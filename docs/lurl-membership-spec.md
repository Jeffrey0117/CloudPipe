# LurlHub 會員系統規格書

## 版本
- v1.0.0
- 日期：2026-01-22

---

## 1. 商業模型概述

### 核心概念
- **額度**：用於恢復過期資源（原始來源已失效的內容）
- **資源存取權**：依會員等級決定可存取的資源時間範圍
- **24小時規則**：「當日資源」定義為上傳後 24 小時內的內容

### 用戶來源
主要來自 Tampermonkey 腳本用戶，自動獲得 `visitorId` 追蹤。

---

## 2. 付費層級定義

### 2.1 免費訪客
| 項目 | 內容 |
|------|------|
| 價格 | 免費 |
| 識別 | visitorId（自動產生）|
| 每月額度 | 3 點 |
| 資源存取 | 僅預覽（縮圖） |
| 功能 | 瀏覽、使用腳本備份 |

### 2.2 額度包訂閱
| 項目 | 內容 |
|------|------|
| 價格 | $199/月 |
| 識別 | visitorId（不需註冊）|
| 每月額度 | 20 點 |
| 資源存取 | 僅預覽 + 額度恢復 |
| 功能 | 同免費，額度更多 |

### 2.3 基礎會員
| 項目 | 內容 |
|------|------|
| 價格 | $599/月 |
| 識別 | 註冊帳號（Email）|
| 每月額度 | 30 點 |
| 資源存取 | 24小時內資源完整存取 |
| 功能 | 觀看歷史、下載記錄、個人資料 |

### 2.4 進階會員
| 項目 | 內容 |
|------|------|
| 價格 | $899/月 |
| 識別 | 註冊帳號（Email）|
| 每月額度 | 不需要（全開）|
| 資源存取 | 全資料庫完整存取 |
| 功能 | 收藏/相簿、隱藏內容、標籤訂閱、批量下載、優先處理 |

### 2.5 超級大會員
| 項目 | 內容 |
|------|------|
| 價格 | $6,999 一次性 |
| 內容 | 完整源碼授權 |
| 包含 | 部署協助、技術文件、1個月技術支援 |
| 適合 | 工作室、重度收藏者、想自架的用戶 |

---

## 3. 資源存取矩陣

| 用戶類型 | 24h內資源 | 歷史資源 | 過期資源 |
|---------|:--------:|:--------:|:--------:|
| 免費訪客 | 預覽 | 預覽 | 需額度 |
| 額度包 | 預覽 | 預覽 | 需額度 |
| 基礎會員 | ✓ 完整 | 預覽 | 需額度 |
| 進階會員 | ✓ 完整 | ✓ 完整 | ✓ 完整 |

### 名詞定義
- **預覽**：可看縮圖、標題、基本資訊，無法播放/下載完整檔案
- **完整存取**：可播放、下載
- **過期資源**：原始來源已失效，需透過本地備份存取
- **24h內資源**：`capturedAt` 在 24 小時內

---

## 4. 功能對照表

| 功能 | 免費 | 額度包 | 基礎會員 | 進階會員 |
|------|:----:|:------:|:--------:|:--------:|
| 瀏覽內容 | ✓ | ✓ | ✓ | ✓ |
| 腳本備份 | ✓ | ✓ | ✓ | ✓ |
| 額度恢復 | ✓ | ✓ | ✓ | - |
| 個人資料 | ✗ | ✗ | ✓ | ✓ |
| 觀看歷史 | ✗ | ✗ | ✓ | ✓ |
| 下載記錄 | ✗ | ✗ | ✓ | ✓ |
| 收藏/相簿 | ✗ | ✗ | ✗ | ✓ |
| 隱藏內容 | ✗ | ✗ | ✗ | ✓ |
| 標籤訂閱 | ✗ | ✗ | ✗ | ✓ |
| 批量下載 | ✗ | ✗ | ✗ | ✓ |
| 優先處理 | ✗ | ✗ | ✗ | ✓ |

---

## 5. 資料庫 Schema

### 5.1 users 表（會員帳號）
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- uuid
  email TEXT UNIQUE NOT NULL,
  passwordHash TEXT NOT NULL,
  nickname TEXT,
  avatar TEXT,
  tier TEXT DEFAULT 'free',      -- free | basic | premium
  tierExpiry TEXT,               -- 訂閱到期日
  quotaBalance INTEGER DEFAULT 0,-- 剩餘額度
  createdAt TEXT,
  lastLoginAt TEXT
);
```

### 5.2 visitors 表（訪客/額度包用戶）
```sql
-- 現有 quotas 表擴充
ALTER TABLE quotas ADD COLUMN tier TEXT DEFAULT 'free';  -- free | quota_pack
ALTER TABLE quotas ADD COLUMN tierExpiry TEXT;
```

### 5.3 subscriptions 表（訂閱記錄）
```sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  userId TEXT,                   -- 關聯 users.id 或 quotas.visitorId
  userType TEXT,                 -- 'user' | 'visitor'
  tier TEXT NOT NULL,            -- quota_pack | basic | premium
  amount INTEGER,                -- 金額
  startAt TEXT,
  endAt TEXT,
  status TEXT,                   -- active | cancelled | expired
  paymentMethod TEXT,
  paymentId TEXT,                -- 金流交易編號
  createdAt TEXT
);
```

### 5.4 collections 表（收藏/相簿）
```sql
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT DEFAULT '預設收藏',
  isPrivate INTEGER DEFAULT 1,
  createdAt TEXT
);

CREATE TABLE collection_items (
  id TEXT PRIMARY KEY,
  collectionId TEXT NOT NULL,
  recordId TEXT NOT NULL,        -- 關聯 records.id
  addedAt TEXT,
  UNIQUE(collectionId, recordId)
);
```

### 5.5 watch_history 表（觀看歷史）
```sql
CREATE TABLE watch_history (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  recordId TEXT NOT NULL,
  watchedAt TEXT,
  progress INTEGER DEFAULT 0,    -- 影片播放進度（秒）
  UNIQUE(userId, recordId)
);
```

### 5.6 hidden_records 表（隱藏內容）
```sql
CREATE TABLE hidden_records (
  userId TEXT NOT NULL,
  recordId TEXT NOT NULL,
  hiddenAt TEXT,
  PRIMARY KEY(userId, recordId)
);
```

### 5.7 tag_subscriptions 表（標籤訂閱）
```sql
CREATE TABLE tag_subscriptions (
  userId TEXT NOT NULL,
  tag TEXT NOT NULL,
  subscribedAt TEXT,
  PRIMARY KEY(userId, tag)
);
```

---

## 6. API 端點規劃

### 6.1 認證
```
POST /lurl/api/auth/register     # 註冊
POST /lurl/api/auth/login        # 登入
POST /lurl/api/auth/logout       # 登出
POST /lurl/api/auth/refresh      # 刷新 token
POST /lurl/api/auth/forgot       # 忘記密碼
```

### 6.2 會員
```
GET  /lurl/api/member/profile    # 個人資料
PUT  /lurl/api/member/profile    # 更新資料
GET  /lurl/api/member/quota      # 額度狀態
GET  /lurl/api/member/history    # 觀看歷史
DELETE /lurl/api/member/history  # 清除歷史
```

### 6.3 收藏
```
GET  /lurl/api/collections                    # 列出收藏夾
POST /lurl/api/collections                    # 建立收藏夾
PUT  /lurl/api/collections/:id                # 更新收藏夾
DELETE /lurl/api/collections/:id              # 刪除收藏夾
POST /lurl/api/collections/:id/items          # 加入收藏
DELETE /lurl/api/collections/:id/items/:recordId  # 移除收藏
```

### 6.4 偏好
```
POST /lurl/api/hide/:recordId    # 隱藏內容
DELETE /lurl/api/hide/:recordId  # 取消隱藏
GET  /lurl/api/tags/subscribed   # 已訂閱標籤
POST /lurl/api/tags/subscribe    # 訂閱標籤
DELETE /lurl/api/tags/subscribe  # 取消訂閱
```

### 6.5 付費
```
POST /lurl/api/payment/create    # 建立訂單
POST /lurl/api/payment/callback  # 金流回調
GET  /lurl/api/payment/history   # 交易記錄
```

---

## 7. 頁面規劃

### 7.1 路由結構
```
/lurl/member/login       # 登入頁
/lurl/member/register    # 註冊頁
/lurl/member/profile     # 個人資料
/lurl/member/collections # 收藏/相簿
/lurl/member/history     # 觀看歷史
/lurl/member/quota       # 額度/訂閱
/lurl/member/settings    # 帳號設定
/lurl/member/upgrade     # 升級頁面（價格表）
```

### 7.2 頁面權限
| 頁面 | 免費 | 額度包 | 基礎會員 | 進階會員 |
|------|:----:|:------:|:--------:|:--------:|
| login/register | ✓ | ✓ | ✓ | ✓ |
| upgrade | ✓ | ✓ | ✓ | ✓ |
| profile | ✗ | ✗ | ✓ | ✓ |
| history | ✗ | ✗ | ✓ | ✓ |
| quota | ✓ | ✓ | ✓ | ✓ |
| collections | ✗ | ✗ | ✗ | ✓ |
| settings | ✗ | ✗ | ✓ | ✓ |

---

## 8. 實作優先順序

### Phase 1：基礎架構
1. [ ] users 表 + 認證 API
2. [ ] 登入/註冊頁面
3. [ ] JWT token 機制
4. [ ] 資源存取權限檢查（24h 規則）

### Phase 2：額度系統
5. [ ] 額度消耗/檢查邏輯
6. [ ] 額度頁面（顯示剩餘）
7. [ ] visitorId 升級會員（額度合併）

### Phase 3：會員功能
8. [ ] 個人資料頁面
9. [ ] 觀看歷史
10. [ ] 下載記錄

### Phase 4：進階功能
11. [ ] 收藏/相簿
12. [ ] 隱藏內容
13. [ ] 標籤訂閱

### Phase 5：金流整合
14. [ ] 金流串接（綠界/藍新）
15. [ ] 訂閱管理
16. [ ] 交易記錄

### Phase 6：超級大會員
17. [ ] 源碼打包機制
18. [ ] 部署文件
19. [ ] 授權驗證

---

## 9. 安全考量

- 密碼使用 bcrypt 雜湊
- JWT 有效期 7 天，refresh token 30 天
- 敏感操作需重新驗證密碼
- 金流回調驗證簽章
- Rate limiting 防止濫用

---

## 10. 未來擴展

- 社交登入（Google / Discord）
- 推薦系統
- 成就系統
- 邀請獎勵
- API 存取（開發者方案）
