# 收藏功能規格

## 現狀分析

### 已完成
| 層級 | 狀態 | 說明 |
|------|------|------|
| 資料庫 | ✅ | `collections`, `collection_items` 表已建立 |
| API | ✅ | CRUD 端點已實作 |
| 收藏夾管理頁 | ✅ | `/lurl/member/collections` |
| 收藏項目頁 | ✅ | 可查看收藏夾內容 |

### 待實作
| 功能 | 優先級 | 說明 |
|------|--------|------|
| View 頁收藏按鈕 | P0 | 用戶最需要的功能 |
| Browse 頁快捷收藏 | P1 | 列表頁直接收藏 |
| 收藏狀態顯示 | P1 | 已收藏的要有標記 |

## 會員系統架構

### 會員等級 (users.tier)
| 等級 | 代碼 | 收藏功能 |
|------|------|---------|
| 免費會員 | `free` | ❌ 不可用 |
| 老司機 | `premium` | ✅ 可用 |
| 管理員 | `admin` | ✅ 可用 |

### 資料結構
```sql
-- 收藏夾
collections (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,        -- 所屬用戶
  name TEXT DEFAULT '預設收藏', -- 收藏夾名稱
  isPrivate INTEGER DEFAULT 1,  -- 是否私密
  createdAt TEXT
)

-- 收藏項目
collection_items (
  id TEXT PRIMARY KEY,
  collectionId TEXT NOT NULL,
  recordId TEXT NOT NULL,       -- 收藏的內容 ID
  addedAt TEXT,
  UNIQUE(collectionId, recordId)
)
```

## View 頁收藏功能規格

### UI 設計
```
┌─────────────────────────────────────┐
│  [下載]  [D卡文章]  [⭐ 收藏 ▾]     │
└─────────────────────────────────────┘
                     ↓ 點擊展開
┌─────────────────────────────────────┐
│ ⭐ 收藏到...                        │
│ ┌─────────────────────────────────┐ │
│ │ ☑ 預設收藏                      │ │
│ │ ☐ 精選合集                      │ │
│ │ ☐ 待看清單                      │ │
│ └─────────────────────────────────┘ │
│ [+ 新增收藏夾]                      │
└─────────────────────────────────────┘
```

### 行為
1. **已登入 + 可用收藏**
   - 點擊按鈕顯示收藏夾選單
   - 可勾選/取消勾選多個收藏夾
   - 勾選後即時同步（不用按確認）

2. **已登入 + 免費會員**
   - 按鈕顯示鎖頭 🔒
   - 點擊提示「升級老司機解鎖」

3. **未登入**
   - 點擊跳轉登入頁

### API 調用
```javascript
// 取得用戶收藏夾（含此內容是否已收藏）
GET /lurl/api/collections?recordId={recordId}
Response: { collections: [{ id, name, hasRecord: true/false }] }

// 加入收藏
POST /lurl/api/collections/{collectionId}/items
Body: { recordId }

// 移除收藏
DELETE /lurl/api/collections/{collectionId}/items/{recordId}
```

## Browse 頁快捷收藏（P1）

### UI
- 卡片右上角顯示收藏圖標
- 未收藏：空心星 ☆
- 已收藏：實心星 ⭐
- 點擊加入「預設收藏」

### 預載收藏狀態
```javascript
// 批量查詢收藏狀態
GET /lurl/api/collections/status?recordIds=id1,id2,id3
Response: { favorites: { id1: true, id2: false, id3: true } }
```

## 實作順序

### Phase 1: View 頁收藏按鈕（今天）
1. 加入收藏按鈕到 actions 區
2. 實作收藏夾選單 UI
3. 呼叫現有 API
4. 處理權限檢查

### Phase 2: Browse 頁快捷收藏
1. 加入卡片收藏圖標
2. 實作批量查詢 API
3. 預設收藏夾快捷操作

### Phase 3: 進階功能
1. 收藏夾分享（取消私密）
2. 收藏數統計
3. 熱門收藏排行
