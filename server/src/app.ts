import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { config } from './config';
import { testConnection } from './config/database';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { generalLimiter } from './middlewares/rateLimiter';

// 导入路由
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import deviceRoutes from './routes/devices';
import cryptoRoutes from './routes/crypto';
// import licenseRoutes from './routes/license';
// import historyRoutes from './routes/history';

// 导入加密中间件
import { decryptRequest, encryptResponse } from './middlewares/encryption';

dotenv.config();

const app: Application = express();

// 中间件 - CORS 必须在其他中间件之前
app.use(cors({
  origin: true, // 开发环境允许所有来源
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'], // 添加 X-Session-Id
  exposedHeaders: ['Authorization'],
  maxAge: 86400, // 24小时
})); // CORS
app.use(helmet()); // 安全头
app.use(morgan('dev')); // 日志
app.use(express.json()); // JSON 解析
app.use(express.urlencoded({ extended: true })); // URL 编码解析

// 应用速率限制
app.use(generalLimiter);

// 健康检查
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API 路由
const apiPrefix = `/api/${config.apiVersion}`;

// 加密路由（不需要加密中间件）
app.use(`${apiPrefix}/crypto`, cryptoRoutes);

// 所有其他路由（需要请求解密和响应加密）
app.use(`${apiPrefix}/auth`, encryptResponse, decryptRequest, authRoutes);
app.use(`${apiPrefix}/users`, encryptResponse, decryptRequest, userRoutes);
app.use(`${apiPrefix}/devices`, encryptResponse, decryptRequest, deviceRoutes);
// app.use(`${apiPrefix}/licenses`, encryptResponse, decryptRequest, licenseRoutes);
// app.use(`${apiPrefix}/history`, encryptResponse, decryptRequest, historyRoutes);

// 404 处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

// 启动服务器
const PORT = config.port;

const startServer = async () => {
  try {
    // 测试数据库连接
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('❌ Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // 启动服务器
    app.listen(PORT, () => {
      console.log('');
      console.log('🚀 LovelyRes API Server');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📡 Server running on: http://localhost:${PORT}`);
      console.log(`🌐 API Base URL: http://localhost:${PORT}${apiPrefix}`);
      console.log(`🔧 Environment: ${config.nodeEnv}`);
      console.log(`💾 Database: ${config.database.name}@${config.database.host}`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('');
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

startServer();

export default app;

