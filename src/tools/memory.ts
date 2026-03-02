import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ToolDefinition } from "./types.js";
import { getSessionKey } from "../session-context.js";

function sessionFile(dataDir: string, base: string): string {
  const key = getSessionKey();
  const safe = key ? key.replace(/[^a-zA-Z0-9_-]/g, "_") : "default";
  return join(dataDir, "memory", `${base}_${safe}.json`);
}

interface MemoryStore {
  entries: Record<string, string>;
  order: string[];
}

const DEFAULT_MAX_ENTRIES = 1000;

async function loadStore(file: string, maxEntries: number, legacyPath?: string): Promise<MemoryStore> {
  const tryLoad = async (path: string) => {
    try {
      const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as MemoryStore;
    if (!parsed.entries || !Array.isArray(parsed.order)) {
      return { entries: {}, order: [] };
    }
    if (parsed.order.length > maxEntries) {
      const toRemove = parsed.order.slice(0, parsed.order.length - maxEntries);
      for (const k of toRemove) delete parsed.entries[k];
      parsed.order = parsed.order.slice(-maxEntries);
    }
    return parsed;
  } catch {
    return null;
  }
  };
  const result = await tryLoad(file);
  if (result) return result;
  if (legacyPath) {
    const legacy = await tryLoad(legacyPath);
    if (legacy) return legacy;
  }
  return { entries: {}, order: [] };
}

async function saveStore(file: string, store: MemoryStore): Promise<void> {
  await writeFile(file, JSON.stringify(store, null, 2), "utf-8");
}

export function createMemoryTool(dataDir: string, maxEntries = DEFAULT_MAX_ENTRIES): ToolDefinition {
  const getFile = () => sessionFile(dataDir, "store");

  return {
    name: "remember",
    description: "Store a fact for the user (key-value). Use for preferences, names, or anything to recall later.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Short key (e.g. favorite_color)" },
        value: { type: "string", description: "Value to remember" },
      },
    },
    async execute(args) {
      const key = String(args.key ?? "").trim();
      const value = String(args.value ?? "").trim();
      if (!key) return "Error: key is required.";
      const file = getFile();
      const legacy = !getSessionKey() ? join(dataDir, "memory.json") : undefined;
      const store = await loadStore(file, maxEntries, legacy);
      if (!(key in store.entries)) {
        store.order.push(key);
        while (store.order.length > maxEntries) {
          const oldest = store.order.shift()!;
          delete store.entries[oldest];
        }
      }
      store.entries[key] = value;
      await mkdir(join(dataDir, "memory"), { recursive: true });
      await saveStore(file, store);
      return `Remembered: ${key} = ${value}`;
    },
  };
}

export function createRecallTool(dataDir: string): ToolDefinition {
  const getFile = () => sessionFile(dataDir, "store");

  return {
    name: "recall",
    description: "Recall a previously stored fact by key.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Key to look up" },
      },
    },
    async execute(args) {
      const key = String(args.key ?? "").trim();
      if (!key) return "Error: key is required.";
      const legacy = !getSessionKey() ? join(dataDir, "memory.json") : undefined;
      const store = await loadStore(getFile(), DEFAULT_MAX_ENTRIES, legacy);
      const value = store.entries[key];
      if (value === undefined) return `No value stored for key: ${key}`;
      return value;
    },
  };
}
