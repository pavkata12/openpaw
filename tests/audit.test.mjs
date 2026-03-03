import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { logToolCall } from "../dist/audit.js";

describe("audit logToolCall", () => {
  it("writes a line with ts, tool, args, resultSummary", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openpaw-audit-"));
    const auditPath = join(dir, "audit.log");
    try {
      await logToolCall(
        { enabled: true, path: auditPath },
        { toolName: "run_shell", args: { command: "echo hi" }, resultSummary: "done", channel: "cli" }
      );
      const content = await readFile(auditPath, "utf-8");
      const line = content.trim();
      assert.ok(line.length > 0);
      const parsed = JSON.parse(line);
      assert.strictEqual(parsed.tool, "run_shell");
      assert.ok(parsed.ts);
      assert.ok(parsed.args.includes("echo hi"));
      assert.strictEqual(parsed.resultSummary, "done");
      assert.strictEqual(parsed.channel, "cli");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("does not write when enabled is false", async () => {
    const dir = await mkdtemp(join(tmpdir(), "openpaw-audit-"));
    const auditPath = join(dir, "audit.log");
    try {
      await logToolCall(
        { enabled: false, path: auditPath },
        { toolName: "run_shell", args: {} }
      );
      try {
        await readFile(auditPath, "utf-8");
        assert.fail("file should not exist");
      } catch (e) {
        assert.strictEqual(e.code, "ENOENT");
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
