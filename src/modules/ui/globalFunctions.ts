/**
 * 全局函数注册模块
 * 将 (window as any).xxx = ... 集中管理
 *
 * 从 main.ts 提取，原位置: 第 204–510 行
 * 这些函数是 HTML 模板中 onclick 等属性所需要的全局入口点，
 * 暂时保留 (window as any) 方式，后续可逐步迁移到 eventBus。
 */

import type { LovelyResApp } from '../core/app';
import { showConfirm, showPrompt } from './confirmDialog';
import './sftpDetailPanel'; // 注册 SFTP 文件详情侧栏的 window 函数
import { sftpManager } from '../remote/sftpManager';
import { sshConnectionManager } from '../remote/sshConnectionManager';
import { sshConnectionDialog } from '../ui/sshConnectionDialog';
import { remoteOperationsManager } from '../remote/remoteOperationsManager';
import { dockerPageManager } from '../docker/dockerPageManager';
import { emergencyPageManager } from '../emergency/emergencyPageManager';
import { KubernetesPageManager } from '../kubernetes/kubernetesPageManager';
// quickDetectionManager removed
import { sshTerminalManager } from '../ssh/sshTerminalManager';
import type { SettingsPageManager } from '../settings/settingsPageManager';

interface GlobalFunctionsDeps {
  app: LovelyResApp;
  settingsPageManager: SettingsPageManager;
  openSSHTerminalWindow: () => Promise<void>;
}

let globalEventsBound = false;
let sftpListenerBound = false;

/**
 * 注册所有全局函数到 window 对象
 */
export function initGlobalFunctions(deps: GlobalFunctionsDeps): void {
  const { app, settingsPageManager, openSSHTerminalWindow } = deps;

  // ──── 侧边栏：折叠/展开（52px 轨道模式）────
  (window as any).toggleSidebar = () => {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    nav.classList.toggle('collapsed');
    localStorage.setItem('sidebar-collapsed', nav.classList.contains('collapsed') ? '1' : '0');
  };

  // ──── 侧边栏：分组折叠/展开 ────
  (window as any).toggleSidebarGroup = (groupId: string) => {
    const nav = document.querySelector('.sidebar-nav');
    // 轨道（折叠）模式下点击分组：先展开整条侧边栏，再确保该组打开
    if (nav && nav.classList.contains('collapsed')) {
      nav.classList.remove('collapsed');
      localStorage.setItem('sidebar-collapsed', '0');
      document.querySelector(`.sidebar-group[data-group-id="${groupId}"]`)?.classList.add('open');
      persistOpenGroups();
      return;
    }
    const grp = document.querySelector(`.sidebar-group[data-group-id="${groupId}"]`);
    if (!grp) return;
    grp.classList.toggle('open');
    persistOpenGroups();
  };

  // ──── 侧边栏：搜索过滤 ────
  (window as any).filterSidebar = (query: string) => {
    const q = (query || '').trim().toLowerCase();
    document.querySelectorAll('.sidebar-group').forEach(group => {
      const g = group as HTMLElement;
      let anyVisible = false;
      g.querySelectorAll('.sidebar-item').forEach(item => {
        const el = item as HTMLElement;
        const text = (el.querySelector('.sidebar-item-label')?.textContent || '').toLowerCase();
        const match = q === '' || text.includes(q);
        el.hidden = !match;
        if (match) anyVisible = true;
      });
      g.hidden = q !== '' && !anyVisible;
      if (q !== '') g.classList.toggle('open', anyVisible);
    });
    if (q === '') applySidebarState();
  };

  // 持久化已展开的分组集合
  function persistOpenGroups(): void {
    const open: string[] = [];
    document.querySelectorAll('.sidebar-group.open').forEach(g => {
      const id = (g as HTMLElement).getAttribute('data-group-id');
      if (id) open.push(id);
    });
    localStorage.setItem('sidebar-groups-open', JSON.stringify(open));
  }

  // 同步活动分组行高亮（依据当前活动叶子；含活动叶子的组始终展开）
  function syncSidebarActiveGroup(): void {
    document.querySelectorAll('.sidebar-group').forEach(g => {
      const el = g as HTMLElement;
      const hasActive = !!el.querySelector('.sidebar-item.active');
      el.querySelector('.sidebar-group-row')?.classList.toggle('active', hasActive);
      if (hasActive) el.classList.add('open');
    });
  }
  (window as any).syncSidebarActiveGroup = syncSidebarActiveGroup;

  // 施加持久化的侧边栏状态（折叠 + 分组展开 + 活动组）；每次侧边栏渲染后调用
  function applySidebarState(): void {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;
    nav.classList.toggle('collapsed', localStorage.getItem('sidebar-collapsed') === '1');
    let openGroups: string[] | null = null;
    try { openGroups = JSON.parse(localStorage.getItem('sidebar-groups-open') || 'null'); } catch { openGroups = null; }
    if (Array.isArray(openGroups)) {
      document.querySelectorAll('.sidebar-group').forEach(g => {
        const el = g as HTMLElement;
        const id = el.getAttribute('data-group-id');
        const hasActive = !!el.querySelector('.sidebar-item.active');
        el.classList.toggle('open', hasActive || (id ? openGroups!.includes(id) : false));
      });
    }
    syncSidebarActiveGroup();
  }
  (window as any).applySidebarState = applySidebarState;

  // 首次渲染后恢复侧边栏状态
  requestAnimationFrame(() => applySidebarState());

  // ──── SFTP 面板全局函数 ────
  // SFTP 当前目录内的客户端过滤（按文件名）
  (window as any).sftpFilterFiles = (query: string) => {
    const q = (query || '').trim().toLowerCase();
    document.querySelectorAll('#sftp-file-list .sftp-file-row').forEach(row => {
      const el = row as HTMLElement;
      const name = (el.querySelector('.file-name')?.textContent || '').toLowerCase();
      const isParent = el.classList.contains('parent-dir-item');
      el.style.display = (!q || isParent || name.includes(q)) ? '' : 'none';
    });
  };

  (window as any).sftpRefresh = () => {
    try {
      if (sftpManager && (sftpManager as any).refreshCurrentDirectory) {
        (sftpManager as any).refreshCurrentDirectory();
        window.showNotification && window.showNotification('文件列表已刷新', 'success');
      }
    } catch (e) {
      console.error('刷新失败:', e);
      window.showNotification && window.showNotification(`刷新失败: ${e}`, 'error');
    }
  };

  (window as any).sftpOpenUpload = () => {
    try {
      if (sftpManager && (sftpManager as any).getCurrentPath && (window as any).uploadModal) {
        (window as any).uploadModal.show((sftpManager as any).getCurrentPath());
      } else {
        window.showNotification && window.showNotification('上传窗口未初始化', 'error');
      }
    } catch (e) {
      console.error('打开上传对话框失败:', e);
      window.showNotification && window.showNotification(`打开上传对话框失败: ${e}`, 'error');
    }
  };

  (window as any).sftpOpenCreateFolder = () => {
    try {
      if (sftpManager && (sftpManager as any).getCurrentPath && (window as any).createFolderModal) {
        (window as any).createFolderModal.show((sftpManager as any).getCurrentPath());
      } else {
        window.showNotification && window.showNotification('新建文件夹窗口未初始化', 'error');
      }
    } catch (e) {
      console.error('打开新建文件夹对话框失败:', e);
      window.showNotification && window.showNotification(`打开新建文件夹失败: ${e}`, 'error');
    }
  };

  (window as any).toggleSftpHistory = () => {
    try {
      if ((window as any).fileContextMenu && (window as any).fileContextMenu.showHistoryModal) {
        (window as any).fileContextMenu.showHistoryModal();
      } else {
        window.showNotification && window.showNotification('文件分析历史窗口未初始化', 'error');
      }
    } catch (e) {
      console.error('显示历史记录失败:', e);
      window.showNotification && window.showNotification(`显示历史记录失败: ${e}`, 'error');
    }
  };

  (window as any).setSftpSortMode = (mode: 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'modified-asc' | 'modified-desc') => {
    try {
      sftpManager.setSortMode(mode);
    } catch (e) {
      console.error('设置排序方式失败:', e);
      window.showNotification && window.showNotification(`设置排序方式失败: ${e}`, 'error');
    }
  };

  // ──── SFTP 新建文件 ────
  (window as any).sftpCreateFile = async () => {
    try {
      const currentPath = sftpManager.getCurrentPath();
      const fileName = await showPrompt({ title: '新建文件', message: '请输入文件名:', defaultValue: 'new_file.txt' });
      if (!fileName || !fileName.trim()) return;

      const fullPath = currentPath === '/'
        ? `/${fileName.trim()}`
        : `${currentPath}/${fileName.trim()}`;

      // Write empty file via existing sftp_write_file command
      (window as any).__TAURI__.core.invoke('sftp_write_file', {
        path: fullPath,
        content: ''
      }).then(() => {
        window.showNotification && window.showNotification(`文件已创建: ${fileName}`, 'success');
        sftpManager.refreshCurrentDirectory();
      }).catch((e: any) => {
        window.showNotification && window.showNotification(`创建文件失败: ${e}`, 'error');
      });
    } catch (e) {
      console.error('创建文件失败:', e);
      window.showNotification && window.showNotification(`创建文件失败: ${e}`, 'error');
    }
  };

  // ──── SFTP 完整性快照 ────
  (window as any).sftpIntegritySnapshot = async () => {
    try {
      const currentPath = sftpManager.getCurrentPath();
      if (!(await showConfirm({ title: '完整性快照', message: `将为 ${currentPath} 目录生成文件哈希清单（md5sum），是否继续？` }))) return;

      window.showNotification && window.showNotification('正在生成完整性快照...', 'info');

      const cmd = `find "${currentPath}" -maxdepth 1 -type f -exec md5sum {} \\; 2>/dev/null | sort -k2`;
      (window as any).__TAURI__.core.invoke('ssh_execute_command_direct', { command: cmd })
        .then((result: any) => {
          const output = result?.output || '(空目录或无文件)';
          if (typeof result?.exit_code === 'number' && result.exit_code !== 0) {
            window.showNotification && window.showNotification(`生成快照命令返回退出码 ${result.exit_code}`, 'warning');
          }
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
          window.showNotification && window.showNotification('完整性快照已生成', 'success');
        })
        .catch((e: any) => {
          window.showNotification && window.showNotification(`生成快照失败: ${e}`, 'error');
        });
    } catch (e) {
      console.error('完整性快照失败:', e);
      window.showNotification && window.showNotification(`完整性快照失败: ${e}`, 'error');
    }
  };

  // ──── 暴露管理器到全局 ────
  (window as any).remoteOperationsManager = remoteOperationsManager;
  (window as any).sshConnectionManager = sshConnectionManager;
  (window as any).sftpManager = sftpManager;
  (window as any).sshTerminalManager = sshTerminalManager;
  // quickDetection removed
  (window as any).sshConnectionDialog = sshConnectionDialog;

  // (快速检测事件委托已移除)
  if (!globalEventsBound) {
    // 预留给其他全局事件
  }

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
      if (!app) return;
      const sidebar = document.querySelector('.sidebar-nav');
      if (!sidebar) return;
      const sidebarHTML = app.getStateManager().getUIRenderer().renderSidebar();
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = sidebarHTML;
      const fresh = tempDiv.querySelector('.sidebar-nav');
      if (fresh) sidebar.replaceWith(fresh);
      applySidebarState();
    } catch (error) {
      console.error('❌ 刷新侧边栏失败:', error);
    }
  };

  // ──── 开发者工具 ────
  (window as any).toggleDevTools = async () => {
    try {
      await (window as any).__TAURI__.core.invoke('open_devtools');
      window.showNotification && window.showNotification('开发者工具已打开', 'success');
    } catch (error) {
      window.showNotification && window.showNotification(`打开开发者工具失败: ${error}`, 'error');
    }
  };

  // ──── 页面切换 ────
  let remoteOperationsPageInitialized = false;
  (window as any).switchPage = (pageId: string) => {
    console.log('🔄 切换页面:', pageId);

    // 取消前一个页面的异步操作
    // quickDetection cancelScan removed

    // SFTP: 切走时标记需要重新绑定DOM事件，但不丢弃数据
    if (pageId !== 'remote-operations') {
      remoteOperationsPageInitialized = false;
    }

    document.querySelectorAll('.sidebar-item[data-nav-id], .activity-bar-item[data-nav-id], .nav-item[data-nav-id]').forEach(item => {
      const htmlItem = item as HTMLElement;
      const navId = htmlItem.getAttribute('data-nav-id');
      htmlItem.classList.toggle('active', navId === pageId);
    });
    syncSidebarActiveGroup();

    const sm = app.getStateManager();
    if (app && sm) {
      const prevPage = sm.getState()?.currentPage;
      sm.setCurrentPage(pageId as any);
      app.render();
      // 进出带「上下文分组」的页面时重渲主侧边栏，以并入/移除其上下文分组
      const CTX_PAGES = ['system-info', 'remote-operations'];
      if (prevPage !== pageId && (CTX_PAGES.includes(prevPage as string) || CTX_PAGES.includes(pageId))) {
        (window as any).refreshSidebar && (window as any).refreshSidebar();
      }

      if (pageId === 'docker') {
        // initialize is already called inside renderDockerPage()
        // Use setTimeout to ensure DOM is mounted before refresh
        setTimeout(() => dockerPageManager.refresh(true), 50);
      } else if (pageId === 'emergency-commands') {
        emergencyPageManager.initialize();
      } else if (pageId === 'log-analysis') {
        setTimeout(() => { (window as any).refreshLogAnalysis(); }, 200);
      } else if (pageId === 'settings') {
        setTimeout(() => { settingsPageManager.initialize(); }, 100);
      } else if (pageId === 'web-terminal') {
        (window as any).openWebTerminal?.();
        return;
      } else if (pageId === 'ssh-terminal') {
        openSSHTerminalWindow();
        setTimeout(() => {
          const sm2 = app?.getStateManager();
          if (app && sm2) {
            sm2.setCurrentPage('system-info');
            app.render();
          }
        }, 100);
      } else if (pageId === 'kubernetes') {
        // Lazy init K8s page manager
        if (!(window as any).kubernetesPageManager) {
          const appObj = (window as any).app;
          if (appObj?.kubernetesManager && appObj?.kubernetesEmergencyManager && appObj?.kubernetesSecurityAuditor) {
            const renderer = appObj.modernUIRenderer?.kubernetesRenderer;
            if (renderer) {
              const kpm = new KubernetesPageManager(
                appObj.kubernetesManager,
                appObj.kubernetesEmergencyManager,
                appObj.kubernetesSecurityAuditor,
                renderer
              );
              (window as any).kubernetesPageManager = kpm;
            }
          }
        }
        const kpm = (window as any).kubernetesPageManager;
        if (kpm) {
          kpm.initialize();
          kpm.refresh(true);
        }
      } else if (pageId === 'baseline-quick-edit') {
        // Lazy init baseline quick edit manager
        if (!(window as any).baselineQuickEditManager) {
          import('../baseline/baselineQuickEditManager').then(({ BaselineQuickEditManager }) => {
            (window as any).baselineQuickEditManager = new BaselineQuickEditManager();
            (window as any).baselineQuickEditManager.initialize();
          }).catch((e) => {
            console.error('加载基线模块失败:', e);
            window.showNotification?.('加载基线模块失败', 'error');
          });
        } else {
          (window as any).baselineQuickEditManager.initialize();
        }
      } else if (pageId === 'database') {
        // Lazy init database manager
        import('./databaseManager').then(({ databaseManager }) => {
          databaseManager.initialize();
        }).catch((e) => {
          console.error('加载数据库模块失败:', e);
          window.showNotification?.('加载数据库模块失败', 'error');
        });
      } else if (pageId === 'java-hot-update') {
        import('../javaHotUpdate/javaHotUpdateManager').then(({ javaHotUpdateManager }) => {
          javaHotUpdateManager.initialize();
        }).catch((e) => {
          console.error('加载Java热更新模块失败:', e);
          window.showNotification?.('加载Java热更新模块失败', 'error');
        });
      } else if (pageId === 'notes') {
        import('../notes/notesManager').then(({ notesManager }) => {
          notesManager.initialize();
        }).catch((e) => {
          console.error('加载笔记模块失败:', e);
          window.showNotification?.('加载笔记模块失败', 'error');
        });
      } else if (pageId === 'secfix') {
        import('../secfix/secfixManager').then(({ secfixManager }) => {
          secfixManager.initialize();
        }).catch((e) => {
          console.error('加载安全速查模块失败:', e);
          window.showNotification?.('加载安全速查模块失败', 'error');
        });
      } else if (pageId === 'check-audit') {
        import('../checkAudit/checkAuditManager').then(({ checkAuditManager }) => {
          checkAuditManager.initialize();
        }).catch((e) => {
          console.error('加载Check审计模块失败:', e);
          window.showNotification?.('加载Check审计模块失败', 'error');
        });
      } else if (pageId === 'ai-history') {
        import('../ai/aiHistoryManager').then(({ aiHistoryManager }) => {
          aiHistoryManager.initialize();
        }).catch((e) => {
          console.error('加载AI历史模块失败:', e);
          window.showNotification?.('加载AI历史模块失败', 'error');
        });
      }

      // 离开 Docker/K8s/PacketCapture 页面时停止后台操作
      if (pageId !== 'docker') dockerPageManager.deactivate();
      if (pageId !== 'kubernetes') {
        const kpm = (window as any).kubernetesPageManager;
        if (kpm) kpm.deactivate();
      }
      if (pageId !== 'packet-capture') {
        const renderer = (window as any).app?.modernUIRenderer?.packetCaptureRenderer;
        if (renderer) renderer.destroy();
      }
      if (pageId !== 'java-hot-update') {
        (window as any).__jhuManager?.deactivate?.();
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
    settingsPageManager.resetEventBindings();
  };

  // ──── 连接面板下拉菜单 ────
  (window as any).toggleUserDropdown = () => {
    const dropdown = document.getElementById('user-dropdown-menu');
    if (dropdown) {
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }
  };

  if (!globalEventsBound) {
    document.addEventListener('click', (event) => {
      const dropdown = document.getElementById('user-dropdown-menu');
      const connectionPanel = document.querySelector('.user-panel');
      if (dropdown && connectionPanel) {
        const clickedInsideDropdown = dropdown.contains(event.target as Node);
        const clickedOnPanel = connectionPanel.contains(event.target as Node);
        if (!clickedInsideDropdown && !clickedOnPanel && dropdown.style.display === 'block') {
          dropdown.style.display = 'none';
        }
      }
    });
    globalEventsBound = true;
  }

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

    if (!sftpListenerBound) {
    sftpListenerBound = true;
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
    } // end of !sftpListenerBound
  };

  // ──── 数据库管理 ────
  // databaseManager 通过事件委托 (data-db-action) 处理所有交互，无需额外全局函数

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

  // ──── Web 终端（新窗口打开） ────
  (window as any).openWebTerminal = async (url?: string) => {
    const { webTerminalManager } = await import('../remote/webTerminalManager');

    if (url) {
      await webTerminalManager.openUrl(url);
      return;
    }

    const input = await showPrompt({
      title: 'Web 终端',
      message: '输入 Web 终端 URL（在新窗口中打开）:',
      defaultValue: 'http://',
    });
    if (!input || input === 'http://') return;

    await webTerminalManager.openUrl(input);
  };

}

