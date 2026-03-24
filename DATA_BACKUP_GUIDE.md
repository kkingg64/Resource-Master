# 🗂️ OMS Data Backup & Local Testing Guide

## Quick Start (3 Steps)

### Step 1️⃣: Export Live Data from Supabase

首先，臨時改返 `.env.local` 連接live database：

```env
# 改呢行
VITE_USE_LOCAL_DATA=false
```

然後執行export命令：
```bash
npm run export-data
```

✅ 呢個會生成 `data-export/` 資料夾，入面係所有你個data (JSON files)

**What gets exported:**
- `projects.json` - 所有projects
- `modules.json` - 所有modules
- `tasks.json` - 所有tasks  
- `task_assignments.json` - 所有assignments
- `resources.json` - 所有resources
- `holidays.json` - Holiday data
- `resource_allocations.json` - Allocations
- ... etc

---

### Step 2️⃣: Import Data Locally

有兩個方法：

#### 方法 A: 用浏览器（推薦，最簡單）

1. 打開 [DataLoader.html](DataLoader.html) 喺browser度
2. 按 "Choose data-export folder to import"
3. 選擇你個 `data-export` 資料夾
4. ✅ Data會自動import到localStorage

#### 方法 B: 用Console命令

打開browser console (F12) 執行：
```javascript
window.__loadDataFromExport()
```

---

### Step 3️⃣: Switch to Offline Mode

編輯 `.env.local`：

```env
# 改回
VITE_USE_LOCAL_DATA=true
```

然後refresh browser (F5) 或 `npm run dev`

✅ **Done!** 現在用offline mode + imported local data呀！

---

## 📊 What's Imported?

所有data會save到 `localStorage` patterns:

```
oms_data_projects -> your projects
oms_data_modules -> your modules  
oms_data_tasks -> your tasks
... etc
```

可以喺console check：
```javascript
// 查看所有imported tables
window.__dataImporter.getAllData()

// 查看specific table
window.__dataImporter.getData('projects')

// Clear all data
window.__dataImporter.clearData()
```

---

## 🔄 Switching between Live & Offline

| Mode | `.env.local` Setting | Result |
|------|-----|--------|
| **Live** | `VITE_USE_LOCAL_DATA=false` | Connects to live Supabase |
| **Offline** | `VITE_USE_LOCAL_DATA=true` | Uses localStorage + mock auth |

Just change `.env.local` and refresh! 🔄

---

## 🛡️ Safety Notes

✅ **Safe to Test:**
- Changes while offline only affect localStorage
- Zero connection to live database
- Can delete/modify data without fear

❌ **When Switching Back to Live:**
- Local changes **won't** sync back to Supabase
- Live data **won't** overwrite your local changes automatically
- You'll see differences if you made changes locally!

---

## 💾 Backing Up Your Data

```bash
# Export live data (creates data-export/ folder)
npm run export-data

# Then commit to git as backup
git add data-export/
git commit -m "backup: export production data for local testing"
```

---

## 🚨 Troubleshooting

**Q: Import button not working?**
- A: Browser needs to support File System API (Chrome/Edge 98+, Firefox limited)
- Use console method instead: `window.__loadDataFromExport()`

**Q: Data not showing up?**
- A: Check localStorage in DevTools → Application → Local Storage
- Key pattern should be `oms_data_projects`, `oms_data_modules`, etc.

**Q: Still connecting to live database?**
- A: Make sure `.env.local` has `VITE_USE_LOCAL_DATA=true`
- Check browser console for "🔌 OFFLINE MODE ENABLED" message

---

## 📝 CLI Commands

```bash
# Start dev server (connects based on .env.local)
npm run dev

# Export live data to JSON
npm run export-data

# Build for production
npm run build
```

---

## 🎯 Recommended Workflow

```
1. npm run export-data          # Backup live data
2. Edit .env.local → true       # Switch to offline
3. npm run dev                  # Start dev server
4. Open DataLoader.html         # Import your data
5. Start testing/developing! ✨
```

---

**Ready? Let's start refactoring safely!** 🚀
