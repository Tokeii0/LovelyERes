/**
 * 压缩文件解压模态对话框
 */

export class ExtractModal {
  private modal: HTMLElement | null = null;
  private isVisible: boolean = false;
  private currentArchivePath: string = '';

  constructor() {
    this.createModal();
    this.setupEventListeners();
  }

  private createModal(): void {
    // 创建模态容器
    this.modal = document.createElement('div');
    this.modal.id = 'extract-modal';
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
          width: 500px;
          max-width: 90vw;
          max-height: 80vh;
          overflow: auto;
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
            <h3 id="extract-modal-title" style="
              margin: 0;
              color: var(--text-primary);
              font-size: 16px;
              font-weight: 600;
            ">文件解压</h3>
            <button id="extract-modal-close" style="
              background: none;
              border: none;
              color: var(--text-secondary);
              font-size: 18px;
              cursor: pointer;
              padding: 4px;
              border-radius: var(--border-radius-sm);
              transition: var(--transition);
            " onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='none'">
              ✕
            </button>
          </div>

          <!-- 内容区域 -->
          <div style="padding: var(--spacing-md);">
            <!-- 压缩文件信息 -->
            <div style="margin-bottom: var(--spacing-md);">
              <label style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
              ">压缩文件</label>
              <div id="extract-archive-info" style="
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

            <!-- 解压目录 -->
            <div style="margin-bottom: var(--spacing-md);">
              <label for="extract-target-dir" style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
              ">解压到目录</label>
              <div style="display: flex; gap: var(--spacing-xs);">
                <input type="text" id="extract-target-dir" style="
                  flex: 1;
                  padding: var(--spacing-sm);
                  background: var(--bg-secondary);
                  border: 1px solid var(--border-color);
                  border-radius: var(--border-radius-sm);
                  color: var(--text-primary);
                  font-size: 12px;
                  font-family: monospace;
                " placeholder="输入解压目录路径">
                <button id="extract-current-dir-btn" style="
                  padding: var(--spacing-sm);
                  background: var(--bg-secondary);
                  border: 1px solid var(--border-color);
                  border-radius: var(--border-radius-sm);
                  color: var(--text-primary);
                  font-size: 12px;
                  cursor: pointer;
                  white-space: nowrap;
                " onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='var(--bg-secondary)'">
                  当前目录
                </button>
              </div>
              <div style="
                margin-top: var(--spacing-xs);
                font-size: 11px;
                color: var(--text-secondary);
              ">
                提示：留空将解压到压缩文件所在目录
              </div>
            </div>

            <!-- 解压选项 -->
            <div style="margin-bottom: var(--spacing-md);">
              <label style="
                display: block;
                margin-bottom: var(--spacing-sm);
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
              ">解压选项</label>
              
              <div style="display: flex; align-items: center; margin-bottom: var(--spacing-xs);">
                <input type="checkbox" id="extract-overwrite" style="
                  margin-right: var(--spacing-xs);
                ">
                <label for="extract-overwrite" style="
                  color: var(--text-primary);
                  font-size: 12px;
                  cursor: pointer;
                ">覆盖已存在的文件</label>
              </div>
              
              <div style="
                font-size: 11px;
                color: var(--text-secondary);
                margin-left: 20px;
              ">
                如果不勾选，遇到同名文件将跳过
              </div>
            </div>

            <!-- 操作按钮 -->
            <div style="
              display: flex;
              gap: var(--spacing-sm);
              justify-content: flex-end;
              margin-top: var(--spacing-lg);
            ">
              <button id="extract-cancel-btn" class="modern-btn secondary" style="
                padding: var(--spacing-sm) var(--spacing-md);
                font-size: 12px;
              ">
                取消
              </button>
              <button id="extract-confirm-btn" class="modern-btn" style="
                padding: var(--spacing-sm) var(--spacing-md);
                background: var(--success-color);
                border: 1px solid var(--success-color);
                color: white;
                font-size: 12px;
              ">
                开始解压
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
    const closeBtn = document.getElementById('extract-modal-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.hide();
    }

    // 取消按钮
    const cancelBtn = document.getElementById('extract-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = () => this.hide();
    }

    // 确认按钮
    const confirmBtn = document.getElementById('extract-confirm-btn');
    if (confirmBtn) {
      confirmBtn.onclick = () => this.extract();
    }

    // 当前目录按钮
    const currentDirBtn = document.getElementById('extract-current-dir-btn');
    const targetDirInput = document.getElementById('extract-target-dir') as HTMLInputElement;
    
    if (currentDirBtn && targetDirInput) {
      currentDirBtn.onclick = () => {
        // 获取当前SFTP目录
        const currentPath = (window as any).sftpManager?.getCurrentPath?.() || '/';
        targetDirInput.value = currentPath;
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

  public show(archivePath: string): void {
    if (!this.modal) return;

    this.currentArchivePath = archivePath;
    this.isVisible = true;

    // 更新压缩文件信息
    const archiveInfo = document.getElementById('extract-archive-info');
    if (archiveInfo) {
      const fileName = archivePath.split('/').pop() || archivePath;
      archiveInfo.textContent = fileName;
    }

    // 设置默认解压目录（压缩文件所在目录）
    const targetDirInput = document.getElementById('extract-target-dir') as HTMLInputElement;
    if (targetDirInput) {
      const archiveDir = archivePath.substring(0, archivePath.lastIndexOf('/')) || '/';
      targetDirInput.value = archiveDir;
    }

    this.modal.style.display = 'flex';
  }

  public hide(): void {
    if (!this.modal) return;
    
    this.modal.style.display = 'none';
    this.isVisible = false;
    this.currentArchivePath = '';
  }

  private async extract(): Promise<void> {
    const targetDirInput = document.getElementById('extract-target-dir') as HTMLInputElement;
    const overwriteCheckbox = document.getElementById('extract-overwrite') as HTMLInputElement;
    const confirmBtn = document.getElementById('extract-confirm-btn') as HTMLButtonElement;
    
    if (!targetDirInput || !overwriteCheckbox || !confirmBtn) return;

    let targetDir = targetDirInput.value.trim();
    const overwrite = overwriteCheckbox.checked;
    
    // 如果没有指定目录，使用压缩文件所在目录
    if (!targetDir) {
      targetDir = this.currentArchivePath.substring(0, this.currentArchivePath.lastIndexOf('/')) || '/';
    }

    // 显示处理中状态
    confirmBtn.textContent = '解压中...';
    confirmBtn.disabled = true;

    try {
      // 调用后端API进行解压
      await (window as any).__TAURI__.core.invoke('sftp_extract', {
        archivePath: this.currentArchivePath,
        targetDir: targetDir,
        overwrite: overwrite
      });

      console.log('文件解压成功:', targetDir);
      (window as any).showNotification && (window as any).showNotification('文件解压成功', 'success');

      // 刷新文件列表
      if ((window as any).sftpManager && (window as any).sftpManager.refreshCurrentDirectory) {
        (window as any).sftpManager.refreshCurrentDirectory();
      }

      this.hide();

    } catch (error) {
      console.error('文件解压失败:', error);
      (window as any).showNotification && (window as any).showNotification(`文件解压失败: ${error}`, 'error');
    } finally {
      // 恢复按钮状态
      confirmBtn.textContent = '开始解压';
      confirmBtn.disabled = false;
    }
  }
}
