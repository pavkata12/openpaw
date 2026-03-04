import type { Message } from "./llm.js";
import type { LLMAdapter } from "./llm.js";
import { summarizeHistory as doSummarize } from "./session-summarizer.js";
import { logger } from "./logger.js";

export type SessionKey = string;

export interface Session {
  key: SessionKey;
  history: Message[];
  createdAt: number;
  updatedAt: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_HISTORY = 50;

export interface SessionManagerOptions {
  llm?: LLMAdapter;
  summarizeThreshold?: number;
  keepRaw?: number;
  /** If set, sessions are loaded from this path on init (via initialSessions) and saved here after each append (debounced). */
  sessionStorePath?: string;
  /** Initial sessions to load (caller should load from sessionStorePath when provided). */
  initialSessions?: Map<SessionKey, Session>;
  /** Session TTL in ms; expired sessions are not returned and not persisted. */
  ttlMs?: number;
  /** Max messages per session before trimming. */
  maxHistory?: number;
}

export function createSessionManager(options: SessionManagerOptions = {}) {
  const {
    llm,
    summarizeThreshold = 0,
    keepRaw = 10,
    sessionStorePath,
    initialSessions,
    ttlMs = DEFAULT_TTL_MS,
    maxHistory = DEFAULT_MAX_HISTORY,
  } = options;
  const sessions = new Map<SessionKey, Session>(initialSessions);
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;

  async function flushSave(): Promise<void> {
    if (!sessionStorePath) return;
    const { saveSessions } = await import("./session-store.js");
    await saveSessions(sessionStorePath, sessions, ttlMs);
  }

  function scheduleSave(): void {
    if (!sessionStorePath) return;
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveTimeout = null;
      flushSave().catch((err) => {
        logger.error("Session save failed", { err: err instanceof Error ? err.message : String(err) });
      });
    }, 800);
  }

  function get(key: SessionKey): Session | undefined {
    const s = sessions.get(key);
    if (!s) return undefined;
    if (Date.now() - s.updatedAt > ttlMs) {
      sessions.delete(key);
      return undefined;
    }
    return s;
  }

  function getSessionKey(channelId: string, userId: string): SessionKey {
    return `${channelId}:${userId}`;
  }

  function getOrCreate(key: SessionKey): Session {
    let s = sessions.get(key);
    if (!s) {
      s = { key, history: [], createdAt: Date.now(), updatedAt: Date.now() };
      sessions.set(key, s);
    }
    return s;
  }

  async function appendMessage(key: SessionKey, msg: Message): Promise<void> {
    const s = getOrCreate(key);
    s.history.push(msg);
    s.updatedAt = Date.now();

    if (
      summarizeThreshold > 0 &&
      keepRaw > 0 &&
      llm &&
      s.history.length > summarizeThreshold
    ) {
      try {
        s.history = await doSummarize(llm, s.history, keepRaw);
      } catch {
        // On summarization failure, just trim to MAX_HISTORY
      }
    }
    while (s.history.length > maxHistory) s.history.shift();
    scheduleSave();
  }

  function getHistory(key: SessionKey): Message[] {
    const s = get(key);
    return s?.history ?? [];
  }

  function clear(key: SessionKey): void {
    sessions.delete(key);
  }

  return { getSessionKey, get, getOrCreate, appendMessage, getHistory, clear };
}
