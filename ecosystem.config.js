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

// ── Resolve runner to PM2 script/args ──
function resolveRunner(project) {
  const runner = project.runner || 'node';

  switch (runner) {
    case 'next':
      return {
        script: 'node_modules/next/dist/bin/next',
        args: `start -p ${project.port}`,
      };
    case 'tsx':
      return {
        script: 'node_modules/tsx/dist/cli.mjs',
        args: project.entryFile,
      };
    case 'node':
    default:
      return {
        script: `./${project.entryFile || 'server.js'}`,
        args: undefined,
      };
  }
}

// ── Build apps list dynamically ──
const apps = [
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
  }
];

// ── Read projects.json and generate PM2 entries ──
try {
  const projectsPath = path.join(__dirname, 'data', 'deploy', 'projects.json');
  const { projects } = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));

  for (const project of projects) {
    const projectDir = path.join(__dirname, 'projects', project.id);

    // Skip projects that haven't been cloned yet
    if (!fs.existsSync(projectDir)) continue;

    const { script, args } = resolveRunner(project);
    const minUptime = ['reelscript', 'upimg'].includes(project.id) ? '10s' : '5s';

    const entry = {
      name: project.pm2Name || project.id,
      script,
      cwd: `./projects/${project.id}`,
      ...projectDefaults(project.pm2Name || project.id, { min_uptime: minUptime }),
      env: {
        NODE_ENV: 'production',
        PORT: project.port,
        ...sharedEnv,
        ...loadEnv(`projects/${project.id}`)
      }
    };

    // Special env overrides
    if (project.id === 'upimg') {
      entry.env.HOSTNAME = '0.0.0.0';
    }

    if (args) {
      entry.args = args;
    }

    apps.push(entry);

    // ── Companion processes ──
    if (Array.isArray(project.companions)) {
      for (const comp of project.companions) {
        const compCwd = comp.cwd
          ? `./projects/${project.id}/${comp.cwd}`
          : `./projects/${project.id}`;
        const compName = `${project.id}-${comp.name}`;

        apps.push({
          name: compName,
          script: comp.command,
          args: comp.args,
          cwd: compCwd,
          ...projectDefaults(compName, { min_uptime: minUptime }),
          env: {
            NODE_ENV: 'production',
            PORT: project.port,
            ...sharedEnv,
            ...loadEnv(`projects/${project.id}`),
            ...(comp.cwd ? loadEnv(`projects/${project.id}/${comp.cwd}`) : {})
          }
        });
      }
    }
  }
} catch (err) {
  console.error('[ecosystem] Failed to load projects.json:', err.message);
}

module.exports = { apps };

// ── Cloudflared Tunnel (conditional) ──
try {
  const cfConfig = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
  const cfPath = cfConfig.cloudflared?.path || 'cloudflared';
  const cfYml = path.join(__dirname, 'cloudflared.yml');
  if (fs.existsSync(cfYml)) {
    module.exports.apps.push({
      name: 'tunnel',
      script: cfPath,
      args: `tunnel --config ${cfYml} run cloudpipe`,
      interpreter: 'none',
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      error_file: 'logs/tunnel-error.log',
      out_file: 'logs/tunnel-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true
    });
  }
} catch {}
