import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000'),
  apiVersion: process.env.API_VERSION || 'v1',

  // Database
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    name: process.env.DB_NAME || 'lovelyres',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '20'),
    idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
  },

  // JWT
  jwt: {
    secret: (process.env.JWT_SECRET || 'your-secret-key') as string,
    expiresIn: (process.env.JWT_EXPIRES_IN || '1h') as string,
    refreshSecret: (process.env.JWT_REFRESH_SECRET || 'your-refresh-secret') as string,
    refreshExpiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as string,
  },

  // CORS
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || [
      'http://localhost:1420',  // Tauri 默认端口
      'http://localhost:5173',  // Vite 默认端口
      'http://localhost:5174',  // Vite 备用端口
      'http://localhost:3000',  // 开发端口
    ],
    credentials: true,
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '60'),
    authMax: parseInt(process.env.RATE_LIMIT_AUTH_MAX || '5'),
  },

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

export default config;

