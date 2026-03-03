# План за изграждане на OpenPaw AGI за Kali Linux

Детайлен, стъпков план за изграждане на всички функции без пропуски. Всяка задача има идентификатор, файлове за промяна, зависимости и критерии за приемане.

**Препратки:** [KALI-AGI-PLAN.md](KALI-AGI-PLAN.md) (способности и Kali tools), [ROADMAP.md](ROADMAP.md) (визия).

---

## Легенда

- **ID** — уникален номер на задачата (за проследяване).
- **Зависимости** — номера на задачи, които трябва да са готови преди тази.
- **Файлове** — `src/...` или път спрямо корена на проекта.
- **[ ]** — чекбокс за отбелязване при завършване.

---

# ФАЗА 1 — Основа: audit, run_script, документация

Цел: audit log за всички tool извиквания, run_script за преддефинирани скриптове, документация с примерни Kali команди.

---

## 1.1 Конфигурация за audit и scripts

| Поле | Стойност |
|------|-----------|
| **ID** | 1.1 |
| **Зависимости** | — |

**Описание:** Добавяне на env променливи за audit log и за директорията със скриптове.

**Файлове за промяна:**

1. **`src/config.ts`**
   - В `EnvSchema` добави:
     - `OPENPAW_AUDIT_LOG`: `z.string().default("false").transform(v => v === "1" \|\| v === "true")` — дали да се записват tool извикванията.
     - `OPENPAW_AUDIT_LOG_PATH`: `z.string().optional()` — път до лог файла (ако липсва: `{OPENPAW_DATA_DIR}/audit.log`).
     - `OPENPAW_SCRIPTS_DIR`: `z.string().default("")` — директория със скриптове; ако празно: `{OPENPAW_DATA_DIR}/scripts` или `~/.openpaw/scripts`.
   - В `loadConfig()` при резолвиране на `OPENPAW_DATA_DIR` да се резолвва и `OPENPAW_SCRIPTS_DIR` (ако е относителен — спрямо cwd или dataDir) и да се върне в обекта.

**Критерии за приемане:**

- [ ] `OPENPAW_AUDIT_LOG`, `OPENPAW_AUDIT_LOG_PATH`, `OPENPAW_SCRIPTS_DIR` са в типа `Config`.
- [ ] При липса на `OPENPAW_AUDIT_LOG_PATH` се използва `{dataDir}/audit.log`.
- [ ] При липса на `OPENPAW_SCRIPTS_DIR` се използва `{dataDir}/scripts`.
- [ ] В `.env.example` са добавени коментари и примери за трите променливи.

---

## 1.2 Audit log — запис на tool извиквания

| Поле | Стойност |
|------|-----------|
| **ID** | 1.2 |
| **Зависимости** | 1.1 |

**Описание:** При всяко изпълнение на tool (в agent loop) да се записва ред в audit лог файла, ако `OPENPAW_AUDIT_LOG` е true.

**Файлове за промяна / създаване:**

1. **`src/audit.ts`** (нов файл)
   - Функция `appendAuditLog(options: { dataDir: string; auditPath?: string; enabled: boolean })` или директно приемане на `config`.
   - Функция `logToolCall(params: { toolName: string; args: Record<string, unknown>; resultSummary?: string; channel?: string })`.
   - Записва един ред на извикване: timestamp (ISO), toolName, JSON.stringify(args) (или truncated), resultSummary (първи N символа от result), channel. Формат: например JSON lines (един JSON обект на ред) или CSV — по избор, да е четим.
   - Създава директорията на файла ако липсва; append, не overwrite.

2. **`src/agent.ts`**
   - Импорт на audit модула.
   - В цикъла, след като се изчисли `result` за всеки tool call:
     - Ако config (или подадена опция) казва че audit е enabled, извиквай `logToolCall({ toolName: tc.name, args, resultSummary: result.slice(0, 200), channel })`.
   - Проблем: в `runAgent` нямаме достъп до config. Варианти: (A) подаваме `config` или `auditOptions` в `RunAgentOptions`; (B) audit се извиква от router/caller, който има config. Препоръка: (A) разшири `RunAgentOptions` с `audit?: { enabled: boolean; path: string }` и в `cli.ts`/`router.ts` при извикване на `runAgent` подавай от config.

**Критерии за приемане:**

- [ ] При `OPENPAW_AUDIT_LOG=true` всеки tool call записва един ред в audit лога.
- [ ] Редът съдържа поне: timestamp, tool name, args (или truncated), кратко result summary.
- [ ] При `OPENPAW_AUDIT_LOG=false` нищо не се записва.
- [ ] Няма crash при липсваща директория — тя се създава.

---

## 1.3 Run_script tool

| Поле | Стойност |
|------|-----------|
| **ID** | 1.3 |
| **Зависимости** | 1.1 |

**Описание:** Tool `run_script` — изпълнява скрипт от `OPENPAW_SCRIPTS_DIR` по име с опционални аргументи. Само скриптове в тази директория; няма path traversal извън нея.

**Файлове за промяна / създаване:**

1. **`src/tools/run-script.ts`** (нов файл)
   - `createRunScriptTool(scriptsDir: string): ToolDefinition`.
   - Параметри: `script` (string, име на файла, напр. `recon.sh`), `args` (optional array of strings или един string с space-separated аргументи).
   - Резолвирай пътя: `resolve(scriptsDir, script)`. Провери че резултатът е под `scriptsDir` (relative path да не започва с `..`). Ако не — връщай грешка.
   - Провери че файлът съществува и е файл (не директория). Опционално: да се позволи само `.sh`, `.bash` или използвай allowlist по разширение.
   - Изпълнение: `spawn` или `exec` с интерпретатор (за `.sh` → `bash`, за останалите по желание). Timeout напр. 300000 ms (5 min). Записвай stdout+stderr и ги върни като резултат.
   - Описание за LLM: „Run a predefined script from the scripts directory. Use for recon, wireless, or web scan workflows. Args: script name (e.g. recon.sh), optional args.“

2. **`src/cli.ts`**
   - В `bootstrap()`: `registry.register(createRunScriptTool(config.OPENPAW_SCRIPTS_DIR));`.
   - Импорт на `createRunScriptTool` от `./tools/run-script.js`.

3. **`src/dashboard.ts`**
   - При създаване на registry без deps: регистрирай `createRunScriptTool(config.OPENPAW_SCRIPTS_DIR)` (и импорт).

**Критерии за приемане:**

- [ ] Агентът може да извика `run_script` с име на скрипт и аргументи.
- [ ] Path traversal е невъзможен; само файлове в `OPENPAW_SCRIPTS_DIR` се изпълняват.
- [ ] stdout и stderr се връщат в резултата от tool-а.
- [ ] В README или docs е споменато къде се слагат скриптовете и пример: `recon.sh`, `wifite_quick.sh`.

---

## 1.4 Документация — примерни Kali команди

| Поле | Стойност |
|------|-----------|
| **ID** | 1.4 |
| **Зависимости** | — |

**Описание:** Документ с примерни команди за nmap, wifite, nikto, hydra и др., за да може агентът (и потребителят) да ги използват чрез run_shell или run_script.

**Файлове за създаване:**

1. **`docs/kali-commands.md`** (или `docs/KALI-COMMANDS.md`)
   - Секции: Recon (nmap, netexec), Wireless (wifite, aircrack-ng, reaver), Web (nikto, sqlmap, gobuster), Credentials (hydra, hashcat, john). За всяка: примерна команда, кратко описание, типични аргументи.
   - Секция „Скриптове за run_script“: примери за съдържание на `recon.sh`, `wifite_quick.sh`, `nikto_scan.sh` (само примерни команди в скрипта).

2. **`README.md`**
   - В секцията за Kali или Built-in tools добави линк: „Примерни Kali команди и скриптове: [docs/kali-commands.md](docs/kali-commands.md).“

**Критерии за приемане:**

- [ ] Файлът `docs/kali-commands.md` съществува и съдържа поне по един пример за nmap, wifite, nikto, hydra.
- [ ] README сочи към този документ.

---

## Чеклист Фаза 1

- [ ] 1.1 Конфигурация за audit и scripts
- [ ] 1.2 Audit log — запис при tool call
- [ ] 1.3 Run_script tool
- [ ] 1.4 Документация kali-commands.md

---

# ФАЗА 2 — Dedicated wrappers: nmap, wireless, web, danger_approval

Цел: tools с ясна семантика за рекон, wireless и уеб; опционално одобрение за опасни команди.

---

## 2.1 Nmap_scan tool

| Поле | Стойност |
|------|-----------|
| **ID** | 2.1 |
| **Зависимости** | — |

**Описание:** Tool `nmap_scan`: извиква `nmap` с зададен target и тип сканиране; връща текстов изход, подходящ за четене от LLM.

**Файлове за създаване / промяна:**

1. **`src/tools/nmap-scan.ts`** (нов)
   - `createNmapScanTool(): ToolDefinition`.
   - Параметри: `target` (string, задължителен — IP, CIDR или hostname), `scanType` (optional: `"quick"` \| `"full"` \| `"udp"` или default). Quick: `-sV -T4`, full: `-sC -sV -A -T4`, udp: избран набор от UDP портове.
   - Изпълнение: `exec` или `spawn` на `nmap ...`. Timeout: quick 120s, full 600s (или config).
   - Резултат: stdout + stderr като един string. При грешка (nmap не е инсталиран или exit !== 0) върни ясно съобщение.

2. **`src/cli.ts`** и **`src/dashboard.ts`**
   - Регистрирай `createNmapScanTool()` в registry.

**Критерии за приемане:**

- [ ] Агентът може да извика `nmap_scan` с target и scanType.
- [ ] Изходът се връща като текст и е четим за модела.

---

## 2.2 Wifite_scan и wifite_attack (wireless) tools

| Поле | Стойност |
|------|-----------|
| **ID** | 2.2 |
| **Зависимости** | — |

**Описание:** Два tools: `wireless_scan` (сканиране на Wi‑Fi) и `wireless_attack` (пускане на атака с wifite/reaver).

**Файлове за създаване:**

1. **`src/tools/wireless.ts`** (нов)
   - **createWirelessScanTool()**: извиква `wifite --scan` или еквивалент (напр. `airmon-ng` + `airodump-ng` за кратко), интерфейс опционален (default `wlan0`). Резултат: текст с AP-та (SSID, BSSID, channel, signal). Timeout 60–120s.
   - **createWirelessAttackTool()**: параметри `interface`, `attackType` (wpa \| wep \| wps), optional `wordlist`, optional `bssid`. Сглобява команда за wifite и я изпълнява. Timeout голям (напр. 600s) или опция за background (Фаза 3).
   - И двата да проверяват дали интерфейсът съществува (optional); при липса на wifite да връщат ясна грешка.

2. **`src/cli.ts`** и **`src/dashboard.ts`**
   - Регистрирай `createWirelessScanTool()` и `createWirelessAttackTool()`.

**Критерии за приемане:**

- [ ] `wireless_scan` връща списък на достъпни мрежи (или грешка ако няма wifite/интерфейс).
- [ ] `wireless_attack` пуска атака с зададени параметри и връща изхода или съобщение за background (ако се имплементира по-късно).

---

## 2.3 Nikto_scan (web scan) tool

| Поле | Стойност |
|------|-----------|
| **ID** | 2.3 |
| **Зависимости** | — |

**Описание:** Tool `nikto_scan`: сканиране на уеб сървър с nikto за уязвимости.

**Файлове за създаване:**

1. **`src/tools/nikto-scan.ts`** (нов)
   - `createNiktoScanTool(): ToolDefinition`.
   - Параметри: `url` (string, задължителен — напр. `http://target:80`), optional `timeout` (seconds).
   - Изпълнение: `nikto -h <url>` (или еквивалентни опции). Резултат: stdout + stderr. При липса на nikto — ясна грешка.

2. **`src/cli.ts`** и **`src/dashboard.ts`**
   - Регистрирай `createNiktoScanTool()`.

**Критерии за приемане:**

- [ ] Агентът може да подаде URL и да получи изхода от nikto като текст.

---

## 2.4 Danger_approval — одобрение за опасни команди

| Поле | Стойност |
|------|-----------|
| **ID** | 2.4 |
| **Зависимости** | 1.1 (config) |

**Описание:** При определени run_shell команди да се изисква потвърждение преди изпълнение. Списъкът с шаблони да е конфигурируем (или фиксиран като default).

**Файлове за промяна / създаване:**

1. **`src/config.ts`**
   - Добави `OPENPAW_DANGER_APPROVAL`: `z.string().default("false").transform(...)` — дали да се изисква одобрение.
   - Добави `OPENPAW_DANGER_PATTERNS`: `z.string().optional()` — comma-separated подстрингове (напр. `sudo,rm -rf,nc -e,msfconsole,msfvenom`). Ако командата съдържа някой от тях и approval е enabled — изисквай одобрение.

2. **`src/tools/shell.ts`** (или нов модул за approval)
   - Вариант A: В `createShellTool` при `execute`: ако config (подаден като option) казва danger_approval и командата match-ва някой pattern, да върне специален резултат „Pending approval: <command>“ и да не изпълнява. Това изисква асинхронно одобрение от потребителя и повторно извикване — по-сложно.
   - Вариант B: Отделна логика в router/agent: преди да се изпълни run_shell, ако командата е „опасна“, да се пита потребителят (в CLI с readline, в Telegram с бутон/команда). След одобрение да се изпълни същата команда. За това трябва: (1) функция `requiresDangerApproval(command: string, patterns: string[]): boolean`; (2) в точката където се извиква run_shell (agent или router), ако резултатът е „pending_approval“, да се подаде обратно към канала и да се чака одобрение; при следващо съобщение от потребителя „approve <id>“ да се изпълни командата.
   - По-прост вариант за Фаза 2: В **shell tool** при опасна команда да връщаш резултат: „Command requires approval: <command>. Reply with 'approve' to run it.“ И да има отделен механизъм: при съобщение „approve“ от потребителя, последната pending команда да се изпълни. Това изисква съхранение на „last pending command“ в session или в контекста на канала. Имплементация: в router или в channel (CLI) да се пази `lastPendingShellCommand`; когато user напише „approve“, да се извика run_shell с тази команда и да се изчисти.

   Конкретизация за минимална имплементация:
   - В **shell.ts**: добави опция `dangerPatterns?: string[]` и `onDangerousCommand?: (command: string) => Promise<boolean>`. При execute, ако командата match-ва pattern и има `onDangerousCommand`, извикай го; ако върне false — не изпълнявай и върни „Command rejected (approval required).“ Ако върне true — изпълни. За CLI: `onDangerousCommand` да пита с readline „Run this command? (y/n)“ и да resolve true/false. За Telegram/Discord: може да се подаде callback който чака съобщение „approve“ в същия канал.
   - В **cli.ts** при създаване на createShellTool подавай `dangerPatterns` от config и `onDangerousCommand` — за CLI channel да е функция която използва readline (ако е налично в контекста). Проблем: bootstrap не знае за readline на CLI. Алтернатива: в **channels/cli.ts** при получаване на съобщение да проверяваш дали последният отговор на агента съдържа „requires approval“ и дали потребителят е написал „y“ или „approve“ — тогава да изпратиш същата команда като ново съобщение. Това е по-лесно без да променяш shell tool: shell tool просто изпълнява. Вместо това в **agent** или **router**: преди да подадеш резултата от run_shell към LLM, ако резултатът е „Command requires approval“, да го върнеш като отговор към потребителя и да запишеш командата в session; при следващ user message дали да е „approve“ — тогава извикваш run_shell директно с тази команда и показваш резултата. Така не променяш shell tool с callback. Трябва обаче shell tool да може да върне „needs approval“ вместо да изпълнява. Значи в shell.ts при опасна команда да не изпълняваш, а да връщаш специален резултат например „[OPENPAW_NEEDS_APPROVAL]<command>“. Router/CLI при такъв отговор да показва на потребителя „Approve this command? (yes/no): <command>“ и да пази командата; при „yes“/„approve“ да извика run_shell с тази команда и да покаже резултата.

   Имплементация:
   - **shell.ts**: при `fullControl` и наличие на `dangerPatterns` (опция в createShellTool), ако `command` съдържа някой от patterns, върни `[OPENPAW_NEEDS_APPROVAL]${command}` без да изпълняваш.
   - **router.ts** или **channels/cli.ts**: при отговор съдържащ `[OPENPAW_NEEDS_APPROVAL]`, извлечи командата, покажи на потребителя и запиши в session/contexт `pendingApproval: command`. При следващо user message ако е „yes“/„approve“/„y“ и има pending, изпълни командата (директно извикай tool execute или runAgent с специално съобщение) и изчисти pending.
   - За Discord/Telegram: също да проверяват за pending и при „approve“ да изпълняват.

**Файлове:**

1. **`src/config.ts`** — добави `OPENPAW_DANGER_APPROVAL`, `OPENPAW_DANGER_PATTERNS`.
2. **`src/tools/shell.ts`** — опция `dangerPatterns?: string[]`; при match върни `[OPENPAW_NEEDS_APPROVAL]${command}`.
3. **`src/router.ts`** или **`src/channels/cli.ts`** — при отговор с NEEDS_APPROVAL запиши pending; при „approve“ изпълни и покажи резултат. (Ако логиката е в router, трябва router да има достъп до tools и да може да изпълни един tool и да върне резултата без да вика LLM.)
4. **`src/channels/telegram.ts`** и **`src/channels/discord.ts`** — при нужда същата логика за approve (текст „approve“ или команда /approve).

**Критерии за приемане:**

- [ ] При `OPENPAW_DANGER_APPROVAL=true` и команда съдържаща pattern, run_shell връща съобщение за одобрение вместо да изпълнява.
- [ ] В CLI при „approve“ командата се изпълнява и резултатът се показва.
- [ ] В .env.example са документирани OPENPAW_DANGER_APPROVAL и OPENPAW_DANGER_PATTERNS.

---

## Чеклист Фаза 2

- [ ] 2.1 Nmap_scan tool
- [ ] 2.2 Wireless_scan и wireless_attack tools
- [ ] 2.3 Nikto_scan tool
- [ ] 2.4 Danger_approval

---

# ФАЗА 3 — Контекст, background задачи, канали, retry

Цел: именовани workspace-ове (engagements), TARGET.md, background задачи с уведомления, кратки команди в канали, retry за LLM.

---

## 3.1 Именовани workspace-ове (engagements)

| Поле | Стойност |
|------|-----------|
| **ID** | 3.1 |
| **Зависимости** | — |

**Описание:** Поддръжка на множество workspace-а с име. Команда `openpaw use <name>` задава текущия workspace; той се записва във файл в dataDir (напр. `.openpaw/current_workspace`) или в env. При зареждане на config да се чете текущия workspace и OPENPAW_WORKSPACE да сочи към него (ако е зададен именован).

**Файлове:**

1. **`src/config.ts`**
   - Добави `OPENPAW_CURRENT_ENGAGEMENT`: optional string (име на engagement). Ако е зададено, workspace да е `{OPENPAW_DATA_DIR}/engagements/{name}`. Резолвирай в loadConfig.
   - Или: файл `{dataDir}/current_engagement` съдържа едно име на ред; при loadConfig чети този файл и ако има име, workspace = `{dataDir}/engagements/{name}`.

2. **`src/cli.ts`**
   - Нова подкоманда: `openpaw use <engagement-name>`. Създава `{dataDir}/engagements/{name}` ако не съществува, записва в `{dataDir}/current_engagement` името. След това при следващо стартиране bootstrap ще използва този workspace.
   - Команда `openpaw use` без аргумент — показва текущия engagement и списък от всички (от папка engagements).

**Критерии за приемане:**

- [ ] `openpaw use alfa` задава workspace на `{dataDir}/engagements/alfa`.
- [ ] След това read_file, list_dir и др. работят спрямо този workspace.
- [ ] `openpaw use` показва текущия и списък с engagements.

---

## 3.2 TARGET.md / context файл в началото на сесията

| Поле | Стойност |
|------|-----------|
| **ID** | 3.2 |
| **Зависимости** | 3.1 (желателно) |

**Описание:** В началото на разговор (първо съобщение в сесията или при първо извикване на агента за този channel/session), ако в workspace съществува файл `TARGET.md` или `.openpaw/context.md`, съдържанието му да се добави като контекст към първото user съобщение (напр. „Context:\n\"\"\"\n{content}\n\"\"\"\n\nUser: {message}\") или като отделено system/user съобщение.

**Файлове:**

1. **`src/router.ts`** или там където се формира съобщението към агента
   - Преди да извикаш runAgent, провери дали има файл `TARGET.md` или `context.md` в workspace (или в dataDir). Ако има, прочети съдържанието и го добави като префикс към user message или като предходно user съобщение: „Current target/context:\n{content}\n\nUser request: {actualMessage}“.
   - Да се прави само веднъж за сесията (напр. при първото съобщение в тази conversation history), за да не се дублира всеки път.

2. **Документация** в README или docs: описание на TARGET.md и .openpaw/context.md.

**Критерии за приемане:**

- [ ] При наличие на TARGET.md в workspace съдържанието се подава на агента в началото на разговора.
- [ ] Документацията описва формата и целта на файла.

---

## 3.3 Background задачи и уведомления при готовност

| Поле | Стойност |
|------|-----------|
| **ID** | 3.3 |
| **Зависимости** | 1.2 (audit), канали |

**Описание:** Възможност да се пусне дълга задача (run_shell, nmap_scan, wireless_attack, run_script) в „background“. При приключване да се изпрати уведомление в канала (CLI може да покаже в конзолата при следващо отваряне или да записва в файл; Telegram/Discord да изпратят съобщение).

**Файлове:**

1. **`src/background-jobs.ts`** (нов)
   - Структура: хранилище за задачи (файл в dataDir, напр. `background_jobs.json`) с { id, commandOrTool, args, status: pending|running|done|failed, result?, channel?, createdAt, finishedAt? }.
   - Функции: `startBackgroundJob(options)`, `getJob(id)`, `listJobs()`, `markDone(id, result)`, `markFailed(id, error)`.
   - При стартиране на job да се пусне child_process.spawn или Promise в фон и да се записва резултатът в хранилището и да се извика callback за уведомление (напр. sendToChannel).

2. **Tool или разширение на run_shell / nmap / wireless**
   - Опция `background: true`. Ако е true, вместо да чакаш резултата, стартираш job в background-jobs и връщаш „Job started. ID: xyz. You will be notified when done.“ При приключване background-jobs извиква notifier за регистрираните канали (Telegram/Discord да имат метод sendMessage или callback).

3. **Интеграция в канали**
   - Discord и Telegram да регистрират callback за уведомления (напр. при markDone да изпратят съобщение в съответния чат). За CLI може да се записва в audit или в отделен лог и при следващо отваряне да се показва „You have N completed background jobs“.

**Критерии за приемане:**

- [ ] Потребителят може да подаде background=true за подходящ tool (напр. run_shell, nmap_scan) и да получи job id.
- [ ] При приключване на задачата резултатът се записва и се изпраща уведомление в конфигурирания канал (ако е Telegram/Discord).

---

## 3.4 Кратки команди в Telegram/Discord

| Поле | Стойност |
|------|-----------|
| **ID** | 3.4 |
| **Зависимости** | 2.1, 2.2, 2.3 |

**Описание:** Поддръжка на slash команди или кратки думи: напр. `/recon 192.168.1.0/24`, `/wireless`, `/webscan https://target`. Те да се мапват към извикване на съответния tool (nmap_scan, wireless_scan, nikto_scan) с подходящи аргументи и отговор да се изпрати в същия канал.

**Файлове:**

1. **`src/channels/telegram.ts`** и **`src/channels/discord.ts`**
   - Преди да подадеш съобщението към агента, провери дали текстът започва с `/recon`, `/wireless`, `/webscan`. Ако да, парсни аргументите и извикай директно съответния tool (от registry), после изпрати резултата в чата. Или генерирай един „псевдо“ user message който казва „Run nmap scan on 192.168.1.0/24“ и го подай на агента — по-просто и консистентно с останалия flow.
   - Препоръка: да се генерира стабилен user message (напр. „Execute: nmap_scan target=192.168.1.0/24“) и да се подаде на runAgent; така агентът ще извика tool-а и ще върне отговор. По-малко дублиране на логика.

**Критерии за приемане:**

- [ ] В Telegram и Discord при `/recon 192.168.1.0/24` се изпълнява nmap scan и резултатът се изпраща в чата.
- [ ] Аналогично за `/wireless` и `/webscan <url>`.

---

## 3.5 Retry за LLM при timeout/грешка

| Поле | Стойност |
|------|-----------|
| **ID** | 3.5 |
| **Зависимости** | — |

**Описание:** При грешка от LLM API (timeout, 5xx, network error) да се опита 1–2 retry с exponential backoff (напр. 2s, 4s) преди да се върне грешка на потребителя.

**Файлове:**

1. **`src/llm.ts`**
   - В `fetchWithTimeout` или в `adapter.chat`: при catch или при res.ok === false, ако е timeout или 5xx, повтори до 2 пъти с забавяне (setTimeout или delay(2000), delay(4000)). След последния опит върни грешката.
   - Конфигурация: optional `OPENPAW_LLM_RETRY_COUNT` (default 2), `OPENPAW_LLM_RETRY_DELAY_MS` (default 2000).

2. **`src/config.ts`**
   - Добави `OPENPAW_LLM_RETRY_COUNT`, `OPENPAW_LLM_RETRY_DELAY_MS`.

**Критерии за приемане:**

- [ ] При временна грешка на API се прави до 2 повторни опита с пауза.
- [ ] След това потребителят получава ясно съобщение за грешка.

---

## Чеклист Фаза 3

- [ ] 3.1 Именовани workspace-ове (engagements)
- [ ] 3.2 TARGET.md / context файл
- [ ] 3.3 Background задачи и уведомления
- [ ] 3.4 Кратки команди в Telegram/Discord
- [ ] 3.5 Retry за LLM

---

# ФАЗА 4 — Skill packs, dashboard, docs

Цел: skill packs (recon, wireless, web, credential), подобрения в dashboard, Kali quickstart в README.

---

## 4.1 Skill packs — структура и зареждане

| Поле | Стойност |
|------|-----------|
| **ID** | 4.1 |
| **Зависимости** | 1.3, 2.1, 2.2, 2.3 |

**Описание:** Механизъм за „pack“ — име (recon, wireless, web, credential), списък от tools (по име) и опционално допълнителен system prompt. При `openpaw use pack recon` да се зареждат само tools от този pack (или да се добавят към базовите). По-прост вариант: pack е конфигурация в JSON (в dataDir или в код) която казва кои tools да са включени и какъв е допълнителен system prompt; при стартиране с `--pack recon` да се зарежда тази конфигурация.

**Файлове:**

1. **`src/packs.ts`** или **`src/config/packs.ts`** (нов)
   - Дефиниция на типове: `Pack = { name: string; tools: string[]; systemPromptSuffix?: string }`.
   - Конфигурация: файл `{dataDir}/packs.json` или в код default packs: recon (nmap_scan, run_script), wireless (wireless_scan, wireless_attack, run_script), web (nikto_scan, run_script), credential (run_script).
   - Функция `getPack(name: string): Pack | null`, `listPacks(): string[]`.

2. **`src/cli.ts`**
   - Подкоманда `openpaw use pack <name>` или флаг `--pack recon`. При наличие на pack при bootstrap да регистрираш само tools които са в pack (или да добавиш pack tools към базовите). За system prompt: при наличие на pack.systemPromptSuffix да се добави към system prompt в llm (трябва да се подаде към createLLM или да се промени глобалния system prompt в llm.ts да приема опция).

3. **`src/llm.ts`**
   - SYSTEM_PROMPT_BASE да може да приема suffix от опции при chat (или при създаване на adapter). Вариант: в RunAgentOptions да има `systemPromptSuffix?: string` и в agent.ts при извикване на llm.chat да се подава като част от първото system съобщение. За това в createLLM chat да приема опции с systemPromptSuffix и да го добави към system content.

**Критерии за приемане:**

- [ ] Съществува конфигурация за поне един pack (recon).
- [ ] При `openpaw use pack recon` (или --pack recon) се зареждат съответните tools и опционално system prompt.
- [ ] Документация как да се дефинира нов pack.

---

## 4.2 Примерни скриптове и шаблони за packs

| Поле | Стойност |
|------|-----------|
| **ID** | 4.2 |
| **Зависимости** | 4.1, 1.3 |

**Описание:** В репото да има примерни скриптове в `scripts/` (или `docs/scripts-examples/`) и шаблон за TARGET.md. При първо стартиране или при `openpaw init` да се копират в dataDir/scripts и да се създаде празен TARGET.md в workspace.

**Файлове:**

1. **`scripts/recon.sh`**, **`scripts/wifite_quick.sh`**, **`scripts/nikto_scan.sh`** (примери в репото)
2. **`docs/templates/TARGET.md.example`**
3. **`src/cli.ts`** — команда `openpaw init` да създава dataDir/scripts ако липсва и да копира примерни скриптове от репото (ако има такава папка).

**Критерии за приемане:**

- [x] В репото има поне един примерен скрипт и един шаблон за TARGET.md.
- [x] Документацията сочи към тях (README, docs/kali-commands.md → docs/scripts-examples/, docs/templates/TARGET.md.example).

---

## 4.3 Dashboard — workspace selector и audit log преглед

| Поле | Стойност |
|------|-----------|
| **ID** | 4.3 |
| **Зависимости** | 1.2, 3.1 |

**Описание:** В уеб dashboard да има възможност да се избере текущ workspace (engagement) от падащо меню и да се вижда последните редове от audit log (ако audit е enabled).

**Файлове:**

1. **`src/dashboard.ts`**
   - Добави endpoint или страница за списък на engagements и избор на текущ (запис в current_engagement файл или чрез API).
   - Добави endpoint за четене на последните N реда от audit log файла; показвай ги в отделен панел или модал.

**Критерии за приемане:**

- [x] Потребителят може да избере engagement от dashboard и да вижда последните audit записи.

---

## 4.4 Kali quickstart в README

| Поле | Стойност |
|------|-----------|
| **ID** | 4.4 |
| **Зависимости** | — |

**Описание:** Отделна подсекция в README за Kali: препоръчани пакети (`sudo apt install ...` за nmap, wifite, nikto, и др.), препоръчан локален модел (Ollama + име на модел), примерни промптове („Full recon на 192.168.1.0/24“, „Сканирай Wi‑Fi“, „Сканирай уеб сървъра http://target“).

**Файлове:**

1. **`README.md`**
   - Секция „Kali Linux quickstart“ или разшири съществуващата: списък пакети, Ollama модел, 3–5 примерни промпта.

**Критерии за приемане:**

- [x] README съдържа ясни инструкции и примери за Kali (Kali packages, Ollama model, example prompts, shortcuts).

---

## Чеклист Фаза 4

- [ ] 4.1 Skill packs — структура и зареждане
- [x] 4.2 Примерни скриптове и шаблони
- [x] 4.3 Dashboard — workspace и audit преглед
- [x] 4.4 Kali quickstart в README

---

# Обобщение на всички задачи

| ID   | Задача                              | Фаза |
|------|-------------------------------------|------|
| 1.1  | Конфигурация audit + scripts        | 1    |
| 1.2  | Audit log при tool call             | 1    |
| 1.3  | Run_script tool                     | 1    |
| 1.4  | Документация kali-commands.md       | 1    |
| 2.1  | Nmap_scan tool                      | 2    |
| 2.2  | Wireless_scan и wireless_attack     | 2    |
| 2.3  | Nikto_scan tool                     | 2    |
| 2.4  | Danger_approval                     | 2    |
| 3.1  | Именовани workspace-ове            | 3    |
| 3.2  | TARGET.md / context                 | 3    |
| 3.3  | Background задачи + уведомления     | 3    |
| 3.4  | Кратки команди в канали             | 3    |
| 3.5  | Retry за LLM                        | 3    |
| 4.1  | Skill packs структура               | 4    |
| 4.2  | Примерни скриптове и шаблони        | 4    |
| 4.3  | Dashboard workspace + audit        | 4    |
| 4.4  | Kali quickstart в README            | 4    |

Изграждай по ред на фазите; вътре във всяка фаза задачите могат да се правят паралелно където няма зависимости. След всяка задача отбелязвай чекбокса и тествай съответните критерии за приемане.
