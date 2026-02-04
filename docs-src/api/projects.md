# 專案 API

管理 CloudPipe 專案的 API。

## 列出所有專案

### GET /api/_admin/deploy/projects

取得所有專案列表。

**Request:**

```bash
curl https://epi.isnowfriend.com/api/_admin/deploy/projects \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{
  "projects": [
    {
      "id": "my-api",
      "name": "my-api",
      "deployMethod": "github",
      "repoUrl": "https://github.com/user/my-api",
      "branch": "main",
      "port": 4003,
      "pm2Name": "my-api",
      "lastDeployStatus": "success",
      "lastDeployAt": "2024-01-15T10:30:00Z",
      "runningCommit": "abc1234"
    }
  ]
}
```

## 取得單一專案

### GET /api/_admin/deploy/projects/:id

取得專案詳細資訊及部署記錄。

**Request:**

```bash
curl https://epi.isnowfriend.com/api/_admin/deploy/projects/my-api \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{
  "project": {
    "id": "my-api",
    "name": "my-api",
    "deployMethod": "github",
    "repoUrl": "https://github.com/user/my-api",
    "branch": "main",
    "port": 4003,
    "pm2Name": "my-api",
    "lastDeployStatus": "success",
    "lastDeployAt": "2024-01-15T10:30:00Z"
  },
  "deployments": [
    {
      "id": "deploy-001",
      "status": "success",
      "commit": "abc1234",
      "commitMessage": "feat: add new feature",
      "triggeredBy": "webhook",
      "startedAt": "2024-01-15T10:28:00Z",
      "completedAt": "2024-01-15T10:30:00Z",
      "duration": 120000
    }
  ]
}
```

## 建立專案

### POST /api/_admin/deploy/projects

建立新專案。

**Request:**

```bash
curl -X POST https://epi.isnowfriend.com/api/_admin/deploy/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-new-app",
    "name": "My New App",
    "deployMethod": "github",
    "repoUrl": "https://github.com/user/my-new-app",
    "branch": "main"
  }'
```

**Body 參數：**

| 參數 | 類型 | 必填 | 說明 |
|------|------|------|------|
| `id` | string | 是 | 專案 ID（也是子域名） |
| `name` | string | 否 | 顯示名稱 |
| `deployMethod` | string | 是 | `github`、`git-url`、`upload-app` |
| `repoUrl` | string | 視情況 | GitHub repo URL |
| `branch` | string | 否 | 分支名稱（預設 `main`） |
| `port` | number | 否 | 服務 port（自動分配） |
| `entryFile` | string | 否 | 入口檔案（自動偵測） |
| `buildCommand` | string | 否 | Build 指令（自動偵測） |

**Response:**

```json
{
  "success": true,
  "project": {
    "id": "my-new-app",
    "name": "My New App",
    "port": 4005
  }
}
```

## 更新專案

### PUT /api/_admin/deploy/projects/:id

更新專案設定。

**Request:**

```bash
curl -X PUT https://epi.isnowfriend.com/api/_admin/deploy/projects/my-api \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "branch": "develop",
    "buildCommand": "npm run build:prod"
  }'
```

**Response:**

```json
{
  "success": true,
  "project": {
    "id": "my-api",
    "branch": "develop",
    "buildCommand": "npm run build:prod"
  }
}
```

## 刪除專案

### DELETE /api/_admin/deploy/projects/:id

刪除專案及相關資源。

**Request:**

```bash
curl -X DELETE https://epi.isnowfriend.com/api/_admin/deploy/projects/my-api \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{
  "success": true,
  "message": "Project deleted"
}
```

## 列出服務與 Apps

### GET /api/_admin/services

取得上傳的 API 服務和 Apps。

**Request:**

```bash
curl https://epi.isnowfriend.com/api/_admin/services \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{
  "services": [
    {
      "name": "my-service",
      "url": "epi.isnowfriend.com/my-service"
    }
  ],
  "apps": [
    {
      "name": "blog",
      "url": "blog.isnowfriend.com"
    }
  ]
}
```

## 刪除 API 服務

### DELETE /api/_admin/service/:name

```bash
curl -X DELETE https://epi.isnowfriend.com/api/_admin/service/my-service \
  -H "Authorization: Bearer $TOKEN"
```

## 刪除 App

### DELETE /api/_admin/app/:name

```bash
curl -X DELETE https://epi.isnowfriend.com/api/_admin/app/blog \
  -H "Authorization: Bearer $TOKEN"
```

## 錯誤處理

| 狀態碼 | 說明 |
|--------|------|
| 400 | 請求參數錯誤 |
| 401 | 未認證 |
| 404 | 專案不存在 |
| 409 | 專案 ID 已存在 |
| 500 | 伺服器錯誤 |

**錯誤 Response 格式：**

```json
{
  "error": "Project not found"
}
```
