import { describe, it } from "node:test";
import assert from "node:assert";
import { createRunScriptTool } from "../dist/tools/run-script.js";

describe("run_script tool", () => {
  it("rejects path traversal in script name", async () => {
    const tool = createRunScriptTool("/tmp/scripts");
    const out = await tool.execute({ script: "../../../etc/passwd" });
    assert.ok(out.includes("Error"));
    assert.ok(out.includes("invalid") || out.includes("traversal") || out.includes("not found"));
  });

  it("rejects script name containing ..", async () => {
    const tool = createRunScriptTool("/tmp/scripts");
    const out = await tool.execute({ script: "sub/../../evil.sh" });
    assert.ok(out.includes("Error"));
  });

  it("returns error when script is missing", async () => {
    const tool = createRunScriptTool("/tmp/empty-scripts-dir");
    const out = await tool.execute({ script: "recon.sh" });
    assert.ok(out.includes("Error") || out.includes("not found"));
  });
});
