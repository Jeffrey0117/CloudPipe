import fs from 'fs';
import path from 'path';
import type { AppConfig, Machine } from '@shared/types';

const CONFIG_PATH = path.resolve(__dirname, '..', '..', '..', 'config.local.json');

const DEFAULTS: AppConfig = {
  serverUrl: 'http://localhost:8787',
  token: '',
  theme: 'light',
  locale: 'zh',
  pollIntervals: {
    projects: 5_000,
    logs: 3_000,
    system: 10_000,
  },
  machines: [],
  activeMachineId: '',
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
    return { ...this.config, machines: [...this.config.machines] };
  }

  set(updates: Partial<AppConfig> | Record<string, unknown>): void {
    this.config = { ...this.config, ...updates } as AppConfig;
    this.save();
  }

  getMachines(): Machine[] {
    return [...this.config.machines];
  }

  addMachine(machine: Machine): void {
    this.config = {
      ...this.config,
      machines: [...this.config.machines, machine],
    };
    this.save();
  }

  removeMachine(id: string): void {
    this.config = {
      ...this.config,
      machines: this.config.machines.filter((m) => m.id !== id),
      activeMachineId: this.config.activeMachineId === id ? '' : this.config.activeMachineId,
    };
    this.save();
  }

  switchMachine(id: string): AppConfig {
    const machine = this.config.machines.find((m) => m.id === id);
    if (!machine) return this.get();
    this.config = {
      ...this.config,
      activeMachineId: id,
      serverUrl: machine.serverUrl,
      token: machine.token,
    };
    this.save();
    return this.get();
  }
}
