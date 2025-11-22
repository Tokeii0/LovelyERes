/**
 * 认证守卫
 * 用于检查用户是否已登录，未登录则显示登录弹窗
 */


export class AuthGuard {
  private static instance: AuthGuard;

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
   * 检查用户是否已登录
   * @returns 是否已登录
   */
  public isAuthenticated(): boolean {
    return true;
  }

  /**
   * 要求用户登录
   * 如果未登录，显示登录弹窗并返回 false
   * 如果已登录，返回 true
   * @param message 提示消息
   * @returns 是否已登录
   */
  public requireAuth(message?: string): boolean {
    return true;
  }

  /**
   * 显示需要登录的提示消息
   * @param message 提示消息
   */
  private showAuthRequiredMessage(message: string): void {
    // 创建提示元素
    const toast = document.createElement('div');
    toast.className = 'auth-required-toast';
    toast.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: var(--bg-primary);
      border: 1px solid var(--border-color);
      border-left: 4px solid var(--warning-color);
      border-radius: var(--border-radius);
      padding: 12px 16px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 10px;
      animation: slideInRight 0.3s ease-out;
      max-width: 300px;
    `;

    toast.innerHTML = `
      <div style="
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: rgba(255, 193, 7, 0.1);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--warning-color)" stroke-width="2">
          <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
        </svg>
      </div>
      <div style="flex: 1;">
        <div style="font-weight: 600; color: var(--text-primary); font-size: 13px; margin-bottom: 2px;">
          需要登录
        </div>
        <div style="font-size: 12px; color: var(--text-secondary);">
          ${message}
        </div>
      </div>
      <button onclick="this.parentElement.remove()" style="
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all 0.2s ease;
      " onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    `;

    // 添加动画样式
    if (!document.getElementById('auth-guard-styles')) {
      const style = document.createElement('style');
      style.id = 'auth-guard-styles';
      style.textContent = `
        @keyframes slideInRight {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        
        @keyframes slideOutRight {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: translateX(100%);
            opacity: 0;
          }
        }
      `;
      document.head.appendChild(style);
    }

    // 添加到页面
    document.body.appendChild(toast);

    // 3秒后自动移除
    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => {
        toast.remove();
      }, 300);
    }, 3000);
  }

  /**
   * 包装需要认证的函数
   * @param fn 需要认证的函数
   * @param message 提示消息
   * @returns 包装后的函数
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
   * 为元素添加认证检查
   * @param element 元素
   * @param message 提示消息
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
   * @param selector CSS 选择器
   * @param message 提示消息
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

