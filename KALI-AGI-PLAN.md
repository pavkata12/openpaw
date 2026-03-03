# План: Какво трябва да може този AGI (Kali Linux)

Преглед на **препоръчани Kali инструменти** по категории и план какво трябва да умее агентът — способности (capabilities) и кои tools как да се покрият.

---

## 1. Препоръчани Kali tools по категории

(Източник: [kali.org/tools](https://www.kali.org/tools/), [en.kali.tools](https://en.kali.tools/), общоприети топ списъци.)

### 1.1 Reconnaissance (разузнаване)

| Инструмент | Назначение |
|------------|------------|
| **nmap** | Сканиране на мрежа, портове, ОС, скриптове (NSE). |
| **netexec** | Автоматизация на оценка на мрежова сигурност (2024). |
| **amass** | Поддомейн енумерация. |
| **autorecon** | Автоматизирано енумерация на услуги. |
| **gobuster** | Directory/DNS brute-force. |
| **ffuf** | Fuzzing за уеб. |
| **theHarvester** | Събиране на emails, subdomains, хостове. |

### 1.2 Wireless (безжични мрежи)

| Инструмент | Назначение |
|------------|------------|
| **wifite** | Автоматизиран Wi‑Fi pentest (WEP/WPA/WPS). |
| **aircrack-ng** | Airmon-ng, airodump-ng, aircrack-ng — capture и crack. |
| **reaver** / **bully** | WPS атаки. |
| **bettercap** | 802.11, BLE, MITM, sniffing. |
| **kismet** | Wireless IDS и рекон. |
| **airgeddon** | Bash скрипт за wireless аудит. |

### 1.3 Web application testing

| Инструмент | Назначение |
|------------|------------|
| **burp suite** | Ръчен/автоматизиран уеб тест (често GUI; има и headless). |
| **sqlmap** | Автоматизиран SQL injection. |
| **nikto** | Сканиране на уеб сървър за уязвимости. |
| **wpscan** | WordPress уязвимости. |
| **dirb** / **dirbuster** | Directory brute-force. |
| **hydra** | Brute-force за HTTP/форми и др. |

### 1.4 Password & credential testing

| Инструмент | Назначение |
|------------|------------|
| **john the ripper** | Cracking на пароли. |
| **hashcat** | GPU/CPU password recovery, handshake crack. |
| **hydra** | Brute-force за SSH, FTP, HTTP, DB и др. |
| **mimikatz** (често чрез impacket/msf) | Credential dumping, Windows. |

### 1.5 Exploitation & post-exploitation

| Инструмент | Назначение |
|------------|------------|
| **metasploit framework** | msfconsole, msfvenom, exploit/post модули. |
| **impacket** | psexec, smbclient, mimikatz, ntlmrelayx и др. |
| **beef** | Browser exploitation. |
| **setoolkit** | Social-Engineer Toolkit (phishing и др.). |

### 1.6 Sniffing & traffic analysis

| Инструмент | Назначение |
|------------|------------|
| **wireshark** / **tshark** | Анализ на пакети. |
| **bettercap** | MITM, sniffing в реално време. |
| **tcpdump** | Запис на трафик от терминал. |

### 1.7 Forensics (форензика)

| Инструмент | Назначение |
|------------|------------|
| **binwalk** | Извличане на файлове от образи. |
| **autopsy** | GUI за Sleuth Kit. |
| **bulk_extractor** | Извличане на данни от образи. |

### 1.8 Други полезни

| Инструмент | Назначение |
|------------|------------|
| **netcat** / **ncat** | Свързване, listener, transfer. |
| **bloodhound** | AD атаки и визуализация. |
| **powershell** (pwsh) | Скриптове в Windows среда. |

---

## 2. Какво трябва да може този AGI — способности

Агентът трябва да може да:

| № | Способност | Описание |
|---|------------|----------|
| 1 | **Мрежов рекон** | Сканиране на цели (IP/диапазон/домейн), изброяване на хостове и портове, опционално услуги/ОС. Резултатите да са четливи за LLM и да водят към следващи стъпки. |
| 2 | **Wireless рекон и атаки** | Сканиране на Wi‑Fi мрежи (AP, клиенти, канали); пускане на WPA/WEP/WPS атаки с зададени параметри; дълги задачи в background с известие при готовност. |
| 3 | **Уеб тестове** | За даден URL: сканиране за уязвимости (Nikto-подобно), directory fuzz (gobuster/ffuf), опционално SQLi (sqlmap). Резултатите да се подават обратно на агента. |
| 4 | **Credential testing** | Brute-force/wordlist атаки (Hydra) за SSH, HTTP, FTP и др.; crack на хешове (John, Hashcat); crack на Wi‑Fi handshake (aircrack/hashcat). |
| 5 | **Exploitation** | Стартиране на Metasploit модули или Impacket скриптове по зададени параметри; генериране на payload (msfvenom). Опасни команди — с опционално одобрение (danger_approval). |
| 6 | **Sniffing и трафик** | Запис на трафик (tcpdump/tshark); опционално стартиране на Bettercap за MITM. Резултатите (файлове/лог) да са достъпни за агента (read_file или run_shell за анализ). |
| 7 | **Файлове и код** | Четене/писане/търсене в workspace; прилагане на patch; пускане на скриптове. Вече покрито с read_file, write_file, search_in_files, apply_patch, run_shell. |
| 8 | **Контекст и памет** | Работа с engagement/workspace; памет за цели, бележки, резултати; резюме на сесията при дълги разговори. |
| 9 | **Отчетност и безопасност** | Лог на всички извиквания (audit); опционално одобрение за опасни команди; ясни съобщения при грешки. |
| 10 | **Канали и уведомления** | Команди от Telegram/Discord; известие при приключване на дълга задача; voice вход/изход. |

---

## 3. План: кои Kali tools как да се покрият

### Фаза 1 — Вече имаме / минимални промени

- **run_shell** с full control на Linux — изпълнява всяка Kali команда (nmap, wifite, hydra, msfconsole, и т.н.). Агентът може да ги вика с правилните аргументи.
- **read_file, write_file, list_dir, search_in_files, apply_patch** — за код, конфиги, резултати от сканирания.
- **remember / recall** — за цели, пароли на тестови акаунти, бележки.
- **Планиране и изпълнение** (system prompt) — план → стъпки с tools.

**Какво да добавим в Phase 1:**  
- **audit_log** — лог на tool calls (и по желание run_shell).  
- **run_script** — изпълнение на скриптове от `~/.openpaw/scripts/` (recon.sh, wifite_quick.sh, nikto_scan.sh и т.н.).  
- Документация: примерни команди за nmap, wifite, nikto, hydra в README или в `docs/kali-commands.md`.

### Фаза 2 — Dedicated wrappers за най-често използваните

- **nmap_scan** — target, тип (quick/full), изход структуриран (хостове, портове) за по-добра семантика за LLM.
- **wifite_scan** и **wifite_attack** (или wireless_scan / wireless_attack) — както в ROADMAP.
- **nikto_scan** (или web_scan) — URL, опции; изходът да се върне като текст за агента.
- **danger_approval** — опционално одобрение за sudo, msfconsole, nc -e, rm -rf и т.н.

След това агентът може да казва: „направи nmap на 192.168.1.0/24“, „сканирай Wi‑Fi“, „сканирай уеб сървъра http://target“, без потребителят да описва точните команди.

### Фаза 3 — Още способности и UX

- **Именовани workspace-ове (engagements)** — `openpaw use engagement-alfa`; code tools и опционално памет в контекста на engagement.
- **TARGET.md / context файл** — агентът да чете в началото на сесията цел, scope, бележки.
- **Background задачи + уведомления** — дълги (nmap, wifite, hydra, hashcat) да могат да се пускат в background и при приключване да се изпрати съобщение в Telegram/Discord.
- **Кратки команди в канали** — напр. `/recon 192.168.1.0/24`, `/wireless`, `/webscan https://target`.
- **Retry за LLM** при timeout/5xx.

### Фаза 4 — Skill packs и разширяемост

- **Recon pack** — nmap_scan, run_script за recon скриптове, шаблон за TARGET.md.
- **Wireless pack** — wifite_scan, wifite_attack, run_script за aircrack/reaver скриптове.
- **Web pack** — nikto_scan, run_script за sqlmap/gobuster/ffuf.
- **Credential pack** — run_script за hydra, hashcat, john (с ясно документирани параметри).

Допълнителни wrappers (по желание): **sqlmap_run**, **hydra_run**, **msf_venom** — за по-стриктна семантика и по-малко грешки в аргументите. Или да останат за run_script с готови шаблони.

---

## 4. Обобщение: какво трябва да може AGI-то

1. **Рекон** — nmap, netexec, gobuster; резултатите четливи за агента.  
2. **Wireless** — wifite, aircrack-ng, reaver, bettercap; scan и attack с възможност за background.  
3. **Уеб** — nikto, sqlmap, gobuster/ffuf; сканиране и опционално fuzz.  
4. **Credentials** — hydra, john, hashcat; чрез run_shell/run_script или dedicated wrapper.  
5. **Exploitation** — metasploit, impacket; с опционално danger_approval.  
6. **Sniffing** — tcpdump, tshark, bettercap; запис и достъп до файлове за анализ.  
7. **Файлове и код** — вече покрито; workspace и при нужда engagements.  
8. **Контекст** — TARGET.md, remember/recall, резюме на сесията.  
9. **Audit и одобрение** — лог на действия, одобрение за опасни команди.  
10. **Канали и уведомления** — Telegram/Discord команди и известия при готовност на задачи.

Този документ е планът какво трябва да може този AGI; детайлите за имплементация са в [ROADMAP.md](ROADMAP.md).
