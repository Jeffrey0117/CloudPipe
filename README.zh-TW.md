<p align="center">
  <img src="public/Cloud.jpeg" alt="CloudPipe" width="180" />
</p>

<h1 align="center">CloudPipe</h1>

<p align="center">
  <strong>你自己的 Vercel。跑在你自己的機器。手機上就能部署。</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@jeffrey0117/cloudpipe"><img src="https://img.shields.io/npm/v/@jeffrey0117/cloudpipe?color=blue" alt="npm" /></a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node 18+" />
  <img src="https://img.shields.io/badge/MCP_tools-31+-purple" alt="MCP Tools" />
</p>

<p align="center">
  <a href="README.md">English</a> | <strong>繁體中文</strong>
</p>

---

## 想像一下

你在公車上，突然有個 side project 的靈感。

打開 Telegram，跟 [ClaudeBot](https://github.com/Jeffrey0117/ClaudeBot) 說要寫什麼。它寫好程式碼、push 到 GitHub。CloudPipe 偵測到，自動 build、部署，然後傳訊息給你：

> **部署成功。** `myapp.yourdomain.com` 已上線。32 秒。

你還沒下車，app 就已經在線上了。

凌晨三點掛了？CloudPipe 通知你的手機。你打 `/restart myapp`。修好了。繼續睡。

想加新功能？跟 AI 說。它呼叫 CloudPipe 的 MCP 工具，部署更新，完成後通知你。你從頭到尾沒打開過終端機。

**這就是 CloudPipe。** 一個自架部署平台，把你的機器變成 Vercel — 差別在你擁有它、不花錢、而且用 Telegram 就能控制一切。

---

## 為什麼不用 Vercel 就好？

| | Vercel / Railway | Zeabur | **CloudPipe** |
|---|---|---|---|
| 費用 | $20+/月 | 按量計費 | **$0（你的機器）** |
| 你擁有一切 | 不是 | 不是 | **是** |
| 手機上部署 | 不行 | 不行 | **可以（Telegram bot）** |
| AI 幫你部署 | 不行 | 不行 | **可以（31+ MCP 工具）** |
| 多機同步 | N/A | N/A | **Redis 自動同步** |
| Bot 通知 | 不行 | 不行 | **成功、失敗、掛掉都通知** |
| 聊天裡管理 | 不行 | 不行 | **部署、重啟、看 log、管環境變數** |

你得到的是託管平台的方便，加上自架的自由。

---

## 生態系：從新電腦到上線

CloudPipe 是一個完整工具鏈的一部分。每個工具消除一層摩擦：

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   DevUp          新電腦？一個指令。                       │
│   ↓              所有工具裝好、所有 repo clone 好、       │
│                  所有依賴裝好。                           │
│                                                         │
│   ZeroSetup      你的專案有 20 個安裝步驟？               │
│   ↓              現在只有一個：雙擊 setup.bat             │
│                                                         │
│   ClaudeBot      在手機上寫程式。                         │
│   ↓              AI 改你的程式碼，push 到 Git。           │
│                                                         │
│   CloudPipe      自動部署。                               │
│   ↓              通知你。你在聊天裡管理一切。               │
│                                                         │
│   MemoryGuy      7 個服務跑著，8GB+ RAM。                 │
│                  洩漏偵測。安全優化。                      │
│                  永遠不會誤殺所有進程。                    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

| 工具 | 消滅什麼痛點 | Repo |
|------|-------------|------|
| [**DevUp**](https://github.com/Jeffrey0117/DevUp) | 「設定新電腦要搞一整天」 | 一個指令重建你的整個工作環境 |
| [**ZeroSetup**](https://github.com/Jeffrey0117/ZeroSetup) | 「看 README、裝 Python、設 PATH...」 | `git clone` → 雙擊 → 跑起來 |
| [**ClaudeBot**](https://github.com/Jeffrey0117/ClaudeBot) | 「我要帶筆電才能寫程式」 | AI 在 Telegram 寫程式、語音轉程式碼、即時串流 |
| [**CloudPipe**](https://github.com/Jeffrey0117/CloudPipe) | 「部署很複雜又很貴」 | Git push → 上線。手機管理。$0。 |
| [**MemoryGuy**](https://github.com/Jeffrey0117/MemoryGuy) | 「哪個 node.exe 是哪個？有東西在漏記憶體嗎？」 | 記憶體洩漏偵測、安全優化、port 管理 |

**新電腦 → 環境就緒 → 手機寫程式 → 自動部署 → 聊天裡管理 → 穩穩跑著不爆炸。**

每一步都零摩擦。

---

## ClaudeBot + CloudPipe

搭在一起，你的整個開發流程都在 Telegram 裡：

```
你：         「幫我做一個短網址服務，要有點擊分析」
ClaudeBot：  寫好程式碼，push 到 GitHub
CloudPipe：  偵測到 push，build，部署
CloudPipe：  「部署成功。short.yourdomain.com 已上線。」

你：         「加一個按國家統計點擊的功能」
ClaudeBot：  更新程式碼，push
CloudPipe：  「部署成功。28 秒。」

你：         /status
CloudPipe：  「3 個專案運行中。全部健康。」

你：         /restart short
CloudPipe：  「已重啟。健康檢查通過。」
```

**從靈感到上線。在手機上。不用打開筆電。**

---

## 憑什麼這麼屌

### 6 種部署方式

沒有其他自架平台能做到：

| 方式 | 怎麼用 |
|------|--------|
| **Git Push** | push 到 GitHub，webhook 自動部署 |
| **CLI** | `cloudpipe deploy` — 自動偵測一切 |
| **Dashboard** | Web 後台一鍵部署 |
| **Telegram** | `/deploy myapp` 手機上部署 |
| **REST API** | `POST /api/_admin/deploy`，JWT 認證 |
| **AI Agent** | AI 呼叫 MCP 工具幫你部署 |

### AI 原生：31+ MCP 工具

CloudPipe 內建 **Model Context Protocol server**。任何 AI agent（Claude、GPT、本地模型）都能管理你的整個基礎設施：

```
「部署我的專案」              → deploy_project
「給我看 myapp 的 log」      → get_logs
「建一個新的廣告活動」        → adman_create_ad
「產生學習單字卡」            → autocard_generate_content
「列出所有使用者」            → letmeuse_list_users
```

最屌的是：工具是**自動發現**的。部署一個有 OpenAPI docs 的 FastAPI 服務？CloudPipe 自動從每個 endpoint 產生 MCP 工具。零設定。

### Telegram Bot — 不只是通知

部署、重啟、監控、管理 — 全部在聊天裡：

- `/deploy myapp` — 部署，有確認按鈕
- `/restart myapp` — 在任何地方 PM2 重啟
- `/status` — 所有專案的記憶體、CPU、uptime
- `/machines` — 多機器總覽
- `/envtoken` — 安全的一次性 `.env` 下載

部署失敗？你收到錯誤通知。部署成功？你收到 URL 和耗時。機器離線？即時警報。

### 多機器自動同步

在多台機器跑 CloudPipe，自動協調：

- A 機器部署 → B 機器 **30 秒**內同步
- 只有一台 bot 輪詢 GitHub（**leader 選舉** + 自動 failover）
- 機器掛掉 → **90 秒**內 Telegram 通知
- 所有狀態透過 Redis 共享 — 零手動設定

### 熱載入 API

丟一個 `.js` 檔，直接變公網 API。不用重啟、不用重新部署：

```javascript
// services/hello.js
module.exports = {
  match: (req) => req.url.startsWith('/hello'),
  handle: (req, res) => {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ message: 'Hello from CloudPipe' }))
  }
}
```

上傳 → `https://api.yourdomain.com/hello` 即時上線。

### 自動偵測所有框架

Next.js、Vite、React、Vue、Angular、Express、Fastify、Koa、FastAPI、靜態網站 — CloudPipe 自己判斷你跑什麼，裝依賴、build、用 PM2 啟動。你什麼都不用設定。

---

## 快速開始

```bash
npm i -g @jeffrey0117/cloudpipe
```

或 clone：

```bash
git clone https://github.com/Jeffrey0117/CloudPipe.git
cd CloudPipe && npm install
cp config.example.json config.json
node index.js
```

Dashboard 在 `http://localhost:8787/admin`。

---

## 數字說話

| | |
|---|---|
| MCP 工具 | **31+**（從你的 app 自動發現）|
| 部署方式 | **6 種** |
| 框架偵測 | **10+** 種 |
| Admin API 端點 | **25+** |
| 跨機器同步 | **30 秒** |
| 每月費用 | **$0** |

---

## License

MIT

</content>
</invoke>