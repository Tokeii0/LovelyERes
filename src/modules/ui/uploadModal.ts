/**
 * 文件上传模态对话框
 */

export class UploadModal {
  private modal: HTMLElement | null = null;
  private isVisible: boolean = false;
  private currentTargetDir: string = '';
  private selectedFiles: File[] = [];

  constructor() {
    this.createModal();
    this.setupEventListeners();
  }

  private createModal(): void {
    // 创建模态容器
    this.modal = document.createElement('div');
    this.modal.id = 'upload-modal';
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
          width: 600px;
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
            <h3 id="upload-modal-title" style="
              margin: 0;
              color: var(--text-primary);
              font-size: 16px;
              font-weight: 600;
            ">文件上传</h3>
            <button id="upload-modal-close" style="
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
            <!-- 目标目录 -->
            <div style="margin-bottom: var(--spacing-md);">
              <label style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
              ">上传到目录</label>
              <div id="upload-target-dir" style="
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

            <!-- 文件选择区域 -->
            <div style="margin-bottom: var(--spacing-md);">
              <label style="
                display: block;
                margin-bottom: var(--spacing-xs);
                color: var(--text-secondary);
                font-size: 12px;
                font-weight: 500;
              ">选择文件</label>
              
              <!-- 拖拽区域 -->
              <div id="upload-drop-zone" style="
                border: 2px dashed var(--border-color);
                border-radius: var(--border-radius-sm);
                padding: var(--spacing-lg);
                text-align: center;
                background: var(--bg-secondary);
                cursor: pointer;
                transition: all 0.2s ease;
              ">
                <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: var(--spacing-sm);">
                  📁 拖拽文件到此处或点击选择文件
                </div>
                <input type="file" id="upload-file-input" multiple style="display: none;">
                <button id="upload-select-btn" class="modern-btn primary" style="
                  padding: var(--spacing-sm) var(--spacing-md);
                  font-size: 12px;
                ">
                  选择文件
                </button>
              </div>
            </div>

            <!-- 文件列表 -->
            <div id="upload-file-list" style="
              margin-bottom: var(--spacing-md);
              max-height: 200px;
              overflow-y: auto;
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius-sm);
              background: var(--bg-secondary);
              display: none;
            ">
              <div style="
                padding: var(--spacing-sm);
                border-bottom: 1px solid var(--border-color);
                background: var(--bg-primary);
                font-size: 12px;
                font-weight: 500;
                color: var(--text-secondary);
              ">
                已选择的文件
              </div>
              <div id="upload-file-items"></div>
            </div>

            <!-- 上传进度 -->
            <div id="upload-progress-container" style="
              margin-bottom: var(--spacing-md);
              display: none;
            ">
              <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: var(--spacing-xs);
              ">
                <span style="font-size: 12px; color: var(--text-secondary);">上传进度</span>
                <span id="upload-progress-text" style="font-size: 12px; color: var(--text-secondary);">0%</span>
              </div>
              <div style="
                width: 100%;
                height: 8px;
                background: var(--bg-secondary);
                border-radius: 4px;
                overflow: hidden;
              ">
                <div id="upload-progress-bar" style="
                  height: 100%;
                  background: var(--success-color);
                  width: 0%;
                  transition: width 0.3s ease;
                "></div>
              </div>
            </div>

            <!-- 操作按钮 -->
            <div style="
              display: flex;
              gap: var(--spacing-sm);
              justify-content: flex-end;
              margin-top: var(--spacing-lg);
            ">
              <button id="upload-cancel-btn" class="modern-btn secondary" style="
                padding: var(--spacing-sm) var(--spacing-md);
                font-size: 12px;
              ">
                取消
              </button>
              <button id="upload-confirm-btn" class="modern-btn" style="
                padding: var(--spacing-sm) var(--spacing-md);
                background: var(--success-color);
                border: 1px solid var(--success-color);
                color: white;
                font-size: 12px;
                opacity: 0.5;
              " disabled>
                开始上传
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
    const closeBtn = document.getElementById('upload-modal-close');
    if (closeBtn) {
      closeBtn.onclick = () => this.hide();
    }

    // 取消按钮
    const cancelBtn = document.getElementById('upload-cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = () => this.hide();
    }

    // 确认按钮
    const confirmBtn = document.getElementById('upload-confirm-btn');
    if (confirmBtn) {
      confirmBtn.onclick = () => this.upload();
    }

    // 文件选择按钮
    const selectBtn = document.getElementById('upload-select-btn');
    const fileInput = document.getElementById('upload-file-input') as HTMLInputElement;

    if (selectBtn && fileInput) {
      selectBtn.onclick = (e) => {
        e.stopPropagation(); // 阻止事件冒泡到拖拽区域
        fileInput.click();
      };
      fileInput.onchange = (e) => this.handleFileSelect(e);
    }

    // 拖拽区域
    const dropZone = document.getElementById('upload-drop-zone');
    if (dropZone) {
      dropZone.onclick = (e) => {
        // 如果点击的是按钮，不触发文件选择（已由按钮处理）
        if ((e.target as HTMLElement).id === 'upload-select-btn') {
          return;
        }
        fileInput?.click();
      };
      
      dropZone.ondragover = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--primary-color)';
        dropZone.style.backgroundColor = 'var(--bg-tertiary)';
      };
      
      dropZone.ondragleave = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.backgroundColor = 'var(--bg-secondary)';
      };
      
      dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.style.borderColor = 'var(--border-color)';
        dropZone.style.backgroundColor = 'var(--bg-secondary)';
        
        const files = Array.from(e.dataTransfer?.files || []);
        this.addFiles(files);
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

  public show(targetDir: string): void {
    if (!this.modal) return;

    this.currentTargetDir = targetDir;
    this.selectedFiles = [];
    this.isVisible = true;

    // 更新目标目录显示
    const targetDirEl = document.getElementById('upload-target-dir');
    if (targetDirEl) {
      targetDirEl.textContent = targetDir;
    }

    // 重置文件输入框的值，确保 onchange 事件能正常触发
    const fileInput = document.getElementById('upload-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }

    // 重置界面状态
    this.updateFileList();
    this.updateUploadButton();
    this.hideProgress();

    this.modal.style.display = 'flex';
  }

  public hide(): void {
    if (!this.modal) return;
    
    this.modal.style.display = 'none';
    this.isVisible = false;
    this.currentTargetDir = '';
    this.selectedFiles = [];
  }

  private handleFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    this.addFiles(files);
  }

  private addFiles(files: File[]): void {
    // 添加新文件到选择列表
    for (const file of files) {
      // 检查是否已存在同名文件
      const exists = this.selectedFiles.some(f => f.name === file.name);
      if (!exists) {
        this.selectedFiles.push(file);
      }
    }
    
    this.updateFileList();
    this.updateUploadButton();
  }

  private updateFileList(): void {
    const fileList = document.getElementById('upload-file-list');
    const fileItems = document.getElementById('upload-file-items');
    
    if (!fileList || !fileItems) return;

    if (this.selectedFiles.length === 0) {
      fileList.style.display = 'none';
      return;
    }

    fileList.style.display = 'block';
    fileItems.innerHTML = this.selectedFiles.map((file, index) => `
      <div style="
        padding: var(--spacing-sm);
        border-bottom: 1px solid var(--border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div style="flex: 1; min-width: 0;">
          <div style="font-size: 12px; color: var(--text-primary); word-break: break-all;">
            ${file.name}
          </div>
          <div style="font-size: 11px; color: var(--text-secondary);">
            ${this.formatFileSize(file.size)}
          </div>
        </div>
        <button onclick="window.uploadModal.removeFile(${index})" style="
          background: none;
          border: none;
          color: var(--text-secondary);
          cursor: pointer;
          padding: 4px;
          font-size: 14px;
        " title="移除文件">
          ✕
        </button>
      </div>
    `).join('');
  }

  private updateUploadButton(): void {
    const confirmBtn = document.getElementById('upload-confirm-btn') as HTMLButtonElement;
    if (!confirmBtn) return;
    
    const hasFiles = this.selectedFiles.length > 0;
    confirmBtn.disabled = !hasFiles;
    confirmBtn.style.opacity = hasFiles ? '1' : '0.5';
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  public removeFile(index: number): void {
    this.selectedFiles.splice(index, 1);
    this.updateFileList();
    this.updateUploadButton();
  }

  private showProgress(): void {
    const progressContainer = document.getElementById('upload-progress-container');
    if (progressContainer) {
      progressContainer.style.display = 'block';
    }
  }

  private hideProgress(): void {
    const progressContainer = document.getElementById('upload-progress-container');
    if (progressContainer) {
      progressContainer.style.display = 'none';
    }
  }

  private updateProgress(percent: number): void {
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');
    
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }
    
    if (progressText) {
      progressText.textContent = `${Math.round(percent)}%`;
    }
  }

  private async upload(): Promise<void> {
    if (this.selectedFiles.length === 0) return;

    const confirmBtn = document.getElementById('upload-confirm-btn') as HTMLButtonElement;
    const cancelBtn = document.getElementById('upload-cancel-btn') as HTMLButtonElement;
    
    // 显示进度并禁用按钮
    this.showProgress();
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    confirmBtn.textContent = '上传中...';

    try {
      const totalFiles = this.selectedFiles.length;
      let completedFiles = 0;

      for (const file of this.selectedFiles) {
        // 构建远程文件路径
        const remotePath = `${this.currentTargetDir}/${file.name}`;
        
        // 将文件转换为临时本地路径（这里需要使用Tauri的文件API）
        const localPath = await this.saveFileTemporarily(file);
        
        try {
          // 调用后端API上传文件
          await (window as any).__TAURI__.core.invoke('sftp_upload', {
            localPath: localPath,
            remotePath: remotePath
          });

          completedFiles++;
          this.updateProgress((completedFiles / totalFiles) * 100);
          
        } catch (error) {
          console.error(`上传文件失败: ${file.name}`, error);
          (window as any).showNotification && (window as any).showNotification(`上传文件失败: ${file.name} - ${error}`, 'error');
        }
      }

      if (completedFiles > 0) {
        (window as any).showNotification && (window as any).showNotification(`成功上传 ${completedFiles} 个文件`, 'success');
        
        // 刷新文件列表
        if ((window as any).sftpManager && (window as any).sftpManager.refreshCurrentDirectory) {
          (window as any).sftpManager.refreshCurrentDirectory();
        }
      }

      this.hide();

    } catch (error) {
      console.error('上传过程中发生错误:', error);
      (window as any).showNotification && (window as any).showNotification(`上传失败: ${error}`, 'error');
    } finally {
      // 恢复按钮状态
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      confirmBtn.textContent = '开始上传';
      this.hideProgress();
    }
  }

  private async saveFileTemporarily(file: File): Promise<string> {
    // 将File对象转换为ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // 调用Tauri命令保存临时文件
    const tempPath = await (window as any).__TAURI__.core.invoke('save_temp_file', {
      fileName: file.name,
      data: Array.from(uint8Array)
    });

    return tempPath;
  }
}
