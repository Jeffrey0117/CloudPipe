import { Tray, Menu, nativeImage, BrowserWindow, Notification } from 'electron';
import path from 'path';

type TrayStatus = 'green' | 'yellow' | 'red';

export class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private status: TrayStatus = 'red';

  create(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;

    // Create a simple 16x16 tray icon
    const icon = nativeImage.createEmpty();
    this.tray = new Tray(icon);
    this.tray.setToolTip('CloudPipe Desktop');
    this.updateMenu();

    this.tray.on('click', () => {
      this.showWindow();
    });
  }

  private showWindow(): void {
    if (this.mainWindow) {
      this.mainWindow.show();
      this.mainWindow.focus();
    }
  }

  private updateMenu(): void {
    if (!this.tray) return;
    const menu = Menu.buildFromTemplate([
      { label: 'Show Window', click: () => this.showWindow() },
      { type: 'separator' },
      { label: 'Quit', click: () => { this.mainWindow?.destroy(); } },
    ]);
    this.tray.setContextMenu(menu);
  }

  setStatus(status: TrayStatus): void {
    this.status = status;
    if (this.tray) {
      this.tray.setToolTip(`CloudPipe - ${status === 'green' ? 'All Online' : status === 'yellow' ? 'Partial' : 'Offline'}`);
    }
  }

  notify(title: string, body: string): void {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
