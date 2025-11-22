/**
 * 文件/文件夹打包模态对话框
 */

export class CompressModal {
  private modal: HTMLElement | null = null;
  private isVisible: boolean = false;
  private currentSourcePath: string = '';

  constructor() {
    this.createModal();
    this.setupEventListeners();
  }

  private createModal(): void {
    // 创建模态容器
    this.modal = document.createElement('div');
    this.modal.id = 'compress-modal';
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
            <h3 id="compress-modal-title" style="
              margin: 0;
              color: var(--text-primary);
              font-size: 16px;
              font-weight: 600;
            ">文件打包</h3>
            <button id="compress-modal-close" style="
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
            <!-- 源文件信息 -->
            <div style="margin-bottom: var(--spacing-md);">
              <label style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
              ">源文件/文件夹</label>
              <div id="compress-source-info" style="
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

            <!-- 压缩格式选择 -->
            <div style="margin-bottom: var(--spacing-md);">
              <label for="compress-format" style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
              ">压缩格式</label>
              <select id="compress-format" style="
                width: 100%;
                padding: var(--spacing-sm);
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                color: var(--text-primary);
                font-size: 12px;
              ">
                <option value="tar.gz">tar.gz (推荐)</option>
                <option value="zip">zip</option>
                <option value="tar">tar (无压缩)</option>
              </select>
            </div>

            <!-- 目标文件名 -->
            <div style="margin-bottom: var(--spacing-md);">
              <label for="compress-target-name" style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
              ">目标文件名</label>
              <input type="text" id="compress-target-name" style="
                width: 100%;
                padding: var(--spacing-sm);
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                color: var(--text-primary);
                font-size: 12px;
                box-sizing: border-box;
              " placeholder="输入压缩文件名">
            </div>

            <!-- 操作按钮 -->
            <div style="
              display: flex;
              gap: var(--spacing-sm);
              justify-content: flex-end;
              margin-top: var(--spacing-lg);
            ">
              <button id="compress-cancel-btn" class="modern-btn secondary" style="
                padding: var(--spacing-sm) var(--spacing-md);
                font-size: 12px;
              ">
                取消
              </button>
              <button id="compress-confirm-btn" class="modern-btn primary" style="
                padding: var(--spacing-sm) var(--spacing-md);
                font-size: 12px;
              ">
                开始打包
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
    const closeBtn = document.getElementById('compress-modal-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.hide();
    }

    // 取消按钮
    const cancelBtn = document.getElementById('compress-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = () => this.hide();
    }

    // 确认按钮
    const confirmBtn = document.getElementById('compress-confirm-btn');
    if (confirmBtn) {
      confirmBtn.onclick = () => this.compress();
    }

    // 格式选择变化时更新文件名
    const formatSelect = document.getElementById('compress-format') as HTMLSelectElement;
    const targetNameInput = document.getElementById('compress-target-name') as HTMLInputElement;
    
    if (formatSelect && targetNameInput) {
      formatSelect.onchange = () => {
        this.updateTargetFileName();
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

  public show(sourcePath: string, fileType: string): void {
    if (!this.modal) return;

    this.currentSourcePath = sourcePath;
    this.isVisible = true;

    // 更新源文件信息
    const sourceInfo = document.getElementById('compress-source-info');
    if (sourceInfo) {
      const fileName = sourcePath.split('/').pop() || sourcePath;
      const typeText = fileType === 'directory' ? '文件夹' : '文件';
      sourceInfo.textContent = `${fileName} (${typeText})`;
    }

    // 生成默认文件名
    this.updateTargetFileName();

    this.modal.style.display = 'flex';
  }

  public hide(): void {
    if (!this.modal) return;
    
    this.modal.style.display = 'none';
    this.isVisible = false;
    this.currentSourcePath = '';
  }

  private updateTargetFileName(): void {
    const formatSelect = document.getElementById('compress-format') as HTMLSelectElement;
    const targetNameInput = document.getElementById('compress-target-name') as HTMLInputElement;

    if (!formatSelect || !targetNameInput || !this.currentSourcePath) return;

    const fileName = this.currentSourcePath.split('/').pop() || 'archive';
    const format = formatSelect.value;

    // 移除原有扩展名（如果有）
    let baseName = fileName.replace(/\.[^/.]+$/, '');

    // 清理文件名：替换特殊字符为连字符
    baseName = baseName
      .replace(/[\/\\:*?"<>|]/g, '-')  // 替换文件系统不允许的字符
      .replace(/\s+/g, '-')           // 替换空格为连字符
      .replace(/-+/g, '-')            // 合并多个连字符
      .replace(/^-|-$/g, '');         // 移除开头和结尾的连字符

    // 如果清理后为空，使用默认名称
    if (!baseName) {
      baseName = 'archive';
    }

    targetNameInput.value = `${baseName}.${format}`;
  }

  private async compress(): Promise<void> {
    const formatSelect = document.getElementById('compress-format') as HTMLSelectElement;
    const targetNameInput = document.getElementById('compress-target-name') as HTMLInputElement;
    const confirmBtn = document.getElementById('compress-confirm-btn') as HTMLButtonElement;
    
    if (!formatSelect || !targetNameInput || !confirmBtn) return;

    const format = formatSelect.value;
    const targetName = targetNameInput.value.trim();
    
    if (!targetName) {
      (window as any).showNotification && (window as any).showNotification('请输入目标文件名', 'warning');
      return;
    }

    // 构建目标路径
    // 优先使用当前SFTP目录，如果无法获取则使用源文件目录
    let targetDir = '/tmp'; // 默认使用临时目录

    try {
      // 尝试获取当前SFTP目录
      const currentPath = (window as any).sftpManager?.getCurrentPath?.();
      if (currentPath) {
        targetDir = currentPath;
      } else {
        // 使用源文件所在目录
        const sourceDir = this.currentSourcePath.substring(0, this.currentSourcePath.lastIndexOf('/'));
        if (sourceDir) {
          targetDir = sourceDir;
        }
      }
    } catch (e) {
      console.warn('无法获取目标目录，使用默认目录:', e);
    }

    const targetPath = `${targetDir}/${targetName}`;

    // 显示处理中状态
    confirmBtn.textContent = '打包中...';
    confirmBtn.disabled = true;

    try {
      // 调用后端API进行压缩
      await (window as any).__TAURI__.core.invoke('sftp_compress', {
        sourcePath: this.currentSourcePath,
        targetPath: targetPath,
        format: format
      });

      console.log('文件打包成功:', targetPath);
      (window as any).showNotification && (window as any).showNotification('文件打包成功', 'success');

      // 刷新文件列表
      if ((window as any).sftpManager && (window as any).sftpManager.refreshCurrentDirectory) {
        (window as any).sftpManager.refreshCurrentDirectory();
      }

      this.hide();

    } catch (error) {
      console.error('文件打包失败:', error);
      (window as any).showNotification && (window as any).showNotification(`文件打包失败: ${error}`, 'error');
    } finally {
      // 恢复按钮状态
      confirmBtn.textContent = '开始打包';
      confirmBtn.disabled = false;
    }
  }
}


