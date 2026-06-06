// PM2 — Configuration StoreBox API
module.exports = {
  apps: [
    {
      name: 'storebox-api',
      cwd: './apps/api',
      script: 'dist/index.js',
      instances: 1,              // 1 instance (augmenter si VPS multi-core)
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      env_file: './apps/api/.env',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
