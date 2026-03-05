import { createServer } from "node:http";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, ACCESSIBILITY_PROMPT_SUFFIX } from "./config.js";
import { createLLM, createSecondLLM } from "./llm.js";
import { createReActLLM } from "./agent/react.js";
import { runAgent } from "./agent.js";
import { createDelegateToAgentTool, DELEGATE_TO_AGENT_NAME, DELEGATE_EXECUTOR_SUFFIX, type DelegateHistoryRef } from "./tools/delegate-agent.js";
import { createToolRegistry } from "./tools/registry.js";
import { createMemoryTool, createRecallTool } from "./tools/memory.js";
import { createShellTool } from "./tools/shell.js";
import {
  createReadFileTool,
  createWriteFileTool,
  createListDirTool,
  createSearchInFilesTool,
  createApplyPatchTool,
  createWorkspaceContextTool,
} from "./tools/code.js";
import { createRunScriptTool } from "./tools/run-script.js";
import { createNmapScanTool } from "./tools/nmap-scan.js";
import { createWirelessScanTool, createWirelessAttackTool } from "./tools/wireless.js";
import { createNiktoScanTool } from "./tools/nikto-scan.js";
import { createDuckDuckGoSearchTool } from "./tools/duckduckgo-search.js";
import { createFetchPageTool } from "./tools/fetch-page.js";
import { createOpenUrlTool } from "./tools/open-url.js";
import { createPlayMediaTool } from "./tools/play-media.js";
import { createTranscribeVideoTool } from "./tools/transcribe-video.js";
import { createBrowserAutomateTool, createBrowserOpenAndReadTool } from "./tools/browser.js";
import { createBrowserSessionTool } from "./tools/browser-enhanced.js";
import { createScreenshotTool, createVisionClickTool } from "./tools/screenshot.js";
import { createYtDlpTool, createYtDlpDownloadTool } from "./tools/ytdlp.js";
import { createRecordWorkflowTool, createFindWorkflowTool, createListWorkflowsTool } from "./tools/workflow-memory.js";
import * as PentestTools from "./tools/pentest/index.js";
import { createExploitSuggestionTool } from "./exploit-suggestion.js";
import { createNewReportTool, createAddFindingTool, createExportReportTool } from "./tools/reporting.js";
import { createCVELookupTool, createExploitDBSearchTool, createCVSSCalculatorTool } from "./tools/vuln-database.js";
import { createWordlistGeneratorTool, createPasswordMutatorTool } from "./tools/wordlist-generator.js";
import { createToolCheckTool, createSystemReadyTool } from "./tools/system-check.js";
import { createWhoisTool, createDNSEnumTool, createSubdomainFinderTool, createEmailHarvesterTool, createTechDetectionTool } from "./tools/osint.js";
import { createScreenshotComputerTool, createMouseClickTool, createMouseMoveTool, createKeyboardTypeTool, createKeyboardPressTool, createComputerUseTool } from "./tools/computer-use.js";
import { createLocalWhisperSTT, createElevenLabsSTT } from "./voice/stt.js";
import type { ChannelAdapter } from "./channels/types.js";
import { loadTasks, saveTasks } from "./scheduler/task-store.js";
import { loadSessions } from "./session-store.js";
import { getConfigManager } from "./config-manager.js";

const PORT = 3780;

const VOICE_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenPaw Voice</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
      background: linear-gradient(165deg, #0c0c0f 0%, #13131a 40%, #0f0f14 100%);
      color: #e4e4e7;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .header {
      padding: 1rem 1.5rem;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
      background: rgba(0,0,0,0.2);
    }
    .header h1 { margin: 0; font-size: 1.125rem; font-weight: 600; letter-spacing: -0.02em; }
    .header a {
      color: #a78bfa;
      text-decoration: none;
      font-size: 0.875rem;
      font-weight: 500;
      padding: 0.35rem 0.6rem;
      border-radius: 6px;
      transition: background 0.2s, color 0.2s;
    }
    .header a:hover { background: rgba(167,139,250,0.15); color: #c4b5fd; }
    .conversation {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      max-height: calc(100vh - 220px);
      min-height: 220px;
    }
    .msg { margin-bottom: 1.25rem; max-width: 88%; }
    .msg.you { margin-left: 0; }
    .msg.paw { margin-left: 0; }
    .msg-label {
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 0.35rem;
      color: #71717a;
    }
    .msg.you .msg-label { color: #a78bfa; }
    .msg-bubble {
      padding: 0.9rem 1.15rem;
      border-radius: 16px;
      line-height: 1.55;
      word-break: break-word;
      white-space: pre-wrap;
      font-size: 0.95rem;
      box-shadow: 0 1px 2px rgba(0,0,0,0.2);
    }
    .msg.you .msg-bubble {
      background: rgba(63,63,70,0.6);
      color: #f4f4f5;
      border: 1px solid rgba(255,255,255,0.06);
      border-bottom-right-radius: 6px;
    }
    .msg.paw .msg-bubble {
      background: linear-gradient(135deg, rgba(30,27,75,0.85) 0%, rgba(49,46,129,0.5) 100%);
      color: #e4e4e7;
      border: 1px solid rgba(129,140,248,0.25);
      border-bottom-left-radius: 6px;
    }
    .msg.err .msg-bubble {
      background: rgba(127,29,29,0.5);
      border-color: rgba(248,113,113,0.4);
      color: #fecaca;
    }
    .status-bar {
      padding: 0.65rem 1.5rem;
      min-height: 2.5rem;
      font-size: 0.8125rem;
      color: #a1a1aa;
      display: flex;
      align-items: center;
      flex-shrink: 0;
      background: rgba(0,0,0,0.15);
      border-top: 1px solid rgba(255,255,255,0.05);
    }
    .status-bar .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      margin-right: 0.6rem;
      flex-shrink: 0;
    }
    .status-bar.recording .dot { background: #ef4444; box-shadow: 0 0 12px rgba(239,68,68,0.5); animation: pulse 1s ease-in-out infinite; }
    .status-bar.speaking .dot { background: #a78bfa; box-shadow: 0 0 12px rgba(167,139,250,0.4); animation: pulse 1.5s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{ opacity:1; transform: scale(1) } 50%{ opacity:0.7; transform: scale(1.1) } }
    .controls {
      padding: 1.25rem 1.5rem;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      flex-shrink: 0;
    }
    .mic-wrap {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .mic-btn {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      background: linear-gradient(145deg, #3f3f46 0%, #27272a 100%);
      color: #e4e4e7;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06);
    }
    .mic-btn:hover:not(:disabled) {
      transform: scale(1.06);
      box-shadow: 0 6px 20px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08);
      background: linear-gradient(145deg, #52525b 0%, #3f3f46 100%);
    }
    .mic-btn:active:not(:disabled) { transform: scale(0.98); }
    .mic-btn:disabled { opacity: 0.65; cursor: not-allowed; }
    .mic-btn.recording {
      background: linear-gradient(145deg, #dc2626 0%, #b91c1c 100%);
      box-shadow: 0 4px 20px rgba(220,38,38,0.4), 0 0 0 3px rgba(220,38,38,0.2);
    }
    .mic-btn.speaking {
      background: linear-gradient(145deg, #7c3aed 0%, #6d28d9 100%);
      box-shadow: 0 4px 18px rgba(124,58,237,0.35);
    }
    .mic-btn svg { width: 28px; height: 28px; }
    .key-hint { font-size: 0.75rem; color: #71717a; }
    kbd { padding: 0.15em 0.45em; font-size: 0.85em; background: rgba(255,255,255,0.08); border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); font-family: inherit; }
    .interrupt-btn {
      padding: 0.5rem 1rem;
      border-radius: 10px;
      border: 1px solid rgba(167,139,250,0.4);
      background: rgba(167,139,250,0.1);
      color: #a78bfa;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      font-family: inherit;
      transition: background 0.2s, border-color 0.2s;
    }
    .interrupt-btn:hover { background: rgba(167,139,250,0.2); border-color: rgba(167,139,250,0.6); }
  </style>
</head>
<body>
  <header class="header">
    <h1>Voice</h1>
    <a href="/">Dashboard</a>
  </header>
  <div class="conversation" id="conversation"></div>
  <div class="status-bar" id="statusBar">Ready — click mic or press <kbd>Space</kbd> to speak</div>
  <div class="controls">
    <div class="mic-wrap">
      <button type="button" class="mic-btn" id="micBtn" title="Click or press Space to start, again to send">
        <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 3.22 5.19 5.91 5.19s5.42-2.19 5.91-5.19c.1-.6-.39-1.14-1-1.14z"/></svg>
      </button>
    </div>
    <p class="key-hint">Click or press <kbd>Space</kbd> to record, again to send</p>
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
    function authQuery() { var m = /token=([^&]+)/.exec(window.location.search); return m ? '?token=' + encodeURIComponent(m[1]) : ''; }
    function authHeaders() { var m = /token=([^&]+)/.exec(window.location.search); return m ? { 'X-Dashboard-Token': m[1] } : {}; }

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
    function triggerMic() {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable)) return;
      micBtn.click();
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
      setStatus('Ready — click mic or press Space to speak');
    }

    document.addEventListener('keydown', function(e) {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        triggerMic();
      }
    });

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
        setStatus('Recording… click mic or press Space again to send', 'recording');
      }).catch(err => {
        addMessage('paw', 'Mic error: ' + err.message, true);
        setStatus('Ready — click mic or press Space to speak');
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
        const tr = await fetch('/api/voice/transcribe' + authQuery(), { method: 'POST', headers: authHeaders(), body: formData });
        let trData;
        try {
          trData = await tr.json();
        } catch (_) {
          addMessage('paw', 'Transcription failed: server returned ' + tr.status + ' (is the voice server running?)', true);
          setStatus('Ready — click mic or press Space to speak');
          micBtn.disabled = false;
          return;
        }
        if (!tr.ok || trData.error) {
          addMessage('paw', 'Transcription failed: ' + (trData.error || tr.statusText || 'Unknown error'), true);
          setStatus('Ready — click mic or press Space to speak');
          micBtn.disabled = false;
          return;
        }
        const text = (trData.text || '').trim();
        if (!text) {
          setStatus('No speech detected — try again');
          setTimeout(() => { setStatus('Ready — click mic or press Space to speak'); micBtn.disabled = false; }, 2000);
          return;
        }
        addMessage('you', text, false);
        setStatus('Thinking…');
        const chatRes = await fetch('/api/chat' + authQuery(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ text, sessionId, voice: true })
        });
        const chatData = await chatRes.json();
        if (!chatRes.ok || chatData.error) {
          addMessage('paw', 'Error: ' + (chatData.error || 'Request failed'), true);
          setStatus('Ready — click mic or press Space to speak');
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
          setStatus('Ready — click mic or press Space to speak');
          micBtn.disabled = false;
        }
      } catch (err) {
        addMessage('paw', 'Error: ' + err.message, true);
        setStatus('Ready — click mic or press Space to speak');
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
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'DM Sans', system-ui, sans-serif;
      margin: 0;
      min-height: 100vh;
      background: linear-gradient(165deg, #0c0c0f 0%, #13131a 35%, #0f0f14 100%);
      color: #e4e4e7;
      padding: 0 1rem 2rem;
    }
    .wrap { max-width: 640px; margin: 0 auto; }
    .header {
      padding: 1.5rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      margin-bottom: 1.5rem;
    }
    .header h1 { margin: 0; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.03em; }
    .header .tagline { color: #71717a; font-size: 0.9rem; margin-top: 0.25rem; }
    .header .tagline .ver { color: #a78bfa; font-weight: 500; }
    .card {
      background: rgba(24,24,27,0.6);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 16px;
      padding: 1.25rem 1.5rem;
      margin-bottom: 1.25rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .card h2 { margin: 0 0 0.5rem; font-size: 0.95rem; font-weight: 600; color: #f4f4f5; letter-spacing: -0.02em; }
    .card .hint { color: #71717a; font-size: 0.8rem; margin-bottom: 0.75rem; }
    .chat-row { display: flex; gap: 0.6rem; margin-top: 0.5rem; }
    .chat-row input {
      flex: 1;
      padding: 0.75rem 1rem;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(0,0,0,0.25);
      color: #e4e4e7;
      font-size: 0.95rem;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .chat-row input::placeholder { color: #71717a; }
    .chat-row input:focus { outline: none; border-color: rgba(167,139,250,0.4); box-shadow: 0 0 0 3px rgba(167,139,250,0.1); }
    .chat-row button {
      padding: 0.75rem 1.35rem;
      border-radius: 12px;
      border: none;
      background: linear-gradient(145deg, #7c3aed 0%, #6d28d9 100%);
      color: #fff;
      cursor: pointer;
      font-weight: 600;
      font-size: 0.9rem;
      font-family: inherit;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .chat-row button:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(124,58,237,0.4); }
    .chat-row button:active:not(:disabled) { transform: translateY(0); }
    .chat-row button:disabled { opacity: 0.55; cursor: not-allowed; }
    #chatLog {
      margin-top: 1rem;
      min-height: 100px;
      max-height: 260px;
      overflow-y: auto;
      font-size: 0.9rem;
      line-height: 1.55;
    }
    #chatLog .you { color: #a1a1aa; margin-bottom: 0.35rem; }
    #chatLog .paw { color: #a78bfa; margin-bottom: 0.85rem; }
    #chatLog .err { color: #f87171; }
    .workspace-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
    .workspace-row select {
      padding: 0.5rem 1rem;
      border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.08);
      background: rgba(0,0,0,0.25);
      color: #e4e4e7;
      font-size: 0.9rem;
      font-family: inherit;
      min-width: 160px;
    }
    .workspace-row .status { font-size: 0.8rem; color: #71717a; }
    #recentAudit { min-height: 2rem; font-size: 0.85rem; color: #a1a1aa; }
    #recentAudit ul { margin: 0; padding-left: 1.2rem; }
    #recentAudit li { margin-bottom: 0.25rem; }
    .nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-bottom: 1.25rem;
    }
    .nav a {
      display: inline-block;
      padding: 0.45rem 0.9rem;
      border-radius: 10px;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.08);
      color: #a78bfa;
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 500;
      transition: background 0.2s, border-color 0.2s, color 0.2s;
    }
    .nav a:hover { background: rgba(167,139,250,0.12); border-color: rgba(167,139,250,0.25); color: #c4b5fd; }
    .nav code { font-size: 0.8rem; color: #71717a; padding: 0.45rem 0.6rem; background: rgba(0,0,0,0.2); border-radius: 8px; }
    .config-block {
      background: rgba(0,0,0,0.35);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 1rem 1.15rem;
      overflow: auto;
      font-size: 0.8rem;
      line-height: 1.5;
      font-family: ui-monospace, monospace;
      color: #a1a1aa;
    }
    a.link { color: #a78bfa; text-decoration: none; font-weight: 500; }
    a.link:hover { text-decoration: underline; }
    .health-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; margin-top: 0.5rem; }
    .health-item { background: rgba(0,0,0,0.2); border-radius: 10px; padding: 0.65rem 0.9rem; }
    .health-item .label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; }
    .health-item .value { font-size: 0.9rem; font-weight: 600; color: #e4e4e7; margin-top: 0.2rem; }
    .health-item .value.live { color: #22c55e; }
    .quick-actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem; margin-top: 0.5rem; }
    .quick-actions a {
      display: flex; align-items: center; justify-content: center;
      padding: 0.85rem 1rem; border-radius: 12px;
      background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.2);
      color: #c4b5fd; text-decoration: none; font-weight: 600; font-size: 0.9rem;
      transition: background 0.2s, border-color 0.2s, transform 0.15s;
    }
    .quick-actions a:hover { background: rgba(167,139,250,0.2); border-color: rgba(167,139,250,0.4); transform: translateY(-2px); }
    details.config-details { margin-top: 0.5rem; }
    details.config-details summary { cursor: pointer; font-size: 0.85rem; color: #a78bfa; font-weight: 500; user-select: none; }
    details.config-details[open] summary { margin-bottom: 0.5rem; }
    body.theme-light { background: linear-gradient(165deg, #f4f4f5 0%, #e4e4e7 35%, #fafafa 100%); color: #18181b; }
    body.theme-light .header { border-bottom-color: rgba(0,0,0,0.08); }
    body.theme-light .header .tagline { color: #52525b; }
    body.theme-light .card { background: rgba(255,255,255,0.8); border-color: rgba(0,0,0,0.08); }
    body.theme-light .card h2 { color: #18181b; }
    body.theme-light .card .hint { color: #52525b; }
    body.theme-light .health-item .value { color: #18181b; }
    body.theme-light .nav a { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.08); color: #6d28d9; }
    body.theme-light .nav a:hover { background: rgba(109,40,217,0.1); border-color: rgba(109,40,217,0.25); color: #7c3aed; }
    body.theme-light .config-block { background: rgba(0,0,0,0.06); border-color: rgba(0,0,0,0.08); color: #52525b; }
    .header-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.75rem; }
    .header-controls { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
    .theme-btn { padding: 0.35rem 0.65rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: #a1a1aa; cursor: pointer; font-size: 0.8rem; font-family: inherit; }
    .theme-btn:hover { background: rgba(255,255,255,0.1); color: #e4e4e7; }
    .theme-btn.active { background: rgba(167,139,250,0.25); border-color: rgba(167,139,250,0.4); color: #c4b5fd; }
    body.theme-light .theme-btn { border-color: rgba(0,0,0,0.12); color: #71717a; }
    body.theme-light .theme-btn:hover { color: #18181b; }
    body.theme-light .theme-btn.active { background: rgba(109,40,217,0.15); border-color: rgba(109,40,217,0.3); color: #6d28d9; }
    .auto-refresh-row { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #a1a1aa; }
    .auto-refresh-row input { margin: 0; accent-color: #a78bfa; }
    .sessions-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-top: 0.5rem; }
    .sessions-table th, .sessions-table td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.06); }
    .sessions-table th { color: #71717a; font-weight: 500; }
    body.theme-light .sessions-table th, body.theme-light .sessions-table td { border-bottom-color: rgba(0,0,0,0.06); }
    body.theme-light .sessions-table th { color: #52525b; }
    .key-settings-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.6rem; margin-top: 0.5rem; }
    .key-settings-item { background: rgba(0,0,0,0.2); border-radius: 10px; padding: 0.6rem 0.85rem; font-size: 0.85rem; }
    .key-settings-item .k { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em; color: #71717a; }
    .key-settings-item .v { margin-top: 0.2rem; color: #e4e4e7; word-break: break-all; }
    body.theme-light .key-settings-item { background: rgba(0,0,0,0.06); }
    body.theme-light .key-settings-item .k { color: #52525b; }
    body.theme-light .key-settings-item .v { color: #18181b; }
  </style>
</head>
<body id="bodyEl">
  <div class="wrap">
    <header class="header">
      <div class="header-row">
        <div>
          <h1>OpenPaw</h1>
          <p class="tagline">Your self-hosted AI assistant <span class="ver" id="appVersion"></span></p>
        </div>
        <div class="header-controls">
          <span class="theme-btn" data-theme="dark" id="themeDark">Dark</span>
          <span class="theme-btn" data-theme="light" id="themeLight">Light</span>
        </div>
      </div>
    </header>

    <div class="card" id="healthCard">
      <h2>Health</h2>
      <div class="health-grid">
        <div class="health-item"><div class="label">Status</div><div class="value live" id="healthStatus">—</div></div>
        <div class="health-item"><div class="label">Uptime</div><div class="value" id="healthUptime">—</div></div>
        <div class="health-item"><div class="label">Model</div><div class="value" id="healthModel">—</div></div>
        <div class="health-item"><div class="label">Channels</div><div class="value" id="healthChannels">—</div></div>
      </div>
    </div>

    <div class="card">
      <h2>Quick actions</h2>
      <div class="quick-actions">
        <a href="/voice">Voice chat</a>
        <a href="/tasks">Scheduled tasks</a>
        <a href="/audit">Audit log</a>
        <a href="/history">History</a>
      </div>
      <p class="hint" style="margin-top:0.75rem;margin-bottom:0;">CLI: <code style="font-size:0.8rem;padding:0.2rem 0.4rem;background:rgba(0,0,0,0.25);border-radius:6px;">npm run start:cli</code> · <code style="font-size:0.8rem;padding:0.2rem 0.4rem;background:rgba(0,0,0,0.25);border-radius:6px;">openpaw doctor</code></p>
    </div>

    <div class="card">
      <h2>Chat</h2>
      <div class="chat-row">
        <input id="chatInput" type="text" placeholder="Type a message..." autocomplete="off" />
        <button id="chatSend">Send</button>
      </div>
      <div id="chatLog"></div>
    </div>

    <div class="card">
      <h2>Workspace</h2>
      <p class="hint">Code tools and TARGET.md use this. Restart to apply.</p>
      <div class="workspace-row">
        <select id="engagementSelect">
          <option value="">— default —</option>
        </select>
        <span id="engagementStatus" class="status"></span>
      </div>
    </div>

    <div class="card">
      <h2>Recent activity</h2>
      <p class="hint">Last 5 tool calls. <a class="link" href="/audit">Full audit log</a></p>
      <div class="auto-refresh-row" style="margin-bottom:0.5rem;">
        <label><input type="checkbox" id="autoRefresh" /> Auto-refresh every 30s</label>
      </div>
      <div id="recentAudit">Loading...</div>
    </div>

    <div class="card" id="sessionsCard">
      <h2>Sessions</h2>
      <p class="hint">Active conversation sessions (TTL applies).</p>
      <div id="sessionsList">Loading...</div>
    </div>

    <div class="card" id="keySettingsCard">
      <h2>Key settings</h2>
      <p class="hint">Read-only. Edit .env and restart to change.</p>
      <div class="key-settings-grid" id="keySettingsGrid">—</div>
    </div>

    <div class="card">
      <h2>Status & config</h2>
      <details class="config-details">
        <summary>Show full config (JSON)</summary>
        <pre class="config-block" id="config">Loading...</pre>
      </details>
    </div>
  </div>
  <script>
    let sessionId = localStorage.getItem('openpaw-chat-session') || crypto.randomUUID();
    localStorage.setItem('openpaw-chat-session', sessionId);
    function authQuery() { var m = /token=([^&]+)/.exec(window.location.search); return m ? '?token=' + encodeURIComponent(m[1]) : ''; }
    function authHeaders() { var m = /token=([^&]+)/.exec(window.location.search); return m ? { 'X-Dashboard-Token': m[1] } : {}; }

    (function theme() {
      var theme = localStorage.getItem('openpaw-theme') || 'dark';
      document.getElementById('bodyEl').className = theme === 'light' ? 'theme-light' : '';
      document.getElementById('themeDark').classList.toggle('active', theme !== 'light');
      document.getElementById('themeLight').classList.toggle('active', theme === 'light');
      document.getElementById('themeDark').onclick = function() { localStorage.setItem('openpaw-theme', 'dark'); document.getElementById('bodyEl').className = ''; document.getElementById('themeDark').classList.add('active'); document.getElementById('themeLight').classList.remove('active'); };
      document.getElementById('themeLight').onclick = function() { localStorage.setItem('openpaw-theme', 'light'); document.getElementById('bodyEl').className = 'theme-light'; document.getElementById('themeLight').classList.add('active'); document.getElementById('themeDark').classList.remove('active'); };
    })();
    (function preserveTokenInLinks() {
      var search = window.location.search;
      if (!search) return;
      document.querySelectorAll('.nav a, .quick-actions a').forEach(function(a) {
        var h = a.getAttribute('href');
        if (h && h.startsWith('/') && h.indexOf('?') === -1) a.setAttribute('href', h + search);
      });
    })();

    var autoRefreshTimer = null;
    function setAutoRefresh(on) {
      if (autoRefreshTimer) clearInterval(autoRefreshTimer);
      autoRefreshTimer = null;
      if (on) autoRefreshTimer = setInterval(refreshHealthAndAudit, 30000);
    }
    (function autoRefreshInit() {
      var cb = document.getElementById('autoRefresh');
      cb.checked = localStorage.getItem('openpaw-auto-refresh') === '1';
      setAutoRefresh(cb.checked);
      cb.onchange = function() { var v = cb.checked ? '1' : '0'; localStorage.setItem('openpaw-auto-refresh', v); setAutoRefresh(cb.checked); };
    })();

    function formatUptime(sec) {
      if (sec < 60) return sec + 's';
      if (sec < 3600) return Math.floor(sec / 60) + 'm';
      const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60);
      return h + 'h' + (m ? ' ' + m + 'm' : '');
    }
    function applyConfig(d) {
      if (d.version) document.getElementById('appVersion').textContent = 'v' + d.version;
      document.getElementById('healthStatus').textContent = 'Running';
      document.getElementById('healthUptime').textContent = d.uptimeSeconds != null ? formatUptime(d.uptimeSeconds) : '—';
      document.getElementById('healthModel').textContent = (d.llmModel || '—').split('/').pop() || d.llmModel || '—';
      var ch = ['Web'];
      if (d.hasDiscord) ch.push('Discord');
      if (d.hasTelegram) ch.push('Telegram');
      document.getElementById('healthChannels').textContent = ch.join(', ');
      document.getElementById('config').textContent = JSON.stringify(d, null, 2);
      var grid = document.getElementById('keySettingsGrid');
      grid.innerHTML = '<div class="key-settings-item"><div class="k">Model</div><div class="v">' + (d.llmModel || '—') + '</div></div>' +
        '<div class="key-settings-item"><div class="k">Data dir</div><div class="v">' + (d.dataDir || '—') + '</div></div>' +
        '<div class="key-settings-item"><div class="k">Pack</div><div class="v">' + (d.pack || '—') + '</div></div>' +
        '<div class="key-settings-item"><div class="k">Workspace</div><div class="v">' + (d.workspace || '—') + '</div></div>' +
        '<div class="key-settings-item"><div class="k">Discord</div><div class="v">' + (d.hasDiscord ? 'Yes' : 'No') + '</div></div>' +
        '<div class="key-settings-item"><div class="k">Telegram</div><div class="v">' + (d.hasTelegram ? 'Yes' : 'No') + '</div></div>';
    }
    function refreshSessions() {
      fetch('/api/sessions' + authQuery(), { headers: authHeaders() }).then(r => r.json()).then(function(d) {
        var el = document.getElementById('sessionsList');
        var sessions = d.sessions || [];
        if (!sessions.length) { el.innerHTML = '<p class="hint" style="margin:0;">No active sessions.</p>'; return; }
        el.innerHTML = '<table class="sessions-table"><thead><tr><th>Session</th><th>Messages</th><th>Last activity</th></tr></thead><tbody>' +
          sessions.map(function(s) {
            var key = (s.key || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
            var updated = s.updatedAt ? new Date(s.updatedAt).toLocaleString() : '—';
            return '<tr><td><code style="font-size:0.8rem;">' + key + '</code></td><td>' + (s.messageCount || 0) + '</td><td>' + updated + '</td></tr>';
          }).join('') + '</tbody></table>';
      }).catch(function() {});
    }
    function refreshHealthAndAudit() {
      fetch('/api/config' + authQuery(), { headers: authHeaders() }).then(r => r.json()).then(applyConfig).catch(function() { document.getElementById('healthStatus').textContent = 'Error'; });
      fetch('/api/audit?limit=5' + (authQuery() ? authQuery().replace('?','&') : ''), { headers: authHeaders() }).then(r => r.json()).then(function(d) {
        var el = document.getElementById('recentAudit');
        var entries = d.entries || [];
        if (!entries.length) { el.innerHTML = '<span class="muted">No recent tool calls. Enable OPENPAW_AUDIT_LOG to log activity.</span>'; return; }
        el.innerHTML = '<ul style="margin:0;padding-left:1.2rem;">' + entries.map(function(e) { return '<li><strong>' + (e.tool || '') + '</strong> ' + (e.ts || '') + '</li>'; }).join('') + '</ul>';
      }).catch(function() {});
      refreshSessions();
    }
    fetch('/api/config' + authQuery(), { headers: authHeaders() }).then(r => r.json()).then(applyConfig).catch(function() {
      document.getElementById('config').textContent = 'Could not load config';
      document.getElementById('healthStatus').textContent = 'Error';
    });
    fetch('/api/audit?limit=5' + (authQuery() ? authQuery().replace('?','&') : ''), { headers: authHeaders() }).then(r => r.json()).then(function(d) {
      var el = document.getElementById('recentAudit');
      var entries = d.entries || [];
      if (!entries.length) { el.innerHTML = '<span class="muted">No recent tool calls. Enable OPENPAW_AUDIT_LOG to log activity.</span>'; return; }
      el.innerHTML = '<ul style="margin:0;padding-left:1.2rem;">' + entries.map(function(e) { return '<li><strong>' + (e.tool || '') + '</strong> ' + (e.ts || '') + '</li>'; }).join('') + '</ul>';
    }).catch(function() { document.getElementById('recentAudit').textContent = 'Could not load activity.'; });
    refreshSessions();
    (function() {
      const sel = document.getElementById('engagementSelect');
      const status = document.getElementById('engagementStatus');
      function loadEngagements() {
        fetch('/api/engagements' + authQuery(), { headers: authHeaders() }).then(r => r.json()).then(d => {
          sel.innerHTML = '<option value="">— default —</option>' + (d.list || []).map(n => '<option value="' + n + '">' + n + '</option>').join('');
          if (d.current) sel.value = d.current;
        }).catch(() => {});
      }
      loadEngagements();
      sel.onchange = function() {
        const name = sel.value || '';
        fetch('/api/engagements/current' + authQuery(), { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ name }) })
          .then(r => r.json()).then(d => { status.textContent = d.ok ? 'Saved. Restart to apply.' : (d.error || ''); }).catch(() => { status.textContent = 'Error'; });
      };
    })();
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
      fetch('/api/chat' + authQuery(), { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ text, sessionId }) })
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
          errEl.className = 'paw err';
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
    function authQuery() { var m = /token=([^&]+)/.exec(window.location.search); return m ? '?token=' + encodeURIComponent(m[1]) : ''; }
    function authHeaders() { var m = /token=([^&]+)/.exec(window.location.search); return m ? { 'X-Dashboard-Token': m[1] } : {}; }
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
          fetch('/api/tasks' + authQuery(), { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify({ id, enabled }) })
            .then(r => r.json()).then(() => fetch('/api/tasks' + authQuery(), { headers: authHeaders() }).then(r => r.json()).then(render)).catch(console.error);
        };
      });
    }
    fetch('/api/tasks' + authQuery(), { headers: authHeaders() }).then(r => r.json()).then(render).catch(() => { document.getElementById('list').textContent = 'Failed to load tasks.'; });
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

const AUDIT_HTML = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OpenPaw — Audit log</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; background: #0f0f12; color: #e4e4e7; }
    h1 { font-size: 1.5rem; }
    a { color: #a78bfa; }
    .muted { color: #71717a; font-size: 0.9rem; }
    .tool-bar { display: flex; gap: 0.5rem; align-items: center; margin-bottom: 1rem; }
    .tool-bar select { padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid #3f3f46; background: #18181b; color: #e4e4e7; }
    .tool-bar button { padding: 0.4rem 0.8rem; border-radius: 6px; border: none; background: #a78bfa; color: #0f0f12; cursor: pointer; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th, td { text-align: left; padding: 0.5rem 0.75rem; border-bottom: 1px solid #27272a; }
    th { color: #71717a; font-weight: 500; }
    .entry-tool { color: #a78bfa; }
    .entry-ts { color: #71717a; white-space: nowrap; }
    .entry-args { max-width: 200px; overflow: hidden; text-overflow: ellipsis; }
    .empty { color: #71717a; padding: 1rem 0; }
  </style>
</head>
<body>
  <h1>Audit log</h1>
  <p class="muted"><a href="/" id="backLink">Back to dashboard</a></p>
  <div class="tool-bar">
    <label>Last <select id="limit"><option value="50">50</option><option value="100">100</option><option value="200">200</option></select> entries</label>
    <button type="button" id="refresh">Refresh</button>
    <label style="margin-left:0.75rem;"><input type="checkbox" id="liveMode" /> Live (every 5s)</label>
    <label style="margin-left:0.5rem;"><input type="checkbox" id="streamMode" /> Stream (SSE)</label>
    <span class="muted" id="lastUpdated" style="margin-left:0.5rem;font-size:0.8rem;"></span>
  </div>
  <div id="content">Loading...</div>
  <script>
    function authQuery() { var m = /token=([^&]+)/.exec(window.location.search); return m ? '?token=' + encodeURIComponent(m[1]) : ''; }
    function authHeaders() { var m = /token=([^&]+)/.exec(window.location.search); return m ? { 'X-Dashboard-Token': m[1] } : {}; }
    var liveTimer = null;
    var eventSource = null;
    function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'); }
    function rowHtml(e) {
      return '<tr><td class="entry-ts">' + esc(e.ts) + '</td><td class="entry-tool">' + esc(e.tool) + '</td><td class="entry-args" title="' + esc(e.args) + '">' + esc(e.args).slice(0, 80) + (e.args.length > 80 ? '…' : '') + '</td><td>' + esc(e.resultSummary).slice(0, 100) + (e.resultSummary.length > 100 ? '…' : '') + '</td><td>' + esc(e.channel) + '</td></tr>';
    }
    function render(entries) {
      var content = document.getElementById('content');
      if (!entries.length) { content.innerHTML = '<p class="empty">No audit entries. Enable OPENPAW_AUDIT_LOG in .env to log tool calls.</p>'; return; }
      content.innerHTML = '<table><thead><tr><th>Time</th><th>Tool</th><th>Args</th><th>Result (summary)</th><th>Channel</th></tr></thead><tbody>' +
        entries.map(function(e) { return rowHtml(e); }).join('') + '</tbody></table>';
      var el = document.getElementById('lastUpdated');
      if (el) el.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
    }
    function prependEntry(entry) {
      var content = document.getElementById('content');
      var tbody = content && content.querySelector('tbody');
      if (tbody) {
        var tr = document.createElement('tr');
        tr.innerHTML = '<td class="entry-ts">' + esc(entry.ts) + '</td><td class="entry-tool">' + esc(entry.tool) + '</td><td class="entry-args" title="' + esc(entry.args) + '">' + esc(entry.args).slice(0, 80) + (entry.args.length > 80 ? '…' : '') + '</td><td>' + esc(entry.resultSummary).slice(0, 100) + (entry.resultSummary.length > 100 ? '…' : '') + '</td><td>' + esc(entry.channel) + '</td>';
        tbody.insertBefore(tr, tbody.firstChild);
      } else {
        content.innerHTML = '<table><thead><tr><th>Time</th><th>Tool</th><th>Args</th><th>Result (summary)</th><th>Channel</th></tr></thead><tbody>' + rowHtml(entry) + '</tbody></table>';
      }
      var el = document.getElementById('lastUpdated');
      if (el) el.textContent = 'Last updated: ' + new Date().toLocaleTimeString();
    }
    function load() {
      var limit = document.getElementById('limit').value;
      var q = authQuery();
      fetch('/api/audit?limit=' + limit + (q ? '&' + q.slice(1) : ''), { headers: authHeaders() }).then(function(r) { return r.json(); }).then(function(d) { render(d.entries || []); }).catch(function() { document.getElementById('content').textContent = 'Failed to load audit log.'; });
    }
    function setLive(on) {
      if (liveTimer) clearInterval(liveTimer);
      liveTimer = on ? setInterval(load, 5000) : null;
    }
    function setStream(on) {
      if (eventSource) { eventSource.close(); eventSource = null; }
      if (!on) return;
      var streamUrl = '/api/audit/stream' + authQuery();
      eventSource = new EventSource(streamUrl);
      eventSource.addEventListener('snapshot', function(ev) {
        var data = [];
        try { data = JSON.parse(ev.data); } catch (_) {}
        render(data);
      });
      eventSource.addEventListener('entry', function(ev) {
        try { prependEntry(JSON.parse(ev.data)); } catch (_) {}
      });
      eventSource.onerror = function() {
        document.getElementById('lastUpdated').textContent = 'Stream disconnected';
      };
    }
    document.getElementById('limit').onchange = load;
    document.getElementById('refresh').onclick = load;
    var liveCb = document.getElementById('liveMode');
    var streamCb = document.getElementById('streamMode');
    liveCb.checked = localStorage.getItem('openpaw-audit-live') === '1';
    streamCb.checked = localStorage.getItem('openpaw-audit-stream') === '1';
    if (streamCb.checked) setStream(true); else { setLive(liveCb.checked); load(); }
    liveCb.onchange = function() {
      if (liveCb.checked) { streamCb.checked = false; localStorage.setItem('openpaw-audit-stream', '0'); setStream(false); setLive(true); }
      else setLive(false);
      localStorage.setItem('openpaw-audit-live', liveCb.checked ? '1' : '0');
    };
    streamCb.onchange = function() {
      if (streamCb.checked) { liveCb.checked = false; localStorage.setItem('openpaw-audit-live', '0'); setLive(false); setStream(true); }
      else { setStream(false); load(); }
      localStorage.setItem('openpaw-audit-stream', streamCb.checked ? '1' : '0');
    };
    if (window.location.search) document.getElementById('backLink').href = '/' + window.location.search;
    load();
  </script>
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
  /** When set (dual-agent from CLI), passed to runAgent for delegate context across exchanges. */
  delegateHistoryRef?: DelegateHistoryRef;
}

export async function startDashboard(deps?: DashboardDeps) {
  const config = deps?.config ?? loadConfig();
  const dataDir = config.OPENPAW_DATA_DIR;
  const registry = deps?.registry ?? createToolRegistry();
  let delegateHistoryRef: DelegateHistoryRef | undefined = deps?.delegateHistoryRef;
  if (!deps?.registry) {
    const dangerPatterns =
      config.OPENPAW_DANGER_APPROVAL && config.OPENPAW_DANGER_PATTERNS
        ? config.OPENPAW_DANGER_PATTERNS.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined;
    registry.register(createMemoryTool(dataDir, config.OPENPAW_MEMORY_MAX_ENTRIES));
    registry.register(createRecallTool(dataDir));
    registry.register(createShellTool({ dangerPatterns }));
    registry.register(createReadFileTool(config.OPENPAW_WORKSPACE));
    registry.register(createWriteFileTool(config.OPENPAW_WORKSPACE));
    registry.register(createListDirTool(config.OPENPAW_WORKSPACE));
    registry.register(createSearchInFilesTool(config.OPENPAW_WORKSPACE));
    registry.register(createApplyPatchTool(config.OPENPAW_WORKSPACE));
    registry.register(createWorkspaceContextTool(config.OPENPAW_WORKSPACE));
    registry.register(createRunScriptTool(config.OPENPAW_SCRIPTS_DIR ?? config.OPENPAW_DATA_DIR + "/scripts"));
    registry.register(createNmapScanTool());
    registry.register(createWirelessScanTool());
    registry.register(createWirelessAttackTool());
    registry.register(createNiktoScanTool());
    
    // PENTESTING TOOLS SUITE
    registry.register(PentestTools.createNucleiScanTool());
    registry.register(PentestTools.createGobusterTool());
    registry.register(PentestTools.createFfufTool());
    registry.register(PentestTools.createSQLMapTool());
    registry.register(PentestTools.createWPScanTool());
    registry.register(PentestTools.createLinPEASTool());
    registry.register(PentestTools.createWinPEASTool());
    registry.register(PentestTools.createEnum4LinuxTool());
    registry.register(PentestTools.createHashcatTool());
    registry.register(PentestTools.createHydraTool());
    registry.register(PentestTools.createMetasploitSearchTool());
    registry.register(PentestTools.createMetasploitInfoTool());
    
    // AI INTELLIGENCE & ADVANCED FEATURES
    registry.register(createExploitSuggestionTool());
    registry.register(createNewReportTool());
    registry.register(createAddFindingTool());
    registry.register(createExportReportTool());
    registry.register(createCVELookupTool());
    registry.register(createExploitDBSearchTool());
    registry.register(createCVSSCalculatorTool());
    registry.register(createWordlistGeneratorTool());
    registry.register(createPasswordMutatorTool());
    registry.register(createToolCheckTool());
    registry.register(createSystemReadyTool());
    registry.register(createWhoisTool());
    registry.register(createDNSEnumTool());
    registry.register(createSubdomainFinderTool());
    registry.register(createEmailHarvesterTool());
    registry.register(createTechDetectionTool());
    
    // COMPUTER USE API
    registry.register(createScreenshotComputerTool());
    registry.register(createMouseClickTool());
    registry.register(createMouseMoveTool());
    registry.register(createKeyboardTypeTool());
    registry.register(createKeyboardPressTool());
    registry.register(createComputerUseTool());
    
    registry.register(createDuckDuckGoSearchTool());
    registry.register(createFetchPageTool());
    registry.register(createOpenUrlTool());
    registry.register(createPlayMediaTool(config.OPENPAW_WORKSPACE));
    registry.register(createTranscribeVideoTool(config));
    
    // Enhanced browser session (persistent)
    const browserSessionTool = await createBrowserSessionTool();
    if (browserSessionTool) registry.register(browserSessionTool);
    
    // Screenshot tool for vision-based navigation
    const screenshotTool = await createScreenshotTool();
    if (screenshotTool) registry.register(screenshotTool);
    
    // Vision-based click (requires vision model)
    registry.register(createVisionClickTool());
    
    // yt-dlp integration for video extraction
    registry.register(createYtDlpTool());
    registry.register(createYtDlpDownloadTool());
    
    // Workflow learning and memory
    registry.register(createRecordWorkflowTool(config.OPENPAW_DATA_DIR));
    registry.register(createFindWorkflowTool(config.OPENPAW_DATA_DIR));
    registry.register(createListWorkflowsTool(config.OPENPAW_DATA_DIR));

    // Original browser tools
    const browserAutomateOriginal = await createBrowserAutomateTool();
    if (browserAutomateOriginal) registry.register(browserAutomateOriginal);
    const browserReadOriginal = await createBrowserOpenAndReadTool();
    if (browserReadOriginal) registry.register(browserReadOriginal);
    const llm2 = createSecondLLM(config);
    if (llm2) {
      delegateHistoryRef = { history: [] };
      const maxContext = config.OPENPAW_DELEGATE_MAX_CONTEXT_EXCHANGES ?? 5;
      const buildMessageWithContext = (
        message: string,
        context: Array<{ request: string; response: string }>
      ): string => {
        if (context.length === 0) return message;
        return (
          "Previous exchanges with the primary agent:\n\n" +
          context.map((e) => `Primary asked: ${e.request}\n\nYou replied: ${e.response}`).join("\n\n---\n\n") +
          "\n\n---\n\nNew request: " +
          message
        );
      };
      registry.register(
        createDelegateToAgentTool(
          (message, context) =>
            runAgent(llm2, registry, buildMessageWithContext(message, context), [], {
              excludeToolNames: [DELEGATE_TO_AGENT_NAME],
              systemPromptSuffix: DELEGATE_EXECUTOR_SUFFIX,
            }),
          delegateHistoryRef,
          maxContext
        )
      );
    }
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
    const fullUrl = req.url ?? "";
    const url = fullUrl.split("?")[0];
    const dashboardToken = config.OPENPAW_DASHBOARD_TOKEN?.trim();
    if (dashboardToken) {
      const queryToken = fullUrl.includes("?") ? new URL(fullUrl, "http://localhost").searchParams.get("token") : null;
      const authHeader = req.headers["authorization"];
      const bearer = typeof authHeader === "string" && authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;
      const headerToken = req.headers["x-dashboard-token"] ? String(req.headers["x-dashboard-token"]).trim() : null;
      const token = queryToken ?? bearer ?? headerToken;
      if (token !== dashboardToken) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Dashboard token required. Use ?token=... or Authorization: Bearer ... or X-Dashboard-Token header." }));
        return;
      }
    }
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
    if (url === "/audit") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(AUDIT_HTML);
      return;
    }
    if (url === "/api/config") {
      let version = "0.0.0";
      try {
        const root = join(dirname(fileURLToPath(import.meta.url)), "..");
        const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8")) as { version?: string };
        version = pkg.version ?? "0.0.0";
      } catch {
        /* ignore */
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          version,
          uptimeSeconds: Math.floor(process.uptime()),
          llmBaseUrl: config.OPENPAW_LLM_BASE_URL,
          llmModel: config.OPENPAW_LLM_MODEL,
          dataDir: config.OPENPAW_DATA_DIR,
          pack: config.OPENPAW_PACK ?? null,
          workspace: config.OPENPAW_WORKSPACE ?? ".",
          hasDiscord: !!config.OPENPAW_DISCORD_TOKEN,
          hasTelegram: !!config.OPENPAW_TELEGRAM_BOT_TOKEN,
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
    
    // SETTINGS PAGE
    if (url === "/settings" && req.method === "GET") {
      try {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const filePath = join(__dirname, "views", "settings.html");
        const content = readFileSync(filePath, "utf-8");
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(content);
      } catch (err) {
        res.writeHead(404);
        res.end("Settings page not found");
      }
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
    const engagementsDir = join(dataDir, "engagements");
    const currentEngagementPath = join(dataDir, "current_engagement");
    if (url === "/api/engagements" && req.method === "GET") {
      try {
        let list: string[] = [];
        if (existsSync(engagementsDir)) {
          list = readdirSync(engagementsDir).filter((e) => e && !e.startsWith("."));
        }
        let current: string | null = null;
        if (existsSync(currentEngagementPath)) {
          try {
            const line = readFileSync(currentEngagementPath, "utf-8").split(/\r?\n/)[0]?.trim();
            if (line) current = line;
          } catch {
            /* ignore */
          }
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ list, current }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    if (url === "/api/engagements/current" && req.method === "PUT") {
      try {
        const body = await parseBody(req);
        const name = String(body.name ?? "").trim();
        if (name && !/^[a-zA-Z0-9_-]+$/.test(name)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "name must be alphanumeric, underscore, or hyphen" }));
          return;
        }
        writeFileSync(currentEngagementPath, name ? name + "\n" : "", "utf-8");
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, current: name || null }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    if (url === "/api/sessions" && req.method === "GET") {
      try {
        const sessionPath = join(dataDir, "sessions.json");
        const ttlHours = config.OPENPAW_SESSION_TTL_HOURS ?? 24;
        const ttlMs = ttlHours * 60 * 60 * 1000;
        const sessionsMap = await loadSessions(sessionPath, ttlMs);
        const sessions = [...sessionsMap.entries()].map(([key, s]) => ({
          key,
          updatedAt: s.updatedAt,
          createdAt: s.createdAt,
          messageCount: s.history?.length ?? 0,
          history: s.history || [],
        }));
        sessions.sort((a, b) => b.updatedAt - a.updatedAt);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ sessions }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    
    // Get specific session
    if (url?.match(/^\/api\/sessions\/[^\/]+$/) && req.method === "GET") {
      try {
        const sessionKey = url.split("/").pop() || "";
        const sessionPath = join(dataDir, "sessions.json");
        const ttlHours = config.OPENPAW_SESSION_TTL_HOURS ?? 24;
        const ttlMs = ttlHours * 60 * 60 * 1000;
        const sessionsMap = await loadSessions(sessionPath, ttlMs);
        const session = sessionsMap.get(sessionKey);
        
        if (!session) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Session not found" }));
          return;
        }
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ session }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    
    // Delete session
    if (url?.match(/^\/api\/sessions\/[^\/]+$/) && req.method === "DELETE") {
      try {
        const sessionKey = url.split("/").pop() || "";
        const sessionPath = join(dataDir, "sessions.json");
        const ttlHours = config.OPENPAW_SESSION_TTL_HOURS ?? 24;
        const ttlMs = ttlHours * 60 * 60 * 1000;
        const sessionsMap = await loadSessions(sessionPath, ttlMs);
        
        sessionsMap.delete(sessionKey);
        
        const { saveSessions } = await import("./session-store.js");
        await saveSessions(sessionPath, sessionsMap, ttlMs);
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    
    // Rename session
    if (url?.match(/^\/api\/sessions\/[^\/]+$/) && req.method === "PATCH") {
      try {
        const sessionKey = url.split("/").pop() || "";
        const body = await parseBody(req);
        const title = String(body.title ?? "").trim();
        
        const sessionPath = join(dataDir, "sessions.json");
        const ttlHours = config.OPENPAW_SESSION_TTL_HOURS ?? 24;
        const ttlMs = ttlHours * 60 * 60 * 1000;
        const sessionsMap = await loadSessions(sessionPath, ttlMs);
        const session = sessionsMap.get(sessionKey);
        
        if (!session) {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Session not found" }));
          return;
        }
        
        // Store title in session metadata (we'll need to extend session type)
        (session as any).title = title;
        
        const { saveSessions } = await import("./session-store.js");
        await saveSessions(sessionPath, sessionsMap, ttlMs);
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    
    if (url === "/api/audit/stream" && req.method === "GET") {
      const auditPath = config.OPENPAW_AUDIT_LOG && config.OPENPAW_AUDIT_LOG_PATH ? config.OPENPAW_AUDIT_LOG_PATH : null;
      function readAuditEntries(): Array<{ ts: string; tool: string; args: string; resultSummary: string; channel?: string }> {
        const out: Array<{ ts: string; tool: string; args: string; resultSummary: string; channel?: string }> = [];
        if (!auditPath || !existsSync(auditPath)) return out;
        try {
          const raw = readFileSync(auditPath, "utf-8");
          const lines = raw.split(/\r?\n/).filter((l) => l.trim());
          for (const line of lines) {
            try {
              const obj = JSON.parse(line) as { ts?: string; tool?: string; args?: string; resultSummary?: string; channel?: string };
              out.push({
                ts: obj.ts ?? "",
                tool: obj.tool ?? "",
                args: obj.args ?? "",
                resultSummary: obj.resultSummary ?? "",
                channel: obj.channel,
              });
            } catch {
              /* skip */
            }
          }
        } catch {
          /* ignore */
        }
        return out;
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const entries = readAuditEntries();
      const snapshot = entries.slice(-50).reverse();
      res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot)}\n\n`);
      let lastCount = entries.length;
      const interval = setInterval(() => {
        if (res.writableEnded) return;
        const next = readAuditEntries();
        if (next.length > lastCount) {
          for (let i = lastCount; i < next.length; i++) {
            try {
              res.write(`event: entry\ndata: ${JSON.stringify(next[i])}\n\n`);
            } catch {
              clearInterval(interval);
              return;
            }
          }
          lastCount = next.length;
        }
      }, 1500);
      req.on("close", () => {
        clearInterval(interval);
      });
      return;
    }
    if (url?.startsWith("/api/audit") && req.method === "GET") {
      try {
        const limit = Math.min(500, Math.max(1, parseInt(new URL(req.url!, `http://localhost`).searchParams.get("limit") || "50", 10) || 50));
        const entries: Array<{ ts: string; tool: string; args: string; resultSummary: string; channel?: string }> = [];
        if (config.OPENPAW_AUDIT_LOG && config.OPENPAW_AUDIT_LOG_PATH && existsSync(config.OPENPAW_AUDIT_LOG_PATH)) {
          const raw = readFileSync(config.OPENPAW_AUDIT_LOG_PATH, "utf-8");
          const lines = raw.split(/\r?\n/).filter((l) => l.trim());
          for (const line of lines.slice(-limit)) {
            try {
              const obj = JSON.parse(line) as { ts?: string; tool?: string; args?: string; resultSummary?: string; channel?: string };
              entries.push({
                ts: obj.ts ?? "",
                tool: obj.tool ?? "",
                args: obj.args ?? "",
                resultSummary: obj.resultSummary ?? "",
                channel: obj.channel,
              });
            } catch {
              /* skip invalid line */
            }
          }
          entries.reverse();
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ entries }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
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
          reply = await runAgent(llm, registry, text, [], {
            ...(voice ? { voice: true } : {}),
            ...(config.OPENPAW_ACCESSIBILITY_MODE ? { systemPromptSuffix: ACCESSIBILITY_PROMPT_SUFFIX } : {}),
            maxTurns: config.OPENPAW_AGENT_MAX_TURNS,
            completionReminder: config.OPENPAW_AGENT_COMPLETION_REMINDER,
            verifyCompletion: config.OPENPAW_AGENT_VERIFY_COMPLETION,
            ...(delegateHistoryRef != null ? { delegateHistoryRef } : {}),
          });
        }

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ reply }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    
    // CONFIG API - Get current configuration
    if (url === "/api/config" && req.method === "GET") {
      try {
        const configManager = getConfigManager();
        const currentConfig = configManager.get();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(currentConfig));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    
    // CONFIG API - Save configuration
    if (url === "/api/config" && req.method === "POST") {
      try {
        const body = await parseBody(req);
        const configManager = getConfigManager();
        configManager.update(body);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: "Configuration saved. Restart OpenPaw for changes to take effect." }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    
    // CONFIG API - Import from .env
    if (url === "/api/config/import-env" && req.method === "POST") {
      try {
        const configManager = getConfigManager();
        const envPath = join(process.cwd(), ".env");
        configManager.importFromEnv(envPath);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: "Settings imported from .env" }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    
    // CONFIG API - Reset to defaults
    if (url === "/api/config/reset" && req.method === "POST") {
      try {
        const configManager = getConfigManager();
        configManager.reset();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ success: true, message: "Settings reset to defaults" }));
      } catch (err) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }));
      }
      return;
    }
    
    // STATIC FILE - settings.js
    if (url === "/static/settings.js" && req.method === "GET") {
      try {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const filePath = join(__dirname, "views", "settings.js");
        const content = readFileSync(filePath, "utf-8");
        res.writeHead(200, { "Content-Type": "application/javascript" });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end("Not found");
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
