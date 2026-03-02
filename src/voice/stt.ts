import { tmpdir } from "node:os";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

export interface STTAdapter {
  transcribe(audioBuffer: Buffer, mimeType?: string): Promise<string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const _localWhisperCache = new Map<string, (audio: Float32Array | Float64Array) => Promise<any>>();

async function getLocalWhisperPipeline(model: string): Promise<(audio: Float32Array | Float64Array) => Promise<any>> {
  let transcriber = _localWhisperCache.get(model);
  if (transcriber) return transcriber;
  const { pipeline } = await import("@huggingface/transformers");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loaded: (audio: Float32Array | Float64Array) => Promise<any> = (await pipeline("automatic-speech-recognition", model)) as any;
  _localWhisperCache.set(model, loaded);
  return loaded;
}

export function createLocalWhisperSTT(
  model = "Xenova/whisper-tiny.en",
  language?: string
): STTAdapter {
  return {
    async transcribe(audioBuffer: Buffer, mimeType = "audio/wav"): Promise<string> {
      let wavBuffer = audioBuffer;
      if (mimeType.startsWith("audio/webm") || mimeType === "audio/ogg") {
        wavBuffer = await convertToWav(audioBuffer, mimeType);
      }
      const wavefile = await import("wavefile");
      const WaveFileCtor =
        (wavefile as { WaveFile?: new (b?: Buffer) => { toBitDepth(s: string): void; toSampleRate(n: number): void; getSamples(): Float32Array | Float32Array[] | Float64Array } }).WaveFile ??
        (wavefile as { default?: { WaveFile?: new (b?: Buffer) => { toBitDepth(s: string): void; toSampleRate(n: number): void; getSamples(): Float32Array | Float32Array[] | Float64Array } } }).default?.WaveFile;
      if (typeof WaveFileCtor !== "function") throw new Error("WaveFile is not a constructor");
      const wav = new WaveFileCtor(wavBuffer);
      wav.toBitDepth("32f");
      wav.toSampleRate(16000);
      let audioData = wav.getSamples() as Float32Array | Float32Array[] | Float64Array;
      if (Array.isArray(audioData)) {
        if (audioData.length > 1) {
          const ch0 = audioData[0];
          const ch1 = audioData[1];
          const SCALING_FACTOR = Math.sqrt(2);
          for (let i = 0; i < ch0.length; ++i) {
            (ch0 as unknown as number[])[i] =
              (SCALING_FACTOR * (ch0[i] + ch1[i])) / 2;
          }
        }
        audioData = audioData[0];
      }
      const transcriber = await getLocalWhisperPipeline(model);
      const opts = language ? { language, task: "transcribe" as const } : undefined;
      const output = await (opts ? (transcriber as (a: Float32Array | Float64Array, o: object) => Promise<unknown>)(audioData, opts) : transcriber(audioData));
      const text = Array.isArray(output) ? output[0]?.text : output?.text;
      return (text ?? "").trim();
    },
  };
}

export function createElevenLabsSTT(
  apiKey: string,
  modelId = "scribe_v2",
  languageCode?: string
): STTAdapter {
  return {
    async transcribe(audioBuffer: Buffer, mimeType = "audio/wav"): Promise<string> {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
      formData.append("file", blob, "audio.wav");
      formData.append("model_id", modelId);
      if (languageCode) formData.append("language_code", languageCode);
      const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`ElevenLabs STT failed (${res.status}): ${text.slice(0, 200)}`);
      }
      const data = (await res.json()) as { text?: string };
      return (data.text ?? "").trim();
    },
  };
}

async function convertToWav(inputBuffer: Buffer, mimeType: string): Promise<Buffer> {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  const ffmpegPath = require("ffmpeg-static") as string;
  const ffmpeg = require("fluent-ffmpeg");
  const ext = mimeType.includes("webm") ? "webm" : "ogg";
  const inputPath = join(tmpdir(), `openpaw-${randomBytes(8).toString("hex")}.${ext}`);
  const outputPath = join(tmpdir(), `openpaw-${randomBytes(8).toString("hex")}.wav`);
  try {
    writeFileSync(inputPath, inputBuffer);
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setFfmpegPath(ffmpegPath)
        .toFormat("wav")
        .audioFrequency(16000)
        .audioChannels(1)
        .on("end", () => resolve())
        .on("error", reject)
        .save(outputPath);
    });
    const { readFileSync } = await import("node:fs");
    const out = readFileSync(outputPath);
    return out;
  } finally {
    if (existsSync(inputPath)) unlinkSync(inputPath);
    if (existsSync(outputPath)) unlinkSync(outputPath);
  }
}

export function createWhisperSTT(apiKey: string, baseUrl = "https://api.openai.com/v1"): STTAdapter {
  return {
    async transcribe(audioBuffer: Buffer, mimeType = "audio/wav"): Promise<string> {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(audioBuffer)], { type: mimeType });
      formData.append("file", blob, "audio.wav");
      formData.append("model", "whisper-1");
      const res = await fetch(`${baseUrl.replace(/\/$/, "")}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });
      if (!res.ok) throw new Error(`Whisper failed: ${res.status}`);
      const data = (await res.json()) as { text?: string };
      return data.text?.trim() ?? "";
    },
  };
}
