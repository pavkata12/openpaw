import { randomUUID } from "node:crypto";
import type { ChannelAdapter, InboundMessage, SendContext } from "./types.js";

const PENDING = new Map<string, { resolve: (text: string) => void; reject: (err: Error) => void }>();

export function createWebChannel(): ChannelAdapter & { sendMessage(userId: string, text: string): Promise<string> } {
  let handler: ((msg: InboundMessage) => void | Promise<void>) | null = null;

  return {
    name: "web",
    async start() {
      // Web channel is request/response; no long-running loop
    },
    onMessage(h) {
      handler = h;
    },
    async send(userId: string, reply: { text: string }, context?: SendContext) {
      const requestId = context?.requestId as string | undefined;
      if (requestId) {
        const pending = PENDING.get(requestId);
        if (pending) {
          PENDING.delete(requestId);
          pending.resolve(reply.text);
        }
      }
    },
    async sendMessage(userId: string, text: string, metadata?: Record<string, unknown>): Promise<string> {
      return new Promise((resolve, reject) => {
        const requestId = randomUUID();
        PENDING.set(requestId, { resolve, reject });
        const msg: InboundMessage = {
          channelId: "web",
          userId,
          text,
          metadata: { requestId, ...metadata },
        };
        if (handler) {
          const p = handler(msg);
          if (p && typeof (p as Promise<unknown>).catch === "function") {
            (p as Promise<void>).catch((err: unknown) => {
              PENDING.delete(requestId);
              reject(err instanceof Error ? err : new Error(String(err)));
            });
          }
        } else {
          PENDING.delete(requestId);
          reject(new Error("Web channel not connected to router"));
        }
      });
    },
  };
}
