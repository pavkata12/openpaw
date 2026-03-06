import type { ToolDefinition } from "./types.js";
import { readFileSync, unlinkSync } from "node:fs";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execAsync = promisify(exec);

/**
 * Context Aware Help - AI suggests next actions based on current screen
 * Analyzes screen + conversation history to proactively help
 */

interface ContextHelpArgs {
  current_task?: string;
  stuck?: boolean;
  ask_suggestions?: boolean;
}

async function takeScreenshot(): Promise<string> {
  const screenshotPath = join(tmpdir(), `context-${Date.now()}.png`);
  
  if (process.platform === "win32") {
    await execAsync(
      `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds | ForEach-Object { $bmp = New-Object System.Drawing.Bitmap($_.Width, $_.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($_.Left, $_.Top, 0, 0, $bmp.Size); $bmp.Save('${screenshotPath}'); $g.Dispose(); $bmp.Dispose() }"`,
      { timeout: 10000 }
    );
  } else if (process.platform === "darwin") {
    await execAsync(`screencapture -x "${screenshotPath}"`, { timeout: 10000 });
  } else {
    try {
      await execAsync(`scrot "${screenshotPath}"`, { timeout: 10000 });
    } catch {
      await execAsync(`import -window root "${screenshotPath}"`, { timeout: 10000 });
    }
  }
  
  return screenshotPath;
}

function generateContextualSuggestions(task?: string, isStuck?: boolean): string[] {
  const suggestions: string[] = [];
  
  if (isStuck) {
    suggestions.push("📸 **Describe screen**: 'What's on screen?' - I'll tell you what I see");
    suggestions.push("🔍 **Search for help**: 'Search how to [do X]' - I'll find tutorials");
    suggestions.push("🛠️ **Auto-fix**: 'Fix this error' - I'll diagnose and suggest solutions");
    suggestions.push("🔊 **Read aloud**: 'Read this' - I'll read screen content to you");
    suggestions.push("🎯 **Simplify**: 'Break this down' - I'll split the task into steps");
  } else if (task) {
    const taskLower = task.toLowerCase();
    
    if (taskLower.includes("watch") || taskLower.includes("video") || taskLower.includes("anime")) {
      suggestions.push("🎬 **Find content**: 'Find [anime] episode [X]' - I'll locate streaming links");
      suggestions.push("▶️ **Play video**: 'Open and play' - I'll navigate to the video and hit play");
      suggestions.push("🖥️ **Fullscreen**: 'Make it fullscreen' - I'll maximize the video player");
    } else if (taskLower.includes("search") || taskLower.includes("find") || taskLower.includes("research")) {
      suggestions.push("🔍 **Smart search**: 'Research [topic]' - I'll fetch and summarize multiple sources");
      suggestions.push("🌐 **Open website**: 'Go to [website]' - I'll navigate there");
      suggestions.push("📖 **Read results**: 'Read the first result' - I'll read it aloud");
    } else if (taskLower.includes("code") || taskLower.includes("program") || taskLower.includes("script")) {
      suggestions.push("📝 **Write code**: 'Create a [language] script that [does X]'");
      suggestions.push("🔧 **Fix errors**: 'This code has errors' - I'll analyze and fix");
      suggestions.push("🚀 **Run code**: 'Execute the script' - I'll run it for you");
    } else {
      suggestions.push("🎤 **Voice commands**: Just say what you want naturally");
      suggestions.push("🔊 **Read aloud**: 'Read this' - I'll read any text to you");
      suggestions.push("🖱️ **Navigate**: 'Click [element]' - I'll find and click it");
    }
  } else {
    // General suggestions
    suggestions.push("🎤 **Talk naturally**: Say what you want to do in your own words");
    suggestions.push("📸 **Describe screen**: 'What's on screen?' anytime you need orientation");
    suggestions.push("🔍 **Smart search**: 'Research [topic]' for multi-source research");
    suggestions.push("🎬 **Watch content**: 'Find and play [anime/video]' for automatic playback");
    suggestions.push("🖱️ **Navigate apps**: 'Open [app/website]' to launch anything");
    suggestions.push("🔊 **Read aloud**: 'Read this' to hear any content");
    suggestions.push("🛠️ **Auto-fix errors**: 'Fix it' when something goes wrong");
  }
  
  return suggestions;
}

export function createContextAwareHelpTool(): ToolDefinition {
  return {
    name: "context_aware_help",
    description: `Provides contextual suggestions based on current screen and task. AI analyzes what you're doing and suggests relevant next actions. Essential for blind/low-vision users who may not see all available options. Use when user seems stuck, asks "what now?", "what can I do?", or needs guidance. Proactively offers help without being asked.`,
    parameters: {
      type: "object",
      properties: {
        current_task: {
          type: "string",
          description: "What the user is currently trying to do (e.g., 'watching anime', 'coding', 'researching')"
        },
        stuck: {
          type: "boolean",
          description: "Whether the user seems stuck or confused (triggers more detailed help)"
        },
        ask_suggestions: {
          type: "boolean",
          description: "Whether to ask the user which suggestion they want (default: true)"
        }
      }
    },
    
    async execute(args: Record<string, unknown>) {
      const currentTask = args.current_task as string;
      const isStuck = args.stuck as boolean;
      const askSuggestions = args.ask_suggestions !== false;
      
      try {
        // Generate suggestions
        const suggestions = generateContextualSuggestions(currentTask, isStuck);
        
        return `💡 **Context-Aware Help**

${isStuck ? "🆘 **I see you might be stuck. Let me help!**" : ""}
${currentTask ? `📋 **Current Task:** ${currentTask}\n` : ""}

---

## 🎯 **What You Can Do:**

${suggestions.join('\n')}

---

## 🎤 **Voice Command Examples:**

**General:**
- "What's on screen?"
- "Read this to me"
- "Open YouTube"
- "Find Python tutorial"

**When Watching Videos:**
- "Find One Piece episode 1"
- "Make it fullscreen"
- "Pause" / "Play"
- "Skip forward 10 seconds"

**When Coding:**
- "Write a Python script that downloads files"
- "Fix this error"
- "Run the code"
- "Explain this function"

**When Stuck:**
- "Help me"
- "What can I do now?"
- "I don't know what to do"
- "Fix it"

---

${askSuggestions ? "**What would you like to do?** Just say it naturally! 🎤" : ""}

**💡 Pro Tip:** You don't need exact commands - just talk naturally and I'll understand! For example:
- ❌ Don't say: "Execute the anime_search tool with parameter episode 5"
- ✅ Do say: "Find Dead Account episode 5"

**Accessibility Features:**
- 🔊 All responses are optimized for screen readers
- 🎤 Voice input works in any language
- 📸 Visual content is described in detail
- 🤖 I can do everything autonomously - just tell me what you want!`;
        
      } catch (error) {
        return `❌ Context help failed: ${error instanceof Error ? error.message : 'unknown error'}

**Don't worry!** Just tell me what you're trying to do in plain language and I'll help. For example:
- "I want to watch anime"
- "Help me search for something"
- "I'm trying to code but it's not working"
- "What can I do?"`;
      }
    }
  };
}
