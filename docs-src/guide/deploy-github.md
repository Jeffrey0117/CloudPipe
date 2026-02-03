# GitHub 部署

CloudPipe 支援從 GitHub 自動部署，push 到 repo 後幾秒內就會自動更新。

## 建立專案

### 透過 Dashboard

1. 打開 Dashboard → 部署管理
2. 點擊「新增專案」
3. 填入：
   - **專案 ID**：唯一識別碼，會變成 subdomain（如 `my-app.isnowfriend.com`）
   - **GitHub URL**：repo 網址
   - **Branch**：要部署的分支（預設 `main`）

### 透過 API

```bash
curl -X POST https://epi.isnowfriend.com/api/_admin/deploy/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-app",
    "name": "My App",
    "deployMethod": "github",
    "repoUrl": "https://github.com/you/my-app",
    "branch": "main"
  }'
```

## 自動部署機制

CloudPipe 有兩種自動部署方式：

### 1. Webhook（即時）

建立專案時會自動設定 GitHub Webhook。當你 push 到指定 branch：

1. GitHub 發送 webhook 到 `https://epi.isnowfriend.com/webhook/{project-id}`
2. CloudPipe 驗證簽名
3. 觸發部署流程

::: tip
新建專案時 Webhook 會自動設定，不需要手動操作。
:::

### 2. Polling（備援）

每 5 分鐘檢查一次 GitHub 最新 commit，如果有新的就自動部署。

這是備援機制，萬一 webhook 沒觸發也不會漏掉更新。

## 部署流程

當觸發部署時，CloudPipe 會執行：

```
1. git fetch origin {branch}
2. git reset --hard origin/{branch}
3. 偵測 package manager (pnpm/yarn/npm)
4. 安裝依賴（有快取，依賴沒變不會重裝）
5. 執行 build（如果 package.json 有 build script）
6. PM2 重啟服務
7. Health Check 確認啟動
8. 更新 DNS（如果是新專案）
```

## 支援的專案類型

| 類型 | 偵測方式 | 啟動方式 |
|------|----------|----------|
| **Node.js** | 有 `server.js` 或 `index.js` | `pm2 start server.js` |
| **Next.js** | `package.json` 有 `next` dependency | `pm2 start next -- start` |
| **其他框架** | `package.json` 有 `scripts.start` | `pm2 start npm -- start` |
| **靜態網站** | 無 `package.json` 或無 start script | 直接 serve 靜態檔案 |

## 手動觸發部署

如果想手動重新部署：

```bash
# 透過 API
curl -X POST https://epi.isnowfriend.com/api/_admin/deploy/projects/{id}/deploy \
  -H "Authorization: Bearer $TOKEN"

# 透過 CLI
cloudpipe deploy {id}
```

## 查看部署記錄

```bash
# API
curl https://epi.isnowfriend.com/api/_admin/deploy/deployments \
  -H "Authorization: Bearer $TOKEN"

# CLI
cloudpipe logs {id}
```

每次部署都會記錄：
- 觸發方式（webhook / poll / manual）
- Commit hash 和訊息
- 執行時間
- 成功/失敗狀態
- 詳細 log
