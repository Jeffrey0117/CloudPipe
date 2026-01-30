# CloudPipe CLI

**🚀 Zero-config deployment tool for full-stack applications**

CloudPipe CLI automates project deployment with automatic framework detection, service management, and tunnel creation - all without configuration files.

## ✨ Features

- **🔍 Auto-detection**: Automatically detects Next.js, Vite, React, Vue, Express, and more
- **⚡ Zero-config**: Deploy without writing any configuration (optional config supported)
- **🔄 Hot-reload**: Watch mode for automatic rebuilds and restarts
- **🌐 Public URLs**: Automatic Cloudflare Tunnel creation for instant public access
- **📦 Service Management**: Built on PM2 for reliable process management
- **🔐 Environment Variables**: Secure management of secrets and config
- **📊 Deployment History**: Track all deployments with detailed logs
- **🎯 Simple CLI**: Intuitive commands that just work

## 📦 Installation

```bash
npm install -g cloudpipe
```

### Prerequisites

- **Node.js** (v14+)
- **PM2** (installed automatically)
- **Cloudflared** (optional, for public URLs):
  - Windows: `winget install cloudflare.cloudflared`
  - macOS: `brew install cloudflared`
  - Linux: [Installation guide](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/)

## 🚀 Quick Start

```bash
# Navigate to your project
cd my-project

# Deploy instantly (auto-detects everything)
cloudpipe deploy

# Or with custom options
cloudpipe deploy --name my-app --port 3000 --watch
```

That's it! CloudPipe will:
1. ✅ Detect your framework and project type
2. ✅ Build your project (if needed)
3. ✅ Start the service with PM2
4. ✅ Create a Cloudflare Tunnel for public access
5. ✅ Display local and public URLs

## 📚 Commands

### `cloudpipe init`

Scan your project and generate a `cloudpipe.json` configuration file.

```bash
cloudpipe init

# Force overwrite existing config
cloudpipe init --force
```

### `cloudpipe deploy [path]`

Deploy a project with automatic detection.

```bash
# Deploy current directory
cloudpipe deploy

# Deploy specific directory
cloudpipe deploy ./my-app

# Deploy with custom name and port
cloudpipe deploy --name my-api --port 4000

# Deploy with file watching (hot-reload)
cloudpipe deploy --watch

# Deploy without tunnel
cloudpipe deploy --no-tunnel
```

**Options:**
- `-n, --name <name>`: Custom project name
- `-p, --port <port>`: Custom port number
- `--no-tunnel`: Skip Cloudflare Tunnel creation
- `-w, --watch`: Enable file watching for auto-reload

### `cloudpipe list`

List all deployed projects.

```bash
cloudpipe list

# Alias
cloudpipe ls
```

### `cloudpipe logs <name>`

View project logs.

```bash
# View last 50 lines
cloudpipe logs my-app

# Follow logs in real-time
cloudpipe logs my-app --follow

# View last 100 lines
cloudpipe logs my-app --lines 100
```

**Options:**
- `-f, --follow`: Follow log output in real-time
- `-n, --lines <number>`: Number of lines to display (default: 50)

### `cloudpipe stop <name>`

Stop a running project.

```bash
cloudpipe stop my-app
```

### `cloudpipe remove <name>`

Remove a deployed project (with confirmation).

```bash
cloudpipe remove my-app

# Alias
cloudpipe rm my-app
```

### `cloudpipe env`

Manage environment variables.

```bash
# Set a variable
cloudpipe env set API_KEY=abc123

# Set interactively
cloudpipe env set

# List all variables (secrets masked)
cloudpipe env list

# Remove a variable
cloudpipe env remove API_KEY
```

### `cloudpipe history`

View deployment history.

```bash
# View last 10 deployments
cloudpipe history

# View last 20 deployments
cloudpipe history --limit 20
```

## 🎯 Supported Frameworks

CloudPipe automatically detects and configures:

| Framework | Type | Build | Start |
|-----------|------|-------|-------|
| **Next.js** | Full-stack | ✅ | `npm start` |
| **Vite** | Frontend | ✅ | `serve dist` |
| **Create React App** | Frontend | ✅ | `serve build` |
| **Vue CLI** | Frontend | ✅ | `serve dist` |
| **Angular** | Frontend | ✅ | `serve dist` |
| **Express** | Backend | ❌ | `npm start` |
| **Fastify** | Backend | ❌ | `npm start` |
| **Koa** | Backend | ❌ | `npm start` |
| **Static HTML** | Static | ❌ | `serve .` |

## 📝 Configuration File

While CloudPipe works without configuration, you can customize behavior with `cloudpipe.json`:

```json
{
  "name": "my-app",
  "type": "frontend",
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "startCommand": "npm run start",
  "port": 3000,
  "env": {
    "NODE_ENV": "production",
    "API_URL": "https://api.example.com"
  },
  "tunnel": {
    "enabled": true
  }
}
```

Generate this file with `cloudpipe init`.

## 🔐 Environment Variables

CloudPipe manages environment variables securely:

1. **Reading**: Loads from `.env` and `.cloudpipe.env`
2. **Writing**: Saves to `.cloudpipe.env` (higher priority)
3. **Security**: Automatically masks sensitive values in `list` output

```bash
# Set variables
cloudpipe env set DATABASE_URL=postgres://...
cloudpipe env set API_SECRET=secret123

# Variables are automatically loaded during deployment
cloudpipe deploy
```

## 🔄 Hot Reload Mode

Watch mode enables automatic rebuilds and restarts on file changes:

```bash
cloudpipe deploy --watch
```

Features:
- **Smart debouncing**: Waits 1s after last change before rebuilding
- **Filtered watching**: Ignores `node_modules`, `.git`, `dist`, etc.
- **Auto-rebuild**: Runs build command if configured
- **Auto-restart**: Restarts service after successful rebuild

## 📊 Deployment History

CloudPipe tracks all deployments in `~/.cloudpipe/history.json`:

```bash
cloudpipe history
```

Shows:
- Deployment timestamp
- Project name and type
- Public URL
- Success/failure status
- Error messages (if failed)

## 🛠️ Troubleshooting

### Port Already in Use

```bash
# Check what's using the port
netstat -ano | findstr :3000

# Deploy on different port
cloudpipe deploy --port 3001
```

### Service Won't Start

```bash
# Check logs for errors
cloudpipe logs my-app --follow

# Verify dependencies are installed
cd my-project && npm install

# Try redeploying
cloudpipe remove my-app
cloudpipe deploy
```

### Cloudflare Tunnel Fails

```bash
# Check if cloudflared is installed
cloudflared --version

# Deploy without tunnel
cloudpipe deploy --no-tunnel
```

### Build Fails

```bash
# Check build command in package.json
cat package.json

# Run build manually to see errors
npm run build

# Generate config and customize
cloudpipe init
```

## 🏗️ Architecture

CloudPipe is built on proven tools:

- **PM2**: Process management and monitoring
- **Cloudflared**: Secure tunnel creation
- **Chokidar**: File watching for hot-reload
- **Commander**: CLI framework
- **Inquirer**: Interactive prompts

```
┌─────────────┐
│  cloudpipe  │
│     CLI     │
└──────┬──────┘
       │
       ├─► ProjectDetector (auto-detection)
       ├─► ServiceManager (PM2 wrapper)
       ├─► TunnelManager (cloudflared)
       ├─► FileWatcher (hot-reload)
       └─► EnvManager (environment vars)
```

## 📄 License

MIT

## 🙏 Acknowledgments

Built with inspiration from:
- [Vercel CLI](https://vercel.com/docs/cli)
- [PinMe](https://github.com/glitternetwork/pinme)
- [Railway CLI](https://docs.railway.app/reference/cli-api)

---

**Made with ❤️ for developers who just want to ship**
