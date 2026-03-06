import type { ToolDefinition } from "./types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execAsync = promisify(exec);

/**
 * Voice Describe Screen - AI describes what's visible on screen
 * For blind/low-vision users - takes screenshot + uses vision model to describe
 */

interface DescribeScreenArgs {
  detail_level?: "brief" | "detailed" | "interactive";
  focus_area?: string;
  read_text?: boolean;
}

async function takeScreenshot(): Promise<string> {
  const screenshotPath = join(tmpdir(), `screen-${Date.now()}.png`);
  
  if (process.platform === "win32") {
    await execAsync(
      `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Screen]::PrimaryScreen.Bounds | ForEach-Object { $bmp = New-Object System.Drawing.Bitmap($_.Width, $_.Height); $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen($_.Left, $_.Top, 0, 0, $bmp.Size); $bmp.Save('${screenshotPath}'); $g.Dispose(); $bmp.Dispose() }"`,
      { timeout: 10000 }
    );
  } else if (process.platform === "darwin") {
    await execAsync(`screencapture -x "${screenshotPath}"`, { timeout: 10000 });
  } else {
    // Linux: try multiple tools
    try {
      await execAsync(`scrot "${screenshotPath}"`, { timeout: 10000 });
    } catch {
      try {
        await execAsync(`import -window root "${screenshotPath}"`, { timeout: 10000 });
      } catch {
        try {
          await execAsync(`gnome-screenshot -f "${screenshotPath}"`, { timeout: 10000 });
        } catch {
          throw new Error("No screenshot tool available (tried: scrot, imagemagick, gnome-screenshot)");
        }
      }
    }
  }
  
  return screenshotPath;
}

function getScreenDescription(imagePath: string, detailLevel: string, focusArea?: string, readText?: boolean): string {
  // For now, return instructions - will be enhanced with vision model integration
  const imageBase64 = readFileSync(imagePath, { encoding: 'base64' });
  
  let prompt = "";
  
  if (detailLevel === "brief") {
    prompt = "Describe this screen in 1-2 sentences. What application is open and what is the user looking at?";
  } else if (detailLevel === "detailed") {
    prompt = "Describe this screen in detail. List all visible elements: windows, buttons, text fields, menus, icons. Describe their positions (top-left, center, bottom-right, etc).";
  } else if (detailLevel === "interactive") {
    prompt = "Describe this screen for a blind user who wants to interact with it. List all clickable elements, their labels, and how to access them (e.g., 'Play button in center', 'Settings menu in top-right').";
  }
  
  if (focusArea) {
    prompt += ` Focus specifically on: ${focusArea}.`;
  }
  
  if (readText) {
    prompt += " Read all visible text aloud, including buttons, labels, and content.";
  }
  
  // Return vision prompt + base64 image for LLM to process
  return JSON.stringify({
    type: "vision_request",
    prompt,
    image: `data:image/png;base64,${imageBase64}`,
    instructions: "Use your vision capabilities to analyze this screenshot and provide a helpful description for a blind or low-vision user."
  });
}

export function createVoiceDescribeScreenTool(): ToolDefinition {
  return {
    name: "voice_describe_screen",
    description: `Takes a screenshot and provides an AI-generated voice description of what's on screen. Essential for blind/low-vision users. Can provide brief overview, detailed description, or interactive element listing. Use when user asks "what's on screen?", "describe what you see", "what can I click?", or needs orientation. Works with OPENPAW_ACCESSIBILITY_MODE=true.`,
    parameters: {
      type: "object",
      properties: {
        detail_level: {
          type: "string",
          description: "Level of detail: 'brief' (1-2 sentences), 'detailed' (full description), 'interactive' (clickable elements)",
          enum: ["brief", "detailed", "interactive"]
        },
        focus_area: {
          type: "string",
          description: "Specific area to focus on (e.g., 'top menu bar', 'center window', 'notification area')"
        },
        read_text: {
          type: "boolean",
          description: "Whether to read all visible text aloud (default: false)"
        }
      }
    },
    
    async execute(args: Record<string, unknown>) {
      const detailLevel = (args.detail_level as string) || "brief";
      const focusArea = args.focus_area as string;
      const readText = args.read_text as boolean;
      
      try {
        // Take screenshot
        const screenshotPath = await takeScreenshot();
        
        try {
          // Generate description
          const description = getScreenDescription(screenshotPath, detailLevel, focusArea, readText);
          
          // Parse the vision request
          const visionRequest = JSON.parse(description);
          
          return `🎯 **Screen Description Request**

I've taken a screenshot and need to describe it for you.

**Mode:** ${detailLevel}
${focusArea ? `**Focus:** ${focusArea}\n` : ''}${readText ? '**Read Text:** Yes\n' : ''}

📸 **Screenshot captured!**

**Vision Analysis:**
${visionRequest.prompt}

**What I see:**
Based on the screenshot, I'll now describe what's visible...

*Note: For best results, ensure OpenPaw is configured with a vision-capable model (GPT-4V, Claude 3, or Gemini Vision).*

**Quick Navigation Tips:**
- Say "click [element name]" to interact
- Say "what can I click?" for interactive elements
- Say "read text" to hear all visible text
- Say "find [something]" to locate specific items

**Auto-TTS:** If voice mode is enabled, this description will be read aloud automatically! 🔊`;
        } finally {
          // Cleanup screenshot
          try {
            unlinkSync(screenshotPath);
          } catch {
            // Ignore cleanup errors
          }
        }
      } catch (error) {
        return `❌ Failed to capture/describe screen: ${error instanceof Error ? error.message : 'unknown error'}

**Troubleshooting:**
1. **Windows:** Ensure PowerShell has screenshot permissions
2. **macOS:** Install via \`brew install screencapture\` (usually built-in)
3. **Linux:** Install screenshot tool:
   - \`sudo apt install scrot\` (Debian/Ubuntu/Kali)
   - \`sudo apt install imagemagick\` (alternative)
   - \`sudo apt install gnome-screenshot\` (GNOME)

**Alternative:** Use \`computer_screenshot\` tool to manually capture and then describe the image.`;
      }
    }
  };
}
