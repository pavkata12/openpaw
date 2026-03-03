import { readFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface Pack {
  name: string;
  tools: string[];
  systemPromptSuffix?: string;
}

const DEFAULT_PACKS: Map<string, Pack> = new Map([
  [
    "recon",
    {
      name: "recon",
      tools: ["nmap_scan", "run_script"],
      systemPromptSuffix: "\n\n**Recon pack:** Focus on network reconnaissance. Use nmap_scan for targets and run_script for predefined recon scripts.",
    },
  ],
  [
    "wireless",
    {
      name: "wireless",
      tools: ["wireless_scan", "wireless_attack", "run_script"],
      systemPromptSuffix: "\n\n**Wireless pack:** Focus on Wi-Fi scanning and attacks. Use wireless_scan to list networks, wireless_attack for WPA/WEP/WPS, run_script for custom wireless scripts.",
    },
  ],
  [
    "web",
    {
      name: "web",
      tools: ["nikto_scan", "run_script"],
      systemPromptSuffix: "\n\n**Web pack:** Focus on web vulnerability scanning. Use nikto_scan for targets and run_script for custom web scan scripts.",
    },
  ],
  ["full", { name: "full", tools: [] }],
]);

const PACKS_FILENAME = "packs.json";

export async function loadPacks(dataDir: string): Promise<Map<string, Pack>> {
  const out = new Map(DEFAULT_PACKS);
  const path = join(dataDir, PACKS_FILENAME);
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, { name?: string; tools?: string[]; systemPromptSuffix?: string }>;
    for (const [key, p] of Object.entries(parsed)) {
      if (p && Array.isArray(p.tools)) {
        out.set(key, {
          name: p.name ?? key,
          tools: p.tools,
          systemPromptSuffix: typeof p.systemPromptSuffix === "string" ? p.systemPromptSuffix : undefined,
        });
      }
    }
  } catch {
    // no file or invalid — use defaults only
  }
  return out;
}

export async function getPack(name: string, dataDir?: string): Promise<Pack | null> {
  const packs = dataDir ? await loadPacks(dataDir) : DEFAULT_PACKS;
  const n = name.trim().toLowerCase();
  if (!n) return null;
  return packs.get(n) ?? null;
}

export async function listPacks(dataDir?: string): Promise<string[]> {
  const packs = dataDir ? await loadPacks(dataDir) : DEFAULT_PACKS;
  return [...packs.keys()];
}

/** Base tool names always included in every pack (and when pack is full). */
export const BASE_TOOL_NAMES = new Set(["remember", "recall", "run_shell"]);

/** Returns set of tool names to allow: BASE + pack tools, or null meaning all tools. */
export function getAllowedToolNames(pack: Pack | null): Set<string> | null {
  if (!pack || pack.name === "full" || pack.tools.length === 0) return null;
  const set = new Set(BASE_TOOL_NAMES);
  for (const t of pack.tools) set.add(t);
  return set;
}
