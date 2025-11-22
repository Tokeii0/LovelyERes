#!/bin/bash

# LovelyRes 本地构建并部署到服务器
# 使用方法: ./scripts/build-and-deploy.sh

set -e  # 遇到错误立即退出

# 配置
SERVER_IP="${1:-110.42.47.180}"
SERVER_USER="${2:-root}"
SERVER_PATH="${3:-/var/www/LovelyRes/server}"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 开始构建并部署 LovelyRes API 服务器...${NC}"
echo ""

# 1. 清理旧的构建
echo -e "${YELLOW}🧹 清理旧的构建...${NC}"
rm -rf dist

# 2. 安装依赖
echo -e "${YELLOW}📦 安装依赖...${NC}"
npm install

# 3. 构建项目
echo -e "${YELLOW}🔨 构建项目...${NC}"
npm run build

echo -e "${GREEN}✅ 构建成功！${NC}"
echo ""

# 4. 创建部署目录
echo -e "${YELLOW}📁 创建部署目录...${NC}"
DEPLOY_DIR="deploy-temp"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# 5. 复制必要文件
echo -e "${YELLOW}📋 复制必要文件...${NC}"

# 复制 dist 目录
cp -r dist $DEPLOY_DIR/

# 复制 package.json 和 package-lock.json
cp package.json $DEPLOY_DIR/
cp package-lock.json $DEPLOY_DIR/

# 复制 ecosystem.config.js
cp ecosystem.config.js $DEPLOY_DIR/

# 复制 .env.production
cp .env.production $DEPLOY_DIR/

# 复制 keys 目录（如果存在）
if [ -d "keys" ]; then
    cp -r keys $DEPLOY_DIR/
else
    echo -e "${YELLOW}⚠️  keys 目录不存在，将在服务器上生成${NC}"
fi

# 复制 scripts 目录
mkdir -p $DEPLOY_DIR/scripts
cp scripts/*.sh $DEPLOY_DIR/scripts/ 2>/dev/null || true

echo -e "${GREEN}✅ 文件复制完成！${NC}"
echo ""

# 6. 上传到服务器
echo -e "${YELLOW}📤 上传到服务器 $SERVER_USER@$SERVER_IP...${NC}"
echo -e "${CYAN}目标路径: $SERVER_PATH${NC}"

# 使用 rsync 上传（如果可用），否则使用 scp
if command -v rsync &> /dev/null; then
    rsync -avz --delete $DEPLOY_DIR/ $SERVER_USER@$SERVER_IP:$SERVER_PATH/
else
    scp -r $DEPLOY_DIR/* $SERVER_USER@$SERVER_IP:$SERVER_PATH/
fi

echo -e "${GREEN}✅ 上传成功！${NC}"
echo ""

# 7. 清理临时目录
echo -e "${YELLOW}🧹 清理临时文件...${NC}"
rm -rf $DEPLOY_DIR

# 8. 在服务器上执行部署命令
echo -e "${YELLOW}🔧 在服务器上执行部署命令...${NC}"
echo ""

ssh $SERVER_USER@$SERVER_IP << 'ENDSSH'
cd /var/www/LovelyRes/server

echo '📦 安装生产依赖...'
npm install --production

echo '⚙️  配置环境变量...'
if [ ! -f .env ]; then
    cp .env.production .env
    echo '✅ 已创建 .env 文件，请修改配置'
else
    echo '⚠️  .env 文件已存在，跳过'
fi

echo '🔐 检查 RSA 密钥对...'
if [ ! -f keys/private.pem ]; then
    echo '生成 RSA 密钥对...'
    mkdir -p keys
    openssl genrsa -out keys/private.pem 2048
    openssl rsa -in keys/private.pem -pubout -out keys/public.pem
    chmod 600 keys/private.pem
    chmod 644 keys/public.pem
    echo '✅ RSA 密钥对生成完成'
else
    echo '✅ RSA 密钥对已存在'
fi

echo '🗄️  初始化数据库...'
npm run db:init 2>/dev/null || echo '⚠️  数据库可能已初始化'

echo '🚀 重启应用...'
pm2 delete lovelyres-api 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

echo ''
echo '✅ 部署完成！'
echo ''
echo '📊 应用状态:'
pm2 status

echo ''
echo '🌐 访问地址:'
echo '  - API: http://110.42.47.180:3000'
echo '  - 健康检查: http://110.42.47.180:3000/health'
ENDSSH

echo ""
echo -e "${GREEN}🎉 部署成功！${NC}"
echo ""
echo -e "${CYAN}📝 下一步:${NC}"
echo -e "${NC}  1. 修改服务器上的 .env 文件配置${NC}"
echo -e "${NC}  2. 重启应用: ssh $SERVER_USER@$SERVER_IP 'cd $SERVER_PATH && pm2 restart lovelyres-api'${NC}"
echo -e "${NC}  3. 查看日志: ssh $SERVER_USER@$SERVER_IP 'pm2 logs lovelyres-api'${NC}"
echo ""

