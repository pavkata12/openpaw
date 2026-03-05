/**
 * Tool result caching layer - speeds up repeated identical tool calls
 * Caches results for 5 minutes to avoid redundant operations
 */

interface CacheEntry {
  result: string;
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, CacheEntry>();

/**
 * Generate cache key from tool name and arguments
 */
function getCacheKey(toolName: string, args: Record<string, unknown>): string {
  // Sort keys for consistent hashing
  const sortedArgs = Object.keys(args)
    .sort()
    .reduce((acc, key) => {
      acc[key] = args[key];
      return acc;
    }, {} as Record<string, unknown>);
  
  return `${toolName}::${JSON.stringify(sortedArgs)}`;
}

/**
 * Get cached result if available and fresh
 */
export function getCachedResult(toolName: string, args: Record<string, unknown>): string | null {
  const key = getCacheKey(toolName, args);
  const entry = cache.get(key);
  
  if (!entry) return null;
  
  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  
  return entry.result;
}

/**
 * Store result in cache
 */
export function setCachedResult(toolName: string, args: Record<string, unknown>, result: string): void {
  const key = getCacheKey(toolName, args);
  cache.set(key, {
    result,
    timestamp: Date.now()
  });
}

/**
 * Clear all cached results
 */
export function clearCache(): void {
  cache.clear();
}

/**
 * Clear cached results for a specific tool
 */
export function clearToolCache(toolName: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(`${toolName}::`)) {
      cache.delete(key);
    }
  }
}

/**
 * Get cache stats
 */
export function getCacheStats(): { size: number; entries: Array<{ tool: string; age: string }> } {
  const entries = Array.from(cache.entries()).map(([key, entry]) => {
    const tool = key.split("::")[0];
    const age = Math.floor((Date.now() - entry.timestamp) / 1000);
    return { tool, age: `${age}s ago` };
  });
  
  return {
    size: cache.size,
    entries
  };
}

/**
 * List of tools that should be cached (safe to cache, deterministic results)
 */
const CACHEABLE_TOOLS = new Set([
  "read_file",
  "list_dir",
  "search_in_files",
  "workspace_context",
  "web_search",
  "google_search",
  "fetch_page",
  "extract_video_url",  // yt-dlp metadata
  "nmap_scan",
  "wireless_scan",
  "recall",  // Memory recall
  "knowledge_search",
  "email_search",
  "calendar_list",
  "schedule_list"
]);

/**
 * Check if a tool should be cached
 */
export function isToolCacheable(toolName: string): boolean {
  return CACHEABLE_TOOLS.has(toolName);
}

/**
 * Periodic cleanup of expired cache entries
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      cache.delete(key);
    }
  }
}, 60 * 1000); // Clean up every minute
