import type { ToolDefinition } from "./types.js";

type Step = { action: "goto"; url?: string } | { action: "type"; selector?: string; value?: string } | { action: "click"; selector?: string };

/**
 * Optional browser automation (requires: npm install playwright && npx playwright install chromium).
 * One tool that runs a sequence of steps: goto URL, type into fields, click buttons. Use for login flows or filling forms.
 */
export async function createBrowserAutomateTool(): Promise<ToolDefinition | null> {
  try {
    const { chromium } = await import("playwright");
    return {
      name: "browser_automate",
      description:
        "Run browser automation steps: open a URL, type into inputs (e.g. login), click buttons. Use when the user asks to open a site and log in or fill a form. Steps: list of { action: 'goto'|'type'|'click', url?, selector?, value? }. For 'type' and 'click' use a CSS selector (e.g. input[name=email], button[type=submit]). Requires Playwright: npm install playwright && npx playwright install chromium.",
      parameters: {
        type: "object",
        properties: {
          steps: {
            type: "array",
            description: "List of steps. Each: { action: 'goto', url } or { action: 'type', selector, value } or { action: 'click', selector }",
            items: {
              type: "object",
              properties: {
                action: { type: "string", enum: ["goto", "type", "click"] },
                url: { type: "string" },
                selector: { type: "string" },
                value: { type: "string" },
              },
            },
          },
        },
      },
      async execute(args) {
        const steps = args.steps as Step[] | undefined;
        if (!Array.isArray(steps) || steps.length === 0) {
          return "Error: steps is required (array of { action, url? | selector?, value? }).";
        }
        const browser = await chromium.launch({ headless: true });
        try {
          const page = await browser.newPage();
          const results: string[] = [];
          for (let i = 0; i < steps.length; i++) {
            const step = steps[i];
            if (!step || typeof step.action !== "string") continue;
            try {
              if (step.action === "goto") {
                const url = String((step as { url?: string }).url ?? "").trim();
                if (!url) { results.push(`Step ${i + 1}: goto skipped (no url)`); continue; }
                await page.goto(url, { timeout: 15_000 });
                results.push(`Step ${i + 1}: opened ${url}`);
              } else if (step.action === "type") {
                const s = step as { selector?: string; value?: string };
                const selector = String(s.selector ?? "").trim();
                const value = String(s.value ?? "").trim();
                if (!selector) { results.push(`Step ${i + 1}: type skipped (no selector)`); continue; }
                await page.waitForSelector(selector, { timeout: 5000 });
                await page.fill(selector, value);
                results.push(`Step ${i + 1}: typed into ${selector}`);
              } else if (step.action === "click") {
                const selector = String((step as { selector?: string }).selector ?? "").trim();
                if (!selector) { results.push(`Step ${i + 1}: click skipped (no selector)`); continue; }
                await page.waitForSelector(selector, { timeout: 5000 });
                await page.click(selector);
                results.push(`Step ${i + 1}: clicked ${selector}`);
              }
            } catch (e) {
              results.push(`Step ${i + 1} failed: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
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
