<p align="center">
  <img src="public/Cloud.jpeg" alt="CloudPipe" width="180" />
</p>

<h1 align="center">CloudPipe</h1>

<p align="center">
  <strong>Your own Vercel. On your own machine. Deploy from your phone.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@jeffrey0117/cloudpipe"><img src="https://img.shields.io/npm/v/@jeffrey0117/cloudpipe?color=blue" alt="npm" /></a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node 18+" />
  <img src="https://img.shields.io/badge/MCP_tools-31+-purple" alt="MCP Tools" />
</p>

<p align="center">
  <strong>English</strong> | <a href="README.zh-TW.md">繁體中文</a>
</p>

---

## Picture This

You're on the bus. You have an idea for a side project.

You open Telegram, tell [ClaudeBot](https://github.com/Jeffrey0117/ClaudeBot) to write the code. It pushes to GitHub. CloudPipe picks it up, builds it, deploys it, and sends you a message:

> **Deploy successful.** `myapp.yourdomain.com` is live. 32s.

Your app is online before you get off the bus.

Something breaks at 3 AM? CloudPipe pings your phone. You type `/restart myapp`. Fixed. Go back to sleep.

Want to add a feature? Tell the AI. It calls CloudPipe's MCP tools, deploys the update, and notifies you when it's done. You never open a terminal.

**That's CloudPipe.** A self-hosted deployment platform that turns your machine into Vercel — except you own it, it costs nothing, and you control everything from Telegram.

---

## Why Not Just Use Vercel?

| | Vercel / Railway | Zeabur | **CloudPipe** |
|---|---|---|---|
| Cost | $20+/mo | Pay per use | **$0 (your machine)** |
| You own everything | No | No | **Yes** |
| Deploy from phone | No | No | **Yes (Telegram bot)** |
| AI deploys for you | No | No | **Yes (31+ MCP tools)** |
| Multi-machine sync | N/A | N/A | **Auto via Redis** |
| Bot notifications | No | No | **Success, failure, crash** |
| Manage from chat | No | No | **Deploy, restart, logs, env** |

You get the convenience of a managed platform with the freedom of self-hosting.

---

## The Full Picture: ClaudeBot + CloudPipe

Pair CloudPipe with [ClaudeBot](https://github.com/Jeffrey0117/ClaudeBot) and your entire dev workflow lives in Telegram:

```
You:        "Build me a URL shortener with analytics"
ClaudeBot:  writes code, pushes to GitHub
CloudPipe:  detects push, builds, deploys
CloudPipe:  "Deploy successful. short.yourdomain.com is live."

You:        "Add click tracking by country"
ClaudeBot:  updates code, pushes
CloudPipe:  "Deploy successful. 28s."

You:        /status
CloudPipe:  "3 projects running. All healthy."

You:        /restart short
CloudPipe:  "Restarted. Health check passed."
```

**Idea to production. From your phone. Without opening a laptop.**

---

## What Makes It Ridiculous

### 6 Ways to Deploy

No other self-hosted platform gives you this many options:

| Method | Example |
|--------|---------|
| **Git Push** | Push to GitHub, auto-deploys via webhook |
| **CLI** | `cloudpipe deploy` — auto-detects everything |
| **Dashboard** | One-click deploy from web UI |
| **Telegram** | `/deploy myapp` from your phone |
| **REST API** | `POST /api/_admin/deploy` with JWT |
| **AI Agent** | AI calls MCP tools to deploy for you |

### AI-Native: 31+ MCP Tools

CloudPipe has a built-in **Model Context Protocol server**. Any AI agent (Claude, GPT, local LLMs) can manage your entire infrastructure:

```
"Deploy my project"           → deploy_project
"Show the logs for myapp"     → get_logs
"Create a new ad campaign"    → adman_create_ad
"Generate study flashcards"   → autocard_generate_content
"List all users"              → letmeuse_list_users
```

The magic: tools are **auto-discovered** from your deployed apps. Deploy a FastAPI service with OpenAPI docs? CloudPipe instantly creates MCP tools from every endpoint. Zero configuration.

### Telegram Bot — Not Just Notifications

Deploy, restart, monitor, and manage — all from chat:

- `/deploy myapp` — deploy with confirmation buttons
- `/restart myapp` — PM2 restart from anywhere
- `/status` — all projects, memory, CPU, uptime
- `/machines` — multi-machine overview
- `/envtoken` — secure one-time `.env` download

Deploy fails? You get a notification with the error. Deploy succeeds? You get the URL and duration. A machine goes offline? Instant alert.

### Multi-Machine Auto-Sync

Run CloudPipe on multiple machines. They coordinate automatically:

- Machine A deploys → Machine B syncs within **30 seconds**
- Only one bot polls GitHub (**leader election** with auto-failover)
- Machine goes down → Telegram alert within **90 seconds**
- All state shared via Redis — zero manual coordination

### Hot-Reload APIs

Drop a `.js` file, get a live API. No restart, no redeploy:

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

Upload → `https://api.yourdomain.com/hello` is live instantly.

### Auto-Detects Everything

Next.js, Vite, React, Vue, Angular, Express, Fastify, Koa, FastAPI, static sites — CloudPipe figures out what you're running, installs dependencies, builds, and starts it with PM2. You don't configure anything.

---

## Quick Start

```bash
npm i -g @jeffrey0117/cloudpipe
```

Or clone:

```bash
git clone https://github.com/Jeffrey0117/CloudPipe.git
cd CloudPipe && npm install
cp config.example.json config.json
node index.js
```

Dashboard at `http://localhost:8787/admin`.

---

## The Numbers

| | |
|---|---|
| MCP tools | **31+** (auto-discovered from your apps) |
| Deploy methods | **6** |
| Frameworks detected | **10+** |
| Admin API endpoints | **25+** |
| Cross-machine sync | **30 seconds** |
| Monthly cost | **$0** |

---

## License

MIT

</content>
</invoke>