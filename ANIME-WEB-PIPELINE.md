# 🎬 Anime Search & Smart Web Pipeline

## What's New?

### 1. **Anime Search Tool** (`anime_search`)

Automatically finds anime episodes on streaming sites (HiAnime, GogoAnime) and returns direct watch URLs.

**Features:**
- Web search + HTML parsing for episode links
- Supports HiAnime and GogoAnime
- Auto mode tries both sites
- Returns direct streaming URLs

**Usage:**
```javascript
// Example 1: Auto search (tries both sites)
anime_search({
  anime_name: "Dead Account",
  episode: 5
})

// Example 2: Specific site
anime_search({
  anime_name: "One Piece",
  episode: 1050,
  site: "hianime"
})
```

**How it works:**
1. Searches DuckDuckGo for `anime_name episode X site`
2. Finds anime page URL from search results
3. Fetches anime page HTML
4. Parses HTML to locate specific episode link
5. Returns direct watch URL

**Supported Sites:**
- **HiAnime** (hianime.to) - HD quality, fast servers
- **GogoAnime** (gogoanime.by) - Large library, multiple servers

---

### 2. **Smart Web Pipeline** (`smart_web_search`)

Advanced web search that goes beyond basic queries - searches, fetches multiple pages, extracts structured content, and summarizes findings.

**Features:**
- Progressive web search (DuckDuckGo)
- Parallel page fetching (configurable 1-5 pages)
- HTML parsing with Cheerio
- Content extraction (prioritizes article/main content)
- Keyword-based relevance filtering
- Image and link extraction
- Goal-oriented summarization

**Usage:**
```javascript
// Example 1: Research AI models
smart_web_search({
  query: "best AI coding models 2026",
  goal: "Find which AI model is fastest for code completion",
  max_pages: 3
})

// Example 2: Security best practices
smart_web_search({
  query: "Node.js security vulnerabilities",
  goal: "Learn how to prevent SQL injection and XSS attacks",
  max_pages: 5,
  include_images: true
})
```

**Pipeline Steps:**
1. **Search:** DuckDuckGo HTML search (no API needed)
2. **Fetch:** Parallel page fetching with curl + User-Agent
3. **Parse:** Cheerio HTML parsing, removes scripts/ads/nav
4. **Extract:** Prioritizes `<article>`, `<main>`, `.content` elements
5. **Filter:** Extracts sentences matching goal keywords
6. **Summarize:** Combines relevant info from all pages

**Output includes:**
- Title and URL for each page
- Relevant excerpts (filtered by goal keywords)
- Images (if requested)
- Additional resource links
- Next steps suggestions

---

## Architecture

### File Structure
```
src/tools/
├── anime-search.ts          # Anime streaming link finder
├── smart-web-pipeline.ts    # Multi-page web research tool
```

### Dependencies
- **curl** - HTTP requests (already in Kali)
- **grep** - Text parsing (already in Kali)
- **cheerio** - HTML parsing (npm package, now installed)

### Tool Registration
Both tools are automatically registered in:
- `src/cli.ts` (CLI interface)
- `src/dashboard.ts` (Web dashboard)

---

## Why These Tools?

### Anime Search
- **Requested by user** from ChatGPT conversation
- Automates manual browser searching
- Direct integration with streaming sites
- No API keys required

### Smart Web Pipeline
- **Requested by user** from ChatGPT conversation
- Much more powerful than basic `web_search`
- Combines multiple tools into one workflow:
  - `web_search` → find URLs
  - `fetch_page` → get HTML
  - HTML parsing → extract content
  - Summarization → goal-focused results
- Reduces number of tool calls (faster, cheaper)
- Provides structured, actionable information

---

## Comparison

| Feature | `web_search` | `smart_web_search` | `anime_search` |
|---------|-------------|-------------------|----------------|
| Search engine | DuckDuckGo | DuckDuckGo | DuckDuckGo |
| Result type | URLs + snippets | Full page content | Direct watch URLs |
| Pages fetched | 0 | 1-5 (configurable) | 1-2 (per site) |
| HTML parsing | ❌ | ✅ (Cheerio) | ✅ (grep) |
| Content extraction | ❌ | ✅ | ✅ |
| Goal-focused filtering | ❌ | ✅ | ✅ |
| Images | ❌ | ✅ (optional) | ❌ |
| Use case | Quick search | Research/Analysis | Anime episodes |

---

## Example Workflows

### Workflow 1: Find and Watch Anime
```
User: "Find Dead Account episode 5 and play it"

1. anime_search({ anime_name: "Dead Account", episode: 5 })
   → Returns: https://hianime.to/watch/dead-account-12345?ep=67890

2. browser_open_and_read({ url: "https://hianime.to/watch/..." })
   → Opens page, clicks play button
```

### Workflow 2: Research Best AI Model
```
User: "Which AI model is best for coding in 2026?"

1. smart_web_search({
     query: "best AI models for code generation 2026",
     goal: "Compare model speed, accuracy, and pricing",
     max_pages: 5
   })
   → Returns: Structured comparison from 5 tech blogs/benchmarks

2. (AI analyzes results and provides recommendation)
```

### Workflow 3: Security Audit Research
```
User: "Research latest Node.js security vulnerabilities"

1. smart_web_search({
     query: "Node.js security vulnerabilities 2026",
     goal: "Find CVEs and mitigation strategies",
     max_pages: 3
   })
   → Returns: CVE details, exploit info, patch instructions

2. cve_lookup({ cve_id: "CVE-2026-..." })
   → Get detailed CVE info from NVD
```

---

## Testing

### Test Anime Search
```bash
# In OpenPaw CLI or Dashboard:
anime_search({ anime_name: "One Piece", episode: 1 })
```

**Expected Output:**
- HiAnime link: `https://hianime.to/watch/one-piece-100/ep-1`
- GogoAnime link: `https://gogoanime.by/one-piece-episode-1`

### Test Smart Web Pipeline
```bash
smart_web_search({
  query: "Kali Linux penetration testing tools",
  goal: "Find top 10 tools for web pentesting",
  max_pages: 3
})
```

**Expected Output:**
- 3 pages analyzed
- Structured summaries with tool names
- Relevant excerpts about each tool
- Additional resource links

---

## Limitations & Improvements

### Current Limitations
1. **Anime Search:**
   - Depends on HTML structure (may break if sites change)
   - Limited to HiAnime and GogoAnime
   - No video quality selection

2. **Smart Web Pipeline:**
   - Max 5 pages (to avoid long execution times)
   - Keyword filtering is basic (no AI summarization yet)
   - curl-based (no JavaScript rendering)

### Future Improvements
1. **Add more streaming sites** (9anime, AnimixPlay, etc.)
2. **Use AI for better summarization** (LLM-powered content extraction)
3. **Add browser automation fallback** (for JS-heavy sites)
4. **Cache search results** (avoid redundant searches)
5. **Add quality selection** (HD, FHD, 4K)

---

## Credits

- **Anime Search**: Inspired by user request from ChatGPT conversation
- **Smart Web Pipeline**: Designed based on user feedback about AI struggling with web tasks
- **cheerio**: Fast, flexible HTML parsing library
- **DuckDuckGo**: Privacy-focused search engine (no API needed)

---

## Related Tools

- `web_search` - Basic DuckDuckGo search (URLs only)
- `fetch_page` - Fetch single page HTML
- `browser_open_and_read` - Full browser automation
- `browser_session` - Persistent browser with smart element finding
- `extract_video_url` - yt-dlp video extraction
- `play_media` - Play videos with system player
