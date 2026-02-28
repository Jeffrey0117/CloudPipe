import { ipcMain, BrowserWindow } from 'electron';
import { IPC } from '@shared/constants';
import { ApiClient } from './services/api-client';
import { Pm2Manager } from './services/pm2-manager';
import { ConfigStore } from './services/config-store';

interface HandlerDeps {
  getMainWindow: () => BrowserWindow | null;
}

export function setupIpcHandlers({ getMainWindow }: HandlerDeps): void {
  const configStore = new ConfigStore();
  const config = configStore.get();
  const apiClient = new ApiClient(config.serverUrl, config.token);
  const pm2Manager = new Pm2Manager();

  // --- Window controls ---
  ipcMain.handle(IPC.WIN_MINIMIZE, () => {
    getMainWindow()?.minimize();
  });
  ipcMain.handle(IPC.WIN_MAXIMIZE, () => {
    const win = getMainWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });
  ipcMain.handle(IPC.WIN_CLOSE, () => {
    getMainWindow()?.close();
  });
  ipcMain.handle(IPC.WIN_IS_MAXIMIZED, () => {
    return getMainWindow()?.isMaximized() ?? false;
  });

  // --- Auth ---
  ipcMain.handle(IPC.LOGIN, async (_e, serverUrl: string, password: string) => {
    apiClient.setServerUrl(serverUrl);
    const result = await apiClient.login(password);
    if (result.token) {
      apiClient.setToken(result.token);
      configStore.set({ serverUrl, token: result.token });
    }
    return result;
  });
  ipcMain.handle(IPC.VERIFY_TOKEN, async () => {
    return apiClient.verifyToken();
  });
  ipcMain.handle(IPC.LOGOUT, async () => {
    apiClient.setToken('');
    configStore.set({ token: '' });
  });

  // --- Projects ---
  ipcMain.handle(IPC.GET_PROJECTS, async () => {
    const [projects, pm2List] = await Promise.all([
      apiClient.getProjects(),
      pm2Manager.getStatus(),
    ]);
    return projects.map((p: Record<string, unknown>) => ({
      ...p,
      pm2: pm2List.find((proc: { name: string }) => proc.name === p.pm2Name),
    }));
  });
  ipcMain.handle(IPC.DEPLOY_PROJECT, async (_e, id: string) => {
    return apiClient.deployProject(id);
  });
  ipcMain.handle(IPC.RESTART_PROJECT, async (_e, id: string) => {
    return apiClient.restartProject(id);
  });
  ipcMain.handle(IPC.GET_DEPLOY_HISTORY, async (_e, id?: string) => {
    return apiClient.getDeployHistory(id);
  });

  // --- Logs ---
  ipcMain.handle(IPC.GET_LOGS, async (_e, pm2Name: string) => {
    return apiClient.getLogs(pm2Name);
  });

  // --- System ---
  ipcMain.handle(IPC.GET_SYSTEM_INFO, async () => {
    return apiClient.getSystemInfo();
  });

  // --- Gateway ---
  ipcMain.handle(IPC.GET_TOOLS, async () => {
    return apiClient.getTools();
  });
  ipcMain.handle(IPC.GET_PIPELINES, async () => {
    return apiClient.getPipelines();
  });
  ipcMain.handle(IPC.CALL_TOOL, async (_e, tool: string, params: Record<string, unknown>) => {
    return apiClient.callTool(tool, params);
  });
  ipcMain.handle(IPC.RUN_PIPELINE, async (_e, pipeline: string, input: Record<string, unknown>) => {
    return apiClient.runPipeline(pipeline, input);
  });

  // --- PM2 local ---
  ipcMain.handle(IPC.PM2_START_ALL, async () => {
    return pm2Manager.startAll();
  });
  ipcMain.handle(IPC.PM2_STOP_ALL, async () => {
    return pm2Manager.stopAll();
  });
  ipcMain.handle(IPC.PM2_STATUS, async () => {
    return pm2Manager.getStatus();
  });

  // --- Config ---
  ipcMain.handle(IPC.GET_CONFIG, () => {
    return configStore.get();
  });
  ipcMain.handle(IPC.SET_CONFIG, (_e, updates: Record<string, unknown>) => {
    configStore.set(updates);
    if (updates.serverUrl) apiClient.setServerUrl(updates.serverUrl as string);
    if (updates.token) apiClient.setToken(updates.token as string);
    return configStore.get();
  });
}
