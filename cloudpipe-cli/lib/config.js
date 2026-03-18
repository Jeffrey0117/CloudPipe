import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CONFIG_DIR = path.join(os.homedir(), '.cloudpipe');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

export function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n');
}

export function clearConfig() {
  try {
    fs.unlinkSync(CONFIG_PATH);
  } catch {
    // ignore
  }
}

export const CONFIG_PATH_DISPLAY = CONFIG_PATH;
