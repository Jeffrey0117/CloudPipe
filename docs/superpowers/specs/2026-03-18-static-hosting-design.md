# CloudPipe Static Hosting — Design Spec

**Date**: 2026-03-18
**Status**: Final
**Goal**: Let vibe coders deploy static sites with one command: `npx cloudpipe-cli up`

---

## Problem

Vibe coders (Cursor/Claude users) build frontend projects and need to get them online. Current options (Vercel, Netlify, Zeabur) require GitHub linking, framework selection, or complex config. CloudPipe already has domain routing, HTTPS via Cloudflare Tunnel, and a deployment engine — but only for internal sub-projects.

## Solution

Add static site hosting to CloudPipe core. Three deliverables:

1. **`src/core/static.js`** — upload, serve, CRUD for static sites
2. **Deploy API** — `POST /api/deploy/static` on the main CloudPipe server
3. **`cloudpipe-cli`** — npm package, `npx cloudpipe-cli up` to deploy

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build location | Client-side | Server only receives built output. Safer, faster, less server resources |
| Auth | Deploy token | Simple random token. Manual issuance first, LetMeUse later |
| Slug collision | First come, first served | Global unique slugs, like GitHub usernames |
| Site size limit | 50 MB | Plenty for static sites (typical Vite build is 2-5 MB) |
| Free tier quota | 3 sites per token | Enough to try, pay for more later |
| Domain | `*.cloudpipe.app` | Separate from `*.isnowfriend.com` (personal infra) |
| Storage | Filesystem `data/static/{slug}/` | DB stores metadata only |
| Approach | New `static.js` module in `src/core/` | Isolated from existing `apps/` and `projects/`, zero proxy overhead |
| Archive format | tar.gz | CLI shells out to system `tar` (available on Windows 10+, macOS, Linux). Server extracts via `tar` npm package. Simple, battle-tested |
| Upload protocol | Raw body PUT | `PUT /api/deploy/static?slug=xxx` with `Content-Type: application/gzip` raw body. Avoids multipart parsing complexity entirely |
| Token generation | `crypto.randomBytes(32).toString('hex')` | 256-bit entropy, brute-force infeasible |

---

## Architecture

```
                    ┌─────────────────────────────────────────┐
                    │  cloudpipe-cli (npm package)            │
                    │  npx cloudpipe-cli up                   │
                    │  - detect project type                  │
                    │  - npm run build (if needed)            │
                    │  - tar czf → upload raw .tar.gz body    │
                    └──────────────┬──────────────────────────┘
                                   │ PUT /api/deploy/static?slug=my-app
                                   │ Authorization: Bearer {token}
                                   │ Content-Type: application/gzip
                                   │ Body: raw .tar.gz bytes
                                   ▼
┌──────────────────────────────────────────────────────────────────┐
│  CloudPipe Server (port 8787)                                    │
│                                                                  │
│  server.js → router.js                                           │
│    │                                                             │
│    ├── *.isnowfriend.com → existing sub-project routing          │
│    │                                                             │
│    ├── *.cloudpipe.app   → static.js serve                       │
│    │   slug = hostname.split('.')[0]                             │
│    │   serve data/static/{slug}/ with SPA fallback               │
│    │                                                             │
│    └── cloudpipe.app (bare domain)                               │
│        ├── GET  /api/sites          → list user's sites          │
│        ├── PUT  /api/deploy/static  → upload + deploy            │
│        ├── DELETE /api/sites/:slug  → delete site                │
│        ├── POST /api/auth/token     → create deploy token (admin)│
│        └── GET  /                   → landing page (later)       │
│                                                                  │
│  src/core/static.js                                              │
│    - handleSite(req, res, slug)     → serve files                │
│    - handleAPI(req, res)            → deploy/list/delete API     │
│    - extractArchive(buffer, slug)   → extract tar.gz to dir      │
│    - validateSlug(slug)             → alphanumeric + hyphens     │
│                                                                  │
│  data/                                                           │
│    ├── cloudpipe.db   → static_sites + deploy_tokens tables      │
│    └── static/                                                   │
│        ├── my-cool-app/                                          │
│        │   ├── index.html                                        │
│        │   ├── assets/                                           │
│        │   └── ...                                               │
│        └── another-site/                                         │
└──────────────────────────────────────────────────────────────────┘
```

---

## Data Layer

Two new tables in `data/cloudpipe.db` (added via `db.js`):

```sql
CREATE TABLE IF NOT EXISTS deploy_tokens (
  token TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  max_sites INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS static_sites (
  slug TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (token) REFERENCES deploy_tokens(token)
);
```

### db.js additions

```javascript
// Deploy Tokens
getDeployToken(token)           → row or null
createDeployToken({ name, email?, max_sites? })  // auto-generates token via crypto.randomBytes(32).toString('hex')
listDeployTokens()              → all tokens (admin)
deleteDeployToken(token)

// Static Sites
getStaticSite(slug)             → row or null
listStaticSites(token)          → sites owned by token
createStaticSite({ slug, token, size })           // auto-sets created_at + updated_at
updateStaticSite(slug, { size })                  // auto-sets updated_at = NOW
deleteStaticSite(slug)
countSitesByToken(token)        → number (for quota check)
```

---

## Module: `src/core/static.js`

Single file, ~250-350 lines. Responsibilities:

### 1. Serve static files

```javascript
function handleSite(req, res, slug) {
  const siteDir = path.join(STATIC_DIR, slug)
  if (!fs.existsSync(siteDir)) → 404 page

  const urlPath = req.url.split('?')[0]
  const filePath = path.resolve(siteDir, '.' + urlPath)

  // Security: path traversal check
  if (!filePath.startsWith(siteDir)) → 403

  // Try exact file
  if (exists(filePath) && isFile) → serve with MIME type + cache headers

  // SPA fallback: only for paths WITHOUT file extension
  // Paths with extensions that don't match a file → 404
  const ext = path.extname(urlPath)
  if (ext) → 404  // e.g. /favicon.ico, /robots.txt that don't exist

  // No extension (e.g. /about, /dashboard) → SPA fallback
  if (exists(siteDir/index.html)) → serve index.html

  → 404
}
```

Features:
- MIME type detection (extended from router.js: add `.webp`, `.avif`, `.mp4`, `.wasm`, `.map`)
- Smart SPA fallback: only for extensionless paths. `/about` → index.html, but `/missing.css` → 404
- Cache headers:
  - `index.html`: `Cache-Control: no-cache` (always revalidate)
  - Files with hash in name (e.g. `assets/index-a1b2c3.js`): `Cache-Control: public, max-age=31536000, immutable`
  - Other files: `Cache-Control: public, max-age=3600`
- Path traversal protection (resolved path must start with site dir)
- Directory listing prevention (directories return 404, not file listing)
- Compression: handled by Cloudflare edge for production. No server-side compression in MVP.

### 2. Deploy API

```
PUT /api/deploy/static?slug=my-app
Authorization: Bearer {deploy_token}
Content-Type: application/gzip
Body: raw .tar.gz bytes
```

Flow:
1. Validate token → 401 if invalid
2. Validate slug (lowercase alphanumeric + hyphens, 3-50 chars, no reserved words)
3. Check ownership: if slug exists and token doesn't match → 403
4. Check quota: if new slug and token already has 3 sites → 402
5. Collect body into buffer, check size ≤ 50 MB → 413
6. Extract to temp dir `data/static/.tmp-{slug}-{timestamp}/`
7. Validate: must have index.html → 400 if missing
8. Check uncompressed size ≤ 50 MB (zip bomb protection) → 413
9. Directory swap (best-effort, not atomic on Windows):
   a. If old dir exists, rename to `data/static/.old-{slug}-{timestamp}/`
   b. Rename temp dir to `data/static/{slug}/`
   c. Delete old dir in background (setTimeout, ignore errors)
   d. If step b fails, rename old dir back and return 500
10. Upsert DB record (createStaticSite or updateStaticSite)
11. Return `{ url: "https://{slug}.cloudpipe.app", slug, size }`

On any error after temp dir creation: delete temp dir before returning error.

Reserved slugs: `www`, `api`, `admin`, `app`, `dashboard`, `static`, `cdn`, `mail`, `ftp`, `ssh`, `cloudpipe`, `status`, `health`, `login`, `signup`, `blog`, `docs`

### 3. List / Delete API

```
GET /api/sites
Authorization: Bearer {deploy_token}
→ { sites: [{ slug, url, size, created_at, updated_at }] }

DELETE /api/sites/:slug
Authorization: Bearer {deploy_token}
→ { deleted: true }
```

Delete also removes `data/static/{slug}/` directory.

### 4. Token management (admin only)

```
POST /api/auth/token
Authorization: Bearer {admin_jwt}
Body: { name: "Jeffrey", email?: "..." }
→ { token: "abc123...def456", name, max_sites: 3 }
```

Initially admin-only. Later: self-service via LetMeUse login on cloudpipe.app.

### 5. Error response format

All errors use consistent schema:
```json
{ "error": "Human-readable message", "code": "SLUG_TAKEN" }
```

Error codes: `INVALID_TOKEN`, `INVALID_SLUG`, `SLUG_TAKEN`, `QUOTA_EXCEEDED`, `ARCHIVE_TOO_LARGE`, `NO_INDEX_HTML`, `EXTRACTION_FAILED`, `DEPLOY_FAILED`, `NOT_FOUND`, `FORBIDDEN`

---

## Router Integration

`router.js` changes (minimal):

```javascript
// Near the top of the request handler, BEFORE the mainSubdomain check:
const staticDomain = config.staticDomain || 'cloudpipe.app'

if (hostname === staticDomain || hostname.endsWith('.' + staticDomain)) {
  const staticHost = require('./static')

  if (hostname === staticDomain) {
    // Bare domain: API + landing page
    return staticHost.handleAPI(req, res)
  }

  // Subdomain: serve static site
  const slug = hostname.split('.')[0]
  return staticHost.handleSite(req, res, slug)
}

// ... rest of existing routing unchanged
```

CORS whitelist update in `isAllowedOrigin()`:
```javascript
if (hostname.endsWith('.cloudpipe.app') || hostname === 'cloudpipe.app') return true
```

Config addition in `config.json`:
```json
{
  "staticDomain": "cloudpipe.app"
}
```

### cloudflared.yml (complete final version)

```yaml
ingress:
  - hostname: "*.cloudpipe.app"
    service: http://localhost:8787
  - hostname: "cloudpipe.app"
    service: http://localhost:8787
  - hostname: "*.isnowfriend.com"
    service: http://localhost:8787
  - hostname: "duk.tw"
    service: http://localhost:8787
  - hostname: "*.duk.tw"
    service: http://localhost:8787
  - service: http_status:404
```

New rules go BEFORE the existing rules, ABOVE the catch-all `http_status:404`.

---

## Telegram Bot: `/newtoken`

```
/newtoken <name> [email]
```

- Admin only (chatId check, same as other admin commands)
- Creates token via `db.createDeployToken({ name, email })`
- Returns token string in message (one-time display)
- Example: `/newtoken Jeffrey jeff@example.com` → `Deploy token: a1b2c3d4...`

---

## CLI: `cloudpipe-cli`

Separate npm package. ESM. One prod dependency: none (uses system `tar` command via `child_process.execSync`).

System requirement: `tar` command available in PATH (Windows 10+, macOS, Linux all ship with it).

### Commands

```
npx cloudpipe-cli login          # Interactive prompt: paste token → save to ~/.cloudpipe/config.json
npx cloudpipe-cli up [--name x]  # Build + deploy
npx cloudpipe-cli list           # List my sites
npx cloudpipe-cli rm <slug>      # Delete a site
npx cloudpipe-cli logout         # Remove saved token
```

### `login` flow

Interactive stdin prompt:
```
? Enter your deploy token: ████████████████
? Server URL (https://cloudpipe.app):
✅ Saved to ~/.cloudpipe/config.json
```

### `up` flow

```
1. Read ~/.cloudpipe/config.json → get token + server URL
   - Error if not logged in

2. Detect project type:
   - has package.json with "build" script → run `npm run build`
     - has vite.config.* → output dir: dist/
     - has next.config.* → REJECT ("Next.js SSR needs Pro plan. Static export: add `output: 'export'` to next.config")
     - else → try dist/, build/, out/ (first that exists)
   - has index.html in root → use current dir (no build needed)
   - else → error "No deployable files found. Need index.html or package.json with build script."

3. Determine slug:
   - --name flag → use it (sanitized)
   - package.json "name" field → sanitize to slug
   - current directory name → sanitize to slug
   - Sanitize: lowercase, replace non-alphanumeric with hyphens, trim hyphens, 3-50 chars

4. Validate: output dir must contain index.html
   - Error if missing: "No index.html found in {dir}/. SPA frameworks should output index.html."

5. Create tar.gz:
   - execSync(`tar czf {tmpFile} -C {outputDir} .`)
   - Check tar.gz size ≤ 50 MB

6. Upload:
   - PUT https://{server}/api/deploy/static?slug={slug}
   - Authorization: Bearer {token}
   - Content-Type: application/gzip
   - Body: raw .tar.gz file content (fs.readFileSync)
   - Uses node:https built-in

7. Print result:
   ✅ Deployed to https://{slug}.cloudpipe.app
   Size: 1.2 MB
```

### Config file

```json
// ~/.cloudpipe/config.json
{
  "token": "abc123...",
  "server": "https://cloudpipe.app"
}
```

### Package setup

```json
{
  "name": "cloudpipe-cli",
  "version": "1.0.0",
  "type": "module",
  "bin": { "cloudpipe": "./bin/cli.js" },
  "files": ["bin/", "lib/"],
  "engines": { "node": ">=18" }
}
```

File structure:
```
cloudpipe-cli/
  bin/cli.js        — entry point, argument parser, command dispatch
  lib/
    config.js       — read/write ~/.cloudpipe/config.json
    detect.js       — project type detection + build
    deploy.js       — tar + upload
    api.js          — HTTP client (list, delete, login)
  package.json
  README.md
```

---

## Security

| Threat | Mitigation |
|--------|-----------|
| Path traversal (`../../../etc/passwd`) | `path.resolve` + startsWith check |
| Tar bomb (huge uncompressed) | Track extracted size during extraction, abort > 50 MB |
| Symlinks in archive | `tar` extract with `--no-same-owner` and filter/strip symlinks |
| Slug squatting | Reserved word list (16 words), 3-50 char limit |
| Token brute force | Deploy endpoint: 10/min per IP via Redis rate limit key `rl:deploy:{ip}:{minute}` (separate from router-level limiter) |
| XSS via uploaded HTML | Sites on separate subdomain = origin isolation from API |
| Overwrite other user's site | Token ownership check before deploy |
| Directory listing | Directories return 404, never list contents |
| MIME sniffing | `X-Content-Type-Options: nosniff` header on all served files |

---

## Testing

| Test | Type | What |
|------|------|------|
| Slug validation | Unit | Valid/invalid slugs, reserved words, edge cases |
| Token auth | Unit | Valid, invalid, missing token |
| Quota enforcement | Unit | 3 sites limit, same token re-deploy bypasses quota |
| Archive extraction | Integration | Valid tar.gz, missing index.html, > 50MB, symlinks |
| Static serve | Integration | HTML, CSS, JS, SPA fallback, extensioned 404, path traversal |
| Cache headers | Integration | index.html no-cache, hashed assets immutable, others 1h |
| CLI detect | Unit | Vite project, plain HTML, Next.js rejection |
| Full deploy flow | E2E | CLI up → API → serve → browser accessible |

---

## Scope Boundaries (MVP vs Later)

### MVP (this spec)
- `static.js` module (serve + API)
- db.js tables (deploy_tokens + static_sites)
- router.js integration (cloudpipe.app domain)
- CLI (login, up, list, rm)
- Admin token creation (Telegram `/newtoken` + API)
- Error response format with codes

### Later (NOT in MVP)
- Self-service registration (LetMeUse integration)
- Dashboard web UI (cloudpipe-web sub-project)
- Custom domains per site
- Pro tier with backend support (PM2 process)
- Analytics (page views per site)
- Preview deployments (branch-based)
- Team/org sharing
- PayGate subscription tiers
- GitHub/GitLab webhook auto-deploy
- CDN / edge caching
- Deploy rollback (keep previous version as `.prev-{slug}/`)
- Server-side gzip/brotli compression
- `_redirects` / `cloudpipe.json` per-site config

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/core/static.js` | **NEW** — static site serve + deploy API + CRUD (~300 lines) |
| `src/core/db.js` | Add `deploy_tokens` + `static_sites` tables + CRUD functions (~80 lines) |
| `src/core/router.js` | Add `cloudpipe.app` domain check + CORS whitelist update (~15 lines) |
| `src/core/telegram.js` | Add `/newtoken <name> [email]` admin command (~20 lines) |
| `config.json` | Add `staticDomain` field |
| `cloudflared.yml` | Add `*.cloudpipe.app` + `cloudpipe.app` rules (2 lines) |
| `cloudpipe-cli/` | **NEW** directory — CLI npm package (~400 lines total) |

### Dependencies

| Where | Package | Why |
|-------|---------|-----|
| Server (`package.json`) | `tar` | Extract uploaded tar.gz archives |
| CLI | none | Uses system `tar` command + Node built-ins |
