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
  <img src="https://img.shields.io/badge/MCP_tools-70+-purple" alt="MCP Tools" />
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
| AI deploys for you | No | No | **Yes (70+ MCP tools)** |
| Multi-machine sync | N/A | N/A | **Auto via Redis** |
| Bot notifications | No | No | **Success, failure, crash** |
| Manage from chat | No | No | **Deploy, restart, logs, env** |
| Apps call each other | Manual wiring | No | **SDK: 2 lines, auto-discovery** |

You get the convenience of a managed platform with the freedom of self-hosting.

---

## The Ecosystem: From New Machine to Production

CloudPipe is part of a stack that covers your entire developer lifecycle. Each tool eliminates one layer of friction:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   DevUp          New machine? One command.              │
│   ↓              Every tool installed, every repo       │
│                  cloned, every dependency resolved.     │
│                                                         │
│   ZeroSetup      Your project has 20 setup steps?       │
│   ↓              Now it has one: double-click setup.bat │
│                                                         │
│   ClaudeBot      Write code from your phone.            │
│   ↓              AI edits your codebase, pushes to Git. │
│                                                         │
│   CloudPipe      Deploys automatically.                 │
│   ↓              Notifies you. You manage from chat.    │
│                                                         │
│   MemoryGuy      7 services running, 8GB+ RAM.          │
│                  Leak detection. Safe optimization.     │
│                  Never accidentally kill everything.    │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

| Tool | What It Kills | Repo |
|------|--------------|------|
| [**DevUp**](https://github.com/Jeffrey0117/DevUp) | "Setting up a new machine takes a whole day" | One command rebuilds your entire workspace |
| [**ZeroSetup**](https://github.com/Jeffrey0117/ZeroSetup) | "Read the README, install Python, configure PATH..." | `git clone` → double-click → running |
| [**ClaudeBot**](https://github.com/Jeffrey0117/ClaudeBot) | "I need my laptop to code" | AI writes code from Telegram, voice-to-code, live streaming |
| [**CloudPipe**](https://github.com/Jeffrey0117/CloudPipe) | "Deploying is complicated and expensive" | Git push → live. Manage from your phone. $0. |
| [**MemoryGuy**](https://github.com/Jeffrey0117/MemoryGuy) | "Which node.exe is which? Is something leaking?" | Memory leak detection, safe optimization, port dashboard |

**New machine → workspace ready → code from phone → deploy automatically → manage from chat → keep it all running.**

Zero friction at every step.

---

## ClaudeBot + CloudPipe

Pair them and your entire dev workflow lives in Telegram:

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

## What Makes CloudPipe Ridiculous

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

### AI-Native: 70+ MCP Tools

CloudPipe has a built-in **Model Context Protocol server**. Any AI agent (Claude, GPT, local LLMs) can manage your entire infrastructure:

```
"Deploy my project"           → deploy_project
"Show the logs for myapp"     → get_logs
"Generate study flashcards"   → autocard_generate_content
"Search YouTube for React"    → meetube_search
"Run the full pipeline"       → pipeline_youtube-to-flashcards
```

Tools are **auto-discovered** from your deployed apps. Deploy a FastAPI service with OpenAPI docs? CloudPipe instantly creates MCP tools from every endpoint. Zero configuration.

### API Gateway + Pipeline Engine

Every deployed app's API becomes a **gateway tool**. Chain them into pipelines:

```json
{
  "id": "youtube-to-flashcards",
  "steps": [
    { "tool": "meetube_search",             "params": { "q": "{{input.query}}" } },
    { "tool": "autocard_generate_content",  "params": { "topic": "{{steps.search.data.results[0].title}}" } },
    { "tool": "upimg_shorten_url",          "params": { "url": "{{steps.cards.data.cover}}" } }
  ]
}
```

One pipeline call chains multiple services. Output flows automatically via `{{steps.id.data}}` templates. Call via HTTP, Telegram (`/pipe`), or MCP.

### Shared Capabilities SDK — Every Project Powers Every Other

Deploy 5 apps on CloudPipe. Now each one can use the other 4. Two lines of code:

```javascript
const gw = require('@jeffrey0117/cloudpipe/sdk/gateway')
const tg = require('@jeffrey0117/cloudpipe/sdk/telegram')

// Your flashcard app can search YouTube
const videos = await gw.call('meetube_search', { q: 'React hooks' })

// Your screenshot tool can upload to your image CDN
const img = await gw.call('upimg_upload', { url: screenshotUrl })

// Any app can send you a Telegram notification
await tg.send('Job complete!')
```

No hardcoded ports. No manual auth. No reimplementation. The Gateway auto-discovers every API, and the SDK handles the rest. **The more you deploy, the more powerful every app becomes.**

| Capability | One-liner |
|-----------|-----------|
| YouTube search | `gw.call('meetube_search', { q: '...' })` |
| Image hosting | `gw.call('upimg_upload', { url: '...' })` |
| Job queue | `gw.call('workr_create_job', { type: '...' })` |
| Auth service | `gw.call('letmeuse_verify_session', { token })` |
| AI flashcards | `gw.call('autocard_generate_content', { topic })` |
| Telegram notify | `tg.send('message')` |
| Any tool | `gw.call('{projectId}_{endpoint}', params)` |

### The Kirby Architecture — One Bot Swallows All

Most platforms make each app build its own bot. Image host needs a bot? Write one. Flashcard app needs a bot? Write another. Five apps, five bots, five polling loops, five auth systems.

CloudPipe takes the opposite approach: **one bot eats every app's abilities.**

```
┌──────────────────────────────────────────────┐
│           CloudPipe Telegram Bot             │
│                                              │
│   /upload photo  →  Upimg (duk.tw)           │
│   /call meetube_search q=React  →  MeeTube   │
│   /call autocard_generate ...   →  AutoCard  │
│   /pipe youtube-to-flashcards   →  Pipeline  │
│   /deploy myapp                 →  Deploy    │
│                                              │
│   New project onboarded?                     │
│   Bot automatically gains all its abilities. │
└──────────────────────────────────────────────┘
```

Sub-projects stay pure API services. They don't import Telegram libraries, don't handle polling, don't manage auth. They just expose HTTP endpoints. CloudPipe's bot discovers them via the Gateway and absorbs every capability — like Kirby swallowing enemies and gaining their powers.

**Deploy a new app → bot instantly knows how to use it. Zero bot code in the app.**

### Telegram Bot — Not Just Notifications

Deploy, restart, monitor, and manage — all from chat:

- `/deploy myapp` — deploy with confirmation buttons
- `/restart myapp` — PM2 restart from anywhere
- `/status` — all projects, memory, CPU, uptime
- `/machines` — multi-machine overview
- `/upload` — send a photo, get a duk.tw short URL
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
npx @jeffrey0117/cloudpipe
```

The setup wizard walks you through configuration (port, password, domain, Telegram). Done in under 2 minutes.

Or clone manually:

```bash
git clone https://github.com/Jeffrey0117/CloudPipe.git
cd CloudPipe && npm install
cloudpipe setup
cloudpipe start
```

Dashboard at `http://localhost:8787/admin`.

---

## The Numbers

| | |
|---|---|
| MCP tools | **70+** (auto-discovered from your apps) |
| Deploy methods | **6** |
| Gateway tools | **All APIs unified** |
| Pipeline engine | **Chain any tools together** |
| Frameworks detected | **10+** |
| Admin API endpoints | **25+** |
| Cross-machine sync | **30 seconds** |
| Shared SDK | **2 lines → full ecosystem access** |
| Monthly cost | **$0** |

---

## License

MIT