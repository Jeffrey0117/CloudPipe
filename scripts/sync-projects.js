#!/usr/bin/env node

/**
 * Project Sync Script
 *
 * Keeps CloudPipe projects/ and Desktop/code/ in sync with GitHub.
 * For duplicates: git pull --ff-only on both sides.
 * For missing: create junction from Desktop/code/ → cloudpipe/projects/.
 *
 * Usage:
 *   node scripts/sync-projects.js          # dry-run (report only)
 *   node scripts/sync-projects.js --run    # actually sync
 *   node scripts/sync-projects.js --link   # create missing junctions too
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECTS_DIR = path.join(__dirname, '..', 'projects');
const CODE_DIR = path.resolve(PROJECTS_DIR, '..', '..');  // Desktop/code/

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--run') && !args.includes('--link');
const CREATE_LINKS = args.includes('--link');

function gitInfo(dir) {
  try {
    const head = execSync('git rev-parse --short HEAD', { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
    const dirty = execSync('git status --porcelain', { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
    return { head, branch, dirty: dirty ? dirty.split('\n').length : 0, ok: true };
  } catch {
    return { head: '?', branch: '?', dirty: 0, ok: false };
  }
}

function gitPull(dir) {
  try {
    execSync('git fetch --quiet', { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 });
    const result = execSync('git pull --ff-only --quiet', { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'], timeout: 30000 }).toString().trim();
    return { ok: true, msg: result || 'up to date' };
  } catch (err) {
    return { ok: false, msg: err.message.split('\n')[0] };
  }
}

function isJunction(p) {
  try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; }
}

// --- Main ---

const cpProjects = fs.readdirSync(PROJECTS_DIR).filter(e => {
  try { return fs.statSync(path.join(PROJECTS_DIR, e)).isDirectory() && !e.startsWith('.'); }
  catch { return false; }
});

const codeEntries = fs.readdirSync(CODE_DIR).filter(e => {
  try { return fs.statSync(path.join(CODE_DIR, e)).isDirectory() && !e.startsWith('.'); }
  catch { return false; }
});
const codeLowerMap = {};
codeEntries.forEach(e => { codeLowerMap[e.toLowerCase()] = e; });

const synced = [];
const diverged = [];
const linked = [];
const missing = [];
const errors = [];

console.log(DRY_RUN ? '\n[DRY RUN] Add --run to sync, --link to also create junctions\n' : '\n[SYNCING]\n');

for (const p of cpProjects) {
  const match = codeLowerMap[p.toLowerCase()];
  const cpPath = path.join(PROJECTS_DIR, p);
  const codePath = match ? path.join(CODE_DIR, match) : null;

  // Skip junctions (already linked)
  if (codePath && isJunction(codePath)) {
    linked.push(p);
    continue;
  }

  if (!codePath) {
    // No matching directory in Desktop/code/
    if (CREATE_LINKS && !DRY_RUN) {
      try {
        fs.symlinkSync(cpPath, path.join(CODE_DIR, p), 'junction');
        linked.push(p);
        console.log(`  🔗 Created junction: code/${p} → projects/${p}`);
      } catch (err) {
        errors.push({ project: p, msg: err.message });
        console.log(`  ❌ Junction failed: ${p}: ${err.message}`);
      }
    } else {
      missing.push(p);
      console.log(`  ❌ ${p}: no directory in Desktop/code/ (use --link to create junction)`);
    }
    continue;
  }

  // Both exist — compare and sync
  const cpInfo = gitInfo(cpPath);
  const codeInfo = gitInfo(codePath);

  if (cpInfo.head === codeInfo.head) {
    synced.push(p);
    continue;
  }

  // Different commits — try to pull both
  if (DRY_RUN) {
    diverged.push(p);
    console.log(`  ⚠️  ${p}: projects/${p} @ ${cpInfo.head} vs code/${match} @ ${codeInfo.head}`);
    continue;
  }

  console.log(`  ⚠️  ${p}: syncing...`);

  const cpPull = gitPull(cpPath);
  const codePull = gitPull(codePath);

  console.log(`     projects/${p}: ${cpPull.ok ? '✅' : '❌'} ${cpPull.msg}`);
  console.log(`     code/${match}:    ${codePull.ok ? '✅' : '❌'} ${codePull.msg}`);

  // Re-check after pull
  const cpAfter = gitInfo(cpPath);
  const codeAfter = gitInfo(codePath);

  if (cpAfter.head === codeAfter.head) {
    synced.push(p);
    console.log(`     → ✅ Now in sync @ ${cpAfter.head}`);
  } else {
    diverged.push(p);
    console.log(`     → ⚠️  Still different: ${cpAfter.head} vs ${codeAfter.head}`);
    if (cpAfter.branch !== codeAfter.branch) {
      console.log(`     → ⚠️  Different branches: ${cpAfter.branch} vs ${codeAfter.branch}`);
    }
  }
}

// --- Summary ---
console.log('\n' + '='.repeat(50));
console.log(`✅ Synced:   ${synced.length} (${synced.join(', ') || '-'})`);
console.log(`🔗 Linked:   ${linked.length} (${linked.join(', ') || '-'})`);
console.log(`⚠️  Diverged: ${diverged.length} (${diverged.join(', ') || '-'})`);
console.log(`❌ Missing:  ${missing.length} (${missing.join(', ') || '-'})`);
if (errors.length) {
  console.log(`💥 Errors:   ${errors.length} (${errors.map(e => e.project).join(', ')})`);
}
console.log('='.repeat(50) + '\n');
