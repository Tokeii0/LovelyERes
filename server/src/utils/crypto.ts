/**
 * 加密工具模块
 * 提供 RSA 和 AES 加密/解密功能
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

// 加载 RSA 密钥
let PRIVATE_KEY: string;
let PUBLIC_KEY: string;

try {
  PRIVATE_KEY = fs.readFileSync(
    path.join(__dirname, '../../keys/private.pem'),
    'utf8'
  );
  
  PUBLIC_KEY = fs.readFileSync(
    path.join(__dirname, '../../keys/public.pem'),
    'utf8'
  );
  
  console.log('✅ RSA 密钥加载成功');
} catch (error) {
  console.error('❌ 无法加载 RSA 密钥:', error);
  console.error('请确保已生成密钥文件: server/keys/private.pem 和 server/keys/public.pem');
  process.exit(1);
}

/**
 * 使用私钥解密 AES 密钥
 */
export function decryptAESKey(encryptedKey: string): Buffer {
  try {
    const encryptedBuffer = Buffer.from(encryptedKey, 'base64');
    
    const decrypted = crypto.privateDecrypt(
      {
        key: PRIVATE_KEY,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256'
      },
      encryptedBuffer
    );
    
    return decrypted;
  } catch (error) {
    console.error('❌ 解密 AES 密钥失败:', error);
    throw new Error('解密 AES 密钥失败');
  }
}

/**
 * 使用 AES 解密数据
 */
export function decryptData(encryptedData: string, aesKey: Buffer): string {
  try {
    // Base64 解码
    const combined = Buffer.from(encryptedData, 'base64');
    
    // 提取 IV（前 16 字节）和密文
    const iv = combined.slice(0, 16);
    const encrypted = combined.slice(16);
    
    // 解密
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  } catch (error) {
    console.error('❌ AES 解密失败:', error);
    throw new Error('AES 解密失败');
  }
}

/**
 * 使用 AES 加密数据
 */
export function encryptData(data: string, aesKey: Buffer): string {
  try {
    // 生成随机 IV
    const iv = crypto.randomBytes(16);
    
    // 加密
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    let encrypted = cipher.update(data, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    // 组合 IV 和密文
    const combined = Buffer.concat([iv, encrypted]);
    
    // Base64 编码
    return combined.toString('base64');
  } catch (error) {
    console.error('❌ AES 加密失败:', error);
    throw new Error('AES 加密失败');
  }
}

/**
 * 使用私钥签名数据
 */
export function signData(data: string | Buffer): string {
  try {
    const dataBuffer = typeof data === 'string' ? Buffer.from(data) : data;
    
    const signature = crypto.sign('sha256', dataBuffer, {
      key: PRIVATE_KEY,
      padding: crypto.constants.RSA_PKCS1_PSS_PADDING
    });
    
    return signature.toString('base64');
  } catch (error) {
    console.error('❌ 签名失败:', error);
    throw new Error('签名失败');
  }
}

/**
 * 获取公钥
 */
export function getPublicKey(): string {
  return PUBLIC_KEY;
}

