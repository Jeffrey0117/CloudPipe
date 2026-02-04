# PM2 設定

CloudPipe 使用 PM2 來管理所有部署的 Node.js 應用程式。

## 什麼是 PM2？

[PM2](https://pm2.keymetrics.io/) 是 Node.js 的生產環境程序管理器，提供：

- 應用程式自動重啟
- 負載平衡（cluster mode）
- 日誌管理
- 監控與效能追蹤

## 預設行為

當你部署專案時，CloudPipe 會自動：

1. 使用專案 ID 作為 PM2 process 名稱
2. 設定自動重啟（crash 時）
3. 配置日誌輸出路徑
4. 注入 `PORT` 環境變數

## 查看 PM2 狀態

### 透過命令列

```bash
# 查看所有 process
pm2 list

# 查看特定專案
pm2 show my-app

# 查看即時日誌
pm2 logs my-app

# 查看監控面板
pm2 monit
```

### 透過 CloudPipe Dashboard

在管理頁面可以：

1. 查看 process 狀態（運行中 / 停止 / 錯誤）
2. 查看最近的 logs
3. 重啟或停止 process

## 自訂 PM2 設定

### ecosystem.config.js

在專案根目錄建立 `ecosystem.config.js`：

```javascript
module.exports = {
  apps: [{
    name: 'my-app',
    script: 'server.js',
    instances: 2,           // 啟動 2 個 instance
    exec_mode: 'cluster',   // cluster mode
    env: {
      NODE_ENV: 'production'
    },
    max_memory_restart: '500M',  // 記憶體超過 500MB 重啟
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
  }]
}
```

::: warning
如果專案有 `ecosystem.config.js`，CloudPipe 會使用它來啟動，而非自動偵測的設定。
:::

### 常用設定選項

| 選項 | 說明 | 範例 |
|------|------|------|
| `instances` | 啟動的 instance 數量 | `2` 或 `'max'` |
| `exec_mode` | 執行模式 | `'fork'` 或 `'cluster'` |
| `max_memory_restart` | 記憶體上限 | `'500M'` |
| `cron_restart` | 定時重啟 | `'0 3 * * *'` (每天 3 點) |
| `watch` | 檔案變更時自動重啟 | `true` 或 `['src']` |
| `ignore_watch` | 忽略的檔案 | `['node_modules', 'logs']` |

## Cluster Mode

對於 CPU 密集型應用，可以啟用 cluster mode：

```javascript
module.exports = {
  apps: [{
    name: 'my-api',
    script: 'server.js',
    instances: 'max',      // 使用所有 CPU 核心
    exec_mode: 'cluster',
  }]
}
```

::: tip
Cluster mode 需要你的應用程式是 stateless 的（不在記憶體中存放 session）。
:::

## 日誌管理

### 日誌路徑

PM2 日誌預設存放在：

```
~/.pm2/logs/
├── my-app-out.log    # stdout
├── my-app-error.log  # stderr
```

### 日誌輪替

安裝 pm2-logrotate 模組：

```bash
pm2 install pm2-logrotate

# 設定保留 7 天
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### 透過 API 查看日誌

```bash
curl https://epi.isnowfriend.com/api/_admin/deploy/logs/my-app \
  -H "Authorization: Bearer $TOKEN"
```

## 常用指令

```bash
# 重啟應用
pm2 restart my-app

# 停止應用
pm2 stop my-app

# 刪除應用
pm2 delete my-app

# 重載（zero-downtime，僅 cluster mode）
pm2 reload my-app

# 清除日誌
pm2 flush my-app

# 儲存目前的 process list
pm2 save

# 設定開機自動啟動
pm2 startup
```

## 問題排解

### Process 一直重啟

檢查 logs 找出錯誤原因：

```bash
pm2 logs my-app --lines 100
```

常見原因：
- Port 衝突
- 缺少環境變數
- 依賴未安裝

### 記憶體持續增長

可能是 memory leak，設定記憶體上限：

```javascript
{
  max_memory_restart: '500M'
}
```

### 查看詳細資訊

```bash
pm2 show my-app
```

會顯示：
- 重啟次數
- 運行時間
- 記憶體使用
- CPU 使用
