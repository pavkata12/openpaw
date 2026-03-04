import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ToolDefinition } from "../tools/types.js";
import { connectMCPServer, type MCPServerConfig } from "./client.js";
import { logger } from "../logger.js";

export type { MCPServerConfig } from "./client.js";

export interface MCPConfig {
  mcpServers?: Record<string, MCPServerConfig>;
}

function loadMCPConfig(dataDir?: string): MCPConfig {
  const paths = [
    dataDir ? resolve(dataDir, "openpaw.json") : null,
    resolve(process.cwd(), ".openpaw", "openpaw.json"),
    resolve(process.cwd(), "openpaw.json"),
  ].filter((p): p is string => !!p);
  for (const p of paths) {
    if (existsSync(p)) {
      try {
        const raw = readFileSync(p, "utf-8");
        const parsed = JSON.parse(raw) as MCPConfig;
        return parsed;
      } catch {
        return {};
      }
    }
  }
  return {};
}

export async function loadMCPTools(dataDir?: string): Promise<{ tools: ToolDefinition[]; close: () => Promise<void> }> {
  const config = loadMCPConfig(dataDir);
  const servers = config.mcpServers ?? {};
  const allTools: ToolDefinition[] = [];
  const adapters: Awaited<ReturnType<typeof connectMCPServer>>[] = [];

  for (const [name, serverConfig] of Object.entries(servers)) {
    try {
      const adapter = await connectMCPServer(serverConfig);
      adapters.push(adapter);
      const tools = await adapter.listTools();
      for (const t of tools) {
        const mcpName = `${name}_${t.name}`;
        allTools.push({
          name: mcpName,
          description: `[MCP ${name}] ${t.description}`,
          parameters: t.parameters,
          async execute(args) {
            return adapter.callTool(t.name, args);
          },
        });
      }
    } catch (err) {
      console.warn(`MCP server ${name} failed to load:`, err instanceof Error ? err.message : err);
    }
  }

  return {
    tools: allTools,
    async close() {
      for (const a of adapters) await a.close().catch((err) => logger.error("MCP adapter close failed", { err: err instanceof Error ? err.message : String(err) }));
    },
  };
}
