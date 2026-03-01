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
  OPEN_URL: 'open-url',
  PM2_STATUS: 'pm2-status',

  // Deploy All
  DEPLOY_ALL: 'deploy-all',

  // Machines
  GET_MACHINES: 'get-machines',
  ADD_MACHINE: 'add-machine',
  REMOVE_MACHINE: 'remove-machine',
  SWITCH_MACHINE: 'switch-machine',

  // Deploy (new project)
  BROWSE_FOLDER: 'browse-folder',
  SCAN_FOLDER: 'scan-folder',
  SCAN_WORKSPACE: 'scan-workspace',
  REGISTER_PROJECT: 'register-project',
  GET_NEXT_PORT: 'get-next-port',
  GITHUB_VALIDATE_TOKEN: 'github-validate-token',
  GITHUB_GET_REPOS: 'github-get-repos',
  GITHUB_SEARCH_REPOS: 'github-search-repos',
  GITHUB_GET_STARRED: 'github-get-starred',

  // Config
  GET_CONFIG: 'get-config',
  SET_CONFIG: 'set-config',

  // Window controls
  WIN_MINIMIZE: 'win-minimize',
  WIN_MAXIMIZE: 'win-maximize',
  WIN_CLOSE: 'win-close',
  WIN_IS_MAXIMIZED: 'win-is-maximized',

  // Tunnel
  TUNNEL_START: 'tunnel-start',
  TUNNEL_STOP: 'tunnel-stop',
  TUNNEL_STATUS: 'tunnel-status',

  // Startup sequence
  STARTUP_SEQUENCE: 'startup-sequence',

  // Setup
  SETUP: 'setup',
  CHECK_NEEDS_SETUP: 'check-needs-setup',
  ON_SETUP_PROGRESS: 'on-setup-progress',

  // Push events (main → renderer)
  ON_DEPLOY_STATUS: 'on-deploy-status',
  ON_CONNECTION_STATUS: 'on-connection-status',
  ON_NAVIGATE_PAGE: 'on-navigate-page',
  ON_STARTUP_PROGRESS: 'on-startup-progress',
  ON_TUNNEL_STATUS: 'on-tunnel-status',
} as const;

export const POLL_INTERVALS = {
  PROJECTS: 5_000,
  LOGS: 3_000,
  SYSTEM: 10_000,
} as const;
