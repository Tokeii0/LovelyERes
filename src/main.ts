/**
 * LovelyRes 主入口文件
 * Linux Emergency Response Tool
 */

import './styles/sftp-context-menu.css';
import './styles/sftp.css';
import './styles/system-info.css';
import './styles/log-analysis.css';

import { invoke } from "@tauri-apps/api/core";
import { LovelyResApp } from './modules/core/app';
import { remoteOperationsManager } from './modules/remote/remoteOperationsManager';

import { dockerPageManager } from './modules/docker/dockerPageManager';
import { emergencyPageManager } from './modules/emergency/emergencyPageManager';
import { sshConnectionManager } from './modules/remote/sshConnectionManager';
import { quickDetectionManager } from './modules/detection/quickDetectionManager';
import { SettingsManager } from './modules/settings/settingsManager';
import { SettingsPageManager } from './modules/settings/settingsPageManager';
import { ProcessContextMenu } from './modules/ui/processContextMenu';
import { NetworkContextMenu } from './modules/ui/networkContextMenu';
import { ServiceContextMenu } from './modules/ui/serviceContextMenu';
import { UserContextMenu } from './modules/ui/userContextMenu';
import { StartupContextMenu } from './modules/ui/startupContextMenu';
import { CronContextMenu } from './modules/ui/cronContextMenu';
import { FirewallContextMenu } from './modules/ui/firewallContextMenu';

// 全局变量
import { sftpManager } from './modules/remote/sftpManager';

// 创建设置管理器实例
const settingsManager = new SettingsManager();
const settingsPageManager = new SettingsPageManager(settingsManager);

// 创建进程右键菜单实例
const processContextMenu = new ProcessContextMenu();

// 创建网络连接右键菜单实例
const networkContextMenu = new NetworkContextMenu();

// 创建系统服务右键菜单实例
const serviceContextMenu = new ServiceContextMenu();

// 创建用户列表右键菜单实例
const userContextMenu = new UserContextMenu();

// 创建自启动右键菜单实例
const startupContextMenu = new StartupContextMenu();

// 创建计划任务右键菜单实例
const cronContextMenu = new CronContextMenu();

// 创建防火墙右键菜单实例
const firewallContextMenu = new FirewallContextMenu();

import { sshConnectionDialog } from './modules/ui/sshConnectionDialog';
import { sshTerminalManager } from './modules/ssh/sshTerminalManager';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import './css/base.css';
import './css/dropdowns.css';
import 'xterm/css/xterm.css';

/**
 * 在新窗口中打开SSH终端
 */
async function openSSHTerminalWindow(): Promise<void> {
  try {
    // 首先检查是否已经存在SSH终端窗口
    const existingWindow = await WebviewWindow.getByLabel('ssh-terminal');

    if (existingWindow) {
      // 如果窗口已存在，聚焦到该窗口
      console.log('🔍 检测到已存在的SSH终端窗口，聚焦到该窗口');
      await existingWindow.setFocus();
      await existingWindow.unminimize();
      return;
    }

    // 创建新窗口
    console.log('🆕 创建新的SSH终端窗口');

    // 检测平台，macOS 使用原生标题栏，其他平台使用自定义标题栏
    const isMacOS = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const sshWindow = new WebviewWindow('ssh-terminal', {
      url: '/ssh-terminal.html',
      title: 'SSH Terminal - LovelyRes',
      width: 1000,
      height: 700,
      minWidth: 600,
      minHeight: 400,
      resizable: true,
      maximizable: true,
      minimizable: true,
      closable: true,
      center: true,
      decorations: isMacOS, // macOS 使用原生标题栏，其他平台使用自定义标题栏
      alwaysOnTop: false,
      skipTaskbar: false
    });

    // 等待窗口创建完成
    sshWindow.once('tauri://created', () => {
      console.log('✅ SSH终端窗口已创建');
    });

    // 监听窗口创建错误
    sshWindow.once('tauri://error', (error) => {
      console.error('❌ SSH终端窗口创建错误:', error);
    });

    // 监听窗口关闭事件
    sshWindow.once('tauri://close-requested', () => {
      console.log('🔧 SSH终端窗口即将关闭');
    });

  } catch (error) {
    console.error('❌ 创建SSH终端窗口失败:', error);

    // 如果是因为窗口已存在导致的错误，尝试获取并聚焦
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('🔄 窗口已存在，尝试聚焦...');
      const existingWindow = await WebviewWindow.getByLabel('ssh-terminal');
      if (existingWindow) {
        try {
          await existingWindow.setFocus();
          await existingWindow.unminimize();
          console.log('✅ 已聚焦到现有窗口');
          return;
        } catch (focusError) {
          console.error('❌ 聚焦窗口失败:', focusError);
        }
      }
    }

    // 如果创建窗口失败，可以考虑使用浏览器的window.open作为备选方案
    const fallbackWindow = window.open('/ssh-terminal.html', 'ssh-terminal',
      'width=1000,height=700,resizable=yes,scrollbars=yes,status=yes');
    if (fallbackWindow) {
      console.log('✅ 使用浏览器窗口打开SSH终端');
    } else {
      console.error('❌ 无法打开SSH终端窗口');
    }
  }
}


// 全局应用实例
let app: LovelyResApp;
import { FileViewerModal } from './modules/ui/fileViewerModal';
import { PermissionsModal } from './modules/ui/permissionsModal';
import { EmergencyResultModal } from './modules/ui/emergencyModal';
import { CommandHistoryModal } from './modules/ui/commandHistoryModal';
import { FileContextMenu } from './modules/ui/fileContextMenu';
import { LogContextMenu } from './modules/ui/logContextMenu';

// 移除旧的SSH连接状态变量，现在由模块化管理器处理

/**
 * 应用初始化
 */
// 通知动画样式已移除

async function initializeApp() {
  try {
  console.log('🚀 LovelyRes 启动中...');

  // 创建应用实例
  app = new LovelyResApp();

  // 初始化应用
  // 初始化模态组件
  const fileViewerModal = new FileViewerModal();
  const permissionsModal = new PermissionsModal();
  const emergencyResultModal = new EmergencyResultModal();
  const commandHistoryModal = new CommandHistoryModal();
  const fileContextMenu = new FileContextMenu();
  const logContextMenu = new LogContextMenu(); // 初始化日志右键菜单

  // 将模态组件添加到全局作用域
  (window as any).fileViewerModal = fileViewerModal;
  (window as any).permissionsModal = permissionsModal;
  (window as any).emergencyResultModal = emergencyResultModal;
  (window as any).commandHistoryModal = commandHistoryModal;
  (window as any).fileContextMenu = fileContextMenu;
  (window as any).logContextMenu = logContextMenu;

  // 添加全局日志右键菜单监听
  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    // 检查是否点击了日志条目
    const logEntry = target.closest('.log-entry');
    if (logEntry) {
      e.preventDefault();
      // 获取日志内容，去除多余空白
      const content = logEntry.textContent?.trim().replace(/\s+/g, ' ') || '';
      if (content) {
        logContextMenu.showContextMenu(e.clientX, e.clientY, content);
      }
    }
  });

  console.log('✅ 所有模态组件已初始化');

  await app.initialize();

  console.log('✅ LovelyRes 启动完成');

    // 移除加载屏幕
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      // 添加隐藏类以触发过渡动画
      loadingScreen.classList.add('hidden');

      // 等待动画完成后从DOM中移除
      setTimeout(() => {
        loadingScreen.remove();
      }, 600); // 与CSS过渡时间保持一致
    }

    // 将应用实例暴露到全局，供其他模块使用
    (window as any).app = app;

    // 将SSH终端窗口函数暴露到全局
    (window as any).openSSHTerminalWindow = openSSHTerminalWindow;

    // 延迟初始化SSH终端组件（等待DOM渲染完成）
    setTimeout(() => {
      // SSH终端容器现在始终存在于DOM中，可以安全地挂载组件
      if (document.getElementById('ssh-terminal-container')) {
        sshTerminalManager.mountTerminal();
        console.log('✅ SSH终端组件预挂载完成');
      } else {
        console.log('⚠️ SSH终端容器尚未准备就绪');
      }
    }, 1000); // 给足够时间让DOM渲染完成


    // 提供全局函数供面板按钮直接调用（避免重复绑定与渲染时机问题）
    (window as any).sftpRefresh = () => {
      try {
        if (sftpManager && (sftpManager as any).refreshCurrentDirectory) {
          (sftpManager as any).refreshCurrentDirectory();
          (window as any).showNotification && (window as any).showNotification('文件列表已刷新', 'success');
        } else {
          console.warn('sftpManager.refreshCurrentDirectory 不可用');
        }
      } catch (e) {
        console.error('刷新失败:', e);
        (window as any).showNotification && (window as any).showNotification(`刷新失败: ${e}`, 'error');
      }
    };

    (window as any).sftpOpenUpload = () => {
      try {
        if (sftpManager && (sftpManager as any).getCurrentPath && (window as any).uploadModal) {
          const currentPath = (sftpManager as any).getCurrentPath();
          (window as any).uploadModal.show(currentPath);
        } else {
          console.warn('uploadModal 或 sftpManager.getCurrentPath 不可用');
        }
      } catch (e) {
        console.error('打开上传对话框失败:', e);
        (window as any).showNotification && (window as any).showNotification(`打开上传失败: ${e}`, 'error');
      }
    };

    (window as any).sftpOpenCreateFolder = () => {
      try {
        if (sftpManager && (sftpManager as any).getCurrentPath && (window as any).createFolderModal) {
          const currentPath = (sftpManager as any).getCurrentPath();
          (window as any).createFolderModal.show(currentPath);
        } else {
          console.warn('createFolderModal 或 sftpManager.getCurrentPath 不可用');
        }
      } catch (e) {
        console.error('打开新建文件夹对话框失败:', e);
        (window as any).showNotification && (window as any).showNotification(`打开新建失败: ${e}`, 'error');
      }
    };

    (window as any).toggleSftpHistory = () => {
      try {
        if ((window as any).fileContextMenu && (window as any).fileContextMenu.showHistoryModal) {
          (window as any).fileContextMenu.showHistoryModal();
        } else {
          console.warn('fileContextMenu 不可用');
        }
      } catch (e) {
        console.error('显示历史记录失败:', e);
      }
    };

    // 初始化SFTP文件管理
    console.log('📁 专注于SFTP文件管理功能');

    // 将应用实例暴露到全局，方便调试
    (window as any).lovelyResApp = app;

    // 添加全局模态框函数
    setupGlobalModalFunctions(app);

    // 初始化远程操作管理器
    await remoteOperationsManager.initialize();

    // 初始化 SSH 终端管理器
    await sshTerminalManager.initialize();

    // 初始化设置管理器
    await settingsManager.initialize();


    // 将管理器暴露到全局，供HTML调用
    (window as any).remoteOperationsManager = remoteOperationsManager;
    (window as any).sshConnectionManager = sshConnectionManager;
    (window as any).sftpManager = sftpManager;
    (window as any).sshTerminalManager = sshTerminalManager;
    (window as any).quickDetection = quickDetectionManager;

    (window as any).sshConnectionDialog = sshConnectionDialog;

    // SFTP UI helpers: sorting + context menu
    (window as any).setSftpSortMode = (mode: 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'modified-asc' | 'modified-desc') => {
      try {
        sftpManager.setSortMode(mode);
      } catch (e) {
        console.error('设置排序方式失败:', e);
      }
    };

    const ctxMenuElId = 'sftp-context-menu';
    const getCtxEl = () => document.getElementById(ctxMenuElId);
    let sftpCtx: { index: number | null } = { index: null };

    // 复制文件完整路径功能处理
    (window as any).sftpCopyPathSelected = async () => {
      console.log('复制路径被选择，索引:', sftpCtx.index);
      const idx = sftpCtx.index;
      if (idx == null || idx < 0) {
        console.warn('无效的文件索引:', idx);
        return;
      }
      (window as any).hideSftpContextMenu();
      try {
        const file = sftpManager.getFileByIndex(idx);
        console.log('获取到文件信息:', file);
        if (!file) return;

        // 复制完整路径到剪贴板，确保使用正斜杠
        const fullPath = file.path.replace(/\\/g, '/');
        await navigator.clipboard.writeText(fullPath);
        (window as any).showNotification && (window as any).showNotification(`路径已复制到剪贴板: ${fullPath}`, 'success');
      } catch (e) {
        console.error('复制路径失败:', e);
        (window as any).showNotification && (window as any).showNotification(`复制路径失败: ${e}`, 'error');
      }
    };



    // 查看文件详细信息功能处理
    (window as any).sftpFileDetailsSelected = async () => {
      console.log('查看详情被选择，索引:', sftpCtx.index);
      const idx = sftpCtx.index;
      if (idx == null || idx < 0) {
        console.warn('无效的文件索引:', idx);
        return;
      }
      (window as any).hideSftpContextMenu();
      try {
        const file = sftpManager.getFileByIndex(idx);
        console.log('获取到文件信息:', file);
        if (!file) return;

        // 使用文件详情模态框
        const fileDetailsModal = (window as any).fileDetailsModal;
        if (fileDetailsModal) {
          console.log('打开文件详情:', file.path);
          await fileDetailsModal.show(file.path);
        } else {
          console.error('文件详情模态框未找到');
          (window as any).showNotification && (window as any).showNotification('文件详情功能暂不可用', 'warning');
        }
      } catch (e) {
        console.error('查看文件详情失败:', e);
        (window as any).showNotification && (window as any).showNotification(`查看详情失败: ${e}`, 'error');
      }
    };

    // 文件安全分析功能处理
    (window as any).sftpFileSecurityAnalysis = async (action: string) => {
      console.log('文件安全分析被选择，动作:', action, '索引:', sftpCtx.index);
      // 立即保存索引，避免被清空
      const idx = sftpCtx.index;
      console.log('保存的索引:', idx);

      // 先隐藏菜单
      (window as any).hideSftpContextMenu();

      if (idx == null || idx < 0) {
        console.warn('无效的文件索引:', idx);
        return;
      }

      try {
        const file = sftpManager.getFileByIndex(idx);
        console.log('获取到文件信息:', file);
        if (!file) return;

        // 使用文件安全分析模态框
        const fileContextMenu = (window as any).fileContextMenu;
        if (fileContextMenu) {
          console.log('执行文件安全分析:', action, file.path);
          await fileContextMenu.handleAction(action, file.path);
        } else {
          console.error('文件安全分析模块未找到');
          (window as any).showNotification && (window as any).showNotification('文件安全分析功能暂不可用', 'warning');
        }
      } catch (e) {
        console.error('文件安全分析失败:', e);
        (window as any).showNotification && (window as any).showNotification(`安全分析失败: ${e}`, 'error');
      }
    };

    (window as any).showSftpContextMenu = (ev: MouseEvent, index: number) => {
      console.log('显示SFTP上下文菜单，索引:', index);
      ev.preventDefault();
      ev.stopPropagation();
      sftpCtx.index = index;
      const menu = getCtxEl();
      if (!menu) {
        console.error('找不到上下文菜单元素:', ctxMenuElId);
        return;
      }

      // 根据文件类型显示相应的菜单项
      const files = sftpManager.getCurrentFiles();
      const file = files[index];

      // 获取菜单按钮元素
      const menuButtons = {
        compress: document.getElementById('sftp-ctx-compress'),
        extract: document.getElementById('sftp-ctx-extract'),
        download: document.getElementById('sftp-ctx-download')
      };

      if (menuButtons.compress && menuButtons.extract && menuButtons.download && file) {
        // 检查是否为压缩文件
        const isArchive = file.name.match(/\.(tar\.gz|tgz|tar\.bz2|tbz2|tar|zip)$/i);

        if (isArchive) {
          // 压缩文件显示解压选项
          menuButtons.compress.style.display = 'none';
          menuButtons.extract.style.display = 'block';
        } else {
          // 普通文件或文件夹显示打包选项
          menuButtons.compress.style.display = 'block';
          menuButtons.extract.style.display = 'none';
        }

        // 下载按钮只对文件显示，目录不显示
        if (file.file_type === 'directory') {
          menuButtons.download.style.display = 'none';
        } else {
          menuButtons.download.style.display = 'block';
        }
      }

      // Compute position within viewport bounds
      const padding = 8; // 增加边距
      const { clientX: x, clientY: y } = ev;
      menu.style.display = 'block';
      // Temporarily position to measure size
      menu.style.left = x + 'px';
      menu.style.top = y + 'px';
      const rect = menu.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = x;
      let top = y;

      // 检测右侧边界，如果超出则向左调整
      if (rect.right > vw - padding) {
        left = Math.max(padding, vw - rect.width - padding);
      }

      // 检测底部边界，如果超出则向上调整
      // 增加额外的偏移量，让菜单更靠上
      if (rect.bottom > vh - padding) {
        top = Math.max(padding, vh - rect.height - padding);
        // 额外向上偏移 20px
        top = Math.max(padding, top - 20);
      }

      menu.style.left = left + 'px';
      menu.style.top = top + 'px';

      // 添加子菜单边缘检测
      const adjustSubmenuPosition = () => {
        const submenus = menu.querySelectorAll('.ctx-submenu');
        submenus.forEach((submenu: Element) => {
          const submenuEl = submenu as HTMLElement;
          const parent = submenuEl.parentElement;

          if (!parent) return;

          // 监听父菜单项的 mouseenter 事件
          parent.addEventListener('mouseenter', () => {
            // 等待子菜单显示后再检测位置
            setTimeout(() => {
              if (submenuEl.style.display === 'none') return;

              const submenuRect = submenuEl.getBoundingClientRect();
              const vw = window.innerWidth;
              const vh = window.innerHeight;

              // 检测右侧是否超出窗口（增加更大的安全边距）
              if (submenuRect.right > vw - padding * 2) {
                submenuEl.classList.add('show-left');
              } else {
                submenuEl.classList.remove('show-left');
              }

              // 检测底部是否超出窗口（增加更大的安全边距）
              if (submenuRect.bottom > vh - padding * 2) {
                submenuEl.classList.add('adjust-top');
              } else {
                submenuEl.classList.remove('adjust-top');
              }
            }, 10);
          });
        });
      };

      adjustSubmenuPosition();

      // 为菜单项添加点击事件监听器
      const quickViewBtn = document.getElementById('sftp-ctx-quick-view');
      const editPermsBtn = document.getElementById('sftp-ctx-edit-perms');
      const compressBtn = document.getElementById('sftp-ctx-compress');
      const extractBtn = document.getElementById('sftp-ctx-extract');
      const downloadBtn = document.getElementById('sftp-ctx-download');
      const copyPathBtn = document.getElementById('sftp-ctx-copy-path');

      const fileDetailsBtn = document.getElementById('sftp-ctx-file-details');

      // 文件安全分析子菜单项
      const securityAnalysisItems = document.querySelectorAll('#sftp-ctx-security-analysis .ctx-item[data-action]');

      if (quickViewBtn) {
        quickViewBtn.onclick = (e) => {
          e.stopPropagation();
          (window as any).sftpQuickViewSelected();
        };
      }

      if (editPermsBtn) {
        editPermsBtn.onclick = (e) => {
          e.stopPropagation();
          (window as any).sftpEditPermissionsSelected();
        };
      }

      if (compressBtn) {
        compressBtn.onclick = (e) => {
          e.stopPropagation();
          (window as any).sftpCompressSelected();
        };
      }

      if (extractBtn) {
        extractBtn.onclick = (e) => {
          e.stopPropagation();
          (window as any).sftpExtractSelected();
        };
      }

      if (downloadBtn) {
        downloadBtn.onclick = (e) => {
          e.stopPropagation();
          (window as any).sftpDownloadSelected();
        };
      }

      if (copyPathBtn) {
        copyPathBtn.onclick = (e) => {
          e.stopPropagation();
          (window as any).sftpCopyPathSelected();
        };
      }



      if (fileDetailsBtn) {
        fileDetailsBtn.onclick = (e) => {
          e.stopPropagation();
          (window as any).sftpFileDetailsSelected();
        };
      }

      // 初始化菜单的鼠标事件处理
      const app = (window as any).app;
      if (app && app.modernUIRenderer && app.modernUIRenderer.sftpContextMenuRenderer) {
        app.modernUIRenderer.sftpContextMenuRenderer.initializeMenuEvents();
      }

      // 文件安全分析子菜单项事件
      securityAnalysisItems.forEach(item => {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation(); // 阻止其他事件监听器
          const action = (item as HTMLElement).getAttribute('data-action');
          if (action) {
            console.log('菜单项被点击，动作:', action, '当前索引:', sftpCtx.index);
            (window as any).sftpFileSecurityAnalysis(action);
          }
        }, true); // 使用捕获阶段，确保在 close 事件之前执行
      });

      // Click outside to close
      const close = (e: Event) => {
        // 如果点击的是菜单项，不关闭菜单
        if (e.target && (e.target as Element).closest('#sftp-context-menu')) {
          return;
        }
        (window as any).hideSftpContextMenu();
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
    };

    (window as any).hideSftpContextMenu = () => {
      const menu = getCtxEl();
      if (menu) menu.style.display = 'none';
      sftpCtx.index = null;
    };

    (window as any).sftpQuickViewSelected = async () => {
      console.log('快速查看被选择，索引:', sftpCtx.index);
      const idx = sftpCtx.index;
      if (idx == null || idx < 0) {
        console.warn('无效的文件索引:', idx);
        return;
      }
      (window as any).hideSftpContextMenu();
      try {
        const file = sftpManager.getFileByIndex(idx);
        console.log('获取到文件信息:', file);
        if (!file || file.file_type === 'directory') {
          (window as any).showNotification && (window as any).showNotification('只能查看文件，不能查看目录', 'warning');
          return;
        }

        // 使用文件查看器模态
        const fileViewerModal = (window as any).fileViewerModal;
        if (fileViewerModal) {
          console.log('打开文件查看器:', file.path);
          await fileViewerModal.show(file.path, true); // 只读模式
        } else {
          console.error('文件查看器模态未找到');
        }
      } catch (e) {
        console.error('打开快速查看失败:', e);
        (window as any).showNotification && (window as any).showNotification(`打开文件失败: ${e}`, 'error');
      }
    };

    (window as any).sftpEditPermissionsSelected = async () => {
      console.log('权限编辑被选择，索引:', sftpCtx.index);
      const idx = sftpCtx.index;
      if (idx == null || idx < 0) {
        console.warn('无效的文件索引:', idx);
        return;
      }
      (window as any).hideSftpContextMenu();
      try {
        const file = sftpManager.getFileByIndex(idx);
        console.log('获取到文件信息:', file);
        if (!file) return;

        // 使用权限编辑模态
        const permissionsModal = (window as any).permissionsModal;
        if (permissionsModal) {
          console.log('打开权限编辑器:', file.path, file.permissions);
          permissionsModal.show(file.path, file.permissions);
        } else {
          console.error('权限编辑模态未找到');
        }
      } catch (e) {
        console.error('打开权限编辑失败:', e);
        (window as any).showNotification && (window as any).showNotification(`打开权限编辑失败: ${e}`, 'error');
      }
    };

    // 打包功能处理
    (window as any).sftpCompressSelected = async () => {
      console.log('打包被选择，索引:', sftpCtx.index);
      const idx = sftpCtx.index;
      if (idx == null || idx < 0) {
        console.warn('无效的文件索引:', idx);
        return;
      }
      (window as any).hideSftpContextMenu();
      try {
        const file = sftpManager.getFileByIndex(idx);
        console.log('获取到文件信息:', file);
        if (!file) return;

        // 使用打包模态
        const compressModal = (window as any).compressModal;
        if (compressModal) {
          console.log('打开打包器:', file.path);
          compressModal.show(file.path, file.file_type);
        } else {
          console.error('打包模态未找到');
        }
      } catch (e) {
        console.error('打开打包功能失败:', e);
        (window as any).showNotification && (window as any).showNotification(`打开打包功能失败: ${e}`, 'error');
      }
    };

    // 解压功能处理
    (window as any).sftpExtractSelected = async () => {
      console.log('解压被选择，索引:', sftpCtx.index);
      const idx = sftpCtx.index;
      if (idx == null || idx < 0) {
        console.warn('无效的文件索引:', idx);
        return;
      }
      (window as any).hideSftpContextMenu();
      try {
        const file = sftpManager.getFileByIndex(idx);
        console.log('获取到文件信息:', file);
        if (!file) return;

        // 使用解压模态
        const extractModal = (window as any).extractModal;
        if (extractModal) {
          console.log('打开解压器:', file.path);
          extractModal.show(file.path);
        } else {
          console.error('解压模态未找到');
        }
      } catch (e) {
        console.error('打开解压功能失败:', e);
        (window as any).showNotification && (window as any).showNotification(`打开解压功能失败: ${e}`, 'error');
      }
    };

    // 下载功能处理
    (window as any).sftpDownloadSelected = async () => {
      console.log('下载被选择，索引:', sftpCtx.index);
      const idx = sftpCtx.index;
      if (idx == null || idx < 0) {
        console.warn('无效的文件索引:', idx);
        return;
      }
      (window as any).hideSftpContextMenu();
      try {
        const file = sftpManager.getFileByIndex(idx);
        console.log('获取到文件信息:', file);
        if (!file) return;

        // 只允许下载文件，不允许下载目录
        if (file.file_type === 'directory') {
          (window as any).showNotification && (window as any).showNotification('不能下载目录，请选择文件', 'warning');
          return;
        }

        // 构建远程文件路径
        const remotePath = `${sftpManager.getCurrentPath()}/${file.name}`;

        try {
          // 调用Tauri的保存文件对话框
          const savePath = await (window as any).__TAURI__.dialog.save({
            defaultPath: file.name,
            filters: [{
              name: '所有文件',
              extensions: ['*']
            }]
          });

          if (savePath) {
            // 显示下载开始通知
            (window as any).showNotification && (window as any).showNotification(`开始下载: ${file.name}`, 'info');

            // 调用后端API下载文件
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
      } catch (e) {
        console.error('下载过程中发生错误:', e);
        (window as any).showNotification && (window as any).showNotification(`下载失败: ${e}`, 'error');
      }
    };

  } catch (error) {
    console.error('❌ LovelyRes 启动失败:', error);

    // 移除加载屏幕，确保错误信息可见
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.remove();
    }

    // 显示错误信息
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          background: #f8fafc;
          color: #1e293b;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <div style="font-size: 48px; margin-bottom: 24px;">❌</div>
          <h2 style="margin-bottom: 16px;">应用启动失败</h2>
          <p style="color: #64748b; text-align: center; max-width: 400px;">
            LovelyRes 在启动过程中遇到了问题。请检查控制台获取详细错误信息。
          </p>
          <button onclick="location.reload()" style="
            margin-top: 24px;
            padding: 12px 24px;
            background: #4299e1;
            color: white;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
          ">
            重新加载
          </button>
        </div>
      `;
    }
  }

  // 使用事件委托方式添加SSH终端按钮的点击事件监听器
  // 这样即使按钮被重新渲染，事件监听器也不会丢失
  document.body.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    // 检查点击的元素或其父元素是否是SSH终端按钮
    const terminalBtn = target.closest('#ssh-terminal-title-btn');
    if (terminalBtn) {
      console.log('🖱️ SSH终端按钮被点击');
      event.preventDefault();
      event.stopPropagation();
      openSSHTerminalWindow();
    }
  });
  console.log('✅ SSH终端按钮事件监听器已添加（事件委托方式）');

  // 数据库管理相关全局函数
  (window as any).switchDatabaseView = (viewType: string) => {
    console.log('切换数据库视图:', viewType);
    // update active class in sidebar
    const items = document.querySelectorAll('.database-sidebar .db-list-item');
    items.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('onclick')?.includes(`'${viewType}'`)) {
            item.classList.add('active');
        }
    });
    
    // TODO: Filter content based on viewType
    (window as any).showNotification && (window as any).showNotification(`切换到视图: ${viewType}`, 'info');
  };

  (window as any).showAddDatabaseModal = () => {
    console.log('打开添加数据库模态框');
    (window as any).showNotification && (window as any).showNotification('添加数据库连接功能即将上线', 'info');
  };

  // 全局点击事件：清除表格选中状态
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    // 如果点击的不是表格行，也不是右键菜单
    if (!target.closest('tr') && !target.closest('[id$="-context-menu"]')) {
      document.querySelectorAll('.system-table tr.selected').forEach(row => {
        row.classList.remove('selected');
      });
    }
  });
}

/**
 * DOM加载完成后初始化应用
 */
document.addEventListener('DOMContentLoaded', initializeApp);

/**
 * 页面卸载时清理资源
 */
window.addEventListener('beforeunload', () => {
  if (app) {
    // 这里可以添加清理逻辑
    console.log('🧹 LovelyRes 正在清理资源...');
  }
});

/**
 * 全局错误处理
 */
window.addEventListener('error', (event) => {
  // 某些情况下 event.error 为 null（如资源加载错误），降级输出基础信息，避免刷屏
  const anyEvt: any = event as any;
  // 忽略 ResizeObserver 的已知噪声错误
  const msg = (event && (event as any).message) as string | undefined;
  if (msg && typeof msg === 'string' && msg.includes('ResizeObserver loop')) {
    return;
  }

  if (anyEvt && anyEvt.error) {
    console.error('全局错误:', anyEvt.error);
  } else {
    console.error('全局错误:', event.message, event.filename, event.lineno, event.colno);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise拒绝:', event.reason);
});

/**
 * 全局通知函数
 */
(window as any).showNotification = function (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
  // 确保通知容器存在
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    container.style.cssText = `
      position: fixed;
      top: 30px;
      right: 30px;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 16px;
      pointer-events: none;
      width: 400px;
      max-width: 90vw;
    `;
    document.body.appendChild(container);
  }

  // 映射类型到 CSS 变量
  const typeColorMap = {
    success: 'var(--success-color)',
    error: 'var(--error-color)',
    info: 'var(--info-color)',
    warning: 'var(--warning-color)'
  };

  const typeIconMap = {
    success: 'M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z',
    error: 'M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c-9.4 9.4-9.4 24.6 0 33.9l47 47-47 47c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l47-47 47 47c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-47-47 47-47c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0z',
    info: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z',
    warning: 'M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z'
  };

  const typeTitleMap = {
    success: '成功',
    error: '错误',
    info: '提示',
    warning: '警告'
  };

  const primaryColor = typeColorMap[type];
  const iconPath = typeIconMap[type];
  const title = typeTitleMap[type];

  // 创建通知元素
  const notification = document.createElement('div');
  notification.className = 'modern-notification';

  // 使用 CSS 变量进行主题适配
  notification.style.cssText = `
    width: 100%;
    min-height: 76px;
    border-radius: 12px;
    box-sizing: border-box;
    padding: 16px;
    
    /* 核心主题变量 */
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-lg);
    
    /* 装饰性边框 */
    border-left: 4px solid ${primaryColor};
    
    overflow: hidden;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    position: relative;
    pointer-events: auto;
    transform-origin: top right;
    animation: slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1);
    backdrop-filter: blur(8px);
  `;

  notification.innerHTML = `
    <!-- 背景波浪纹装饰 -->
    <svg style="
      position: absolute;
      transform: rotate(90deg);
      left: -30px;
      top: 20px;
      width: 90px;
      height: 90px;
      fill: ${primaryColor};
      opacity: 0.08;
      pointer-events: none;
    " viewBox="0 0 1440 320" xmlns="http://www.w3.org/2000/svg">
      <path d="M0,256L11.4,240C22.9,224,46,192,69,192C91.4,192,114,224,137,234.7C160,245,183,235,206,213.3C228.6,192,251,160,274,149.3C297.1,139,320,149,343,181.3C365.7,213,389,267,411,282.7C434.3,299,457,277,480,250.7C502.9,224,526,192,549,181.3C571.4,171,594,181,617,208C640,235,663,277,686,256C708.6,235,731,149,754,122.7C777.1,96,800,128,823,165.3C845.7,203,869,245,891,224C914.3,203,937,117,960,112C982.9,107,1006,181,1029,197.3C1051.4,213,1074,171,1097,144C1120,117,1143,107,1166,133.3C1188.6,160,1211,224,1234,218.7C1257.1,213,1280,139,1303,133.3C1325.7,128,1349,192,1371,192C1394.3,192,1417,128,1429,96L1440,64L1440,320L1428.6,320C1417.1,320,1394,320,1371,320C1348.6,320,1326,320,1303,320C1280,320,1257,320,1234,320C1211.4,320,1189,320,1166,320C1142.9,320,1120,320,1097,320C1074.3,320,1051,320,1029,320C1005.7,320,983,320,960,320C937.1,320,914,320,891,320C868.6,320,846,320,823,320C800,320,777,320,754,320C731.4,320,709,320,686,320C662.9,320,640,320,617,320C594.3,320,571,320,549,320C525.7,320,503,320,480,320C457.1,320,434,320,411,320C388.6,320,366,320,343,320C320,320,297,320,274,320C251.4,320,229,320,206,320C182.9,320,160,320,137,320C114.3,320,91,320,69,320C45.7,320,23,320,11,320L0,320Z"></path>
    </svg>

    <!-- 图标容器 -->
    <div style="
      width: 36px;
      height: 36px;
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      flex-shrink: 0;
      z-index: 1;
    ">
      <!-- 图标背景圆 -->
      <div style="
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100%;
        background-color: ${primaryColor};
        opacity: 0.15;
        border-radius: 10px;
      "></div>
      
      <!-- 图标SVG -->
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        style="width: 20px; height: 20px; color: ${primaryColor}; position: relative; z-index: 2;"
        fill="currentColor"
      >
        <path d="${iconPath}"></path>
      </svg>
    </div>

    <!-- 文本内容 -->
    <div style="
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: flex-start;
      flex-grow: 1;
      min-width: 0;
      z-index: 1;
      padding-top: 2px;
    ">
      <p style="
        margin: 0 0 6px 0;
        color: ${primaryColor};
        font-size: 14px;
        font-weight: 600;
        cursor: default;
        line-height: 1.2;
      ">${title}</p>
      <p style="
        margin: 0;
        font-size: 13px;
        color: var(--text-secondary);
        cursor: default;
        word-wrap: break-word;
        line-height: 1.5;
      ">${message}</p>
    </div>

    <!-- 关闭按钮 -->
    <button style="
      background: transparent;
      border: none;
      cursor: pointer;
      padding: 6px;
      margin: -6px -6px 0 0;
      color: var(--text-light);
      transition: all 0.2s;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
    "
    onmouseover="this.style.color='var(--text-primary)'; this.style.backgroundColor='var(--bg-tertiary)'"
    onmouseout="this.style.color='var(--text-light)'; this.style.backgroundColor='transparent'"
    title="关闭"
    >
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  `;

  // 添加动画样式（如果还没有）
  if (!document.getElementById('notification-animations')) {
    const style = document.createElement('style');
    style.id = 'notification-animations';
    style.textContent = `
      @keyframes slideInRight {
        from { transform: translateX(100%) scale(0.9); opacity: 0; }
        to { transform: translateX(0) scale(1); opacity: 1; }
      }
      @keyframes slideOutRight {
        from { transform: translateX(0) scale(1); opacity: 1; }
        to { transform: translateX(100%) scale(0.9); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  // 点击关闭按钮关闭
  const closeBtn = notification.querySelector('button');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notification.style.animation = 'slideOutRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
      setTimeout(() => notification.remove(), 300);
    });
  }

  // 添加到容器
  container.appendChild(notification);

  // 4秒后自动移除
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideOutRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
      setTimeout(() => notification.remove(), 300);
    }
  }, 4000);
};

/**
 * 设置全局模态框函数
 */
function setupGlobalModalFunctions(app: LovelyResApp) {
  // 将应用实例暴露到全局，供其他函数使用
  (window as any).app = app;

  // 系统信息数据缓存
  (window as any).systemInfoCache = {
    detailedInfo: null,
    lastUpdate: null,
    isLoading: false
  };

  // 显示服务器模态框
  (window as any).showServerModal = () => {
    const existingModal = document.getElementById('server-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modalHTML = app.getStateManager().getUIRenderer().renderServerModal();
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('server-modal');
    if (modal) {
      // 先设置为 flex 但透明
      modal.style.display = 'flex';

      // 强制浏览器重绘 (Reflow) 以确保过渡动画生效
      modal.offsetHeight;

      // 设置不透明，触发 CSS transition
      modal.style.opacity = '1';

      // 如果有内容区域，也可以添加缩放动画
      const content = modal.querySelector('.modal-content') as HTMLElement;
      if (content) {
        content.style.transform = 'scale(1)';
      }
    }
  };

  // 隐藏服务器模态框
  (window as any).hideServerModal = () => {
    const modal = document.getElementById('server-modal');
    if (modal) {
      // 触发淡出动画
      modal.style.opacity = '0';

      const content = modal.querySelector('.modal-content') as HTMLElement;
      if (content) {
        content.style.transform = 'scale(0.98)';
      }

      // 等待动画结束后隐藏/移除
      setTimeout(() => {
        if (modal && modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      }, 200); // 200ms 对应 CSS 中的 transition 时间
    }
  };

  // 显示添加服务器表单
  (window as any).showAddServerForm = () => {
    const serverList = document.getElementById('server-list');
    const addForm = document.getElementById('add-server-form');

    if (serverList && addForm) {
      // 如果不是编辑模式，检查服务器数量限制
      if (!(window as any).editingServerId) {
        // 检查 VIP 权限和服务器数量限制
        const sshManager = (window as any).app?.sshManager;
        if (sshManager) {
        }

        // 重置表单标题和按钮文本
        const formTitle = document.querySelector('#add-server-form h3');
        if (formTitle) {
          formTitle.textContent = '添加新服务器';
        }

        const submitButton = document.querySelector('#add-server-form button[type="submit"]');
        if (submitButton) {
          submitButton.textContent = '保存服务器';
        }

        // 清空表单
        const form = document.getElementById('add-server-form-element') as HTMLFormElement;
        if (form) {
          form.reset();
        }
      }

      serverList.style.display = 'none';
      addForm.style.display = 'block';
    }
  };

  // 隐藏添加服务器表单
  (window as any).hideAddServerForm = () => {
    const serverList = document.getElementById('server-list');
    const addForm = document.getElementById('add-server-form');

    if (serverList && addForm) {
      // 清除编辑模式标识和保存的加密密码
      (window as any).editingServerId = null;
      (window as any).editingServerEncryptedPassword = null;

      serverList.style.display = 'block';
      addForm.style.display = 'none';
    }
  };

  // 切换认证字段
  (window as any).toggleAuthFields = (authType: string) => {
    const passwordAuth = document.getElementById('password-auth');
    const keyAuth = document.getElementById('key-auth');

    if (passwordAuth && keyAuth) {
      passwordAuth.style.display = authType === 'password' ? 'block' : 'none';
      keyAuth.style.display = authType === 'key' ? 'block' : 'none';
    }
  };

  // 初始化额外账号列表
  (window as any).additionalAccounts = [];

  // 添加服务器账号
  (window as any).addServerAccount = () => {
    const accountsList = document.getElementById('additional-accounts-list');
    if (!accountsList) return;

    const accountId = `account-${Date.now()}`;
    const accountHtml = `
      <div class="account-item" id="${accountId}" style="
        padding: var(--spacing-md);
        background: var(--bg-tertiary);
        border-radius: var(--border-radius);
        border: 1px solid var(--border-color);
      ">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
          <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">账号 #${(window as any).additionalAccounts.length + 2}</span>
          <button type="button" onclick="window.removeServerAccount('${accountId}')" style="
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 16px;
            padding: 0 4px;
          " title="删除账号">×</button>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm);">
          <div>
            <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">用户名</label>
            <input type="text" class="extra-account-username" placeholder="例如: superuser" style="
              width: 100%;
              padding: 6px 8px;
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius-sm);
              background: var(--bg-secondary);
              color: var(--text-primary);
              font-size: 11px;
            " required>
          </div>
          <div>
            <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">描述（可选）</label>
            <input type="text" class="extra-account-description" placeholder="例如: 数据库管理员" style="
              width: 100%;
              padding: 6px 8px;
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius-sm);
              background: var(--bg-secondary);
              color: var(--text-primary);
              font-size: 11px;
            ">
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm);">
          <div>
            <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">认证方式</label>
            <select class="extra-account-authType" style="
              width: 100%;
              padding: 6px 8px;
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius-sm);
              background: var(--bg-secondary);
              color: var(--text-primary);
              font-size: 11px;
            " onchange="window.toggleExtraAccountAuthFields('${accountId}', this.value)">
              <option value="password">密码认证</option>
              <option value="key">SSH密钥</option>
            </select>
          </div>
          <div class="extra-account-password-field">
            <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">密码</label>
            <input type="password" class="extra-account-password" placeholder="请输入密码" style="
              width: 100%;
              padding: 6px 8px;
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius-sm);
              background: var(--bg-secondary);
              color: var(--text-primary);
              font-size: 11px;
            ">
          </div>
          <div class="extra-account-key-field" style="display: none;">
            <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">私钥路径</label>
            <input type="text" class="extra-account-keyPath" placeholder="/path/to/key" style="
              width: 100%;
              padding: 6px 8px;
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius-sm);
              background: var(--bg-secondary);
              color: var(--text-primary);
              font-size: 11px;
            ">
          </div>
        </div>
        <div style="margin-top: var(--spacing-xs);">
          <label style="display: flex; align-items: center; font-size: 11px; color: var(--text-secondary); cursor: pointer;">
            <input type="checkbox" class="extra-account-isDefault" style="margin-right: 4px;">
            设为默认账号
          </label>
        </div>
      </div>
    `;

    accountsList.insertAdjacentHTML('beforeend', accountHtml);
    (window as any).additionalAccounts.push(accountId);
  };

  // 删除服务器账号
  (window as any).removeServerAccount = (accountId: string) => {
    const accountEl = document.getElementById(accountId);
    if (accountEl) {
      accountEl.remove();
      (window as any).additionalAccounts = (window as any).additionalAccounts.filter((id: string) => id !== accountId);
    }
  };

  // 切换额外账号的认证字段
  (window as any).toggleExtraAccountAuthFields = (accountId: string, authType: string) => {
    const accountEl = document.getElementById(accountId);
    if (!accountEl) return;

    const passwordField = accountEl.querySelector('.extra-account-password-field') as HTMLElement;
    const keyField = accountEl.querySelector('.extra-account-key-field') as HTMLElement;

    if (passwordField && keyField) {
      passwordField.style.display = authType === 'password' ? 'block' : 'none';
      keyField.style.display = authType === 'key' ? 'block' : 'none';
    }
  };

  // 处理服务器表单提交
  (window as any).handleServerFormSubmit = async (event: Event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const formData = new FormData(form);
    await (window as any).saveServer(formData);
  };

  // 切换连接下拉菜单
  (window as any).toggleConnectionDropdown = () => {
    const dropdown = document.getElementById('connection-dropdown-menu');
    const connectionCard = document.querySelector('.connection-card');
    if (dropdown && connectionCard) {
      const isVisible = dropdown.style.display !== 'none';
      if (isVisible) {
        dropdown.style.display = 'none';
      } else {
        // 刷新下拉菜单内容
        if (app) {
          dropdown.innerHTML = app.getStateManager().getUIRenderer().renderConnectionDropdownContent();
        }

        // 显示下拉菜单 (位置由CSS控制)
        dropdown.style.display = 'block';
      }
    }
  };

  // 隐藏连接下拉菜单
  (window as any).hideConnectionDropdown = () => {
    const dropdown = document.getElementById('connection-dropdown-menu');
    if (dropdown) {
      dropdown.style.display = 'none';
    }
  };

  // 点击其他地方时隐藏下拉菜单
  document.addEventListener('click', (event) => {
    const dropdown = document.getElementById('connection-dropdown-menu');
    const connectionCard = document.querySelector('.connection-card');
    const target = event.target as Node;

    if (dropdown && connectionCard) {
      // 如果点击的不是卡片也不是下拉菜单，则隐藏下拉菜单
      if (!connectionCard.contains(target) && !dropdown.contains(target)) {
        dropdown.style.display = 'none';
      }
    }
  });

  // 导航项点击处理
  document.addEventListener('click', (event) => {
    const navItem = (event.target as Element).closest('.nav-item');
    const settingsBtn = (event.target as Element).closest('.settings-btn');
    const settingsCloseBtn = (event.target as Element).closest('.settings-close-btn');
    const settingsOverlay = (event.target as Element).closest('.settings-overlay');

    if (navItem) {
      const navId = navItem.getAttribute('data-nav-id');
      if (navId) {
        (window as any).switchPage(navId);
      }
    } else if (settingsBtn) {
      // 显示设置覆盖层
      (window as any).showSettingsOverlay();
    } else if (settingsCloseBtn) {
      // 关闭设置覆盖层
      (window as any).hideSettingsOverlay();
    } else if (settingsOverlay && event.target === settingsOverlay) {
      // 点击覆盖层背景关闭设置
      (window as any).hideSettingsOverlay();
    }
  });

  // 系统信息标签页切换
  document.addEventListener('click', (event) => {
    const tabBtn = (event.target as Element).closest('.tab-btn');
    if (tabBtn) {
      const tabId = tabBtn.getAttribute('data-tab');
      if (tabId) {
        (window as any).switchSystemInfoTab(tabId);
      }
    }
  });

  // SFTP文件双击事件委托（双击进入目录）
  document.addEventListener('dblclick', (event) => {
    const fileItem = (event.target as Element).closest('.file-item');
    if (fileItem) {
      // 处理上级目录双击
      if (fileItem.hasAttribute('data-action') && fileItem.getAttribute('data-action') === 'parent') {
        console.log('🖱️ 委托处理上级目录双击');
        sftpManager.navigateToParent();
        return;
      }

      // 处理文件/文件夹双击
      const index = parseInt(fileItem.getAttribute('data-file-index') || '-1');
      if (index >= 0) {
        console.log('🖱️ 委托处理文件双击，索引:', index);
        sftpManager.handleFileClickByIndex(index);
      }
    }
  });

  // 表格过滤功能
  (window as any).filterTable = (tableType: string, searchTerm: string) => {
    const tbody = document.getElementById(`${tableType}-table-body`);
    const filterSelect = document.getElementById(`${tableType}-filter`) as HTMLSelectElement;
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    const searchLower = searchTerm.toLowerCase();
    const filterValue = filterSelect ? filterSelect.value.toLowerCase() : '';

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      let shouldShow = false;

      // 如果搜索词为空，显示所有行
      if (!searchTerm.trim()) {
        shouldShow = true;
      } else {
        // 检查每个单元格是否包含搜索词
        cells.forEach(cell => {
          const cellText = cell.textContent?.toLowerCase() || '';
          if (cellText.includes(searchLower)) {
            shouldShow = true;
          }
        });
      }

      // 应用类别筛选
      if (shouldShow && filterValue) {
        shouldShow = (window as any).checkCategoryFilter(tableType, row, filterValue);
      }

      // 应用状态筛选
      const statFilter = document.getElementById(`${tableType}-stat-filter`) as HTMLSelectElement;
      const statValue = statFilter ? statFilter.value : '';
      if (shouldShow && statValue) {
        shouldShow = (window as any).checkStatusFilter(tableType, row, statValue);
      }

      // 显示或隐藏行
      if (shouldShow) {
        (row as HTMLElement).style.display = '';
      } else {
        (row as HTMLElement).style.display = 'none';
      }
    });

    console.log(`🔍 表格 ${tableType} 过滤: "${searchTerm}"`);
  };

  // 按类别筛选表格
  (window as any).filterTableByCategory = (tableType: string, categoryValue: string) => {
    const tbody = document.getElementById(`${tableType}-table-body`);
    const searchInput = document.getElementById(`${tableType}-search`) as HTMLInputElement;
    const statFilter = document.getElementById(`${tableType}-stat-filter`) as HTMLSelectElement;
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const statValue = statFilter ? statFilter.value : '';

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      let shouldShow = true;

      // 应用搜索过滤
      if (searchTerm.trim()) {
        shouldShow = false;
        cells.forEach(cell => {
          const cellText = cell.textContent?.toLowerCase() || '';
          if (cellText.includes(searchTerm)) {
            shouldShow = true;
          }
        });
      }

      // 应用类别筛选
      if (shouldShow && categoryValue) {
        shouldShow = (window as any).checkCategoryFilter(tableType, row, categoryValue.toLowerCase());
      }

      // 应用状态筛选
      if (shouldShow && statValue) {
        shouldShow = (window as any).checkStatusFilter(tableType, row, statValue);
      }

      // 显示或隐藏行
      if (shouldShow) {
        (row as HTMLElement).style.display = '';
      } else {
        (row as HTMLElement).style.display = 'none';
      }
    });

    console.log(`🔍 表格 ${tableType} 按类别筛选: "${categoryValue}"`);
  };

  // 按状态筛选表格
  (window as any).filterTableByStatus = (tableType: string, statusValue: string) => {
    const tbody = document.getElementById(`${tableType}-table-body`);
    const searchInput = document.getElementById(`${tableType}-search`) as HTMLInputElement;
    const categoryFilter = document.getElementById(`${tableType}-filter`) as HTMLSelectElement;
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const categoryValue = categoryFilter ? categoryFilter.value : '';

    rows.forEach(row => {
      const cells = row.querySelectorAll('td');
      let shouldShow = true;

      // 应用搜索过滤
      if (searchTerm.trim()) {
        shouldShow = false;
        cells.forEach(cell => {
          const cellText = cell.textContent?.toLowerCase() || '';
          if (cellText.includes(searchTerm)) {
            shouldShow = true;
          }
        });
      }

      // 应用类别筛选
      if (shouldShow && categoryValue) {
        shouldShow = (window as any).checkCategoryFilter(tableType, row, categoryValue.toLowerCase());
      }

      // 应用状态筛选
      if (shouldShow && statusValue) {
        shouldShow = (window as any).checkStatusFilter(tableType, row, statusValue);
      }

      // 显示或隐藏行
      if (shouldShow) {
        (row as HTMLElement).style.display = '';
      } else {
        (row as HTMLElement).style.display = 'none';
      }
    });

    console.log(`🔍 表格 ${tableType} 按状态筛选: "${statusValue}"`);
  };

  // 检查类别筛选条件
  (window as any).checkCategoryFilter = (tableType: string, row: Element, filterValue: string): boolean => {
    const cells = row.querySelectorAll('td');

    switch (tableType) {
      case 'processes':
        // 按用户筛选（第二列是用户）
        const userCell = cells[1];
        return userCell ? userCell.textContent?.toLowerCase().includes(filterValue) || false : false;

      case 'services':
        // 按状态筛选（第二列是状态）
        const statusCell = cells[1];
        return statusCell ? statusCell.textContent?.toLowerCase().includes(filterValue) || false : false;

      case 'network':
        // 按状态筛选（第四列是状态）
        const netStatusCell = cells[3];
        return netStatusCell ? netStatusCell.textContent?.toLowerCase().includes(filterValue) || false : false;

      case 'users':
        // 按Shell筛选（第五列是Shell）
        const shellCell = cells[4];
        return shellCell ? shellCell.textContent?.toLowerCase().includes(filterValue) || false : false;

      default:
        return true;
    }
  };

  // 检查状态筛选条件
  (window as any).checkStatusFilter = (tableType: string, row: Element, statusValue: string): boolean => {
    const cells = row.querySelectorAll('td');

    switch (tableType) {
      case 'processes':
        // 按进程状态筛选（第三列是状态）
        const statCell = cells[2];
        if (!statCell) return false;
        const statText = statCell.textContent || '';
        // 检查状态字符串是否包含筛选值（例如 "Ss" 包含 "S"）
        return statText.includes(statusValue);

      default:
        return true;
    }
  };

  // 连接状态通知已移除

  // 刷新仪表盘
  (window as any).refreshDashboard = () => {
    try {
      if (app) {
        // 重新渲染主工作区
        const mainWorkspace = document.querySelector('.main-workspace');
        if (mainWorkspace) {
          mainWorkspace.innerHTML = app.getStateManager().getUIRenderer().renderMainWorkspace();
        }
        console.log('✅ 仪表盘已刷新');
      }
    } catch (error) {
      console.error('❌ 刷新仪表盘失败:', error);
    }
  };

  // 刷新侧边栏
  (window as any).refreshSidebar = () => {
    try {
      if (app) {
        // 重新渲染侧边栏
        const sidebar = document.querySelector('.modern-sidebar');
        if (sidebar) {
          const sidebarHTML = app.getStateManager().getUIRenderer().renderSidebar();
          // 提取侧边栏内容（去掉外层的 modern-sidebar div）
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = sidebarHTML;
          const sidebarContent = tempDiv.querySelector('.modern-sidebar');
          if (sidebarContent) {
            sidebar.innerHTML = sidebarContent.innerHTML;
          }
        }
        console.log('✅ 侧边栏已刷新');
      }
    } catch (error) {
      console.error('❌ 刷新侧边栏失败:', error);
    }
  };

  // 切换开发者工具
  (window as any).toggleDevTools = async () => {
    try {
      // 调用 Rust 后端命令打开开发者工具
      await (window as any).__TAURI__.core.invoke('open_devtools');
      console.log('✅ 开发者工具已打开');
      (window as any).showNotification && (window as any).showNotification('开发者工具已打开', 'success');
    } catch (error) {
      console.error('❌ 打开开发者工具失败:', error);
      (window as any).showNotification && (window as any).showNotification(`打开开发者工具失败: ${error}`, 'error');
    }
  };

  // 保存服务器配置
  (window as any).saveServer = async (formData: FormData) => {
    try {
      const editingServerId = (window as any).editingServerId;
      const isEditing = !!editingServerId;

      console.log(isEditing ? '更新服务器配置...' : '保存服务器配置...');

      // 收集基本配置
      const serverData = {
        name: formData.get('name') as string,
        host: formData.get('host') as string,
        port: parseInt(formData.get('port') as string) || 22,
        username: formData.get('username') as string,
        authType: formData.get('authType') as string, // 前端使用 authType
        password: formData.get('password') as string,
        keyPath: formData.get('keyPath') as string,
        keyPassphrase: formData.get('keyPassphrase') as string,
        accounts: [] as any[] // 新增：多账号数组
      };

      // 首先添加主账号到 accounts 数组
      serverData.accounts.push({
        username: serverData.username,
        authType: serverData.authType,
        password: serverData.authType === 'password' ? serverData.password : undefined,
        keyPath: serverData.authType === 'key' ? serverData.keyPath : undefined,
        keyPassphrase: serverData.keyPassphrase || undefined,
        isDefault: true, // 主账号设为默认
        description: '主账号'
      });

      // 收集额外的账号数据
      const additionalAccountsList = document.getElementById('additional-accounts-list');
      if (additionalAccountsList) {
        const accountItems = additionalAccountsList.querySelectorAll('.account-item');
        accountItems.forEach((accountEl) => {
          const username = (accountEl.querySelector('.extra-account-username') as HTMLInputElement)?.value;
          const description = (accountEl.querySelector('.extra-account-description') as HTMLInputElement)?.value;
          const authType = (accountEl.querySelector('.extra-account-authType') as HTMLSelectElement)?.value;
          const password = (accountEl.querySelector('.extra-account-password') as HTMLInputElement)?.value;
          const keyPath = (accountEl.querySelector('.extra-account-keyPath') as HTMLInputElement)?.value;
          const isDefault = (accountEl.querySelector('.extra-account-isDefault') as HTMLInputElement)?.checked;

          if (username) {
            serverData.accounts.push({
              username,
              authType,
              password: authType === 'password' ? password : undefined,
              keyPath: authType === 'key' ? keyPath : undefined,
              isDefault: isDefault || false,
              description: description || undefined
            });
          }
        });
      }

      console.log('📝 [保存服务器] 收集到的额外账号数:', serverData.accounts.length);

      // 调试日志：检查密码是否被正确获取
      console.log('📝 [保存服务器] 表单数据:', {
        name: serverData.name,
        host: serverData.host,
        username: serverData.username,
        authType: serverData.authType,
        hasPassword: !!serverData.password,
        passwordLength: serverData.password?.length || 0
      });

      // 验证必填字段
      if (!serverData.name || !serverData.host || !serverData.username) {
        console.error('❌ 请填写所有必填字段');
        (window as any).showNotification?.('请填写所有必填字段', 'warning');
        return;
      }

      // 如果是密码认证，验证密码不为空
      if (serverData.authType === 'password' && !serverData.password && !isEditing) {
        console.error('❌ 密码认证方式需要提供密码');
        (window as any).showNotification?.('密码认证方式需要提供密码', 'warning');
        return;
      }

      // 调用SSH管理器添加或更新连接
      const sshManager = (window as any).app?.sshManager;
      if (sshManager) {
        if (isEditing) {
          // 更新现有连接
          // 如果密码为空，不更新密码字段
          const updateData = { ...serverData };
          if (!updateData.password) {
            delete (updateData as any).password;
          }
          await sshManager.updateConnection(editingServerId, updateData);
          console.log('✅ 服务器配置更新成功');
          (window as any).showNotification?.('服务器配置更新成功', 'success');
        } else {
          // 添加新连接前检查数量限制

          await sshManager.addConnection(serverData);
          console.log('✅ 服务器配置保存成功');
          (window as any).showNotification?.('服务器配置保存成功', 'success');
        }

        // 清除编辑模式标识和保存的加密密码
        (window as any).editingServerId = null;
        (window as any).editingServerEncryptedPassword = null;

        // 隐藏表单并刷新列表
        (window as any).hideAddServerForm();
        (window as any).refreshServerList();
      } else {
        throw new Error('SSH管理器未初始化');
      }
    } catch (error) {
      console.error('❌ 保存服务器配置失败:', error);

      // 提取错误信息
      let errorMessage = '保存失败';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      (window as any).showNotification?.(`保存服务器配置失败：${errorMessage}`, 'error');
    }
  };

  // 刷新服务器列表
  (window as any).refreshServerList = async () => {
    console.log('刷新服务器列表');
    try {
      // 重新渲染整个服务器模态框
      const modal = document.getElementById('server-modal');
      if (modal && app) {
        // 记住当前模态框的显示状态
        const wasVisible = modal.style.display === 'flex';

        const newModalHTML = app.getStateManager().getUIRenderer().renderServerModal();
        modal.outerHTML = newModalHTML;

        // 只有在之前是显示状态时才重新显示
        if (wasVisible) {
          const newModal = document.getElementById('server-modal');
          if (newModal) {
            newModal.style.display = 'flex';
          }
        }
      }
    } catch (error) {
      console.error('刷新服务器列表失败:', error);
    }
  };

  // 连接服务器 - 统一使用新的SSH连接管理器
  (window as any).connectServer = async (serverId: string) => {
    try {
      console.log('🔗 连接服务器:', serverId);

      // 关闭服务器管理模态框和下拉菜单
      (window as any).hideServerModal();
      (window as any).hideConnectionDropdown();

      // 触发连接卡片翻转动画 - 持续到连接成功
      const connectionCard = document.querySelector('.connection-card');
      if (connectionCard) {
        connectionCard.classList.add('connecting');
      }

      const sshManager = (window as any).app?.sshManager;
      const stateManager = (window as any).app?.getStateManager?.();
      if (sshManager) {
        const connection = sshManager.getConnection(serverId);
        if (connection) {
          console.log('📋 连接配置信息:', {
            id: connection.id,
            name: connection.name,
            host: connection.host,
            port: connection.port,
            username: connection.username,
            authType: connection.authType,
            hasEncryptedPassword: !!connection.encryptedPassword
          });

          stateManager?.setLoading(true);
          (window as any).refreshDashboard?.();

          try {
            // 解密密码（如果需要）
            let password = '';
            if (connection.authType === 'password' && connection.encryptedPassword) {
              try {
                console.log('🔐 开始解密密码...');
                password = await (window as any).__TAURI__.core.invoke('decrypt_password', {
                  encryptedPassword: connection.encryptedPassword
                });
                console.log('✅ 密码解密成功，密码长度:', password.length);
              } catch (error) {
                console.error('❌ 解密密码失败:', error);
                (window as any).showNotification?.('密码解密失败，请检查连接配置', 'error');
                // 移除动画
                if (connectionCard) {
                  connectionCard.classList.remove('connecting');
                }
                return;
              }
            } else {
              console.log('⚠️ 未找到加密密码，authType:', connection.authType);
            }

            console.log('🚀 准备调用 sshConnectionManager.connect');
            console.log('📡 连接参数:', {
              host: connection.host,
              port: connection.port,
              portType: typeof connection.port,
              username: connection.username,
              passwordLength: password.length
            });

            // 使用统一的SSH连接管理器
            await sshConnectionManager.connect(
              connection.host,
              connection.port,
              connection.username,
              password
            );

            console.log('✅ sshConnectionManager.connect 调用成功');

            // 更新应用状态，传递完整的服务器信息
            if (app) {
              app.getStateManager().setConnected(true, connection.name, {
                name: connection.name,
                host: connection.host,
                port: connection.port,
                username: connection.username
              });
            }

            // 连接成功后获取系统信息
            try {
              console.log('📊 正在获取系统信息...');
              await sshManager.fetchSystemInfo();
              console.log('✅ 系统信息获取成功');
            } catch (error) {
              console.warn('⚠️ 获取系统信息失败，但SSH连接成功:', error);
            }

            // 注意：不在这里停止动画，让状态监听器来处理
            // 当 isConnected 变为 true 时，状态监听器会重新渲染卡片
            // 新渲染的卡片不会有 'connecting' 类，所以动画会自然停止

            (window as any).refreshServerList();
            (window as any).refreshSidebar();
            (window as any).refreshDashboard();

            {
              const currentPage = app?.getStateManager()?.getState()?.currentPage;
              if (currentPage === 'dashboard' || currentPage === 'system-info') {
                (window as any).loadSystemDetailedInfo(true);
              }
            }

            console.log('✅ 服务器连接成功');
            (window as any).showNotification?.(`已成功连接到 ${connection.name}`, 'success');
          } finally {
            stateManager?.setLoading(false);
            (window as any).refreshDashboard?.();
          }
        }
      } else {
        console.error('❌ SSH管理器未初始化');
        (window as any).showNotification?.('SSH管理器未初始化', 'error');
      }
    } catch (error) {
      console.error('❌ 连接服务器失败:', error);

      // 移除连接动画
      const connectionCard = document.querySelector('.connection-card');
      if (connectionCard) {
        connectionCard.classList.remove('connecting');
      }

      // 提取错误信息
      let errorMessage = '连接失败';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // 根据错误类型提供更友好的提示
      if (errorMessage.includes('Authentication failed') || errorMessage.includes('认证失败')) {
        (window as any).showNotification?.('SSH认证失败：用户名或密码错误', 'error');
      } else if (errorMessage.includes('Connection refused') || errorMessage.includes('连接被拒绝')) {
        (window as any).showNotification?.('连接被拒绝：请检查服务器地址和端口', 'error');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
        (window as any).showNotification?.('连接超时：请检查网络连接', 'error');
      } else if (errorMessage.includes('Network') || errorMessage.includes('网络')) {
        (window as any).showNotification?.('网络错误：请检查网络连接', 'error');
      } else {
        (window as any).showNotification?.(`连接失败：${errorMessage}`, 'error');
      }

      const stateManager = (window as any).app?.getStateManager?.();
      stateManager?.setLoading(false);
      (window as any).refreshDashboard?.();
    }
  };

  // 处理断开连接（从连接卡片调用）
  (window as any).handleDisconnect = async () => {
    try {
      const sshManager = (window as any).app?.sshManager;
      if (sshManager) {
        const connections = sshManager.getConnections();
        const connectedServer = connections.find((c: any) => c.isConnected);
        if (connectedServer) {
          await (window as any).disconnectServer(connectedServer.id);
        }
      }
    } catch (error) {
      console.error('❌ 断开连接失败:', error);
    }
  };

  // 断开服务器连接 - 统一使用新的SSH连接管理器
  (window as any).disconnectServer = async (serverId: string) => {
    try {
      console.log('🔌 断开服务器连接:', serverId);

      const sshManager = (window as any).app?.sshManager;
      if (sshManager) {
        await sshManager.disconnect(serverId);
        console.log('✅ 服务器已断开连接');

        // 更新UI
        (window as any).refreshServerList();
        (window as any).refreshSidebar();
        (window as any).refreshDashboard();
        (window as any).showNotification('服务器已断开连接', 'info');
      } else {
        console.error('❌ SSH管理器未初始化');
      }
    } catch (error) {
      console.error('❌ 断开服务器失败:', error);
      (window as any).showNotification(`断开连接失败: ${error}`, 'error');
    }
  };

  // 测试连接
  (window as any).testConnection = async () => {
    const form = document.getElementById('add-server-form-element') as HTMLFormElement;
    if (!form) return;

    const formData = new FormData(form);
    const host = formData.get('host') as string;
    const port = parseInt(formData.get('port') as string);
    const username = formData.get('username') as string;
    const authType = formData.get('authType') as string;
    const password = formData.get('password') as string;
    const keyPath = formData.get('keyPath') as string;
    const keyPassphrase = formData.get('keyPassphrase') as string;

    if (!host || !username) {
      (window as any).showNotification('请填写主机地址和用户名', 'warning');
      return;
    }

    // 显示加载状态
    const testBtn = document.getElementById('test-connection-btn');
    const originalText = testBtn ? testBtn.innerHTML : '测试连接';
    if (testBtn) {
      testBtn.innerHTML = '连接中...';
      (testBtn as HTMLButtonElement).disabled = true;
    }

    try {
      console.log('🔄 测试连接中...');
      
      // 编辑模式下，如果密码为空，尝试使用原有加密密码
      let testPassword = password;
      if (!testPassword && authType === 'password' && (window as any).editingServerId && (window as any).editingServerEncryptedPassword) {
        console.log('📝 编辑模式下密码为空，使用原有加密密码...');
        try {
          testPassword = await (window as any).__TAURI__.core.invoke('decrypt_password', {
            encryptedPassword: (window as any).editingServerEncryptedPassword
          });
          console.log('✅ 原有密码解密成功');
        } catch (decryptError) {
          console.error('❌ 解密原有密码失败:', decryptError);
          (window as any).showNotification('无法解密原有密码，请重新输入密码', 'warning');
          if (testBtn) {
            testBtn.innerHTML = originalText;
            (testBtn as HTMLButtonElement).disabled = false;
          }
          return;
        }
      }
      
      console.log('连接参数:', { host, port, username, authType, hasPassword: !!testPassword, hasKeyPath: !!keyPath });

      const result = await (window as any).__TAURI__.core.invoke('ssh_test_connection', {
        host,
        port,
        username,
        authType,
        password: testPassword || null,
        keyPath: keyPath || null,
        keyPassphrase: keyPassphrase || null,
        certificatePath: null
      });

      console.log('测试连接结果:', result);

      if (result) {
        (window as any).showNotification('✅ 连接测试成功', 'success');
      } else {
        (window as any).showNotification('❌ 连接测试失败：服务器拒绝连接', 'error');
      }
    } catch (error) {
      console.error('测试连接失败:', error);
      
      // 提取并格式化错误信息
      let errorMessage = '未知错误';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      // 根据错误类型提供更友好的中文提示
      let friendlyMessage = errorMessage;
      if (errorMessage.includes('Unable to exchange encryption keys') || errorMessage.includes('encryption keys')) {
        friendlyMessage = 'SSH密钥交换失败：服务器不支持当前加密算法，请检查SSH服务器配置';
      } else if (errorMessage.includes('Authentication failed') || errorMessage.includes('认证失败')) {
        friendlyMessage = '认证失败：用户名或密码错误';
      } else if (errorMessage.includes('Connection refused') || errorMessage.includes('连接被拒绝')) {
        friendlyMessage = '连接被拒绝：请检查服务器地址和端口是否正确';
      } else if (errorMessage.includes('timeout') || errorMessage.includes('超时') || errorMessage.includes('Timeout')) {
        friendlyMessage = '连接超时：请检查网络连接和防火墙设置';
      } else if (errorMessage.includes('Network') || errorMessage.includes('网络') || errorMessage.includes('network')) {
        friendlyMessage = '网络错误：无法连接到目标服务器';
      } else if (errorMessage.includes('Host key') || errorMessage.includes('host key')) {
        friendlyMessage = '主机密钥验证失败：服务器身份无法确认';
      } else if (errorMessage.includes('Permission denied') || errorMessage.includes('权限')) {
        friendlyMessage = '权限被拒绝：用户名或密码错误';
      } else if (errorMessage.includes('No route to host') || errorMessage.includes('无法路由')) {
        friendlyMessage = '无法访问目标主机：请检查网络连接';
      } else if (errorMessage.includes('SSH握手失败')) {
        // 解析更具体的握手失败原因
        friendlyMessage = `SSH握手失败：${errorMessage.includes('encryption') ? '加密协商失败' : '协议协商失败'}`;
      }
      
      (window as any).showNotification(`❌ 连接测试失败：${friendlyMessage}`, 'error');
    } finally {
      // 恢复按钮状态
      if (testBtn) {
        testBtn.innerHTML = originalText;
        (testBtn as HTMLButtonElement).disabled = false;
      }
    }
  };

  // 选择私钥文件
  (window as any).selectPrivateKeyFile = async () => {
    try {
      if (!(window as any).__TAURI__?.dialog) {
        (window as any).showNotification('文件选择功能不可用', 'error');
        return;
      }

      const selected = await (window as any).__TAURI__.dialog.open({
        multiple: false,
        filters: [{
          name: 'SSH Key',
          extensions: ['pem', 'ppk', 'key', 'id_rsa', 'id_ed25519']
        }]
      });

      if (selected) {
        const input = document.querySelector('input[name="keyPath"]') as HTMLInputElement;
        if (input) {
          input.value = selected as string;
        }

        // 如果是在额外账号中
        // 这里简化处理，目前只支持主表单的文件选择
      }
    } catch (error) {
      console.error('选择文件失败:', error);
      (window as any).showNotification('选择文件失败: ' + error, 'error');
    }
  };

  // 编辑服务器
  (window as any).editServer = (serverId: string) => {
    try {
      console.log('✏️ 编辑服务器:', serverId);
      const sshManager = (window as any).app?.sshManager;
      if (sshManager) {
        const connection = sshManager.getConnection(serverId);
        if (connection) {
          // 设置编辑模式
          (window as any).editingServerId = serverId;
          // 保存原有的加密密码，用于测试连接时使用
          (window as any).editingServerEncryptedPassword = connection.encryptedPassword;

          // 填充编辑表单
          const form = document.getElementById('add-server-form-element') as HTMLFormElement;
          if (form) {
            (form.elements.namedItem('name') as HTMLInputElement).value = connection.name;
            (form.elements.namedItem('host') as HTMLInputElement).value = connection.host;
            (form.elements.namedItem('port') as HTMLInputElement).value = connection.port.toString();
            (form.elements.namedItem('username') as HTMLInputElement).value = connection.username;
            (form.elements.namedItem('authType') as HTMLSelectElement).value = connection.authType;

            // 清空额外账号列表
            const additionalAccountsList = document.getElementById('additional-accounts-list');
            if (additionalAccountsList) {
              additionalAccountsList.innerHTML = '';
              (window as any).additionalAccounts = [];
            }

            // 加载多账号数据
            if (connection.accounts && connection.accounts.length > 0) {
              console.log('📝 加载多账号数据:', connection.accounts.length, '个账号');

              // 遍历所有账号，跳过主账号（isDefault: true）
              connection.accounts.forEach((account: any, index: number) => {
                // 跳过主账号，主账号已经填充到表单顶部了
                if (account.isDefault) {
                  console.log('跳过主账号:', account.username);
                  return;
                }

                // 为额外账号创建账号项
                if (additionalAccountsList) {
                  const accountId = `account-${Date.now()}-${index}`;
                  const accountHtml = `
                    <div class="account-item" id="${accountId}" style="
                      padding: var(--spacing-md);
                      background: var(--bg-tertiary);
                      border-radius: var(--border-radius);
                      border: 1px solid var(--border-color);
                      margin-bottom: var(--spacing-sm);
                    ">
                      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
                        <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">账号 #${index + 1}</span>
                        <button type="button" onclick="window.removeServerAccount('${accountId}')" style="
                          background: none;
                          border: none;
                          color: var(--text-secondary);
                          cursor: pointer;
                          font-size: 16px;
                          padding: 0 4px;
                        " title="删除账号">×</button>
                      </div>
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm);">
                        <div>
                          <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">用户名</label>
                          <input type="text" class="extra-account-username" value="${account.username}" placeholder="例如: superuser" style="
                            width: 100%;
                            padding: 6px 8px;
                            border: 1px solid var(--border-color);
                            border-radius: var(--border-radius-sm);
                            background: var(--bg-secondary);
                            color: var(--text-primary);
                            font-size: 11px;
                          " required>
                        </div>
                        <div>
                          <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">描述（可选）</label>
                          <input type="text" class="extra-account-description" value="${account.description || ''}" placeholder="例如: 数据库管理员" style="
                            width: 100%;
                            padding: 6px 8px;
                            border: 1px solid var(--border-color);
                            border-radius: var(--border-radius-sm);
                            background: var(--bg-secondary);
                            color: var(--text-primary);
                            font-size: 11px;
                          ">
                        </div>
                      </div>
                      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm);">
                        <div>
                          <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">认证方式</label>
                          <select class="extra-account-authType" style="
                            width: 100%;
                            padding: 6px 8px;
                            border: 1px solid var(--border-color);
                            border-radius: var(--border-radius-sm);
                            background: var(--bg-secondary);
                            color: var(--text-primary);
                            font-size: 11px;
                          " onchange="window.toggleExtraAccountAuthFields('${accountId}', this.value)">
                            <option value="password" ${account.authType === 'password' ? 'selected' : ''}>密码认证</option>
                            <option value="key" ${account.authType === 'key' ? 'selected' : ''}>SSH密钥</option>
                          </select>
                        </div>
                        <div class="extra-account-password-field" style="display: ${account.authType === 'password' ? 'block' : 'none'};">
                          <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">密码</label>
                          <input type="password" class="extra-account-password" placeholder="留空则保持不变" style="
                            width: 100%;
                            padding: 6px 8px;
                            border: 1px solid var(--border-color);
                            border-radius: var(--border-radius-sm);
                            background: var(--bg-secondary);
                            color: var(--text-primary);
                            font-size: 11px;
                          ">
                        </div>
                        <div class="extra-account-key-field" style="display: ${account.authType === 'key' ? 'block' : 'none'};">
                          <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">私钥路径</label>
                          <input type="text" class="extra-account-keyPath" value="${account.keyPath || ''}" placeholder="/path/to/key" style="
                            width: 100%;
                            padding: 6px 8px;
                            border: 1px solid var(--border-color);
                            border-radius: var(--border-radius-sm);
                            background: var(--bg-secondary);
                            color: var(--text-primary);
                            font-size: 11px;
                          ">
                        </div>
                      </div>
                      <div style="margin-top: var(--spacing-xs);">
                        <label style="display: flex; align-items: center; font-size: 11px; color: var(--text-secondary); cursor: pointer;">
                          <input type="checkbox" class="extra-account-isDefault" ${account.isDefault ? 'checked' : ''} style="margin-right: 4px;">
                          设为默认账号
                        </label>
                      </div>
                    </div>
                  `;

                  additionalAccountsList.insertAdjacentHTML('beforeend', accountHtml);
                  (window as any).additionalAccounts.push(accountId);
                }
              });
            }

            // 更新表单标题和按钮文本
            const formTitle = document.querySelector('#add-server-form h3');
            if (formTitle) {
              formTitle.textContent = '编辑服务器';
            }

            const submitButton = document.querySelector('#add-server-form button[type="submit"]');
            if (submitButton) {
              submitButton.textContent = '更新服务器';
            }

            // 显示表单
            (window as any).showAddServerForm();
            console.log('✅ 编辑表单已填充');
          }
        }
      }
    } catch (error) {
      console.error('❌ 编辑服务器失败:', error);
    }
  };

  // 删除服务器
  (window as any).deleteServer = async (serverId: string) => {
    try {
      // 使用简单的确认提示
      const userConfirmed = window.confirm ? window.confirm('确定要删除这个服务器配置吗？') : true;
      if (userConfirmed) {
        console.log('🗑️ 删除服务器:', serverId);
        const sshManager = (window as any).app?.sshManager;
        if (sshManager) {
          await sshManager.deleteConnection(serverId);
          console.log('✅ 服务器删除成功');
          (window as any).refreshServerList();
        } else {
          console.error('❌ SSH管理器未初始化');
        }
      }
    } catch (error) {
      console.error('❌ 删除服务器失败:', error);
    }
  };

  // 点击模态框背景关闭
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('modal-overlay')) {
      (window as any).hideServerModal();
    }
  });

  // 页面切换函数
  (window as any).switchPage = (pageId: string) => {
    console.log('🔄 切换页面:', pageId);

    // 重置远程操作页面初始化状态
    if (pageId !== 'remote-operations') {
      remoteOperationsPageInitialized = false;
    }

    // 更新导航项状态
    document.querySelectorAll('.nav-item').forEach(item => {
      const htmlItem = item as HTMLElement;
      const navId = htmlItem.getAttribute('data-nav-id');
      htmlItem.classList.toggle('active', navId === pageId);
    });

    // 通过状态管理器切换页面
    console.log(`🔄 [PageSwitch] 切换到页面: ${pageId}`);

    const app = (window as any).app;
    if (app && app.stateManager) {
      app.stateManager.setCurrentPage(pageId);
      // 重新渲染UI
      app.render();

      if (pageId === 'docker') {
        console.log('🐳 [PageSwitch] 初始化 Docker 页面');
        dockerPageManager.initialize();
        dockerPageManager.refresh(true);
      } else if (pageId === 'emergency-commands') {
        console.log('🚨 [PageSwitch] 初始化应急响应页面');
        emergencyPageManager.initialize();
      } else if (pageId === 'log-analysis') {
        console.log('📋 [PageSwitch] 初始化日志审计页面');
        // 延迟刷新日志，确保页面已渲染完成
        setTimeout(() => {
          (window as any).refreshLogAnalysis();
        }, 200);
      } else if (pageId === 'settings') {
        console.log('⚙️ [PageSwitch] 初始化设置页面');
        // 初始化设置页面
        setTimeout(() => {
          settingsPageManager.initialize();
        }, 100);
      } else if (pageId === 'ssh-terminal') {
        // SSH 终端页面：在新窗口中打开
        openSSHTerminalWindow();
        // 切换回dashboard页面，因为SSH终端在新窗口中
        setTimeout(() => {
          const app = (window as any).app;
          if (app && app.stateManager) {
            app.stateManager.setCurrentPage('dashboard');
            app.render();
          }
        }, 100);
      } else {
        dockerPageManager.deactivate();
        // SSH终端在独立窗口中，不需要隐藏
      }

      const shouldLoadDetail = pageId === 'system-info' || pageId === 'dashboard';
      const isConnected = sshConnectionManager.isConnected();

      if (shouldLoadDetail && isConnected) {
        // 重置缓存的加载状态，防止被阻塞
        const cache = (window as any).systemInfoCache;
        if (cache) {
          cache.isLoading = false;
        }

        // 对于仪表盘，强制刷新以确保获取最新数据
        const forceRefresh = pageId === 'dashboard';

        (window as any).loadSystemDetailedInfo(forceRefresh);

        // 如果是仪表盘页面，启动自动刷新
        if (pageId === 'dashboard') {
          (window as any).startDashboardAutoRefresh();
        }
      } else {
        // 如果离开仪表盘页面，停止自动刷新
        (window as any).stopDashboardAutoRefresh();

        if (shouldLoadDetail && !isConnected) {
          console.log('⚠️ 未连接服务器，跳过系统信息加载');
        }
      }

      // 远程操作页面的初始化由renderRemoteOperationsPage中的定时器处理
    }
  };

  // 系统信息标签页切换函数
  (window as any).switchSystemInfoTab = (tabId: string) => {
    console.log('🔄 切换系统信息标签页:', tabId);

    // 更新标签按钮状态
    document.querySelectorAll('.tab-btn').forEach(btn => {
      const htmlBtn = btn as HTMLElement;
      htmlBtn.classList.remove('active');
      const btnTabId = htmlBtn.getAttribute('data-tab');
      if (btnTabId === tabId) {
        htmlBtn.classList.add('active');
        htmlBtn.style.color = 'var(--primary-color)';
        htmlBtn.style.borderBottom = '2px solid var(--primary-color)';
      } else {
        htmlBtn.style.color = 'var(--text-secondary)';
        htmlBtn.style.borderBottom = '2px solid transparent';
      }
    });

    // 更新标签页内容
    const contentContainer = document.getElementById('system-info-content');
    if (contentContainer) {
      const renderer = (window as any).app?.modernUIRenderer;
      if (renderer) {
        // 只有在内容容器为空或者内容不匹配时才重新渲染
        const currentContent = contentContainer.innerHTML;
        const expectedContent = renderer.renderSystemInfoTab(tabId);

        if (!currentContent || !currentContent.includes(`id="${tabId}-table-body"`)) {
          contentContainer.innerHTML = expectedContent;
        }

        // 尝试使用缓存的数据加载标签页
        const cache = (window as any).systemInfoCache;
        if (cache.detailedInfo) {
          (window as any).loadSystemInfoTabData(tabId, cache.detailedInfo);
        } else {
          // 如果没有缓存数据，则加载新数据
          (window as any).loadSystemDetailedInfo();
        }
      }
    }
  };

  // 加载系统详细信息
  (window as any).loadSystemDetailedInfo = async (forceRefresh = false) => {
    try {
      // 首先检查统一的SSH连接状态
      const isConnected = sshConnectionManager.isConnected();
      if (!isConnected) {
        console.log('❌ SSH未连接，无法获取系统详细信息');
        return null;
      }

      const cache = (window as any).systemInfoCache;

      // 检查缓存是否有效（5分钟内的数据认为有效）
      const cacheValid = cache.detailedInfo &&
        cache.lastUpdate &&
        (Date.now() - cache.lastUpdate) < 5 * 60 * 1000;

      if (!forceRefresh && cacheValid && !cache.isLoading) {
        console.log('📋 使用缓存的系统详细信息');
        // 更新当前显示的标签页数据
        const activeTab = document.querySelector('.tab-btn.active');
        if (activeTab) {
          const tabId = activeTab.getAttribute('data-tab') || 'processes';
          (window as any).loadSystemInfoTabData(tabId, cache.detailedInfo);
        }
        
        // 更新 Tab 计数
        const app = (window as any).app;
        if (app && app.modernUIRenderer && typeof app.modernUIRenderer.updateSystemInfoTabs === 'function') {
          app.modernUIRenderer.updateSystemInfoTabs(cache.detailedInfo);
        }

        return cache.detailedInfo;
      }

      if (cache.isLoading && !forceRefresh) {
        console.log('⏳ 系统详细信息正在加载中...');
        return;
      }

      // 如果强制刷新，重置加载状态
      if (forceRefresh) {
        cache.isLoading = false;
      }

      console.log('🔍 开始加载系统详细信息...');
      cache.isLoading = true;

      const app = (window as any).app;
      if (app && app.systemInfoManager) {
        const detailedInfo = await app.systemInfoManager.getDetailedSystemInfo();
        console.log('✅ 系统详细信息加载完成:', detailedInfo);

        // 更新缓存
        cache.detailedInfo = detailedInfo;
        cache.lastUpdate = Date.now();
        cache.isLoading = false;

        // 检查当前页面，如果是仪表盘则重新渲染
        const currentPage = (window as any).app.stateManager.getState().currentPage;
        if (currentPage === 'dashboard') {
          console.log('🔄 重新渲染仪表盘以显示详细信息');
          (window as any).app.render();
        } else {
          // 更新当前显示的标签页数据
          const activeTab = document.querySelector('.tab-btn.active');
          if (activeTab) {
            const tabId = activeTab.getAttribute('data-tab') || 'processes';
            (window as any).loadSystemInfoTabData(tabId, detailedInfo);
          }
          
          // 更新 Tab 计数
          if (app.modernUIRenderer && typeof app.modernUIRenderer.updateSystemInfoTabs === 'function') {
            app.modernUIRenderer.updateSystemInfoTabs(detailedInfo);
          }
        }

        return detailedInfo;
      }
    } catch (error) {
      console.error('❌ 加载系统详细信息失败:', error);
      const cache = (window as any).systemInfoCache;
      cache.isLoading = false;
    }
  };

  // 加载标签页数据
  (window as any).loadSystemInfoTabData = (tabId: string, detailedInfo?: any) => {
    if (!detailedInfo) {
      console.log('⏳ 等待详细信息加载...');
      return;
    }

    console.log('📊 更新标签页数据:', tabId);

    switch (tabId) {
      case 'processes':
        (window as any).updateProcessesTable(detailedInfo.processes);
        break;
      case 'network':
        (window as any).updateNetworkTable(detailedInfo.networkDetails);
        break;
      case 'services':
        (window as any).updateServicesTable(detailedInfo.services);
        break;
      case 'users':
        (window as any).updateUsersTable(detailedInfo.users);
        break;
      case 'autostart':
        (window as any).updateAutostartTable(detailedInfo.autostart);
        break;
      case 'cron':
        (window as any).updateCronTable(detailedInfo.cronJobs);
        break;
      case 'firewall':
        (window as any).updateFirewallTable(detailedInfo.firewallRules || []);
        break;
    }
  };

  // 刷新所有系统信息
  (window as any).refreshAllSystemInfo = async () => {
    console.log('🔄 开始刷新所有系统信息...');

    try {
      // 显示加载状态
      const content = document.getElementById('system-info-content');
      if (content) {
        content.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; padding: 40px; color: var(--text-secondary);">
            <div style="text-align: center;">
              <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
              <div>正在刷新系统信息...</div>
            </div>
          </div>
        `;
      }

      // 获取应用实例
      const app = (window as any).app;
      if (!app || !app.systemInfoManager) {
        console.error('❌ 应用实例或系统信息管理器未找到');
        if (content) {
          content.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; padding: 40px; color: var(--text-error);">
              <div style="text-align: center;">
                <div style="font-size: 24px; margin-bottom: 10px;">❌</div>
                <div>应用实例未找到，请刷新页面重试</div>
              </div>
            </div>
          `;
        }
        return;
      }

      // 清除缓存以确保获取最新数据
      app.systemInfoManager.clearCache();

      // 重新获取所有系统信息
      const detailedInfo = await app.systemInfoManager.getDetailedSystemInfo();
      console.log('✅ 系统信息刷新完成');

      // 将详细信息更新到状态中，以便 Tab 上的计数徽章能更新
      const state = app.stateManager.getState();
      if (state.serverInfo) {
        state.serverInfo.detailedInfo = detailedInfo;
        app.stateManager.setState(state);
      }

      // 更新 Tab 计数
      if (app.modernUIRenderer && typeof app.modernUIRenderer.updateSystemInfoTabs === 'function') {
        app.modernUIRenderer.updateSystemInfoTabs(detailedInfo);
      }

      // 更新当前激活的标签页
      const activeTab = document.querySelector('.tab-btn.active');
      const currentTabId = activeTab ? activeTab.getAttribute('data-tab') : 'processes';

      const updateFunctions = {
        processes: 'updateProcessesTable',
        network: 'updateNetworkTable',
        services: 'updateServicesTable',
        users: 'updateUsersTable',
        autostart: 'updateAutostartTable',
        cron: 'updateCronTable',
        firewall: 'updateFirewallTable'
      };

      if (updateFunctions[currentTabId as keyof typeof updateFunctions]) {
        const updateFunc = (window as any)[updateFunctions[currentTabId as keyof typeof updateFunctions]];
        if (typeof updateFunc === 'function') {
          updateFunc(detailedInfo[currentTabId as keyof typeof detailedInfo]);
        }
      }

      // 显示成功提示
      setTimeout(() => {
        const notification = document.createElement('div');
        notification.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: var(--bg-success);
          color: var(--text-primary);
          padding: 12px 20px;
          border-radius: var(--border-radius);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 10000;
          font-size: 14px;
        `;
        notification.textContent = '✅ 系统信息已刷新';
        document.body.appendChild(notification);

        setTimeout(() => {
          if (notification.parentNode) {
            document.body.removeChild(notification);
          }
        }, 3000);
      }, 100);

    } catch (error) {
      console.error('❌ 刷新系统信息失败:', error);
      const content = document.getElementById('system-info-content');
      if (content) {
        content.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; padding: 40px; color: var(--text-error);">
            <div style="text-align: center;">
              <div style="font-size: 24px; margin-bottom: 10px;">❌</div>
              <div>刷新失败: ${error}</div>
              <button onclick="window.refreshAllSystemInfo()" style="
                margin-top: 10px;
                padding: 8px 16px;
                background: var(--bg-primary);
                border: 1px solid var(--border-color);
                border-radius: var(--border-radius);
                cursor: pointer;
                font-size: 14px;
              ">重试</button>
            </div>
          </div>
        `;
      }
    }
  };

  // 更新进程表格
  (window as any).updateProcessesTable = (processes: any[]) => {
    const tbody = document.getElementById('processes-table-body');
    if (!tbody) return;

    // 禁用进程表格区域的默认右键菜单
    tbody.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    if (!processes || processes.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
            暂无进程信息
          </td>
        </tr>
      `;
      return;
    }

    // 动态填充用户筛选选项
    const userFilter = document.getElementById('processes-filter') as HTMLSelectElement;
    if (userFilter) {
      const users = [...new Set(processes.map(p => p.user))].sort();
      const currentValue = userFilter.value;
      userFilter.innerHTML = '<option value="">所有用户</option>' +
        users.map(user => `<option value="${user}">${user}</option>`).join('');
      userFilter.value = currentValue; // 保持当前选择
    }

    tbody.innerHTML = processes.map((process) => `
      <tr data-pid="${process.pid}" class="process-row" style="
        border-bottom: 1px solid var(--border-color);
        cursor: context-menu;
      ">
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${process.pid}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${process.user}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace;">${process.stat || '-'}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${process.cpu}%</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${process.memory}%</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${process.command}">${process.command}</td>
      </tr>
    `).join('');

    // 添加右键事件监听
    tbody.querySelectorAll('tr[data-pid]').forEach(row => {
      row.addEventListener('contextmenu', (e: Event) => {
        e.preventDefault();
        const mouseEvent = e as MouseEvent;

        // 清除其他行的选中状态
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        // 选中当前行
        (row as HTMLElement).classList.add('selected');

        const pid = (row as HTMLElement).getAttribute('data-pid');
        if (pid) {
          processContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, pid);
        }
      });
    });
  };

  // 更新网络表格
  (window as any).updateNetworkTable = (networkDetails: any[]) => {
    const tbody = document.getElementById('network-table-body');
    if (!tbody) return;

    // 禁用网络表格区域的默认右键菜单
    tbody.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    if (!networkDetails || networkDetails.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
            暂无网络连接信息
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = networkDetails.map((conn) => `
      <tr class="network-row" data-protocol="${conn.protocol}" data-local="${conn.localAddress}" data-foreign="${conn.foreignAddress}" data-state="${conn.state}" data-pid="${conn.pid || '-'}" data-process="${conn.process}" style="
        border-bottom: 1px solid var(--border-color);
        cursor: context-menu;
      ">
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${conn.protocol}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${conn.localAddress}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${conn.foreignAddress}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${conn.state}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${conn.pid || '-'}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary);">${conn.process}</td>
      </tr>
    `).join('');

    // 添加右键事件监听
    tbody.querySelectorAll('tr[data-protocol]').forEach(row => {
      row.addEventListener('contextmenu', (e: Event) => {
        e.preventDefault();
        const mouseEvent = e as MouseEvent;

        // 清除其他行的选中状态
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        // 选中当前行
        (row as HTMLElement).classList.add('selected');

        const protocol = (row as HTMLElement).getAttribute('data-protocol') || '';
        const localAddress = (row as HTMLElement).getAttribute('data-local') || '';
        const foreignAddress = (row as HTMLElement).getAttribute('data-foreign') || '';
        const state = (row as HTMLElement).getAttribute('data-state') || '';
        const pid = (row as HTMLElement).getAttribute('data-pid') || '-';
        const process = (row as HTMLElement).getAttribute('data-process') || '';

        networkContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
          protocol,
          localAddress,
          foreignAddress,
          state,
          pid,
          process
        });
      });
    });
  };

  // 更新系统服务表格
  (window as any).updateServicesTable = (services: any[]) => {
    const tbody = document.getElementById('services-table-body');
    if (!tbody) return;

    if (!services || services.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
            暂无系统服务信息
          </td>
        </tr>
      `;
      return;
    }

    // 动态填充状态筛选选项
    const statusFilter = document.getElementById('services-filter') as HTMLSelectElement;
    if (statusFilter) {
      const statuses = [...new Set(services.map(s => s.status))].sort();
      const currentValue = statusFilter.value;
      statusFilter.innerHTML = '<option value="">所有状态</option>' +
        statuses.map(status => `<option value="${status}">${status}</option>`).join('');
      statusFilter.value = currentValue; // 保持当前选择
    }

    tbody.innerHTML = services.map((service) => `
      <tr data-service-name="${service.name}" style="
        border-bottom: 1px solid var(--border-color);
        cursor: context-menu;
      ">
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${service.name}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">
          <span style="color: ${service.status === 'active' ? 'var(--success-color)' : 'var(--error-color)'};">
            ${service.status}
          </span>
        </td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${service.enabled}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${service.description}">${service.description}</td>
      </tr>
    `).join('');

    // 添加右键菜单事件监听器
    tbody.querySelectorAll('tr[data-service-name]').forEach(row => {
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const mouseEvent = e as MouseEvent;

        // 清除其他行的选中状态
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        // 选中当前行
        (row as HTMLElement).classList.add('selected');

        const serviceName = (row as HTMLElement).getAttribute('data-service-name');
        if (serviceName) {
          serviceContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, serviceName);
        }
      });
    });
  };

  // 更新用户表格
  (window as any).updateUsersTable = (users: any[]) => {
    const tbody = document.getElementById('users-table-body');
    if (!tbody) return;

    if (!users || users.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
            暂无用户信息
          </td>
        </tr>
      `;
      return;
    }

    // 动态填充Shell筛选选项
    const shellFilter = document.getElementById('users-filter') as HTMLSelectElement;
    if (shellFilter) {
      const shells = [...new Set(users.map(u => u.shell))].sort();
      const currentValue = shellFilter.value;
      shellFilter.innerHTML = '<option value="">所有Shell</option>' +
        shells.map(shell => `<option value="${shell}">${shell}</option>`).join('');
      shellFilter.value = currentValue; // 保持当前选择
    }

    tbody.innerHTML = users.map((user) => `
      <tr data-username="${user.username}" style="
        border-bottom: 1px solid var(--border-color);
        cursor: context-menu;
      ">
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${user.username}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${user.uid}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${user.gid}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${user.home}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary);">${user.shell}</td>
      </tr>
    `).join('');

    // 添加右键菜单事件监听器
    tbody.querySelectorAll('tr[data-username]').forEach(row => {
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const mouseEvent = e as MouseEvent;

        // 清除其他行的选中状态
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        // 选中当前行
        (row as HTMLElement).classList.add('selected');

        const username = (row as HTMLElement).getAttribute('data-username');
        if (username) {
          userContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, username);
        }
      });
    });
  };

  // 更新自启动表格
  (window as any).updateAutostartTable = (autostart: any[]) => {
    const tbody = document.getElementById('autostart-table-body');
    if (!tbody) return;

    if (!autostart || autostart.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
            暂无自启动服务信息
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = autostart.map((item) => `
      <tr data-startup-name="${item.name}" data-startup-type="${item.type}" data-startup-path="${item.path || ''}" data-startup-command="${item.command}" style="
        border-bottom: 1px solid var(--border-color);
        cursor: context-menu;
      ">
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${item.name}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-right: 1px solid var(--border-color-light);" title="${item.command}">${item.command}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">
          <span style="color: ${item.status === 'enabled' ? 'var(--success-color)' : 'var(--error-color)'};">
            ${item.status}
          </span>
        </td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary);">${item.type}</td>
      </tr>
    `).join('');

    // 添加右键菜单事件监听器
    tbody.querySelectorAll('tr[data-startup-name]').forEach(row => {
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const mouseEvent = e as MouseEvent;

        // 清除其他行的选中状态
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        // 选中当前行
        (row as HTMLElement).classList.add('selected');

        const name = (row as HTMLElement).getAttribute('data-startup-name') || '';
        const type = (row as HTMLElement).getAttribute('data-startup-type') || '';
        const path = (row as HTMLElement).getAttribute('data-startup-path') || '';
        const command = (row as HTMLElement).getAttribute('data-startup-command') || '';

        if (name) {
          startupContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
            name,
            type,
            path,
            command
          });
        }
      });
    });
  };

  // 更新计划任务表格
  (window as any).updateCronTable = (cronJobs: any[]) => {
    const tbody = document.getElementById('cron-table-body');
    if (!tbody) return;

    if (!cronJobs || cronJobs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="3" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
            暂无计划任务信息
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = cronJobs.map((job) => `
      <tr data-cron-user="${job.user}" data-cron-schedule="${job.schedule}" data-cron-command="${job.command}" data-cron-source="${job.source || ''}" style="
        border-bottom: 1px solid var(--border-color);
        cursor: context-menu;
      ">
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${job.user}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); font-family: monospace; border-right: 1px solid var(--border-color-light);">${job.schedule}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${job.command}">${job.command}</td>
      </tr>
    `).join('');

    // 添加右键菜单事件监听器
    tbody.querySelectorAll('tr[data-cron-user]').forEach(row => {
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const mouseEvent = e as MouseEvent;

        // 清除其他行的选中状态
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        // 选中当前行
        (row as HTMLElement).classList.add('selected');

        const user = (row as HTMLElement).getAttribute('data-cron-user') || '';
        const schedule = (row as HTMLElement).getAttribute('data-cron-schedule') || '';
        const command = (row as HTMLElement).getAttribute('data-cron-command') || '';
        const source = (row as HTMLElement).getAttribute('data-cron-source') || '';

        if (user && command) {
          cronContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
            user,
            schedule,
            command,
            source
          });
        }
      });
    });
  };

  // 更新防火墙表格
  (window as any).updateFirewallTable = (firewallRules: any[]) => {
    const tbody = document.getElementById('firewall-table-body');
    if (!tbody) return;

    if (!firewallRules || firewallRules.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
            暂无防火墙规则信息
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = firewallRules.map((rule) => `
      <tr data-chain="${rule.chain}" data-target="${rule.target}" data-protocol="${rule.protocol}" data-source="${rule.source}" data-destination="${rule.destination}" data-options="${rule.options}" style="
        border-bottom: 1px solid var(--border-color);
        cursor: context-menu;
      ">
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${rule.chain}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${rule.target}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${rule.protocol}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${rule.source}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${rule.destination}</td>
        <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${rule.options}">${rule.options}</td>
      </tr>
    `).join('');

    // 添加右键菜单事件监听器
    tbody.querySelectorAll('tr[data-chain]').forEach(row => {
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const mouseEvent = e as MouseEvent;

        // 清除其他行的选中状态
        tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
        // 选中当前行
        (row as HTMLElement).classList.add('selected');

        const chain = (row as HTMLElement).getAttribute('data-chain') || '';
        const target = (row as HTMLElement).getAttribute('data-target') || '';
        const protocol = (row as HTMLElement).getAttribute('data-protocol') || '';
        const source = (row as HTMLElement).getAttribute('data-source') || '';
        const destination = (row as HTMLElement).getAttribute('data-destination') || '';
        const options = (row as HTMLElement).getAttribute('data-options') || '';

        if (chain) {
          firewallContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
            chain,
            target,
            protocol,
            source,
            destination,
            options
          });
        }
      });
    });
  };

  // 仪表盘自动刷新相关函数
  let dashboardRefreshInterval: number | null = null;

  // 启动仪表盘自动刷新
  (window as any).startDashboardAutoRefresh = () => {
    // 先停止之前的定时器
    (window as any).stopDashboardAutoRefresh();

    console.log('🔄 启动仪表盘自动刷新 (每30秒)');

    // 设置30秒自动刷新
    dashboardRefreshInterval = window.setInterval(() => {
      const currentPage = (window as any).app?.stateManager?.getState()?.currentPage;
      if (currentPage === 'dashboard') {
        console.log('🔄 仪表盘自动刷新');
        (window as any).loadSystemDetailedInfo();
      } else {
        // 如果不在仪表盘页面，停止自动刷新
        (window as any).stopDashboardAutoRefresh();
      }
    }, 30000); // 30秒
  };

  // 停止仪表盘自动刷新
  (window as any).stopDashboardAutoRefresh = () => {
    if (dashboardRefreshInterval) {
      console.log('⏹️ 停止仪表盘自动刷新');
      window.clearInterval(dashboardRefreshInterval);
      dashboardRefreshInterval = null;
    }
  };

  // 页面卸载时清理定时器
  window.addEventListener('beforeunload', () => {
    (window as any).stopDashboardAutoRefresh();
  });
}

// 页面特定的初始化函数
let remoteOperationsPageInitialized = false;
(window as any).initRemoteOperationsPage = async function () {
  if (remoteOperationsPageInitialized) {
    console.log('⏭️ 远程操作页面已初始化，跳过重复初始化');
    return;
  }

  console.log('🔧 初始化远程操作页面');
  remoteOperationsPageInitialized = true;

  // 初始化远程操作管理器
  await remoteOperationsManager.initialize();

  // 检查统一SSH连接管理器的连接状态
  console.log('� 检查SSH连接状态...');
  const backendStatus = await sshConnectionManager.checkConnectionStatus();
  console.log('🔍 后端返回的连接状态:', backendStatus);

  // 获取连接状态
  const connectionStatus = sshConnectionManager.getConnectionStatus();
  console.log('🔍 当前SSH连接状态:', connectionStatus);

  if (connectionStatus?.connected) {
    console.log('✅ 发现现有SSH连接，刷新远程操作界面');

    // 刷新SFTP文件列表（会通过监听器自动更新UI）
    await sftpManager.refreshFileList();

    console.log('✅ SFTP文件列表已刷新');
  } else {
    console.log('ℹ️ SSH未连接，显示提示信息');

    // 更新SFTP显示（会自动显示未连接状态）
    const sftpFileList = document.getElementById('sftp-file-list');
    if (sftpFileList) {
      sftpFileList.innerHTML = sftpManager.renderFileListHTML();
    }

    console.log('ℹ️ SSH未连接，SFTP显示未连接状态');
  }

  // 修正排序下拉潜在的编码异常显示
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

  // 添加 SFTP 路径变化监听器
  sftpManager.addListener((_files, path) => {
    // 更新路径输入框
    const pathInput = document.getElementById('sftp-path-input') as HTMLInputElement;
    if (pathInput) {
      pathInput.value = path;
    }

    // 更新文件列表
    const sftpFileList = document.getElementById('sftp-file-list');
    if (sftpFileList) {
      sftpFileList.innerHTML = sftpManager.renderFileListHTML();
    }

    // 更新排序下拉框的选中状态
    const sortModeSelect = document.getElementById('sftp-sort-mode') as HTMLSelectElement;
    if (sortModeSelect) {
      sortModeSelect.value = sftpManager.getSortMode();
    }
  });

};

// SSH连接对话框现在由专门的模块处理
(window as any).showSSHConnectionDialog = function () {
  sshConnectionDialog.show();
};

/**
 * 显示设置覆盖层
 */
(window as any).showSettingsOverlay = function () {
  console.log('🔧 显示设置覆盖层');

  // 获取现代UI渲染器
  const app = (window as any).app;
  if (!app || !app.modernUIRenderer) {
    console.error('❌ 无法获取UI渲染器');
    return;
  }

  // 渲染设置页面HTML
  const settingsHTML = app.modernUIRenderer.renderSettingsPage();

  // 创建设置覆盖层元素
  const settingsOverlay = document.createElement('div');
  settingsOverlay.innerHTML = settingsHTML;
  settingsOverlay.id = 'settings-overlay-container';

  // 添加到页面
  document.body.appendChild(settingsOverlay);

  // 初始化设置页面管理器
  setTimeout(() => {
    settingsPageManager.initialize();
  }, 100);
};

/**
 * 隐藏设置覆盖层
 */
(window as any).hideSettingsOverlay = function () {
  console.log('🔧 隐藏设置覆盖层');

  const settingsOverlay = document.getElementById('settings-overlay-container');
  if (settingsOverlay) {
    settingsOverlay.remove();
  }
};

/**
 * 用户相关的全局函数
 */


// 显示设置
// 切换用户下拉菜单
(window as any).toggleUserDropdown = function () {
  const dropdown = document.getElementById('user-dropdown-menu');
  const userAvatarBtn = document.querySelector('.user-avatar-btn');

  if (dropdown && userAvatarBtn) {
    const isVisible = dropdown.style.display === 'block';

    if (isVisible) {
      dropdown.style.display = 'none';
    } else {
      // 计算下拉菜单位置
      const rect = userAvatarBtn.getBoundingClientRect();
      dropdown.style.top = `${rect.bottom + 5}px`;
      dropdown.style.right = `${window.innerWidth - rect.right}px`;
      dropdown.style.display = 'block';
    }
  }
};

// 点击页面其他地方关闭下拉菜单
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

// 处理用户菜单操作
(window as any).handleUserMenuAction = async function (action: string) {
  // 关闭下拉菜单
  const dropdown = document.getElementById('user-dropdown-menu');
  if (dropdown) {
    dropdown.style.display = 'none';
  }

  switch (action) {
    case 'settings':
      console.log('⚙️ 打开设置');
      (window as any).showSettingsOverlay && (window as any).showSettingsOverlay();
      break;

    default:
      console.warn('未知的菜单操作:', action);
  }
};

// ==================== 日志审计功能 ====================

/**
 * 加载日志文件列表
 */
async function loadLogFileList() {
  // 检查是否在日志页面
  const select = document.getElementById('log-file-select') as HTMLSelectElement;
  if (!select) return;

  console.log('📂 正在加载日志源列表...');
  try {
    const [logFiles, containers] = await Promise.all([
      invoke('list_log_files') as Promise<any[]>,
      invoke('docker_list_containers') as Promise<any[]>
    ]);
    
    const currentValue = select.value;
    let optionsHtml = '';

    // 1. Docker 容器分组
    if (Array.isArray(containers) && containers.length > 0) {
      console.log('📦 获取到的容器列表:', containers);
      optionsHtml += `<optgroup label="Docker 容器">`;
      containers.forEach((container: any) => {
        // 兼容不同的字段名（PascalCase 或 camelCase）
        const id = container.Id || container.id;
        const names = container.Names || container.names;
        const name = container.Name || container.name;
        const state = container.State || container.state;

        if (!id) return;
        
        // 容器ID取前12位
        const containerId = String(id);
        const shortId = containerId.substring(0, 12);
        
        // 显示名称，去掉开头的斜杠
        let displayName = 'Unknown';
        if (Array.isArray(names) && names.length > 0) {
          displayName = names[0].replace(/^\//, '');
        } else if (name) {
          displayName = name.replace(/^\//, '');
        }
        
        // 状态图标
        const statusIcon = state === 'running' ? '🟢' : '🔴';
        
        const value = `docker:${shortId}`;
        optionsHtml += `<option value="${value}" ${value === currentValue ? 'selected' : ''}>
          ${statusIcon} ${displayName} (${shortId})
        </option>`;
      });
      optionsHtml += `</optgroup>`;
    } else {
       console.log('⚠️ 未获取到 Docker 容器或列表为空');
       optionsHtml += `<optgroup label="Docker 容器"><option value="" disabled>无运行中容器</option></optgroup>`;
    }

    // 2. 系统日志分组
    if (Array.isArray(logFiles) && logFiles.length > 0) {
      optionsHtml += `<optgroup label="系统日志">`;
      logFiles.forEach((file: any) => {
        const sizeStr = file.size > 1024 * 1024 
          ? `${(file.size / 1024 / 1024).toFixed(1)} MB` 
          : `${(file.size / 1024).toFixed(1)} KB`;
        // 标记最近修改的文件
        const isRecent = Date.now() - parseInt(file.modified) * 1000 < 24 * 60 * 60 * 1000; // 24小时内
        const recentMark = isRecent ? '🕒 ' : '';
        
        optionsHtml += `<option value="${file.path}" ${file.path === currentValue ? 'selected' : ''}>
          ${recentMark}${file.name} (${sizeStr})
        </option>`;
      });
      optionsHtml += `</optgroup>`;
    }
    
    if (optionsHtml) {
      select.innerHTML = optionsHtml;
      console.log(`✅ 已加载日志源: ${logFiles.length} 个文件, ${containers.length} 个容器`);
    }
  } catch (error) {
    console.error('❌ 加载日志源列表失败:', error);
  }
}

/**
 * 刷新日志审计页面
 */
(window as any).refreshLogAnalysis = async function () {
  console.log('🔄 刷新日志审计');
  
  // 尝试加载文件列表（异步执行，不阻塞UI）
  loadLogFileList();

  try {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) return;

    // 显示加载状态
    logContainer.innerHTML = `
      <div class="loading-placeholder">
        <div class="spinner"></div>
        <p>加载日志中...</p>
      </div>
    `;

    // 获取当前配置
    const state = (window as any).logAnalysisState || {};
    const useJournalctl = state.useJournalctl || false;
    const logPath = state.logPath || '/var/log/auth.log';
    const pageSize = parseInt(state.lines || '100');
    const page = state.page || 1;
    const filter = state.filter || '';
    const journalUnit = state.journalUnit || '';
    const dateFilter = state.date || '';

    let result: any;
    
    if (useJournalctl) {
      // 使用 journalctl
      result = await invoke('read_journalctl_log', {
        page,
        pageSize,
        unit: journalUnit || null,
        filter: filter || null,
        since: dateFilter ? `${dateFilter} 00:00:00` : null,
        until: dateFilter ? `${dateFilter} 23:59:59` : null
      });
      document.getElementById('current-source')!.textContent = `journalctl${journalUnit ? ` -u ${journalUnit}` : ''}`;
    } else if (logPath.startsWith('docker:')) {
      // 使用 Docker 容器日志
      const containerId = logPath.replace('docker:', '');
      // 对于 Docker 日志，我们复用 LogAnalysisResult 结构，但需要适配
      // 这里的 result 类型需要和 read_system_log 返回的一致
      const logs = await invoke('docker_container_logs', {
        containerId,
        tail: pageSize.toString() // Docker logs API 通常接受 tail 参数
      }) as string;

      // 手动解析 Docker 日志为 LogAnalysisResult 结构
      // Docker 日志通常格式不固定，这里做简单处理
      const entries = logs.split('\n')
        .filter(line => line.trim())
        .map(line => {
          // 尝试提取时间戳 (Docker日志可能有多种格式)
          // 简单起见，我们把整行作为 message，level 默认为 INFO
          return {
            timestamp: '', // Docker API 返回的原始字符串可能包含时间戳，也可能不包含
            level: 'INFO',
            service: `docker:${containerId.substring(0, 8)}`,
            message: line,
            raw: line,
            highlighted: false
          };
        });

      // 简单的客户端过滤（如果需要）
      const filteredEntries = filter 
        ? entries.filter(e => e.message.toLowerCase().includes(filter.toLowerCase()))
        : entries;

      result = {
        total_count: filteredEntries.length,
        highlighted_count: 0,
        entries: filteredEntries,
        file_info: null
      };
      document.getElementById('current-source')!.textContent = `Container ${containerId.substring(0, 8)}`;
    } else {
      // 使用文件日志
      result = await invoke('read_system_log', {
        logPath,
        page,
        pageSize,
        filter: filter || null,
        dateFilter: dateFilter || null
      });
      const fileName = logPath.split('/').pop() || logPath;
      document.getElementById('current-source')!.textContent = fileName;
    }

    // 更新统计信息和分页状态
    document.getElementById('total-logs')!.textContent = result.total_count.toString();
    
    // 更新翻页按钮状态
    const prevBtn = document.querySelector('.pagination-btn[title="上一页"]') as HTMLButtonElement;
    const nextBtn = document.querySelector('.pagination-btn[title="下一页"]') as HTMLButtonElement;
    const pageDisplay = document.querySelector('.page-display');
    
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = result.entries.length < pageSize; // 如果返回条数少于pageSize，说明是最后一页
    if (pageDisplay) pageDisplay.textContent = `第 ${page} 页`;

    // 渲染日志条目
    if (result.entries && result.entries.length > 0) {
      logContainer.innerHTML = renderLogEntries(result.entries);
    } else {
      logContainer.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor">
            <path d="M39 8H9c-1.1 0-2 .9-2 2v28c0 1.1.9 2 2 2h30c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-2 28H11V12h26v24z"/>
          </svg>
          <p>没有找到日志记录</p>
          <small>请检查日志文件路径或调整过滤条件</small>
        </div>
      `;
    }

  } catch (error) {
    console.error('❌ 刷新日志失败:', error);
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      logContainer.innerHTML = `
        <div class="error-state">
          <p>加载日志失败</p>
          <small>${error}</small>
        </div>
      `;
    }
  }
};

/**
 * 渲染日志条目 - 紧凑模式
 */
function renderLogEntries(entries: any[]): string {
  return `
    <div class="log-entries">
      ${entries.map(entry => {
        const levelClass = getLevelClass(entry.level);
        const highlightClass = entry.highlighted ? 'highlighted' : '';
        
        // 简化时间戳显示
        let displayTime = entry.timestamp || '-';
        if (displayTime.length > 19) displayTime = displayTime.substring(0, 19);

        // 清理消息内容，去除首尾空白，防止多余换行
        const cleanMessage = (entry.message || '').trim();

        return `
          <div class="log-entry ${levelClass} ${highlightClass}">
            <div class="log-timestamp" title="${entry.timestamp}">${displayTime}</div>
            <div class="log-level ${levelClass}">${entry.level}</div>
            <div class="log-message">${entry.highlighted ? '<span class="log-marker">!</span>' : ''}${escapeHtml(cleanMessage)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * 获取日志级别CSS类
 */
function getLevelClass(level: string): string {
  const levelUpper = level.toUpperCase();
  if (levelUpper.includes('ERROR') || levelUpper.includes('FAIL')) return 'level-error';
  if (levelUpper.includes('WARN')) return 'level-warn';
  if (levelUpper.includes('INFO')) return 'level-info';
  if (levelUpper.includes('DEBUG')) return 'level-debug';
  return 'level-info';
}

/**
 * HTML转义
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 切换日志来源
 */
(window as any).switchLogSource = function (source: string) {
  (window as any).logAnalysisState = (window as any).logAnalysisState || {};
  (window as any).logAnalysisState.useJournalctl = source === 'journalctl';
  (window as any).logAnalysisState.page = 1; // 重置页码
  
  // 重新渲染控制面板
  const app = (window as any).app;
  if (app) {
    const workspaceContent = document.querySelector('.workspace-content');
    if (workspaceContent) {
      const renderer = app.getStateManager().getUIRenderer();
      // 更新渲染器内部状态
      renderer['logAnalysisRenderer'].setUseJournalctl(source === 'journalctl');
      workspaceContent.innerHTML = renderer['renderLogAnalysisPage']();
      
      // 自动刷新日志
      setTimeout(() => {
        (window as any).refreshLogAnalysis();
      }, 100);
    }
  }
};

/**
 * 更新日志路径
 */
(window as any).updateLogPath = function (path: string) {
  (window as any).logAnalysisState = (window as any).logAnalysisState || {};
  (window as any).logAnalysisState.logPath = path;
  (window as any).logAnalysisState.page = 1;
  (window as any).refreshLogAnalysis();
};

/**
 * 更新显示行数
 */
(window as any).updateLogLines = function (lines: string) {
  (window as any).logAnalysisState = (window as any).logAnalysisState || {};
  (window as any).logAnalysisState.lines = lines;
  (window as any).logAnalysisState.page = 1; // 重置页码
  (window as any).refreshLogAnalysis();
};

/**
 * 更新过滤器
 */
(window as any).updateLogFilter = function (filter: string) {
  (window as any).logAnalysisState = (window as any).logAnalysisState || {};
  (window as any).logAnalysisState.filter = filter;
  (window as any).logAnalysisState.page = 1;
  (window as any).refreshLogAnalysis();
};

/**
 * 更新日期筛选
 */
(window as any).updateLogDate = function (date: string) {
  (window as any).logAnalysisState = (window as any).logAnalysisState || {};
  (window as any).logAnalysisState.date = date;
  (window as any).logAnalysisState.page = 1;
  (window as any).refreshLogAnalysis();
};

/**
 * 切换页码
 */
(window as any).changeLogPage = function (delta: number) {
  (window as any).logAnalysisState = (window as any).logAnalysisState || {};
  let currentPage = (window as any).logAnalysisState.page || 1;
  currentPage += delta;
  if (currentPage < 1) currentPage = 1;
  
  (window as any).logAnalysisState.page = currentPage;
  
  // 更新渲染器状态以保持同步
  const app = (window as any).app;
  if (app) {
    // 只是简单更新显示，不需要完全重渲染
    const pageDisplay = document.querySelector('.page-display');
    if (pageDisplay) pageDisplay.textContent = `第 ${currentPage} 页`;
  }
  
  (window as any).refreshLogAnalysis();
};

/**
 * 清除过滤器
 */
(window as any).clearLogFilter = function () {
  const input = document.getElementById('log-filter-input') as HTMLInputElement;
  if (input) {
    input.value = '';
  }
  (window as any).logAnalysisState = (window as any).logAnalysisState || {};
  (window as any).logAnalysisState.filter = '';
  (window as any).logAnalysisState.page = 1;
  (window as any).refreshLogAnalysis();
};

/**
 * 更新 journal 单元
 */
(window as any).updateJournalUnit = function (unit: string) {
  (window as any).logAnalysisState = (window as any).logAnalysisState || {};
  (window as any).logAnalysisState.journalUnit = unit;
  (window as any).logAnalysisState.page = 1;
  (window as any).refreshLogAnalysis();
};

// 启动应用
document.addEventListener('DOMContentLoaded', initializeApp);
