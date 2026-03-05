import type { ToolDefinition, ToolRegistry } from "./types.js";
import { getCachedResult, setCachedResult, isToolCacheable } from "../tool-cache.js";

class Registry implements ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  register(tool: ToolDefinition): void {
    // Wrap tool execution with caching layer
    const originalExecute = tool.execute;
    
    const cachedExecute = async (args: Record<string, unknown>): Promise<string> => {
      // Check cache first if tool is cacheable
      if (isToolCacheable(tool.name)) {
        const cached = getCachedResult(tool.name, args);
        if (cached) {
          return `[CACHED] ${cached}`;
        }
      }
      
      // Execute tool
      const result = await originalExecute.call(tool, args);
      
      // Cache result if tool is cacheable
      if (isToolCacheable(tool.name) && typeof result === "string") {
        setCachedResult(tool.name, args, result);
      }
      
      return result;
    };
    
    this.tools.set(tool.name, {
      ...tool,
      execute: cachedExecute
    });
  }
}

export function createToolRegistry(): ToolRegistry {
  return new Registry();
}
