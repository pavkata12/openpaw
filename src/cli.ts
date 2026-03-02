import { existsSync } from "node:fs";
import { loadConfig } from "./config.js";
import { createLLM } from "./llm.js";
import { createReActLLM } from "./agent/react.js";
import { runAgent } from "./agent.js";
import { createToolRegistry } from "./tools/registry.js";
import { createMemoryTool, createRecallTool } from "./tools/memory.js";
import { createShellTool } from "./tools/shell.js";
import { initLogger } from "./logger.js";
import { createRouter } from "./router.js";
import { loadMCPTools } from "./mcp/index.js";
import { createCLIChannel } from "./channels/cli.js";
import { createDiscordChannel } from "./channels/discord.js";
import { createWebChannel } from "./channels/web.js";
import { createSchedulerChannel } from "./channels/scheduler.js";
import { startDashboard } from "./dashboard.js";
import { createScheduler } from "./scheduler/index.js";
import { createScheduleAddTool, createScheduleRemoveTool, createScheduleListTool } from "./tools/schedule.js";
import { createEmailSearchTool, createEmailSendTool } from "./tools/email.js";
import { createCalendarListTool, createCalendarAddTool } from "./tools/calendar.js";
import { createTelegramChannel } from "./channels/telegram.js";
import { createKnowledgeSearchTool, createKnowledgeAddTool } from "./tools/knowledge.js";
import { createGoogleSearchTool } from "./tools/google-search.js";
import { createBackup, listBackups, restoreBackup } from "./backup.js";

async function bootstrap() {
  const config = loadConfig();
  initLogger(config);
  const dataDir = config.OPENPAW_DATA_DIR;
  const registry = createToolRegistry();
  const allowed = config.OPENPAW_SHELL_ALLOWED?.split(",").map((s) => s.trim()).filter(Boolean);
  const blocked = config.OPENPAW_SHELL_BLOCKED_PATHS?.split(",").map((s) => s.trim()).filter(Boolean);
  registry.register(createMemoryTool(dataDir, config.OPENPAW_MEMORY_MAX_ENTRIES));
  registry.register(createRecallTool(dataDir));
  registry.register(
    createShellTool({
      allowedCommands: allowed,
      blockedPaths: blocked,
      fullControl: config.OPENPAW_SHELL_FULL_CONTROL,
      timeout: config.OPENPAW_SHELL_TIMEOUT,
    })
  );

  const mcp = await loadMCPTools(config.OPENPAW_DATA_DIR).catch(() => ({ tools: [], close: async () => {} }));
  for (const t of mcp.tools) registry.register(t);

  const emailSearch = createEmailSearchTool(config);
  const emailSend = createEmailSendTool(config);
  if (emailSearch) registry.register(emailSearch);
  if (emailSend) registry.register(emailSend);
  registry.register(createCalendarListTool(dataDir));
  registry.register(createCalendarAddTool(dataDir));
  registry.register(createKnowledgeSearchTool(config, dataDir));
  registry.register(createKnowledgeAddTool(config, dataDir));

  const googleSearch = createGoogleSearchTool(config);
  if (googleSearch) registry.register(googleSearch);

  const mode = config.OPENPAW_AGENT_MODE;
  const llm = mode === "react" ? createReActLLM(config, registry) : createLLM(config);
  return { config, llm, registry, mcpClose: mcp.close };
}

export async function chatSession() {
  const { config, llm, registry } = await bootstrap();
  const router = createRouter({ llm, tools: registry, config });
  const cli = createCLIChannel();
  router.registerChannel(cli);
  await cli.start();
}

export async function gatewaySession() {
  const { config, llm, registry } = await bootstrap();
  const router = createRouter({ llm, tools: registry, config });
  const cli = createCLIChannel();
  const webChannel = createWebChannel();
  const schedulerChannel = createSchedulerChannel();
  router.registerChannel(cli);
  router.registerChannel(webChannel);
  router.registerChannel(schedulerChannel);
  if (config.OPENPAW_DISCORD_TOKEN) {
    const allowed = config.OPENPAW_DISCORD_ALLOWED_IDS?.split(",").map((s) => s.trim()).filter(Boolean);
    const discord = createDiscordChannel(config.OPENPAW_DISCORD_TOKEN, allowed?.length ? allowed : undefined);
    router.registerChannel(discord);
    await discord.start();
  }
  if (config.OPENPAW_TELEGRAM_BOT_TOKEN) {
    const allowed = config.OPENPAW_TELEGRAM_ALLOWED_IDS?.split(",").map((s) => s.trim()).filter(Boolean);
    const telegram = createTelegramChannel(config.OPENPAW_TELEGRAM_BOT_TOKEN, allowed?.length ? allowed : undefined);
    router.registerChannel(telegram);
    await telegram.start();
  }
  const dataDir = config.OPENPAW_DATA_DIR;
  const scheduler = createScheduler({
    dataDir,
    onTrigger: (taskId, prompt) => schedulerChannel.trigger(taskId, prompt),
  });
  registry.register(createScheduleAddTool(dataDir, () => scheduler.refresh()));
  registry.register(createScheduleRemoveTool(dataDir, () => scheduler.refresh()));
  registry.register(createScheduleListTool(dataDir));
  if (config.OPENPAW_SCHEDULER_ENABLED) {
    scheduler.start();
    console.log("  Scheduler: enabled");
  }
  startDashboard({ config, llm, registry, webChannel });
  console.log("\n  Gateway: http://localhost:3780 (dashboard + voice)\n");
  await cli.start();
}

export async function voiceSession() {
  const { config, llm, registry } = await bootstrap();
  const router = createRouter({ llm, tools: registry, config });
  const webChannel = createWebChannel();
  router.registerChannel(webChannel);
  startDashboard({ config, llm, registry, webChannel });
  console.log("\n  OpenPaw voice: http://localhost:3780/voice");
  console.log("  Mic → Whisper (local) → LLM → browser TTS. Conversation memory enabled.\n");
}

export async function onboard() {
  const config = loadConfig();
  console.log("\n  OpenPaw onboarding\n");
  console.log("  LLM:", config.OPENPAW_LLM_BASE_URL, "| model:", config.OPENPAW_LLM_MODEL);
  console.log("  Data dir:", config.OPENPAW_DATA_DIR);
  console.log("\n  EASIEST (free): OpenRouter + Kimi K2");
  console.log("    1. Get key: https://openrouter.ai/keys");
  console.log("    2. cp .env.openrouter.example .env");
  console.log("    3. Add your OPENPAW_LLM_API_KEY");
  console.log("\n  Or: Ollama (local) | OpenAI | Moonshot Kimi — see .env.example");
  console.log("\n  Then: npm run start:cli\n");
}

function printHelp() {
  console.log(`
OpenPaw — your self-hosted AI assistant

Usage: openpaw [command]

Commands:
  chat       Interactive chat (default)
  voice      Voice chat (requires STT/TTS config)
  gateway    Multi-channel mode (CLI + Discord if configured)
  onboard    Show setup instructions
  doctor     Validate config and paths
  backup     Create/list/restore backups (backup create [name], backup list, backup restore <name>)
  help       Show this help

Examples:
  openpaw
  openpaw chat
  openpaw onboard
  openpaw doctor

Env: OPENPAW_DATA_DIR, OPENPAW_LLM_BASE_URL, OPENPAW_LLM_MODEL, etc.
See .env.example for full list.
`);
}

async function doctor() {
  const config = loadConfig();
  console.log("\n  OpenPaw doctor\n");
  const issues: string[] = [];
  if (!config.OPENPAW_LLM_API_KEY && config.OPENPAW_LLM_BASE_URL.includes("api.openai.com")) {
    issues.push("OPENPAW_LLM_API_KEY is required for OpenAI");
  }
  const dataDir = config.OPENPAW_DATA_DIR;
  if (!existsSync(dataDir)) {
    try {
      const { mkdir } = await import("node:fs/promises");
      await mkdir(dataDir, { recursive: true });
      console.log("  Created data dir:", dataDir);
    } catch {
      issues.push("Cannot create data dir: " + dataDir);
    }
  }
  console.log("  Data dir:", dataDir);
  console.log("  LLM:", config.OPENPAW_LLM_BASE_URL, "|", config.OPENPAW_LLM_MODEL);
  if (issues.length) {
    console.log("\n  Issues:\n");
    issues.forEach((i) => console.log("    -", i));
    console.log("");
  } else {
    console.log("\n  OK\n");
  }
}

async function backupCmd() {
  const config = loadConfig();
  const [, , , sub, name] = process.argv;
  const s = (sub ?? "").toLowerCase();
  if (s === "create") {
    const path = createBackup(config.OPENPAW_DATA_DIR, name ?? "backup");
    console.log("\n  Backup created:", path, "\n");
    return;
  }
  if (s === "list") {
    const backups = listBackups(config.OPENPAW_DATA_DIR);
    console.log("\n  Backups:\n");
    backups.forEach((p) => console.log("    ", p));
    console.log("");
    return;
  }
  if (s === "restore" && name) {
    restoreBackup(config.OPENPAW_DATA_DIR, name);
    console.log("\n  Restored:", name, "\n");
    return;
  }
  console.log("\n  Usage: openpaw backup create [name]");
  console.log("         openpaw backup list");
  console.log("         openpaw backup restore <name>\n");
}

function main() {
  const [, , cmd] = process.argv;
  const c = (cmd ?? "").toLowerCase();
  if (c === "onboard") {
    onboard();
    return;
  }
  if (c === "doctor") {
    doctor();
    return;
  }
  if (c === "backup") {
    backupCmd();
    return;
  }
  if (c === "help" || c === "-h" || c === "--help") {
    printHelp();
    return;
  }
  if (c === "voice") {
    voiceSession();
    return;
  }
  if (c === "gateway") {
    gatewaySession();
    return;
  }
  if (c === "chat" || c === "") {
    chatSession();
    return;
  }
  console.log("Unknown command:", cmd);
  printHelp();
  process.exit(1);
}

main();
