import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { z } from "zod";

/**
 * ConfigManager - Manages configuration in JSON format (config.json)
 * Replaces .env file with a JSON-based configuration system
 */

export interface OpenPawConfig {
  // LLM Settings
  llm: {
    baseUrl: string;
    model: string;
    apiKey?: string;
    timeoutMs: number;
    retryCount: number;
    retryDelayMs: number;
  };
  
  // Dual Agent
  dualAgent?: {
    enabled: boolean;
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    maxContextExchanges: number;
  };
  
  // Agent Behavior
  agent: {
    mode: "auto" | "native" | "react";
    maxTurns: number;
    completionReminder: boolean;
    verifyCompletion: boolean;
  };
  
  // System Prompt
  systemPrompt: {
    mode: "default" | "append" | "replace";
  };
  
  // Skill Pack
  pack?: {
    enabled: boolean;
    packName?: "recon" | "wireless" | "web" | "full" | "";
  };
  
  // Workspace
  workspace: {
    dataDir: string;
    workspaceRoot: string;
    scriptsDir?: string;
    currentEngagement?: string;
  };
  
  // Shell
  shell: {
    fullControl: boolean;
    timeout?: number;
    dangerApproval: boolean;
    dangerPatterns?: string;
    allowedCommands?: string;
    blockedPaths?: string;
  };
  
  // Channels
  discord?: {
    enabled: boolean;
    token?: string;
    allowedIds?: string;
  };
  
  telegram?: {
    enabled: boolean;
    botToken?: string;
    allowedIds?: string;
  };
  
  // Voice
  voice: {
    sttProvider: "local" | "elevenlabs";
    sttModel?: string;
    sttLanguage?: string;
    elevenLabsApiKey?: string;
    elevenLabsSttModelId?: string;
    elevenLabsSttLanguageCode?: string;
    ttsLang?: string;
  };
  
  // Integrations
  email?: {
    enabled: boolean;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    secure?: boolean;
  };
  
  googleSearch?: {
    enabled: boolean;
    apiKey?: string;
    engineId?: string;
  };
  
  knowledge?: {
    enabled: boolean;
    knowledgeDir?: string;
    embeddingModel?: string;
  };
  
  scheduler: {
    enabled: boolean;
  };
  
  // Session
  session: {
    ttlHours: number;
    maxHistory: number;
    summarizeThreshold: number;
    keepRaw: number;
  };
  
  // Memory
  memory: {
    maxEntries: number;
  };
  
  // Audit
  audit: {
    enabled: boolean;
    logPath?: string;
  };
  
  // Dashboard
  dashboard: {
    token?: string;
    port: number;
  };
  
  // Accessibility
  accessibility: {
    enabled: boolean;
  };
  
  // Advanced
  advanced: {
    logFormat: "text" | "json";
  };
}

const DEFAULT_CONFIG: OpenPawConfig = {
  llm: {
    baseUrl: "http://localhost:11434/v1",
    model: "llama3.2",
    timeoutMs: 55000,
    retryCount: 2,
    retryDelayMs: 2000,
  },
  agent: {
    mode: "auto",
    maxTurns: 100,
    completionReminder: true,
    verifyCompletion: false,
  },
  systemPrompt: {
    mode: "default",
  },
  workspace: {
    dataDir: "./.openpaw",
    workspaceRoot: ".",
  },
  shell: {
    fullControl: process.platform === "linux",
    dangerApproval: false,
  },
  voice: {
    sttProvider: "local",
    sttModel: "Xenova/whisper-tiny.en",
  },
  scheduler: {
    enabled: true,
  },
  session: {
    ttlHours: 24,
    maxHistory: 50,
    summarizeThreshold: 20,
    keepRaw: 10,
  },
  memory: {
    maxEntries: 1000,
  },
  audit: {
    enabled: false,
  },
  dashboard: {
    port: 3780,
  },
  accessibility: {
    enabled: false,
  },
  advanced: {
    logFormat: "text",
  },
};

export class ConfigManager {
  private configPath: string;
  private config: OpenPawConfig;
  
  constructor(configPath?: string) {
    // Default to .openpaw/config.json in current directory
    this.configPath = configPath || join(process.cwd(), ".openpaw", "config.json");
    this.config = this.load();
  }
  
  /**
   * Load configuration from JSON file
   */
  private load(): OpenPawConfig {
    if (existsSync(this.configPath)) {
      try {
        const raw = readFileSync(this.configPath, "utf-8");
        const parsed = JSON.parse(raw);
        // Merge with defaults to ensure all required fields exist
        return this.mergeWithDefaults(parsed);
      } catch (e) {
        console.error(`[ConfigManager] Failed to parse ${this.configPath}:`, e);
        console.warn("[ConfigManager] Using default configuration");
        return { ...DEFAULT_CONFIG };
      }
    }
    
    // No config file exists, create it with defaults
    console.log(`[ConfigManager] No config file found at ${this.configPath}`);
    console.log("[ConfigManager] Creating default config.json...");
    this.save(DEFAULT_CONFIG);
    return { ...DEFAULT_CONFIG };
  }
  
  /**
   * Merge user config with defaults (deep merge)
   */
  private mergeWithDefaults(userConfig: Partial<OpenPawConfig>): OpenPawConfig {
    const merged = { ...DEFAULT_CONFIG };
    
    for (const key in userConfig) {
      const value = (userConfig as any)[key];
      if (typeof value === "object" && !Array.isArray(value) && value !== null) {
        (merged as any)[key] = { ...(merged as any)[key], ...value };
      } else {
        (merged as any)[key] = value;
      }
    }
    
    return merged;
  }
  
  /**
   * Save configuration to JSON file
   */
  save(config: OpenPawConfig = this.config): void {
    try {
      // Ensure directory exists
      const dir = dirname(this.configPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      
      // Write JSON with pretty formatting
      writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf-8");
      this.config = config;
      console.log(`[ConfigManager] Configuration saved to ${this.configPath}`);
    } catch (e) {
      console.error(`[ConfigManager] Failed to save config:`, e);
      throw e;
    }
  }
  
  /**
   * Get current configuration
   */
  get(): OpenPawConfig {
    return { ...this.config };
  }
  
  /**
   * Update configuration (partial update)
   */
  update(partial: Partial<OpenPawConfig>): void {
    this.config = this.mergeWithDefaults({ ...this.config, ...partial });
    this.save();
  }
  
  /**
   * Reset to default configuration
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.save();
  }
  
  /**
   * Import from legacy .env file
   */
  importFromEnv(envPath: string): void {
    if (!existsSync(envPath)) {
      throw new Error(`.env file not found: ${envPath}`);
    }
    
    const raw = readFileSync(envPath, "utf-8");
    const envVars: Record<string, string> = {};
    
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (m) {
        envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
      }
    }
    
    // Map .env variables to config structure
    const imported: Partial<OpenPawConfig> = {
      llm: {
        baseUrl: envVars.OPENPAW_LLM_BASE_URL || this.config.llm.baseUrl,
        model: envVars.OPENPAW_LLM_MODEL || this.config.llm.model,
        apiKey: envVars.OPENPAW_LLM_API_KEY,
        timeoutMs: Number(envVars.OPENPAW_LLM_TIMEOUT_MS) || this.config.llm.timeoutMs,
        retryCount: Number(envVars.OPENPAW_LLM_RETRY_COUNT) || this.config.llm.retryCount,
        retryDelayMs: Number(envVars.OPENPAW_LLM_RETRY_DELAY_MS) || this.config.llm.retryDelayMs,
      },
      agent: {
        mode: (envVars.OPENPAW_AGENT_MODE as any) || this.config.agent.mode,
        maxTurns: Number(envVars.OPENPAW_AGENT_MAX_TURNS) || this.config.agent.maxTurns,
        completionReminder: envVars.OPENPAW_AGENT_COMPLETION_REMINDER === "true" || this.config.agent.completionReminder,
        verifyCompletion: envVars.OPENPAW_AGENT_VERIFY_COMPLETION === "true" || this.config.agent.verifyCompletion,
      },
      workspace: {
        dataDir: envVars.OPENPAW_DATA_DIR || this.config.workspace.dataDir,
        workspaceRoot: envVars.OPENPAW_WORKSPACE || this.config.workspace.workspaceRoot,
        scriptsDir: envVars.OPENPAW_SCRIPTS_DIR,
      },
      shell: {
        fullControl: envVars.OPENPAW_SHELL_FULL_CONTROL === "true" || this.config.shell.fullControl,
        timeout: Number(envVars.OPENPAW_SHELL_TIMEOUT),
        dangerApproval: envVars.OPENPAW_DANGER_APPROVAL === "true" || this.config.shell.dangerApproval,
        dangerPatterns: envVars.OPENPAW_DANGER_PATTERNS,
        allowedCommands: envVars.OPENPAW_SHELL_ALLOWED,
        blockedPaths: envVars.OPENPAW_SHELL_BLOCKED_PATHS,
      },
      audit: {
        enabled: envVars.OPENPAW_AUDIT_LOG === "true" || this.config.audit.enabled,
        logPath: envVars.OPENPAW_AUDIT_LOG_PATH,
      },
    };
    
    // Dual agent
    if (envVars.OPENPAW_LLM_2_BASE_URL) {
      imported.dualAgent = {
        enabled: true,
        baseUrl: envVars.OPENPAW_LLM_2_BASE_URL,
        model: envVars.OPENPAW_LLM_2_MODEL,
        apiKey: envVars.OPENPAW_LLM_2_API_KEY,
        maxContextExchanges: Number(envVars.OPENPAW_DELEGATE_MAX_CONTEXT_EXCHANGES) || 5,
      };
    }
    
    // Voice
    imported.voice = {
      sttProvider: (envVars.OPENPAW_STT_PROVIDER as any) || this.config.voice.sttProvider,
      sttModel: envVars.OPENPAW_STT_MODEL,
      sttLanguage: envVars.OPENPAW_STT_LANGUAGE,
      elevenLabsApiKey: envVars.ELEVENLABS_API_KEY,
      elevenLabsSttModelId: envVars.ELEVENLABS_STT_MODEL_ID,
      elevenLabsSttLanguageCode: envVars.ELEVENLABS_STT_LANGUAGE_CODE,
      ttsLang: envVars.OPENPAW_TTS_LANG,
    };
    
    // Google Search
    if (envVars.OPENPAW_GOOGLE_SEARCH_API_KEY) {
      imported.googleSearch = {
        enabled: true,
        apiKey: envVars.OPENPAW_GOOGLE_SEARCH_API_KEY,
        engineId: envVars.OPENPAW_GOOGLE_SEARCH_ENGINE_ID,
      };
    }
    
    // Discord
    if (envVars.OPENPAW_DISCORD_TOKEN) {
      imported.discord = {
        enabled: true,
        token: envVars.OPENPAW_DISCORD_TOKEN,
        allowedIds: envVars.OPENPAW_DISCORD_ALLOWED_IDS,
      };
    }
    
    // Telegram
    if (envVars.OPENPAW_TELEGRAM_BOT_TOKEN) {
      imported.telegram = {
        enabled: true,
        botToken: envVars.OPENPAW_TELEGRAM_BOT_TOKEN,
        allowedIds: envVars.OPENPAW_TELEGRAM_ALLOWED_IDS,
      };
    }
    
    this.config = this.mergeWithDefaults({ ...this.config, ...imported });
    this.save();
    
    console.log(`[ConfigManager] Imported settings from ${envPath}`);
  }
  
  /**
   * Export configuration to a file (for backup/sharing)
   */
  exportTo(path: string): void {
    writeFileSync(path, JSON.stringify(this.config, null, 2), "utf-8");
    console.log(`[ConfigManager] Configuration exported to ${path}`);
  }
  
  /**
   * Convert config to environment variables (for backward compatibility)
   */
  toEnvVars(): Record<string, string> {
    const env: Record<string, string> = {};
    
    env.OPENPAW_LLM_BASE_URL = this.config.llm.baseUrl;
    env.OPENPAW_LLM_MODEL = this.config.llm.model;
    if (this.config.llm.apiKey) env.OPENPAW_LLM_API_KEY = this.config.llm.apiKey;
    env.OPENPAW_LLM_TIMEOUT_MS = String(this.config.llm.timeoutMs);
    env.OPENPAW_LLM_RETRY_COUNT = String(this.config.llm.retryCount);
    env.OPENPAW_LLM_RETRY_DELAY_MS = String(this.config.llm.retryDelayMs);
    
    if (this.config.dualAgent?.enabled) {
      if (this.config.dualAgent.baseUrl) env.OPENPAW_LLM_2_BASE_URL = this.config.dualAgent.baseUrl;
      if (this.config.dualAgent.model) env.OPENPAW_LLM_2_MODEL = this.config.dualAgent.model;
      if (this.config.dualAgent.apiKey) env.OPENPAW_LLM_2_API_KEY = this.config.dualAgent.apiKey;
      env.OPENPAW_DELEGATE_MAX_CONTEXT_EXCHANGES = String(this.config.dualAgent.maxContextExchanges);
    }
    
    env.OPENPAW_AGENT_MODE = this.config.agent.mode;
    env.OPENPAW_AGENT_MAX_TURNS = String(this.config.agent.maxTurns);
    env.OPENPAW_AGENT_COMPLETION_REMINDER = String(this.config.agent.completionReminder);
    env.OPENPAW_AGENT_VERIFY_COMPLETION = String(this.config.agent.verifyCompletion);
    
    env.OPENPAW_SYSTEM_PROMPT_MODE = this.config.systemPrompt.mode;
    
    if (this.config.pack?.enabled && this.config.pack.packName) {
      env.OPENPAW_PACK = this.config.pack.packName;
    }
    
    env.OPENPAW_DATA_DIR = this.config.workspace.dataDir;
    env.OPENPAW_WORKSPACE = this.config.workspace.workspaceRoot;
    if (this.config.workspace.scriptsDir) env.OPENPAW_SCRIPTS_DIR = this.config.workspace.scriptsDir;
    
    env.OPENPAW_SHELL_FULL_CONTROL = String(this.config.shell.fullControl);
    if (this.config.shell.timeout) env.OPENPAW_SHELL_TIMEOUT = String(this.config.shell.timeout);
    env.OPENPAW_DANGER_APPROVAL = String(this.config.shell.dangerApproval);
    if (this.config.shell.dangerPatterns) env.OPENPAW_DANGER_PATTERNS = this.config.shell.dangerPatterns;
    if (this.config.shell.allowedCommands) env.OPENPAW_SHELL_ALLOWED = this.config.shell.allowedCommands;
    if (this.config.shell.blockedPaths) env.OPENPAW_SHELL_BLOCKED_PATHS = this.config.shell.blockedPaths;
    
    if (this.config.discord?.enabled) {
      if (this.config.discord.token) env.OPENPAW_DISCORD_TOKEN = this.config.discord.token;
      if (this.config.discord.allowedIds) env.OPENPAW_DISCORD_ALLOWED_IDS = this.config.discord.allowedIds;
    }
    
    if (this.config.telegram?.enabled) {
      if (this.config.telegram.botToken) env.OPENPAW_TELEGRAM_BOT_TOKEN = this.config.telegram.botToken;
      if (this.config.telegram.allowedIds) env.OPENPAW_TELEGRAM_ALLOWED_IDS = this.config.telegram.allowedIds;
    }
    
    env.OPENPAW_STT_PROVIDER = this.config.voice.sttProvider;
    if (this.config.voice.sttModel) env.OPENPAW_STT_MODEL = this.config.voice.sttModel;
    if (this.config.voice.sttLanguage) env.OPENPAW_STT_LANGUAGE = this.config.voice.sttLanguage;
    if (this.config.voice.elevenLabsApiKey) env.ELEVENLABS_API_KEY = this.config.voice.elevenLabsApiKey;
    if (this.config.voice.elevenLabsSttModelId) env.ELEVENLABS_STT_MODEL_ID = this.config.voice.elevenLabsSttModelId;
    if (this.config.voice.elevenLabsSttLanguageCode) env.ELEVENLABS_STT_LANGUAGE_CODE = this.config.voice.elevenLabsSttLanguageCode;
    if (this.config.voice.ttsLang) env.OPENPAW_TTS_LANG = this.config.voice.ttsLang;
    
    if (this.config.email?.enabled) {
      if (this.config.email.host) env.OPENPAW_EMAIL_HOST = this.config.email.host;
      if (this.config.email.port) env.OPENPAW_EMAIL_PORT = String(this.config.email.port);
      if (this.config.email.user) env.OPENPAW_EMAIL_USER = this.config.email.user;
      if (this.config.email.password) env.OPENPAW_EMAIL_PASS = this.config.email.password;
      if (this.config.email.secure !== undefined) env.OPENPAW_EMAIL_SECURE = String(this.config.email.secure);
    }
    
    if (this.config.googleSearch?.enabled) {
      if (this.config.googleSearch.apiKey) env.OPENPAW_GOOGLE_SEARCH_API_KEY = this.config.googleSearch.apiKey;
      if (this.config.googleSearch.engineId) env.OPENPAW_GOOGLE_SEARCH_ENGINE_ID = this.config.googleSearch.engineId;
    }
    
    if (this.config.knowledge?.enabled) {
      if (this.config.knowledge.knowledgeDir) env.OPENPAW_KNOWLEDGE_DIR = this.config.knowledge.knowledgeDir;
      if (this.config.knowledge.embeddingModel) env.OPENPAW_EMBEDDING_MODEL = this.config.knowledge.embeddingModel;
    }
    
    env.OPENPAW_SCHEDULER_ENABLED = String(this.config.scheduler.enabled);
    
    env.OPENPAW_SESSION_TTL_HOURS = String(this.config.session.ttlHours);
    env.OPENPAW_SESSION_MAX_HISTORY = String(this.config.session.maxHistory);
    env.OPENPAW_HISTORY_SUMMARIZE_THRESHOLD = String(this.config.session.summarizeThreshold);
    env.OPENPAW_HISTORY_KEEP_RAW = String(this.config.session.keepRaw);
    
    env.OPENPAW_MEMORY_MAX_ENTRIES = String(this.config.memory.maxEntries);
    
    env.OPENPAW_AUDIT_LOG = String(this.config.audit.enabled);
    if (this.config.audit.logPath) env.OPENPAW_AUDIT_LOG_PATH = this.config.audit.logPath;
    
    if (this.config.dashboard.token) env.OPENPAW_DASHBOARD_TOKEN = this.config.dashboard.token;
    
    env.OPENPAW_ACCESSIBILITY_MODE = String(this.config.accessibility.enabled);
    
    env.OPENPAW_LOG_FORMAT = this.config.advanced.logFormat;
    
    return env;
  }
}

// Singleton instance
let instance: ConfigManager | null = null;

export function getConfigManager(configPath?: string): ConfigManager {
  if (!instance) {
    instance = new ConfigManager(configPath);
  }
  return instance;
}
