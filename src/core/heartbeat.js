/**
 * CloudPipe Heartbeat System
 *
 * 每 30 秒寫心跳到 Redis，TTL 90 秒。
 * 其他機器可透過 getAllMachines() 讀取所有在線機器。
 * 偵測到機器離線 → Telegram 告警。
 */

const { execSync } = require('child_process');
const { getClient, getMachineId } = require('./redis');

let heartbeatInterval = null;
let offlineCheckInterval = null;

const HEARTBEAT_INTERVAL = 30000; // 30s
const HEARTBEAT_TTL = 90;         // 90s (3 missed = offline)
const KEY_PREFIX = 'cloudpipe:heartbeat:';

// 追蹤已知機器，用於離線告警
const knownMachines = new Set();

function getPm2Processes() {
  try {
    const output = execSync('pm2 jlist', { windowsHide: true, timeout: 10000 }).toString();
    const processes = JSON.parse(output);
    return processes.map(p => ({
      name: p.name,
      status: p.pm2_env?.status || 'unknown',
      memory: p.monit?.memory || 0,
      cpu: p.monit?.cpu || 0,
      uptime: p.pm2_env?.pm_uptime || 0,
    }));
  } catch {
    return [];
  }
}

async function sendHeartbeat() {
  const redis = getClient();
  if (!redis) return;

  const machineId = getMachineId();
  const key = KEY_PREFIX + machineId;
  const processes = getPm2Processes();

  const data = {
    machineId,
    status: 'online',
    lastSeen: new Date().toISOString(),
    uptime: String(Math.floor(process.uptime())),
    platform: process.platform,
    nodeVersion: process.version,
    processCount: String(processes.filter(p => p.status === 'online').length),
    processTotal: String(processes.length),
    processes: JSON.stringify(processes),
  };

  try {
    const pipeline = redis.pipeline();
    pipeline.hset(key, data);
    pipeline.expire(key, HEARTBEAT_TTL);
    await pipeline.exec();
  } catch (err) {
    console.error('[Heartbeat] Failed to send:', err.message);
  }
}

async function getAllMachines() {
  const redis = getClient();
  if (!redis) return [];

  try {
    const keys = await redis.keys(KEY_PREFIX + '*');
    if (keys.length === 0) return [];

    const machines = [];
    for (const key of keys) {
      const data = await redis.hgetall(key);
      if (data && data.machineId) {
        machines.push({
          ...data,
          processes: JSON.parse(data.processes || '[]'),
          uptime: parseInt(data.uptime || '0', 10),
          processCount: parseInt(data.processCount || '0', 10),
          processTotal: parseInt(data.processTotal || '0', 10),
        });
      }
    }

    return machines;
  } catch (err) {
    console.error('[Heartbeat] Failed to get machines:', err.message);
    return [];
  }
}

async function checkOfflineAlerts() {
  const machines = await getAllMachines();
  const currentIds = new Set(machines.map(m => m.machineId));
  const myId = getMachineId();

  // 偵測消失的機器
  for (const id of knownMachines) {
    if (!currentIds.has(id) && id !== myId) {
      console.log(`[Heartbeat] Machine offline: ${id}`);
      try {
        const telegram = require('./telegram');
        const tgConfig = telegram.getConfig();
        if (tgConfig.enabled && tgConfig.chatId) {
          await telegram.sendMessage(
            tgConfig.chatId,
            `🚨 <b>Machine Offline:</b> ${id} is no longer responding.`
          );
        }
      } catch {
        // telegram 可能還沒初始化
      }
    }
  }

  // 更新已知機器列表
  knownMachines.clear();
  for (const id of currentIds) {
    knownMachines.add(id);
  }
}

function startHeartbeat() {
  const redis = getClient();
  if (!redis) {
    console.log('[Heartbeat] Skipped (no Redis)');
    return;
  }

  const machineId = getMachineId();
  console.log(`[Heartbeat] Started (${machineId}, every ${HEARTBEAT_INTERVAL / 1000}s)`);

  // 立即送第一次
  sendHeartbeat();

  heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

  // 離線偵測（每 60 秒）
  offlineCheckInterval = setInterval(checkOfflineAlerts, 60000);
  // 初始掃描
  setTimeout(checkOfflineAlerts, 5000);
}

async function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
  if (offlineCheckInterval) {
    clearInterval(offlineCheckInterval);
    offlineCheckInterval = null;
  }

  // 標記為 offline
  const redis = getClient();
  if (redis) {
    const key = KEY_PREFIX + getMachineId();
    try {
      await redis.hset(key, 'status', 'offline');
      await redis.expire(key, 10);
    } catch {
      // ignore
    }
  }

  console.log('[Heartbeat] Stopped');
}

module.exports = { startHeartbeat, stopHeartbeat, getAllMachines };
