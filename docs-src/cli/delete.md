# cloudpipe delete

刪除已部署的專案。

## 語法

```bash
cloudpipe delete <name> [options]
```

## 參數

| 參數 | 說明 |
|------|------|
| `name` | 專案名稱（必填） |

## 選項

| 選項 | 說明 |
|------|------|
| `--force, -f` | 強制刪除，不詢問確認 |
| `--keep-files` | 保留專案檔案，只移除 PM2 process |

## 範例

### 刪除專案

```bash
cloudpipe delete my-api
```

會出現確認提示：

```
Are you sure you want to delete "my-api"?
This will:
  - Stop the PM2 process
  - Remove project files
  - Delete project config

Type "my-api" to confirm:
```

### 強制刪除（不確認）

```bash
cloudpipe delete my-api --force
```

### 只停止服務，保留檔案

```bash
cloudpipe delete my-api --keep-files
```

## 刪除的內容

執行 `delete` 會移除：

1. **PM2 process** - 停止並從 PM2 移除
2. **專案檔案** - `projects/{name}/` 目錄
3. **專案設定** - 從 `projects.json` 移除
4. **Webhook** - 如果有設定 GitHub Webhook

## 恢復已刪除的專案

如果使用 `--keep-files`，可以重新部署：

```bash
cloudpipe deploy projects/my-api --name my-api
```

如果完全刪除了，需要重新從 GitHub 部署：

```bash
cloudpipe deploy https://github.com/user/repo --name my-api
```

## 批次刪除

```bash
# 列出所有專案
cloudpipe list --json | jq -r '.[].id'

# 刪除多個專案
for name in my-api test-app old-blog; do
  cloudpipe delete $name --force
done
```

## 相關指令

- [cloudpipe list](/cli/list) - 查看所有部署
- [cloudpipe deploy](/cli/deploy) - 部署專案
- [cloudpipe logs](/cli/logs) - 查看日誌
