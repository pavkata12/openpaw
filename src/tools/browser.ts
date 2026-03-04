import type { ToolDefinition } from "./types.js";

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
  | { action: "wait_selector"; selector?: string; timeout_ms?: number };

const STEP_DESCRIPTION =
  "Each step: goto (url), type (selector, value), click (selector), double_click (selector), hover (selector), scroll (direction: up|down|top|bottom|to_selector, amount for up/down in px, selector for to_selector), select_option (selector, value or label), check (selector), uncheck (selector), press_key (key e.g. Enter|Tab|Escape, optional selector to focus first), wait (timeout_ms), wait_selector (selector, timeout_ms). Use CSS selectors: input[name=email], button[type=submit], #id, .class.";

async function runSteps(page: import("playwright").Page, steps: Step[], stepDelayMs: number = 300): Promise<string[]> {
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
        await page.goto(url, { timeout: 20_000, waitUntil: "domcontentloaded" });
        results.push(`Step ${i + 1}: opened ${url}`);
      } else if (step.action === "type") {
        const s = step as { selector?: string; value?: string };
        const selector = String(s.selector ?? "").trim();
        const value = String(s.value ?? "").trim();
        if (!selector) {
          results.push(`Step ${i + 1}: type skipped (no selector)`);
          continue;
        }
        await page.waitForSelector(selector, { timeout: 8000 });
        await page.fill(selector, value);
        results.push(`Step ${i + 1}: typed into ${selector}`);
      } else if (step.action === "click") {
        const selector = String((step as { selector?: string }).selector ?? "").trim();
        if (!selector) {
          results.push(`Step ${i + 1}: click skipped (no selector)`);
          continue;
        }
        await page.waitForSelector(selector, { timeout: 8000 });
        await page.click(selector);
        results.push(`Step ${i + 1}: clicked ${selector}`);
      } else if (step.action === "double_click") {
        const selector = String((step as { selector?: string }).selector ?? "").trim();
        if (!selector) {
          results.push(`Step ${i + 1}: double_click skipped (no selector)`);
          continue;
        }
        await page.waitForSelector(selector, { timeout: 8000 });
        await page.dblclick(selector);
        results.push(`Step ${i + 1}: double-clicked ${selector}`);
      } else if (step.action === "hover") {
        const selector = String((step as { selector?: string }).selector ?? "").trim();
        if (!selector) {
          results.push(`Step ${i + 1}: hover skipped (no selector)`);
          continue;
        }
        await page.waitForSelector(selector, { timeout: 8000 });
        await page.hover(selector);
        results.push(`Step ${i + 1}: hovered ${selector}`);
      } else if (step.action === "scroll") {
        const s = step as { direction?: string; amount?: number; selector?: string };
        const direction = String(s.direction ?? "down").toLowerCase();
        const amount = Number(s.amount) || 400;
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
      } else if (step.action === "select_option") {
        const s = step as { selector?: string; value?: string; label?: string };
        const selector = String(s.selector ?? "").trim();
        if (!selector) {
          results.push(`Step ${i + 1}: select_option skipped (no selector)`);
          continue;
        }
        await page.waitForSelector(selector, { timeout: 8000 });
        if (s.value !== undefined && s.value !== "") {
          await page.selectOption(selector, s.value);
        } else if (s.label !== undefined && s.label !== "") {
          await page.selectOption(selector, { label: s.label });
        } else {
          results.push(`Step ${i + 1}: select_option skipped (provide value or label)`);
          continue;
        }
        results.push(`Step ${i + 1}: selected option in ${selector}`);
      } else if (step.action === "check") {
        const selector = String((step as { selector?: string }).selector ?? "").trim();
        if (!selector) {
          results.push(`Step ${i + 1}: check skipped (no selector)`);
          continue;
        }
        await page.waitForSelector(selector, { timeout: 8000 });
        await page.check(selector);
        results.push(`Step ${i + 1}: checked ${selector}`);
      } else if (step.action === "uncheck") {
        const selector = String((step as { selector?: string }).selector ?? "").trim();
        if (!selector) {
          results.push(`Step ${i + 1}: uncheck skipped (no selector)`);
          continue;
        }
        await page.waitForSelector(selector, { timeout: 8000 });
        await page.uncheck(selector);
        results.push(`Step ${i + 1}: unchecked ${selector}`);
      } else if (step.action === "press_key") {
        const s = step as { key?: string; selector?: string };
        const key = String(s.key ?? "Enter").trim();
        if (s.selector) {
          await page.waitForSelector(s.selector, { timeout: 8000 });
          await page.locator(s.selector).press(key);
        } else {
          await page.keyboard.press(key);
        }
        results.push(`Step ${i + 1}: pressed ${key}`);
      } else if (step.action === "wait") {
        const ms = Number((step as { timeout_ms?: number }).timeout_ms) || 1000;
        await new Promise((r) => setTimeout(r, Math.min(ms, 10000)));
        results.push(`Step ${i + 1}: waited ${ms}ms`);
      } else if (step.action === "wait_selector") {
        const s = step as { selector?: string; timeout_ms?: number };
        const selector = String(s.selector ?? "").trim();
        const timeout = Math.min(Number(s.timeout_ms) || 5000, 15000);
        if (!selector) {
          results.push(`Step ${i + 1}: wait_selector skipped (no selector)`);
          continue;
        }
        await page.waitForSelector(selector, { timeout });
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
 * Optional browser automation (requires: npm install playwright && npx playwright install chromium).
 * Full human-like control: goto, type, click, double_click, hover, scroll, select_option, check, uncheck, press_key, wait, wait_selector.
 */
export async function createBrowserAutomateTool(): Promise<ToolDefinition | null> {
  try {
    const { chromium } = await import("playwright");
    return {
      name: "browser_automate",
      description: `Control the browser like a human. Run a sequence of steps: goto URL, type into inputs, click or double-click, hover (for dropdowns), scroll (up/down/top/bottom/to_selector), select from dropdowns, check/uncheck boxes, press keys (Enter, Tab, Escape). Use for login, forms, infinite scroll, or any site interaction. ${STEP_DESCRIPTION} Requires Playwright: npm install playwright && npx playwright install chromium.`,
      parameters: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            description: "List of steps. Actions: goto, type, click, double_click, hover, scroll, select_option, check, uncheck, press_key, wait, wait_selector.",
            items: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: [
                    "goto",
                    "type",
                    "click",
                    "double_click",
                    "hover",
                    "scroll",
                    "select_option",
                    "check",
                    "uncheck",
                    "press_key",
                    "wait",
                    "wait_selector",
                  ],
                },
                url: { type: "string" },
                selector: { type: "string" },
                value: { type: "string" },
                label: { type: "string" },
                direction: { type: "string", description: "For scroll: up, down, top, bottom, to_selector" },
                amount: { type: "number", description: "For scroll up/down: pixels" },
                key: { type: "string", description: "For press_key: Enter, Tab, Escape, etc." },
                timeout_ms: { type: "number", description: "For wait or wait_selector: milliseconds" },
              },
            },
          },
        },
      },
      async execute(args) {
        const steps = args.steps as Step[] | undefined;
        if (!Array.isArray(steps) || steps.length === 0) {
          return "Error: steps is required (array of steps with action and optional url/selector/value/direction/amount/key/timeout_ms).";
        }
        const browser = await chromium.launch({ headless: true });
        try {
          const page = await browser.newPage();
          const results = await runSteps(page, steps);
          return results.join("\n") || "No steps run.";
        } finally {
          await browser.close();
        }
      },
    };
  } catch {
    return null;
  }
}

const MAX_PAGE_TEXT = 15_000;
const MAX_LINKS = 150;
const MAX_BUTTONS = 80;
const MAX_INPUTS = 50;

/**
 * Open a URL, optionally run steps (goto, type, click, scroll, hover, etc.), then return page title, visible text, links, and actionable elements (buttons, inputs) so the agent can control the page like a human.
 */
export async function createBrowserOpenAndReadTool(): Promise<ToolDefinition | null> {
  try {
    const { chromium } = await import("playwright");
    return {
      name: "browser_open_and_read",
      description: `Open a URL in a real browser (JavaScript runs). Returns: page title, visible text, links (url + text), and actionable elements (buttons and inputs with selectors so you can click/type by meaning). Use when the user says "go to this site and find/do X": open the site, read the result, then use browser_automate with the right selectors to click, type, scroll, or select. Optional 'steps' to run before extracting (same actions as browser_automate: goto, type, click, scroll, hover, wait, etc.). ${STEP_DESCRIPTION}`,
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Full URL to open. If steps are given, first step can be goto with this url or another.",
          },
          steps: {
            type: "array",
            description: "Optional. Steps before extracting: goto, type, click, scroll, hover, wait, wait_selector, etc.",
            items: {
              type: "object",
              properties: {
                action: {
                  type: "string",
                  enum: [
                    "goto",
                    "type",
                    "click",
                    "double_click",
                    "hover",
                    "scroll",
                    "select_option",
                    "check",
                    "uncheck",
                    "press_key",
                    "wait",
                    "wait_selector",
                  ],
                },
                url: { type: "string" },
                selector: { type: "string" },
                value: { type: "string" },
                label: { type: "string" },
                direction: { type: "string" },
                amount: { type: "number" },
                key: { type: "string" },
                timeout_ms: { type: "number" },
              },
            },
          },
        },
      },
      async execute(args) {
        const url = String(args.url ?? "").trim();
        const steps = ((args.steps as Step[] | undefined) ?? []) as Step[];
        if (!url && steps.length === 0) return "Error: provide url or at least one step with action 'goto' and url.";

        const browser = await chromium.launch({ headless: true });
        try {
          const page = await browser.newPage();
          const firstGoto = url || (steps[0]?.action === "goto" ? String((steps[0] as { url?: string }).url ?? "").trim() : "");
          if (firstGoto) await page.goto(firstGoto, { timeout: 20_000, waitUntil: "domcontentloaded" });

          const stepResults = await runSteps(page, steps, 400);
          // If any step failed badly, we still try to extract; stepResults are logged only on demand

          const out = await page.evaluate(
            ({ maxText, maxLinks, maxButtons, maxInputs }: { maxText: number; maxLinks: number; maxButtons: number; maxInputs: number }) => {
              const title = document.title || "";
              const text = (document.body?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, maxText);
              const links: { href: string; text: string }[] = [];
              document.querySelectorAll("a[href]").forEach((a) => {
                const href = (a as HTMLAnchorElement).href?.trim();
                if (!href || href.startsWith("javascript:")) return;
                const t = (a.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
                if (links.length < maxLinks) links.push({ href, text: t });
              });
              const buttons: { text: string; selectorHint: string }[] = [];
              document.querySelectorAll("button, [role='button'], input[type='submit'], input[type='button']").forEach((el, idx) => {
                if (buttons.length >= maxButtons) return;
                const tag = el.tagName.toLowerCase();
                const text = (el.textContent ?? (el as HTMLInputElement).value ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
                const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : "";
                const name = (el as HTMLInputElement).name ? `[name="${(el as HTMLInputElement).name}"]` : "";
                const selectorHint = id || name || (tag === "button" ? `button:nth-of-type(${idx + 1})` : `${tag}${name || "[type=submit]"}`);
                buttons.push({ text, selectorHint });
              });
              const inputs: { type: string; name: string; placeholder: string; selectorHint: string }[] = [];
              document.querySelectorAll("input:not([type='submit']):not([type='button']):not([type='hidden']), textarea").forEach((el, idx) => {
                if (inputs.length >= maxInputs) return;
                const tag = el.tagName.toLowerCase();
                const type = ((el as HTMLInputElement).type ?? "text").toLowerCase();
                const name = (el as HTMLInputElement).name ?? "";
                const placeholder = ((el as HTMLInputElement).placeholder ?? "").slice(0, 80);
                const id = (el as HTMLElement).id ? `#${(el as HTMLElement).id}` : "";
                const selectorHint = id || (name ? `[name="${name}"]` : `${tag}[type="${type}"]:nth-of-type(${idx + 1})`);
                inputs.push({ type, name, placeholder, selectorHint });
              });
              return { title, text, links, buttons, inputs };
            },
            { maxText: MAX_PAGE_TEXT, maxLinks: MAX_LINKS, maxButtons: MAX_BUTTONS, maxInputs: MAX_INPUTS }
          );

          let block = `Title: ${out.title}\n\nText:\n${out.text}`;
          if (out.links.length > 0) {
            block += `\n\nLinks (use href for navigation or transcribe_video):\n`;
            block += out.links.map((l) => `${l.href} | ${l.text}`).join("\n");
          }
          if (out.buttons.length > 0) {
            block += `\n\nButtons (use selectorHint with browser_automate click):\n`;
            block += out.buttons.map((b) => `[${b.text || "(no text)"}] selector: ${b.selectorHint}`).join("\n");
          }
          if (out.inputs.length > 0) {
            block += `\n\nInputs (use selectorHint with browser_automate type):\n`;
            block += out.inputs.map((i) => `type=${i.type} name=${i.name} placeholder=${i.placeholder} selector: ${i.selectorHint}`).join("\n");
          }
          return block;
        } finally {
          await browser.close();
        }
      },
    };
  } catch {
    return null;
  }
}
