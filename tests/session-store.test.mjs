import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadSessions, saveSessions } from "../dist/session-store.js";

describe("session-store", () => {
  it("save then load preserves data", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openpaw-sessions-"));
    const filePath = join(dir, "sessions.json");
    const ttlMs = 24 * 60 * 60 * 1000;
    try {
      const sessions = new Map();
      sessions.set("cli:user1", {
        key: "cli:user1",
        history: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }],
        createdAt: Date.now() - 1000,
        updatedAt: Date.now(),
      });
      await saveSessions(filePath, sessions, ttlMs);
      const loaded = await loadSessions(filePath, ttlMs);
      assert.strictEqual(loaded.size, 1);
      const s = loaded.get("cli:user1");
      assert.ok(s);
      assert.strictEqual(s.history.length, 2);
      assert.strictEqual(s.history[0].content, "hi");
      assert.strictEqual(s.history[1].content, "hello");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("load filters out expired sessions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openpaw-sessions-"));
    const filePath = join(dir, "sessions.json");
    const ttlMs = 1000;
    try {
      const sessions = new Map();
      sessions.set("expired", {
        key: "expired",
        history: [],
        createdAt: Date.now() - 2000,
        updatedAt: Date.now() - 2000,
      });
      sessions.set("fresh", {
        key: "fresh",
        history: [{ role: "user", content: "now" }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await saveSessions(filePath, sessions, ttlMs);
      const loaded = await loadSessions(filePath, ttlMs);
      assert.strictEqual(loaded.size, 1);
      assert.ok(loaded.has("fresh"));
      assert.ok(!loaded.has("expired"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("load returns empty Map when file missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openpaw-sessions-"));
    const filePath = join(dir, "nonexistent.json");
    try {
      const loaded = await loadSessions(filePath);
      assert.strictEqual(loaded.size, 0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
