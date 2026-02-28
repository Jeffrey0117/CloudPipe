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
});
