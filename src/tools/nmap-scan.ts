import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition } from "./types.js";

const execAsync = promisify(exec);

const TIMEOUT_QUICK_MS = 120_000;
const TIMEOUT_FULL_MS = 600_000;
const TIMEOUT_UDP_MS = 300_000;

type ScanType = "quick" | "full" | "udp";

/** Exported for tests. */
export function buildNmapArgs(target: string, scanType: ScanType): { args: string[]; timeoutMs: number } {
  const t = target.trim();
  if (!t) return { args: [], timeoutMs: TIMEOUT_QUICK_MS };
  switch (scanType) {
    case "quick":
      return { args: ["-sV", "-T4", t], timeoutMs: TIMEOUT_QUICK_MS };
    case "full":
      return { args: ["-sC", "-sV", "-A", "-T4", t], timeoutMs: TIMEOUT_FULL_MS };
    case "udp":
      return { args: ["-sU", "--top-ports", "100", "-T4", t], timeoutMs: TIMEOUT_UDP_MS };
    default:
      return { args: ["-sV", "-T4", t], timeoutMs: TIMEOUT_QUICK_MS };
  }
}

export function createNmapScanTool(): ToolDefinition {
  return {
    name: "nmap_scan",
    description:
      "Run an nmap network scan on a target (IP, CIDR, or hostname). Use for recon. scanType: quick (default, -sV -T4), full (-sC -sV -A), or udp (top 100 UDP ports).",
    parameters: {
      type: "object",
      properties: {
        target: { type: "string", description: "Target: IP, CIDR (e.g. 192.168.1.0/24), or hostname" },
        scanType: { type: "string", description: "Optional: quick, full, or udp. Default: quick" },
        background: { type: "boolean", description: "If true, run scan in background; you will be notified when done." },
      },
    },
    async execute(args) {
      const target = String(args.target ?? "").trim();
      if (!target) return "Error: target is required (IP, CIDR, or hostname).";
      const scanType = (String(args.scanType ?? "quick").trim().toLowerCase() || "quick") as ScanType;
      if (!["quick", "full", "udp"].includes(scanType)) {
        return "Error: scanType must be quick, full, or udp.";
      }
      const { args: nmapArgs, timeoutMs } = buildNmapArgs(target, scanType);
      const cmd = `nmap ${nmapArgs.join(" ")}`;
      try {
        const { stdout, stderr } = await execAsync(cmd, {
          timeout: timeoutMs,
          maxBuffer: 4 * 1024 * 1024,
        });
        const out = [stdout, stderr].filter(Boolean).join("\n").trim();
        return out || "(no output)";
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; message?: string; code?: number };
        if (e.message?.includes("ENOENT") || e.code === 127) {
          return "Error: nmap not found. Install it (e.g. apt install nmap on Debian/Kali).";
        }
        const out = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n").trim();
        return `nmap failed:\n${out}`;
      }
    },
  };
}
