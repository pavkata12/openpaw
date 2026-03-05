import type { ToolDefinition } from "./types.js";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

type Step =
  | { action: "goto"; url?: string }
  | { action: "type"; selector?: string; value?: string }
  | { action: "click"; selector?: string }
  | { action: "double_click"; selector?: string }
  | { action: "hover"; selector?: string }
  | { action: "scroll"; direction?: "up" | "down" | "top" | "bottom" | "to_selector"; amount?: number; selector?: string }
  | { action: "select_option"; selector?: string; value?: string; label?: string }
  | { action: "check"; selector?: string }
  | { action: "uncheck"; selector?: string }
  | { action: "press_key"; key?: string; selector?: string }
  | { action: "wait"; timeout_ms?: number }
  | { action: "wait_selector"; selector?: string; timeout_ms?: number }
  | { action: "fullscreen"; selector?: string }
  | { action: "get_video_state" }
  | { action: "find_and_click"; text?: string; role?: string }
  | { action: "find_and_type"; text?: string; value?: string }
  | { action: "smart_search"; query?: string };

interface BrowserSession {
  browser: import("playwright").Browser;
  context: import("playwright").BrowserContext;
  page: import("playwright").Page;
  lastUrl: string;
  createdAt: number;
  profileDir: string;  // Persistent profile directory
}

// Keep browser sessions alive for 10 minutes
const BROWSER_SESSION_TTL = 10 * 60 * 1000;
const sessions = new Map<string, BrowserSession>();

async function getOrCreateSession(sessionId: string = "default"): Promise<BrowserSession> {
  const existing = sessions.get(sessionId);
  if (existing && Date.now() - existing.createdAt < BROWSER_SESSION_TTL) {
    return existing;
  }
  
  // Clean up old session
  if (existing) {
    try { await existing.browser.close(); } catch { /* ignore */ }
    sessions.delete(sessionId);
  }

  // Create persistent profile directory (survives browser restarts)
  const profilesDir = join(process.cwd(), ".openpaw", "browser-profiles");
  mkdirSync(profilesDir, { recursive: true });
  const profileDir = join(profilesDir, sessionId);
  mkdirSync(profileDir, { recursive: true });

  // Create new session with STEALTH MODE + PERSISTENT STORAGE
  const { chromium } = await import("playwright");
  
  // Stealth args: bypass bot detection on streaming sites
  const stealthArgs = [
    '--start-maximized',
    '--disable-blink-features=AutomationControlled',
    '--disable-dev-shm-usage',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-web-security',
    '--disable-features=IsolateOrigins,site-per-process',
    '--allow-running-insecure-content',
    '--disable-infobars',
    '--window-position=0,0',
    '--ignore-certificate-errors',
    '--ignore-certificate-errors-spki-list',
  ];
  
  const browser = await chromium.launch({ 
    headless: false,
    args: stealthArgs
  });
  
  // PERSISTENT CONTEXT: saves cookies, localStorage, auth tokens between sessions
  const storageStatePath = join(profileDir, "storage-state.json");
  const { existsSync } = await import("node:fs");
  const storageState = existsSync(storageStatePath) ? storageStatePath : undefined;
  
  const context = await browser.newContext({ 
    viewport: { width: 1920, height: 1080 },
    storageState,  // Load saved cookies/auth if exists
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['geolocation'],
    extraHTTPHeaders: {
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    }
  });
  
  const page = await context.newPage();
  
  // Stealth JavaScript injections: hide automation
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });
    
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
      ],
    });
    
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
    });
    
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) => (
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'denied' } as PermissionStatus)
        : originalQuery(parameters)
    );
    
    (window as any).chrome = {
      runtime: {},
    };
  });
  
  const session: BrowserSession = {
    browser,
    context,
    page,
    lastUrl: "",
    createdAt: Date.now(),
    profileDir
  };
  
  sessions.set(sessionId, session);
  return session;
}

async function smartFindElement(page: import("playwright").Page, text: string, role?: string): Promise<string | null> {
  // Try to find element by text with various strategies
  const strategies = [
    `text=${text}`,
    `text="${text}"`,
    `//*[contains(text(), '${text}')]`,
    `button:has-text("${text}")`,
    `a:has-text("${text}")`,
    `[aria-label*="${text}" i]`,
    `[title*="${text}" i]`,
    `[placeholder*="${text}" i]`,
  ];

  if (role) {
    strategies.unshift(`[role="${role}"]:has-text("${text}")`);
  }

  for (const selector of strategies) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.count() > 0 && await locator.isVisible({ timeout: 1000 })) {
        return selector;
      }
    } catch {
      continue;
    }
  }
  
  return null;
}

async function runEnhancedSteps(
  page: import("playwright").Page,
  steps: Step[],
  stepDelayMs: number = 500
): Promise<string[]> {
  const results: string[] = [];
  
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step || typeof step.action !== "string") continue;
    
    try {
      if (step.action === "goto") {
        const url = String((step as { url?: string }).url ?? "").trim();
        if (!url) {
          results.push(`Step ${i + 1}: goto skipped (no url)`);
          continue;
        }
        await page.goto(url, { timeout: 30_000, waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});
        results.push(`Step ${i + 1}: opened ${url}`);
        
      } else if (step.action === "smart_search") {
        const query = String((step as { query?: string }).query ?? "").trim();
        if (!query) {
          results.push(`Step ${i + 1}: smart_search skipped (no query)`);
          continue;
        }
        
        // Try to find search box and search
        const searchSelectors = [
          'input[type="search"]',
          'input[placeholder*="search" i]',
          'input[name*="search" i]',
          'input[aria-label*="search" i]',
          '#search',
          '.search-input',
          'input[type="text"]'
        ];
        
        let searched = false;
        for (const sel of searchSelectors) {
          try {
            const input = page.locator(sel).first();
            if (await input.count() > 0 && await input.isVisible({ timeout: 1000 })) {
              await input.click();
              await input.fill(query);
              await page.keyboard.press("Enter");
              await page.waitForLoadState("domcontentloaded", { timeout: 8000 }).catch(() => {});
              results.push(`Step ${i + 1}: searched for "${query}"`);
              searched = true;
              break;
            }
          } catch {
            continue;
          }
        }
        
        if (!searched) {
          results.push(`Step ${i + 1}: smart_search failed (no search box found)`);
        }
        
      } else if (step.action === "find_and_click") {
        const s = step as { text?: string; role?: string };
        const text = String(s.text ?? "").trim();
        if (!text) {
          results.push(`Step ${i + 1}: find_and_click skipped (no text)`);
          continue;
        }
        
        const selector = await smartFindElement(page, text, s.role);
        if (selector) {
          await page.locator(selector).first().click();
          results.push(`Step ${i + 1}: clicked "${text}"`);
        } else {
          results.push(`Step ${i + 1}: find_and_click failed (element "${text}" not found)`);
        }
        
      } else if (step.action === "find_and_type") {
        const s = step as { text?: string; value?: string };
        const text = String(s.text ?? "").trim();
        const value = String(s.value ?? "").trim();
        if (!text) {
          results.push(`Step ${i + 1}: find_and_type skipped (no text)`);
          continue;
        }
        
        const selector = await smartFindElement(page, text);
        if (selector) {
          await page.locator(selector).first().fill(value);
          results.push(`Step ${i + 1}: typed into "${text}"`);
        } else {
          results.push(`Step ${i + 1}: find_and_type failed (element "${text}" not found)`);
        }
        
      } else if (step.action === "fullscreen") {
        const selector = String((step as { selector?: string }).selector ?? "video").trim();
        try {
          // Try to click fullscreen button or trigger fullscreen API
          const fullscreenSelectors = [
            'button[aria-label*="fullscreen" i]',
            'button[title*="fullscreen" i]',
            '.ytp-fullscreen-button',  // YouTube
            '[data-testid*="fullscreen"]',
            selector
          ];
          
          let didFullscreen = false;
          for (const sel of fullscreenSelectors) {
            try {
              const btn = page.locator(sel).first();
              if (await btn.count() > 0 && await btn.isVisible({ timeout: 1000 })) {
                await btn.click();
                results.push(`Step ${i + 1}: clicked fullscreen button`);
                didFullscreen = true;
                break;
              }
            } catch {
              continue;
            }
          }
          
          if (!didFullscreen) {
            // Try to trigger fullscreen via JavaScript
            await page.evaluate(() => {
              const video = document.querySelector('video');
              if (video && video.requestFullscreen) {
                video.requestFullscreen().catch(() => {});
              }
            });
            results.push(`Step ${i + 1}: attempted fullscreen via API`);
          }
        } catch (e) {
          results.push(`Step ${i + 1}: fullscreen failed: ${e instanceof Error ? e.message : String(e)}`);
        }
        
      } else if (step.action === "get_video_state") {
        try {
          const state = await page.evaluate(() => {
            const video = document.querySelector('video');
            if (!video) return { found: false };
            return {
              found: true,
              playing: !video.paused,
              currentTime: video.currentTime,
              duration: video.duration,
              volume: video.volume,
              muted: video.muted,
              fullscreen: document.fullscreenElement === video
            };
          });
          results.push(`Step ${i + 1}: video state: ${JSON.stringify(state)}`);
        } catch (e) {
          results.push(`Step ${i + 1}: get_video_state failed: ${e instanceof Error ? e.message : String(e)}`);
        }
        
      } else if (step.action === "type") {
        const s = step as { selector?: string; value?: string };
        const selector = String(s.selector ?? "").trim();
        const value = String(s.value ?? "").trim();
        if (!selector) {
          results.push(`Step ${i + 1}: type skipped (no selector)`);
          continue;
        }
        await page.waitForSelector(selector, { timeout: 10000 });
        await page.locator(selector).first().fill(value);
        results.push(`Step ${i + 1}: typed into ${selector}`);
        
      } else if (step.action === "click") {
        const selector = String((step as { selector?: string }).selector ?? "").trim();
        if (!selector) {
          results.push(`Step ${i + 1}: click skipped (no selector)`);
          continue;
        }
        await page.waitForSelector(selector, { timeout: 10000 });
        await page.locator(selector).first().click();
        results.push(`Step ${i + 1}: clicked ${selector}`);
        
      } else if (step.action === "double_click") {
        const selector = String((step as { selector?: string }).selector ?? "").trim();
        if (!selector) {
          results.push(`Step ${i + 1}: double_click skipped (no selector)`);
          continue;
        }
        await page.waitForSelector(selector, { timeout: 10000 });
        await page.locator(selector).first().dblclick();
        results.push(`Step ${i + 1}: double-clicked ${selector}`);
        
      } else if (step.action === "hover") {
        const selector = String((step as { selector?: string }).selector ?? "").trim();
        if (!selector) {
          results.push(`Step ${i + 1}: hover skipped (no selector)`);
          continue;
        }
        await page.waitForSelector(selector, { timeout: 10000 });
        await page.locator(selector).first().hover();
        results.push(`Step ${i + 1}: hovered ${selector}`);
        
      } else if (step.action === "scroll") {
        const s = step as { direction?: string; amount?: number; selector?: string };
        const direction = String(s.direction ?? "down").toLowerCase();
        const amount = Number(s.amount) || 600;
        
        if (direction === "top") {
          await page.evaluate(() => window.scrollTo(0, 0));
          results.push(`Step ${i + 1}: scrolled to top`);
        } else if (direction === "bottom") {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          results.push(`Step ${i + 1}: scrolled to bottom`);
        } else if (direction === "to_selector" && s.selector) {
          await page.locator(s.selector).scrollIntoViewIfNeeded();
          results.push(`Step ${i + 1}: scrolled to ${s.selector}`);
        } else if (direction === "up") {
          await page.evaluate((y) => window.scrollBy(0, -y), amount);
          results.push(`Step ${i + 1}: scrolled up ${amount}px`);
        } else {
          await page.evaluate((y) => window.scrollBy(0, y), amount);
          results.push(`Step ${i + 1}: scrolled down ${amount}px`);
        }
        
      } else if (step.action === "press_key") {
        const s = step as { key?: string; selector?: string };
        const key = String(s.key ?? "Enter").trim();
        if (s.selector) {
          await page.waitForSelector(s.selector, { timeout: 10000 });
          await page.locator(s.selector).first().press(key);
        } else {
          await page.keyboard.press(key);
        }
        results.push(`Step ${i + 1}: pressed ${key}`);
        
      } else if (step.action === "wait") {
        const ms = Number((step as { timeout_ms?: number }).timeout_ms) || 1000;
        await new Promise((r) => setTimeout(r, Math.min(ms, 15000)));
        results.push(`Step ${i + 1}: waited ${ms}ms`);
        
      } else if (step.action === "wait_selector") {
        const s = step as { selector?: string; timeout_ms?: number };
        const selector = String(s.selector ?? "").trim();
        const timeout = Math.min(Number(s.timeout_ms) || 8000, 20000);
        if (!selector) {
          results.push(`Step ${i + 1}: wait_selector skipped (no selector)`);
          continue;
        }
        await page.waitForSelector(selector, { timeout, state: 'visible' });
        results.push(`Step ${i + 1}: element visible ${selector}`);
      }
      
    } catch (e) {
      results.push(`Step ${i + 1} failed: ${e instanceof Error ? e.message : String(e)}`);
    }
    
    if (stepDelayMs > 0) await new Promise((r) => setTimeout(r, stepDelayMs));
  }
  
  return results;
}

/**
 * Enhanced browser control with persistent sessions, smart element finding, fullscreen support, and video player control.
 * Keeps browser open between calls for better navigation flow.
 */
export async function createBrowserSessionTool(): Promise<ToolDefinition | null> {
  try {
    await import("playwright");
    return {
      name: "browser_session",
      description: `Enhanced persistent browser control. The browser stays open between calls so you can navigate step-by-step without losing context. New actions: smart_search (auto-find search box and search), find_and_click (click by text without selector), find_and_type (type by label), fullscreen (make video fullscreen), get_video_state (check video playing/paused). All original actions work: goto, type, click, double_click, hover, scroll, press_key, wait, wait_selector. Perfect for streaming sites (YouTube, Netflix, anime sites): navigate, search, play, and control video. Use sessionId to maintain separate browser instances.`,
      parameters: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            description: "List of actions: goto, smart_search, find_and_click, find_and_type, type, click, double_click, hover, scroll, press_key, wait, wait_selector, fullscreen, get_video_state.",
            items: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: [
                    "goto", "smart_search", "find_and_click", "find_and_type",
                    "type", "click", "double_click", "hover", "scroll",
                    "select_option", "check", "uncheck", "press_key",
                    "wait", "wait_selector", "fullscreen", "get_video_state"
                  ],
                },
                url: { type: "string", description: "For goto" },
                query: { type: "string", description: "For smart_search: search term" },
                text: { type: "string", description: "For find_and_click/find_and_type: element text to find" },
                role: { type: "string", description: "For find_and_click: button, link, etc." },
                selector: { type: "string", description: "CSS selector" },
                value: { type: "string", description: "Text to type" },
                direction: { type: "string", description: "For scroll: up|down|top|bottom|to_selector" },
                amount: { type: "number", description: "Scroll pixels" },
                key: { type: "string", description: "Key name: Enter, Escape, etc." },
                timeout_ms: { type: "number", description: "Wait timeout" },
              },
            },
          },
          sessionId: {
            type: "string",
            description: "Optional session ID to maintain separate browser instances. Default: 'default'"
          },
          close_session: {
            type: "boolean",
            description: "Set true to close this browser session after execution. Default: false (keeps browser open)."
          }
        },
      },
      async execute(args) {
        const steps = args.steps as Step[] | undefined;
        if (!Array.isArray(steps) || steps.length === 0) {
          return "Error: steps is required (array of actions).";
        }
        
        const sessionId = String(args.sessionId ?? "default").trim() || "default";
        const closeSession = args.close_session === true;
        
        try {
          const session = await getOrCreateSession(sessionId);
          const results = await runEnhancedSteps(session.page, steps, 600);

          if (closeSession) {
            // Save browser state before closing (cookies, localStorage, auth)
            const storageStatePath = join(session.profileDir, "storage-state.json");
            try {
              await session.context.storageState({ path: storageStatePath });
              results.push(`Browser state saved to ${storageStatePath}`);
            } catch (e) {
              results.push(`Warning: Could not save browser state: ${e instanceof Error ? e.message : String(e)}`);
            }
            
            await session.browser.close();
            sessions.delete(sessionId);
            results.push("Browser session closed.");
          } else {
            results.push(`Browser session '${sessionId}' kept open. Current URL: ${session.page.url()}`);
          }
          
          return results.join("\n") || "No steps run.";
        } catch (e) {
          return `Error: ${e instanceof Error ? e.message : String(e)}`;
        }
      },
    };
  } catch {
    return null;
  }
}

// Export session getter for other tools (e.g., screenshot)
export function getBrowserSession(sessionId: string = "default"): BrowserSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  if (Date.now() - session.createdAt >= BROWSER_SESSION_TTL) {
    sessions.delete(sessionId);
    return null;
  }
  return session;
}

// Export cleanup function to close all sessions on process exit
export function cleanupBrowserSessions(): void {
  for (const [id, session] of sessions) {
    session.browser.close().catch(() => {});
  }
  sessions.clear();
}

// Auto-cleanup on process exit
process.on("exit", cleanupBrowserSessions);
process.on("SIGINT", () => {
  cleanupBrowserSessions();
  process.exit(0);
});
