/**
 * Smart error recovery system - learns from failures and retries with different strategies
 */

interface ErrorPattern {
  pattern: RegExp;
  strategy: string;
  retryCount: number;
}

/**
 * Known error patterns and recovery strategies
 */
const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /selector.*not found|element.*not visible|timeout.*waiting for selector/i,
    strategy: "Browser element not found. Try: 1) Use find_and_click with text instead of CSS selector, 2) Use smart_search to find the element, 3) Take screenshot to see what's visible, 4) Wait longer with wait action",
    retryCount: 2
  },
  {
    pattern: /navigation.*timeout|page.*did not load|net::ERR/i,
    strategy: "Page load timeout. Try: 1) Wait 5 seconds and retry, 2) Check if URL is correct, 3) Try different browser session",
    retryCount: 3
  },
  {
    pattern: /permission.*denied|EACCES|access.*forbidden/i,
    strategy: "Permission denied. Try: 1) Check file/folder permissions, 2) Use different path, 3) Ask user for permission if needed",
    retryCount: 1
  },
  {
    pattern: /ENOENT|file not found|directory not found/i,
    strategy: "File/folder not found. Try: 1) List parent directory to see what exists, 2) Use search_in_files to find the file, 3) Ask user for correct path",
    retryCount: 1
  },
  {
    pattern: /command not found|'.*' is not recognized/i,
    strategy: "Command not found. Try: 1) Check if tool is installed, 2) Use full path to executable, 3) Suggest installation command to user",
    retryCount: 1
  },
  {
    pattern: /video.*not.*playing|playback.*error|media.*error/i,
    strategy: "Video playback error. Try: 1) Extract direct URL with extract_video_url, 2) Try different video quality/format, 3) Use browser_session to play in browser instead",
    retryCount: 2
  },
  {
    pattern: /rate.*limit|too many requests|429/i,
    strategy: "Rate limited. Try: 1) Wait 30 seconds before retrying, 2) Use cached result if available, 3) Try alternative method",
    retryCount: 1
  },
  {
    pattern: /bot.*detection|captcha|cloudflare|access denied.*automated/i,
    strategy: "Bot detection. Browser session already uses stealth mode. Try: 1) Wait a few seconds between actions, 2) Use more human-like navigation (scroll, hover before click), 3) Manual user intervention may be needed",
    retryCount: 0
  },
  {
    pattern: /network.*error|connection.*refused|ECONNREFUSED/i,
    strategy: "Network error. Try: 1) Wait 5 seconds and retry, 2) Check if service is running, 3) Verify URL/hostname",
    retryCount: 2
  }
];

interface RetryContext {
  toolName: string;
  args: Record<string, unknown>;
  attemptCount: number;
  lastError: string;
}

const retryHistory = new Map<string, RetryContext>();

/**
 * Analyze error and suggest recovery strategy
 */
export function analyzeError(toolName: string, args: Record<string, unknown>, error: string): {
  shouldRetry: boolean;
  strategy?: string;
  waitMs?: number;
} {
  // Generate key for this tool call
  const key = `${toolName}::${JSON.stringify(args)}`;
  const context = retryHistory.get(key);
  const attemptCount = context ? context.attemptCount + 1 : 1;
  
  // Find matching error pattern
  for (const errorPattern of ERROR_PATTERNS) {
    if (errorPattern.pattern.test(error)) {
      const shouldRetry = attemptCount <= errorPattern.retryCount;
      
      // Update retry history
      retryHistory.set(key, {
        toolName,
        args,
        attemptCount,
        lastError: error
      });
      
      // Special handling for rate limits and network errors
      let waitMs = 0;
      if (error.match(/rate.*limit|too many requests|429/i)) {
        waitMs = 30000; // Wait 30s for rate limit
      } else if (error.match(/network.*error|timeout/i)) {
        waitMs = 5000; // Wait 5s for network errors
      } else if (error.match(/navigation.*timeout|page.*did not load/i)) {
        waitMs = 3000; // Wait 3s for page load timeouts
      }
      
      return {
        shouldRetry,
        strategy: shouldRetry ? errorPattern.strategy : `Max retries (${errorPattern.retryCount}) reached. ${errorPattern.strategy}`,
        waitMs
      };
    }
  }
  
  // Unknown error - don't retry automatically
  return {
    shouldRetry: false,
    strategy: "Unknown error type. Check error message and adjust approach."
  };
}

/**
 * Clear retry history for a specific tool call
 */
export function clearRetryHistory(toolName: string, args: Record<string, unknown>): void {
  const key = `${toolName}::${JSON.stringify(args)}`;
  retryHistory.delete(key);
}

/**
 * Clear all retry history (useful after successful task completion)
 */
export function clearAllRetryHistory(): void {
  retryHistory.clear();
}

/**
 * Get retry statistics
 */
export function getRetryStats(): Array<{ tool: string; attempts: number; lastError: string }> {
  return Array.from(retryHistory.values()).map(ctx => ({
    tool: ctx.toolName,
    attempts: ctx.attemptCount,
    lastError: ctx.lastError.substring(0, 100)
  }));
}

/**
 * Periodic cleanup of old retry history (prevent memory leak)
 */
setInterval(() => {
  // Clear history older than 10 minutes
  const now = Date.now();
  const TTL = 10 * 60 * 1000;
  
  // Note: We don't track timestamps yet, so this is a future enhancement
  // For now, clear everything after 100 entries
  if (retryHistory.size > 100) {
    retryHistory.clear();
  }
}, 60 * 1000);
