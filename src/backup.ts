import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

export function createBackup(dataDir: string, name: string): string {
  const backupDir = join(dataDir, "backups");
  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupName = name ? `${name}_${timestamp}` : timestamp;
  const backupPath = join(backupDir, `${backupName}.json`);

  const backup: Record<string, unknown> = {
    version: 1,
    createdAt: new Date().toISOString(),
    data: {},
  };

  const memoryDir = join(dataDir, "memory");
  if (existsSync(memoryDir)) {
    const files = readdirSync(memoryDir).filter((f) => f.endsWith(".json"));
    const memory: Record<string, string> = {};
    for (const f of files) {
      try {
        memory[f] = readFileSync(join(memoryDir, f), "utf-8");
      } catch {
        // skip
      }
    }
    backup.data = { ...(backup.data as object), memory };
  }

  const memoryFile = join(dataDir, "memory.json");
  if (existsSync(memoryFile)) {
    try {
      (backup.data as Record<string, unknown>).memory_legacy = readFileSync(memoryFile, "utf-8");
    } catch {
      // skip
    }
  }

  writeFileSync(backupPath, JSON.stringify(backup, null, 2), "utf-8");
  return backupPath;
}

export function listBackups(dataDir: string): string[] {
  const backupDir = join(dataDir, "backups");
  if (!existsSync(backupDir)) return [];
  return readdirSync(backupDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => join(backupDir, f));
}

export function restoreBackup(dataDir: string, name: string): void {
  const backupDir = join(dataDir, "backups");
  const backups = listBackups(dataDir);
  const match = backups.find((p) => p.includes(name));
  if (!match) throw new Error(`Backup not found: ${name}`);
  const raw = readFileSync(match, "utf-8");
  const backup = JSON.parse(raw) as { data?: { memory?: Record<string, string>; memory_legacy?: string } };
  const data = backup.data ?? {};
  const memoryDir = join(dataDir, "memory");
  if (data.memory && typeof data.memory === "object") {
    mkdirSync(memoryDir, { recursive: true });
    for (const [f, content] of Object.entries(data.memory)) {
      writeFileSync(join(memoryDir, f), content, "utf-8");
    }
  }
  if (data.memory_legacy) {
    writeFileSync(join(dataDir, "memory.json"), data.memory_legacy, "utf-8");
  }
}
