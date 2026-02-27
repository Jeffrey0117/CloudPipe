/**
 * CloudPipe Telegram Bot
 *
 * 功能：
 * - /projects — 列出所有專案（inline keyboard 直接開啟）
 * - /status — 多機狀態總覽（有 Redis）/ 本機狀態（無 Redis）
 * - /machines — 各機器詳細資訊
 * - /deploy <id> — 觸發部署（需確認）
 * - /restart <id> — 重啟服務
 * - Leader Election — 多台機器自動選出一台跑 polling
 * - 部署完成自動通知
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const deploy = require('./deploy');

const CONFIG_PATH = path.join(__dirname, '../../config.json');
function getFullConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function getApiBase() {
  const { telegramProxy } = getFullConfig();
  return telegramProxy ? `${telegramProxy.replace(/\/+$/, '')}/bot` : 'https://api.telegram.org/bot';
}

let polling = false;
let pollTimeout = null;
let pollInFlight = false;
let lastUpdateId = 0;

// Upload mode state (per-chat)
let uploadMode = false;

// Leader election state
const LEADER_KEY = 'cloudpipe:telegram:leader';
const LEADER_TTL = 60;
let leaderInterval = null;
let isLeader = false;

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

  const res = await fetch(`${getApiBase()}${botToken}/${method}`, {
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

// ==================== Utility ====================

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ==================== Bot Commands Menu ====================

async function registerCommands() {
  await apiCall('setMyCommands', {
    commands: [
      { command: 'status', description: '狀態總覽（多機 + 部署資訊）' },
      { command: 'projects', description: '專案列表（點擊直接開啟）' },
      { command: 'machines', description: '各機器詳細資訊' },
      { command: 'deploy', description: '觸發部署（需指定專案 ID）' },
      { command: 'restart', description: '重啟服務（PM2 restart）' },
      { command: 'tools', description: '列出可用工具（Gateway）' },
      { command: 'call', description: '呼叫工具 /call <tool> key=value' },
      { command: 'pipe', description: '執行 pipeline /pipe <id> key=value' },
      { command: 'upload', description: '開關上傳模式（傳圖自動上傳到 duk.tw）' },
      { command: 'envtoken', description: '生成 .env 下載 token（給新機器用）' },
      { command: 'help', description: '指令說明' },
    ],
  });
}

// ==================== Command Handlers ====================

async function handleStart(chatId) {
  const text = [
    '🚀 <b>CloudPipe Bot</b>',
    '',
    '快速進入你的所有專案：',
    '',
    '/status — 狀態總覽',
    '/projects — 專案列表（點擊直接開啟）',
    '/machines — 各機器詳細資訊',
    '/deploy &lt;id&gt; — 觸發部署',
    '/restart &lt;id&gt; — 重啟服務',
    '/tools [project] — 列出可用工具',
    '/call &lt;tool&gt; key=value — 呼叫工具',
    '/pipe &lt;pipeline&gt; key=value — 執行 pipeline',
    '/upload — 開關上傳模式（傳圖自動上傳 duk.tw）',
    '/envtoken — 生成 .env token（新機器用）',
    '/help — 指令列表',
    '',
    '💡 輸入 / 可以看到所有指令選單',
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
  const domain = getDomain();

  // 嘗試多機視圖
  let machines = [];
  try {
    const heartbeat = require('./heartbeat');
    machines = await heartbeat.getAllMachines();
  } catch {
    // heartbeat 未載入
  }

  if (machines.length > 0) {
    // 多機狀態
    const lines = [];

    for (const machine of machines) {
      const icon = machine.status === 'online' ? '🟢' : '🔴';
      const uptimeStr = formatUptime(machine.uptime);
      lines.push(`${icon} <b>${machine.machineId}</b> (${uptimeStr})`);

      for (const proc of machine.processes) {
        const procIcon = proc.status === 'online' ? '✅' : '❌';
        const mem = (proc.memory / 1024 / 1024).toFixed(0);
        lines.push(`   ${procIcon} ${proc.name}: ${proc.status} (${mem}MB)`);
      }
      lines.push('');
    }

    lines.push('<b>Projects:</b>');
    for (const p of projects) {
      const commit = p.runningCommit || '-';
      lines.push(`  🔗 <b>${p.name || p.id}</b> (${commit}) https://${p.id}.${domain}`);
    }

    await sendMessage(chatId, lines.join('\n'));
  } else {
    // Fallback: 本機視圖
    const pm2Status = getPm2Status();

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
}

async function handleMachines(chatId) {
  let machines = [];
  try {
    const heartbeat = require('./heartbeat');
    machines = await heartbeat.getAllMachines();
  } catch {
    // heartbeat 未載入
  }

  if (machines.length === 0) {
    return sendMessage(chatId, 'No machines connected (Redis not configured).');
  }

  const redisMod = require('./redis');
  const myId = redisMod.getMachineId();

  const lines = machines.map(m => {
    const icon = m.status === 'online' ? '🟢' : '🔴';
    const uptimeStr = formatUptime(m.uptime);
    const isMe = m.machineId === myId ? ' (this)' : '';
    const leaderTag = isLeader && m.machineId === myId ? ' 👑' : '';
    return [
      `${icon} <b>${m.machineId}</b>${isMe}${leaderTag}`,
      `   Uptime: ${uptimeStr}`,
      `   Processes: ${m.processCount}/${m.processTotal} online`,
      `   Platform: ${m.platform} (${m.nodeVersion})`,
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

async function handleEnvToken(chatId) {
  const redis = require('./redis').getClient();
  if (!redis) {
    return sendMessage(chatId, '❌ Redis 未設定，無法生成 token');
  }

  try {
    const crypto = require('crypto');
    const token = crypto.randomBytes(32).toString('hex');
    const key = `cloudpipe:envtoken:${token}`;
    await redis.set(key, 'valid', 'EX', 300);

    const config = JSON.parse(require('fs').readFileSync(
      require('path').join(__dirname, '../../config.json'), 'utf8'
    ));
    const domain = config.domain || 'localhost';
    const subdomain = config.subdomain || 'epi';

    const fullUrl = `https://${subdomain}.${domain}/api/_admin/env-bundle/download?token=${token}`;

    const text = [
      '🔑 <b>.env 下載 Token 已生成</b>',
      '',
      '<b>5 分鐘內有效，用一次就作廢</b>',
      '',
      '新機器執行（複製整行）：',
      `<code>node setup-env.js ${fullUrl}</code>`,
    ].join('\n');

    await sendMessage(chatId, text);
  } catch (err) {
    await sendMessage(chatId, `❌ 生成失敗: ${err.message}`);
  }
}

// ==================== Gateway Commands ====================

async function handleTools(chatId, projectFilter) {
  let gateway
  try {
    gateway = require('./gateway')
  } catch {
    return sendMessage(chatId, 'Gateway module not available.')
  }

  const allTools = gateway.getTools()
  if (allTools.length === 0) {
    await gateway.refreshTools()
  }

  let tools = gateway.getTools()
  if (projectFilter) {
    tools = tools.filter(t => t.project === projectFilter)
  }

  if (tools.length === 0) {
    const msg = projectFilter
      ? `No tools found for project <code>${projectFilter}</code>.`
      : 'No tools discovered. Check that projects are running.'
    return sendMessage(chatId, msg)
  }

  // Group by project
  const byProject = {}
  for (const t of tools) {
    const key = t.project || 'unknown'
    if (!byProject[key]) byProject[key] = []
    byProject[key].push(t)
  }

  const lines = []
  for (const [project, projectTools] of Object.entries(byProject)) {
    lines.push(`<b>${project}</b> (${projectTools.length})`)
    for (const t of projectTools) {
      lines.push(`  <code>${t.name}</code> — ${t.method} ${t.path}`)
    }
    lines.push('')
  }

  lines.push(`Total: ${tools.length} tools`)
  await sendMessage(chatId, lines.join('\n'))
}

async function handleCall(chatId, args) {
  if (args.length === 0) {
    return sendMessage(chatId, 'Usage: /call &lt;tool_name&gt; key=value key=value\n\nExample: <code>/call meetube_search q=React</code>')
  }

  const toolName = args[0]
  const params = {}
  for (let i = 1; i < args.length; i++) {
    const eqIdx = args[i].indexOf('=')
    if (eqIdx > 0) {
      const key = args[i].slice(0, eqIdx)
      const val = args[i].slice(eqIdx + 1)
      params[key] = val
    }
  }

  let gateway
  try {
    gateway = require('./gateway')
  } catch {
    return sendMessage(chatId, 'Gateway module not available.')
  }

  await sendMessage(chatId, `Calling <code>${toolName}</code>...`)

  try {
    const result = await gateway.callToolByName(toolName, params)

    if (!result.ok) {
      return sendMessage(chatId, `HTTP ${result.status}: <pre>${JSON.stringify(result.data, null, 2).slice(0, 3000)}</pre>`)
    }

    const output = typeof result.data === 'string'
      ? result.data.slice(0, 3000)
      : JSON.stringify(result.data, null, 2).slice(0, 3000)

    await sendMessage(chatId, `<pre>${output}</pre>`)
  } catch (err) {
    await sendMessage(chatId, `Error: ${err.message}`)
  }
}

async function handlePipe(chatId, args) {
  if (args.length === 0) {
    return sendMessage(chatId, 'Usage: /pipe &lt;pipeline_id&gt; key=value\n\nExample: <code>/pipe youtube-to-flashcards query=React</code>')
  }

  const pipelineId = args[0]
  const input = {}
  for (let i = 1; i < args.length; i++) {
    const eqIdx = args[i].indexOf('=')
    if (eqIdx > 0) {
      const key = args[i].slice(0, eqIdx)
      const val = args[i].slice(eqIdx + 1)
      input[key] = val
    }
  }

  let pipeline
  try {
    pipeline = require('./pipeline')
  } catch {
    return sendMessage(chatId, 'Pipeline module not available.')
  }

  const def = pipeline.getPipeline(pipelineId)
  if (!def) {
    const available = pipeline.listPipelines()
    const ids = available.map(p => `<code>${p.id}</code>`).join(', ')
    return sendMessage(chatId, `Pipeline not found: <code>${pipelineId}</code>\n\nAvailable: ${ids || 'none'}`)
  }

  await sendMessage(chatId, `Running pipeline <b>${def.name || pipelineId}</b>...`)

  try {
    const result = await pipeline.execute(def, input)

    if (!result.success) {
      return sendMessage(chatId, `Pipeline failed at step <code>${result.failedAt}</code>:\n${result.error}`)
    }

    const output = typeof result.result === 'string'
      ? result.result.slice(0, 3000)
      : JSON.stringify(result.result, null, 2).slice(0, 3000)

    const stepSummary = Object.entries(result.steps)
      .map(([id, s]) => `  ${s.ok ? '✅' : '❌'} ${id} (${s.tool})`)
      .join('\n')

    await sendMessage(chatId, `<b>Pipeline complete</b>\n\nSteps:\n${stepSummary}\n\nResult:\n<pre>${output}</pre>`)
  } catch (err) {
    await sendMessage(chatId, `Pipeline error: ${err.message}`)
  }
}

async function handleHelp(chatId) {
  const text = [
    '<b>CloudPipe Bot 指令</b>',
    '',
    '/projects — 專案列表（點擊開啟）',
    '/status — 狀態總覽（多機 + 部署資訊）',
    '/machines — 各機器詳細資訊',
    '/deploy &lt;id&gt; — 觸發部署',
    '/restart &lt;id&gt; — 重啟服務（PM2 restart）',
    '/tools [project] — 列出可用工具',
    '/call &lt;tool&gt; key=value — 呼叫工具',
    '/pipe &lt;pipeline&gt; key=value — 執行 pipeline',
    '/upload — 圖片 caption 加 /upload → 上傳到 duk.tw',
    '/envtoken — 生成 .env token（給新機器）',
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

  // Upload mode off button
  if (data === 'upload:off') {
    uploadMode = false;
    await answerCallback(queryId, '已關閉');
    return editMessage(chatId, messageId, '📸 上傳模式已關閉');
  }

  // Quick action buttons
  if (data === 'quick:status') {
    await answerCallback(queryId);
    return handleStatus(chatId);
  }
  if (data === 'quick:projects') {
    await answerCallback(queryId);
    return handleProjects(chatId);
  }
  if (data === 'quick:machines') {
    await answerCallback(queryId);
    return handleMachines(chatId);
  }

  await answerCallback(queryId);
}

// ==================== Photo Upload ====================

async function handlePhoto(chatId, message) {
  // 1. Get file_id (photo = array of sizes, take largest; document = single file)
  const fileId = message.photo
    ? message.photo[message.photo.length - 1].file_id
    : message.document.file_id
  const fileName = message.document?.file_name || `photo_${Date.now()}.jpg`

  // 2. Send "uploading..." feedback
  const statusMsg = await sendMessage(chatId, '⏳ 上傳中...')
  if (!statusMsg?.result?.message_id) {
    return sendMessage(chatId, '❌ 無法傳送狀態訊息')
  }
  const statusMsgId = statusMsg.result.message_id

  try {
    // 3. Get file path from Telegram
    const fileInfo = await apiCall('getFile', { file_id: fileId })
    if (!fileInfo?.result?.file_path) {
      return editMessage(chatId, statusMsgId, '❌ 無法取得檔案')
    }

    // 4. Download from Telegram (through tg-proxy)
    const config = getFullConfig()
    const { botToken } = getConfig()
    const proxyBase = config.telegramProxy
      ? config.telegramProxy.replace(/\/+$/, '')
      : 'https://api.telegram.org'
    const fileUrl = `${proxyBase}/file/bot${botToken}/${fileInfo.result.file_path}`

    const fileRes = await fetch(fileUrl)
    if (!fileRes.ok) {
      return editMessage(chatId, statusMsgId, '❌ 下載失敗')
    }

    // 5. Upload to Upimg via multipart form-data
    const buffer = Buffer.from(await fileRes.arrayBuffer())
    const blob = new Blob([buffer], { type: message.document?.mime_type || 'image/jpeg' })

    const formData = new FormData()
    formData.append('image', blob, fileName)

    const upimgPort = 4007
    const uploadHeaders = {}
    const upimgKey = process.env.UPLOAD_API_KEY
    if (upimgKey) {
      uploadHeaders['x-api-key'] = upimgKey
    }

    const uploadRes = await fetch(`http://localhost:${upimgPort}/api/upload`, {
      method: 'POST',
      headers: uploadHeaders,
      body: formData,
    })

    if (!uploadRes.ok) {
      const err = await uploadRes.text().catch(() => 'unknown')
      return editMessage(chatId, statusMsgId, `❌ 上傳失敗: ${err}`)
    }

    // 6. Parse result and reply
    const data = await uploadRes.json()
    const shortUrl = data.shortUrl || `https://duk.tw/${data.result}`

    return editMessage(chatId, statusMsgId,
      `✅ <a href="${shortUrl}">${shortUrl}</a>`,
      { disable_web_page_preview: false }
    )
  } catch (err) {
    return editMessage(chatId, statusMsgId, `❌ 上傳失敗: ${err.message}`)
  }
}

// ==================== Update Handler ====================

async function handleUpdate(update) {
  if (update.callback_query) {
    return handleCallback(update.callback_query);
  }

  const message = update.message;

  // Photo upload: when upload mode is active
  const hasImage = message && (message.photo || (message.document && message.document.mime_type?.startsWith('image/')))
  if (hasImage && uploadMode) {
    const chatId = message.chat.id
    if (!isAuthorized(chatId)) return
    return handlePhoto(chatId, message)
  }

  if (!message || !message.text) return;

  const chatId = message.chat.id;
  if (!isAuthorized(chatId)) return;

  const text = message.text.trim();
  const [rawCommand, ...args] = text.split(/\s+/);
  const command = rawCommand.toLowerCase();

  switch (command) {
    case '/start':
      return handleStart(chatId);
    case '/projects':
      return handleProjects(chatId);
    case '/status':
      return handleStatus(chatId);
    case '/machines':
      return handleMachines(chatId);
    case '/deploy':
      return handleDeploy(chatId, args[0]);
    case '/restart':
      return handleRestart(chatId, args[0]);
    case '/tools':
      return handleTools(chatId, args[0]);
    case '/call':
      return handleCall(chatId, args);
    case '/pipe':
      return handlePipe(chatId, args);
    case '/upload': {
      // Reply to a photo → upload that photo directly
      const reply = message.reply_to_message
      const replyHasImage = reply && (reply.photo || (reply.document && reply.document.mime_type?.startsWith('image/')))
      if (replyHasImage) {
        return handlePhoto(chatId, reply)
      }

      // Otherwise toggle upload mode
      uploadMode = !uploadMode
      if (uploadMode) {
        return sendMessage(chatId, '📸 <b>上傳模式已開啟</b>\n直接傳圖片就會上傳到 duk.tw', {
          reply_markup: {
            inline_keyboard: [[
              { text: '關閉上傳模式', callback_data: 'upload:off' },
            ]],
          },
        })
      }
      return sendMessage(chatId, '📸 上傳模式已關閉')
    }
    case '/envtoken':
      return handleEnvToken(chatId);
    case '/help':
      return handleHelp(chatId);
    default:
      // 未知指令或純文字 → 提示
      if (text.startsWith('/')) {
        return sendMessage(chatId, `❓ 不認識的指令 <code>${command}</code>\n\n輸入 /help 查看可用指令`);
      }
      return sendMessage(chatId, '💡 輸入 / 可以看到指令選單，或試試 /status', {
        reply_markup: {
          inline_keyboard: [[
            { text: '📊 狀態', callback_data: 'quick:status' },
            { text: '📁 專案', callback_data: 'quick:projects' },
            { text: '🖥 機器', callback_data: 'quick:machines' },
          ]],
        },
      });
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

// ==================== Leader Election ====================

async function tryAcquireLeadership() {
  const redis = require('./redis').getClient();
  const machineId = require('./redis').getMachineId();
  if (!redis) return false;

  try {
    // SET NX: 只在 key 不存在時設定
    const result = await redis.set(LEADER_KEY, machineId, 'EX', LEADER_TTL, 'NX');
    if (result === 'OK') {
      return true;
    }

    // 檢查是不是自己持有
    const current = await redis.get(LEADER_KEY);
    if (current === machineId) {
      await redis.expire(LEADER_KEY, LEADER_TTL);
      return true;
    }

    return false;
  } catch (err) {
    console.error('[Telegram] Leader election error:', err.message);
    return false;
  }
}

async function startWithLeaderElection() {
  const config = getConfig();
  if (!config.enabled || !config.botToken || !config.chatId) {
    console.log('[Telegram] Not configured, skipping');
    return;
  }

  // 先訂閱部署通知（所有機器都要）
  deploy.events.on('deploy:complete', onDeployComplete);

  // 嘗試成為 leader
  const gotLeadership = await tryAcquireLeadership();
  if (gotLeadership) {
    console.log('[Telegram] This machine is the bot leader 👑');
    isLeader = true;
    await clearStaleConnections();
    await registerCommands();
    polling = true;
    poll();
  } else {
    console.log('[Telegram] Another machine is bot leader, notification-only');
    isLeader = false;
  }

  // 每 30 秒檢查 leadership
  leaderInterval = setInterval(async () => {
    const wasLeader = isLeader;
    isLeader = await tryAcquireLeadership();

    if (!wasLeader && isLeader) {
      console.log('[Telegram] Acquired bot leadership 👑');
      await clearStaleConnections();
      await registerCommands();
      polling = true;
      poll();
    } else if (wasLeader && !isLeader) {
      console.log('[Telegram] Lost bot leadership, notification-only');
      polling = false;
      if (pollTimeout) {
        clearTimeout(pollTimeout);
        pollTimeout = null;
      }
    }
  }, 30000);

  const redisMod = require('./redis');
  console.log(`[Telegram] Leader election active (${redisMod.getMachineId()})`);
}

// ==================== Deploy Notification ====================

function onDeployComplete({ project, deployment }) {
  const config = getConfig();
  if (!config.enabled || !config.botToken || !config.chatId) return;

  const domain = getDomain();
  const duration = deployment.duration ? `${(deployment.duration / 1000).toFixed(1)}s` : '?';
  const redisMod = require('./redis');
  const machineTag = redisMod.getMachineId() || '';

  const text = deployment.status === 'success'
    ? [
        `✅ <b>[部署成功] ${project.name || project.id}</b>`,
        `Commit: <code>${deployment.commit || '-'}</code>`,
        deployment.commitMessage ? `${deployment.commitMessage}` : '',
        `耗時: ${duration} | 機器: ${machineTag}`,
        `🔗 https://${project.id}.${domain}`,
      ].filter(Boolean).join('\n')
    : [
        `❌ <b>[部署失敗] ${project.name || project.id}</b>`,
        `錯誤: ${deployment.error || '未知'}`,
        `觸發: ${deployment.triggeredBy || 'unknown'} | 機器: ${machineTag}`,
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
  await registerCommands();

  polling = true;
  poll();

  deploy.events.on('deploy:complete', onDeployComplete);

  console.log(`[Telegram] Bot 已啟動 (chatId: ${config.chatId})`);
}

function stopBot() {
  polling = false;
  pollInFlight = false;
  isLeader = false;

  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
  if (leaderInterval) {
    clearInterval(leaderInterval);
    leaderInterval = null;
  }

  // 釋放 leadership
  try {
    const redis = require('./redis').getClient();
    const machineId = require('./redis').getMachineId();
    if (redis) {
      redis.get(LEADER_KEY).then(current => {
        if (current === machineId) {
          redis.del(LEADER_KEY);
        }
      }).catch(() => {});
    }
  } catch {
    // redis 可能還沒載入
  }

  deploy.events.removeListener('deploy:complete', onDeployComplete);
  console.log('[Telegram] Bot 已停止');
}

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
  startWithLeaderElection,
  sendMessage,
  getConfig,
};
