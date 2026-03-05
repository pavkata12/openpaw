import type { ToolDefinition } from "./types.js";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

/**
 * Screenshot tool - capture browser or screen for vision models to analyze
 * Enables vision-based navigation: AI sees what's on screen and clicks precisely
 */
export async function createScreenshotTool(): Promise<ToolDefinition | null> {
  try {
    const { chromium } = await import("playwright");
    
    return {
      name: "take_screenshot",
      description: `Take a screenshot of the current browser page or screen. Returns the screenshot path so you can send it to a vision model (GPT-4V, Claude 3) to analyze what's visible. Use this when CSS selectors fail or you need to verify what the user sees. The vision model can then tell you exact coordinates to click or describe elements.`,
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "Browser session ID (from browser_session tool). Default: 'default'"
          },
          fullPage: {
            type: "boolean",
            description: "Capture full scrollable page (true) or just viewport (false). Default: false"
          },
          element: {
            type: "string",
            description: "Optional CSS selector to screenshot just one element instead of whole page"
          },
          name: {
            type: "string",
            description: "Optional filename (without extension). Default: timestamp"
          }
        },
      },
      async execute(args) {
        const sessionId = String(args.sessionId ?? "default").trim() || "default";
        const fullPage = args.fullPage === true;
        const element = args.element ? String(args.element).trim() : null;
        const name = args.name ? String(args.name).trim() : `screenshot-${Date.now()}`;
        
        // Get browser session from browser-enhanced
        const { getBrowserSession } = await import("./browser-enhanced.js");
        const session = await getBrowserSession(sessionId);
        
        if (!session) {
          return `Error: Browser session '${sessionId}' not found. Open a browser first with browser_session.`;
        }
        
        // Create screenshots directory
        const screenshotsDir = join(process.cwd(), ".openpaw", "screenshots");
        mkdirSync(screenshotsDir, { recursive: true });
        
        const screenshotPath = join(screenshotsDir, `${name}.png`);
        
        try {
          if (element) {
            // Screenshot specific element
            const locator = session.page.locator(element);
            await locator.screenshot({ path: screenshotPath });
          } else {
            // Screenshot page
            await session.page.screenshot({ 
              path: screenshotPath,
              fullPage 
            });
          }
          
          // Get page info for context
          const url = session.page.url();
          const title = await session.page.title();
          
          return `Screenshot saved: ${screenshotPath}\nPage: ${title}\nURL: ${url}\n\nYou can now use a vision model to analyze this screenshot. Ask: "What elements are visible?" or "Where is the play button?" and get exact coordinates or descriptions.`;
        } catch (e) {
          return `Screenshot failed: ${e instanceof Error ? e.message : String(e)}`;
        }
      },
    };
  } catch {
    return null;
  }
}

/**
 * Vision-based click tool - Use vision model to find and click elements
 * Requires GPT-4V, Claude 3, or similar vision model
 */
export function createVisionClickTool(): ToolDefinition {
  return {
    name: "vision_click",
    description: `ADVANCED: Use a vision model to find an element on screen and click it. Takes a screenshot, sends to vision model (GPT-4V/Claude 3) with your description, gets coordinates, and clicks. More reliable than CSS selectors for complex UIs. Requires a vision-capable model.`,
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "Describe what to click: 'the red play button', 'the search box in the top right', 'the first video thumbnail'"
        },
        sessionId: {
          type: "string",
          description: "Browser session ID. Default: 'default'"
        },
        visionModel: {
          type: "string",
          description: "Vision model to use: 'gpt-4-vision-preview', 'claude-3-opus', etc. Default: same as OPENPAW_LLM_MODEL if it supports vision"
        }
      },
    },
    async execute(args) {
      const description = String(args.description ?? "").trim();
      if (!description) return "Error: description is required. Describe what to click.";
      
      const sessionId = String(args.sessionId ?? "default").trim() || "default";
      
      // This is a placeholder - full implementation would:
      // 1. Take screenshot
      // 2. Send to vision model with prompt: "Find the coordinates of: {description}"
      // 3. Parse coordinates from response
      // 4. Click at those coordinates
      
      return `Vision-based clicking is in beta. For now, use browser_session with find_and_click which uses text-based strategies. Vision model integration coming soon.\n\nAlternative: Use take_screenshot + manually analyze, then click at coordinates with browser_session press_key or click actions.`;
    },
  };
}

