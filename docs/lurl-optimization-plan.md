# LurlHub 後端優化規劃

> 記錄日期：2026-01-23
> 狀態：規劃中，待討論
>
> **優化重點：**
> - 腳本使用者上傳體驗
> - 後端管控機制
> - 效能與架構優化

---

## 🎯 核心優化目標

### 使用者使用流程
```
腳本使用者（瀏覽器擴充）
    ↓ 上傳請求（fileUrl, pageUrl, title...）
LurlHub 後端
    ↓ 驗證、管控、處理
    ├─ 額度檢查
    ├─ 頻率限制
    ├─ 內容審核
    └─ 儲存處理
    ↓ 回傳結果
腳本使用者收到回應
```

---

## 🔥 重點優化項目

### 1. 後端管控機制強化

#### 1.1 額度管理優化
**現況：**
- 已有基本額度系統（每日額度、總額度）
- 透過 redeem code 增加額度

**待優化：**
```javascript
// 更細緻的額度控制
{
  daily: {
    uploads: 50,        // 每日上傳次數
    storage: 500MB,     // 每日儲存空間
    downloads: 100      // 每日下載配額（如果有提供下載服務）
  },
  total: {
    storage: 5GB,       // 總儲存空間
    records: 1000       // 總記錄數
  },
  rate: {
    perMinute: 10,      // 每分鐘最多 10 次請求
    perHour: 100        // 每小時最多 100 次
  }
}
```

**需要討論：**
- [ ] 當前額度設定是否合理？
- [ ] 是否需要「軟限制」（超過後降速不是完全禁止）？
- [ ] VIP 使用者的額度應該是多少？
- [ ] 額度重置時間？（凌晨、滾動 24 小時）

#### 1.2 頻率限制（Rate Limiting）
**現況：**
- 目前沒有嚴格的頻率限制

**建議實作：**
```javascript
// 使用 Redis 或記憶體實作 Rate Limiter
const rateLimits = {
  default: {
    windowMs: 60000,      // 1 分鐘
    max: 10,              // 最多 10 次請求
    message: '請求過於頻繁，請稍後再試'
  },
  upload: {
    windowMs: 60000,      // 1 分鐘
    max: 5,               // 最多 5 次上傳
    skipSuccessfulRequests: false
  },
  vip: {
    windowMs: 60000,
    max: 30               // VIP 更高限制
  }
}
```

**技術方案：**
- 方案 A：使用 `express-rate-limit`（簡單）
- 方案 B：自己實作（可以更精細控制）
- 方案 C：使用 Redis（分散式環境適用）

#### 1.3 內容審核與防濫用
**待討論：**
- [ ] 需要檢查檔案類型嗎？（只允許特定類型）
- [ ] 需要檔案大小限制嗎？（單檔上限）
- [ ] 需要掃毒嗎？（ClamAV 整合）
- [ ] 需要黑名單機制嗎？（封鎖特定網域/使用者）
- [ ] 需要內容審核嗎？（AI 檢測違規內容）

---

### 2. 後端效能優化

#### 2.1 API 效能優化
**現況檢查點：**
```javascript
// 需要評估的 API 端點
GET  /lurl/api/records     ← 列表查詢（最常用）
POST /lurl/api/submit      ← 上傳（最關鍵）
GET  /lurl/api/record/:id  ← 單筆查詢
GET  /lurl/media/:file     ← 檔案存取
```

**優化方向：**

**a) 查詢優化**
```sql
-- 檢查是否有必要的索引
CREATE INDEX IF NOT EXISTS idx_records_visitor_created
  ON records(visitorId, createdAt DESC);

CREATE INDEX IF NOT EXISTS idx_records_type
  ON records(type);

CREATE INDEX IF NOT EXISTS idx_records_blocked
  ON records(blocked);
```

**b) 分頁載入**
```javascript
// 改善記錄列表載入
// 目前：一次載入所有記錄（可能很慢）
// 優化：實作分頁或無限滾動
GET /lurl/api/records?page=1&limit=50
GET /lurl/api/records?offset=0&limit=50
```

**c) 回應快取**
```javascript
// 靜態內容快取
app.use('/lurl/media', express.static('data/lurl', {
  maxAge: '1d',           // 快取 1 天
  etag: true,
  lastModified: true
}));

// API 快取（適用於不常變動的資料）
// 例如：使用者資訊、統計數據
```

**d) 資料庫連線池**
```javascript
// 如果查詢量大，考慮連線池
// SQLite 改用 better-sqlite3 的 WAL 模式
const db = new Database('data/lurl.db', {
  readonly: false,
  fileMustExist: false,
  timeout: 5000
});
db.pragma('journal_mode = WAL');  // 提升併發效能
```

#### 2.2 檔案處理效能
**現況：**
- 下載、縮圖、HLS 轉檔都需要時間

**優化方向：**

**a) 非同步處理**
```javascript
// 上傳 → 立即回傳 jobId → 背景處理
POST /lurl/api/submit
  ↓ 立即回應
{
  "ok": true,
  "id": "abc123",
  "status": "pending",
  "jobId": "xyz789"  // 可以查詢處理進度
}
  ↓ 背景處理（workr）
  ├─ 下載檔案
  ├─ 產生縮圖
  └─ HLS 轉檔（如果需要）
```

**b) 批次處理優化**
```javascript
// 使用 workr 批次處理，避免阻塞
// 例如：一次提交多個下載請求
POST /lurl/api/batch-submit
{
  "records": [
    { "fileUrl": "...", "pageUrl": "..." },
    { "fileUrl": "...", "pageUrl": "..." }
  ]
}
```

**c) 檔案處理並行化**
```javascript
// workr 並發數調整
const CONCURRENCY = {
  thumbnail: 5,   // 增加縮圖並發
  webp: 5,
  hls: 2,         // HLS 較耗資源
  download: 10    // 下載可以更多
};
```

#### 2.3 資料庫結構優化
**現況檢查：**
- SQLite 是否足夠？（記錄數量、查詢效能）
- 是否需要資料表拆分？

**待討論：**
- [ ] 目前有多少記錄？增長速度？
- [ ] 查詢是否變慢？
- [ ] 是否需要歷史資料歸檔？

**可能的優化：**
```sql
-- 歷史記錄歸檔（超過 6 個月自動歸檔）
CREATE TABLE records_archive AS SELECT * FROM records WHERE ...;

-- 資料表拆分（如果記錄量很大）
CREATE TABLE records_2026_01 ...;
CREATE TABLE records_2026_02 ...;

-- 冷熱分離（活躍記錄 vs 很少存取的記錄）
```

---

### 3. 上傳流程優化

#### 3.1 上傳速度優化
**現況：**
- 腳本使用者透過 API 上傳 fileUrl
- 後端下載檔案

**優化方向：**

**a) 並行下載**
```javascript
// 如果同一使用者提交多個下載
// 可以並行處理（在額度內）
const downloadQueue = {
  visitorId: 'xxx',
  jobs: [
    { id: 1, status: 'downloading', progress: 45% },
    { id: 2, status: 'pending' },
    { id: 3, status: 'pending' }
  ]
};
```

**b) 下載策略優化**
```javascript
// 智能重試策略
const downloadStrategies = [
  { method: 'direct', timeout: 30000 },       // 直接下載
  { method: 'puppeteer', timeout: 60000 },    // 瀏覽器模擬
  { method: 'proxy', timeout: 30000 }         // 透過 proxy
];

// 失敗自動切換下一個策略
```

**c) 斷點續傳**
```javascript
// 大檔案支援斷點續傳
// 避免網路中斷後重新下載
```

#### 3.2 上傳回應優化
**現況：**
- 同步等待所有處理完成才回應

**優化：**
```javascript
// 方案 A：立即回傳，非同步處理
POST /lurl/api/submit
→ 回應：{ id, status: 'processing', jobId }
→ 背景處理
→ 使用者輪詢或 WebSocket 接收進度

// 方案 B：SSE 即時推送進度
GET /lurl/api/job/:jobId/stream
→ 即時推送：{ progress: 45%, status: 'downloading' }
```

---

### 4. 資料維護自動化

#### 4.1 自動排程任務
```javascript
// 定時任務（凌晨執行，不影響白天使用）
{
  "每天 02:00": [
    "修復 Untitled",
    "產生缺少的縮圖",
    "清理重複記錄"
  ],
  "每週日 03:00": [
    "重試失敗的下載",
    "修復路徑"
  ],
  "每月 1 號 04:00": [
    "清理 HLS 原檔",
    "歸檔舊記錄"
  ]
}
```

---

### 5. 監控與警報

#### 5.1 關鍵指標監控
```javascript
// 即時監控儀表板
{
  realtime: {
    activeUsers: 15,           // 當前活躍使用者
    requestsPerMinute: 120,    // 每分鐘請求數
    avgResponseTime: 250,      // 平均回應時間（ms）
    errorRate: 0.5%            // 錯誤率
  },
  resources: {
    cpuUsage: 45%,
    memoryUsage: 60%,
    diskUsage: 75%,
    diskIOPS: 1200
  },
  queues: {
    downloadQueue: 5,          // 等待下載的任務
    thumbnailQueue: 3,
    hlsQueue: 1
  }
}
```

#### 5.2 警報機制
```javascript
// 自動警報觸發條件
const alerts = {
  highErrorRate: {
    condition: 'errorRate > 5%',
    action: 'sendTelegram'
  },
  diskSpaceLow: {
    condition: 'diskUsage > 90%',
    action: 'sendTelegram + autoCleanup'
  },
  highLoad: {
    condition: 'cpuUsage > 80% for 5min',
    action: 'sendTelegram'
  }
};
```

---

## 🤖 自動化維護系統規格（待討論）

### 方案 C：混合模式（推薦）

#### 1. 自動排程設計

```
每天凌晨 2:00（輕量任務）
├─ 修復 Untitled          ← 本地執行，5 分鐘內完成
├─ 產生縮圖（限 50 個）   ← 本地執行，避免影響效能
└─ 清理重複記錄           ← 快速，本地執行

每週日凌晨 3:00（重量任務）
├─ 重試下載               ← 提交到 workr，可能需要 1-2 小時
└─ 修復路徑               ← 本地執行

每月 1 號凌晨 4:00（空間清理）
└─ 清理 HLS 原檔          ← 提交到 workr，釋放大量空間
```

#### 2. 檔案架構

```
services/lurl/
├── maintenance/
│   ├── scheduler.js              ← 主排程器（node-cron）
│   ├── config.js                 ← 排程設定
│   ├── logger.js                 ← 執行記錄
│   └── tasks/
│       ├── fix-untitled.js
│       ├── retry-download.js
│       ├── generate-thumbnails.js
│       ├── cleanup-duplicates.js
│       ├── repair-paths.js
│       └── cleanup-hls.js
data/
├── maintenance-config.json       ← 使用者可編輯的設定
└── maintenance-logs/
    └── 2026-01-23.json          ← 每日執行記錄
```

#### 3. 功能特性

**智能執行：**
- 檢測資料量，決定是否需要執行
- 例如：沒有 Untitled 記錄就跳過

**限流保護：**
- 批次處理（每次最多處理 N 筆）
- 避免系統卡頓

**執行記錄：**
- 記錄每次執行的時間、狀態、結果
- 可在管理後台查看

**通知機制：**
- 執行失敗時發送通知
- 可整合 Webhook、Telegram

**管理後台整合：**
- 查看自動執行歷史
- 可手動觸發任意任務
- 可臨時停用某個任務

#### 4. 設定檔範例

```javascript
// data/maintenance-config.json
{
  "enabled": true,
  "schedules": {
    "fixUntitled": {
      "cron": "0 2 * * *",
      "enabled": true,
      "maxRecords": 100,
      "skipIfEmpty": true
    },
    "generateThumbnails": {
      "cron": "0 3 * * *",
      "enabled": true,
      "maxRecords": 50,
      "useWorkr": false
    },
    "retryDownload": {
      "cron": "0 3 * * 0",
      "enabled": true,
      "maxRecords": 20,
      "useWorkr": true,
      "timeout": 7200000  // 2 hours
    },
    "cleanupDuplicates": {
      "cron": "0 4 * * 0",
      "enabled": true
    },
    "repairPaths": {
      "cron": "0 5 * * 0",
      "enabled": true
    },
    "cleanupHls": {
      "cron": "0 4 1 * *",
      "enabled": true,
      "keepDays": 7,  // 保留最近 7 天的原檔
      "useWorkr": true
    }
  },
  "notifications": {
    "webhook": "",
    "telegram": {
      "enabled": false,
      "botToken": "",
      "chatId": ""
    },
    "onSuccess": false,
    "onFailure": true,
    "onSkip": false
  },
  "limits": {
    "maxConcurrent": 1,  // 同時最多執行 1 個任務
    "maxDuration": 3600000  // 單個任務最長執行 1 小時
  }
}
```

#### 5. 管理後台設計

**新增「自動維護」區塊：**

```
┌─────────────────────────────────────────────────┐
│ 🤖 自動維護狀態                                  │
├─────────────────────────────────────────────────┤
│ ⚙️ 自動維護：✅ 啟用      [停用]               │
│ 📅 下次執行：2026-01-24 02:00 (修復 Untitled)  │
│ 📊 執行歷史：[查看記錄 →]                       │
│ ⚙️ 排程設定：[編輯 →]                          │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 📋 最近執行記錄                                  │
├────────┬──────────────┬────────┬─────────────────┤
│ 時間   │ 任務         │ 狀態   │ 結果            │
├────────┼──────────────┼────────┼─────────────────┤
│ 02:00  │ 修復Untitled │ ✅成功 │ 修復 5 筆記錄   │
│ 02:05  │ 產生縮圖     │ ✅成功 │ 產生 12 張縮圖  │
│ 02:10  │ 清理重複     │ ⚠️跳過 │ 無重複記錄      │
│ 03:00  │ 重試下載     │ 🔄執行中│ 處理中... (12%) │
└────────┴──────────────┴────────┴─────────────────┘
```

---

## 💡 其他後端優化方向

### 6. 架構優化
**現況：**
- 單一 lurl.js 檔案（8000+ 行）

**建議重構：**
```
services/lurl/
├── index.js                    ← 主入口
├── config.js                   ← 設定檔
├── routes/
│   ├── api.js                  ← API 路由
│   ├── media.js                ← 媒體檔案路由
│   └── admin.js                ← 管理後台路由
├── controllers/
│   ├── record.controller.js    ← 記錄相關邏輯
│   ├── user.controller.js      ← 使用者邏輯
│   └── quota.controller.js     ← 額度邏輯
├── services/
│   ├── download.service.js     ← 下載服務
│   ├── thumbnail.service.js    ← 縮圖服務
│   └── hls.service.js          ← HLS 服務
├── middleware/
│   ├── auth.js                 ← 身份驗證
│   ├── quota.js                ← 額度檢查
│   └── ratelimit.js            ← 頻率限制
└── database/
    ├── db.js                   ← 資料庫連線
    └── models/
        ├── record.js
        └── user.js
```

**優點：**
- 程式碼更容易維護
- 功能模組化
- 更容易測試
- 團隊協作更方便

### 7. 安全性強化
- [x] 身份驗證（visitorId）
- [ ] **Rate Limiting**（頻率限制）← 重要
- [ ] **Input Validation**（輸入驗證）
  - URL 格式檢查
  - 檔案類型白名單
  - 檔案大小限制
- [ ] **SQL Injection 防護**（使用 prepared statements）
- [ ] **XSS 防護**（sanitize 使用者輸入）
- [ ] **CORS 設定**（限制允許的來源）
- [ ] **檔案上傳安全**
  - 檔案類型檢查（MIME type）
  - 惡意檔案掃描

### 8. 資料備份與恢復
- [ ] **自動備份機制**
  ```javascript
  // 每日備份資料庫
  0 4 * * * → 備份 lurl.db

  // 每週備份檔案
  0 5 * * 0 → 備份 data/lurl/

  // 保留最近 30 天備份
  ```
- [ ] **異地備份**（S3, R2, Google Drive）
- [ ] **快速恢復測試**（定期測試恢復流程）

### 9. 日誌與除錯
**現況：**
- console.log 散落各處

**改善：**
```javascript
// 使用結構化日誌
const logger = require('winston');

logger.info('Record created', {
  recordId: 'abc123',
  visitorId: 'xxx',
  fileSize: 1024000
});

logger.error('Download failed', {
  recordId: 'abc123',
  error: err.message,
  stack: err.stack
});
```

**日誌分類：**
- `access.log` - 所有 API 請求
- `error.log` - 錯誤記錄
- `download.log` - 下載相關
- `quota.log` - 額度異常
- `security.log` - 安全事件

---

## 📊 需要收集的關鍵數據

為了更好地規劃優化，需要了解以下數據：

### 1. 使用者與流量
```javascript
{
  users: {
    total: ?,              // 總使用者數
    active: ?,             // 活躍使用者（最近 30 天）
    vip: ?,                // VIP 使用者數
    growth: ?              // 每月增長率
  },
  traffic: {
    avgRequestsPerDay: ?,  // 每日平均請求數
    peakRequestsPerHour: ?,// 尖峰時段請求數
    avgUploadPerDay: ?     // 每日平均上傳數
  }
}
```

### 2. 儲存與資源
```javascript
{
  storage: {
    totalUsed: ?,          // GB - 目前使用量
    totalAvailable: ?,     // GB - 總容量
    growthPerMonth: ?,     // GB - 每月增長
    fileCount: ?,          // 總檔案數
    avgFileSize: ?         // MB - 平均檔案大小
  },
  database: {
    recordCount: ?,        // 總記錄數
    dbSize: ?,             // MB - 資料庫大小
    avgQueryTime: ?        // ms - 平均查詢時間
  }
}
```

### 3. 效能指標
```javascript
{
  api: {
    avgResponseTime: ?,    // ms - API 平均回應
    p95ResponseTime: ?,    // ms - 95% 請求的回應時間
    errorRate: ?           // % - 錯誤率
  },
  processing: {
    downloadSuccessRate: ?,// % - 下載成功率
    avgDownloadTime: ?,    // s - 平均下載時間
    thumbnailSuccessRate: ?,
    hlsSuccessRate: ?
  }
}
```

---

## 🎯 建議實作優先順序

### 🔴 高優先（立即著手）

1. **Rate Limiting（頻率限制）**
   - 防止濫用
   - 保護系統穩定性
   - 實作難度：低
   - 預估時間：1-2 天

2. **資料維護自動化**
   - 減少手動工作
   - 改善資料品質
   - 實作難度：中
   - 預估時間：3-5 天

3. **API 效能優化**
   - 加上必要的資料庫索引
   - 實作分頁載入
   - 實作難度：低
   - 預估時間：1-2 天

### 🟡 中優先（近期規劃）

4. **額度系統增強**
   - 更細緻的管控
   - 分級使用者
   - 實作難度：中
   - 預估時間：3-5 天

5. **監控儀表板**
   - 了解系統狀況
   - 及早發現問題
   - 實作難度：中
   - 預估時間：5-7 天

6. **檔案處理非同步化**
   - 立即回應，背景處理
   - 改善使用者體驗
   - 實作難度：中高
   - 預估時間：5-7 天

### 🟢 低優先（長期規劃）

7. **架構重構**
   - 模組化程式碼
   - 改善維護性
   - 實作難度：高
   - 預估時間：2-3 週

8. **進階功能**
   - 批次上傳、斷點續傳等
   - 實作難度：中高
   - 預估時間：視功能而定

---

## 💬 待討論清單

### 管控相關
- [ ] 目前額度設定是否合理？需要調整嗎？
- [ ] Rate Limiting 的限制值應該設多少？
- [ ] 需要檔案類型白名單嗎？（只允許特定類型）
- [ ] 需要檔案大小限制嗎？（單檔上限多少？）
- [ ] 如何處理違規使用者？（警告、暫停、永久封鎖）

### 效能相關
- [ ] 目前系統負載如何？有效能瓶頸嗎？
- [ ] 資料庫查詢會慢嗎？
- [ ] 下載失敗率高嗎？主要原因？
- [ ] workr 處理速度足夠嗎？

### 架構相關
- [ ] 是否需要重構程式碼？（8000+ 行有點難維護）
- [ ] 是否需要 Redis？（快取、Rate Limiting）
- [ ] SQLite 是否足夠？需要升級 PostgreSQL 嗎？
- [ ] 是否需要 CDN？（加速檔案存取）

### 維護相關
- [ ] 哪些維護任務最重要？
- [ ] 多久執行一次？
- [ ] 需要通知機制嗎？（Telegram、Email）

---

## 📋 下一步行動

1. **收集數據** - 建立簡單的統計查詢，了解目前狀況
2. **討論優先順序** - 根據實際情況決定先做什麼
3. **制定計畫** - 確定實作順序和時程
4. **開始實作** - 從高優先項目開始

---

## 📝 備註

- 此文件會持續更新
- 優化重點：**管控、效能、自動化**
- 所有改動都會保持向下相容

---

最後更新：2026-01-23
