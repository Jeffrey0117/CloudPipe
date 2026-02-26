/**
 * CloudPipe Telegram Bot
 *
 * 功能：
 * - /projects — 列出所有專案（inline keyboard 直接開啟）
 * - /status — 專案狀態總覽
 * - /deploy <id> — 觸發部署（需確認）
 * - 部署完成自動通知
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const deploy = require('./deploy');

const CONFIG_PATH = path.join(__dirname, '../../config.json');
const API_BASE = 'https://api.telegram.org/bot';

let polling = false;
let pollTimeout = null;
let pollInFlight = false;
let lastUpdateId = 0;

// ==================== Config ====================

function getConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return config.telegram || {};
  } catch {
    return {};
  }
}

function getDomain() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')).domain || '';
  } catch {
    return '';
  }
}

// ==================== Telegram API ====================

async function apiCall(method, body = {}) {
  const { botToken } = getConfig();
  if (!botToken) return null;

  const res = await fetch(`${API_BASE}${botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error(`[Telegram] API error (${method}):`, text);
    return null;
  }

  return res.json();
}

async function sendMessage(chatId, text, options = {}) {
  return apiCall('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    ...options,
  });
}

async function editMessage(chatId, messageId, text, options = {}) {
  return apiCall('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
    ...options,
  });
}

async function answerCallback(callbackQueryId, text = '') {
  return apiCall('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text,
  });
}

// ==================== Security ====================

function isAuthorized(chatId) {
  const config = getConfig();
  if (!config.chatId) return false;
  return String(chatId) === String(config.chatId);
}

// ==================== PM2 Status ====================

function getPm2Status() {
  try {
    const output = execSync('pm2 jlist', { windowsHide: true }).toString();
    const processes = JSON.parse(output);
    const statusMap = {};
    for (const proc of processes) {
      statusMap[proc.name] = proc.pm2_env?.status || 'unknown';
    }
    return statusMap;
  } catch {
    return {};
  }
}

// ==================== Command Handlers ====================

async function handleStart(chatId) {
  const text = [
    '<b>CloudPipe Bot</b>',
    '',
    '快速進入你的所有專案：',
    '',
    '/projects — 專案列表（點擊直接開啟）',
    '/status — 狀態總覽',
    '/deploy &lt;id&gt; — 觸發部署',
    '/restart &lt;id&gt; — 重啟服務',
    '/help — 指令列表',
  ].join('\n');

  await sendMessage(chatId, text);
}

async function handleProjects(chatId) {
  const projects = deploy.getAllProjects();
  const domain = getDomain();

  if (projects.length === 0) {
    return sendMessage(chatId, '目前沒有任何專案。');
  }

  const keyboard = projects.map((p) => ([{
    text: `${p.name || p.id}`,
    url: `https://${p.id}.${domain}`,
  }]));

  // Admin dashboard as last button
  keyboard.push([{
    text: 'CloudPipe Admin',
    url: `https://epi.${domain}/_admin`,
  }]);

  await sendMessage(chatId, '<b>你的專案：</b>', {
    reply_markup: { inline_keyboard: keyboard },
  });
}

async function handleStatus(chatId) {
  const projects = deploy.getAllProjects();
  const pm2Status = getPm2Status();
  const domain = getDomain();

  if (projects.length === 0) {
    return sendMessage(chatId, '目前沒有任何專案。');
  }

  const lines = projects.map((p) => {
    const status = pm2Status[p.pm2Name] || 'stopped';
    const icon = status === 'online' ? '🟢' : '🔴';
    const lastDeploy = p.lastDeployAt
      ? new Date(p.lastDeployAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })
      : '尚未部署';
    const commit = p.runningCommit || '-';

    return [
      `${icon} <b>${p.name || p.id}</b>`,
      `   狀態: ${status} | Commit: ${commit}`,
      `   上次部署: ${lastDeploy}`,
      `   🔗 https://${p.id}.${domain}`,
    ].join('\n');
  });

  await sendMessage(chatId, lines.join('\n\n'));
}

async function handleRestart(chatId, projectId) {
  if (!projectId) {
    const projects = deploy.getAllProjects();
    const ids = projects.map((p) => `<code>${p.id}</code>`).join(', ');
    return sendMessage(chatId, `請指定專案 ID：\n/restart &lt;id&gt;\n\n可用: ${ids}`);
  }

  const project = deploy.getProject(projectId);
  if (!project) {
    return sendMessage(chatId, `找不到專案 <code>${projectId}</code>`);
  }

  try {
    execSync(`pm2 restart ${project.pm2Name || project.id}`, { stdio: 'pipe', windowsHide: true });
    await sendMessage(chatId, `✅ <b>${project.name || project.id}</b> 已重啟`);
  } catch (err) {
    await sendMessage(chatId, `❌ 重啟失敗: ${err.message}`);
  }
}

async function handleDeploy(chatId, projectId) {
  if (!projectId) {
    const projects = deploy.getAllProjects();
    const ids = projects.map((p) => `<code>${p.id}</code>`).join(', ');
    return sendMessage(chatId, `請指定專案 ID：\n/deploy &lt;id&gt;\n\n可用: ${ids}`);
  }

  const project = deploy.getProject(projectId);
  if (!project) {
    return sendMessage(chatId, `找不到專案 <code>${projectId}</code>`);
  }

  await sendMessage(chatId, `確定要部署 <b>${project.name || project.id}</b> 嗎？`, {
    reply_markup: {
      inline_keyboard: [[
        { text: '確認部署', callback_data: `deploy_confirm:${project.id}` },
        { text: '取消', callback_data: `deploy_cancel:${project.id}` },
      ]],
    },
  });
}

async function handleHelp(chatId) {
  const text = [
    '<b>CloudPipe Bot 指令</b>',
    '',
    '/projects — 專案列表（點擊開啟）',
    '/status — 狀態總覽（PM2 + 部署資訊）',
    '/deploy &lt;id&gt; — 觸發部署',
    '/restart &lt;id&gt; — 重啟服務（PM2 restart）',
    '/help — 顯示此說明',
  ].join('\n');

  await sendMessage(chatId, text);
}

// ==================== Callback Query ====================

async function handleCallback(callbackQuery) {
  const { id: queryId, message, data } = callbackQuery;
  const chatId = message.chat.id;
  const messageId = message.message_id;

  if (!isAuthorized(chatId)) {
    return answerCallback(queryId, '未授權');
  }

  if (data.startsWith('deploy_confirm:')) {
    const projectId = data.replace('deploy_confirm:', '');
    await answerCallback(queryId, '開始部署...');
    await editMessage(chatId, messageId, `⏳ 正在部署 <b>${projectId}</b>...`);

    try {
      const result = await deploy.deploy(projectId, { triggeredBy: 'telegram' });
      const domain = getDomain();
      const duration = result.duration ? `${(result.duration / 1000).toFixed(1)}s` : '?';

      if (result.status === 'success') {
        await editMessage(chatId, messageId, [
          `✅ <b>${projectId}</b> 部署成功`,
          `Commit: <code>${result.commit || '-'}</code>`,
          `耗時: ${duration}`,
          `🔗 https://${projectId}.${domain}`,
        ].join('\n'));
      } else {
        await editMessage(chatId, messageId, [
          `❌ <b>${projectId}</b> 部署失敗`,
          `錯誤: ${result.error || '未知錯誤'}`,
        ].join('\n'));
      }
    } catch (err) {
      await editMessage(chatId, messageId, `❌ 部署錯誤: ${err.message}`);
    }
    return;
  }

  if (data.startsWith('deploy_cancel:')) {
    await answerCallback(queryId, '已取消');
    await editMessage(chatId, messageId, '已取消部署。');
    return;
  }

  await answerCallback(queryId);
}

// ==================== Update Handler ====================

async function handleUpdate(update) {
  if (update.callback_query) {
    return handleCallback(update.callback_query);
  }

  const message = update.message;
  if (!message || !message.text) return;

  const chatId = message.chat.id;
  if (!isAuthorized(chatId)) return;

  const text = message.text.trim();
  const [command, ...args] = text.split(/\s+/);

  switch (command) {
    case '/start':
      return handleStart(chatId);
    case '/projects':
      return handleProjects(chatId);
    case '/status':
      return handleStatus(chatId);
    case '/deploy':
      return handleDeploy(chatId, args[0]);
    case '/restart':
      return handleRestart(chatId, args[0]);
    case '/help':
      return handleHelp(chatId);
    default:
      break;
  }
}

// ==================== Long Polling ====================

async function clearStaleConnections() {
  try {
    await apiCall('deleteWebhook', { drop_pending_updates: false });
    const flush = await apiCall('getUpdates', { offset: -1, timeout: 0 });
    if (flush?.result?.length > 0) {
      lastUpdateId = flush.result[flush.result.length - 1].update_id;
    }
    console.log('[Telegram] Cleared stale connections');
  } catch (err) {
    console.error('[Telegram] clearStaleConnections error:', err.message);
  }
}

async function poll() {
  if (!polling || pollInFlight) return;

  const { botToken } = getConfig();
  if (!botToken) {
    pollTimeout = setTimeout(poll, 10000);
    return;
  }

  pollInFlight = true;
  let nextDelay = 1000;

  try {
    const data = await apiCall('getUpdates', {
      offset: lastUpdateId + 1,
      timeout: 30,
    });

    if (!data) {
      nextDelay = 5000;
    } else if (data.result?.length > 0) {
      for (const update of data.result) {
        lastUpdateId = update.update_id;
        handleUpdate(update).catch((err) => {
          console.error('[Telegram] Handle error:', err);
        });
      }
    }
  } catch (err) {
    console.error('[Telegram] Poll error:', err.message);
    nextDelay = 5000;
  } finally {
    pollInFlight = false;
  }

  if (polling) {
    pollTimeout = setTimeout(poll, nextDelay);
  }
}

// ==================== Deploy Notification ====================

function onDeployComplete({ project, deployment }) {
  const config = getConfig();
  if (!config.enabled || !config.botToken || !config.chatId) return;

  const domain = getDomain();
  const duration = deployment.duration ? `${(deployment.duration / 1000).toFixed(1)}s` : '?';

  const text = deployment.status === 'success'
    ? [
        `✅ <b>[部署成功] ${project.name || project.id}</b>`,
        `Commit: <code>${deployment.commit || '-'}</code>`,
        deployment.commitMessage ? `${deployment.commitMessage}` : '',
        `耗時: ${duration}`,
        `🔗 https://${project.id}.${domain}`,
      ].filter(Boolean).join('\n')
    : [
        `❌ <b>[部署失敗] ${project.name || project.id}</b>`,
        `錯誤: ${deployment.error || '未知'}`,
        `觸發: ${deployment.triggeredBy || 'unknown'}`,
      ].join('\n');

  sendMessage(config.chatId, text).catch((err) => {
    console.error('[Telegram] Notification error:', err.message);
  });
}

// ==================== Lifecycle ====================

async function startBot() {
  const config = getConfig();

  if (!config.enabled) {
    console.log('[Telegram] Bot 未啟用 (config.telegram.enabled = false)');
    return;
  }

  if (!config.botToken) {
    console.log('[Telegram] 缺少 botToken，跳過啟動');
    return;
  }

  if (!config.chatId) {
    console.log('[Telegram] 缺少 chatId，跳過啟動');
    return;
  }

  await clearStaleConnections();

  polling = true;
  poll();

  // Listen for deploy events
  deploy.events.on('deploy:complete', onDeployComplete);

  console.log(`[Telegram] Bot 已啟動 (chatId: ${config.chatId})`);
}

function stopBot() {
  polling = false;
  pollInFlight = false;
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
  deploy.events.removeListener('deploy:complete', onDeployComplete);
  console.log('[Telegram] Bot 已停止');
}

/**
 * Notification-only mode: subscribe to deploy events without polling.
 * Used by replica machines (polling=false) to still send Telegram notifications.
 */
function startNotificationsOnly() {
  const config = getConfig();
  if (!config.enabled || !config.botToken || !config.chatId) {
    console.log('[Telegram] Notification-only: missing config, skipping');
    return;
  }
  deploy.events.on('deploy:complete', onDeployComplete);
  console.log(`[Telegram] Notification-only mode active (chatId: ${config.chatId})`);
}

module.exports = {
  startBot,
  stopBot,
  startNotificationsOnly,
  sendMessage,
  getConfig: getConfig,
};
