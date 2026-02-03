# 安裝設定

## 下載 CloudPipe

```bash
git clone https://github.com/Jeffrey0117/CloudPipe.git
cd CloudPipe
npm install
```

## 設定檔

### config.json

主要設定檔，位於專案根目錄：

```json
{
  "domain": "isnowfriend.com",
  "port": 8787,
  "subdomain": "epi",
  "adminPassword": "your-secure-password",
  "jwtSecret": "your-jwt-secret"
}
```

| 欄位 | 說明 |
|------|------|
| `domain` | 你的域名 |
| `port` | CloudPipe 監聽的 port |
| `subdomain` | API 的 subdomain（如 `epi.isnowfriend.com`） |
| `adminPassword` | Dashboard 登入密碼 |
| `jwtSecret` | JWT 簽名密鑰（隨機字串） |

### ecosystem.config.js

PM2 設定檔：

```javascript
module.exports = {
  apps: [{
    name: 'cloudpipe',
    script: './index.js',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production'
    }
  }]
}
```

### cloudflared.yml

Cloudflare Tunnel 設定：

```yaml
tunnel: your-tunnel-id
credentials-file: ~/.cloudflared/your-tunnel-id.json

ingress:
  - hostname: epi.isnowfriend.com
    service: http://localhost:8787
  - hostname: "*.isnowfriend.com"
    service: http://localhost:8787
  - service: http_status:404
```

## Cloudflare Tunnel 設定

1. 安裝 cloudflared：
   ```bash
   # Windows
   winget install Cloudflare.cloudflared

   # Mac
   brew install cloudflared

   # Linux
   curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
   chmod +x cloudflared
   ```

2. 登入並建立 tunnel：
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create cloudpipe
   ```

3. 設定 DNS：
   ```bash
   cloudflared tunnel route dns cloudpipe epi.isnowfriend.com
   cloudflared tunnel route dns cloudpipe "*.isnowfriend.com"
   ```

4. 建立 `cloudflared.yml`（參考上方範例）

## 目錄結構

```
cloudpipe/
├── index.js              # 入口點
├── config.json           # 主設定
├── ecosystem.config.js   # PM2 設定
├── cloudflared.yml       # Tunnel 設定
├── start.bat             # Windows 啟動腳本
├── src/
│   └── core/
│       ├── server.js     # 主伺服器
│       ├── router.js     # 路由
│       ├── deploy.js     # 部署引擎
│       └── admin.js      # Admin API
├── public/               # 靜態檔案
├── services/             # API 服務
├── projects/             # 部署的專案
└── data/
    └── deploy/
        ├── projects.json     # 專案設定
        └── deployments.json  # 部署記錄
```
