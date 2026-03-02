import type { Config } from "../config.js";
import type { ToolDefinition } from "./types.js";

const BASE = "https://www.googleapis.com/customsearch/v1";

export function createGoogleSearchTool(config: Config): ToolDefinition | null {
  const apiKey = config.OPENPAW_GOOGLE_SEARCH_API_KEY?.trim();
  const cx = config.OPENPAW_GOOGLE_SEARCH_ENGINE_ID?.trim();
  if (!apiKey || !cx) return null;

  return {
    name: "google_search",
    description:
      "Search the web via Google. Use for current info, facts, or when the user asks to search or look something up. Returns title, link, and snippet for each result.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (e.g. 'weather Sofia', 'latest news AI')" },
        num: { type: "number", description: "Number of results (1–10, default 5)" },
      },
    },
    async execute(args) {
      const query = String(args.query ?? "").trim();
      if (!query) return "Error: query is required.";
      const num = Math.min(10, Math.max(1, Number(args.num) || 5));
      const url = `${BASE}?key=${encodeURIComponent(apiKey)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=${num}`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          const text = await res.text();
          return `Google Search failed (${res.status}): ${text.slice(0, 200)}`;
        }
        const data = (await res.json()) as {
          items?: Array<{ title?: string; link?: string; snippet?: string }>;
          error?: { message?: string };
        };
        if (data.error) return `Google Search error: ${data.error.message ?? "Unknown"}`;
        const items = data.items ?? [];
        if (items.length === 0) return "No results found.";
        const lines = items.map((item, i) => {
          const title = item.title ?? "";
          const link = item.link ?? "";
          const snippet = item.snippet ?? "";
          return `${i + 1}. ${title}\n   ${link}\n   ${snippet}`;
        });
        return lines.join("\n\n");
      } catch (e) {
        return `Google Search failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}
