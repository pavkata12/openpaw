# OpenPaw 🐾

**Your self-hosted AI assistant — built for Kali Linux, full control of your machine.**

OpenPaw is a comprehensive AI automation framework: an AI that runs on your machine, uses your LLM (OpenAI, Ollama, or any OpenAI-compatible API), and can **control everything** - shell commands, browser, mouse/keyboard, system automation. Primary platform: **Kali Linux**. No vendor lock-in, no mandatory cloud.

---

## 🎯 Why OpenPaw?

- **🐉 Kali Linux first** — Designed for penetration testers and security professionals
- **🖥️ Full system control** — Computer Use API: screen, mouse, keyboard automation
- **🧠 48 Professional tools** — From pentesting to browser automation to AI suggestions
- **💬 Chat History** — Persistent conversations with full context memory
- **⚙️ GUI Configuration** — Web dashboard for all settings (no more .env editing!)
- **🎙️ Voice Control** — Full voice interface for accessibility
- **🔧 13 Pentesting Tools** — Nuclei, SQLMap, Metasploit, Hydra, and more
- **📊 Professional Reports** — Generate PDF/HTML/Markdown reports
- **🌐 Browser Automation** — Playwright-powered with stealth mode
- **🎨 Modern UI** — Beautiful web dashboard with dark/light themes

---

## ⚡ Quick Start (Automated Installation)

### Linux/Kali:
```bash
git clone https://github.com/pavkata12/openpaw.git
cd openpaw
chmod +x install-linux.sh
./install-linux.sh
```

### Windows:
```powershell
git clone https://github.com/pavkata12/openpaw.git
cd openpaw
.\install-windows.ps1
```

### macOS:
```bash
git clone https://github.com/pavkata12/openpaw.git
cd openpaw
chmod +x install-macos.sh
./install-macos.sh
```

**The installer will:**
- ✅ Install Node.js (if needed)
- ✅ Install system dependencies (xdotool, scrot/alternatives, imagemagick)
- ✅ Install pentesting tools (optional prompt)
- ✅ Build TypeScript
- ✅ Create data directories
- ✅ Download PEASS scripts (LinPEAS, WinPEAS)
- ✅ Run system health check

See [INSTALL.md](INSTALL.md) for manual installation.

---

## 🚀 Features


### 🎨 Modern Web Dashboard
- **Chat History UI** - View, switch, rename, delete past conversations
- **Settings GUI** - Configure everything from the web interface
- **Voice Chat** - Browser-based speech interface
- **Task Scheduler** - Manage scheduled AI tasks
- **Audit Log** - Track all tool executions
- **Engagement Manager** - Organize pentesting engagements

### 🖥️ Computer Use API (Anthropic Claude-style)
- **Full Desktop Screenshots** - Capture entire screen
- **Mouse Control** - Click, move, drag at any coordinates
- **Keyboard Control** - Type text, press keys
- **Cross-platform** - Windows (PowerShell), macOS (cliclick), Linux (xdotool)
- **Vision Integration** - AI can see and interact with desktop

### 🔐 Pentesting Tools (13 integrated)
- **Vulnerability Scanning** - Nuclei
- **Web Enumeration** - Gobuster, Ffuf
- **Web Exploitation** - SQLMap, WPScan
- **Privilege Escalation** - LinPEAS, WinPEAS, enum4linux
- **Password Attacks** - Hashcat, Hydra
- **Exploitation** - Metasploit search & info
- **AI Exploit Suggestions** - Smart recommendations

### 📊 Professional Reporting
- **Create Reports** - Structured pentest reports
- **Add Findings** - Track vulnerabilities with severity
- **Export Formats** - PDF, HTML, Markdown
- **CVSS Calculator** - Automated scoring

### 🔍 Intelligence & OSINT
- **Vulnerability Databases** - CVE lookup (NVD), Exploit-DB search
- **OSINT Tools** - WHOIS, DNS enum, subdomain finder, email harvester
- **Tech Detection** - Identify technologies on targets
- **Custom Wordlists** - Generate and mutate passwords

### 🌐 Enhanced Browser Automation
- **Playwright Integration** - Full browser control
- **Stealth Mode** - Anti-bot detection
- **Persistent Sessions** - Cookies and state preserved
- **Vision Click** - GPT-4V/Claude 3 element finding
- **Video Control** - YouTube, streaming platforms
- **Smart Search** - Find elements by description

### 💾 Session & Memory Management
- **Persistent Chat History** - All conversations saved
- **Context Awareness** - AI remembers past conversations
- **Session Switching** - Continue any previous chat
- **Auto-summarization** - Long conversations compressed
- **TTL Management** - Configurable expiration

### ⚡ Advanced Agent Features
- **Smart Error Recovery** - Auto-retry with exponential backoff
- **Task Checkpointing** - Resume interrupted work
- **Parallel Tool Execution** - Multiple tools at once
- **Completion Verification** - Ensures tasks finish
- **Workflow Learning** - Records successful patterns
- **Tool Result Caching** - Faster repeated operations
- **Real-time Streaming** - SSE for live updates

---

## 🛠️ System Requirements

### Minimum:
- **Node.js** 18+ (installer handles this)
- **RAM** 2GB+ (4GB+ recommended for LLM)
- **Disk** 500MB for OpenPaw + space for LLM

### For Computer Use API:
- **Linux**: xdotool, scrot (or gnome-screenshot/maim), imagemagick
- **macOS**: cliclick, screencapture (built-in)
- **Windows**: PowerShell (built-in)

### For Pentesting Tools (optional):
- Kali Linux or install manually: nmap, nuclei, gobuster, sqlmap, etc.

---

## 📋 Commands

1. **Node 20+**: `node -v` — if older: `sudo apt update && sudo apt install -y nodejs` or [NodeSource](https://github.com/nodesource/distributions) / nvm.
2. **Create `.env`** (not in git):
   ```bash
   cp .env.example .env
   ```
3. Edit `.env`: set your LLM (e.g. OpenRouter + free model, or Ollama).
   - Easiest free: [openrouter.ai/keys](https://openrouter.ai/keys) → `OPENPAW_LLM_BASE_URL=https://openrouter.ai/api/v1`, `OPENPAW_LLM_MODEL=moonshotai/kimi-k2:free`, `OPENPAW_LLM_API_KEY=sk-or-v1-...`
   - Local: install Ollama, run `ollama run llama3.2`, use defaults.
4. Run:
   ```bash
   npm install && npm run build
   npm run start:cli
   ```
5. On **Kali/Linux**, the shell tool has **full control by default**: the agent can run any command (e.g. `nmap`, `apt`, `systemctl`, custom scripts). Set `OPENPAW_SHELL_FULL_CONTROL=false` in `.env` to restrict to an allowlist.

**Kali packages (optional, for built-in tools):** `sudo apt install -y nmap nikto wifite` (wireless tools need a Wi‑Fi interface). For brute-force via run_script: `hydra`, `hashcat`, `john`. See [docs/kali-commands.md](docs/kali-commands.md) for examples.

**Recommended local model (Ollama):** `ollama run llama3.2` or `ollama run mistral`; set in `.env`: `OPENPAW_LLM_BASE_URL=http://localhost:11434/v1`, `OPENPAW_LLM_MODEL=llama3.2`.

**Example prompts (recon / web / wireless):**
- *"Full recon on 192.168.1.0/24"* — uses nmap_scan (or run_script with recon.sh).
- *"Scan the web server at http://192.168.1.10"* — uses nikto_scan.
- *"List nearby Wi‑Fi networks"* — uses wireless_scan (or shortcut `/wireless`).
- *"Quick scan on 10.0.0.1"* — nmap quick scan.
- Shortcuts in any channel: `/recon 192.168.1.0/24`, `/webscan https://target`, `/wireless`.

**Diagnostics**: `npm run build && node dist/cli.js doctor` — then `npm run test:llm`.  
**Build tools** (if Discord/native deps fail): `sudo apt install build-essential python3`.

## Quick start (other platforms)

On **Windows** or **macOS**, shell commands are sandboxed by default (allowlist). For full control set in `.env`:

```
OPENPAW_SHELL_FULL_CONTROL=true
```

- **OpenRouter + Kimi K2 (free)**: Get key at [openrouter.ai/keys](https://openrouter.ai/keys), set `OPENPAW_LLM_BASE_URL`, `OPENPAW_LLM_MODEL`, `OPENPAW_LLM_API_KEY` in `.env`.
- **Ollama** (local): [ollama.com](https://ollama.com), `ollama run llama3.2`, use defaults.
- **OpenAI**: `OPENPAW_LLM_BASE_URL=https://api.openai.com/v1`, `OPENPAW_LLM_MODEL=gpt-4o-mini`, `OPENPAW_LLM_API_KEY=sk-...`
- **Kimi (Moonshot)**: Key at [platform.moonshot.ai](https://platform.moonshot.ai/console/api-keys), `api.moonshot.ai/v1` + `moonshot-v1-32k`


| Command | Description |
|---------|-------------|
| `npm run dashboard` | **Web dashboard** on http://localhost:3780 (chat, voice, settings, tasks, audit) |
| `npm run start:cli` | Interactive chat in the terminal |
| `npm run voice` | Start dashboard + open voice chat |
| `npm run gateway` | Multi-channel mode (CLI + Discord/Telegram if configured) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Same as start:cli |
| `openpaw doctor` | Validate config and system health |
| `openpaw backup create [name]` | Create backup |
| `openpaw backup list` | List backups |
| `openpaw backup restore <name>` | Restore backup |
| `openpaw init` | Create data directories and example scripts |
| `openpaw use <name>` | Switch to named workspace/engagement |

---

## ⚙️ Configuration

### Web Dashboard (Recommended)
1. Start dashboard: `npm run dashboard`
2. Open: http://localhost:3780
3. Click "⚙️ Settings"
4. Configure everything in the GUI!

### Manual Configuration (.env)

Still supported! Create `.env` from `.env.example`:


### Key Environment Variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENPAW_LLM_BASE_URL` | OpenAI-compatible API base URL | `http://localhost:11434/v1` (Ollama) |
| `OPENPAW_LLM_MODEL` | Model name | `llama3.2` |
| `OPENPAW_LLM_API_KEY` | API key (optional for Ollama) | — |
| `OPENPAW_DATA_DIR` | Directory for memory and data | `./.openpaw` |
| `OPENPAW_WORKSPACE` | Root directory for code tools | `.` |
| `OPENPAW_SHELL_FULL_CONTROL` | Allow any shell command | `true` on Linux, `false` elsewhere |
| `OPENPAW_AGENT_MAX_TURNS` | Max tool-calling turns per request | `100` (increased for long tasks) |
| `OPENPAW_AGENT_COMPLETION_REMINDER` | Inject reminders to complete tasks | `true` |
| `OPENPAW_AGENT_VERIFY_COMPLETION` | Verify task completion | `true` |
| `OPENPAW_SESSION_TTL_HOURS` | Session expiration time | `24` |
| `OPENPAW_AUDIT_LOG` | Enable tool execution logging | `false` |
| `OPENPAW_ACCESSIBILITY_MODE` | Voice-first accessibility mode | `false` |
| `OPENPAW_DASHBOARD_TOKEN` | Dashboard auth token (optional) | — |

See [Configuration Guide](docs/configuration.md) for all 40+ variables.

---

## 🎯 What Can OpenPaw Do?

### 🔐 Penetration Testing
```
You: Run full recon on 192.168.1.0/24
AI: *runs nmap scan* → *enumerates services* → *suggests exploits* → *generates report*
```

### 🌐 Browser Automation
```
You: Find a tutorial on React hooks and open it
AI: *searches* → *finds best result* → *opens in browser* → *can interact with page*
```

### 🖥️ System Control
```
You: Take a screenshot and tell me what's on my screen
AI: *captures desktop* → *analyzes with vision* → "You have 3 terminal windows open..."
```

### 💬 Conversation Memory
```
You: What did we discuss yesterday?
AI: *loads conversation history* → "We worked on the Python script for..."
```

### 📊 Professional Reports
```
You: Create a pentest report for the scan we just did
AI: *creates structured report* → *adds findings* → *exports to PDF*
```

---

## 📚 Documentation

- **[INSTALL.md](INSTALL.md)** - Detailed installation guide
- **[BEATS-OPENCLAW.md](BEATS-OPENCLAW.md)** - Feature comparison with OpenClaw
- **[PENTESTING-TOOLS-COMPLETE.md](PENTESTING-TOOLS-COMPLETE.md)** - Pentesting guide
- **[COMPLETE-SYSTEM.md](COMPLETE-SYSTEM.md)** - System architecture
- **[CHAT-HISTORY-COMPLETE.md](CHAT-HISTORY-COMPLETE.md)** - Chat history features
- **[CONFIG-GUI-COMPLETE.md](CONFIG-GUI-COMPLETE.md)** - GUI configuration guide
- **[KALI-SCREENSHOT-FIX.md](KALI-SCREENSHOT-FIX.md)** - Screenshot tool troubleshooting
- **[ROADMAP.md](ROADMAP.md)** - Future plans
- **[KALI-AGI-PLAN.md](KALI-AGI-PLAN.md)** - Kali tools integration plan

---

## 🏗️ Architecture

```
src/
  config.ts           # Configuration management
  config-manager.ts   # JSON-based config (replaces .env)
  llm.ts             # OpenAI-compatible chat client + ReAct fallback
  agent.ts           # Agent loop (LLM + tools)
  agent/
    react.ts         # ReAct parser for non-tool-calling models
  cli.ts             # CLI interface
  router.ts          # Message routing + Lane Queue
  session.ts         # Session management
  session-store.ts   # Persistent session storage
  streaming.ts       # SSE streaming support
  tool-cache.ts      # Tool result caching
  checkpoint.ts      # Task checkpointing
  error-recovery.ts  # Smart error handling
  dashboard.ts       # Web dashboard + API
  tools/
    types.ts         # Tool definitions
    registry.ts      # Tool registration
    memory.ts        # remember, recall
    shell.ts         # run_shell
    code.ts          # read_file, write_file, list_dir, search_in_files, apply_patch
    browser.ts       # Browser automation (basic)
    browser-enhanced.ts  # Browser automation (advanced with stealth)
    screenshot.ts    # Screen capture + vision_click
    computer-use.ts  # Computer Use API (mouse, keyboard, desktop screenshots)
    ytdlp.ts         # Video extraction and download
    workflow-memory.ts  # Workflow learning
    pentest/         # 13 pentesting tools
      nuclei.ts      # Vulnerability scanner
      sqlmap.ts      # SQL injection
      metasploit.ts  # Exploitation framework
      gobuster.ts    # Directory/DNS fuzzing
      hydra.ts       # Password cracker
      hashcat.ts     # Hash cracker
      wpscan.ts      # WordPress scanner
      ffuf.ts        # Web fuzzer
      linpeas.ts     # Linux privilege escalation
      winpeas.ts     # Windows privilege escalation
      enum4linux.ts  # SMB enumeration
    reporting.ts     # Report generation
    vuln-database.ts # CVE/Exploit-DB lookup
    osint.ts         # OSINT tools
    wordlist-generator.ts  # Custom wordlists
    system-check.ts  # Tool verification
  exploit-suggestion.ts  # AI-powered exploit suggestions
  channels/
    cli.ts           # CLI channel
    discord.ts       # Discord adapter
    telegram.ts      # Telegram adapter
    types.ts         # Channel interfaces
  voice/
    stt.ts           # Speech-to-text (Whisper, ElevenLabs)
    tts.ts           # Text-to-speech
    voice-loop.ts    # Voice interaction loop
  views/
    index.html       # Main dashboard
    settings.html    # Settings GUI
    settings.js      # Settings frontend
    chat-history.js  # Chat history manager
```

---

## 🔧 Extending OpenPaw

### Add Custom Tools

```typescript
import { ToolDefinition } from "./tools/types.js";
import { createToolRegistry } from "./tools/registry.js";

const registry = createToolRegistry();

const myTool: ToolDefinition = {
  name: "my_custom_tool",
  description: "Does something awesome",
  parameters: {
    type: "object",
    properties: {
      input: { type: "string", description: "Some input" }
    },
    required: ["input"]
  },
  async execute(args) {
    // Your logic here
    return "Result!";
  }
};

registry.register(myTool);
```

### Add Custom Channels

```typescript
import { runAgent } from "./agent.js";
import { createLLM } from "./llm.js";
import { createToolRegistry } from "./tools/registry.js";

const llm = createLLM(config);
const registry = createToolRegistry();

// Your channel logic
async function handleMessage(userId: string, text: string) {
  const reply = await runAgent(llm, registry, text, [], {
    maxTurns: 20
  });
  
  // Send reply back to your channel
  await yourChannel.send(userId, reply);
}
```

---

## 🎨 Screenshots

### Web Dashboard
![Dashboard](docs/screenshots/dashboard.png)

### Chat History
![Chat History](docs/screenshots/chat-history.png)

### Settings GUI
![Settings](docs/screenshots/settings.png)

### Voice Interface
![Voice](docs/screenshots/voice.png)

---

## ♿ Accessibility

**Full voice control** for blind users:

1. **Setup** (one-time): Someone helps configure `.env` and start `npm run dashboard`
2. **Use**: Open http://localhost:3780/voice in browser with screen reader
3. **Talk**: Speak your requests, AI responds with TTS
4. **Hands-free**: AI acts as your "hands and eyes" on the computer

Enable: `OPENPAW_ACCESSIBILITY_MODE=true`

AI can:
- ✅ Open websites and read content
- ✅ Search and find information
- ✅ Play media (YouTube, local files)
- ✅ Read and send emails (if configured)
- ✅ Run system commands
- ✅ Control desktop (with Computer Use API)

**Telegram Alternative**: Even easier - just send voice messages to the bot!

---

## 🆚 OpenPaw vs OpenClaw

See [BEATS-OPENCLAW.md](BEATS-OPENCLAW.md) for detailed comparison.

### OpenPaw Advantages:
- ✅ Computer Use API (screen/mouse/keyboard)
- ✅ 48 professional tools vs 24
- ✅ 13 pentesting tools integrated
- ✅ Chat history UI with persistence
- ✅ GUI configuration dashboard
- ✅ Professional report generation
- ✅ AI exploit suggestions
- ✅ OSINT tools built-in
- ✅ Video handling (yt-dlp)
- ✅ Stealth browser automation
- ✅ Tool result caching
- ✅ Smart error recovery
- ✅ Task checkpointing
- ✅ Workflow learning
- ✅ Real-time streaming

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- Inspired by [OpenClaw](https://github.com/OpenClaw/openclaw)
- Built for the Kali Linux community
- Powered by OpenAI-compatible LLMs

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/pavkata12/openpaw/issues)
- **Discussions**: [GitHub Discussions](https://github.com/pavkata12/openpaw/discussions)
- **Documentation**: See `docs/` folder

---

**OpenPaw - Your AI assistant for everything. Built for power users. Open source forever.** 🐾✨

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENPAW_LLM_BASE_URL` | OpenAI-compatible API base URL | `http://localhost:11434/v1` (Ollama) |
| `OPENPAW_LLM_MODEL` | Model name | `llama3.2` |
| `OPENPAW_LLM_API_KEY` | API key (optional for Ollama) | — |
| `OPENPAW_LLM_2_BASE_URL` | Second model base URL (dual-agent mode). When set with `OPENPAW_LLM_2_MODEL`, the primary agent gets **delegate_to_agent** to hand off subtasks to the second model. | — |
| `OPENPAW_LLM_2_MODEL` | Second model name (dual-agent). | — |
| `OPENPAW_LLM_2_API_KEY` | API key for second model (optional; falls back to `OPENPAW_LLM_API_KEY`). | — |
| `OPENPAW_DATA_DIR` | Directory for memory and data | `./.openpaw` |
| `OPENPAW_SHELL_FULL_CONTROL` | Allow any shell command (no allowlist). On **Linux** default is `true`; on Windows/macOS default is `false`. | `true` on Linux, `false` elsewhere |
| `OPENPAW_SHELL_TIMEOUT` | Shell command timeout (ms). Full control: 120s on Linux, 60s on Windows. | — |
| `OPENPAW_WORKSPACE` | Root directory for code tools (read_file, write_file, list_dir, search_in_files, apply_patch). Paths are relative to this. | `.` (current directory) |
| `OPENPAW_AUDIT_LOG` | When true, log every tool call to an audit file (see `OPENPAW_AUDIT_LOG_PATH`). | `false` |
| `OPENPAW_AUDIT_LOG_PATH` | Path to audit log file. | `{OPENPAW_DATA_DIR}/audit.log` |
| `OPENPAW_SCRIPTS_DIR` | Directory for run_script tool (predefined .sh scripts). | `{OPENPAW_DATA_DIR}/scripts` |
| `OPENPAW_DANGER_APPROVAL` | When true, run_shell commands that match `OPENPAW_DANGER_PATTERNS` require user to reply "approve" before running. | `false` |
| `OPENPAW_DANGER_PATTERNS` | Comma-separated substrings (e.g. `sudo,rm -rf,msfconsole`). Commands containing any require approval when OPENPAW_DANGER_APPROVAL=true. | — |
| `OPENPAW_LLM_RETRY_COUNT` | Retries on LLM timeout or 5xx (exponential backoff). | `2` |
| `OPENPAW_LLM_RETRY_DELAY_MS` | Delay before first retry (ms); doubles each attempt. | `2000` |
| `OPENPAW_PACK` | Skill pack name: `recon`, `wireless`, `web`, or `full`. When set, only base tools (remember, recall, run_shell) + pack tools are loaded. Optional `packs.json` in data dir overrides defaults. | — (all tools) |
| `OPENPAW_SYSTEM_PROMPT_MODE` | How to use workspace system prompt file: `default` = ignore; `append` = base prompt + file content; `replace` = only file content. File: `SOUL.md` or `.openpaw/system-prompt.md` in workspace. | `default` |
| `OPENPAW_SESSION_TTL_HOURS` | Session TTL in hours; expired sessions are not loaded or saved. | `24` |
| `OPENPAW_SESSION_MAX_HISTORY` | Max messages per session before trimming (and before summarization if enabled). | `50` |
| `OPENPAW_ACCESSIBILITY_MODE` | When true, the agent is instructed to act as the user's hands and eyes: do anything doable on the computer (run commands, browse, read/write files), describe actions briefly. For users who cannot see the screen or use the mouse; use with voice (`npm run voice` or Telegram voice). Limitation: visual captcha (no audio) cannot be solved. | `false` |
| `OPENPAW_AGENT_MAX_TURNS` | Max tool-calling turns per request (plan + execute until done or this limit). Default 20; increase (e.g. 25–30) for long-horizon tasks so the agent can complete multi-step requests without hitting the limit. | `20` |
| `OPENPAW_AGENT_COMPLETION_REMINDER` | When true (default), after each tool result a short reminder is injected so the agent continues until the task is fully done (reduces early stopping: e.g. "found the link" but not opening it). Set to `false` to disable. | `true` |
| `OPENPAW_AGENT_VERIFY_COMPLETION` | When true, when the agent returns a final reply we ask the LLM once "Is the user's request fully satisfied?" (YES/NO). If NO, the agent continues for another turn. Adds one extra LLM call per completion; use for important long tasks. | `false` |

## Long-horizon tasks (дълги задачи до довършване)

The agent is instructed to **not stop until the request is fully done**: e.g. if you ask to "find a film and play it", it must both find and play it, not just reply with the link. To support this we use: (1) a stronger system prompt (wrong: one step then reply; right: all steps then final answer), (2) **completion reminder** after each tool result (injected text reminding the model to continue if more steps are needed), (3) **configurable max turns** (`OPENPAW_AGENT_MAX_TURNS`, default 20), (4) optional **verify completion** (`OPENPAW_AGENT_VERIFY_COMPLETION=true`): when the agent says it's done, we ask the LLM once "Is the user's request fully satisfied?" (YES/NO); if NO, the agent gets one more turn. So the agent can run many steps until the task is complete or the turn limit is reached. If you see "I hit the turn limit", increase `OPENPAW_AGENT_MAX_TURNS`.

## Accessibility (достъпност)

**Ако си сляп, клавиатурата и екрана не ти трябват за ползване** — влизаш само с **глас**. OpenPaw може да се управлява изцяло чрез говор: казваш какво искаш, агентът го прави (отваря сайтове, чете поща, пуска команди, обобщава клипове) и ти отговаря с глас (TTS) или като текст в Telegram. Ти не пипаш нищо след като приложението е стартирано.

- **Само с глас (без клавиатура, без екран):**
  - **Telegram** (най-удобно): Настрой бота веднъж (някой ти помага да сложиш `OPENPAW_TELEGRAM_BOT_TOKEN` в `.env` и да стартираш `npm run gateway`). След това от телефона изпращаш **гласови съобщения** на бота — той транскрибира, агентът отговаря с текст (може да го четеш със screen reader или да го слушаш ако има TTS в Telegram).
  - **Уеб глас**: `npm run voice` — някой отваря веднъж в браузъра http://localhost:3780/voice (или ти с screen reader). После говориш в микрофона, отговорът се чете с TTS — без клавиатура.
- **Стартиране на приложението**: Клавиатурата ти трябва само веднъж — да се пусне OpenPaw (или някой да го пусне вместо теб). Може да направиш **shortcut** или **автостарт при включване** на компютъра (напр. Windows: Планировчик на задачи; Linux: systemd service), така че след рестарт да не пипаш нищо — само отваряш Telegram и говориш.
- **Accessibility mode**: В `.env` сложи `OPENPAW_ACCESSIBILITY_MODE=true`. Агентът получава инструкция да е твоите „ръце и очи“: да прави всичко, което поискаш (сайт, поща, команди), да описва накратко всяко действие и да довършва задачата. Всичко, което може да се прави на този компютър с команди и tools, агентът може да го направи вместо теб.
- **Ограничение**: Визуален captcha (без аудио вариант) агентът не може да реши; ще ти каже и ще предложи алтернатива (друг сайт или да помолиш някой веднъж).

Обобщение: **сляп потребител ползва само глас** — без да вижда клавиатура или екран. Стартираш приложението веднъж (или с автостарт), после всичко е чрез глас в Telegram или в браузъра.

## Какво може да прави агентът (при пълни tools)

С всички вградени tools агентът може да прави почти всичко, което човек би направил на компютъра. Примери:

| Искаш | Как го прави агентът | Tools |
|-------|----------------------|--------|
| **Да пусне филм или музика** | От линк (YouTube, Netflix, Spotify) отваря в браузъра; от файл на диска (филм.mp4, песен.mp3) пуска с плеъра по подразбиране. | `play_media` (url или path), `open_url` |
| **Да търси документи** | Търси по име или съдържание в папка с документи. Задай `OPENPAW_WORKSPACE` на папката (напр. Документи) — агентът използва `list_dir` и `search_in_files`. | `list_dir`, `search_in_files`, `read_file` |
| **Да пазарува онлайн** | Влиза в сайта, търси продукт, добавя в кошница, попълва формуляри до стъпка плащане (плащането обикновено е ръчно за сигурност). | `browser_open_and_read`, `browser_automate`, `web_search` |
| **Да чете поща / календар** | Чете и търси в поща, показва събития. | `email_search`, `calendar_list`, `calendar_add` |
| **Да отвори сайт и да намери нещо** | Отваря страницата, вижда линкове и текст, избира най-подходящото (клип, статия), отваря или транскрибира и обобщава. | `browser_open_and_read`, `transcribe_video`, `fetch_page` |
| **Да пуска команди / скриптове** | Изпълнява всяка команда (при full control) или предопределени скриптове. | `run_shell`, `run_script` |

За **достъпност** (само с глас): включи `OPENPAW_ACCESSIBILITY_MODE=true` и не използвай skill pack (или използвай `OPENPAW_PACK=full`) — така агентът има всички tools и може да пуска филми, да търси документи и да пазарува вместо теб.
>>>>>>> Incoming (Background Agent changes)

## Built-in tools

- **remember** — Store a fact for the user (key-value).
- **recall** — Recall a stored fact by key.
- **delegate_to_agent** — (Only when `OPENPAW_LLM_2_BASE_URL` and `OPENPAW_LLM_2_MODEL` are set.) Delegate a subtask to the second model; it runs with the same tools (except delegate) and returns its reply. Use for parallel work or a second perspective (e.g. one model plans, the other runs nmap and summarizes).
- **run_shell** — Run shell commands. On **Kali/Linux**: full control by default (any command, `/bin/bash`, 2 min timeout). On Windows/macOS: sandboxed allowlist unless `OPENPAW_SHELL_FULL_CONTROL=true`. Supports `cwd` when full control is on. With `OPENPAW_DANGER_APPROVAL=true`, commands matching `OPENPAW_DANGER_PATTERNS` require the user to reply "approve" before running.
- **run_script** — Run a predefined script from `OPENPAW_SCRIPTS_DIR` (default: `.openpaw/scripts`). Use for recon, wireless, or web scan workflows. Example scripts and Kali commands: [docs/kali-commands.md](docs/kali-commands.md).
- **nmap_scan** — Run nmap on a target (IP, CIDR, hostname). `scanType`: quick (default), full, or udp.
- **wireless_scan** — Scan for Wi‑Fi networks (wifite). Optional `interface` (default wlan0).
- **wireless_attack** — Run wifite attack: `attackType` wpa/wep/wps, optional wordlist and bssid.
- **nikto_scan** — Web vulnerability scan with nikto; pass `url` (e.g. http://target:80).
- **play_media** — Play video or music: pass a URL (YouTube, Netflix, Spotify, etc.) to open in the browser, or a local file path (e.g. movie.mp4, song.mp3) to open with the default player. Use when the user says "пусни филм/музика".
- **read_file** — Read file contents in the workspace; optional line range (`startLine`, `endLine`).
- **write_file** — Create or overwrite a file; creates parent directories if needed.
- **list_dir** — List directory contents (explore project structure).
- **search_in_files** — Grep-like search in workspace (plain text or regex); optional `filePattern` (e.g. `*.ts`).
- **apply_patch** — Apply multiple file changes at once (OpenClaw-style): `*** Begin Patch` / `*** Add File: path` / `+lines` / `*** Update File: path` / `-old` / `+new` / `*** Delete File: path` / `*** End Patch`.

All file/code tools are scoped to **OPENPAW_WORKSPACE** (default: current directory). Paths are relative to the workspace; path traversal outside it is rejected.

**Engagements (named workspaces):** Run `openpaw use <name>` to set the workspace to `{OPENPAW_DATA_DIR}/engagements/<name>`. Run `openpaw use` with no argument to see the current engagement and list. Useful for Kali engagements (one workspace per target).

**TARGET.md / context:** On the first message of a session, if the workspace contains `TARGET.md` or `.openpaw/context.md`, its content is prepended to your message as context so the agent knows the current target (e.g. scope, IP range, objectives). Example template: [docs/templates/TARGET.md.example](docs/templates/TARGET.md.example).

**SOUL.md / system prompt:** With `OPENPAW_SYSTEM_PROMPT_MODE=append`, the agent gets the base prompt plus the content of `SOUL.md` (or `.openpaw/system-prompt.md`) in the workspace—useful for engagement-specific instructions or tone. With `replace`, only the file content is used as the system prompt (advanced).

**Session persistence:** Conversation history is saved to `{OPENPAW_DATA_DIR}/sessions.json` and restored on restart so sessions survive process restarts. TTL and max history are configurable via `OPENPAW_SESSION_TTL_HOURS` (default 24) and `OPENPAW_SESSION_MAX_HISTORY` (default 50).

**Skill packs:** Set `OPENPAW_PACK=recon` (or `wireless`, `web`, `full`) to load only base tools plus that pack’s tools. Built-in packs: `recon` (nmap_scan, run_script), `wireless` (wireless_scan, wireless_attack, run_script), `web` (nikto_scan, run_script), `full` (all tools). Optional `{OPENPAW_DATA_DIR}/packs.json` overrides or extends packs. Example scripts for `run_script`: [docs/scripts-examples/](docs/scripts-examples/) (copy to `OPENPAW_SCRIPTS_DIR`, e.g. `.openpaw/scripts`).

**Shortcuts (any channel):** `/recon 192.168.1.0/24` → nmap quick scan; `/wireless` → wireless_scan; `/webscan https://target` → nikto_scan.

**Background jobs:** For `run_shell` and `nmap_scan` you can pass `background: true`; the job runs in the background and the channel (CLI, Telegram, Discord, web) gets a notification when it finishes.

## Planning and execution (Cursor + OpenClaw style)

The agent is instructed to **plan then execute** for coding and multi-step tasks:

1. **Plan** — State a short numbered plan (1. read/explore 2. search 3. edit 4. run).
2. **Execute** — Use tools in order: `read_file` / `list_dir` → `search_in_files` (if needed) → `write_file` / `apply_patch` → `run_shell` to build or test.
3. After each tool result, it either continues to the next step or returns a final answer.

This applies to both native tool-calling and ReAct mode. You can give a high-level goal (e.g. "add a new CLI command that lists backups") and the agent will plan and run the steps like Cursor or OpenClaw.

## Voice

- **Web voice** — `npm run voice` then open http://localhost:3780/voice. Uses browser Speech Recognition + Synthesis (Chrome/Edge).
- **Telegram voice** — In gateway mode, send a voice message to the bot; it is transcribed (Whisper or ElevenLabs STT), the agent replies, and the reply is sent as text in the chat. Uses the same STT config as web voice (OPENPAW_STT_* / ELEVENLABS_*).

## Project layout

```
src/
  config.ts      # Env loading (absolute paths, OPENPAW_CONFIG)
  llm.ts         # OpenAI-compatible chat client + ReAct fallback
  agent.ts       # Agent loop (LLM + tools)
  agent/react.ts # ReAct parser for models without tool-calling
  cli.ts         # CLI (chat, voice, gateway, doctor)
  router.ts      # Message router + Lane Queue
  session.ts     # Session manager
  dashboard.ts   # Web dashboard + /voice + /api/chat
  tools/         # remember, recall, run_shell, code tools (read_file, write_file, list_dir, search_in_files, apply_patch)
  channels/      # CLI, Discord adapters
  voice/         # STT, TTS adapters, voice loop
```

## MCP (Model Context Protocol)

Add MCP servers via `.openpaw/openpaw.json`:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "C:\\path\\to\\allow"]
    }
  }
}
```

No third-party registry — servers are explicit config only.

## Extending

1. **Custom tools** — Implement `ToolDefinition` and `registry.register(tool)` before running the agent.
2. **New channels** — Call `runAgent(llm, registry, userMessage, history)` with messages from your channel (Discord, Telegram, etc.) and send the result back.

See **[ROADMAP.md](ROADMAP.md)** for a vision and ideas to make OpenPaw a full Kali Linux agent (Kali-specific tools, audit log, engagements, TUI, and more).  
See **[KALI-AGI-PLAN.md](KALI-AGI-PLAN.md)** for recommended Kali tools by category and a phased plan of what the AGI should be able to do.  
See **[BUILD-PLAN.md](BUILD-PLAN.md)** for a detailed, step-by-step implementation plan (tasks, files, dependencies, acceptance criteria) to build everything without missing features.

## License

MIT.
