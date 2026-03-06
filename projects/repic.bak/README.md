<div align="center">
  <img src="repic-logo.png" alt="RePic Logo" width="120">
  <br><br>
  <img src="repic.png" alt="RePic" width="400">

  <p><strong>Re:define how you see pictures.</strong></p>

  <p>
    <a href="https://github.com/Jeffrey0117/RePic/releases"><img src="https://img.shields.io/github/v/release/Jeffrey0117/RePic?label=download&color=0A84FF" alt="Download"></a>
    <img src="https://img.shields.io/badge/platform-Windows%2010+-0A84FF" alt="Platform">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License">
  </p>

  <p>
    <a href="https://jeffrey0117.github.io/RePic/">Website</a> &middot;
    <a href="https://jeffrey0117.github.io/RePic/intro.html">Story</a> &middot;
    <a href="./README.zh-TW.md">繁體中文</a>
  </p>
</div>

---

## What is RePic?

RePic is a desktop image viewer and manager that **rethinks how images are stored and organized**.

Instead of downloading every image to your hard drive, RePic introduces **Virtual Albums** — collections of web images that take **zero disk space**. When you need real files, pin them to disk as `.repic` shortcut files (under 1 KB each).

### The core idea

```
Traditional:  Save image → 5 MB on disk → one copy per device
RePic:        Drag image → 0 KB (virtual) or <1 KB (.repic) → URL stays in the cloud
```

## Features

### Virtual Albums — 0 KB
Drag images from any website into RePic. No downloads, no disk usage — just URLs stored in memory. Browse, crop, and annotate them as if they were local files.

### .repic Files — Pin to Disk
Want real files? Pin an album to create `.repic` shortcut files visible in File Explorer. Each file is a tiny JSON with the image URL — shareable, backupable, double-click to open.

```json
{
  "v": 2,
  "type": "virtual-image",
  "url": "https://example.com/photo.jpg",
  "crop": { "x": 120, "y": 80, "width": 640, "height": 480 }
}
```

### Local → Cloud Virtualization
Upload a local image to the cloud, then convert it to a `.repic` file. 5 MB photo becomes a 0.5 KB shortcut — 99.99% space savings with the same visual result.

### Everything Else
- **Blazing fast browsing** — Virtual scrolling + thumbnail preloading
- **Non-destructive editing** — Crop, annotate, mosaic without touching originals
- **Drag to share** — Drag images straight to Discord, LINE, or any app
- **Clipboard paste** — Ctrl+V to import screenshots instantly
- **Hotlink bypass** — Automatic proxy for protected images (Instagram, etc.)
- **Dark & light themes** — iOS-inspired UI
- **i18n** — English / Traditional Chinese

## Getting Started

### Download

Grab the latest installer from [Releases](https://github.com/Jeffrey0117/RePic/releases).

**Requirements:** Windows 10 or later.

### Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build for Windows
npm run electron:build
```

Output: `release/` folder with NSIS installer.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Electron 31 |
| Frontend | React 19 + Vite 7 |
| Styling | TailwindCSS v4 |
| Image processing | Sharp |
| Cropping | react-image-crop |
| Virtual scrolling | react-window |

## Roadmap

- [x] Virtual albums (0 KB web image collections)
- [x] .repic file format v2 (read, write, batch export)
- [x] Non-destructive crop & annotations
- [x] Cloud upload (urusai.cc)
- [x] Album import/export (JSON backup)
- [x] Sidebar position toggle
- [x] Thumbnail cache (IndexedDB)
- [x] Offline image cache
- [ ] Pin album to disk (auto-create .repic folder)
- [ ] Unpin album (read back to virtual)
- [ ] Local image → cloud → .repic virtualization
- [ ] Batch virtualize / materialize
- [ ] File Explorer shell extension (Windows)

## Contributing

Found a bug or have an idea? [Open an issue](https://github.com/Jeffrey0117/RePic/issues) — every report is read.

## License

[MIT](LICENSE)
