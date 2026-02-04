# Webhook 設定

設定 GitHub Webhook 可以在 push 時自動觸發部署。

## 運作原理

```
GitHub push → Webhook 通知 → CloudPipe 接收 → 自動部署
```

## 設定方式

### 方式一：透過 Dashboard（推薦）

部署成功後，Dashboard 會顯示「設定 GitHub Webhook」按鈕：

1. 點擊按鈕
2. CloudPipe 會自動呼叫 GitHub API 建立 Webhook
3. 完成！之後 push 就會自動部署

::: tip
需要 GitHub repo 的 admin 權限才能設定 Webhook。
:::

### 方式二：手動設定

1. 進入 GitHub repo → Settings → Webhooks → Add webhook

2. 填入以下資訊：

| 欄位 | 值 |
|------|-----|
| Payload URL | `https://epi.isnowfriend.com/webhook/{project-id}` |
| Content type | `application/json` |
| Secret | (留空或自訂) |
| Events | Just the push event |

3. 點擊「Add webhook」

## Webhook URL 格式

```
https://epi.isnowfriend.com/webhook/{project-id}
```

例如專案 ID 是 `my-app`：

```
https://epi.isnowfriend.com/webhook/my-app
```

## 分支過濾

預設只有 push 到設定的分支（通常是 `main`）才會觸發部署。

如果要部署其他分支：

```bash
curl -X PUT https://epi.isnowfriend.com/api/_admin/deploy/projects/my-app \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"branch": "develop"}'
```

## Webhook 事件處理

CloudPipe 支援以下 GitHub 事件：

| 事件 | 處理方式 |
|------|----------|
| `push` | 觸發部署（如果是設定的分支） |
| `ping` | 回傳 200 OK（測試連線） |

### Push 事件流程

1. 收到 push 事件
2. 檢查分支是否符合
3. 取得最新 commit SHA
4. 執行 `git pull`
5. 執行 `npm install`（如需要）
6. 執行 `npm run build`（如有）
7. 重啟 PM2 process
8. 記錄部署結果

## 查看 Webhook 記錄

### GitHub 側

GitHub repo → Settings → Webhooks → 點擊 webhook → Recent Deliveries

可以看到：
- 發送時間
- HTTP 狀態碼
- Request/Response 內容

### CloudPipe 側

在 Dashboard 的專案詳情中可以看到部署記錄：

- 觸發來源（webhook / manual）
- Commit SHA 和 message
- 部署狀態（success / failed）
- 耗時

## 手動觸發部署

即使設定了 Webhook，你仍可手動觸發：

### 透過 Dashboard

點擊專案卡片 → 「重新部署」

### 透過 API

```bash
curl -X POST https://epi.isnowfriend.com/api/_admin/deploy/projects/my-app/deploy \
  -H "Authorization: Bearer $TOKEN"
```

## 問題排解

### Webhook 沒有觸發

1. **檢查 GitHub Webhook 狀態**
   - GitHub repo → Settings → Webhooks
   - 查看 Recent Deliveries 是否有紅色 X

2. **檢查 URL 是否正確**
   - 確認 project-id 正確
   - 確認 URL 可以從外網訪問

3. **檢查分支設定**
   - 確認 push 的分支與專案設定一致

### Webhook 觸發但部署失敗

查看部署日誌：

```bash
curl https://epi.isnowfriend.com/api/_admin/deploy/projects/my-app \
  -H "Authorization: Bearer $TOKEN"
```

常見原因：
- Build script 錯誤
- 依賴安裝失敗
- Port 衝突

### 移除 Webhook

1. GitHub repo → Settings → Webhooks
2. 找到對應的 webhook
3. 點擊「Delete」

或透過 API：

```bash
curl -X DELETE https://epi.isnowfriend.com/api/_admin/deploy/projects/my-app/webhook \
  -H "Authorization: Bearer $TOKEN"
```

## 安全性

### Webhook Secret

目前 CloudPipe 不驗證 Webhook secret，建議：

1. 使用 Cloudflare Tunnel（只有 CloudPipe 能接收）
2. 或在 config 中設定允許的 IP 來源

### 避免意外部署

- 只監聽特定分支
- 使用 PR workflow，只 merge 到 main 時才部署
- 在 CI 中先跑測試，通過才 merge
