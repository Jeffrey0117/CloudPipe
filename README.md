<p align="center">
  <img src="public/LOGO.png" alt="CloudPipe" width="180" />
</p>

<h1 align="center">CloudPipe</h1>

<p align="center">
  <strong>Self-Hosted Micro Deploy Platform</strong><br/>
  Your own mini Vercel / Railway &mdash; one JS file, one public API.
</p>

<p align="center">
  <code>Node.js</code>&nbsp;&nbsp;|&nbsp;&nbsp;<code>Cloudflare Tunnel</code>&nbsp;&nbsp;|&nbsp;&nbsp;<code>Zero Config</code>
</p>

---

## TL;DR

```
Upload a .js file  -->  Get a public API instantly
Upload a .zip file -->  Get a subdomain website
```

No nginx. No SSL. No CI/CD pipeline. Just drop and go.

---

## [ZH] 中文說明

### 核心概念

**一個 `.js` 檔案 = 一個公網 API**

上傳一個 JavaScript 檔案到 CloudPipe，立即獲得一個可用的公網 API。不需要額外跑 server，不需要設定 nginx，不需要管 SSL。

### 兩種部署模式

| 模式 | 網址格式 | 用途 |
|------|----------|------|
| **API 服務** | `api.yourdomain.com/xxx` | API、Webhook、微服務 |
| **專案部署** | `xxx.yourdomain.com` | 完整網站、靜態頁面 |

### 快速開始

```bash
# 1. 複製專案
git clone https://github.com/your-org/cloudpipe.git
cd cloudpipe

# 2. 安裝依賴
npm install

# 3. 設定 config.json
#    修改 domain、port、adminPassword 等

# 4. 啟動
node index.js
# 或 Windows 使用者
start.bat
```

啟動後打開 Dashboard 即可開始部署。

### API 服務

在 `handle()` 裡，你可以做任何事：

- 回傳 JSON 資料
- 讀寫本地檔案
- 下載遠端資源
- 呼叫其他 API
- 存資料庫 (SQLite、JSONL...)
- 處理 POST / GET / PUT / DELETE
- 設定 CORS 跨域

#### 基本結構

```javascript
// services/my-api.js
module.exports = {
  match(req) {
    return req.url.startsWith('/my-api');
  },

  handle(req, res) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ hello: 'world' }));
  }
};
```

上傳後 `https://api.yourdomain.com/my-api` 立即可用。

#### 完整範例：接收資料並存檔

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

    // POST /collector/save
    if (req.method === 'POST' && req.url === '/collector/save') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const data = JSON.parse(body);
        fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
        res.writeHead(200, headers);
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    // GET /collector/list
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

### 專案部署

**靜態網站**

```
apps/blog/
└── index.html
```

存取：`https://blog.yourdomain.com`

**Node.js 應用**

```javascript
// apps/api/server.js
module.exports = function(req, res) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
};
```

存取：`https://api.yourdomain.com`

### 目錄結構

```
cloudpipe/
├── index.js              # 入口
├── config.json           # 設定檔
├── start.bat             # Windows 一鍵啟動
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

### 設定

`config.json`:

```json
{
  "domain": "yourdomain.com",
  "port": 8787,
  "subdomain": "api",
  "adminPassword": "your-secure-password"
}
```

---

## [EN] English

### Concept

**One `.js` file = One public API**

Upload a JavaScript file to CloudPipe and instantly get a live public API endpoint. No extra server setup, no nginx config, no SSL management.

### Two Deploy Modes

| Mode | URL Pattern | Use Case |
|------|-------------|----------|
| **API Service** | `api.yourdomain.com/xxx` | APIs, Webhooks, Microservices |
| **Project Deploy** | `xxx.yourdomain.com` | Full websites, Static pages |

### Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/your-org/cloudpipe.git
cd cloudpipe

# 2. Install dependencies
npm install

# 3. Configure config.json
#    Set domain, port, adminPassword, etc.

# 4. Start
node index.js
# Or on Windows
start.bat
```

Open the Dashboard after startup to begin deploying.

### API Services

Inside `handle()`, you can do anything:

- Return JSON data
- Read/write local files
- Download remote resources
- Call external APIs
- Store data (SQLite, JSONL...)
- Handle POST / GET / PUT / DELETE
- Configure CORS

#### Basic Structure

```javascript
// services/my-api.js
module.exports = {
  match(req) {
    return req.url.startsWith('/my-api');
  },

  handle(req, res) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ hello: 'world' }));
  }
};
```

After upload: `https://api.yourdomain.com/my-api` is live.

#### Full Example: Receive and Store Data

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

    // POST /collector/save
    if (req.method === 'POST' && req.url === '/collector/save') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const data = JSON.parse(body);
        fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
        res.writeHead(200, headers);
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    // GET /collector/list
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

### Project Deploy

**Static Website**

```
apps/blog/
└── index.html
```

Access: `https://blog.yourdomain.com`

**Node.js App**

```javascript
// apps/api/server.js
module.exports = function(req, res) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
};
```

Access: `https://api.yourdomain.com`

### Directory Structure

```
cloudpipe/
├── index.js              # Entry point
├── config.json           # Configuration
├── start.bat             # Windows quick start
│
├── services/             # API services (upload .js)
│   ├── _example.js       # Example
│   └── your-api.js       # Your API
│
├── apps/                 # Projects (upload .zip)
│   └── {name}/
│
├── data/                 # Data storage (auto-created)
│   └── {service}/
│
└── public/               # Dashboard frontend
```

### Configuration

`config.json`:

```json
{
  "domain": "yourdomain.com",
  "port": 8787,
  "subdomain": "api",
  "adminPassword": "your-secure-password"
}
```

---

## License

MIT
