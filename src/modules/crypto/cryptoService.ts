/**
 * 加密服务
 * 负责客户端的加密/解密操作
 */

// 扩展 Window 接口
declare global {
  interface Window {
    __TAURI__?: {
      core: {
        invoke: (cmd: string, args?: any) => Promise<any>;
      };
    };
  }
}

class CryptoService {
  private static instance: CryptoService;
  private aesKey: CryptoKey | null = null;
  private sessionId: string | null = null;
  private serverPublicKey: CryptoKey | null = null;
  private initialized: boolean = false;

  private constructor() {}

  public static getInstance(): CryptoService {
    if (!CryptoService.instance) {
      CryptoService.instance = new CryptoService();
    }
    return CryptoService.instance;
  }

  /**
   * 初始化加密（获取公钥并交换 AES 密钥）
   */
  public async initialize(baseURL: string): Promise<void> {
    if (this.initialized) {
      console.log('🔐 加密服务已初始化');
      return;
    }

    try {
      console.log('🔐 开始初始化加密服务...');
      
      // 1. 获取服务端公钥
      await this.fetchServerPublicKey(baseURL);
      
      // 2. 生成 AES 密钥
      await this.generateAESKey();
      
      // 3. 交换密钥
      await this.exchangeKey(baseURL);
      
      this.initialized = true;
      console.log('✅ 加密服务初始化成功');
    } catch (error) {
      console.error('❌ 加密服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 获取服务端公钥
   * 从 Rust 后端获取硬编码的公钥（已混淆）
   */
  private async fetchServerPublicKey(baseURL: string): Promise<void> {
    let publicKeyPem: string;

    // 检测是否在 Tauri 环境中
    if (window.__TAURI__) {
      try {
        // 从 Rust 后端获取公钥（硬编码，已混淆）
        publicKeyPem = await window.__TAURI__.core.invoke('get_rsa_public_key') as string;
        console.log('📥 获取服务端公钥成功（来自 Rust 后端，已解混淆）');
      } catch (error) {
        console.error('❌ 从 Rust 后端获取公钥失败:', error);
        // 降级到服务器
        const response = await fetch(`${baseURL}/crypto/public-key`);
        const data = await response.json();

        if (data.code !== 200) {
          throw new Error(data.message);
        }

        publicKeyPem = data.data.publicKey;
        console.log('📥 获取服务端公钥成功（来自服务器，降级）');
      }
    } else {
      // 浏览器环境，从服务器获取公钥
      const response = await fetch(`${baseURL}/crypto/public-key`);
      const data = await response.json();

      if (data.code !== 200) {
        throw new Error(data.message);
      }

      publicKeyPem = data.data.publicKey;
      console.log('📥 获取服务端公钥成功（来自服务器）');
    }

    // 导入公钥
    const publicKeyDer = this.pemToDer(publicKeyPem);

    this.serverPublicKey = await window.crypto.subtle.importKey(
      'spki',
      publicKeyDer,
      {
        name: 'RSA-OAEP',
        hash: 'SHA-256'
      },
      false,
      ['encrypt']
    );
  }

  /**
   * 生成 AES-256 密钥
   */
  private async generateAESKey(): Promise<void> {
    this.aesKey = await window.crypto.subtle.generateKey(
      {
        name: 'AES-CBC',
        length: 256
      },
      true,
      ['encrypt', 'decrypt']
    );
    
    console.log('🔑 生成 AES-256 密钥成功');
  }

  /**
   * 交换 AES 密钥
   */
  private async exchangeKey(baseURL: string): Promise<void> {
    if (!this.aesKey || !this.serverPublicKey) {
      throw new Error('密钥未初始化');
    }
    
    // 导出 AES 密钥为原始格式
    const aesKeyRaw = await window.crypto.subtle.exportKey('raw', this.aesKey);
    
    // 使用服务端公钥加密 AES 密钥
    const encryptedKey = await window.crypto.subtle.encrypt(
      {
        name: 'RSA-OAEP'
      },
      this.serverPublicKey,
      aesKeyRaw
    );
    
    // Base64 编码
    const encryptedKeyBase64 = this.arrayBufferToBase64(encryptedKey);
    
    // 发送到服务端
    const response = await fetch(`${baseURL}/crypto/exchange-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        encryptedKey: encryptedKeyBase64
      })
    });
    
    const data = await response.json();
    
    if (data.code !== 200) {
      throw new Error(data.message);
    }
    
    // 保存会话 ID
    this.sessionId = data.data.sessionId;
    
    console.log(`🔄 密钥交换成功，会话 ID: ${this.sessionId}`);
    
    // TODO: 验证签名
    // const verified = await this.verifySignature('OK', data.data.signature);
    // if (!verified) {
    //   throw new Error('签名验证失败');
    // }
  }

  /**
   * 加密数据
   */
  public async encryptData(data: any): Promise<string> {
    if (!this.aesKey) {
      throw new Error('AES 密钥未初始化');
    }
    
    // 序列化数据
    const json = JSON.stringify(data);
    const jsonBuffer = new TextEncoder().encode(json);
    
    // 生成随机 IV
    const iv = window.crypto.getRandomValues(new Uint8Array(16));
    
    // 加密
    const encrypted = await window.crypto.subtle.encrypt(
      {
        name: 'AES-CBC',
        iv
      },
      this.aesKey,
      jsonBuffer
    );
    
    // 组合 IV 和密文
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Base64 编码
    return this.arrayBufferToBase64(combined.buffer);
  }

  /**
   * 解密数据
   */
  public async decryptData(encryptedData: string): Promise<any> {
    if (!this.aesKey) {
      throw new Error('AES 密钥未初始化');
    }
    
    // Base64 解码
    const combined = this.base64ToArrayBuffer(encryptedData);
    
    // 提取 IV 和密文
    const iv = combined.slice(0, 16);
    const encrypted = combined.slice(16);
    
    // 解密
    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: 'AES-CBC',
        iv
      },
      this.aesKey,
      encrypted
    );
    
    // 解析 JSON
    const json = new TextDecoder().decode(decrypted);
    return JSON.parse(json);
  }

  /**
   * 获取会话 ID
   */
  public getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * 检查是否已初始化
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 重置加密服务
   */
  public reset(): void {
    this.aesKey = null;
    this.sessionId = null;
    this.serverPublicKey = null;
    this.initialized = false;
    console.log('🔄 加密服务已重置');
  }

  /**
   * PEM 转 DER
   */
  private pemToDer(pem: string): ArrayBuffer {
    const b64 = pem
      .replace(/-----BEGIN PUBLIC KEY-----/, '')
      .replace(/-----END PUBLIC KEY-----/, '')
      .replace(/\s/g, '');
    
    return this.base64ToArrayBuffer(b64);
  }

  /**
   * ArrayBuffer 转 Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Base64 转 ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const cryptoService = CryptoService.getInstance();

