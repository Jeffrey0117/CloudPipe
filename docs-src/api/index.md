# API Reference

CloudPipe 提供 REST API 來管理專案和部署。

## Base URL

```
https://epi.isnowfriend.com/api/_admin
```

## 認證

大部分 API 需要 JWT token。先透過 login 取得：

```bash
curl -X POST https://epi.isnowfriend.com/api/_admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}'
```

回應：
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

之後的請求加上 header：
```
Authorization: Bearer <token>
```

## API 列表

### 認證

| Method | Endpoint | 說明 |
|--------|----------|------|
| POST | `/login` | 登入取得 token |
| GET | `/verify` | 驗證 token |

### 專案

| Method | Endpoint | 說明 |
|--------|----------|------|
| GET | `/deploy/projects` | 列出所有專案 |
| POST | `/deploy/projects` | 新增專案 |
| GET | `/deploy/projects/:id` | 專案詳情 |
| PUT | `/deploy/projects/:id` | 更新專案 |
| DELETE | `/deploy/projects/:id` | 刪除專案 |

### 部署

| Method | Endpoint | 說明 |
|--------|----------|------|
| POST | `/deploy/projects/:id/deploy` | 觸發部署 |
| GET | `/deploy/deployments` | 所有部署記錄 |
| GET | `/deploy/deployments/:id` | 部署詳情 |
| GET | `/deploy/logs/:pm2Name` | PM2 logs |

### Webhook

| Method | Endpoint | 說明 |
|--------|----------|------|
| POST | `/deploy/projects/:id/webhook` | 設定 GitHub Webhook |
| DELETE | `/deploy/projects/:id/webhook` | 刪除 Webhook |
| GET | `/deploy/projects/:id/webhooks` | 列出 Webhooks |

## 回應格式

成功：
```json
{
  "success": true,
  "data": { ... }
}
```

錯誤：
```json
{
  "error": "錯誤訊息"
}
```

## 範例

### 建立專案

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

### 觸發部署

```bash
curl -X POST https://epi.isnowfriend.com/api/_admin/deploy/projects/my-app/deploy \
  -H "Authorization: Bearer $TOKEN"
```

### 查看部署記錄

```bash
curl https://epi.isnowfriend.com/api/_admin/deploy/projects/my-app \
  -H "Authorization: Bearer $TOKEN"
```
