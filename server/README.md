# LovelyRes API Server

基于 Node.js + Express + TypeScript + PostgreSQL 的 RESTful API 服务器。

## 技术栈

- **运行时**: Node.js 18+
- **框架**: Express.js
- **语言**: TypeScript
- **数据库**: PostgreSQL 15+
- **认证**: JWT (JSON Web Token)
- **密码加密**: bcrypt
- **其他**: CORS, Helmet, Rate Limiting

## 项目结构

```
server/
├── src/
│   ├── config/              # 配置文件
│   │   ├── database.ts      # 数据库连接配置
│   │   └── index.ts         # 应用配置
│   ├── controllers/         # 控制器（待创建）
│   ├── middlewares/         # 中间件
│   │   ├── auth.ts          # 认证中间件
│   │   ├── rateLimiter.ts   # 速率限制
│   │   └── errorHandler.ts  # 错误处理
│   ├── models/              # 数据模型
│   │   └── User.ts          # 用户模型
│   ├── routes/              # 路由（待创建）
│   ├── services/            # 业务逻辑（待创建）
│   ├── utils/               # 工具函数
│   │   ├── jwt.ts           # JWT 工具
│   │   ├── password.ts      # 密码加密
│   │   ├── response.ts      # 响应格式化
│   │   └── license.ts       # 授权密钥生成
│   └── app.ts               # 应用入口
├── .env                     # 环境变量
├── .env.example             # 环境变量示例
├── package.json             # 依赖配置
├── tsconfig.json            # TypeScript 配置
└── README.md                # 本文件
```

## 快速开始

### 1. 安装依赖

```bash
cd server
npm install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并修改配置：

```bash
cp .env.example .env
```

主要配置项：
- `DB_HOST`: 数据库主机（已配置：110.42.47.180）
- `DB_PORT`: 数据库端口（已配置：5432）
- `DB_NAME`: 数据库名称（已配置：lovelyres）
- `DB_USER`: 数据库用户（已配置：lovelyres）
- `DB_PASSWORD`: 数据库密码（已配置）
- `JWT_SECRET`: JWT 密钥（生产环境请修改）
- `PORT`: 服务器端口（默认：3000）

### 3. 初始化数据库

确保数据库已创建并执行初始化脚本：

```bash
# 在项目根目录执行
psql -h 110.42.47.180 -p 5432 -U lovelyres -d lovelyres -f doc/init-database.sql
```

### 4. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

### 5. 构建生产版本

```bash
npm run build
npm start
```

## API 文档

详细的 API 文档请参考：
- [完整 API 文档](../doc/api-documentation.md)
- [API 快速参考](../doc/api-quick-reference.md)

### API 基础 URL

```
http://localhost:3000/api/v1
```

### 主要接口

#### 认证相关
- `POST /api/v1/auth/register` - 用户注册
- `POST /api/v1/auth/login` - 用户登录
- `POST /api/v1/auth/refresh` - 刷新 Token
- `POST /api/v1/auth/logout` - 用户登出

#### 用户信息
- `GET /api/v1/users/me` - 获取当前用户信息
- `PATCH /api/v1/users/me` - 更新用户信息
- `POST /api/v1/users/me/password` - 修改密码

#### 设备管理
- `GET /api/v1/devices` - 获取设备列表
- `POST /api/v1/devices` - 绑定设备
- `GET /api/v1/devices/{id}` - 获取设备详情
- `DELETE /api/v1/devices/{id}` - 解绑设备
- `POST /api/v1/devices/rebind` - 换绑设备

#### 离线授权
- `POST /api/v1/licenses/generate` - 生成离线授权
- `POST /api/v1/licenses/update` - 更新离线授权
- `POST /api/v1/licenses/verify` - 验证离线授权
- `GET /api/v1/licenses/history` - 获取授权历史

## 开发指南

### 添加新的 API 接口

1. 在 `src/models/` 创建数据模型
2. 在 `src/services/` 创建业务逻辑
3. 在 `src/controllers/` 创建控制器
4. 在 `src/routes/` 创建路由
5. 在 `src/app.ts` 注册路由

### 代码规范

```bash
# 代码检查
npm run lint

# 代码格式化
npm run format
```

### 测试

```bash
npm test
```

## 环境变量说明

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| NODE_ENV | 运行环境 | development |
| PORT | 服务器端口 | 3000 |
| DB_HOST | 数据库主机 | localhost |
| DB_PORT | 数据库端口 | 5432 |
| DB_NAME | 数据库名称 | lovelyres |
| DB_USER | 数据库用户 | postgres |
| DB_PASSWORD | 数据库密码 | - |
| JWT_SECRET | JWT 密钥 | - |
| JWT_EXPIRES_IN | JWT 过期时间 | 1h |
| CORS_ORIGIN | CORS 允许的源 | http://localhost:1420 |

## 安全建议

1. **生产环境**：
   - 修改 `JWT_SECRET` 和 `JWT_REFRESH_SECRET` 为强密码
   - 使用 HTTPS
   - 配置防火墙规则
   - 定期更新依赖

2. **数据库**：
   - 使用强密码
   - 限制数据库访问 IP
   - 定期备份数据

3. **API**：
   - 启用速率限制
   - 验证所有输入
   - 记录敏感操作日志

## 故障排查

### 数据库连接失败

```bash
# 检查数据库是否可访问
psql -h 110.42.47.180 -p 5432 -U lovelyres -d lovelyres

# 检查环境变量
cat .env
```

### 端口被占用

```bash
# 修改 .env 中的 PORT 变量
PORT=3001
```

## 下一步开发

- [ ] 完成所有 API 控制器
- [ ] 添加单元测试
- [ ] 添加集成测试
- [ ] 实现日志系统
- [ ] 添加 API 文档（Swagger）
- [ ] 实现邮件发送功能
- [ ] 添加数据库迁移工具

## 部署指南

### 服务器信息
- **IP 地址**: 110.42.47.180
- **端口**: 3000
- **API 前缀**: `/api/v1`

### 快速部署

#### 方法 1: 自动部署脚本（推荐）

```bash
# 上传代码到服务器
scp -r . root@110.42.47.180:/var/www/LovelyRes/server/

# 在服务器上运行部署脚本
cd /var/www/LovelyRes/server
chmod +x scripts/deploy.sh
sudo ./scripts/deploy.sh
```

#### 方法 2: 手动部署

详细步骤请参考：
- [完整部署指南](../doc/deployment-guide.md)
- [快速部署指南](../doc/quick-deployment.md)
- [部署检查清单](../doc/deployment-checklist.md)

### 生产环境配置

1. **生成 RSA 密钥对**
   ```bash
   mkdir -p keys
   openssl genrsa -out keys/private.pem 2048
   openssl rsa -in keys/private.pem -pubout -out keys/public.pem
   chmod 600 keys/private.pem
   chmod 644 keys/public.pem
   ```

2. **配置环境变量**
   ```bash
   cp .env.production .env
   # 编辑 .env 文件，修改数据库密码、JWT 密钥等
   ```

3. **使用 PM2 启动**
   ```bash
   npm install --production
   npm run build
   pm2 start ecosystem.config.js --env production
   pm2 save
   pm2 startup
   ```

### 客户端配置

修改客户端 API 配置：

**文件**: `src/config/api.config.ts`

```typescript
production: {
  baseURL: 'http://110.42.47.180:3000/api/v1',
  timeout: 10000,
}
```

---

## 相关文档

### 数据库
- [数据库设计文档](../doc/database-design.md)
- [数据库安装指南](../doc/database-setup-guide.md)
- [数据库 ER 图](../doc/database-er-diagram.md)

### API
- [API 完整文档](../doc/api-documentation.md)
- [API 快速参考](../doc/api-quick-reference.md)
- [加密 API 文档](../doc/encryption-api.md)

### 部署
- [完整部署指南](../doc/deployment-guide.md)
- [快速部署指南](../doc/quick-deployment.md)
- [部署检查清单](../doc/deployment-checklist.md)

### 加密
- [加密方案设计](../doc/encryption-design.md)
- [加密实现指南](../doc/encryption-implementation-guide.md)

---

## 技术支持

如有问题，请联系：
- 邮箱：support@lovelyres.com
- GitHub Issues：https://github.com/lovelyres/lovelyres/issues

---

## 许可证

MIT License

