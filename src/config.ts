import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Project root: folder above dist/ when running compiled code. */
const projectRoot = resolve(__dirname, "..");

const EnvSchema = z.object({
  OPENPAW_LLM_BASE_URL: z.string().default("http://localhost:11434/v1"),
  OPENPAW_LLM_MODEL: z.string().default("llama3.2"),
  OPENPAW_LLM_API_KEY: z.string().optional(),
  OPENPAW_DISCORD_TOKEN: z.string().optional(),
  OPENPAW_DISCORD_ALLOWED_IDS: z.string().optional(),
  OPENPAW_DATA_DIR: z.string().default("./.openpaw"),
  OPENPAW_CONFIG: z.string().optional(),
  OPENPAW_LOG_FORMAT: z.enum(["text", "json"]).default("text"),
  OPENPAW_SHELL_ALLOWED: z.string().optional(),
  OPENPAW_SHELL_BLOCKED_PATHS: z.string().optional(),
  /** When true, shell tool has full control: no allowlist/blocklist, cwd support, proper shell (cmd/bash). Like OpenClaw. */
  OPENPAW_SHELL_FULL_CONTROL: z
    .string()
    .default("false")
    .transform((v) => v === "1" || v === "true"),
  /** Shell command timeout in ms (default 60000 when full control, 30000 otherwise). */
  OPENPAW_SHELL_TIMEOUT: z.coerce.number().optional(),
  OPENPAW_MEMORY_MAX_ENTRIES: z.coerce.number().default(1000),
  OPENPAW_AGENT_MODE: z.enum(["native", "react", "auto"]).default("auto"),
  OPENPAW_HISTORY_SUMMARIZE_THRESHOLD: z.coerce.number().default(20),
  OPENPAW_HISTORY_KEEP_RAW: z.coerce.number().default(10),
  OPENPAW_SCHEDULER_ENABLED: z
    .string()
    .default("true")
    .transform((v) => v !== "0" && v !== "false"),
  OPENPAW_EMAIL_HOST: z.string().optional(),
  OPENPAW_EMAIL_PORT: z.coerce.number().optional(),
  OPENPAW_EMAIL_USER: z.string().optional(),
  OPENPAW_EMAIL_PASS: z.string().optional(),
  OPENPAW_EMAIL_SECURE: z.string().optional().transform((v) => v === "1" || v === "true"),
  OPENPAW_TELEGRAM_BOT_TOKEN: z.string().optional(),
  OPENPAW_TELEGRAM_ALLOWED_IDS: z.string().optional(),
  OPENPAW_KNOWLEDGE_DIR: z.string().optional(),
  OPENPAW_EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  /** Local Whisper STT model: Xenova/whisper-tiny.en (English only) or Xenova/whisper-tiny (multilingual). */
  OPENPAW_STT_MODEL: z.string().default("Xenova/whisper-tiny.en"),
  /** STT language for multilingual Whisper (e.g. "bulgarian", "english"). Empty = auto-detect. */
  OPENPAW_STT_LANGUAGE: z.string().optional(),
  /** TTS language for browser SpeechSynthesis (e.g. "bg-BG", "en-US"). Empty = browser default. */
  OPENPAW_TTS_LANG: z.string().optional(),
  /** Google Custom Search API key (for google_search tool). Get from Google Cloud Console, enable Custom Search API. */
  OPENPAW_GOOGLE_SEARCH_API_KEY: z.string().optional(),
  /** Google Programmable Search Engine ID (cx). Create at https://programmablesearchengine.google.com/ */
  OPENPAW_GOOGLE_SEARCH_ENGINE_ID: z.string().optional(),
  /** STT provider: "local" (Whisper via Transformers.js) or "elevenlabs". */
  OPENPAW_STT_PROVIDER: z.enum(["local", "elevenlabs"]).default("local"),
  /** ElevenLabs API key, used when OPENPAW_STT_PROVIDER=elevenlabs. */
  ELEVENLABS_API_KEY: z.string().optional(),
  /** ElevenLabs STT model id (e.g. "scribe_v2"). */
  ELEVENLABS_STT_MODEL_ID: z.string().default("scribe_v2"),
  /** ElevenLabs STT language code (e.g. "bg" for Bulgarian). Optional. */
  ELEVENLABS_STT_LANGUAGE_CODE: z.string().optional(),
});

export type Config = z.infer<typeof EnvSchema>;

function resolveDataDir(raw: string): string {
  if (raw.startsWith("/") || (raw.length >= 2 && raw[1] === ":")) return raw;
  const base = process.env.OPENPAW_CONFIG
    ? resolve(process.cwd(), process.env.OPENPAW_CONFIG)
    : process.cwd();
  const resolved = resolve(base, raw);
  return resolved;
}

export function loadConfig(): Config {
  const configPath = process.env.OPENPAW_CONFIG;
  const configDir = configPath ? dirname(resolve(process.cwd(), configPath)) : process.cwd();
  const candidates = [
    resolve(projectRoot, ".env"),
    resolve(configDir, ".env"),
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
  ];
  const toLoad = candidates.find((p) => existsSync(p));
  if (!toLoad) {
    const tried = candidates.join(", ");
    console.error(
      "[OpenPaw] No .env file found. Tried: " + tried + "\n  Copy .env.example to .env and configure: cp .env.example .env"
    );
  } else if (toLoad !== candidates[0]) {
    console.warn("[OpenPaw] Loaded .env from: " + toLoad);
  }
  if (toLoad) {
    const raw = readFileSync(toLoad, "utf-8");
    const parsed: Record<string, string> = {};
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) parsed[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
    Object.assign(process.env, parsed);
  }
  const parsed = EnvSchema.parse(process.env);
  return {
    ...parsed,
    OPENPAW_DATA_DIR: resolveDataDir(parsed.OPENPAW_DATA_DIR),
  };
}
