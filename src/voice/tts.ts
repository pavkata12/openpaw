export interface TTSAdapter {
  speak(text: string): Promise<Buffer>;
}

export async function createEdgeTTS(voice = "en-US-AriaNeural"): Promise<TTSAdapter> {
  const { EdgeTTS } = await import("edge-tts-universal");
  return {
    async speak(text: string): Promise<Buffer> {
      const tts = new EdgeTTS(text, voice);
      const result = await tts.synthesize();
      return Buffer.from(await result.audio.arrayBuffer());
    },
  };
}
