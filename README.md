# MotionCut Studio

極簡、線條主導的 web app，用來把相片批量送到 KlingAI 生成動態片段，然後在同一個專案內排時間線、調整過場與主題，最後輸出 MP4。

## 為什麼我選 Supabase

這個需求同時有：

- 專案與媒體片段的關聯式資料
- 批量圖片與影片儲存
- 非同步任務狀態輪詢
- Vercel 上容易部署的 Node / serverless API

相比 Firebase，Supabase 在這個情境比較直接，因為 PostgreSQL schema、Storage、SQL 查詢與狀態管理更適合 timeline / render / generation 這類多表關聯流程。

## 技術棧

- Next.js 16 App Router
- Tailwind CSS 4
- Supabase Database + Storage
- KlingAI API for image-to-video generation
- `ffmpeg.wasm` client-side export
- `dnd-kit` timeline sorting

## 已完成流程

1. 建立專案
2. 批量上傳最多約 100 張相片
3. 顯示每張縮圖，最大視覺邊長小於 200px
4. 為每張相片指定 prompt
5. 批量提交 Kling 生成任務
6. 等待頁輪詢任務狀態，完成後自動跳到剪輯頁
7. 已完成片段自動進入 timeline
8. 拖放重排次序
9. 每段設定過場、邊框、主題
10. 以瀏覽器內 `ffmpeg.wasm` 匯出 MP4

## 專案結構

```text
src/app/                         頁面與 API routes
src/components/                  前端互動元件
src/lib/                         Supabase/Kling/data helpers
supabase/schema.sql              建表與 storage bucket 建立腳本
.env.example                     所需環境變數
```

## 本地啟動

```bash
npm install
cp .env.example .env.local
npm run dev
```

## Supabase 設定

1. 建立新 Supabase project。
2. 在 SQL editor 執行 [supabase/schema.sql](/Users/TY/photo-motion-studio/supabase/schema.sql)。
3. 到 Project Settings 取得：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`

這個版本使用 server-side service role key 直接寫入資料表與 storage，適合你先快速 MVP 上線。之後若要開放公眾使用，建議再加上 Supabase Auth 與 RLS。

## KlingAI 設定

把以下值填入 `.env.local`：

```bash
KLING_ACCESS_KEY=
KLING_SECRET_KEY=
KLING_API_BASE_URL=https://api-singapore.klingai.com
KLING_IMAGE_TO_VIDEO_PATH=/v1/videos/image2video
KLING_QUERY_TASK_TEMPLATE=/v1/videos/image2video/{taskId}
KLING_MODEL_NAME=kling-v1-6
KLING_DURATION_SECONDS=5
```

說明：

- 我把 Kling base URL 與 query path 都做成 env，因為官方文件版本與區域 endpoint 近年有變動。
- `src/lib/kling.ts` 已把 JWT bearer token 簽名與建立 / 查詢 task 的邏輯抽出，若你的帳號對應欄位格式不同，只需要在這個檔案微調。

## Vercel 部署

1. push 到 GitHub。
2. 在 Vercel import repository。
3. 把 `.env.example` 內所有環境變數填到 Vercel。
4. Deploy。

建議另外在 Vercel 加上：

- `NEXT_PUBLIC_APP_URL=https://你的網域`

這樣 Kling callback 與等待頁輪詢連結會正確。

## 後續可再加

- Supabase Auth 登入與專案權限
- 背景 render worker，避免大型片段全在瀏覽器合成
- Email / webhook 通知
- 更完整的 transition library 與字幕/音樂軌
