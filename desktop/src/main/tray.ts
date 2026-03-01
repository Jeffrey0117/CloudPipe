import { Tray, Menu, nativeImage, BrowserWindow, Notification, app } from 'electron';
import zlib from 'zlib';

type TrayStatus = 'green' | 'yellow' | 'red';

// CRC32 table for PNG generation
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createColoredIcon(r: number, g: number, b: number): Electron.NativeImage {
  const size = 16;
  // Raw pixel data with filter byte per row
  const raw = Buffer.alloc(size * (1 + size * 4), 0);
  for (let y = 0; y < size; y++) {
    const rowOff = y * (1 + size * 4);
    raw[rowOff] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const px = rowOff + 1 + x * 4;
      const dx = x - 7.5, dy = y - 7.5;
      if (dx * dx + dy * dy < 42) {
        raw[px] = r;
        raw[px + 1] = g;
        raw[px + 2] = b;
        raw[px + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(raw);

  // IHDR data
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);  // width
  ihdrData.writeUInt32BE(size, 4);  // height
  ihdrData[8] = 8;                  // bit depth
  ihdrData[9] = 6;                  // color type RGBA
  ihdrData[10] = 0;                 // compression
  ihdrData[11] = 0;                 // filter
  ihdrData[12] = 0;                 // interlace

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = pngChunk('IHDR', ihdrData);
  const idat = pngChunk('IDAT', compressed);
  const iend = pngChunk('IEND', Buffer.alloc(0));

  const png = Buffer.concat([signature, ihdr, idat, iend]);
  return nativeImage.createFromBuffer(png);
}

const STATUS_COLORS: Record<TrayStatus, [number, number, number]> = {
  green: [0x22, 0xc5, 0x5e],
  yellow: [0xea, 0xb3, 0x08],
  red: [0xef, 0x44, 0x44],
};

export interface TrayCallbacks {
  onStartAll: () => void;
  onStopAll: () => void;
  onToggleTunnel: () => void;
}

export class TrayManager {
  private tray: Tray | null = null;
  private mainWindow: BrowserWindow | null = null;
  private status: TrayStatus = 'red';
  private tunnelRunning = false;
  private callbacks: TrayCallbacks | null = null;

  create(mainWindow: BrowserWindow, callbacks: TrayCallbacks): void {
    this.mainWindow = mainWindow;
    this.callbacks = callbacks;

    const [r, g, b] = STATUS_COLORS[this.status];
    const icon = createColoredIcon(r, g, b);
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
    const tunnelLabel = this.tunnelRunning ? 'Stop Tunnel' : 'Start Tunnel';
    const menu = Menu.buildFromTemplate([
      { label: 'Show Window', click: () => this.showWindow() },
      { type: 'separator' },
      { label: 'Start All', click: () => this.callbacks?.onStartAll() },
      { label: 'Stop All', click: () => this.callbacks?.onStopAll() },
      { label: tunnelLabel, click: () => this.callbacks?.onToggleTunnel() },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          this.mainWindow?.destroy();
          app.quit();
        },
      },
    ]);
    this.tray.setContextMenu(menu);
  }

  setStatus(status: TrayStatus): void {
    if (this.status === status) return;
    this.status = status;
    if (this.tray) {
      const [r, g, b] = STATUS_COLORS[status];
      this.tray.setImage(createColoredIcon(r, g, b));
      const tooltip = status === 'green' ? 'All Online' : status === 'yellow' ? 'Partial' : 'Offline';
      this.tray.setToolTip(`CloudPipe - ${tooltip}`);
    }
  }

  setTunnelRunning(running: boolean): void {
    if (this.tunnelRunning === running) return;
    this.tunnelRunning = running;
    this.updateMenu();
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
