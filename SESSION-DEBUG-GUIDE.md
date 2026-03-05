# 🔍 OpenPaw Memory/Session Debug Guide

## How Sessions Work:

### Browser (Dashboard):
1. **Session ID** is stored in browser `localStorage`:
   - Key: `openpaw-chat-session`
   - Value: UUID (e.g., `608d23c1-4d16-4f15-922d-f619a4db857b`)
2. **Persists** across page refreshes in same browser
3. **Lost** if you:
   - Clear browser data/localStorage
   - Use incognito/private mode
   - Use different browser
   - Different device

### Server (OpenPaw):
1. **Session Key** format: `web:web-{sessionId}`
2. **Stored** in `.openpaw/sessions.json`
3. **TTL**: 24 hours (configurable via `OPENPAW_SESSION_TTL_HOURS`)
4. **Max History**: 50 messages (configurable via `OPENPAW_SESSION_MAX_HISTORY`)

---

## ✅ Check if Session is Saved:

### 1. Check Browser localStorage:
```javascript
// Open browser console (F12)
// Check if session exists:
localStorage.getItem('openpaw-chat-session')

// Should show UUID like: "608d23c1-4d16-4f15-922d-f619a4db857b"
```

### 2. Check Server Sessions:
```bash
# Check sessions.json file:
cat .openpaw/sessions.json

# Should show sessions with history
```

---

## 🐛 Common Problems:

### Problem 1: "Every message is a new chat"

**Причини:**
- ✅ Browser localStorage is cleared between page loads
- ✅ Using incognito/private mode
- ✅ Different browser/device each time
- ✅ Session expired (older than 24h)

**Решение:**
1. Use same browser (not incognito)
2. Don't clear browser data
3. Check localStorage in console

### Problem 2: "AI doesn't remember previous messages"

**Причини:**
- ✅ Session ID changes each time
- ✅ Server can't find session in sessions.json
- ✅ Session TTL expired

**Решение:**
1. Check `.openpaw/sessions.json` exists
2. Check OPENPAW_SESSION_TTL_HOURS in .env
3. Verify session key matches in browser + server

### Problem 3: "Session resets after X hours"

**Причини:**
- ✅ Session TTL expired (default 24h)

**Решение:**
```bash
# In .env, increase TTL:
OPENPAW_SESSION_TTL_HOURS=168  # 7 days
```

---

## 🔧 Debug Steps:

### Step 1: Check Browser Session ID
```javascript
// In browser console (F12):
console.log('Session ID:', localStorage.getItem('openpaw-chat-session'));
```

### Step 2: Check Server Sessions
```bash
# In OpenPaw directory:
cat .openpaw/sessions.json | jq .
```

### Step 3: Verify Session Key Format
Session key should be: `web:web-{sessionId}`

Example:
- Browser localStorage: `608d23c1-4d16-4f15-922d-f619a4db857b`
- Server sessions.json: `"web:web-608d23c1-4d16-4f15-922d-f619a4db857b"`

### Step 4: Check Session Age
```javascript
// In sessions.json, check updatedAt timestamp:
const updatedAt = 1772506151064;
const now = Date.now();
const ageHours = (now - updatedAt) / (1000 * 60 * 60);
console.log('Session age (hours):', ageHours);
// If > 24h, session expired
```

---

## ✅ Manual Fix:

### Clear and Start Fresh:
```bash
# 1. Stop OpenPaw
# 2. Delete old sessions
rm .openpaw/sessions.json

# 3. Clear browser localStorage:
# In browser console (F12):
localStorage.removeItem('openpaw-chat-session');
location.reload();

# 4. Start OpenPaw again
npm run dashboard
```

### Keep Session Forever:
```bash
# In .env:
OPENPAW_SESSION_TTL_HOURS=999999  # Very long time
OPENPAW_SESSION_MAX_HISTORY=1000  # More messages
```

---

## 🎯 Current Session Data:

Check `.openpaw/sessions.json`:
```json
{
  "web:web-608d23c1-4d16-4f15-922d-f619a4db857b": {
    "key": "web:web-608d23c1-4d16-4f15-922d-f619a4db857b",
    "history": [
      {"role": "user", "content": "..."},
      {"role": "assistant", "content": "..."}
    ],
    "createdAt": 1772506076711,
    "updatedAt": 1772506151064
  }
}
```

---

## 💡 Solution:

**За да работи memory правилно:**

1. ✅ Use same browser (not incognito)
2. ✅ Don't clear browser localStorage
3. ✅ Session TTL: 24h default (increase if needed)
4. ✅ Check browser console for session ID
5. ✅ Verify `.openpaw/sessions.json` exists and contains history

**Ако все още не работи:**
- Refresh page (F5)
- Check console for errors (F12)
- Verify localStorage is enabled in browser
- Try different browser (Firefox/Chrome)

---

## 🔍 Real-Time Check:

```javascript
// Paste in browser console (F12):
(function() {
  const sessionId = localStorage.getItem('openpaw-chat-session');
  console.log('=== OpenPaw Session Debug ===');
  console.log('Browser Session ID:', sessionId);
  console.log('Session Key (server):', 'web:web-' + sessionId);
  console.log('localStorage enabled:', typeof(Storage) !== "undefined");
  console.log('===========================');
})();
```

---

**Status**: Sessions are working, but may need browser localStorage persistence!
