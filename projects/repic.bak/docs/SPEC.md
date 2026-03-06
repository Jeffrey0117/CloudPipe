# Repic 規格文件

## 版本歷史

| 版本 | 日期 | 變更 |
|------|------|------|
| 0.1.0 | 2025-01 | 初始版本 |

---

## 效能優化記錄 (2025-01-25)

### 已完成優化

| 優化項目 | 檔案 | 說明 |
|----------|------|------|
| 虛擬滾動 | `Sidebar.jsx` | 只渲染可見範圍內的縮略圖，100張圖僅渲染 ~15 個 DOM |
| LRU 緩存 | `imageLoader.js` | 記憶體限制：50 張全圖 + 200 張縮略圖，自動淘汰舊項目 |
| 優先隊列 | `imageLoader.js` | 二分搜尋插入，從 O(n log n) 降至 O(log n) |
| 避免重複讀取 | `useWebAlbums.js` | localStorage 初始化只讀一次 |

---

## .repic 檔案格式規格

### 版本 2 (當前)

```jsonc
{
  "v": 2,
  "type": "virtual-image",
  "url": "https://example.com/image.jpg",
  "name": "my-image",
  "createdAt": 1706000000000,

  // 來源相簿資訊（可選）
  "source": {
    "albumId": "abc123",
    "albumName": "My Album",
    "imageId": "img456",
    "exportedAt": 1706000000000
  },

  // 裁切參數（可選）
  "crop": {
    "x": 10,      // 起始 X (百分比)
    "y": 20,      // 起始 Y (百分比)
    "width": 50,  // 寬度 (百分比)
    "height": 60  // 高度 (百分比)
  },

  // 標註（可選）- 馬賽克、方框、圓形、箭頭
  "annotations": [
    {
      "type": "blur",   // "rect" | "circle" | "arrow" | "blur"
      "x": 30,          // 起始 X (百分比)
      "y": 40,          // 起始 Y (百分比)
      "width": 20,      // 寬度 (百分比)
      "height": 15,     // 高度 (百分比)
      "unit": "%"
    }
  ],

  // 原始圖片尺寸（可選，用於驗證裁切）
  "original": {
    "width": 1920,
    "height": 1080
  },

  // === 版本 3 規劃：編輯參數 ===
  "edits": {
    // 旋轉
    "rotate": 0,  // 0, 90, 180, 270

    // 翻轉
    "flip": {
      "horizontal": false,
      "vertical": false
    },

    // 色彩調整
    "adjustments": {
      "brightness": 0,    // -100 ~ 100
      "contrast": 0,      // -100 ~ 100
      "saturation": 0,    // -100 ~ 100
      "exposure": 0,      // -100 ~ 100
      "temperature": 0,   // -100 ~ 100 (冷暖色調)
      "tint": 0           // -100 ~ 100 (色調偏移)
    },

    // 濾鏡 (預設名稱)
    "filter": null,  // "grayscale" | "sepia" | "vintage" | "cool" | "warm" | null

    // 銳化/模糊
    "sharpen": 0,     // 0 ~ 100
    "blur": 0         // 0 ~ 100
  }
}
```

### 編輯參數設計原則

1. **非破壞性** - 所有編輯都是參數，原圖 URL 不變
2. **可疊加** - 編輯操作按順序應用：crop → rotate → flip → adjustments → filter
3. **可還原** - 刪除參數即還原到上一狀態
4. **延遲應用** - 預覽時用 CSS/Canvas，匯出時才真正處理

### 匯出流程

```
讀取 .repic → 下載原圖 → 應用 edits 參數 → 輸出最終圖片
```

### 預覽流程（高效能）

```
CSS filter: brightness(), contrast(), saturate()
CSS transform: rotate(), scale(-1, 1)
CSS clip-path: inset() for crop
```

---

## 功能狀態

| 功能 | 編輯 | 保存 | 預覽 | 匯出 |
|------|------|------|------|------|
| Crop 裁切 | ✅ | ✅ | ✅ | ✅ |
| Annotations 標註 | ✅ | ✅ | ✅ | ✅ |

### 支援的標註類型
- `rect` - 方框
- `circle` - 圓形
- `arrow` - 箭頭
- `blur` - 模糊/馬賽克

---

## 相關檔案

| 檔案 | 說明 |
|------|------|
| `src/utils/repicFile.js` | .repic 檔案讀寫工具 |
| `src/features/editor/ImageEditor.jsx` | 圖片編輯器 |
| `src/features/editor/ImageCropper.jsx` | 裁切工具 |
| `src/hooks/useWebAlbums.js` | 相簿管理 (含 crop 儲存) |
