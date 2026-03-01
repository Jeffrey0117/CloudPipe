export type Locale = 'en' | 'zh';

const translations = {
  // App
  'app.title': { en: 'CloudPipe', zh: 'CloudPipe' },

  // Sidebar
  'nav.dashboard': { en: 'Dashboard', zh: '儀表板' },
  'nav.projects': { en: 'Projects', zh: '專案' },
  'nav.logs': { en: 'Logs', zh: '日誌' },
  'nav.gateway': { en: 'Gateway', zh: '閘道' },
  'nav.settings': { en: 'Settings', zh: '設定' },

  // Status
  'status.connected': { en: 'Connected', zh: '已連線' },
  'status.disconnected': { en: 'Disconnected', zh: '未連線' },
  'status.checking': { en: 'Checking...', zh: '檢查中...' },
  'status.online': { en: 'Online', zh: '上線' },
  'status.offline': { en: 'Offline', zh: '離線' },
  'status.stopped': { en: 'Stopped', zh: '已停止' },
  'status.errored': { en: 'Errored', zh: '錯誤' },
  'status.launching': { en: 'Launching', zh: '啟動中' },

  // Login
  'login.title': { en: 'CloudPipe Desktop', zh: 'CloudPipe 桌面端' },
  'login.subtitle': { en: 'Management Console', zh: '管理控制台' },
  'login.serverUrl': { en: 'Server URL', zh: '伺服器位址' },
  'login.password': { en: 'Password', zh: '密碼' },
  'login.button': { en: 'Connect', zh: '連線' },
  'login.connecting': { en: 'Connecting...', zh: '連線中...' },
  'login.invalidPassword': { en: 'Invalid password', zh: '密碼錯誤' },
  'login.connectionFailed': { en: 'Connection failed', zh: '連線失敗' },

  // Dashboard
  'dash.title': { en: 'Dashboard', zh: '儀表板' },
  'dash.uptime': { en: 'Uptime', zh: '運行時間' },
  'dash.services': { en: 'Services', zh: '服務' },
  'dash.recentDeploys': { en: 'Recent Deploys', zh: '近期部署' },
  'dash.quickActions': { en: 'Quick Actions', zh: '快速操作' },
  'dash.startAll': { en: 'Start All', zh: '全部啟動' },
  'dash.stopAll': { en: 'Stop All', zh: '全部停止' },
  'dash.deployAll': { en: 'Deploy All', zh: '全部部署' },
  'dash.deployingAll': { en: 'Deploying...', zh: '部署中...' },
  'dash.starting': { en: 'Starting...', zh: '啟動中...' },
  'dash.stopping': { en: 'Stopping...', zh: '停止中...' },
  'dash.noDeploys': { en: 'No deployments yet', zh: '尚無部署紀錄' },
  'dash.system': { en: 'System', zh: '系統' },
  'dash.node': { en: 'Node', zh: 'Node' },
  'dash.platform': { en: 'Platform', zh: '平台' },

  // Projects
  'proj.title': { en: 'Projects', zh: '專案' },
  'proj.count': { en: 'projects', zh: '個專案' },
  'proj.deploy': { en: 'Deploy', zh: '部署' },
  'proj.deploying': { en: 'Deploying...', zh: '部署中...' },
  'proj.restart': { en: 'Restart', zh: '重啟' },
  'proj.open': { en: 'Open', zh: '開啟' },
  'proj.copied': { en: 'Copied!', zh: '已複製！' },
  'proj.noProjects': { en: 'No projects found. Is the server running?', zh: '找不到專案。伺服器有在運行嗎？' },
  'proj.port': { en: 'Port', zh: '連接埠' },

  // Logs
  'logs.title': { en: 'Logs', zh: '日誌' },
  'logs.selectProject': { en: 'Select project...', zh: '選擇專案...' },
  'logs.filter': { en: 'Filter logs...', zh: '篩選日誌...' },
  'logs.noSelection': { en: 'Select a project to view logs', zh: '選擇專案以查看日誌' },
  'logs.stdout': { en: 'stdout', zh: '標準輸出' },
  'logs.stderr': { en: 'stderr', zh: '錯誤輸出' },

  // Gateway
  'gw.title': { en: 'Gateway', zh: '閘道' },
  'gw.tools': { en: 'Tools', zh: '工具' },
  'gw.pipelines': { en: 'Pipelines', zh: '管線' },
  'gw.tryIt': { en: 'Try It', zh: '測試' },
  'gw.run': { en: 'Run', zh: '執行' },
  'gw.refresh': { en: 'Refresh', zh: '重新整理' },
  'gw.loading': { en: 'Loading...', zh: '載入中...' },
  'gw.execute': { en: 'Execute', zh: '執行' },
  'gw.running': { en: 'Running...', zh: '執行中...' },
  'gw.cancel': { en: 'Cancel', zh: '取消' },
  'gw.params': { en: 'Parameters (JSON)', zh: '參數 (JSON)' },
  'gw.steps': { en: 'steps', zh: '步驟' },

  // Settings
  'set.title': { en: 'Settings', zh: '設定' },
  'set.connection': { en: 'Connection', zh: '連線' },
  'set.serverUrl': { en: 'Server URL', zh: '伺服器位址' },
  'set.test': { en: 'Test', zh: '測試' },
  'set.logout': { en: 'Logout', zh: '登出' },
  'set.appearance': { en: 'Appearance', zh: '外觀' },
  'set.theme': { en: 'Theme', zh: '主題' },
  'set.dark': { en: 'Dark', zh: '深色' },
  'set.light': { en: 'Light', zh: '淺色' },
  'set.language': { en: 'Language', zh: '語言' },
  'set.machines': { en: 'Machines', zh: '機器' },
  'set.machineName': { en: 'Name', zh: '名稱' },
  'set.machineUrl': { en: 'URL', zh: '位址' },
  'set.machineToken': { en: 'Token', zh: 'Token' },
  'set.addMachine': { en: 'Add Machine', zh: '新增機器' },
  'set.removeMachine': { en: 'Remove', zh: '移除' },
  'set.switchMachine': { en: 'Switch', zh: '切換' },
  'set.active': { en: 'Active', zh: '使用中' },
  'set.noMachines': { en: 'No machines configured', zh: '尚未設定機器' },
  'set.about': { en: 'About', zh: '關於' },
  'set.version': { en: 'CloudPipe Desktop v0.1.0', zh: 'CloudPipe Desktop v0.1.0' },
  'set.description': { en: 'Self-hosted deployment platform', zh: '自架部署平台' },

  // Tunnel
  'tunnel.stopped': { en: 'Stopped', zh: '已停止' },
  'tunnel.starting': { en: 'Starting', zh: '啟動中' },
  'tunnel.running': { en: 'Running', zh: '運行中' },
  'tunnel.errored': { en: 'Error', zh: '錯誤' },

  // Startup steps
  'startup.deleting': { en: 'Cleaning up...', zh: '清理中...' },
  'startup.starting_core': { en: 'Starting core...', zh: '啟動核心...' },
  'startup.health_check': { en: 'Health check...', zh: '健康檢查...' },
  'startup.deploying': { en: 'Deploying...', zh: '部署中...' },
  'startup.starting_tunnel': { en: 'Starting tunnel...', zh: '啟動隧道...' },
  'startup.complete': { en: 'Complete', zh: '完成' },
  'startup.failed': { en: 'Failed', zh: '失敗' },

  // Deploy status
  'deploy.success': { en: 'Success', zh: '成功' },
  'deploy.failed': { en: 'Failed', zh: '失敗' },
  'deploy.pending': { en: 'Pending', zh: '等待中' },
  'deploy.building': { en: 'Building', zh: '建置中' },
  'deploy.deploying': { en: 'Deploying', zh: '部署中' },

  // Setup
  'setup.title': { en: 'First-Time Setup', zh: '首次設定' },
  'setup.subtitle': { en: 'Connect to your primary CloudPipe server', zh: '連接到你的 CloudPipe 主機' },
  'setup.serverUrl': { en: 'Primary Server URL', zh: '主機位址' },
  'setup.password': { en: 'Admin Password', zh: '管理員密碼' },
  'setup.connect': { en: 'Connect & Setup', zh: '連接並設定' },
  'setup.login': { en: 'Authenticating...', zh: '驗證中...' },
  'setup.bundle': { en: 'Downloading config...', zh: '下載設定...' },
  'setup.cloudflared': { en: 'Checking cloudflared...', zh: '檢查 cloudflared...' },
  'setup.credentials': { en: 'Writing credentials...', zh: '寫入憑證...' },
  'setup.config': { en: 'Writing config...', zh: '寫入設定...' },
  'setup.tunnel_yml': { en: 'Generating tunnel config...', zh: '產生隧道設定...' },
  'setup.projects': { en: 'Syncing projects...', zh: '同步專案...' },
  'setup.env': { en: 'Pulling .env files...', zh: '拉取環境變數...' },
  'setup.complete': { en: 'Setup complete!', zh: '設定完成！' },
  'setup.failed': { en: 'Setup failed', zh: '設定失敗' },
  'setup.start': { en: 'Start Services', zh: '啟動服務' },
  'setup.retry': { en: 'Retry', zh: '重試' },

  // Deploy page
  'nav.deploy': { en: 'Deploy', zh: '部署' },
  'deploy.title': { en: 'Deploy New Project', zh: '部署新專案' },
  'deploy.localTab': { en: 'Local', zh: '本地' },
  'deploy.githubTab': { en: 'GitHub', zh: 'GitHub' },
  'deploy.browse': { en: 'Browse Folder', zh: '瀏覽資料夾' },
  'deploy.scanning': { en: 'Scanning...', zh: '掃描中...' },
  'deploy.formTitle': { en: 'Project Config', zh: '專案設定' },
  'deploy.fieldId': { en: 'Project ID', zh: '專案 ID' },
  'deploy.fieldPort': { en: 'Port', zh: '連接埠' },
  'deploy.fieldEntry': { en: 'Entry File', zh: '入口檔案' },
  'deploy.fieldBuild': { en: 'Build Command', zh: '建置指令' },
  'deploy.fieldRepo': { en: 'Repo URL', zh: '儲存庫位址' },
  'deploy.fieldBranch': { en: 'Branch', zh: '分支' },
  'deploy.register': { en: 'Register & Deploy', zh: '註冊並部署' },
  'deploy.registering': { en: 'Registering...', zh: '註冊中...' },
  'deploy.registerSuccess': { en: 'Deployed!', zh: '部署完成！' },
  'deploy.done': { en: 'Project deployed successfully!', zh: '專案已成功部署！' },
  'deploy.projectsFound': { en: 'projects found', zh: '個專案' },
  'deploy.noProjects': { en: 'No projects found in this folder', zh: '這個資料夾裡沒有找到專案' },
  'deploy.alreadyDeployed': { en: 'Deployed', zh: '已部署' },
  'deploy.alreadyRegistered': { en: 'is already registered in CloudPipe', zh: '已經在 CloudPipe 中註冊了' },
  'deploy.errorNoId': { en: 'Project ID is required', zh: '請填寫專案 ID' },
  'deploy.errorBadPort': { en: 'Port must be >= 1000', zh: '連接埠必須 >= 1000' },
  'deploy.ghConnect': { en: 'Connect', zh: '連接' },
  'deploy.ghTab_search': { en: 'Search', zh: '搜尋' },
  'deploy.ghTab_mine': { en: 'My Repos', zh: '我的' },
  'deploy.ghTab_starred': { en: 'Starred', zh: '星標' },
  'deploy.ghSearchPlaceholder': { en: 'Search GitHub repos...', zh: '搜尋 GitHub 儲存庫...' },
  'deploy.ghSearching': { en: 'Searching...', zh: '搜尋中...' },
  'deploy.ghNoResults': { en: 'No repos found', zh: '找不到儲存庫' },
  'deploy.ghTokenTitle': { en: 'GitHub login required', zh: '需要登入 GitHub' },
  'deploy.ghTokenDesc': { en: 'To browse your repos and starred projects, paste a GitHub token below. Click the link to create one (just tick "repo" and generate).', zh: '要瀏覽你自己的 repos 和星標專案，請在下方貼上 GitHub token。點下面的連結建立一個（勾選「repo」然後產生就好）。' },
  'deploy.ghTokenCreate': { en: 'Create a GitHub token (opens browser)', zh: '建立 GitHub token（開啟瀏覽器）' },
} as const;

type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, locale: Locale): string {
  return translations[key]?.[locale] ?? key;
}
