/**
 * 全局函数注册模块
 * 将 (window as any).xxx = ... 集中管理
 *
 * 从 main.ts 提取，原位置: 第 204–510 行
 * 这些函数是 HTML 模板中 onclick 等属性所需要的全局入口点，
 * 暂时保留 (window as any) 方式，后续可逐步迁移到 eventBus。
 */

import type { LovelyResApp } from '../core/app';
import { sftpManager } from '../remote/sftpManager';
import { sshConnectionManager } from '../remote/sshConnectionManager';
import { sshConnectionDialog } from '../ui/sshConnectionDialog';
import { remoteOperationsManager } from '../remote/remoteOperationsManager';
import { dockerPageManager } from '../docker/dockerPageManager';
import { emergencyPageManager } from '../emergency/emergencyPageManager';
import { quickDetectionManager } from '../detection/quickDetectionManager';
import { sshTerminalManager } from '../ssh/sshTerminalManager';
import type { SettingsPageManager } from '../settings/settingsPageManager';

interface GlobalFunctionsDeps {
  app: LovelyResApp;
  settingsPageManager: SettingsPageManager;
  openSSHTerminalWindow: () => Promise<void>;
}

/**
 * 注册所有全局函数到 window 对象
 */
export function initGlobalFunctions(deps: GlobalFunctionsDeps): void {
  const { app, settingsPageManager, openSSHTerminalWindow } = deps;

  // ──── SFTP 面板全局函数 ────
  (window as any).sftpRefresh = () => {
    try {
      if (sftpManager && (sftpManager as any).refreshCurrentDirectory) {
        (sftpManager as any).refreshCurrentDirectory();
        (window as any).showNotification && (window as any).showNotification('文件列表已刷新', 'success');
      }
    } catch (e) {
      console.error('刷新失败:', e);
      (window as any).showNotification && (window as any).showNotification(`刷新失败: ${e}`, 'error');
    }
  };

  (window as any).sftpOpenUpload = () => {
    try {
      if (sftpManager && (sftpManager as any).getCurrentPath && (window as any).uploadModal) {
        (window as any).uploadModal.show((sftpManager as any).getCurrentPath());
      }
    } catch (e) {
      console.error('打开上传对话框失败:', e);
    }
  };

  (window as any).sftpOpenCreateFolder = () => {
    try {
      if (sftpManager && (sftpManager as any).getCurrentPath && (window as any).createFolderModal) {
        (window as any).createFolderModal.show((sftpManager as any).getCurrentPath());
      }
    } catch (e) {
      console.error('打开新建文件夹对话框失败:', e);
    }
  };

  (window as any).toggleSftpHistory = () => {
    try {
      if ((window as any).fileContextMenu && (window as any).fileContextMenu.showHistoryModal) {
        (window as any).fileContextMenu.showHistoryModal();
      }
    } catch (e) {
      console.error('显示历史记录失败:', e);
    }
  };

  (window as any).setSftpSortMode = (mode: 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'modified-asc' | 'modified-desc') => {
    try { sftpManager.setSortMode(mode); } catch (e) { console.error('设置排序方式失败:', e); }
  };

  // ──── SFTP 新建文件 ────
  (window as any).sftpCreateFile = () => {
    try {
      const currentPath = sftpManager.getCurrentPath();
      const fileName = prompt('请输入文件名:', 'new_file.txt');
      if (!fileName || !fileName.trim()) return;

      const fullPath = currentPath === '/'
        ? `/${fileName.trim()}`
        : `${currentPath}/${fileName.trim()}`;

      // Write empty file via existing sftp_write_file command
      (window as any).__TAURI__.core.invoke('sftp_write_file', {
        path: fullPath,
        content: ''
      }).then(() => {
        (window as any).showNotification && (window as any).showNotification(`文件已创建: ${fileName}`, 'success');
        sftpManager.refreshCurrentDirectory();
      }).catch((e: any) => {
        (window as any).showNotification && (window as any).showNotification(`创建文件失败: ${e}`, 'error');
      });
    } catch (e) {
      console.error('创建文件失败:', e);
    }
  };

  // ──── SFTP 完整性快照 ────
  (window as any).sftpIntegritySnapshot = () => {
    try {
      const currentPath = sftpManager.getCurrentPath();
      if (!confirm(`将为 ${currentPath} 目录生成文件哈希清单（md5sum），是否继续？`)) return;

      (window as any).showNotification && (window as any).showNotification('正在生成完整性快照...', 'info');

      const cmd = `find "${currentPath}" -maxdepth 1 -type f -exec md5sum {} \\; 2>/dev/null | sort -k2`;
      (window as any).__TAURI__.core.invoke('ssh_execute_command_direct', { command: cmd })
        .then((result: any) => {
          const output = result?.output || '(空目录或无文件)';
          // Show in modal
          const modal = document.createElement('div');
          modal.className = 'modal-overlay';
          modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:10000;display:flex;align-items:center;justify-content:center;';
          modal.innerHTML = `
            <div style="background:var(--bg-primary);border-radius:12px;padding:24px;max-width:700px;width:90%;max-height:80vh;display:flex;flex-direction:column;border:1px solid var(--border-color);">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
                <h3 style="margin:0;font-size:16px;color:var(--text-primary);">🛡️ 文件完整性快照 — ${currentPath}</h3>
                <button onclick="this.closest('.modal-overlay').remove()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:20px;">✕</button>
              </div>
              <div style="font-size:11px;color:var(--text-secondary);margin-bottom:12px;">
                生成时间: ${new Date().toLocaleString()} | 可复制保存，用于前后对比
              </div>
              <textarea readonly style="flex:1;min-height:300px;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px;font-family:'JetBrains Mono',monospace;font-size:12px;color:var(--text-primary);resize:vertical;">${output.replace(/</g, '&lt;')}</textarea>
              <div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
                <button onclick="navigator.clipboard.writeText(this.closest('.modal-overlay').querySelector('textarea').value);(window.showNotification||alert)('已复制到剪贴板','success')" class="modern-btn secondary">📋 复制</button>
                <button onclick="this.closest('.modal-overlay').remove()" class="modern-btn primary">关闭</button>
              </div>
            </div>
          `;
          document.body.appendChild(modal);
          modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        })
        .catch((e: any) => {
          (window as any).showNotification && (window as any).showNotification(`生成快照失败: ${e}`, 'error');
        });
    } catch (e) {
      console.error('完整性快照失败:', e);
    }
  };

  // ──── 暴露管理器到全局 ────
  (window as any).remoteOperationsManager = remoteOperationsManager;
  (window as any).sshConnectionManager = sshConnectionManager;
  (window as any).sftpManager = sftpManager;
  (window as any).sshTerminalManager = sshTerminalManager;
  (window as any).quickDetection = quickDetectionManager;
  (window as any).sshConnectionDialog = sshConnectionDialog;

  // ──── 工作区/侧边栏刷新 ────
  (window as any).refreshDashboard = () => {
    try {
      if (app) {
        const mainWorkspace = document.querySelector('.main-workspace');
        if (mainWorkspace) {
          mainWorkspace.innerHTML = app.getStateManager().getUIRenderer().renderMainWorkspace();
        }
      }
    } catch (error) {
      console.error('❌ 刷新工作区失败:', error);
    }
  };

  (window as any).refreshSidebar = () => {
    try {
      if (app) {
        const sidebar = document.querySelector('.modern-sidebar');
        if (sidebar) {
          const sidebarHTML = app.getStateManager().getUIRenderer().renderSidebar();
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = sidebarHTML;
          const sidebarContent = tempDiv.querySelector('.modern-sidebar');
          if (sidebarContent) sidebar.innerHTML = sidebarContent.innerHTML;
        }
      }
    } catch (error) {
      console.error('❌ 刷新侧边栏失败:', error);
    }
  };

  // ──── 开发者工具 ────
  (window as any).toggleDevTools = async () => {
    try {
      await (window as any).__TAURI__.core.invoke('open_devtools');
      (window as any).showNotification && (window as any).showNotification('开发者工具已打开', 'success');
    } catch (error) {
      (window as any).showNotification && (window as any).showNotification(`打开开发者工具失败: ${error}`, 'error');
    }
  };

  // ──── 页面切换 ────
  let remoteOperationsPageInitialized = false;
  (window as any).switchPage = (pageId: string) => {
    console.log('🔄 切换页面:', pageId);

    // SFTP: 切走时标记需要重新绑定DOM事件，但不丢弃数据
    if (pageId !== 'remote-operations') {
      remoteOperationsPageInitialized = false;
    }

    document.querySelectorAll('.activity-bar-item[data-nav-id], .nav-item[data-nav-id]').forEach(item => {
      const htmlItem = item as HTMLElement;
      const navId = htmlItem.getAttribute('data-nav-id');
      htmlItem.classList.toggle('active', navId === pageId);
    });

    const sm = app.getStateManager();
    if (app && sm) {
      sm.setCurrentPage(pageId as any);
      app.render();

      if (pageId === 'docker') {
        dockerPageManager.initialize();
        dockerPageManager.refresh(true);
      } else if (pageId === 'emergency-commands') {
        emergencyPageManager.initialize();
      } else if (pageId === 'log-analysis') {
        setTimeout(() => { (window as any).refreshLogAnalysis(); }, 200);
      } else if (pageId === 'settings') {
        setTimeout(() => { settingsPageManager.initialize(); }, 100);
      } else if (pageId === 'ssh-terminal') {
        openSSHTerminalWindow();
        setTimeout(() => {
          const sm2 = app?.getStateManager();
          if (app && sm2) {
            sm2.setCurrentPage('system-info');
            app.render();
          }
        }, 100);
      } else {
        dockerPageManager.deactivate();
      }

      // 系统概览：仅在无缓存时才重新加载
      if (pageId === 'system-info' && sshConnectionManager.isConnected()) {
        const cache = (window as any).systemInfoCache;
        if (cache && cache.detailedInfo) {
          // 有缓存，直接用缓存渲染，不重新请求
          (window as any).loadSystemDetailedInfo(false);
        }
      }
    }
  };

  // ──── SSH 连接对话框和设置覆盖层 ────
  (window as any).showSSHConnectionDialog = () => sshConnectionDialog.show();

  (window as any).showSettingsOverlay = () => {
    const renderer = (window as any).app?.modernUIRenderer;
    if (!app || !renderer) return;
    const settingsHTML = renderer.renderSettingsPage();
    const settingsOverlay = document.createElement('div');
    settingsOverlay.innerHTML = settingsHTML;
    settingsOverlay.id = 'settings-overlay-container';
    document.body.appendChild(settingsOverlay);
    setTimeout(() => settingsPageManager.initialize(), 100);
  };

  (window as any).hideSettingsOverlay = () => {
    const el = document.getElementById('settings-overlay-container');
    if (el) el.remove();
  };

  // ──── 用户头像下拉菜单 ────
  (window as any).toggleUserDropdown = () => {
    const dropdown = document.getElementById('user-dropdown-menu');
    const userAvatarBtn = document.querySelector('.user-avatar-btn');
    if (dropdown && userAvatarBtn) {
      const isVisible = dropdown.style.display === 'block';
      if (isVisible) {
        dropdown.style.display = 'none';
      } else {
        const rect = userAvatarBtn.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + 5}px`;
        dropdown.style.right = `${window.innerWidth - rect.right}px`;
        dropdown.style.display = 'block';
      }
    }
  };

  document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('user-dropdown-menu');
    const userAvatarContainer = document.querySelector('.user-avatar-container');
    if (dropdown && userAvatarContainer) {
      const clickedInsideDropdown = dropdown.contains(event.target as Node);
      const clickedOnAvatar = userAvatarContainer.contains(event.target as Node);
      if (!clickedInsideDropdown && !clickedOnAvatar && dropdown.style.display === 'block') {
        dropdown.style.display = 'none';
      }
    }
  });

  (window as any).handleUserMenuAction = async (action: string) => {
    const dropdown = document.getElementById('user-dropdown-menu');
    if (dropdown) dropdown.style.display = 'none';
    switch (action) {
      case 'settings':
        (window as any).showSettingsOverlay && (window as any).showSettingsOverlay();
        break;
      default:
        console.warn('未知的菜单操作:', action);
    }
  };

  // ──── 远程操作页面初始化 ────
  (window as any).initRemoteOperationsPage = async function () {
    if (remoteOperationsPageInitialized) return;
    remoteOperationsPageInitialized = true;
    await remoteOperationsManager.initialize();

    await sshConnectionManager.checkConnectionStatus();
    const connectionStatus = sshConnectionManager.getConnectionStatus();

    const hasExistingData = sftpManager.getCurrentFiles().length > 0;

    if (connectionStatus?.connected && !hasExistingData) {
      // 首次加载：请求文件列表
      await sftpManager.refreshFileList();
    } else {
      // 已有数据或未连接：直接用现有数据渲染
      const sftpFileList = document.getElementById('sftp-file-list');
      if (sftpFileList) sftpFileList.innerHTML = sftpManager.renderFileListHTML();
      const breadcrumb = document.getElementById('sftp-breadcrumb');
      if (breadcrumb) breadcrumb.innerHTML = sftpManager.renderBreadcrumbHTML();
      const pathInput = document.getElementById('sftp-path-input') as HTMLInputElement;
      if (pathInput) pathInput.value = sftpManager.getCurrentPath();
      sftpManager.updateSortIndicators();
    }

    // 修正排序下拉潜在的编码异常
    setTimeout(() => {
      try {
        const label = document.querySelector('label[for="sftp-sort-mode"]');
        if (label) label.textContent = '排序';
        const nameAsc = document.querySelector('#sftp-sort-mode option[value="name-asc"]') as HTMLOptionElement | null;
        if (nameAsc) nameAsc.textContent = '名称 A→Z';
        const nameDesc = document.querySelector('#sftp-sort-mode option[value="name-desc"]') as HTMLOptionElement | null;
        if (nameDesc) nameDesc.textContent = '名称 Z→A';
        const sizeAsc = document.querySelector('#sftp-sort-mode option[value="size-asc"]') as HTMLOptionElement | null;
        if (sizeAsc) sizeAsc.textContent = '大小 ↑';
        const sizeDesc = document.querySelector('#sftp-sort-mode option[value="size-desc"]') as HTMLOptionElement | null;
        if (sizeDesc) sizeDesc.textContent = '大小 ↓';
        const modifiedAsc = document.querySelector('#sftp-sort-mode option[value="modified-asc"]') as HTMLOptionElement | null;
        if (modifiedAsc) modifiedAsc.textContent = '修改时间 ↑';
        const modifiedDesc = document.querySelector('#sftp-sort-mode option[value="modified-desc"]') as HTMLOptionElement | null;
        if (modifiedDesc) modifiedDesc.textContent = '修改时间 ↓';
      } catch { }
    }, 0);

    sftpManager.addListener((_files, path) => {
      const pathInput = document.getElementById('sftp-path-input') as HTMLInputElement;
      if (pathInput) pathInput.value = path;

      // Update breadcrumb
      const breadcrumb = document.getElementById('sftp-breadcrumb');
      if (breadcrumb) breadcrumb.innerHTML = sftpManager.renderBreadcrumbHTML();

      // Render file list
      const sftpFileList = document.getElementById('sftp-file-list');
      if (sftpFileList) sftpFileList.innerHTML = sftpManager.renderFileListHTML();

      // Update sort indicators
      sftpManager.updateSortIndicators();

      const sortModeSelect = document.getElementById('sftp-sort-mode') as HTMLSelectElement;
      if (sortModeSelect) sortModeSelect.value = sftpManager.getSortMode();
    });
  };

  // ──── 数据库管理（占位） ────
  (window as any).switchDatabaseView = (viewType: string) => {
    const items = document.querySelectorAll('.database-sidebar .db-list-item');
    items.forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('onclick')?.includes(`'${viewType}'`)) {
        item.classList.add('active');
      }
    });
    (window as any).showNotification && (window as any).showNotification(`切换到视图: ${viewType}`, 'info');
  };

  (window as any).showAddDatabaseModal = () => {
    (window as any).showNotification && (window as any).showNotification('添加数据库连接功能即将上线', 'info');
  };

  // ──── 连接下拉菜单 ────
  (window as any).showConnectionDropdown = () => {
    const dropdown = document.getElementById('connection-dropdown');
    if (dropdown) {
      const card = document.querySelector('.connection-card');
      if (card) {
        const rect = card.getBoundingClientRect();
        dropdown.style.top = `${rect.bottom + 5}px`;
        dropdown.style.left = `${rect.left}px`;
        dropdown.style.minWidth = `${rect.width}px`;
      }
      dropdown.style.display = 'block';
      setTimeout(() => { dropdown.style.opacity = '1'; }, 10);
    }
  };

  (window as any).hideConnectionDropdown = () => {
    const dropdown = document.getElementById('connection-dropdown');
    if (dropdown) {
      dropdown.style.opacity = '0';
      setTimeout(() => { dropdown.style.display = 'none'; }, 200);
    }
  };
}
