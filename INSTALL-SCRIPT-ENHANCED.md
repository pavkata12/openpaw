# 🔧 Linux Install Script - Enhanced!

## 🎯 What's New:

### 1. **Comprehensive Dependency Checking** ✅
Before installation, the script now checks for:
- `xdotool` - Mouse and keyboard control
- `scrot` - Screenshots
- `imagemagick` - Image processing

### 2. **Auto-Install Missing Dependencies** ✅
If any required dependency is missing:
- Automatically detects it
- Installs it via `apt`
- Verifies installation with version check
- **Exits with error if installation fails** (prevents broken setup)

### 3. **Installation Verification** ✅
After installing each dependency:
```bash
✓ xdotool: xdotool 3.20160805.1
✓ scrot: installed
✓ imagemagick: 6.9.11-60
```

### 4. **Auto-Download PEASS Scripts** ✅
Automatically downloads:
- **LinPEAS** - Linux privilege escalation
- **WinPEAS** - Windows privilege escalation
- Saved to `.openpaw/scripts/`

### 5. **Final System Check** ✅
Before completing, runs 6 checks:
- ✓ Node.js installed
- ✓ xdotool installed
- ✓ scrot installed
- ✓ imagemagick installed
- ✓ Build output exists
- ✓ .env file present

### 6. **Better Error Handling** ✅
- Clear error messages
- Exits early if critical dependencies fail
- Colored output (green ✓, red ✗, yellow !)

---

## 📋 What It Checks:

### Required (Must Install):
```bash
✓ xdotool    # For mouse/keyboard control
✓ scrot      # For screenshots
✓ imagemagick # For image processing
✓ Node.js    # For running OpenPaw
```

### Optional (Asks User):
```bash
nmap, nuclei, gobuster, ffuf, sqlmap, 
wpscan, hydra, hashcat, metasploit, etc.
```

---

## 🚀 Usage:

```bash
# Make executable
chmod +x install-linux.sh

# Run installer
./install-linux.sh
```

### What Happens:

1. **Updates system** → `apt update`
2. **Checks Node.js** → Installs v20 if needed
3. **Checks Computer Use deps** → Auto-installs if missing
4. **Verifies installation** → Shows versions
5. **Asks about pentest tools** → Optional install
6. **Installs npm packages** → `npm install`
7. **Builds TypeScript** → `npm run build`
8. **Downloads PEASS scripts** → LinPEAS, WinPEAS
9. **Creates directories** → `.openpaw/sessions`, etc.
10. **Final system check** → 6/6 checks passed ✓

---

## ✅ Before vs After:

### Before:
```bash
# Silently installed (might fail)
sudo apt install -y xdotool scrot imagemagick
```

### After:
```bash
[*] Checking Computer Use API dependencies...
[!] Missing required dependencies: xdotool scrot
[*] Installing missing dependencies...
[*] Installing xdotool...
[*] Installing scrot...
[✓] All Computer Use dependencies installed
[*] Verifying Computer Use API tools...
[✓] ✓ xdotool: xdotool 3.20160805.1
[✓] ✓ scrot: installed
[✓] ✓ imagemagick: 6.9.11-60
```

---

## 🎯 Result:

**Zero surprises!** The script now:
- ✅ Checks before installing
- ✅ Shows what's missing
- ✅ Installs automatically
- ✅ Verifies with versions
- ✅ Exits on critical failures
- ✅ Downloads PEASS scripts
- ✅ Final system health check

---

## 📦 Git Status:

```bash
# New commits:
ff8fa4d - Chat History Backend APIs
a35fa5f - Chat History UI Complete
a3fddd2 - Chat History Documentation
18875f5 - Settings Link Fix
262c6ec - Enhanced Linux Install Script

# Pushed to origin/master ✓
```

---

**Now the Linux install script is production-ready!** 🚀
