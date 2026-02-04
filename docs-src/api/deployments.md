# 部署 API

管理專案部署的 API。

## 觸發部署

### POST /api/_admin/deploy/projects/:id/deploy

手動觸發專案部署。

**Request:**

```bash
curl -X POST https://epi.isnowfriend.com/api/_admin/deploy/projects/my-api/deploy \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{
  "success": true,
  "message": "Deployment started",
  "deploymentId": "deploy-002"
}
```

## 查看部署狀態

### GET /api/_admin/deploy/projects/:id

在專案詳情中包含部署記錄。

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
    "lastDeployStatus": "success",
    "lastDeployAt": "2024-01-15T10:30:00Z",
    "runningCommit": "abc1234"
  },
  "deployments": [
    {
      "id": "deploy-002",
      "status": "success",
      "commit": "abc1234",
      "commitMessage": "fix: bug fix",
      "triggeredBy": "manual",
      "startedAt": "2024-01-15T10:28:00Z",
      "completedAt": "2024-01-15T10:30:00Z",
      "duration": 120000
    },
    {
      "id": "deploy-001",
      "status": "failed",
      "commit": "def5678",
      "triggeredBy": "webhook",
      "startedAt": "2024-01-14T15:00:00Z",
      "completedAt": "2024-01-14T15:02:00Z",
      "error": "Build failed: npm ERR! ..."
    }
  ]
}
```

## 部署狀態說明

| 狀態 | 說明 |
|------|------|
| `pending` | 排隊中 |
| `running` | 部署進行中 |
| `success` | 部署成功 |
| `failed` | 部署失敗 |

## 查看 PM2 日誌

### GET /api/_admin/deploy/logs/:pm2Name

取得應用程式的執行日誌。

**Request:**

```bash
curl https://epi.isnowfriend.com/api/_admin/deploy/logs/my-api \
  -H "Authorization: Bearer $TOKEN"
```

**Query 參數：**

| 參數 | 說明 | 預設值 |
|------|------|--------|
| `lines` | 回傳行數 | 100 |
| `type` | `out`、`error` 或 `all` | `all` |

**Response:**

```json
{
  "logs": "2024-01-15 10:30:15 [INFO] Server started...\n2024-01-15 10:30:16 [INFO] ..."
}
```

## 上傳部署

### POST /api/_admin/upload/service

上傳 API 服務（.js 檔案）。

**Request:**

```bash
curl -X POST https://epi.isnowfriend.com/api/_admin/upload/service \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@my-service.js" \
  -F "name=my-service"
```

**Response:**

```json
{
  "success": true,
  "url": "epi.isnowfriend.com/my-service"
}
```

### POST /api/_admin/upload/app

上傳專案（.zip 檔案）。

**Request:**

```bash
curl -X POST https://epi.isnowfriend.com/api/_admin/upload/app \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@my-app.zip" \
  -F "name=my-app"
```

**Response:**

```json
{
  "success": true,
  "url": "my-app.isnowfriend.com"
}
```

## Webhook 設定

### POST /api/_admin/deploy/projects/:id/webhook

為專案設定 GitHub Webhook。

**Request:**

```bash
curl -X POST https://epi.isnowfriend.com/api/_admin/deploy/projects/my-api/webhook \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "webhookUrl": "https://epi.isnowfriend.com/webhook/my-api"
  }'
```

**Response:**

```json
{
  "success": true,
  "webhookId": "12345"
}
```

### DELETE /api/_admin/deploy/projects/:id/webhook

移除 GitHub Webhook。

**Request:**

```bash
curl -X DELETE https://epi.isnowfriend.com/api/_admin/deploy/projects/my-api/webhook \
  -H "Authorization: Bearer $TOKEN"
```

## Webhook 接收端點

### POST /webhook/:projectId

GitHub push 事件的接收端點（不需要認證）。

由 GitHub 自動呼叫，會觸發對應專案的部署。

**支援的事件：**

- `push` - 觸發部署
- `ping` - 回傳 200 OK

## 系統資訊

### GET /api/_admin/system

取得系統資訊。

**Request:**

```bash
curl https://epi.isnowfriend.com/api/_admin/system \
  -H "Authorization: Bearer $TOKEN"
```

**Response:**

```json
{
  "uptime": 86400,
  "disk": {
    "used": "15.2 GB",
    "free": "84.8 GB",
    "total": "100 GB"
  },
  "memory": {
    "used": "2.1 GB",
    "total": "8 GB"
  }
}
```
