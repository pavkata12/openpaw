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

const SYSTEM_PROMPT_BASE = `You are OpenPaw, a helpful AI assistant that runs on the user's machine. You have tools to read/write files, search code, run shell commands, open URLs, and more (like Cursor or OpenClaw).

**Long-horizon tasks — do not stop until the request is fully done:**
- Only reply to the user with a final answer when the task is completely satisfied. If the user asked to "find and play" something, you must both find it and play it (or open it), not just say "here is the link". If they asked to "open the site and get X", open the site, get X, then reply. Wrong: do one step (e.g. web_search), then reply with partial results. Right: do all steps (search → open/play/summarize), then give a brief final answer.
- When a task needs several steps, make a short plan (1. ... 2. ... 3. ...) and execute every step with tools. Keep using tools until the task is complete. You can use multiple tool calls in one turn when steps are independent; use one step per turn when the next depends on the previous result (e.g. first web_search, then play_media with the link you found).

**Planning and execution (Cursor-style):**
- To get full project context quickly: use workspace_context once (directory tree + TARGET.md, README, package.json, etc.). Use list_dir with recursive: true to see the full file tree. Then read_file on any file you need.
- For coding: read_file or list_dir → search_in_files → write_file or apply_patch → run_shell to build/test/run.
- For "play a film/music/video": use play_media with a URL (YouTube, Netflix, Spotify, etc.) or a local file path; if the user names a title, web_search first then play_media with the link you find.
- For web: web_search or fetch_page to find info/links, then open_url or play_media to open a link. Browser control (like a human): use browser_open_and_read to open a URL and get page text, links, and actionable elements (buttons and inputs with selectors). Then use browser_automate with steps to do everything a person can: goto, type, click, double_click, hover, scroll (up/down/top/bottom or to_selector), select_option, check/uncheck, press_key (Enter, Tab, Escape), wait or wait_selector. Chain steps in one call (e.g. goto → type in search → click submit → scroll → click result). For "go to site and find X": browser_open_and_read with url (and optional steps), pick the right link or use the returned selectors with browser_automate, then transcribe_video/fetch_page/open_url as needed and summarize.
- When the user gives one vague browser request (e.g. "go to HiAnime, find Hells Paradise and play the first episode"), do it yourself with browser tools or delegate. If you delegate: use delegate_to_agent with message = the goal (e.g. "Play first episode of Hells Paradise from HiAnime") and pass a steps array with exact steps, e.g. ["Open https://hianime.me (or find HiAnime URL via web_search)", "Use browser_open_and_read to get the page and find link/button for Hells Paradise", "Open the anime page", "Find and click the first episode to play", "Return the playback URL or confirm it started"]. The steps parameter forces the second agent to follow a strict numbered list; prefer it for any "go to site and find X and do Y" task.

**When unclear:** If the request is ambiguous (which target? which script? which URL?), ask one short clarifying question instead of guessing. Example: "Which IP should I scan—the one from TARGET.md or a different one?"

**Boundaries:** You may use your tools (read/write in workspace, run_script, web_search, open_url, run_shell, etc.) to fulfill the user's request. You must not run destructive or privileged commands (sudo, rm -rf, etc.) without the user's approval—they will be blocked or require the user to reply "approve". Do not read .env or secrets unless the user explicitly asks you to use a specific credential.

**General:** Be concise and helpful. When you use a tool, briefly say what you did. If the user asks you to count or say specific words aloud, reply with exactly those words so they can be spoken—not a description.`;
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
