import type { ToolDefinition } from "../tools/types.js";

export interface MCPServerConfig {
  command?: string;
  args?: string[];
  url?: string;
}

export interface MCPToolAdapter {
  listTools(): Promise<ToolDefinition[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<string>;
  close(): Promise<void>;
}

async function connectStdio(config: { command: string; args?: string[] }): Promise<MCPToolAdapter> {
  const { Client } = await import("@modelcontextprotocol/sdk/client");
  const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");

  const client = new Client({ name: "openpaw", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: config.command,
    args: config.args ?? [],
  });
  await client.connect(transport);

  const extractText = (r: Awaited<ReturnType<typeof client.callTool>>): string => {
    const c = (r as { content?: Array<{ type?: string; text?: string }> }).content;
    return c?.map((x) => (typeof x === "string" ? x : x?.text ?? "")).join("\n") ?? "";
  };

  const adapter: MCPToolAdapter = {
    async listTools(): Promise<ToolDefinition[]> {
      const all: ToolDefinition[] = [];
      let cursor: string | undefined;
      do {
        const { tools, nextCursor } = await client.listTools({ cursor });
        for (const t of tools) {
          all.push({
            name: t.name,
            description: t.description ?? "",
            parameters: t.inputSchema as ToolDefinition["parameters"],
            async execute(args) {
              const result = await client.callTool({ name: t.name, arguments: args });
              return extractText(result);
            },
          });
        }
        cursor = nextCursor;
      } while (cursor);
      return all;
    },
    async callTool(name: string, args: Record<string, unknown>): Promise<string> {
      const result = await client.callTool({ name, arguments: args });
      return extractText(result);
    },
    async close() {
      await client.close();
    },
  };
  return adapter;
}

async function connectStreamableHttp(url: string): Promise<MCPToolAdapter> {
  const { Client } = await import("@modelcontextprotocol/sdk/client");
  const { StreamableHTTPClientTransport } = await import("@modelcontextprotocol/sdk/client/streamableHttp.js");

  const client = new Client({ name: "openpaw", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(url));
  await client.connect(transport);

  const extractText = (r: Awaited<ReturnType<typeof client.callTool>>): string => {
    const c = (r as { content?: Array<{ type?: string; text?: string }> }).content;
    return c?.map((x) => (typeof x === "string" ? x : x?.text ?? "")).join("\n") ?? "";
  };

  const adapter: MCPToolAdapter = {
    async listTools(): Promise<ToolDefinition[]> {
      const all: ToolDefinition[] = [];
      let cursor: string | undefined;
      do {
        const { tools, nextCursor } = await client.listTools({ cursor });
        for (const t of tools) {
          all.push({
            name: t.name,
            description: t.description ?? "",
            parameters: t.inputSchema as ToolDefinition["parameters"],
            async execute(args) {
              const result = await client.callTool({ name: t.name, arguments: args });
              return extractText(result);
            },
          });
        }
        cursor = nextCursor;
      } while (cursor);
      return all;
    },
    async callTool(name: string, args: Record<string, unknown>): Promise<string> {
      const result = await client.callTool({ name, arguments: args });
      return extractText(result);
    },
    async close() {
      if ("terminateSession" in transport && typeof transport.terminateSession === "function") {
        await (transport as { terminateSession: () => Promise<void> }).terminateSession();
      }
      await client.close();
    },
  };
  return adapter;
}

export async function connectMCPServer(config: MCPServerConfig): Promise<MCPToolAdapter> {
  if (config.command) {
    return connectStdio({ command: config.command, args: config.args });
  }
  if (config.url) {
    return connectStreamableHttp(config.url);
  }
  throw new Error("MCP server config must have 'command' or 'url'");
}
