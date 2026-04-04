/**
 * 认证守卫
 * 检查用户是否已登录，未登录则弹出登录框
 * 对接 UserManager 获取真实登录状态
 */

import { userManager } from '../user/userManager';
import { LoginModal } from '../user/loginModal';

export class AuthGuard {
  private static instance: AuthGuard;
  private loginModal: LoginModal | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  public static getInstance(): AuthGuard {
    if (!AuthGuard.instance) {
      AuthGuard.instance = new AuthGuard();
    }
    return AuthGuard.instance;
  }

  /**
   * 延迟获取 LoginModal（避免循环依赖和初始化时序问题）
   */
  private getLoginModal(): LoginModal {
    if (!this.loginModal) {
      this.loginModal = LoginModal.getInstance();
    }
    return this.loginModal;
  }

  /**
   * 检查用户是否已登录
   */
  public isAuthenticated(): boolean {
    return userManager.isLoggedIn();
  }

  /**
   * 要求用户登录
   * 如果未登录，显示登录弹窗并返回 false
   * 如果已登录，返回 true
   * @param message 提示消息
   */
  public requireAuth(message?: string): boolean {
    if (this.isAuthenticated()) {
      return true;
    }

    // 显示登录提示
    this.showAuthRequiredToast(message || '请先登录后再进行此操作');

    // 弹出登录框
    try {
      this.getLoginModal().show('login');
    } catch (e) {
      console.error('❌ 打开登录框失败:', e);
    }

    return false;
  }

  /**
   * 显示需要登录的提示消息
   */
  private showAuthRequiredToast(message: string): void {
    const toast = document.createElement('div');
    toast.className = 'auth-required-toast';
    toast.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: var(--bg-primary, #fff);
      border: 1px solid var(--border-color, #e2e8f0);
      border-left: 4px solid var(--warning-color, #f59e0b);
      border-radius: var(--border-radius, 8px);
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: authSlideIn 0.3s ease-out;
      max-width: 300px;
    `;

    toast.innerHTML = `
      <div style="
        width: 32px; height: 32px; border-radius: 50%;
        background: rgba(245, 158, 11, 0.1);
        display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning-color, #f59e0b)" stroke-width="2">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <div style="flex: 1;">
        <div style="font-weight: 600; color: var(--text-primary, #1e293b); font-size: 13px; margin-bottom: 2px;">
          需要登录
        </div>
        <div style="font-size: 12px; color: var(--text-secondary, #64748b);">
          ${message}
        </div>
      </div>
      <button onclick="this.parentElement.remove()" style="
        background: none; border: none; color: var(--text-secondary, #64748b);
        cursor: pointer; padding: 4px; display: flex; align-items: center;
        justify-content: center; border-radius: 4px; transition: all 0.2s ease;
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;

    // 确保动画样式存在
    if (!document.getElementById('auth-guard-styles')) {
      const style = document.createElement('style');
      style.id = 'auth-guard-styles';
      style.textContent = `
        @keyframes authSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes authSlideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // 3秒后自动关闭
    setTimeout(() => {
      toast.style.animation = 'authSlideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * 包装需要认证的函数
   * 调用时自动检查登录态，未登录则弹出登录框
   */
  public withAuth<T extends (...args: any[]) => any>(
    fn: T,
    message?: string
  ): T {
    return ((...args: any[]) => {
      if (this.requireAuth(message)) {
        return fn(...args);
      }
      return undefined;
    }) as T;
  }

  /**
   * 为元素添加认证点击拦截
   */
  public protectElement(element: HTMLElement, message?: string): void {
    const originalOnClick = element.onclick;

    element.onclick = (event) => {
      if (!this.requireAuth(message)) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }

      if (originalOnClick) {
        return originalOnClick.call(element, event);
      }
      return true;
    };
  }

  /**
   * 批量保护元素
   */
  public protectElements(selector: string, message?: string): void {
    const elements = document.querySelectorAll<HTMLElement>(selector);
    elements.forEach(element => {
      this.protectElement(element, message);
    });
  }
}

// 导出单例实例
export const authGuard = AuthGuard.getInstance();

// 全局函数，供 HTML 中使用
(window as any).requireAuth = (message?: string) => {
  return authGuard.requireAuth(message);
};
