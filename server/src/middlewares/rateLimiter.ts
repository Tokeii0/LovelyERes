import rateLimit from 'express-rate-limit';
import { config } from '../config';

/**
 * 通用速率限制器
 */
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    code: 429,
    message: '请求过于频繁，请稍后再试',
    error: 'TOO_MANY_REQUESTS',
    timestamp: Date.now(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * 认证接口速率限制器（更严格）
 */
export const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  message: {
    code: 429,
    message: '登录尝试次数过多，请稍后再试',
    error: 'TOO_MANY_AUTH_ATTEMPTS',
    timestamp: Date.now(),
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // 成功的请求不计入限制
});

/**
 * 授权验证速率限制器（较宽松）
 */
export const licenseLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: 100,
  message: {
    code: 429,
    message: '授权验证请求过于频繁',
    error: 'TOO_MANY_LICENSE_REQUESTS',
    timestamp: Date.now(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

