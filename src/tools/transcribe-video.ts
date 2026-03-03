import { spawnSync } from "node:child_process";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomBytes } from "node:crypto";
import type { Config } from "../config.js";
import type { ToolDefinition } from "./types.js";
import { createLocalWhisperSTT, createElevenLabsSTT } from "../voice/stt.js";

const YT_DLP_TIMEOUT_MS = 120_000; // 2 min for download + extract

function getSTT(config: Config): ReturnType<typeof createLocalWhisperSTT> | ReturnType<typeof createElevenLabsSTT> {
  if (config.OPENPAW_STT_PROVIDER === "elevenlabs" && config.ELEVENLABS_API_KEY) {
    return createElevenLabsSTT(
      config.ELEVENLABS_API_KEY,
      config.ELEVENLABS_STT_MODEL_ID,
      config.ELEVENLABS_STT_LANGUAGE_CODE
    );
  }
  return createLocalWhisperSTT(config.OPENPAW_STT_MODEL, config.OPENPAW_STT_LANGUAGE);
}

/**
 * Transcribe a video or audio URL (YouTube, direct link, etc.) using yt-dlp to get audio and the configured STT.
 * Returns the transcript so the agent (or user) can summarize. Requires yt-dlp installed.
 */
export function createTranscribeVideoTool(config: Config): ToolDefinition {
  let stt: ReturnType<typeof createLocalWhisperSTT> | null = null;
  function getSTTLazy() {
    if (!stt) stt = getSTT(config);
    return stt;
  }

  return {
    name: "transcribe_video",
    description:
      "Transcribe speech from a video or audio URL (YouTube, Vimeo, direct link). Uses yt-dlp to get audio and STT to transcribe. Returns the transcript; you can then summarize it. Requires yt-dlp installed (pip install yt-dlp or https://github.com/yt-dlp/yt-dlp).",
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "Video or audio URL (e.g. https://www.youtube.com/watch?v=..., or direct .mp3/.m4a link)",
        },
      },
    },
    async execute(args) {
      const rawUrl = String(args.url ?? "").trim();
      if (!rawUrl) return "Error: url is required (e.g. a YouTube or direct audio/video link).";

      let url: URL;
      try {
        url = new URL(rawUrl);
      } catch {
        return "Error: invalid URL.";
      }

      const outPath = join(tmpdir(), `openpaw-video-${randomBytes(8).toString("hex")}.wav`);
      const proc = spawnSync(
        "yt-dlp",
        ["-x", "--audio-format", "wav", "-o", outPath, "--no-warnings", "--quiet", rawUrl],
        { timeout: YT_DLP_TIMEOUT_MS, encoding: "utf-8" }
      );
      if (proc.error) {
        const msg = proc.error.message;
        if (msg.includes("ENOENT") || msg.includes("not found") || msg.includes("spawn yt-dlp")) {
          return "yt-dlp is not installed or not in PATH. Install it: pip install yt-dlp or see https://github.com/yt-dlp/yt-dlp";
        }
        if (msg.includes("timed out")) {
          return `Download timed out after ${YT_DLP_TIMEOUT_MS / 1000}s. Try a shorter clip or check the URL.`;
        }
        return `Failed to run yt-dlp: ${msg.slice(0, 200)}`;
      }
      if (proc.status !== 0) {
        const stderr = (proc.stderr || "").slice(0, 300);
        return `yt-dlp failed (exit ${proc.status}). ${stderr || "Check the URL and that yt-dlp supports this site."}`;
      }

      if (!existsSync(outPath)) {
        return "yt-dlp did not produce an audio file. Check the URL and that yt-dlp supports this site.";
      }

      try {
        const buffer = readFileSync(outPath);
        const transcript = await getSTTLazy().transcribe(buffer, "audio/wav");
        unlinkSync(outPath);
        return transcript || "(No speech detected in the audio.)";
      } catch (e) {
        if (existsSync(outPath)) try { unlinkSync(outPath); } catch { /* ignore */ }
        return `Transcription failed: ${e instanceof Error ? e.message : String(e)}`;
      }
    },
  };
}
