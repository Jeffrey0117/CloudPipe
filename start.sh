#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

echo ""
echo "  CloudPipe - Local Deploy Gateway"
echo "  ================================"
echo ""

# ============================================================
#  Step 0: Check & install prerequisites
# ============================================================

echo "[0] Checking prerequisites..."

# ── Helper: check command exists ──
has() { command -v "$1" &>/dev/null; }

# ── Node.js ──
if ! has node; then
  echo "  Installing Node.js..."
  if has apt-get; then
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    sudo apt-get install -y nodejs
  elif has dnf; then
    curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
    sudo dnf install -y nodejs
  elif has brew; then
    brew install node
  else
    echo "  [ERROR] Cannot auto-install Node.js. Install manually: https://nodejs.org"
    exit 1
  fi
fi
echo "  Node.js OK ($(node --version))"

# ── Git ──
if ! has git; then
  echo "  Installing Git..."
  if has apt-get; then
    sudo apt-get install -y git
  elif has dnf; then
    sudo dnf install -y git
  elif has brew; then
    brew install git
  else
    echo "  [ERROR] Cannot auto-install Git. Install manually."
    exit 1
  fi
fi
echo "  Git OK"

# ── PM2 ──
if ! has pm2; then
  echo "  Installing PM2..."
  sudo npm install -g pm2
fi
echo "  PM2 OK"

# ── node_modules ──
if [ ! -d node_modules ]; then
  echo "  Installing dependencies..."
  npm install
fi
echo "  Dependencies OK"

# ── Python (optional, for companions like reelscript-bot) ──
if has python3; then
  echo "  Python3 OK"
elif has python; then
  echo "  Python OK"
else
  echo "  Python not found (optional, needed for some companions)"
fi

echo ""

# ============================================================
#  First-time setup: auto-run setup.js if no config.json
# ============================================================

if [ ! -f config.json ]; then
  echo "  ========================================"
  echo "  First-time setup detected!"
  echo "  ========================================"
  echo ""
  node setup.js
  if [ $? -ne 0 ]; then
    echo ""
    echo "  [ERROR] Setup failed!"
    exit 1
  fi
  echo ""
  echo "  Setup complete!"
  echo ""
fi

# ============================================================
#  Start all services + tunnel via PM2
# ============================================================

echo "[1/3] Stopping old instances..."
pm2 delete all 2>/dev/null || true
sleep 2

echo "[2/3] Starting all services + tunnel..."
pm2 start ecosystem.config.js
if [ $? -ne 0 ]; then
  echo ""
  echo "  [ERROR] PM2 failed to start!"
  exit 1
fi

# Save process list for pm2 resurrect
pm2 save 2>/dev/null || true

sleep 5

echo ""
echo "[3/3] Service status:"
echo ""
pm2 list

if ! pm2 list 2>/dev/null | grep -q "online"; then
  echo ""
  echo "  [ERROR] No services started!"
  echo "  Check logs with: pm2 logs"
  exit 1
fi

echo ""
echo "  All services + tunnel running!"
echo "  Managed by PM2 (survives terminal close)"
echo ""

# ============================================================
#  Auto-start on boot (systemd)
# ============================================================

if ! systemctl is-enabled pm2-$(whoami) &>/dev/null 2>&1; then
  echo ""
  read -rp "  Enable auto-start on boot? (Y/n): " AUTOSTART
  if [[ ! "$AUTOSTART" =~ ^[nN]$ ]]; then
    pm2 startup systemd -u "$(whoami)" --hp "$HOME" 2>/dev/null || sudo env PATH="$PATH" pm2 startup systemd -u "$(whoami)" --hp "$HOME"
    pm2 save
    echo "  Auto-start enabled via systemd"
    echo "  To remove: pm2 unstartup systemd"
  fi
fi

echo ""
echo "  Commands:"
echo "    pm2 list          - status"
echo "    pm2 logs          - live logs"
echo "    pm2 logs tunnel   - tunnel logs"
echo "    pm2 stop all      - stop everything"
echo ""
