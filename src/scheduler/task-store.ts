import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface ScheduledTask {
  id: string;
  cron: string;
  channelId: string;
  userId: string;
  prompt: string;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

interface Store {
  tasks: ScheduledTask[];
}

const FILENAME = "schedules.json";

export async function loadTasks(dataDir: string): Promise<ScheduledTask[]> {
  const path = join(dataDir, FILENAME);
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as Store;
    return Array.isArray(parsed.tasks) ? parsed.tasks : [];
  } catch {
    return [];
  }
}

export async function saveTasks(dataDir: string, tasks: ScheduledTask[]): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const path = join(dataDir, FILENAME);
  await writeFile(path, JSON.stringify({ tasks }, null, 2), "utf-8");
}
