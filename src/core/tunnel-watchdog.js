/**
 * Tunnel Watchdog
 *
 * 每 2 分鐘檢查 Cloudflare Tunnel 健康狀態：
 *   1. 快速檢查：connector count（本地，無網路）
 *   2. 深度檢查：外部 HTTP 探測（抓 stream 斷裂等問題）
 *   3. 連續 2 次失敗才重啟（避免誤殺）
 *   4. 重啟後 5 分鐘冷卻期
 *   5. Telegram 通知
 */

const { execSync } = require('child_process');
const { getTunnelInfo } = require('./tunnel-info');

const CHECK_INTERVAL = 2 * 60 * 1000;   // 2 分鐘
const COOLDOWN = 5 * 60 * 1000;          // 重啟後冷卻 5 分鐘
const PROBE_TIMEOUT = 10000;             // 外部探測 10 秒 timeout

let consecutiveFailures = 0;
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

function restartTunnel(reason) {
  const now = Date.now();
  if (now - lastRestartAt < COOLDOWN) {
    console.log(`[tunnel-watchdog] 冷卻中，跳過重啟 (${reason})`);
    return;
  }

  lastRestartAt = now;
  consecutiveFailures = 0;

  console.log(`[tunnel-watchdog] 重啟 tunnel: ${reason}`);
  let success = false;
  try {
    execSync('pm2 restart tunnel', { stdio: 'pipe', windowsHide: true });
    console.log('[tunnel-watchdog] ✓ tunnel 已重啟');
    success = true;
  } catch (err) {
    console.error('[tunnel-watchdog] ✗ 重啟失敗:', err.message);
  }

  // 只在重啟失敗時才通知（成功就靜默處理）
  if (!success) {
    const chatId = getChatId();
    if (chatId) {
      try {
        const telegram = require('./telegram');
        telegram.sendMessage(chatId, `🚨 <b>Tunnel Watchdog</b>\n${reason}\n自動重啟失敗，需要人工處理`, {
          parse_mode: 'HTML',
        }).catch(() => {});
      } catch {}
    }
  }
}

async function check() {
  // Phase 1: connector count（快速、本地）
  try {
    const info = getTunnelInfo();
    if (info.connectorCount === 0) {
      restartTunnel('Connector count = 0');
      return;
    }
  } catch {}

  // Phase 2: 外部 HTTP 探測（抓 stream 斷裂）
  const probeUrl = getProbeUrl();
  if (!probeUrl) return; // 沒設定 domain，跳過深度檢查

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
    if (consecutiveFailures > 0) {
      console.log('[tunnel-watchdog] 探測恢復正常');
    }
    consecutiveFailures = 0;
  } catch (err) {
    // timeout 或網路錯誤
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
  // 啟動後 30 秒做第一次檢查（給 tunnel 時間連線）
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
