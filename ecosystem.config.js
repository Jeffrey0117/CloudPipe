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

    // ── Adman ── port 4003
    {
      name: 'adman',
      script: 'node_modules/.bin/next',
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
    }
  ]
};
