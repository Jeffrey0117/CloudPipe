#!/usr/bin/env node
/**
 * Deploy All Projects
 *
 * 讀取 projects.json，逐一部署所有專案。
 * 跳過已經在 PM2 中 online 的專案。
 *
 * 用法：node scripts/deploy-all.js
 */

const path = require('path');
const { execSync } = require('child_process');
const deploy = require('../src/core/deploy');

function getPm2OnlineNames() {
  try {
    const output = execSync('pm2 jlist', { windowsHide: true }).toString();
    const processes = JSON.parse(output);
    return new Set(
      processes
        .filter(proc => proc.pm2_env?.status === 'online')
        .map(proc => proc.name)
    );
  } catch {
    return new Set();
  }
}

async function main() {
  const projects = deploy.getAllProjects();

  if (projects.length === 0) {
    console.log('[deploy-all] No projects found in projects.json');
    return;
  }

  console.log(`[deploy-all] Found ${projects.length} projects`);

  const onlineNames = getPm2OnlineNames();

  let deployed = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of projects) {
    const processName = p.pm2Name || p.id;
    if (onlineNames.has(processName)) {
      console.log(`[${projects.indexOf(p) + 1}/${projects.length}] skip ${p.id} (already online)`);
      skipped++;
      continue;
    }

    console.log(`[${projects.indexOf(p) + 1}/${projects.length}] deploy ${p.id}...`);
    try {
      const result = await deploy.deploy(p.id);
      if (result.status === 'success') {
        deployed++;
      } else {
        console.error(`[fail] ${p.id}: ${result.error || 'deploy failed'}`);
        failed++;
      }
    } catch (e) {
      console.error(`[fail] ${p.id}: ${e.message}`);
      failed++;
    }
  }

  // Save PM2 process list
  try {
    execSync('pm2 save', { stdio: 'inherit', windowsHide: true });
  } catch {
    console.error('[deploy-all] pm2 save failed');
  }

  console.log(`\n[deploy-all] Done: ${deployed} deployed, ${skipped} skipped, ${failed} failed`);
}

main().catch(err => {
  console.error('[deploy-all] Fatal error:', err);
  process.exit(1);
});
