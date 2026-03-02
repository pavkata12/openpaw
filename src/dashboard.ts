import { createServer } from "node:http";
import { loadConfig } from "./config.js";
import { createLLM } from "./llm.js";
import { createReActLLM } from "./agent/react.js";
import { runAgent } from "./agent.js";
import { createToolRegistry } from "./tools/registry.js";
import { createMemoryTool, createRecallTool } from "./tools/memory.js";
import { createShellTool } from "./tools/shell.js";
import { createLocalWhisperSTT, createElevenLabsSTT } from "./voice/stt.js";
import type { ChannelAdapter } from "./channels/types.js";
import { loadTasks, saveTasks } from "./scheduler/task-store.js";

const PORT = 3780;

const VOICE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenPaw Voice</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Segoe UI', system-ui, sans-serif; background: #0f0f12; color: #e4e4e7; min-height: 100vh; display: flex; flex-direction: column; }
    .header { padding: 0.75rem 1rem; border-bottom: 1px solid #27272a; display: flex; align-items: center; justify-content: space-between; flex-shrink: 0; }
    .header h1 { margin: 0; font-size: 1rem; font-weight: 600; }
    .header a { color: #a78bfa; text-decoration: none; font-size: 0.9rem; }
    .header a:hover { text-decoration: underline; }
    .conversation { flex: 1; overflow-y: auto; padding: 1rem; max-height: calc(100vh - 180px); min-height: 200px; }
    .msg { margin-bottom: 1rem; max-width: 85%; }
    .msg.you { margin-left: 0; }
    .msg.paw { margin-left: 0; }
    .msg-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; color: #71717a; }
    .msg.you .msg-label { color: #a78bfa; }
    .msg-bubble { padding: 0.75rem 1rem; border-radius: 12px; line-height: 1.5; word-break: break-word; white-space: pre-wrap; }
    .msg.you .msg-bubble { background: #27272a; color: #e4e4e7; border-bottom-right-radius: 4px; }
    .msg.paw .msg-bubble { background: #1e1b4b; color: #e4e4e7; border-bottom-left-radius: 4px; border: 1px solid #312e81; }
    .msg.err .msg-bubble { background: #450a0a; border-color: #b91c1c; color: #fecaca; }
    .status-bar { padding: 0.5rem 1rem; min-height: 2rem; font-size: 0.85rem; color: #71717a; display: flex; align-items: center; flex-shrink: 0; }
    .status-bar .dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; margin-right: 0.5rem; }
    .status-bar.recording .dot { background: #ef4444; animation: pulse 1s ease-in-out infinite; }
    .status-bar.speaking .dot { background: #a78bfa; animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{ opacity:1 } 50%{ opacity:0.5 } }
    .controls { padding: 1rem; border-top: 1px solid #27272a; display: flex; justify-content: center; align-items: center; gap: 0.75rem; flex-shrink: 0; }
    .mic-btn { width: 56px; height: 56px; border-radius: 50%; border: none; cursor: pointer; background: #3f3f46; color: #e4e4e7; display: flex; align-items: center; justify-content: center; transition: transform 0.15s, background 0.15s; }
    .mic-btn:hover:not(:disabled) { background: #52525b; transform: scale(1.05); }
    .mic-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .mic-btn.recording { background: #dc2626; }
    .mic-btn.speaking { background: #7c3aed; }
    .mic-btn svg { width: 24px; height: 24px; }
    .interrupt-btn { padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid #7c3aed; background: transparent; color: #a78bfa; cursor: pointer; font-size: 0.9rem; }
    .interrupt-btn:hover { background: #2e1065; }
  </style>
</head>
<body>
  <header class="header">
    <h1>Voice</h1>
    <a href="/">Dashboard</a>
  </header>
  <div class="conversation" id="conversation"></div>
  <div class="status-bar" id="statusBar">Ready — tap the mic to speak</div>
  <div class="controls">
    <button type="button" class="mic-btn" id="micBtn" title="Tap to start, tap again to send">
      <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 3.22 5.19 5.91 5.19s5.42-2.19 5.91-5.19c.1-.6-.39-1.14-1-1.14z"/></svg>
    </button>
    <button type="button" class="interrupt-btn" id="interruptBtn" style="display:none">Interrupt</button>
  </div>
  <script>
    window.__OPENPAW_TTS_LANG__ = '__OPENPAW_TTS_LANG_VALUE__';
    const conversation = document.getElementById('conversation');
    const statusBar = document.getElementById('statusBar');
    const micBtn = document.getElementById('micBtn');
    const interruptBtn = document.getElementById('interruptBtn');
    let sessionId = localStorage.getItem('openpaw-voice-session') || crypto.randomUUID();
    localStorage.setItem('openpaw-voice-session', sessionId);

    function addMessage(role, text, isError) {
      const wrap = document.createElement('div');
      wrap.className = 'msg ' + role + (isError ? ' err' : '');
      wrap.innerHTML = '<div class="msg-label">' + (role === 'you' ? 'You' : 'Paw') + '</div><div class="msg-bubble"></div>';
      const bubble = wrap.querySelector('.msg-bubble');
      bubble.textContent = text;
      conversation.appendChild(wrap);
      conversation.scrollTop = conversation.scrollHeight;
    }

    function setStatus(text, state) {
      statusBar.innerHTML = (state ? '<span class="dot"></span>' : '') + text;
      statusBar.className = 'status-bar' + (state ? ' ' + state : '');
    }

    let mediaRecorder = null;
    let stream = null;
    let currentUtterance = null;
    let isRecording = false;

    function stopSpeaking() {
      speechSynthesis.cancel();
      currentUtterance = null;
      interruptBtn.style.display = 'none';
      micBtn.classList.remove('speaking');
      micBtn.disabled = false;
      setStatus('Ready — tap the mic to speak');
    }

    interruptBtn.onclick = function() {
      stopSpeaking();
      startRecording();
    };

    function startRecording() {
      if (isRecording) return;
      navigator.mediaDevices.getUserMedia({ audio: true }).then(s => {
        stream = s;
        mediaRecorder = new MediaRecorder(stream);
        const chunks = [];
        mediaRecorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        mediaRecorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          isRecording = false;
          micBtn.classList.remove('recording');
          const blob = new Blob(chunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          if (blob.size < 500) {
            addMessage('paw', 'Recording too short — record at least ~1 second and try again', true);
            setStatus('Ready — tap the mic to speak');
            return;
          }
          sendAudio(blob);
        };
        mediaRecorder.start();
        isRecording = true;
        micBtn.classList.add('recording');
        setStatus('Recording… tap the mic again to send', 'recording');
      }).catch(err => {
        addMessage('paw', 'Mic error: ' + err.message, true);
        setStatus('Ready — tap the mic to speak');
      });
    }

    function stopRecording() {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    }

    async function sendAudio(blob) {
      micBtn.disabled = true;
      setStatus('Transcribing…');
      try {
        const formData = new FormData();
        formData.append('audio', blob, 'recording.webm');
        const tr = await fetch('/api/voice/transcribe', { method: 'POST', body: formData });
        let trData;
        try {
          trData = await tr.json();
        } catch (_) {
          addMessage('paw', 'Transcription failed: server returned ' + tr.status + ' (is the voice server running?)', true);
          setStatus('Ready — tap the mic to speak');
          micBtn.disabled = false;
          return;
        }
        if (!tr.ok || trData.error) {
          addMessage('paw', 'Transcription failed: ' + (trData.error || tr.statusText || 'Unknown error'), true);
          setStatus('Ready — tap the mic to speak');
          micBtn.disabled = false;
          return;
        }
        const text = (trData.text || '').trim();
        if (!text) {
          setStatus('No speech detected — try again');
          setTimeout(() => { setStatus('Ready — tap the mic to speak'); micBtn.disabled = false; }, 2000);
          return;
        }
        addMessage('you', text, false);
        setStatus('Thinking…');
        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, sessionId, voice: true })
        });
        const chatData = await chatRes.json();
        if (!chatRes.ok || chatData.error) {
          addMessage('paw', 'Error: ' + (chatData.error || 'Request failed'), true);
          setStatus('Ready — tap the mic to speak');
          micBtn.disabled = false;
          return;
        }
        const reply = chatData.reply || '';
        addMessage('paw', reply, false);
        if (reply) {
          setStatus('Speaking…', 'speaking');
          interruptBtn.style.display = 'inline-block';
          micBtn.classList.add('speaking');
          currentUtterance = new SpeechSynthesisUtterance(reply);
          if (window.__OPENPAW_TTS_LANG__) currentUtterance.lang = window.__OPENPAW_TTS_LANG__;
          currentUtterance.onend = () => { stopSpeaking(); };
          speechSynthesis.speak(currentUtterance);
        } else {
          setStatus('Ready — tap the mic to speak');
          micBtn.disabled = false;
        }
      } catch (err) {
        addMessage('paw', 'Error: ' + err.message, true);
        setStatus('Ready — tap the mic to speak');
        micBtn.disabled = false;
      }
    }

    micBtn.onclick = function() {
      if (micBtn.classList.contains('speaking')) {
        stopSpeaking();
        startRecording();
        return;
      }
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
    };
  </script>
</body>
</html>
`;

const HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenPaw</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', system-ui, sans-serif;
      max-width: 640px;
      margin: 0 auto;
      padding: 2rem;
      background: #0f0f12;
      color: #e4e4e7;
      min-height: 100vh;
    }
    h1 { font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; }
    .muted { color: #71717a; font-size: 0.9rem; }
    section { margin-top: 2rem; }
    pre {
      background: #18181b;
      padding: 1rem;
      border-radius: 8px;
      overflow: auto;
      font-size: 0.85rem;
    }
    a { color: #a78bfa; }
    .chat-row { display: flex; gap: 0.5rem; margin-top: 0.5rem; }
    .chat-row input { flex: 1; padding: 0.6rem 1rem; border-radius: 8px; border: 1px solid #3f3f46; background: #18181b; color: #e4e4e7; font-size: 1rem; }
    .chat-row button { padding: 0.6rem 1.2rem; border-radius: 8px; border: none; background: #a78bfa; color: #0f0f12; cursor: pointer; font-weight: 500; }
    .chat-row button:disabled { opacity: 0.5; cursor: not-allowed; }
    #chatLog { margin-top: 1rem; min-height: 120px; max-height: 280px; overflow-y: auto; font-size: 0.95rem; line-height: 1.5; }
    #chatLog .you { color: #a1a1aa; margin-bottom: 0.25rem; }
    #chatLog .paw { color: #a78bfa; margin-bottom: 0.75rem; }
  </style>
</head>
<body>
  <h1>OpenPaw</h1>
  <p class="muted">Your self-hosted AI assistant</p>
  <section>
    <h2>Chat</h2>
    <div class="chat-row">
      <input id="chatInput" type="text" placeholder="Type a message..." autocomplete="off" />
      <button id="chatSend">Send</button>
    </div>
    <div id="chatLog"></div>
  </section>
  <section>
    <p class="muted"><a href="/voice">Voice chat</a> | <a href="/tasks">Scheduled tasks</a> | <a href="/history">History</a> | <code>npm run start:cli</code></p>
  </section>
  <section>
    <h2>Status</h2>
    <pre id="config">Loading...</pre>
  </section>
  <script>
    let sessionId = localStorage.getItem('openpaw-chat-session') || crypto.randomUUID();
    localStorage.setItem('openpaw-chat-session', sessionId);
    fetch('/api/config').then(r => r.json()).then(d => {
      document.getElementById('config').textContent = JSON.stringify(d, null, 2);
    }).catch(() => {
      document.getElementById('config').textContent = 'Could not load config';
    });
    const input = document.getElementById('chatInput');
    const send = document.getElementById('chatSend');
    const log = document.getElementById('chatLog');
    const doSend = () => {
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      send.disabled = true;
      const you = document.createElement('div');
      you.className = 'you';
      you.textContent = 'You: ' + text;
      log.appendChild(you);
      log.scrollTop = log.scrollHeight;
      fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, sessionId }) })
        .then(r => r.json())
        .then(d => {
          const paw = document.createElement('div');
          paw.className = 'paw';
          paw.textContent = 'Paw: ' + (d.reply || d.error || 'No response');
          log.appendChild(paw);
          log.scrollTop = log.scrollHeight;
        })
        .catch(err => {
          const errEl = document.createElement('div');
          errEl.className = 'paw';
          errEl.style.color = '#f87171';
          errEl.textContent = 'Error: ' + err.message;
          log.appendChild(errEl);
          log.scrollTop = log.scrollHeight;
        })
        .finally(() => { send.disabled = false; });
    };
    send.onclick = doSend;
    input.onkeydown = (e) => { if (e.key === 'Enter') doSend(); };
  </script>
</body>
</html>
`;

const TASKS_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenPaw — Scheduled Tasks</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 640px; margin: 0 auto; padding: 2rem; background: #0f0f12; color: #e4e4e7; }
    h1 { font-size: 1.5rem; }
    a { color: #a78bfa; }
    .muted { color: #71717a; font-size: 0.9rem; }
    .task { background: #18181b; padding: 1rem; border-radius: 8px; margin-bottom: 0.75rem; }
    .task.disabled { opacity: 0.6; }
    .task cron { font-family: monospace; color: #a78bfa; }
    .task .prompt { color: #a1a1aa; margin-top: 0.5rem; }
    .task .meta { font-size: 0.85rem; color: #71717a; margin-top: 0.5rem; }
    button { padding: 0.4rem 0.8rem; border-radius: 6px; border: none; background: #a78bfa; color: #0f0f12; cursor: pointer; font-size: 0.9rem; }
    button.off { background: #3f3f46; color: #a1a1aa; }
  </style>
</head>
<body>
  <h1>Scheduled Tasks</h1>
  <p class="muted"><a href="/">Back to dashboard</a></p>
  <div id="list">Loading...</div>
  <script>
    function render(tasks) {
      const list = document.getElementById('list');
      if (!tasks.length) { list.innerHTML = '<p class="muted">No scheduled tasks. Ask the agent to add one with schedule_add.</p>'; return; }
      list.innerHTML = tasks.map(t => {
        const esc = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
        return '<div class="task ' + (t.enabled ? '' : 'disabled') + '" data-id="' + esc(t.id) + '" data-enabled="' + t.enabled + '"><span class="cron">' + esc(t.cron) + '</span><div class="prompt">' + esc(t.prompt.slice(0, 80)) + (t.prompt.length > 80 ? '...' : '') + '</div><div class="meta">Last run: ' + (t.lastRun ? new Date(t.lastRun).toLocaleString() : 'never') + '</div><button type="button">' + (t.enabled ? 'Disable' : 'Enable') + '</button></div>';
      }).join('');
      list.querySelectorAll('button').forEach(btn => {
        btn.onclick = () => {
          const div = btn.closest('.task');
          if (!div) return;
          const id = div.getAttribute('data-id');
          const enabled = div.getAttribute('data-enabled') !== 'true';
          fetch('/api/tasks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, enabled }) })
            .then(r => r.json()).then(() => fetch('/api/tasks').then(r => r.json()).then(render)).catch(console.error);
        };
      });
    }
    fetch('/api/tasks').then(r => r.json()).then(render).catch(() => { document.getElementById('list').textContent = 'Failed to load tasks.'; });
  </script>
</body>
</html>
`;

const HISTORY_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenPaw — History</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 640px; margin: 0 auto; padding: 2rem; background: #0f0f12; color: #e4e4e7; }
    h1 { font-size: 1.5rem; }
    a { color: #a78bfa; }
    .muted { color: #71717a; }
  </style>
</head>
<body>
  <h1>Conversation History</h1>
  <p class="muted"><a href="/">Back to dashboard</a></p>
  <p class="muted">Session history is kept in memory per channel. Past conversations are not persisted here. Use the chat or voice interface for the current session.</p>
</body>
</html>
`;

function parseBody(req: import("node:http").IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

async function parseMultipart(req: import("node:http").IncomingMessage): Promise<{ audio: Buffer; mimeType: string } | null> {
  const { createRequire } = await import("node:module");
  const require = createRequire(import.meta.url);
  return new Promise((resolve, reject) => {
    const Busboy = require("busboy");
    const busboy = Busboy({ headers: req.headers as Record<string, string> });
    let result: { audio: Buffer; mimeType: string } | null = null;
    let finished = false;
    const maybeResolve = () => {
      if (finished) resolve(result);
    };
    busboy.on("file", (name: string, file: NodeJS.ReadableStream, info: { mimeType?: string }) => {
      if (name !== "audio") {
        file.resume();
        return;
      }
      const chunks: Buffer[] = [];
      file.on("data", (chunk: Buffer) => chunks.push(chunk));
      file.on("end", () => {
        result = { audio: Buffer.concat(chunks), mimeType: info.mimeType || "audio/webm" };
        maybeResolve();
      });
    });
    busboy.on("finish", () => {
      finished = true;
      maybeResolve();
    });
    busboy.on("error", reject);
    req.pipe(busboy);
  });
}

export interface DashboardDeps {
  config: ReturnType<typeof loadConfig>;
  llm: Awaited<ReturnType<typeof createLLM>>;
  registry: ReturnType<typeof createToolRegistry>;
  webChannel: ChannelAdapter & { sendMessage(userId: string, text: string): Promise<string> };
}

export function startDashboard(deps?: DashboardDeps) {
  const config = deps?.config ?? loadConfig();
  const dataDir = config.OPENPAW_DATA_DIR;
  const registry = deps?.registry ?? createToolRegistry();
  if (!deps?.registry) {
    registry.register(createMemoryTool(dataDir, config.OPENPAW_MEMORY_MAX_ENTRIES));
    registry.register(createRecallTool(dataDir));
    registry.register(createShellTool());
  }
  const llm = deps?.llm ?? (config.OPENPAW_AGENT_MODE === "react" ? createReActLLM(config, registry) : createLLM(config));
  const webChannel = deps?.webChannel;

  let stt: import("./voice/stt.js").STTAdapter | null = null;
  function getSTT() {
    if (!stt) {
      if (config.OPENPAW_STT_PROVIDER === "elevenlabs" && config.ELEVENLABS_API_KEY) {
        stt = createElevenLabsSTT(
          config.ELEVENLABS_API_KEY,
          config.ELEVENLABS_STT_MODEL_ID,
          config.ELEVENLABS_STT_LANGUAGE_CODE
        );
      } else {
        stt = createLocalWhisperSTT(config.OPENPAW_STT_MODEL, config.OPENPAW_STT_LANGUAGE);
      }
    }
    return stt;
  }

  const server = createServer(async (req, res) => {
    const url = req.url?.split("?")[0];
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(HTML);
      return;
    }
    if (url === "/voice") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(VOICE_HTML.replace("__OPENPAW_TTS_LANG_VALUE__", config.OPENPAW_TTS_LANG ?? ""));
      return;
    }
    if (url === "/tasks") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(TASKS_HTML);
      return;
    }
    if (url === "/history") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(HISTORY_HTML);
      return;
    }
    if (url === "/api/config") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          llmBaseUrl: config.OPENPAW_LLM_BASE_URL,
          llmModel: config.OPENPAW_LLM_MODEL,
          dataDir: config.OPENPAW_DATA_DIR,
          hasDiscord: !!config.OPENPAW_DISCORD_TOKEN,
        })
      );
      return;
    }
    if (url === "/api/metrics") {
      const uptime = Math.floor(process.uptime());
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end(`# OpenPaw metrics\nopenpaw_uptime_seconds ${uptime}\n`);
      return;
    }
    if (url === "/api/tasks" && req.method === "GET") {
      try {
        const tasks = await loadTasks(dataDir);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(tasks));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    if (url === "/api/tasks" && req.method === "PATCH") {
      try {
        const body = await parseBody(req);
        const id = String(body.id ?? "").trim();
        const enabled = body.enabled === true || body.enabled === "true";
        if (!id) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "id required" }));
          return;
        }
        const tasks = await loadTasks(dataDir);
        const task = tasks.find((t) => t.id === id);
        if (!task) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "task not found" }));
          return;
        }
        task.enabled = enabled;
        await saveTasks(dataDir, tasks);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    if (url === "/api/history" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ message: "Session history is in-memory per channel.", entries: [] }));
      return;
    }
    if (url === "/api/voice/transcribe" && req.method === "POST") {
      try {
        const parsed = await parseMultipart(req);
        if (!parsed || parsed.audio.length === 0) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "audio required (multipart form)" }));
          return;
        }
        if (parsed.audio.length < 500) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Recording too short — record at least ~1 second" }));
          return;
        }
        const text = await getSTT().transcribe(parsed.audio, parsed.mimeType);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ text }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    if (url === "/api/chat" && req.method === "POST") {
      try {
        const body = await parseBody(req);
        const text = String(body.text ?? "").trim();
        if (!text) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "text required" }));
          return;
        }
        const sessionId = String(body.sessionId ?? "").trim() || `anon-${Date.now()}`;
        const userId = `web-${sessionId}`; // router session key for conversation memory
        const voice = body.voice === true;

        let reply: string;
        if (webChannel && "sendMessage" in webChannel) {
          const send = webChannel as { sendMessage(userId: string, text: string, metadata?: Record<string, unknown>): Promise<string> };
          reply = await send.sendMessage(userId, text, voice ? { voice: true } : undefined);
        } else {
          reply = await runAgent(llm, registry, text, [], voice ? { voice: true } : undefined);
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(PORT, () => {
    console.log(`OpenPaw dashboard: http://localhost:${PORT}`);
  });
}

if (process.argv[1]?.endsWith("dashboard.js")) {
  startDashboard();
}
