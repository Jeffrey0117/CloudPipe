#!/usr/bin/env node
/**
 * Warm npm Cache
 *
 * Scans all projects' package.json, merges all unique dependencies,
 * runs a single `npm install` in a temp dir to populate the npm cache.
 *
 * After this, individual project `npm install` / `npm ci` will be
 * near-instant since everything is already cached locally.
 *
 * Usage:
 *   node scripts/warm-npm-cache.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const CLOUDPIPE_ROOT = path.resolve(__dirname, '..');

function main() {
  // Read projects from deploy config or db
  let projects;
  try {
    const deploy = require('../src/core/deploy');
    projects = deploy.getAllProjects();
  } catch {
    // Fallback: read projects.json directly
    const pjPath = path.join(CLOUDPIPE_ROOT, 'data', 'deploy', 'projects.json');
    if (!fs.existsSync(pjPath)) {
      console.log('[warm-cache] No projects.json found, skipping');
      return;
    }
    projects = JSON.parse(fs.readFileSync(pjPath, 'utf8'));
  }

  if (!projects || projects.length === 0) {
    console.log('[warm-cache] No projects found, skipping');
    return;
  }

  // Collect all dependencies from all projects
  const allDeps = {};
  let scanned = 0;

  for (const p of projects) {
    const dir = path.isAbsolute(p.directory)
      ? path.normalize(p.directory)
      : path.join(CLOUDPIPE_ROOT, p.directory);
    const pkgPath = path.join(dir, 'package.json');

    if (!fs.existsSync(pkgPath)) continue;

    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      for (const [name, version] of Object.entries(deps)) {
        // Keep the first version seen (good enough for cache warming)
        if (!allDeps[name]) {
          allDeps[name] = version;
        }
      }
      scanned++;
    } catch {
      // skip malformed package.json
    }
  }

  const depCount = Object.keys(allDeps).length;
  console.log(`[warm-cache] Scanned ${scanned} projects, found ${depCount} unique packages`);

  if (depCount === 0) {
    console.log('[warm-cache] Nothing to cache');
    return;
  }

  // Create temp dir with merged package.json
  const tmpDir = path.join(os.tmpdir(), `cloudpipe-cache-warm-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const mergedPkg = {
    name: 'cloudpipe-cache-warm',
    version: '1.0.0',
    private: true,
    dependencies: allDeps,
  };

  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(mergedPkg, null, 2));

  console.log(`[warm-cache] Installing ${depCount} packages to warm cache...`);
  const startTime = Date.now();

  try {
    // --ignore-scripts: skip postinstall hooks (we only want the cache)
    // --no-audit: skip vulnerability check (faster)
    // --no-fund: skip funding messages
    execSync('npm install --ignore-scripts --no-audit --no-fund', {
      cwd: tmpDir,
      stdio: 'inherit',
      windowsHide: true,
      timeout: 600000, // 10 min max
      env: { ...process.env, NODE_ENV: 'development' },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[warm-cache] Cache warmed in ${elapsed}s (${depCount} packages)`);
  } catch (e) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    // Partial success is fine — whatever got cached will speed up later installs
    console.log(`[warm-cache] Partial cache warm in ${elapsed}s (some packages may have failed)`);
  }

  // Cleanup temp dir
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

module.exports = { main };

if (require.main === module) {
  main();
}
