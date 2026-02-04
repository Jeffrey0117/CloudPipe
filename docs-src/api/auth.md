# 認證

CloudPipe API 使用 Bearer Token 認證。

## 取得 Token

### POST /api/_admin/login

使用密碼登入並取得 token。

**Request:**

```bash
curl -X POST https://epi.isnowfriend.com/api/_admin/login \
  -H "Content-Type: application/json" \
  -d '{"password": "your-password"}'
```

**Response:**

```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**錯誤：**

```json
{
  "success": false,
  "error": "Invalid password"
}
```

## 使用 Token

在所有需要認證的 API 請求中，加入 `Authorization` header：

```bash
curl https://epi.isnowfriend.com/api/_admin/services \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 驗證 Token

### GET /api/_admin/verify

檢查 token 是否有效。

**Request:**

```bash
curl https://epi.isnowfriend.com/api/_admin/verify \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (成功):**

```json
{
  "valid": true
}
```

**Response (失敗):**

```json
{
  "valid": false,
  "error": "Token expired"
}
```

## Token 有效期

- 預設有效期：7 天
- 過期後需重新登入取得新 token

## 安全建議

1. **不要在前端程式碼中硬編碼 token**
2. **使用 HTTPS**（Cloudflare Tunnel 預設啟用）
3. **定期更換密碼**
4. **在伺服器環境變數中儲存 token**

### 環境變數範例

```bash
# .env
CLOUDPIPE_TOKEN=your-token-here
```

```javascript
// 使用環境變數
const token = process.env.CLOUDPIPE_TOKEN;

fetch('https://epi.isnowfriend.com/api/_admin/services', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## 錯誤碼

| 狀態碼 | 說明 |
|--------|------|
| 401 | 未提供 token 或 token 無效 |
| 403 | token 已過期 |

## 相關 API

- [專案 API](/api/projects) - 管理專案
- [部署 API](/api/deployments) - 管理部署
