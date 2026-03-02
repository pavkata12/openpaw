import type { LLMAdapter, Message } from "./llm.js";

const SUMMARIZE_PROMPT = `Summarize the following conversation in 2-4 sentences. Preserve key facts, decisions, preferences, and context the assistant will need later. Output only the summary, no preamble.`;

export async function summarizeHistory(
  llm: LLMAdapter,
  messages: Message[],
  keepRaw: number
): Promise<Message[]> {
  if (messages.length <= keepRaw) return messages;
  const toSummarize = messages.slice(0, messages.length - keepRaw);
  const tail = messages.slice(-keepRaw);
  const transcript = toSummarize
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");
  const summarizerMessages: Message[] = [
    { role: "user", content: `${SUMMARIZE_PROMPT}\n\nConversation:\n${transcript}` },
  ];
  const response = await llm.chat(summarizerMessages);
  const summaryText =
    response.finishReason === "stop"
      ? response.content.trim()
      : "(Summary unavailable)";
  const summaryMessage: Message = {
    role: "user",
    content: `[Previous conversation summary]: ${summaryText}`,
  };
  return [summaryMessage, ...tail];
}
