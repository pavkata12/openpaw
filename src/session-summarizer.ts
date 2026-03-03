import type { LLMAdapter, Message } from "./llm.js";

const SUMMARIZE_PROMPT = `Summarize the following conversation in 2-4 sentences. Preserve key facts, decisions, preferences, and context the assistant will need later. Output only the summary, no preamble.`;

const SESSION_CONTEXT_PROMPT = `In 2-3 short sentences, summarize what has happened so far in this conversation: what the user asked, what was done (tools used), and the current state. Output only the summary, no preamble.`;

/** Generate a short "session so far" summary from recent history for context injection (no trimming). */
export async function summarizeSessionContext(llm: LLMAdapter, history: Message[]): Promise<string> {
  const lastN = history.slice(-12);
  const transcript = lastN
    .map((m) => {
      const content = m.content.slice(0, 400);
      return `${m.role}: ${content}${m.content.length > 400 ? "…" : ""}`;
    })
    .join("\n");
  const summarizerMessages: Message[] = [
    { role: "user", content: `${SESSION_CONTEXT_PROMPT}\n\nConversation:\n${transcript}` },
  ];
  const response = await llm.chat(summarizerMessages);
  const text = response.finishReason === "stop" ? response.content.trim() : "";
  return text || buildFallbackSummary(history);
}

function buildFallbackSummary(history: Message[]): string {
  const parts: string[] = [];
  for (const m of history.slice(-8)) {
    if (m.role === "user" && m.content.startsWith("[Tool result for ")) {
      const name = m.content.match(/\[Tool result for (\w+)\]/)?.[1] ?? "tool";
      parts.push(`Used ${name}`);
    } else if (m.role === "user") parts.push("User sent a message.");
  }
  return parts.length ? parts.slice(-4).join("; ") : "Recent conversation.";
}

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
