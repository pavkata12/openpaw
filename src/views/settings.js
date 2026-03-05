/**
 * Settings.js - Frontend JavaScript for Settings UI
 * Handles form interactions, API calls, and live updates
 */

const API_BASE = '';

// State
let currentConfig = null;
let isDirty = false;

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  setupEventListeners();
});

/**
 * Load configuration from API
 */
async function loadConfig() {
  try {
    const response = await fetch(`${API_BASE}/api/config`);
    if (!response.ok) throw new Error('Failed to load config');
    
    currentConfig = await response.json();
    populateForm(currentConfig);
    isDirty = false;
  } catch (e) {
    showMessage('error', `Failed to load configuration: ${e.message}`);
  }
}

/**
 * Populate form with config values
 */
function populateForm(config) {
  // LLM
  setFormValue('llm.baseUrl', config.llm.baseUrl);
  setFormValue('llm.model', config.llm.model);
  setFormValue('llm.apiKey', config.llm.apiKey || '');
  setFormValue('llm.timeoutMs', config.llm.timeoutMs);
  setFormValue('llm.retryCount', config.llm.retryCount);
  setFormValue('llm.retryDelayMs', config.llm.retryDelayMs);
  
  // Dual Agent
  const dualEnabled = config.dualAgent?.enabled || false;
  setFormValue('dualAgent.enabled', dualEnabled);
  toggleDualAgentFields(dualEnabled);
  if (config.dualAgent) {
    setFormValue('dualAgent.baseUrl', config.dualAgent.baseUrl || '');
    setFormValue('dualAgent.model', config.dualAgent.model || '');
    setFormValue('dualAgent.apiKey', config.dualAgent.apiKey || '');
    setFormValue('dualAgent.maxContextExchanges', config.dualAgent.maxContextExchanges);
  }
  
  // Agent
  setFormValue('agent.mode', config.agent.mode);
  setFormValue('agent.maxTurns', config.agent.maxTurns);
  setFormValue('agent.completionReminder', config.agent.completionReminder);
  setFormValue('agent.verifyCompletion', config.agent.verifyCompletion);
  
  // System Prompt
  setFormValue('systemPrompt.mode', config.systemPrompt.mode);
  
  // Pack
  const packEnabled = config.pack?.enabled || false;
  setFormValue('pack.enabled', packEnabled);
  setFormValue('pack.packName', config.pack?.packName || '');
  
  // Accessibility
  setFormValue('accessibility.enabled', config.accessibility?.enabled || false);
  
  // Workspace
  setFormValue('workspace.dataDir', config.workspace.dataDir);
  setFormValue('workspace.workspaceRoot', config.workspace.workspaceRoot);
  setFormValue('workspace.scriptsDir', config.workspace.scriptsDir || '');
  setFormValue('workspace.currentEngagement', config.workspace.currentEngagement || '');
  
  // Shell
  setFormValue('shell.fullControl', config.shell.fullControl);
  toggleShellAllowlist(!config.shell.fullControl);
  setFormValue('shell.timeout', config.shell.timeout || '');
  setFormValue('shell.dangerApproval', config.shell.dangerApproval);
  setFormValue('shell.dangerPatterns', config.shell.dangerPatterns || '');
  setFormValue('shell.allowedCommands', config.shell.allowedCommands || '');
  setFormValue('shell.blockedPaths', config.shell.blockedPaths || '');
  
  // Discord
  const discordEnabled = config.discord?.enabled || false;
  setFormValue('discord.enabled', discordEnabled);
  toggleDiscordFields(discordEnabled);
  if (config.discord) {
    setFormValue('discord.token', config.discord.token || '');
    setFormValue('discord.allowedIds', config.discord.allowedIds || '');
  }
  
  // Telegram
  const telegramEnabled = config.telegram?.enabled || false;
  setFormValue('telegram.enabled', telegramEnabled);
  toggleTelegramFields(telegramEnabled);
  if (config.telegram) {
    setFormValue('telegram.botToken', config.telegram.botToken || '');
    setFormValue('telegram.allowedIds', config.telegram.allowedIds || '');
  }
  
  // Voice
  const sttProvider = config.voice.sttProvider || 'local';
  setFormValue('voice.sttProvider', sttProvider);
  toggleSTTFields(sttProvider);
  setFormValue('voice.sttModel', config.voice.sttModel || '');
  setFormValue('voice.sttLanguage', config.voice.sttLanguage || '');
  setFormValue('voice.elevenLabsApiKey', config.voice.elevenLabsApiKey || '');
  setFormValue('voice.elevenLabsSttModelId', config.voice.elevenLabsSttModelId || '');
  setFormValue('voice.elevenLabsSttLanguageCode', config.voice.elevenLabsSttLanguageCode || '');
  setFormValue('voice.ttsLang', config.voice.ttsLang || '');
  
  // Email
  const emailEnabled = config.email?.enabled || false;
  setFormValue('email.enabled', emailEnabled);
  toggleEmailFields(emailEnabled);
  if (config.email) {
    setFormValue('email.host', config.email.host || '');
    setFormValue('email.port', config.email.port || '');
    setFormValue('email.user', config.email.user || '');
    setFormValue('email.password', config.email.password || '');
    setFormValue('email.secure', config.email.secure || false);
  }
  
  // Google Search
  const googleSearchEnabled = config.googleSearch?.enabled || false;
  setFormValue('googleSearch.enabled', googleSearchEnabled);
  toggleGoogleSearchFields(googleSearchEnabled);
  if (config.googleSearch) {
    setFormValue('googleSearch.apiKey', config.googleSearch.apiKey || '');
    setFormValue('googleSearch.engineId', config.googleSearch.engineId || '');
  }
  
  // Knowledge
  const knowledgeEnabled = config.knowledge?.enabled || false;
  setFormValue('knowledge.enabled', knowledgeEnabled);
  toggleKnowledgeFields(knowledgeEnabled);
  if (config.knowledge) {
    setFormValue('knowledge.knowledgeDir', config.knowledge.knowledgeDir || '');
    setFormValue('knowledge.embeddingModel', config.knowledge.embeddingModel || '');
  }
  
  // Scheduler
  setFormValue('scheduler.enabled', config.scheduler?.enabled !== false);
  
  // Session
  setFormValue('session.ttlHours', config.session.ttlHours);
  setFormValue('session.maxHistory', config.session.maxHistory);
  setFormValue('session.summarizeThreshold', config.session.summarizeThreshold);
  setFormValue('session.keepRaw', config.session.keepRaw);
  
  // Memory
  setFormValue('memory.maxEntries', config.memory.maxEntries);
  
  // Audit
  setFormValue('audit.enabled', config.audit.enabled);
  setFormValue('audit.logPath', config.audit.logPath || '');
  
  // Dashboard
  setFormValue('dashboard.token', config.dashboard.token || '');
  setFormValue('dashboard.port', config.dashboard.port);
}

/**
 * Set form field value
 */
function setFormValue(name, value) {
  const input = document.querySelector(`[name="${name}"]`);
  if (!input) return;
  
  if (input.type === 'checkbox') {
    input.checked = Boolean(value);
  } else {
    input.value = value;
  }
}

/**
 * Get form values as config object
 */
function getFormValues() {
  const config = {
    llm: {
      baseUrl: getFieldValue('llm.baseUrl'),
      model: getFieldValue('llm.model'),
      apiKey: getFieldValue('llm.apiKey') || undefined,
      timeoutMs: Number(getFieldValue('llm.timeoutMs')),
      retryCount: Number(getFieldValue('llm.retryCount')),
      retryDelayMs: Number(getFieldValue('llm.retryDelayMs')),
    },
    agent: {
      mode: getFieldValue('agent.mode'),
      maxTurns: Number(getFieldValue('agent.maxTurns')),
      completionReminder: getFieldValue('agent.completionReminder'),
      verifyCompletion: getFieldValue('agent.verifyCompletion'),
    },
    systemPrompt: {
      mode: getFieldValue('systemPrompt.mode'),
    },
    workspace: {
      dataDir: getFieldValue('workspace.dataDir'),
      workspaceRoot: getFieldValue('workspace.workspaceRoot'),
      scriptsDir: getFieldValue('workspace.scriptsDir') || undefined,
      currentEngagement: getFieldValue('workspace.currentEngagement') || undefined,
    },
    shell: {
      fullControl: getFieldValue('shell.fullControl'),
      timeout: Number(getFieldValue('shell.timeout')) || undefined,
      dangerApproval: getFieldValue('shell.dangerApproval'),
      dangerPatterns: getFieldValue('shell.dangerPatterns') || undefined,
      allowedCommands: getFieldValue('shell.allowedCommands') || undefined,
      blockedPaths: getFieldValue('shell.blockedPaths') || undefined,
    },
    voice: {
      sttProvider: getFieldValue('voice.sttProvider'),
      sttModel: getFieldValue('voice.sttModel') || undefined,
      sttLanguage: getFieldValue('voice.sttLanguage') || undefined,
      elevenLabsApiKey: getFieldValue('voice.elevenLabsApiKey') || undefined,
      elevenLabsSttModelId: getFieldValue('voice.elevenLabsSttModelId') || undefined,
      elevenLabsSttLanguageCode: getFieldValue('voice.elevenLabsSttLanguageCode') || undefined,
      ttsLang: getFieldValue('voice.ttsLang') || undefined,
    },
    scheduler: {
      enabled: getFieldValue('scheduler.enabled'),
    },
    session: {
      ttlHours: Number(getFieldValue('session.ttlHours')),
      maxHistory: Number(getFieldValue('session.maxHistory')),
      summarizeThreshold: Number(getFieldValue('session.summarizeThreshold')),
      keepRaw: Number(getFieldValue('session.keepRaw')),
    },
    memory: {
      maxEntries: Number(getFieldValue('memory.maxEntries')),
    },
    audit: {
      enabled: getFieldValue('audit.enabled'),
      logPath: getFieldValue('audit.logPath') || undefined,
    },
    dashboard: {
      token: getFieldValue('dashboard.token') || undefined,
      port: Number(getFieldValue('dashboard.port')),
    },
    accessibility: {
      enabled: getFieldValue('accessibility.enabled'),
    },
    advanced: {
      logFormat: 'text',
    },
  };
  
  // Dual Agent
  if (getFieldValue('dualAgent.enabled')) {
    config.dualAgent = {
      enabled: true,
      baseUrl: getFieldValue('dualAgent.baseUrl') || undefined,
      model: getFieldValue('dualAgent.model') || undefined,
      apiKey: getFieldValue('dualAgent.apiKey') || undefined,
      maxContextExchanges: Number(getFieldValue('dualAgent.maxContextExchanges')),
    };
  }
  
  // Pack
  if (getFieldValue('pack.enabled')) {
    config.pack = {
      enabled: true,
      packName: getFieldValue('pack.packName') || undefined,
    };
  }
  
  // Discord
  if (getFieldValue('discord.enabled')) {
    config.discord = {
      enabled: true,
      token: getFieldValue('discord.token') || undefined,
      allowedIds: getFieldValue('discord.allowedIds') || undefined,
    };
  }
  
  // Telegram
  if (getFieldValue('telegram.enabled')) {
    config.telegram = {
      enabled: true,
      botToken: getFieldValue('telegram.botToken') || undefined,
      allowedIds: getFieldValue('telegram.allowedIds') || undefined,
    };
  }
  
  // Email
  if (getFieldValue('email.enabled')) {
    config.email = {
      enabled: true,
      host: getFieldValue('email.host') || undefined,
      port: Number(getFieldValue('email.port')) || undefined,
      user: getFieldValue('email.user') || undefined,
      password: getFieldValue('email.password') || undefined,
      secure: getFieldValue('email.secure'),
    };
  }
  
  // Google Search
  if (getFieldValue('googleSearch.enabled')) {
    config.googleSearch = {
      enabled: true,
      apiKey: getFieldValue('googleSearch.apiKey') || undefined,
      engineId: getFieldValue('googleSearch.engineId') || undefined,
    };
  }
  
  // Knowledge
  if (getFieldValue('knowledge.enabled')) {
    config.knowledge = {
      enabled: true,
      knowledgeDir: getFieldValue('knowledge.knowledgeDir') || undefined,
      embeddingModel: getFieldValue('knowledge.embeddingModel') || undefined,
    };
  }
  
  return config;
}

/**
 * Get field value (handles checkboxes)
 */
function getFieldValue(name) {
  const input = document.querySelector(`[name="${name}"]`);
  if (!input) return '';
  
  if (input.type === 'checkbox') {
    return input.checked;
  }
  return input.value;
}

/**
 * Save configuration
 */
async function saveConfig(e) {
  e.preventDefault();
  
  const config = getFormValues();
  
  try {
    const response = await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(error);
    }
    
    currentConfig = config;
    isDirty = false;
    showMessage('success', '✅ Settings saved successfully! Restart OpenPaw for changes to take effect.');
  } catch (e) {
    showMessage('error', `Failed to save settings: ${e.message}`);
  }
}

/**
 * Import from .env file
 */
async function importFromEnv() {
  if (!confirm('This will import settings from .env file and overwrite current configuration. Continue?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/config/import-env`, { method: 'POST' });
    if (!response.ok) throw new Error(await response.text());
    
    showMessage('success', '✅ Settings imported from .env successfully!');
    await loadConfig();
  } catch (e) {
    showMessage('error', `Failed to import from .env: ${e.message}`);
  }
}

/**
 * Reset to defaults
 */
async function resetConfig() {
  if (!confirm('This will reset ALL settings to defaults. This cannot be undone. Continue?')) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/api/config/reset`, { method: 'POST' });
    if (!response.ok) throw new Error(await response.text());
    
    showMessage('success', '✅ Settings reset to defaults!');
    await loadConfig();
  } catch (e) {
    showMessage('error', `Failed to reset settings: ${e.message}`);
  }
}

/**
 * Export configuration
 */
async function exportConfig() {
  try {
    const response = await fetch(`${API_BASE}/api/config`);
    if (!response.ok) throw new Error('Failed to load config');
    
    const config = await response.json();
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'openpaw-config.json';
    a.click();
    URL.revokeObjectURL(url);
    
    showMessage('success', '✅ Configuration exported!');
  } catch (e) {
    showMessage('error', `Failed to export: ${e.message}`);
  }
}

/**
 * Import configuration from file
 */
async function importConfig(file) {
  try {
    const text = await file.text();
    const config = JSON.parse(text);
    
    const response = await fetch(`${API_BASE}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) throw new Error(await response.text());
    
    showMessage('success', '✅ Configuration imported successfully!');
    await loadConfig();
  } catch (e) {
    showMessage('error', `Failed to import: ${e.message}`);
  }
}

/**
 * Show message
 */
function showMessage(type, text) {
  const msg = document.getElementById('statusMessage');
  msg.className = `alert alert-${type} show`;
  msg.textContent = text;
  
  setTimeout(() => {
    msg.classList.remove('show');
  }, 5000);
}

/**
 * Toggle field visibility
 */
function toggleDualAgentFields(enabled) {
  document.getElementById('dualAgentFields').style.display = enabled ? 'block' : 'none';
}

function toggleShellAllowlist(show) {
  document.getElementById('shellAllowlistSection').style.display = show ? 'block' : 'none';
}

function toggleDiscordFields(enabled) {
  document.getElementById('discordFields').style.display = enabled ? 'block' : 'none';
}

function toggleTelegramFields(enabled) {
  document.getElementById('telegramFields').style.display = enabled ? 'block' : 'none';
}

function toggleSTTFields(provider) {
  document.getElementById('localSTTFields').style.display = provider === 'local' ? 'block' : 'none';
  document.getElementById('elevenLabsSTTFields').style.display = provider === 'elevenlabs' ? 'block' : 'none';
}

function toggleEmailFields(enabled) {
  document.getElementById('emailFields').style.display = enabled ? 'block' : 'none';
}

function toggleGoogleSearchFields(enabled) {
  document.getElementById('googleSearchFields').style.display = enabled ? 'block' : 'none';
}

function toggleKnowledgeFields(enabled) {
  document.getElementById('knowledgeFields').style.display = enabled ? 'block' : 'none';
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;
      
      // Update tabs
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Update content
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.querySelector(`[data-tab="${targetTab}"].tab-content`).classList.add('active');
    });
  });
  
  // Form submission
  document.getElementById('settingsForm').addEventListener('submit', saveConfig);
  
  // Cancel button
  document.getElementById('cancelBtn').addEventListener('click', () => {
    if (isDirty && !confirm('Discard unsaved changes?')) return;
    loadConfig();
  });
  
  // Toggles
  document.getElementById('dualAgentEnabled').addEventListener('change', (e) => {
    toggleDualAgentFields(e.target.checked);
  });
  
  document.getElementById('shellFullControl').addEventListener('change', (e) => {
    toggleShellAllowlist(!e.target.checked);
  });
  
  document.getElementById('discordEnabled').addEventListener('change', (e) => {
    toggleDiscordFields(e.target.checked);
  });
  
  document.getElementById('telegramEnabled').addEventListener('change', (e) => {
    toggleTelegramFields(e.target.checked);
  });
  
  document.getElementById('sttProvider').addEventListener('change', (e) => {
    toggleSTTFields(e.target.value);
  });
  
  document.getElementById('emailEnabled').addEventListener('change', (e) => {
    toggleEmailFields(e.target.checked);
  });
  
  document.getElementById('googleSearchEnabled').addEventListener('change', (e) => {
    toggleGoogleSearchFields(e.target.checked);
  });
  
  document.getElementById('knowledgeEnabled').addEventListener('change', (e) => {
    toggleKnowledgeFields(e.target.checked);
  });
  
  // Advanced buttons
  document.getElementById('importEnvBtn').addEventListener('click', importFromEnv);
  document.getElementById('resetBtn').addEventListener('click', resetConfig);
  document.getElementById('exportBtn').addEventListener('click', exportConfig);
  
  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  
  document.getElementById('importFile').addEventListener('change', (e) => {
    if (e.target.files[0]) {
      importConfig(e.target.files[0]);
    }
  });
  
  // Track changes
  document.getElementById('settingsForm').addEventListener('input', () => {
    isDirty = true;
  });
  
  // Back link - use relative path
  const backLink = document.getElementById('backLink');
  const currentUrl = new URL(window.location.href);
  backLink.href = currentUrl.origin;
}
