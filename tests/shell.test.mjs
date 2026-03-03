import { describe, it } from "node:test";
import assert from "node:assert";
import { createShellTool, OPENPAW_NEEDS_APPROVAL_PREFIX } from "../dist/tools/shell.js";

describe("shell tool danger approval", () => {
  it("returns NEEDS_APPROVAL when command matches dangerPatterns", async () => {
    const tool = createShellTool({ fullControl: true, dangerPatterns: ["sudo"] });
    const out = await tool.execute({ command: "sudo rm -rf x" });
    assert.ok(out.startsWith(OPENPAW_NEEDS_APPROVAL_PREFIX));
    assert.ok(out.includes("sudo rm -rf x"));
  });

  it("returns NEEDS_APPROVAL for pattern substring", async () => {
    const tool = createShellTool({ fullControl: true, dangerPatterns: ["rm -rf"] });
    const out = await tool.execute({ command: "rm -rf /tmp/foo" });
    assert.ok(out.startsWith(OPENPAW_NEEDS_APPROVAL_PREFIX));
  });

  it("executes when command does not match dangerPatterns", async () => {
    const tool = createShellTool({ fullControl: true, dangerPatterns: ["sudo"] });
    const out = await tool.execute({ command: "echo hello" });
    assert.ok(!out.startsWith(OPENPAW_NEEDS_APPROVAL_PREFIX));
    assert.ok(out.includes("hello"));
  });
});
