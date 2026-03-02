import type { LLMAdapter } from "./llm.js";
import type { ToolRegistry } from "./tools/types.js";
import { runAgent } from "./agent.js";
import { createSessionManager } from "./session.js";
import { createLaneQueue } from "./lane-queue.js";
import type { InboundMessage, ChannelAdapter, SendContext } from "./channels/types.js";
import { sessionContext } from "./session-context.js";
import type { Config } from "./config.js";

export interface RouterDeps {
  llm: LLMAdapter;
  tools: ToolRegistry;
  config?: Config;
}

export function createRouter(deps: RouterDeps) {
  const { llm, tools, config } = deps;
  const summarizeThreshold = config?.OPENPAW_HISTORY_SUMMARIZE_THRESHOLD ?? 0;
  const keepRaw = config?.OPENPAW_HISTORY_KEEP_RAW ?? 10;
  const sessions = createSessionManager(
    summarizeThreshold > 0
      ? { llm, summarizeThreshold, keepRaw }
      : {}
  );
  const laneQueue = createLaneQueue();
  const channels = new Map<string, ChannelAdapter>();

  function registerChannel(adapter: ChannelAdapter): void {
    channels.set(adapter.name, adapter);
    adapter.onMessage((msg) => handleMessage(adapter.name, msg).catch(() => {}));
  }

  async function handleMessage(adapterName: string, msg: InboundMessage): Promise<void> {
    const sessionKey = sessions.getSessionKey(adapterName, msg.userId);
    const adapter = channels.get(adapterName);
    const context: SendContext | undefined = msg.metadata
      ? { ...msg.metadata, channelId: msg.metadata.channelId as string | undefined }
      : undefined;
    await laneQueue.enqueue(sessionKey, async () => {
      const history = sessions.getHistory(sessionKey);
      const reply = await sessionContext.run({ sessionKey }, () =>
        runAgent(llm, tools, msg.text, history, { voice: msg.metadata?.voice === true })
      );
      await sessions.appendMessage(sessionKey, { role: "user", content: msg.text });
      await sessions.appendMessage(sessionKey, { role: "assistant", content: reply });
      if (adapter) {
        await adapter.send(msg.userId, { text: reply }, context);
      }
    });
  }

  return { registerChannel, handleMessage };
}
