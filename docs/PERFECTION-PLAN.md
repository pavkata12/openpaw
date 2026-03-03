# План „До перфектност“ — OpenPaw

Подробен план за затваряне на критичните пропуски спрямо OpenClaw и за стабилност: session persistence, тестове, skill packs, конфиг, agent identity.

**Препратки:** [OPENPAW-VS-OPENCLAW.md](OPENPAW-VS-OPENCLAW.md) (критична съпоставка), [BUILD-PLAN.md](../BUILD-PLAN.md) (фази 1–4).

---

## Приоритети (по ред на изпълнение)

| # | Задача | Файлове | Защо първо |
|---|--------|---------|-------------|
| A.1 | Session persistence | session.ts, session-store.ts, router, config | История оцелява при рестарт; критично за engagements |
| A.2 | Тестове (tools + audit) | tests/, package.json | Увереност при рефакторинг и нови фичи |
| A.3 | Skill packs зареждане | packs.ts, config, cli, dashboard | Разширяемост без промяна на core |
| A.4 | Agent identity (system prompt от файл) | llm.ts, config, router | Per-engagement тон и инструкции |
| A.5 | Конфиг за session/routing | openpaw.json или .env разширен | TTL, MAX_HISTORY, per-channel (бъдещо) |

---

# ФАЗА A — Session persistence

**Цел:** Историята на разговорите да се записва на диск и да се възстановява при рестарт.

---

## A.1 Session store (файлово backed)

| Поле | Стойност |
|------|----------|
| **ID** | A.1 |
| **Зависимости** | — |

**Описание:** Session manager да чете/записва сесиите в `{OPENPAW_DATA_DIR}/sessions.json`. При старт зареждане; при appendMessage — запис (debounced 500–1000 ms), за да не пишем при всяко съобщение.

**Файлове:**

1. **`src/session-store.ts`** (нов)
   - `loadSessions(filePath: string): Promise<Map<SessionKey, Session>>` — четене от JSON файл; при липса или грешка връща празен Map. Формат: `{ "channel:userId": { key, history, createdAt, updatedAt } }`. Премахвай сесии с `updatedAt` по-стар от TTL.
   - `saveSessions(filePath: string, sessions: Map<SessionKey, Session>): Promise<void>` — запис само на не-изтекли сесии; създава директорията ако липсва.
   - Експорт на типове съвместими с `Session` от session.ts (или импорт от session.ts).

2. **`src/session.ts`**
   - Разшири `SessionManagerOptions` с `sessionStorePath?: string` (опционално; ако липсва — само in-memory както досега).
   - В `createSessionManager`: ако `sessionStorePath` е зададен, при инициализация извикай `loadSessions` и попълни `sessions` Map. При `appendMessage` след промяна на историята да се вика debounced save (напр. `saveSessions(storePath, sessions)` след 800 ms без нов append).
   - Важно: при save да се подава текущото съдържание на Map-а (не само една сесия), за да не се презаписват паралелни сесии.

3. **`src/router.ts`**
   - При създаване на router да се подава `config?.OPENPAW_DATA_DIR`; router да подава при `createSessionManager` опция `sessionStorePath: join(config.OPENPAW_DATA_DIR, "sessions.json")` ако dataDir е зададен. (Алтернатива: sessionStorePath да се подава от cli/dashboard при извикване на createRouter — т.е. от caller.)

4. **`src/config.ts`**
   - Не е задължително нови променливи; използва се `OPENPAW_DATA_DIR`. Опционално: `OPENPAW_SESSION_STORE` (default `sessions.json` в dataDir).

**Критерии за приемане:**

- [ ] При рестарт на процеса съществуващите сесии (с неизтекъл TTL) се зареждат от файл.
- [ ] Нови съобщения в съществуваща сесия се записват и след рестарт историята е налична.
- [ ] При липса на файл или при `sessionStorePath` undefined поведението е както досега (само in-memory).
- [ ] Изтекнали сесии (по TTL) не се записват обратно и не се зареждат.

---

# ФАЗА B — Тестове

**Цел:** Базови unit/integration тестове за tools и audit, за да не счупим критичния път.

---

## B.1 Test runner и тестове за tools

| Поле | Стойност |
|------|----------|
| **ID** | B.1 |
| **Зависимости** | — |

**Описание:** Добавяне на Node.js built-in test runner (`node --test`) или Vitest; поне един тест файл за 2–3 tools (напр. run_script path resolution, nmap_scan build args, shell dangerPatterns) и за audit `logToolCall`.

**Файлове:**

1. **`package.json`**
   - Добави скрипт: `"test": "node --test tests/"` или `"test": "vitest run"`. Препоръка: `node --test` за нулеви допълнителни зависимости.

2. **`tests/tools/run-script.test.ts`** (или .mjs ако без ts-node)
   - Тест: `resolveScriptPath` не позволява path traversal (..); тест: при валидно име върнатата пътека е под scriptsDir. Ако функциите не са експортни, тествай чрез `createRunScriptTool` с временна директория и mock script.

3. **`tests/tools/nmap-scan.test.ts`**
   - Тест: `buildNmapArgs("192.168.1.1", "quick")` връща очакваните аргументи и timeout. (Трябва да експортнеш `buildNmapArgs` от nmap-scan.ts или да тестваш чрез execute с mock exec.)

4. **`tests/tools/shell.test.ts`**
   - Тест: при `dangerPatterns: ["sudo"]` и команда "sudo rm -rf x" execute връща резултат съдържащ `OPENPAW_NEEDS_APPROVAL_PREFIX`. Тест: при команда без pattern изпълнението продължава (може с mock exec).

5. **`tests/audit.test.ts`**
   - Тест: при извикване на `logToolCall` с временен файл се записва ред с очакваните полета (timestamp, toolName, args, resultSummary).

**Критерии за приемане:**

- [x] `npm test` минава успешно.
- [x] Покрити са поне: run_script path safety, nmap args, shell danger approval, audit log write.

---

## B.2 Тестове за session store (след A.1)

| Поле | Стойност |
|------|----------|
| **ID** | B.2 |
| **Зависимости** | A.1 |

**Описание:** Тестове за loadSessions/saveSessions: празен файл, валидни сесии, изтекли сесии се филтрират.

**Файлове:** `tests/session-store.test.ts`

**Критерии за приемане:**

- [x] Save след load запазва данните; при load с изтекли сесии те не се връщат.

---

# ФАЗА C — Skill packs / разширяемост

**Цел:** Зареждане на набор от tools (и опционално system prompt suffix) по име на pack без да се пипа cli.ts за всеки нов tool.

---

## C.1 Skill packs — дефиниция и зареждане

| Поле | Стойност |
|------|----------|
| **ID** | C.1 |
| **Зависимости** | — |

**Описание:** Файл или модул `packs.ts` дефинира типове `Pack = { name, tools: string[], systemPromptSuffix?: string }`. Конфигурация: или в код (default packs: recon, wireless, web, full), или в `{dataDir}/packs.json`. Функция `getPack(name): Pack | null`, `listPacks(): string[]`. При bootstrap ако е зададен `OPENPAW_PACK` (напр. `recon`), да се регистрират само tools от този pack (или default + pack tools). За system prompt: ако pack има `systemPromptSuffix`, да се подава към runAgent като разширение на system съобщението.

**Файлове:**

1. **`src/packs.ts`** (нов)
   - Типове: `Pack = { name: string; tools: string[]; systemPromptSuffix?: string }`.
   - Default packs в памет: recon = [nmap_scan, run_script], wireless = [wireless_scan, wireless_attack, run_script], web = [nikto_scan, run_script], full = [] (празно = всички налични).
   - `loadPacks(dataDir: string): Promise<Map<string, Pack>>` — ако има `packs.json`, merge с defaults.
   - `getPack(name: string, dataDir?: string): Promise<Pack | null>`, `listPacks(dataDir?: string): Promise<string[]>`.

2. **`src/config.ts`**
   - `OPENPAW_PACK`: optional string (име на pack). Ако зададено, bootstrap използва само tools от този pack (или всички ако pack е "full"/празно).

3. **`src/cli.ts`** и **`src/dashboard.ts`**
   - След регистрация на всички вградени tools, ако `config.OPENPAW_PACK` е зададено и не е "full", филтрирай registry да съдържа само tools от pack (или създай нов registry и регистрирай само pack tools). За dashboard аналогично.
   - При runAgent да се подава `systemPromptSuffix` от pack-а ако има.

4. **`src/agent.ts`** / **`src/llm.ts`**
   - RunAgentOptions вече може да има `systemPromptSuffix?: string`; в llm при изграждане на system content да се добави този suffix.

**Критерии за приемане:**

- [x] При `OPENPAW_PACK=recon` в .env се зареждат само nmap_scan и run_script (и базовите remember/recall/run_shell винаги).
- [x] При `OPENPAW_PACK=full` или липса на OPENPAW_PACK се използват всички tools.
- [x] Документация в README за packs и примерен packs.json (`.openpaw/packs.json.example`).

*Бележка:* Dashboard при старт от gateway получава вече филтриран registry от bootstrap; standalone dashboard (без gateway) зарежда всички tools.

---

# ФАЗА D — Agent identity / system prompt от файл

**Цел:** Възможност за различен system prompt или инструкции per workspace/engagement (SOUL.md стил).

---

## D.1 System prompt от файл

| Поле | Стойност |
|------|----------|
| **ID** | D.1 |
| **Зависимости** | 3.1 (engagements) |

**Описание:** Ако в workspace съществува файл `SOUL.md` или `.openpaw/system-prompt.md`, съдържанието му да се използва като допълнение или замяна на базовия system prompt (конфигурируемо: replace vs append). Конфиг: `OPENPAW_SYSTEM_PROMPT_MODE`: `default` | `append` | `replace`. При append: базов prompt + "\n\n" + съдържание на файла. При replace: само съдържанието на файла (риск; за напреднали).

**Файлове:**

1. **`src/config.ts`**
   - `OPENPAW_SYSTEM_PROMPT_MODE`: z.enum(["default", "append", "replace"]).default("default").

2. **`src/router.ts`** или **`src/agent.ts`**
   - Преди извикване на runAgent: ако има workspace (config.OPENPAW_WORKSPACE) и mode не е default, провери за SOUL.md или .openpaw/system-prompt.md; прочети съдържанието и подай като `systemPromptSuffix` (при append) или като пълен system prompt (при replace — изисква промяна в llm да приема пълен system content от опции).

3. **`src/llm.ts`**
   - В adapter.chat да приема опция `systemPromptOverride?: string` (при replace) или да използва вече `systemPromptSuffix`. При override да се използва като единствен system content.

**Критерии за приемане:**

- [x] При наличие на SOUL.md в workspace и mode=append, агентът получава базов prompt + съдържанието на SOUL.md.
- [x] Документация за SOUL.md и режимите (README, .env.example).

---

# ФАЗА E — Конфиг за session и routing (опционално)

**Цел:** TTL и MAX_HISTORY да са конфигурируеми; подготовка за per-channel policies.

---

## E.1 Session/routing опции в .env

| Поле | Стойност |
|------|----------|
| **ID** | E.1 |
| **Зависимости** | A.1 |

**Описание:** Добави в config: `OPENPAW_SESSION_TTL_HOURS` (default 24), `OPENPAW_SESSION_MAX_HISTORY` (default 50). Session manager да ги чете от опции. Препоръка: тези стойности да се подават от config при createSessionManager.

**Файлове:** `src/config.ts`, `src/session.ts`, `src/router.ts`

**Критерии за приемане:**

- [x] При зададени TTL и MAX_HISTORY сесията изтича и се подрязва според тях.

---

# Обобщение — какво правим първо

1. **A.1 Session persistence** — най-голям ефект за потребителя, самостоятелна задача.
2. **B.1 Тестове** — да нямаме регресии след това.
3. **C.1 Skill packs** — разширяемост без да пипаме core при всеки нов pack.
4. **D.1 SOUL.md** — по-добър контрол върху агента per engagement.
5. **E.1** — фина настройка на session.

След приключване на A.1 и B.1 OpenPaw вече е значително по-близо до „перфектност“ по стабилност и възстановяемост; C.1 и D.1 го правят по-разширяем и конфигурируем.
