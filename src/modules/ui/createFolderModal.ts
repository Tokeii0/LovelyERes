/**
 * 新建文件夹模态对话框
 */

export class CreateFolderModal {
  private modal: HTMLElement | null = null;
  private isVisible: boolean = false;
  private currentParentDir: string = '';

  constructor() {
    this.createModal();
    this.setupEventListeners();
  }

  private createModal(): void {
    // 创建模态容器
    this.modal = document.createElement('div');
    this.modal.id = 'create-folder-modal';
    this.modal.innerHTML = `
      <div class="modal-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      ">
        <div class="modal-content" style="
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          width: 400px;
          max-width: 90vw;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        ">
          <!-- 标题栏 -->
          <div style="
            padding: var(--spacing-md);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            justify-content: space-between;
            align-items: center;
          ">
            <h3 style="
              margin: 0;
              color: var(--text-primary);
              font-size: 16px;
              font-weight: 600;
            ">新建文件夹</h3>
            <button id="create-folder-modal-close" style="
              background: none;
              border: none;
              color: var(--text-secondary);
              font-size: 18px;
              cursor: pointer;
              padding: 4px;
              border-radius: var(--border-radius-sm);
            " onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='none'">
              ✕
            </button>
          </div>

          <!-- 内容区域 -->
          <div style="padding: var(--spacing-md);">
            <!-- 父目录显示 -->
            <div style="margin-bottom: var(--spacing-md);">
              <label style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
              ">创建位置</label>
              <div id="create-folder-parent-dir" style="
                padding: var(--spacing-sm);
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                color: var(--text-primary);
                font-family: monospace;
                font-size: 12px;
                word-break: break-all;
              "></div>
            </div>

            <!-- 文件夹名称输入 -->
            <div style="margin-bottom: var(--spacing-md);">
              <label for="create-folder-name" style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
              ">文件夹名称</label>
              <input
                type="text"
                id="create-folder-name"
                placeholder="请输入文件夹名称"
                style="
                  width: 100%;
                  padding: var(--spacing-sm);
                  border: 1px solid var(--border-color);
                  border-radius: var(--border-radius-sm);
                  background: var(--bg-secondary);
                  color: var(--text-primary);
                  font-size: 14px;
                  box-sizing: border-box;
                "
              />
              <div id="create-folder-error" style="
                margin-top: var(--spacing-xs);
                color: var(--error-color);
                font-size: 11px;
                display: none;
              "></div>
            </div>

            <!-- 完整路径预览 -->
            <div style="margin-bottom: var(--spacing-lg);">
              <label style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
              ">完整路径</label>
              <div id="create-folder-full-path" style="
                padding: var(--spacing-sm);
                background: var(--bg-tertiary);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                color: var(--text-secondary);
                font-family: monospace;
                font-size: 11px;
                word-break: break-all;
                min-height: 20px;
              "></div>
            </div>

            <!-- 操作按钮 -->
            <div style="
              display: flex;
              gap: var(--spacing-sm);
              justify-content: flex-end;
            ">
              <button id="create-folder-cancel-btn" class="modern-btn secondary" style="
                padding: var(--spacing-sm) var(--spacing-md);
                font-size: 12px;
              ">
                取消
              </button>
              <button id="create-folder-confirm-btn" class="modern-btn" style="
                padding: var(--spacing-sm) var(--spacing-md);
                background: var(--success-color);
                border: 1px solid var(--success-color);
                color: white;
                font-size: 12px;
                opacity: 0.5;
              " disabled>
                创建
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.modal.style.display = 'none';
    document.body.appendChild(this.modal);
  }

  private setupEventListeners(): void {
    if (!this.modal) return;

    // 关闭按钮
    const closeBtn = document.getElementById('create-folder-modal-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.hide();
    }

    // 取消按钮
    const cancelBtn = document.getElementById('create-folder-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = () => this.hide();
    }

    // 确认按钮
    const confirmBtn = document.getElementById('create-folder-confirm-btn') as HTMLButtonElement | null;
    if (confirmBtn) {
      confirmBtn.onclick = () => this.createFolder();
    }

    // 文件夹名称输入
    const nameInput = document.getElementById('create-folder-name') as HTMLInputElement;
    if (nameInput) {
      nameInput.oninput = () => this.validateInput();
      nameInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (confirmBtn && !confirmBtn.disabled) {
            this.createFolder();
          }
        }
      };
    }

    // ESC键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isVisible) {
        this.hide();
      }
    });

    // 点击遮罩关闭
    this.modal.onclick = (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    };
  }

  public show(parentDir: string): void {
    if (!this.modal) return;

    this.currentParentDir = parentDir;
    this.isVisible = true;

    // 更新父目录显示
    const parentDirEl = document.getElementById('create-folder-parent-dir');
    if (parentDirEl) {
      parentDirEl.textContent = parentDir;
    }

    // 重置输入框
    const nameInput = document.getElementById('create-folder-name') as HTMLInputElement;
    if (nameInput) {
      nameInput.value = '';
      nameInput.focus();
    }

    // 重置状态
    this.validateInput();
    this.hideError();

    this.modal.style.display = 'flex';
  }

  public hide(): void {
    if (!this.modal) return;
    
    this.modal.style.display = 'none';
    this.isVisible = false;
    this.currentParentDir = '';
  }

  private validateInput(): void {
    const nameInput = document.getElementById('create-folder-name') as HTMLInputElement;
    const confirmBtn = document.getElementById('create-folder-confirm-btn') as HTMLButtonElement;
    const fullPathEl = document.getElementById('create-folder-full-path');
    
    if (!nameInput || !confirmBtn || !fullPathEl) return;

    const folderName = nameInput.value.trim();
    let isValid = true;
    let errorMessage = '';

    // 检查是否为空
    if (!folderName) {
      isValid = false;
      fullPathEl.textContent = '';
    } else {
      // 检查文件名是否包含非法字符
      const invalidChars = /[\/\\:*?"<>|]/;
      if (invalidChars.test(folderName)) {
        isValid = false;
        errorMessage = '文件夹名称不能包含以下字符: / \\ : * ? " < > |';
      }
      
      // 检查是否以点开头或结尾
      if (folderName.startsWith('.') || folderName.endsWith('.')) {
        isValid = false;
        errorMessage = '文件夹名称不能以点开头或结尾';
      }
      
      // 检查长度
      if (folderName.length > 255) {
        isValid = false;
        errorMessage = '文件夹名称过长（最多255个字符）';
      }
      
      // 更新完整路径预览
      if (isValid) {
        const fullPath = `${this.currentParentDir}/${folderName}`;
        fullPathEl.textContent = fullPath;
      } else {
        fullPathEl.textContent = '';
      }
    }

    // 更新按钮状态
    confirmBtn.disabled = !isValid;
    confirmBtn.style.opacity = isValid ? '1' : '0.5';

    // 显示或隐藏错误信息
    if (errorMessage) {
      this.showError(errorMessage);
    } else {
      this.hideError();
    }
  }

  private showError(message: string): void {
    const errorEl = document.getElementById('create-folder-error');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.style.display = 'block';
    }
  }

  private hideError(): void {
    const errorEl = document.getElementById('create-folder-error');
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  }

  private async createFolder(): Promise<void> {
    const nameInput = document.getElementById('create-folder-name') as HTMLInputElement;
    if (!nameInput) return;

    const folderName = nameInput.value.trim();
    if (!folderName) return;

    const confirmBtn = document.getElementById('create-folder-confirm-btn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('create-folder-cancel-btn') as HTMLButtonElement;
    
    // 禁用按钮
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    confirmBtn.textContent = '创建中...';

    try {
      // 构建完整路径
      const fullPath = `${this.currentParentDir}/${folderName}`;
      
      // 调用后端API创建文件夹
      await (window as any).__TAURI__.core.invoke('sftp_create_directory', {
        remotePath: fullPath
      });

      (window as any).showNotification && (window as any).showNotification(`文件夹创建成功: ${folderName}`, 'success');
      
      // 刷新文件列表
      if ((window as any).sftpManager && (window as any).sftpManager.refreshCurrentDirectory) {
        (window as any).sftpManager.refreshCurrentDirectory();
      }

      this.hide();

    } catch (error) {
      console.error('创建文件夹失败:', error);
      (window as any).showNotification && (window as any).showNotification(`创建文件夹失败: ${error}`, 'error');
      this.showError(`创建失败: ${error}`);
    } finally {
      // 恢复按钮状态
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      confirmBtn.textContent = '创建';
    }
  }
}


