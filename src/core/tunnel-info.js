/**
 * Tunnel Connector Info
 *
 * 查詢 cloudflared tunnel 的 connector 資訊（哪些機器連著 tunnel）。
 * 30 秒記憶體 cache，失敗不 throw。
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const CONFIG_PATH = path.join(__dirname, '../../config.json');
const CACHE_TTL = 30000; // 30s

let cached = null;
let cachedAt = 0;

function getCloudflaredConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return {
      path: config.cloudflared?.path || 'cloudflared',
      tunnelId: config.cloudflared?.tunnelId || '',
    };
  } catch {
    return { path: 'cloudflared', tunnelId: '' };
  }
}

function fetchTunnelInfo() {
  const { path: cfPath, tunnelId } = getCloudflaredConfig();
  if (!tunnelId) {
    return { connectorCount: 0, connectors: [] };
  }

  try {
    const output = execSync(
      `"${cfPath}" tunnel info -o json ${tunnelId}`,
      { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, timeout: 10000 }
    ).toString();

    const data = JSON.parse(output);
    const conns = data.conns || [];

    const connectors = conns.map(conn => {
      const subConns = conn.conns || [];
      const colos = subConns.map(sc => sc.colo_name).filter(Boolean);
      const originIp = subConns.length > 0 ? subConns[0].origin_ip : '';

      return {
        id: conn.id || '',
        ip: originIp ? originIp.replace(/:\d+$/, '') : '',
        version: conn.version || '',
        arch: conn.arch || '',
        connectedAt: conn.run_at || '',
        colos,
      };
    });

    return { connectorCount: connectors.length, connectors };
  } catch {
    return { connectorCount: 0, connectors: [] };
  }
}

function getTunnelInfo() {
  const now = Date.now();
  if (cached && (now - cachedAt) < CACHE_TTL) {
    return cached;
  }

  cached = fetchTunnelInfo();
  cachedAt = now;
  return cached;
}

module.exports = { getTunnelInfo };
