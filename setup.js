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
const readline = require('readline');

const CONFIG_PATH = path.join(__dirname, 'config.json');

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n  CloudPipe Remote Setup');
  console.log('  =====================\n');

  // 1. 問主機網址
  const serverUrl = (await ask(rl, '主機 Admin URL (例如 https://epi.yourdomain.com): ')).trim().replace(/\/+$/, '');
  if (!serverUrl) {
    console.error('需要提供主機 URL');
    rl.close();
    process.exit(1);
  }

  // 2. 問密碼
  const password = (await ask(rl, 'Admin 密碼: ')).trim();

  // 3. 登入取 token
  console.log('\n  登入中...');
  let token;
  try {
    const loginRes = await fetch(`${serverUrl}/api/_admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const loginData = await loginRes.json();
    if (!loginData.success || !loginData.token) {
      console.error('  登入失敗:', loginData.error || '密碼錯誤');
      rl.close();
      process.exit(1);
    }
    token = loginData.token;
    console.log('  登入成功!');
  } catch (err) {
    console.error('  連線失敗:', err.message);
    rl.close();
    process.exit(1);
  }

  // 4. 拉 setup bundle
  console.log('  下載設定...');
  let bundle;
  try {
    const bundleRes = await fetch(`${serverUrl}/api/_admin/setup-bundle`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    bundle = await bundleRes.json();
    if (bundle.error) {
      console.error('  下載失敗:', bundle.error);
      rl.close();
      process.exit(1);
    }
    console.log('  設定已下載!');
  } catch (err) {
    console.error('  下載失敗:', err.message);
    rl.close();
    process.exit(1);
  }

  // 5. 自動偵測 cloudflared 路徑
  const { execSync: execCmd } = require('child_process');
  let cfPath = 'cloudflared';
  const candidates = [
    'C:\\Program Files\\cloudflared\\cloudflared.exe',
    'C:\\Program Files (x86)\\cloudflared\\cloudflared.exe',
    path.join(process.env.USERPROFILE || '', 'cloudflared.exe'),
    path.join(process.env.USERPROFILE || '', '.cloudflared', 'cloudflared.exe'),
  ];

  // 先用 where（Windows）或 which（Linux/Mac）找 PATH 裡的
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
    // 自動安裝
    console.log('  cloudflared not found, installing...');
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
      // 裝完重新偵測
      found = findCloudflared();
    } catch (e) {
      console.error('  auto-install failed:', e.message);
    }
  }

  if (found) {
    cfPath = found;
    console.log('  cloudflared: ' + cfPath);
  } else {
    console.error('  cloudflared install failed, please install manually and re-run setup');
    rl.close();
    process.exit(1);
  }

  // 6. 建立 credentials file
  let credentialsFile = '';
  if (bundle.tunnelCredentials && bundle.tunnelId) {
    const cfDir = path.join(process.env.USERPROFILE || process.env.HOME, '.cloudflared');
    if (!fs.existsSync(cfDir)) {
      fs.mkdirSync(cfDir, { recursive: true });
    }
    credentialsFile = path.join(cfDir, `${bundle.tunnelId}.json`);
    fs.writeFileSync(credentialsFile, JSON.stringify(bundle.tunnelCredentials, null, 2));
    console.log(`\n  Tunnel credentials 已寫入: ${credentialsFile}`);
  }

  // 7. 建立 config.json（telegram polling=false for replica）
  const telegramConfig = {
    ...(bundle.telegram || { enabled: false, botToken: '', chatId: '' }),
    polling: false,  // replica 不做 polling，僅發通知
  };

  const config = {
    domain: bundle.domain,
    port: bundle.port,
    subdomain: bundle.subdomain,
    adminPassword: bundle.adminPassword,
    jwtSecret: bundle.jwtSecret,
    serviceToken: bundle.serviceToken || '',
    supabase: { url: '', anonKey: '', serviceRoleKey: '', logRequests: false },
    cloudflared: {
      path: cfPath,
      tunnelId: bundle.tunnelId,
      credentialsFile,
    },
    telegram: telegramConfig,
  };

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log(`  config.json 已建立!`);

  // 8. 複製 cloudflared.yml（替換 credentials-file 路徑）
  const ymlSrc = path.join(__dirname, 'cloudflared.yml');
  if (fs.existsSync(ymlSrc)) {
    let yml = fs.readFileSync(ymlSrc, 'utf8');
    // 替換 tunnel ID 和 credentials-file
    yml = yml.replace(/tunnel:\s*.+/, `tunnel: ${bundle.tunnelId}`);
    yml = yml.replace(/credentials-file:\s*.+/, `credentials-file: ${credentialsFile}`);
    fs.writeFileSync(ymlSrc, yml);
    console.log('  cloudflared.yml 已更新!');
  }

  // 9. 儲存 projects.json（從主機同步專案清單）
  if (bundle.projects && bundle.projects.length > 0) {
    const deployDir = path.join(__dirname, 'data', 'deploy');
    if (!fs.existsSync(deployDir)) {
      fs.mkdirSync(deployDir, { recursive: true });
    }
    const projectsPath = path.join(deployDir, 'projects.json');
    fs.writeFileSync(projectsPath, JSON.stringify({ projects: bundle.projects }, null, 2));
    console.log(`  projects.json 已同步! (${bundle.projects.length} 個專案)`);

    // 10. 詢問是否部署全部專案
    const deployAnswer = (await ask(rl, '\n  要現在部署全部專案嗎？(Y/n): ')).trim().toLowerCase();
    if (deployAnswer !== 'n' && deployAnswer !== 'no') {
      console.log('\n  開始部署全部專案...\n');
      const { execSync: exec } = require('child_process');
      try {
        exec('node scripts/deploy-all.js', {
          cwd: __dirname,
          stdio: 'inherit',
          windowsHide: true,
        });
      } catch (e) {
        console.error('  部署過程中有錯誤:', e.message);
      }
    }
  }

  console.log('\n  ============================');
  console.log('  設定完成! 啟動方式：');
  console.log('');
  console.log('    start.bat');
  console.log('    # 或');
  console.log('    pm2 start ecosystem.config.js');
  console.log('  ============================\n');

  rl.close();
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
