# 上傳部署

除了 GitHub 部署，你也可以直接上傳檔案來部署。

## 兩種上傳類型

| 類型 | 上傳格式 | URL 格式 | 用途 |
|------|----------|----------|------|
| **API 服務** | `.js` 檔案 | `epi.isnowfriend.com/xxx` | 輕量 API、Webhook |
| **專案部署** | `.zip` 檔案 | `xxx.isnowfriend.com` | 完整網站、應用 |

## API 服務上傳

### 檔案格式

上傳的 `.js` 檔案必須導出 `match` 和 `handle` 函式：

```javascript
// my-api.js
module.exports = {
  // 判斷是否處理這個請求
  match(req) {
    return req.url.startsWith('/my-api');
  },

  // 處理請求
  handle(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ hello: 'world' }));
  }
};
```

### 透過 Dashboard 上傳

1. 打開 Dashboard (`/_admin`)
2. 點擊「API 服務」卡片
3. 輸入 API 名稱（例如 `my-api`）
4. 選擇 `.js` 檔案上傳
5. 上傳成功後即可訪問 `epi.isnowfriend.com/my-api`

### 透過 API 上傳

```bash
curl -X POST https://epi.isnowfriend.com/api/_admin/upload/service \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@my-api.js" \
  -F "name=my-api"
```

### API 服務範例

#### 回傳 JSON 資料

```javascript
module.exports = {
  match: (req) => req.url.startsWith('/data'),
  handle: (req, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify({
      status: 'ok',
      time: new Date().toISOString()
    }));
  }
};
```

#### 處理 POST 請求

```javascript
module.exports = {
  match: (req) => req.url.startsWith('/webhook'),
  handle: (req, res) => {
    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const data = JSON.parse(body);
        console.log('Received:', data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received: true }));
      });
    } else {
      res.writeHead(405);
      res.end('Method not allowed');
    }
  }
};
```

## 專案部署（ZIP）

### ZIP 檔案結構

```
my-project.zip
├── index.html        # 靜態網站入口
├── css/
├── js/
└── images/
```

或 Node.js 專案：

```
my-app.zip
├── package.json
├── server.js
├── src/
└── public/
```

### 透過 Dashboard 上傳

1. 打開 Dashboard (`/_admin`)
2. 點擊「專案部署」卡片
3. 輸入子域名（例如 `blog`）
4. 選擇 `.zip` 檔案上傳
5. 上傳成功後即可訪問 `blog.isnowfriend.com`

### 透過 API 上傳

```bash
curl -X POST https://epi.isnowfriend.com/api/_admin/upload/app \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@my-project.zip" \
  -F "name=blog"
```

## 靜態網站 vs Node.js 應用

CloudPipe 會自動偵測：

| 偵測條件 | 處理方式 |
|----------|----------|
| 有 `package.json` | 當作 Node.js 應用，執行 `npm install` 並啟動 |
| 只有 HTML/CSS/JS | 當作靜態網站，直接提供檔案 |

### 靜態網站

直接放置 `index.html` 即可：

```html
<!-- index.html -->
<!DOCTYPE html>
<html>
<head><title>My Site</title></head>
<body>
  <h1>Hello World</h1>
</body>
</html>
```

### Node.js 應用

需要 `package.json` 和入口檔案：

```javascript
// server.js
const http = require('http');
const port = process.env.PORT || 3000;

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end('<h1>Hello from Node.js</h1>');
}).listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

## 更新已部署的專案

### 覆蓋上傳

使用相同的名稱重新上傳，會自動覆蓋舊版本：

```bash
# 更新 API 服務
curl -X POST https://epi.isnowfriend.com/api/_admin/upload/service \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@my-api-v2.js" \
  -F "name=my-api"

# 更新專案
curl -X POST https://epi.isnowfriend.com/api/_admin/upload/app \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@my-project-v2.zip" \
  -F "name=blog"
```

## 刪除已部署的專案

### 透過 Dashboard

在管理頁面 (`/_admin/settings`) 點擊「刪除」按鈕。

### 透過 API

```bash
# 刪除 API 服務
curl -X DELETE https://epi.isnowfriend.com/api/_admin/service/my-api \
  -H "Authorization: Bearer $TOKEN"

# 刪除專案
curl -X DELETE https://epi.isnowfriend.com/api/_admin/app/blog \
  -H "Authorization: Bearer $TOKEN"
```

## 限制

- 單檔上傳大小限制：50MB
- API 服務必須是單一 `.js` 檔案
- ZIP 解壓後大小限制：500MB
