const fs = require('fs');
const path = require('path');

// ── Shared env from config.json ──
let sharedEnv = {};
try {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  if (config.telegramProxy) {
    sharedEnv.TELEGRAM_PROXY = config.telegramProxy;
  }
} catch {}

// ── Load .env file for a project directory ──
function loadEnv(relativeDir) {
  const envPath = path.join(__dirname, relativeDir, '.env');
  const env = {};
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx);
        const val = trimmed.slice(eqIdx + 1).replace(/^["']|["']$/g, '');
        env[key] = val;
      }
    }
  } catch {}
  return env;
}

// ── PM2 defaults for sub-projects ──
function projectDefaults(name, opts = {}) {
  return {
    autorestart: true,
    max_restarts: 5,
    min_uptime: opts.min_uptime || '5s',
    error_file: `../../logs/${name}-error.log`,
    out_file: `../../logs/${name}-out.log`,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true
  };
}

module.exports = {
  apps: [
    // ── CloudPipe (core) ── port 8787
    {
      name: 'cloudpipe',
      script: './index.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      error_file: 'logs/error.log',
      out_file: 'logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      kill_timeout: 8000,
      wait_ready: false,
      listen_timeout: 15000,
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        ...sharedEnv
      }
    },

    // ── MySpeedTest ── port 4001
    {
      name: 'myspeedtest',
      script: './server.js',
      cwd: './projects/myspeedtest',
      ...projectDefaults('myspeedtest'),
      env: {
        NODE_ENV: 'production',
        PORT: 4001,
        ...sharedEnv,
        ...loadEnv('projects/myspeedtest')
      }
    },

    // ── Workr ── port 4002
    {
      name: 'workr',
      script: './server.js',
      cwd: './projects/workr',
      ...projectDefaults('workr'),
      env: {
        NODE_ENV: 'production',
        PORT: 4002,
        ...sharedEnv,
        ...loadEnv('projects/workr')
      }
    },

    // ── AdMan ── port 4003 (Next.js)
    {
      name: 'adman',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4003',
      cwd: './projects/adman',
      ...projectDefaults('adman'),
      env: {
        NODE_ENV: 'production',
        PORT: 4003,
        ...sharedEnv,
        ...loadEnv('projects/adman')
      }
    },

    // ── AutoCard ── port 4004
    {
      name: 'autocard',
      script: './server.js',
      cwd: './projects/autocard',
      ...projectDefaults('autocard'),
      env: {
        NODE_ENV: 'production',
        PORT: 4004,
        ...sharedEnv,
        ...loadEnv('projects/autocard')
      }
    },

    // ── ReelScript ── port 4005
    {
      name: 'reelscript',
      script: './server.js',
      cwd: './projects/reelscript',
      ...projectDefaults('reelscript', { min_uptime: '10s' }),
      env: {
        NODE_ENV: 'production',
        PORT: 4005,
        ...sharedEnv,
        ...loadEnv('projects/reelscript')
      }
    },

    // ── ReelScript Bot (companion) ──
    {
      name: 'reelscript-bot',
      script: 'python',
      args: '-m services.telegram_bot',
      cwd: './projects/reelscript/backend',
      ...projectDefaults('reelscript-bot', { min_uptime: '10s' }),
      env: {
        ...sharedEnv,
        ...loadEnv('projects/reelscript'),
        ...loadEnv('projects/reelscript/backend')
      }
    },

    // ── LetMeUse ── port 4006 (Next.js)
    {
      name: 'letmeuse',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4006',
      cwd: './projects/letmeuse',
      ...projectDefaults('letmeuse'),
      env: {
        NODE_ENV: 'production',
        PORT: 4006,
        ...sharedEnv,
        ...loadEnv('projects/letmeuse')
      }
    },

    // ── Upimg (duk.tw) ── port 4007 (Next.js)
    {
      name: 'upimg',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4007',
      cwd: './projects/upimg',
      ...projectDefaults('upimg', { min_uptime: '10s' }),
      env: {
        NODE_ENV: 'production',
        PORT: 4007,
        HOSTNAME: '0.0.0.0',
        ...sharedEnv,
        ...loadEnv('projects/upimg')
      }
    },

    // ── MeeTube ── port 4008
    {
      name: 'meetube',
      script: './server/index.js',
      cwd: './projects/meetube',
      ...projectDefaults('meetube'),
      env: {
        NODE_ENV: 'production',
        PORT: 4008,
        ...sharedEnv,
        ...loadEnv('projects/meetube')
      }
    },

    // ── Pokkit ── port 4009
    {
      name: 'pokkit',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'src/index.ts',
      cwd: './projects/pokkit',
      ...projectDefaults('pokkit'),
      env: {
        NODE_ENV: 'production',
        PORT: 4009,
        ...sharedEnv,
        ...loadEnv('projects/pokkit')
      }
    }
  ]
};
