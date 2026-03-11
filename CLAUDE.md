# CloudPipe

Self-hosted deployment platform + API gateway + MCP server.

## Architecture

```
src/core/          — Platform core (CJS, no TypeScript)
  server.js        — HTTP server (:8787)
  router.js        — Domain-based routing
  deploy.js        — Git-based deployment engine
  admin.js         — Admin API
  gateway.js       — Internal API gateway (tool cache, pipeline routes)
  gateway-fetch.js — Shared HTTP call logic
  pipeline.js      — Pipeline engine (chain tools into workflows)
  telegram.js      — Telegram bot (/tools, /call, /pipe)

mcp/               — MCP server (stdio transport)
  index.js         — Tool registration + handlers
  discovery.js     — Auto-discovery engine
  core-tools.js    — CloudPipe management tools

sdk/
  index.js         — CloudPipe SDK (admin API client)
  gateway.js       — Gateway client (call any tool from any project)
  telegram.js      — Telegram helper (send messages via tg-proxy)

data/
  deploy/projects.json   — Registered projects
  manifests/*.json       — API manifests (per-project)
  manifests/auth.json    — Auth config (per-project)
  pipelines/*.json       — Pipeline definitions

projects/          — Junctions → workhub/ (canonical project folders)
services/          — CloudPipe-internal services (xcard, etc.)
scripts/           — Maintenance scripts (workhub init, deploy-all, sync)

workhub/           — (outside repo, configured in config.json)
                     Single canonical directory for all project git clones
```

## Workhub (Canonical Project Storage)

**Problem**: `projects/` contained git clones, but other tools (ClaudeBot, IDE) also needed copies → duplicate repos, sync nightmares, divergent state.

**Solution**: One canonical directory (`workhub/`) holds all git clones. Both `projects/` and external directories use Windows junctions (symlinks) pointing there.

```
workhub/           ← real git clones (canonical source of truth)
  ├── adman/
  ├── survey/
  └── ...

cloudpipe/projects/ ← junctions → workhub/{id}
Desktop/code/       ← junctions → workhub/{id} (optional, for IDE/ClaudeBot)
```

### Config (`config.json`)

```json
{
  "workhub": {
    "enabled": true,
    "dir": "../workhub"    // relative to CloudPipe root, or absolute path
  }
}
```

### Setup Script

```bash
node scripts/init-workhub.js              # dry-run (preview only)
node scripts/init-workhub.js --run        # clone repos + create junctions
node scripts/init-workhub.js --run --setup # also npm install + next build
node scripts/init-workhub.js --run --code-dir "C:\Users\jeffb\Desktop\code"
                                          # also create junctions in code dir
```

The script:
1. Reads project list from `data/deploy/projects.json` (not filesystem scan)
2. `git clone` each project's `repoUrl` into workhub/
3. Backs up existing `projects/{id}` → `projects/{id}.bak`
4. Creates junctions: `projects/{id}` → `workhub/{id}`
5. Copies runtime files from `.bak` (`.env`, `data/`, `uploads/`, `.db` files)
6. With `--setup`: runs `npm install` + `next build` where needed

### Important: Runtime Data

Git clones don't include `.gitignored` runtime data. The script auto-copies from `.bak`:
- `.env`, `.env.local`, `.env.production`
- `.pm2-start.cjs` (CloudPipe-generated startup scripts)
- `data/`, `uploads/`, `db/`, `storage/` directories
- `*.db`, `*.sqlite`, `*.sqlite3` files

### New Projects

New projects added via CloudPipe deploy flow automatically go into `projects/`. To integrate with workhub:
1. Add project to `data/deploy/projects.json`
2. Re-run `node scripts/init-workhub.js --run`

Deploying (`git fetch + reset --hard`) preserves untracked files — existing `.env` and `data/` directories are safe.

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/init-workhub.js` | Clone all projects into workhub, create junctions |
| `scripts/deploy-all.js` | Deploy all registered projects |
| `scripts/sync-projects.js` | Legacy sync (superseded by workhub) |
| `scripts/autostart.js` | Auto-start services on boot |

## Ports

| Port | Project |
|------|---------|
| 8787 | CloudPipe main |
| 4001 | MySpeedTest |
| 4002 | Workr |
| 4003 | AdMan |
| 4004 | AutoCard |
| 4005 | ReelScript |
| 4006 | LetMeUse |
| 4007 | Upimg (duk.tw) |
| 4008 | MeeTube |
| 4009 | Pokkit |
| 4010 | NoteBody |
| 4011 | CanWeBack |
| 4012 | GitLoop |
| 4013 | REPIC |
| 4014 | CourseBloom |
| 4015 | RawTxt |
| 4016 | Quickky |
| 4017 | LurlHub |

## Code Style

- **CJS** everywhere (require / module.exports), no ESM in core
- No TypeScript in platform code
- Immutable patterns — never mutate, always spread
- Small files (200-400 lines typical)
- Raw Node http module for services (no Express in core)

## Onboarding a New Project

When adding a new project to CloudPipe, follow this checklist:

### 1. Manifest (`data/manifests/{projectId}.json`)

```json
{
  "name": "ProjectName",
  "version": "1.0.0",
  "description": "One-line description",
  "endpoints": [
    {
      "name": "operation_name",
      "description": "What this endpoint does",
      "method": "GET|POST|PUT|DELETE",
      "path": "/api/path/{param}",
      "auth": "bearer",
      "parameters": {
        "type": "object",
        "properties": {
          "param": { "type": "string", "description": "Description" }
        },
        "required": ["param"]
      }
    }
  ]
}
```

Rules:
- `name` field uses snake_case (becomes `{projectId}_{name}` as gateway tool)
- Path params use `{param}` syntax (resolved by gateway-fetch)
- `auth` field is optional — only needed if endpoint requires auth
- Skip admin-only endpoints (not useful for gateway/pipeline)
- Skip endpoints that require file uploads (gateway doesn't support multipart yet)

### 2. Auth (`data/manifests/auth.json`)

Add an entry for the project:

```json
{
  "projectId": {
    "type": "bearer",
    "token": "hardcoded-token"
  }
}
```

Or use env var:
```json
{
  "projectId": {
    "type": "bearer",
    "env": "PROJECT_TOKEN"
  }
}
```

Or no auth:
```json
{
  "projectId": {
    "type": "none"
  }
}
```

### 3. Project Registration (`data/deploy/projects.json`)

Done via admin UI or SDK. Key fields:
- `id`: lowercase, no spaces (used as projectId everywhere)
- `port`: unique port number
- `entryFile`: server entry point (e.g., `server.js`, `index.js`)
- `buildCommand`: build step (e.g., `npm run build`)
- `healthEndpoint`: optional health check path

### 4. Server Requirements

The project must expose an HTTP server. If it doesn't have one:
- Create `server.js` using Node's built-in `http` module
- Expose API endpoints matching the manifest
- Include `GET /api/health` for health checks
- Listen on `process.env.PORT || {assigned_port}`

### 5. Verification

After registering and deploying:
1. Gateway auto-discovers tools: `GET /api/gateway/tools`
2. MCP server picks them up: tools appear as `{projectId}_{endpointName}`
3. Bot can call them: `/call {projectId}_{endpointName} key=value`
4. Pipeline can chain them: reference in `data/pipelines/*.json`

## MCP Discovery Priority

1. Local manifest: `data/manifests/{projectId}.json` (preferred)
2. HTTP manifest: `http://localhost:{port}/api/manifest.json`
3. HTTP OpenAPI: `http://localhost:{port}/openapi.json`

Local manifests are preferred — faster, no network call, fully controlled.

## Pipeline Format

```json
{
  "id": "pipeline-id",
  "name": "Display Name",
  "description": "What this pipeline does",
  "input": {
    "paramName": { "type": "string", "required": true, "description": "..." }
  },
  "steps": [
    {
      "id": "step1",
      "tool": "projectId_endpointName",
      "params": { "key": "{{input.paramName}}" }
    },
    {
      "id": "step2",
      "tool": "other_tool",
      "params": { "key": "{{steps.step1.data.field}}" },
      "continueOnError": true
    }
  ]
}
```

Template syntax:
- `{{input.x}}` — pipeline input
- `{{steps.stepId.data.field}}` — previous step result
- `{{steps.stepId.data.arr[0].field}}` — array indexing

## Auto-injected Environment Variables

CloudPipe automatically injects shared env vars into all sub-projects (both static in `ecosystem.config.js` and dynamic via `deploy.js`).

| Variable | Source | Value |
|----------|--------|-------|
| `TELEGRAM_PROXY` | `config.json → telegramProxy` | Cloudflare Workers reverse proxy for `api.telegram.org` |

### Using `TELEGRAM_PROXY` in sub-projects

**JS** (via `sdk/telegram.js` — already handled):
```javascript
const tg = require('../../sdk/telegram')
await tg.send('Hello')  // uses TELEGRAM_PROXY automatically
```

**Python** (`python-telegram-bot`):
```python
import os
proxy = os.environ.get('TELEGRAM_PROXY')  # e.g. https://tg-proxy.jeffby8.workers.dev
bot = Bot(
    token=TOKEN,
    base_url=f"{proxy}/bot" if proxy else "https://api.telegram.org/bot",
    base_file_url=f"{proxy}/file/bot" if proxy else "https://api.telegram.org/file/bot",
)
```

**Raw HTTP** (any language):
```
# Replace:
https://api.telegram.org/bot{TOKEN}/sendMessage
# With:
${TELEGRAM_PROXY}/bot{TOKEN}/sendMessage
```

A project's own `.env` takes priority — if `TELEGRAM_PROXY` is set in `.env`, the injected value is skipped.

## Shared Capabilities SDK

Sub-projects use `sdk/gateway.js` and `sdk/telegram.js` to access shared ecosystem capabilities without reimplementing anything.

### Gateway Client (`sdk/gateway.js`)

```javascript
// From any sub-project:
const gw = require('../../sdk/gateway')

// Call any tool across the ecosystem
const results = await gw.call('meetube_search', { q: 'React' })
const uploaded = await gw.call('upimg_upload', { url: imageUrl })
const job = await gw.call('workr_create_job', { type: 'screenshot', url: '...' })

// Run a pipeline
const cards = await gw.pipe('youtube-to-flashcards', { query: 'React hooks' })

// List available tools
const { tools } = await gw.tools()
const meetubeTools = await gw.tools('meetube')
```

Auto-configured from `config.json` (serviceToken + port). Override with env vars:
- `CLOUDPIPE_URL` — gateway base URL
- `CLOUDPIPE_TOKEN` — service token

### Telegram Helper (`sdk/telegram.js`)

```javascript
const tg = require('../../sdk/telegram')

// Send notifications (uses tg-proxy automatically)
await tg.send('Deploy complete!')
await tg.sendPhoto(coverUrl, 'New flashcards generated')
await tg.notify('<b>Alert</b>: service down', { parse_mode: 'HTML' })

// Raw API access
await tg.api('sendMessage', { chat_id: '123', text: 'Hello' })
```

Auto-configured from `config.json` (telegramProxy + botToken + chatId).

### External npm usage

```javascript
const { gateway, telegram } = require('@jeffrey0117/cloudpipe')
// or
const gw = require('@jeffrey0117/cloudpipe/sdk/gateway')
const tg = require('@jeffrey0117/cloudpipe/sdk/telegram')
```

### Shared Infrastructure

See **"Ecosystem Services Quick Reference"** section below for complete details on every service.

| Capability | SDK call | MCP tool |
|-----------|---------|---------|
| Any project API | `gw.call('projectId_endpoint', params)` | `{projectId}_{endpoint}` |
| Telegram messages | `tg.send(text)` | — |
| Auth (register app) | `gw.call('letmeuse_create_app', ...)` | `letmeuse_create_app` |
| Image hosting | `gw.call('upimg_shorten_url', ...)` | `upimg_shorten_url` |
| Image processing | `gw.call('repic_resize', ...)` | `repic_resize` |
| File storage | `gw.call('pokkit_upload_file', ...)` | `pokkit_upload_file` |
| Job queue | `gw.call('workr_submit_job', ...)` | `workr_submit_job` |
| Text paste | `gw.call('rawtxt_create_paste', ...)` | `rawtxt_create_paste` |
| YouTube search | `gw.call('meetube_search', ...)` | `meetube_search` |
| AI flashcards | `gw.call('autocard_generate_content', ...)` | `autocard_generate_content` |
| Video learning | `gw.call('reelscript_process_video', ...)` | `reelscript_process_video` |
| NotebookLM | `gw.call('notebody_ask', ...)` | `notebody_ask` |

## Ecosystem Services Quick Reference (IMPORTANT — READ THIS FIRST)

When you need a capability, find it here. Use MCP tools directly — do NOT explore project source code.

All MCP tools are prefixed: `{projectId}_{toolName}` (e.g. `upimg_shorten_url`, `letmeuse_create_app`).

---

### LetMeUse — Auth as a Service (port 4006)

**What**: Embeddable email/password + magic link authentication for any app.

**When to use**: Any new project that needs user login.

**Key MCP tools**:
- `letmeuse_create_app({ name, domains })` — Register a new app, returns app_id
- `letmeuse_list_apps()` — List all registered apps
- `letmeuse_list_users({ appId?, search? })` — List/search users
- `letmeuse_get_stats()` — User/session/app counts

**Integration workflow**: See `letmeuse/CLAUDE.md` → "Integrating LetMeUse into a New Project" (5-step guide with code).

**Reference**: Quickky (`quickky/public/app.js` + `quickky/src/middleware/auth.js`)

**Auth**: bearer (1-year admin JWT in auth.json)

---

### Upimg — Image Hosting / duk.tw (port 4007)

**What**: Upload images or shorten external image URLs → get `https://duk.tw/hash.ext` short URLs.

**When to use**: Any project that handles user-uploaded images or needs image CDN.

**Key MCP tools**:
- `upimg_shorten_url({ url, filename })` — Shorten external image URL → `https://duk.tw/xxx.png`
- `upimg_upload_image({ file })` — Upload image file (multipart)
- `upimg_list_mappings({ search?, page?, limit? })` — Query stored images
- `upimg_get_admin_stats()` — Upload statistics

**Integration pattern** (backend proxy for user uploads):
```javascript
// POST /api/upload — proxy user's FormData to Upimg
const formData = new FormData()
formData.append('file', file)
const res = await fetch('https://duk.tw/api/upload', { method: 'POST', body: formData })
const { shortUrl } = await res.json() // https://duk.tw/abc123.png
```

**Auth**: none for upload/shorten, bearer for admin endpoints

---

### REPIC — Image Processing (port 4013)

**What**: Server-side image manipulation — remove background, generate favicons, resize, convert, crop, composite/watermark.

**When to use**: Need to process images (remove bg, make favicon, resize for thumbnails, convert format, add watermark).

**Key MCP tools** (all accept `url` or `base64`):
- `repic_remove_background({ url })` — Remove white/gray bg → transparent PNG
- `repic_generate_favicon({ url })` — Generate 16/32/180/192/512 favicon set
- `repic_resize({ url, width, height, fit?, format? })` — Resize image
- `repic_convert({ url, format, quality? })` — Convert between PNG/JPEG/WebP/AVIF
- `repic_crop({ url, left, top, width, height })` — Crop region
- `repic_composite({ url, overlay_url, gravity?, opacity? })` — Overlay/watermark
- `repic_metadata({ url })` — Get dimensions, format, file size

**Auth**: none (all endpoints are public)

---

### Pokkit — File Storage (port 4009)

**What**: Self-hosted file storage. Upload any file, get download URL.

**When to use**: Store non-image files (PDFs, ZIPs, documents).

**Key MCP tools**:
- `pokkit_upload_file({ file })` — Upload file → download URL + file ID
- `pokkit_list_files()` — List all stored files with metadata
- `pokkit_delete_file({ id })` — Delete by ID
- `pokkit_get_status()` — Storage stats (total files, disk usage)

**Auth**: bearer (token in auth.json via env var)

---

### Workr — Job Queue (port 4002)

**What**: Background job processing — thumbnail generation, WebP conversion, HLS, downloads, HTTP proxy, deployments.

**When to use**: Any long-running task that shouldn't block the main request.

**Key MCP tools**:
- `workr_submit_job({ type, payload, priority?, callback? })` — Submit job
  - Types: `thumbnail`, `webp`, `hls`, `download`, `proxy`, `deploy`
- `workr_get_job({ id })` — Check job status
- `workr_list_jobs({ status?, type? })` — List/filter jobs
- `workr_cancel_job({ id })` — Cancel queued job
- `workr_get_stats()` — Queue statistics
- `workr_proxy_request({ url })` — HTTP proxy (bypass CORS/geo-blocking)

**Auth**: none

---

### RawTxt — Text Paste (port 4015)

**What**: Minimal text paste service. Create paste → get raw URL for sharing or feeding to AI.

**When to use**: Quick text sharing, logs, AI input preparation.

**Key MCP tools**:
- `rawtxt_create_paste({ content, expiresIn? })` — Create paste → raw URL + view URL
  - expiresIn: `1h`, `6h`, `24h` (default), `7d`, `30d`, `forever`
- `rawtxt_read_paste({ id })` — Read paste content
- `rawtxt_list_recent({ limit? })` — List recent pastes

**Auth**: none

---

### AutoCard — AI Flashcards (port 4004)

**What**: Generate flashcard content using DeepSeek AI. Manage content pool.

**Key MCP tools**:
- `autocard_generate_content({ topic, pages? })` — AI generates flashcard markdown
- `autocard_suggest_topics({ category })` — AI suggests 10 topics for a category
- `autocard_gemini_action({ action, text, topic? })` — Gemini AI (social captions, enhance)
- `autocard_list_pool()` / `autocard_create_pool_entry({ title, markdown, tags? })` — Content pool CRUD

**Auth**: bearer

---

### MeeTube — YouTube Proxy (port 4008)

**What**: Private YouTube client — search, video details, captions, translation, favorites.

**Key MCP tools**:
- `meetube_search({ q })` — Search YouTube videos
- `meetube_get_video({ id })` — Full video details (streams, captions, related)
- `meetube_get_channel({ id })` — Channel metadata
- `meetube_get_captions({ videoId })` — List caption tracks
- `meetube_translate_text({ text, targetLang? })` — Translate text (default: zh-TW)
- `meetube_translate_batch({ texts, targetLang? })` — Batch translate
- `meetube_get_trending()` — Trending videos

**Auth**: none

---

### ReelScript — Video Learning (port 4005)

**What**: Download video → transcribe → translate to Chinese → extract vocabulary → generate quotes. Full learning pipeline.

**Key MCP tools**:
- `reelscript_process_video({ url })` — Process video (YouTube/IG/Bilibili/TikTok), async
- `reelscript_get_video({ video_id })` — Full transcript + translations + vocabulary
- `reelscript_translate_video({ video_id })` — Translate to Traditional Chinese
- `reelscript_analyze_vocabulary({ video_id })` — Extract phrasal verbs, idioms
- `reelscript_appreciate_video({ video_id })` — Theme, key points, golden quotes
- `reelscript_search({ q, mode? })` — Search across all video content
- `reelscript_daily_snippet()` / `reelscript_random_snippet()` — Learning snippets
- `reelscript_list_quotes({ limit? })` — Golden quotes collection

**Auth**: bearer for process/translate/analyze, none for public read endpoints

---

### NoteBody — NotebookLM Bridge (port 4010)

**What**: Ask questions to Google NotebookLM, get grounded answers with citations. Manage notebook library.

**Key MCP tools**:
- `notebody_ask({ question, notebook_url? })` — Ask NotebookLM a question
- `notebody_list_notebooks()` — List notebooks in library
- `notebody_add_notebook({ url, tags?, description? })` — Add notebook by URL
- `notebody_select_notebook({ id })` — Set active notebook for queries
- `notebody_auto_create_notebook({ title? })` — Create new notebook (browser automation)
- `notebody_auto_add_source({ notebook_url, source_url })` — Add YouTube/website source

**Auth**: bearer

---

### AdMan — Ad Management (port 4003)

**What**: Manage ad projects and ad units. CRUD for ad campaigns.

**Key MCP tools**:
- `adman_list_projects()` / `adman_create_project({ name, domain })` — Project CRUD
- `adman_get_ad({ adId })` / `adman_update_ad({ adId, status?, position? })` — Ad CRUD

**Auth**: none

---

### CanWeBack — Fortune/Relationship (port 4011)

**What**: Relationship compatibility analysis from birthdays (ROC format). Unsent letters feature.

**Key MCP tools**:
- `canweback_generate_fortune({ myBirthday, partnerBirthday })` — Generate reading
- `canweback_create_letter({ senderName, receiverName, receiverBirthday, content })` — Unsent letter

**Auth**: none

---

### GitLoop — Git Webhooks (port 4012)

**What**: Receive Gitea push/PR webhooks → trigger notifications + AI code review.

**Key MCP tools**:
- `gitloop_receive_webhook({ event })` — Receive webhook event

**Auth**: none

---

### CourseBloom — Online Courses (port 4014)

**What**: Multi-tenant online course platform with affiliate tracking.

**Key MCP tools**:
- `coursebloom_check_tenant({ slug })` — Check tenant slug availability
- `coursebloom_track_affiliate({ tenantId, affiliateCode, landingUrl })` — Track affiliate click

**Auth**: none

---

### MySpeedTest — Speed Test (port 4001)

**What**: Internet speed test with server node discovery.

**Key MCP tools**:
- `myspeedtest_get_targets({ count?, country? })` — Get test server nodes
- `myspeedtest_save_result({ speed, bytes?, duration? })` — Save test result

**Auth**: none

---

### Quickky — Personal Cards (port 4016)

**What**: Personal card platform — create rich cards (text + images), share via QR/short link.

**No MCP tools** — standalone consumer app. Uses LetMeUse for auth, Upimg for images.

---

## Companion Processes

Projects can define companion processes (bots, workers, background tasks) that run alongside the main PM2 process. Companions auto-start on deploy and are managed by PM2.

### Config

Add a `companions` array to the project in `data/deploy/projects.json`:

```json
{
  "companions": [
    {
      "name": "bot",
      "command": "python",
      "args": ["-m", "services.telegram_bot"],
      "cwd": "backend",
      "delay": 5
    }
  ]
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `name` | yes | PM2 name becomes `{projectId}-{name}` (e.g. `reelscript-bot`) |
| `command` | yes | Executable (`python`, `node`, etc.) |
| `args` | no | Command arguments array |
| `cwd` | no | Working directory relative to project root (defaults to project root) |
| `delay` | no | Seconds to wait after main process starts before launching (default 0) |

### Lifecycle

- **Deploy**: After main process health check passes, each companion is spawned as a separate PM2 process
- **Redeploy**: Old companions are deleted before the main process, then re-created after health check
- **Environment**: Companions inherit the same env vars as the main process (`.env` + CloudPipe injected vars)
- **Logs**: `pm2 logs {projectId}-{name}`
- **Python deps**: If companion uses `python`/`python3`, deploy.js auto-runs `pip install -r requirements.txt`

## Multi-Machine Deployment

CloudPipe supports running on multiple machines. All machines connect to the same Cloudflare Tunnel — if one goes down, traffic routes to the others.

### Quick Start

**Windows (Machine B):**
```batch
git clone https://github.com/Jeffrey0117/CloudPipe.git
cd CloudPipe
start.bat
```

**Linux/Ubuntu (Machine C):**
```bash
git clone https://github.com/Jeffrey0117/CloudPipe.git
cd CloudPipe
bash start.sh
```

Both scripts auto-install prerequisites, run `setup.js` on first boot, and start all services.

### Setup Flow

1. `start.bat` / `start.sh` auto-installs: Node.js, Git, PM2, dependencies
2. Detects no `config.json` → runs `setup.js`
3. `setup.js` prompts for primary URL + password → pulls config bundle from Machine A
4. Installs cloudflared, writes tunnel credentials + `cloudflared.yml`
5. Syncs `projects.json` (all project definitions)
6. Asks to deploy all projects (clone + build)
7. Asks to pull `.env` files from primary
8. `ecosystem.config.js` dynamically reads `projects.json` — only starts projects with cloned code

### .env Sync

Two methods:
- **During setup**: Automatic (setup.js pulls from primary)
- **After setup**: Send `/envtoken` to Telegram bot → run `node setup-env.js <url>` on target machine

### Runner Field

`projects.json` supports a `runner` field for PM2 startup method:

| Runner | PM2 Script | Use Case |
|--------|-----------|----------|
| `"node"` (default) | `node {entryFile}` | Standard Node.js |
| `"next"` | `next start -p {port}` | Next.js projects |
| `"tsx"` | `tsx {entryFile}` | TypeScript projects |

Deploy auto-detects and writes `runner` on first deploy.

### Ubuntu Prerequisites

```bash
sudo apt update && sudo apt install -y git build-essential python3 python3-pip ffmpeg redis-server
```

| Package | Why |
|---------|-----|
| `build-essential` | Native npm module compilation (node-gyp) |
| `python3` + `pip` | Companion processes (e.g. reelscript-bot) |
| `ffmpeg` | ReelScript video processing (yt-dlp) |
| `redis-server` | `/envtoken` one-time tokens, optional but recommended |

### Resource Requirements

- **RAM**: 2GB minimum, 4GB recommended. All services ≈ 1-2GB
- **Swap**: Add 2GB swap on small VPS to survive Next.js builds
- **GPU**: Optional. ReelScript's Whisper transcription uses GPU if available, falls back to CPU (slow)
- **Ports**: Not needed — Cloudflare Tunnel uses outbound connections only
- **Architecture**: `setup.js` downloads `cloudflared-linux-amd64`. ARM machines need manual cloudflared install

## Diagnostics & Troubleshooting

### Quick Diagnosis

Run on any machine:
```bash
node diagnose.js          # Full health report
node diagnose.js --json   # JSON output (for scripting)
node diagnose.js --fix    # Show fix suggestions
```

### Common Problems & Fixes

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| No config.json | Setup not run | `node setup.js` |
| Redis connection refused | Wrong redis.url or Redis down | Check config.json redis.url |
| PM2 empty | Services not started | `pm2 start ecosystem.config.js` |
| Project "not deployed" | Dir/junction missing in projects/ | `node scripts/init-workhub.js --run` or deploy via admin |
| cloudflared not running | Process crashed | `pm2 restart tunnel` |
| .env missing | Env not synced | `/envtoken` on primary → `node setup-env.js <url>` |
| Tunnel 0 connectors | cloudflared credentials bad | Re-run `node setup.js` |
| Health check fails | Port conflict or crash | `pm2 logs {name}` to see error |

### Machine Setup Checklist

For a new machine (Machine B, C, etc.):
1. Clone repo: `git clone https://github.com/Jeffrey0117/CloudPipe.git`
2. Run bootstrap: `start.bat` (Windows) or `bash start.sh` (Linux)
3. Verify: `node diagnose.js`
4. If errors: follow the fix suggestions
5. Confirm on primary: check `/machines` in Telegram or MCP `machines` tool

### File Locations

| File | Purpose | Critical? |
|------|---------|-----------|
| `config.json` | Machine identity + credentials | Yes |
| `data/deploy/projects.json` | Project registry | Yes |
| `cloudflared.yml` | Tunnel routing rules | Yes (for remote access) |
| `~/.cloudflared/{tunnelId}.json` | Tunnel credentials | Yes (for remote access) |
| `projects/{id}/.env` | Per-project secrets | Yes (per project) |
| `workhub/{id}/` | Canonical project clones (junctions from projects/) | Yes |
| `workhub/{id}/data/` | Runtime data (surveys, uploads, etc.) | Yes (not in git) |
| `ecosystem.config.js` | PM2 process definitions | Auto-generated |

### Restart Everything

```bash
pm2 delete all && pm2 start ecosystem.config.js && pm2 save
```
