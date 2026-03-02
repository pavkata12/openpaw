import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ToolDefinition } from "./types.js";
import type { Config } from "../config.js";
import { search, embedAndStore, ingestFile } from "../knowledge/index.js";

function getKnowledgeDir(config: Config, dataDir: string): string {
  if (config.OPENPAW_KNOWLEDGE_DIR) {
    const p = config.OPENPAW_KNOWLEDGE_DIR;
    if (p.startsWith("/") || (p.length >= 2 && p[1] === ":")) return p;
    return resolve(process.cwd(), p);
  }
  return join(dataDir, "knowledge");
}

export function createKnowledgeSearchTool(config: Config, dataDir: string): ToolDefinition {
  const storePath = getKnowledgeDir(config, dataDir);
  return {
    name: "knowledge_search",
    description: "Search the custom knowledge base for relevant passages. Returns top matching chunks. Use this to answer questions from ingested documents.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query or question" },
        topK: { type: "number", description: "Number of results to return (default 5)" },
      },
    },
    async execute(args) {
      const query = String(args.query ?? "").trim();
      if (!query) return "Error: query is required.";
      const topK = Math.min(20, Math.max(1, Number(args.topK) || 5));
      const results = await search(config, storePath, query, topK);
      if (results.length === 0) return "No relevant passages found in the knowledge base.";
      return results.map((r, i) => `[${i + 1}] ${r.source ? `(${r.source}) ` : ""}${r.text}`).join("\n\n");
    },
  };
}

export function createKnowledgeAddTool(config: Config, dataDir: string): ToolDefinition {
  const storePath = getKnowledgeDir(config, dataDir);
  return {
    name: "knowledge_add",
    description: "Add text or a file to the knowledge base. Pass either 'text' (raw text) or 'path' (filename relative to knowledge dir). The content will be chunked and embedded for later search.",
    parameters: {
      type: "object",
      properties: {
        text: { type: "string", description: "Raw text to add" },
        path: { type: "string", description: "File path relative to knowledge directory" },
      },
    },
    async execute(args) {
      const text = typeof args.text === "string" ? args.text.trim() : "";
      const pathArg = typeof args.path === "string" ? args.path.trim() : "";
      if (text) {
        const added = await embedAndStore(config, storePath, text);
        return `Added ${added} chunk(s) to the knowledge base.`;
      }
      if (pathArg) {
        const fullPath = join(storePath, pathArg);
        if (!existsSync(fullPath)) return `Error: file not found: ${pathArg}`;
        const added = await ingestFile(config, storePath, pathArg);
        return `Ingested file ${pathArg}: ${added} chunk(s) added.`;
      }
      return "Error: provide either 'text' or 'path'.";
    },
  };
}
