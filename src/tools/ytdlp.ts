import type { ToolDefinition } from "./types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * yt-dlp integration: Extract video info and direct URLs from ANY streaming site
 * Works with YouTube, Twitch, Vimeo, and 1000+ other sites
 */
export function createYtDlpTool(): ToolDefinition {
  return {
    name: "extract_video_url",
    description: `Extract direct video URL and metadata from any streaming site using yt-dlp. Works with YouTube, Twitch, Vimeo, anime sites, and 1000+ platforms. Returns direct video URL that can be played with play_media tool, plus video title, duration, formats available. Use this when you need to download or get direct access to a video.`,
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL of the video page (YouTube, Twitch, etc.)"
        },
        format: {
          type: "string",
          description: "Format preference: 'best' (default), 'worst', 'bestaudio', 'bestvideo', or specific format code like '137'"
        },
        getDirectUrl: {
          type: "boolean",
          description: "Get direct video URL (true, default) or just metadata (false)"
        }
      },
    },
    async execute(args) {
      const url = String(args.url ?? "").trim();
      if (!url) return "Error: url is required.";
      
      const format = String(args.format ?? "best").trim();
      const getDirectUrl = args.getDirectUrl !== false;
      
      try {
        // Check if yt-dlp is installed
        try {
          await execAsync("yt-dlp --version");
        } catch {
          return `Error: yt-dlp not installed. Install it:\n\nWindows: winget install yt-dlp\nLinux: sudo apt install yt-dlp\nMac: brew install yt-dlp\n\nOr: pip install yt-dlp`;
        }
        
        // Get video metadata
        const metadataCmd = `yt-dlp --dump-json --no-playlist "${url}"`;
        const { stdout: metadataJson } = await execAsync(metadataCmd, { timeout: 30000 });
        const metadata = JSON.parse(metadataJson);
        
        const info = {
          title: metadata.title,
          duration: metadata.duration ? `${Math.floor(metadata.duration / 60)}m ${metadata.duration % 60}s` : "unknown",
          uploader: metadata.uploader || metadata.channel,
          views: metadata.view_count?.toLocaleString() || "unknown",
          description: metadata.description?.substring(0, 200) || "",
          thumbnail: metadata.thumbnail,
          formats: metadata.formats?.length || 0
        };
        
        let directUrl = "";
        if (getDirectUrl) {
          // Get direct video URL (no download)
          const urlCmd = `yt-dlp -f "${format}" --get-url --no-playlist "${url}"`;
          const { stdout } = await execAsync(urlCmd, { timeout: 30000 });
          directUrl = stdout.trim().split('\n')[0];  // First URL if multiple
        }
        
        let result = `Video Info:\n`;
        result += `Title: ${info.title}\n`;
        result += `Duration: ${info.duration}\n`;
        result += `Uploader: ${info.uploader}\n`;
        result += `Views: ${info.views}\n`;
        result += `Formats available: ${info.formats}\n`;
        
        if (directUrl) {
          result += `\nDirect Video URL:\n${directUrl}\n\n`;
          result += `You can now:\n`;
          result += `1. Use play_media tool with this URL to play it locally\n`;
          result += `2. Open it in browser with open_url\n`;
          result += `3. Download it with: yt-dlp -f ${format} "${url}"`;
        }
        
        return result;
      } catch (e) {
        const err = e as Error & { stderr?: string };
        if (err.stderr?.includes("Unsupported URL")) {
          return `Error: This site is not supported by yt-dlp. Try using browser_session to navigate and play instead.`;
        }
        return `Error extracting video: ${err.message || String(e)}`;
      }
    },
  };
}

/**
 * Download video tool using yt-dlp
 */
export function createYtDlpDownloadTool(): ToolDefinition {
  return {
    name: "download_video",
    description: `Download video from any streaming site (YouTube, Twitch, etc.) using yt-dlp. Saves to downloads folder. Useful when user wants to save a video offline.`,
    parameters: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "URL of the video to download"
        },
        format: {
          type: "string",
          description: "Format: 'best' (default), 'bestaudio' (audio only), 'bestvideo' (video only), or specific format code"
        },
        outputDir: {
          type: "string",
          description: "Output directory (default: ./downloads)"
        },
        filename: {
          type: "string",
          description: "Custom filename (without extension). Default: video title"
        }
      },
    },
    async execute(args) {
      const url = String(args.url ?? "").trim();
      if (!url) return "Error: url is required.";
      
      const format = String(args.format ?? "best").trim();
      const outputDir = String(args.outputDir ?? "./downloads").trim();
      const filename = args.filename ? String(args.filename).trim() : "%(title)s";
      
      try {
        // Check if yt-dlp is installed
        try {
          await execAsync("yt-dlp --version");
        } catch {
          return `Error: yt-dlp not installed. Install it:\n\nWindows: winget install yt-dlp\nLinux: sudo apt install yt-dlp\nMac: brew install yt-dlp`;
        }
        
        // Download video
        const output = `${outputDir}/${filename}.%(ext)s`;
        const downloadCmd = `yt-dlp -f "${format}" -o "${output}" --no-playlist "${url}"`;
        
        const { stdout, stderr } = await execAsync(downloadCmd, { 
          timeout: 300000,  // 5 minutes max
          maxBuffer: 10 * 1024 * 1024  // 10MB buffer
        });
        
        // Extract filename from output
        const downloadedFile = stdout.match(/\[download\] Destination: (.+)/)?.[1] || 
                               stdout.match(/has already been downloaded/)?.[0] ||
                               "unknown location";
        
        return `Video downloaded successfully!\n\nLocation: ${downloadedFile}\n\nYou can now play it with: play_media tool`;
      } catch (e) {
        const err = e as Error & { stderr?: string };
        return `Download failed: ${err.message || String(e)}\n\n${err.stderr || ""}`;
      }
    },
  };
}
