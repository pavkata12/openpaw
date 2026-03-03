import type { ChannelAdapter, InboundMessage, SendContext } from "./types.js";

export interface TelegramChannelOptions {
  /** When set, voice messages are downloaded, transcribed with this function, and sent to the agent as text. Reply is sent as text in chat. */
  transcribeVoice?: (audioBuffer: Buffer, mimeType?: string) => Promise<string>;
}

export function createTelegramChannel(
  botToken: string,
  allowedUserIds?: string[],
  options?: TelegramChannelOptions
): ChannelAdapter {
  const transcribeVoice = options?.transcribeVoice;
  let handler: ((msg: InboundMessage) => void | Promise<void>) | null = null;
  let client: {
    on: (e: string, cb: (msg: unknown) => void) => void;
    sendMessage: (chatId: string, text: string) => Promise<unknown>;
    getFile: (fileId: string) => Promise<{ file_path: string }>;
  } | null = null;

  async function downloadVoiceFile(fileId: string): Promise<Buffer> {
    if (!client) throw new Error("Bot not started");
    const file = await (client as { getFile: (id: string) => Promise<{ file_path: string }> }).getFile(fileId);
    const url = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download voice: ${res.status}`);
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  }

  return {
    name: "telegram",
    async start() {
      const TelegramBot = (await import("node-telegram-bot-api")).default;
      const bot = new TelegramBot(botToken, { polling: true });
      client = bot as typeof client;
      bot.on("message", (msg: { from?: { id: number }; chat?: { id: number }; text?: string; voice?: { file_id: string; mime_type?: string } }) => {
        if (!msg.from) return;
        const userId = String(msg.from.id);
        if (allowedUserIds?.length && !allowedUserIds.includes(userId)) return;
        const chatId = String(msg.chat?.id ?? "");

        if (msg.voice && transcribeVoice) {
          void (async () => {
            try {
              const buffer = await downloadVoiceFile(msg.voice!.file_id);
              const mime = msg.voice!.mime_type ?? "audio/ogg";
              const text = await transcribeVoice(buffer, mime);
              if (!text?.trim()) return;
              if (handler) {
                await handler({
                  channelId: "telegram",
                  userId,
                  text: text.trim(),
                  metadata: { chatId, voice: true },
                });
              }
            } catch (err) {
              if (handler) {
                void handler({
                  channelId: "telegram",
                  userId,
                  text: `[Voice transcription failed: ${err instanceof Error ? err.message : String(err)}]`,
                  metadata: { chatId },
                });
              }
            }
          })();
          return;
        }

        if (!msg.text) return;
        const text = msg.text.trim();
        if (!text) return;
        if (handler) {
          void handler({
            channelId: "telegram",
            userId,
            text,
            metadata: { chatId },
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
