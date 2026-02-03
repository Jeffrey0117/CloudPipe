# CLI 指令總覽

CloudPipe CLI 讓你從命令列管理部署。

## 安裝

```bash
# 全域安裝
npm install -g cloudpipe

# 或使用 npx
npx cloudpipe <command>
```

## 指令列表

| 指令 | 說明 |
|------|------|
| `cloudpipe deploy <url>` | 部署 GitHub repo |
| `cloudpipe list` | 列出所有專案 |
| `cloudpipe logs <id>` | 查看部署 logs |
| `cloudpipe delete <id>` | 刪除專案 |
| `cloudpipe status` | 查看服務狀態 |

## 常用範例

```bash
# 部署新專案
cloudpipe deploy https://github.com/you/my-app

# 查看所有專案
cloudpipe list

# 查看特定專案的 logs
cloudpipe logs my-app

# 重新部署
cloudpipe deploy my-app

# 刪除專案
cloudpipe delete my-app
```

## 設定

CLI 會讀取 `~/.cloudpipe/config.json`：

```json
{
  "apiUrl": "https://epi.isnowfriend.com",
  "token": "your-jwt-token"
}
```

或使用環境變數：

```bash
export CLOUDPIPE_API_URL=https://epi.isnowfriend.com
export CLOUDPIPE_TOKEN=your-jwt-token
```
