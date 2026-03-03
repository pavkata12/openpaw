import type { ToolDefinition } from "./types.js";

const MAX_TEXT_LENGTH = 20_000;
const FETCH_TIMEOUT_MS = 15_000;

function stripHtml(html: string): string {
  let text = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function extractTitle(html: string): string {
  const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripHtml(m[1]).slice(0, 200) : "";
}

/**
 * Fetch a web page and return its text content (HTML stripped) so the agent can read and summarize it.
 * Use after web_search or google_search to open and preview result links.
 */
export function createFetchPageTool(): ToolDefinition {
  return {
    name: "fetch_page",
    description:
      "Fetch a web page by URL and return its text content (HTML stripped). Use after web_search or google_search to open a result link and read the page. Pass the full URL including https://.",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Full URL to fetch (e.g. https://example.com/article)",
        },
        max_length: {
          type: "number",
          description: `Max characters to return (default ${MAX_TEXT_LENGTH})`,
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
        return "Error: invalid URL. Use full URL with scheme (https:// or http://).";
      }
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        return "Error: only http and https URLs are allowed.";
      }

      const maxLen = Math.min(50_000, Math.max(1000, Number(args.max_length) || MAX_TEXT_LENGTH));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      try {
        const res = await fetch(url.toString(), {
          headers: { "User-Agent": "OpenPaw/1.0 (fetch_page)" },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (!res.ok) {
          return `Failed to fetch: ${res.status} ${res.statusText}. URL: ${url.toString()}`;
        }
        const contentType = res.headers.get("content-type") ?? "";
        if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
          return `Page is not HTML or text (Content-Type: ${contentType.slice(0, 50)}). I can only read web pages.`;
        }
        const html = await res.text();
        const title = extractTitle(html);
        const text = stripHtml(html);
        const truncated = text.length > maxLen ? text.slice(0, maxLen) + "\n\n[... truncated]" : text;
        const out = [`Title: ${title || "(no title)"}`, `URL: ${url.toString()}`, "", truncated].join("\n");
        return out;
      } catch (e) {
        clearTimeout(timeout);
        if (e instanceof Error && e.name === "AbortError") {
          return `Request timed out after ${FETCH_TIMEOUT_MS / 1000}s. URL: ${url.toString()}`;
        }
        return `Fetch failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}
