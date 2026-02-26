<p align="center">
  <img src="public/Cloud.jpeg" alt="CloudPipe" width="180" />
</p>

<h1 align="center">CloudPipe</h1>

<p align="center">
  <strong>你自己的 Vercel。跑在你自己的機器上。零廠商綁定。</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@jeffrey0117/cloudpipe"><img src="https://img.shields.io/npm/v/@jeffrey0117/cloudpipe?color=blue" alt="npm" /></a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node 18+" />
  <img src="https://img.shields.io/badge/MCP_tools-31+-purple" alt="MCP Tools" />
  <img src="https://img.shields.io/badge/projects_in_production-7-orange" alt="Production" />
</p>

<p align="center">
  <a href="README.md">English</a> | <strong>繁體中文</strong>
</p>

---

**CloudPipe** 是一個自架部署平台，做的事跟 Vercel、Railway、Coolify 一樣 — 但跑在你自己的機器上，每月 $0，完全掌控。

一個 Node.js process。Git push 就部署。Telegram 即時通知。AI 原生 MCP server。不需要 Docker。

---

## 為什麼選 CloudPipe

| | Vercel / Railway | Coolify | **CloudPipe** |
|---|---|---|---|
| 費用 | $20+/月 | 免費（需要 Docker） | **免費（裸機直跑）** |
| 需要 Docker | - | 要 | **不用** |
| 部署方式 | Git push | Git push | **Git push + CLI + 上傳 + Telegram + API** |
| AI 整合 | 無 | 無 | **31+ MCP 工具，自動發現** |
| 多機同步 | N/A | 手動 | **Redis 自動同步** |
| 手機部署 | 不行 | 不行 | **可以（Telegram bot）** |
| 架設時間 | 5 分鐘 | 30 分鐘 | **5 分鐘** |

---

## 能做什麼

### Git Push → 秒級上線

接上 GitHub repo，CloudPipe 自動偵測框架、安裝依賴、build、PM2 啟動、設定 Cloudflare Tunnel DNS、健康檢查 — 全自動。

```
git push origin main
```

就這樣。你的 app 已經在 `yourapp.yourdomain.com` 上線了。

**自動偵測**：Next.js、Vite、React、Vue、Angular、Express、Fastify、Koa、FastAPI、靜態網站。

### 從任何地方部署

| 方式 | 怎麼用 |
|------|--------|
| **Git Push** | GitHub webhook，push 就自動部署 |
| **CLI** | `cloudpipe deploy` — 零設定，自動偵測一切 |
| **Dashboard** | Web 後台，一鍵部署、看 log、管環境變數 |
| **Telegram** | `/deploy myapp` 手機上直接部署 |
| **API** | 完整 REST API，JWT 認證 |
| **MCP** | AI agent 幫你部署，透過 Model Context Protocol |

### 31+ AI 工具 via MCP

CloudPipe 內建 **Model Context Protocol server**，把整個平台開放給 AI agent 操作。

```
「部署我的 app」        → AI 呼叫 deploy_project
「給我看 log」         → AI 呼叫 get_logs
「建一個新廣告」        → AI 呼叫 adman_create_ad
「產生單字卡」          → AI 呼叫 autocard_generate_content
```

工具**自動發現**。部署一個有 OpenAPI docs 的 FastAPI app？CloudPipe 自動從你的 endpoint 產生 MCP 工具。零設定。

### 多機同步

在 2 台以上機器跑 CloudPipe，透過 Redis 自動同步：

- **Leader 選舉** — 只有一台 bot 輪詢 GitHub，30 秒內自動 failover
- **部署廣播** — A 機器部署 → B 機器 30 秒內自動同步
- **心跳監控** — 90 秒 TTL，機器離線立刻 Telegram 通知
- **共享狀態** — 部署狀態、process 指標，全部同步

### Telegram Bot — 你的部署遙控器

不只是通知，是完整的控制：

- `/deploy myapp` — 觸發部署，有確認按鈕
- `/status` — 所有機器的 PM2 狀態、記憶體、CPU、uptime
- `/machines` — 哪些機器在線、各跑幾個 process
- `/restart myapp` — 躺在沙發上重啟服務
- `/envtoken` — 安全的一次性 `.env` 打包下載

凌晨三點部署掛了？你會收到通知。在床上修好它。

### 熱載入 API 服務

丟一個 `.js` 檔 → 即時獲得公網 API。不用重啟。

```javascript
// services/hello.js
module.exports = {
  match: (req) => req.url.startsWith('/hello'),
  handle: (req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ message: 'Hello from CloudPipe' }));
  }
};
```

上傳 → `https://api.yourdomain.com/hello` 立即可用。改檔案 → 即時生效。不用重新部署。

---

## 數字說話

| 指標 | 數值 |
|------|------|
| MCP 工具 | **31+**（7 核心 + 24 自動發現）|
| Admin API 端點 | **25+** |
| Telegram 指令 | **13** |
| 框架自動偵測 | **10+** 種框架 |
| 部署方式 | **6 種**（git、CLI、上傳、Telegram、API、MCP）|
| 健康檢查重試 | **5 次**，間隔 3 秒 |
| 跨機器同步 | **30 秒** |
| GitHub 輪詢備援 | **5 分鐘** |
| 架設時間 | **< 5 分鐘** |
| 每月費用 | **$0** |

---

## 快速開始

```bash
npm i -g @jeffrey0117/cloudpipe
```

或 clone 直接跑：

```bash
git clone https://github.com/Jeffrey0117/CloudPipe.git
cd CloudPipe && npm install
cp config.example.json config.json  # 填入你的 domain
node index.js
```

Dashboard 開在 `http://localhost:8787/admin`。

---

## 架構

```
cloudpipe/
├── src/core/
│   ├── server.js        # 啟動協調器
│   ├── router.js        # 子網域 + 路徑路由
│   ├── deploy.js        # Git 部署引擎（大腦）
│   ├── admin.js         # 25+ REST API 端點
│   ├── telegram.js      # 多機器 Telegram bot
│   ├── heartbeat.js     # 跨機器監控
│   ├── redis.js         # 多機器同步層
│   └── auth.js          # JWT 認證
├── mcp/                 # MCP server + 自動發現
├── sdk/                 # JavaScript SDK
├── bin/                 # CLI 入口
└── services/            # 熱載入 API 服務
```

---

## License

MIT

</content>
</invoke>