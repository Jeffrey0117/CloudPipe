#!/usr/bin/env node
/**
 * Deploy All Projects (Parallel)
 *
 * Reads projects.json and deploys all projects with concurrency control.
 * Skips projects already online in PM2.
 *
 * Usage:
 *   node scripts/deploy-all.js              # parallel (default, concurrency=3)
 *   node scripts/deploy-all.js --seq        # sequential (old behavior)
 *   node scripts/deploy-all.js --concurrency=5
 */

const path = require('path');
const { execSync } = require('child_process');
const deploy = require('../src/core/deploy');

// ── Parse CLI flags ──
const args = process.argv.slice(2);
const sequential = args.includes('--seq');
const concurrencyFlag = args.find(a => a.startsWith('--concurrency='));
const CONCURRENCY = sequential ? 1 : (concurrencyFlag ? parseInt(concurrencyFlag.split('=')[1], 10) : 3);

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

/**
 * Run async tasks with concurrency limit
 */
async function runWithConcurrency(tasks, concurrency) {
  const results = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      results[i] = await tasks[i]();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

async function main() {
  const projects = deploy.getAllProjects();

  if (projects.length === 0) {
    console.log('[deploy-all] No projects found in projects.json');
    return;
  }

  console.log(`[deploy-all] Found ${projects.length} projects (concurrency: ${CONCURRENCY})`);

  const onlineNames = getPm2OnlineNames();

  const toDeploy = [];
  let skipped = 0;

  for (const p of projects) {
    const processName = p.pm2Name || p.id;
    if (onlineNames.has(processName)) {
      console.log(`  skip ${p.id} (already online)`);
      skipped++;
    } else {
      toDeploy.push(p);
    }
  }

  if (toDeploy.length === 0) {
    console.log(`[deploy-all] All projects already online (${skipped} skipped)`);
    return;
  }

  console.log(`[deploy-all] Deploying ${toDeploy.length} projects, skipping ${skipped}...`);
  console.log();

  let deployed = 0;
  let failed = 0;
  const startTime = Date.now();

  const tasks = toDeploy.map((p, idx) => async () => {
    const label = `[${idx + 1}/${toDeploy.length}]`;
    console.log(`${label} deploying ${p.id}...`);
    try {
      const result = await deploy.deploy(p.id);
      if (result.status === 'success') {
        console.log(`${label} ${p.id} OK (${result.duration}ms)`);
        deployed++;
        return { id: p.id, status: 'success' };
      } else {
        console.error(`${label} ${p.id} FAILED: ${result.error || 'deploy failed'}`);
        failed++;
        return { id: p.id, status: 'failed', error: result.error };
      }
    } catch (e) {
      console.error(`${label} ${p.id} ERROR: ${e.message}`);
      failed++;
      return { id: p.id, status: 'error', error: e.message };
    }
  });

  await runWithConcurrency(tasks, CONCURRENCY);

  // Save PM2 process list
  try {
    execSync('pm2 save', { stdio: 'inherit', windowsHide: true });
  } catch {
    console.error('[deploy-all] pm2 save failed');
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[deploy-all] Done in ${totalTime}s: ${deployed} deployed, ${skipped} skipped, ${failed} failed`);
}

main().catch(err => {
  console.error('[deploy-all] Fatal error:', err);
  process.exit(1);
});
