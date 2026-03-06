<div align="center">
  <img src="repic-logo.png" alt="RePic Logo" width="120">
  <br><br>
  <img src="repic.png" alt="RePic" width="400">

  <p><strong>Re:define — 重新定義圖片體驗。</strong></p>

  <p>
    <a href="https://github.com/Jeffrey0117/RePic/releases"><img src="https://img.shields.io/github/v/release/Jeffrey0117/RePic?label=%E4%B8%8B%E8%BC%89&color=0A84FF" alt="下載"></a>
    <img src="https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Windows%2010+-0A84FF" alt="平台">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="授權">
  </p>

  <p>
    <a href="https://jeffrey0117.github.io/RePic/">官網</a> &middot;
    <a href="https://jeffrey0117.github.io/RePic/intro.html">故事</a> &middot;
    <a href="./README.md">English</a>
  </p>
</div>

---

## RePic 是什麼？

RePic 是一個桌面圖片瀏覽器與管理工具，**重新思考圖片的儲存與整理方式**。

不用把每張圖片都下載到硬碟。RePic 的**虛擬相簿**讓你收藏網路圖片，磁碟佔用 **0 KB**。需要實體檔案時，釘選成 `.repic` 捷徑檔（每個不到 1 KB）。

### 核心概念

```
傳統做法：  儲存圖片 → 佔 5 MB → 每台電腦存一份
RePic：    拖入圖片 → 0 KB（虛擬）或 <1 KB（.repic）→ URL 留在雲端
```

## 功能

### 虛擬相簿 — 0 KB
從任何網站拖圖片到 RePic。不下載、不佔空間 — URL 存在記憶體裡。瀏覽、裁切、標註，跟本地圖片一樣。

### .repic 檔案 — 釘選到磁碟
想要實體檔案？釘選相簿，每張圖變成檔案總管裡看得到的 `.repic` 捷徑檔。JSON 格式，可分享、可備份，雙擊就能開。

```json
{
  "v": 2,
  "type": "virtual-image",
  "url": "https://example.com/photo.jpg",
  "crop": { "x": 120, "y": 80, "width": 640, "height": 480 }
}
```

### 本地圖片雲端虛擬化
上傳本地圖片到雲端，轉成 `.repic` 檔案。5 MB 的照片變成 0.5 KB 的捷徑 — 省了 99.99% 的空間。

### 其他功能
- **極速瀏覽** — 虛擬捲動 + 縮圖預載
- **非破壞性編輯** — 裁切、標註、馬賽克，原圖不動
- **拖曳分享** — 直接拖到 Discord、LINE 就能傳
- **剪貼簿貼上** — Ctrl+V 匯入截圖
- **防盜連繞過** — 自動代理受保護的圖片
- **暗色 / 亮色主題** — iOS 風格 UI
- **多語系** — English / 繁體中文

## 下載

從 [Releases](https://github.com/Jeffrey0117/RePic/releases) 下載最新安裝包。

**系統需求：** Windows 10 以上。

## 開發

```bash
npm install
npm run electron:dev      # 開發模式
npm run electron:build    # 建置 Windows 安裝包
```

## 授權

[MIT](LICENSE)
