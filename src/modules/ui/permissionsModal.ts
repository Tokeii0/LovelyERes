// LovelyRes - 权限编辑模态组件
// 提供用户友好的权限编辑界面

export class PermissionsModal {
  private modal: HTMLElement | null = null;
  private isVisible: boolean = false;
  private currentFilePath: string = '';
  private currentPermissions: string = '';

  constructor() {
    this.createModal();
    this.bindEvents();
  }

  private createModal(): void {
    const modalHTML = `
      <div id="permissions-modal" class="modal-overlay" style="
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
          width: 500px;
          background: var(--bg-primary);
          border-radius: var(--border-radius-lg);
          border: 1px solid var(--border-color);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
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
            <h3 style="
              margin: 0;
              font-size: 16px;
              font-weight: 600;
              color: var(--text-primary);
            ">修改权限</h3>
            <button id="permissions-close-btn" style="
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

          <!-- 模态内容 -->
          <div class="modal-body" style="
            padding: var(--spacing-lg);
          ">
            <!-- 文件路径 -->
            <div style="margin-bottom: var(--spacing-lg);">
              <label style="
                display: block;
                font-size: 12px;
                color: var(--text-secondary);
                margin-bottom: var(--spacing-xs);
              ">文件路径</label>
              <div id="permissions-file-path" style="
                padding: var(--spacing-sm);
                background: var(--bg-secondary);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-sm);
                font-family: monospace;
                font-size: 12px;
                color: var(--text-primary);
                word-break: break-all;
              "></div>
            </div>

            <!-- 当前权限 -->
            <div style="margin-bottom: var(--spacing-lg);">
              <label style="
                display: block;
                font-size: 12px;
                color: var(--text-secondary);
                margin-bottom: var(--spacing-xs);
              ">当前权限</label>
              <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                <span id="permissions-current-octal" style="
                  font-family: monospace;
                  font-size: 14px;
                  font-weight: 600;
                  color: var(--primary-color);
                "></span>
                <span style="color: var(--text-secondary);">|</span>
                <span id="permissions-current-symbolic" style="
                  font-family: monospace;
                  font-size: 14px;
                  color: var(--text-primary);
                "></span>
              </div>
            </div>

            <!-- 权限编辑器 -->
            <div style="margin-bottom: var(--spacing-lg);">
              <label style="
                display: block;
                font-size: 12px;
                color: var(--text-secondary);
                margin-bottom: var(--spacing-sm);
              ">设置权限</label>
              
              <div style="
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius-md);
                overflow: hidden;
              ">
                <!-- 表头 -->
                <div style="
                  display: grid;
                  grid-template-columns: 80px 1fr 1fr 1fr;
                  background: var(--bg-secondary);
                  border-bottom: 1px solid var(--border-color);
                  font-size: 12px;
                  font-weight: 600;
                  color: var(--text-secondary);
                ">
                  <div style="padding: var(--spacing-sm); text-align: center;"></div>
                  <div style="padding: var(--spacing-sm); text-align: center;">读取 (r)</div>
                  <div style="padding: var(--spacing-sm); text-align: center;">写入 (w)</div>
                  <div style="padding: var(--spacing-sm); text-align: center;">执行 (x)</div>
                </div>

                <!-- 用户权限 -->
                <div style="
                  display: grid;
                  grid-template-columns: 80px 1fr 1fr 1fr;
                  border-bottom: 1px solid var(--border-color);
                ">
                  <div style="
                    padding: var(--spacing-sm);
                    font-size: 12px;
                    color: var(--text-primary);
                    display: flex;
                    align-items: center;
                  ">用户 (u)</div>
                  <div style="padding: var(--spacing-sm); text-align: center;">
                    <input type="checkbox" id="perm-user-read" style="cursor: pointer;">
                  </div>
                  <div style="padding: var(--spacing-sm); text-align: center;">
                    <input type="checkbox" id="perm-user-write" style="cursor: pointer;">
                  </div>
                  <div style="padding: var(--spacing-sm); text-align: center;">
                    <input type="checkbox" id="perm-user-execute" style="cursor: pointer;">
                  </div>
                </div>

                <!-- 组权限 -->
                <div style="
                  display: grid;
                  grid-template-columns: 80px 1fr 1fr 1fr;
                  border-bottom: 1px solid var(--border-color);
                ">
                  <div style="
                    padding: var(--spacing-sm);
                    font-size: 12px;
                    color: var(--text-primary);
                    display: flex;
                    align-items: center;
                  ">组 (g)</div>
                  <div style="padding: var(--spacing-sm); text-align: center;">
                    <input type="checkbox" id="perm-group-read" style="cursor: pointer;">
                  </div>
                  <div style="padding: var(--spacing-sm); text-align: center;">
                    <input type="checkbox" id="perm-group-write" style="cursor: pointer;">
                  </div>
                  <div style="padding: var(--spacing-sm); text-align: center;">
                    <input type="checkbox" id="perm-group-execute" style="cursor: pointer;">
                  </div>
                </div>

                <!-- 其他权限 -->
                <div style="
                  display: grid;
                  grid-template-columns: 80px 1fr 1fr 1fr;
                ">
                  <div style="
                    padding: var(--spacing-sm);
                    font-size: 12px;
                    color: var(--text-primary);
                    display: flex;
                    align-items: center;
                  ">其他 (o)</div>
                  <div style="padding: var(--spacing-sm); text-align: center;">
                    <input type="checkbox" id="perm-other-read" style="cursor: pointer;">
                  </div>
                  <div style="padding: var(--spacing-sm); text-align: center;">
                    <input type="checkbox" id="perm-other-write" style="cursor: pointer;">
                  </div>
                  <div style="padding: var(--spacing-sm); text-align: center;">
                    <input type="checkbox" id="perm-other-execute" style="cursor: pointer;">
                  </div>
                </div>
              </div>
            </div>

            <!-- 新权限预览 -->
            <div style="margin-bottom: var(--spacing-lg);">
              <label style="
                display: block;
                font-size: 12px;
                color: var(--text-secondary);
                margin-bottom: var(--spacing-xs);
              ">新权限预览</label>
              <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                <span id="permissions-new-octal" style="
                  font-family: monospace;
                  font-size: 14px;
                  font-weight: 600;
                  color: var(--success-color);
                ">644</span>
                <span style="color: var(--text-secondary);">|</span>
                <span id="permissions-new-symbolic" style="
                  font-family: monospace;
                  font-size: 14px;
                  color: var(--text-primary);
                ">rw-r--r--</span>
              </div>
            </div>

            <!-- 按钮组 -->
            <div style="
              display: flex;
              justify-content: flex-end;
              gap: var(--spacing-sm);
            ">
              <button id="permissions-cancel-btn" class="modern-btn secondary" style="
                padding: var(--spacing-sm) var(--spacing-md);
                font-size: 12px;
              ">取消</button>
              <button id="permissions-apply-btn" class="modern-btn primary" style="
                padding: var(--spacing-sm) var(--spacing-md);
                font-size: 12px;
              ">应用</button>
            </div>
          </div>
        </div>
      </div>

      <style>
        #permissions-close-btn:hover {
          background: var(--bg-tertiary) !important;
        }
      </style>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    this.modal = document.getElementById('permissions-modal');
  }

  private bindEvents(): void {
    // 关闭按钮
    document.getElementById('permissions-close-btn')?.addEventListener('click', () => {
      this.hide();
    });

    // 取消按钮
    document.getElementById('permissions-cancel-btn')?.addEventListener('click', () => {
      this.hide();
    });

    // 应用按钮
    document.getElementById('permissions-apply-btn')?.addEventListener('click', () => {
      this.applyPermissions();
    });

    // 点击遮罩关闭
    this.modal?.addEventListener('click', (e) => {
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

    // 权限复选框变化事件
    const checkboxes = [
      'perm-user-read', 'perm-user-write', 'perm-user-execute',
      'perm-group-read', 'perm-group-write', 'perm-group-execute',
      'perm-other-read', 'perm-other-write', 'perm-other-execute'
    ];

    checkboxes.forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => {
        this.updatePermissionPreview();
      });
    });
  }

  public show(filePath: string, currentPermissions: string): void {
    this.currentFilePath = filePath;
    this.currentPermissions = currentPermissions;
    
    if (!this.modal) return;

    // 显示模态
    this.modal.style.display = 'block';
    this.isVisible = true;

    // 更新文件路径
    const pathEl = document.getElementById('permissions-file-path');
    if (pathEl) pathEl.textContent = filePath;

    // 更新当前权限显示
    this.updateCurrentPermissions();

    // 设置复选框状态
    this.setCheckboxesFromPermissions(currentPermissions);

    // 更新预览
    this.updatePermissionPreview();
  }

  public hide(): void {
    if (!this.modal) return;
    
    this.modal.style.display = 'none';
    this.isVisible = false;
    this.currentFilePath = '';
    this.currentPermissions = '';
  }

  private updateCurrentPermissions(): void {
    const octalEl = document.getElementById('permissions-current-octal');
    const symbolicEl = document.getElementById('permissions-current-symbolic');

    if (octalEl) octalEl.textContent = this.currentPermissions;
    if (symbolicEl) symbolicEl.textContent = this.octalToSymbolic(this.currentPermissions);
  }

  private setCheckboxesFromPermissions(octal: string): void {
    const mode = parseInt(octal, 8);
    
    // 用户权限
    (document.getElementById('perm-user-read') as HTMLInputElement).checked = !!(mode & 0o400);
    (document.getElementById('perm-user-write') as HTMLInputElement).checked = !!(mode & 0o200);
    (document.getElementById('perm-user-execute') as HTMLInputElement).checked = !!(mode & 0o100);

    // 组权限
    (document.getElementById('perm-group-read') as HTMLInputElement).checked = !!(mode & 0o040);
    (document.getElementById('perm-group-write') as HTMLInputElement).checked = !!(mode & 0o020);
    (document.getElementById('perm-group-execute') as HTMLInputElement).checked = !!(mode & 0o010);

    // 其他权限
    (document.getElementById('perm-other-read') as HTMLInputElement).checked = !!(mode & 0o004);
    (document.getElementById('perm-other-write') as HTMLInputElement).checked = !!(mode & 0o002);
    (document.getElementById('perm-other-execute') as HTMLInputElement).checked = !!(mode & 0o001);
  }

  private updatePermissionPreview(): void {
    const mode = this.getPermissionsFromCheckboxes();
    const octal = mode.toString(8).padStart(3, '0');
    const symbolic = this.octalToSymbolic(octal);

    const octalEl = document.getElementById('permissions-new-octal');
    const symbolicEl = document.getElementById('permissions-new-symbolic');

    if (octalEl) octalEl.textContent = octal;
    if (symbolicEl) symbolicEl.textContent = symbolic;
  }

  private getPermissionsFromCheckboxes(): number {
    let mode = 0;

    // 用户权限
    if ((document.getElementById('perm-user-read') as HTMLInputElement).checked) mode |= 0o400;
    if ((document.getElementById('perm-user-write') as HTMLInputElement).checked) mode |= 0o200;
    if ((document.getElementById('perm-user-execute') as HTMLInputElement).checked) mode |= 0o100;

    // 组权限
    if ((document.getElementById('perm-group-read') as HTMLInputElement).checked) mode |= 0o040;
    if ((document.getElementById('perm-group-write') as HTMLInputElement).checked) mode |= 0o020;
    if ((document.getElementById('perm-group-execute') as HTMLInputElement).checked) mode |= 0o010;

    // 其他权限
    if ((document.getElementById('perm-other-read') as HTMLInputElement).checked) mode |= 0o004;
    if ((document.getElementById('perm-other-write') as HTMLInputElement).checked) mode |= 0o002;
    if ((document.getElementById('perm-other-execute') as HTMLInputElement).checked) mode |= 0o001;

    return mode;
  }

  private octalToSymbolic(octal: string): string {
    const mode = parseInt(octal, 8);
    
    const toTriplet = (n: number) => {
      const r = (n & 4) ? 'r' : '-';
      const w = (n & 2) ? 'w' : '-';
      const x = (n & 1) ? 'x' : '-';
      return r + w + x;
    };

    const user = toTriplet((mode >> 6) & 7);
    const group = toTriplet((mode >> 3) & 7);
    const other = toTriplet(mode & 7);

    return user + group + other;
  }

  private async applyPermissions(): Promise<void> {
    const newMode = this.getPermissionsFromCheckboxes();
    
    try {
      await (window as any).__TAURI__.core.invoke('sftp_chmod', {
        path: this.currentFilePath,
        mode: newMode
      });

      console.log(`权限修改成功: ${this.currentFilePath} -> ${newMode.toString(8)}`);
      
      // 刷新SFTP文件列表
      if ((window as any).sftpManager && (window as any).sftpManager.refreshFileList) {
        await (window as any).sftpManager.refreshFileList();
      }

      this.hide();

    } catch (error) {
      console.error('修改权限失败:', error);
      (window as any).showNotification && (window as any).showNotification(`修改权限失败: ${error}`, 'error');
    }
  }
}
