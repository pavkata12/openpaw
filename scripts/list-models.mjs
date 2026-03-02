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

const apiKey = process.env.OPENPAW_LLM_API_KEY;
const res = await fetch("https://openrouter.ai/api/v1/models", {
  headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
});
const d = await res.json();
const data = d.data || [];
const free = data.filter((m) => m.id && (String(m.id).includes(":free") || (m.pricing && Number(m.pricing.prompt) === 0)));
console.log("Free / free-tier models (first 15):");
free.slice(0, 15).forEach((m) => console.log("  ", m.id));
