# cloudpipe list

列出所有已部署的專案。

## 語法

```bash
cloudpipe list [options]
```

## 選項

| 選項 | 說明 |
|------|------|
| `--json` | 輸出 JSON 格式 |
| `--status <status>` | 篩選狀態（running, stopped, error） |

## 範例

### 列出所有專案

```bash
cloudpipe list
```

輸出：

```
┌──────────────┬─────────┬──────┬────────────────────────────────┐
│ Name         │ Status  │ Port │ URL                            │
├──────────────┼─────────┼──────┼────────────────────────────────┤
│ my-api       │ running │ 4003 │ https://my-api.isnowfriend.com │
│ blog         │ running │ 4004 │ https://blog.isnowfriend.com   │
│ test-app     │ stopped │ 4005 │ https://test-app.isnowfriend.com│
└──────────────┴─────────┴──────┴────────────────────────────────┘
```

### JSON 格式

```bash
cloudpipe list --json
```

輸出：

```json
[
  {
    "id": "my-api",
    "name": "my-api",
    "status": "running",
    "port": 4003,
    "url": "https://my-api.isnowfriend.com",
    "deployMethod": "github",
    "lastDeployAt": "2024-01-15T10:30:00Z"
  },
  {
    "id": "blog",
    "name": "blog",
    "status": "running",
    "port": 4004,
    "url": "https://blog.isnowfriend.com",
    "deployMethod": "upload-app",
    "lastDeployAt": "2024-01-14T15:20:00Z"
  }
]
```

### 只顯示運行中的專案

```bash
cloudpipe list --status running
```

## 狀態說明

| 狀態 | 說明 |
|------|------|
| `running` | 正常運行中 |
| `stopped` | 已停止 |
| `error` | 錯誤（可能 crash 或啟動失敗） |
| `building` | 正在 build 中 |

## 配合其他指令使用

```bash
# 列出所有專案名稱
cloudpipe list --json | jq -r '.[].id'

# 停止所有專案
for name in $(cloudpipe list --json | jq -r '.[].id'); do
  cloudpipe stop $name
done
```

## 相關指令

- [cloudpipe deploy](/cli/deploy) - 部署專案
- [cloudpipe logs](/cli/logs) - 查看日誌
- [cloudpipe delete](/cli/delete) - 刪除部署
