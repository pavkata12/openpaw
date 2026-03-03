# OpenPaw Roadmap — AGI за Kali Linux

Ако това беше моят проект, ето какво бих добавил и подобрил, за да целината да е като **един цялостен агент за Kali Linux** (pentest, opsec, автоматизация, код).

**План за способностите на AGI и препоръчани Kali tools:** виж **[KALI-AGI-PLAN.md](KALI-AGI-PLAN.md)** — категории Kali инструменти, какво трябва да може агентът, и фази (1–4) за имплементация.

**Детайлен план за изграждане (стъпка по стъпка):** виж **[BUILD-PLAN.md](BUILD-PLAN.md)** — подредени задачи по фази, файлове за промяна, зависимости и критерии за приемане, за да се построи всичко без пропуски.

**Критична съпоставка с OpenClaw (калибър):** виж **[docs/OPENPAW-VS-OPENCLAW.md](docs/OPENPAW-VS-OPENCLAW.md)** — къде OpenPaw стига нивото на OpenClaw и къде остава назад (архитектура, конфиг, session, сигурност, тестове).

**План „До перфектност“:** виж **[docs/PERFECTION-PLAN.md](docs/PERFECTION-PLAN.md)** — session persistence, тестове, skill packs, agent identity, конфиг за session/routing; подредени задачи с файлове и критерии.

---

## 1. Kali-специфични tools (приоритет висок)

| Tool | Описание | Защо |
|------|----------|------|
| **nmap_scan** | Обвивка около `nmap`: подаваш target, тип (quick/full), получаваш структуриран изход (hosts, ports). Агентът може да чете резултатите и да предлага следващи стъпки. | Пряк достъп до рекон без да пипаш ръчно команди; по-добра семантика за LLM. |
| **run_script** | Изпълнява преддефиниран скрипт от `~/.openpaw/scripts/` (напр. `recon.sh`, `web_scan.sh`) с аргументи. Скриптовете са твои — агентът само ги вика. | Стандартизирани workflow-та: "пусни ми стандартния recon". |
| **audit_log** | Записва всички извиквания на tools (и по желание run_shell) в лог файл с време, канал, команда/args. Опционално: `OPENPAW_AUDIT_LOG=1`. | Отчетност и преглед какво е изпълнил агентът — важно за Kali/engagements. |
| **danger_approval** | При определени команди (sudo, rm -rf, nc -e, msfconsole, и т.н.) да изисква потвърждение от потребителя преди изпълнение (в CLI пита, в Telegram/Discord — approve с бутон или команда). | Баланс между пълен контрол и безопасност. |

**Wireless / Wi‑Fi (Wifite и др.):**

| Tool | Описание | Защо |
|------|----------|------|
| **wifite_scan** / **wireless_scan** | Обвивка около `wifite` (и опционално `airmon-ng`, `airodump-ng`): сканиране на Wi‑Fi мрежи, изброяване на AP-та и клиенти. Резултатът да е четим за агента (списък SSID, BSSID, канал, сигнал). | Агентът може да каже „сканирай безжичните“, да види резултатите и да предложи следващи стъпки (напр. WPA handshake capture, речник за crack). |
| **wifite_attack** / **wireless_attack** | Стартиране на атака с **wifite** (или **reaver**, **aircrack-ng**) с параметри: интерфейс, тип (wpa/wep/wps), опционално речник. Дълготрайни задачи — да могат да се пускат в background с уведомление при готовност. | „Пусни wifite на wlan0 за WPA с речник rockyou“ без да пипаш ръчно команди; подходящо за Kali. |
| **run_script** (wireless) | Скриптове в `~/.openpaw/scripts/` за wireless: напр. `wifite_quick.sh`, `capture_handshake.sh`, `reaver_wps.sh`. Агентът ги вика чрез **run_script** с аргументи (интерфейс, BSSID, речник). | Стандартизирани workflow-та за Wi‑Fi: един скрипт за бърз scan, друг за capture + crack. |

Сродни инструменти, с които агентът може да работи чрез **run_shell** или **run_script**: **aircrack-ng**, **reaver**, **bully**, **bettercap**, **hashcat** (за crack на handshake). Препоръка: документирай типичните команди в README или в примерни скриптове в `scripts/`.

## 2. Контекст и памет (приоритет висок)

- **Engagement / project scope**  
  - `OPENPAW_WORKSPACE` вече е „текущ проект“. Добави **именовани workspace-ове**: напр. `openpaw use engagement-alfa` и всички code tools + опционално памет да са за тази engagement.  
  - Паметта (remember/recall) да може да е **per-workspace** или глобална (config).

- **По-дълга сесия без изтичане на контекст**  
  - Вече имаш summarization. Подобрение: при много стъпки да се подава на модела и **кратко резюме на сесията** („Досега: направихме nmap на X, открихме портове 22,80; редактирахме config на Y“) за да не се губи нишката при 20+ съобщения.

- **Файлово-backed контекст за цел**  
  - Опционално: в workspace да има файл `TARGET.md` или `.openpaw/context.md`, който агентът да чете в началото на сесията (IP, scope, бележки). Така не трябва всеки път да описваш целта.

---

## 3. Канали и достъп (среден приоритет)

- **Оперативен канал от телефон**  
  - Telegram/Discord вече са там. Добре е да има **кратки команди** (напр. `/recon 192.168.1.0/24`, `/status`) и отговор в същия канал — за употреба от полето.

- **Уведомления при готовност**  
  - Дълга задача (nmap, **wifite/reaver/aircrack**, bruteforce, скрипт) да може да се пусне в „background“ и при приключване да се изпрати съобщение в избран канал (Telegram/Discord): „Scan приключи: резултатите са в …“.

- **Voice от телефон**  
  - Push-to-talk в Telegram/Discord (voice message → STT → агент → отговор като текст или TTS). Частично покрито с voice; остава интеграцията с каналите да е ясна и стабилна.

---

## 4. Надеждност и сигурност (среден приоритет)

- **Retry и timeout за LLM**  
  - При грешка от API (timeout, 5xx) да има 1–2 retry с backoff; при продължителни грешки да връща ясно съобщение вместо да „замлъква“.

- **Audit log**  
  - Виж **audit_log** по-горе. Важно за Kali: кой какво е пуснал и кога.

- **Опционално: allowlist за „опасни“ run_shell**  
  - Допълнително към full control: списък с команди/шаблони, които изискват approve (sudo, rm, nc -e, msf, и т.н.). По подразбиране изключено при full control; включва се с config.

---

## 5. UX за Kali (среден/нисък приоритет)

- **TUI (terminal UI)**  
  - Интерактивен терминален интерфейс: панел с чат, панел с последни команди/резултати, бързи действия („Quick: recon“, „Quick: open notes“). Подходящо за работа само в терминал на Kali.

- **Dashboard подобрения**  
  - Тъмна тема вече има. Добави: избор на workspace/engagement, преглед на audit log, последни tool calls.

- **Kali quickstart в README**  
  - Отделна подсекция: препоръчани пакети (`sudo apt install ...`), препоръчан локален модел (Ollama) за офлайн работа, примерни промптове („Full recon на 192.168.1.0/24“, „Добави нов listener“).

---

## 6. Офлайн и локален модел (нисък приоритет, но важно за opsec)

- **Ollama като first-class**  
  - В документацията и doctor да се подчертава: за пълна локалност използвай Ollama; примерни модели (llama3.2, mistral, codellama) за код и за общи задачи.

- **Fallback при липса на мрежа**  
  - Ако OPENPAW_LLM_BASE_URL е недостижим, да излиза ясно съобщение и опция за „retry“ или „use cached“, ако някой ден има кеширани отговори.

---

## 7. Разширяемост (нисък приоритет)

- **Skill packs**  
  - Папки или npm пакети с набор от tools + кратък system prompt за конкретен тип задача (напр. „recon pack“: nmap_scan, run_script за recon скриптове, шаблон за TARGET.md; **„wireless pack“**: wifite_scan, wifite_attack, run_script за Wifite/Aircrack/Reaver скриптове). Зареждат се чрез config или `openpaw use pack recon` / `openpaw use pack wireless`.

- **MCP за Kali**  
  - Документирай препоръчани MCP сървъри за файлова система, и ако има такива — за специфични Kali инструменти. Все още explicit config, без автоматичен registry.

---

## Резюме — какво да има „като AGI за Kali“

1. **Kali-специфични tools**: nmap_scan, run_script, audit_log, danger_approval; **wireless**: wifite_scan / wifite_attack (или wireless_scan / wireless_attack), run_script за Wifite, Aircrack-ng, Reaver, Bettercap, Hashcat.  
2. **Контекст**: именовани workspace-ове (engagements), по-добро резюме на сесията, опционален TARGET/context файл.  
3. **Канали**: кратки команди от Telegram/Discord, уведомления при приключване на дълги задачи.  
4. **Надеждност**: retry за LLM, audit log, опционално одобрение за опасни команди.  
5. **UX**: TUI за терминал, подобрен dashboard с workspace + log.  
6. **Офлайн**: Ollama и локален модел като препоръка, ясни съобщения при липса на мрежа.  
7. **Разширяемост**: skill packs и документирани MCP за Kali.

Това би накарало OpenPaw да се чувства като **един цялостен агент за Kali Linux** — не само чат с tools, а система за планиране, изпълнение, контекст и отчетност, ориентирана към pentest и opsec.
