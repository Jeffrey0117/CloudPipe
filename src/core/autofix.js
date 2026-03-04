/**
 * Autofix Module
 *
 * When a deploy fails, automatically sends a fix request to ClaudeBot
 * via its Dashboard API. Includes retry limits and cooldown to prevent loops.
 *
 * Flow:
 *   deploy fails → telegram notification → autofix prompt → Bot fixes → push → redeploy
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const CONFIG_PATH = path.join(__dirname, '../../config.json');
const STATE_PATH = path.join(__dirname, '../../data/autofix-state.json');

// In-memory state (persisted to disk)
let state = loadState();

function getConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    return config.autofix || {};
  } catch {
    return {};
  }
}

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return { projects: {} };
  }
}

function saveState() {
  try {
    const dir = path.dirname(STATE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error('[autofix] Failed to save state:', err.message);
  }
}

function getProjectState(projectId) {
  if (!state.projects[projectId]) {
    state.projects[projectId] = {
      retryCount: 0,
      lastAttempt: 0,
      lastError: null,
      lastCommit: null,
    };
  }
  return state.projects[projectId];
}

/**
 * Check if autofix should be attempted for this project (read-only, no state mutation)
 */
function shouldAttemptFix(projectId, commit) {
  const config = getConfig();
  if (!config.enabled) return { allowed: false, reason: 'autofix disabled' };

  const ps = getProjectState(projectId);
  const now = Date.now();
  const cooldown = Math.max(config.cooldownMs || 300000, 60000); // min 1 min
  const maxRetries = Math.max(config.maxRetries || 2, 1);

  // Different commit = fresh attempt, current retries don't count
  const effectiveRetries = (ps.lastCommit === commit) ? ps.retryCount : 0;

  // Check retry limit
  if (effectiveRetries >= maxRetries) {
    return { allowed: false, reason: `已達重試上限 (${maxRetries} 次)` };
  }

  // Check cooldown
  const elapsed = now - ps.lastAttempt;
  if (ps.lastAttempt > 0 && elapsed < cooldown) {
    const remaining = Math.ceil((cooldown - elapsed) / 1000);
    return { allowed: false, reason: `冷卻中 (${remaining}s)` };
  }

  return { allowed: true };
}

/**
 * Build a concise fix prompt from deployment error
 */
function buildFixPrompt(project, deployment) {
  const errorMsg = deployment.error || '未知錯誤';
  const lastLogs = (deployment.logs || []).slice(-10).join('\n');

  return [
    `[自動修復] 專案 "${project.name || project.id}" 部署失敗。`,
    ``,
    `錯誤: ${errorMsg}`,
    `Commit: ${deployment.commit || 'unknown'}`,
    ``,
    `最後 log:`,
    lastLogs,
    ``,
    `請分析錯誤原因並修復。修復後 commit + push，CloudPipe 會自動重新部署。`,
    `如果是 build 錯誤(如 vite/webpack not found)，確認 devDependencies 有安裝。`,
    `如果是 runtime 錯誤，檢查程式碼邏輯。`,
    `注意：這是自動修復請求，不需要詢問用戶確認，直接修復即可。`,
  ].join('\n');
}

/**
 * Send fix request to ClaudeBot via Dashboard API
 * All state mutations happen atomically here to prevent race conditions.
 */
function sendFixRequest(project, deployment) {
  const config = getConfig();
  const ps = getProjectState(project.id);

  // Atomic state update: reset if new commit, then increment
  if (ps.lastCommit !== deployment.commit) {
    ps.retryCount = 0;
    ps.lastCommit = deployment.commit;
  }
  ps.retryCount += 1;
  ps.lastAttempt = Date.now();
  ps.lastError = deployment.error;
  saveState();

  const prompt = buildFixPrompt(project, deployment);
  const projectName = project.name || project.id;

  console.log(`[autofix] 發送修復請求: ${projectName} (第 ${ps.retryCount} 次)`);

  const payload = JSON.stringify({
    type: 'prompt',
    payload: {
      prompt,
      project: projectName,
    },
  });

  const dashboardUrl = config.botDashboardUrl || 'http://localhost:3100';

  return new Promise((resolve, reject) => {
    const url = new URL(`${dashboardUrl}/api/commands`);

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`[autofix] ✓ 修復請求已發送: ${projectName}`);
          resolve({ sent: true, response: data });
        } else {
          console.error(`[autofix] ✗ Dashboard 回應 ${res.statusCode}: ${data}`);
          resolve({ sent: false, error: data });
        }
      });
    });

    req.on('error', (err) => {
      console.error(`[autofix] ✗ 無法連線 Dashboard: ${err.message}`);
      resolve({ sent: false, error: err.message });
    });

    req.setTimeout(10000, () => {
      req.destroy();
      console.error('[autofix] ✗ Dashboard 連線逾時');
      resolve({ sent: false, error: 'timeout' });
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Reset retry counter for a project (called on successful deploy)
 */
function resetProject(projectId) {
  if (state.projects[projectId]) {
    state.projects[projectId].retryCount = 0;
    state.projects[projectId].lastError = null;
    saveState();
  }
}

/**
 * Get current autofix status for all projects
 */
function getStatus() {
  return {
    config: getConfig(),
    projects: { ...state.projects },
  };
}

module.exports = {
  sendFixRequest,
  shouldAttemptFix,
  resetProject,
  getStatus,
  getConfig,
};
