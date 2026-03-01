import { app, BrowserWindow, Menu, globalShortcut } from 'electron';
import path from 'path';
import fs from 'fs';
import { setupIpcHandlers } from './ipc-handlers';
import { TrayManager } from './tray';
import { TunnelManager } from './services/tunnel-manager';
import { IPC } from '@shared/constants';

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    const logDir = app.isReady() ? app.getPath('userData') : __dirname;
    fs.appendFileSync(path.join(logDir, 'crash.log'), line + '\n');
  } catch { /* ignore */ }
}

process.on('uncaughtException', (err) => {
  log(`UNCAUGHT: ${err.stack ?? err.message}`);
  console.error('UNCAUGHT:', err);
  app.quit();
});
process.on('unhandledRejection', (reason) => {
  log(`UNHANDLED: ${reason}`);
  console.error('UNHANDLED:', reason);
  app.quit();
});

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;
declare const MAIN_WINDOW_PRELOAD_VITE_ENTRY: string;

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;
let tunnelManager: TunnelManager | null = null;
const trayManager = new TrayManager();

function getPreloadPath(): string {
  if (typeof MAIN_WINDOW_PRELOAD_VITE_ENTRY === 'string' && MAIN_WINDOW_PRELOAD_VITE_ENTRY) {
    log(`Using Forge preload: ${MAIN_WINDOW_PRELOAD_VITE_ENTRY}`);
    return MAIN_WINDOW_PRELOAD_VITE_ENTRY;
  }
  // esbuild prestart builds to dist/preload.js
  const candidates = [
    path.join(__dirname, '..', '..', 'dist', 'preload.js'),
    path.join(__dirname, 'preload.js'),
    path.join(__dirname, '..', 'preload.js'),
  ];
  for (const p of candidates) {
    log(`Checking preload: ${p} → ${fs.existsSync(p)}`);
    if (fs.existsSync(p)) return p;
  }
  log('No preload found!');
  return candidates[0];
}

const PAGES = ['dashboard', 'projects', 'logs', 'gateway', 'deploy', 'settings'] as const;

function registerShortcuts(): void {
  // Ctrl+1~5: navigate pages
  for (let i = 0; i < PAGES.length; i++) {
    globalShortcut.register(`CommandOrControl+${i + 1}`, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.webContents.send(IPC.ON_NAVIGATE_PAGE, PAGES[i]);
      }
    });
  }

  // Ctrl+D: deploy all
  globalShortcut.register('CommandOrControl+D', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.webContents.send(IPC.ON_NAVIGATE_PAGE, 'dashboard');
      // Trigger deploy-all via a custom event the renderer listens for
      mainWindow.webContents.send('trigger-deploy-all');
    }
  });

  // Ctrl+Shift+S: start all (avoid Ctrl+S which is "save" in many contexts)
  globalShortcut.register('CommandOrControl+Shift+S', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.webContents.send('trigger-start-all');
    }
  });
}

async function createWindow(): Promise<void> {
  log('Creating BrowserWindow...');
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 550,
    frame: false,
    backgroundColor: '#0f0f0f',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: getPreloadPath(),
    },
    show: false,
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    const filePath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    await mainWindow.loadFile(filePath);
  }

  mainWindow.show();
  mainWindow.focus();
  log('Window visible!');

  // Close = hide to tray (not quit)
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Tray
  trayManager.create(mainWindow, {
    onStartAll: () => {
      mainWindow?.webContents.send('trigger-start-all');
    },
    onStopAll: () => {
      mainWindow?.webContents.send('trigger-stop-all');
    },
    onToggleTunnel: async () => {
      if (!tunnelManager) return;
      const info = tunnelManager.getStatus();
      if (info.status === 'running') {
        await tunnelManager.stop();
        trayManager.setTunnelRunning(false);
      } else {
        await tunnelManager.start();
        trayManager.setTunnelRunning(tunnelManager.getStatus().status === 'running');
      }
    },
  });
}

async function initialize(): Promise<void> {
  log('--- App initializing ---');
  const handlers = setupIpcHandlers({ getMainWindow: () => mainWindow, trayManager });
  tunnelManager = handlers.tunnelManager;
  await createWindow();
  registerShortcuts();
}

app.whenReady().then(initialize).catch((err) => {
  log(`FATAL: ${err instanceof Error ? err.stack : String(err)}`);
  app.quit();
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // On Windows, keep app running in tray
  // Only quit when tray "Quit" is clicked (sets isQuitting = true)
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  tunnelManager?.destroy();
  trayManager.destroy();
});
