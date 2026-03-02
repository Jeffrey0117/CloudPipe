#!/usr/bin/env node

/**
 * CloudPipe Diagnostics
 *
 * Standalone health check — works even if CloudPipe isn't running.
 * Usage:
 *   node diagnose.js          # Full report
 *   node diagnose.js --json   # JSON output
 *   node diagnose.js --fix    # Show fix suggestions
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');

// ── Flags ──────────────────────────────────
const args = process.argv.slice(2);
const JSON_MODE = args.includes('--json');
const FIX_MODE = args.includes('--fix');

// ── Paths ──────────────────────────────────
const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'config.json');
const PROJECTS_PATH = path.join(ROOT, 'data', 'deploy', 'projects.json');
const CF_YML_PATH = path.join(ROOT, 'cloudflared.yml');

// ── Report accumulator ─────────────────────
const report = {
  config: [],
  prerequisites: [],
  redis: [],
  pm2: [],
  health: [],
  tunnel: [],
  projects: [],
};
let errorCount = 0;
let warnCount = 0;

// ── Helpers ────────────────────────────────
function ok(section, msg) {
  report[section].push({ status: 'ok', msg });
}

function err(section, msg, fix) {
  report[section].push({ status: 'error', msg, fix });
  errorCount++;
}

function warn(section, msg, fix) {
  report[section].push({ status: 'warn', msg, fix });
  warnCount++;
}

function info(section, msg) {
  report[section].push({ status: 'info', msg });
}

function execSafe(cmd, opts = {}) {
  try {
    return execSync(cmd, {
      windowsHide: true,
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...opts,
    }).toString().trim();
  } catch {
    return null;
  }
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function httpCheck(port, urlPath = '/health') {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}${urlPath}`, { timeout: 3000 }, (res) => {
      res.resume();
      resolve({ ok: true, status: res.statusCode });
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
  });
}

// ── Section: Config ────────────────────────
function checkConfig() {
  const config = readJsonSafe(CONFIG_PATH);
  if (!config) {
    err('config', 'config.json not found', 'node setup.js');
    return null;
  }
  ok('config', 'config.json exists');

  if (config.machineId) {
    ok('config', `machineId: ${config.machineId}`);
  } else {
    warn('config', 'machineId not set', 'Add machineId to config.json');
  }

  if (config.domain) {
    ok('config', `domain: ${config.domain}`);
  } else {
    warn('config', 'domain not set');
  }

  if (config.redis?.url) {
    ok('config', 'redis.url: configured');
  } else {
    info('config', 'redis.url: not configured (multi-machine disabled)');
  }

  if (config.cloudflared?.tunnelId) {
    ok('config', 'cloudflared.tunnelId: configured');
  } else {
    warn('config', 'cloudflared.tunnelId: not configured', 'node setup.js');
  }

  if (config.cloudflared?.credentialsFile) {
    const credPath = config.cloudflared.credentialsFile;
    if (fs.existsSync(credPath)) {
      ok('config', 'cloudflared.credentialsFile: exists');
    } else {
      err('config', `cloudflared.credentialsFile: not found at ${credPath}`, 'node setup.js');
    }
  }

  return config;
}

// ── Section: Prerequisites ─────────────────
function checkPrerequisites() {
  const nodeVersion = execSafe('node --version');
  if (nodeVersion) {
    ok('prerequisites', `Node.js: ${nodeVersion}`);
  } else {
    err('prerequisites', 'Node.js: not found', 'Install Node.js v20+');
  }

  const gitVersion = execSafe('git --version');
  if (gitVersion) {
    ok('prerequisites', `Git: ${gitVersion.replace('git version ', '')}`);
  } else {
    err('prerequisites', 'Git: not found', 'Install Git');
  }

  const pm2Version = execSafe('pm2 --version');
  if (pm2Version) {
    ok('prerequisites', `PM2: ${pm2Version}`);
  } else {
    err('prerequisites', 'PM2: not found', 'npm install -g pm2');
  }

  if (fs.existsSync(path.join(ROOT, 'node_modules'))) {
    ok('prerequisites', 'node_modules: exists');
  } else {
    err('prerequisites', 'node_modules: missing', 'npm install');
  }

  const python = execSafe('python3 --version') || execSafe('python --version');
  if (python) {
    ok('prerequisites', `Python: ${python.replace('Python ', '')}`);
  } else {
    warn('prerequisites', 'Python: not found (companions may not work)', 'Install python3');
  }
}

// ── Section: Redis ─────────────────────────
async function checkRedis(config) {
  if (!config?.redis?.url) {
    info('redis', 'Skipped (no redis.url in config)');
    return;
  }

  let Redis;
  try {
    Redis = require('ioredis');
  } catch {
    warn('redis', 'ioredis not installed (run npm install)', 'npm install');
    return;
  }

  let redisUrl = config.redis.url;
  if (redisUrl.includes('upstash.io') && redisUrl.startsWith('redis://')) {
    redisUrl = redisUrl.replace('redis://', 'rediss://');
  }

  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    lazyConnect: true,
  });

  try {
    await client.connect();
    ok('redis', 'Connection: OK');

    const machineId = config.machineId || 'unknown';
    const heartbeatKey = `cloudpipe:heartbeat:${machineId}`;
    const ttl = await client.ttl(heartbeatKey);

    if (ttl > 0) {
      ok('redis', `Heartbeat key exists (TTL: ${ttl}s)`);
    } else {
      warn('redis', 'Heartbeat key not found (CloudPipe may not be running)', 'pm2 start ecosystem.config.js');
    }

    const keys = await client.keys('cloudpipe:heartbeat:*');
    const otherMachines = keys
      .map(k => k.replace('cloudpipe:heartbeat:', ''))
      .filter(id => id !== machineId);

    if (otherMachines.length > 0) {
      ok('redis', `Other machines visible: ${otherMachines.join(', ')}`);
    } else {
      info('redis', 'No other machines detected');
    }
  } catch (e) {
    err('redis', `Connection failed: ${e.message}`, 'Check config.json redis.url');
  } finally {
    try { await client.quit(); } catch { /* ignore */ }
  }
}

// ── Section: PM2 ───────────────────────────
function checkPm2(projects) {
  const raw = execSafe('pm2 jlist');
  if (!raw) {
    err('pm2', 'Cannot read PM2 process list', 'pm2 start ecosystem.config.js');
    return {};
  }

  let processes;
  try {
    processes = JSON.parse(raw);
  } catch {
    err('pm2', 'PM2 output is not valid JSON', 'pm2 kill && pm2 start ecosystem.config.js');
    return {};
  }

  const pm2Map = {};
  for (const p of processes) {
    pm2Map[p.name] = p.pm2_env?.status || 'unknown';
  }

  // Check cloudpipe core
  const coreStatus = pm2Map['cloudpipe'];
  if (coreStatus === 'online') {
    ok('pm2', 'cloudpipe: online (port 8787)');
  } else if (coreStatus) {
    err('pm2', `cloudpipe: ${coreStatus}`, 'pm2 restart cloudpipe && pm2 logs cloudpipe');
  } else {
    err('pm2', 'cloudpipe: not in PM2', 'pm2 start ecosystem.config.js');
  }

  // Check each project
  const projectDirs = new Set();
  try {
    const entries = fs.readdirSync(path.join(ROOT, 'projects'));
    for (const e of entries) {
      if (fs.statSync(path.join(ROOT, 'projects', e)).isDirectory()) {
        projectDirs.add(e);
      }
    }
  } catch { /* projects/ may not exist */ }

  for (const proj of projects) {
    const name = proj.pm2Name || proj.id;
    const deployed = projectDirs.has(proj.id);

    if (!deployed) {
      info('pm2', `${name}: not deployed (dir missing)`);
      continue;
    }

    const status = pm2Map[name];
    if (status === 'online') {
      ok('pm2', `${name}: online (port ${proj.port})`);
    } else if (status === 'errored') {
      err('pm2', `${name}: errored`, `pm2 restart ${name} && pm2 logs ${name}`);
    } else if (status === 'stopped') {
      warn('pm2', `${name}: stopped`, `pm2 start ${name}`);
    } else if (status === 'launching') {
      warn('pm2', `${name}: launching (waiting restart)`);
    } else if (status) {
      warn('pm2', `${name}: ${status}`, `pm2 restart ${name}`);
    } else {
      warn('pm2', `${name}: not in PM2 (deployed but not started)`, 'pm2 start ecosystem.config.js');
    }

    // Check companions
    if (Array.isArray(proj.companions)) {
      for (const comp of proj.companions) {
        const compName = `${proj.id}-${comp.name}`;
        const compStatus = pm2Map[compName];
        if (compStatus === 'online') {
          ok('pm2', `  ${compName}: online`);
        } else if (compStatus) {
          warn('pm2', `  ${compName}: ${compStatus}`, `pm2 restart ${compName}`);
        } else {
          info('pm2', `  ${compName}: not in PM2`);
        }
      }
    }
  }

  // Check tunnel
  const tunnelStatus = pm2Map['tunnel'];
  if (tunnelStatus === 'online') {
    ok('pm2', 'tunnel: online');
  } else if (tunnelStatus) {
    warn('pm2', `tunnel: ${tunnelStatus}`, 'pm2 restart tunnel');
  } else {
    info('pm2', 'tunnel: not in PM2');
  }

  return pm2Map;
}

// ── Section: Health Checks ─────────────────
async function checkHealth(projects, pm2Map) {
  // Check CloudPipe core
  const coreResult = await httpCheck(8787);
  if (coreResult.ok) {
    ok('health', `localhost:8787 — ${coreResult.status} OK`);
  } else {
    err('health', 'localhost:8787 — connection refused', 'pm2 logs cloudpipe');
  }

  // Check each online project
  const checks = [];
  for (const proj of projects) {
    const name = proj.pm2Name || proj.id;
    const status = pm2Map[name];
    if (status !== 'online') continue;

    checks.push(
      httpCheck(proj.port, proj.healthEndpoint || '/health').then(result => {
        if (result.ok) {
          ok('health', `localhost:${proj.port} (${name}) — ${result.status}`);
        } else {
          err('health', `localhost:${proj.port} (${name}) — connection refused`, `pm2 logs ${name}`);
        }
      })
    );
  }

  await Promise.all(checks);
}

// ── Section: Tunnel ────────────────────────
function checkTunnel(config) {
  if (fs.existsSync(CF_YML_PATH)) {
    ok('tunnel', 'cloudflared.yml exists');
  } else {
    warn('tunnel', 'cloudflared.yml not found', 'node setup.js');
    return;
  }

  const cfPath = config?.cloudflared?.path || 'cloudflared';
  const tunnelId = config?.cloudflared?.tunnelId;

  // Check if cloudflared is running via PM2 or system
  const pm2Raw = execSafe('pm2 jlist');
  let cfRunning = false;
  if (pm2Raw) {
    try {
      const procs = JSON.parse(pm2Raw);
      cfRunning = procs.some(p => p.name === 'tunnel' && p.pm2_env?.status === 'online');
    } catch { /* ignore */ }
  }

  if (cfRunning) {
    ok('tunnel', 'cloudflared process: running (PM2)');
  } else {
    warn('tunnel', 'cloudflared process: not detected in PM2', 'pm2 start ecosystem.config.js');
  }

  if (!tunnelId) {
    warn('tunnel', 'No tunnelId configured — skipping connector check');
    return;
  }

  // Try to get tunnel info
  const output = execSafe(`"${cfPath}" tunnel info -o json ${tunnelId}`);
  if (!output) {
    warn('tunnel', 'Cannot fetch tunnel info (cloudflared CLI may not be available)');
    return;
  }

  try {
    const data = JSON.parse(output);
    const conns = data.conns || [];

    ok('tunnel', `Tunnel connectors: ${conns.length}`);

    for (const conn of conns) {
      const subConns = conn.conns || [];
      const colos = subConns.map(sc => sc.colo_name).filter(Boolean);
      const originIp = subConns.length > 0 ? (subConns[0].origin_ip || '').replace(/:\d+$/, '') : '';
      const arch = conn.arch || '';
      const coloStr = colos.length > 0 ? ` via ${colos[0]}` : '';
      info('tunnel', `  ${originIp} (${arch})${coloStr}`);
    }

    if (conns.length === 0) {
      err('tunnel', 'Tunnel has 0 connectors — no machines connected', 'Check cloudflared credentials or re-run node setup.js');
    }
  } catch {
    warn('tunnel', 'Failed to parse tunnel info output');
  }
}

// ── Section: Projects ──────────────────────
function checkProjects(projects) {
  ok('projects', `projects.json: ${projects.length} projects registered`);

  let deployedCount = 0;
  const missing = [];
  let envCount = 0;
  let envTotal = 0;

  for (const proj of projects) {
    const projDir = path.join(ROOT, 'projects', proj.id);
    if (fs.existsSync(projDir)) {
      deployedCount++;
      envTotal++;
      if (fs.existsSync(path.join(projDir, '.env'))) {
        envCount++;
      }
    } else {
      missing.push(proj.id);
    }
  }

  ok('projects', `Deployed: ${deployedCount}/${projects.length} (dirs exist)`);

  if (missing.length > 0) {
    warn('projects', `Missing: ${missing.join(', ')}`, 'Deploy via admin UI or git clone');
  }

  if (envTotal > 0) {
    if (envCount === envTotal) {
      ok('projects', `.env files: ${envCount}/${envTotal} synced`);
    } else {
      warn('projects', `.env files: ${envCount}/${envTotal} synced`, '/envtoken on primary → node setup-env.js <url>');
    }
  }
}

// ── Output ─────────────────────────────────
function printReport() {
  const ICONS = { ok: '\u2705', error: '\u274C', warn: '\u26A0\uFE0F', info: '--' };
  const SECTIONS = ['config', 'prerequisites', 'redis', 'pm2', 'health', 'tunnel', 'projects'];
  const TITLES = {
    config: 'Config',
    prerequisites: 'Prerequisites',
    redis: 'Redis',
    pm2: 'PM2 Processes',
    health: 'Health Checks',
    tunnel: 'Cloudflare Tunnel',
    projects: 'Projects',
  };

  console.log('\n=== CloudPipe Diagnostics ===\n');

  for (const section of SECTIONS) {
    const items = report[section];
    if (items.length === 0) continue;

    console.log(`[${TITLES[section]}]`);
    for (const item of items) {
      const icon = ICONS[item.status];
      console.log(`  ${icon} ${item.msg}`);
      if (FIX_MODE && item.fix) {
        console.log(`     \u2192 Fix: ${item.fix}`);
      }
    }
    console.log('');
  }

  console.log('[Summary]');
  if (errorCount === 0 && warnCount === 0) {
    console.log('  \u2705 All checks passed!');
  } else {
    console.log(`  ${errorCount} error(s), ${warnCount} warning(s)`);
    if (!FIX_MODE && errorCount + warnCount > 0) {
      console.log("  Run 'node diagnose.js --fix' for auto-fix suggestions");
    }
  }
  console.log('');
}

function printJson() {
  const output = {
    timestamp: new Date().toISOString(),
    errors: errorCount,
    warnings: warnCount,
    sections: report,
  };
  console.log(JSON.stringify(output, null, 2));
}

// ── Main ───────────────────────────────────
async function main() {
  const config = checkConfig();
  checkPrerequisites();

  // Load projects list
  const projectsData = readJsonSafe(PROJECTS_PATH);
  const projects = projectsData?.projects || [];

  await checkRedis(config);

  const pm2Map = checkPm2(projects);

  await checkHealth(projects, pm2Map);

  checkTunnel(config);
  checkProjects(projects);

  if (JSON_MODE) {
    printJson();
  } else {
    printReport();
  }

  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Diagnostics failed:', e.message);
  process.exit(2);
});
