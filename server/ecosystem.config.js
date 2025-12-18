// PM2 配置文件 - 用于生产环境进程管理
module.exports = {
  apps: [{
    name: 'sales-data-server',
    script: 'index.js',
    cwd: '/var/www/meihaodata/server',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      JWT_SECRET: 'your-production-secret-key-change-this'
    }
  }]
};
