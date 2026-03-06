import type { ToolDefinition } from "./types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Smart Navigate - High-level navigation commands
 * "Open YouTube", "Find settings", "Go to Google" - AI figures out HOW
 */

interface SmartNavigateArgs {
  command: string;
  app_or_website?: string;
  wait_for_load?: boolean;
}

async function openApplication(appName: string): Promise<string> {
  const app = appName.toLowerCase();
  
  if (process.platform === "win32") {
    // Windows common apps
    const winApps: Record<string, string> = {
      "chrome": "start chrome",
      "firefox": "start firefox",
      "edge": "start msedge",
      "notepad": "start notepad",
      "calculator": "start calc",
      "explorer": "start explorer",
      "settings": "start ms-settings:",
      "terminal": "start cmd",
      "powershell": "start powershell"
    };
    
    const cmd = winApps[app] || `start ${appName}`;
    await execAsync(cmd, { timeout: 5000 });
    return `Opened ${appName} on Windows`;
    
  } else if (process.platform === "darwin") {
    // macOS apps
    await execAsync(`open -a "${appName}"`, { timeout: 5000 });
    return `Opened ${appName} on macOS`;
    
  } else {
    // Linux
    const linuxApps: Record<string, string> = {
      "chrome": "google-chrome",
      "firefox": "firefox",
      "terminal": "gnome-terminal",
      "files": "nautilus",
      "settings": "gnome-control-center"
    };
    
    const cmd = linuxApps[app] || appName;
    await execAsync(`${cmd} &`, { timeout: 5000, shell: '/bin/bash' });
    return `Opened ${appName} on Linux`;
  }
}

async function openWebsite(url: string): Promise<string> {
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;
  
  if (process.platform === "win32") {
    await execAsync(`start ${fullUrl}`, { timeout: 5000 });
  } else if (process.platform === "darwin") {
    await execAsync(`open "${fullUrl}"`, { timeout: 5000 });
  } else {
    await execAsync(`xdg-open "${fullUrl}"`, { timeout: 5000 });
  }
  
  return `Opened ${fullUrl}`;
}

function parseNavigationCommand(command: string): { type: "app" | "website" | "search"; target: string } {
  const cmd = command.toLowerCase();
  
  // Detect common patterns
  if (cmd.match(/open|start|launch/)) {
    const target = cmd.replace(/^(open|start|launch)\s+/i, '').trim();
    
    // Check if it's a website
    if (target.includes('.com') || target.includes('.org') || target.includes('.net') || 
        target.match(/youtube|google|facebook|twitter|reddit|github/i)) {
      return { type: "website", target };
    }
    
    // Otherwise treat as app
    return { type: "app", target };
  }
  
  // "Go to X" usually means website
  if (cmd.match(/go to|navigate to|visit/)) {
    const target = cmd.replace(/^(go to|navigate to|visit)\s+/i, '').trim();
    return { type: "website", target };
  }
  
  // "Find X" or "Search for X" usually means web search
  if (cmd.match(/find|search for|look for|search/)) {
    const target = cmd.replace(/^(find|search for|look for|search)\s+/i, '').trim();
    return { type: "search", target };
  }
  
  // Default: try as website first
  return { type: "website", target: command };
}

export function createSmartNavigateTool(): ToolDefinition {
  return {
    name: "smart_navigate",
    description: `High-level navigation command that automatically figures out HOW to do something. User says "Open YouTube" and the AI handles the details. Works for apps, websites, and searches. Examples: "open Chrome", "go to YouTube", "find Python tutorial", "start calculator", "open settings". Much easier for voice/accessibility users than low-level commands.`,
    parameters: {
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "Natural language navigation command (e.g., 'open YouTube', 'find Python tutorial', 'start Chrome')"
        },
        app_or_website: {
          type: "string",
          description: "Optional: explicitly specify if this is an 'app' or 'website' to help disambiguation"
        },
        wait_for_load: {
          type: "boolean",
          description: "Whether to wait for page/app to load before returning (default: false)"
        }
      }
    },
    
    async execute(args: Record<string, unknown>) {
      const command = args.command as string;
      const explicitType = args.app_or_website as string;
      const waitForLoad = args.wait_for_load as boolean;
      
      try {
        // Parse command
        const parsed = parseNavigationCommand(command);
        const type = explicitType || parsed.type;
        
        let result = "";
        
        if (type === "app") {
          result = await openApplication(parsed.target);
        } else if (type === "website") {
          // Convert common names to URLs
          const websiteMap: Record<string, string> = {
            "youtube": "youtube.com",
            "google": "google.com",
            "gmail": "gmail.com",
            "facebook": "facebook.com",
            "twitter": "twitter.com",
            "reddit": "reddit.com",
            "github": "github.com",
            "stackoverflow": "stackoverflow.com",
            "wikipedia": "wikipedia.org"
          };
          
          const target = websiteMap[parsed.target.toLowerCase()] || parsed.target;
          result = await openWebsite(target);
          
        } else if (type === "search") {
          // Use Google search
          const query = encodeURIComponent(parsed.target);
          result = await openWebsite(`google.com/search?q=${query}`);
        }
        
        if (waitForLoad) {
          // Wait a bit for page/app to load
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        return `✅ **Navigation Complete**

**Command:** ${command}
**Action:** ${result}

${waitForLoad ? '✓ Waited for load\n' : ''}
**What's Next?**
- Use \`voice_describe_screen\` to hear what's on screen
- Use \`browser_session\` for more complex web interactions
- Use \`computer_use\` for low-level control (click, type, etc.)

**Voice Users:** Just say what you want next, like:
- "Click the search button"
- "Type 'hello world'"
- "What's on screen?"
- "Find the settings menu"`;
        
      } catch (error) {
        return `❌ Navigation failed: ${error instanceof Error ? error.message : 'unknown error'}

**Troubleshooting:**
- **App not found?** Try specifying full app name (e.g., "Google Chrome" instead of "Chrome")
- **Website not opening?** Check internet connection
- **Wrong action?** Use \`app_or_website\` parameter to clarify (e.g., \`app_or_website: "app"\`)

**Manual Alternative:**
- **Apps:** Use \`run_shell\` with \`start\`/\`open\`/\`xdg-open\` command
- **Websites:** Use \`open_url\` or \`browser_session\` tool
- **Search:** Use \`web_search\` or \`smart_web_search\` tool`;
      }
    }
  };
}
