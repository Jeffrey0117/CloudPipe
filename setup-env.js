#!/usr/bin/env node
/**
 * CloudPipe .env 一鍵設定
 *
 * 用法：
 *   node setup-env.js <token>
 *   node setup-env.js <完整下載URL>
 *
 * 流程：
 *   1. 用 token 從主機下載所有專案的 .env
 *   2. 寫入 projects/<id>/.env
 *   3. 觸發缺少的專案部署
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'config.json');
const PROJECTS_DIR = path.join(ROOT, 'projects');

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

async function main() {
  const arg = process.argv[2];

  if (!arg) {
    console.log('');
    console.log('用法: node setup-env.js <token>');
    console.log('      node setup-env.js <download-url>');
    console.log('');
    console.log('Token 從 A 電腦生成：');
    console.log('  POST /api/_admin/env-bundle/generate (需 JWT)');
    console.log('  或請管理員提供下載連結');
    process.exit(1);
  }

  // 判斷是 token 還是完整 URL
  let downloadUrl;
  if (arg.startsWith('http')) {
    downloadUrl = arg;
  } else {
    // 從 config 組 URL，或用預設
    const config = getConfig();
    const domain = config.domain;
    const subdomain = config.subdomain || 'epi';
    if (!domain) {
      console.error('config.json 沒有 domain，請提供完整 URL');
      process.exit(1);
    }
    downloadUrl = `https://${subdomain}.${domain}/api/_admin/env-bundle/download?token=${arg}`;
  }

  console.log('');
  console.log('========================================');
  console.log('  CloudPipe .env Setup');
  console.log('========================================');
  console.log('');
  console.log(`Downloading from: ${downloadUrl.substring(0, 80)}...`);
  console.log('');

  // 下載
  let data;
  try {
    const res = await fetch(downloadUrl);
    if (!res.ok) {
      const err = await res.text();
      console.error(`Download failed (${res.status}): ${err}`);
      process.exit(1);
    }
    data = await res.json();
  } catch (err) {
    console.error('Download error:', err.message);
    process.exit(1);
  }

  const bundle = data.envBundle;
  if (!bundle || typeof bundle !== 'object') {
    console.error('Invalid response — no envBundle found');
    process.exit(1);
  }

  const projectIds = Object.keys(bundle);
  if (projectIds.length === 0) {
    console.log('No .env files in bundle (all projects might not use .env)');
    process.exit(0);
  }

  console.log(`Found ${projectIds.length} .env file(s):`);
  console.log('');

  // 寫入 .env
  let written = 0;
  let skipped = 0;

  for (const projectId of projectIds) {
    const envContent = bundle[projectId];
    const projectDir = path.join(PROJECTS_DIR, projectId);
    const envPath = path.join(projectDir, '.env');

    // 確保目錄存在
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // 檢查是否已存在
    if (fs.existsSync(envPath)) {
      const existing = fs.readFileSync(envPath, 'utf8');
      if (existing === envContent) {
        console.log(`  [skip] ${projectId}/.env (identical)`);
        skipped++;
        continue;
      }
      // 備份舊的
      const backupPath = envPath + '.backup';
      fs.writeFileSync(backupPath, existing);
      console.log(`  [backup] ${projectId}/.env.backup`);
    }

    fs.writeFileSync(envPath, envContent);
    console.log(`  [write] ${projectId}/.env (${envContent.length} bytes)`);
    written++;
  }

  console.log('');
  console.log(`Done: ${written} written, ${skipped} skipped`);

  // 檢查有沒有專案還沒部署（目錄不存在或沒有 node_modules）
  const deploy = require('./src/core/deploy');
  const projects = deploy.getAllProjects();
  const needDeploy = [];

  for (const p of projects) {
    const dir = path.join(ROOT, p.directory);
    const hasNodeModules = fs.existsSync(path.join(dir, 'node_modules'));
    const hasPkg = fs.existsSync(path.join(dir, 'package.json'));

    if (!hasPkg) {
      needDeploy.push(p.id);
    } else if (!hasNodeModules) {
      needDeploy.push(p.id);
    }
  }

  if (needDeploy.length > 0) {
    console.log('');
    console.log(`Found ${needDeploy.length} project(s) needing deploy:`);
    console.log(`  ${needDeploy.join(', ')}`);
    console.log('');
    console.log('Deploying now...');
    console.log('');

    for (const id of needDeploy) {
      try {
        console.log(`  [deploy] ${id}...`);
        const result = await deploy.deploy(id, { triggeredBy: 'setup-env' });
        if (result.status === 'success') {
          console.log(`  [done]   ${id} (${result.commit || '-'})`);
        } else {
          console.log(`  [fail]   ${id}: ${result.error || 'unknown'}`);
        }
      } catch (err) {
        console.log(`  [error]  ${id}: ${err.message}`);
      }
    }
  }

  console.log('');
  console.log('========================================');
  console.log('  Setup complete!');
  console.log('========================================');
  console.log('');
  console.log('Restart CloudPipe to apply:');
  console.log('  pm2 restart cloudpipe');
  console.log('');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
