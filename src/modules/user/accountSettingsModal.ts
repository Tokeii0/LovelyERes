/**
 * 账户设置模态框
 */

import { apiService } from '../api/apiService';
import { userManager } from './userManager';

export class AccountSettingsModal {
  private static instance: AccountSettingsModal;
  private modal: HTMLElement | null = null;

  private constructor() {}

  public static getInstance(): AccountSettingsModal {
    if (!AccountSettingsModal.instance) {
      AccountSettingsModal.instance = new AccountSettingsModal();
    }
    return AccountSettingsModal.instance;
  }

  /**
   * 显示账户设置模态框
   */
  public show(): void {
    if (!this.modal) {
      this.createModal();
    }

    const user = userManager.getCurrentUser();
    if (!user) {
      console.error('❌ 未登录，无法打开账户设置');
      return;
    }

    // 填充表单数据
    const nicknameInput = document.getElementById('account-nickname') as HTMLInputElement;
    const emailInput = document.getElementById('account-email') as HTMLInputElement;
    const qqIdInput = document.getElementById('account-qq-id') as HTMLInputElement;

    if (nicknameInput) nicknameInput.value = user.nickname || '';
    if (emailInput) emailInput.value = user.email || '';
    if (qqIdInput) qqIdInput.value = user.qq_id || '';

    this.modal!.style.display = 'flex';
  }

  /**
   * 隐藏账户设置模态框
   */
  public hide(): void {
    if (this.modal) {
      this.modal.style.display = 'none';
    }
  }

  /**
   * 创建模态框
   */
  private createModal(): void {
    const modal = document.createElement('div');
    modal.id = 'account-settings-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: none;
      justify-content: center;
      align-items: center;
      z-index: 10000;
    `;

    modal.innerHTML = `
      <div class="modal-content" style="
        background: var(--bg-primary);
        border-radius: 12px;
        padding: 24px;
        width: 90%;
        max-width: 500px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      ">
        <div class="modal-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        ">
          <h2 style="margin: 0; font-size: 20px; color: var(--text-primary);">⚙️ 账户设置</h2>
          <button type="button" class="close-btn" onclick="event.stopPropagation(); window.closeAccountSettings();" style="
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--text-secondary);
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
          " onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">×</button>
        </div>

        <div class="modal-body">
          <form id="account-settings-form">
            <div class="form-group" style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-size: 14px;">
                昵称
              </label>
              <input
                type="text"
                id="account-nickname"
                placeholder="请输入昵称"
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1px solid var(--border-color);
                  border-radius: 6px;
                  background: var(--bg-secondary);
                  color: var(--text-primary);
                  font-size: 14px;
                  box-sizing: border-box;
                "
              />
            </div>

            <div class="form-group" style="margin-bottom: 16px;">
              <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-size: 14px;">
                邮箱 <span style="color: var(--text-secondary); font-size: 12px;">(不可修改)</span>
              </label>
              <input
                type="email"
                id="account-email"
                placeholder="请输入邮箱"
                disabled
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1px solid var(--border-color);
                  border-radius: 6px;
                  background: var(--bg-secondary);
                  color: var(--text-secondary);
                  font-size: 14px;
                  box-sizing: border-box;
                  cursor: not-allowed;
                  opacity: 0.6;
                "
              />
            </div>

            <div class="form-group" style="margin-bottom: 20px;">
              <label style="display: block; margin-bottom: 8px; color: var(--text-primary); font-size: 14px;">
                QQ 号
              </label>
              <input
                type="text"
                id="account-qq-id"
                placeholder="请输入 QQ 号"
                style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1px solid var(--border-color);
                  border-radius: 6px;
                  background: var(--bg-secondary);
                  color: var(--text-primary);
                  font-size: 14px;
                  box-sizing: border-box;
                "
              />
            </div>

            <div class="form-actions" style="display: flex; gap: 12px; justify-content: flex-end;">
              <button
                type="button"
                onclick="window.closeAccountSettings()"
                style="
                  padding: 10px 20px;
                  border: 1px solid var(--border-color);
                  border-radius: 6px;
                  background: var(--bg-secondary);
                  color: var(--text-primary);
                  font-size: 14px;
                  cursor: pointer;
                "
                onmouseover="this.style.background='var(--bg-tertiary)'"
                onmouseout="this.style.background='var(--bg-secondary)'"
              >
                取消
              </button>
              <button
                type="submit"
                style="
                  padding: 10px 20px;
                  border: none;
                  border-radius: 6px;
                  background: var(--primary-color);
                  color: white;
                  font-size: 14px;
                  cursor: pointer;
                "
                onmouseover="this.style.opacity='0.9'"
                onmouseout="this.style.opacity='1'"
              >
                保存
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.hide();
      }
    });

    // 表单提交
    const form = modal.querySelector('#account-settings-form') as HTMLFormElement;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handleSubmit();
    });

    document.body.appendChild(modal);
    this.modal = modal;
  }

  /**
   * 处理表单提交
   */
  private async handleSubmit(): Promise<void> {
    const nicknameInput = document.getElementById('account-nickname') as HTMLInputElement;
    const qqIdInput = document.getElementById('account-qq-id') as HTMLInputElement;

    const nickname = nicknameInput.value.trim();
    const qq_id = qqIdInput.value.trim();

    try {
      // 调用 API 更新用户信息（不包括邮箱，邮箱不可修改）
      const updatedUser = await apiService.updateUserInfo({
        nickname: nickname || undefined,
        qq_id: qq_id || undefined,
      });

      // 更新本地用户信息
      userManager.updateUserInfo(updatedUser);

      // 显示成功提示
      (window as any).showNotification && (window as any).showNotification('账户信息更新成功', 'success');

      // 关闭模态框
      this.hide();
    } catch (error: any) {
      console.error('❌ 更新账户信息失败:', error);
      (window as any).showNotification && (window as any).showNotification(
        error.message || '更新账户信息失败',
        'error'
      );
    }
  }
}

// 导出单例实例
export const accountSettingsModal = AccountSettingsModal.getInstance();

// 全局函数
(window as any).closeAccountSettings = function() {
  accountSettingsModal.hide();
};

