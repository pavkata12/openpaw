# 🐾 OpenPaw - Installation Guide

Quick and easy installation for all platforms!

---

## 🚀 **Quick Install (Recommended)**

### **Linux / Kali Linux**
```bash
chmod +x install-linux.sh
./install-linux.sh
```

### **macOS**
```bash
chmod +x install-macos.sh
./install-macos.sh
```

### **Windows**
```powershell
powershell -ExecutionPolicy Bypass -File install-windows.ps1
```

---

## 📋 **What the Install Script Does**

The installation script automatically:

✅ Checks and installs Node.js 18+ (if needed)
✅ Installs Computer Use API dependencies:
   - Linux: `xdotool`, `scrot`, `imagemagick`
   - macOS: `cliclick`
   - Windows: Built-in (PowerShell)
✅ Installs npm packages from `package.json`
✅ Builds TypeScript → JavaScript
✅ Creates `.env` configuration file
✅ Creates data directories
✅ (Optional) Installs pentesting tools

**Total install time: 2-5 minutes** ⏱️

---

## 🔧 **Manual Installation**

If you prefer to install manually:

### **1. Install Node.js 18+**

**Linux/Kali:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**macOS:**
```bash
brew install node@20
```

**Windows:**
Download from [nodejs.org](https://nodejs.org)

### **2. Install Computer Use Dependencies**

**Linux/Kali:**
```bash
sudo apt install xdotool scrot imagemagick
```

**macOS:**
```bash
brew install cliclick
```

**Windows:**
✅ No dependencies needed (built-in)

### **3. Install OpenPaw**

```bash
# Clone or navigate to OpenPaw directory
cd openpaw

# Install npm packages
npm install

# Build TypeScript
npm run build

# Create config file
cp .env.example .env

# Edit .env and add your API key
nano .env  # or notepad .env on Windows
```

### **4. Start OpenPaw**

```bash
npm start
```

---

## 🛠️ **Optional: Pentesting Tools**

For full pentesting capabilities, install these tools:

### **Kali Linux** (most tools pre-installed)
```bash
sudo apt install nmap nuclei gobuster ffuf sqlmap wpscan hydra hashcat metasploit-framework enum4linux-ng whois dnsutils
```

### **Ubuntu/Debian**
```bash
sudo apt install nmap gobuster ffuf sqlmap hydra hashcat whois dnsutils

# Nuclei (manual install)
go install -v github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest

# WPScan (manual install)
gem install wpscan
```

### **macOS**
```bash
brew install nmap gobuster ffuf sqlmap hydra hashcat
```

### **Windows**
Install Kali Linux via WSL2 for full pentesting tools:
```powershell
wsl --install -d kali-linux
```

---

## 📦 **What Gets Installed**

### **Core Dependencies (Always)**
- Node.js 18+ (JavaScript runtime)
- npm packages:
  - `playwright` (browser automation)
  - `express` (web server)
  - `zod` (validation)
  - `openai` (LLM API)
  - And more...

### **Computer Use API (Platform-specific)**
- **Linux**: `xdotool`, `scrot`, `imagemagick`
- **macOS**: `cliclick`
- **Windows**: Built-in (PowerShell + .NET)

### **Pentesting Tools (Optional)**
- Nmap, Nuclei, Gobuster, FFuf
- SQLMap, WPScan
- Hydra, Hashcat
- Metasploit, enum4linux-ng
- WHOIS, DNS utils

---

## ⚙️ **Configuration**

After installation, edit `.env`:

```bash
# Required: Your LLM API key
OPENPAW_API_KEY=sk-your-api-key-here

# Optional: Change LLM provider
OPENPAW_BASE_URL=https://api.openai.com/v1
OPENPAW_MODEL=gpt-4

# Optional: Customize settings
OPENPAW_MAX_TURNS=100
OPENPAW_PORT=3000
```

---

## 🚦 **Verify Installation**

Test that everything works:

```bash
# Start OpenPaw
npm start

# Try a simple command
> "What tools do you have?"
> "Check system readiness"
> "Take a screenshot"
```

You should see:
- ✅ 48 tools registered
- ✅ Computer Use API available
- ✅ Pentesting tools available (if installed)

---

## 🐛 **Troubleshooting**

### **"command not found: node"**
Install Node.js 18+ first (see above)

### **"npm install failed"**
```bash
# Clear cache and try again
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### **"npm run build failed"**
```bash
# Install TypeScript globally
npm install -g typescript
npm run build
```

### **"Computer Use tools not working"**
Make sure dependencies are installed:
- Linux: `which xdotool scrot`
- macOS: `which cliclick`
- Windows: Built-in (should always work)

### **"Pentesting tools not found"**
Install them manually (see Optional section above)

---

## 📚 **Next Steps**

1. ✅ **Installation complete!**
2. 📖 Read `BEATS-OPENCLAW.md` for feature overview
3. 🔒 Read `PENTESTING-TOOLS-COMPLETE.md` for pentesting guide
4. 🚀 Start using OpenPaw!

---

## 🆘 **Support**

- **Installation issues?** Check the troubleshooting section above
- **Feature questions?** Read `BEATS-OPENCLAW.md`
- **Pentesting help?** Read `PENTESTING-TOOLS-COMPLETE.md`

---

## 📊 **Installation Comparison**

| Platform | Time | Complexity | Auto-Install |
|----------|------|------------|--------------|
| **Kali Linux** | ~3 min | ⭐ Easy | ✅ Yes |
| **Ubuntu** | ~5 min | ⭐⭐ Medium | ✅ Yes |
| **macOS** | ~4 min | ⭐⭐ Medium | ✅ Yes |
| **Windows** | ~3 min | ⭐ Easy | ✅ Yes |

---

**Happy hacking! 🐾🚀**
