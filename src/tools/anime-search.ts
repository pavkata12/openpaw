import type { ToolDefinition } from "./types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

/**
 * Anime Search Tool - Find anime episodes on streaming sites
 * Uses web search + HTML parsing to find direct streaming links
 */

interface AnimeSearchArgs {
  anime_name: string;
  episode: number;
  site?: "hianime" | "gogoanime" | "auto";
}

async function searchWeb(query: string): Promise<string> {
  try {
    // Use DuckDuckGo lite HTML (no JS needed)
    const { stdout } = await execAsync(
      `curl -s "https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}" | grep -oP 'href="\\K[^"]*' | head -20`,
      { timeout: 10000 }
    );
    return stdout;
  } catch {
    return "";
  }
}

async function fetchPage(url: string): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `curl -sL -A "Mozilla/5.0" "${url}"`,
      { timeout: 10000 }
    );
    return stdout;
  } catch {
    return "";
  }
}

function extractHiAnimeLink(html: string, episode: number): string | null {
  // HiAnime structure: data-number="5" or ep=12345
  const epMatch = html.match(new RegExp(`data-number="${episode}"[^>]*data-id="(\\d+)"`));
  if (epMatch) {
    const epId = epMatch[1];
    const animeMatch = html.match(/watch\/([^"?]+)/);
    if (animeMatch) {
      return `https://hianime.to/watch/${animeMatch[1]}?ep=${epId}`;
    }
  }
  
  // Alternative: direct ep link
  const directMatch = html.match(new RegExp(`href="(/watch/[^"]*\\?ep=\\d+)"[^>]*>\\s*${episode}\\s*<`));
  if (directMatch) {
    return `https://hianime.to${directMatch[1]}`;
  }
  
  return null;
}

function extractGogoAnimeLink(html: string, episode: number): string | null {
  // GogoAnime structure: /anime-name-episode-5
  const match = html.match(new RegExp(`href="(/[^"]*-episode-${episode}[^"]*)"`));
  if (match) {
    return `https://gogoanime.by${match[1]}`;
  }
  return null;
}

export function createAnimeSearchTool(): ToolDefinition {
  return {
    name: "anime_search",
    description: `Search for anime episodes on streaming sites (HiAnime, GogoAnime) and return direct streaming link. Use when user asks to find, watch, or play anime episodes. Automatically searches the web, finds the anime page, locates the specific episode, and returns the watch URL. Example: "Find One Piece episode 1050" or "Play Dead Account episode 5 on HiAnime".`,
    parameters: {
      type: "object",
      properties: {
        anime_name: {
          type: "string",
          description: "Name of the anime (e.g. 'Dead Account', 'One Piece', 'Naruto')"
        },
        episode: {
          type: "number",
          description: "Episode number to find"
        },
        site: {
          type: "string",
          description: "Streaming site preference: 'hianime', 'gogoanime', or 'auto' (try both)",
          enum: ["hianime", "gogoanime", "auto"]
        }
      }
    },
    
    async execute(args: Record<string, unknown>) {
      const anime_name = args.anime_name as string;
      const episode = args.episode as number;
      const site = (args.site as string) || "auto";
      
      const results: string[] = [];
      
      // Try HiAnime
      if (site === "hianime" || site === "auto") {
        try {
          const query = `${anime_name} episode ${episode} hianime`;
          const searchResults = await searchWeb(query);
          
          // Find HiAnime link in search results
          const hiAnimeMatch = searchResults.match(/https?:\/\/hianime\.to\/[^\s"]+/);
          if (hiAnimeMatch) {
            const baseUrl = hiAnimeMatch[0].split('?')[0];
            const html = await fetchPage(baseUrl);
            const episodeLink = extractHiAnimeLink(html, episode);
            
            if (episodeLink) {
              results.push(`✅ **HiAnime**: ${episodeLink}`);
            }
          }
        } catch (error) {
          results.push(`⚠️ HiAnime search failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      }
      
      // Try GogoAnime
      if (site === "gogoanime" || site === "auto") {
        try {
          const query = `${anime_name} episode ${episode} gogoanime`;
          const searchResults = await searchWeb(query);
          
          // Find GogoAnime link in search results
          const gogoMatch = searchResults.match(/https?:\/\/gogoanime\.[a-z]+\/[^\s"]+/);
          if (gogoMatch) {
            const baseUrl = gogoMatch[0].split('/episode-')[0];
            const html = await fetchPage(baseUrl);
            const episodeLink = extractGogoAnimeLink(html, episode);
            
            if (episodeLink) {
              results.push(`✅ **GogoAnime**: ${episodeLink}`);
            }
          }
        } catch (error) {
          results.push(`⚠️ GogoAnime search failed: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      }
      
      if (results.length === 0) {
        return `❌ Could not find ${anime_name} Episode ${episode} on any streaming site.

**Manual search suggestions:**
1. Go to https://hianime.to
2. Search for "${anime_name}"
3. Select Episode ${episode}

**Alternative sites:**
- https://gogoanime.by
- https://9anime.to
- https://animixplay.to`;
      }
      
      return `🎬 **Found ${anime_name} - Episode ${episode}**

${results.join('\n\n')}

**How to watch:**
1. Click the link above
2. Press Play ▶️
3. If the video doesn't load, try switching servers (usually HD-1, HD-2, or Vidstream)

**Tip:** Use \`browser_open_and_read\` or \`open_url\` to open the link automatically!`;
    }
  };
}
