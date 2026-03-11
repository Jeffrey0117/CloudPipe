#!/usr/bin/env node

/**
 * Workhub Initializer
 *
 * Sets up a single canonical directory for all CloudPipe projects.
 * Each project is cloned from GitHub into workhub/, then CloudPipe's
 * projects/ directory gets junctions pointing there.
 *
 * Reads project list from data/deploy/projects.json (not filesystem scan).
 * Reads workhub config from config.json.
 *
 * Usage:
 *   node scripts/init-workhub.js              # dry-run
 *   node scripts/init-workhub.js --run        # clone + junction only
 *   node scripts/init-workhub.js --run --setup # also npm install + build
 *
 * Options:
 *   --code-dir <path>   Also create junctions in this directory
 *                        (e.g., for ClaudeBot's project scanner)
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- Config ---

const ROOT = path.join(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config.json'), 'utf8'));

// Load projects from SQLite (auto-migrates from JSON on first use)
let projectsData;
try {
  const db = require('../src/core/db');
  projectsData = { projects: db.getAllProjects() };
} catch {
  projectsData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'deploy', 'projects.json'), 'utf8'));
}

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--run');
const DO_SETUP = args.includes('--setup');

const codeDirIdx = args.indexOf('--code-dir');
const CODE_DIR = codeDirIdx !== -1 ? path.resolve(args[codeDirIdx + 1]) : null;

const workhubRelative = config.workhub?.dir || 'workhub';
const WORKHUB_DIR = path.isAbsolute(workhubRelative)
  ? workhubRelative
  : path.resolve(ROOT, workhubRelative);

const PROJECTS_DIR = path.join(ROOT, 'projects');

// --- Helpers ---

function safeExec(cmd, cwd, timeoutMs = 60000) {
  try {
    return execSync(cmd, { cwd, stdio: ['pipe', 'pipe', 'pipe'], timeout: timeoutMs }).toString().trim();
  } catch {
    return null;
  }
}

function isJunction(p) {
  try { return fs.lstatSync(p).isSymbolicLink(); } catch { return false; }
}

function exists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}

function makeJunction(target, linkPath, label) {
  try {
    if (isJunction(linkPath)) {
      fs.unlinkSync(linkPath);
    }
    fs.symlinkSync(target, linkPath, 'junction');
    console.log(`  🔗 ${label}`);
    return true;
  } catch (err) {
    console.log(`  ❌ Junction failed (${label}): ${err.message}`);
    return false;
  }
}

function backupAndJunction(target, linkPath, label) {
  if (isJunction(linkPath)) {
    return makeJunction(target, linkPath, label + ' (re-point)');
  }

  if (!exists(linkPath)) {
    return makeJunction(target, linkPath, label + ' (new)');
  }

  // Real directory — backup first
  const bakPath = linkPath + '.bak';
  try {
    if (exists(bakPath)) {
      const bak2 = linkPath + '.bak2';
      if (!exists(bak2)) {
        fs.renameSync(bakPath, bak2);
      }
    }
    fs.renameSync(linkPath, bakPath);
    console.log(`  📦 ${label} → .bak`);
  } catch (err) {
    console.log(`  ❌ Backup failed (${label}): ${err.message}`);
    return false;
  }

  return makeJunction(target, linkPath, label);
}

function copyDirRecursive(src, dst) {
  let count = 0;
  const SKIP = new Set(['node_modules', '.git', '.next', '.cache', 'dist', 'build', '.turbo', '.svelte-kit']);

  try {
    const stat = fs.lstatSync(src);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      if (!exists(dst)) fs.mkdirSync(dst, { recursive: true });
      for (const entry of fs.readdirSync(src)) {
        if (SKIP.has(entry)) continue;
        count += copyDirRecursive(path.join(src, entry), path.join(dst, entry));
      }
    } else if (stat.isFile() && !exists(dst)) {
      const parent = path.dirname(dst);
      if (!exists(parent)) fs.mkdirSync(parent, { recursive: true });
      fs.copyFileSync(src, dst);
      count++;
    }
  } catch {}
  return count;
}

function copyRuntimeFiles(bakDir, targetDir) {
  if (!exists(bakDir)) return 0;

  let copied = 0;

  // 1. Env files and startup scripts
  const envPatterns = ['.env', '.env.local', '.env.production', '.pm2-start.cjs', '.pm2-start.js'];
  try {
    for (const f of fs.readdirSync(bakDir)) {
      if (!envPatterns.some(p => f === p || f.startsWith('.env'))) continue;
      const src = path.join(bakDir, f);
      const dst = path.join(targetDir, f);
      if (fs.statSync(src).isFile() && !exists(dst)) {
        fs.copyFileSync(src, dst);
        console.log(`  📋 Copied ${f}`);
        copied++;
      }
    }
  } catch {}

  // 2. Env files in subdirs (backend/, server/, api/)
  for (const sub of ['backend', 'server', 'api']) {
    const subBak = path.join(bakDir, sub);
    const subTarget = path.join(targetDir, sub);
    if (!exists(subBak) || !exists(subTarget)) continue;
    try {
      for (const f of fs.readdirSync(subBak)) {
        if (!f.startsWith('.env')) continue;
        const src = path.join(subBak, f);
        const dst = path.join(subTarget, f);
        if (fs.statSync(src).isFile() && !exists(dst)) {
          fs.copyFileSync(src, dst);
          console.log(`  📋 Copied ${sub}/${f}`);
          copied++;
        }
      }
    } catch {}
  }

  // 3. Runtime data directories (data/, uploads/, db/, storage/)
  for (const dataDir of ['data', 'uploads', 'db', 'storage']) {
    const srcData = path.join(bakDir, dataDir);
    const dstData = path.join(targetDir, dataDir);
    if (!exists(srcData)) continue;
    const count = copyDirRecursive(srcData, dstData);
    if (count > 0) {
      console.log(`  📋 Copied ${dataDir}/ (${count} files)`);
      copied += count;
    }
  }

  // 4. SQLite/DB files at root
  try {
    for (const f of fs.readdirSync(bakDir)) {
      if (!/\.(db|sqlite|sqlite3)$/i.test(f)) continue;
      const src = path.join(bakDir, f);
      const dst = path.join(targetDir, f);
      if (fs.statSync(src).isFile() && !exists(dst)) {
        fs.copyFileSync(src, dst);
        console.log(`  📋 Copied ${f}`);
        copied++;
      }
    }
  } catch {}

  return copied;
}

function npmInstall(dir) {
  if (!exists(path.join(dir, 'package.json'))) return false;
  if (exists(path.join(dir, 'node_modules'))) return true;

  console.log(`  📦 npm install...`);
  const result = safeExec('npm install', dir, 120000);
  return result !== null || exists(path.join(dir, 'node_modules'));
}

function nextBuild(dir) {
  // Check if it's a Next.js project
  const pkgPath = path.join(dir, 'package.json');
  if (!exists(pkgPath)) return true;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    if (!deps.next) return true; // Not Next.js
  } catch {
    return true;
  }

  if (exists(path.join(dir, '.next'))) return true; // Already built

  console.log(`  🔨 next build...`);
  const result = safeExec('npx next build', dir, 300000);
  return result !== null || exists(path.join(dir, '.next'));
}

// --- Main ---

// Filter: only github/git-url projects with repoUrl
const projects = projectsData.projects.filter(p =>
  p.repoUrl && ['github', 'git-url'].includes(p.deployMethod)
);

console.log(DRY_RUN
  ? '\n[DRY RUN] Add --run to execute, --setup to also install+build\n'
  : DO_SETUP
    ? '\n[EXECUTING + SETUP] Clone, junction, install, build\n'
    : '\n[EXECUTING] Clone + junction only\n'
);

console.log(`Workhub: ${WORKHUB_DIR}`);
console.log(`Projects: ${PROJECTS_DIR}`);
if (CODE_DIR) console.log(`Code dir: ${CODE_DIR}`);
console.log(`Projects to process: ${projects.length}\n`);

const results = { cloned: 0, junctions: 0, installed: 0, built: 0, envCopied: 0, errors: [] };

// Create workhub directory
if (!exists(WORKHUB_DIR)) {
  console.log(`📁 Creating ${WORKHUB_DIR}`);
  if (!DRY_RUN) fs.mkdirSync(WORKHUB_DIR, { recursive: true });
}

for (const project of projects) {
  const { id, repoUrl, branch } = project;
  const whPath = path.join(WORKHUB_DIR, id);
  const cpPath = path.join(PROJECTS_DIR, id);

  console.log(`\n--- ${id} ---`);

  // Step 1: Clone
  if (exists(whPath) && exists(path.join(whPath, '.git'))) {
    console.log(`  ✅ workhub/${id} exists`);
  } else {
    console.log(`  📦 git clone ${repoUrl} → workhub/${id}`);
    if (!DRY_RUN) {
      safeExec(`git clone "${repoUrl}" "${whPath}"`, WORKHUB_DIR, 120000);
      if (!exists(path.join(whPath, '.git'))) {
        console.log(`  ❌ Clone failed`);
        results.errors.push(`${id}: clone`);
        continue;
      }
      // Switch to correct branch if needed
      if (branch) {
        safeExec(`git checkout ${branch}`, whPath);
      }
      results.cloned++;
    }
  }

  // Step 2: Junction in projects/
  if (!DRY_RUN) {
    if (backupAndJunction(whPath, cpPath, `projects/${id} → workhub/${id}`)) {
      results.junctions++;
    }
  } else {
    console.log(`  🔗 projects/${id} → workhub/${id}`);
  }

  // Step 3: Junction in code dir (optional)
  if (CODE_DIR) {
    // Find existing entry with case-insensitive match
    let codeName = id;
    try {
      const entries = fs.readdirSync(CODE_DIR);
      const match = entries.find(e => e.toLowerCase() === id.toLowerCase());
      if (match) codeName = match;
    } catch {}

    const codePath = path.join(CODE_DIR, codeName);
    if (!DRY_RUN) {
      if (backupAndJunction(whPath, codePath, `code/${codeName} → workhub/${id}`)) {
        results.junctions++;
      }
    } else {
      console.log(`  🔗 code/${codeName} → workhub/${id}`);
    }
  }

  // Step 4: Copy .env files from backup
  if (!DRY_RUN) {
    const bakPath = cpPath + '.bak';
    results.envCopied += copyRuntimeFiles(bakPath, whPath);
    if (CODE_DIR) {
      // Also try code dir backup
      const codeEntries = exists(CODE_DIR) ? fs.readdirSync(CODE_DIR) : [];
      const match = codeEntries.find(e => e.toLowerCase() === (id + '.bak').toLowerCase());
      if (match) {
        results.envCopied += copyRuntimeFiles(path.join(CODE_DIR, match), whPath);
      }
    }
  }

  // Step 5: Install + Build (if --setup)
  if (DO_SETUP && !DRY_RUN) {
    if (npmInstall(whPath)) results.installed++;
    if (nextBuild(whPath)) results.built++;
  }
}

// --- Summary ---
console.log('\n' + '='.repeat(50));
console.log(`📦 Cloned:     ${results.cloned}`);
console.log(`🔗 Junctions:  ${results.junctions}`);
console.log(`📋 Runtime files copied: ${results.envCopied}`);
if (DO_SETUP) {
  console.log(`📦 Installed:  ${results.installed}`);
  console.log(`🔨 Built:      ${results.built}`);
}
if (results.errors.length) {
  console.log(`❌ Errors:     ${results.errors.length}`);
  results.errors.forEach(e => console.log(`   - ${e}`));
}
console.log('='.repeat(50));

if (DRY_RUN) {
  console.log('\nDry run. Add --run to execute.');
  console.log('Add --setup to also npm install + next build.');
  if (!CODE_DIR) {
    console.log('Add --code-dir <path> to also create junctions in another directory.');
  }
}
console.log('');
