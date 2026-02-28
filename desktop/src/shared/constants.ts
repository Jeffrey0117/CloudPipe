export const IPC = {
  // Auth
  LOGIN: 'login',
  VERIFY_TOKEN: 'verify-token',
  LOGOUT: 'logout',

  // Projects
  GET_PROJECTS: 'get-projects',
  DEPLOY_PROJECT: 'deploy-project',
  RESTART_PROJECT: 'restart-project',
  GET_DEPLOY_HISTORY: 'get-deploy-history',

  // Logs
  GET_LOGS: 'get-logs',
  ON_LOG_UPDATE: 'on-log-update',

  // System
  GET_SYSTEM_INFO: 'get-system-info',

  // Gateway
  GET_TOOLS: 'get-tools',
  GET_PIPELINES: 'get-pipelines',
  CALL_TOOL: 'call-tool',
  RUN_PIPELINE: 'run-pipeline',

  // PM2 local
  PM2_START_ALL: 'pm2-start-all',
  PM2_STOP_ALL: 'pm2-stop-all',
  PM2_STATUS: 'pm2-status',

  // Config
  GET_CONFIG: 'get-config',
  SET_CONFIG: 'set-config',

  // Window controls
  WIN_MINIMIZE: 'win-minimize',
  WIN_MAXIMIZE: 'win-maximize',
  WIN_CLOSE: 'win-close',
  WIN_IS_MAXIMIZED: 'win-is-maximized',

  // Push events (main → renderer)
  ON_DEPLOY_STATUS: 'on-deploy-status',
  ON_CONNECTION_STATUS: 'on-connection-status',
} as const;

export const POLL_INTERVALS = {
  PROJECTS: 5_000,
  LOGS: 3_000,
  SYSTEM: 10_000,
} as const;
