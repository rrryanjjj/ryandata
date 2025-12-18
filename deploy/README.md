# 阿里云 ECS 部署指南

## 前置条件

1. 购买阿里云 ECS 实例（推荐配置）：
   - 地域：华东/华北（根据用户位置选择）
   - 规格：1核2G 或以上
   - 系统：Ubuntu 22.04 LTS
   - 带宽：1-5Mbps

2. 配置安全组规则：
   - 入方向开放 22 端口（SSH）
   - 入方向开放 80 端口（HTTP）
   - 入方向开放 443 端口（HTTPS，可选）

## 部署步骤

### 方式一：自动部署（推荐）

1. SSH 连接到 ECS：
```bash
ssh root@你的ECS公网IP
```

2. 下载并运行部署脚本：
```bash
curl -fsSL https://raw.githubusercontent.com/rrryanjjj/meihaodata/main/deploy/setup.sh | bash
```

### 方式二：手动部署

1. SSH 连接到 ECS：
```bash
ssh root@你的ECS公网IP
```

2. 安装 Node.js：
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
```

3. 安装 PM2 和 Nginx：
```bash
npm install -g pm2
apt install -y nginx git
```

4. 克隆代码：
```bash
mkdir -p /var/www
cd /var/www
git clone https://github.com/rrryanjjj/meihaodata.git
```

5. 安装依赖：
```bash
cd /var/www/meihaodata/server
npm install --production
```

6. 配置 Nginx：
```bash
cp /var/www/meihaodata/deploy/nginx.conf /etc/nginx/sites-available/meihaodata
ln -sf /etc/nginx/sites-available/meihaodata /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
# 编辑 server_name 为你的域名或 IP
nano /etc/nginx/sites-available/meihaodata
nginx -t && systemctl reload nginx
```

7. 修改 JWT 密钥：
```bash
nano /var/www/meihaodata/server/ecosystem.config.js
# 修改 JWT_SECRET 为一个安全的随机字符串
```

8. 启动应用：
```bash
cd /var/www/meihaodata/server
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

## 验证部署

访问 `http://你的ECS公网IP` 应该能看到销售数据对比系统界面。

## 常用命令

```bash
# 查看应用状态
pm2 status

# 查看日志
pm2 logs sales-data-server

# 重启应用
pm2 restart sales-data-server

# 更新代码
cd /var/www/meihaodata
git pull
cd server && npm install
pm2 restart sales-data-server
```

## 配置域名（可选）

1. 在阿里云购买域名并完成备案
2. 添加 A 记录指向 ECS 公网 IP
3. 修改 Nginx 配置中的 server_name
4. 配置 HTTPS（推荐使用 Let's Encrypt）

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```
