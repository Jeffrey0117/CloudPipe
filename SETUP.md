# CloudPipe Setup Guide

## First-Time Setup

### 1. Clone and Install

```bash
git clone https://github.com/Jeffrey0117/CloudPipe.git
cd CloudPipe
npm install
```

### 2. Configure

Copy the example config and customize it:

```bash
# Windows
copy config.example.json config.json

# macOS/Linux
cp config.example.json config.json
```

Edit `config.json`:

```json
{
  "domain": "yourdomain.com",          // Your domain
  "port": 8787,                        // Server port
  "subdomain": "api",                  // API subdomain
  "adminPassword": "change-this",      // Dashboard password (CHANGE THIS!)
  "jwtSecret": "your-random-secret",   // JWT secret for auth (CHANGE THIS!)
  "serviceToken": "service-token"      // Internal service token (CHANGE THIS!)
}
```

### 3. Start the Server

```bash
# Windows
start.bat

# macOS/Linux
node index.js
```

### 4. Access Dashboard

Open: `http://localhost:8787/admin`

Default password: (the one you set in config.json)

## Directory Structure

After setup, your structure should look like:

```
CloudPipe/
├── services/           # Your API services (.js files)
│   ├── _example.js    # Example service (reference)
│   └── your-api.js    # Your services go here
├── apps/              # Your deployed projects
│   └── my-website/    # Deployed projects go here
├── data/              # Service data storage (auto-created)
├── config.json        # Your private config (gitignored)
└── ...
```

## Creating Your First Service

1. Create a new file in `services/`:

```javascript
// services/hello.js
module.exports = {
  match(req) {
    return req.url.startsWith('/hello');
  },

  handle(req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Hello from CloudPipe!' }));
  }
};
```

2. Restart the server

3. Access: `http://api.yourdomain.com/hello`

## Using the CLI

See [CLI Documentation](docs/CLI.md) for deploying full-stack applications.

```bash
# Install CLI globally
npm install -g cloudpipe

# Deploy a project
cd my-nextjs-app
cloudpipe deploy
```

## Security Notes

⚠️ **IMPORTANT**: Change these in `config.json`:
- `adminPassword` - Dashboard access password
- `jwtSecret` - JWT signing secret
- `serviceToken` - Internal service authentication

Never commit `config.json` to git (it's already in .gitignore).

## Troubleshooting

### Port already in use

```bash
# Change port in config.json
"port": 8788
```

### Services not loading

1. Check file is in `services/` directory
2. Ensure filename ends with `.js`
3. Check server logs for errors
4. Restart the server

### Can't access dashboard

1. Check server is running: `http://localhost:8787/admin`
2. Try the correct admin password from config.json
3. Clear browser cache

## Next Steps

- Read the [README](README.md) for feature overview
- Check [CLI Documentation](docs/CLI.md) for CLI usage
- See `services/_example.js` for service examples
- Join our community for support

---

Need help? Open an issue on GitHub!
