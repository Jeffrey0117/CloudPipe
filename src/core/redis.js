/**
 * CloudPipe Redis Singleton
 *
 * 跨機器共享狀態層（Upstash Redis）。
 * 沒設 redis.url → getClient() 回傳 null，所有多機功能靜默停用。
 */

const Redis = require('ioredis');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '../../config.json');

let client = null;
let initAttempted = false;

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function getClient() {
  if (client) return client;
  if (initAttempted) return null;
  initAttempted = true;

  const config = getConfig();
  let redisUrl = config.redis?.url;

  if (!redisUrl) {
    console.log('[Redis] No redis.url configured, multi-machine features disabled');
    return null;
  }

  // Upstash 需要 TLS — 自動轉換 redis:// → rediss://
  if (redisUrl.includes('upstash.io') && redisUrl.startsWith('redis://')) {
    redisUrl = redisUrl.replace('redis://', 'rediss://');
  }

  try {
    client = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 10) return null; // 停止重試
        return Math.min(times * 500, 5000);
      },
      lazyConnect: false,
    });

    client.on('connect', () => console.log('[Redis] Connected'));
    client.on('error', (err) => console.error('[Redis] Error:', err.message));

    return client;
  } catch (err) {
    console.error('[Redis] Failed to create client:', err.message);
    client = null;
    return null;
  }
}

function getMachineId() {
  return getConfig().machineId || 'unknown';
}

async function shutdown() {
  if (client) {
    try {
      await client.quit();
    } catch {
      // ignore
    }
    client = null;
  }
}

module.exports = { getClient, getMachineId, shutdown };
