# CloudPipe Static Hosting

Deploy static sites with one command. Supports Vite, React, Vue, plain HTML — anything that outputs static files.

```
npx cloudpipe-cli up
```

---

## Quick Start (Localhost)

No domain needed. Run everything locally in 5 minutes.

### 1. Install & Start CloudPipe

```bash
git clone https://github.com/Jeffrey0117/CloudPipe.git
cd CloudPipe
npm install
pm2 start ecosystem.config.js
```

### 2. Get a Deploy Token

Login to admin and create a token:

```bash
# Get admin JWT
TOKEN=$(curl -s -X POST http://localhost:8787/api/_admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"YOUR_ADMIN_PASSWORD"}' | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).token")

# Create deploy token
curl -s -X POST http://localhost:8787/api/auth/token \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-token"}'
```

Copy the `token` value from the response — you'll need it next.

Or if you have the Telegram bot configured: send `/newtoken my-token` and copy the token.

### 3. Deploy Your Site

```bash
cd ~/my-vite-project
npx cloudpipe-cli login
# Paste your token, press Enter for default server (http://localhost:8787)

npx cloudpipe-cli up
```

Done! Open the URL it prints — something like `http://localhost:8787/_sites/my-vite-project/`

### 4. Manage Sites

```bash
cloudpipe list          # List all your sites
cloudpipe rm my-site    # Delete a site
cloudpipe logout        # Remove saved token
```

---

## Go Online with Cloudflare Tunnel

Make your sites accessible from the internet — free, no port forwarding needed.

### Step 1: Create a Cloudflare Account

Go to [dash.cloudflare.com](https://dash.cloudflare.com/) and sign up (free).

### Step 2: Get a Domain

Either:
- **Buy a domain** on Cloudflare (cheapest registrar, ~$10/year)
- **Transfer** an existing domain to Cloudflare

For this guide we'll use `example.com` — replace with your domain.

### Step 3: Create a Tunnel

```bash
# Install cloudflared
# Windows: winget install cloudflare.cloudflared
# Mac: brew install cloudflared
# Linux: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

# Login to Cloudflare
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create my-cloudpipe

# Note the tunnel ID (e.g. afd11345-c75a-4d62-aa67-0a389d82ce74)
```

### Step 4: DNS Records

In Cloudflare dashboard → DNS → Add records:

| Type | Name | Content | Proxy |
|------|------|---------|-------|
| CNAME | `@` | `YOUR_TUNNEL_ID.cfargotunnel.com` | Proxied |
| CNAME | `*` | `YOUR_TUNNEL_ID.cfargotunnel.com` | Proxied |

The wildcard `*` record is what makes `my-site.example.com` work.

### Step 5: Configure CloudPipe

Edit `cloudflared.yml` in your CloudPipe root:

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /path/to/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: "*.example.com"
    service: http://localhost:8787
  - hostname: "example.com"
    service: http://localhost:8787
  - service: http_status:404
```

Edit `config.json`, add:

```json
{
  "staticDomain": "example.com"
}
```

### Step 6: Start Tunnel

```bash
# Add to PM2 (auto-restarts)
pm2 start cloudflared -- tunnel run my-cloudpipe
pm2 save
```

### Step 7: Deploy & Visit

```bash
cd ~/my-project
npx cloudpipe-cli login
# Token: (paste your token)
# Server URL: https://example.com

npx cloudpipe-cli up --name my-site
```

Visit `https://my-site.example.com` — your site is live!

---

## CLI Reference

| Command | Description |
|---------|-------------|
| `cloudpipe login` | Save deploy token + server URL |
| `cloudpipe up` | Build & deploy current directory |
| `cloudpipe up --name x` | Deploy with custom slug |
| `cloudpipe list` | List your deployed sites |
| `cloudpipe rm <slug>` | Delete a site |
| `cloudpipe logout` | Remove saved credentials |

### What gets deployed?

The CLI auto-detects your project:

| Project Type | What Happens |
|-------------|-------------|
| **Vite / React / Vue** | Runs `npm run build`, uploads `dist/` |
| **Create React App** | Runs `npm run build`, uploads `build/` |
| **Plain HTML** | Uploads current directory as-is |
| **Next.js (SSR)** | Rejected (needs `output: "export"` for static) |

### Limits (Free Tier)

| Limit | Value |
|-------|-------|
| Sites per token | 3 |
| Max archive size | 50 MB |
| Max extracted size | 50 MB |

---

## API Reference

All endpoints available on your CloudPipe server (both bare domain and `localhost:8787`).

### Deploy a Site

```
PUT /api/deploy/static?slug=my-site
Authorization: Bearer <deploy-token>
Content-Type: application/gzip
Body: <tar.gz archive>
```

Response:
```json
{
  "url": "https://my-site.example.com",
  "slug": "my-site",
  "size": 12345
}
```

### List Sites

```
GET /api/sites
Authorization: Bearer <deploy-token>
```

### Delete a Site

```
DELETE /api/sites/my-site
Authorization: Bearer <deploy-token>
```

### Create Deploy Token (Admin)

```
POST /api/auth/token
Authorization: Bearer <admin-jwt>
Content-Type: application/json

{"name": "user-name", "email": "optional@email.com", "max_sites": 3}
```

---

## FAQ

**Q: Do I need a domain?**
No. Localhost mode works with `/_sites/slug/` paths. Add a domain later when you're ready to go public.

**Q: Can I use a free domain?**
Yes. Any domain on Cloudflare works. You can also use a subdomain of a domain you already own (e.g., `sites.mydomain.com`).

**Q: How do I increase the site limit?**
Create a new token with a higher `max_sites` value, or modify the token's `max_sites` in the SQLite database at `data/cloudpipe.db`.

**Q: Can I deploy backend/SSR apps?**
Not yet. Static hosting is for static files only (HTML, CSS, JS, images). Backend support is planned for a future Pro tier.

**Q: Where are the files stored?**
In `data/static/{slug}/` inside your CloudPipe directory. Each deploy replaces the previous version atomically.
