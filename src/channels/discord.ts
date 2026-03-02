import type { ChannelAdapter, InboundMessage, SendContext } from "./types.js";

export function createDiscordChannel(token: string, allowedUserIds?: string[]): ChannelAdapter {
  let handler: ((msg: InboundMessage) => void | Promise<void>) | null = null;
  let client: unknown = null;

  return {
    name: "discord",
    async start() {
      const { Client, GatewayIntentBits } = await import("discord.js");
      const c = new Client({
        intents: [
          GatewayIntentBits.Guilds,
          GatewayIntentBits.GuildMessages,
          GatewayIntentBits.DirectMessages,
          GatewayIntentBits.MessageContent,
        ],
      });
      client = c;
      c.on("ready", () => console.log(`Discord: logged in as ${c.user?.tag}`));
      c.on("messageCreate", async (msg: { author: { bot: boolean; id: string }; content?: string; channelId: string; guildId?: string | null }) => {
        if (msg.author.bot) return;
        const text = msg.content?.trim();
        if (!text) return;
        if (allowedUserIds?.length && !allowedUserIds.includes(msg.author.id)) return;
        if (handler) {
          await handler({
            channelId: "discord",
            userId: msg.author.id,
            text,
            metadata: { channelId: msg.channelId, guildId: msg.guildId ?? undefined },
          });
        }
      });
      await c.login(token);
    },
    onMessage(h) {
      handler = h;
    },
    async send(userId: string, reply: { text: string }, context?: SendContext) {
      if (!client) return;
      const c = client as { channels: { fetch: (id: string) => Promise<{ send?: (o: { content: string }) => Promise<unknown> } | null> }; users: { fetch: (id: string) => Promise<{ send: (content: string) => Promise<unknown> } | null> } };
      const chId = context?.channelId as string | undefined;
      if (chId) {
        const ch = await c.channels.fetch(chId).catch(() => null);
        if (ch?.send) await ch.send({ content: reply.text }).catch(() => {});
      } else {
        const user = await c.users.fetch(userId).catch(() => null);
        if (user) await user.send(reply.text).catch(() => {});
      }
    },
  };
}
