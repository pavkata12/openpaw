import type { ToolDefinition } from "./types.js";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { load } from "cheerio";

const execAsync = promisify(exec);

/**
 * Smart Web Pipeline - Progressive web search + page parsing
 * Combines search → open pages → extract structured data → summarize
 */

interface WebPipelineArgs {
  query: string;
  goal: string;
  max_pages?: number;
  include_images?: boolean;
}

interface SearchResult {
  url: string;
  title: string;
  snippet: string;
}

interface PageData {
  url: string;
  title: string;
  content: string;
  images: string[];
  links: string[];
}

async function searchDuckDuckGo(query: string, maxResults = 5): Promise<SearchResult[]> {
  try {
    const { stdout } = await execAsync(
      `curl -sL "https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}" | grep -oP '<a class="result__a".*?</a>|<a class="result__snippet".*?</a>'`,
      { timeout: 10000 }
    );
    
    const results: SearchResult[] = [];
    const lines = stdout.split('\n').filter(Boolean);
    
    for (let i = 0; i < lines.length - 1; i += 2) {
      if (results.length >= maxResults) break;
      
      const titleMatch = lines[i].match(/href="([^"]+)"[^>]*>([^<]+)/);
      const snippetMatch = lines[i + 1]?.match(/>([^<]+)</);
      
      if (titleMatch && snippetMatch) {
        results.push({
          url: titleMatch[1],
          title: titleMatch[2].trim(),
          snippet: snippetMatch[1].trim()
        });
      }
    }
    
    return results;
  } catch (error) {
    console.error("DuckDuckGo search failed:", error);
    return [];
  }
}

async function fetchPageContent(url: string): Promise<PageData | null> {
  try {
    const { stdout } = await execAsync(
      `curl -sL -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" "${url}"`,
      { timeout: 15000 }
    );
    
    const $ = load(stdout);
    
    // Remove script, style, nav, footer
    $('script, style, nav, footer, header, .ad, .advertisement').remove();
    
    // Extract structured data
    const title = $('title').text().trim() || $('h1').first().text().trim();
    
    // Get main content (prioritize article, main, or body)
    let content = '';
    const mainContent = $('article, main, .content, .post, .entry').first();
    if (mainContent.length > 0) {
      content = mainContent.text();
    } else {
      content = $('body').text();
    }
    
    // Clean whitespace
    content = content
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim()
      .slice(0, 5000); // Limit to 5000 chars
    
    // Extract images
    const images: string[] = [];
    $('img').each((_, el) => {
      const src = $(el).attr('src');
      if (src && (src.startsWith('http') || src.startsWith('//'))) {
        images.push(src.startsWith('//') ? 'https:' + src : src);
      }
    });
    
    // Extract relevant links
    const links: string[] = [];
    $('a').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.startsWith('http')) {
        links.push(href);
      }
    });
    
    return {
      url,
      title,
      content,
      images: images.slice(0, 5),
      links: links.slice(0, 10)
    };
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return null;
  }
}

function extractRelevantInfo(pages: PageData[], goal: string): string {
  let summary = '';
  
  for (const page of pages) {
    summary += `\n## ${page.title}\n**URL:** ${page.url}\n\n`;
    
    // Extract sentences mentioning key terms from the goal
    const keywords = goal.toLowerCase().split(' ').filter(w => w.length > 3);
    const sentences = page.content.split(/[.!?]\s+/);
    
    const relevant = sentences.filter(s => 
      keywords.some(kw => s.toLowerCase().includes(kw))
    ).slice(0, 5);
    
    if (relevant.length > 0) {
      summary += relevant.join('. ') + '.\n\n';
    } else {
      // Fallback: first 500 chars
      summary += page.content.slice(0, 500) + '...\n\n';
    }
    
    if (page.images.length > 0) {
      summary += `**Images:** ${page.images.slice(0, 2).join(', ')}\n\n`;
    }
  }
  
  return summary;
}

export function createSmartWebPipelineTool(): ToolDefinition {
  return {
    name: "smart_web_search",
    description: `Advanced web search pipeline that searches the web, opens multiple relevant pages, extracts structured content, and summarizes findings based on your goal. Much more powerful than basic web_search. Use when you need comprehensive information from multiple sources. Example: "Find the latest AI models for code generation" or "Research best practices for Node.js security".`,
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g. 'best AI coding models 2026', 'Node.js security best practices')"
        },
        goal: {
          type: "string",
          description: "What you're trying to achieve (helps filter relevant info). E.g. 'Find which AI model is fastest for code completion'"
        },
        max_pages: {
          type: "number",
          description: "Maximum number of pages to fetch and analyze (default: 3, max: 5)"
        },
        include_images: {
          type: "boolean",
          description: "Whether to include image URLs in results (default: false)"
        }
      }
    },
    
    async execute(args: Record<string, unknown>) {
      const query = args.query as string;
      const goal = args.goal as string;
      const maxPages = Math.min((args.max_pages as number) || 3, 5);
      const includeImages = args.include_images as boolean;
      
      // Step 1: Search
      const searchResults = await searchDuckDuckGo(query, maxPages + 2);
      
      if (searchResults.length === 0) {
        return `❌ No search results found for: "${query}"

**Troubleshooting:**
- Try a more specific query
- Check your internet connection
- Try using \`browser_open_and_read\` to manually search`;
      }
      
      // Step 2: Fetch top pages in parallel
      const fetchPromises = searchResults
        .slice(0, maxPages)
        .map(r => fetchPageContent(r.url));
      
      const pages = (await Promise.allSettled(fetchPromises))
        .filter((r): r is PromiseFulfilledResult<PageData | null> => r.status === 'fulfilled')
        .map(r => r.value)
        .filter((p): p is PageData => p !== null);
      
      if (pages.length === 0) {
        return `⚠️ Found search results but couldn't fetch any pages.

**Search Results Found:**
${searchResults.map((r, i) => `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`).join('\n\n')}

**Suggestion:** Try opening these URLs directly with \`browser_open_and_read\` or \`fetch_page\`.`;
      }
      
      // Step 3: Extract relevant info
      const summary = extractRelevantInfo(pages, goal);
      
      return `🔍 **Web Search Pipeline Results**

**Query:** ${query}
**Goal:** ${goal}
**Pages Analyzed:** ${pages.length}/${searchResults.length}

---

${summary}

---

**Additional Resources:**
${searchResults.slice(maxPages).map((r, i) => `${i + 1}. [${r.title}](${r.url})`).join('\n')}

**Next Steps:**
- Use \`browser_open_and_read\` to explore specific pages in detail
- Use \`fetch_page\` to get full HTML if needed
- Use \`anime_search\` if looking for anime episodes`;
    }
  };
}
