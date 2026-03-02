#!/usr/bin/env node
/**
 * Test LLM API directly (no OpenPaw server). Uses .env OPENPAW_LLM_*.
 * Run: node scripts/test-llm.mjs
 * Shows raw response or error so we can see why the model returns nothing.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return {};
  const raw = readFileSync(envPath, "utf-8");
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  Object.assign(process.env, out);
  return out;
}

loadEnv();

const base = (process.env.OPENPAW_LLM_BASE_URL || "http://localhost:11434/v1").replace(/\/$/, "");
const model = process.env.OPENPAW_LLM_MODEL || "llama3.2";
const apiKey = process.env.OPENPAW_LLM_API_KEY;

console.log("LLM test (from .env)");
console.log("  BASE_URL:", base);
console.log("  MODEL:", model);
console.log("  API_KEY:", apiKey ? apiKey.slice(0, 12) + "…" : "(none)");
console.log("");

const url = `${base}/chat/completions`;
const body = JSON.stringify({
  model,
  messages: [{ role: "user", content: "Say only: OK" }],
  stream: false,
});

const controller = new AbortController();
const t = setTimeout(() => controller.abort(), 25000);

try {
  const res = await fetch(url, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body,
  });
  clearTimeout(t);

  const text = await res.text();
  console.log("Status:", res.status, res.statusText);
  if (!res.ok) {
    console.log("Error body:", text.slice(0, 500));
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    console.log("Invalid JSON:", text.slice(0, 300));
    process.exit(1);
  }

  const content = data.choices?.[0]?.message?.content;
  if (content != null && content !== "") {
    console.log("Reply:", typeof content === "string" ? content : JSON.stringify(content).slice(0, 200));
  } else {
    console.log("Reply: (empty)");
    console.log("Full response (first 800 chars):", JSON.stringify(data).slice(0, 800));
  }
} catch (e) {
  clearTimeout(t);
  if (e.name === "AbortError") {
    console.error("Timeout after 25s. OpenRouter may be slow or unreachable.");
  } else {
    console.error("Request failed:", e.message);
  }
  process.exit(1);
}
