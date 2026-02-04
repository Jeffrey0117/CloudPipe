# cloudpipe deploy

部署專案到 CloudPipe。

## 語法

```bash
cloudpipe deploy [path] [options]
```

## 參數

| 參數 | 說明 | 預設值 |
|------|------|--------|
| `path` | 專案路徑或 GitHub URL | 當前目錄 |

## 選項

| 選項 | 說明 |
|------|------|
| `--name, -n <name>` | 指定專案名稱（子域名） |
| `--port, -p <port>` | 指定 port |
| `--watch, -w` | 啟用 watch mode（開發用） |
| `--branch, -b <branch>` | 指定分支（GitHub 部署） |
| `--build <command>` | 自訂 build 指令 |
| `--entry <file>` | 指定入口檔案 |

## 範例

### 部署當前目錄

```bash
cd my-project
cloudpipe deploy
```

### 部署 GitHub 專案

```bash
cloudpipe deploy https://github.com/user/repo
```

### 指定名稱和 port

```bash
cloudpipe deploy --name my-api --port 4005
```

### 開發模式（watch）

```bash
cloudpipe deploy --watch
```

檔案變更時會自動重新部署。

### 部署特定分支

```bash
cloudpipe deploy https://github.com/user/repo --branch develop
```

## 自動偵測

CloudPipe 會自動偵測：

- **框架**：Next.js、Vite、Create React App、Express 等
- **Package Manager**：npm、yarn、pnpm
- **Build Command**：從 `package.json` 讀取
- **Entry File**：`main` 欄位或常見檔案名

### 偵測結果範例

```
Detected:
  Framework:  Next.js
  Package:    pnpm
  Build:      pnpm run build
  Start:      next start
```

## 部署流程

1. 分析專案結構
2. 建立或更新專案設定
3. 拉取程式碼（如果是 GitHub）
4. 安裝依賴 (`npm install`)
5. 執行 build（如果有）
6. 啟動 PM2 process
7. 設定 Cloudflare Tunnel 路由
8. 回報部署結果

## 輸出

成功部署會顯示：

```
✓ Deployed successfully!

  URL:     https://my-api.isnowfriend.com
  Status:  Running
  Port:    4003

  View logs: cloudpipe logs my-api
```

## 錯誤處理

### Build 失敗

```
✗ Build failed

Error: Command failed: npm run build
...

Fix the build error and try again.
```

### Port 衝突

```
✗ Port 4003 is already in use

Try: cloudpipe deploy --port 4004
```

## 相關指令

- [cloudpipe list](/cli/list) - 查看所有部署
- [cloudpipe logs](/cli/logs) - 查看日誌
- [cloudpipe delete](/cli/delete) - 刪除部署
