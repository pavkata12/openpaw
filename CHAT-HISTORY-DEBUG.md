# 🔍 Chat History Debug Guide

## ❓ Problem: "Chat history не запазва миналите чатове"

### ✅ What We Checked:

1. **sessions.json EXISTS** ✓
   - Location: `.openpaw/sessions.json`
   - Has data: 1 session with 6 messages
   - BUT: Cyrillic encoding issue (shows garbage chars in PowerShell)

2. **API endpoints EXIST** ✓
   - `GET /api/sessions` - implemented
   - `GET /api/sessions/:key` - implemented
   - `DELETE /api/sessions/:key` - implemented
   - `PATCH /api/sessions/:key` - implemented

3. **JavaScript code CORRECT** ✓
   - `loadSessions()` function exists
   - `renderSessions()` function exists
   - `switchSession()` function exists

---

## 🔴 ACTUAL PROBLEM:

**Dashboard is NOT running!** 

```bash
netstat -ano | findstr :3780
# Shows only TIME_WAIT (no LISTENING)
```

---

## ✅ SOLUTION:

### Step 1: Start Dashboard

```bash
npm run dashboard
```

### Step 2: Open Browser

```
http://localhost:3780
```

### Step 3: Clear Browser Cache

Press `Ctrl + Shift + R` (hard refresh) or:
- Chrome: `Ctrl + Shift + Delete` → Clear cache
- Firefox: `Ctrl + Shift + Delete` → Clear cache

### Step 4: Check Sidebar

- Look for **☰** button (top left)
- Click it to toggle chat history sidebar
- Should see: "💬 Chat History" with "[+ New]" button

---

## 🐛 If Still Not Working:

### Debug in Browser Console:

1. Open DevTools: `F12`
2. Go to **Console** tab
3. Check for errors
4. Run manually:

```javascript
// Check if chat history manager loaded
window.chatHistory

// Test API manually
fetch('/api/sessions')
  .then(r => r.json())
  .then(d => console.log('Sessions:', d))
```

### Check Network Tab:

1. Open DevTools: `F12`
2. Go to **Network** tab
3. Refresh page
4. Look for: `GET /api/sessions`
5. Check response

---

## 📋 Expected Behavior:

### When Working:
```
┌─────────────────────────────────┐
│ [☰] OpenPaw          [+ New]    │
├─────────────┬───────────────────┤
│ 💬 Chat     │                   │
│             │                   │
│ Today       │  Your session     │
│ ✓ Chat 1    │  should appear    │
│             │  here!            │
└─────────────┴───────────────────┘
```

### Session Data:
- **Key**: `web:web-608d23c1-4d16-4f15-922d-f619a4db857b`
- **Messages**: 6 (3 user, 3 assistant)
- **Created**: Jan 1, 2026
- **Updated**: Jan 1, 2026

---

## 🎯 Quick Fix Checklist:

- [ ] Dashboard is running (`npm run dashboard`)
- [ ] Port 3780 is open (netstat shows LISTENING)
- [ ] Browser opened to `http://localhost:3780`
- [ ] Hard refresh (Ctrl+Shift+R)
- [ ] Sidebar toggle button (☰) visible
- [ ] No JavaScript errors in console
- [ ] `/api/sessions` returns 200 OK

---

## 🔧 If Dashboard Won't Start:

```bash
# Kill any old process
netstat -ano | findstr :3780
taskkill /F /PID <PID>

# Rebuild
npm run build

# Start fresh
npm run dashboard
```

---

## 💡 Most Likely Issue:

**You need to restart the dashboard!**

The code was pushed to git, but your local dashboard process is still running the OLD version without chat history UI.

**Solution**: Kill and restart dashboard to load the NEW code!

```bash
# Stop
Ctrl+C (in dashboard terminal)

# Start
npm run dashboard
```

---

**Try this and let me know!** 🚀
