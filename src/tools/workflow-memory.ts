import type { ToolDefinition } from "./types.js";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Workflow learning system - remembers successful navigation patterns
 * and auto-applies them for similar tasks
 */

interface WorkflowPattern {
  id: string;
  name: string;
  description: string;
  successCount: number;
  lastUsed: number;
  steps: Array<{
    tool: string;
    args: Record<string, unknown>;
    description: string;
  }>;
  tags: string[];  // e.g., ["youtube", "video", "search"]
}

class WorkflowMemory {
  private workflows = new Map<string, WorkflowPattern>();
  private workflowFile: string;
  
  constructor(dataDir: string) {
    const workflowDir = join(dataDir, "workflows");
    mkdirSync(workflowDir, { recursive: true });
    this.workflowFile = join(workflowDir, "patterns.json");
    this.load();
  }
  
  private load(): void {
    if (existsSync(this.workflowFile)) {
      try {
        const data = JSON.parse(readFileSync(this.workflowFile, "utf-8"));
        this.workflows = new Map(data.map((w: WorkflowPattern) => [w.id, w]));
      } catch {
        // Ignore load errors
      }
    }
  }
  
  private save(): void {
    try {
      const data = Array.from(this.workflows.values());
      writeFileSync(this.workflowFile, JSON.stringify(data, null, 2));
    } catch {
      // Ignore save errors
    }
  }
  
  /**
   * Record a successful workflow
   */
  recordSuccess(
    name: string,
    description: string,
    steps: Array<{ tool: string; args: Record<string, unknown>; description: string }>,
    tags: string[]
  ): void {
    const id = this.generateId(name, tags);
    const existing = this.workflows.get(id);
    
    if (existing) {
      existing.successCount++;
      existing.lastUsed = Date.now();
      existing.steps = steps;  // Update with latest successful steps
    } else {
      this.workflows.set(id, {
        id,
        name,
        description,
        successCount: 1,
        lastUsed: Date.now(),
        steps,
        tags
      });
    }
    
    this.save();
  }
  
  /**
   * Find similar workflow patterns based on tags
   */
  findSimilar(tags: string[]): WorkflowPattern[] {
    const matches: Array<{ workflow: WorkflowPattern; score: number }> = [];
    
    for (const workflow of this.workflows.values()) {
      const commonTags = workflow.tags.filter(t => tags.includes(t));
      if (commonTags.length > 0) {
        const score = commonTags.length * workflow.successCount;
        matches.push({ workflow, score });
      }
    }
    
    // Sort by score (best matches first)
    matches.sort((a, b) => b.score - a.score);
    
    return matches.map(m => m.workflow).slice(0, 5);
  }
  
  /**
   * Get workflow by ID
   */
  get(id: string): WorkflowPattern | undefined {
    return this.workflows.get(id);
  }
  
  /**
   * List all workflows
   */
  listAll(): WorkflowPattern[] {
    return Array.from(this.workflows.values())
      .sort((a, b) => b.successCount - a.successCount);
  }
  
  private generateId(name: string, tags: string[]): string {
    return `${name.toLowerCase().replace(/\s+/g, "-")}-${tags.sort().join("-")}`;
  }
}

let workflowMemory: WorkflowMemory | null = null;

/**
 * Initialize workflow memory
 */
export function initWorkflowMemory(dataDir: string): void {
  workflowMemory = new WorkflowMemory(dataDir);
}

/**
 * Tool to record successful workflows
 */
export function createRecordWorkflowTool(dataDir: string): ToolDefinition {
  if (!workflowMemory) initWorkflowMemory(dataDir);
  
  return {
    name: "record_workflow",
    description: `Record a successful workflow pattern for future use. When you complete a multi-step task successfully (e.g., "search YouTube → click video → make fullscreen"), record it so you can reuse the pattern later. This builds up your knowledge of effective navigation strategies.`,
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Short name for this workflow (e.g., 'youtube-video-search')"
        },
        description: {
          type: "string",
          description: "What this workflow does (e.g., 'Search and play videos on YouTube')"
        },
        steps: {
          type: "array",
          description: "List of steps in order",
          items: {
            type: "object",
            properties: {
              tool: { type: "string", description: "Tool name" },
              args: { type: "object", description: "Tool arguments" },
              description: { type: "string", description: "What this step does" }
            }
          }
        },
        tags: {
          type: "array",
          description: "Tags for finding similar workflows (e.g., ['youtube', 'video', 'search'])",
          items: { type: "string" }
        }
      },
    },
    async execute(args) {
      if (!workflowMemory) return "Error: Workflow memory not initialized.";
      
      const name = String(args.name ?? "").trim();
      const description = String(args.description ?? "").trim();
      const steps = args.steps as Array<{ tool: string; args: Record<string, unknown>; description: string }>;
      const tags = (args.tags as string[]).map(t => String(t).toLowerCase().trim());
      
      if (!name || !description || !steps?.length || !tags?.length) {
        return "Error: name, description, steps, and tags are required.";
      }
      
      workflowMemory.recordSuccess(name, description, steps, tags);
      
      return `Workflow recorded: ${name}\nSteps: ${steps.length}\nTags: ${tags.join(", ")}\n\nThis pattern will be suggested for similar tasks in the future.`;
    },
  };
}

/**
 * Tool to find and suggest workflow patterns
 */
export function createFindWorkflowTool(dataDir: string): ToolDefinition {
  if (!workflowMemory) initWorkflowMemory(dataDir);
  
  return {
    name: "find_workflow",
    description: `Find previously successful workflow patterns similar to your current task. Use this when starting a multi-step task to see if you've done something similar before. Provide tags describing what you want to do.`,
    parameters: {
      type: "object",
      properties: {
        tags: {
          type: "array",
          description: "Tags describing the task (e.g., ['youtube', 'video'], ['anime', 'stream'])",
          items: { type: "string" }
        }
      },
    },
    async execute(args) {
      if (!workflowMemory) return "Error: Workflow memory not initialized.";
      
      const tags = (args.tags as string[]).map(t => String(t).toLowerCase().trim());
      if (!tags.length) return "Error: tags are required.";
      
      const similar = workflowMemory.findSimilar(tags);
      
      if (similar.length === 0) {
        return `No similar workflows found for tags: ${tags.join(", ")}\n\nYou'll need to figure out the steps yourself. After you succeed, use record_workflow to save the pattern.`;
      }
      
      let result = `Found ${similar.length} similar workflow(s) for tags: ${tags.join(", ")}\n\n`;
      
      for (const workflow of similar) {
        result += `### ${workflow.name}\n`;
        result += `${workflow.description}\n`;
        result += `Success count: ${workflow.successCount} | Tags: ${workflow.tags.join(", ")}\n\n`;
        result += `Steps:\n`;
        for (let i = 0; i < workflow.steps.length; i++) {
          const step = workflow.steps[i];
          result += `  ${i + 1}. ${step.tool}: ${step.description}\n`;
        }
        result += `\n`;
      }
      
      result += `\nYou can adapt these patterns for your current task.`;
      
      return result;
    },
  };
}

/**
 * Tool to list all recorded workflows
 */
export function createListWorkflowsTool(dataDir: string): ToolDefinition {
  if (!workflowMemory) initWorkflowMemory(dataDir);
  
  return {
    name: "list_workflows",
    description: `List all recorded workflow patterns. Shows what successful multi-step workflows have been learned.`,
    parameters: {
      type: "object",
      properties: {},
    },
    async execute() {
      if (!workflowMemory) return "Error: Workflow memory not initialized.";
      
      const workflows = workflowMemory.listAll();
      
      if (workflows.length === 0) {
        return "No workflows recorded yet. Use record_workflow after completing multi-step tasks to build up knowledge.";
      }
      
      let result = `Recorded Workflows (${workflows.length}):\n\n`;
      
      for (const workflow of workflows) {
        result += `- ${workflow.name} (${workflow.successCount} successes)\n`;
        result += `  ${workflow.description}\n`;
        result += `  Tags: ${workflow.tags.join(", ")}\n`;
        result += `  Steps: ${workflow.steps.length}\n\n`;
      }
      
      return result;
    },
  };
}
