import type { LLMAdapter } from "./llm.js";
import type { ToolRegistry } from "./tools/types.js";
import { runAgent } from "./agent.js";
import { createSessionManager } from "./session.js";
import { createLaneQueue } from "./lane-queue.js";
import type { InboundMessage, ChannelAdapter, SendContext } from "./channels/types.js";
import { sessionContext } from "./session-context.js";
import type { Config } from "./config.js";
import { OPENPAW_NEEDS_APPROVAL_PREFIX } from "./tools/shell.js";
import { startBackgroundJob } from "./background-jobs.js";
import { loadSessions } from "./session-store.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Reads SOUL.md or .openpaw/system-prompt.md from workspace. Returns null if missing or unreadable. */
function readWorkspaceSystemPrompt(workspacePath: string): string | null {
  const soulPath = join(workspacePath, "SOUL.md");
  const altPath = join(workspacePath, ".openpaw", "system-prompt.md");
  for (const p of [soulPath, altPath]) {
    if (existsSync(p)) {
      try {
        const content = readFileSync(p, "utf-8").trim();
        if (content) return content;
      } catch {
        /* ignore */
      }
    }
  }
  return null;
}

export interface RouterDeps {
  llm: LLMAdapter;
  tools: ToolRegistry;
  config?: Config;
  /** Optional system prompt suffix (e.g. from skill pack). */
  systemPromptSuffix?: string;
}

export async function createRouter(deps: RouterDeps) {
  const { llm, tools, config, systemPromptSuffix } = deps;
  const summarizeThreshold = config?.OPENPAW_HISTORY_SUMMARIZE_THRESHOLD ?? 0;
  const keepRaw = config?.OPENPAW_HISTORY_KEEP_RAW ?? 10;
  const ttlHours = config?.OPENPAW_SESSION_TTL_HOURS ?? 24;
  const maxHistory = config?.OPENPAW_SESSION_MAX_HISTORY ?? 50;
  const sessionTtlMs = ttlHours * 60 * 60 * 1000;
  let initialSessions: Map<string, import("./session.js").Session> | undefined;
  const sessionStorePath = config?.OPENPAW_DATA_DIR
    ? join(config.OPENPAW_DATA_DIR, "sessions.json")
    : undefined;
  if (sessionStorePath) {
    initialSessions = await loadSessions(sessionStorePath, sessionTtlMs);
  }
  const sessions = createSessionManager({
    ...(summarizeThreshold > 0 ? { llm, summarizeThreshold, keepRaw } : {}),
    sessionStorePath,
    initialSessions,
    ttlMs: sessionTtlMs,
    maxHistory,
  });
  const laneQueue = createLaneQueue();
  const channels = new Map<string, ChannelAdapter>();

  const pendingApproval = new Map<string, { command: string }>();
  function isApproveText(text: string): boolean {
    const t = text.trim().toLowerCase();
    return t === "approve" || t === "yes" || t === "y";
  }

  /** If text is a shortcut (/recon, /wireless, /webscan), return a user message that triggers the right tool. */
  function parseShortcut(text: string): string | null {
    const t = text.trim();
    const reconMatch = t.match(/^\/recon\s+(.+)$/i);
    if (reconMatch) return `Run nmap_scan with target ${reconMatch[1].trim()}. Quick scan.`;
    if (/^\/wireless\s*$/i.test(t)) return "Run wireless_scan to list nearby Wi-Fi networks.";
    const webscanMatch = t.match(/^\/webscan\s+(.+)$/i);
    if (webscanMatch) return `Run nikto_scan on URL ${webscanMatch[1].trim()}.`;
    return null;
  }

  function registerChannel(adapter: ChannelAdapter): void {
    channels.set(adapter.name, adapter);
    adapter.onMessage((msg) => handleMessage(adapter.name, msg).catch(() => {}));
  }

  async function handleMessage(adapterName: string, msg: InboundMessage): Promise<void> {
    const sessionKey = sessions.getSessionKey(adapterName, msg.userId);
    const adapter = channels.get(adapterName);
    const context: SendContext | undefined = msg.metadata
      ? { ...msg.metadata, channelId: msg.metadata.channelId as string | undefined }
      : undefined;
    await laneQueue.enqueue(sessionKey, async () => {
      const pending = pendingApproval.get(sessionKey);
      if (pending && isApproveText(msg.text)) {
        pendingApproval.delete(sessionKey);
        const shellTool = tools.get("run_shell");
        const result = shellTool
          ? await shellTool.execute({ command: pending.command })
          : "Error: run_shell not available.";
        await sessions.appendMessage(sessionKey, { role: "user", content: msg.text });
        await sessions.appendMessage(sessionKey, { role: "assistant", content: result });
        if (adapter) await adapter.send(msg.userId, { text: result }, context);
        return;
      }
      const history = sessions.getHistory(sessionKey);
      let userText = msg.text;
      const shortcut = parseShortcut(userText);
      if (shortcut) userText = shortcut;
      if (history.length === 0 && config?.OPENPAW_WORKSPACE) {
        const targetPath = join(config.OPENPAW_WORKSPACE, "TARGET.md");
        const contextPath = join(config.OPENPAW_WORKSPACE, ".openpaw", "context.md");
        let contextContent: string | undefined;
        if (existsSync(targetPath)) {
          try {
            contextContent = readFileSync(targetPath, "utf-8").trim();
          } catch {
            /* ignore */
          }
        }
        if (!contextContent && existsSync(contextPath)) {
          try {
            contextContent = readFileSync(contextPath, "utf-8").trim();
          } catch {
            /* ignore */
          }
        }
        if (contextContent) {
          userText = `Current target/context:\n\`\`\`\n${contextContent}\n\`\`\`\n\nUser request: ${msg.text}`;
        }
      }
      const auditOpts =
        config?.OPENPAW_AUDIT_LOG && config?.OPENPAW_AUDIT_LOG_PATH
          ? { audit: { enabled: true, path: config.OPENPAW_AUDIT_LOG_PATH }, channel: adapterName }
          : undefined;
      const mode = config?.OPENPAW_SYSTEM_PROMPT_MODE ?? "default";
      const workspacePrompt = config?.OPENPAW_WORKSPACE && mode !== "default" ? readWorkspaceSystemPrompt(config.OPENPAW_WORKSPACE) : null;
      let effectiveSuffix: string | undefined;
      let effectiveOverride: string | undefined;
      if (mode === "replace" && workspacePrompt != null) {
        effectiveOverride = workspacePrompt;
      } else if (mode === "append" && workspacePrompt != null) {
        effectiveSuffix = systemPromptSuffix ? `${workspacePrompt}\n\n${systemPromptSuffix}` : workspacePrompt;
      } else if (systemPromptSuffix) {
        effectiveSuffix = systemPromptSuffix;
      }
      const onBeforeToolCall =
        config?.OPENPAW_DATA_DIR && (adapterName === "discord" || adapterName === "telegram" || adapterName === "cli" || adapterName === "web")
          ? async (toolName: string, args: Record<string, unknown>): Promise<string | null> => {
              const runInBackground = args?.background === true || args?.background === "true";
              if (!runInBackground || (toolName !== "run_shell" && toolName !== "nmap_scan")) return null;
              const argsCopy = { ...args };
              delete argsCopy.background;
              const id = startBackgroundJob(
                config!.OPENPAW_DATA_DIR,
                {
                  toolName,
                  args: argsCopy,
                  channel: adapterName,
                  userId: msg.userId,
                  channelId: context?.channelId as string | undefined,
                },
                tools,
                async (job, result) => {
                  const ad = channels.get(job.channel ?? "");
                  if (ad && job.userId) {
                    const text =
                      job.status === "done"
                        ? `[Background job ${job.id} done]\n${(result ?? "").slice(0, 4000)}`
                        : `[Background job ${job.id} failed]\n${job.error ?? "Unknown error"}`;
                    await ad.send(job.userId, { text }, { channelId: job.channelId });
                  }
                }
              );
              return `Job started. ID: ${id}. You will be notified when done.`;
            }
          : undefined;
      const reply = await sessionContext.run({ sessionKey }, () =>
        runAgent(llm, tools, userText, history, {
          voice: msg.metadata?.voice === true,
          ...auditOpts,
          onBeforeToolCall,
          ...(effectiveSuffix != null ? { systemPromptSuffix: effectiveSuffix } : {}),
          ...(effectiveOverride != null ? { systemPromptOverride: effectiveOverride } : {}),
        })
      );
      let replyToUser = reply;
      if (reply.startsWith(OPENPAW_NEEDS_APPROVAL_PREFIX)) {
        const command = reply.slice(OPENPAW_NEEDS_APPROVAL_PREFIX.length).trim();
        pendingApproval.set(sessionKey, { command });
        replyToUser = `This command requires approval: ${command}\nReply with "approve" to run it.`;
      }
      await sessions.appendMessage(sessionKey, { role: "user", content: userText });
      await sessions.appendMessage(sessionKey, { role: "assistant", content: replyToUser });
      if (adapter) {
        await adapter.send(msg.userId, { text: replyToUser }, context);
      }
    });
  }

  return { registerChannel, handleMessage };
}
