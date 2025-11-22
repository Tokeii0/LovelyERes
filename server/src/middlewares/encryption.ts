/**
 * 加密中间件
 * 处理请求解密和响应加密
 */

import { Request, Response, NextFunction } from 'express';
import { decryptData, encryptData, signData } from '../utils/crypto';
import { sessionManager } from '../utils/sessionManager';

// 扩展 Request 类型以包含 aesKey
declare global {
  namespace Express {
    interface Request {
      aesKey?: Buffer;
    }
  }
}

/**
 * 请求解密中间件
 */
export function decryptRequest(req: Request, res: Response, next: NextFunction): void {
  try {
    // 获取会话 ID
    const sessionId = req.headers['x-session-id'] as string;
    
    if (!sessionId) {
      console.warn('⚠️ 请求缺少会话 ID');
      res.status(400).json({
        code: 400,
        message: '缺少会话 ID',
        error: 'MISSING_SESSION_ID',
        timestamp: Date.now()
      });
      return;
    }
    
    // 获取 AES 密钥
    const aesKey = sessionManager.getAESKey(sessionId);
    
    if (!aesKey) {
      console.warn(`⚠️ 会话无效或已过期: ${sessionId}`);
      res.status(401).json({
        code: 401,
        message: '会话已过期或无效',
        error: 'INVALID_SESSION',
        timestamp: Date.now()
      });
      return;
    }
    
    // 获取加密数据
    const { encrypted, nonce, timestamp } = req.body || {};

    // GET 请求通常没有 body，不需要解密
    if (!encrypted) {
      // 如果是 GET 请求，直接通过
      if (req.method === 'GET') {
        req.aesKey = aesKey;
        next();
        return;
      }

      // 其他请求必须有加密数据
      console.warn('⚠️ 请求缺少加密数据');
      res.status(400).json({
        code: 400,
        message: '缺少加密数据',
        error: 'MISSING_ENCRYPTED_DATA',
        timestamp: Date.now()
      });
      return;
    }
    
    // 验证时间戳（防重放攻击）
    if (timestamp) {
      const now = Date.now();
      const diff = Math.abs(now - timestamp);
      
      if (diff > 5 * 60 * 1000) { // 5 分钟
        console.warn(`⚠️ 请求时间戳过期: ${diff}ms`);
        res.status(400).json({
          code: 400,
          message: '请求已过期',
          error: 'REQUEST_EXPIRED',
          timestamp: Date.now()
        });
        return;
      }
    }
    
    // 解密数据
    const decrypted = decryptData(encrypted, aesKey);
    const data = JSON.parse(decrypted);
    
    console.log(`🔓 请求解密成功: ${req.method} ${req.path}`);
    
    // 将解密后的数据放入 req.body
    req.body = data;
    
    // 保存 AES 密钥到 req 对象，供响应加密使用
    req.aesKey = aesKey;
    
    next();
  } catch (error) {
    console.error('❌ 解密请求失败:', error);
    res.status(400).json({
      code: 400,
      message: '解密失败',
      error: 'DECRYPTION_FAILED',
      timestamp: Date.now()
    });
  }
}

/**
 * 响应加密中间件
 */
export function encryptResponse(req: Request, res: Response, next: NextFunction): void {
  // 保存原始的 json 方法
  const originalJson = res.json.bind(res);
  
  // 重写 json 方法
  res.json = function (data: any) {
    try {
      // 获取 AES 密钥
      const aesKey = req.aesKey;
      
      if (!aesKey) {
        // 如果没有 AES 密钥，直接返回原始数据（用于未加密的路由）
        console.log(`📤 响应未加密: ${req.method} ${req.path}`);
        return originalJson(data);
      }
      
      // 序列化数据
      const json = JSON.stringify(data);
      
      // 加密数据
      const encrypted = encryptData(json, aesKey);
      
      // 生成签名
      const signature = signData(encrypted);
      
      console.log(`🔒 响应加密成功: ${req.method} ${req.path}`);
      
      // 返回加密数据
      return originalJson({
        encrypted,
        signature,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('❌ 加密响应失败:', error);
      return originalJson({
        code: 500,
        message: '加密失败',
        error: 'ENCRYPTION_FAILED',
        timestamp: Date.now()
      });
    }
  };
  
  next();
}

