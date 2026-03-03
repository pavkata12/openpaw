import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export interface AuditLogOptions {
  enabled: boolean;
  path: string;
}

export interface ToolCallAuditEntry {
  ts: string;
  tool: string;
  args: string;
  resultSummary: string;
  channel?: string;
}

function formatEntry(entry: ToolCallAuditEntry): string {
  return JSON.stringify(entry) + "\n";
}

export async function logToolCall(
  options: AuditLogOptions,
  params: {
    toolName: string;
    args: Record<string, unknown>;
    resultSummary?: string;
    channel?: string;
  }
): Promise<void> {
  if (!options.enabled || !options.path) return;
  const argsStr = JSON.stringify(params.args);
  const resultSummary = (params.resultSummary ?? "").slice(0, 500);
  const entry: ToolCallAuditEntry = {
    ts: new Date().toISOString(),
    tool: params.toolName,
    args: argsStr,
    resultSummary,
    channel: params.channel,
  };
  try {
    await mkdir(dirname(options.path), { recursive: true });
    await appendFile(options.path, formatEntry(entry), "utf-8");
  } catch {
    // best-effort; do not throw
  }
}
