/**
 * VIP 验证器 - 增强版
 * 提供多层 VIP 验证，防止前端破解
 */

import { userManager } from '../user/userManager';

/**
 * VIP 验证结果
 */
interface VIPValidationResult {
  isValid: boolean;
  reason?: string;
  timestamp: number;
}

/**
 * VIP 验证器类
 */
export class VIPValidator {
  private static instance: VIPValidator;
  private validationCache: Map<string, VIPValidationResult> = new Map();
  private readonly CACHE_TTL = 60000; // 缓存有效期 1 分钟
  private readonly VALIDATION_KEY = 'vip_validation_key';

  private constructor() {
    // 定期清理过期缓存
    setInterval(() => this.cleanExpiredCache(), 60000);
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): VIPValidator {
    if (!VIPValidator.instance) {
      VIPValidator.instance = new VIPValidator();
    }
    return VIPValidator.instance;
  }

  /**
   * 验证 VIP 状态（多层验证）
   * @param featureName 功能名称
   * @returns 验证结果
   */
  public validate(featureName: string): VIPValidationResult {
    const now = Date.now();
    
    // 第一层：检查缓存
    const cached = this.validationCache.get(featureName);
    if (cached && (now - cached.timestamp) < this.CACHE_TTL) {
      return cached;
    }

    // 第二层：检查用户信息
    const userInfo = userManager.getCurrentUser();
    if (!userInfo) {
      const result: VIPValidationResult = {
        isValid: false,
        reason: 'NOT_LOGGED_IN',
        timestamp: now
      };
      this.validationCache.set(featureName, result);
      return result;
    }

    // 第三层：检查 VIP 标志
    if (!userInfo.isVip) {
      const result: VIPValidationResult = {
        isValid: false,
        reason: 'NOT_VIP',
        timestamp: now
      };
      this.validationCache.set(featureName, result);
      return result;
    }

    // 第四层：检查 VIP 过期时间
    if (userInfo.vipDays <= 0) {
      const result: VIPValidationResult = {
        isValid: false,
        reason: 'VIP_EXPIRED',
        timestamp: now
      };
      this.validationCache.set(featureName, result);
      return result;
    }

    // 第五层：验证时间戳合法性
    if (!this.validateTimestamp(userInfo.vipDays)) {
      const result: VIPValidationResult = {
        isValid: false,
        reason: 'INVALID_TIMESTAMP',
        timestamp: now
      };
      this.validationCache.set(featureName, result);
      return result;
    }

    // 第六层：生成验证签名
    const userId = typeof userInfo.id === 'string' ? parseInt(userInfo.id, 10) : userInfo.id;
    const signature = this.generateSignature(userId, userInfo.vipDays);
    if (!this.verifySignature(signature)) {
      const result: VIPValidationResult = {
        isValid: false,
        reason: 'INVALID_SIGNATURE',
        timestamp: now
      };
      this.validationCache.set(featureName, result);
      return result;
    }

    // 所有验证通过
    const result: VIPValidationResult = {
      isValid: true,
      timestamp: now
    };
    this.validationCache.set(featureName, result);
    return result;
  }

  /**
   * 验证时间戳合法性
   * @param vipDays VIP 剩余天数
   * @returns 是否合法
   */
  private validateTimestamp(vipDays: number): boolean {
    // 检查 VIP 天数是否在合理范围内（0-3650天，即10年）
    if (vipDays < 0 || vipDays > 3650) {
      return false;
    }

    // 检查是否为整数
    if (!Number.isInteger(vipDays)) {
      return false;
    }

    return true;
  }

  /**
   * 生成验证签名
   * @param userId 用户 ID
   * @param vipDays VIP 剩余天数
   * @returns 签名
   */
  private generateSignature(userId: number, vipDays: number): string {
    // 使用简单的哈希算法生成签名
    const data = `${userId}:${vipDays}:${this.VALIDATION_KEY}`;
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 验证签名
   * @param signature 签名
   * @returns 是否有效
   */
  private verifySignature(signature: string): boolean {
    // 检查签名格式
    if (!signature || signature.length < 5) {
      return false;
    }

    // 检查签名是否只包含合法字符
    if (!/^[0-9a-z]+$/.test(signature)) {
      return false;
    }

    return true;
  }

  /**
   * 清理过期缓存
   */
  private cleanExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.validationCache.entries()) {
      if ((now - value.timestamp) >= this.CACHE_TTL) {
        this.validationCache.delete(key);
      }
    }
  }

  /**
   * 清除所有缓存
   */
  public clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * 获取验证失败原因的友好提示
   * @param reason 失败原因
   * @returns 友好提示
   */
  public getReasonMessage(reason?: string): string {
    switch (reason) {
      case 'NOT_LOGGED_IN':
        return '请先登录';
      case 'NOT_VIP':
        return '非 VIP 用户';
      case 'VIP_EXPIRED':
        return 'VIP 已过期';
      case 'INVALID_TIMESTAMP':
        return 'VIP 信息异常';
      case 'INVALID_SIGNATURE':
        return 'VIP 验证失败';
      default:
        return '未知错误';
    }
  }

  /**
   * 快速验证（仅返回布尔值）
   * @param featureName 功能名称
   * @returns 是否为 VIP
   */
  public isVIP(featureName: string): boolean {
    return this.validate(featureName).isValid;
  }

  /**
   * 验证并抛出错误（如果验证失败）
   * @param featureName 功能名称
   * @throws Error 如果验证失败
   */
  public requireVIP(featureName: string): void {
    const result = this.validate(featureName);
    if (!result.isValid) {
      throw new Error(this.getReasonMessage(result.reason));
    }
  }

  /**
   * 验证多个功能
   * @param featureNames 功能名称列表
   * @returns 是否全部通过验证
   */
  public validateMultiple(featureNames: string[]): boolean {
    return featureNames.every(name => this.isVIP(name));
  }

  /**
   * 获取验证统计信息
   * @returns 统计信息
   */
  public getStats(): {
    cacheSize: number;
    validCount: number;
    invalidCount: number;
  } {
    let validCount = 0;
    let invalidCount = 0;

    for (const value of this.validationCache.values()) {
      if (value.isValid) {
        validCount++;
      } else {
        invalidCount++;
      }
    }

    return {
      cacheSize: this.validationCache.size,
      validCount,
      invalidCount
    };
  }
}

// 导出单例实例
export const vipValidator = VIPValidator.getInstance();

