# 🔌 Supabase Disconnect Guide

## 選項 1: 最簡單 - 暫時停止Live Database連接

編輯 `.env.local` 檔案，加入呢行：

```env
# Gemini AI API Key (required)
VITE_GEMINI_API_KEY=your_groq_or_gemini_api_key_here

# Supabase Configuration (required)
VITE_SUPABASE_URL=https://dbiechsqskcywtjdwzos.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_bIq4BjUEtcXmQ1tKJQyFXA_uW0bR_fV

# ⬇️ 加呢行 = 停用live database，用local data
VITE_USE_LOCAL_DATA=true
```

✅ **之後**：Refresh browser → 應該會見到console message話 "OFFLINE MODE ENABLED"

---

## 選項 2: 完全隔離 - Backup然後刪除環境變數

1. **首先backup所有data** (執行我們個export script):
```bash
npm run export-data
```

2. **然後修改 `.env.local`** - 將Supabase keys設為dummy values:
```env
VITE_SUPABASE_URL=https://placeholder.supabase.co
VITE_SUPABASE_ANON_KEY=placeholder_key_xxx
VITE_USE_LOCAL_DATA=true
```

呢樣保證**零連接**到live database ✨

---

## 選項 3: 推薦 - 使用Local JSON Data Backup

1. 執行export script到local:
```bash
npm run export-data
```

2. 呢個會生成 `data-export/` 資料夾，入面有：
   - `projects.json`
   - `modules.json`
   - `tasks.json`
   - `task_assignments.json`
   - ...etc

3. 設置 `VITE_USE_LOCAL_DATA=true`

4. 用呢啲JSON files做development / testing 🎯

---

## 如何Restore回Live Database?

只須改返 `.env.local`:
```env
VITE_USE_LOCAL_DATA=false
```

或者直接**刪除呢行**，default會用live database。

---

## 💡 我建議做法

```bash
# Step 1: Export確保有backup
npm run export-data

# Step 2: Stop live connection
# (編輯 .env.local 加入 VITE_USE_LOCAL_DATA=true)

# Step 3: Restart dev server
npm run dev

# Step 4: 安全咁refactor code!
```

---

**Ready? 我會等你confirm咗再改code** 🚀
