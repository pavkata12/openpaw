import type { ChannelAdapter, InboundMessage, SendContext } from "./types.js";

export function createTelegramChannel(
  botToken: string,
  allowedUserIds?: string[]
): ChannelAdapter {
  let handler: ((msg: InboundMessage) => void | Promise<void>) | null = null;
  let client: { on: (e: string, cb: (msg: unknown) => void) => void; sendMessage: (chatId: string, text: string) => Promise<unknown> } | null = null;

  return {
    name: "telegram",
    async start() {
      const TelegramBot = (await import("node-telegram-bot-api")).default;
      const bot = new TelegramBot(botToken, { polling: true });
      client = bot;
      bot.on("message", (msg: { from?: { id: number }; chat?: { id: number }; text?: string }) => {
        if (!msg.from || !msg.text) return;
        const userId = String(msg.from.id);
        if (allowedUserIds?.length && !allowedUserIds.includes(userId)) return;
        const text = msg.text.trim();
        if (!text) return;
        if (handler) {
          void handler({
            channelId: "telegram",
            userId,
            text,
            metadata: { chatId: String(msg.chat?.id ?? "") },
          });
        }
      });
    },
    onMessage(h) {
      handler = h;
    },
    async send(userId: string, reply: { text: string }, context?: SendContext) {
      if (!client) return;
      const chatId = (context?.channelId as string) || userId;
      await (client as { sendMessage: (id: string, t: string) => Promise<unknown> }).sendMessage(chatId, reply.text).catch(() => {});
    },
  };
}
