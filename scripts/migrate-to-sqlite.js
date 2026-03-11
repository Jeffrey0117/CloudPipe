#!/usr/bin/env node

/**
 * Manual migration: projects.json + deployments.json → SQLite
 *
 * This is a standalone script for manual/backup purposes.
 * The main db.js does auto-migration on first use, so this is optional.
 *
 * Usage:
 *   node scripts/migrate-to-sqlite.js              # dry-run
 *   node scripts/migrate-to-sqlite.js --run        # execute migration
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PROJECTS_JSON = path.join(ROOT, 'data', 'deploy', 'projects.json');
const DEPLOYMENTS_JSON = path.join(ROOT, 'data', 'deploy', 'deployments.json');
const AUTOFIX_JSON = path.join(ROOT, 'data', 'autofix-state.json');
const DB_PATH = path.join(ROOT, 'data', 'cloudpipe.db');

const dryRun = !process.argv.includes('--run');

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function main() {
  console.log('\n=== CloudPipe JSON → SQLite Migration ===\n');

  if (dryRun) {
    console.log('  (dry-run mode — add --run to execute)\n');
  }

  // Check sources
  const projectsData = readJson(PROJECTS_JSON);
  const deploymentsData = readJson(DEPLOYMENTS_JSON);
  const autofixData = readJson(AUTOFIX_JSON);

  const projects = projectsData?.projects || [];
  const deployments = deploymentsData?.deployments || [];
  const autofixEntries = Object.entries(autofixData?.projects || {});

  console.log(`  Projects:    ${projects.length} (${fs.existsSync(PROJECTS_JSON) ? 'found' : 'missing'})`);
  console.log(`  Deployments: ${deployments.length} (${fs.existsSync(DEPLOYMENTS_JSON) ? 'found' : 'missing'})`);
  console.log(`  Autofix:     ${autofixEntries.length} entries (${fs.existsSync(AUTOFIX_JSON) ? 'found' : 'missing'})`);
  console.log(`  DB path:     ${DB_PATH}`);
  console.log(`  DB exists:   ${fs.existsSync(DB_PATH)}`);
  console.log('');

  if (projects.length === 0 && deployments.length === 0) {
    console.log('  Nothing to migrate.');
    return;
  }

  if (dryRun) {
    console.log('  Would migrate:');
    for (const p of projects) {
      console.log(`    project: ${p.id} (port ${p.port})`);
    }
    console.log(`    ${deployments.length} deployment records`);
    console.log(`    ${autofixEntries.length} autofix state entries`);
    console.log('\n  Run with --run to execute.\n');
    return;
  }

  // Backup existing DB if it exists
  if (fs.existsSync(DB_PATH)) {
    const backupPath = DB_PATH + '.bak';
    fs.copyFileSync(DB_PATH, backupPath);
    console.log(`  Backed up existing DB → ${backupPath}`);
  }

  // Use db.js (which will auto-migrate)
  const db = require('../src/core/db');
  const existing = db.getAllProjects();

  if (existing.length > 0) {
    console.log(`  DB already has ${existing.length} projects — skipping (auto-migration already ran)`);
  } else {
    console.log(`  Auto-migration will run via db.js init...`);
  }

  // Verify
  const finalProjects = db.getAllProjects();
  const finalDeployments = db.getAllDeployments(null, 9999);

  console.log('');
  console.log(`  Final project count:    ${finalProjects.length}`);
  console.log(`  Final deployment count: ${finalDeployments.length}`);
  console.log('');

  if (finalProjects.length === projects.length) {
    console.log('  Migration complete!\n');
  } else {
    console.log(`  Warning: count mismatch (expected ${projects.length}, got ${finalProjects.length})\n`);
  }

  db.close();
}

main();
