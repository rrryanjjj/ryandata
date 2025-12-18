#!/bin/bash
# 阿里云 ECS 部署脚本 (Ubuntu/Debian)
# 在 ECS 服务器上以 root 用户运行

set -e

echo "=== 1. 更新系统 ==="
apt update && apt upgrade -y

echo "=== 2. 安装 Node.js 18.x ==="
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

echo "=== 3. 安装 PM2 ==="
npm install -g pm2

echo "=== 4. 安装 Nginx ==="
apt install -y nginx

echo "=== 5. 安装 Git ==="
apt install -y git

echo "=== 6. 创建应用目录 ==="
mkdir -p /var/www/meihaodata

echo "=== 7. 克隆代码 ==="
cd /var/www
git clone https://github.com/rrryanjjj/meihaodata.git meihaodata

echo "=== 8. 安装依赖 ==="
cd /var/www/meihaodata/server
npm install --production

echo "=== 9. 配置 Nginx ==="
cp /var/www/meihaodata/deploy/nginx.conf /etc/nginx/sites-available/meihaodata
ln -sf /etc/nginx/sites-available/meihaodata /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "=== 10. 启动应用 ==="
cd /var/www/meihaodata/server
pm2 start ecosystem.config.js
pm2 save
pm2 startup

echo "=== 部署完成! ==="
echo "请修改以下配置:"
echo "1. /etc/nginx/sites-available/meihaodata 中的 server_name"
echo "2. /var/www/meihaodata/server/ecosystem.config.js 中的 JWT_SECRET"
echo "3. 阿里云安全组开放 80 端口"
