import { randomUUID } from "node:crypto";
import type { ToolDefinition } from "./types.js";
import { loadTasks, saveTasks, type ScheduledTask } from "../scheduler/task-store.js";

export function createScheduleAddTool(
  dataDir: string,
  onRefresh: () => void | Promise<void>
): ToolDefinition {
  return {
    name: "schedule_add",
    description: "Add a scheduled task. The task runs at the given cron time and sends the prompt to the agent. Cron format: minute hour day-of-month month day-of-week (e.g. '0 9 * * *' = daily at 9am, '*/5 * * * *' = every 5 minutes).",
    parameters: {
      type: "object",
      properties: {
        cron: { type: "string", description: "Cron expression (e.g. '0 9 * * *' for 9am daily)" },
        prompt: { type: "string", description: "Prompt or instruction to run at scheduled time" },
      },
    },
    async execute(args) {
      const cron = String(args.cron ?? "").trim();
      const prompt = String(args.prompt ?? "").trim();
      if (!cron || !prompt) return "Error: cron and prompt are required.";
      const tasks = await loadTasks(dataDir);
      const task: ScheduledTask = {
        id: randomUUID(),
        cron,
        channelId: "scheduler",
        userId: "",
        prompt,
        enabled: true,
      };
      task.userId = task.id;
      tasks.push(task);
      await saveTasks(dataDir, tasks);
      await onRefresh();
      return `Scheduled task added: id=${task.id}, cron=${cron}. It will run at the next matching time.`;
    },
  };
}

export function createScheduleRemoveTool(
  dataDir: string,
  onRefresh: () => void | Promise<void>
): ToolDefinition {
  return {
    name: "schedule_remove",
    description: "Remove a scheduled task by id. Use schedule_list to see task ids.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "Task id from schedule_list" },
      },
    },
    async execute(args) {
      const id = String(args.id ?? "").trim();
      if (!id) return "Error: id is required.";
      const tasks = await loadTasks(dataDir);
      const before = tasks.length;
      const filtered = tasks.filter((t) => t.id !== id);
      if (filtered.length === before) return `No task found with id: ${id}`;
      await saveTasks(dataDir, filtered);
      await onRefresh();
      return `Removed scheduled task ${id}.`;
    },
  };
}

export function createScheduleListTool(dataDir: string): ToolDefinition {
  return {
    name: "schedule_list",
    description: "List all scheduled tasks with their id, cron, prompt, enabled status, and last run time.",
    parameters: { type: "object", properties: {} },
    async execute() {
      const tasks = await loadTasks(dataDir);
      if (tasks.length === 0) return "No scheduled tasks.";
      const lines = tasks.map(
        (t) =>
          `id=${t.id} cron=${t.cron} enabled=${t.enabled} prompt="${t.prompt.slice(0, 40)}..." lastRun=${t.lastRun ? new Date(t.lastRun).toISOString() : "never"}`
      );
      return lines.join("\n");
    },
  };
}
