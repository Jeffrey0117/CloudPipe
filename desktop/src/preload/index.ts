import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/constants';

contextBridge.exposeInMainWorld('cloudpipe', {
  // Auth
  login: (serverUrl: string, password: string) => ipcRenderer.invoke(IPC.LOGIN, serverUrl, password),
  verifyToken: () => ipcRenderer.invoke(IPC.VERIFY_TOKEN),
  logout: () => ipcRenderer.invoke(IPC.LOGOUT),

  // Projects
  getProjects: () => ipcRenderer.invoke(IPC.GET_PROJECTS),
  deployProject: (id: string) => ipcRenderer.invoke(IPC.DEPLOY_PROJECT, id),
  restartProject: (id: string) => ipcRenderer.invoke(IPC.RESTART_PROJECT, id),
  getDeployHistory: (id?: string) => ipcRenderer.invoke(IPC.GET_DEPLOY_HISTORY, id),

  // Deploy All
  deployAll: () => ipcRenderer.invoke(IPC.DEPLOY_ALL),

  // Logs
  getLogs: (pm2Name: string) => ipcRenderer.invoke(IPC.GET_LOGS, pm2Name),
  onLogUpdate: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_LOG_UPDATE, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_LOG_UPDATE, handler); };
  },

  // System
  getSystemInfo: () => ipcRenderer.invoke(IPC.GET_SYSTEM_INFO),

  // Gateway
  getTools: () => ipcRenderer.invoke(IPC.GET_TOOLS),
  getPipelines: () => ipcRenderer.invoke(IPC.GET_PIPELINES),
  callTool: (tool: string, params: Record<string, unknown>) => ipcRenderer.invoke(IPC.CALL_TOOL, tool, params),
  runPipeline: (pipeline: string, input: Record<string, unknown>) => ipcRenderer.invoke(IPC.RUN_PIPELINE, pipeline, input),

  // PM2 local
  pm2StartAll: () => ipcRenderer.invoke(IPC.PM2_START_ALL),
  pm2StopAll: () => ipcRenderer.invoke(IPC.PM2_STOP_ALL),
  pm2Status: () => ipcRenderer.invoke(IPC.PM2_STATUS),
  openUrl: (url: string) => ipcRenderer.invoke(IPC.OPEN_URL, url),

  // Tunnel
  tunnelStart: () => ipcRenderer.invoke(IPC.TUNNEL_START),
  tunnelStop: () => ipcRenderer.invoke(IPC.TUNNEL_STOP),
  tunnelStatus: () => ipcRenderer.invoke(IPC.TUNNEL_STATUS),

  // Startup sequence
  startupSequence: () => ipcRenderer.invoke(IPC.STARTUP_SEQUENCE),

  // Machines
  getMachines: () => ipcRenderer.invoke(IPC.GET_MACHINES),
  addMachine: (machine: unknown) => ipcRenderer.invoke(IPC.ADD_MACHINE, machine),
  removeMachine: (id: string) => ipcRenderer.invoke(IPC.REMOVE_MACHINE, id),
  switchMachine: (id: string) => ipcRenderer.invoke(IPC.SWITCH_MACHINE, id),

  // Deploy (new project)
  browseFolder: () => ipcRenderer.invoke(IPC.BROWSE_FOLDER),
  scanFolder: (folderPath: string) => ipcRenderer.invoke(IPC.SCAN_FOLDER, folderPath),
  scanWorkspace: (folderPath: string) => ipcRenderer.invoke(IPC.SCAN_WORKSPACE, folderPath),
  registerProject: (data: unknown) => ipcRenderer.invoke(IPC.REGISTER_PROJECT, data),
  getNextPort: () => ipcRenderer.invoke(IPC.GET_NEXT_PORT),
  githubValidateToken: (pat: string) => ipcRenderer.invoke(IPC.GITHUB_VALIDATE_TOKEN, pat),
  githubGetRepos: (pat: string) => ipcRenderer.invoke(IPC.GITHUB_GET_REPOS, pat),
  githubSearchRepos: (query: string, pat?: string) => ipcRenderer.invoke(IPC.GITHUB_SEARCH_REPOS, query, pat),
  githubGetStarred: (pat: string) => ipcRenderer.invoke(IPC.GITHUB_GET_STARRED, pat),

  // Config
  getConfig: () => ipcRenderer.invoke(IPC.GET_CONFIG),
  setConfig: (config: Record<string, unknown>) => ipcRenderer.invoke(IPC.SET_CONFIG, config),

  // Window
  windowMinimize: () => ipcRenderer.invoke(IPC.WIN_MINIMIZE),
  windowMaximize: () => ipcRenderer.invoke(IPC.WIN_MAXIMIZE),
  windowClose: () => ipcRenderer.invoke(IPC.WIN_CLOSE),
  windowIsMaximized: () => ipcRenderer.invoke(IPC.WIN_IS_MAXIMIZED),

  // Push events
  onDeployStatus: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_DEPLOY_STATUS, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_DEPLOY_STATUS, handler); };
  },
  onConnectionStatus: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_CONNECTION_STATUS, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_CONNECTION_STATUS, handler); };
  },
  onNavigatePage: (callback: (page: string) => void) => {
    const handler = (_: unknown, page: string) => callback(page);
    ipcRenderer.on(IPC.ON_NAVIGATE_PAGE, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_NAVIGATE_PAGE, handler); };
  },

  // Startup progress + tunnel status events
  onStartupProgress: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_STARTUP_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_STARTUP_PROGRESS, handler); };
  },
  onTunnelStatus: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_TUNNEL_STATUS, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_TUNNEL_STATUS, handler); };
  },

  // Setup
  setup: (serverUrl: string, password: string) => ipcRenderer.invoke(IPC.SETUP, serverUrl, password),
  checkNeedsSetup: () => ipcRenderer.invoke(IPC.CHECK_NEEDS_SETUP),
  onSetupProgress: (callback: (data: unknown) => void) => {
    const handler = (_: unknown, data: unknown) => callback(data);
    ipcRenderer.on(IPC.ON_SETUP_PROGRESS, handler);
    return () => { ipcRenderer.removeListener(IPC.ON_SETUP_PROGRESS, handler); };
  },

  // Triggered by main process (keyboard shortcuts / tray)
  onTriggerDeployAll: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('trigger-deploy-all', handler);
    return () => { ipcRenderer.removeListener('trigger-deploy-all', handler); };
  },
  onTriggerStartAll: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('trigger-start-all', handler);
    return () => { ipcRenderer.removeListener('trigger-start-all', handler); };
  },
  onTriggerStopAll: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('trigger-stop-all', handler);
    return () => { ipcRenderer.removeListener('trigger-stop-all', handler); };
  },
});
