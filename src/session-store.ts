import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Message } from "./llm.js";
import type { Session, SessionKey } from "./session.js";

const TTL_MS_DEFAULT = 24 * 60 * 60 * 1000;

export interface SessionStoreRecord {
  [key: string]: { key: SessionKey; history: { role: string; content: string }[]; createdAt: number; updatedAt: number };
}

export async function loadSessions(
  filePath: string,
  ttlMs: number = TTL_MS_DEFAULT
): Promise<Map<SessionKey, Session>> {
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as SessionStoreRecord;
    const map = new Map<SessionKey, Session>();
    const now = Date.now();
    for (const [key, s] of Object.entries(parsed)) {
      if (!s || typeof s.updatedAt !== "number") continue;
      if (now - s.updatedAt > ttlMs) continue;
      const rawHistory = Array.isArray(s.history) ? s.history : [];
      const history: Message[] = rawHistory
        .filter((m) => m && typeof m.content === "string")
        .map((m) => ({ role: (["system", "user", "assistant"].includes(m.role) ? m.role : "user") as Message["role"], content: m.content }));
      map.set(key, {
        key: s.key ?? key,
        history,
        createdAt: typeof s.createdAt === "number" ? s.createdAt : now,
        updatedAt: s.updatedAt,
      });
    }
    return map;
  } catch {
    return new Map();
  }
}

export async function saveSessions(
  filePath: string,
  sessions: Map<SessionKey, Session>,
  ttlMs: number = TTL_MS_DEFAULT
): Promise<void> {
  const now = Date.now();
  const obj: SessionStoreRecord = {};
  for (const [key, s] of sessions) {
    if (now - s.updatedAt > ttlMs) continue;
    obj[key] = {
      key: s.key,
      history: s.history,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    };
  }
  const dir = dirname(filePath);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath, JSON.stringify(obj, null, 2), "utf-8");
}
