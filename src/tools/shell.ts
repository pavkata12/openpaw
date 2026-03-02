import { exec } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import type { ToolDefinition } from "./types.js";

const execAsync = promisify(exec);

const isWin = process.platform === "win32";

export interface ShellToolOptions {
  timeout?: number;
  allowedCommands?: string[];
  blockedPaths?: string[];
  /** Full control: no allowlist/blocklist, cwd support, native shell (cmd.exe / bash). */
  fullControl?: boolean;
}

const DEFAULT_ALLOWED = [
  "ls", "dir", "cat", "type", "pwd", "cd", "echo", "node", "npm", "npx",
  "git", "python", "python3", "pip", "pip3", "curl", "wget", "jq",
  "head", "tail", "grep", "find", "wc", "date", "whoami", "hostname",
];

function isAllowed(command: string, allowlist?: string[]): boolean {
  const list = allowlist?.length ? allowlist : DEFAULT_ALLOWED;
  const base = command.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  const cmd = base.replace(/^\.\//, "").split("/").pop() ?? base;
  return list.some((a) => cmd === a.toLowerCase() || cmd.startsWith(a.toLowerCase() + "."));
}

function hasBlockedPath(command: string, blocked?: string[]): boolean {
  if (!blocked?.length) return false;
  const lower = command.toLowerCase();
  return blocked.some((p) => lower.includes(p.toLowerCase()));
}

export function createShellTool(options: ShellToolOptions = {}): ToolDefinition {
  const fullControl = options.fullControl === true;
  const timeout = options.timeout ?? (fullControl ? 60_000 : 30_000);
  const allowed = options.allowedCommands;
  const blocked = options.blockedPaths;

  const description = fullControl
    ? "Run a shell command with full control (like OpenClaw). Uses cmd.exe on Windows, bash on Linux. Supports pipes, &&, cwd. No allowlist/blocklist."
    : "Run a shell command on the user's machine. Use for listing files, running scripts, etc. Prefer single commands. Sandboxed: only allowed commands; blocked paths: /etc, /root, etc.";

  return {
    name: "run_shell",
    description,
    parameters: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to run (e.g. ls -la, cd myapp && npm run build)" },
        ...(fullControl ? { cwd: { type: "string", description: "Working directory (absolute or relative to process cwd). Optional." } } : {}),
      },
    },
    async execute(args) {
      const command = String(args.command ?? "").trim();
      if (!command) return "Error: command is required.";

      if (!fullControl) {
        if (!isAllowed(command, allowed)) {
          return `Error: command not in allowlist. Allowed: ${(allowed ?? DEFAULT_ALLOWED).join(", ")}`;
        }
        if (hasBlockedPath(command, blocked ?? ["/etc", "/root", "/var/log", "rm -rf /"])) {
          return "Error: command references blocked path.";
        }
      }

      let cwd: string | undefined;
      if (fullControl && args.cwd != null) {
        const raw = String(args.cwd).trim();
        if (raw) cwd = resolve(process.cwd(), raw);
      }

      const execOpts: Parameters<typeof execAsync>[1] = {
        timeout,
        maxBuffer: fullControl ? 4 * 1024 * 1024 : 1024 * 1024,
        ...(cwd ? { cwd } : {}),
      };

      if (fullControl && isWin) {
        execOpts.shell = "cmd.exe";
      } else if (fullControl && !isWin) {
        execOpts.shell = "/bin/bash";
      }

      try {
        const { stdout, stderr } = await execAsync(command, execOpts);
        const out = [stdout, stderr].filter(Boolean).join("\n").trim();
        return out || "(no output)";
      } catch (err: unknown) {
        const e = err as { stdout?: string; stderr?: string; message?: string };
        const out = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n").trim();
        return `Command failed:\n${out}`;
      }
    },
  };
}
