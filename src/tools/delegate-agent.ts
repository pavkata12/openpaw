import type { ToolDefinition } from "./types.js";

const DELEGATE_TO_AGENT_NAME = "delegate_to_agent";

/** Injected as systemPromptSuffix when running the second agent so it executes step-by-step with browser tools. */
export const DELEGATE_EXECUTOR_SUFFIX =
  "You are executing a sub-task. Follow the instruction step by step. Use browser_open_and_read to open URLs and get page content, links, and buttons; use browser_automate to click, type, scroll, hover, select_option as needed. Do not skip steps—execute each one and report what you did. Return the final result (e.g. playback URL or confirmation) to the primary agent.";

export type DelegateHistoryRef = { history: Array<{ request: string; response: string }> };

/**
 * Tool that runs a subtask with the second LLM. The primary agent can call it
 * multiple times in one task; the second agent receives the last N exchanges as
 * context so they can have a short dialogue (clarify, follow-up). The second
 * agent has the same tools except delegate_to_agent (no recursion).
 */
export function createDelegateToAgentTool(
  executeDelegate: (message: string, context: Array<{ request: string; response: string }>) => Promise<string>,
  delegateHistoryRef: DelegateHistoryRef,
  maxContextExchanges: number = 5
): ToolDefinition {
  return {
    name: DELEGATE_TO_AGENT_NAME,
    description: `Delegate a subtask to the second AI agent. You can call this multiple times in one task; the other agent sees the previous exchanges and can build on them. It has the same tools as you (browser_open_and_read, browser_automate, web_search, run_shell, etc.) but cannot delegate further. For browser tasks (e.g. "go to site X, find Y, play Z") prefer passing a 'steps' array so the second agent gets a strict numbered list to execute. Example steps: ["Open https://example.com", "Use browser_open_and_read to find the link for [X]", "Open that page and find [Y]", "Click first episode / [Z]", "Return playback URL or confirm"]. If you omit steps, write a very clear numbered instruction in message. The second agent is instructed to execute every step with browser tools and report the result.`,
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "Goal or full instruction for the second agent. Required. If steps is provided, this is the goal line (e.g. 'Play first episode of Hells Paradise from HiAnime').",
        },
        steps: {
          type: "array",
          description: "Optional. For browser/site tasks: exact steps the second agent must do in order (each step one string). Strongly recommended for 'go to site and find X and do Y' requests.",
          items: { type: "string" },
        },
        task_description: {
          type: "string",
          description: "Optional short label (e.g. 'Browser: HiAnime Hells Paradise').",
        },
      },
    },
    async execute(args: Record<string, unknown>): Promise<string> {
      const message = typeof args.message === "string" ? args.message.trim() : "";
      if (!message) return "Error: delegate_to_agent requires a non-empty 'message'.";
      const taskLabel = typeof args.task_description === "string" ? args.task_description.trim() : "";
      const prefix = taskLabel ? `[Task: ${taskLabel}]\n` : "";
      const rawSteps = args.steps as string[] | undefined;
      const steps = Array.isArray(rawSteps) ? rawSteps.map((s) => String(s).trim()).filter(Boolean) : [];
      const fullMessage =
        steps.length > 0
          ? prefix +
            "Goal: " +
            message +
            "\n\nExecute these steps in order (use browser_open_and_read and browser_automate as needed; do not skip any step):\n" +
            steps.map((s, i) => `${i + 1}. ${s}`).join("\n")
          : prefix + message;
      const context = maxContextExchanges > 0
        ? delegateHistoryRef.history.slice(-maxContextExchanges)
        : [];
      const result = await executeDelegate(fullMessage, context);
      delegateHistoryRef.history.push({ request: fullMessage, response: result });
      return result;
    },
  };
}

export { DELEGATE_TO_AGENT_NAME };
