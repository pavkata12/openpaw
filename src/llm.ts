import type { Config } from "./config.js";

export type Message = { role: "system" | "user" | "assistant"; content: string };

export interface LLMCapabilities {
  nativeToolCalling: boolean;
}

export interface ChatOptions {
  /** When true, the reply may be read aloud; keep it concise and natural. */
  voice?: boolean;
  /** Optional suffix appended to the system prompt (e.g. from skill pack). */
  systemPromptSuffix?: string;
  /** When set, used as the only system message (replaces base prompt). Used for OPENPAW_SYSTEM_PROMPT_MODE=replace. */
  systemPromptOverride?: string;
}

export interface LLMAdapter {
  chat(messages: Message[], tools?: ToolSpec[], options?: ChatOptions): Promise<LLMResponse>;
  capabilities?: LLMCapabilities;
}

export interface ToolSpec {
  type: "function";
  function: { name: string; description: string; parameters?: { type: "object"; properties?: Record<string, unknown> } };
}

export type LLMResponse =
  | { finishReason: "stop"; content: string }
  | { finishReason: "tool_calls"; content: string; toolCalls: { id: string; name: string; arguments: string }[] };

const SYSTEM_PROMPT_BASE = `You are OpenPaw, a helpful AI assistant that runs on the user's machine. You have tools to read/write files, search code, run shell commands, and more (like Cursor or OpenClaw).

**Planning and execution (Cursor-style):**
- For coding or multi-step tasks: first state a brief plan (1. ... 2. ... 3. ...) then execute step by step with tools.
- Typical flow: read_file or list_dir to understand the codebase → search_in_files to find usages → write_file or apply_patch to make changes → run_shell to build/test/run.
- Prefer one logical step per turn when steps depend on each other; use multiple tool calls in one turn when they are independent (e.g. read two files).
- After each tool result, decide: continue with the next step, or summarize and give the final answer.

**General:** Be concise and helpful. When you use a tool, briefly say what you did. If the user asks you to count or say specific words aloud, reply with exactly those words so they can be spoken—not a description.`;
const VOICE_SUFFIX = ` This reply will be read aloud: keep it concise and natural; avoid long lists or markdown.`;

/** Raw completion - no system prompt. Used by ReAct adapter. */
export async function rawCompletion(
  config: Config,
  messages: Message[],
  _tools?: ToolSpec[]
): Promise<{ content: string }> {
  const base = config.OPENPAW_LLM_BASE_URL.replace(/\/$/, "");
  const model = config.OPENPAW_LLM_MODEL;
  const apiKey = config.OPENPAW_LLM_API_KEY;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, messages, stream: false }),
    });
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error("LLM request timed out (55s). OpenRouter may be slow or the API key/model may be invalid.");
    }
    throw e;
  }
  clearTimeout(timeout);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM failed (${res.status}): ${text.slice(0, 500)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | string[] | null } }>;
  };
  let content = data.choices?.[0]?.message?.content;
  if (Array.isArray(content)) {
    content = content.map((c) => (typeof c === "string" ? c : (c as { text?: string })?.text ?? "")).join("");
  }
  const out = typeof content === "string" ? content : "";
  if (!out.trim()) {
    console.error("[OpenPaw] LLM returned empty content. Check OPENPAW_LLM_API_KEY and OPENPAW_LLM_MODEL in .env");
  }
  return { content: out };
}

function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number }
): Promise<Response> {
  const { timeoutMs = 55_000, ...fetchOpts } = options;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...fetchOpts, signal: controller.signal }).finally(() => clearTimeout(t));
}

export function createLLM(config: Config): LLMAdapter {
  const base = config.OPENPAW_LLM_BASE_URL.replace(/\/$/, "");
  const model = config.OPENPAW_LLM_MODEL;
  const apiKey = config.OPENPAW_LLM_API_KEY;

  const retryCount = config.OPENPAW_LLM_RETRY_COUNT ?? 2;
  const retryDelayMs = config.OPENPAW_LLM_RETRY_DELAY_MS ?? 2000;

  const adapter: LLMAdapter = {
    capabilities: { nativeToolCalling: true },
    async chat(messages: Message[], tools?: ToolSpec[], options?: ChatOptions): Promise<LLMResponse> {
      const systemContent = options?.systemPromptOverride != null
        ? options.systemPromptOverride + (options?.voice ? VOICE_SUFFIX : "")
        : SYSTEM_PROMPT_BASE + (options?.systemPromptSuffix ?? "") + (options?.voice ? VOICE_SUFFIX : "");
      const body: Record<string, unknown> = {
        model,
        messages: [{ role: "system", content: systemContent }, ...messages],
        stream: false,
      };
      if (tools?.length) body.tools = tools;
      if (tools?.length) body.tool_choice = "auto";

      let lastError: Error | null = null;
      for (let attempt = 0; attempt <= retryCount; attempt++) {
        if (attempt > 0) {
          const delay = retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((r) => setTimeout(r, delay));
        }
        try {
          const res = await fetchWithTimeout(`${base}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
            },
            body: JSON.stringify(body),
            timeoutMs: 55_000,
          });

          if (!res.ok) {
            const text = await res.text();
            const err = new Error(`LLM request failed (${res.status}): ${text.slice(0, 500)}`);
            if (res.status >= 500 && attempt < retryCount) {
              lastError = err;
              continue;
            }
            throw err;
          }

          const data = (await res.json()) as {
            choices?: Array<{
              message?: {
                content?: string | null;
                tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
              };
              finish_reason?: string;
            }>;
          };

          const choice = data.choices?.[0];
          if (!choice?.message) throw new Error("Invalid LLM response: no message");

          const msg = choice.message;
          const toolCalls = msg.tool_calls;

          if (toolCalls?.length) {
            return {
              finishReason: "tool_calls",
              content: msg.content ?? "",
              toolCalls: toolCalls.map((tc) => ({
                id: tc.id,
                name: tc.function.name,
                arguments: tc.function.arguments,
              })),
            };
          }

          return {
            finishReason: "stop",
            content: msg.content ?? "",
          };
        } catch (e) {
          lastError = e instanceof Error ? e : new Error(String(e));
          const isRetryable =
            (lastError.name === "AbortError" || (lastError as { code?: string }).code === "ETIMEDOUT") && attempt < retryCount;
          if (!isRetryable) throw lastError;
        }
      }
      throw lastError ?? new Error("LLM request failed after retries");
    },
  };
  return adapter;
}
