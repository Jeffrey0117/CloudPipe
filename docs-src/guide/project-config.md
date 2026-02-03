# 專案設定

每個專案可以自訂多項設定，控制部署行為。

## 設定欄位

| 欄位 | 說明 | 預設值 |
|------|------|--------|
| `id` | 專案 ID，也是 subdomain | (必填) |
| `name` | 顯示名稱 | 同 id |
| `deployMethod` | 部署方式：`github`、`git-url`、`upload-app` | `github` |
| `repoUrl` | GitHub repo URL | - |
| `branch` | 部署的分支 | `main` |
| `port` | 服務監聽的 port | 自動分配 (4001~) |
| `entryFile` | 入口檔案 | 自動偵測 |
| `buildCommand` | Build 指令 | 自動偵測 |
| `pm2Name` | PM2 process 名稱 | 同 id |
| `healthEndpoint` | Health check endpoint | `/` 或 `/health` |

## 自動偵測

CloudPipe 會自動偵測許多設定，通常不需要手動指定。

### Package Manager

依據 lock file 偵測：

| 檔案 | Package Manager |
|------|-----------------|
| `pnpm-lock.yaml` | pnpm |
| `yarn.lock` | yarn |
| `package-lock.json` | npm |

### Build Command

如果 `package.json` 有 `scripts.build`，會自動執行：

```json
{
  "scripts": {
    "build": "next build"  // ← 會自動執行
  }
}
```

### Entry File

偵測順序：

1. `package.json` 的 `main` 欄位
2. 常見檔案：`server.js` → `app.js` → `index.js` → `main.js`
3. 框架偵測：Next.js 用 `next start`

## 修改設定

### 透過 API

```bash
curl -X PUT https://epi.isnowfriend.com/api/_admin/deploy/projects/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "buildCommand": "pnpm run build",
    "port": 4005,
    "healthEndpoint": "/api/health"
  }'
```

### 直接編輯 projects.json

```json
{
  "projects": [
    {
      "id": "my-app",
      "name": "My App",
      "deployMethod": "github",
      "repoUrl": "https://github.com/you/my-app",
      "branch": "main",
      "port": 4003,
      "entryFile": "server.js",
      "buildCommand": "npm run build",
      "pm2Name": "my-app"
    }
  ]
}
```

## 環境變數

### PORT

CloudPipe 會自動設定 `PORT` 環境變數給你的 app：

```javascript
// 你的 app 應該這樣讀取 port
const port = process.env.PORT || 3000
```

### 自訂環境變數

在專案目錄建立 `.env` 檔案：

```bash
DATABASE_URL=postgres://...
API_KEY=xxx
```

::: warning
`.env` 不會被 git 追蹤，需要手動在伺服器建立。
:::

## 範例：Next.js 專案

```json
{
  "id": "my-nextjs",
  "deployMethod": "github",
  "repoUrl": "https://github.com/you/my-nextjs",
  "branch": "main",
  "port": 4003
  // entryFile 和 buildCommand 會自動偵測
}
```

自動偵測結果：
- `buildCommand`: `pnpm run build` (如果用 pnpm)
- 啟動方式: `next start`
- Health check: `/`

## 範例：Express 專案

```json
{
  "id": "my-api",
  "deployMethod": "github",
  "repoUrl": "https://github.com/you/my-api",
  "branch": "main",
  "port": 4004,
  "entryFile": "server.js",
  "healthEndpoint": "/health"
}
```
