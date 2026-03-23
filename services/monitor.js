/**
 * URL Monitor Service
 * 自動監控所有已部署專案的健康狀態
 *
 * - 每 5 分鐘 GET request 所有專案（本機直連）
 * - 連續 3 次失敗 → Telegram DOWN 通知 + 自動修復
 * - 恢復 → Telegram UP 通知 + 停機時間
 * - 自動修復：MODULE_NOT_FOUND → npm install, errored → restart
 * - 也支援手動加入額外 URL（走外部）
 *
 * API:
 *   GET  /monitor/status   — 所有監控目標狀態
 *   POST /monitor/add      — 新增自訂 URL { url }
 *   POST /monitor/remove   — 移除自訂 URL { url }
 *   POST /monitor/check    — 立刻觸發全部檢查
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const deploy = require('../src/core/deploy');
const telegram = require('../src/core/telegram');

const CONFIG_PATH = path.join(__dirname, '../config.json');
const DATA_FILE = path.join(__dirname, '../data/monitor.json');
const ROOT_DIR = path.join(__dirname, '..');
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const CHECK_TIMEOUT_MS = 60_000;
const FAILURE_THRESHOLD = 3;
const REPAIR_COOLDOWN_MS = 30 * 60 * 1000; // 30 min cooldown per project

let checkTimer = null;

// --- State ---

// Key: URL → { consecutiveFailures, lastStatus, lastCheckedAt, downSince, latencyMs, statusCode }
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

// --- Build target list ---

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function getAllTargets() {
  const config = getConfig();
  const domain = config.domain || '';
  const targets = [];

  // Auto-discover deployed projects — check localhost directly
  try {
    const projects = deploy.getAllProjects();
    for (const p of projects) {
      if (p.port) {
        const health = p.healthEndpoint || '/';
        targets.push({
          url: `http://localhost:${p.port}${health}`,
          label: domain ? `${p.id}.${domain}` : p.id,
          projectId: p.id,
        });
      }
    }
  } catch {
    // deploy module not ready yet
  }

  // Add custom URLs (external, checked as-is)
  const custom = loadCustomUrls();
  for (const url of custom) {
    if (!targets.find(t => t.url === url)) {
      targets.push({ url, label: url, projectId: null });
    }
  }

  return targets;
}

// --- Health check ---

function isAlive(statusCode) {
  // Any HTTP response means the service is running
  // 401/403 = auth required but alive
  // 404 = no route but alive
  // Only 5xx and connection failures count as down
  return statusCode > 0 && statusCode < 500;
}

async function checkUrl(url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timeout);
    return {
      ok: isAlive(res.status),
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
      statusCode: 0,
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

// --- Auto-repair ---

// Track repair attempts: projectId → { lastAttempt, attempts, lastError }
const repairState = new Map();

function getRepairState(projectId) {
  if (!repairState.has(projectId)) {
    repairState.set(projectId, { lastAttempt: 0, attempts: 0, lastError: null });
  }
  return repairState.get(projectId);
}

function resetRepairState(projectId) {
  if (repairState.has(projectId)) {
    repairState.set(projectId, { lastAttempt: 0, attempts: 0, lastError: null });
  }
}

function pm2Jlist() {
  try {
    const raw = execSync('pm2 jlist', { stdio: 'pipe', windowsHide: true, timeout: 10000 });
    return JSON.parse(raw.toString());
  } catch {
    return [];
  }
}

function readErrorLog(projectId) {
  const logPath = path.join(ROOT_DIR, 'logs', `${projectId}-error.log`);
  try {
    const content = fs.readFileSync(logPath, 'utf8');
    const lines = content.trim().split('\n');
    return lines.slice(-30).join('\n');
  } catch {
    return '';
  }
}

function diagnoseError(errorLog) {
  if (!errorLog) return { type: 'unknown', detail: '' };

  // MODULE_NOT_FOUND → npm install
  const modMatch = errorLog.match(/Cannot find module '([^']+)'/);
  if (modMatch) return { type: 'missing_module', detail: modMatch[1] };

  // EADDRINUSE → port conflict
  if (errorLog.includes('EADDRINUSE')) return { type: 'port_conflict', detail: '' };

  // ENOENT on entry file
  const enoentMatch = errorLog.match(/ENOENT.*?'([^']+)'/);
  if (enoentMatch) return { type: 'missing_file', detail: enoentMatch[1] };

  return { type: 'unknown', detail: '' };
}

async function attemptRepair(projectId) {
  const rs = getRepairState(projectId);
  const now = Date.now();

  // Cooldown check
  if (now - rs.lastAttempt < REPAIR_COOLDOWN_MS) return null;

  // Max 3 repair attempts before giving up (resets when service comes back up)
  if (rs.attempts >= 3) return null;

  const processes = pm2Jlist();
  const proc = processes.find(p => p.name === projectId);
  const pm2Status = proc ? proc.pm2_env.status : 'not_found';

  // Only repair errored or stopped processes (not running ones with bad health endpoint)
  if (pm2Status !== 'errored' && pm2Status !== 'stopped' && pm2Status !== 'not_found') return null;

  const errorLog = readErrorLog(projectId);
  const diagnosis = diagnoseError(errorLog);

  rs.lastAttempt = now;
  rs.attempts++;

  const project = deploy.getProject(projectId);
  if (!project) return null;

  const projectDir = path.resolve(ROOT_DIR, project.directory || `projects/${projectId}`);

  let action = '';
  let success = false;

  try {
    switch (diagnosis.type) {
      case 'missing_module': {
        console.log(`[monitor-repair] ${projectId}: missing module "${diagnosis.detail}", running npm install`);
        action = `npm install (missing: ${diagnosis.detail})`;
        execSync('npm install', { cwd: projectDir, stdio: 'pipe', windowsHide: true, timeout: 120000 });

        // Restart: delete + start from ecosystem to pick up fresh config
        if (pm2Status !== 'not_found') {
          execSync(`pm2 delete ${projectId}`, { stdio: 'pipe', windowsHide: true, timeout: 10000 });
        }
        execSync(`pm2 start ecosystem.config.js --only ${projectId}`, {
          cwd: ROOT_DIR, stdio: 'pipe', windowsHide: true, timeout: 30000
        });
        success = true;
        break;
      }

      case 'not_found':
      case 'missing_file': {
        // Process not in PM2 — try starting it
        if (pm2Status === 'not_found') {
          console.log(`[monitor-repair] ${projectId}: not in PM2, starting from ecosystem`);
          action = 'pm2 start (not in process list)';
          execSync(`pm2 start ecosystem.config.js --only ${projectId}`, {
            cwd: ROOT_DIR, stdio: 'pipe', windowsHide: true, timeout: 30000
          });
          success = true;
        }
        break;
      }

      case 'port_conflict': {
        console.log(`[monitor-repair] ${projectId}: port conflict, skipping auto-repair`);
        action = 'skipped (port conflict)';
        break;
      }

      default: {
        // Unknown error — try simple restart if errored
        if (pm2Status === 'errored') {
          console.log(`[monitor-repair] ${projectId}: unknown error, attempting restart`);
          action = 'pm2 restart (unknown error)';
          execSync(`pm2 delete ${projectId}`, { stdio: 'pipe', windowsHide: true, timeout: 10000 });
          execSync(`pm2 start ecosystem.config.js --only ${projectId}`, {
            cwd: ROOT_DIR, stdio: 'pipe', windowsHide: true, timeout: 30000
          });
          success = true;
        }
        break;
      }
    }
  } catch (err) {
    console.error(`[monitor-repair] ${projectId}: repair failed —`, err.message);
    rs.lastError = err.message;
    return { projectId, action, success: false, error: err.message };
  }

  if (success) {
    console.log(`[monitor-repair] ${projectId}: ✓ ${action}`);
    rs.lastError = null;
  }

  return { projectId, action, success, diagnosis: diagnosis.type };
}

// --- Check all targets ---

async function checkAllTargets() {
  const targets = getAllTargets();
  if (targets.length === 0) return;

  const now = Date.now();

  for (const target of targets) {
    const result = await checkUrl(target.url);
    const s = getState(target.url);
    s.lastCheckedAt = now;
    s.latencyMs = result.latencyMs;
    s.statusCode = result.statusCode;

    if (result.ok) {
      if (s.lastStatus === 'down' && s.downSince) {
        const downtime = formatDuration(now - s.downSince);
        const rs = repairState.get(target.projectId);
        const wasRepaired = rs && rs.attempts > 0;
        notify(
          `✅ <b>[Monitor UP]</b> ${target.label}\n停機時間: ${downtime}` +
          (wasRepaired ? '\n🔧 自動修復成功' : '')
        );
      }
      s.consecutiveFailures = 0;
      s.lastStatus = 'up';
      s.downSince = null;
      if (target.projectId) resetRepairState(target.projectId);
    } else {
      s.consecutiveFailures++;
      if (s.consecutiveFailures >= FAILURE_THRESHOLD && s.lastStatus !== 'down') {
        s.lastStatus = 'down';
        s.downSince = now;

        // Attempt auto-repair for project targets
        let repairMsg = '';
        if (target.projectId) {
          const repairResult = await attemptRepair(target.projectId);
          if (repairResult) {
            repairMsg = repairResult.success
              ? `\n🔧 自動修復: ${repairResult.action}`
              : `\n🔧 修復失敗: ${repairResult.action} — ${repairResult.error || ''}`;
          }
        }

        notify(
          `❌ <b>[Monitor DOWN]</b> ${target.label}\n` +
          `HTTP ${result.statusCode || 'timeout'} (${result.latencyMs}ms)\n` +
          `連續失敗: ${s.consecutiveFailures} 次` +
          repairMsg
        );
      } else if (s.lastStatus === 'down' && target.projectId) {
        // Already notified as down — periodically retry repair
        const rs = getRepairState(target.projectId);
        if (rs.attempts < 3 && now - rs.lastAttempt >= REPAIR_COOLDOWN_MS) {
          const repairResult = await attemptRepair(target.projectId);
          if (repairResult && repairResult.success) {
            notify(`🔧 <b>[Monitor Repair]</b> ${target.label}\n${repairResult.action}\n等待下次檢查確認...`);
          }
        }
      }
    }
  }
}

// --- Lifecycle ---

function startMonitor() {
  if (checkTimer) return;
  console.log('[monitor] Started — checking every 5 minutes, auto-repair enabled');
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
      const targets = getAllTargets();
      const statuses = targets.map((t) => {
        const s = getState(t.url);
        const rs = t.projectId ? repairState.get(t.projectId) : null;
        return {
          label: t.label,
          url: t.url,
          projectId: t.projectId,
          status: s.lastStatus,
          statusCode: s.statusCode,
          consecutiveFailures: s.consecutiveFailures,
          latencyMs: s.latencyMs,
          lastCheckedAt: s.lastCheckedAt,
          downSince: s.downSince,
          repair: rs ? { attempts: rs.attempts, lastAttempt: rs.lastAttempt, lastError: rs.lastError } : null,
        };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ targets: statuses, checkedAt: Date.now() }));
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
