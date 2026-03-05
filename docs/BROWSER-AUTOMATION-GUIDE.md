# Browser Automation & Streaming Guide

## Overview

OpenPaw now has **enhanced browser control** specifically designed for finding and playing videos/movies/anime from streaming sites. The AI can:

- **Persistent browser sessions** - Browser stays open between commands (no context loss)
- **Smart element finding** - Click/type by text without needing CSS selectors
- **Fullscreen control** - Automatically make videos fullscreen
- **Video player control** - Check if video is playing, pause/resume
- **Multi-step navigation** - Navigate complex sites step-by-step without losing place

## Key Improvements

### 1. Persistent Browser Sessions
The browser now **stays open** between your commands, so the AI can:
- Navigate in multiple steps without starting over
- Remember where it is on a page
- Continue from where it left off

### 2. Smart Element Finding
No more struggling with CSS selectors! The AI can now:
- `smart_search` - Auto-find search boxes and search for content
- `find_and_click` - Click any button/link by its text
- `find_and_type` - Type into inputs by their label/placeholder

### 3. Fullscreen & Video Control
- `fullscreen` - Automatically make videos fullscreen
- `get_video_state` - Check if video is playing/paused

### 4. Increased Persistence
The AI has been configured to:
- **35 max turns** (up from 20) - Can handle longer multi-step tasks
- **Completion verification** - Checks if task is done before stopping
- **Completion reminders** - Reminded after each step to continue until fully done
- **Stronger system prompt** - Explicitly told to NEVER stop until task is complete

## Example Usage

### Simple: Play a YouTube video
```
You: "Play the first Naruto opening on YouTube"

AI will:
1. Open YouTube
2. Search for "naruto opening 1"
3. Click the first video
4. Verify it's playing
5. Reply: "Playing Naruto opening 1"
```

### Complex: Find and watch an anime episode
```
You: "Go to HiAnime and play Demon Slayer season 1 episode 5 in fullscreen"

AI will:
1. Open HiAnime
2. Search for "Demon Slayer"
3. Click on the show
4. Find episode 5
5. Click to play
6. Make it fullscreen
7. Verify video is playing
8. Reply with confirmation
```

### Multi-step navigation
```
You: "Find One Piece episode 1000 and play it"

AI will:
1. Search web for best streaming site
2. Open the site
3. Search for One Piece
4. Navigate to episode 1000
5. Play it
6. Make fullscreen if you want
```

## Available Browser Actions

### Navigation
- `goto` - Open a URL
- `smart_search` - Auto-find search and search for text (no selector needed!)

### Smart Interaction (no selectors needed)
- `find_and_click` - Click element by text: `{"action": "find_and_click", "text": "Play"}`
- `find_and_type` - Type by label: `{"action": "find_and_type", "text": "Search", "value": "naruto"}`

### Video Control
- `fullscreen` - Make video fullscreen: `{"action": "fullscreen"}`
- `get_video_state` - Check playing status: `{"action": "get_video_state"}`

### Traditional Actions (when you need CSS selectors)
- `type` - Type into element: `{"action": "type", "selector": "input", "value": "text"}`
- `click` - Click element: `{"action": "click", "selector": "button"}`
- `double_click` - Double-click
- `hover` - Hover (for dropdowns)
- `scroll` - Scroll: `{"action": "scroll", "direction": "down"/"up"/"top"/"bottom"}`
- `press_key` - Press key: `{"action": "press_key", "key": "Enter"}`
- `wait` - Wait milliseconds: `{"action": "wait", "timeout_ms": 2000}`
- `wait_selector` - Wait for element: `{"action": "wait_selector", "selector": ".video"}`

## Configuration Changes

Your `.env` now has:

```env
# Agent persistence: increased for long multi-step tasks
OPENPAW_AGENT_MAX_TURNS=35
OPENPAW_AGENT_COMPLETION_REMINDER=true
OPENPAW_AGENT_VERIFY_COMPLETION=true
```

These settings ensure the AI:
- Can handle up to 35 steps (enough for complex navigation)
- Is reminded to continue after each tool use
- Verifies task is complete before stopping

## Tips for Best Results

### 1. Be specific but let the AI work
**Good:**
- "Play the first episode of Attack on Titan in fullscreen"
- "Find and play Interstellar movie"
- "Go to Crunchyroll and play the newest One Piece episode"

**Too vague (but AI will ask):**
- "Play something" (what?)
- "Find a show" (which show?)

### 2. Streaming sites work best with persistent session
The AI uses `browser_session` which keeps the browser open. This means:
- You can give it multiple commands for the same site
- It remembers where it is
- No need to start over each time

### 3. If something fails, be patient
The AI will try multiple approaches:
- Different search strategies
- Alternative element finders
- Multiple attempts at clicking

### 4. You can ask it to close the browser
```
"Close the browser session"
```

The AI will use `{"close_session": true}` to clean up.

## Technical Details

### New Tool: `browser_session`
Replaces the old `browser_automate` with:
- **Persistent sessions** using sessionId
- **Headless: false** (you can see what it's doing)
- **Maximized window** (1920x1080)
- **10-minute session TTL** (auto-cleanup)
- **Smart element finding** with multiple strategies

### System Prompt Changes
The AI's core instructions now emphasize:
1. **NEVER stop until task is fully complete**
2. **Use browser_session for all streaming/video tasks**
3. **Navigate in multiple steps if needed**
4. **Don't give up after one failure**

### Example Agent Behavior

**Old behavior:**
```
User: "Play Naruto on YouTube"
AI: web_search("naruto youtube")
AI: "Here's the link: https://youtube.com/watch?v=..."
[STOPS - didn't actually play it!]
```

**New behavior:**
```
User: "Play Naruto on YouTube"
AI: browser_session goto youtube.com
AI: browser_session smart_search "naruto"
AI: browser_session find_and_click "first result"
AI: browser_session get_video_state
AI: "Now playing Naruto on YouTube. Video is at 0:05 / 3:45."
[Task COMPLETE - video is actually playing!]
```

## Troubleshooting

### "Browser tools not loaded"
Run:
```bash
npm install playwright
npx playwright install chromium
```

### "Can't find element"
The AI will try multiple selectors automatically. If it still fails:
- The element might not be visible yet (AI will wait)
- The site might have anti-bot measures
- Try a different site

### "Browser session not responding"
Sessions auto-expire after 10 minutes. Just start a new command and a fresh session will be created.

### "AI stopped too early"
This should be rare now with the new settings. If it happens:
- Check `OPENPAW_AGENT_MAX_TURNS` is set to 35+
- Check `OPENPAW_AGENT_COMPLETION_REMINDER=true`
- Check `OPENPAW_AGENT_VERIFY_COMPLETION=true`

## Supported Streaming Sites

The AI can work with any site that:
- Has a search function
- Uses standard HTML video players
- Doesn't have aggressive anti-bot measures

**Common sites that work:**
- YouTube
- Most anime streaming sites (HiAnime, 9anime, etc.)
- Some movie streaming sites
- Educational video platforms

**May have issues:**
- Netflix (DRM protected)
- Amazon Prime Video (DRM protected)
- Sites with heavy Cloudflare protection

## Future Enhancements

Potential improvements (not yet implemented):
- Remember favorite sites per user
- Auto-detect best quality settings
- Skip intros automatically
- Remember where you left off in series
- Download support for offline watching

---

**Questions?** Ask the AI! It can help you use these features.
