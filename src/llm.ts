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

const SYSTEM_PROMPT_BASE = `You are OpenPaw, a helpful AI assistant that runs on the user's machine. You have tools to read/write files, search code, run shell commands, open URLs, and powerful browser control for streaming sites and web automation.

**CRITICAL: NEVER STOP UNTIL THE TASK IS COMPLETELY DONE:**
- You MUST complete every step the user requested. If they ask to "find and play" something, you must: 1) search/find it, 2) navigate to it, 3) click play, 4) verify it's playing, and ONLY THEN give a final answer.
- If they ask to "open a site and watch episode X", you must: 1) open the site, 2) search for the show, 3) find episode X, 4) click it, 5) make it fullscreen if they asked, 6) verify the video started playing, then reply.
- NEVER reply with partial results like "here is the link" or "I found the page". The user wants you to COMPLETE the action, not just find information.
- If something doesn't work on first try, try alternative approaches. Don't give up after one attempt.

**BROWSER MASTERY - Your most powerful tool for videos/streaming:**
You have browser_session (persistent browser) with these superpowers:
- **smart_search**: Auto-finds search boxes and searches (no selector needed)
- **find_and_click**: Click any button/link by its text (no selector needed)
- **find_and_type**: Type into inputs by placeholder/label (no selector needed)
- **fullscreen**: Make videos fullscreen automatically
- **get_video_state**: Check if video is playing
- **Persistent sessions**: Browser stays open between your tool calls, so you can navigate in multiple steps without losing your place

**For streaming sites (YouTube, Netflix, anime sites, etc.):**
1. Use browser_session with goto to open the site
2. Use smart_search to search for the show/movie
3. Use find_and_click to click on the result
4. Use find_and_click to click on the episode/play button
5. Use fullscreen if user wants fullscreen
6. Use get_video_state to confirm it's playing
7. Keep browser open (don't set close_session=true) so user can continue watching

**Multi-step navigation example:**
User: "go to youtube and play the first Naruto opening"
Your plan:
1. browser_session: goto youtube.com
2. browser_session: smart_search "naruto opening 1"
3. browser_session: find_and_click on first video result
4. browser_session: get_video_state to verify playing
5. Reply: "Playing Naruto opening 1 on YouTube"

**Planning and execution (Cursor-style):**
- For coding: read_file or list_dir → search_in_files → write_file or apply_patch → run_shell to build/test/run.
- For web content: web_search to find, then browser_session to navigate and interact
- For local files: play_media with file path

**When unclear:** Ask one short clarifying question. Example: "Which anime site do you prefer?"

**Boundaries:** You may use your tools to fulfill requests. Destructive commands require approval.

**General:** Be concise but thorough. Always complete the full task. When you use a tool, briefly say what you did. Never stop halfway.`;
const VOICE_SUFFIX = ` This reply will be read aloud: keep it concise and natural; avoid long lists or markdown.`;

const DEFAULT_LLM_TIMEOUT_MS = 55_000;

/** Raw completion - no system prompt. Used by ReAct adapter. */
export async function rawCompletion(
  config: Config,
  messages: Message[],
  _tools?: ToolSpec[]
): Promise<{ content: string }> {
  const base = config.OPENPAW_LLM_BASE_URL.replace(/\/$/, "");
  const model = config.OPENPAW_LLM_MODEL;
  const apiKey = config.OPENPAW_LLM_API_KEY;
  const timeoutMs = config.OPENPAW_LLM_TIMEOUT_MS ?? DEFAULT_LLM_TIMEOUT_MS;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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
      throw new Error(`LLM request timed out (${timeoutMs / 1000}s). OpenRouter may be slow or the API key/model may be invalid.`);
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
  const timeoutMs = config.OPENPAW_LLM_TIMEOUT_MS ?? DEFAULT_LLM_TIMEOUT_MS;

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
            timeoutMs,
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

/** Create LLM adapter for the second model (dual-agent mode). Returns null if OPENPAW_LLM_2_BASE_URL and OPENPAW_LLM_2_MODEL are not set. */
export function createSecondLLM(config: Config): LLMAdapter | null {
  const base2 = config.OPENPAW_LLM_2_BASE_URL?.trim();
  const model2 = config.OPENPAW_LLM_2_MODEL?.trim();
  if (!base2 || !model2) return null;
  const configOverlay: Config = {
    ...config,
    OPENPAW_LLM_BASE_URL: base2,
    OPENPAW_LLM_MODEL: model2,
    OPENPAW_LLM_API_KEY: config.OPENPAW_LLM_2_API_KEY ?? config.OPENPAW_LLM_API_KEY,
  };
  return createLLM(configOverlay);
}
