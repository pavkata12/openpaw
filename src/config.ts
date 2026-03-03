import { z } from "zod";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
/** Project root: folder above dist/ when running compiled code. */
const projectRoot = resolve(__dirname, "..");

const EnvSchema = z.object({
  OPENPAW_LLM_BASE_URL: z.string().default("http://localhost:11434/v1"),
  OPENPAW_LLM_MODEL: z.string().default("llama3.2"),
  OPENPAW_LLM_API_KEY: z.string().optional(),
  /** Number of retries on LLM API timeout or 5xx. Default 2. */
  OPENPAW_LLM_RETRY_COUNT: z.coerce.number().default(2),
  /** Delay in ms before first retry; doubles each time. Default 2000. */
  OPENPAW_LLM_RETRY_DELAY_MS: z.coerce.number().default(2000),
  /** Optional skill pack name (recon, wireless, web, full). When set, only pack tools + base (remember, recall, run_shell) are registered. Use "full" or leave unset for all tools. */
  OPENPAW_PACK: z.string().optional(),
  /** System prompt from workspace file: default = ignore file; append = base + SOUL.md/content; replace = only file content. */
  OPENPAW_SYSTEM_PROMPT_MODE: z.enum(["default", "append", "replace"]).default("default"),
  OPENPAW_DISCORD_TOKEN: z.string().optional(),
  OPENPAW_DISCORD_ALLOWED_IDS: z.string().optional(),
  OPENPAW_DATA_DIR: z.string().default("./.openpaw"),
  OPENPAW_CONFIG: z.string().optional(),
  /** Root directory for code tools (read_file, write_file, list_dir, search_in_files, apply_patch). Paths are resolved against this. Default: current working directory. */
  OPENPAW_WORKSPACE: z.string().default("."),
  /** When true, log every tool call to an audit file (tool name, args, result summary). Useful for Kali/engagements. */
  OPENPAW_AUDIT_LOG: z.string().default("false").transform((v) => v === "1" || v === "true"),
  /** Path to audit log file. If unset, uses {OPENPAW_DATA_DIR}/audit.log */
  OPENPAW_AUDIT_LOG_PATH: z.string().optional(),
  /** Directory for run_script tool (predefined scripts). If unset, uses {OPENPAW_DATA_DIR}/scripts */
  OPENPAW_SCRIPTS_DIR: z.string().optional(),
  OPENPAW_LOG_FORMAT: z.enum(["text", "json"]).default("text"),
  OPENPAW_SHELL_ALLOWED: z.string().optional(),
  OPENPAW_SHELL_BLOCKED_PATHS: z.string().optional(),
  /** When true, shell tool has full control: no allowlist/blocklist, cwd support, proper shell (cmd/bash). On Linux (e.g. Kali) defaults to true so the agent can run any command and control the system. */
  OPENPAW_SHELL_FULL_CONTROL: z
    .string()
    .default(process.platform === "linux" ? "true" : "false")
    .transform((v) => v === "1" || v === "true"),
  /** Shell command timeout in ms (default 60000 when full control, 30000 otherwise). */
  OPENPAW_SHELL_TIMEOUT: z.coerce.number().optional(),
  /** When true, run_shell will require user approval for commands matching OPENPAW_DANGER_PATTERNS. */
  OPENPAW_DANGER_APPROVAL: z.string().default("false").transform((v) => v === "1" || v === "true"),
  /** Comma-separated substrings; if command contains any, and OPENPAW_DANGER_APPROVAL=true, approval is required. E.g. sudo,rm -rf,nc -e,msfconsole. */
  OPENPAW_DANGER_PATTERNS: z.string().optional(),
  OPENPAW_MEMORY_MAX_ENTRIES: z.coerce.number().default(1000),
  OPENPAW_AGENT_MODE: z.enum(["native", "react", "auto"]).default("auto"),
  OPENPAW_HISTORY_SUMMARIZE_THRESHOLD: z.coerce.number().default(20),
  OPENPAW_HISTORY_KEEP_RAW: z.coerce.number().default(10),
  /** Session TTL in hours; expired sessions are not loaded or persisted. Default 24. */
  OPENPAW_SESSION_TTL_HOURS: z.coerce.number().default(24),
  /** Max messages per session before trimming. Default 50. */
  OPENPAW_SESSION_MAX_HISTORY: z.coerce.number().default(50),
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
  if (toLoad) process.env.OPENPAW_LOADED_ENV_PATH = toLoad;
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
  const dataDir = resolveDataDir(parsed.OPENPAW_DATA_DIR);
  const engagementsDir = join(dataDir, "engagements");
  const currentEngagementPath = join(dataDir, "current_engagement");
  let engagementName: string | undefined;
  if (existsSync(currentEngagementPath)) {
    try {
      const line = readFileSync(currentEngagementPath, "utf-8").split(/\r?\n/)[0]?.trim();
      if (line) engagementName = line;
    } catch {
      /* ignore */
    }
  }
  const workspaceRaw = parsed.OPENPAW_WORKSPACE;
  const workspace =
    engagementName
      ? resolve(engagementsDir, engagementName)
      : workspaceRaw.startsWith("/") || (workspaceRaw.length >= 2 && workspaceRaw[1] === ":")
        ? resolve(workspaceRaw)
        : resolve(process.cwd(), workspaceRaw);
  const scriptsDirRaw = parsed.OPENPAW_SCRIPTS_DIR?.trim();
  const scriptsDir = scriptsDirRaw
    ? scriptsDirRaw.startsWith("/") || (scriptsDirRaw.length >= 2 && scriptsDirRaw[1] === ":")
      ? resolve(scriptsDirRaw)
      : resolve(process.cwd(), scriptsDirRaw)
    : resolve(dataDir, "scripts");
  const auditLogPath = parsed.OPENPAW_AUDIT_LOG_PATH?.trim()
    ? parsed.OPENPAW_AUDIT_LOG_PATH.startsWith("/") || (parsed.OPENPAW_AUDIT_LOG_PATH.length >= 2 && parsed.OPENPAW_AUDIT_LOG_PATH[1] === ":")
      ? resolve(parsed.OPENPAW_AUDIT_LOG_PATH)
      : resolve(process.cwd(), parsed.OPENPAW_AUDIT_LOG_PATH)
    : resolve(dataDir, "audit.log");
  return {
    ...parsed,
    OPENPAW_DATA_DIR: dataDir,
    OPENPAW_WORKSPACE: workspace,
    OPENPAW_SCRIPTS_DIR: scriptsDir,
    OPENPAW_AUDIT_LOG_PATH: auditLogPath,
  };
}
