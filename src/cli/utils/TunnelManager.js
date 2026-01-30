const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * Cloudflare Tunnel 管理器
 */
class TunnelManager {
  constructor() {
    this.tunnels = new Map();
    this.configDir = path.join(process.env.HOME || process.env.USERPROFILE, '.cloudpipe', 'tunnels');

    // 確保配置目錄存在
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  /**
   * 建立 Tunnel
   */
  async create(name, port) {
    // 檢查是否已有 tunnel
    if (this.tunnels.has(name)) {
      return this.tunnels.get(name);
    }

    // 啟動 cloudflared
    const child = spawn('cloudflared', [
      'tunnel',
      '--url', `http://localhost:${port}`,
      '--no-autoupdate'
    ], {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // 等待獲取 URL
    const url = await this.waitForUrl(child);

    const tunnel = {
      name,
      port,
      url,
      pid: child.pid,
      process: child
    };

    this.tunnels.set(name, tunnel);

    // 將 tunnel 資訊寫入檔案
    this.saveTunnelInfo(tunnel);

    // 當進程退出時清理
    child.on('exit', () => {
      this.tunnels.delete(name);
      this.removeTunnelInfo(name);
    });

    return tunnel;
  }

  /**
   * 等待 Tunnel URL
   */
  waitForUrl(child) {
    return new Promise((resolve, reject) => {
      let output = '';
      const timeout = setTimeout(() => {
        reject(new Error('Tunnel 啟動超時'));
      }, 30000);

      child.stdout.on('data', (data) => {
        output += data.toString();

        // 尋找 URL
        const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[0]);
        }
      });

      child.stderr.on('data', (data) => {
        const error = data.toString();
        if (error.includes('error') || error.includes('failed')) {
          clearTimeout(timeout);
          reject(new Error('Tunnel 啟動失敗: ' + error));
        }
      });

      child.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  /**
   * 移除 Tunnel
   */
  async remove(name) {
    const tunnel = this.tunnels.get(name);
    if (!tunnel) return;

    // 終止進程
    if (tunnel.process) {
      tunnel.process.kill();
    }

    this.tunnels.delete(name);
    this.removeTunnelInfo(name);
  }

  /**
   * 儲存 Tunnel 資訊
   */
  saveTunnelInfo(tunnel) {
    const filePath = path.join(this.configDir, `${tunnel.name}.json`);
    fs.writeFileSync(filePath, JSON.stringify({
      name: tunnel.name,
      port: tunnel.port,
      url: tunnel.url,
      pid: tunnel.pid,
      createdAt: Date.now()
    }, null, 2));
  }

  /**
   * 移除 Tunnel 資訊
   */
  removeTunnelInfo(name) {
    const filePath = path.join(this.configDir, `${name}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  /**
   * 載入已存在的 Tunnels
   */
  async loadExistingTunnels() {
    if (!fs.existsSync(this.configDir)) return;

    const files = fs.readdirSync(this.configDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(this.configDir, file);
      try {
        const info = JSON.parse(fs.readFileSync(filePath, 'utf8'));

        // 檢查進程是否還在運行
        const isRunning = this.checkProcess(info.pid);
        if (!isRunning) {
          // 如果進程已死，清理資訊
          fs.unlinkSync(filePath);
        }
      } catch (err) {
        // 忽略損壞的檔案
      }
    }
  }

  /**
   * 檢查進程是否運行
   */
  checkProcess(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return false;
    }
  }
}

module.exports = TunnelManager;
