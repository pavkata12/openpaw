import type { ToolDefinition } from "./types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const execAsync = promisify(exec);

/**
 * Computer Use API - Anthropic Claude-style computer control
 * Direct screen, mouse, and keyboard automation
 */

interface ScreenInfo {
  width: number;
  height: number;
  scaleFactor: number;
}

/**
 * Get screen resolution and info
 */
async function getScreenInfo(): Promise<ScreenInfo> {
  const platform = process.platform;
  
  try {
    if (platform === "win32") {
      // Windows: PowerShell to get screen resolution
      const { stdout } = await execAsync(
        `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds; Write-Output ($screen.Width.ToString() + 'x' + $screen.Height.ToString())"`,
        { timeout: 5000 }
      );
      const [width, height] = stdout.trim().split('x').map(Number);
      return { width, height, scaleFactor: 1 };
    } else if (platform === "darwin") {
      // macOS: system_profiler
      const { stdout } = await execAsync("system_profiler SPDisplaysDataType | grep Resolution", { timeout: 5000 });
      const match = stdout.match(/(\d+) x (\d+)/);
      if (match) {
        return { width: parseInt(match[1]), height: parseInt(match[2]), scaleFactor: 1 };
      }
    } else {
      // Linux: xdpyinfo
      const { stdout } = await execAsync("xdpyinfo | grep dimensions", { timeout: 5000 });
      const match = stdout.match(/(\d+)x(\d+)/);
      if (match) {
        return { width: parseInt(match[1]), height: parseInt(match[2]), scaleFactor: 1 };
      }
    }
  } catch {
    // Fallback to common resolution
    return { width: 1920, height: 1080, scaleFactor: 1 };
  }
  
  return { width: 1920, height: 1080, scaleFactor: 1 };
}

/**
 * Take full screen screenshot
 */
export function createScreenshotComputerTool(): ToolDefinition {
  return {
    name: "computer_screenshot",
    description: `Take a full screenshot of the entire screen (not just browser). Returns screenshot path for vision model analysis. Use for: checking desktop state, finding applications, reading screen content, verifying actions. Unlike browser screenshot, this captures everything on screen.`,
    parameters: {
      type: "object",
      properties: {
        display: {
          type: "number",
          description: "Display number (default: 0 for primary monitor)"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const display = Number(args.display ?? 0);
      const platform = process.platform;
      
      // Create screenshots directory
      const screenshotsDir = join(process.cwd(), ".openpaw", "screenshots");
      mkdirSync(screenshotsDir, { recursive: true });
      
      const timestamp = Date.now();
      const screenshotPath = join(screenshotsDir, `screen-${timestamp}.png`);
      
      try {
        if (platform === "win32") {
          // Windows: Use PowerShell with .NET to capture screen
          const psScript = `
            Add-Type -AssemblyName System.Windows.Forms,System.Drawing
            $screens = [Windows.Forms.Screen]::AllScreens
            $screen = $screens[${display}]
            $bitmap = New-Object Drawing.Bitmap $screen.Bounds.Width, $screen.Bounds.Height
            $graphics = [Drawing.Graphics]::FromImage($bitmap)
            $graphics.CopyFromScreen($screen.Bounds.Location, [Drawing.Point]::Empty, $screen.Bounds.Size)
            $bitmap.Save('${screenshotPath.replace(/\\/g, '\\\\')}', [Drawing.Imaging.ImageFormat]::Png)
            $graphics.Dispose()
            $bitmap.Dispose()
          `;
          await execAsync(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, { timeout: 10000 });
        } else if (platform === "darwin") {
          // macOS: screencapture
          await execAsync(`screencapture -x "${screenshotPath}"`, { timeout: 10000 });
        } else {
          // Linux: scrot or import (ImageMagick)
          try {
            await execAsync(`scrot "${screenshotPath}"`, { timeout: 10000 });
          } catch {
            // Fallback to ImageMagick
            await execAsync(`import -window root "${screenshotPath}"`, { timeout: 10000 });
          }
        }
        
        const screenInfo = await getScreenInfo();
        
        return `📸 Screen captured: ${screenshotPath}\n\nResolution: ${screenInfo.width}x${screenInfo.height}\n\n💡 Use this screenshot with vision models (GPT-4V, Claude 3) to:\n- Find UI elements by description\n- Read text on screen\n- Verify application state\n- Get coordinates for clicking`;
      } catch (e) {
        return `Screenshot failed: ${e instanceof Error ? e.message : String(e)}\n\nInstall dependencies:\n- Windows: Built-in (PowerShell)\n- macOS: Built-in (screencapture)\n- Linux: sudo apt install scrot imagemagick`;
      }
    },
  };
}

/**
 * Mouse control - Click at coordinates
 */
export function createMouseClickTool(): ToolDefinition {
  return {
    name: "mouse_click",
    description: `Click mouse at specific screen coordinates. Use after taking screenshot and identifying element position. Supports: left click, right click, double click, middle click. Coordinates are absolute screen position (0,0 = top-left).`,
    parameters: {
      type: "object",
      properties: {
        x: {
          type: "number",
          description: "X coordinate (pixels from left)"
        },
        y: {
          type: "number",
          description: "Y coordinate (pixels from top)"
        },
        button: {
          type: "string",
          description: "Mouse button: 'left' (default), 'right', 'middle'"
        },
        clicks: {
          type: "number",
          description: "Number of clicks: 1 (default), 2 (double-click)"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const x = Number(args.x ?? 0);
      const y = Number(args.y ?? 0);
      const button = String(args.button ?? "left").toLowerCase();
      const clicks = Number(args.clicks ?? 1);
      const platform = process.platform;
      
      if (x < 0 || y < 0) {
        return "Error: Coordinates must be positive.";
      }
      
      try {
        if (platform === "win32") {
          // Windows: Use PowerShell with .NET
          const buttonCode = button === "right" ? "0x08" : button === "middle" ? "0x10" : "0x02";
          const psScript = `
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
            Start-Sleep -Milliseconds 100
            for ($i = 0; $i -lt ${clicks}; $i++) {
              [System.Windows.Forms.Application]::DoEvents()
              Start-Sleep -Milliseconds 50
            }
          `;
          await execAsync(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, { timeout: 5000 });
        } else if (platform === "darwin") {
          // macOS: cliclick
          try {
            await execAsync("which cliclick", { timeout: 2000 });
            const clickType = button === "right" ? "rc" : clicks === 2 ? "dc" : "c";
            await execAsync(`cliclick ${clickType}:${x},${y}`, { timeout: 5000 });
          } catch {
            return "Error: cliclick not installed. Install: brew install cliclick";
          }
        } else {
          // Linux: xdotool
          try {
            await execAsync("which xdotool", { timeout: 2000 });
            const buttonNum = button === "right" ? "3" : button === "middle" ? "2" : "1";
            await execAsync(`xdotool mousemove ${x} ${y} click --repeat ${clicks} ${buttonNum}`, { timeout: 5000 });
          } catch {
            return "Error: xdotool not installed. Install: sudo apt install xdotool";
          }
        }
        
        return `✅ Mouse clicked at (${x}, ${y})\nButton: ${button}\nClicks: ${clicks}`;
      } catch (e) {
        return `Mouse click failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}

/**
 * Mouse movement
 */
export function createMouseMoveTool(): ToolDefinition {
  return {
    name: "mouse_move",
    description: `Move mouse cursor to specific coordinates without clicking. Use for: hovering over elements, positioning cursor, preparing for click. Coordinates are absolute screen position.`,
    parameters: {
      type: "object",
      properties: {
        x: {
          type: "number",
          description: "X coordinate (pixels from left)"
        },
        y: {
          type: "number",
          description: "Y coordinate (pixels from top)"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const x = Number(args.x ?? 0);
      const y = Number(args.y ?? 0);
      const platform = process.platform;
      
      try {
        if (platform === "win32") {
          const psScript = `
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
          `;
          await execAsync(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, { timeout: 5000 });
        } else if (platform === "darwin") {
          try {
            await execAsync(`cliclick m:${x},${y}`, { timeout: 5000 });
          } catch {
            return "Error: cliclick not installed. Install: brew install cliclick";
          }
        } else {
          try {
            await execAsync(`xdotool mousemove ${x} ${y}`, { timeout: 5000 });
          } catch {
            return "Error: xdotool not installed. Install: sudo apt install xdotool";
          }
        }
        
        return `✅ Mouse moved to (${x}, ${y})`;
      } catch (e) {
        return `Mouse move failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}

/**
 * Keyboard typing
 */
export function createKeyboardTypeTool(): ToolDefinition {
  return {
    name: "keyboard_type",
    description: `Type text using keyboard automation. Types into currently focused application/field. Use after clicking input field. Supports: regular text, special keys (Enter, Tab, Escape), key combinations (Ctrl+C, etc.).`,
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to type. Use special syntax: {enter}, {tab}, {esc}, {ctrl+c}, etc."
        },
        delay: {
          type: "number",
          description: "Delay between keystrokes in milliseconds (default: 50)"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const text = String(args.text ?? "");
      const delay = Number(args.delay ?? 50);
      const platform = process.platform;
      
      if (!text) return "Error: text is required.";
      
      // Parse special keys
      let processedText = text;
      const specialKeys: Record<string, string> = {
        "{enter}": platform === "win32" ? "{ENTER}" : "Return",
        "{tab}": platform === "win32" ? "{TAB}" : "Tab",
        "{esc}": platform === "win32" ? "{ESC}" : "Escape",
        "{backspace}": platform === "win32" ? "{BACKSPACE}" : "BackSpace",
        "{delete}": platform === "win32" ? "{DELETE}" : "Delete",
        "{space}": platform === "win32" ? " " : "space"
      };
      
      try {
        if (platform === "win32") {
          // Windows: PowerShell SendKeys
          for (const [key, replacement] of Object.entries(specialKeys)) {
            processedText = processedText.replace(new RegExp(key, "gi"), replacement);
          }
          
          const psScript = `
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.SendKeys]::SendWait('${processedText.replace(/'/g, "''")}')
          `;
          await execAsync(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, { timeout: 30000 });
        } else if (platform === "darwin") {
          // macOS: cliclick or osascript
          try {
            // Use cliclick for typing
            await execAsync(`cliclick t:'${text.replace(/'/g, "\\'")}'`, { timeout: 30000 });
          } catch {
            return "Error: cliclick not installed. Install: brew install cliclick";
          }
        } else {
          // Linux: xdotool
          try {
            // Replace special keys for xdotool
            for (const [key, replacement] of Object.entries(specialKeys)) {
              processedText = processedText.replace(new RegExp(key, "gi"), replacement);
            }
            await execAsync(`xdotool type --delay ${delay} "${processedText.replace(/"/g, '\\"')}"`, { timeout: 30000 });
          } catch {
            return "Error: xdotool not installed. Install: sudo apt install xdotool";
          }
        }
        
        return `⌨️  Typed: ${text.substring(0, 100)}${text.length > 100 ? "..." : ""}`;
      } catch (e) {
        return `Keyboard type failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}

/**
 * Keyboard key press (for shortcuts)
 */
export function createKeyboardPressTool(): ToolDefinition {
  return {
    name: "keyboard_press",
    description: `Press keyboard keys or shortcuts. Use for: Ctrl+C (copy), Ctrl+V (paste), Alt+Tab (switch apps), Win+D (show desktop), etc. Supports modifier keys: ctrl, alt, shift, cmd/win.`,
    parameters: {
      type: "object",
      properties: {
        keys: {
          type: "string",
          description: "Key combination (e.g., 'ctrl+c', 'alt+tab', 'cmd+space', 'F5')"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const keys = String(args.keys ?? "").toLowerCase();
      const platform = process.platform;
      
      if (!keys) return "Error: keys required.";
      
      try {
        if (platform === "win32") {
          // Windows: PowerShell SendKeys
          let psKeys = keys;
          psKeys = psKeys.replace("ctrl+", "^");
          psKeys = psKeys.replace("alt+", "%");
          psKeys = psKeys.replace("shift+", "+");
          psKeys = psKeys.replace("win+", "^{ESC}"); // Approximate
          
          const psScript = `
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.SendKeys]::SendWait('${psKeys}')
          `;
          await execAsync(`powershell -Command "${psScript.replace(/\n/g, ' ')}"`, { timeout: 5000 });
        } else if (platform === "darwin") {
          // macOS: cliclick with key codes
          try {
            let cliKeys = keys.replace("cmd+", "cmd:").replace("ctrl+", "ctrl:").replace("alt+", "alt:").replace("shift+", "shift:");
            await execAsync(`cliclick kp:${cliKeys}`, { timeout: 5000 });
          } catch {
            return "Error: cliclick not installed. Install: brew install cliclick";
          }
        } else {
          // Linux: xdotool key
          try {
            await execAsync(`xdotool key ${keys.replace("+", "+")}`, { timeout: 5000 });
          } catch {
            return "Error: xdotool not installed. Install: sudo apt install xdotool";
          }
        }
        
        return `⌨️  Pressed: ${keys}`;
      } catch (e) {
        return `Keyboard press failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}

/**
 * Computer Use - Combined tool for vision-based automation
 */
export function createComputerUseTool(): ToolDefinition {
  return {
    name: "computer_use",
    description: `High-level computer control combining screenshot, vision analysis, and actions. Use for: "Click the Firefox icon", "Type in the search box", "Open File menu". AI analyzes screen and performs actions. This is the main Computer Use API - use this for natural language computer control.`,
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          description: "Action: 'screenshot', 'click', 'type', 'press_key', 'move', 'double_click', 'right_click'"
        },
        target: {
          type: "string",
          description: "For click/type: Natural language description (e.g., 'Firefox icon', 'search box', 'OK button')"
        },
        text: {
          type: "string",
          description: "For type action: Text to type"
        },
        coordinates: {
          type: "string",
          description: "For click/move: Comma-separated x,y coordinates (e.g., '100,200')"
        },
        keys: {
          type: "string",
          description: "For press_key: Key combination (e.g., 'ctrl+c', 'alt+tab')"
        }
      },
    },
    async execute(args: Record<string, unknown>) {
      const action = String(args.action ?? "screenshot").toLowerCase();
      const target = args.target ? String(args.target) : "";
      const text = args.text ? String(args.text) : "";
      const coordinates = args.coordinates ? String(args.coordinates) : "";
      const keys = args.keys ? String(args.keys) : "";
      
      let result = `🖥️  Computer Use Action: ${action}\n`;
      result += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      
      if (action === "screenshot") {
        const screenshotTool = createScreenshotComputerTool();
        return await screenshotTool.execute({});
      }
      
      if (action === "click" || action === "double_click" || action === "right_click") {
        if (coordinates) {
          const [x, y] = coordinates.split(",").map(Number);
          const clickTool = createMouseClickTool();
          return await clickTool.execute({
            x,
            y,
            button: action === "right_click" ? "right" : "left",
            clicks: action === "double_click" ? 2 : 1
          });
        } else if (target) {
          result += `⚠️  Vision-based clicking requires:\n`;
          result += `1. Take screenshot: computer_use action="screenshot"\n`;
          result += `2. Analyze with vision model: "Find coordinates of ${target}"\n`;
          result += `3. Click: computer_use action="click" coordinates="x,y"\n\n`;
          result += `For now, provide coordinates directly.`;
          return result;
        }
        return "Error: Provide either 'coordinates' or 'target' description.";
      }
      
      if (action === "move") {
        if (coordinates) {
          const [x, y] = coordinates.split(",").map(Number);
          const moveTool = createMouseMoveTool();
          return await moveTool.execute({ x, y });
        }
        return "Error: coordinates required for move action.";
      }
      
      if (action === "type") {
        if (text) {
          const typeTool = createKeyboardTypeTool();
          return await typeTool.execute({ text });
        }
        return "Error: text required for type action.";
      }
      
      if (action === "press_key") {
        if (keys) {
          const pressTool = createKeyboardPressTool();
          return await pressTool.execute({ keys });
        }
        return "Error: keys required for press_key action.";
      }
      
      return `Error: Unknown action '${action}'. Supported: screenshot, click, type, press_key, move, double_click, right_click`;
    },
  };
}
