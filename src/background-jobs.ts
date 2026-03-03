import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ToolRegistry } from "./tools/types.js";

export interface BackgroundJob {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  status: "pending" | "running" | "done" | "failed";
  result?: string;
  error?: string;
  channel?: string;
  userId?: string;
  channelId?: string;
  createdAt: string;
  finishedAt?: string;
}

const FILENAME = "background_jobs.json";

function loadJobs(dataDir: string): BackgroundJob[] {
  const path = join(dataDir, FILENAME);
  if (!existsSync(path)) return [];
  try {
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveJobs(dataDir: string, jobs: BackgroundJob[]): void {
  mkdirSync(dataDir, { recursive: true });
  writeFileSync(join(dataDir, FILENAME), JSON.stringify(jobs, null, 2), "utf-8");
}

function createId(): string {
  return "bg_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 9);
}

export function listJobs(dataDir: string): BackgroundJob[] {
  return loadJobs(dataDir);
}

export function getJob(dataDir: string, id: string): BackgroundJob | undefined {
  return loadJobs(dataDir).find((j) => j.id === id);
}

export function markDone(dataDir: string, id: string, result: string): void {
  const jobs = loadJobs(dataDir);
  const j = jobs.find((x) => x.id === id);
  if (j) {
    j.status = "done";
    j.result = result;
    j.finishedAt = new Date().toISOString();
    saveJobs(dataDir, jobs);
  }
}

export function markFailed(dataDir: string, id: string, error: string): void {
  const jobs = loadJobs(dataDir);
  const j = jobs.find((x) => x.id === id);
  if (j) {
    j.status = "failed";
    j.error = error;
    j.finishedAt = new Date().toISOString();
    saveJobs(dataDir, jobs);
  }
}

export function startBackgroundJob(
  dataDir: string,
  opts: {
    toolName: string;
    args: Record<string, unknown>;
    channel?: string;
    userId?: string;
    channelId?: string;
  },
  tools: ToolRegistry,
  onDone: (job: BackgroundJob, result: string | null) => void | Promise<void>
): string {
  const id = createId();
  const job: BackgroundJob = {
    id,
    toolName: opts.toolName,
    args: opts.args,
    status: "running",
    channel: opts.channel,
    userId: opts.userId,
    channelId: opts.channelId,
    createdAt: new Date().toISOString(),
  };
  const jobs = loadJobs(dataDir);
  jobs.push(job);
  saveJobs(dataDir, jobs);

  setImmediate(async () => {
    const tool = tools.get(opts.toolName);
    try {
      const result = tool ? await tool.execute(opts.args) : "Unknown tool: " + opts.toolName;
      markDone(dataDir, id, result);
      const updated = getJob(dataDir, id) ?? job;
      await onDone(updated, result);
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      markFailed(dataDir, id, errMsg);
      const updated = getJob(dataDir, id) ?? job;
      await onDone(updated, null);
    }
  });

  return id;
}
