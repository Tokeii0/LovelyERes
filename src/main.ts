/**
 * LovelyRes 主入口文件
 * Linux Emergency Response Tool
 *
 * 此文件为应用的入口 orchestrator，负责：
 * - 引入样式和模块
 * - 初始化应用核心
 * - 委托各功能模块的初始化
 */

// Styles - Modular CSS
import './css/main.css';
import 'xterm/css/xterm.css';

// Core
import { LovelyResApp } from './modules/core/app';

// Remote
import { remoteOperationsManager } from './modules/remote/remoteOperationsManager';
import { sshTerminalManager } from './modules/ssh/sshTerminalManager';

// Features
import { SettingsManager } from './modules/settings/settingsManager';
import { SettingsPageManager } from './modules/settings/settingsPageManager';

// SSH
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

// UI Modals & Context Menus
import { FileViewerModal } from './modules/ui/fileViewerModal';
import { PermissionsModal } from './modules/ui/permissionsModal';
import { EmergencyResultModal } from './modules/ui/emergencyModal';
import { CommandHistoryModal } from './modules/ui/commandHistoryModal';
import { FileContextMenu } from './modules/ui/fileContextMenu';
import { LogContextMenu } from './modules/ui/logContextMenu';

// Extracted modules
import { initNotificationManager } from './modules/ui/notificationManager';
import { initSftpContextMenuHandler } from './modules/ui/sftpContextMenuHandler';
import { initServerModalManager } from './modules/ui/serverModalManager';
import { initTableFilterManager } from './modules/ui/tableFilterManager';
import { initSystemInfoTabManager } from './modules/ui/systemInfoTabManager';
import { initTableUpdateManager } from './modules/ui/tableUpdateManager';
import { initLogAnalysisManager } from './modules/ui/logAnalysisManager';

// Phase 2 优化：拆分模块
import { initCommandPalette } from './modules/ui/commandPalette';
import { initKeyboardShortcuts } from './modules/ui/keyboardShortcuts';
import { initGlobalFunctions } from './modules/ui/globalFunctions';

// 新增优化模块
import { logger } from './modules/core/logger';
import { i18n } from './modules/i18n';
import { forensicManager } from './modules/emergency/forensicManager';

// 设置管理器（全局唯一实例）
const settingsManager = new SettingsManager();
const settingsPageManager = new SettingsPageManager(settingsManager);

// 全局应用实例
let app: LovelyResApp;

/**
 * 在新窗口中打开SSH终端
 */
async function openSSHTerminalWindow(): Promise<void> {
  try {
    const existingWindow = await WebviewWindow.getByLabel('ssh-terminal');
    if (existingWindow) {
      console.log('🔍 检测到已存在的SSH终端窗口，聚焦到该窗口');
      await existingWindow.setFocus();
      await existingWindow.unminimize();
      return;
    }

    console.log('🆕 创建新的SSH终端窗口');
    const isMacOS = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    const sshWindow = new WebviewWindow('ssh-terminal', {
      url: '/ssh-terminal.html',
      title: 'SSH Terminal - LovelyRes',
      width: 1000, height: 700,
      minWidth: 600, minHeight: 400,
      resizable: true, maximizable: true, minimizable: true, closable: true,
      center: true,
      decorations: isMacOS,
      alwaysOnTop: false, skipTaskbar: false
    });

    sshWindow.once('tauri://created', () => console.log('✅ SSH终端窗口已创建'));
    sshWindow.once('tauri://error', (error) => console.error('❌ SSH终端窗口创建错误:', error));
    sshWindow.once('tauri://close-requested', () => console.log('🔧 SSH终端窗口即将关闭'));

  } catch (error) {
    console.error('❌ 创建SSH终端窗口失败:', error);

    if (error instanceof Error && error.message.includes('already exists')) {
      const existingWindow = await WebviewWindow.getByLabel('ssh-terminal');
      if (existingWindow) {
        try {
          await existingWindow.setFocus();
          await existingWindow.unminimize();
          return;
        } catch (focusError) {
          console.error('❌ 聚焦窗口失败:', focusError);
        }
      }
    }

    const fallbackWindow = window.open('/ssh-terminal.html', 'ssh-terminal',
      'width=1000,height=700,resizable=yes,scrollbars=yes,status=yes');
    if (fallbackWindow) {
      console.log('✅ 使用浏览器窗口打开SSH终端');
    } else {
      console.error('❌ 无法打开SSH终端窗口');
    }
  }
}

/**
 * 应用初始化
 */
async function initializeApp() {
  try {
    console.log('🚀 LovelyRes 启动中...');

    // 1. 初始化全局功能模块
    initNotificationManager();
    initTableFilterManager();
    initTableUpdateManager();
    initSystemInfoTabManager();
    initServerModalManager();
    initSftpContextMenuHandler();
    initLogAnalysisManager();

    // 初始化新增优化模块
    const log = logger.module('App');
    log.info(`LovelyRes 启动中... (语言: ${i18n.lang})`);
    forensicManager.loadFromStorage();

    // 2. 创建并初始化应用核心
    app = new LovelyResApp();

    // 3. 初始化模态组件
    const fileViewerModal = new FileViewerModal();
    const permissionsModal = new PermissionsModal();
    const emergencyResultModal = new EmergencyResultModal();
    const commandHistoryModal = new CommandHistoryModal();
    const fileContextMenu = new FileContextMenu();
    const logContextMenu = new LogContextMenu();

    (window as any).fileViewerModal = fileViewerModal;
    (window as any).permissionsModal = permissionsModal;
    (window as any).emergencyResultModal = emergencyResultModal;
    (window as any).commandHistoryModal = commandHistoryModal;
    (window as any).fileContextMenu = fileContextMenu;
    (window as any).logContextMenu = logContextMenu;

    // 全局日志右键菜单监听
    document.addEventListener('contextmenu', (e) => {
      const target = e.target as HTMLElement;
      const logEntry = target.closest('.log-entry');
      if (logEntry) {
        e.preventDefault();
        const content = logEntry.textContent?.trim().replace(/\s+/g, ' ') || '';
        if (content) {
          logContextMenu.showContextMenu(e.clientX, e.clientY, content);
        }
      }
    });

    console.log('✅ 所有模态组件已初始化');

    // 4. 初始化应用
    await app.initialize();
    console.log('✅ LovelyRes 启动完成');

    // 移除加载屏幕
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
      setTimeout(() => loadingScreen.remove(), 600);
    }

    // 5. 暴露全局实例
    (window as any).app = app;
    (window as any).lovelyResApp = app;
    (window as any).openSSHTerminalWindow = openSSHTerminalWindow;

    // 6. 延迟初始化SSH终端组件
    setTimeout(() => {
      if (document.getElementById('ssh-terminal-container')) {
        sshTerminalManager.mountTerminal();
        console.log('✅ SSH终端组件预挂载完成');
      }
    }, 1000);

    // 7. 注册全局函数（从 globalFunctions.ts 模块）
    initGlobalFunctions({ app, settingsPageManager, openSSHTerminalWindow });

    // 8. 初始化功能管理器
    console.log('📁 专注于SFTP文件管理功能');
    await remoteOperationsManager.initialize();
    await sshTerminalManager.initialize();
    await settingsManager.initialize();

  } catch (error) {
    console.error('❌ LovelyRes 启动失败:', error);
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.remove();

    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.innerHTML = `
        <div style="
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          height: 100vh; background: #f8fafc; color: #1e293b;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">
          <div style="font-size: 48px; margin-bottom: 24px;">❌</div>
          <h2 style="margin-bottom: 16px;">应用启动失败</h2>
          <p style="color: #64748b; text-align: center; max-width: 400px;">
            LovelyRes 在启动过程中遇到了问题。请检查控制台获取详细错误信息。
          </p>
          <button onclick="location.reload()" style="
            margin-top: 24px; padding: 12px 24px;
            background: #4299e1; color: white; border: none;
            border-radius: 8px; cursor: pointer; font-size: 14px;
          ">重新加载</button>
        </div>
      `;
    }
  }

  // SSH终端按钮事件委托
  document.body.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const terminalBtn = target.closest('#ssh-terminal-title-btn');
    if (terminalBtn) {
      event.preventDefault();
      event.stopPropagation();
      openSSHTerminalWindow();
    }
  });

  // 全局点击：清除表格选中状态
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target.closest('tr') && !target.closest('[id$="-context-menu"]')) {
      document.querySelectorAll('.system-table tr.selected').forEach(row => {
        row.classList.remove('selected');
      });
    }
  });

  // 初始化 Command Palette（从 commandPalette.ts 模块）
  initCommandPalette();

  // 初始化全局键盘快捷键（从 keyboardShortcuts.ts 模块）
  initKeyboardShortcuts(app);
}

/**
 * 全局错误处理
 */
window.addEventListener('error', (event) => {
  const msg = (event as any).message as string | undefined;
  if (msg && typeof msg === 'string' && msg.includes('ResizeObserver loop')) return;
  if ((event as any).error) {
    console.error('全局错误:', (event as any).error);
  } else {
    console.error('全局错误:', event.message, event.filename, event.lineno, event.colno);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('未处理的Promise拒绝:', event.reason);
});

window.addEventListener('beforeunload', () => {
  if (app) {
    console.log('🧹 LovelyRes 正在清理资源...');
  }
});

// 启动应用
document.addEventListener('DOMContentLoaded', initializeApp);
