# OpenPaw

**Your self-hosted AI assistant — simpler, hackable, yours.**

OpenPaw is a minimal, OpenClaw-inspired framework: an AI that runs on your machine, uses your LLM (OpenAI, Ollama, or any OpenAI-compatible API), and can remember, run commands, and be extended with plugins. No vendor lock-in, no mandatory cloud.

## Why OpenPaw?

- **Simpler** — Small core, clear code, easy to read and modify. Get chatting in under a minute.
- **Same spirit as OpenClaw** — Local-first, multi-model, tools and memory — but with a lean codebase and straightforward onboarding.
- **OpenAI-compatible** — Use OpenAI, Ollama, or any API that speaks the OpenAI chat format.
- **Extensible** — Register custom tools in TypeScript; add channels (Discord, etc.) the same way.

## Quick start

### Easiest: OpenRouter + Kimi K2 (free)

1. Get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys)
2. **Create `.env`** (the file is not in git; on a fresh clone you must create it):
   ```bash
   cp .env.example .env
   ```
3. Edit `.env` and set:

```
OPENPAW_LLM_BASE_URL=https://openrouter.ai/api/v1
OPENPAW_LLM_MODEL=moonshotai/kimi-k2:free
OPENPAW_LLM_API_KEY=sk-or-v1-your-key
```

4. Run:

```bash
npm install && npm run build
npm run start:cli
```

### Other options

- **Ollama** (local, no key): Install from [ollama.com](https://ollama.com), run `ollama run llama3.2`, use defaults in `.env`
- **OpenAI**: Set `OPENPAW_LLM_BASE_URL=https://api.openai.com/v1`, `OPENPAW_LLM_MODEL=gpt-4o-mini`, `OPENPAW_LLM_API_KEY=sk-...`
- **Kimi (Moonshot)**: Get key at [platform.moonshot.ai](https://platform.moonshot.ai/console/api-keys), use `api.moonshot.ai/v1` + `moonshot-v1-32k`

## Commands

| Command | Description |
|--------|-------------|
| `npm run start:cli` | Interactive chat in the terminal |
| `npm run voice` | Start dashboard + open voice chat (browser Speech API) |
| `npm run gateway` | Multi-channel mode (CLI + Discord if configured) |
| `npm run start:dashboard` | Web dashboard on http://localhost:3780 |
| `npm run build` | Compile TypeScript to `dist/` |
| `openpaw doctor` | Validate config and paths |
| `openpaw backup create [name]` | Create backup |
| `openpaw backup list` | List backups |
| `openpaw backup restore <name>` | Restore backup |

## Configuration

Environment variables (in `.env` or your shell):

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENPAW_LLM_BASE_URL` | OpenAI-compatible API base URL | `http://localhost:11434/v1` (Ollama) |
| `OPENPAW_LLM_MODEL` | Model name | `llama3.2` |
| `OPENPAW_LLM_API_KEY` | API key (optional for Ollama) | — |
| `OPENPAW_DATA_DIR` | Directory for memory and data | `./.openpaw` |

## Built-in tools

- **remember** — Store a key/value fact (e.g. preferences, names).
- **recall** — Retrieve a stored fact by key.
- **run_shell** — Run a sandboxed shell command (allowlist, timeout 30s).

## Voice

- **Web voice** — `npm run voice` then open http://localhost:3780/voice. Uses browser Speech Recognition + Synthesis (Chrome/Edge).

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
  tools/         # remember, recall, run_shell (sandboxed)
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

## License

MIT.
