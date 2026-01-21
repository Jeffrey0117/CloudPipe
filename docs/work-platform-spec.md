# Work Platform 規格書

## 概述

Work Platform 是一個通用的任務佇列服務，專門處理耗時的背景任務。
作為獨立專案部署在 CloudPipe 上，提供 API 給其他服務使用。

## 目標

1. **解耦** - 耗時任務從主服務抽離
2. **可擴展** - 可部署多個 Worker 實例
3. **通用** - 任何服務都能使用
4. **可觀測** - 即時進度、狀態查詢

---

## 架構

```
┌─────────────────────────────────────────────────────────┐
│                    Work Platform                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐          │
│  │   API    │───►│  Queue   │───►│ Workers  │          │
│  │  Server  │    │ (Memory/ │    │          │          │
│  │          │◄───│  Redis)  │◄───│ Worker 1 │          │
│  └──────────┘    └──────────┘    │ Worker 2 │          │
│       │                          │ ...      │          │
│       │ SSE                      └──────────┘          │
│       ▼                                                │
│  ┌──────────┐                                          │
│  │ Clients  │                                          │
│  │ (Lurl,   │                                          │
│  │  etc.)   │                                          │
│  └──────────┘                                          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Job Types（任務類型）

### 1. `hls` - HLS 轉檔
將影片轉換為多畫質 HLS 串流格式。

```json
{
  "type": "hls",
  "payload": {
    "inputPath": "/path/to/video.mp4",
    "outputDir": "/path/to/hls/output",
    "qualities": ["1080p", "720p", "480p"]
  }
}
```

### 2. `thumbnail` - 縮圖生成
從影片擷取縮圖。

```json
{
  "type": "thumbnail",
  "payload": {
    "videoPath": "/path/to/video.mp4",
    "outputPath": "/path/to/thumb.webp",
    "timestamp": "00:00:01",
    "width": 320
  }
}
```

### 3. `download` - 檔案下載
下載檔案，支援重試和 Puppeteer 模式。

```json
{
  "type": "download",
  "payload": {
    "url": "https://example.com/file.mp4",
    "outputPath": "/path/to/output.mp4",
    "headers": { "Referer": "https://example.com" },
    "cookies": "...",
    "usePuppeteer": false
  }
}
```

### 4. `webp` - 圖片轉換
將圖片轉換為 WebP 格式。

```json
{
  "type": "webp",
  "payload": {
    "inputPath": "/path/to/image.jpg",
    "outputPath": "/path/to/image.webp",
    "quality": 80
  }
}
```

### 5. `deploy` - Git 部署
執行 Git 專案部署。

```json
{
  "type": "deploy",
  "payload": {
    "projectId": "myspeedtest",
    "repoUrl": "https://github.com/user/repo.git",
    "branch": "master",
    "directory": "/path/to/project",
    "buildCommand": "npm run build"
  }
}
```

---

## API 設計

### Base URL
```
https://work.isnowfriend.com/api
```

### 認證
```
Authorization: Bearer <API_KEY>
```

---

### 1. 提交任務

**POST /jobs**

Request:
```json
{
  "type": "thumbnail",
  "payload": {
    "videoPath": "/data/videos/abc.mp4",
    "outputPath": "/data/thumbnails/abc.webp"
  },
  "priority": 1,
  "callback": "https://lurl.example.com/webhook/job-done"
}
```

Response:
```json
{
  "jobId": "job_abc123",
  "status": "queued",
  "createdAt": "2026-01-22T12:00:00Z"
}
```

---

### 2. 查詢任務狀態

**GET /jobs/:id**

Response:
```json
{
  "jobId": "job_abc123",
  "type": "thumbnail",
  "status": "completed",
  "progress": 100,
  "result": {
    "outputPath": "/data/thumbnails/abc.webp",
    "size": 12345
  },
  "createdAt": "2026-01-22T12:00:00Z",
  "startedAt": "2026-01-22T12:00:01Z",
  "finishedAt": "2026-01-22T12:00:03Z",
  "duration": 2000
}
```

---

### 3. 取消任務

**DELETE /jobs/:id**

Response:
```json
{
  "jobId": "job_abc123",
  "status": "cancelled"
}
```

---

### 4. 列出任務

**GET /jobs**

Query Parameters:
- `status`: queued | running | completed | failed
- `type`: hls | thumbnail | download | webp | deploy
- `limit`: 數量限制（預設 20）

Response:
```json
{
  "jobs": [...],
  "total": 42,
  "queued": 5,
  "running": 2
}
```

---

### 5. 即時進度（SSE）

**GET /events**

```javascript
const es = new EventSource('/api/events?token=xxx');
es.onmessage = (e) => {
  const data = JSON.parse(e.data);
  // { jobId, status, progress, message }
};
```

Event Types:
- `job:started` - 任務開始
- `job:progress` - 進度更新
- `job:completed` - 任務完成
- `job:failed` - 任務失敗

---

## Job 狀態機

```
  ┌─────────┐
  │ queued  │ ← 新任務
  └────┬────┘
       │
       ▼
  ┌─────────┐
  │ running │ ← Worker 開始處理
  └────┬────┘
       │
   ┌───┴───┐
   ▼       ▼
┌─────┐ ┌──────┐
│done │ │failed│
└─────┘ └──┬───┘
           │ retry?
           ▼
      ┌─────────┐
      │ queued  │ ← 重新排隊
      └─────────┘
```

---

## 優先級

| Priority | 說明 | 使用場景 |
|----------|------|----------|
| 0 | 最高 | 使用者主動觸發 |
| 1 | 高 | 縮圖生成 |
| 2 | 中 | 下載重試 |
| 3 | 低 | HLS 轉檔 |
| 4 | 最低 | 批次處理 |

---

## 並發控制

```javascript
const CONCURRENCY = {
  hls: 1,        // CPU 密集，一次只跑一個
  thumbnail: 3,  // 較快，可並發
  download: 5,   // IO 密集，可多並發
  webp: 3,
  deploy: 1      // 避免衝突
};
```

---

## 錯誤重試

- 預設重試 3 次
- 指數退避：1s → 2s → 4s
- 可配置每種任務的重試策略

```json
{
  "retryPolicy": {
    "maxRetries": 3,
    "backoff": "exponential",
    "initialDelay": 1000
  }
}
```

---

## Callback（完成通知）

任務完成後，POST 到指定 URL：

```json
{
  "jobId": "job_abc123",
  "status": "completed",
  "result": { ... },
  "duration": 2000
}
```

---

## 專案結構

```
work-platform/
├── package.json
├── server.js           # 入口
├── src/
│   ├── api/
│   │   ├── jobs.js     # Job API
│   │   └── events.js   # SSE
│   ├── queue/
│   │   ├── index.js    # Queue 介面
│   │   ├── memory.js   # Memory Queue
│   │   └── redis.js    # Redis Queue (optional)
│   ├── workers/
│   │   ├── index.js    # Worker Manager
│   │   ├── hls.js      # HLS Worker
│   │   ├── thumbnail.js
│   │   ├── download.js
│   │   ├── webp.js
│   │   └── deploy.js
│   └── utils/
│       ├── ffmpeg.js
│       └── puppeteer.js
├── config.json
└── README.md
```

---

## 環境變數

```env
PORT=4002
API_KEY=your-secret-key
QUEUE_TYPE=memory          # memory | redis
REDIS_URL=redis://localhost:6379
MAX_CONCURRENT_JOBS=5
DATA_DIR=/data/work
```

---

## 部署

透過 CloudPipe 部署：

```json
{
  "id": "work-platform",
  "repoUrl": "https://github.com/Jeffrey0117/work-platform.git",
  "branch": "master",
  "port": 4002,
  "buildCommand": "npm install"
}
```

---

## Lurl 整合範例

```javascript
// lurl.js 中呼叫 Work Platform

async function queueThumbnail(videoPath, outputPath) {
  const res = await fetch('https://work.isnowfriend.com/api/jobs', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + WORK_API_KEY
    },
    body: JSON.stringify({
      type: 'thumbnail',
      payload: { videoPath, outputPath },
      callback: 'https://epi.isnowfriend.com/lurl/webhook/thumbnail-done'
    })
  });
  return res.json();
}
```

---

## 未來擴展

1. **Dashboard** - 視覺化任務監控
2. **多節點** - 分散式 Worker
3. **排程任務** - Cron Job 支援
4. **資源監控** - CPU/Memory 使用率
5. **任務依賴** - Job A 完成後觸發 Job B

---

## 時程建議

| 階段 | 內容 | 優先級 |
|------|------|--------|
| Phase 1 | 基礎架構 + Memory Queue + thumbnail/webp | 高 |
| Phase 2 | HLS Worker + 進度回報 | 高 |
| Phase 3 | Download Worker (Puppeteer) | 中 |
| Phase 4 | Deploy Worker + Callback | 中 |
| Phase 5 | Redis Queue + Dashboard | 低 |
