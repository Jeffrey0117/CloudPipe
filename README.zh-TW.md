<p align="center">
  <img src="public/LOGO.png" alt="CloudPipe" width="180" />
</p>

<h1 align="center">CloudPipe</h1>

<p align="center">
  <strong>自架微型部署平台</strong><br/>
  你自己的 mini Vercel / Railway &mdash; 一個 JS 檔案，一個公網 API。
</p>

<p align="center">
  <code>Node.js</code>&nbsp;&nbsp;|&nbsp;&nbsp;<code>Cloudflare Tunnel</code>&nbsp;&nbsp;|&nbsp;&nbsp;<code>Zero Config</code>
</p>

<p align="center">
  <a href="README.md">English</a> | <strong>繁體中文</strong>
</p>

---

## 一句話說明

```
上傳一個 .js 檔案  -->  立即獲得公網 API
上傳一個 .zip 檔案 -->  立即獲得子網域網站
```

不用 nginx、不用 SSL、不用 CI/CD，放上去就能用。

---

## 核心概念

**一個 `.js` 檔案 = 一個公網 API**

上傳一個 JavaScript 檔案到 CloudPipe，立即獲得一個可用的公網 API。不需要額外跑 server，不需要設定 nginx，不需要管 SSL。

## 兩種部署模式

| 模式 | 網址格式 | 用途 |
|------|----------|------|
| **API 服務** | `api.yourdomain.com/xxx` | API、Webhook、微服務 |
| **專案部署** | `xxx.yourdomain.com` | 完整網站、靜態頁面 |

## 快速開始

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

## API 服務

在 `handle()` 裡，你可以做任何事：

- 回傳 JSON 資料
- 讀寫本地檔案
- 下載遠端資源
- 呼叫其他 API
- 存資料庫（SQLite、JSONL...）
- 處理 POST / GET / PUT / DELETE
- 設定 CORS 跨域

### 基本結構

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

## 專案部署

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

## 目錄結構

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

## 設定

`config.json`：

```json
{
  "domain": "yourdomain.com",
  "port": 8787,
  "subdomain": "api",
  "adminPassword": "your-secure-password"
}
```

## 授權

MIT
