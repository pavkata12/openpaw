import type { LLMAdapter } from "../llm.js";
import type { ToolRegistry } from "../tools/types.js";
import { runAgent } from "../agent.js";
import type { STTAdapter } from "./stt.js";
import type { TTSAdapter } from "./tts.js";

export interface VoiceLoopDeps {
  llm: LLMAdapter;
  tools: ToolRegistry;
  stt: STTAdapter;
  tts: TTSAdapter;
}

export async function runVoiceLoop(deps: VoiceLoopDeps, onListen: () => Promise<Buffer>, onSpeak: (audio: Buffer) => Promise<void>): Promise<void> {
  const { llm, tools, stt, tts } = deps;
  const history: { role: "user" | "assistant"; content: string }[] = [];

  while (true) {
    const audio = await onListen();
    if (audio.length === 0) break;
    const text = await stt.transcribe(audio);
    if (!text.trim()) continue;
    if (text.toLowerCase() === "exit" || text.toLowerCase() === "quit") break;

    const reply = await runAgent(llm, tools, text, history);
    history.push({ role: "user", content: text });
    history.push({ role: "assistant", content: reply });

    const audioOut = await tts.speak(reply);
    await onSpeak(audioOut);
  }
}
