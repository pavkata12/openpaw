import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { Config } from "../config.js";
import { loadChunks, saveChunks, searchChunks, type EmbeddingChunk } from "./vector-store.js";

const CHUNK_SIZE = 500;
const OVERLAP = 50;

function* chunkText(text: string, maxTokens: number = CHUNK_SIZE): Generator<string> {
  const words = text.split(/\s+/).filter(Boolean);
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + maxTokens, words.length);
    yield words.slice(start, end).join(" ");
    start = end - (end < words.length ? OVERLAP : 0);
  }
}

let embeddingCache: ((text: string) => Promise<number[]>) | null = null;

async function getEmbeddingFn(config: Config): Promise<(text: string) => Promise<number[]>> {
  if (embeddingCache) return embeddingCache;
  const base = config.OPENPAW_LLM_BASE_URL.replace(/\/$/, "");
  const model = config.OPENPAW_EMBEDDING_MODEL ?? "text-embedding-3-small";
  const apiKey = config.OPENPAW_LLM_API_KEY;
  const fn = async (text: string): Promise<number[]> => {
    const res = await fetch(`${base}/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({ model, input: text.slice(0, 8000) }),
    });
    if (!res.ok) throw new Error(`Embeddings API failed: ${res.status}`);
    const data = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
    const embedding = data.data?.[0]?.embedding;
    if (!embedding) throw new Error("No embedding in response");
    return embedding;
  };
  embeddingCache = fn;
  return fn;
}

export async function embedAndStore(
  config: Config,
  storePath: string,
  text: string,
  source?: string
): Promise<number> {
  const embed = await getEmbeddingFn(config);
  const chunks = await loadChunks(storePath);
  let added = 0;
  for (const piece of chunkText(text)) {
    if (!piece.trim()) continue;
    const embedding = await embed(piece);
    const id = `chunk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    chunks.push({ id, text: piece, embedding, source });
    added++;
  }
  await saveChunks(storePath, chunks);
  return added;
}

export async function embedQuery(config: Config, query: string): Promise<number[]> {
  const embed = await getEmbeddingFn(config);
  return embed(query);
}

export async function search(
  config: Config,
  storePath: string,
  query: string,
  topK: number = 5
): Promise<{ text: string; source?: string }[]> {
  const chunks = await loadChunks(storePath);
  if (chunks.length === 0) return [];
  const queryEmbedding = await embedQuery(config, query);
  const results = searchChunks(chunks, queryEmbedding, topK);
  return results.map((c) => ({ text: c.text, source: c.source }));
}

export async function ingestFile(config: Config, storePath: string, filePath: string): Promise<number> {
  const fullPath = join(storePath, filePath);
  const raw = await readFile(fullPath, "utf-8");
  const text = raw.replace(/\r\n/g, "\n");
  return embedAndStore(config, storePath, text, filePath);
}

/** Ingest a file from an absolute path (e.g. workspace TARGET.md) into the store. */
export async function ingestFromPath(
  config: Config,
  storePath: string,
  absolutePath: string,
  sourceLabel: string
): Promise<number> {
  const raw = await readFile(absolutePath, "utf-8");
  const text = raw.replace(/\r\n/g, "\n");
  return embedAndStore(config, storePath, text, sourceLabel);
}

const WORKSPACE_CONTEXT_FILES = ["TARGET.md", "README.md", ".openpaw/context.md"] as const;

/** If store is empty, ingest TARGET.md, README.md, .openpaw/context.md from workspace. Returns number of chunks added. */
export async function ensureWorkspaceContextIngested(
  config: Config,
  storePath: string,
  workspacePath: string
): Promise<number> {
  const chunks = await loadChunks(storePath);
  if (chunks.length > 0) return 0;
  let added = 0;
  for (const rel of WORKSPACE_CONTEXT_FILES) {
    const full = join(workspacePath, rel);
    if (!existsSync(full)) continue;
    try {
      added += await ingestFromPath(config, storePath, full, rel);
    } catch {
      /* skip */
    }
  }
  return added;
}
