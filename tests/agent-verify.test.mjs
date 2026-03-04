import { describe, it } from "node:test";
import assert from "node:assert";
import { isVerifiedYes } from "../dist/agent.js";

describe("agent verify completion", () => {
  it("isVerifiedYes returns true for YES", () => {
    assert.strictEqual(isVerifiedYes("YES"), true);
    assert.strictEqual(isVerifiedYes("yes"), true);
    assert.strictEqual(isVerifiedYes("  YES  "), true);
    assert.strictEqual(isVerifiedYes("YES, the task is complete."), true);
  });

  it("isVerifiedYes returns false for NO or unclear", () => {
    assert.strictEqual(isVerifiedYes("NO"), false);
    assert.strictEqual(isVerifiedYes("no"), false);
    assert.strictEqual(isVerifiedYes("NO, something is still missing."), false);
    assert.strictEqual(isVerifiedYes(""), false);
    assert.strictEqual(isVerifiedYes("Maybe"), false);
  });
});
