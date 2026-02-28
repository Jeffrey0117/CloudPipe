import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import fs from 'fs';
import { setupIpcHandlers } from './ipc-handlers';

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

  mainWindow.webContents.openDevTools({ mode: 'detach' });
  mainWindow.show();
  mainWindow.focus();
  log('Window visible!');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function initialize(): Promise<void> {
  log('--- App initializing ---');
  setupIpcHandlers({ getMainWindow: () => mainWindow });
  await createWindow();
}

app.whenReady().then(initialize).catch((err) => {
  log(`FATAL: ${err instanceof Error ? err.stack : String(err)}`);
  app.quit();
});

app.on('window-all-closed', () => {
  app.quit();
});
