# Admin Settings 頁面設計規範

## 頁面結構

### 1. 服務管理 (servicesGrid)
**目的：快速總覽所有服務狀態**

顯示內容：
- LurlHub（固定）
- 所有 Git 部署專案

顯示格式：卡片式，包含：
- 服務名稱 + Port
- 簡短描述
- 狀態標籤（運行中 / 失敗 / commit hash）

點擊行為：開啟專案詳情 Modal

### 2. 已部署 (deployedList)
**目的：提供詳細操作按鈕**

顯示內容：
- 所有 Git 部署專案（含操作按鈕）
- API 服務
- 上傳的靜態專案

顯示格式：列表式，包含：
- 名稱 + 連結
- 部署時間 / URL
- 狀態（Vercel 風格，顯示 commit hash）
- 操作按鈕：Log / 開啟 / 重新部署 / 刪除

## 重要設計決策

### Git 專案同時出現在兩個區塊
這是**刻意設計**，不是重複錯誤：
- **服務管理**：快速查看狀態
- **已部署**：執行操作（查 Log、重新部署等）

兩邊顯示的資訊和互動方式不同，服務不同目的。

### 狀態顯示（Vercel 風格）
- 成功：`✓ abc1234`（綠色，顯示 runningCommit）
- 失敗但有舊版運行：`✗ 失敗` + `運行中: abc1234`
- 失敗無舊版：`✗ 部署失敗`

需要的資料欄位：
- `lastDeployStatus`: 'success' | 'failed'
- `runningCommit`: 成功部署時記錄的 commit hash
- `lastDeployCommit`: 最後一次嘗試部署的 commit（不論成敗）

## 修改歷史
- 2026-01-22: 新增 runningCommit 欄位，實作 Vercel 風格狀態顯示
- 2026-01-22: 新增 windowsHide: true 到所有 execSync 呼叫（解決 CMD 彈出問題）
