import { createInterface } from "node:readline";
import type { ChannelAdapter, InboundMessage } from "./types.js";

export function createCLIChannel(): ChannelAdapter {
  let handler: ((msg: InboundMessage) => void) | null = null;

  return {
    name: "cli",
    async start() {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      console.log("\n  OpenPaw — type a message. 'exit' or 'quit' to stop.\n");
      const ask = () => {
        rl.question("  You: ", async (line) => {
          const input = line.trim();
          if (!input) {
            ask();
            return;
          }
          if (input.toLowerCase() === "exit" || input.toLowerCase() === "quit") {
            console.log("  Bye.\n");
            rl.close();
            return;
          }
          if (handler) {
            await handler({
              channelId: "cli",
              userId: "local",
              text: input,
            });
          }
          ask();
        });
      };
      ask();
    },
    onMessage(h) {
      handler = h;
    },
    async send(_userId: string, reply: { text: string }, _context?: { channelId?: string }) {
      process.stdout.write("  Paw: ");
      console.log(reply.text);
      console.log("");
    },
  };
}
