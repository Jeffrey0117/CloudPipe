# cloudpipe logs

查看專案的執行日誌。

## 語法

```bash
cloudpipe logs <name> [options]
```

## 參數

| 參數 | 說明 |
|------|------|
| `name` | 專案名稱（必填） |

## 選項

| 選項 | 說明 |
|------|------|
| `--lines, -n <number>` | 顯示最後 N 行（預設 100） |
| `--follow, -f` | 持續追蹤新日誌（類似 `tail -f`） |
| `--error` | 只顯示錯誤日誌 |
| `--out` | 只顯示標準輸出 |

## 範例

### 查看最近日誌

```bash
cloudpipe logs my-api
```

輸出：

```
2024-01-15 10:30:15 [INFO] Server started on port 4003
2024-01-15 10:30:16 [INFO] Connected to database
2024-01-15 10:31:02 [INFO] GET /api/users 200 15ms
2024-01-15 10:31:05 [INFO] POST /api/login 200 45ms
```

### 追蹤即時日誌

```bash
cloudpipe logs my-api --follow
```

按 `Ctrl+C` 停止追蹤。

### 顯示更多行數

```bash
cloudpipe logs my-api --lines 500
```

### 只看錯誤

```bash
cloudpipe logs my-api --error
```

輸出：

```
2024-01-15 10:32:15 [ERROR] Database connection failed
2024-01-15 10:32:16 [ERROR] Retrying in 5 seconds...
```

## 日誌位置

PM2 日誌檔案存放在：

```
~/.pm2/logs/
├── my-api-out.log    # stdout
├── my-api-error.log  # stderr
```

你也可以直接用 PM2 指令查看：

```bash
pm2 logs my-api
```

## 部署日誌

查看部署過程的日誌（build、install 等）：

```bash
cloudpipe logs my-api --deploy
```

或透過 API：

```bash
curl https://epi.isnowfriend.com/api/_admin/deploy/projects/my-api \
  -H "Authorization: Bearer $TOKEN" | jq '.deployments[0]'
```

## 日誌輪替

建議設定 PM2 日誌輪替，避免日誌檔案過大：

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## 相關指令

- [cloudpipe list](/cli/list) - 查看所有部署
- [cloudpipe deploy](/cli/deploy) - 部署專案
