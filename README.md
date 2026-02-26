<p align="center">
  <img src="public/Cloud.jpeg" alt="CloudPipe" width="180" />
</p>

<h1 align="center">CloudPipe</h1>

<p align="center">
  <strong>Your own Vercel. On your own machine. Zero vendor lock-in.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@jeffrey0117/cloudpipe"><img src="https://img.shields.io/npm/v/@jeffrey0117/cloudpipe?color=blue" alt="npm" /></a>
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node 18+" />
  <img src="https://img.shields.io/badge/MCP_tools-31+-purple" alt="MCP Tools" />
  <img src="https://img.shields.io/badge/projects_in_production-7-orange" alt="Production" />
</p>

<p align="center">
  <strong>English</strong> | <a href="README.zh-TW.md">繁體中文</a>
</p>

---

**CloudPipe** is a self-hosted deployment platform that does what Vercel, Railway, and Coolify do — but runs entirely on your machine, costs $0/month, and gives you full control.

One Node.js process. Git push to deploy. Telegram notifications. AI-ready MCP server. No Docker required.

---

## Why CloudPipe

| | Vercel / Railway | Coolify | **CloudPipe** |
|---|---|---|---|
| Cost | $20+/mo | Free (needs Docker) | **Free (bare metal)** |
| Docker required | - | Yes | **No** |
| Deploy method | Git push | Git push | **Git push + CLI + Upload + Telegram + API** |
| AI integration | None | None | **31+ MCP tools, auto-discovered** |
| Multi-machine sync | N/A | Manual | **Automatic via Redis** |
| Mobile deploy | No | No | **Yes (Telegram bot)** |
| Setup time | 5 min | 30 min | **5 min** |

---

## What It Can Do

### Git Push → Live in Seconds

Connect a GitHub repo. CloudPipe auto-detects your framework, installs deps, builds, starts with PM2, sets up Cloudflare Tunnel DNS, and health-checks — all automatically.

```
git push origin main
```

That's it. Your app is live at `yourapp.yourdomain.com`.

**Auto-detected**: Next.js, Vite, React, Vue, Angular, Express, Fastify, Koa, FastAPI, static sites.

### Deploy From Anywhere

| Method | How |
|--------|-----|
| **Git Push** | GitHub webhook, auto-deploy on push |
| **CLI** | `cloudpipe deploy` — zero-config, auto-detects everything |
| **Dashboard** | Web UI with one-click deploy, logs, env management |
| **Telegram** | `/deploy myapp` from your phone |
| **API** | Full REST API with JWT auth |
| **MCP** | AI agents deploy for you via Model Context Protocol |

### 31+ AI Tools via MCP

CloudPipe ships with a **Model Context Protocol server** that exposes your entire platform to AI agents.

```
"Deploy my app"          → AI calls deploy_project
"Show me the logs"       → AI calls get_logs
"Create a new ad"        → AI calls adman_create_ad
"Generate flashcards"    → AI calls autocard_generate_content
```

Tools are **auto-discovered** from your deployed projects. Deploy a FastAPI app with OpenAPI docs? CloudPipe automatically creates MCP tools from your endpoints. Zero config.

### Multi-Machine Sync

Run CloudPipe on 2+ machines. They auto-sync via Redis:

- **Leader election** — only one bot polls GitHub, automatic failover in 30s
- **Deploy broadcast** — Machine A deploys → Machine B catches up within 30s
- **Heartbeat monitoring** — 90s TTL, Telegram alert if a machine goes offline
- **Shared state** — deployment status, process metrics, all synced

### Telegram Bot — Your Deploy Remote Control

Not just notifications. Full control from your phone:

- `/deploy myapp` — trigger deploy with confirmation buttons
- `/status` — PM2 status across all machines, memory, CPU, uptime
- `/machines` — which machines are online, how many processes each
- `/restart myapp` — PM2 restart from the couch
- `/envtoken` — secure one-time `.env` bundle download

Deploy fails at 3 AM? You'll know. Fix it from bed.

### Hot-Reload API Services

Drop a `.js` file → get a live public API. No restart needed.

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

Upload → `https://api.yourdomain.com/hello` is live. Update the file → changes apply instantly. No redeploy.

---

## The Numbers

| Metric | Value |
|--------|-------|
| MCP tools | **31+** (7 core + 24 auto-discovered) |
| Admin API endpoints | **25+** |
| Telegram commands | **13** |
| Framework auto-detection | **10+** frameworks |
| Deploy methods | **6** (git, CLI, upload, Telegram, API, MCP) |
| Health check retries | **5** with 3s delay |
| Cross-machine sync | **30 seconds** |
| GitHub polling backup | **5 minutes** |
| Setup time | **< 5 minutes** |
| Monthly cost | **$0** |

---

## Quick Start

```bash
npm i -g @jeffrey0117/cloudpipe
```

Or clone and run:

```bash
git clone https://github.com/Jeffrey0117/CloudPipe.git
cd CloudPipe && npm install
cp config.example.json config.json  # edit with your domain
node index.js
```

Dashboard opens at `http://localhost:8787/admin`.

---

## Architecture

```
cloudpipe/
├── src/core/
│   ├── server.js        # Startup orchestrator
│   ├── router.js        # Subdomain + path routing
│   ├── deploy.js        # Git deploy engine (the brain)
│   ├── admin.js         # 25+ REST API endpoints
│   ├── telegram.js      # Multi-machine Telegram bot
│   ├── heartbeat.js     # Cross-machine monitoring
│   ├── redis.js         # Multi-machine sync layer
│   └── auth.js          # JWT authentication
├── mcp/                 # MCP server with auto-discovery
├── sdk/                 # JavaScript SDK
├── bin/                 # CLI entry point
└── services/            # Hot-reload API services
```

---

## License

MIT

</content>
</invoke>