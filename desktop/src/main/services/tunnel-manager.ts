import { execFile } from 'child_process';
import type { TunnelStatus, TunnelInfo } from '@shared/types';

/**
 * Tunnel Manager — manages cloudflared via PM2
 *
 * The tunnel is defined as 'tunnel' in ecosystem.config.js.
 * This manager starts/stops/monitors it through PM2, ensuring
 * both start.bat and Electron use the same single tunnel instance.
 */

const PM2_NAME = 'tunnel';

function pm2(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile('pm2', args, { timeout: 15_000, shell: true, windowsHide: true }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr?.toString() || err.message));
        return;
      }
      resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

export class TunnelManager {
  private status: TunnelStatus = 'stopped';
  private startedAt: number | null = null;
  private lastError: string | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private onStatusChange: ((info: TunnelInfo) => void) | null = null;

  setOnStatusChange(cb: (info: TunnelInfo) => void): void {
    this.onStatusChange = cb;
  }

  private emitStatus(): void {
    this.onStatusChange?.(this.getStatus());
  }

  private async readPm2Status(): Promise<{ online: boolean; pid?: number; uptime?: number }> {
    try {
      const { stdout } = await pm2(['jlist']);
      const list = JSON.parse(stdout);
      const tunnel = list.find((p: Record<string, unknown>) => p.name === PM2_NAME);
      if (!tunnel) return { online: false };

      const env = tunnel.pm2_env as Record<string, unknown> | undefined;
      const isOnline = env?.status === 'online';
      return {
        online: isOnline,
        pid: tunnel.pid as number | undefined,
        uptime: isOnline && env?.pm_uptime
          ? Date.now() - (env.pm_uptime as number)
          : undefined,
      };
    } catch {
      return { online: false };
    }
  }

  private startPolling(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(async () => {
      const pm2Status = await this.readPm2Status();
      const prevStatus = this.status;

      if (pm2Status.online) {
        this.status = 'running';
        this.startedAt = pm2Status.uptime ? Date.now() - pm2Status.uptime : this.startedAt;
        this.lastError = null;
      } else if (this.status === 'running') {
        // Was running, now offline
        this.status = 'errored';
        this.lastError = 'Tunnel process stopped unexpectedly';
        this.startedAt = null;
      }

      if (prevStatus !== this.status) {
        this.emitStatus();
      }
    }, 5_000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async start(): Promise<{ success: boolean; error?: string }> {
    // Check if already running in PM2
    const current = await this.readPm2Status();
    if (current.online) {
      this.status = 'running';
      this.startedAt = current.uptime ? Date.now() - current.uptime : Date.now();
      this.lastError = null;
      this.emitStatus();
      this.startPolling();
      return { success: true };
    }

    this.status = 'starting';
    this.lastError = null;
    this.emitStatus();

    try {
      // Try starting just the tunnel via PM2
      await pm2(['start', 'ecosystem.config.js', '--only', PM2_NAME]);

      // Wait for it to come online (up to 10s)
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 2_000));
        const check = await this.readPm2Status();
        if (check.online) {
          this.status = 'running';
          this.startedAt = Date.now();
          this.lastError = null;
          this.emitStatus();
          this.startPolling();
          return { success: true };
        }
      }

      this.status = 'errored';
      this.lastError = 'Tunnel did not start within 10s';
      this.emitStatus();
      return { success: false, error: this.lastError };
    } catch (err) {
      this.status = 'errored';
      this.lastError = (err as Error).message;
      this.emitStatus();
      return { success: false, error: this.lastError };
    }
  }

  async stop(): Promise<{ success: boolean; error?: string }> {
    this.stopPolling();

    try {
      await pm2(['stop', PM2_NAME]);
    } catch {
      // May not exist — that's fine
    }

    this.status = 'stopped';
    this.startedAt = null;
    this.lastError = null;
    this.emitStatus();
    return { success: true };
  }

  getStatus(): TunnelInfo {
    return {
      status: this.status,
      uptime: this.startedAt ? Date.now() - this.startedAt : undefined,
      error: this.lastError ?? undefined,
    };
  }

  /** Synchronous cleanup for app quit — stop polling only, tunnel stays in PM2 */
  destroy(): void {
    this.stopPolling();
    // Don't kill the tunnel — it lives in PM2 and should survive Electron closing
  }
}
