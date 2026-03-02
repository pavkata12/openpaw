import type { LLMAdapter, Message, ToolSpec } from "./llm.js";
import type { ToolRegistry } from "./tools/types.js";

const MAX_TURNS = 10;

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
}

export async function runAgent(
  llm: LLMAdapter,
  tools: ToolRegistry,
  userMessage: string,
  conversationHistory: Message[] = [],
  options?: RunAgentOptions
): Promise<string> {
  const messages: Message[] = [...conversationHistory, { role: "user", content: userMessage }];
  const toolDefs = tools.list();
  const toolSpecs: ToolSpec[] = toolDefs.length ? toolDefs.map(toolDefToSpec) : [];
  const chatOptions = options?.voice ? { voice: true as const } : undefined;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const response = await llm.chat(messages, toolSpecs.length ? toolSpecs : undefined, chatOptions);

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
      const tool = tools.get(tc.name);
      let result: string;
      try {
        const args = JSON.parse(tc.arguments || "{}") as Record<string, unknown>;
        result = tool ? await tool.execute(args) : `Unknown tool: ${tc.name}`;
      } catch (e) {
        result = `Tool error: ${e instanceof Error ? e.message : String(e)}`;
      }
      messages.push({
        role: "user",
        content: `[Tool result for ${tc.name}]: ${result}`,
      });
    }
  }

  return "I hit the turn limit. Try a simpler request.";
}
