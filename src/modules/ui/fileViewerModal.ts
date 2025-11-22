// LovelyRes - 文件查看/编辑模态组件
// 支持语法高亮的文件查看和编辑功能

export class FileViewerModal {
  private modal: HTMLElement | null = null;
  private isVisible: boolean = false;
  private currentFilePath: string = '';
  private currentFileContent: string = '';
  private isReadOnly: boolean = true;
  private isModified: boolean = false;

  constructor() {
    this.createModal();
    this.bindEvents();
  }

  private createModal(): void {
    const modalHTML = `
      <div id="file-viewer-modal" class="modal-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: none;
        z-index: 10000;
        backdrop-filter: blur(4px);
      ">
        <div class="modal-content" style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 1200px;
          height: 80%;
          background: var(--bg-primary);
          border-radius: var(--border-radius-lg);
          border: 1px solid var(--border-color);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        ">
          <!-- 模态头部 -->
          <div class="modal-header" style="
            padding: var(--spacing-md);
            border-bottom: 1px solid var(--border-color);
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: var(--bg-secondary);
          ">
            <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
              <h3 id="file-viewer-title" style="
                margin: 0;
                font-size: 16px;
                font-weight: 600;
                color: var(--text-primary);
              ">文件查看器</h3>
              <span id="file-viewer-path" style="
                font-size: 12px;
                color: var(--text-secondary);
                font-family: monospace;
              "></span>
            </div>
            <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
              <button id="file-viewer-edit-btn" style="
                padding: 4px 12px;
                background: var(--primary-color);
                color: white;
                border: none;
                border-radius: var(--border-radius-sm);
                font-size: 12px;
                cursor: pointer;
                transition: background-color 0.2s ease;
              ">编辑</button>
              <button id="file-viewer-save-btn" style="
                padding: 4px 12px;
                background: var(--success-color);
                color: white;
                border: none;
                border-radius: var(--border-radius-sm);
                font-size: 12px;
                cursor: pointer;
                transition: background-color 0.2s ease;
                display: none;
              ">保存</button>
              <button id="file-viewer-close-btn" style="
                padding: 4px 8px;
                background: transparent;
                color: var(--text-secondary);
                border: none;
                border-radius: var(--border-radius-sm);
                font-size: 16px;
                cursor: pointer;
                transition: background-color 0.2s ease;
              ">×</button>
            </div>
          </div>

          <!-- 文件内容区域 -->
          <div class="modal-body" style="
            flex: 1;
            padding: var(--spacing-md);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          ">
            <div id="file-viewer-loading" style="
              display: none;
              text-align: center;
              padding: var(--spacing-xl);
              color: var(--text-secondary);
            ">
              <div style="margin-bottom: var(--spacing-sm);">加载中...</div>
              <div style="
                width: 32px;
                height: 32px;
                border: 3px solid var(--border-color);
                border-top: 3px solid var(--primary-color);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto;
              "></div>
            </div>

            <div id="file-viewer-error" style="
              display: none;
              text-align: center;
              padding: var(--spacing-xl);
              color: var(--error-color);
            ">
              <div id="file-viewer-error-message">加载文件时出错</div>
            </div>

            <div id="file-viewer-content" style="
              flex: 1;
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius-md);
              overflow: hidden;
              background: var(--bg-primary);
            ">
              <pre id="file-viewer-code" style="
                margin: 0;
                padding: var(--spacing-md);
                height: 100%;
                overflow: auto;
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                font-size: 13px;
                line-height: 1.5;
                color: var(--text-primary);
                background: transparent;
                white-space: pre-wrap;
                word-wrap: break-word;
              "><code id="file-viewer-code-content"></code></pre>
              <textarea id="file-viewer-editor" style="
                display: none;
                width: 100%;
                height: 100%;
                padding: var(--spacing-md);
                border: none;
                outline: none;
                resize: none;
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                font-size: 13px;
                line-height: 1.5;
                color: var(--text-primary);
                background: var(--bg-primary);
                white-space: pre;
                overflow-wrap: normal;
                overflow-x: auto;
              "></textarea>
            </div>
          </div>
        </div>
      </div>

      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        #file-viewer-edit-btn:hover {
          background: var(--primary-color-hover) !important;
        }

        #file-viewer-save-btn:hover:not(:disabled) {
          background: var(--success-color-hover) !important;
        }

        #file-viewer-save-btn:disabled {
          cursor: not-allowed !important;
          opacity: 0.5 !important;
        }

        #file-viewer-close-btn:hover {
          background: var(--bg-tertiary) !important;
        }
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('file-viewer-modal');
  }

  private bindEvents(): void {
    // 关闭按钮
    document.getElementById('file-viewer-close-btn')?.addEventListener('click', () => {
      this.hide();
    });

    // 点击遮罩关闭
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hide();
      }
    });

    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (!this.isVisible) return;

      if (e.key === 'Escape') {
        this.hide();
      } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        if (!this.isReadOnly) {
          this.saveFile();
        }
      }
    });

    // 编辑按钮
    document.getElementById('file-viewer-edit-btn')?.addEventListener('click', () => {
      this.toggleEditMode();
    });

    // 保存按钮
    document.getElementById('file-viewer-save-btn')?.addEventListener('click', () => {
      this.saveFile();
    });
  }

  public async show(filePath: string, readOnly: boolean = true): Promise<void> {
    this.currentFilePath = filePath;
    this.isReadOnly = readOnly;

    if (!this.modal) return;

    // 显示模态
    this.modal.style.display = 'block';
    this.isVisible = true;

    // 更新标题和路径
    const titleEl = document.getElementById('file-viewer-title');
    const pathEl = document.getElementById('file-viewer-path');
    const editBtn = document.getElementById('file-viewer-edit-btn');

    if (titleEl) titleEl.textContent = readOnly ? '文件查看器' : '文件编辑器';
    if (pathEl) pathEl.textContent = filePath;
    if (editBtn) editBtn.style.display = readOnly ? 'block' : 'none';

    // 加载文件内容
    await this.loadFile();
  }

  public hide(): void {
    if (!this.modal) return;

    this.modal.style.display = 'none';
    this.isVisible = false;
    this.currentFilePath = '';
    this.currentFileContent = '';
    this.isModified = false;
    this.setViewMode();
  }

  private async loadFile(): Promise<void> {
    const loadingEl = document.getElementById('file-viewer-loading');
    const errorEl = document.getElementById('file-viewer-error');
    const contentEl = document.getElementById('file-viewer-content');

    if (loadingEl) loadingEl.style.display = 'block';
    if (errorEl) errorEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'none';

    try {
      // 调用后端API读取文件
      const content = await (window as any).__TAURI__.core.invoke('sftp_read_file', {
        path: this.currentFilePath,
        maxBytes: 1024 * 1024 // 1MB限制
      });

      this.currentFileContent = content;
      this.displayContent(content);

      if (loadingEl) loadingEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'block';

    } catch (error) {
      console.error('加载文件失败:', error);

      if (loadingEl) loadingEl.style.display = 'none';
      if (errorEl) {
        errorEl.style.display = 'block';
        const errorMsgEl = document.getElementById('file-viewer-error-message');
        if (errorMsgEl) {
          // 检查是否是目录错误
          const errorStr = String(error);
          if (errorStr.includes('不能读取目录') || errorStr.includes('is a directory')) {
            errorMsgEl.textContent = '无法查看目录内容，请选择文件';
          } else {
            errorMsgEl.textContent = `加载文件失败: ${error}`;
          }
        }
      }

      // 如果是目录错误，也显示通知
      const errorStr = String(error);
      if (errorStr.includes('不能读取目录') || errorStr.includes('is a directory')) {
        (window as any).showNotification && (window as any).showNotification('无法查看目录，请选择文件', 'warning');
      }
    }
  }

  private displayContent(content: string): void {
    const codeEl = document.getElementById('file-viewer-code-content');
    if (!codeEl) return;

    // 清除之前的高亮状态
    delete codeEl.dataset.highlighted;
    codeEl.className = '';

    // 设置内容
    codeEl.textContent = content;

    // 尝试应用语法高亮（如果有highlight.js）
    if ((window as any).hljs) {
      try {
        (window as any).hljs.highlightElement(codeEl);
      } catch (e) {
        console.warn('语法高亮失败:', e);
      }
    }
  }

  private toggleEditMode(): void {
    if (this.isReadOnly) {
      this.setEditMode();
    } else {
      this.setViewMode();
    }
  }

  private setEditMode(): void {
    const codeEl = document.getElementById('file-viewer-code');
    const editorEl = document.getElementById('file-viewer-editor') as HTMLTextAreaElement;
    const editBtn = document.getElementById('file-viewer-edit-btn');
    const saveBtn = document.getElementById('file-viewer-save-btn');

    if (codeEl) codeEl.style.display = 'none';
    if (editorEl) {
      editorEl.style.display = 'block';
      editorEl.value = this.currentFileContent;
      editorEl.focus();

      // 监听内容变化
      editorEl.addEventListener('input', () => {
        this.isModified = editorEl.value !== this.currentFileContent;
        this.updateTitle();
        this.updateSaveButton();
      });
    }
    if (editBtn) editBtn.style.display = 'none';
    if (saveBtn) saveBtn.style.display = 'block';

    this.isReadOnly = false;
    this.isModified = false;
    this.updateTitle();
  }

  private setViewMode(): void {
    const codeEl = document.getElementById('file-viewer-code');
    const editorEl = document.getElementById('file-viewer-editor');
    const editBtn = document.getElementById('file-viewer-edit-btn');
    const saveBtn = document.getElementById('file-viewer-save-btn');

    if (codeEl) codeEl.style.display = 'block';
    if (editorEl) editorEl.style.display = 'none';
    if (editBtn) editBtn.style.display = 'block';
    if (saveBtn) saveBtn.style.display = 'none';

    this.isReadOnly = true;
    this.isModified = false;
    this.updateTitle();
  }

  private async saveFile(): Promise<void> {
    const editorEl = document.getElementById('file-viewer-editor') as HTMLTextAreaElement;
    if (!editorEl) return;

    const newContent = editorEl.value;
    const saveBtn = document.getElementById('file-viewer-save-btn');

    // 显示保存中状态
    if (saveBtn) {
      saveBtn.textContent = '保存中...';
      (saveBtn as HTMLButtonElement).disabled = true;
    }

    try {
      // 调用后端API保存文件
      await (window as any).__TAURI__.core.invoke('sftp_write_file', {
        path: this.currentFilePath,
        content: newContent
      });

      console.log('文件保存成功:', this.currentFilePath);
      (window as any).showNotification && (window as any).showNotification('文件保存成功', 'success');

      this.currentFileContent = newContent;
      this.displayContent(newContent);
      this.isModified = false;
      this.updateTitle();
      this.updateSaveButton();
      this.setViewMode();

    } catch (error) {
      console.error('保存文件失败:', error);
      (window as any).showNotification && (window as any).showNotification(`保存文件失败: ${error}`, 'error');
    } finally {
      // 恢复保存按钮状态
      if (saveBtn) {
        saveBtn.textContent = '保存';
        (saveBtn as HTMLButtonElement).disabled = false;
      }
    }
  }

  private updateTitle(): void {
    const titleEl = document.getElementById('file-viewer-title');
    if (!titleEl) return;

    const baseTitle = this.isReadOnly ? '文件查看器' : '文件编辑器';
    const modifiedIndicator = this.isModified ? ' *' : '';
    titleEl.textContent = baseTitle + modifiedIndicator;
  }

  private updateSaveButton(): void {
    const saveBtn = document.getElementById('file-viewer-save-btn') as HTMLButtonElement;
    if (!saveBtn) return;

    saveBtn.disabled = !this.isModified;
    saveBtn.style.opacity = this.isModified ? '1' : '0.5';
  }
}
