/**
 * 加密 API 路由
 * 提供公钥获取和密钥交换功能
 */

import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { getPublicKey, decryptAESKey, signData } from '../utils/crypto';
import { sessionManager } from '../utils/sessionManager';

const router = express.Router();

/**
 * 获取服务端公钥
 * GET /api/v1/crypto/public-key
 */
router.get('/public-key', async (req: Request, res: Response): Promise<void> => {
  try {
    const publicKey = getPublicKey();
    
    console.log('📤 返回公钥');
    
    res.json({
      code: 200,
      message: 'success',
      data: {
        publicKey,
        algorithm: 'RSA-OAEP',
        keySize: 2048,
        expiresAt: null
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ 获取公钥失败:', error);
    res.status(500).json({
      code: 500,
      message: '无法读取公钥',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: Date.now()
    });
  }
});

/**
 * 交换 AES 密钥
 * POST /api/v1/crypto/exchange-key
 */
router.post('/exchange-key', async (req: Request, res: Response): Promise<void> => {
  try {
    const { encryptedKey, clientId } = req.body;
    
    if (!encryptedKey) {
      console.warn('⚠️ 缺少加密密钥');
      res.status(400).json({
        code: 400,
        message: '缺少加密密钥',
        error: 'MISSING_ENCRYPTED_KEY',
        timestamp: Date.now()
      });
      return;
    }
    
    // 解密 AES 密钥
    const aesKey = decryptAESKey(encryptedKey);
    
    // 验证 AES 密钥长度
    if (aesKey.length !== 32) {
      console.warn(`⚠️ AES 密钥长度无效: ${aesKey.length} bytes (期望 32 bytes)`);
      res.status(400).json({
        code: 400,
        message: 'AES 密钥长度无效',
        error: 'INVALID_KEY_LENGTH',
        timestamp: Date.now()
      });
      return;
    }
    
    // 生成会话 ID
    const sessionId = crypto.randomUUID();
    
    // 保存会话
    sessionManager.createSession(sessionId, aesKey);
    
    // 生成签名
    const signature = signData('OK');
    
    console.log(`✅ 密钥交换成功: ${sessionId}${clientId ? ` (客户端: ${clientId})` : ''}`);
    
    res.json({
      code: 200,
      message: 'success',
      data: {
        status: 'OK',
        sessionId,
        signature
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ 密钥交换失败:', error);
    res.status(500).json({
      code: 500,
      message: '解密 AES 密钥失败',
      error: 'DECRYPTION_FAILED',
      timestamp: Date.now()
    });
  }
});

/**
 * 获取会话统计信息（调试用）
 * GET /api/v1/crypto/stats
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = sessionManager.getStats();
    
    res.json({
      code: 200,
      message: 'success',
      data: stats,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ 获取统计信息失败:', error);
    res.status(500).json({
      code: 500,
      message: '获取统计信息失败',
      error: 'INTERNAL_SERVER_ERROR',
      timestamp: Date.now()
    });
  }
});

export default router;

