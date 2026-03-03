import { spawn } from "node:child_process";
import type { ToolDefinition } from "./types.js";

/**
 * Open a URL in the user's default browser (or default app for the scheme).
 * Use after web_search when the user asks to "open", "play", "пусни", "отвори" a link.
 */
export function createOpenUrlTool(): ToolDefinition {
  return {
    name: "open_url",
    description:
      "Open a URL in the user's default browser (or app). Use when the user asks to open a link, play a video, or go to a page. Pass the full URL (https:// or http://).",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Full URL to open (e.g. https://example.com or a streaming/watch link)",
        },
      },
    },
    async execute(args) {
      const rawUrl = String(args.url ?? "").trim();
      if (!rawUrl) return "Error: url is required (e.g. https://example.com).";

      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        return "Error: invalid URL. Use full URL with https:// or http://.";
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return "Error: only http and https URLs can be opened.";
      }

      const urlStr = url.toString();
      return new Promise((resolve) => {
        const isWin = process.platform === "win32";
        const isMac = process.platform === "darwin";
        const child = isWin
          ? spawn("cmd", ["/c", "start", "", urlStr], { shell: false, stdio: "ignore" })
          : isMac
            ? spawn("open", [urlStr], { stdio: "ignore" })
            : spawn("xdg-open", [urlStr], { stdio: "ignore" });

        child.on("error", (err) => {
          resolve(`Failed to open URL: ${err.message}. Try opening manually: ${urlStr}`);
        });
        child.on("close", (code) => {
          if (code === 0) resolve(`Opened in browser: ${urlStr}`);
          else resolve(`Opened (exit ${code}). If nothing opened, try manually: ${urlStr}`);
        });
      });
    },
  };
}
