import type { ToolDefinition } from "./types.js";

const DDG_API = "https://api.duckduckgo.com/";

/**
 * Web search using DuckDuckGo Instant Answer API. No API key required.
 * Use when Google Custom Search is not configured.
 */
export function createDuckDuckGoSearchTool(): ToolDefinition {
  return {
    name: "web_search",
    description:
      "Search the web (DuckDuckGo). Use for current info, facts, or when the user asks to search or look something up. No API key needed.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (e.g. 'weather Sofia', 'latest news AI')" },
      },
    },
    async execute(args) {
      const query = String(args.query ?? "").trim();
      if (!query) return "Error: query is required.";
      const url = `${DDG_API}?q=${encodeURIComponent(query)}&format=json&no_redirect=1`;
      try {
        const res = await fetch(url, { headers: { "User-Agent": "OpenPaw/1.0" } });
        if (!res.ok) {
          return `Search failed (${res.status}): ${(await res.text()).slice(0, 150)}`;
        }
        const data = (await res.json()) as {
          Abstract?: string;
          AbstractURL?: string;
          AbstractText?: string;
          RelatedTopics?: Array<{ FirstURL?: string; Text?: string } | { Topics?: Array<{ FirstURL?: string; Text?: string }> }>;
        };
        const parts: string[] = [];
        if (data.AbstractText || data.Abstract) {
          parts.push((data.AbstractText || data.Abstract || "").trim());
          if (data.AbstractURL) parts.push(`Source: ${data.AbstractURL}`);
        }
        const topics: Array<{ FirstURL?: string; Text?: string }> = [];
        for (const t of data.RelatedTopics ?? []) {
          if ("Topics" in t && Array.isArray(t.Topics)) {
            topics.push(...t.Topics);
          } else if ("FirstURL" in t || "Text" in t) {
            topics.push(t as { FirstURL?: string; Text?: string });
          }
        }
        for (let i = 0; i < Math.min(5, topics.length); i++) {
          const item = topics[i];
          const text = (item.Text ?? "").trim();
          const url2 = (item.FirstURL ?? "").trim();
          if (text || url2) parts.push(`${i + 1}. ${text}${url2 ? "\n   " + url2 : ""}`);
        }
        const out = parts.filter(Boolean).join("\n\n");
        return out || "No results found for that query.";
      } catch (e) {
        return `Search failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}
