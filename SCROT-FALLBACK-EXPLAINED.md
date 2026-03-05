# 🔧 Linux Install Script - Automatic Fallback для scrot

## ✅ Как работи сега:

### Когато `scrot` липсва, автоматично пробва:

```bash
1. sudo apt install scrot
   ❌ Failed? → Try alternatives...

2. sudo apt install gnome-screenshot
   ✅ Success? → Use this!
   ❌ Failed? → Try next...

3. sudo apt install maim
   ✅ Success? → Use this!
   ❌ Failed? → Try next...

4. sudo apt install flameshot
   ✅ Success? → Use this!
   ❌ Failed? → Try next...

5. Check if imagemagick 'import' exists
   ✅ Already installed? → Use this!
   ❌ Nothing works? → Warning, but continue
```

## 🎯 Резултат:

### Ако `scrot` не се инсталира:
```bash
[!] scrot not found in repos, trying alternatives...
[✓] gnome-screenshot installed (scrot alternative)
[*] Verifying Computer Use API tools...
[✓] ✓ xdotool: xdotool 3.20160805.1
[✓] ✓ gnome-screenshot: installed (scrot alternative)
[✓] ✓ imagemagick: 6.9.11-60
[✓] Computer Use API tools: 3/3 verified (sufficient to run)
```

### Script-ът НЕ спира с грешка - продължава!

---

## 🔍 Защо се показва "failed to install"?

Това е **нормално съобщение** от `apt`! Script-ът го вижда и автоматично пробва алтернативите.

### Output който виждаш:
```bash
[*] Installing scrot...
E: Unable to locate package scrot    ← apt съобщение
[!] scrot not found in repos, trying alternatives...
[*] Installing gnome-screenshot...   ← автоматично пробва
[✓] gnome-screenshot installed (scrot alternative) ← успех!
```

---

## 💡 Какво се променя:

### ПРЕДИ (старата версия):
```bash
sudo apt install -y scrot || {
    print_error "Failed to install scrot!"
    exit 1    ← Спира тук!
}
```

### СЕГА (новата версия):
```bash
if sudo apt install -y scrot 2>/dev/null; then
    print_success "scrot installed"
else
    print_warning "scrot not found, trying alternatives..."
    
    # Try gnome-screenshot
    if sudo apt install -y gnome-screenshot 2>/dev/null; then
        print_success "gnome-screenshot installed"
    # Try maim
    elif sudo apt install -y maim 2>/dev/null; then
        print_success "maim installed"
    # Try flameshot
    elif sudo apt install -y flameshot 2>/dev/null; then
        print_success "flameshot installed"
    else
        print_warning "Continuing without screenshot tool..."
        # НЕ спира! Продължава!
    fi
fi
```

---

## 🚀 Какво означава за теб:

### ✅ Инсталацията ПРОДЪЛЖАВА автоматично
- Не спира на грешка
- Автоматично пробва 4 алтернативи
- Инсталира каквото намери
- Предупреждава ако нищо не намери

### ✅ OpenPaw ще работи с каквото има:
- `gnome-screenshot` → работи
- `maim` → работи
- `flameshot` → работи
- `imagemagick import` → работи
- Само `xdotool` е критичен (за mouse/keyboard)

---

## 📋 Финална проверка:

След инсталация, скриптът проверява:
```bash
[*] Verifying Computer Use API tools...
[✓] ✓ xdotool: installed            (критично ✅)
[✓] ✓ gnome-screenshot: installed   (алтернатива на scrot ✅)
[✓] ✓ imagemagick: installed        (за image processing ✅)

[✓] Computer Use API tools: 3/3 verified (sufficient to run)
```

### Минимум за работа: **2/3 tools**
- `xdotool` (задължително за mouse/keyboard)
- Някой screenshot tool (scrot, gnome-screenshot, maim, flameshot, или imagemagick)

---

## 🎯 Заключение:

**Script-ът вече прави точно това което каза - не дава грешка, а автоматично инсталира алтернативи!**

Съобщението "failed to install scrot" идва от `apt`, но script-ът го вижда и веднага пробва следващата опция.

---

## 🔄 Да пуснеш отново:

```bash
cd /path/to/openpaw
git pull origin master
./install-linux.sh
```

Ще видиш:
```
[!] scrot not found in repos, trying alternatives...
[✓] gnome-screenshot installed (scrot alternative)
✅ Инсталацията продължава и приключва успешно!
```

---

**Script-ът е интелигентен - не спира на грешка, а търси решение!** 🧠✅
