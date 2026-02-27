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

projects/          — Deployed project folders (git clones)
services/          — CloudPipe-internal services (xcard, etc.)
```

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
| 4007 | Upimg |
| 4008 | MeeTube |
| 4009 | XCard (reserved) |

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

| Capability | How to access | What it does |
|-----------|--------------|-------------|
| Any project API | `gw.call('projectId_endpoint', params)` | Gateway routes to correct port |
| Telegram messages | `tg.send(text)` | Uses tg-proxy (Cloudflare Worker) |
| Image hosting | `gw.call('upimg_upload', ...)` | R2-backed image CDN |
| Job queue | `gw.call('workr_create_job', ...)` | Background task processing |
| Auth verification | `gw.call('letmeuse_verify_session', ...)` | Shared auth service |
| YouTube search | `gw.call('meetube_search', ...)` | YouTube proxy |
| AI flashcards | `gw.call('autocard_generate_content', ...)` | DeepSeek-powered |
| Ad serving | `gw.call('adman_list_ads', ...)` | Ad management |
