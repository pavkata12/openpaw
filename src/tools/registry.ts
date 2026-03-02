import type { ToolDefinition, ToolRegistry } from "./types.js";

class Registry implements ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }
}

export function createToolRegistry(): ToolRegistry {
  return new Registry();
}
