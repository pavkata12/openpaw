import cron from "node-cron";
import type { ScheduledTask } from "./task-store.js";
import { loadTasks, saveTasks } from "./task-store.js";

export interface SchedulerDeps {
  dataDir: string;
  onTrigger: (taskId: string, prompt: string) => Promise<void>;
}

const REFRESH_INTERVAL_MS = 60_000; // reload tasks from disk every minute

export function createScheduler(deps: SchedulerDeps) {
  const { dataDir, onTrigger } = deps;
  const scheduled = new Map<string, cron.ScheduledTask>();

  async function runTask(task: ScheduledTask) {
    if (!task.enabled) return;
    try {
      await onTrigger(task.id, task.prompt);
      task.lastRun = Date.now();
      const all = await loadTasks(dataDir);
      const idx = all.findIndex((t) => t.id === task.id);
      if (idx >= 0) {
        all[idx] = { ...all[idx], lastRun: task.lastRun };
        await saveTasks(dataDir, all);
      }
    } catch (err) {
      console.warn(`Scheduler task ${task.id} failed:`, err instanceof Error ? err.message : err);
    }
  }

  function stopAll() {
    for (const t of scheduled.values()) t.stop();
    scheduled.clear();
  }

  function scheduleTasks(tasks: ScheduledTask[]) {
    stopAll();
    for (const task of tasks) {
      if (!task.enabled) continue;
      try {
        const job = cron.schedule(task.cron, () => runTask(task));
        scheduled.set(task.id, job);
      } catch (err) {
        console.warn(`Invalid cron "${task.cron}" for task ${task.id}:`, err instanceof Error ? err.message : err);
      }
    }
  }

  async function refresh() {
    const tasks = await loadTasks(dataDir);
    scheduleTasks(tasks);
  }

  let intervalId: ReturnType<typeof setInterval> | null = null;

  function start() {
    refresh();
    intervalId = setInterval(refresh, REFRESH_INTERVAL_MS);
  }

  function stop() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    stopAll();
  }

  return { start, stop, refresh };
}
