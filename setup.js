#!/usr/bin/env node
/**
 * CloudPipe Remote Setup
 *
 * 從已運行的 CloudPipe 主機拉設定，自動建立 config.json + tunnel credentials。
 *
 * 用法：node setup.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const CONFIG_PATH = path.join(__dirname, 'config.json');

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function stepOk(msg) {
  console.log(`  ${msg}`);
}

function stepFail(msg) {
  console.error(`  ${msg}`);
}

/**
 * Generate cloudflared.yml from scratch using bundle data.
 */
function generateCloudflaredYml(bundle, credentialsFile) {
  const lines = [];
  lines.push(`tunnel: ${bundle.tunnelId}`);
  lines.push(`credentials-file: ${credentialsFile}`);
  lines.push('');
  lines.push('ingress:');

  const domain = bundle.domain || 'localhost';
  const subdomain = bundle.subdomain || 'epi';

  // Main CloudPipe hostname
  lines.push(`  - hostname: "${subdomain}.${domain}"`);
  lines.push(`    service: http://localhost:${bundle.port || 8787}`);

  // Each project → {id}.{domain} + customDomains
  const projects = bundle.projects || [];
  for (const proj of projects) {
    if (!proj.port) continue;

    lines.push(`  - hostname: "${proj.id}.${domain}"`);
    lines.push(`    service: http://localhost:${proj.port}`);

    if (Array.isArray(proj.customDomains)) {
      for (const cd of proj.customDomains) {
        lines.push(`  - hostname: "${cd}"`);
        lines.push(`    service: http://localhost:${proj.port}`);
      }
    }
  }

  // Wildcard → CloudPipe core
  lines.push(`  - hostname: "*.${domain}"`);
  lines.push(`    service: http://localhost:${bundle.port || 8787}`);

  // Fallback
  lines.push('  - service: http_status:404');
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n  CloudPipe Remote Setup');
  console.log('  =====================\n');

  // ──────────────────────────────────────
  // [1/7] Login
  // ──────────────────────────────────────
  const serverUrl = (await ask(rl, '  Primary URL (e.g. https://epi.yourdomain.com): ')).trim().replace(/\/+$/, '');
  if (!serverUrl) {
    stepFail('[ERROR] URL is required');
    rl.close();
    process.exit(1);
  }
  if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
    stepFail('[ERROR] URL must start with http:// or https://');
    rl.close();
    process.exit(1);
  }

  const password = (await ask(rl, '  Admin password: ')).trim();

  console.log('');
  let token;
  try {
    const loginRes = await fetch(`${serverUrl}/api/_admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.token) {
      stepFail('[1/7] Login...               FAIL');
      stepFail(`      ${loginData.error || 'Wrong password'}`);
      rl.close();
      process.exit(1);
    }
    token = loginData.token;
    stepOk('[1/7] Login...               OK');
  } catch (err) {
    stepFail('[1/7] Login...               FAIL');
    stepFail(`      ${err.message}`);
    rl.close();
    process.exit(1);
  }

  // ──────────────────────────────────────
  // [2/7] Download config bundle
  // ──────────────────────────────────────
  let bundle;
  try {
    const bundleRes = await fetch(`${serverUrl}/api/_admin/setup-bundle`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    bundle = await bundleRes.json();
    if (bundle.error) {
      stepFail('[2/7] Download config...     FAIL');
      stepFail(`      ${bundle.error}`);
      rl.close();
      process.exit(1);
    }
    stepOk('[2/7] Download config...     OK');
  } catch (err) {
    stepFail('[2/7] Download config...     FAIL');
    stepFail(`      ${err.message}`);
    rl.close();
    process.exit(1);
  }

  // ──────────────────────────────────────
  // [3/7] Install cloudflared
  // ──────────────────────────────────────
  const { execSync: execCmd } = require('child_process');
  let cfPath = 'cloudflared';
  const candidates = [
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    path.join(process.env.USERPROFILE || '', 'cloudflared.exe'),
    path.join(process.env.USERPROFILE || '', '.cloudflared', 'cloudflared.exe'),
  ];

  function findCloudflared() {
    try {
      const cmd = process.platform === 'win32' ? 'where cloudflared' : 'which cloudflared';
      return execCmd(cmd, { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim().split('\n')[0].trim();
    } catch {
      return candidates.find(p => fs.existsSync(p)) || null;
    }
  }

  let found = findCloudflared();
  if (!found) {
    console.log('  [3/7] Install cloudflared... (downloading)');
    try {
      if (process.platform === 'win32') {
        execCmd('winget install cloudflare.cloudflared --accept-source-agreements --accept-package-agreements', {
          stdio: 'inherit',
          windowsHide: true,
          timeout: 120000,
        });
      } else {
        execCmd('curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared', {
          stdio: 'inherit',
          timeout: 120000,
        });
      }
      found = findCloudflared();
    } catch (e) {
      stepFail(`  [3/7] Install cloudflared... FAIL (${e.message})`);
    }
  }

  if (found) {
    cfPath = found;
    stepOk(`[3/7] Install cloudflared... OK (${cfPath})`);
  } else {
    stepFail('[3/7] Install cloudflared... FAIL');
    stepFail('      Please install manually and re-run setup');
    rl.close();
    process.exit(1);
  }

  // ──────────────────────────────────────
  // [4/7] Tunnel credentials
  // ──────────────────────────────────────
  let credentialsFile = '';
  if (bundle.tunnelCredentials && bundle.tunnelId) {
    const cfDir = path.join(process.env.USERPROFILE || process.env.HOME || os.homedir(), '.cloudflared');
    if (!fs.existsSync(cfDir)) {
      fs.mkdirSync(cfDir, { recursive: true });
    }
    credentialsFile = path.join(cfDir, `${bundle.tunnelId}.json`);
    fs.writeFileSync(credentialsFile, JSON.stringify(bundle.tunnelCredentials, null, 2));
    stepOk(`[4/7] Tunnel credentials...  OK (${credentialsFile})`);
  } else {
    stepOk('[4/7] Tunnel credentials...  SKIP (no tunnel configured)');
  }

  // ──────────────────────────────────────
  // [5/7] config.json (with machineId, redis, telegramProxy)
  // ──────────────────────────────────────
  const machineId = `${os.hostname().toLowerCase()}-${Date.now().toString(36).slice(-4)}`;

  const telegramConfig = {
    ...(bundle.telegram || { enabled: false, botToken: '', chatId: '' }),
    polling: false,
  };

  const config = {
    machineId,
    domain: bundle.domain,
    port: bundle.port,
    subdomain: bundle.subdomain,
    adminPassword: bundle.adminPassword,
    jwtSecret: bundle.jwtSecret,
    serviceToken: bundle.serviceToken || '',
    redis: bundle.redis || { url: '' },
    telegramProxy: bundle.telegramProxy || '',
    supabase: { url: '', anonKey: '', serviceRoleKey: '', logRequests: false },
    cloudflared: {
      path: cfPath,
      tunnelId: bundle.tunnelId,
      credentialsFile,
    },
    telegram: telegramConfig,
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  stepOk(`[5/7] config.json...         OK (machineId: ${machineId})`);

  // ──────────────────────────────────────
  // [6/7] cloudflared.yml (generated from scratch)
  // ──────────────────────────────────────
  if (bundle.tunnelId) {
    const ymlContent = generateCloudflaredYml(bundle, credentialsFile);
    const ymlPath = path.join(__dirname, 'cloudflared.yml');
    fs.writeFileSync(ymlPath, ymlContent);

    const ingressCount = (ymlContent.match(/- hostname:/g) || []).length + 1; // +1 for fallback
    stepOk(`[6/7] cloudflared.yml...     OK (${ingressCount} ingress rules)`);
  } else {
    stepOk('[6/7] cloudflared.yml...     SKIP (no tunnel configured)');
  }

  // ──────────────────────────────────────
  // [7/7] Sync projects.json
  // ──────────────────────────────────────
  if (bundle.projects && bundle.projects.length > 0) {
    const deployDir = path.join(__dirname, 'data', 'deploy');
    if (!fs.existsSync(deployDir)) {
      fs.mkdirSync(deployDir, { recursive: true });
    }
    const projectsPath = path.join(deployDir, 'projects.json');
    fs.writeFileSync(projectsPath, JSON.stringify({ projects: bundle.projects }, null, 2));
    stepOk(`[7/7] Sync projects.json...  OK (${bundle.projects.length} projects)`);
  } else {
    stepOk('[7/7] Sync projects.json...  SKIP (no projects)');
  }

  console.log('');

  // ──────────────────────────────────────
  // Deploy all projects?
  // ──────────────────────────────────────
  if (bundle.projects && bundle.projects.length > 0) {
    const deployAnswer = (await ask(rl, '  Deploy all projects? (Y/n): ')).trim().toLowerCase();
    if (deployAnswer !== 'n' && deployAnswer !== 'no') {
      console.log('');
      try {
        execCmd('node scripts/deploy-all.js', {
          cwd: __dirname,
          stdio: 'inherit',
          windowsHide: true,
        });
      } catch (e) {
        console.error('  Deploy errors:', e.message);
      }
    }
  }

  // ──────────────────────────────────────
  // Pull .env files?
  // ──────────────────────────────────────
  const envAnswer = (await ask(rl, '  Pull .env files from primary? (Y/n): ')).trim().toLowerCase();
  if (envAnswer !== 'n' && envAnswer !== 'no') {
    try {
      const envRes = await fetch(`${serverUrl}/api/_admin/env-bundle/direct`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const envData = await envRes.json();

      if (envData.error) {
        stepFail(`  .env pull failed: ${envData.error}`);
      } else if (envData.envBundle) {
        const entries = Object.entries(envData.envBundle);
        let written = 0;
        for (const [projectId, envContent] of entries) {
          const envDir = path.join(__dirname, 'projects', projectId);
          if (!fs.existsSync(envDir)) {
            fs.mkdirSync(envDir, { recursive: true });
          }
          fs.writeFileSync(path.join(envDir, '.env'), envContent);
          written++;
        }
        stepOk(`.env files pulled: ${written} project(s)`);
      } else {
        stepOk('No .env files on primary');
      }
    } catch (err) {
      stepFail(`.env pull failed: ${err.message}`);
    }
  }

  const startCmd = process.platform === 'win32' ? 'start.bat' : 'bash start.sh';
  console.log('\n  ============================');
  console.log('  Setup complete!');
  console.log(`  Run:  ${startCmd}`);
  console.log('  ============================\n');

  rl.close();
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
