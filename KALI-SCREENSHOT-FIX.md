# 🔧 Kali Linux - Screenshot Tool Fix

## ❗ Problem: "unable to locate package" на Kali Linux

Kali Linux ТРЯБВА да има тези tools! Ако не ги намира, причината е:

---

## 🔍 Възможни Причини:

### 1. Repositories не са update-нати
```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Минимална Kali инсталация (Headless)
Ако си инсталирал Kali без GUI (headless/minimal):
```bash
# Check if you have GUI
echo $DISPLAY

# If empty, you're in headless mode
```

### 3. Docker/WSL Kali
Ако Kali е в Docker или WSL, X11 tools могат да липсват.

---

## ✅ Бързо Решение за Kali:

### Опция 1: Update repositories (препоръчвам)
```bash
# Update package lists
sudo apt update

# Install scrot (should be available now)
sudo apt install scrot -y

# If still fails, try this:
sudo apt install kali-linux-default -y
# This installs standard Kali tools
```

### Опция 2: Install individual tools
```bash
# Try each one:
sudo apt install scrot -y
sudo apt install maim -y  
sudo apt install gnome-screenshot -y
sudo apt install imagemagick -y
```

### Опция 3: Use imagemagick (already on Kali)
```bash
# Imagemagick is pre-installed on Kali
which convert  # Should show: /usr/bin/convert

# Use import command for screenshots:
import -window root screenshot.png
```

---

## 🎯 Specific for Kali Linux:

### Check Kali Version:
```bash
cat /etc/os-release
# Should show: Kali GNU/Linux Rolling
```

### Check if repositories are correct:
```bash
cat /etc/apt/sources.list

# Should contain:
# deb http://http.kali.org/kali kali-rolling main contrib non-free
```

### If sources.list is wrong, fix it:
```bash
sudo nano /etc/apt/sources.list

# Add this line:
deb http://http.kali.org/kali kali-rolling main contrib non-free non-free-firmware

# Save and update:
sudo apt update
sudo apt install scrot -y
```

---

## 🚀 Quick Kali Fix:

```bash
# 1. Update everything
sudo apt update && sudo apt upgrade -y

# 2. Install Kali default tools (includes scrot)
sudo apt install kali-tools-top10 -y

# 3. Verify
which scrot
# Should show: /usr/bin/scrot

# 4. Test
scrot test.png && ls -lh test.png
```

---

## 🐍 Python Fallback (Always Works on Kali):

```bash
# Kali has Python pre-installed
sudo apt install python3-pil python3-tk -y

# Create screenshot script
cat > /usr/local/bin/kali-screenshot << 'EOF'
#!/usr/bin/env python3
import sys
from PIL import ImageGrab
ImageGrab.grab().save(sys.argv[1] if len(sys.argv) > 1 else 'screenshot.png')
EOF

sudo chmod +x /usr/local/bin/kali-screenshot

# Test
kali-screenshot test.png
```

---

## 💡 За WSL/Docker Kali:

Ако си в WSL или Docker, X11 screenshots няма да работят без допълнителна настройка:

### WSL Setup:
```bash
# Install VcXsrv on Windows first
# Then in WSL:
export DISPLAY=:0

# Test X11
xeyes  # Should open window

# Now screenshot tools will work
```

### Docker Setup:
```bash
# Run with X11 forwarding
docker run -e DISPLAY=$DISPLAY \
  -v /tmp/.X11-unix:/tmp/.X11-unix \
  kalilinux/kali-rolling
```

---

## 🔍 Debug Commands:

```bash
# Check what's available:
apt search scrot
apt search screenshot

# Check repository status:
apt-cache policy scrot

# See available packages:
apt list | grep -i screenshot

# Force reinstall:
sudo apt install --reinstall scrot
```

---

## ✅ Expected on Kali:

После като update-неш, трябва да има:
- ✅ `scrot` - /usr/bin/scrot
- ✅ `imagemagick` - /usr/bin/convert
- ✅ `python3` - /usr/bin/python3
- ✅ `xdotool` - /usr/bin/xdotool

---

## 🎯 Финално Решение:

```bash
# Complete fix for Kali:
sudo apt update && sudo apt upgrade -y
sudo apt install scrot xdotool imagemagick -y
./install-linux.sh

# Should work now! ✅
```

---

## 📞 Ако пак не работи:

Изпрати ми output-а от:
```bash
cat /etc/os-release
apt-cache policy scrot
apt search scrot
which scrot
echo $DISPLAY
```

Ще видя точно какъв е проблемът! 🔍

---

**Kali трябва да има всички тези tools by default! Обикновено `sudo apt update` решава проблема.** 🐉✅
