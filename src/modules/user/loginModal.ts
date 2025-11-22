/**
 * 登录/注册模态框
 * 提供用户登录和注册界面
 */

import { userManager } from './userManager';
import { User, Lock, Mail } from '@icon-park/svg';

export class LoginModal {
  private static instance: LoginModal;
  private modal: HTMLElement | null = null;
  private isVisible: boolean = false;

  private constructor() {
    this.createModal();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): LoginModal {
    if (!LoginModal.instance) {
      LoginModal.instance = new LoginModal();
    }
    return LoginModal.instance;
  }

  /**
   * 创建模态框
   */
  private createModal(): void {
    this.modal = document.createElement('div');
    this.modal.id = 'login-modal';
    this.modal.className = 'modal-overlay';
    this.modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    `;

    this.modal.innerHTML = this.getModalContent();

    // 点击背景关闭
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // ESC键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    document.body.appendChild(this.modal);
    this.attachEventListeners();
  }

  /**
   * 获取模态框内容
   */
  private getModalContent(): string {
    return `
      <div class="modal-content" style="
        background: var(--bg-primary);
        border-radius: var(--border-radius-lg);
        width: 400px;
        max-width: 90vw;
        border: 1px solid var(--border-color);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        overflow: hidden;
      ">
        <!-- 模态头部 -->
        <div class="login-modal-header" style="
          padding: var(--spacing-lg);
          background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
          color: white;
          text-align: center;
        ">
          <div style="
            width: 60px;
            height: 60px;
            margin: 0 auto var(--spacing-md);
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            backdrop-filter: blur(10px);
          ">
            ${User({ theme: 'filled', size: '32', fill: 'white' })}
          </div>
          <h2 id="login-modal-title" style="margin: 0; font-size: 20px; font-weight: 600;">
            欢迎使用 LovelyRes
          </h2>
          <p style="margin: 8px 0 0; font-size: 13px; opacity: 0.9;">
            Linux Emergency Response Tool
          </p>
        </div>

        <!-- 模态内容 -->
        <div class="login-modal-body" style="padding: var(--spacing-lg);">
          <!-- 登录表单 -->
          <div id="login-form" style="display: block;">
            <div style="margin-bottom: var(--spacing-md);">
              <label style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-primary);
                font-size: 13px;
                font-weight: 500;
              ">
                ${Mail({ theme: 'outline', size: '14', fill: 'currentColor' })}
                用户名或邮箱
              </label>
              <input
                type="text"
                id="login-username"
                placeholder="请输入用户名或邮箱"
                autocomplete="username"
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1px solid var(--border-color);
                  border-radius: var(--border-radius);
                  background: var(--bg-secondary);
                  color: var(--text-primary);
                  font-size: 14px;
                  box-sizing: border-box;
                  transition: all 0.2s ease;
                "
              />
            </div>

            <div style="margin-bottom: var(--spacing-lg);">
              <label style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-primary);
                font-size: 13px;
                font-weight: 500;
              ">
                ${Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
                密码
              </label>
              <input
                type="password"
                id="login-password"
                placeholder="请输入密码"
                autocomplete="current-password"
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1px solid var(--border-color);
                  border-radius: var(--border-radius);
                  background: var(--bg-secondary);
                  color: var(--text-primary);
                  font-size: 14px;
                  box-sizing: border-box;
                  transition: all 0.2s ease;
                "
              />
            </div>

            <button
              id="login-submit-btn"
              class="modern-btn primary"
              style="
                width: 100%;
                padding: 12px;
                font-size: 14px;
                font-weight: 600;
                margin-bottom: var(--spacing-md);
              "
            >
              登录
            </button>

            <div style="text-align: center; color: var(--text-secondary); font-size: 13px;">
              还没有账户？
              <a
                id="show-register-btn"
                href="javascript:void(0)"
                style="
                  color: var(--primary-color);
                  text-decoration: none;
                  font-weight: 500;
                "
              >
                立即注册
              </a>
            </div>
          </div>

          <!-- 注册表单 -->
          <div id="register-form" style="display: none;">
            <div style="margin-bottom: var(--spacing-md);">
              <label style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-primary);
                font-size: 13px;
                font-weight: 500;
              ">
                ${User({ theme: 'outline', size: '14', fill: 'currentColor' })}
                用户名 <span style="color: #ef4444;">*</span>
              </label>
              <input
                type="text"
                id="register-username"
                placeholder="请输入用户名（至少3位）"
                autocomplete="username"
                required
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1px solid var(--border-color);
                  border-radius: var(--border-radius);
                  background: var(--bg-secondary);
                  color: var(--text-primary);
                  font-size: 14px;
                  box-sizing: border-box;
                "
              />
            </div>

            <div style="margin-bottom: var(--spacing-md);">
              <label style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-primary);
                font-size: 13px;
                font-weight: 500;
              ">
                ${User({ theme: 'outline', size: '14', fill: 'currentColor' })}
                昵称
              </label>
              <input
                type="text"
                id="register-nickname"
                placeholder="请输入昵称（可选）"
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1px solid var(--border-color);
                  border-radius: var(--border-radius);
                  background: var(--bg-secondary);
                  color: var(--text-primary);
                  font-size: 14px;
                  box-sizing: border-box;
                "
              />
            </div>

            <div style="margin-bottom: var(--spacing-md);">
              <label style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-primary);
                font-size: 13px;
                font-weight: 500;
              ">
                ${Mail({ theme: 'outline', size: '14', fill: 'currentColor' })}
                邮箱 <span style="color: #ef4444;">*</span>
              </label>
              <input
                type="email"
                id="register-email"
                placeholder="请输入邮箱地址"
                autocomplete="email"
                required
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1px solid var(--border-color);
                  border-radius: var(--border-radius);
                  background: var(--bg-secondary);
                  color: var(--text-primary);
                  font-size: 14px;
                  box-sizing: border-box;
                "
              />
            </div>

            <div style="margin-bottom: var(--spacing-md);">
              <label style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-primary);
                font-size: 13px;
                font-weight: 500;
              ">
                ${User({ theme: 'outline', size: '14', fill: 'currentColor' })}
                QQ号
              </label>
              <input
                type="text"
                id="register-qq"
                placeholder="请输入QQ号（可选，用于显示头像）"
                pattern="[0-9]*"
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1px solid var(--border-color);
                  border-radius: var(--border-radius);
                  background: var(--bg-secondary);
                  color: var(--text-primary);
                  font-size: 14px;
                  box-sizing: border-box;
                "
              />
            </div>

            <div style="margin-bottom: var(--spacing-lg);">
              <label style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-primary);
                font-size: 13px;
                font-weight: 500;
              ">
                ${Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
                密码 <span style="color: #ef4444;">*</span>
              </label>
              <input
                type="password"
                id="register-password"
                placeholder="请输入密码（至少6位）"
                autocomplete="new-password"
                required
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1px solid var(--border-color);
                  border-radius: var(--border-radius);
                  background: var(--bg-secondary);
                  color: var(--text-primary);
                  font-size: 14px;
                  box-sizing: border-box;
                "
              />
            </div>

            <button
              id="register-submit-btn"
              class="modern-btn primary"
              style="
                width: 100%;
                padding: 12px;
                font-size: 14px;
                font-weight: 600;
                margin-bottom: var(--spacing-md);
              "
            >
              注册
            </button>

            <div style="text-align: center; color: var(--text-secondary); font-size: 13px;">
              已有账户？
              <a
                id="show-login-btn"
                href="javascript:void(0)"
                style="
                  color: var(--primary-color);
                  text-decoration: none;
                  font-weight: 500;
                "
              >
                立即登录
              </a>
            </div>
          </div>

          <!-- 错误提示 -->
          <div
            id="login-error-message"
            style="
              display: none;
              margin-top: var(--spacing-md);
              padding: var(--spacing-sm);
              background: rgba(239, 68, 68, 0.1);
              border: 1px solid rgba(239, 68, 68, 0.3);
              border-radius: var(--border-radius);
              color: #ef4444;
              font-size: 13px;
              text-align: center;
            "
          ></div>
        </div>
      </div>
    `;
  }

  /**
   * 附加事件监听器
   */
  private attachEventListeners(): void {
    // 登录按钮
    const loginBtn = document.getElementById('login-submit-btn');
    loginBtn?.addEventListener('click', () => this.handleLogin());

    // 注册按钮
    const registerBtn = document.getElementById('register-submit-btn');
    registerBtn?.addEventListener('click', () => this.handleRegister());

    // 切换到注册表单
    const showRegisterBtn = document.getElementById('show-register-btn');
    showRegisterBtn?.addEventListener('click', () => this.switchMode('register'));

    // 切换到登录表单
    const showLoginBtn = document.getElementById('show-login-btn');
    showLoginBtn?.addEventListener('click', () => this.switchMode('login'));

    // 回车键提交
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    const registerUsername = document.getElementById('register-username');
    const registerEmail = document.getElementById('register-email');
    const registerPassword = document.getElementById('register-password');

    [loginUsername, loginPassword].forEach(input => {
      input?.addEventListener('keypress', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') {
          this.handleLogin();
        }
      });
    });

    [registerUsername, registerEmail, registerPassword].forEach(input => {
      input?.addEventListener('keypress', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') {
          this.handleRegister();
        }
      });
    });
  }

  /**
   * 切换登录/注册模式
   */
  private switchMode(mode: 'login' | 'register'): void {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const title = document.getElementById('login-modal-title');

    if (mode === 'login') {
      if (loginForm) loginForm.style.display = 'block';
      if (registerForm) registerForm.style.display = 'none';
      if (title) title.textContent = '欢迎使用 LovelyRes';
    } else {
      if (loginForm) loginForm.style.display = 'none';
      if (registerForm) registerForm.style.display = 'block';
      if (title) title.textContent = '注册新账户';
    }

    this.hideError();
  }

  /**
   * 处理登录
   */
  private async handleLogin(): Promise<void> {
    const usernameInput = document.getElementById('login-username') as HTMLInputElement;
    const passwordInput = document.getElementById('login-password') as HTMLInputElement;
    const submitBtn = document.getElementById('login-submit-btn') as HTMLButtonElement;

    if (!usernameInput || !passwordInput || !submitBtn) return;

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      this.showError('请输入用户名和密码');
      return;
    }

    // 禁用按钮，显示加载状态
    submitBtn.disabled = true;
    submitBtn.textContent = '登录中...';

    try {
      const result = await userManager.login(username, password);

      if (result.success) {
        this.hide();
        // 刷新UI
        this.refreshUI();
      } else {
        this.showError(result.message);
      }
    } catch (error) {
      this.showError('登录失败，请稍后重试');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '登录';
    }
  }

  /**
   * 处理注册
   */
  private async handleRegister(): Promise<void> {
    const usernameInput = document.getElementById('register-username') as HTMLInputElement;
    const nicknameInput = document.getElementById('register-nickname') as HTMLInputElement;
    const emailInput = document.getElementById('register-email') as HTMLInputElement;
    const qqInput = document.getElementById('register-qq') as HTMLInputElement;
    const passwordInput = document.getElementById('register-password') as HTMLInputElement;
    const submitBtn = document.getElementById('register-submit-btn') as HTMLButtonElement;

    if (!usernameInput || !emailInput || !passwordInput || !submitBtn) return;

    const username = usernameInput.value.trim();
    const nickname = nicknameInput?.value.trim() || undefined;
    const email = emailInput.value.trim();
    const qqId = qqInput?.value.trim() || undefined;
    const password = passwordInput.value;

    if (!username || !email || !password) {
      this.showError('请填写所有必填字段');
      return;
    }

    // 禁用按钮，显示加载状态
    submitBtn.disabled = true;
    submitBtn.textContent = '注册中...';

    try {
      const result = await userManager.register(username, email, password, nickname, qqId);

      if (result.success) {
        this.hide();
        // 刷新UI
        this.refreshUI();
      } else {
        this.showError(result.message);
      }
    } catch (error) {
      this.showError('注册失败，请稍后重试');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '注册';
    }
  }

  /**
   * 显示错误信息
   */
  private showError(message: string): void {
    const errorEl = document.getElementById('login-error-message');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  /**
   * 隐藏错误信息
   */
  private hideError(): void {
    const errorEl = document.getElementById('login-error-message');
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  }

  /**
   * 刷新UI
   */
  private refreshUI(): void {
    // 触发UI更新
    const app = (window as any).app;
    if (app && app.render) {
      app.render();
    }
  }

  /**
   * 显示模态框
   */
  public show(mode: 'login' | 'register' = 'login'): void {
    if (!this.modal) return;

    this.isVisible = true;
    this.modal.style.display = 'flex';
    this.switchMode(mode);

    // 聚焦到第一个输入框
    setTimeout(() => {
      if (mode === 'login') {
        const usernameInput = document.getElementById('login-username') as HTMLInputElement;
        usernameInput?.focus();
      } else {
        const usernameInput = document.getElementById('register-username') as HTMLInputElement;
        usernameInput?.focus();
      }
    }, 100);
  }

  /**
   * 隐藏模态框
   */
  public hide(): void {
    if (!this.modal) return;

    this.isVisible = false;
    this.modal.style.display = 'none';
    this.hideError();

    // 清空输入框
    const inputs = [
      'login-username',
      'login-password',
      'register-username',
      'register-email',
      'register-password'
    ];

    inputs.forEach(id => {
      const input = document.getElementById(id) as HTMLInputElement;
      if (input) input.value = '';
    });
  }
}

// 导出单例实例
export const loginModal = LoginModal.getInstance();
