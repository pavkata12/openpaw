import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { ToolDefinition } from "./types.js";

const execAsync = promisify(exec);

export function createNiktoScanTool(): ToolDefinition {
  return {
    name: "nikto_scan",
    description:
      "Scan a web server for vulnerabilities using nikto (Kali). Pass URL including scheme and port if needed (e.g. http://target:80).",
    parameters: {
      type: "object",
      properties: {
        url: { type: "string", description: "Target URL (e.g. http://192.168.1.10:80 or https://example.com)" },
        timeout: { type: "number", description: "Timeout in seconds (optional, default 300)" },
      },
    },
    async execute(args) {
      const url = String(args.url ?? "").trim();
      if (!url) return "Error: url is required (e.g. http://target:80).";
      const timeoutSec = Number(args.timeout) || 300;
      const timeoutMs = Math.min(Math.max(timeoutSec * 1000, 10_000), 600_000);
      const cmd = `nikto -h ${url}`;
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
          return "Error: nikto not found. Install it (e.g. apt install nikto on Kali).";
        }
        const out = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n").trim();
        return `nikto_scan failed:\n${out}`;
      }
    },
  };
}
