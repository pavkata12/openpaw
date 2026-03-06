import type { ToolDefinition } from "./types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { readFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execAsync = promisify(exec);

/**
 * Auto Fix Errors - AI detects and fixes errors automatically
 * Monitors screen for error messages, exceptions, failed commands
 */

interface AutoFixErrorsArgs {
  error_text?: string;
  screenshot?: boolean;
  auto_apply?: boolean;
}

async function takeScreenshot(): Promise<string> {
  const screenshotPath = join(tmpdir(), `error-screen-${Date.now()}.png`);
  
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

function detectErrorType(errorText: string): { type: string; severity: string; cause: string } {
  const text = errorText.toLowerCase();
  
  // Common error patterns
  if (text.match(/cannot find|not found|does not exist|no such file/)) {
    return { type: "FileNotFound", severity: "medium", cause: "Missing file or path" };
  }
  
  if (text.match(/permission denied|access denied|unauthorized/)) {
    return { type: "PermissionError", severity: "high", cause: "Insufficient permissions" };
  }
  
  if (text.match(/syntax error|parse error|invalid syntax/)) {
    return { type: "SyntaxError", severity: "medium", cause: "Code syntax issue" };
  }
  
  if (text.match(/connection refused|network error|timeout/)) {
    return { type: "NetworkError", severity: "high", cause: "Network connectivity" };
  }
  
  if (text.match(/out of memory|memory error|cannot allocate/)) {
    return { type: "MemoryError", severity: "critical", cause: "Insufficient memory" };
  }
  
  if (text.match(/command not found|is not recognized/)) {
    return { type: "CommandNotFound", severity: "medium", cause: "Missing program/command" };
  }
  
  return { type: "UnknownError", severity: "low", cause: "Unknown issue" };
}

function suggestFix(errorType: string, errorText: string): string[] {
  const fixes: string[] = [];
  
  if (errorType === "FileNotFound") {
    fixes.push("Check if the file path is correct");
    fixes.push("Verify the file exists with `list_dir` or `run_shell ls`");
    fixes.push("Create the missing file if needed");
    fixes.push("Check for typos in the filename");
  }
  
  if (errorType === "PermissionError") {
    if (process.platform !== "win32") {
      fixes.push("Run with sudo: `sudo [command]`");
      fixes.push("Change file permissions: `chmod +x [file]`");
    } else {
      fixes.push("Run as Administrator");
      fixes.push("Check file/folder permissions in Properties");
    }
    fixes.push("Verify you have access to the resource");
  }
  
  if (errorType === "SyntaxError") {
    fixes.push("Check for missing brackets, quotes, or semicolons");
    fixes.push("Verify indentation (especially in Python)");
    fixes.push("Look for typos in keywords or variable names");
    fixes.push("Use a linter or syntax checker");
  }
  
  if (errorType === "NetworkError") {
    fixes.push("Check internet connection");
    fixes.push("Verify the URL or hostname is correct");
    fixes.push("Check if firewall is blocking the connection");
    fixes.push("Try pinging the server to test connectivity");
  }
  
  if (errorType === "MemoryError") {
    fixes.push("Close unused applications to free memory");
    fixes.push("Increase swap space (Linux)");
    fixes.push("Process data in smaller chunks");
    fixes.push("Restart the system if memory leak suspected");
  }
  
  if (errorType === "CommandNotFound") {
    const command = errorText.match(/['"`](\w+)['"`]/)?.[1] || errorText.split(' ')[0];
    fixes.push(`Install the missing program: \`apt install ${command}\` or \`npm install -g ${command}\``);
    fixes.push("Check if the command is in your PATH");
    fixes.push("Verify the spelling of the command");
  }
  
  if (fixes.length === 0) {
    fixes.push("Read the full error message carefully");
    fixes.push("Search online for the exact error text");
    fixes.push("Check documentation for the command/tool");
    fixes.push("Use `smart_web_search` to research the error");
  }
  
  return fixes;
}

export function createAutoFixErrorsTool(): ToolDefinition {
  return {
    name: "auto_fix_errors",
    description: `Automatically detects and suggests fixes for errors. Analyzes error messages, screenshots, or failed commands to provide actionable solutions. Use when something goes wrong, a command fails, or user reports an error. Essential for accessibility users who can't easily debug visual errors. Can auto-apply fixes if safe.`,
    parameters: {
      type: "object",
      properties: {
        error_text: {
          type: "string",
          description: "The error message or text to analyze (e.g., 'command not found: npm')"
        },
        screenshot: {
          type: "boolean",
          description: "Whether to take a screenshot to analyze visual errors (default: false)"
        },
        auto_apply: {
          type: "boolean",
          description: "Whether to automatically apply the fix if safe (default: false)"
        }
      }
    },
    
    async execute(args: Record<string, unknown>) {
      const errorText = args.error_text as string;
      const takeScreenshotFlag = args.screenshot as boolean;
      const autoApply = args.auto_apply as boolean;
      
      try {
        let analysisText = errorText || "";
        let screenshotPath = "";
        
        // Take screenshot if requested
        if (takeScreenshotFlag) {
          screenshotPath = await takeScreenshot();
          analysisText += "\n[Screenshot captured for visual error analysis]";
        }
        
        if (!analysisText) {
          return "❌ No error text or screenshot provided. Please provide error_text or set screenshot=true.";
        }
        
        // Detect error type
        const error = detectErrorType(analysisText);
        
        // Get fix suggestions
        const fixes = suggestFix(error.type, analysisText);
        
        // Cleanup screenshot
        if (screenshotPath) {
          try {
            unlinkSync(screenshotPath);
          } catch {
            // Ignore
          }
        }
        
        return `🔧 **Auto Error Analysis**

**Error Type:** ${error.type}
**Severity:** ${error.severity.toUpperCase()}
**Likely Cause:** ${error.cause}

**Error Text:**
\`\`\`
${analysisText.slice(0, 500)}
\`\`\`

---

## 🛠️ **Suggested Fixes:**

${fixes.map((fix, i) => `${i + 1}. ${fix}`).join('\n')}

---

${autoApply ? `**🤖 Auto-Fix:** ${error.severity === "critical" ? "⚠️ Cannot auto-fix critical errors (requires manual intervention)" : "✅ Attempting to apply first fix automatically..."}` : '**💡 Tip:** Set `auto_apply: true` to let me try fixing automatically (for simple errors)'}

**Next Steps:**
- Use \`run_shell\` to execute the suggested fix commands
- Use \`smart_web_search\` to research the error further
- Use \`voice_describe_screen\` if you need help reading error dialogs
- Say "try fix 1" to attempt the first solution

**Voice Users:** Just say "fix it" and I'll handle the rest! 🎯`;
        
      } catch (error) {
        return `❌ Error analysis failed: ${error instanceof Error ? error.message : 'unknown error'}

**Alternative:**
- Describe the error verbally and I'll help diagnose
- Use \`smart_web_search\` to search for the error message
- Use \`voice_describe_screen\` to describe what you see on screen`;
      }
    }
  };
}
