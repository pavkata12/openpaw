import type { Config } from "../config.js";
import type { ChatOptions, LLMAdapter, Message, ToolSpec } from "../llm.js";
import { rawCompletion } from "../llm.js";
import type { ToolRegistry } from "../tools/types.js";

const REACT_SYSTEM = `You are OpenPaw, a helpful AI assistant. You can use tools by outputting:
Action: tool_name {"arg":"value"}
Use valid JSON for arguments. When done, output:
Final Answer: your response to the user

**Planning and execution (Cursor-style):** For coding or multi-step tasks, first output a short plan, then run tools in order. Example:
Plan: 1. read_file to see the code 2. search_in_files to find usages 3. apply_patch or write_file to change 4. run_shell to test
Then use Action: read_file ... etc. Prefer read before edit, search before change, then run. One step per Action when steps depend on each other.

Be clear and natural. When the user asks you to count, say something aloud, or speak specific words (e.g. "count to 10"), your Final Answer must be exactly those words—e.g. "1, 2, 3, 4, 5, 6, 7, 8, 9, 10"—not a description like "I've counted to 10."

Available tools:`;

const REACT_VOICE_SUFFIX = `

[This reply will be read aloud. Keep it concise and natural; avoid long lists or markdown.]`;

function formatToolsForPrompt(tools: ToolRegistry): string {
  return tools
    .list()
    .map(
      (t) =>
        `- ${t.name}: ${t.description}${t.parameters?.properties ? ` (args: ${Object.keys(t.parameters.properties).join(", ")})` : ""}`
    )
    .join("\n");
}

export function parseReActOutput(content: string): { type: "action"; name: string; arguments: string } | { type: "final"; content: string } | null {
  const trimmed = content.trim();
  const actionMatch = trimmed.match(/Action:\s*(\w+)\s*(\{[\s\S]*?\})/);
  if (actionMatch) {
    return { type: "action", name: actionMatch[1], arguments: actionMatch[2] };
  }
  const finalMatch = trimmed.match(/Final Answer:\s*([\s\S]*)/i);
  if (finalMatch) {
    return { type: "final", content: finalMatch[1].trim() };
  }
  return null;
}

export function createReActLLM(config: Config, tools: ToolRegistry): LLMAdapter {
  const toolList = formatToolsForPrompt(tools);
  const systemPrompt = `${REACT_SYSTEM}\n${toolList}`;

  return {
    capabilities: { nativeToolCalling: false },
    async chat(messages: Message[], _tools?: ToolSpec[], options?: ChatOptions) {
      const systemContent = systemPrompt + (options?.voice ? REACT_VOICE_SUFFIX : "");
      const msgs: Message[] = [
        { role: "system", content: systemContent },
        ...messages.filter((m) => m.role !== "system"),
      ];
      const { content } = await rawCompletion(config, msgs);
      const parsed = parseReActOutput(content);
      if (parsed?.type === "action") {
        return {
          finishReason: "tool_calls" as const,
          content,
          toolCalls: [{ id: "react-1", name: parsed.name, arguments: parsed.arguments }],
        };
      }
      if (parsed?.type === "final") {
        return { finishReason: "stop" as const, content: parsed.content };
      }
      // Model didn't use "Final Answer:" — use whole response as reply (many models ignore the format)
      const fallback = content.trim();
      return { finishReason: "stop" as const, content: fallback || "Няма отговор. Провери OPENPAW_LLM_API_KEY и модела в .env" };
    },
  };
}
