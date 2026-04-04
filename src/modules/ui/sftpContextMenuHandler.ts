/**
 * SFTP 右键菜单处理器
 * 管理 SFTP 文件列表右键菜单的显示、定位和操作
 */

import { sftpManager } from '../remote/sftpManager';

const CTX_MENU_ID = 'sftp-context-menu';
let sftpCtxIndex: number | null = null;

function getCtxEl(): HTMLElement | null {
  return document.getElementById(CTX_MENU_ID);
}

/** 通用的文件操作包装：获取索引、隐藏菜单、获取文件信息 */
async function withFileAction(callback: (file: any, index: number) => Promise<void> | void): Promise<void> {
  const idx = sftpCtxIndex;
  if (idx == null || idx < 0) {
    console.warn('无效的文件索引:', idx);
    return;
  }
  hideSftpContextMenu();
  try {
    const file = sftpManager.getFileByIndex(idx);
    if (!file) return;
    await callback(file, idx);
  } catch (e) {
    console.error('文件操作失败:', e);
    (window as any).showNotification && (window as any).showNotification(`操作失败: ${e}`, 'error');
  }
}

function hideSftpContextMenu(): void {
  const menu = getCtxEl();
  if (menu) menu.style.display = 'none';
  sftpCtxIndex = null;
}

function adjustSubmenuPosition(menu: HTMLElement): void {
  const padding = 8;
  const submenus = menu.querySelectorAll('.ctx-submenu');
  submenus.forEach((submenu: Element) => {
    const submenuEl = submenu as HTMLElement;
    const parent = submenuEl.parentElement;
    if (!parent) return;

    parent.addEventListener('mouseenter', () => {
      setTimeout(() => {
        if (submenuEl.style.display === 'none') return;
        const submenuRect = submenuEl.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (submenuRect.right > vw - padding * 2) {
          submenuEl.classList.add('show-left');
        } else {
          submenuEl.classList.remove('show-left');
        }
        if (submenuRect.bottom > vh - padding * 2) {
          submenuEl.classList.add('adjust-top');
        } else {
          submenuEl.classList.remove('adjust-top');
        }
      }, 10);
    });
  });
}

function showSftpContextMenu(ev: MouseEvent, index: number): void {
  ev.preventDefault();
  ev.stopPropagation();
  sftpCtxIndex = index;
  const menu = getCtxEl();
  if (!menu) {
    console.error('找不到上下文菜单元素:', CTX_MENU_ID);
    return;
  }

  // 根据文件类型显示相应的菜单项
  const files = sftpManager.getCurrentFiles();
  const file = files[index];

  const menuButtons = {
    compress: document.getElementById('sftp-ctx-compress'),
    extract: document.getElementById('sftp-ctx-extract'),
    download: document.getElementById('sftp-ctx-download'),
    quickView: document.getElementById('sftp-ctx-quick-view')
  };

  if (file) {
    const isArchive = file.name.match(/\.(tar\.gz|tgz|tar\.bz2|tbz2|tar|zip)$/i);
    const isDir = file.file_type === 'directory';

    if (menuButtons.compress) menuButtons.compress.style.display = isArchive || isDir ? 'none' : 'flex';
    if (menuButtons.extract) menuButtons.extract.style.display = isArchive ? 'flex' : 'none';
    if (menuButtons.download) menuButtons.download.style.display = isDir ? 'none' : 'flex';
    if (menuButtons.quickView) menuButtons.quickView.style.display = isDir ? 'none' : 'flex';
  }

  // 定位菜单
  const padding = 8;
  const { clientX: x, clientY: y } = ev;
  menu.style.display = 'block';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let left = x;
  let top = y;

  if (rect.right > vw - padding) {
    left = Math.max(padding, vw - rect.width - padding);
  }
  if (rect.bottom > vh - padding) {
    top = Math.max(padding, vh - rect.height - padding);
    top = Math.max(padding, top - 20);
  }

  menu.style.left = left + 'px';
  menu.style.top = top + 'px';

  adjustSubmenuPosition(menu);

  // 绑定菜单项事件
  const bindClick = (id: string, handler: () => void) => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.onclick = (e) => { e.stopPropagation(); handler(); };
    }
  };

  bindClick('sftp-ctx-quick-view', () => (window as any).sftpQuickViewSelected());
  bindClick('sftp-ctx-rename', () => (window as any).sftpRenameSelected());
  bindClick('sftp-ctx-edit-perms', () => (window as any).sftpEditPermissionsSelected());
  bindClick('sftp-ctx-compress', () => (window as any).sftpCompressSelected());
  bindClick('sftp-ctx-extract', () => (window as any).sftpExtractSelected());
  bindClick('sftp-ctx-download', () => (window as any).sftpDownloadSelected());
  bindClick('sftp-ctx-copy-path', () => (window as any).sftpCopyPathSelected());
  bindClick('sftp-ctx-copy-name', () => (window as any).sftpCopyNameSelected());
  bindClick('sftp-ctx-open-terminal', () => (window as any).sftpOpenTerminalSelected());
  bindClick('sftp-ctx-file-details', () => (window as any).sftpFileDetailsSelected());
  bindClick('sftp-ctx-delete', () => (window as any).sftpDeleteSelected());

  // 初始化菜单的鼠标事件处理
  const app = (window as any).app;
  if (app && app.modernUIRenderer && app.modernUIRenderer.sftpContextMenuRenderer) {
    app.modernUIRenderer.sftpContextMenuRenderer.initializeMenuEvents();
  }

  // 文件安全分析子菜单项事件
  const securityAnalysisItems = document.querySelectorAll('#sftp-ctx-security-analysis .ctx-item[data-action]');
  securityAnalysisItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const action = (item as HTMLElement).getAttribute('data-action');
      if (action) {
        (window as any).sftpFileSecurityAnalysis(action);
      }
    }, true);
  });

  // 点击外部关闭
  const close = (e: Event) => {
    if (e.target && (e.target as Element).closest('#sftp-context-menu')) return;
    hideSftpContextMenu();
    document.removeEventListener('click', close, true);
    document.removeEventListener('contextmenu', close, true);
    document.removeEventListener('keydown', onKeyDown, true);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close(e);
  };
  setTimeout(() => {
    document.addEventListener('click', close, true);
    document.addEventListener('contextmenu', close, true);
    document.addEventListener('keydown', onKeyDown, true);
  }, 0);
}

/**
 * 初始化 SFTP 右键菜单处理器
 */
export function initSftpContextMenuHandler(): void {
  (window as any).showSftpContextMenu = showSftpContextMenu;
  (window as any).hideSftpContextMenu = hideSftpContextMenu;

  (window as any).sftpQuickViewSelected = () => withFileAction(async (file) => {
    if (file.file_type === 'directory') {
      (window as any).showNotification && (window as any).showNotification('只能查看文件，不能查看目录', 'warning');
      return;
    }
    const fileViewerModal = (window as any).fileViewerModal;
    if (fileViewerModal) {
      await fileViewerModal.show(file.path, true);
    } else {
      console.error('文件查看器模态未找到');
    }
  });

  (window as any).sftpEditPermissionsSelected = () => withFileAction(async (file) => {
    const permissionsModal = (window as any).permissionsModal;
    if (permissionsModal) {
      permissionsModal.show(file.path, file.permissions);
    } else {
      console.error('权限编辑模态未找到');
    }
  });

  (window as any).sftpCompressSelected = () => withFileAction(async (file) => {
    const compressModal = (window as any).compressModal;
    if (compressModal) {
      compressModal.show(file.path, file.file_type);
    } else {
      console.error('打包模态未找到');
    }
  });

  (window as any).sftpExtractSelected = () => withFileAction(async (file) => {
    const extractModal = (window as any).extractModal;
    if (extractModal) {
      extractModal.show(file.path);
    } else {
      console.error('解压模态未找到');
    }
  });

  (window as any).sftpDownloadSelected = () => withFileAction(async (file) => {
    if (file.file_type === 'directory') {
      (window as any).showNotification && (window as any).showNotification('不能下载目录，请选择文件', 'warning');
      return;
    }
    const remotePath = `${sftpManager.getCurrentPath()}/${file.name}`;
    try {
      const savePath = await (window as any).__TAURI__.dialog.save({
        defaultPath: file.name,
        filters: [{ name: '所有文件', extensions: ['*'] }]
      });
      if (savePath) {
        (window as any).showNotification && (window as any).showNotification(`开始下载: ${file.name}`, 'info');
        await (window as any).__TAURI__.core.invoke('sftp_download', {
          remotePath: remotePath,
          localPath: savePath
        });
        (window as any).showNotification && (window as any).showNotification(`文件下载成功: ${file.name}`, 'success');
      }
    } catch (error) {
      console.error('下载文件失败:', error);
      (window as any).showNotification && (window as any).showNotification(`下载文件失败: ${error}`, 'error');
    }
  });

  (window as any).sftpCopyPathSelected = () => withFileAction(async (file) => {
    const fullPath = file.path.replace(/\\/g, '/');
    await navigator.clipboard.writeText(fullPath);
    (window as any).showNotification && (window as any).showNotification(`路径已复制到剪贴板: ${fullPath}`, 'success');
  });

  (window as any).sftpCopyNameSelected = () => withFileAction(async (file) => {
    await navigator.clipboard.writeText(file.name);
    (window as any).showNotification && (window as any).showNotification(`文件名已复制: ${file.name}`, 'success');
  });

  (window as any).sftpRenameSelected = () => withFileAction(async (file) => {
    const newName = prompt('请输入新名称:', file.name);
    if (!newName || newName === file.name) return;
    const currentPath = sftpManager.getCurrentPath();
    const oldPath = `${currentPath}/${file.name}`.replace(/\/+/g, '/');
    const newPath = `${currentPath}/${newName}`.replace(/\/+/g, '/');
    try {
      await (window as any).__TAURI__.core.invoke('sftp_rename', {
        oldPath: oldPath,
        newPath: newPath
      });
      (window as any).showNotification && (window as any).showNotification(`重命名成功: ${file.name} → ${newName}`, 'success');
      sftpManager.refreshCurrentDirectory();
    } catch (error) {
      (window as any).showNotification && (window as any).showNotification(`重命名失败: ${error}`, 'error');
    }
  });

  (window as any).sftpDeleteSelected = () => withFileAction(async (file) => {
    const isDir = file.file_type === 'directory';
    const confirmMsg = isDir
      ? `确定要删除目录 "${file.name}" 吗？\n\n注意：仅能删除空目录，非空目录请先清理内容或使用终端 rm -rf`
      : `确定要删除文件 "${file.name}" 吗？`;
    if (!confirm(confirmMsg)) return;

    const filePath = file.path.replace(/\\/g, '/');
    try {
      if (isDir) {
        // For directories, use SSH command rm -rf for reliability
        await (window as any).__TAURI__.core.invoke('execute_command', {
          command: `rm -rf "${filePath}"`
        });
      } else {
        await (window as any).__TAURI__.core.invoke('sftp_delete', {
          path: filePath
        });
      }
      (window as any).showNotification && (window as any).showNotification(`已删除: ${file.name}`, 'success');
      sftpManager.refreshCurrentDirectory();
    } catch (error) {
      (window as any).showNotification && (window as any).showNotification(`删除失败: ${error}`, 'error');
    }
  });

  (window as any).sftpOpenTerminalSelected = () => withFileAction(async (file) => {
    const isDir = file.file_type === 'directory';
    const targetPath = isDir ? file.path : sftpManager.getCurrentPath();
    const cleanPath = targetPath.replace(/\\/g, '/');
    try {
      // Switch to terminal page and send cd command
      const sshTerminalManager = (window as any).sshTerminalManager;
      if (sshTerminalManager) {
        // Switch to terminal page first
        (window as any).switchPage && (window as any).switchPage('terminal');
        // Send cd command to the terminal
        setTimeout(() => {
          sshTerminalManager.sendCommand(`cd "${cleanPath}" && pwd`);
        }, 300);
      } else {
        (window as any).showNotification && (window as any).showNotification('终端不可用', 'warning');
      }
    } catch (error) {
      (window as any).showNotification && (window as any).showNotification(`打开终端失败: ${error}`, 'error');
    }
  });

  (window as any).sftpFileDetailsSelected = () => withFileAction(async (file) => {
    const fileDetailsModal = (window as any).fileDetailsModal;
    if (fileDetailsModal) {
      await fileDetailsModal.show(file.path);
    } else {
      console.error('文件详情模态框未找到');
      (window as any).showNotification && (window as any).showNotification('文件详情功能暂不可用', 'warning');
    }
  });

  (window as any).sftpFileSecurityAnalysis = async (action: string) => {
    // 保存索引，因为 withFileAction 会清空它
    const savedIdx = sftpCtxIndex;
    if (savedIdx == null || savedIdx < 0) return;
    hideSftpContextMenu();

    try {
      const file = sftpManager.getFileByIndex(savedIdx);
      if (!file) return;
      const fileContextMenu = (window as any).fileContextMenu;
      if (fileContextMenu) {
        await fileContextMenu.handleAction(action, file.path);
      } else {
        (window as any).showNotification && (window as any).showNotification('文件安全分析功能暂不可用', 'warning');
      }
    } catch (e) {
      console.error('文件安全分析失败:', e);
      (window as any).showNotification && (window as any).showNotification(`安全分析失败: ${e}`, 'error');
    }
  };
}
