# OpenPaw vs OpenClaw — критична съпоставка (калибър Kali)

Кратко: къде OpenPaw **стига** нивото на OpenClaw и къде **остава назад**. Цел: честна оценка за приоритизация.

**Актуализация:** Session persistence, тестове (tools + audit), skill packs, SOUL.md (system prompt от файл), session/routing конфиг (TTL, MAX_HISTORY), dashboard (workspace selector + audit log), и опционално voice в Telegram (voice message → STT → агент → отговор) вече са имплементирани и затварят част от предишните липси.

---

## 1. Къде OpenPaw се доближава до OpenClaw

| Аспект | OpenPaw | OpenClaw | Вердикт |
|--------|---------|----------|--------|
| **Self-hosted gateway** | CLI + web + Discord + Telegram в един процес; един конфиг (.env). | Отделен gateway сървър, много канали (WhatsApp, Slack, Signal, iMessage, webchat), JSON config. | OpenPaw покрива основното за Kali: един бокс, един процес, мулти-канал. Липсват канали (WhatsApp, Slack, Signal, iMessage). |
| **Agent + tools** | LLM + tool calling (и ReAct fallback), plan-then-execute в system prompt; **SOUL.md** / `.openpaw/system-prompt.md` (append/replace). | Agent с tools, SOUL.md шаблони, skills. | Семантиката и SOUL.md са на калибър. |
| **Code tools** | read_file, write_file, list_dir, search_in_files, **apply_patch** (OpenClaw-style). | read, write, edit, apply_patch, exec, process. | apply_patch и файловите операции са на същия калибър. OpenPaw няма отделен „edit“ (има write_file + apply_patch). |
| **Shell / exec** | run_shell с full control (Kali-first), run_script за скриптове. | exec с timeout, background, cleanup; elevated per-channel. | За Kali full control + run_script е достатъчно. Липсва: explicit elevated-by-channel, sandbox. |
| **Kali-специфични tools** | nmap_scan, wireless_scan, wireless_attack, nikto_scan + run_script. | Няма вградени Kali tools; разширяемост чрез skills/extensions. | Тук OpenPaw е **пред** OpenClaw за Kali: готови wrappers, без нужда от skill пакети за базов recon/wireless/web. |
| **Контекст / workspace** | OPENPAW_WORKSPACE, engagements (openpaw use), TARGET.md / context.md при първо съобщение; **session persistence** (sessions.json, TTL, debounced save). | agent.workspace, session store, memory search, extra paths. | Engagements + TARGET.md + session persistence покриват типичния сценарий. Опционално: knowledge_search за RAG. |
| **Audit / безопасност** | Audit log по tool call; danger_approval (patterns + approve). | Governance с identity, scope, rate limit, injection, audit (напр. GatewayStack). | OpenPaw има audit + одобрение за опасни команди. OpenClaw има по-строга governance и sandbox. |
| **Background задачи** | run_shell / nmap_scan с background: true; уведомление в канала при готовност. | exec.backgroundMs, cron, webhooks. | И двете покриват „дълга задача + уведомление“. OpenClaw има още cron и webhooks. |
| **Кратки команди** | /recon, /wireless, /webscan в router → псевдо user message. | Slash commands по канал (напр. Slack). | Идеята е същата; OpenPaw го прави минимално и универсално за всички канали. |
| **Retry LLM** | OPENPAW_LLM_RETRY_COUNT, exponential backoff при timeout/5xx. | Има в gateway/LLM слой. | На същия калибър. |

**Обобщение:** За **Kali сценарий** (recon, wireless, web scan, един оператор, CLI + Telegram/Discord) OpenPaw вече покрива голяма част от това, което би очаквал от „OpenClaw-caliber“: gateway, мулти-канал, код tools, apply_patch, Kali tools, engagements, TARGET.md, audit, danger approval, background, retry. Калибърът е близо там, където целта е **минимален, но пълен агент за Kali в един процес**.

---

## 2. Къде OpenPaw остава назад (критично)

### 2.1 Архитектура и разширяемост

- **OpenClaw:** Plugin система (Provider, Tool, Memory, Channel); extensions в workspace пакети; hot-load по config.  
- **OpenPaw:** **Skill packs** (OPENPAW_PACK, packs.json): зареждане на подмножество tools + system prompt suffix без промяна на core; MCP за допълнителни tools. Каналите остават в кода (CLI, web, Discord, Telegram).  

**Статус:** Skill packs покриват „набор от tools по име“; пълно plugin discovery и channel-as-plugin не са.

### 2.2 Конфигурация и оперативен контрол

- **OpenClaw:** Един JSON/JSON5 конфиг: identity, agent (workspace, model, fallbacks), auth profiles, logging, routing (queue, groupChat), session (scope, reset, store, maintenance), tools (allow/deny, exec timeout, elevated per channel), всеки канал с политики (allowFrom, groups, requireMention), cron, webhooks, gateway (port, auth, control UI), skills.  
- **OpenPaw:** .env променливи; **session/routing** (TTL, MAX_HISTORY) в .env; **dashboard** с workspace selector и audit log като прост control/status UI; per-channel allow (OPENPAW_*_ALLOWED_IDS).  

**Статус:** За един оператор на Kali .env + dashboard са достатъчни. Единен JSON конфиг и requireMention не са имплементирани.

### 2.3 Session и памет

- **OpenClaw:** Session store (файл/DB), session scope (per-sender, per-channel-peer), reset (daily, idle, triggers), maintenance (prune, rotate), memory search (embedding + extra paths).  
- **OpenPaw:** Session manager с summarization и keepRaw; **файлово-backed session store** (sessions.json, TTL, OPENPAW_SESSION_TTL_HOURS / OPENPAW_SESSION_MAX_HISTORY). Опционално knowledge_search за RAG.  

**Статус:** Session persistence е имплементиран. При рестарт историята се възстановява. Memory search е частично покрит с knowledge tools.

### 2.4 Сигурност и изолация

- **OpenClaw:** Sandbox (Docker, per-session, read-only root, no network), elevated tools само за allowFrom по канал, governance (identity, scope, rate limit, injection, audit).  
- **OpenPaw:** Full shell control на Linux, danger_approval по patterns; няма sandbox, няма rate limit, няма injection detection.  

**Критика:** За Kali с „един доверен оператор“ това е приемлив компромис. За по-строга среда **sandbox и explicit elevated-by-channel** биха довели OpenPaw по-близо до OpenClaw.

### 2.5 Канали и UX

- **OpenClaw:** WhatsApp, Telegram, Discord, Slack, Signal, iMessage, webchat; групови чатове с requireMention; ack reaction, typing interval, message prefix.  
- **OpenPaw:** CLI, web, Discord, Telegram, scheduler; няма WhatsApp/Slack/Signal/iMessage; няма групова политика (requireMention и т.н.).  

**Критика:** За „оперативен канал от телефон“ Telegram/Discord са достатъчни. За **multi-team / enterprise** липсват Slack и по-богати channel policies.

### 2.6 Медия и voice

- **OpenClaw:** Media pipeline (audio/video transcription с избираем provider), конфигурируемо в config.  
- **OpenPaw:** Voice в dashboard (STT/TTS); **Telegram voice message** → изтегляне на файл → STT (Whisper/ElevenLabs) → агент → отговор като текст в чата.  

**Статус:** Voice в браузъра и в Telegram (гласово съобщение → транскрипция → агент) са покрити за полеви сценарии.

### 2.7 Агент templates и identity

- **OpenClaw:** SOUL.md за агент personality/instructions; identity (name, theme, emoji) в config.  
- **OpenPaw:** **SOUL.md** или `.openpaw/system-prompt.md` в workspace; OPENPAW_SYSTEM_PROMPT_MODE=append/replace.  

**Статус:** Per-workspace/engagement инструкции чрез файл са налични.

### 2.8 Тестове и документация

- **OpenClaw:** Repo с docs, конфиг примери, разширяема структура.  
- **OpenPaw:** README, ROADMAP, BUILD-PLAN, kali-commands, PERFECTION-PLAN; **node --test** за run_script, nmap_scan, shell, audit, session-store.  

**Статус:** Базови тестове за критичния път са налични.

---

## 3. Резюме — калибър

- **Kali-first, един оператор, CLI + Telegram/Discord:** OpenPaw вече е **близо до калибъра на OpenClaw** по покритие: gateway, tools, code editing, Kali tools, engagements, TARGET.md, audit, danger approval, background, retry. Разликата е в простотата (един процес, .env) срещу богатството на OpenClaw (много канали, governance, sandbox, config).  

- **Оставащи разлики (по избор за „като OpenClaw“):**  
  1. **Разширяемост:** Skill packs (OPENPAW_PACK) са там; пълно plugin discovery и channel-as-plugin не са.  
  2. **Конфиг:** Session/routing (TTL, MAX_HISTORY) са в .env; няма един JSON конфиг с всички политики.  
  3. **Сигурност (по избор):** sandbox и elevated-by-channel за по-строги среди.  
  4. **Канали:** няма WhatsApp, Slack, Signal, iMessage; има CLI, web, Discord, Telegram (+ voice в Telegram).  

- **Специфично за Kali:** По отношение на **готови Kali tools**, **engagements + TARGET.md**, **session persistence**, **SOUL.md**, **audit + dashboard**, **voice в Telegram** и **тестове** OpenPaw е на калибър или пред OpenClaw за типичен един оператор / полеви сценарии. OpenClaw води по много канали, governance и единен JSON конфиг.

---

## 4. Dashboard / Control UI — съпоставка и подобрения

### Какво има OpenClaw (официален Control UI + community dashboards)

**Официален Control UI (Gateway):**
- Chat с stream, abort, inject; live tool output
- Config: schema + form, raw JSON, apply + restart
- Logs: live tail, filter, export
- Debug: status, health, models, event log, RPC
- Cron: list/add/edit/run, run history
- Sessions: list, per-session overrides
- Channels: status, QR login, per-channel config
- Skills: status, enable/disable, install
- Exec approvals, Nodes, Update (package + restart)
- Auth: token/password, device pairing

**Community (mudrii/openclaw-dashboard):**
- 11 панела: health, cost cards, cron, active sessions, token usage, sub-agent activity, charts, models/skills/git, AI chat
- Темы (6), auto-refresh, glass morphism

### Какво има OpenPaw dashboard (сега)

| Функция | Статус |
|--------|--------|
| Chat (web) | Да |
| Voice (отделна страница) | Да |
| Workspace (engagement) selector | Да |
| Recent activity (последни 5 tool calls) | Да |
| Audit log (пълен преглед) | Да |
| Scheduled tasks (списък, enable/disable) | Да |
| Health карта (status, uptime, model, channels) | Да |
| Quick actions (Voice, Tasks, Audit, History) | Да |
| Config (JSON, сгъваем) | Да |
| Version в header | Да |
| **Sessions** (списък активни сесии, message count, last activity) | Да |
| **Theme picker** (Dark / Light в header, localStorage) | Да |
| **Auto-refresh** (на всеки 30s за health + activity + sessions) | Да |
| **Key settings** (read-only: model, dataDir, pack, workspace, Discord, Telegram) | Да |
| **Auth** (OPENPAW_DASHBOARD_TOKEN → ?token=… / Bearer / X-Dashboard-Token) | Да |

### Подобрения за бъдеще (по желание)

- ~~**Live logs**~~ — имплементирано: на страница Audit log има „Live (every 5s)“ (poll) и „Stream (SSE)“; GET /api/audit/stream изпраща snapshot + нови записи в реално време.
- ~~Sessions list~~ — имплементирано.
- ~~Theme picker~~ — имплементирано (dark/light).
- ~~Auto-refresh~~ — имплементирано (30s, с toggle).
- ~~Config form~~ — имплементиран read-only Key settings; пълен form/редактор по желание.
- ~~Auth за dashboard~~ — имплементиран опционален OPENPAW_DASHBOARD_TOKEN.
