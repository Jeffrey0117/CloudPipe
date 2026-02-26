/**
 * URL Monitor Service
 * 自動監控所有已部署專案的健康狀態
 *
 * - 每 5 分鐘 HEAD request 所有專案 URL
 * - 連續 2 次失敗 → Telegram DOWN 通知
 * - 恢復 → Telegram UP 通知 + 停機時間
 * - 也支援手動加入額外 URL
 *
 * API:
 *   GET  /monitor/status   — 所有監控目標狀態
 *   POST /monitor/add      — 新增自訂 URL { url }
 *   POST /monitor/remove   — 移除自訂 URL { url }
 *   POST /monitor/check    — 立刻觸發全部檢查
 */

const fs = require('fs');
const path = require('path');
const deploy = require('../src/core/deploy');
const telegram = require('../src/core/telegram');

const CONFIG_PATH = path.join(__dirname, '../config.json');
const DATA_FILE = path.join(__dirname, '../data/monitor.json');
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CHECK_TIMEOUT_MS = 10_000;
const FAILURE_THRESHOLD = 2;

let checkTimer = null;

// --- State ---

// Key: URL → { consecutiveFailures, lastStatus, lastCheckedAt, downSince, latencyMs }
let state = new Map();

// --- Persistence (custom URLs only, projects are auto-discovered) ---

function loadCustomUrls() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw).urls || [];
  } catch {
    return [];
  }
}

function saveCustomUrls(urls) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify({ urls }, null, 2), 'utf8');
}

// --- Build target list: deployed projects + custom URLs ---

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function getAllTargetUrls() {
  const config = getConfig();
  const domain = config.domain || '';
  const urls = [];

  // Auto-discover deployed projects
  try {
    const projects = deploy.getAllProjects();
    for (const p of projects) {
      if (domain && p.id) {
        urls.push(`https://${p.id}.${domain}`);
      }
    }
  } catch {
    // deploy module not ready yet
  }

  // Add custom URLs
  const custom = loadCustomUrls();
  for (const url of custom) {
    if (!urls.includes(url)) urls.push(url);
  }

  return urls;
}

// --- Health check ---

async function checkUrl(url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    return {
      ok: res.status >= 200 && res.status < 400,
      statusCode: res.status,
      latencyMs: Date.now() - start,
    };
  } catch {
    return { ok: false, statusCode: 0, latencyMs: Date.now() - start };
  }
}

function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
}

function getState(url) {
  if (!state.has(url)) {
    state.set(url, {
      consecutiveFailures: 0,
      lastStatus: 'unknown',
      lastCheckedAt: 0,
      downSince: null,
      latencyMs: 0,
    });
  }
  return state.get(url);
}

async function notify(text) {
  const tgConfig = telegram.getConfig();
  if (!tgConfig.enabled || !tgConfig.chatId) return;
  telegram.sendMessage(tgConfig.chatId, text).catch((err) => {
    console.error('[monitor] Telegram notify error:', err.message);
  });
}

async function checkAllTargets() {
  const urls = getAllTargetUrls();
  if (urls.length === 0) return;

  const now = Date.now();

  for (const url of urls) {
    const result = await checkUrl(url);
    const s = getState(url);
    s.lastCheckedAt = now;
    s.latencyMs = result.latencyMs;

    if (result.ok) {
      if (s.lastStatus === 'down' && s.downSince) {
        const downtime = formatDuration(now - s.downSince);
        notify(`✅ <b>[Monitor UP]</b> ${url}\n停機時間: ${downtime}`);
      }
      s.consecutiveFailures = 0;
      s.lastStatus = 'up';
      s.downSince = null;
    } else {
      s.consecutiveFailures++;
      if (s.consecutiveFailures >= FAILURE_THRESHOLD && s.lastStatus !== 'down') {
        s.lastStatus = 'down';
        s.downSince = now;
        notify(
          `❌ <b>[Monitor DOWN]</b> ${url}\n` +
          `HTTP ${result.statusCode || 'timeout'} (${result.latencyMs}ms)\n` +
          `連續失敗: ${s.consecutiveFailures} 次`
        );
      }
    }
  }
}

// --- Lifecycle ---

function startMonitor() {
  if (checkTimer) return;
  console.log('[monitor] Started — checking every 5 minutes');
  // First check after 30s
  setTimeout(() => checkAllTargets().catch(console.error), 30_000);
  checkTimer = setInterval(() => checkAllTargets().catch(console.error), CHECK_INTERVAL_MS);
}

function stopMonitor() {
  if (checkTimer) {
    clearInterval(checkTimer);
    checkTimer = null;
  }
}

// Auto-start when loaded
startMonitor();

// --- HTTP Service ---

module.exports = {
  match(req) {
    return req.url.startsWith('/monitor');
  },

  async handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');

    // GET /monitor/status
    if (pathname === '/monitor/status' && req.method === 'GET') {
      const urls = getAllTargetUrls();
      const targets = urls.map((u) => {
        const s = getState(u);
        return {
          url: u,
          status: s.lastStatus,
          consecutiveFailures: s.consecutiveFailures,
          latencyMs: s.latencyMs,
          lastCheckedAt: s.lastCheckedAt,
          downSince: s.downSince,
        };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ targets, checkedAt: Date.now() }));
      return;
    }

    // POST /monitor/add
    if (pathname === '/monitor/add' && req.method === 'POST') {
      const body = await collectBody(req);
      const parsed = JSON.parse(body);
      const targetUrl = parsed.url;

      if (!targetUrl) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing url' }));
        return;
      }

      try { new URL(targetUrl); } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid URL' }));
        return;
      }

      const custom = loadCustomUrls();
      if (!custom.includes(targetUrl)) {
        custom.push(targetUrl);
        saveCustomUrls(custom);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, url: targetUrl }));
      return;
    }

    // POST /monitor/remove
    if (pathname === '/monitor/remove' && req.method === 'POST') {
      const body = await collectBody(req);
      const parsed = JSON.parse(body);
      const targetUrl = parsed.url;

      const custom = loadCustomUrls();
      const updated = custom.filter((u) => u !== targetUrl);
      saveCustomUrls(updated);
      state.delete(targetUrl);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // POST /monitor/check
    if (pathname === '/monitor/check' && req.method === 'POST') {
      await checkAllTargets();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, checkedAt: Date.now() }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  },

  // Exposed for graceful shutdown
  stop: stopMonitor,
};

// --- Utility ---

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 64 * 1024) { req.destroy(); reject(new Error('Body too large')); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
