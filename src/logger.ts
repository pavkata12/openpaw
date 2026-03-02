import type { Config } from "./config.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

let logFormat: "text" | "json" = "text";

export function initLogger(config: Pick<Config, "OPENPAW_LOG_FORMAT">): void {
  logFormat = config.OPENPAW_LOG_FORMAT;
}

function format(level: LogLevel, msg: string, meta?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  if (logFormat === "json") {
    const entry: LogEntry = { ts, level, msg, ...meta };
    return JSON.stringify(entry);
  }
  const metaStr = meta && Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
  return `${ts} [${level.toUpperCase()}] ${msg}${metaStr}`;
}

export const logger = {
  debug(msg: string, meta?: Record<string, unknown>): void {
    console.debug(format("debug", msg, meta));
  },
  info(msg: string, meta?: Record<string, unknown>): void {
    console.info(format("info", msg, meta));
  },
  warn(msg: string, meta?: Record<string, unknown>): void {
    console.warn(format("warn", msg, meta));
  },
  error(msg: string, meta?: Record<string, unknown>): void {
    console.error(format("error", msg, meta));
  },
};
