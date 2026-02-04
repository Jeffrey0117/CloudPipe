# Cloudflare Tunnel

CloudPipe 使用 Cloudflare Tunnel 將本地服務暴露到公網，無需公網 IP 或設定防火牆。

## 什麼是 Cloudflare Tunnel？

Cloudflare Tunnel（前身為 Argo Tunnel）是一個安全的方式，將你的本地服務連接到 Cloudflare 的邊緣網路：

```
使用者 → Cloudflare CDN → Tunnel → 你的伺服器
```

優點：
- 不需要公網 IP
- 不需要開放防火牆 port
- 自動 HTTPS
- DDoS 保護
- 全球 CDN 加速

## 安裝 cloudflared

### Windows

```powershell
# 使用 winget
winget install Cloudflare.cloudflared

# 或下載安裝檔
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

### macOS

```bash
brew install cloudflared
```

### Linux

```bash
# Debian/Ubuntu
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-archive-keyring.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-archive-keyring.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared
```

## 建立 Tunnel

### 1. 登入 Cloudflare

```bash
cloudflared tunnel login
```

會打開瀏覽器，選擇你的 domain 並授權。

### 2. 建立 Tunnel

```bash
cloudflared tunnel create cloudpipe
```

會生成一個 Tunnel ID 和 credentials 檔案。

### 3. 設定 DNS

```bash
# 主域名
cloudflared tunnel route dns cloudpipe epi.isnowfriend.com

# Wildcard（用於子域名）
cloudflared tunnel route dns cloudpipe "*.isnowfriend.com"
```

::: warning
Wildcard DNS 需要在 Cloudflare Dashboard 手動設定，或使用 Cloudflare API。
:::

### 4. 建立設定檔

建立 `~/.cloudflared/config.yml`：

```yaml
tunnel: <your-tunnel-id>
credentials-file: /path/to/credentials.json

ingress:
  # 主服務
  - hostname: epi.isnowfriend.com
    service: http://localhost:8787

  # Wildcard 子域名（給部署的專案用）
  - hostname: "*.isnowfriend.com"
    service: http://localhost:8787

  # 預設處理
  - service: http_status:404
```

### 5. 啟動 Tunnel

```bash
cloudflared tunnel run cloudpipe
```

## 整合 CloudPipe

### start.bat 自動啟動

CloudPipe 的 `start.bat` 已經包含 tunnel 啟動：

```batch
@echo off
echo CloudPipe - Local Deploy Gateway
echo ================================
echo.

echo [1/3] Stopping old instance...
pm2 delete cloudpipe 2>nul

echo [2/3] Starting server with PM2...
pm2 start index.js --name cloudpipe

echo [3/3] Starting tunnel...
start /B cloudflared tunnel run cloudpipe

echo.
echo Done! Server running at https://epi.isnowfriend.com
```

### 作為服務運行

#### Windows

```powershell
cloudflared service install
cloudflared service start
```

#### Linux (systemd)

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

## Tunnel 架構

```
                    Cloudflare Network
                    ┌─────────────────────────────┐
                    │                             │
User ──────────────►│  epi.isnowfriend.com       │
                    │         │                   │
                    │         ▼                   │
                    │  *.isnowfriend.com         │
                    │         │                   │
                    └─────────┼───────────────────┘
                              │
                              │ Tunnel (encrypted)
                              │
                    ┌─────────▼───────────────────┐
                    │    Your Server              │
                    │                             │
                    │  cloudflared ◄──────────────┤
                    │       │                     │
                    │       ▼                     │
                    │  CloudPipe (localhost:8787) │
                    │       │                     │
                    │       ├──► services/        │
                    │       └──► apps/            │
                    └─────────────────────────────┘
```

## 多 Tunnel 設定

如果你有多個服務：

```yaml
# config.yml
tunnel: cloudpipe
credentials-file: /path/to/credentials.json

ingress:
  # CloudPipe 主服務
  - hostname: epi.isnowfriend.com
    service: http://localhost:8787

  # 子域名專案
  - hostname: "*.isnowfriend.com"
    service: http://localhost:8787

  # 其他服務
  - hostname: api.example.com
    service: http://localhost:3000

  - service: http_status:404
```

## 問題排解

### Tunnel 無法連線

1. 檢查 cloudflared 是否運行：
```bash
cloudflared tunnel info cloudpipe
```

2. 檢查 credentials 檔案是否存在

3. 查看日誌：
```bash
cloudflared tunnel run cloudpipe --loglevel debug
```

### DNS 解析失敗

確認 DNS 記錄已設定：

```bash
# 檢查 DNS
nslookup epi.isnowfriend.com
```

應該指向 Cloudflare IP。

### 502 Bad Gateway

通常是本地服務沒有運行：

```bash
# 確認 CloudPipe 正在運行
pm2 status

# 確認 port 正確
curl http://localhost:8787
```

## 監控

### Cloudflare Dashboard

登入 Cloudflare Dashboard → Zero Trust → Access → Tunnels

可以看到：
- Tunnel 狀態
- 流量統計
- 連線數

### 本地日誌

```bash
# 查看 tunnel 日誌
cloudflared tunnel run cloudpipe --loglevel info
```

## 安全建議

1. **使用 Access Policy**：限制誰可以訪問管理介面
2. **啟用 WARP**：為內部用戶提供更快的連線
3. **設定 IP 白名單**：在 Cloudflare 防火牆規則中限制來源 IP
