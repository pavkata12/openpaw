import { existsSync, writeFileSync, mkdirSync, readdirSync, readFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./config.js";
import { createLLM, createSecondLLM } from "./llm.js";
import { createReActLLM } from "./agent/react.js";
import { runAgent } from "./agent.js";
import { createDelegateToAgentTool, DELEGATE_TO_AGENT_NAME } from "./tools/delegate-agent.js";
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
import { createLocalWhisperSTT, createElevenLabsSTT } from "./voice/stt.js";
import { createKnowledgeSearchTool, createKnowledgeAddTool } from "./tools/knowledge.js";
import { createGoogleSearchTool } from "./tools/google-search.js";
import { createDuckDuckGoSearchTool } from "./tools/duckduckgo-search.js";
import { createFetchPageTool } from "./tools/fetch-page.js";
import { createOpenUrlTool } from "./tools/open-url.js";
import { createTranscribeVideoTool } from "./tools/transcribe-video.js";
import { createBrowserAutomateTool } from "./tools/browser.js";
import {
  createReadFileTool,
  createWriteFileTool,
  createListDirTool,
  createSearchInFilesTool,
  createApplyPatchTool,
  createWorkspaceContextTool,
} from "./tools/code.js";
import { createBackup, listBackups, restoreBackup } from "./backup.js";
import { createRunScriptTool } from "./tools/run-script.js";
import { createNmapScanTool } from "./tools/nmap-scan.js";
import { createWirelessScanTool, createWirelessAttackTool } from "./tools/wireless.js";
import { createNiktoScanTool } from "./tools/nikto-scan.js";
import { getPack, getAllowedToolNames } from "./packs.js";

async function bootstrap() {
  const config = loadConfig();
  initLogger(config);
  const dataDir = config.OPENPAW_DATA_DIR;
  const pack = config.OPENPAW_PACK ? await getPack(config.OPENPAW_PACK, dataDir) : null;
  const allowedNames = getAllowedToolNames(pack);

  function shouldRegister(toolName: string): boolean {
    return allowedNames === null || allowedNames.has(toolName);
  }

  const registry = createToolRegistry();
  const allowed = config.OPENPAW_SHELL_ALLOWED?.split(",").map((s) => s.trim()).filter(Boolean);
  const blocked = config.OPENPAW_SHELL_BLOCKED_PATHS?.split(",").map((s) => s.trim()).filter(Boolean);
  const dangerPatterns =
    config.OPENPAW_DANGER_APPROVAL && config.OPENPAW_DANGER_PATTERNS
      ? config.OPENPAW_DANGER_PATTERNS.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;

  const memoryTool = createMemoryTool(dataDir, config.OPENPAW_MEMORY_MAX_ENTRIES);
  if (shouldRegister(memoryTool.name)) registry.register(memoryTool);
  const recallTool = createRecallTool(dataDir);
  if (shouldRegister(recallTool.name)) registry.register(recallTool);
  const shellTool = createShellTool({
    allowedCommands: allowed,
    blockedPaths: blocked,
    fullControl: config.OPENPAW_SHELL_FULL_CONTROL,
    timeout: config.OPENPAW_SHELL_TIMEOUT,
    dangerPatterns,
  });
  if (shouldRegister(shellTool.name)) registry.register(shellTool);

  if (shouldRegister("read_file")) registry.register(createReadFileTool(config.OPENPAW_WORKSPACE));
  if (shouldRegister("write_file")) registry.register(createWriteFileTool(config.OPENPAW_WORKSPACE));
  if (shouldRegister("list_dir")) registry.register(createListDirTool(config.OPENPAW_WORKSPACE));
  if (shouldRegister("search_in_files")) registry.register(createSearchInFilesTool(config.OPENPAW_WORKSPACE));
  if (shouldRegister("apply_patch")) registry.register(createApplyPatchTool(config.OPENPAW_WORKSPACE));
  if (shouldRegister("workspace_context")) registry.register(createWorkspaceContextTool(config.OPENPAW_WORKSPACE));
  if (shouldRegister("run_script")) registry.register(createRunScriptTool(config.OPENPAW_SCRIPTS_DIR ?? config.OPENPAW_DATA_DIR + "/scripts"));
  if (shouldRegister("nmap_scan")) registry.register(createNmapScanTool());
  if (shouldRegister("wireless_scan")) registry.register(createWirelessScanTool());
  if (shouldRegister("wireless_attack")) registry.register(createWirelessAttackTool());
  if (shouldRegister("nikto_scan")) registry.register(createNiktoScanTool());

  const mcp = await loadMCPTools(config.OPENPAW_DATA_DIR).catch(() => ({ tools: [], close: async () => {} }));
  for (const t of mcp.tools) {
    if (shouldRegister(t.name)) registry.register(t);
  }

  const emailSearch = createEmailSearchTool(config);
  const emailSend = createEmailSendTool(config);
  if (emailSearch && shouldRegister(emailSearch.name)) registry.register(emailSearch);
  if (emailSend && shouldRegister(emailSend.name)) registry.register(emailSend);
  if (shouldRegister("calendar_list")) registry.register(createCalendarListTool(dataDir));
  if (shouldRegister("calendar_add")) registry.register(createCalendarAddTool(dataDir));
  const knowledgeSearch = createKnowledgeSearchTool(config, dataDir);
  const knowledgeAdd = createKnowledgeAddTool(config, dataDir);
  if (knowledgeSearch && shouldRegister(knowledgeSearch.name)) registry.register(knowledgeSearch);
  if (knowledgeAdd && shouldRegister(knowledgeAdd.name)) registry.register(knowledgeAdd);

  // Web search: DuckDuckGo by default (no API, works out of the box). If Google keys are set, use Google instead.
  const googleSearch = createGoogleSearchTool(config);
  if (googleSearch && shouldRegister(googleSearch.name)) registry.register(googleSearch);
  else if (shouldRegister("web_search")) registry.register(createDuckDuckGoSearchTool());
  if (shouldRegister("fetch_page")) registry.register(createFetchPageTool());
  if (shouldRegister("open_url")) registry.register(createOpenUrlTool());
  if (shouldRegister("transcribe_video")) registry.register(createTranscribeVideoTool(config));
  const browserTool = await createBrowserAutomateTool();
  if (browserTool && shouldRegister(browserTool.name)) registry.register(browserTool);

  const mode = config.OPENPAW_AGENT_MODE;
  const llm = mode === "react" ? createReActLLM(config, registry) : createLLM(config);
  const llm2 = createSecondLLM(config);
  if (llm2) {
    registry.register(
      createDelegateToAgentTool((message) =>
        runAgent(llm2, registry, message, [], { excludeToolNames: [DELEGATE_TO_AGENT_NAME] })
      )
    );
  }
  return { config, llm, registry, mcpClose: mcp.close, pack };
}

export async function chatSession() {
  const { config, llm, registry, pack } = await bootstrap();
  const router = await createRouter({ llm, tools: registry, config, systemPromptSuffix: pack?.systemPromptSuffix });
  const cli = createCLIChannel();
  router.registerChannel(cli);
  await cli.start();
}

export async function gatewaySession() {
  const { config, llm, registry, pack } = await bootstrap();
  const router = await createRouter({ llm, tools: registry, config, systemPromptSuffix: pack?.systemPromptSuffix });
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
    let telegramSTT: { transcribe: (buf: Buffer, mime?: string) => Promise<string> } | null = null;
    const getTelegramSTT = () => {
      if (!telegramSTT) {
        telegramSTT =
          config.OPENPAW_STT_PROVIDER === "elevenlabs" && config.ELEVENLABS_API_KEY
            ? createElevenLabsSTT(config.ELEVENLABS_API_KEY, config.ELEVENLABS_STT_MODEL_ID, config.ELEVENLABS_STT_LANGUAGE_CODE)
            : createLocalWhisperSTT(config.OPENPAW_STT_MODEL, config.OPENPAW_STT_LANGUAGE);
      }
      return telegramSTT;
    };
    const telegram = createTelegramChannel(config.OPENPAW_TELEGRAM_BOT_TOKEN, allowed?.length ? allowed : undefined, {
      transcribeVoice: (buf, mime) => getTelegramSTT().transcribe(buf, mime),
    });
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
  const { config, llm, registry, pack } = await bootstrap();
  const router = await createRouter({ llm, tools: registry, config, systemPromptSuffix: pack?.systemPromptSuffix });
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
  use        Set or show engagement workspace (use <name>, or use to list)
  init       Create data dir, copy example scripts; use --target to add TARGET.md template to workspace
  help       Show this help

Examples:
  openpaw
  openpaw chat
  openpaw use alfa
  openpaw init
  openpaw init --target
  openpaw onboard
  openpaw doctor

Env: OPENPAW_DATA_DIR, OPENPAW_LLM_BASE_URL, OPENPAW_LLM_MODEL, etc.
See .env.example for full list.
`);
}

function getAppVersion(): string {
  try {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

async function doctor() {
  console.log("\n  OpenPaw doctor\n");
  console.log("  Version:", getAppVersion());
  console.log("  Node:", process.version, "|", process.platform, process.arch);
  console.log("  CWD:", process.cwd());

  let config: ReturnType<typeof loadConfig>;
  try {
    config = loadConfig();
  } catch (err) {
    console.error("  Config failed:", err instanceof Error ? err.message : String(err));
    console.log("\n  Fix .env (copy from .env.example) and ensure Node >= 20.\n");
    return;
  }

  const envPath = process.env.OPENPAW_LOADED_ENV_PATH;
  console.log("  .env:", envPath ?? "(none found)");
  console.log("  Data dir:", config.OPENPAW_DATA_DIR);
  console.log("  LLM:", config.OPENPAW_LLM_BASE_URL, "|", config.OPENPAW_LLM_MODEL);
  console.log("  API key:", config.OPENPAW_LLM_API_KEY ? config.OPENPAW_LLM_API_KEY.slice(0, 12) + "…" : "(none)");

  const issues: string[] = [];
  if (!config.OPENPAW_LLM_API_KEY && config.OPENPAW_LLM_BASE_URL.includes("api.openai.com")) {
    issues.push("OPENPAW_LLM_API_KEY is required for OpenAI");
  }
  if (parseInt(process.version.slice(1).split(".")[0], 10) < 20) {
    issues.push("Node 20+ required (current: " + process.version + ")");
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

  if (issues.length) {
    console.log("\n  Issues:\n");
    issues.forEach((i) => console.log("    -", i));
    console.log("\n  Test LLM: npm run test:llm\n");
  } else {
    console.log("\n  OK. Test LLM: npm run test:llm\n");
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

async function useCmd() {
  const config = loadConfig();
  const dataDir = config.OPENPAW_DATA_DIR;
  const engagementsDir = join(dataDir, "engagements");
  const currentPath = join(dataDir, "current_engagement");
  const [, , , name] = process.argv;
  const engagementName = name?.trim();

  if (!engagementName) {
    let current: string | undefined;
    if (existsSync(currentPath)) {
      try {
        current = readFileSync(currentPath, "utf-8").split(/\r?\n/)[0]?.trim();
      } catch {
        /* ignore */
      }
    }
    const list: string[] = [];
    if (existsSync(engagementsDir)) {
      try {
        list.push(...readdirSync(engagementsDir).filter((e) => e && !e.startsWith(".")));
      } catch {
        /* ignore */
      }
    }
    console.log("\n  OpenPaw engagement (workspace)\n");
    console.log("  Current:", current ?? "(none — using default workspace)");
    console.log("  Available:", list.length ? list.join(", ") : "(none). Use: openpaw use <name>\n");
    return;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(engagementName)) {
    console.error("\n  Engagement name must be alphanumeric, - or _. Example: openpaw use alfa\n");
    process.exit(1);
  }
  mkdirSync(dataDir, { recursive: true });
  mkdirSync(engagementsDir, { recursive: true });
  const targetDir = join(engagementsDir, engagementName);
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(currentPath, engagementName + "\n", "utf-8");
  console.log("\n  Switched to engagement:", engagementName);
  console.log("  Workspace:", targetDir);
  console.log("  Restart or run openpaw chat/gateway to use it.\n");
}

function initCmd() {
  const config = loadConfig();
  const dataDir = config.OPENPAW_DATA_DIR;
  const scriptsDir = config.OPENPAW_SCRIPTS_DIR ?? join(dataDir, "scripts");
  const engagementsDir = join(dataDir, "engagements");
  const args = process.argv.slice(3);
  const withTarget = args.includes("--target");

  mkdirSync(dataDir, { recursive: true });
  mkdirSync(scriptsDir, { recursive: true });
  mkdirSync(engagementsDir, { recursive: true });
  console.log("\n  OpenPaw init\n");
  console.log("  Data dir:", dataDir);
  console.log("  Scripts dir:", scriptsDir);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const projectRoot = join(__dirname, "..");
  const examplesDir = join(projectRoot, "docs", "scripts-examples");
  if (existsSync(examplesDir)) {
    let copied = 0;
    for (const f of readdirSync(examplesDir)) {
      if (!f.endsWith(".sh")) continue;
      const src = join(examplesDir, f);
      const dest = join(scriptsDir, f);
      if (!existsSync(dest)) {
        copyFileSync(src, dest);
        copied++;
        console.log("  Copied script:", f);
      }
    }
    if (copied === 0) console.log("  Scripts: (already present)");
  } else {
    console.log("  Scripts: (no docs/scripts-examples in repo — add scripts to", scriptsDir, ")");
  }

  if (withTarget) {
    const templatePath = join(projectRoot, "docs", "templates", "TARGET.md.example");
    const workspace = config.OPENPAW_WORKSPACE;
    const targetPath = join(workspace, "TARGET.md");
    if (existsSync(templatePath)) {
      if (!existsSync(targetPath)) {
        copyFileSync(templatePath, targetPath);
        console.log("  Created TARGET.md in workspace:", workspace);
      } else {
        console.log("  TARGET.md already exists in workspace");
      }
    } else {
      console.log("  TARGET template not found; create", targetPath, "manually from docs/templates/TARGET.md.example");
    }
  }

  console.log("\n  Done. Run openpaw use <name> to create an engagement, or openpaw chat to start.\n");
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
  if (c === "use") {
    useCmd();
    return;
  }
  if (c === "init") {
    initCmd();
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
