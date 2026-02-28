import fs from 'fs';
import path from 'path';
import type { AppConfig } from '@shared/types';

const CONFIG_PATH = path.resolve(__dirname, '..', '..', '..', 'config.local.json');

const DEFAULTS: AppConfig = {
  serverUrl: 'http://localhost:8787',
  token: '',
  theme: 'dark',
  pollIntervals: {
    projects: 5_000,
    logs: 3_000,
    system: 10_000,
  },
};

export class ConfigStore {
  private config: AppConfig;

  constructor() {
    this.config = this.load();
  }

  private load(): AppConfig {
    try {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      return { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  private save(): void {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2), 'utf-8');
  }

  get(): AppConfig {
    return { ...this.config };
  }

  set(updates: Partial<AppConfig> | Record<string, unknown>): void {
    this.config = { ...this.config, ...updates } as AppConfig;
    this.save();
  }
}
