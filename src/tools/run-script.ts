import { spawn } from "node:child_process";
import { resolve, relative } from "node:path";
import { existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import type { ToolDefinition } from "./types.js";

const SCRIPT_TIMEOUT_MS = 300_000;
const ALLOWED_EXT = [".sh", ".bash"];

function resolveScriptPath(scriptsDir: string, scriptName: string): string | null {
  const base = scriptName.trim().replace(/^\.\//, "").replace(/\\/g, "/");
  if (!base || base.includes("..")) return null;
  const full = resolve(scriptsDir, base);
  const rel = relative(scriptsDir, full);
  if (rel.startsWith("..") || rel === "..") return null;
  return full;
}

export function createRunScriptTool(scriptsDir: string): ToolDefinition {
  return {
    name: "run_script",
    description:
      "Run a predefined script from the scripts directory. Use for recon, wireless, or web scan workflows. Scripts must be in OPENPAW_SCRIPTS_DIR (default: .openpaw/scripts). Args: script name (e.g. recon.sh), optional args as string.",
    parameters: {
      type: "object",
      properties: {
        script: { type: "string", description: "Script filename (e.g. recon.sh, wifite_quick.sh)" },
        args: { type: "string", description: "Optional arguments as a single string (e.g. '192.168.1.0/24')" },
      },
    },
    async execute(args) {
      const scriptArg = String(args.script ?? "").trim();
      if (!scriptArg) return "Error: script is required.";
      const resolved = resolveScriptPath(scriptsDir, scriptArg);
      if (!resolved) return "Error: invalid script path (path traversal not allowed).";
      if (!existsSync(resolved)) return `Error: script not found: ${scriptArg}`;
      let isFile = false;
      try {
        const st = await stat(resolved);
        isFile = st.isFile();
      } catch {
        return `Error: cannot access ${scriptArg}`;
      }
      if (!isFile) return `Error: not a file: ${scriptArg}`;
      const ext = resolved.toLowerCase().slice(resolved.lastIndexOf("."));
      if (!ALLOWED_EXT.includes(ext)) {
        return `Error: only ${ALLOWED_EXT.join(", ")} scripts are allowed. Got: ${scriptArg}`;
      }
      const argsStr = typeof args.args === "string" ? args.args : String(args.args ?? "").trim();
      const argv = argsStr ? argsStr.split(/\s+/).filter(Boolean) : [];

      return new Promise((fulfill) => {
        const child = spawn("bash", [resolved, ...argv], {
          cwd: scriptsDir,
          stdio: ["ignore", "pipe", "pipe"],
        });
        const chunks: Buffer[] = [];
        const errChunks: Buffer[] = [];
        child.stdout?.on("data", (c) => chunks.push(c));
        child.stderr?.on("data", (c) => errChunks.push(c));
        const timeout = setTimeout(() => {
          child.kill("SIGTERM");
          fulfill(
            `Script timed out after ${SCRIPT_TIMEOUT_MS / 1000}s.\nstdout: ${Buffer.concat(chunks).toString("utf-8")}\nstderr: ${Buffer.concat(errChunks).toString("utf-8")}`
          );
        }, SCRIPT_TIMEOUT_MS);
        child.on("close", (code, signal) => {
          clearTimeout(timeout);
          const out = Buffer.concat(chunks).toString("utf-8").trim();
          const err = Buffer.concat(errChunks).toString("utf-8").trim();
          const combined = [out, err].filter(Boolean).join("\n--- stderr ---\n");
          const status = signal ? `killed (${signal})` : `exit ${code}`;
          fulfill(combined ? `${combined}\n\n[${status}]` : `[${status}]`);
        });
        child.on("error", (e) => {
          clearTimeout(timeout);
          fulfill(`Error spawning script: ${e.message}`);
        });
      });
    },
  };
}
