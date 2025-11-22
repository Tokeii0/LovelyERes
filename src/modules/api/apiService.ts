/**
 * API 服务
 * 负责与后端 API 通信
 */

import { cryptoService } from '../crypto/cryptoService';
import { API_CONFIG } from '../../config/api.config';

// API 响应接口
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

// 用户信息接口（与后端对应）
export interface ApiUser {
  id: string;
  username: string;
  nickname?: string;
  email: string;
  qq_id?: string;
  is_vip: boolean;
  vip_expire_date?: string;
  vip_days: number; // 服务端计算的 VIP 剩余天数
  max_devices: number;
  device_rebind_count: number;
  max_rebind_count: number;
  status: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
}

// Token 信息接口
export interface TokenInfo {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// 登录响应
export interface LoginResponse {
  user: ApiUser;
  token: TokenInfo;
}

// 注册请求
export interface RegisterRequest {
  username: string;
  nickname?: string;
  email: string;
  password: string;
  qq_id?: string;
}

// 登录请求
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * API 服务类
 */
export class ApiService {
  private static instance: ApiService;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private encryptionInitialized: boolean = false;
  private encryptionInitPromise: Promise<void> | null = null;

  private constructor() {
    this.loadTokensFromStorage();
    this.encryptionInitPromise = this.initializeEncryption();
  }

  /**
   * 初始化加密服务
   */
  private async initializeEncryption(): Promise<void> {
    try {
      await cryptoService.initialize(API_CONFIG.baseURL);
      this.encryptionInitialized = true;
      console.log('✅ API 服务加密已启用');
    } catch (error) {
      console.error('❌ 加密服务初始化失败:', error);
      // 不阻止应用启动，但记录错误
    }
  }

  /**
   * 等待加密初始化完成
   */
  private async waitForEncryption(): Promise<void> {
    if (this.encryptionInitPromise) {
      await this.encryptionInitPromise;
    }
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): ApiService {
    if (!ApiService.instance) {
      ApiService.instance = new ApiService();
    }
    return ApiService.instance;
  }

  /**
   * 从本地存储加载 Token
   */
  private loadTokensFromStorage(): void {
    try {
      this.accessToken = localStorage.getItem('lovelyres-access-token');
      this.refreshToken = localStorage.getItem('lovelyres-refresh-token');
    } catch (error) {
      console.error('❌ 加载 Token 失败:', error);
    }
  }

  /**
   * 保存 Token 到本地存储
   */
  private saveTokensToStorage(accessToken: string, refreshToken: string): void {
    try {
      this.accessToken = accessToken;
      this.refreshToken = refreshToken;
      localStorage.setItem('lovelyres-access-token', accessToken);
      localStorage.setItem('lovelyres-refresh-token', refreshToken);
    } catch (error) {
      console.error('❌ 保存 Token 失败:', error);
    }
  }

  /**
   * 清除 Token
   */
  private clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
    localStorage.removeItem('lovelyres-access-token');
    localStorage.removeItem('lovelyres-refresh-token');
  }

  /**
   * 发送 HTTP 请求
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    // 等待加密初始化完成
    await this.waitForEncryption();

    const url = `${API_CONFIG.baseURL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // 如果有 access token，添加到请求头
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
      console.log('🔑 使用 Access Token:', this.accessToken.substring(0, 20) + '...');
    } else {
      console.warn('⚠️ 没有 Access Token');
    }

    // 判断是否需要加密（只有 /crypto/ 路由不加密）
    const needsEncryption = this.encryptionInitialized &&
                           !endpoint.includes('/crypto/');

    // 如果需要加密，添加会话 ID
    if (needsEncryption) {
      headers['X-Session-Id'] = cryptoService.getSessionId() || '';

      // 如果有请求体，加密请求体
      if (options.body) {
        try {
          const data = JSON.parse(options.body as string);
          const encrypted = await cryptoService.encryptData(data);
          options.body = JSON.stringify({
            encrypted,
            nonce: crypto.randomUUID(),
            timestamp: Date.now()
          });
          console.log('🔒 请求已加密');
        } catch (error) {
          console.error('❌ 加密请求失败:', error);
        }
      }
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      let data = await response.json();

      // 如果响应是加密的，解密
      if (data.encrypted && data.signature) {
        try {
          data = await cryptoService.decryptData(data.encrypted);
          console.log('🔓 响应已解密');
        } catch (error) {
          console.error('❌ 解密响应失败:', error);
        }
      }

      if (!response.ok) {
        // 如果是会话失效错误，重新初始化加密
        if (data.error === 'INVALID_SESSION') {
          console.log('🔄 会话失效，重新初始化加密...');
          cryptoService.reset();
          this.encryptionInitialized = false;
          this.encryptionInitPromise = this.initializeEncryption();
          await this.encryptionInitPromise;

          // 重试请求
          console.log('✅ 加密重新初始化成功，重试请求...');
          return this.request<T>(endpoint, options);
        }

        // 如果是 401 错误且不是登录/注册请求，尝试刷新 token
        if (response.status === 401 && !endpoint.includes('/auth/')) {
          console.log('🔄 Token 可能已过期，尝试刷新...');
          const refreshed = await this.tryRefreshToken();
          if (refreshed) {
            console.log('✅ Token 刷新成功，重试请求...');
            // 重新设置 Authorization header
            headers['Authorization'] = `Bearer ${this.accessToken}`;
            // 重试请求
            const retryResponse = await fetch(url, {
              ...options,
              headers,
            });
            let retryData = await retryResponse.json();

            // 如果重试响应也是加密的，解密
            if (retryData.encrypted && retryData.signature) {
              try {
                retryData = await cryptoService.decryptData(retryData.encrypted);
              } catch (error) {
                console.error('❌ 解密重试响应失败:', error);
              }
            }

            if (!retryResponse.ok) {
              throw new Error(retryData.message || `HTTP ${retryResponse.status}`);
            }
            return retryData;
          } else {
            console.error('❌ Token 刷新失败');
          }
        }
        throw new Error(data.message || `HTTP ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error('❌ API 请求失败:', error);
      throw error;
    }
  }

  /**
   * 尝试刷新 Token
   */
  private async tryRefreshToken(): Promise<boolean> {
    if (!this.refreshToken) {
      console.error('❌ 没有 Refresh Token');
      return false;
    }

    try {
      const response = await fetch(`${API_CONFIG.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: this.refreshToken,
        }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      if (data.data && data.data.token) {
        this.saveTokensToStorage(
          data.data.token.access_token,
          data.data.token.refresh_token
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ 刷新 Token 失败:', error);
      return false;
    }
  }

  /**
   * 用户注册
   */
  public async register(data: RegisterRequest): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // 保存 Token
    if (response.data.token) {
      this.saveTokensToStorage(
        response.data.token.access_token,
        response.data.token.refresh_token
      );
    }

    return response.data;
  }

  /**
   * 用户登录
   */
  public async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // 保存 Token
    if (response.data.token) {
      this.saveTokensToStorage(
        response.data.token.access_token,
        response.data.token.refresh_token
      );
    }

    return response.data;
  }

  /**
   * 用户登出
   */
  public async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('❌ 登出请求失败:', error);
    } finally {
      // 无论请求是否成功，都清除本地 Token
      this.clearTokens();
    }
  }

  /**
   * 刷新 Token
   */
  public async refreshAccessToken(): Promise<boolean> {
    if (!this.refreshToken) {
      return false;
    }

    try {
      const response = await this.request<{ token: TokenInfo }>('/auth/refresh', {
        method: 'POST',
        body: JSON.stringify({
          refresh_token: this.refreshToken,
        }),
      });

      if (response.data.token) {
        this.saveTokensToStorage(
          response.data.token.access_token,
          response.data.token.refresh_token
        );
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ 刷新 Token 失败:', error);
      this.clearTokens();
      return false;
    }
  }

  /**
   * 获取当前用户信息
   */
  public async getCurrentUser(): Promise<ApiUser> {
    const response = await this.request<ApiUser>('/users/me');
    return response.data;
  }

  /**
   * 更新用户信息
   */
  public async updateUserInfo(data: {
    nickname?: string;
    email?: string;
    qq_id?: string;
  }): Promise<ApiUser> {
    const response = await this.request<ApiUser>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return response.data;
  }

  /**
   * 修改密码
   */
  public async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.request('/users/me/password', {
      method: 'POST',
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword,
      }),
    });
  }

  /**
   * 获取设备列表
   */
  public async getDevices(): Promise<any[]> {
    const response = await this.request<{ devices: any[] }>('/devices');
    return response.data.devices;
  }

  /**
   * 绑定设备
   */
  public async bindDevice(data: {
    device_code: string;
    device_name?: string;
    device_type?: string;
    device_fingerprint?: any;
  }): Promise<any> {
    const response = await this.request<{ device: any }>('/devices', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.data.device;
  }

  /**
   * 解绑设备
   */
  public async unbindDevice(deviceId: number): Promise<void> {
    await this.request(`/devices/${deviceId}`, {
      method: 'DELETE',
    });
  }

  /**
   * 检查是否有有效的 Token
   */
  public hasToken(): boolean {
    return this.accessToken !== null;
  }

  /**
   * 获取 QQ 头像 URL
   */
  public getQQAvatarUrl(qqId: string, size: 40 | 100 | 140 | 640 = 100): string {
    return `https://q1.qlogo.cn/g?b=qq&nk=${qqId}&s=${size}`;
  }
}

// 导出单例实例
export const apiService = ApiService.getInstance();

