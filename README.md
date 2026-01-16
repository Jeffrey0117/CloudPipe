# CloudPipe

Personal Deploy Platform - 個人部署平台

透過 Cloudflare Tunnel 將本地服務快速部署到公網。

## 核心概念

**一個 .js 檔案 = 一個公網 API**

上傳一個 JavaScript 檔案到 cloudpipe，立即獲得一個可用的公網 API。不需要額外跑 server，不需要設定 nginx，不需要管 SSL。

## 兩種部署模式

| 模式 | 網址 | 用途 |
|------|------|------|
| **API 服務** | `epi.isnowfriend.com/xxx` | API、Webhook、微服務 |
| **專案部署** | `xxx.isnowfriend.com` | 完整網站、靜態頁面 |

## 快速開始

```bash
# 啟動 cloudpipe
start.bat
# 或
node index.js
```

打開 `https://epi.isnowfriend.com` 進入 Dashboard。

---

## API 服務（重點！）

### 你可以做什麼

在 `handle()` 裡，你可以做**任何事**：

- 回傳 JSON 資料
- 讀寫本地檔案
- 下載遠端資源
- 呼叫其他 API
- 存資料庫（sqlite、jsonl...）
- 處理 POST/GET/PUT/DELETE
- 設定 CORS 跨域

### 基本結構

```javascript
// services/my-api.js
module.exports = {
  // 1. 匹配規則：哪些 URL 由此服務處理
  match(req) {
    return req.url.startsWith('/my-api');
  },

  // 2. 處理邏輯：你的業務邏輯都在這裡
  handle(req, res) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ hello: 'world' }));
  }
};
```

上傳後：`https://epi.isnowfriend.com/my-api` 就可以用了！

### 完整範例：接收資料並存檔

```javascript
// services/collector.js
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'records.jsonl');

module.exports = {
  match(req) {
    return req.url.startsWith('/collector');
  },

  handle(req, res) {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    };

    // POST /collector/save - 接收並存檔
    if (req.method === 'POST' && req.url === '/collector/save') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const data = JSON.parse(body);

        // 存到檔案
        fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');

        res.writeHead(200, headers);
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    // GET /collector/list - 讀取全部
    if (req.method === 'GET' && req.url === '/collector/list') {
      const content = fs.existsSync(DATA_FILE)
        ? fs.readFileSync(DATA_FILE, 'utf8')
        : '';
      const records = content.trim().split('\n').filter(Boolean).map(JSON.parse);

      res.writeHead(200, headers);
      res.end(JSON.stringify(records));
      return;
    }

    res.writeHead(404, headers);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
};
```

---

## 專案部署

### 靜態網站
```
apps/blog/
└── index.html
```
存取：`https://blog.isnowfriend.com`

### Node.js 應用
```javascript
// apps/api/server.js
module.exports = function(req, res) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
};
```
存取：`https://api.isnowfriend.com`

---

## 目錄結構

```
cloudpipe/
├── index.js              # 入口
├── config.json           # 設定
├── start.bat             # 一鍵啟動
│
├── services/             # API 服務（上傳 .js）
│   ├── _example.js       # 範例
│   └── your-api.js       # 你的 API
│
├── apps/                 # 專案（上傳 .zip）
│   └── {name}/
│
├── data/                 # 資料存放（自動建立）
│   └── {service}/
│
└── public/               # Dashboard 前端
```

## 設定

`config.json`:
```json
{
  "domain": "isnowfriend.com",
  "port": 8787,
  "subdomain": "epi"
}
```

## License

MIT
