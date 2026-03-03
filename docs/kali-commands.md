# Примерни Kali команди и скриптове

Агентът може да изпълнява тези команди чрез **run_shell** или да ги обвие в скриптове в `OPENPAW_SCRIPTS_DIR` (по подразбиране `.openpaw/scripts`) и да ги вика с **run_script**.

---

## Reconnaissance

### Nmap

```bash
# Бързо сканиране (портове, услуги)
nmap -sV -T4 192.168.1.0/24

# Пълен скан с NSE скриптове
nmap -sC -sV -A -T4 192.168.1.1

# Само отворени портове
nmap --open 192.168.1.0/24

# UDP портове (по-бавно)
nmap -sU --top-ports 100 192.168.1.1
```

### Netexec (Kali 2024+)

```bash
netexec smb 192.168.1.0/24
netexec ssh 192.168.1.0/24 -u user -p pass
```

### Gobuster (directory / vhost)

```bash
gobuster dir -u http://target/ -w /usr/share/wordlists/dirb/common.txt
gobuster vhost -u http://target -w subdomains.txt
```

---

## Wireless (Wifite, Aircrack-ng)

### Wifite

```bash
# Сканиране на мрежи
wifite --scan

# Атака WPA с речник
wifite -i wlan0 -e "TargetSSID" --dict /usr/share/wordlists/rockyou.txt

# WPS атака
wifite -i wlan0 --wps
```

### Aircrack-ng (capture + crack)

```bash
airmon-ng start wlan0
airodump-ng wlan0mon
# След capture на handshake:
aircrack-ng -w /usr/share/wordlists/rockyou.txt capture.cap
```

### Reaver (WPS)

```bash
reaver -i wlan0mon -b <BSSID> -vv
```

---

## Web

### Nikto

```bash
nikto -h http://target
nikto -h http://target -p 80,443
```

### SQLmap

```bash
sqlmap -u "http://target/page?id=1" --batch
sqlmap -u "http://target/page?id=1" --dbs --batch
```

### Dirb

```bash
dirb http://target/ /usr/share/wordlists/dirb/common.txt
```

---

## Credentials

### Hydra (brute-force)

```bash
# SSH
hydra -l root -P /usr/share/wordlists/rockyou.txt ssh://192.168.1.1

# HTTP form
hydra -l admin -P pass.txt target http-post-form "/login:user=^USER^&pass=^PASS^:F=failed"

# FTP
hydra -L users.txt -P pass.txt ftp://192.168.1.1
```

### Hashcat

```bash
# WPA handshake
hashcat -m 22000 capture.hc22000 wordlist.txt

# NTLM
hashcat -m 1000 hashes.txt wordlist.txt
```

### John the Ripper

```bash
john --wordlist=/usr/share/wordlists/rockyou.txt hashes.txt
john --format=raw-md5 hashes.txt
```

---

## Скриптове за run_script

Създай папка `.openpaw/scripts` (или задай `OPENPAW_SCRIPTS_DIR`) и сложи там скриптове с разширение `.sh`. Агентът ги вика с **run_script** (име на файла + опционални аргументи). В репото има примерни скриптове в **[docs/scripts-examples/](scripts-examples/)** (`recon.sh`, `wifite_quick.sh`, `nikto_scan.sh`) — копирай ги в data dir scripts и направи изпълними: `chmod +x .openpaw/scripts/*.sh`. Шаблон за цел/контекст: **[docs/templates/TARGET.md.example](templates/TARGET.md.example)**.

### Пример: recon.sh

```bash
#!/bin/bash
# Usage: recon.sh <target>
# Example: run_script script=recon.sh args="192.168.1.0/24"
TARGET="${1:-192.168.1.0/24}"
nmap -sV -T4 --open "$TARGET"
```

### Пример: wifite_quick.sh

```bash
#!/bin/bash
# Quick Wi-Fi scan on wlan0
wifite -i wlan0 --scan 2>&1 | head -80
```

### Пример: nikto_scan.sh

```bash
#!/bin/bash
# Usage: nikto_scan.sh <url>
# Example: run_script script=nikto_scan.sh args="http://192.168.1.10"
nikto -h "${1:?Provide URL}"
```

След като създадеш скриптовете, направи ги изпълними: `chmod +x .openpaw/scripts/*.sh`.
