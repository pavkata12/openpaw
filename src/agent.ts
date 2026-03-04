import type { LLMAdapter, Message, ToolSpec } from "./llm.js";
import type { ToolRegistry } from "./tools/types.js";
import { logToolCall } from "./audit.js";

const MAX_TURNS_DEFAULT = 20;
const SESSION_SUMMARY_THRESHOLD = 8;
/** Injected after each tool result when completion reminder is on, to reduce early stopping (research: persistence reminders improve multi-step completion). */
const COMPLETION_REMINDER =
  "\n\n[Reminder: Only reply to the user with a final answer when their request is fully completed. If you still need to do something (e.g. open the link, play the media, summarize the page, add to cart), call a tool now. Do not stop with partial results like \"here is the link\"—finish the action, then reply.]";

const VERIFY_PROMPT = (userRequest: string, assistantReply: string) =>
  `Original user request: ${userRequest}\n\nAssistant's final reply to the user: ${assistantReply}\n\nIs the user's request fully satisfied (everything they asked for has been done)? Reply with exactly YES or NO.`;

/** Exported for tests. Returns true if the verification reply indicates the task is complete (YES). */
export function isVerifiedYes(content: string): boolean {
  const t = content.trim().toUpperCase();
  if (t === "YES") return true;
  if (t.startsWith("YES") && !t.includes("NO")) return true;
  return false;
}
const SESSION_SUMMARY_LAST_N = 10;
const SESSION_SUMMARY_SNIPPET = 70;

/** Build a short "session so far" from recent history so the model doesn't lose the thread. */
function buildSessionSummary(history: Message[]): string {
  const events: string[] = [];
  const take = history.slice(-SESSION_SUMMARY_LAST_N);
  for (const m of take) {
    if (m.role === "user") {
      if (m.content.startsWith("[Tool result for ")) {
        const match = m.content.match(/\[Tool result for (\w+)\]:\s*(.*)/s);
        const name = match ? match[1] : "tool";
        const rest = (match ? match[2] : m.content).trim();
        const snippet = rest.length > SESSION_SUMMARY_SNIPPET ? rest.slice(0, SESSION_SUMMARY_SNIPPET) + "…" : rest;
        events.push(`  • ${name}: ${snippet}`);
      } else {
        const line = m.content.split(/\n/)[0].trim();
        const snippet = line.length > 60 ? line.slice(0, 60) + "…" : line;
        events.push(`  • User: ${snippet}`);
      }
    } else if (m.role === "assistant" && events.length > 0) {
      const last = events[events.length - 1];
      if (!last.startsWith("  • User:")) continue;
      events.push("  • Assistant replied.");
    }
  }
  if (events.length === 0) return "";
  return events.slice(-6).join("\n");
}

function toolDefToSpec(
  def: { name: string; description: string; parameters?: Record<string, unknown> }
): ToolSpec {
  return {
    type: "function",
    function: {
      name: def.name,
      description: def.description,
      parameters: def.parameters as ToolSpec["function"]["parameters"],
    },
  };
}

export interface RunAgentOptions {
  /** When true, the reply may be read aloud (e.g. voice UI). */
  voice?: boolean;
  /** When set, tool calls are appended to the audit log file. */
  audit?: { enabled: boolean; path: string };
  /** Optional channel name for audit log (e.g. "cli", "telegram"). */
  channel?: string;
  /** If provided and returns a string, that string is used as the tool result and the tool is not executed (e.g. for background jobs). */
  onBeforeToolCall?: (toolName: string, args: Record<string, unknown>) => Promise<string | null>;
  /** Optional suffix appended to the system prompt (e.g. from skill pack). */
  systemPromptSuffix?: string;
  /** When set, used as the only system message (SOUL.md replace mode). */
  systemPromptOverride?: string;
  /** When set and history is long, used to generate a short "session so far" summary (LLM). Overrides heuristic summary. */
  sessionSummaryFn?: (history: Message[]) => Promise<string>;
  /** Tool names to hide from this run (e.g. delegate_to_agent when running the second agent to avoid recursion). */
  excludeToolNames?: string[];
  /** Max tool-calling turns (plan + execute) before returning. Default 20. */
  maxTurns?: number;
  /** When true (default), append a short reminder after each tool result so the agent continues until the task is fully done. Set false to disable. */
  completionReminder?: boolean;
  /** When true, when the agent returns "stop" we ask the LLM once if the user's request is fully satisfied (YES/NO). If NO, inject a message and continue for another turn. Adds one extra LLM call per completion. */
  verifyCompletion?: boolean;
  /** When set (dual-agent), cleared at the start of each top-level run so the second agent gets fresh context for the new request; the delegate tool appends each exchange here so later delegate calls in the same run see previous ones. */
  delegateHistoryRef?: { history: Array<{ request: string; response: string }> };
}

export async function runAgent(
  llm: LLMAdapter,
  tools: ToolRegistry,
  userMessage: string,
  conversationHistory: Message[] = [],
  options?: RunAgentOptions
): Promise<string> {
  if (options?.delegateHistoryRef) options.delegateHistoryRef.history = [];
  let effectiveUserMessage = userMessage;
  if (conversationHistory.length >= SESSION_SUMMARY_THRESHOLD) {
    let summary = "";
    if (options?.sessionSummaryFn) {
      try {
        summary = await options.sessionSummaryFn(conversationHistory);
      } catch {
        summary = buildSessionSummary(conversationHistory);
      }
    } else {
      summary = buildSessionSummary(conversationHistory);
    }
    if (summary) effectiveUserMessage = `Session so far:\n${summary}\n\nCurrent request: ${userMessage}`;
  }
  const messages: Message[] = [...conversationHistory, { role: "user", content: effectiveUserMessage }];
  const toolDefs = tools
    .list()
    .filter((d) => !options?.excludeToolNames?.includes(d.name));
  const toolSpecs: ToolSpec[] = toolDefs.length ? toolDefs.map(toolDefToSpec) : [];
  const chatOptions = {
    ...(options?.voice ? { voice: true as const } : {}),
    ...(options?.systemPromptSuffix ? { systemPromptSuffix: options.systemPromptSuffix } : {}),
    ...(options?.systemPromptOverride != null ? { systemPromptOverride: options.systemPromptOverride } : {}),
  };

  const maxTurns = options?.maxTurns ?? MAX_TURNS_DEFAULT;
  const useCompletionReminder = options?.completionReminder !== false;

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await llm.chat(messages, toolSpecs.length ? toolSpecs : undefined, Object.keys(chatOptions).length ? chatOptions : undefined);

    if (response.finishReason === "stop") {
      const text = response.content.trim();
      const finalText = text || "No response from the model. Check .env (OPENPAW_LLM_API_KEY, OPENPAW_LLM_MODEL) and the server console.";

      if (options?.verifyCompletion && text) {
        try {
          const verifyMessages: Message[] = [{ role: "user", content: VERIFY_PROMPT(userMessage, text.slice(0, 2000)) }];
          const verifyResponse = await llm.chat(verifyMessages);
          const verifyContent = verifyResponse.finishReason === "stop" ? verifyResponse.content.trim() : "";
          if (!isVerifiedYes(verifyContent)) {
            messages.push({ role: "assistant", content: response.content || "" });
            messages.push({
              role: "user",
              content: "[Verification: The task is not yet complete. Continue with the next step—use a tool if something is still missing, then give a final reply.]",
            });
            continue;
          }
        } catch {
          /* on verify error, accept the reply and return */
        }
      }
      return finalText;
    }

    if (response.finishReason !== "tool_calls" || !response.toolCalls?.length) {
      return response.content.trim() || "Done.";
    }

    messages.push({
      role: "assistant",
      content: response.content || "",
    });

    for (const tc of response.toolCalls) {
      let result: string;
      const toolArgs = JSON.parse(tc.arguments || "{}") as Record<string, unknown>;
      if (options?.onBeforeToolCall) {
        const override = await options.onBeforeToolCall(tc.name, toolArgs);
        if (override != null) {
          result = override;
        } else {
          const tool = tools.get(tc.name);
          try {
            result = tool ? await tool.execute(toolArgs) : `Unknown tool: ${tc.name}`;
          } catch (e) {
            result = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
          }
        }
      } else {
        const tool = tools.get(tc.name);
        try {
          result = tool ? await tool.execute(toolArgs) : `Unknown tool: ${tc.name}`;
        } catch (e) {
          result = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      if (options?.audit?.enabled && options.audit.path) {
        await logToolCall(
          { enabled: true, path: options.audit.path },
          { toolName: tc.name, args: toolArgs, resultSummary: result, channel: options.channel }
        );
      }
      const toolResultContent =
        `[Tool result for ${tc.name}]: ${result}` +
        (useCompletionReminder ? COMPLETION_REMINDER : "");
      messages.push({
        role: "user",
        content: toolResultContent,
      });
    }
  }

  return "I hit the turn limit (" + maxTurns + " steps). Try a simpler request or increase OPENPAW_AGENT_MAX_TURNS.";
}
