#!/usr/bin/env node
/**
 * CloudPipe Auto-Start Setup
 *
 * Registers/removes a Windows Scheduled Task that runs
 * `pm2 start ecosystem.config.js` on user login.
 *
 * Usage:
 *   node scripts/autostart.js          # enable auto-start
 *   node scripts/autostart.js --remove # disable auto-start
 */

const { execSync } = require('child_process');
const path = require('path');

const TASK_NAME = 'CloudPipe';
const ROOT = path.join(__dirname, '..');
const ECOSYSTEM = path.join(ROOT, 'ecosystem.config.js');

const remove = process.argv.includes('--remove');

if (remove) {
  try {
    execSync(`schtasks /delete /tn "${TASK_NAME}" /f`, { stdio: 'pipe', windowsHide: true });
    console.log(`[autostart] Removed scheduled task "${TASK_NAME}"`);
  } catch {
    console.log(`[autostart] Task "${TASK_NAME}" not found (already removed)`);
  }
  process.exit(0);
}

// Create a VBS wrapper to run PM2 silently (no cmd window flash)
const vbsPath = path.join(ROOT, 'scripts', 'autostart.vbs');
const fs = require('fs');
const vbsContent = [
  `Set ws = CreateObject("WScript.Shell")`,
  `ws.CurrentDirectory = "${ROOT.replace(/\\/g, '\\\\')}"`,
  `ws.Run "cmd /c pm2 start ecosystem.config.js --silent", 0, False`,
].join('\r\n');
fs.writeFileSync(vbsPath, vbsContent);

// Register scheduled task
try {
  // Delete old task if exists
  try {
    execSync(`schtasks /delete /tn "${TASK_NAME}" /f`, { stdio: 'pipe', windowsHide: true });
  } catch {}

  execSync(
    `schtasks /create /tn "${TASK_NAME}" /tr "wscript.exe \\"${vbsPath}\\"" /sc onlogon /rl highest /f`,
    { stdio: 'pipe', windowsHide: true }
  );

  console.log(`[autostart] Scheduled task "${TASK_NAME}" created`);
  console.log(`[autostart] PM2 will auto-start all services on login`);
  console.log(`[autostart] To remove: node scripts/autostart.js --remove`);
} catch (err) {
  console.error(`[autostart] Failed to create task:`, err.message);
  console.error(`[autostart] Try running as Administrator`);
  process.exit(1);
}
