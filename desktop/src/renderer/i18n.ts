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
  'set.about': { en: 'About', zh: '關於' },
  'set.version': { en: 'CloudPipe Desktop v0.1.0', zh: 'CloudPipe Desktop v0.1.0' },
  'set.description': { en: 'Self-hosted deployment platform', zh: '自架部署平台' },

  // Deploy
  'deploy.success': { en: 'Success', zh: '成功' },
  'deploy.failed': { en: 'Failed', zh: '失敗' },
  'deploy.pending': { en: 'Pending', zh: '等待中' },
  'deploy.building': { en: 'Building', zh: '建置中' },
  'deploy.deploying': { en: 'Deploying', zh: '部署中' },
} as const;

type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, locale: Locale): string {
  return translations[key]?.[locale] ?? key;
}
