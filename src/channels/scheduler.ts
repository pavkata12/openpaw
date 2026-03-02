import type { ChannelAdapter, InboundMessage } from "./types.js";

export function createSchedulerChannel(): ChannelAdapter & { trigger(taskId: string, prompt: string): Promise<void> } {
  let handler: ((msg: InboundMessage) => void | Promise<void>) | null = null;

  return {
    name: "scheduler",
    async start() {},
    onMessage(h) {
      handler = h;
    },
    async send(userId: string, reply: { text: string }) {
      // Optional: log or persist scheduled task output
      if (process.env.NODE_ENV !== "test") {
        console.log(`  [scheduled ${userId}]: ${reply.text.slice(0, 200)}${reply.text.length > 200 ? "..." : ""}`);
      }
    },
    async trigger(taskId: string, prompt: string) {
      if (handler) {
        await handler({
          channelId: "scheduler",
          userId: taskId,
          text: prompt,
        });
      }
    },
  };
}
