import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface EmbeddingChunk {
  id: string;
  text: string;
  embedding: number[];
  source?: string;
}

const STORE_FILE = "vectors.json";

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function loadChunks(storePath: string): Promise<EmbeddingChunk[]> {
  const path = join(storePath, STORE_FILE);
  try {
    const raw = await readFile(path, "utf-8");
    const parsed = JSON.parse(raw) as { chunks?: EmbeddingChunk[] };
    return Array.isArray(parsed.chunks) ? parsed.chunks : [];
  } catch {
    return [];
  }
}

export async function saveChunks(storePath: string, chunks: EmbeddingChunk[]): Promise<void> {
  await mkdir(storePath, { recursive: true });
  const path = join(storePath, STORE_FILE);
  await writeFile(path, JSON.stringify({ chunks }, null, 2), "utf-8");
}

export function searchChunks(chunks: EmbeddingChunk[], queryEmbedding: number[], topK: number): EmbeddingChunk[] {
  const withScore = chunks.map((c) => ({
    chunk: c,
    score: cosineSimilarity(c.embedding, queryEmbedding),
  }));
  withScore.sort((a, b) => b.score - a.score);
  return withScore.slice(0, topK).map((x) => x.chunk);
}
