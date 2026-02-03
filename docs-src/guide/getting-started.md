# 快速開始

CloudPipe 是一個零設定的部署工具，讓你把 GitHub 專案一鍵部署到自己的伺服器。

## 系統需求

- Windows 10/11 或 Linux
- Node.js 18+
- PM2 (`npm install -g pm2`)
- Git
- [Cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/) (用於 tunnel)

## 啟動服務

```bash
# 進入 CloudPipe 目錄
cd cloudpipe

# 啟動（Windows）
start.bat

# 啟動（Linux/Mac）
pm2 start ecosystem.config.js
cloudflared tunnel run cloudpipe
```

啟動後你會看到：

```
CloudPipe - Local Deploy Gateway
================================

[1/3] Stopping old instance...
[2/3] Starting server with PM2...
[3/3] Starting tunnel...
```

## 部署第一個專案

### 方式一：透過 Dashboard

1. 打開 `https://epi.isnowfriend.com/admin.html`
2. 輸入密碼登入
3. 點擊「新增專案」
4. 填入 GitHub repo URL
5. 點擊「部署」

### 方式二：透過 CLI

```bash
# 部署 GitHub 專案
cloudpipe deploy https://github.com/your/repo

# 查看所有專案
cloudpipe list

# 查看部署 logs
cloudpipe logs <project-id>
```

### 方式三：透過 API

```bash
# 登入取得 token
TOKEN=$(curl -s -X POST https://epi.isnowfriend.com/api/_admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your-password"}' | jq -r '.token')

# 建立專案
curl -X POST https://epi.isnowfriend.com/api/_admin/deploy/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-app",
    "repoUrl": "https://github.com/your/repo",
    "deployMethod": "github"
  }'
```

## 下一步

- [GitHub 部署詳解](/guide/deploy-github) - Webhook 設定、自動部署
- [專案設定](/guide/project-config) - port、buildCommand、entryFile 等
- [CLI 指令](/cli/) - 完整 CLI 使用說明
