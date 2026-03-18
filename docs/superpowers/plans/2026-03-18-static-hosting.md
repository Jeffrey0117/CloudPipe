# Static Hosting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add static site hosting to CloudPipe — vibe coders deploy with `npx cloudpipe-cli up`, sites served at `{slug}.cloudpipe.app`

**Architecture:** New `src/core/static.js` module handles file serving + deploy API. `router.js` routes `*.cloudpipe.app` to it. `db.js` gets two new tables (`deploy_tokens`, `static_sites`). A separate `cloudpipe-cli` npm package provides the CLI.

**Tech Stack:** Node.js (CJS), raw `http` module, SQLite (better-sqlite3), `tar` npm package (server-side extraction), system `tar` command (CLI-side packing)

**Spec:** `docs/superpowers/specs/2026-03-18-static-hosting-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/core/db.js` | Add `deploy_tokens` + `static_sites` tables + CRUD functions |
| `src/core/static.js` | **NEW** — static file serving, deploy API, site CRUD API, token API |
| `src/core/router.js` | Route `*.cloudpipe.app` to `static.js`, update CORS whitelist |
| `src/core/telegram.js` | Add `/newtoken` admin command |
| `cloudflared.yml` | Add `*.cloudpipe.app` ingress rules |
| `config.json` | Add `staticDomain` field |
| `cloudpipe-cli/package.json` | **NEW** — CLI npm package config |
| `cloudpipe-cli/bin/cli.js` | **NEW** — entry point, argument parsing |
| `cloudpipe-cli/lib/config.js` | **NEW** — read/write `~/.cloudpipe/config.json` |
| `cloudpipe-cli/lib/detect.js` | **NEW** — project type detection + build |
| `cloudpipe-cli/lib/deploy.js` | **NEW** — tar packing + upload |
| `cloudpipe-cli/lib/api.js` | **NEW** — HTTP client (list, delete) |

---

## Task 1: Data Layer — `db.js` tables + CRUD

**Files:**
- Modify: `src/core/db.js:48-82` (initSchema), `src/core/db.js:334-354` (module.exports)

- [ ] **Step 1: Add tables to `initSchema`**

In `src/core/db.js`, inside the `initSchema(db)` function, add after the `migration_lock` table creation:

```javascript
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

- [ ] **Step 2: Add Deploy Token CRUD functions**

Add before the `// ── Lifecycle` section in `db.js`:

```javascript
// ── Deploy Tokens API ─────────────────────────

function getDeployToken(token) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM deploy_tokens WHERE token = ?').get(token);
  return row || null;
}

function createDeployToken({ name, email, max_sites }) {
  const crypto = require('crypto');
  const db = getDb();
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO deploy_tokens (token, name, email, max_sites, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(token, name, email || null, max_sites || 3, now);
  return { token, name, email: email || null, max_sites: max_sites || 3, created_at: now };
}

function listDeployTokens() {
  const db = getDb();
  return db.prepare('SELECT * FROM deploy_tokens').all();
}

function deleteDeployToken(token) {
  const db = getDb();
  const result = db.prepare('DELETE FROM deploy_tokens WHERE token = ?').run(token);
  return result.changes > 0;
}
```

- [ ] **Step 3: Add Static Sites CRUD functions**

Add after the deploy token functions:

```javascript
// ── Static Sites API ──────────────────────────

function getStaticSite(slug) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM static_sites WHERE slug = ?').get(slug);
  return row || null;
}

function listStaticSites(token) {
  const db = getDb();
  return db.prepare('SELECT * FROM static_sites WHERE token = ?').all(token);
}

function createStaticSite({ slug, token, size }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO static_sites (slug, token, size, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(slug, token, size || 0, now, now);
  return { slug, token, size: size || 0, created_at: now, updated_at: now };
}

function updateStaticSite(slug, { size }) {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE static_sites SET size = ?, updated_at = ? WHERE slug = ?'
  ).run(size, now, slug);
}

function deleteStaticSite(slug) {
  const db = getDb();
  const result = db.prepare('DELETE FROM static_sites WHERE slug = ?').run(slug);
  return result.changes > 0;
}

function countSitesByToken(token) {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) AS count FROM static_sites WHERE token = ?').get(token);
  return row.count;
}
```

- [ ] **Step 4: Export new functions**

Add to `module.exports` in `db.js`:

```javascript
  getDeployToken,
  createDeployToken,
  listDeployTokens,
  deleteDeployToken,

  getStaticSite,
  listStaticSites,
  createStaticSite,
  updateStaticSite,
  deleteStaticSite,
  countSitesByToken,
```

- [ ] **Step 5: Verify tables are created**

Run: `node -e "require('./src/core/db'); console.log('OK')"`
Expected: `OK` (no errors, tables created in `data/cloudpipe.db`)

- [ ] **Step 6: Commit**

```bash
git add src/core/db.js
git commit -m "feat: add deploy_tokens + static_sites tables to db.js"
```

---

## Task 2: Install `tar` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install tar**

Run: `npm install tar`

- [ ] **Step 2: Verify**

Run: `node -e "require('tar'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add tar dependency for static hosting archive extraction"
```

---

## Task 3: Static Module — File Serving (`static.js` part 1)

**Files:**
- Create: `src/core/static.js`

- [ ] **Step 1: Create `static.js` with file serving**

Create `src/core/static.js`:

```javascript
/**
 * CloudPipe Static Hosting
 *
 * Serves static sites at {slug}.cloudpipe.app
 * Handles deploy API at cloudpipe.app/api/*
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const ROOT = path.join(__dirname, '../..');
const STATIC_DIR = path.join(ROOT, 'data', 'static');
const CONFIG_PATH = path.join(ROOT, 'config.json');

// Load config once (staticDomain)
function getStaticDomain() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return config.staticDomain || 'cloudpipe.app';
  } catch {
    return 'cloudpipe.app';
  }
}

// Ensure static dir exists
if (!fs.existsSync(STATIC_DIR)) {
  fs.mkdirSync(STATIC_DIR, { recursive: true });
}

// ── MIME types ──

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.pdf': 'application/pdf',
};

// ── Slug validation ──

const RESERVED_SLUGS = new Set([
  'www', 'api', 'admin', 'app', 'dashboard', 'static', 'cdn',
  'mail', 'ftp', 'ssh', 'cloudpipe', 'status', 'health',
  'login', 'signup', 'blog', 'docs'
]);

function validateSlug(slug) {
  if (!slug || typeof slug !== 'string') return 'Slug is required';
  if (slug.length < 3 || slug.length > 50) return 'Slug must be 3-50 characters';
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) return 'Slug must be lowercase alphanumeric and hyphens, cannot start/end with hyphen';
  if (/--/.test(slug)) return 'Slug cannot contain consecutive hyphens';
  if (RESERVED_SLUGS.has(slug)) return `"${slug}" is a reserved name`;
  return null;
}

// ── Cache-Control helpers ──

const HASH_PATTERN = /[.-][a-f0-9]{8,}[.-]|[.-][A-Za-z0-9_-]{8,}\.(js|css|woff2?|png|jpg|svg)$/;

function getCacheControl(filePath, ext) {
  const basename = path.basename(filePath);
  if (ext === '.html') return 'no-cache';
  if (HASH_PATTERN.test(basename)) return 'public, max-age=31536000, immutable';
  return 'public, max-age=3600';
}

// ── Serve static site ──

function handleSite(req, res, slug) {
  const siteDir = path.join(STATIC_DIR, slug);

  if (!fs.existsSync(siteDir)) {
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    return res.end('<h1>Site not found</h1>');
  }

  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  const resolved = path.resolve(siteDir, '.' + urlPath);

  // Security: path traversal check (normalize for Windows backslash/case)
  const normalizedResolved = path.resolve(resolved);
  const normalizedSiteDir = path.resolve(siteDir);
  if (!normalizedResolved.startsWith(normalizedSiteDir + path.sep) && normalizedResolved !== normalizedSiteDir) {
    res.writeHead(403, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Forbidden' }));
  }

  // Try exact file
  if (fs.existsSync(resolved)) {
    const stat = fs.statSync(resolved);
    if (stat.isFile()) {
      const ext = path.extname(resolved).toLowerCase();
      const contentType = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'content-type': contentType,
        'cache-control': getCacheControl(resolved, ext),
        'x-content-type-options': 'nosniff',
      });
      return fs.createReadStream(resolved).pipe(res);
    }
    // Directory: try index.html inside it
    if (stat.isDirectory()) {
      const dirIndex = path.join(resolved, 'index.html');
      if (fs.existsSync(dirIndex)) {
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-cache',
          'x-content-type-options': 'nosniff',
        });
        return fs.createReadStream(dirIndex).pipe(res);
      }
    }
  }

  // SPA fallback: only for paths WITHOUT file extension
  const ext = path.extname(urlPath);
  if (ext) {
    // Path has extension but file doesn't exist → 404
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    return res.end('<h1>File not found</h1>');
  }

  // No extension (e.g. /about, /dashboard) → SPA fallback to index.html
  const indexPath = path.join(siteDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
    });
    return fs.createReadStream(indexPath).pipe(res);
  }

  res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
  return res.end('<h1>Site not found</h1>');
}

module.exports = { handleSite, handleAPI: null, validateSlug, STATIC_DIR };
```

- [ ] **Step 2: Quick smoke test**

Run: `node -e "const s = require('./src/core/static'); console.log(typeof s.handleSite, typeof s.validateSlug)"`
Expected: `function function`

- [ ] **Step 3: Commit**

```bash
git add src/core/static.js
git commit -m "feat: add static.js with file serving + SPA fallback"
```

---

## Task 4: Static Module — Deploy API (`static.js` part 2)

**Files:**
- Modify: `src/core/static.js`

- [ ] **Step 1: Add deploy API handler**

Add to `static.js`, before the `module.exports` line. This adds the full API handler:

```javascript
// ── Auth helper ──

function getTokenFromRequest(req) {
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7);
  return null;
}

// ── Rate limit for deploy (10/min per IP) ──

async function checkDeployRateLimit(ip) {
  try {
    const redis = require('./redis').getClient();
    if (!redis) return null;
    const minute = Math.floor(Date.now() / 60000);
    const key = `rl:deploy:${ip}:${minute}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 120);
    if (count > 10) return { retryAfter: 60 - Math.floor((Date.now() % 60000) / 1000) };
    return null;
  } catch {
    return null; // Redis error → allow
  }
}

// ── Collect request body ──

function collectBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > maxBytes) {
        req.destroy();
        reject(new Error('BODY_TOO_LARGE'));
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// ── Extract tar.gz archive ──

const MAX_ARCHIVE_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_EXTRACTED_SIZE = 50 * 1024 * 1024; // 50 MB

async function extractArchive(buffer, destDir) {
  const tar = require('tar');
  const { pipeline } = require('stream/promises');
  const { Readable } = require('stream');

  fs.mkdirSync(destDir, { recursive: true });

  await pipeline(
    Readable.from(buffer),
    tar.x({
      cwd: destDir,
      strip: 0,
      preserveOwner: false,
      noChmod: true,
      filter: (entryPath, entry) => {
        // Block symlinks
        if (entry.type === 'SymbolicLink' || entry.type === 'Link') return false;
        // Block path traversal
        const resolved = path.resolve(destDir, entryPath);
        if (!resolved.startsWith(path.resolve(destDir))) return false;
        return true;
      },
    })
  );

  // Check extracted size
  const totalSize = getDirSize(destDir);
  if (totalSize > MAX_EXTRACTED_SIZE) {
    throw new Error('EXTRACTED_TOO_LARGE');
  }

  return totalSize;
}

function getDirSize(dir) {
  let size = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isFile()) {
      size += fs.statSync(fullPath).size;
    } else if (entry.isDirectory()) {
      size += getDirSize(fullPath);
    }
  }
  return size;
}

// ── Directory swap (best-effort on Windows) ──

function swapDirectory(slug, tempDir) {
  const targetDir = path.join(STATIC_DIR, slug);
  const oldDir = path.join(STATIC_DIR, `.old-${slug}-${Date.now()}`);

  if (fs.existsSync(targetDir)) {
    fs.renameSync(targetDir, oldDir);
  }

  try {
    fs.renameSync(tempDir, targetDir);
  } catch (err) {
    // Rollback: restore old directory
    if (fs.existsSync(oldDir)) {
      try { fs.renameSync(oldDir, targetDir); } catch { /* best effort */ }
    }
    throw err;
  }

  // Cleanup old dir in background
  if (fs.existsSync(oldDir)) {
    setTimeout(() => {
      try { fs.rmSync(oldDir, { recursive: true, force: true }); } catch { /* ignore */ }
    }, 1000);
  }
}

// ── JSON response helpers ──

function jsonOk(res, data, status = 200) {
  res.writeHead(status, { 'content-type': 'application/json' });
  return res.end(JSON.stringify(data));
}

function jsonErr(res, error, code, status) {
  res.writeHead(status, { 'content-type': 'application/json' });
  return res.end(JSON.stringify({ error, code }));
}

// ── Parse JSON body ──

function parseJsonBody(buffer) {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    return null;
  }
}

// ── API Router ──

async function handleAPI(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  // PUT /api/deploy/static?slug=xxx — deploy a static site
  if (req.method === 'PUT' && pathname === '/api/deploy/static') {
    return handleDeploy(req, res, url);
  }

  // GET /api/sites — list user's sites
  if (req.method === 'GET' && pathname === '/api/sites') {
    return handleListSites(req, res);
  }

  // DELETE /api/sites/:slug — delete a site
  if (req.method === 'DELETE' && pathname.startsWith('/api/sites/')) {
    const slug = pathname.slice('/api/sites/'.length);
    return handleDeleteSite(req, res, slug);
  }

  // POST /api/auth/token — create deploy token (admin only)
  if (req.method === 'POST' && pathname === '/api/auth/token') {
    return handleCreateToken(req, res);
  }

  // Fallback: serve landing page or 404
  // (OPTIONS preflight already handled by router.js)
  if (req.method === 'GET') {
    // Future: serve cloudpipe.app landing page
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end('<h1>CloudPipe</h1><p>Deploy static sites with one command.</p><code>npx cloudpipe-cli up</code>');
  }

  return jsonErr(res, 'Not found', 'NOT_FOUND', 404);
}

// ── Deploy handler ──

const logger = require('./logger');

async function handleDeploy(req, res, url) {
  const ip = logger.getClientIp(req);

  // Rate limit
  const blocked = await checkDeployRateLimit(ip);
  if (blocked) {
    return jsonErr(res, 'Too many deploys. Try again later.', 'RATE_LIMITED', 429);
  }

  // Auth
  const token = getTokenFromRequest(req);
  if (!token) return jsonErr(res, 'Missing Authorization header', 'INVALID_TOKEN', 401);

  const tokenRecord = db.getDeployToken(token);
  if (!tokenRecord) return jsonErr(res, 'Invalid deploy token', 'INVALID_TOKEN', 401);

  // Slug
  const slug = url.searchParams.get('slug');
  const slugError = validateSlug(slug);
  if (slugError) return jsonErr(res, slugError, 'INVALID_SLUG', 400);

  // Ownership check
  const existingSite = db.getStaticSite(slug);
  if (existingSite && existingSite.token !== token) {
    return jsonErr(res, 'This slug is owned by another user', 'SLUG_TAKEN', 403);
  }

  // Quota check
  if (!existingSite) {
    const count = db.countSitesByToken(token);
    if (count >= tokenRecord.max_sites) {
      return jsonErr(res, `Site limit reached (${tokenRecord.max_sites}). Delete a site or upgrade.`, 'QUOTA_EXCEEDED', 402);
    }
  }

  // Collect body
  let body;
  try {
    body = await collectBody(req, MAX_ARCHIVE_SIZE);
  } catch (err) {
    if (err.message === 'BODY_TOO_LARGE') {
      return jsonErr(res, 'Archive exceeds 50 MB limit', 'ARCHIVE_TOO_LARGE', 413);
    }
    return jsonErr(res, 'Failed to read request body', 'DEPLOY_FAILED', 500);
  }

  if (body.length === 0) {
    return jsonErr(res, 'Empty request body', 'DEPLOY_FAILED', 400);
  }

  // Extract to temp dir
  const tempDir = path.join(STATIC_DIR, `.tmp-${slug}-${Date.now()}`);
  let extractedSize;

  try {
    extractedSize = await extractArchive(body, tempDir);
  } catch (err) {
    // Cleanup temp dir
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }

    if (err.message === 'EXTRACTED_TOO_LARGE') {
      return jsonErr(res, 'Extracted content exceeds 50 MB limit', 'ARCHIVE_TOO_LARGE', 413);
    }
    console.error('[static] Extraction failed:', err.message);
    return jsonErr(res, 'Failed to extract archive', 'EXTRACTION_FAILED', 400);
  }

  // Validate: must have index.html
  if (!fs.existsSync(path.join(tempDir, 'index.html'))) {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    return jsonErr(res, 'Archive must contain index.html at the root', 'NO_INDEX_HTML', 400);
  }

  // Swap directories
  try {
    swapDirectory(slug, tempDir);
  } catch (err) {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    console.error('[static] Swap failed:', err.message);
    return jsonErr(res, 'Failed to deploy site', 'DEPLOY_FAILED', 500);
  }

  // Upsert DB
  if (existingSite) {
    db.updateStaticSite(slug, { size: extractedSize });
  } else {
    db.createStaticSite({ slug, token, size: extractedSize });
  }

  const domain = getStaticDomain();

  console.error(`[static] Deployed ${slug} (${(extractedSize / 1024).toFixed(1)} KB) by token ${token.slice(0, 8)}...`);

  return jsonOk(res, {
    url: `https://${slug}.${domain}`,
    slug,
    size: extractedSize,
  });
}

// ── List sites ──

function handleListSites(req, res) {
  const token = getTokenFromRequest(req);
  if (!token) return jsonErr(res, 'Missing Authorization header', 'INVALID_TOKEN', 401);

  const tokenRecord = db.getDeployToken(token);
  if (!tokenRecord) return jsonErr(res, 'Invalid deploy token', 'INVALID_TOKEN', 401);

  const domain = getStaticDomain();

  const sites = db.listStaticSites(token).map(s => ({
    slug: s.slug,
    url: `https://${s.slug}.${domain}`,
    size: s.size,
    created_at: s.created_at,
    updated_at: s.updated_at,
  }));

  return jsonOk(res, { sites });
}

// ── Delete site ──

function handleDeleteSite(req, res, slug) {
  const token = getTokenFromRequest(req);
  if (!token) return jsonErr(res, 'Missing Authorization header', 'INVALID_TOKEN', 401);

  const tokenRecord = db.getDeployToken(token);
  if (!tokenRecord) return jsonErr(res, 'Invalid deploy token', 'INVALID_TOKEN', 401);

  const site = db.getStaticSite(slug);
  if (!site) return jsonErr(res, 'Site not found', 'NOT_FOUND', 404);
  if (site.token !== token) return jsonErr(res, 'Not your site', 'FORBIDDEN', 403);

  // Delete files
  const siteDir = path.join(STATIC_DIR, slug);
  try { fs.rmSync(siteDir, { recursive: true, force: true }); } catch { /* ignore */ }

  // Delete DB record
  db.deleteStaticSite(slug);

  return jsonOk(res, { deleted: true });
}

// ── Create token (admin only) ──

async function handleCreateToken(req, res) {
  const auth = require('./auth');
  const payload = auth.verifyRequest(req);
  if (!payload) return jsonErr(res, 'Admin authentication required', 'FORBIDDEN', 403);

  let body;
  try {
    body = await collectBody(req, 4096);
  } catch {
    return jsonErr(res, 'Failed to read body', 'DEPLOY_FAILED', 400);
  }

  const data = parseJsonBody(body);
  if (!data || !data.name) {
    return jsonErr(res, 'name is required', 'INVALID_SLUG', 400);
  }

  const record = db.createDeployToken({
    name: data.name,
    email: data.email,
    max_sites: data.max_sites,
  });

  return jsonOk(res, record, 201);
}
```

- [ ] **Step 2: Update `module.exports`**

Replace the existing `module.exports` line at the bottom of `static.js`:

```javascript
module.exports = { handleSite, handleAPI, validateSlug, STATIC_DIR };
```

- [ ] **Step 3: Verify module loads**

Run: `node -e "const s = require('./src/core/static'); console.log(typeof s.handleAPI)"`
Expected: `function`

- [ ] **Step 4: Commit**

```bash
git add src/core/static.js
git commit -m "feat: add deploy API, site CRUD, token management to static.js"
```

---

## Task 5: Router Integration

**Files:**
- Modify: `src/core/router.js:59-70` (isAllowedOrigin), `src/core/router.js:167-247` (request handler)

- [ ] **Step 1: Add `cloudpipe.app` to CORS whitelist**

In `src/core/router.js`, in the `isAllowedOrigin` function, add after the `duk.tw` check (line 65):

```javascript
    if (hostname.endsWith('.cloudpipe.app') || hostname === 'cloudpipe.app') return true
```

- [ ] **Step 2: Add `cloudpipe.app` routing**

In `src/core/router.js`, inside the `createServer` callback, add BEFORE the `// ========== 主域名 (epi.isnowfriend.com) ==========` comment (line 226). Insert after the rate limiting block ends:

```javascript
    // ========== Static Hosting (cloudpipe.app) ==========
    const staticDomain = config.staticDomain
    if (staticDomain && (hostname === staticDomain || hostname.endsWith('.' + staticDomain))) {
      const staticHost = require('./static')

      if (hostname === staticDomain) {
        return staticHost.handleAPI(req, res)
      }

      const slug = hostname.split('.')[0]
      return staticHost.handleSite(req, res, slug)
    }
```

- [ ] **Step 3: Verify router loads**

Run: `node -e "require('./src/core/router'); console.log('OK')"`
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add src/core/router.js
git commit -m "feat: route *.cloudpipe.app to static hosting module"
```

---

## Task 6: Config + Cloudflared

**Files:**
- Modify: `config.json`, `cloudflared.yml`

- [ ] **Step 1: Add `staticDomain` to config.json**

Add `"staticDomain": "cloudpipe.app"` to `config.json` (after the `"subdomain"` field).

- [ ] **Step 2: Update cloudflared.yml**

Add two new ingress rules BEFORE the existing `*.isnowfriend.com` rule:

```yaml
  - hostname: "*.cloudpipe.app"
    service: http://localhost:8787
  - hostname: "cloudpipe.app"
    service: http://localhost:8787
```

Final `cloudflared.yml` should be:

```yaml
tunnel: afd11345-c75a-4d62-aa67-0a389d82ce74
credentials-file: C:\Users\jeffb\.cloudflared\afd11345-c75a-4d62-aa67-0a389d82ce74.json

ingress:
  - hostname: "*.cloudpipe.app"
    service: http://localhost:8787
  - hostname: "cloudpipe.app"
    service: http://localhost:8787
  - hostname: "*.isnowfriend.com"
    service: http://localhost:8787
  - hostname: duk.tw
    service: http://localhost:8787
  - hostname: "*.duk.tw"
    service: http://localhost:8787
  - service: http_status:404
```

- [ ] **Step 3: Commit**

```bash
git add config.json cloudflared.yml
git commit -m "feat: add cloudpipe.app domain config + cloudflared ingress rules"
```

---

## Task 7: Telegram `/newtoken` Command

**Files:**
- Modify: `src/core/telegram.js:942-1033` (handleUpdate switch)

- [ ] **Step 1: Add `handleNewToken` function**

Add before the `handleUpdate` function in `telegram.js` (around line 940):

```javascript
async function handleNewToken(chatId, args) {
  if (!args[0]) {
    return sendMessage(chatId, '用法: <code>/newtoken 名稱 [email]</code>\n\n例: <code>/newtoken Jeffrey jeff@example.com</code>');
  }
  const name = args[0];
  const email = args[1] || null;

  const db = require('./db');
  const record = db.createDeployToken({ name, email });

  return sendMessage(chatId,
    `✅ <b>Deploy Token Created</b>\n\n` +
    `Name: ${record.name}\n` +
    `Email: ${record.email || '(none)'}\n` +
    `Max sites: ${record.max_sites}\n\n` +
    `<code>${record.token}</code>\n\n` +
    `⚠️ 請立即複製，不會再顯示`
  );
}
```

- [ ] **Step 2: Add case to switch statement**

In the `handleUpdate` switch statement, add before the `case '/help':` line:

```javascript
    case '/newtoken':
      return handleNewToken(chatId, args);
```

- [ ] **Step 3: Commit**

```bash
git add src/core/telegram.js
git commit -m "feat: add /newtoken Telegram command for deploy token creation"
```

---

## Task 8: CLI — Package Setup + Config Module

**Files:**
- Create: `cloudpipe-cli/package.json`
- Create: `cloudpipe-cli/lib/config.js`

- [ ] **Step 1: Create `cloudpipe-cli/` directory and `package.json`**

Create `cloudpipe-cli/package.json`:

```json
{
  "name": "cloudpipe-cli",
  "version": "1.0.0",
  "description": "Deploy static sites to CloudPipe with one command",
  "type": "module",
  "bin": {
    "cloudpipe": "./bin/cli.js"
  },
  "files": [
    "bin/",
    "lib/"
  ],
  "engines": {
    "node": ">=18"
  },
  "keywords": [
    "deploy",
    "static",
    "hosting",
    "cli",
    "cloudpipe"
  ],
  "author": "Jeffrey0117",
  "license": "MIT"
}
```

- [ ] **Step 2: Create `lib/config.js`**

Create `cloudpipe-cli/lib/config.js`:

```javascript
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.cloudpipe');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

export function clearConfig() {
  try {
    fs.unlinkSync(CONFIG_PATH);
  } catch {
    // ignore
  }
}

export const CONFIG_PATH_DISPLAY = CONFIG_PATH;
```

- [ ] **Step 3: Commit**

```bash
git add cloudpipe-cli/package.json cloudpipe-cli/lib/config.js
git commit -m "feat: cloudpipe-cli package setup + config module"
```

---

## Task 9: CLI — Project Detection + Build

**Files:**
- Create: `cloudpipe-cli/lib/detect.js`

- [ ] **Step 1: Create `lib/detect.js`**

Create `cloudpipe-cli/lib/detect.js`:

```javascript
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

/**
 * Detect project type and build if needed.
 * Returns { outputDir, slug } or throws with user-friendly message.
 */
export function detectAndBuild(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  const indexPath = path.join(cwd, 'index.html');

  // Case 1: has package.json with build script
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

    // Reject Next.js SSR
    const hasNextConfig = ['next.config.js', 'next.config.mjs', 'next.config.ts']
      .some(f => fs.existsSync(path.join(cwd, f)));
    if (hasNextConfig) {
      throw new Error(
        'Next.js SSR needs a Pro plan.\n' +
        'For static export, add `output: "export"` to next.config.js, then retry.'
      );
    }

    if (pkg.scripts?.build) {
      console.log('Building project...');
      execSync('npm run build', { cwd, stdio: 'inherit' });

      // Detect output directory (dist first for Vite, then build, out)
      const candidates = ['dist', 'build', 'out'];

      for (const dir of candidates) {
        const outputDir = path.join(cwd, dir);
        if (fs.existsSync(outputDir) && fs.statSync(outputDir).isDirectory()) {
          return { outputDir, suggestedSlug: slugify(pkg.name || path.basename(cwd)) };
        }
      }

      throw new Error(
        `Build succeeded but no output directory found.\n` +
        `Looked for: ${candidates.join(', ')}`
      );
    }

    // Has package.json but no build script — check for index.html
    if (fs.existsSync(indexPath)) {
      return { outputDir: cwd, suggestedSlug: slugify(pkg.name || path.basename(cwd)) };
    }

    throw new Error(
      'package.json found but no "build" script and no index.html.\n' +
      'Add a build script or create an index.html.'
    );
  }

  // Case 2: plain HTML project
  if (fs.existsSync(indexPath)) {
    return { outputDir: cwd, suggestedSlug: slugify(path.basename(cwd)) };
  }

  // Case 3: nothing deployable
  throw new Error(
    'No deployable files found.\n' +
    'Need index.html or package.json with a build script.'
  );
}

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/^@[^/]+\//, '')    // strip npm scope
    .replace(/[^a-z0-9-]/g, '-') // non-alphanum → hyphen
    .replace(/-+/g, '-')          // collapse hyphens
    .replace(/^-|-$/g, '')        // trim hyphens
    .slice(0, 50)
    || 'my-site';
}
```

- [ ] **Step 2: Commit**

```bash
git add cloudpipe-cli/lib/detect.js
git commit -m "feat: cloudpipe-cli project detection + build logic"
```

---

## Task 10: CLI — Deploy (tar + upload)

**Files:**
- Create: `cloudpipe-cli/lib/deploy.js`

- [ ] **Step 1: Create `lib/deploy.js`**

Create `cloudpipe-cli/lib/deploy.js`:

```javascript
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import http from 'node:http';
import { execSync } from 'node:child_process';

/**
 * Pack outputDir into tar.gz and upload to server.
 * Returns { url, slug, size } from server response.
 */
export async function deploy({ outputDir, slug, token, server }) {
  // Validate index.html exists
  if (!fs.existsSync(path.join(outputDir, 'index.html'))) {
    throw new Error(`No index.html found in ${outputDir}`);
  }

  // Create tar.gz
  const tmpFile = path.join(os.tmpdir(), `cloudpipe-${slug}-${Date.now()}.tar.gz`);

  try {
    execSync(`tar czf "${tmpFile}" -C "${outputDir}" .`, { stdio: 'pipe' });
  } catch (err) {
    throw new Error(
      'Failed to create archive. Make sure `tar` is available.\n' +
      (err.stderr?.toString() || err.message)
    );
  }

  const archiveBuffer = fs.readFileSync(tmpFile);

  // Cleanup temp file
  try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }

  // Check size
  const sizeMB = (archiveBuffer.length / (1024 * 1024)).toFixed(1);
  if (archiveBuffer.length > 50 * 1024 * 1024) {
    throw new Error(`Archive too large: ${sizeMB} MB (limit: 50 MB)`);
  }

  console.log(`Uploading ${sizeMB} MB...`);

  // Upload
  const url = new URL(`/api/deploy/static?slug=${encodeURIComponent(slug)}`, server);
  const transport = url.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const req = transport.request(url, {
      method: 'PUT',
      headers: {
        'authorization': `Bearer ${token}`,
        'content-type': 'application/gzip',
        'content-length': archiveBuffer.length,
      },
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        try {
          const data = JSON.parse(body);
          if (res.statusCode >= 400) {
            reject(new Error(data.error || `Server returned ${res.statusCode}`));
          } else {
            resolve(data);
          }
        } catch {
          reject(new Error(`Server returned ${res.statusCode}: ${body.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(archiveBuffer);
    req.end();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add cloudpipe-cli/lib/deploy.js
git commit -m "feat: cloudpipe-cli tar packing + upload module"
```

---

## Task 11: CLI — API Client (list, delete)

**Files:**
- Create: `cloudpipe-cli/lib/api.js`

- [ ] **Step 1: Create `lib/api.js`**

Create `cloudpipe-cli/lib/api.js`:

```javascript
import https from 'node:https';
import http from 'node:http';

function request(method, urlStr, { token, body } = {}) {
  const url = new URL(urlStr);
  const transport = url.protocol === 'https:' ? https : http;

  const headers = {
    'authorization': `Bearer ${token}`,
  };

  if (body) {
    headers['content-type'] = 'application/json';
    headers['content-length'] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(url, { method, headers }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          const data = JSON.parse(raw);
          if (res.statusCode >= 400) {
            reject(new Error(data.error || `Server returned ${res.statusCode}`));
          } else {
            resolve(data);
          }
        } catch {
          reject(new Error(`Server returned ${res.statusCode}: ${raw.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function listSites({ token, server }) {
  return request('GET', `${server}/api/sites`, { token });
}

export async function deleteSite({ slug, token, server }) {
  return request('DELETE', `${server}/api/sites/${encodeURIComponent(slug)}`, { token });
}
```

- [ ] **Step 2: Commit**

```bash
git add cloudpipe-cli/lib/api.js
git commit -m "feat: cloudpipe-cli API client (list, delete)"
```

---

## Task 12: CLI — Main Entry Point (`bin/cli.js`)

**Files:**
- Create: `cloudpipe-cli/bin/cli.js`

- [ ] **Step 1: Create `bin/cli.js`**

Create `cloudpipe-cli/bin/cli.js`:

```javascript
#!/usr/bin/env node

import { getConfig, saveConfig, clearConfig, CONFIG_PATH_DISPLAY } from '../lib/config.js';
import { detectAndBuild, slugify } from '../lib/detect.js';
import { deploy } from '../lib/deploy.js';
import { listSites, deleteSite } from '../lib/api.js';
import readline from 'node:readline';

const args = process.argv.slice(2);
const command = args[0];

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  switch (command) {
    case 'login':
      return cmdLogin();
    case 'up':
    case 'deploy':
      return cmdUp();
    case 'list':
    case 'ls':
      return cmdList();
    case 'rm':
    case 'delete':
      return cmdRm();
    case 'logout':
      return cmdLogout();
    case '--help':
    case '-h':
    case 'help':
    case undefined:
      return cmdHelp();
    default:
      console.error(`Unknown command: ${command}\nRun 'cloudpipe help' for usage.`);
      process.exit(1);
  }
}

async function cmdLogin() {
  const token = await prompt('Deploy token: ');
  if (!token) {
    console.error('Token is required.');
    process.exit(1);
  }

  const server = await prompt('Server URL (https://cloudpipe.app): ');
  saveConfig({
    token,
    server: server || 'https://cloudpipe.app',
  });
  console.log(`Saved to ${CONFIG_PATH_DISPLAY}`);
}

async function cmdUp() {
  const config = getConfig();
  if (!config?.token) {
    console.error('Not logged in. Run: cloudpipe login');
    process.exit(1);
  }

  // Parse --name flag
  const nameIdx = args.indexOf('--name');
  const nameArg = nameIdx !== -1 ? args[nameIdx + 1] : null;

  const cwd = process.cwd();

  // Detect + build
  let outputDir, suggestedSlug;
  try {
    const result = detectAndBuild(cwd);
    outputDir = result.outputDir;
    suggestedSlug = result.suggestedSlug;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  const slug = nameArg ? slugify(nameArg) : suggestedSlug;
  console.log(`Deploying to ${slug}...`);

  // Deploy
  try {
    const result = await deploy({
      outputDir,
      slug,
      token: config.token,
      server: config.server,
    });

    console.log('');
    console.log(`Deployed to ${result.url}`);
    console.log(`Size: ${formatSize(result.size)}`);
  } catch (err) {
    console.error(`Deploy failed: ${err.message}`);
    process.exit(1);
  }
}

async function cmdList() {
  const config = getConfig();
  if (!config?.token) {
    console.error('Not logged in. Run: cloudpipe login');
    process.exit(1);
  }

  try {
    const { sites } = await listSites({
      token: config.token,
      server: config.server,
    });

    if (sites.length === 0) {
      console.log('No sites deployed yet. Run: cloudpipe up');
      return;
    }

    console.log('');
    for (const site of sites) {
      const age = timeSince(new Date(site.updated_at));
      console.log(`  ${site.slug.padEnd(30)} ${formatSize(site.size).padEnd(10)} ${age}`);
    }
    console.log('');
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function cmdRm() {
  const config = getConfig();
  if (!config?.token) {
    console.error('Not logged in. Run: cloudpipe login');
    process.exit(1);
  }

  const slug = args[1];
  if (!slug) {
    console.error('Usage: cloudpipe rm <slug>');
    process.exit(1);
  }

  try {
    await deleteSite({ slug, token: config.token, server: config.server });
    console.log(`Deleted ${slug}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

function cmdLogout() {
  clearConfig();
  console.log('Logged out.');
}

function cmdHelp() {
  console.log(`
cloudpipe-cli — Deploy static sites with one command

Commands:
  login           Save your deploy token
  up [--name x]   Build and deploy current directory
  list            List your deployed sites
  rm <slug>       Delete a site
  logout          Remove saved token
  help            Show this help

Examples:
  cloudpipe login
  cloudpipe up
  cloudpipe up --name my-portfolio
  cloudpipe list
  cloudpipe rm my-portfolio
`.trim());
}

function timeSince(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Commit**

```bash
git add cloudpipe-cli/bin/cli.js
git commit -m "feat: cloudpipe-cli main entry point with all commands"
```

---

## Task 13: Integration Test — Full Deploy Flow

- [ ] **Step 1: Create a test static site**

Create a temp directory with test files. On Windows (Git Bash or PowerShell):

```bash
mkdir -p "$TEMP/test-cloudpipe-site"
echo '<html><body><h1>Hello CloudPipe</h1></body></html>' > "$TEMP/test-cloudpipe-site/index.html"
echo 'body { color: red; }' > "$TEMP/test-cloudpipe-site/style.css"
```

- [ ] **Step 2: Create a deploy token**

Easiest method: use Telegram `/newtoken test-user` → copy the 64-char hex token.

Alternative (API): The token creation API lives on `cloudpipe.app` bare domain. For localhost testing, use `Host: cloudpipe.app` header. Admin JWTs from `isnowfriend.com` work because they share the same `jwtSecret`:

```bash
# Get admin JWT from main domain
TOKEN=$(curl -s -X POST http://localhost:8787/api/_admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"..."}' | node -e "process.stdin.on('data',d=>process.stdout.write(JSON.parse(d).token))")

# Create deploy token (Host header routes to static.js handleAPI)
curl -s -X POST http://localhost:8787/api/auth/token \
  -H "Host: cloudpipe.app" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-user"}'
```

Expected: `{ "token": "abc123...", "name": "test-user", "max_sites": 3 }`

- [ ] **Step 3: Deploy via curl**

```bash
DEPLOY_TOKEN="<token from step 2>"

# Create tar.gz
tar czf "$TEMP/test-site.tar.gz" -C "$TEMP/test-cloudpipe-site" .

# Deploy (Host header for local routing)
curl -v -X PUT "http://localhost:8787/api/deploy/static?slug=test-site" \
  -H "Host: cloudpipe.app" \
  -H "Authorization: Bearer $DEPLOY_TOKEN" \
  -H "Content-Type: application/gzip" \
  --data-binary "@$TEMP/test-site.tar.gz"
```

Expected: `{ "url": "https://test-site.cloudpipe.app", "slug": "test-site", "size": ... }`

- [ ] **Step 4: Verify files were extracted**

Check that `data/static/test-site/index.html` and `data/static/test-site/style.css` exist.

- [ ] **Step 5: Test serving**

```bash
curl -H "Host: test-site.cloudpipe.app" http://localhost:8787/
curl -H "Host: test-site.cloudpipe.app" http://localhost:8787/style.css
curl -H "Host: test-site.cloudpipe.app" http://localhost:8787/about  # SPA fallback
curl -H "Host: test-site.cloudpipe.app" http://localhost:8787/missing.css  # 404
```

Expected:
- `/` → HTML content with "Hello CloudPipe"
- `/style.css` → CSS content
- `/about` → SPA fallback (returns index.html)
- `/missing.css` → 404

- [ ] **Step 6: Test list + delete**

```bash
# List
curl -H "Host: cloudpipe.app" "http://localhost:8787/api/sites" \
  -H "Authorization: Bearer $DEPLOY_TOKEN"

# Delete
curl -X DELETE -H "Host: cloudpipe.app" "http://localhost:8787/api/sites/test-site" \
  -H "Authorization: Bearer $DEPLOY_TOKEN"
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: static hosting MVP — deploy API, file serving, CLI, /newtoken"
```

---

## Task 14: DNS Setup (Manual)

This task is manual — not code changes.

- [ ] **Step 1: Buy `cloudpipe.app` domain** (if not already done)

- [ ] **Step 2: Add Cloudflare DNS records**

In Cloudflare dashboard for `cloudpipe.app`:
- `CNAME` `@` → `{tunnelId}.cfargotunnel.com` (proxied)
- `CNAME` `*` → `{tunnelId}.cfargotunnel.com` (proxied)

Tunnel ID: `afd11345-c75a-4d62-aa67-0a389d82ce74`

- [ ] **Step 3: Restart cloudflared tunnel**

```bash
pm2 restart tunnel
```

- [ ] **Step 4: Test live**

```bash
curl https://cloudpipe.app/
curl https://test-site.cloudpipe.app/  # (if test site still exists)
```

---

## Task 15: Publish CLI to npm

- [ ] **Step 1: Test CLI locally**

```bash
cd cloudpipe-cli
node bin/cli.js help
node bin/cli.js login   # enter token + server URL
```

- [ ] **Step 2: Test deploy from a real project**

```bash
cd /some/vite-project
node /path/to/cloudpipe-cli/bin/cli.js up --name test-vite
```

- [ ] **Step 3: Publish to npm**

```bash
cd cloudpipe-cli
npm publish
```

- [ ] **Step 4: Test via npx**

```bash
npx cloudpipe-cli help
npx cloudpipe-cli up
```
