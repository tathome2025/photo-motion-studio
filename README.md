# MotionCut Studio

極簡、線條主導的 web app，用來把相片批量送到 KIE AI 提供的 Kling Video 3 生成動態片段，然後在同一個專案內排時間線、調整過場與主題，最後輸出 MP4。

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
- KIE AI Kling Video 3 API for image-to-video generation
- `ffmpeg.wasm` client-side export
- `dnd-kit` timeline sorting

## 已完成流程

1. 建立專案
2. 批量上傳最多約 100 張相片
3. 上傳時自動把相片統一成 16:9，直向相片會左右補黑邊
4. 顯示每張縮圖，最大視覺邊長小於 200px
5. 為每張相片指定 prompt，可選自訂動作或直接保留靜態相片
6. 批量提交 KIE AI Kling Video 3 生成任務
7. 等待頁輪詢任務狀態，完成後自動跳到剪輯頁
8. 已完成片段自動進入橫向 timeline
9. 拖放重排次序、刪除片段、刪除生成結果、最多重新生成 3 次
10. 每段設定過場、邊框、主題
11. 以瀏覽器內 `ffmpeg.wasm` 匯出 MP4

## 專案結構

```text
src/app/                         頁面與 API routes
src/components/                  前端互動元件
src/lib/                         Supabase/KIE AI/data helpers
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

## KIE AI Kling Video 3 設定

把以下值填入 `.env.local`：

```bash
KIE_API_KEY=
KIE_API_BASE_URL=https://api.kie.ai/api/v1
KIE_CREATE_TASK_PATH=/jobs/createTask
KIE_QUERY_TASK_TEMPLATE=/jobs/recordInfo?taskId={taskId}
KIE_MODEL_NAME=kling-video-v3
KIE_KLING_MODE=std
KLING_DURATION_SECONDS=5
```

說明：

- `KIE_API_KEY` 是唯一必填的 provider key。
- 預設 model 已改為 `kling-video-v3`。
- `src/lib/kling.ts` 現在是走 KIE AI 的 Bearer Token、`createTask` 與 `recordInfo` 流程。

## 升級 schema

如果你之前已經執行過一次 schema，這次請重新執行 [supabase/schema.sql](/Users/TY/photo-motion-studio/supabase/schema.sql)，因為新增了：

- `custom_prompt`
- `regeneration_count`
- `is_static_clip`

以及新的 prompt key 約束。

## Vercel 部署

1. push 到 GitHub。
2. 在 Vercel import repository。
3. 把 `.env.example` 內所有環境變數填到 Vercel。
4. Deploy。

建議另外在 Vercel 加上：

- `NEXT_PUBLIC_APP_URL=https://你的網域`

這樣 KIE AI callback 與等待頁輪詢連結會正確。

## 後續可再加

- Supabase Auth 登入與專案權限
- 背景 render worker，避免大型片段全在瀏覽器合成
- Email / webhook 通知
- 更完整的 transition library 與字幕/音樂軌
