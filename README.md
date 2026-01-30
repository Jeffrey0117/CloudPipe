<p align="center">
  <img src="public/LOGO.png" alt="CloudPipe" width="180" />
</p>

<h1 align="center">CloudPipe</h1>

<p align="center">
  <strong>Self-Hosted Micro Deploy Platform + Zero-Config CLI</strong><br/>
  Your own mini Vercel / Railway &mdash; two ways to deploy.
</p>

<p align="center">
  <code>Node.js</code>&nbsp;&nbsp;|&nbsp;&nbsp;<code>Cloudflare Tunnel</code>&nbsp;&nbsp;|&nbsp;&nbsp;<code>Zero Config</code>
</p>

<p align="center">
  <strong>English</strong> | <a href="README.zh-TW.md">繁體中文</a>
</p>

---

## Two Products in One

| Product | Use Case | Deployment |
|---------|----------|------------|
| **🌐 CloudPipe Platform** | Host multiple services on one server | Upload files via web dashboard |
| **⚡ CloudPipe CLI** | Deploy full-stack apps locally | Command-line tool (like Vercel CLI) |

### Platform: Upload & Host
```
Upload a .js file  -->  Get a public API instantly
Upload a .zip file -->  Get a subdomain website
```

### CLI: Deploy Anywhere
```bash
cd my-nextjs-app
cloudpipe deploy  # Auto-detects, builds, and deploys
```

---

## 🌐 CloudPipe Platform

No nginx. No SSL. No CI/CD pipeline. Just drop and go.

---

## Concept

**One `.js` file = One public API**

Upload a JavaScript file to CloudPipe and instantly get a live public API endpoint. No extra server setup, no nginx config, no SSL management.

## Two Deploy Modes

| Mode | URL Pattern | Use Case |
|------|-------------|----------|
| **API Service** | `api.yourdomain.com/xxx` | APIs, Webhooks, Microservices |
| **Project Deploy** | `xxx.yourdomain.com` | Full websites, Static pages |

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/Jeffrey0117/CloudPipe.git
cd CloudPipe

# 2. Install dependencies
npm install

# 3. Configure (copy example and customize)
cp config.example.json config.json
# Edit config.json with your domain, password, etc.

# 4. Start
node index.js
# Or on Windows: start.bat
```

Open the Dashboard after startup: `http://localhost:8787/admin`

📖 **Detailed setup guide**: See [SETUP.md](SETUP.md)

## API Services

Inside `handle()`, you can do anything:

- Return JSON data
- Read/write local files
- Download remote resources
- Call external APIs
- Store data (SQLite, JSONL...)
- Handle POST / GET / PUT / DELETE
- Configure CORS

### Basic Structure

```javascript
// services/my-api.js
module.exports = {
  match(req) {
    return req.url.startsWith('/my-api');
  },

  handle(req, res) {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ hello: 'world' }));
  }
};
```

After upload: `https://api.yourdomain.com/my-api` is live.

### Full Example: Receive and Store Data

```javascript
// services/collector.js
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '..', 'data', 'records.jsonl');

module.exports = {
  match(req) {
    return req.url.startsWith('/collector');
  },

  handle(req, res) {
    const headers = {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    };

    // POST /collector/save
    if (req.method === 'POST' && req.url === '/collector/save') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        const data = JSON.parse(body);
        fs.appendFileSync(DATA_FILE, JSON.stringify(data) + '\n');
        res.writeHead(200, headers);
        res.end(JSON.stringify({ ok: true }));
      });
      return;
    }

    // GET /collector/list
    if (req.method === 'GET' && req.url === '/collector/list') {
      const content = fs.existsSync(DATA_FILE)
        ? fs.readFileSync(DATA_FILE, 'utf8')
        : '';
      const records = content.trim().split('\n').filter(Boolean).map(JSON.parse);
      res.writeHead(200, headers);
      res.end(JSON.stringify(records));
      return;
    }

    res.writeHead(404, headers);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
};
```

## Project Deploy

**Static Website**

```
apps/blog/
└── index.html
```

Access: `https://blog.yourdomain.com`

**Node.js App**

```javascript
// apps/api/server.js
module.exports = function(req, res) {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ status: 'ok' }));
};
```

Access: `https://api.yourdomain.com`

## Directory Structure

```
cloudpipe/
├── index.js              # Entry point
├── config.json           # Configuration
├── start.bat             # Windows quick start
│
├── services/             # API services (upload .js)
│   ├── _example.js       # Example
│   └── your-api.js       # Your API
│
├── apps/                 # Projects (upload .zip)
│   └── {name}/
│
├── data/                 # Data storage (auto-created)
│   └── {service}/
│
└── public/               # Dashboard frontend
```

## Configuration

`config.json`:

```json
{
  "domain": "yourdomain.com",
  "port": 8787,
  "subdomain": "api",
  "adminPassword": "your-secure-password"
}
```

---

## ⚡ CloudPipe CLI

A powerful command-line tool for deploying full-stack applications with **zero configuration**.

### Features

- **🔍 Auto-detection**: Automatically detects Next.js, Vite, React, Vue, Express, Fastify, Koa, and more
- **⚡ Hot-reload**: Watch mode for automatic rebuilds and restarts during development
- **🌐 Public URLs**: Automatic Cloudflare Tunnel creation for instant public access
- **📦 PM2 Management**: Reliable process management and monitoring
- **🔐 Environment Variables**: Secure management of secrets and configuration
- **📊 Deployment History**: Track all deployments with detailed logs

### Quick Start

```bash
# Install globally
npm install -g cloudpipe

# Deploy any project instantly (auto-detects everything)
cd my-nextjs-app
cloudpipe deploy

# Deploy with hot-reload for development
cloudpipe deploy --watch

# Deploy with custom name and port
cloudpipe deploy --name my-api --port 4000
```

### Available Commands

```bash
cloudpipe init              # Scan and generate config
cloudpipe deploy [path]     # Deploy project
cloudpipe list              # List all deployments
cloudpipe logs <name>       # View logs
cloudpipe stop <name>       # Stop service
cloudpipe remove <name>     # Remove deployment
cloudpipe env set KEY=value # Manage environment variables
cloudpipe history           # View deployment history
```

### Supported Frameworks

✅ Next.js • Vite • Create React App • Vue • Angular
✅ Express • Fastify • Koa • Static HTML

[📖 Full CLI Documentation](docs/CLI.md)

---

## License

MIT
