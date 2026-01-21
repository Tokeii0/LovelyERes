/**
 * SSH连接对话框
 * 提供用户友好的SSH连接界面
 */

import { sshConnectionManager } from '../remote/sshConnectionManager';

export class SSHConnectionDialog {
  private dialog: HTMLElement | null = null;

  /**
   * 显示SSH连接对话框
   */
  show(): void {
    if (this.dialog) {
      this.hide(); // 如果已存在，先关闭
    }

    this.dialog = document.createElement('div');
    this.dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;

    this.dialog.innerHTML = `
      <div style="
        background: var(--bg-primary);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-lg);
        width: 400px;
        max-width: 90vw;
        border: 1px solid var(--border-color);
      ">
        <h3 style="margin: 0 0 var(--spacing-md) 0; color: var(--text-primary);">
          🔗 SSH连接设置
        </h3>

        <div style="margin-bottom: var(--spacing-md);">
          <label style="display: block; margin-bottom: var(--spacing-xs); color: var(--text-primary); font-size: 12px;">
            服务器地址
          </label>
          <input
            type="text"
            id="ssh-host"
            placeholder="例如: 192.168.1.100"
            style="
              width: 100%;
              padding: var(--spacing-sm);
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius);
              background: var(--bg-secondary);
              color: var(--text-primary);
              font-size: 14px;
            "
          />
        </div>

        <div style="margin-bottom: var(--spacing-md);">
          <label style="display: block; margin-bottom: var(--spacing-xs); color: var(--text-primary); font-size: 12px;">
            端口
          </label>
          <input
            type="number"
            id="ssh-port"
            value="22"
            min="1"
            max="65535"
            style="
              width: 100%;
              padding: var(--spacing-sm);
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius);
              background: var(--bg-secondary);
              color: var(--text-primary);
              font-size: 14px;
            "
          />
        </div>

        <div style="margin-bottom: var(--spacing-md);">
          <label style="display: block; margin-bottom: var(--spacing-xs); color: var(--text-primary); font-size: 12px;">
            用户名
          </label>
          <input
            type="text"
            id="ssh-username"
            placeholder="例如: root"
            style="
              width: 100%;
              padding: var(--spacing-sm);
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius);
              background: var(--bg-secondary);
              color: var(--text-primary);
              font-size: 14px;
            "
          />
        </div>

        <div style="margin-bottom: var(--spacing-lg);">
          <label style="display: block; margin-bottom: var(--spacing-xs); color: var(--text-primary); font-size: 12px;">
            密码
          </label>
          <input
            type="password"
            id="ssh-password"
            placeholder="请输入SSH密码"
            style="
              width: 100%;
              padding: var(--spacing-sm);
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius);
              background: var(--bg-secondary);
              color: var(--text-primary);
              font-size: 14px;
            "
          />
        </div>

        <div style="margin-bottom: var(--spacing-md);">
          <label style="display: flex; align-items: center; gap: var(--spacing-xs); color: var(--text-primary); font-size: 13px; cursor: pointer;">
            <input
              type="checkbox"
              id="ssh-use-sudo"
              style="cursor: pointer;"
            />
            <span>使用 sudo 执行系统命令</span>
          </label>
          <small style="display: block; margin-top: var(--spacing-xs); color: var(--text-secondary); font-size: 11px; margin-left: 20px;">
            勾选后,系统信息查询和Docker命令将使用sudo权限执行
          </small>
        </div>

        <div id="sudo-password-container" style="margin-bottom: var(--spacing-md); display: none;">
          <label style="display: block; margin-bottom: var(--spacing-xs); color: var(--text-primary); font-size: 12px;">
            Sudo 密码 (可选)
          </label>
          <input
            type="password"
            id="ssh-sudo-password"
            placeholder="如果配置了NOPASSWD则留空"
            style="
              width: 100%;
              padding: var(--spacing-sm);
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius);
              background: var(--bg-secondary);
              color: var(--text-primary);
              font-size: 14px;
            "
          />
          <small style="display: block; margin-top: var(--spacing-xs); color: var(--text-secondary); font-size: 11px;">
            如果服务器执行sudo需要密码，请输入。密码将加密保存。
          </small>
        </div>

        <div style="display: flex; gap: var(--spacing-sm); justify-content: flex-end;">
          <button
            class="modern-btn secondary"
            onclick="sshConnectionDialog.hide()"
          >
            取消
          </button>
          <button
            class="modern-btn primary"
            onclick="sshConnectionDialog.connect()"
          >
            连接
          </button>
        </div>
      </div>
    `;

    // 添加键盘事件监听
    this.dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hide();
      } else if (e.key === 'Enter') {
        this.connect();
      }
    });

    // 点击背景关闭对话框
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) {
        this.hide();
      }
    });

    // 监听sudo复选框变化
    const useSudoCheckbox = document.getElementById('ssh-use-sudo');
    if (useSudoCheckbox) {
      useSudoCheckbox.addEventListener('change', (e) => {
        const container = document.getElementById('sudo-password-container');
        if (container) {
          if ((e.target as HTMLInputElement).checked) {
            container.style.display = 'block';
          } else {
            container.style.display = 'none';
          }
        }
      });
    }

    document.body.appendChild(this.dialog);

    // 聚焦到第一个输入框
    setTimeout(() => {
      const hostInput = document.getElementById('ssh-host') as HTMLInputElement;
      if (hostInput) {
        hostInput.focus();
      }
    }, 100);
  }

  /**
   * 隐藏对话框
   */
  hide(): void {
    if (this.dialog) {
      this.dialog.remove();
      this.dialog = null;
    }
  }

  /**
   * 执行连接
   */
  async connect(): Promise<void> {
    const host = (document.getElementById('ssh-host') as HTMLInputElement)?.value;
    const port = parseInt((document.getElementById('ssh-port') as HTMLInputElement)?.value);
    const username = (document.getElementById('ssh-username') as HTMLInputElement)?.value;
    const password = (document.getElementById('ssh-password') as HTMLInputElement)?.value;
    const useSudo = (document.getElementById('ssh-use-sudo') as HTMLInputElement)?.checked || false;
    const sudoPassword = (document.getElementById('ssh-sudo-password') as HTMLInputElement)?.value || undefined;

    if (!host || !username || !password) {
      (window as any).showConnectionStatus('请填写完整的连接信息', 'error');
      return;
    }

    try {
      // 使用SSH连接管理器进行连接,传递useSudo参数和sudo密码
      await sshConnectionManager.connect(host, port, username, password, useSudo, sudoPassword);
      
      // 连接成功，关闭对话框
      this.hide();
      
      // 刷新远程操作页面（如果当前在该页面）
      const app = (window as any).app;
      const currentPage = app?.getStateManager().getState().currentPage;
      if (currentPage === 'remote-operations') {
        await (window as any).initRemoteOperationsPage();
      }
      
    } catch (error) {
      console.error('SSH连接失败:', error);
      // 错误信息已在sshConnectionManager中显示
    }
  }
}

// 全局SSH连接对话框实例
export const sshConnectionDialog = new SSHConnectionDialog();
