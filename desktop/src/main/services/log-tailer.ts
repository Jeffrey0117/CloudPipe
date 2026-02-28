import { BrowserWindow } from 'electron';
import { IPC } from '@shared/constants';
import { ApiClient } from './api-client';

export class LogTailer {
  private interval: ReturnType<typeof setInterval> | null = null;
  private activePm2Name: string | null = null;

  constructor(
    private apiClient: ApiClient,
    private getMainWindow: () => BrowserWindow | null,
  ) {}

  start(pm2Name: string, intervalMs = 3_000): void {
    this.stop();
    this.activePm2Name = pm2Name;
    this.interval = setInterval(() => this.poll(), intervalMs);
    this.poll();
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.activePm2Name = null;
  }

  private async poll(): Promise<void> {
    if (!this.activePm2Name) return;
    try {
      const logs = await this.apiClient.getLogs(this.activePm2Name);
      const win = this.getMainWindow();
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.ON_LOG_UPDATE, {
          pm2Name: this.activePm2Name,
          ...logs,
        });
      }
    } catch {
      // connection lost
    }
  }
}
