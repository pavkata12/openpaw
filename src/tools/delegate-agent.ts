import type { ToolDefinition } from "./types.js";

const DELEGATE_TO_AGENT_NAME = "delegate_to_agent";

/**
 * Tool that runs a subtask with the second LLM. The primary agent calls this to
 * "hand off" work to the other model; the second agent has the same tools except
 * delegate_to_agent (no recursion). Use executeDelegate from bootstrap, e.g.:
 * runAgent(llm2, registry, message, [], { excludeToolNames: [DELEGATE_TO_AGENT_NAME] }).
 */
export function createDelegateToAgentTool(
  executeDelegate: (message: string) => Promise<string>
): ToolDefinition {
  return {
    name: DELEGATE_TO_AGENT_NAME,
    description: `Delegate a subtask to the second AI agent. Use when you want the other model to do work in parallel or handle a specific sub-question: it has the same tools (read_file, run_shell, web_search, nmap_scan, etc.) but cannot delegate further. Pass a clear instruction; you will receive its full reply as the result. Example: "Scan 192.168.1.0/24 with nmap and summarize open ports" or "Search the web for X and return the top 3 links."`,
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Clear instruction for the second agent (what to do, what to return). Required.",
        },
        task_description: {
          type: "string",
          description: "Optional short label for the task (e.g. 'Run nmap scan', 'Web search').",
        },
      },
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const message = typeof args.message === "string" ? args.message.trim() : "";
      if (!message) return "Error: delegate_to_agent requires a non-empty 'message' with the instruction for the second agent.";
      const taskLabel = typeof args.task_description === "string" ? args.task_description.trim() : "";
      const prefix = taskLabel ? `[Task: ${taskLabel}]\n` : "";
      const result = await executeDelegate(prefix + message);
      return result;
    },
  };
}

export { DELEGATE_TO_AGENT_NAME };
