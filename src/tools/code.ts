import { readFile, writeFile, readdir, mkdir, unlink } from "node:fs/promises";
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";
import type { ToolDefinition } from "./types.js";

/** Resolve path under workspace; return null if outside (path traversal). */
function resolveInWorkspace(workspace: string, rawPath: string): string | null {
  const p = rawPath.trim().replace(/^\.\//, "");
  if (!p) return workspace;
  const resolved = resolve(workspace, p);
  const rel = relative(workspace, resolved);
  if (rel.startsWith("..") || rel === "..") return null;
  return resolved;
}

function isInside(workspace: string, resolved: string): boolean {
  const rel = relative(workspace, resolved);
  return !rel.startsWith("..") && rel !== "..";
}

export function createReadFileTool(workspace: string): ToolDefinition {
  return {
    name: "read_file",
    description:
      "Read contents of a file in the workspace. Use for viewing source code, configs, or any text file. Optionally limit to a line range.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path from workspace (e.g. src/index.ts)" },
        startLine: { type: "number", description: "Optional 1-based start line (inclusive)" },
        endLine: { type: "number", description: "Optional 1-based end line (inclusive)" },
      },
    },
    async execute(args) {
      const pathArg = String(args.path ?? "").trim();
      if (!pathArg) return "Error: path is required.";
      const resolved = resolveInWorkspace(workspace, pathArg);
      if (!resolved || !isInside(workspace, resolved)) return "Error: path is outside workspace.";
      try {
        const content = await readFile(resolved, "utf-8");
        const start = args.startLine != null ? Number(args.startLine) : undefined;
        const end = args.endLine != null ? Number(args.endLine) : undefined;
        if (start != null && end != null && !Number.isNaN(start) && !Number.isNaN(end)) {
          const lines = content.split(/\r?\n/);
          const s = Math.max(1, Math.min(start, lines.length));
          const e = Math.min(lines.length, Math.max(s, end));
          const slice = lines.slice(s - 1, e).join("\n");
          return `File: ${pathArg} (lines ${s}-${e})\n\n${slice}`;
        }
        return `File: ${pathArg}\n\n${content}`;
      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : String(err);
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return `Error: file not found: ${pathArg}`;
        return `Error reading file: ${m}`;
      }
    },
  };
}

export function createWriteFileTool(workspace: string): ToolDefinition {
  return {
    name: "write_file",
    description:
      "Create or overwrite a file in the workspace. Use for creating new files or replacing full file contents. Creates parent directories if needed.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path from workspace (e.g. src/foo.ts)" },
        contents: { type: "string", description: "Full file contents" },
      },
    },
    async execute(args) {
      const pathArg = String(args.path ?? "").trim();
      if (!pathArg) return "Error: path is required.";
      const resolved = resolveInWorkspace(workspace, pathArg);
      if (!resolved || !isInside(workspace, resolved)) return "Error: path is outside workspace.";
      const contents = typeof args.contents === "string" ? args.contents : String(args.contents ?? "");
      try {
        await mkdir(dirname(resolved), { recursive: true });
        await writeFile(resolved, contents, "utf-8");
        return `Wrote ${pathArg} (${contents.length} bytes).`;
      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : String(err);
        return `Error writing file: ${m}`;
      }
    },
  };
}

export function createListDirTool(workspace: string): ToolDefinition {
  return {
    name: "list_dir",
    description:
      "List directory contents in the workspace. Use to explore project structure, find files, or see what's in a folder.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "Relative path from workspace (default: .)" },
      },
    },
    async execute(args) {
      const pathArg = String(args.path ?? ".").trim() || ".";
      const resolved = resolveInWorkspace(workspace, pathArg);
      if (!resolved || !isInside(workspace, resolved)) return "Error: path is outside workspace.";
      try {
        const entries = await readdir(resolved, { withFileTypes: true });
        const lines = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name)).sort();
        return lines.length ? lines.join("\n") : "(empty directory)";
      } catch (err: unknown) {
        const m = err instanceof Error ? err.message : String(err);
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return `Error: directory not found: ${pathArg}`;
        return `Error listing directory: ${m}`;
      }
    },
  };
}

const MAX_MATCHES = 200;
const MAX_FILE_SIZE = 512 * 1024;

export function createSearchInFilesTool(workspace: string): ToolDefinition {
  return {
    name: "search_in_files",
    description:
      "Search for text or regex in files under the workspace (grep-like). Use to find usages, definitions, or patterns in code. Returns file path and matching lines.",
    parameters: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Search pattern (plain text or regex if wrapped in /.../)" },
        path: { type: "string", description: "Directory to search from (relative to workspace, default: .)" },
        filePattern: { type: "string", description: "Optional glob to limit files (e.g. *.ts, *.json)" },
      },
    },
    async execute(args) {
      const patternRaw = String(args.pattern ?? "").trim();
      if (!patternRaw) return "Error: pattern is required.";
      const dirArg = String(args.path ?? ".").trim() || ".";
      const resolvedDir = resolveInWorkspace(workspace, dirArg);
      if (!resolvedDir || !isInside(workspace, resolvedDir) || !existsSync(resolvedDir)) {
        return "Error: path is outside workspace or not found.";
      }
      const isRegex = patternRaw.startsWith("/") && patternRaw.length > 1 && patternRaw.includes("/", 1);
      const pattern = isRegex
        ? new RegExp(patternRaw.slice(1, patternRaw.lastIndexOf("/")), "i")
        : new RegExp(escapeRegex(patternRaw), "i");
      const fileGlob = args.filePattern != null ? String(args.filePattern).trim() : null;
      const results: string[] = [];
      let totalMatches = 0;

      function walk(dir: string): void {
        if (totalMatches >= MAX_MATCHES) return;
        let entries: { name: string; path: string; isDir: boolean }[];
        try {
          entries = readdirSync(dir, { withFileTypes: true }).map((e) => ({
            name: e.name,
            path: resolve(dir, e.name),
            isDir: e.isDirectory(),
          }));
        } catch {
          return;
        }
        for (const e of entries) {
          if (e.name.startsWith(".") || e.name === "node_modules") continue;
          if (e.isDir) {
            const rel = relative(workspace, e.path);
            if (rel.startsWith("..")) continue;
            walk(e.path);
            continue;
          }
          if (fileGlob && !matchGlob(e.name, fileGlob)) continue;
          const relPath = relative(workspace, e.path);
          try {
            const stat = statSync(e.path);
            if (stat.size > MAX_FILE_SIZE) continue;
            const content = readFileSync(e.path, "utf-8");
            const lines = content.split(/\r?\n/);
            for (let i = 0; i < lines.length && totalMatches < MAX_MATCHES; i++) {
              if (pattern.test(lines[i])) {
                results.push(`${relPath}:${i + 1}: ${lines[i].trim()}`);
                totalMatches++;
              }
            }
          } catch {
            // skip binary or unreadable
          }
        }
      }

      function escapeRegex(s: string): string {
        return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      }
      /** Simple glob: *.ts, *.json, or exact name. */
      function matchGlob(name: string, glob: string): boolean {
        if (glob.includes("*")) {
          const suffix = glob.replace(/^\*\.?/, "");
          return suffix ? name.endsWith(suffix) || name === suffix : true;
        }
        return name === glob;
      }

      walk(resolvedDir);
      if (results.length === 0) return `No matches for "${patternRaw}" in ${dirArg}`;
      return results.join("\n") + (totalMatches >= MAX_MATCHES ? "\n...(truncated)" : "");
    },
  };
}

/** Simplified apply_patch (OpenClaw-style). *** Begin Patch ... *** End Patch */
export function createApplyPatchTool(workspace: string): ToolDefinition {
  return {
    name: "apply_patch",
    description:
      "Apply multiple file changes at once using a patch format. Use for multi-file or multi-hunk edits. Format: *** Begin Patch / *** Add File: path / +lines / *** Update File: path / -old / +new / *** Delete File: path / *** End Patch",
    parameters: {
      type: "object",
      properties: {
        input: {
          type: "string",
          description: "Full patch text including *** Begin Patch and *** End Patch",
        },
      },
    },
    async execute(args) {
      const input = String(args.input ?? "").trim();
      if (!input.includes("*** Begin Patch") || !input.includes("*** End Patch")) {
        return "Error: patch must contain *** Begin Patch and *** End Patch.";
      }
      const lines = input.split(/\r?\n/);
      const out: string[] = [];
      let i = 0;
      while (i < lines.length) {
        const line = lines[i];
        if (line.startsWith("*** Add File:")) {
          const pathRel = line.slice("*** Add File:".length).trim();
          const resolved = resolveInWorkspace(workspace, pathRel);
          if (!resolved || !isInside(workspace, resolved)) {
            out.push(`Error: path outside workspace: ${pathRel}`);
            i++;
            continue;
          }
          const content: string[] = [];
          i++;
          while (i < lines.length && !lines[i].startsWith("***")) {
            if (lines[i].startsWith("+")) content.push(lines[i].slice(1));
            i++;
          }
          try {
            await mkdir(dirname(resolved), { recursive: true });
            await writeFile(resolved, content.join("\n"), "utf-8");
            out.push(`Added: ${pathRel}`);
          } catch (e) {
            out.push(`Error adding ${pathRel}: ${e instanceof Error ? e.message : e}`);
          }
          continue;
        }
        if (line.startsWith("*** Update File:")) {
          const pathRel = line.slice("*** Update File:".length).trim();
          const resolved = resolveInWorkspace(workspace, pathRel);
          if (!resolved || !isInside(workspace, resolved)) {
            out.push(`Error: path outside workspace: ${pathRel}`);
            i++;
            continue;
          }
          let content: string;
          try {
            content = await readFile(resolved, "utf-8");
          } catch {
            content = "";
          }
          const fileLines = content.split(/\r?\n/);
          i++;
          let idx = 0;
          while (i < lines.length && !lines[i].startsWith("***")) {
            const l = lines[i];
            if (l.startsWith("-")) {
              const toRemove = l.slice(1);
              const found = fileLines.findIndex((x, j) => j >= idx && (x === toRemove || x.replace(/\r$/, "") === toRemove));
              if (found >= 0) {
                fileLines.splice(found, 1);
                idx = found;
              }
            } else if (l.startsWith("+")) {
              fileLines.splice(idx, 0, l.slice(1));
              idx++;
            }
            i++;
          }
          try {
            await writeFile(resolved, fileLines.join("\n"), "utf-8");
            out.push(`Updated: ${pathRel}`);
          } catch (e) {
            out.push(`Error updating ${pathRel}: ${e instanceof Error ? e.message : e}`);
          }
          continue;
        }
        if (line.startsWith("*** Delete File:")) {
          const pathRel = line.slice("*** Delete File:".length).trim();
          const resolved = resolveInWorkspace(workspace, pathRel);
          if (!resolved || !isInside(workspace, resolved)) {
            out.push(`Error: path outside workspace: ${pathRel}`);
            i++;
            continue;
          }
          try {
            await unlink(resolved);
            out.push(`Deleted: ${pathRel}`);
          } catch (e) {
            out.push(`Error deleting ${pathRel}: ${e instanceof Error ? e.message : e}`);
          }
          i++;
          continue;
        }
        if (line.startsWith("*** End Patch")) break;
        i++;
      }
      return out.length ? out.join("\n") : "No operations in patch.";
    },
  };
}
