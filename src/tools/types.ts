/** JSON-schema-like shape for tool parameters (object with optional properties, each can be string/number/array/object with type, description, items, enum, etc.). */
export type ToolParametersSchema = {
  type: "object";
  properties?: Record<string, Record<string, unknown>>;
};

export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: ToolParametersSchema;
  execute(args: Record<string, unknown>): Promise<string>;
}

export interface ToolRegistry {
  list(): ToolDefinition[];
  get(name: string): ToolDefinition | undefined;
  register(tool: ToolDefinition): void;
}
