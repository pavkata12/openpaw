import type { Message } from "./llm.js";
import type { LLMAdapter } from "./llm.js";
import { summarizeHistory as doSummarize } from "./session-summarizer.js";

export type SessionKey = string;

export interface Session {
  key: SessionKey;
  history: Message[];
  createdAt: number;
  updatedAt: number;
}

const MAX_HISTORY = 50;
const TTL_MS = 24 * 60 * 60 * 1000;

export interface SessionManagerOptions {
  llm?: LLMAdapter;
  summarizeThreshold?: number;
  keepRaw?: number;
}

export function createSessionManager(options: SessionManagerOptions = {}) {
  const { llm, summarizeThreshold = 0, keepRaw = 10 } = options;
  const sessions = new Map<SessionKey, Session>();

  function getSessionKey(channelId: string, userId: string): SessionKey {
    return `${channelId}:${userId}`;
  }

  function get(key: SessionKey): Session | undefined {
    const s = sessions.get(key);
    if (!s) return undefined;
    if (Date.now() - s.updatedAt > TTL_MS) {
      sessions.delete(key);
      return undefined;
    }
    return s;
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
    while (s.history.length > MAX_HISTORY) s.history.shift();
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
