module.exports = {
  apps: [
    // ── CloudPipe (LurlHub) ── port 8787
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
        NODE_ENV: 'production'
      }
    },

    // ── Workr ── port 4002
    {
      name: 'workr',
      script: './server.js',
      cwd: './projects/workr',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '5s',
      error_file: '../../logs/workr-error.log',
      out_file: '../../logs/workr-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 4002
      }
    },

    // ── MySpeedTest ── port 4001
    {
      name: 'myspeedtest',
      script: './server.js',
      cwd: './projects/myspeedtest',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '5s',
      error_file: '../../logs/myspeedtest-error.log',
      out_file: '../../logs/myspeedtest-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 4001
      }
    },

    // ── Adman ── port 4003 (Next.js)
    {
      name: 'adman',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4003',
      cwd: './projects/adman',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '5s',
      error_file: '../../logs/adman-error.log',
      out_file: '../../logs/adman-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 4003
      }
    },

    // ── AutoCard ── port 4004
    {
      name: 'autocard',
      script: './server.js',
      cwd: './projects/autocard',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '5s',
      error_file: '../../logs/autocard-error.log',
      out_file: '../../logs/autocard-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 4004
      }
    },

    // ── ReelScript ── port 4005 (ESM, spawns Python FastAPI backend)
    {
      name: 'reelscript',
      script: './server.js',
      cwd: './projects/reelscript',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      error_file: '../../logs/reelscript-error.log',
      out_file: '../../logs/reelscript-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 4005
      }
    },

    // ── LetMeUse ── port 4006 (Next.js)
    {
      name: 'letmeuse',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4006',
      cwd: './projects/letmeuse',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '5s',
      error_file: '../../logs/letmeuse-error.log',
      out_file: '../../logs/letmeuse-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 4006
      }
    },

    // ── upimg (duk.tw) ── port 4007 (Next.js)
    {
      name: 'upimg',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 4007',
      cwd: './projects/upimg',
      autorestart: true,
      max_restarts: 5,
      min_uptime: '10s',
      error_file: '../../logs/upimg-error.log',
      out_file: '../../logs/upimg-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 4007,
        HOSTNAME: '0.0.0.0'
      }
    }
  ]
};
