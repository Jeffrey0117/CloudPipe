/**
 * Tunnel Watchdog
 *
 * 每 2 分鐘檢查 Cloudflare Tunnel 健康狀態：
 *   1. 快速檢查：connector count（本地，無網路）
 *   2. 深度檢查：外部 HTTP 探測（抓 stream 斷裂等問題）
 *   3. 連續 2 次失敗才重啟（避免誤殺）
 *   4. 最多重啟 3 次，之後放棄（避免洗頻）
 *   5. 只在放棄時通知一次
 */

const { execSync } = require('child_process');
const { getTunnelInfo } = require('./tunnel-info');

const CHECK_INTERVAL = 2 * 60 * 1000;   // 2 分鐘
const COOLDOWN = 5 * 60 * 1000;          // 重啟後冷卻 5 分鐘
const PROBE_TIMEOUT = 10000;             // 外部探測 10 秒 timeout
const MAX_RESTARTS = 3;                  // 最多重啟 3 次就放棄

let consecutiveFailures = 0;
let restartCount = 0;
let gaveUp = false;
let lastRestartAt = 0;
let timer = null;

function getProbeUrl() {
  try {
    const fs = require('fs');
    const path = require('path');
    const config = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../config.json'), 'utf8')
    );
    if (config.domain) return `https://${config.domain}/api/health`;
  } catch {}
  return '';
}

function getChatId() {
  try {
    const fs = require('fs');
    const path = require('path');
    const config = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../config.json'), 'utf8')
    );
    return config.telegram?.chatId || '';
  } catch {}
  return '';
}

function notify(message) {
  const chatId = getChatId();
  if (!chatId) return;
  try {
    const telegram = require('./telegram');
    telegram.sendMessage(chatId, message, { parse_mode: 'HTML' }).catch(() => {});
  } catch {}
}

function restartTunnel(reason) {
  if (gaveUp) return;

  const now = Date.now();
  if (now - lastRestartAt < COOLDOWN) {
    return; // 冷卻中，靜默跳過
  }

  if (restartCount >= MAX_RESTARTS) {
    gaveUp = true;
    console.log(`[tunnel-watchdog] 已重啟 ${MAX_RESTARTS} 次仍未恢復，放棄自動修復`);
    notify(`🚨 <b>Tunnel Watchdog</b>\ncloudflared 重啟 ${MAX_RESTARTS} 次仍無法恢復\n需要人工檢查`);
    return;
  }

  lastRestartAt = now;
  restartCount++;
  consecutiveFailures = 0;

  console.log(`[tunnel-watchdog] 重啟 tunnel (${restartCount}/${MAX_RESTARTS}): ${reason}`);
  try {
    execSync('pm2 restart tunnel', { stdio: 'pipe', windowsHide: true });
    console.log('[tunnel-watchdog] ✓ tunnel 已重啟');
  } catch (err) {
    console.error('[tunnel-watchdog] ✗ 重啟失敗:', err.message);
    gaveUp = true;
    notify(`🚨 <b>Tunnel Watchdog</b>\n${reason}\npm2 restart 失敗，需要人工處理`);
  }
}

function markRecovered() {
  if (restartCount > 0 || gaveUp) {
    console.log('[tunnel-watchdog] ✓ tunnel 已恢復正常');
  }
  consecutiveFailures = 0;
  restartCount = 0;
  gaveUp = false;
}

async function check() {
  // Phase 1: connector count（快速、本地）
  try {
    const info = getTunnelInfo();
    if (info.connectorCount === 0) {
      consecutiveFailures++;
      if (consecutiveFailures >= 2) {
        restartTunnel('Connector count = 0');
      }
      return;
    }
  } catch {}

  // Phase 2: 外部 HTTP 探測（抓 stream 斷裂）
  const probeUrl = getProbeUrl();
  if (!probeUrl) {
    markRecovered();
    return;
  }

  try {
    const res = await fetch(probeUrl, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT),
      headers: { 'User-Agent': 'CloudPipe-TunnelWatchdog/1.0' },
    });

    if (res.status === 502 || res.status === 503) {
      consecutiveFailures++;
      console.log(`[tunnel-watchdog] 探測失敗 (${res.status})，連續 ${consecutiveFailures} 次`);
      if (consecutiveFailures >= 2) {
        restartTunnel(`外部探測連續 ${consecutiveFailures} 次回傳 ${res.status}`);
      }
      return;
    }

    // 正常
    markRecovered();
  } catch (err) {
    consecutiveFailures++;
    console.log(`[tunnel-watchdog] 探測異常: ${err.message}，連續 ${consecutiveFailures} 次`);
    if (consecutiveFailures >= 2) {
      restartTunnel(`外部探測連續 ${consecutiveFailures} 次失敗: ${err.message}`);
    }
  }
}

function start() {
  if (timer) return;
  console.log('[tunnel-watchdog] 啟動（每 2 分鐘檢查）');
  timer = setInterval(check, CHECK_INTERVAL);
  setTimeout(check, 30000);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log('[tunnel-watchdog] 已停止');
  }
}

module.exports = { start, stop };
