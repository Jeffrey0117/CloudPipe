const pm2 = require('pm2');
const path = require('path');

/**
 * PM2 服務管理器
 */
class ServiceManager {
  constructor() {
    this.connected = false;
  }

  /**
   * 連接 PM2
   */
  async connect() {
    if (this.connected) return;

    return new Promise((resolve, reject) => {
      pm2.connect((err) => {
        if (err) {
          reject(err);
        } else {
          this.connected = true;
          resolve();
        }
      });
    });
  }

  /**
   * 斷開 PM2
   */
  disconnect() {
    if (this.connected) {
      pm2.disconnect();
      this.connected = false;
    }
  }

  /**
   * 啟動服務
   */
  async start(config) {
    await this.connect();

    return new Promise((resolve, reject) => {
      // 解析啟動指令
      const [command, ...args] = config.script.split(' ');

      const pm2Config = {
        name: `cloudpipe-${config.name}`,
        cwd: config.cwd,
        script: command,
        args: args.join(' '),
        env: {
          ...process.env,
          ...config.env,
          PORT: config.port
        },
        autorestart: true,
        max_restarts: 10,
        min_uptime: '10s',
        error_file: path.join(config.cwd, `logs/${config.name}-error.log`),
        out_file: path.join(config.cwd, `logs/${config.name}-out.log`),
        merge_logs: true
      };

      pm2.start(pm2Config, (err, apps) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            name: config.name,
            port: config.port,
            pid: apps[0].pm2_env.pm_id
          });
        }
      });
    });
  }

  /**
   * 停止服務
   */
  async stop(name) {
    await this.connect();

    return new Promise((resolve, reject) => {
      pm2.stop(`cloudpipe-${name}`, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 移除服務
   */
  async remove(name) {
    await this.connect();

    return new Promise((resolve, reject) => {
      pm2.delete(`cloudpipe-${name}`, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 列出所有服務
   */
  async list() {
    await this.connect();

    return new Promise((resolve, reject) => {
      pm2.list((err, list) => {
        if (err) {
          reject(err);
        } else {
          // 過濾出 cloudpipe 的服務
          const services = list
            .filter(proc => proc.name.startsWith('cloudpipe-'))
            .map(proc => ({
              name: proc.name.replace('cloudpipe-', ''),
              status: proc.pm2_env.status,
              pid: proc.pid,
              port: proc.pm2_env.env.PORT,
              uptime: this.formatUptime(proc.pm2_env.pm_uptime),
              restarts: proc.pm2_env.restart_time
            }));

          resolve(services);
        }
      });
    });
  }

  /**
   * 查看日誌
   */
  async logs(name, options = {}) {
    const { spawn } = require('child_process');

    const args = ['logs', `cloudpipe-${name}`];
    if (!options.follow) {
      args.push('--nostream');
      args.push('--lines', options.lines || 50);
    }

    const child = spawn('pm2', args, {
      stdio: 'inherit'
    });

    return new Promise((resolve, reject) => {
      child.on('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`pm2 logs exited with code ${code}`));
        }
      });
    });
  }

  /**
   * 格式化運行時間
   */
  formatUptime(timestamp) {
    if (!timestamp) return 'N/A';

    const now = Date.now();
    const uptime = now - timestamp;
    const seconds = Math.floor(uptime / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d`;
    if (hours > 0) return `${hours}h`;
    if (minutes > 0) return `${minutes}m`;
    return `${seconds}s`;
  }
}

module.exports = ServiceManager;
