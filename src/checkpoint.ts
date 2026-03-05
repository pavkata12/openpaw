import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Message } from "./llm.js";

/**
 * Task checkpointing - save progress and resume long tasks if interrupted
 */

interface Checkpoint {
  id: string;
  taskDescription: string;
  createdAt: number;
  lastUpdated: number;
  turnCount: number;
  messages: Message[];
  metadata: {
    currentStep?: string;
    completedSteps: string[];
    remainingSteps: string[];
  };
}

class CheckpointManager {
  private checkpointsDir: string;
  
  constructor(dataDir: string) {
    this.checkpointsDir = join(dataDir, "checkpoints");
    mkdirSync(this.checkpointsDir, { recursive: true });
  }
  
  /**
   * Save checkpoint
   */
  save(checkpoint: Checkpoint): void {
    const filepath = join(this.checkpointsDir, `${checkpoint.id}.json`);
    checkpoint.lastUpdated = Date.now();
    writeFileSync(filepath, JSON.stringify(checkpoint, null, 2));
  }
  
  /**
   * Load checkpoint
   */
  load(id: string): Checkpoint | null {
    const filepath = join(this.checkpointsDir, `${id}.json`);
    if (!existsSync(filepath)) return null;
    
    try {
      const data = readFileSync(filepath, "utf-8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }
  
  /**
   * List all checkpoints
   */
  listAll(): Array<{ id: string; task: string; updated: string; turns: number }> {
    try {
      const { readdirSync } = require("node:fs");
      const files = readdirSync(this.checkpointsDir).filter((f: string) => f.endsWith(".json"));
      
      return files.map((f: string) => {
        const id = f.replace(".json", "");
        const checkpoint = this.load(id);
        if (!checkpoint) return null;
        
        const age = Date.now() - checkpoint.lastUpdated;
        const ageStr = age < 60000 ? `${Math.floor(age / 1000)}s ago` :
                       age < 3600000 ? `${Math.floor(age / 60000)}m ago` :
                       `${Math.floor(age / 3600000)}h ago`;
        
        return {
          id,
          task: checkpoint.taskDescription,
          updated: ageStr,
          turns: checkpoint.turnCount
        };
      }).filter(Boolean);
    } catch {
      return [];
    }
  }
  
  /**
   * Delete checkpoint
   */
  delete(id: string): void {
    const filepath = join(this.checkpointsDir, `${id}.json`);
    try {
      const { unlinkSync } = require("node:fs");
      unlinkSync(filepath);
    } catch {
      // Ignore
    }
  }
}

let checkpointManager: CheckpointManager | null = null;

/**
 * Initialize checkpoint manager
 */
export function initCheckpointManager(dataDir: string): void {
  checkpointManager = new CheckpointManager(dataDir);
}

/**
 * Get checkpoint manager instance
 */
export function getCheckpointManager(): CheckpointManager | null {
  return checkpointManager;
}

/**
 * Auto-checkpoint during long agent runs
 */
export function autoCheckpoint(
  checkpointId: string,
  taskDescription: string,
  turnCount: number,
  messages: Message[],
  metadata: Checkpoint["metadata"]
): void {
  if (!checkpointManager) return;
  
  const checkpoint: Checkpoint = {
    id: checkpointId,
    taskDescription,
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    turnCount,
    messages,
    metadata
  };
  
  checkpointManager.save(checkpoint);
}

/**
 * Create checkpoint ID from task
 */
export function createCheckpointId(taskDescription: string): string {
  const hash = taskDescription
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .substring(0, 50);
  const timestamp = Date.now().toString(36);
  return `${hash}-${timestamp}`;
}
