# 部署指南

LovelyRes API Server 提供两种部署方式：

---

## 🚀 方式 1: 本地构建 + 服务器部署（推荐）⭐

在本地构建项目，然后上传到服务器。

### 优势
- ✅ 更快的部署速度
- ✅ 减少服务器资源消耗
- ✅ 可以在本地测试构建结果
- ✅ 更小的上传体积

### 快速开始

#### Windows 用户

```powershell
cd server
.\scripts\build-and-deploy.ps1
```

或者使用 npm 命令：

```powershell
npm run deploy:win
```

---

#### Linux/Mac 用户

```bash
cd server
chmod +x scripts/build-and-deploy.sh
./scripts/build-and-deploy.sh
```

或者使用 npm 命令：

```bash
npm run deploy:unix
```

---

### 详细文档

参见 [本地构建部署指南](../doc/local-build-deployment.md)

---

## 🔧 方式 2: 服务器端构建

在服务器上直接构建项目。

### 快速开始

```bash
# 上传代码到服务器
scp -r . root@110.42.47.180:/var/www/LovelyRes/server/

# 在服务器上运行部署脚本
ssh root@110.42.47.180
cd /var/www/LovelyRes/server
chmod +x scripts/deploy.sh
sudo ./scripts/deploy.sh
```

---

### 详细文档

参见以下文档：
- [完整部署指南](../doc/deployment-guide.md)
- [快速部署指南](../doc/quick-deployment.md)
- [部署检查清单](../doc/deployment-checklist.md)

---

## 📊 部署方式对比

| 特性 | 本地构建 | 服务器构建 |
|------|---------|-----------|
| 部署速度 | ⭐⭐⭐⭐⭐ 快 | ⭐⭐⭐ 中等 |
| 服务器资源 | ⭐⭐⭐⭐⭐ 低 | ⭐⭐⭐ 中等 |
| 上传体积 | ⭐⭐⭐⭐⭐ 小 | ⭐⭐ 大 |
| 本地测试 | ✅ 支持 | ❌ 不支持 |
| 服务器依赖 | 只需生产依赖 | 需要开发依赖 |
| 适用场景 | 日常更新 | 首次部署 |

---

## 🌐 服务器信息

- **IP 地址**: 110.42.47.180
- **端口**: 3000
- **API 前缀**: `/api/v1`
- **访问地址**: http://110.42.47.180:3000

---

## 📝 部署后配置

### 1. 修改环境变量

```bash
ssh root@110.42.47.180
cd /var/www/LovelyRes/server
nano .env
```

**必须修改的配置**:
- `DB_PASSWORD` - 数据库密码
- `JWT_SECRET` - JWT 密钥
- `JWT_REFRESH_SECRET` - JWT 刷新密钥
- `CORS_ORIGIN` - CORS 允许的来源

---

### 2. 重启应用

```bash
ssh root@110.42.47.180 'pm2 restart lovelyres-api'
```

---

### 3. 查看日志

```bash
ssh root@110.42.47.180 'pm2 logs lovelyres-api'
```

---

## 🧪 测试部署

### 健康检查

```bash
curl http://110.42.47.180:3000/health
```

预期响应：
```json
{
  "status": "ok",
  "timestamp": 1704902400000
}
```

---

### 测试 API

```bash
# 注册用户
curl -X POST http://110.42.47.180:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123"
  }'

# 登录
curl -X POST http://110.42.47.180:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

---

## 🔄 更新应用

### 本地构建方式

```bash
# Windows
.\scripts\build-and-deploy.ps1

# Linux/Mac
./scripts/build-and-deploy.sh
```

---

### 服务器构建方式

```bash
ssh root@110.42.47.180
cd /var/www/LovelyRes/server
git pull  # 如果使用 Git
npm install --production
npm run build
pm2 restart lovelyres-api
```

---

## 📚 相关文档

### 部署相关
- [本地构建部署指南](../doc/local-build-deployment.md) - 推荐阅读
- [完整部署指南](../doc/deployment-guide.md)
- [快速部署指南](../doc/quick-deployment.md)
- [部署检查清单](../doc/deployment-checklist.md)

### API 相关
- [API 完整文档](../doc/api-documentation.md)
- [API 快速参考](../doc/api-quick-reference.md)
- [加密 API 文档](../doc/encryption-api.md)

### 数据库相关
- [数据库设计文档](../doc/database-design.md)
- [数据库安装指南](../doc/database-setup-guide.md)

---

## ❓ 常见问题

### 1. 如何选择部署方式？

- **首次部署**: 推荐使用服务器构建方式（方式 2）
- **日常更新**: 推荐使用本地构建方式（方式 1）

---

### 2. 上传失败怎么办？

检查以下几点：
- SSH 连接是否正常
- 服务器用户权限是否正确
- 目标路径是否存在

---

### 3. 应用无法启动怎么办？

```bash
# 查看日志
ssh root@110.42.47.180 'pm2 logs lovelyres-api --lines 100'

# 检查配置
ssh root@110.42.47.180 'cat /var/www/LovelyRes/server/.env'
```

---

## 🆘 技术支持

如有问题，请参考：
- [故障排查文档](../doc/deployment-guide.md#故障排查)
- [GitHub Issues](https://github.com/lovelyres/lovelyres/issues)

---

**祝部署顺利！** 🎉

