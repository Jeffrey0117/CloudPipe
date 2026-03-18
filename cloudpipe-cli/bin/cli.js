#!/usr/bin/env node

import { getConfig, saveConfig, clearConfig, CONFIG_PATH_DISPLAY } from '../lib/config.js';
import { detectAndBuild, slugify } from '../lib/detect.js';
import { deploy } from '../lib/deploy.js';
import { listSites, deleteSite } from '../lib/api.js';
import readline from 'node:readline';

const args = process.argv.slice(2);
const command = args[0];

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function main() {
  switch (command) {
    case 'login':
      return cmdLogin();
    case 'up':
    case 'deploy':
      return cmdUp();
    case 'list':
    case 'ls':
      return cmdList();
    case 'rm':
    case 'delete':
      return cmdRm();
    case 'logout':
      return cmdLogout();
    case '--help':
    case '-h':
    case 'help':
    case undefined:
      return cmdHelp();
    default:
      console.error(`Unknown command: ${command}\nRun 'cloudpipe help' for usage.`);
      process.exit(1);
  }
}

async function cmdLogin() {
  const token = await prompt('Deploy token: ');
  if (!token) {
    console.error('Token is required.');
    process.exit(1);
  }

  const server = await prompt('Server URL (http://localhost:8787): ');
  saveConfig({
    token,
    server: server || 'http://localhost:8787',
  });
  console.log(`Saved to ${CONFIG_PATH_DISPLAY}`);
}

async function cmdUp() {
  const config = getConfig();
  if (!config?.token) {
    console.error('Not logged in. Run: cloudpipe login');
    process.exit(1);
  }

  // Parse --name flag
  const nameIdx = args.indexOf('--name');
  const nameArg = nameIdx !== -1 ? args[nameIdx + 1] : null;

  const cwd = process.cwd();

  // Detect + build
  let outputDir, suggestedSlug;
  try {
    const result = detectAndBuild(cwd);
    outputDir = result.outputDir;
    suggestedSlug = result.suggestedSlug;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }

  const slug = nameArg ? slugify(nameArg) : suggestedSlug;
  console.log(`Deploying to ${slug}...`);

  // Deploy
  try {
    const result = await deploy({
      outputDir,
      slug,
      token: config.token,
      server: config.server,
    });

    console.log('');
    console.log(`Deployed to ${result.url}`);
    console.log(`Size: ${formatSize(result.size)}`);
  } catch (err) {
    console.error(`Deploy failed: ${err.message}`);
    process.exit(1);
  }
}

async function cmdList() {
  const config = getConfig();
  if (!config?.token) {
    console.error('Not logged in. Run: cloudpipe login');
    process.exit(1);
  }

  try {
    const { sites } = await listSites({
      token: config.token,
      server: config.server,
    });

    if (sites.length === 0) {
      console.log('No sites deployed yet. Run: cloudpipe up');
      return;
    }

    console.log('');
    for (const site of sites) {
      const age = timeSince(new Date(site.updated_at));
      console.log(`  ${site.slug.padEnd(30)} ${formatSize(site.size).padEnd(10)} ${age}`);
    }
    console.log('');
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

async function cmdRm() {
  const config = getConfig();
  if (!config?.token) {
    console.error('Not logged in. Run: cloudpipe login');
    process.exit(1);
  }

  const slug = args[1];
  if (!slug) {
    console.error('Usage: cloudpipe rm <slug>');
    process.exit(1);
  }

  try {
    await deleteSite({ slug, token: config.token, server: config.server });
    console.log(`Deleted ${slug}`);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exit(1);
  }
}

function cmdLogout() {
  clearConfig();
  console.log('Logged out.');
}

function cmdHelp() {
  console.log(`
cloudpipe-cli — Deploy static sites with one command

Commands:
  login           Save your deploy token
  up [--name x]   Build and deploy current directory
  list            List your deployed sites
  rm <slug>       Delete a site
  logout          Remove saved token
  help            Show this help

Examples:
  cloudpipe login
  cloudpipe up
  cloudpipe up --name my-portfolio
  cloudpipe list
  cloudpipe rm my-portfolio
`.trim());
}

function timeSince(date) {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
