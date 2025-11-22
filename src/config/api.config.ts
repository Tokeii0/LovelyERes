/**
 * API 配置
 * 
 * 根据环境自动选择 API 地址
 */

// 环境类型
type Environment = 'development' | 'production';

// API 配置接口
interface ApiConfig {
  baseURL: string;
  timeout: number;
}

// 获取当前环境
const getEnvironment = (): Environment => {
  // 在 Tauri 环境中，可以通过环境变量判断
  if (window.__TAURI__) {
    // 生产环境
    return 'production';
  }
  
  // 开发环境（浏览器）
  return 'development';
};

// 环境配置
const configs: Record<Environment, ApiConfig> = {
  development: {
    baseURL: 'http://localhost:3000/api/v1',
    timeout: 10000,
  },
  production: {
    baseURL: 'http://110.42.47.180:3000/api/v1',
    timeout: 10000,
  },
};

// 导出当前环境的配置
export const API_CONFIG = configs[getEnvironment()];

// 导出环境判断函数
export const isDevelopment = () => getEnvironment() === 'development';
export const isProduction = () => getEnvironment() === 'production';

// 打印当前配置（仅开发环境）
if (isDevelopment()) {
  console.log('🔧 API 配置:', API_CONFIG);
}

