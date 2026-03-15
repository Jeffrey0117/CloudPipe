/**
 * 核心路由器
 * 支援兩種模式：
 * 1. epi.isnowfriend.com → Dashboard + services/
 * 2. xxx.isnowfriend.com → apps/xxx/
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const admin = require('./admin');
const gateway = require('./gateway');
const hotloader = require('./hotloader');
const deploy = require('./deploy');
const db = require('./db');
const logger = require('./logger');

// ── Rate limiting (Redis fixed-window) ──

const RATE_LIMIT_GLOBAL = 200   // req/min per IP
const RATE_LIMIT_WRITE = 60     // write req/min per IP

async function checkRateLimit(ip, method) {
  try {
    const redis = require('./redis').getClient()
    if (!redis) return null // no Redis → allow

    const minute = Math.floor(Date.now() / 60000)

    // Global limit
    const globalKey = `rl:${ip}:${minute}`
    const globalCount = await redis.incr(globalKey)
    if (globalCount === 1) await redis.expire(globalKey, 120)

    if (globalCount > RATE_LIMIT_GLOBAL) {
      return { limit: RATE_LIMIT_GLOBAL, remaining: 0, retryAfter: 60 - Math.floor((Date.now() % 60000) / 1000) }
    }

    // Write limit (POST/PUT/DELETE)
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      const writeKey = `rl:w:${ip}:${minute}`
      const writeCount = await redis.incr(writeKey)
      if (writeCount === 1) await redis.expire(writeKey, 120)

      if (writeCount > RATE_LIMIT_WRITE) {
        return { limit: RATE_LIMIT_WRITE, remaining: 0, retryAfter: 60 - Math.floor((Date.now() % 60000) / 1000) }
      }
    }

    return null // allowed
  } catch (err) {
    console.error('[rate-limit] Redis error:', err.message)
    return null // Redis error → allow (graceful fallback)
  }
}

// ── CORS origin whitelist ──

function isAllowedOrigin(origin) {
  if (!origin) return false
  try {
    const { hostname } = new URL(origin)
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true
    if (hostname.endsWith('.isnowfriend.com') || hostname === 'isnowfriend.com') return true
    if (hostname.endsWith('.duk.tw') || hostname === 'duk.tw') return true
    return false
  } catch {
    return false
  }
}

// ── hostname → port resolution (30s TTL cache) ──

let routeCache = new Map();
let routeCacheTime = 0;
const ROUTE_CACHE_TTL = 30000;

// ── Blue-Green deployment: temporary port overrides ──
// During deploy, traffic is routed to a temp port while the canonical
// process restarts. This gives true zero-downtime deployments.
const portOverrides = new Map(); // projectId → tempPort

function setPortOverride(projectId, tempPort) {
  portOverrides.set(projectId, tempPort);
}

function clearPortOverride(projectId) {
  portOverrides.delete(projectId);
}

/** Force cache rebuild on next request (call after project port changes) */
function invalidateRouteCache() {
  routeCacheTime = 0;
}

function buildRouteCache(domain) {
  const cache = new Map();
  const projects = db.getAllProjects();

  for (const p of projects) {
    if (!p.port) continue;
    cache.set(`${p.id}.${domain}`, p.port);
    for (const cd of (p.customDomains || [])) {
      cache.set(cd, p.port);
    }
  }
  return cache;
}

function resolveHostnameToPort(hostname, domain) {
  if (Date.now() - routeCacheTime > ROUTE_CACHE_TTL) {
    routeCache = buildRouteCache(domain);
    routeCacheTime = Date.now();
  }

  // Blue-Green override: projectId is the subdomain part
  const sub = hostname.endsWith('.' + domain) ? hostname.slice(0, -(domain.length + 1)) : null;
  if (sub && portOverrides.has(sub)) {
    return portOverrides.get(sub);
  }

  // Exact match
  if (routeCache.has(hostname)) return routeCache.get(hostname);

  // Wildcard match (*.duk.tw → duk.tw's port)
  const dotIdx = hostname.indexOf('.');
  if (dotIdx > 0) {
    const wildcard = '*' + hostname.slice(dotIdx);
    if (routeCache.has(wildcard)) return routeCache.get(wildcard);
  }

  return null;
}

// MIME types
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

const createRouter = function(config) {
  const servicesDir = config.servicesDir;
  const rootDir = path.join(servicesDir, '..');
  const publicDir = path.join(rootDir, 'public');
  const appsDir = path.join(rootDir, 'apps');
  const mainSubdomain = config.subdomain || 'epi';

  // 確保 apps 目錄存在
  if (!fs.existsSync(appsDir)) {
    fs.mkdirSync(appsDir, { recursive: true });
  }

  // 載入 services/（使用 hotloader）
  hotloader.loadAllServices(servicesDir);

  return http.createServer(async (req, res) => {
    try {

    // CORS (origin whitelist)
    const origin = req.headers.origin
    if (isAllowedOrigin(origin)) {
      res.setHeader('access-control-allow-origin', origin)
      res.setHeader('access-control-allow-credentials', 'true')
    }
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader('access-control-allow-headers', 'content-type, authorization')
    res.setHeader('vary', 'Origin')

    // Security headers
    res.setHeader('x-content-type-options', 'nosniff')
    res.setHeader('x-frame-options', 'SAMEORIGIN')
    res.setHeader('referrer-policy', 'strict-origin-when-cross-origin')

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    // 解析 hostname
    const host = req.headers.host || '';
    const hostname = host.split(':')[0];
    const subdomain = hostname.split('.')[0];
    const domain = config.domain || 'isnowfriend.com';

    // Request logging
    const startTime = Date.now()
    const clientIp = logger.getClientIp(req)

    res.on('finish', () => {
      logger.log({
        ts: new Date().toISOString(),
        ip: clientIp,
        method: req.method,
        url: req.url,
        status: res.statusCode,
        ms: Date.now() - startTime,
        sub: subdomain,
        host: hostname
      })
    })

    // Rate limiting (skip OPTIONS, health checks, and LurlHub capture)
    const urlPath0 = req.url.split('?')[0]
    if (req.method !== 'OPTIONS' && urlPath0 !== '/health' && !urlPath0.endsWith('/api/health') && !urlPath0.startsWith('/lurl/')) {
      const blocked = await checkRateLimit(clientIp, req.method)
      if (blocked) {
        res.writeHead(429, {
          'content-type': 'application/json',
          'retry-after': String(blocked.retryAfter)
        })
        return res.end(JSON.stringify({ error: 'Too many requests', retryAfter: blocked.retryAfter }))
      }
    }

    // ========== 主域名 (epi.isnowfriend.com) ==========
    if (subdomain === mainSubdomain || hostname === 'localhost') {
      return handleMainDomain(req, res, { publicDir });
    }

    // ========== hostname → port 全域解析 (涵蓋子域名 + 自訂域名) ==========
    const port = resolveHostnameToPort(hostname, domain);
    if (port) {
      return proxyToPort(req, res, port);
    }

    // ========== Fallback: apps/ 目錄靜態檔案 ==========
    return handleAppDomain(req, res, { subdomain, appsDir });

    } catch (err) {
      console.error('[router] Unhandled error:', err)
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'Internal server error' }))
      }
    }
  });

  // 處理主域名
  function handleMainDomain(req, res, { publicDir }) {
    const routes = hotloader.getRoutes();
    const urlPath = req.url.split('?')[0];

    // /_admin → admin.html
    if (urlPath === '/_admin' || urlPath === '/_admin/') {
      const adminFile = path.join(publicDir, 'admin.html');
      if (fs.existsSync(adminFile)) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(fs.readFileSync(adminFile));
      }
    }

    // /_admin/lurlhub → redirect to /lurl/admin (獨立專案)
    if (urlPath === '/_admin/lurlhub' || urlPath === '/_admin/lurlhub/') {
      res.writeHead(302, { location: '/lurl/admin' });
      return res.end();
    }

    // /_admin/xxx → admin-xxx.html (服務後台頁面)
    if (urlPath.startsWith('/_admin/')) {
      const serviceName = urlPath.replace('/_admin/', '').replace(/\/$/, '');
      const adminFile = path.join(publicDir, `admin-${serviceName}.html`);
      if (fs.existsSync(adminFile)) {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        return res.end(fs.readFileSync(adminFile));
      }
    }

    // /_example.js → services/_example.js (範例檔案)
    if (urlPath === '/_example.js') {
      const exampleFile = path.join(servicesDir, '_example.js');
      if (fs.existsSync(exampleFile)) {
        res.writeHead(200, { 'content-type': 'application/javascript; charset=utf-8' });
        return res.end(fs.readFileSync(exampleFile));
      }
    }

    // 靜態檔案 (public/)
    let staticFile = urlPath === '/' ? '/index.html' : urlPath;
    let filePath = path.join(publicDir, staticFile);
    let ext = path.extname(filePath);

    // 目錄請求：嘗試 index.html
    if (!ext && fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      staticFile = path.join(staticFile, 'index.html');
      filePath = path.join(publicDir, staticFile);
      ext = '.html';
    }

    if (ext && MIME[ext] && fs.existsSync(filePath)) {
      res.writeHead(200, { 'content-type': MIME[ext] });
      return res.end(fs.readFileSync(filePath));
    }

    // Gateway API
    if (gateway.match(req)) {
      return gateway.handle(req, res);
    }

    // Admin API
    if (admin.match(req)) {
      return admin.handle(req, res);
    }

    // Health check
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'ok',
        routes: routes.map(r => r.name),
        timestamp: new Date().toISOString()
      }));
    }

    // LurlHub path proxy (獨立專案，port 4017)
    if (urlPath.startsWith('/lurl/') || urlPath === '/lurl') {
      return proxyToPort(req, res, 4017);
    }

    // Services 路由
    for (const route of routes) {
      if (typeof route.handler === 'function') {
        const handled = route.handler(req, res);
        if (handled) return;
      } else if (route.handler.match && route.handler.handle) {
        if (route.handler.match(req)) {
          return route.handler.handle(req, res);
        }
      }
    }

    // 404
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  // 處理 App 子域名
  function handleAppDomain(req, res, { subdomain, appsDir }) {
    // 先檢查是否有 Git 部署專案（有 port 配置則代理）
    const project = deploy.getProject(subdomain);
    if (project && project.port) {
      return proxyToPort(req, res, project.port);
    }

    // 先檢查 apps/ 目錄
    let appDir = path.join(appsDir, subdomain);

    // 如果 apps/ 沒有，檢查專案目錄（Git 部署）
    if (!fs.existsSync(appDir) && project && project.directory) {
      const projDir = path.resolve(__dirname, '../..', project.directory);
      if (fs.existsSync(projDir)) {
        appDir = projDir;
      }
    }

    // 檢查 app 是否存在
    if (!fs.existsSync(appDir)) {
      res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<h1>App not found: ${subdomain}</h1>`);
    }

    const urlPath = req.url.split('?')[0];

    // 檢查是否有 server.js (後端應用)
    const serverPath = path.join(appDir, 'server.js');
    if (fs.existsSync(serverPath)) {
      try {
        const appHandler = require(serverPath);
        if (typeof appHandler === 'function') {
          return appHandler(req, res);
        } else if (appHandler.handle) {
          return appHandler.handle(req, res);
        }
      } catch (err) {
        res.writeHead(500, { 'content-type': 'application/json' });
        return res.end(JSON.stringify({ error: err.message }));
      }
    }

    // 靜態檔案服務 (public/ → dist/ → 根目錄)
    const appPublicDir = fs.existsSync(path.join(appDir, 'public'))
      ? path.join(appDir, 'public')
      : fs.existsSync(path.join(appDir, 'dist'))
        ? path.join(appDir, 'dist')
        : appDir;

    const staticFile = urlPath === '/' ? '/index.html' : urlPath;
    const filePath = path.join(appPublicDir, staticFile);
    const ext = path.extname(filePath);

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const contentType = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'content-type': contentType });
      return res.end(fs.readFileSync(filePath));
    }

    // SPA fallback - 嘗試返回 index.html
    const indexPath = path.join(appPublicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(indexPath));
    }

    // 404
    res.writeHead(404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<h1>File not found: ${urlPath}</h1>`);
  }

  // 代理到指定 port
  function proxyToPort(req, res, port) {
    const ip = logger.getClientIp(req)
    const existingXff = req.headers['x-forwarded-for']
    const options = {
      hostname: 'localhost',
      port: port,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        'x-forwarded-for': existingXff ? `${ip}, ${existingXff}` : ip,
        'x-real-ip': ip,
        'x-forwarded-proto': 'https'
      }
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`[proxy] Error proxying to port ${port}:`, err.message);
      res.writeHead(502, { 'content-type': 'text/html; charset=utf-8' });
      res.end(`<h1>Service unavailable</h1><p>無法連接到後端服務 (port ${port})</p>`);
    });

    req.pipe(proxyReq);
  }
};

createRouter.invalidateRouteCache = invalidateRouteCache;
createRouter.setPortOverride = setPortOverride;
createRouter.clearPortOverride = clearPortOverride;
module.exports = createRouter;
