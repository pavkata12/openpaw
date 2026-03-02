import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { ToolDefinition } from "./types.js";

const CALENDAR_FILE = "calendar.json";

interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO date or datetime
  end?: string;
  description?: string;
}

interface CalendarStore {
  events: CalendarEvent[];
}

async function loadCalendar(dataDir: string): Promise<CalendarEvent[]> {
  const path = join(dataDir, CALENDAR_FILE);
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as CalendarStore;
    return Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return [];
  }
}

async function saveCalendar(dataDir: string, events: CalendarEvent[]): Promise<void> {
  await mkdir(dataDir, { recursive: true });
  const path = join(dataDir, CALENDAR_FILE);
  await writeFile(path, JSON.stringify({ events }, null, 2), "utf-8");
}

function randomId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function createCalendarListTool(dataDir: string): ToolDefinition {
  return {
    name: "calendar_list",
    description: "List calendar events in a date range. Give start and end as YYYY-MM-DD.",
    parameters: {
      type: "object",
      properties: {
        start: { type: "string", description: "Start date YYYY-MM-DD" },
        end: { type: "string", description: "End date YYYY-MM-DD" },
      },
    },
    async execute(args) {
      const start = String(args.start ?? "").trim();
      const end = String(args.end ?? "").trim();
      const events = await loadCalendar(dataDir);
      const startTime = start ? new Date(start).getTime() : 0;
      const endTime = end ? new Date(end).getTime() : Number.MAX_SAFE_INTEGER;
      const filtered = events.filter((e) => {
        const t = new Date(e.start).getTime();
        return t >= startTime && t <= endTime;
      });
      if (filtered.length === 0) return "No events in range.";
      return filtered
        .map(
          (e) =>
            `${e.start} | ${e.title}${e.description ? ": " + e.description.slice(0, 50) : ""}`
        )
        .join("\n");
    },
  };
}

export function createCalendarAddTool(dataDir: string): ToolDefinition {
  return {
    name: "calendar_add",
    description: "Add a calendar event. Requires title and start (YYYY-MM-DD or ISO datetime). Optional: end, description.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Event title" },
        start: { type: "string", description: "Start date/time (YYYY-MM-DD or full ISO)" },
        end: { type: "string", description: "End date/time (optional)" },
        description: { type: "string", description: "Event description (optional)" },
      },
    },
    async execute(args) {
      const title = String(args.title ?? "").trim();
      const start = String(args.start ?? "").trim();
      if (!title || !start) return "Error: title and start are required.";
      const events = await loadCalendar(dataDir);
      const event: CalendarEvent = {
        id: randomId(),
        title,
        start,
        end: args.end ? String(args.end).trim() : undefined,
        description: args.description ? String(args.description).trim() : undefined,
      };
      events.push(event);
      await saveCalendar(dataDir, events);
      return `Added event: ${title} at ${start} (id=${event.id}).`;
    },
  };
}
