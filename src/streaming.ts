/**
 * Streaming tool execution via Server-Sent Events (SSE)
 * Shows real-time progress as AI works on tasks
 */

export type StreamEvent = 
  | { type: "thinking"; content: string }
  | { type: "tool_call_start"; tool: string; args: Record<string, unknown> }
  | { type: "tool_call_progress"; tool: string; message: string }
  | { type: "tool_call_complete"; tool: string; result: string }
  | { type: "assistant_message"; content: string }
  | { type: "complete"; finalMessage: string }
  | { type: "error"; message: string };

type StreamCallback = (event: StreamEvent) => void;

let globalStreamCallback: StreamCallback | null = null;

/**
 * Set global stream callback for the current agent run
 */
export function setStreamCallback(callback: StreamCallback | null): void {
  globalStreamCallback = callback;
}

/**
 * Get current stream callback
 */
export function getStreamCallback(): StreamCallback | null {
  return globalStreamCallback;
}

/**
 * Emit stream event
 */
export function emitStreamEvent(event: StreamEvent): void {
  if (globalStreamCallback) {
    globalStreamCallback(event);
  }
}

/**
 * Helper: Emit thinking event
 */
export function emitThinking(content: string): void {
  emitStreamEvent({ type: "thinking", content });
}

/**
 * Helper: Emit tool call start
 */
export function emitToolCallStart(tool: string, args: Record<string, unknown>): void {
  emitStreamEvent({ type: "tool_call_start", tool, args });
}

/**
 * Helper: Emit tool call progress
 */
export function emitToolCallProgress(tool: string, message: string): void {
  emitStreamEvent({ type: "tool_call_progress", tool, message });
}

/**
 * Helper: Emit tool call complete
 */
export function emitToolCallComplete(tool: string, result: string): void {
  emitStreamEvent({ type: "tool_call_complete", tool, result });
}

/**
 * Helper: Emit assistant message
 */
export function emitAssistantMessage(content: string): void {
  emitStreamEvent({ type: "assistant_message", content });
}

/**
 * Helper: Emit completion
 */
export function emitComplete(finalMessage: string): void {
  emitStreamEvent({ type: "complete", finalMessage });
}

/**
 * Helper: Emit error
 */
export function emitError(message: string): void {
  emitStreamEvent({ type: "error", message });
}

/**
 * Create SSE response handler for HTTP
 */
export function createSSEHandler(callback: StreamCallback): StreamCallback {
  // Return the callback for chaining
  return callback;
}

/**
 * Format event as SSE for HTTP streaming
 */
export function formatSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
