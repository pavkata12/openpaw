# 🦾 Full Accessibility & Automation Suite

## Overview

OpenPaw е напълно автономен асистент за хора с увреждания - **особено незрящи и хора с ограничена подвижност**. AI-ят може да прави **всичко** на компютъра вместо теб - просто му кажи какво искаш с глас!

---

## 🎯 Нови Accessibility Tools (7 нови инструмента)

### 1. **`voice_describe_screen`** - AI описва какво има на екрана
**За кого:** Незрящи / слабо виждащи  
**Какво прави:** Прави screenshot и AI описва с думи какво вижда

**Примери:**
```
"Какво има на екрана?"
"Опиши ми какво виждаш"
"Какви бутони има?"
"Какво пише в центъра?"
```

**Режими:**
- `brief` - кратко (1-2 изречения): "Отворен е YouTube, виждам списък с видеа"
- `detailed` - подробно: "В горния ляв ъгъл има меню, в центъра 5 видеа с thumbnails..."
- `interactive` - за взаимодействие: "Play бутон в центъра, Settings в горен десен ъгъл..."

---

### 2. **`smart_navigate`** - Автоматична навигация
**За кого:** Всички accessibility users  
**Какво прави:** Отваря приложения и сайтове с естествени команди

**Примери:**
```
"Отвори YouTube"
"Пусни Chrome"
"Влез в Gmail"
"Намери Python tutorial"
"Стартирай калкулатора"
"Отвори настройките"
```

**Как работи:**
- AI автоматично разбира дали искаш app или website
- Прави всичко вместо теб - не трябва да помниш команди
- Работи на Windows, macOS, и Linux

---

### 3. **`read_aloud`** - Чете на глас
**За кого:** Незрящи / слабо виждащи  
**Какво прави:** Text-to-Speech за всякакъв текст

**Примери:**
```
"Прочети това"
"Какво пише тук?"
"Чети на глас"
"Прочети файла"
```

**Източници:**
- `screen` - чете от екрана (OCR)
- `file` - чете файл
- `text` - чете конкретен текст

**Гласове:**
- `default` - нормална скорост
- `fast` - бързо четене
- `slow` - бавно четене

**Поддържа множество езици:** български, английски, испански, и др.

---

### 4. **`auto_fix_errors`** - Автоматично поправяне на грешки
**За кого:** Всички users (особено неопитни)  
**Какво прави:** AI вижда грешката и предлага решение

**Примери:**
```
"Нещо не работи"
"Поправи го"
"Има грешка"
"Command not found"
```

**Какво прави:**
1. Анализира error message
2. Определя типа грешка (FileNotFound, PermissionError, SyntaxError...)
3. Предлага конкретни решения
4. Може автоматично да приложи fix-а (ако е безопасно)

**Типове грешки:**
- FileNotFound - липсващ файл
- PermissionError - нямаш права
- SyntaxError - грешка в кода
- NetworkError - интернет проблем
- MemoryError - недостатъчно RAM
- CommandNotFound - липсваща програма

---

### 5. **`context_aware_help`** - AI предлага какво да правиш
**За кого:** Всички accessibility users  
**Какво прави:** Гледа какво правиш и дава предложения

**Примери:**
```
"Какво мога да направя?"
"Помогни ми"
"Не знам какво да правя"
"Затънал съм"
```

**AI предлага въз основа на:**
- Какво има на екрана
- Каква задача се опитваш да свършиш
- Дали изглеждаш объркан/затънал

**Примери за предложения:**
- Ако гледаш видео: "Направи fullscreen", "Пусни следващия епизод"
- Ако кодиш: "Запази файла", "Пусни кода", "Поправи грешката"
- Ако търсиш: "Прочети първия резултат", "Отвори този линк"

---

### 6. **`anime_search`** - Намира anime епизоди
**За кого:** Всички users  
**Какво прави:** Автоматично намира streaming links за anime

**Примери:**
```
"Намери One Piece епизод 1050"
"Пусни Dead Account епизод 5"
"Намери Naruto епизод 1 на HiAnime"
```

**Сайтове:**
- HiAnime (hianime.to) - HD качество
- GogoAnime (gogoanime.by) - голяма библиотека
- Auto - опитва и двата

---

### 7. **`smart_web_search`** - Интелигентно web търсене
**За кого:** Всички users  
**Какво прави:** Търси в интернет, fetch-ва страници, parse-ва HTML, сумаризира

**Примери:**
```
"Намери най-добрите AI модели за код"
"Проучи Node.js security практики"
"Кой е най-бързият browser в 2026?"
```

**Как работи:**
1. Търси в DuckDuckGo
2. Fetch-ва топ 3-5 страници паралелно
3. Parse-ва HTML (премахва реклами, скриптове)
4. Извлича релевантна информация
5. Сумаризира според целта ти

**Много по-мощно от обикновен `web_search`!**

---

## 🎤 Continuous Voice Mode

Добавено в `src/channels/voice.ts` - **винаги слуша и отговаря**!

**Как да пуснеш:**
```bash
npm run voice
```

**Какво прави:**
- ✅ Винаги слуша (wake word не е нужна)
- ✅ Автоматично разпознава глас
- ✅ Изпълнява команди веднага
- ✅ Чете отговорите на глас (TTS)
- ✅ Работи на всички езици

**Примерна сесия:**
```
Ти: "Какво има на екрана?"
OpenPaw: [описва екрана на глас]

Ти: "Отвори YouTube"
OpenPaw: [отваря YouTube] "Отворих YouTube"

Ти: "Намери Dead Account епизод 5"
OpenPaw: [намира епизода] "Намерих го на HiAnime"

Ти: "Пусни го"
OpenPaw: [кликва play] "Пуснах видеото"

Ти: "Направи fullscreen"
OpenPaw: [прави fullscreen] "Готово!"
```

**Няма нужда да казваш "OpenPaw" или wake word - просто говори!**

---

## 🔊 Voice Setup

### 1. STT (Speech-to-Text) - Разпознаване на глас

**Опция 1: ElevenLabs (cloud, най-добро качество)**
```env
OPENPAW_STT_PROVIDER=elevenlabs
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_STT_MODEL_ID=scribe_v2
ELEVENLABS_STT_LANGUAGE_CODE=bg
```

**Опция 2: Local Whisper (offline, безплатно)**
```env
OPENPAW_STT_MODEL=Xenova/whisper-tiny
OPENPAW_STT_LANGUAGE=bulgarian
```

### 2. TTS (Text-to-Speech) - Четене на глас

**Windows:** Built-in SAPI (работи веднага)  
**macOS:** Built-in `say` (работи веднага)  
**Linux:** Инсталирай `espeak-ng`:
```bash
sudo apt install espeak-ng
```

**Тестване:**
```bash
# Linux
espeak-ng "Здравей света"

# macOS
say "Hello world"

# Windows
powershell -Command "Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.Speak('Hello world')"
```

---

## 🦾 Full Autonomy Example

**Сценарий:** Незрящ човек иска да гледа anime

```
User: "Искам да гледам One Piece"

AI: "Разбрах. Колко епизод искаш да гледаш?"

User: "Епизод 1050"

AI: [използва anime_search]
    [отваря browser с browser_session]
    [намира streaming link]
    [кликва play]
    [прави fullscreen]
    "Готово! Пуснах One Piece епизод 1050 на fullscreen. Видеото вече се пуска."

User: "Благодаря!"
```

**AI прави ВСИЧКО сам - user само говори!**

---

## 🎯 Accessibility Mode

В `.env` файл:
```env
OPENPAW_ACCESSIBILITY_MODE=true
OPENPAW_AGENT_MAX_TURNS=100
OPENPAW_AGENT_COMPLETION_REMINDER=true
OPENPAW_AGENT_VERIFY_COMPLETION=true
```

**Какво прави:**
- AI винаги довършва задачата докрай
- Кратки, ясни описания (оптимизирани за screen readers)
- Автоматично използва accessibility tools
- Проактивно предлага помощ

---

## 🛠️ Инсталация (Linux/Kali)

Всички accessibility tools вече са включени в `install-linux.sh`:

```bash
chmod +x install-linux.sh
./install-linux.sh
```

**Какво инсталира:**
- Node.js + npm
- Screenshot tools (scrot, imagemagick, gnome-screenshot)
- Mouse/keyboard tools (xdotool)
- TTS engine (espeak-ng)
- OpenPaw + всички зависимости

---

## 📊 Tool Comparison

| Feature | Before | After (Accessibility) |
|---------|--------|----------------------|
| Screen description | ❌ Manual screenshot + describe | ✅ `voice_describe_screen` |
| Navigation | ❌ Complex browser commands | ✅ `smart_navigate "open YouTube"` |
| Reading content | ❌ Manual read_file | ✅ `read_aloud` (TTS) |
| Error handling | ❌ User debugs manually | ✅ `auto_fix_errors` (AI fixes) |
| Next steps | ❌ User figures out | ✅ `context_aware_help` (AI suggests) |
| Voice control | ⚠️ Limited (wake word + specific commands) | ✅ Continuous listening (natural speech) |
| Task completion | ⚠️ Partial (user steps through) | ✅ Full autonomy (AI does everything) |

---

## 🚀 Example Commands

### For Blind Users
```
"Какво има на екрана?"
"Прочети това"
"Намери play бутона"
"Кликни го"
"Какво мога да правя?"
"Помогни ми"
```

### For Motor-Impaired Users
```
"Отвори Chrome"
"Влез в Gmail"
"Намери най-новия имейл"
"Прочети го на глас"
"Отговори 'Благодаря'"
```

### For Everyone
```
"Намери One Piece епизод 1"
"Проучи Python tutorials"
"Поправи тази грешка"
"Какво да правя сега?"
```

---

## 🎯 Total Tool Count

**Before:** 48 tools  
**After:** **55 tools** ✅

**Нови accessibility tools:**
1. `voice_describe_screen`
2. `smart_navigate`
3. `read_aloud`
4. `auto_fix_errors`
5. `context_aware_help`
6. `anime_search`
7. `smart_web_search`

---

## 🔥 Why This Matters

OpenPaw е сега **първият AI pentesting асистент** който е **напълно достъпен** за хора с увреждания:

✅ Незрящ човек може да прави **penetration testing само с глас**  
✅ Човек с ограничена подвижност може да управлява **цялата система без мишка/клавиатура**  
✅ AI прави **всичко автоматично** - не трябва да знаеш команди  
✅ **100% автономен** - задаваш цел, AI я изпълнява  

**Никой друг AI pentesting tool не прави това!** 🚀

---

## 📖 Related Documentation

- `ANIME-WEB-PIPELINE.md` - Anime search + smart web pipeline
- `README.md` - Пълна документация за OpenPaw
- `CHAT-HISTORY-COMPLETE.md` - Chat history feature
- `KALI-AGI-PLAN.md` - Vision and roadmap

---

## 🎤 Voice Demo Script

**Setup:**
```bash
npm install
npm run build
npm run voice
```

**Demo conversation:**
```
User: "Hello OpenPaw"
AI: "Hi! I'm ready to help. What would you like to do?"

User: "What's on my screen?"
AI: [takes screenshot, describes] "I see your desktop with Chrome and Terminal open..."

User: "Open YouTube"
AI: [opens YouTube] "Opened YouTube. What would you like to watch?"

User: "Find One Piece episode 1"
AI: [searches, finds link] "Found it on HiAnime! Opening now..."

User: "Play it fullscreen"
AI: [clicks play, goes fullscreen] "Playing One Piece episode 1 in fullscreen. Enjoy!"
```

**Total time:** ~30 seconds  
**User actions:** 0 (только говори)  
**AI actions:** 8+ (search, navigate, click, fullscreen, etc.)

---

## 💪 Conclusion

OpenPaw сега е **напълно автономен accessibility-first AI pentesting assistant**!

Всеки може да го ползва - независимо от:
- ✅ Дали виждаш или не
- ✅ Дали можеш да ползваш мишка/клавиатура
- ✅ Дали знаеш технически команди
- ✅ Дали имаш опит с Linux/Kali

**Просто говори и AI прави всичко вместо теб!** 🦾🚀
