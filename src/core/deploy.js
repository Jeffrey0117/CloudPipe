/**
 * Cloudpipe 部署引擎
 *
 * 功能：
 * - 專案管理 (CRUD)
 * - Git 部署 (pull + pm2 reload)
 * - 上傳部署 (解壓 ZIP)
 * - 部署記錄
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const crypto = require('crypto');
const { EventEmitter } = require('events');

const events = new EventEmitter();

// Per-project deploy locks to prevent concurrent deploys
const deployLocks = new Map();

const DATA_DIR = path.join(__dirname, '../../data/deploy');
const PROJECTS_FILE = path.join(DATA_DIR, 'projects.json');
const DEPLOYMENTS_FILE = path.join(DATA_DIR, 'deployments.json');
const CLOUDPIPE_ROOT = path.join(__dirname, '../..');

// Cloudflare Tunnel 設定（從 config.json 讀取）
const CLOUDFLARED_CONFIG = path.join(__dirname, '../../cloudflared.yml');
function getCloudflared() {
  const config = getConfig();
  return {
    path: config.cloudflared?.path || 'cloudflared',
    tunnelId: config.cloudflared?.tunnelId || '',
  };
}

// Port 分配設定
const BASE_PORT = 4000;  // 起始 port

// 讀取 config.json
const CONFIG_PATH = path.join(__dirname, '../../config.json');
function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

// ==================== 資料存取 ====================

function readProjects() {
  try {
    return JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8')).projects || [];
  } catch {
    return [];
  }
}

function writeProjects(projects) {
  fs.writeFileSync(PROJECTS_FILE, JSON.stringify({ projects }, null, 2));
}

function readDeployments() {
  try {
    return JSON.parse(fs.readFileSync(DEPLOYMENTS_FILE, 'utf8')).deployments || [];
  } catch {
    return [];
  }
}

function writeDeployments(deployments) {
  fs.writeFileSync(DEPLOYMENTS_FILE, JSON.stringify({ deployments }, null, 2));
}

// 檢查端口是否可用
function isPortAvailable(port) {
  const net = require('net');
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

// 取得下一個可用 port（真正檢查端口是否被佔用）
async function getNextAvailablePort() {
  const projects = readProjects();
  const usedPorts = projects
    .filter(p => p.port)
    .map(p => p.port);

  let startPort = BASE_PORT + 1;
  if (usedPorts.length > 0) {
    startPort = Math.max(...usedPorts) + 1;
  }

  for (let port = startPort; port < startPort + 100; port++) {
    const available = await isPortAvailable(port);
    if (available) return port;
  }

  throw new Error(`在 ${startPort}-${startPort + 100} 範圍內找不到可用端口`);
}

// ==================== 專案管理 ====================

function getProject(id) {
  return readProjects().find(p => p.id === id);
}

function getAllProjects() {
  return readProjects();
}

async function createProject(data) {
  const projects = readProjects();

  // 檢查 ID 是否已存在
  if (projects.find(p => p.id === data.id)) {
    throw new Error(`專案 ID "${data.id}" 已存在`);
  }

  // Git 部署或 Node app 自動分配 port
  const deployMethod = data.deployMethod || 'manual';
  const needsPort = deployMethod === 'github' || deployMethod === 'git-url' || deployMethod === 'upload-app';
  const autoPort = needsPort ? await getNextAvailablePort() : null;

  const project = {
    id: data.id,
    name: data.name || data.id,
    description: data.description || '',
    deployMethod,
    repoUrl: data.repoUrl || '',
    branch: data.branch || 'main',
    directory: data.directory || `../workhub/${data.id}`,
    entryFile: data.entryFile || 'index.js',
    port: data.port || autoPort,  // 自動分配或手動指定
    pm2Name: data.pm2Name || data.id,
    webhookSecret: data.webhookSecret || crypto.randomBytes(20).toString('hex'),
    envFile: data.envFile || '',
    buildCommand: data.buildCommand || '',
    createdAt: new Date().toISOString(),
    lastDeployAt: null,
    lastDeployStatus: null
  };

  projects.push(project);
  writeProjects(projects);

  // GitHub 專案自動設定 webhook
  if (deployMethod === 'github' && project.repoUrl) {
    const config = getConfig();
    const domain = config.domain || 'isnowfriend.com';
    const subdomain = config.subdomain || 'epi';
    const webhookUrl = `https://${subdomain}.${domain}/webhook/${project.id}`;

    // 非同步設定，不阻塞 createProject
    setupGitHubWebhook(project.id, webhookUrl).then(result => {
      if (result.success) {
        console.log(`[deploy] 自動設定 webhook: ${project.id}`);
      }
    }).catch(err => {
      console.log(`[deploy] Webhook 設定失敗 (可稍後手動設定): ${err.message}`);
    });
  }

  return project;
}

function updateProject(id, data) {
  const projects = readProjects();
  const index = projects.findIndex(p => p.id === id);

  if (index === -1) {
    throw new Error(`專案 "${id}" 不存在`);
  }

  // 不允許修改 id 和 createdAt
  const { id: _, createdAt: __, ...updateData } = data;
  projects[index] = { ...projects[index], ...updateData };
  writeProjects(projects);

  return projects[index];
}

function deleteProject(id) {
  const projects = readProjects();
  const filtered = projects.filter(p => p.id !== id);

  if (filtered.length === projects.length) {
    throw new Error(`專案 "${id}" 不存在`);
  }

  writeProjects(filtered);
  return true;
}

// ==================== Cloudflare Tunnel Ingress ====================

/**
 * 更新 cloudflared.yml，加入專案的 ingress 規則
 * - 自動為含萬用字元 (*) 的 hostname 加上引號
 * - 重複 hostname 偵測
 * - 寫入前備份 + YAML 驗證
 */
function updateTunnelIngress(hostname, port) {
  try {
    if (!fs.existsSync(CLOUDFLARED_CONFIG)) {
      console.log(`[deploy] cloudflared.yml 不存在，跳過 ingress 更新`);
      return false;
    }

    let content = fs.readFileSync(CLOUDFLARED_CONFIG, 'utf8');

    // 重複 hostname 偵測：從 YAML 提取所有 hostname，剝掉引號後純文字比對
    const existingHostnames = (content.match(/hostname:\s*"?([^"\n]+)"?/g) || [])
      .map(m => m.replace(/hostname:\s*"?/, '').replace(/"?\s*$/, '').trim());
    if (existingHostnames.includes(hostname)) {
      console.log(`[deploy] Ingress 已存在: ${hostname}`);
      return true;
    }

    // 備份 cloudflared.yml
    const backupPath = CLOUDFLARED_CONFIG + '.bak';
    fs.writeFileSync(backupPath, content);

    // 為含萬用字元的 hostname 加引號
    const formattedHostname = hostname.includes('*') ? `"${hostname}"` : hostname;

    // 在 "*.<domain>" 之前插入新規則
    const domain = (getConfig().domain || 'isnowfriend.com').replace(/\./g, '\\.');
    const wildcardPattern = new RegExp(`(\\s*- hostname: "\\*\\.${domain}")`);
    const newRule = `\n  - hostname: ${formattedHostname}\n    service: http://localhost:${port}`;

    if (wildcardPattern.test(content)) {
      content = content.replace(wildcardPattern, newRule + '$1');
    } else {
      // 如果沒有通配符規則，在最後一個 service: http_status:404 之前插入
      const fallbackPattern = /(\s*- service: http_status:404)/;
      content = content.replace(fallbackPattern, newRule + '$1');
    }

    // YAML 驗證：嘗試解析修改後的 YAML 確認格式正確
    try {
      const yaml = require('yaml');
      yaml.parse(content);
    } catch (yamlErr) {
      console.error(`[deploy] YAML 驗證失敗，還原備份: ${yamlErr.message}`);
      // 還原備份
      fs.writeFileSync(CLOUDFLARED_CONFIG, fs.readFileSync(backupPath, 'utf8'));
      return false;
    }

    fs.writeFileSync(CLOUDFLARED_CONFIG, content);
    console.log(`[deploy] Ingress 已新增: ${hostname} -> localhost:${port}`);

    // cloudflared ingress validate — 用 cloudflared 本身驗證規則結構
    const cfPath = getCloudflared().path;
    try {
      execSync(`"${cfPath}" tunnel --config "${CLOUDFLARED_CONFIG}" ingress validate`, {
        stdio: 'pipe', windowsHide: true, timeout: 10000
      });
      console.log(`[deploy] cloudflared ingress validate 通過`);
    } catch (validateErr) {
      const stderr = validateErr.stderr ? validateErr.stderr.toString().trim() : validateErr.message;
      console.error(`[deploy] cloudflared ingress validate 失敗，還原備份: ${stderr}`);
      fs.writeFileSync(CLOUDFLARED_CONFIG, fs.readFileSync(backupPath, 'utf8'));
      return false;
    }

    // 驗證通過才重啟 tunnel
    try {
      execSync('pm2 restart tunnel', { stdio: 'pipe', windowsHide: true });
      console.log(`[deploy] Tunnel 已重啟`);
    } catch (e) {
      console.log(`[deploy] Tunnel 重啟失敗: ${e.message}`);
    }

    return true;
  } catch (e) {
    console.error(`[deploy] 更新 ingress 失敗:`, e.message);
    // 嘗試從備份還原
    const backupPath = CLOUDFLARED_CONFIG + '.bak';
    if (fs.existsSync(backupPath)) {
      try {
        fs.writeFileSync(CLOUDFLARED_CONFIG, fs.readFileSync(backupPath, 'utf8'));
        console.log(`[deploy] 已從備份還原 cloudflared.yml`);
      } catch {}
    }
    return false;
  }
}

// ==================== Health Check ====================

/**
 * 執行 Health Check，確認服務啟動
 * @param {number} port - 服務 port
 * @param {string} endpoint - 檢查的 endpoint（預設 /health）
 * @param {function} log - log 函數
 * @param {number} retries - 重試次數（預設 3）
 * @param {number} delay - 重試間隔 ms（預設 2000）
 */
async function performHealthCheck(port, endpoint = '/health', log, retries = 5, delay = 3000) {
  const http = require('http');
  const url = `http://localhost:${port}${endpoint}`;

  for (let i = 0; i < retries; i++) {
    // 等待服務啟動
    await new Promise(r => setTimeout(r, delay));

    try {
      const result = await new Promise((resolve, reject) => {
        const req = http.get(url, { timeout: 5000 }, (res) => {
          // 任何 HTTP 回應都代表服務已啟動（404、401 等只是沒有該路由，不代表沒跑）
          res.resume();
          resolve(true);
        });
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Timeout'));
        });
      });

      if (result) return true;
    } catch (e) {
      log(`Health Check 嘗試 ${i + 1}/${retries} 失敗: ${e.message}`);
    }
  }

  return false;
}

// ==================== 部署引擎 ====================

/**
 * 解析專案目錄路徑（統一處理絕對路徑和相對路徑）
 */
function resolveProjectDir(project) {
  if (path.isAbsolute(project.directory)) {
    return path.normalize(project.directory);
  } else {
    return path.join(CLOUDPIPE_ROOT, project.directory);
  }
}

function generateDeployId() {
  return 'deploy_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

async function deploy(projectId, options = {}) {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`專案 "${projectId}" 不存在`);
  }

  // ===== Deploy Lock: prevent concurrent deploys for same project =====
  if (deployLocks.get(projectId)) {
    console.log(`[deploy:${projectId}] 已有部署正在進行，跳過`);
    return { id: null, status: 'skipped', error: 'Deploy already in progress' };
  }
  deployLocks.set(projectId, true);

  // ===== Clean up stale "building" records (older than 10 min) =====
  const allDeploys = readDeployments();
  const STALE_THRESHOLD = 10 * 60 * 1000;
  let cleanedStale = false;
  for (const d of allDeploys) {
    if (d.projectId === projectId && d.status === 'building') {
      const age = Date.now() - new Date(d.startedAt).getTime();
      if (age > STALE_THRESHOLD) {
        d.status = 'failed';
        d.error = 'Stale build (auto-cleaned after 10min)';
        d.finishedAt = new Date().toISOString();
        d.duration = age;
        cleanedStale = true;
      }
    }
  }
  if (cleanedStale) writeDeployments(allDeploys);

  const deployId = generateDeployId();
  const startedAt = new Date().toISOString();
  const logs = [];

  const log = (msg) => {
    const timestamp = new Date().toISOString();
    logs.push(`[${timestamp}] ${msg}`);
    console.log(`[deploy:${projectId}] ${msg}`);
  };

  // 建立部署記錄
  const deployment = {
    id: deployId,
    projectId,
    status: 'building',
    commit: null,
    commitMessage: null,
    branch: project.branch,
    startedAt,
    finishedAt: null,
    duration: null,
    logs: [],
    triggeredBy: options.triggeredBy || 'manual',
    error: null
  };

  const deployments = readDeployments();
  deployments.unshift(deployment);
  writeDeployments(deployments);

  try {
    const projectDir = resolveProjectDir(project);

    log(`開始部署專案: ${project.name}`);
    log(`專案目錄: ${projectDir}`);

    // 確保目錄存在
    if (!fs.existsSync(projectDir)) {
      if (project.deployMethod === 'github' || project.deployMethod === 'git-url') {
        // Clone repo（不指定 branch，自動用 repo 預設 branch）
        log(`目錄不存在，執行 git clone...`);
        const parentDir = path.dirname(projectDir);
        if (!fs.existsSync(parentDir)) {
          fs.mkdirSync(parentDir, { recursive: true });
        }
        execSync(`git clone ${project.repoUrl} ${path.basename(projectDir)}`, {
          cwd: parentDir,
          stdio: 'pipe',
          windowsHide: true
        });
        // 自動偵測實際使用的 branch 並更新配置
        const actualBranch = execSync('git branch --show-current', { cwd: projectDir, windowsHide: true }).toString().trim();
        if (actualBranch && actualBranch !== project.branch) {
          log(`偵測到預設 branch: ${actualBranch}（原設定: ${project.branch}）`);
          updateProject(project.id, { branch: actualBranch });
          project.branch = actualBranch;
        }
        log(`Clone 完成 (branch: ${project.branch})`);
      } else {
        fs.mkdirSync(projectDir, { recursive: true });
        log(`建立目錄: ${projectDir}`);
      }
    }

    // Git 部署
    if (project.deployMethod === 'github' || project.deployMethod === 'git-url') {
      // Backup env files before git reset (they're not in git and would survive reset,
      // but git clean or other operations could remove them)
      const ENV_PATTERNS = ['.env', '.env.local', '.env.production', '.env.production.local'];
      const envBackups = {};
      for (const envName of ENV_PATTERNS) {
        const envPath = path.join(projectDir, envName);
        if (fs.existsSync(envPath)) {
          envBackups[envName] = fs.readFileSync(envPath);
          log(`備份 ${envName}`);
        }
      }

      log(`執行 git fetch...`);
      execSync(`git fetch origin`, { cwd: projectDir, stdio: 'pipe', windowsHide: true });

      log(`執行 git reset --hard...`);
      execSync(`git reset --hard origin/${project.branch}`, { cwd: projectDir, stdio: 'pipe', windowsHide: true });

      // Restore env files
      for (const [envName, content] of Object.entries(envBackups)) {
        fs.writeFileSync(path.join(projectDir, envName), content);
        log(`還原 ${envName}`);
      }

      // 取得 commit 資訊
      const commitHash = execSync('git rev-parse --short HEAD', { cwd: projectDir, windowsHide: true }).toString().trim();
      const commitMessage = execSync('git log -1 --pretty=%B', { cwd: projectDir, windowsHide: true }).toString().trim();

      deployment.commit = commitHash;
      deployment.commitMessage = commitMessage;
      log(`Commit: ${commitHash} - ${commitMessage}`);
    }

    // Python 依賴安裝（runner: python）
    const isPython = project.runner === 'python';
    if (isPython) {
      const reqPath = path.join(projectDir, 'requirements.txt');
      if (fs.existsSync(reqPath)) {
        log('安裝 Python 依賴...');
        try {
          execSync(`pip install -r "${reqPath}"`, { cwd: projectDir, stdio: 'pipe', windowsHide: true, timeout: 300000 });
          log('Python 依賴安裝完成');
        } catch (e) {
          log(`⚠ Python 依賴安裝失敗: ${e.message}`);
        }
      }
    }

    // 偵測 package manager
    const pkgPath = path.join(projectDir, 'package.json');
    const hasPnpmLock = fs.existsSync(path.join(projectDir, 'pnpm-lock.yaml'));
    const hasYarnLock = fs.existsSync(path.join(projectDir, 'yarn.lock'));
    const pm = hasPnpmLock ? 'pnpm' : hasYarnLock ? 'yarn' : 'npm';

    // === Kill process BEFORE cleaning Prisma cache (critical for Windows) ===
    let killedOldProcess = false;
    let portPid = null;
    if (project.port) {
      try {
        log(`檢查 port ${project.port} 是否被佔用...`);
        const netstat = execSync(`netstat -ano | findstr :${project.port}`, { windowsHide: true }).toString();
        const lines = netstat.split('\n').filter(l => l.includes('LISTENING'));
        if (lines.length > 0) {
          portPid = lines[0].trim().split(/\s+/).pop();
          log(`Port ${project.port} 被 PID ${portPid} 佔用，嘗試關閉...`);
          try {
            execSync(`taskkill /F /PID ${portPid}`, { windowsHide: true });
            log(`✓ 已關閉 PID ${portPid}`);
            killedOldProcess = true;
            // 等待 3 秒讓 port 和 file handles 完全釋放
            log(`等待 3 秒讓檔案鎖定釋放...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          } catch (killErr) {
            log(`⚠ 無法關閉 PID ${portPid}: ${killErr.message}`);
          }
        } else {
          log(`Port ${project.port} 未被佔用`);
        }
      } catch (err) {
        // netstat 找不到表示 port 沒被佔用，繼續
        log(`Port ${project.port} 未被佔用`);
      }
    }

    // 清理 Prisma cache（在 npm install 之前，避免 EPERM 錯誤）
    // 4 層重試策略：kill port PID → 3s 等待 → pm2 stop → 5s 等待 → force kill port PID
    const prismaPath = path.join(projectDir, 'node_modules', '.prisma');
    if (fs.existsSync(prismaPath)) {
      log(`清理 Prisma cache...`);

      // 檢查 .dll.node 檔案鎖定
      const dllPath = path.join(prismaPath, 'client', 'query_engine-windows.dll.node');
      const isDllLocked = () => {
        if (!fs.existsSync(dllPath)) return false;
        try {
          fs.accessSync(dllPath, fs.constants.W_OK);
          return false;
        } catch {
          return true;
        }
      };

      try {
        if (isDllLocked()) {
          log(`⚠ Prisma DLL 仍被鎖定，等待額外 2 秒...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        fs.rmSync(prismaPath, { recursive: true, force: true });
        log(`✓ Prisma cache 已清理`);
      } catch (cleanErr) {
        log(`⚠ 清理 Prisma cache 失敗 (第 1 次): ${cleanErr.message}`);
        // 第 2 層：等待 3 秒後重試
        log(`等待 3 秒後重試清理...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
        try {
          fs.rmSync(prismaPath, { recursive: true, force: true });
          log(`✓ Prisma cache 重試清理成功 (第 2 次)`);
        } catch (retryErr) {
          log(`⚠ Prisma cache 重試清理失敗 (第 2 次): ${retryErr.message}`);
          // 第 3 層：pm2 stop + 5 秒等待
          if (project.pm2Name) {
            log(`停止 PM2 進程 ${project.pm2Name}...`);
            try {
              execSync(`pm2 stop ${project.pm2Name}`, { stdio: 'pipe', windowsHide: true });
            } catch {}
            log(`等待 5 秒後重試清理...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            try {
              fs.rmSync(prismaPath, { recursive: true, force: true });
              log(`✓ Prisma cache 清理成功 (第 3 次，pm2 stop 後)`);
            } catch (thirdErr) {
              log(`⚠ 第 3 次清理失敗: ${thirdErr.message}`);
              // 第 4 層：重新檢查 port PID 並 force kill
              try {
                const netstat2 = execSync(`netstat -ano | findstr :${project.port}`, { windowsHide: true }).toString();
                const lines2 = netstat2.split('\n').filter(l => l.includes('LISTENING') || l.includes('ESTABLISHED'));
                const pids = [...new Set(lines2.map(l => l.trim().split(/\s+/).pop()).filter(Boolean))];
                for (const pid of pids) {
                  log(`強制結束 PID ${pid}...`);
                  try { execSync(`taskkill /F /PID ${pid}`, { windowsHide: true }); } catch {}
                }
                await new Promise(resolve => setTimeout(resolve, 3000));
                fs.rmSync(prismaPath, { recursive: true, force: true });
                log(`✓ Prisma cache 清理成功 (第 4 次，force kill 後)`);
              } catch (finalErr) {
                log(`❌ 所有 4 層清理嘗試均失敗，建議手動重啟伺服器: ${finalErr.message}`);
              }
            }
          } else {
            log(`⚠ 無法清理 Prisma cache，繼續執行 (可能導致 build 失敗)`);
          }
        }
      }
    }

    // 自動安裝依賴（如果有 package.json）
    if (!isPython && fs.existsSync(pkgPath)) {
      const nodeModulesPath = path.join(projectDir, 'node_modules');
      const lockFiles = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'];
      const lockPath = lockFiles.map(f => path.join(projectDir, f)).find(f => fs.existsSync(f));
      const hashFile = path.join(projectDir, '.pkg-hash');

      // 計算 package.json + lock 的 hash
      const pkgContent = fs.readFileSync(pkgPath, 'utf8');
      const lockContent = lockPath ? fs.readFileSync(lockPath, 'utf8') : '';
      const currentHash = crypto.createHash('md5').update(pkgContent + lockContent).digest('hex');

      // 讀取上次安裝時的 hash
      let lastHash = '';
      if (fs.existsSync(hashFile)) {
        lastHash = fs.readFileSync(hashFile, 'utf8').trim();
      }

      // 檢查是否需要重新安裝
      const needInstall = !fs.existsSync(nodeModulesPath) || currentHash !== lastHash;

      if (needInstall) {
        if (currentHash !== lastHash && lastHash) {
          log(`偵測到依賴變更 (hash changed)，重新安裝...`);
        } else if (!fs.existsSync(nodeModulesPath)) {
          log(`node_modules 不存在，執行安裝...`);
        }
        const installCmd = pm === 'pnpm' ? 'pnpm install' : pm === 'yarn' ? 'yarn install' : 'npm install';
        log(`執行 ${installCmd}...`);
        // NODE_ENV=development 確保 devDependencies 也會安裝（build 工具通常在 devDeps）
        const installEnv = { ...process.env, NODE_ENV: 'development' };
        execSync(installCmd, { cwd: projectDir, stdio: 'pipe', windowsHide: true, env: installEnv });
        // 儲存 hash
        fs.writeFileSync(hashFile, currentHash);
        log(`依賴安裝完成`);
      }

      // Monorepo 偵測：檢查 build script 或 buildCommand 中的 cd <dir>，自動安裝子目錄依賴
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const buildScript = project.buildCommand || pkg.scripts?.build || '';
        const cdMatch = buildScript.match(/cd\s+([^\s&|;]+)/);
        if (cdMatch) {
          const subDir = cdMatch[1];
          const subDirPath = path.join(projectDir, subDir);
          const subPkgPath = path.join(subDirPath, 'package.json');
          const subNodeModules = path.join(subDirPath, 'node_modules');
          if (fs.existsSync(subPkgPath) && !fs.existsSync(subNodeModules)) {
            const subHasPnpmLock = fs.existsSync(path.join(subDirPath, 'pnpm-lock.yaml'));
            const subHasYarnLock = fs.existsSync(path.join(subDirPath, 'yarn.lock'));
            const subPm = subHasPnpmLock ? 'pnpm' : subHasYarnLock ? 'yarn' : 'npm';
            const subInstallCmd = subPm === 'pnpm' ? 'pnpm install' : subPm === 'yarn' ? 'yarn install' : 'npm install';
            log(`偵測到 monorepo 子目錄: ${subDir}/, 執行 ${subInstallCmd}...`);
            const subInstallEnv = { ...process.env, NODE_ENV: 'development' };
            execSync(subInstallCmd, { cwd: subDirPath, stdio: 'pipe', windowsHide: true, env: subInstallEnv });
            log(`${subDir}/ 依賴安裝完成`);
          }
        }
      } catch (e) {
        // ignore monorepo detection errors
      }
    }

    // 執行 build command（手動設定或自動偵測）
    let buildCmd = project.buildCommand;
    if (!buildCmd && fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.scripts?.build) {
          const pmRun = pm === 'pnpm' ? 'pnpm run' : pm === 'yarn' ? 'yarn' : 'npm run';
          buildCmd = `${pmRun} build`;
          log(`偵測到 build script，自動執行`);
        }
      } catch (e) {
        // ignore
      }
    }
    if (buildCmd) {
      // Run build command without NODE_ENV override — Next.js needs NODE_ENV=production
      // The NODE_ENV=development trick is only needed for `npm install` (devDependencies)
      log(`執行 build: ${buildCmd}`);
      try {
        execSync(buildCmd, { cwd: projectDir, stdio: 'pipe', windowsHide: true, timeout: 300000 });
      } catch (buildErr) {
        const stderr = buildErr.stderr ? buildErr.stderr.toString().trim() : '';
        log(`Build stderr: ${stderr || buildErr.message}`);

        // Rollback: if we killed the old process, try to restart it so service isn't down
        if (killedOldProcess && project.pm2Name) {
          log(`⚠ Build 失敗，嘗試重啟舊進程...`);
          try {
            execSync(`pm2 restart ${project.pm2Name}`, { stdio: 'pipe', windowsHide: true });
            log(`✓ 舊進程已重啟 (pm2 restart ${project.pm2Name})`);
          } catch (restartErr) {
            log(`⚠ 重啟舊進程失敗: ${restartErr.message}`);
          }
        }

        throw buildErr;
      }
      log(`Build 完成`);
    }

    // 自動偵測入口檔案或啟動指令
    let entryFile = project.entryFile;
    let startCommand = null;  // 框架專案用啟動指令代替入口檔案
    let useInterpreterNone = false;  // Python projects need interpreter: 'none'

    // Python runner: skip Node.js detection, use uvicorn
    if (isPython) {
      startCommand = {
        script: 'python',
        args: `-m uvicorn ${entryFile} --host 0.0.0.0 --port ${project.port || 8000}`
      };
      useInterpreterNone = true;
      log(`Python 專案，使用 uvicorn: ${entryFile}`);
    } else if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.main) {
          entryFile = pkg.main;
          log(`從 package.json 偵測入口: ${entryFile}`);
        }
      } catch (e) {
        // ignore
      }
    }
    // Fallback: 檢查常見入口檔案（Node.js only）
    if (!isPython && !fs.existsSync(path.join(projectDir, entryFile))) {
      const candidates = ['server.js', 'app.js', 'index.js', 'main.js'];
      for (const c of candidates) {
        if (fs.existsSync(path.join(projectDir, c))) {
          log(`找到入口檔案: ${c}`);
          entryFile = c;
          break;
        }
      }
    }
    // TypeScript 入口：Node.js 無法直接執行 .ts，改用 scripts.start wrapper
    if (entryFile.endsWith('.ts') && fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        if (pkg.scripts?.start) {
          const wrapperPath = path.join(projectDir, '.pm2-start.cjs');
          fs.writeFileSync(wrapperPath, [
            `const { spawn } = require('child_process');`,
            `const child = spawn(${JSON.stringify(pm)}, ['start'], { stdio: 'inherit', cwd: __dirname, shell: true });`,
            `child.on('exit', (code) => process.exit(code || 0));`,
          ].join('\n'));
          startCommand = { script: wrapperPath, args: '' };
          log(`TypeScript 入口 (${entryFile})，使用 ${pm} start (wrapper)`);
        }
      } catch (e) {
        // ignore
      }
    }
    // 框架偵測：如果仍找不到入口檔案，偵測框架啟動方式
    if (!startCommand && !fs.existsSync(path.join(projectDir, entryFile)) && fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const isNextjs = !!(pkg.dependencies?.next || pkg.devDependencies?.next);
        if (isNextjs) {
          // Next.js：直接用 next 的 JS 入口（Windows 上 .cmd 不能被 PM2 執行）
          const nextBin = path.join(projectDir, 'node_modules', 'next', 'dist', 'bin', 'next');
          startCommand = { script: nextBin, args: 'start' };
          log(`偵測到 Next.js 專案，使用 next start`);
        } else if (pkg.scripts?.start) {
          // 其他框架：建立 wrapper script 來呼叫 start
          const wrapperPath = path.join(projectDir, '.pm2-start.cjs');
          fs.writeFileSync(wrapperPath, [
            `const { spawn } = require('child_process');`,
            `const child = spawn(${JSON.stringify(pm)}, ['start'], { stdio: 'inherit', cwd: __dirname, shell: true });`,
            `child.on('exit', (code) => process.exit(code || 0));`,
          ].join('\n'));
          startCommand = { script: wrapperPath, args: '' };
          log(`偵測到 scripts.start，使用 ${pm} start (wrapper)`);
        }
      } catch (e) {
        // ignore
      }
    }
    // 靜態站偵測：有 build 產出但沒有入口檔案或啟動指令
    if (!startCommand && !fs.existsSync(path.join(projectDir, entryFile))) {
      const outputDirs = ['dist', 'build', 'out'];
      for (const dir of outputDirs) {
        const outputPath = path.join(projectDir, dir);
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).isDirectory()) {
          // 安裝 serve（如果尚未安裝）
          const serveBin = path.join(projectDir, 'node_modules', '.bin', 'serve');
          if (!fs.existsSync(serveBin)) {
            log('安裝 serve 套件（靜態站託管）...');
            execSync(`npm install serve --save-dev`, { cwd: projectDir, stdio: 'pipe', windowsHide: true });
          }
          // 建立 PM2 wrapper
          const wrapperPath = path.join(projectDir, '.pm2-static.cjs');
          fs.writeFileSync(wrapperPath, [
            `const { spawn } = require('child_process');`,
            `const port = process.env.PORT || ${project.port || 3000};`,
            `const child = spawn('npx', ['serve', '${dir}', '-s', '-l', String(port)], {`,
            `  stdio: 'inherit', cwd: __dirname, shell: true`,
            `});`,
            `child.on('exit', (code) => process.exit(code || 0));`,
          ].join('\n'));
          startCommand = { script: wrapperPath, args: '' };
          log(`偵測到靜態站 (${dir}/)，使用 serve 託管`);
          break;
        }
      }
    }

    // 自動標記 runner（供 ecosystem.config.js 冷啟動用）
    if (!project.runner) {
      if (startCommand && startCommand.script.includes('next')) {
        updateProject(project.id, { runner: 'next' });
      } else if (entryFile.endsWith('.ts')) {
        updateProject(project.id, { runner: 'tsx' });
      }
    }

    // 更新專案配置
    if (entryFile !== project.entryFile) {
      updateProject(project.id, { entryFile });
      project.entryFile = entryFile;
    }

    // PM2 重啟
    if (project.pm2Name) {
      // 準備環境變數
      const pm2Env = {
        NODE_ENV: 'production',
        ...(project.port ? { PORT: String(project.port) } : {})
      };

      // Load .env files from project directory (.env first, .env.local overrides)
      for (const envFileName of ['.env', '.env.local']) {
        const envFilePath = path.join(projectDir, envFileName);
        if (fs.existsSync(envFilePath)) {
          const envContent = fs.readFileSync(envFilePath, 'utf8');
          envContent.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx > 0) {
              const key = trimmed.slice(0, eqIdx);
              let val = trimmed.slice(eqIdx + 1).replace(/^["']|["']$/g, '');
              pm2Env[key] = val;
            }
          });
          log(`${envFileName} 已載入`);
        }
      }
      log(`環境變數總計: ${Object.keys(pm2Env).length} 個`);

      // Inject shared CloudPipe env vars (e.g. TELEGRAM_PROXY)
      const fullConfig = getConfig();
      if (fullConfig.telegramProxy && !pm2Env.TELEGRAM_PROXY) {
        pm2Env.TELEGRAM_PROXY = fullConfig.telegramProxy;
      }

      // 先刪除舊的（如果有）
      if (project.companions && Array.isArray(project.companions)) {
        for (const companion of project.companions) {
          try {
            execSync(`pm2 delete ${project.pm2Name}-${companion.name}`, { stdio: 'pipe', windowsHide: true });
          } catch {}
        }
      }
      try {
        execSync(`pm2 delete ${project.pm2Name}`, { stdio: 'pipe', windowsHide: true });
      } catch (delErr) {
        // 忽略刪除錯誤
      }

      // Build PM2 ecosystem config to ensure env vars reach the app
      let pm2Script, pm2Args;
      if (startCommand) {
        pm2Script = startCommand.script;
        pm2Args = startCommand.args || undefined;
        log(`啟動 PM2 (framework): ${path.basename(pm2Script)} ${pm2Args || ''}`);
      } else {
        const entryPath = path.join(projectDir, entryFile);
        if (!fs.existsSync(entryPath)) {
          throw new Error(`入口檔案不存在: ${entryFile}`);
        }
        pm2Script = entryPath;
        pm2Args = undefined;
        log(`啟動 PM2 (file): ${entryFile}`);
      }

      const effectiveCwd = project.startCwd ? path.join(projectDir, project.startCwd) : projectDir;
      const pm2EcoConfig = {
        apps: [{
          name: project.pm2Name,
          script: pm2Script,
          cwd: effectiveCwd,
          env: pm2Env,
          autorestart: true,
          max_restarts: 5,
          ...(pm2Args ? { args: pm2Args } : {}),
          ...(useInterpreterNone ? { interpreter: 'none' } : {})
        }]
      };

      const ecoPath = path.join(projectDir, '.pm2-ecosystem.json');
      fs.writeFileSync(ecoPath, JSON.stringify(pm2EcoConfig, null, 2));

      execSync(`pm2 start "${ecoPath}"`, {
        stdio: 'pipe',
        cwd: projectDir,
        windowsHide: true
      });

      log(`PM2 啟動完成 (port: ${project.port || 'default'})`);

      // Health Check：確認服務啟動
      if (project.port) {
        log(`執行 Health Check (port: ${project.port})...`);
        const healthEndpoint = project.healthEndpoint || (startCommand ? '/' : '/health');
        const healthCheckPassed = await performHealthCheck(project.port, healthEndpoint, log);
        if (!healthCheckPassed) {
          throw new Error(`Health Check 失敗：服務未能在 port ${project.port} 啟動`);
        }
        log(`Health Check 通過`);
      }

      // Spawn companion processes (bots, workers, etc.)
      if (project.companions && Array.isArray(project.companions)) {
        for (const companion of project.companions) {
          const compName = `${project.pm2Name}-${companion.name}`;
          const compCwd = companion.cwd
            ? path.join(projectDir, companion.cwd)
            : projectDir;

          // Auto-install Python dependencies if requirements.txt exists
          if (companion.command === 'python' || companion.command === 'python3') {
            const reqFile = path.join(compCwd, 'requirements.txt');
            if (!fs.existsSync(reqFile)) {
              // Also check parent project dir
              const parentReq = path.join(projectDir, 'requirements.txt');
              if (fs.existsSync(parentReq)) {
                try {
                  const pip = companion.command === 'python3' ? 'pip3' : 'pip';
                  log(`安裝 Python 依賴 (${parentReq})...`);
                  execSync(`${pip} install -r "${parentReq}"`, { cwd: projectDir, stdio: 'pipe', windowsHide: true, timeout: 300000 });
                  log('Python 依賴安裝完成');
                } catch (e) {
                  log(`Python 依賴安裝失敗: ${e.message}`);
                }
              }
            } else {
              try {
                const pip = companion.command === 'python3' ? 'pip3' : 'pip';
                log(`安裝 Python 依賴 (${reqFile})...`);
                execSync(`${pip} install -r "${reqFile}"`, { cwd: compCwd, stdio: 'pipe', windowsHide: true, timeout: 300000 });
                log('Python 依賴安裝完成');
              } catch (e) {
                log(`Python 依賴安裝失敗: ${e.message}`);
              }
            }
          }

          if (companion.delay) {
            log(`等待 ${companion.delay}s 後啟動 ${compName}...`);
            await new Promise(r => setTimeout(r, companion.delay * 1000));
          }

          const compArgs = companion.args ? companion.args.join(' ') : '';
          log(`啟動 companion: ${compName} (${companion.command} ${compArgs})`);

          const compEcoConfig = {
            apps: [{
              name: compName,
              script: companion.command,
              cwd: compCwd,
              interpreter: companion.command === 'python' || companion.command === 'python3' ? 'none' : undefined,
              env: pm2Env,
              autorestart: true,
              max_restarts: 5,
              ...(compArgs ? { args: compArgs } : {})
            }]
          };
          const compEcoPath = path.join(projectDir, `.pm2-companion-${companion.name}.json`);
          fs.writeFileSync(compEcoPath, JSON.stringify(compEcoConfig, null, 2));
          execSync(`pm2 start "${compEcoPath}"`, { stdio: 'pipe', windowsHide: true });
          log(`Companion ${compName} 已啟動`);
        }
      }
    }

    // 自動建立 DNS (Cloudflare Tunnel)
    const config = getConfig();
    const hostname = `${project.id}.${config.domain || 'localhost'}`;
    const cf = getCloudflared();
    if (cf.tunnelId) {
      try {
        execSync(`"${cf.path}" tunnel route dns ${cf.tunnelId} ${hostname}`, { stdio: 'ignore', windowsHide: true });
        log(`DNS 已建立: ${hostname}`);
      } catch (e) {
        log(`DNS 建立失敗（可能已存在）: ${e.message}`);
      }
    } else {
      log(`跳過 DNS 建立（未設定 cloudflared.tunnelId）`);
    }

    // 更新 Tunnel Ingress 規則
    if (project.port) {
      log(`更新 Tunnel Ingress: ${hostname} -> localhost:${project.port}`);
      updateTunnelIngress(hostname, project.port);
    }

    // Handle custom domains
    if (project.customDomains && Array.isArray(project.customDomains)) {
      for (const customDomain of project.customDomains) {
        log(`設定自訂網域: ${customDomain} -> localhost:${project.port}`);
        updateTunnelIngress(customDomain, project.port);
        // DNS route for custom domain
        if (cf.tunnelId) {
          try {
            execSync(`"${cf.path}" tunnel route dns ${cf.tunnelId} ${customDomain}`, { stdio: 'ignore', windowsHide: true });
            log(`DNS 已建立: ${customDomain}`);
          } catch (e) {
            log(`DNS 建立失敗（可能已存在）: ${e.message}`);
          }
        }
      }
    }

    // 更新部署狀態
    const finishedAt = new Date().toISOString();
    deployment.status = 'success';
    deployment.finishedAt = finishedAt;
    deployment.duration = new Date(finishedAt) - new Date(startedAt);
    deployment.logs = logs;

    log(`部署成功！耗時 ${deployment.duration}ms`);

  } catch (error) {
    const finishedAt = new Date().toISOString();
    deployment.status = 'failed';
    deployment.finishedAt = finishedAt;
    deployment.duration = new Date(finishedAt) - new Date(startedAt);
    deployment.error = error.message;
    log(`部署失敗: ${error.message}`);
    deployment.logs = logs;
  } finally {
    // Always release the deploy lock
    deployLocks.delete(projectId);
  }

  // 更新部署記錄
  const allDeployments = readDeployments();
  const deployIndex = allDeployments.findIndex(d => d.id === deployId);
  if (deployIndex !== -1) {
    allDeployments[deployIndex] = deployment;
    writeDeployments(allDeployments);
  }

  // 更新專案最後部署時間
  const projectUpdate = {
    lastDeployAt: deployment.finishedAt,
    lastDeployStatus: deployment.status,
    lastDeployCommit: deployment.commit // 嘗試部署的 commit
  };
  // 只有成功才更新 runningCommit
  if (deployment.status === 'success') {
    projectUpdate.runningCommit = deployment.commit;
  }
  updateProject(projectId, projectUpdate);

  // Emit deploy event for notifications (Telegram bot etc.)
  events.emit('deploy:complete', { project, deployment });

  // 通知其他機器有新部署（Redis sync）
  if (deployment.status === 'success') {
    try {
      const redis = require('./redis').getClient();
      if (redis) {
        const syncKey = `cloudpipe:deploy:${projectId}`;
        await redis.hset(syncKey, {
          commit: deployment.commit || '',
          machineId: require('./redis').getMachineId(),
          timestamp: new Date().toISOString(),
          triggeredBy: deployment.triggeredBy || 'unknown',
        });
        await redis.expire(syncKey, 600);
        log(`[sync] Redis 已通知其他機器`);
      }
    } catch (err) {
      log(`[sync] Redis 通知失敗: ${err.message}`);
    }
  }

  return deployment;
}

// ==================== 部署記錄 ====================

function getDeployments(projectId, limit = 20) {
  const deployments = readDeployments();
  const filtered = projectId
    ? deployments.filter(d => d.projectId === projectId)
    : deployments;
  return filtered.slice(0, limit);
}

function getDeployment(deployId) {
  return readDeployments().find(d => d.id === deployId);
}

// ==================== Webhook 驗證 ====================

function verifyGitHubWebhook(payload, signature, secret) {
  if (!signature || !secret) return false;
  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

// ==================== GitHub Webhook 自動設定 ====================

// 從 repoUrl 解析 owner/repo
function parseGitHubRepo(repoUrl) {
  // 支援格式：
  // https://github.com/owner/repo.git
  // https://github.com/owner/repo
  // git@github.com:owner/repo.git
  const httpsMatch = repoUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  const sshMatch = repoUrl.match(/github\.com:([^\/]+)\/([^\/\.]+)/);
  const match = httpsMatch || sshMatch;
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace('.git', '') };
}

// 設定 GitHub Webhook
async function setupGitHubWebhook(projectId, webhookUrl) {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`專案 "${projectId}" 不存在`);
  }

  const parsed = parseGitHubRepo(project.repoUrl);
  if (!parsed) {
    throw new Error(`無法解析 GitHub repo URL: ${project.repoUrl}`);
  }

  const { owner, repo } = parsed;
  const secret = project.webhookSecret;

  console.log(`[deploy] 設定 GitHub Webhook: ${owner}/${repo}`);

  try {
    // 使用 gh CLI 建立 webhook
    const webhookConfig = JSON.stringify({
      name: 'web',
      active: true,
      events: ['push'],
      config: {
        url: webhookUrl,
        content_type: 'json',
        secret: secret,
        insecure_ssl: '0'
      }
    });

    const result = execSync(
      `gh api repos/${owner}/${repo}/hooks --method POST --input -`,
      {
        input: webhookConfig,
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      }
    );

    const hookData = JSON.parse(result);
    console.log(`[deploy] Webhook 已建立: ID ${hookData.id}`);

    // 更新專案記錄
    updateProject(projectId, { webhookId: hookData.id });

    return { success: true, webhookId: hookData.id };
  } catch (error) {
    // 檢查是否是 webhook 已存在 (錯誤訊息可能在 stderr 或 message 中)
    const errorOutput = (error.stderr?.toString() || '') + (error.message || '');
    if (errorOutput.includes('Hook already exists') || errorOutput.includes('already exists')) {
      console.log(`[deploy] Webhook 已存在，跳過建立`);
      return { success: true, alreadyExists: true };
    }
    console.error(`[deploy] Webhook 設定失敗:`, errorOutput || error);
    throw new Error(errorOutput || error.message);
  }
}

// 刪除 GitHub Webhook
async function removeGitHubWebhook(projectId) {
  const project = getProject(projectId);
  if (!project || !project.webhookId) {
    return { success: false, error: '無 webhook 記錄' };
  }

  const parsed = parseGitHubRepo(project.repoUrl);
  if (!parsed) {
    return { success: false, error: '無法解析 repo URL' };
  }

  const { owner, repo } = parsed;

  try {
    execSync(
      `gh api repos/${owner}/${repo}/hooks/${project.webhookId} --method DELETE`,
      { stdio: 'pipe', windowsHide: true }
    );
    console.log(`[deploy] Webhook 已刪除: ID ${project.webhookId}`);
    updateProject(projectId, { webhookId: null });
    return { success: true };
  } catch (error) {
    console.error(`[deploy] Webhook 刪除失敗:`, error.message);
    return { success: false, error: error.message };
  }
}

// 列出專案的 GitHub Webhooks
function listGitHubWebhooks(projectId) {
  const project = getProject(projectId);
  if (!project) {
    throw new Error(`專案 "${projectId}" 不存在`);
  }

  const parsed = parseGitHubRepo(project.repoUrl);
  if (!parsed) {
    throw new Error(`無法解析 GitHub repo URL`);
  }

  const { owner, repo } = parsed;

  try {
    const result = execSync(
      `gh api repos/${owner}/${repo}/hooks`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
    );
    return JSON.parse(result);
  } catch (error) {
    console.error(`[deploy] 取得 webhooks 失敗:`, error.message);
    return [];
  }
}

// ==================== GitHub 輪詢（Backup 機制）====================

/**
 * 檢查 GitHub 最新 commit（使用 gh CLI）
 */
function getGitHubLatestCommit(owner, repo, branch) {
  try {
    const result = execSync(
      `gh api repos/${owner}/${repo}/commits/${branch} --jq ".sha"`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true }
    );
    return result.trim().substring(0, 7);
  } catch (e) {
    console.error(`[poll] 無法取得 ${owner}/${repo} 最新 commit:`, e.message);
    return null;
  }
}

/**
 * 檢查單一專案是否需要部署
 */
async function checkProjectForUpdates(project) {
  if (project.deployMethod !== 'github' && project.deployMethod !== 'git-url') {
    return null;
  }

  const parsed = parseGitHubRepo(project.repoUrl);
  if (!parsed) return null;

  const { owner, repo } = parsed;
  const remoteCommit = getGitHubLatestCommit(owner, repo, project.branch);

  if (!remoteCommit) return null;

  // 取得本地 commit
  const projectDir = resolveProjectDir(project);
  let localCommit = null;
  try {
    if (fs.existsSync(projectDir)) {
      localCommit = execSync('git rev-parse --short HEAD', { cwd: projectDir, encoding: 'utf8', windowsHide: true }).trim();
    }
  } catch (e) {}

  // 比較
  if (remoteCommit !== localCommit) {
    console.log(`[poll] 偵測到新 commit: ${project.id} (local: ${localCommit}, remote: ${remoteCommit})`);
    return { project, localCommit, remoteCommit };
  }

  return null;
}

/**
 * 輪詢所有專案檢查更新
 */
async function pollAllProjects() {
  const projects = getAllProjects();
  console.log(`[poll] 開始輪詢 ${projects.length} 個專案...`);

  for (const project of projects) {
    try {
      const update = await checkProjectForUpdates(project);
      if (update) {
        console.log(`[poll] 觸發部署: ${project.id}`);
        await deploy(project.id, { triggeredBy: 'poll' });
      }
    } catch (e) {
      console.error(`[poll] 檢查 ${project.id} 失敗:`, e.message);
    }
  }

  console.log(`[poll] 輪詢完成`);
}

// 輪詢定時器
let pollInterval = null;
let redisSyncInterval = null;

/**
 * Redis Sync Check — 檢查其他機器是否有新部署（每 30 秒）
 */
async function pollRedisSync() {
  let redis, machineId;
  try {
    redis = require('./redis').getClient();
    machineId = require('./redis').getMachineId();
  } catch {
    return;
  }
  if (!redis) return;

  const projects = getAllProjects();

  for (const project of projects) {
    try {
      const syncKey = `cloudpipe:deploy:${project.id}`;
      const syncData = await redis.hgetall(syncKey);

      if (!syncData || !syncData.commit) continue;
      if (syncData.machineId === machineId) continue; // 自己部署的，跳過

      // 檢查是否比本機新
      if (syncData.commit !== project.runningCommit) {
        console.log(`[sync] ${project.id}: ${syncData.machineId} deployed ${syncData.commit} (local: ${project.runningCommit || 'none'})`);
        await deploy(project.id, { triggeredBy: `sync:${syncData.machineId}` });
      }
    } catch (e) {
      console.error(`[sync] ${project.id} check failed:`, e.message);
    }
  }
}

/**
 * 啟動定時輪詢（GitHub 每 5 分鐘 + Redis sync 每 30 秒）
 */
function startPolling(intervalMs = 5 * 60 * 1000) {
  if (pollInterval) {
    clearInterval(pollInterval);
  }

  console.log(`[poll] 啟動定時輪詢 (GitHub: ${intervalMs / 1000}s)`);

  // GitHub 輪詢
  setTimeout(() => pollAllProjects(), 10000);
  pollInterval = setInterval(pollAllProjects, intervalMs);

  // Redis sync（每 30 秒，輕量級）
  try {
    const redis = require('./redis').getClient();
    if (redis) {
      redisSyncInterval = setInterval(pollRedisSync, 30000);
      console.log('[poll] Redis sync check every 30s');
    }
  } catch {
    // redis 未設定
  }
}

/**
 * 停止定時輪詢
 */
function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
  if (redisSyncInterval) {
    clearInterval(redisSyncInterval);
    redisSyncInterval = null;
  }
  console.log(`[poll] 已停止定時輪詢`);
}

// ==================== 匯出 ====================

module.exports = {
  // 專案管理
  getProject,
  getAllProjects,
  createProject,
  updateProject,
  deleteProject,

  // 部署
  deploy,
  getDeployments,
  getDeployment,

  // Webhook
  verifyGitHubWebhook,
  setupGitHubWebhook,
  removeGitHubWebhook,
  listGitHubWebhooks,
  parseGitHubRepo,

  // Port
  getNextAvailablePort,

  // 輪詢
  startPolling,
  stopPolling,
  pollAllProjects,
  checkProjectForUpdates,

  // Events
  events
};
