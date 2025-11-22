#!/bin/bash

# LovelyRes 服务器部署脚本
# 使用方法: ./scripts/deploy.sh

set -e  # 遇到错误立即退出

echo "🚀 开始部署 LovelyRes API 服务器..."

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
  echo -e "${RED}❌ 请使用 root 用户或 sudo 运行此脚本${NC}"
  exit 1
fi

# 1. 更新系统
echo -e "${YELLOW}📦 更新系统...${NC}"
apt update
apt upgrade -y

# 2. 安装 Node.js
echo -e "${YELLOW}📦 安装 Node.js 18.x...${NC}"
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
fi
echo -e "${GREEN}✅ Node.js 版本: $(node --version)${NC}"
echo -e "${GREEN}✅ npm 版本: $(npm --version)${NC}"

# 3. 安装 PostgreSQL
echo -e "${YELLOW}📦 安装 PostgreSQL...${NC}"
if ! command -v psql &> /dev/null; then
    apt install -y postgresql postgresql-contrib
    systemctl start postgresql
    systemctl enable postgresql
fi
echo -e "${GREEN}✅ PostgreSQL 版本: $(sudo -u postgres psql --version)${NC}"

# 4. 安装 PM2
echo -e "${YELLOW}📦 安装 PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi
echo -e "${GREEN}✅ PM2 版本: $(pm2 --version)${NC}"

# 5. 创建数据库用户和数据库
echo -e "${YELLOW}🗄️  配置数据库...${NC}"
read -p "请输入数据库密码: " DB_PASSWORD

sudo -u postgres psql -c "CREATE USER lovelyres_user WITH PASSWORD '$DB_PASSWORD';" 2>/dev/null || echo "用户已存在"
sudo -u postgres psql -c "CREATE DATABASE lovelyres OWNER lovelyres_user;" 2>/dev/null || echo "数据库已存在"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE lovelyres TO lovelyres_user;" 2>/dev/null

echo -e "${GREEN}✅ 数据库配置完成${NC}"

# 6. 配置环境变量
echo -e "${YELLOW}⚙️  配置环境变量...${NC}"
if [ ! -f .env ]; then
    cp .env.production .env
    
    # 替换数据库密码
    sed -i "s/your_secure_password_here/$DB_PASSWORD/g" .env
    
    # 生成随机 JWT 密钥
    JWT_SECRET=$(openssl rand -base64 32)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32)
    sed -i "s/your_jwt_secret_key_here_change_this_in_production/$JWT_SECRET/g" .env
    sed -i "s/your_jwt_refresh_secret_key_here_change_this_in_production/$JWT_REFRESH_SECRET/g" .env
    
    echo -e "${GREEN}✅ 环境变量配置完成${NC}"
else
    echo -e "${YELLOW}⚠️  .env 文件已存在，跳过${NC}"
fi

# 7. 生成 RSA 密钥对
echo -e "${YELLOW}🔐 生成 RSA 密钥对...${NC}"
if [ ! -f keys/private.pem ]; then
    mkdir -p keys
    openssl genrsa -out keys/private.pem 2048
    openssl rsa -in keys/private.pem -pubout -out keys/public.pem
    chmod 600 keys/private.pem
    chmod 644 keys/public.pem
    echo -e "${GREEN}✅ RSA 密钥对生成完成${NC}"
else
    echo -e "${YELLOW}⚠️  RSA 密钥对已存在，跳过${NC}"
fi

# 8. 安装依赖
echo -e "${YELLOW}📦 安装依赖...${NC}"
npm install --production

# 9. 编译 TypeScript
echo -e "${YELLOW}🔨 编译 TypeScript...${NC}"
npm run build

# 10. 初始化数据库
echo -e "${YELLOW}🗄️  初始化数据库...${NC}"
npm run db:init

# 11. 创建日志目录
echo -e "${YELLOW}📝 创建日志目录...${NC}"
mkdir -p logs

# 12. 启动应用
echo -e "${YELLOW}🚀 启动应用...${NC}"
pm2 delete lovelyres-api 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# 13. 配置防火墙
echo -e "${YELLOW}🔥 配置防火墙...${NC}"
if command -v ufw &> /dev/null; then
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw allow 3000/tcp
    ufw --force enable
    echo -e "${GREEN}✅ 防火墙配置完成${NC}"
fi

# 14. 显示状态
echo -e "${GREEN}✅ 部署完成！${NC}"
echo ""
echo -e "${GREEN}📊 应用状态:${NC}"
pm2 status

echo ""
echo -e "${GREEN}🌐 访问地址:${NC}"
echo "  - API: http://$(hostname -I | awk '{print $1}'):3000"
echo "  - 健康检查: http://$(hostname -I | awk '{print $1}'):3000/health"

echo ""
echo -e "${GREEN}📝 常用命令:${NC}"
echo "  - 查看日志: pm2 logs lovelyres-api"
echo "  - 重启应用: pm2 restart lovelyres-api"
echo "  - 停止应用: pm2 stop lovelyres-api"
echo "  - 查看状态: pm2 status"

echo ""
echo -e "${YELLOW}⚠️  重要提示:${NC}"
echo "  1. 请修改 .env 文件中的 CORS_ORIGIN 配置"
echo "  2. 建议配置 Nginx 反向代理"
echo "  3. 建议配置 SSL 证书"
echo "  4. 定期备份数据库"

echo ""
echo -e "${GREEN}🎉 部署成功！${NC}"

