import type { LLMAdapter, Message, ToolSpec } from "./llm.js";
import type { ToolRegistry } from "./tools/types.js";
import { logToolCall } from "./audit.js";

const MAX_TURNS = 10;
const SESSION_SUMMARY_THRESHOLD = 8;
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
}

export async function runAgent(
  llm: LLMAdapter,
  tools: ToolRegistry,
  userMessage: string,
  conversationHistory: Message[] = [],
  options?: RunAgentOptions
): Promise<string> {
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

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await llm.chat(messages, toolSpecs.length ? toolSpecs : undefined, Object.keys(chatOptions).length ? chatOptions : undefined);

    if (response.finishReason === "stop") {
      const text = response.content.trim();
      return text || "Няма отговор от модела. Провери .env (OPENPAW_LLM_API_KEY, OPENPAW_LLM_MODEL) и конзолата на сървъра.";
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
      messages.push({
        role: "user",
        content: `[Tool result for ${tc.name}]: ${result}`,
      });
    }
  }

  return "I hit the turn limit. Try a simpler request.";
}
