import { describe, it } from "node:test";
import assert from "node:assert";
import { buildNmapArgs } from "../dist/tools/nmap-scan.js";

describe("nmap_scan buildNmapArgs", () => {
  it("quick scan returns -sV -T4 and target", () => {
    const { args, timeoutMs } = buildNmapArgs("192.168.1.1", "quick");
    assert.deepStrictEqual(args, ["-sV", "-T4", "192.168.1.1"]);
    assert.strictEqual(timeoutMs, 120_000);
  });

  it("full scan returns -sC -sV -A -T4 and target", () => {
    const { args } = buildNmapArgs("10.0.0.0/24", "full");
    assert.deepStrictEqual(args, ["-sC", "-sV", "-A", "-T4", "10.0.0.0/24"]);
  });

  it("udp scan returns -sU --top-ports 100", () => {
    const { args, timeoutMs } = buildNmapArgs("192.168.1.1", "udp");
    assert.ok(args.includes("-sU"));
    assert.ok(args.includes("--top-ports"));
    assert.ok(args.includes("100"));
    assert.strictEqual(timeoutMs, 300_000);
  });
});
