import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ToolDefinition } from "./types.js";

/**
 * Play media: open a stream URL in the browser or open a local file with the system default player.
 * Use when the user says "пусни филм/музика/видео" — either give a link (YouTube, Netflix, Spotify) or a path to a file on disk.
 */
export function createPlayMediaTool(workspaceRoot: string): ToolDefinition {
  return {
    name: "play_media",
    description:
      "Play a video or music: pass a URL (YouTube, Netflix, Spotify, etc.) to open in the browser, or a path to a local file (e.g. movie.mp4, song.mp3) to open with the default player. For local files use a path relative to the workspace or an absolute path. Use when the user asks to play a film, song, or video.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Stream URL (e.g. https://www.youtube.com/watch?v=..., Spotify web, Netflix). Opens in browser.",
        },
        path: {
          type: "string",
          description: "Local file path (relative to workspace or absolute), e.g. Movies/film.mp4 or C:\\Users\\...\\song.mp3. Opens with default media player.",
        },
      },
    },
    async execute(args) {
      const rawUrl = typeof args.url === "string" ? args.url.trim() : "";
      const rawPath = typeof args.path === "string" ? args.path.trim() : "";

      if (rawUrl && rawPath) return "Error: provide either url or path, not both.";
      if (!rawUrl && !rawPath) return "Error: provide url (for streams) or path (for local file).";

      if (rawUrl) {
        let url: URL;
        try {
          url = new URL(rawUrl);
        } catch {
          return "Error: invalid URL.";
        }
        if (url.protocol !== "https:" && url.protocol !== "http:") {
          return "Error: only http and https URLs supported.";
        }
        const urlStr = url.toString();
        return new Promise((resolvePromise) => {
          const isWin = process.platform === "win32";
          const isMac = process.platform === "darwin";
          const child = isWin
            ? spawn("cmd", ["/c", "start", "", urlStr], { shell: false, stdio: "ignore" })
            : isMac
              ? spawn("open", [urlStr], { stdio: "ignore" })
              : spawn("xdg-open", [urlStr], { stdio: "ignore" });
          child.on("error", (err) => resolvePromise(`Failed to open: ${err.message}`));
          child.on("close", (code) =>
            resolvePromise(code === 0 ? `Opened in browser: ${urlStr}` : `Opened (exit ${code}). If nothing opened, try manually: ${urlStr}`)
          );
        });
      }

      const resolvedPath = rawPath.startsWith("/") || (rawPath.length >= 2 && rawPath[1] === ":")
        ? resolve(rawPath)
        : resolve(workspaceRoot, rawPath);
      if (!existsSync(resolvedPath)) {
        return `Error: file not found: ${resolvedPath}`;
      }

      return new Promise((resolvePromise) => {
        const isWin = process.platform === "win32";
        const isMac = process.platform === "darwin";
        const child = isWin
          ? spawn("cmd", ["/c", "start", "", resolvedPath], { shell: false, stdio: "ignore" })
          : isMac
            ? spawn("open", [resolvedPath], { stdio: "ignore" })
            : spawn("xdg-open", [resolvedPath], { stdio: "ignore" });
        child.on("error", (err) => resolvePromise(`Failed to play: ${err.message}`));
        child.on("close", (code) =>
          resolvePromise(code === 0 ? `Playing: ${resolvedPath}` : `Launched player (exit ${code}).`)
        );
      });
    },
  };
}
