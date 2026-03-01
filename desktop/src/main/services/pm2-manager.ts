import { execFile } from 'child_process';
import http from 'http';
import path from 'path';

// .vite/build/ → desktop/ → cloudpipe/
const CLOUDPIPE_ROOT = path.resolve(__dirname, '..', '..', '..');

function exec(cmd: string, args: string[], cwd: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd, timeout: 60_000, shell: true }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${cmd} ${args.join(' ')} failed: ${stderr || err.message}`));
        return;
      }
      resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
    });
  });
}

export class Pm2Manager {
  async startAll(): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const { stdout } = await exec('pm2', ['start', 'ecosystem.config.js'], CLOUDPIPE_ROOT);
      return { success: true, output: stdout };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  getRoot(): string {
    return CLOUDPIPE_ROOT;
  }

  async stopAll(): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const { stdout } = await exec('pm2', ['stop', 'all'], CLOUDPIPE_ROOT);
      return { success: true, output: stdout };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async deleteAll(): Promise<{ success: boolean; error?: string }> {
    try {
      await exec('pm2', ['delete', 'all'], CLOUDPIPE_ROOT);
      return { success: true };
    } catch {
      // "No process found" is fine — nothing to delete
      return { success: true };
    }
  }

  async startCore(): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      const { stdout } = await exec(
        'pm2',
        ['start', 'ecosystem.config.js', '--only', 'cloudpipe'],
        CLOUDPIPE_ROOT,
      );
      return { success: true, output: stdout };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  async waitForHealth(
    url = 'http://localhost:8787/health',
    retries = 10,
    delay = 2_000,
  ): Promise<{ success: boolean; error?: string }> {
    for (let i = 0; i < retries; i++) {
      try {
        const ok = await new Promise<boolean>((resolve) => {
          const req = http.get(url, { timeout: 3_000 }, (res) => {
            let body = '';
            res.on('data', (chunk: string) => { body += chunk; });
            res.on('end', () => {
              try {
                const data = JSON.parse(body);
                resolve(data.status === 'ok');
              } catch {
                resolve(false);
              }
            });
          });
          req.on('error', () => resolve(false));
          req.on('timeout', () => { req.destroy(); resolve(false); });
        });
        if (ok) return { success: true };
      } catch { /* retry */ }
      await new Promise((r) => setTimeout(r, delay));
    }
    return { success: false, error: `Health check failed after ${retries} retries` };
  }

  async getStatus(): Promise<Array<{
    name: string;
    pid: number;
    status: string;
    cpu: number;
    memory: number;
    uptime: number;
    restarts: number;
  }>> {
    try {
      const { stdout } = await exec('pm2', ['jlist'], CLOUDPIPE_ROOT);
      const list = JSON.parse(stdout);
      return list.map((proc: Record<string, unknown>) => ({
        name: proc.name as string,
        pid: proc.pid as number,
        status: (proc.pm2_env as Record<string, unknown>)?.status as string || 'unknown',
        cpu: (proc.monit as Record<string, unknown>)?.cpu as number || 0,
        memory: (proc.monit as Record<string, unknown>)?.memory as number || 0,
        uptime: Date.now() - ((proc.pm2_env as Record<string, unknown>)?.pm_uptime as number || Date.now()),
        restarts: (proc.pm2_env as Record<string, unknown>)?.restart_time as number || 0,
      }));
    } catch {
      return [];
    }
  }
}
