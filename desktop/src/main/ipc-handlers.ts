import { ipcMain, BrowserWindow, shell, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { IPC } from '@shared/constants';
import { ApiClient } from './services/api-client';
import { Pm2Manager } from './services/pm2-manager';
import { TunnelManager } from './services/tunnel-manager';
import { ConfigStore } from './services/config-store';
import { scanFolder, scanWorkspace } from './services/folder-scanner';
import { validateToken, getRepos, searchRepos, getStarred } from './services/github-client';
import { TrayManager } from './tray';
import type { Machine, RegisterProjectData, StartupProgress } from '@shared/types';

function readCloudPipeConfig(root: string): { domain?: string } {
  try {
    const raw = fs.readFileSync(path.join(root, 'config.json'), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

interface HandlerDeps {
  getMainWindow: () => BrowserWindow | null;
  trayManager: TrayManager;
}

export function setupIpcHandlers({ getMainWindow, trayManager }: HandlerDeps): { tunnelManager: TunnelManager } {
  const configStore = new ConfigStore();
  const config = configStore.get();
  const apiClient = new ApiClient(config.serverUrl, config.token);
  const pm2Manager = new Pm2Manager();
  const tunnelManager = new TunnelManager();

  tunnelManager.setOnStatusChange((info) => {
    const win = getMainWindow();
    if (win && !win.isDestroyed()) {
      win.webContents.send(IPC.ON_TUNNEL_STATUS, info);
    }
  });

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
    getMainWindow()?.hide();
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
    const root = pm2Manager.getRoot();
    const cpConfig = readCloudPipeConfig(root);
    const domain = cpConfig.domain;
    return (projects as Array<Record<string, unknown>>).map((p) => ({
      ...p,
      pm2: pm2List.find((proc: { name: string }) => proc.name === p.pm2Name),
      localPath: path.join(root, (p.directory as string) || `projects/${p.id}`),
      webUrl: domain ? `https://${p.id}.${domain}` : `http://localhost:${p.port}`,
    }));
  });
  ipcMain.handle(IPC.DEPLOY_PROJECT, async (_e, id: string) => {
    const result = await apiClient.deployProject(id);
    if (result.success) {
      trayManager.notify('Deploy Complete', `${id} deployed successfully`);
    }
    return result;
  });
  ipcMain.handle(IPC.RESTART_PROJECT, async (_e, id: string) => {
    return apiClient.restartProject(id);
  });
  ipcMain.handle(IPC.GET_DEPLOY_HISTORY, async (_e, id?: string) => {
    return apiClient.getDeployHistory(id);
  });

  // --- Deploy All (parallel with concurrency control) ---
  ipcMain.handle(IPC.DEPLOY_ALL, async () => {
    const projects = await apiClient.getProjects() as Array<{ id: string }>;
    const results: Array<{ id: string; success: boolean; error?: string }> = [];
    const CONCURRENCY = 3;

    // Concurrency-limited parallel execution
    let nextIndex = 0;
    async function worker(): Promise<void> {
      while (nextIndex < projects.length) {
        const i = nextIndex++;
        const project = projects[i];
        try {
          const res = await apiClient.deployProjectSync(project.id);
          results[i] = { id: project.id, success: res.success, error: res.error };
          const win = getMainWindow();
          if (win && !win.isDestroyed()) {
            win.webContents.send(IPC.ON_DEPLOY_STATUS, {
              projectId: project.id,
              status: res.success ? 'success' : 'failed',
            });
          }
        } catch (err) {
          results[i] = { id: project.id, success: false, error: (err as Error).message };
        }
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, projects.length) }, () => worker()),
    );

    const successCount = results.filter((r) => r.success).length;
    trayManager.notify(
      'Deploy All Complete',
      `${successCount}/${results.length} projects deployed successfully`,
    );

    return { results };
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
  ipcMain.handle(IPC.OPEN_URL, async (_e, url: string) => {
    shell.openExternal(url);
  });
  ipcMain.handle(IPC.PM2_STATUS, async () => {
    return pm2Manager.getStatus();
  });

  // --- Machines ---
  ipcMain.handle(IPC.GET_MACHINES, () => {
    return configStore.getMachines();
  });
  ipcMain.handle(IPC.ADD_MACHINE, (_e, machine: Machine) => {
    configStore.addMachine(machine);
  });
  ipcMain.handle(IPC.REMOVE_MACHINE, (_e, id: string) => {
    configStore.removeMachine(id);
  });
  ipcMain.handle(IPC.SWITCH_MACHINE, (_e, id: string) => {
    const newConfig = configStore.switchMachine(id);
    apiClient.setServerUrl(newConfig.serverUrl);
    apiClient.setToken(newConfig.token);
    return newConfig;
  });

  // --- Deploy (new project) ---
  ipcMain.handle(IPC.BROWSE_FOLDER, async () => {
    const win = getMainWindow();
    if (!win) return null;
    // Focus window first — on Windows frameless windows, the dialog can appear behind
    win.focus();
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select project folder',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.SCAN_FOLDER, async (_e, folderPath: string) => {
    return scanFolder(folderPath);
  });

  ipcMain.handle(IPC.SCAN_WORKSPACE, async (_e, folderPath: string) => {
    return scanWorkspace(folderPath);
  });

  ipcMain.handle(IPC.REGISTER_PROJECT, async (_e, data: RegisterProjectData) => {
    const root = pm2Manager.getRoot();

    // Manual deploy: copy folder to projects/{id}/ first
    if (data.deployMethod === 'manual' && data.repoUrl) {
      const destDir = path.join(root, 'projects', data.id);
      if (!fs.existsSync(destDir)) {
        fs.cpSync(data.repoUrl, destDir, { recursive: true });
      }
    }

    const registerData: Record<string, unknown> = {
      id: data.id,
      repoUrl: data.deployMethod === 'manual' ? '' : data.repoUrl,
      branch: data.branch,
      port: data.port,
      entryFile: data.entryFile,
      buildCommand: data.buildCommand,
      deployMethod: data.deployMethod,
    };

    const registerResult = await apiClient.registerProject(registerData);
    if (!registerResult.success) return registerResult;

    // Trigger deploy
    const deployResult = await apiClient.deployProject(data.id);
    if (deployResult.success) {
      trayManager.notify('Deploy Complete', `${data.id} registered and deployed`);
    }
    return deployResult;
  });

  ipcMain.handle(IPC.GET_NEXT_PORT, async () => {
    const projects = await apiClient.getProjects() as Array<{ port?: number }>;
    const usedPorts = projects
      .map((p) => p.port)
      .filter((p): p is number => typeof p === 'number');
    const maxPort = usedPorts.length > 0 ? Math.max(...usedPorts) : 4000;
    return maxPort + 1;
  });

  ipcMain.handle(IPC.GITHUB_VALIDATE_TOKEN, async (_e, pat: string) => {
    return validateToken(pat);
  });

  ipcMain.handle(IPC.GITHUB_GET_REPOS, async (_e, pat: string) => {
    return getRepos(pat);
  });

  ipcMain.handle(IPC.GITHUB_SEARCH_REPOS, async (_e, query: string, pat?: string) => {
    return searchRepos(query, pat);
  });

  ipcMain.handle(IPC.GITHUB_GET_STARRED, async (_e, pat: string) => {
    return getStarred(pat);
  });

  // --- Tunnel ---
  ipcMain.handle(IPC.TUNNEL_START, async () => {
    return tunnelManager.start();
  });
  ipcMain.handle(IPC.TUNNEL_STOP, async () => {
    return tunnelManager.stop();
  });
  ipcMain.handle(IPC.TUNNEL_STATUS, () => {
    return tunnelManager.getStatus();
  });

  // --- Startup Sequence (fast boot: pm2 start all at once) ---
  ipcMain.handle(IPC.STARTUP_SEQUENCE, async () => {
    const win = getMainWindow();

    function sendProgress(progress: StartupProgress): void {
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.ON_STARTUP_PROGRESS, progress);
      }
    }

    try {
      // Step 1: Delete all old PM2 processes
      sendProgress({ step: 'deleting', message: 'Cleaning up old processes...' });
      await pm2Manager.deleteAll();

      // Step 2: Start ALL services at once via ecosystem.config.js (fast boot)
      sendProgress({ step: 'starting_core', message: 'Starting all services (parallel)...' });
      const startResult = await pm2Manager.startAll();
      if (!startResult.success) {
        sendProgress({ step: 'failed', message: 'Failed to start services', error: startResult.error });
        return { success: false, error: startResult.error };
      }

      // Step 3: Wait for core health check
      sendProgress({ step: 'health_check', message: 'Waiting for core to become healthy...' });
      const healthResult = await pm2Manager.waitForHealth();
      if (!healthResult.success) {
        sendProgress({ step: 'failed', message: 'Core health check failed', error: healthResult.error });
        return { success: false, error: healthResult.error };
      }

      // Step 4: Report PM2 status
      const pm2List = await pm2Manager.getStatus();
      const onlineCount = pm2List.filter((p) => p.status === 'online').length;
      const totalCount = pm2List.length;

      sendProgress({
        step: 'deploying',
        message: `${onlineCount}/${totalCount} services online`,
        totalProjects: totalCount,
        deployedCount: onlineCount,
      });

      // Step 5: Start cloudflared tunnel
      sendProgress({ step: 'starting_tunnel', message: 'Starting tunnel...' });
      const tunnelResult = await tunnelManager.start();
      if (!tunnelResult.success) {
        sendProgress({
          step: 'complete',
          message: `All services started (tunnel failed: ${tunnelResult.error})`,
          totalProjects: totalCount,
          deployedCount: onlineCount,
        });
        trayManager.notify('Startup Complete', `${onlineCount}/${totalCount} online (tunnel failed)`);
        return { success: true };
      }

      sendProgress({
        step: 'complete',
        message: 'All services started!',
        totalProjects: totalCount,
        deployedCount: onlineCount,
      });
      trayManager.notify('Startup Complete', `${onlineCount}/${totalCount} services online`);
      return { success: true };
    } catch (err) {
      const errorMsg = (err as Error).message;
      sendProgress({ step: 'failed', message: 'Startup failed', error: errorMsg });
      return { success: false, error: errorMsg };
    }
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

  return { tunnelManager };
}
