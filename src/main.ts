/**
 * LovelyRes 主入口文件
 * Linux Emergency Response Tool
 */

import './css/main.css';
import 'xterm/css/xterm.css';

import type { LovelyResApp } from './modules/core/app';

import { initNotificationManager } from './modules/ui/notificationManager';

let app: LovelyResApp | null = null;
let bootPromise: Promise<void> | null = null;
let postBootDomListenersBound = false;

function removeLoadingScreen(): void {
  const loadingScreen = document.getElementById('loading-screen');
  if (!loadingScreen) return;

  loadingScreen.classList.add('hidden');
  setTimeout(() => loadingScreen.remove(), 600);
}

function removeLegacyAccessArtifacts(): void {
  document.body.classList.remove('auth-locked');

  try {
    [
      'lovelyres-access-token',
      'lovelyres-refresh-token',
      'lovelyres-user-info'
    ].forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn('清理旧访问状态失败:', error);
  }

  document
    .querySelectorAll(
      '#login-modal, #bind-device-modal, #account-settings-modal, .auth-required-toast, .license-card, .license-modal'
    )
    .forEach((element) => element.remove());
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showStartupFailure(error: unknown): void {
  removeLoadingScreen();

  const appEl = document.getElementById('app');
  if (!appEl) return;

  appEl.innerHTML = `
    <div style="
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100vh; background: #f8fafc; color: #1e293b;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    ">
      <div style="font-size: 42px; margin-bottom: 24px;">启动失败</div>
      <h2 style="margin-bottom: 16px;">应用启动失败</h2>
      <p style="color: #64748b; text-align: center; max-width: 420px; line-height: 1.7;">
        LovelyRes 在启动过程中遇到了问题。请检查控制台获取详细错误信息。
      </p>
      <pre style="
        margin-top: 16px; max-width: 520px; white-space: pre-wrap; word-break: break-word;
        color: #dc2626; background: #fee2e2; padding: 12px; border-radius: 8px; font-size: 12px;
      ">${escapeHtml(String(error))}</pre>
      <button onclick="location.reload()" style="
        margin-top: 24px; padding: 12px 24px;
        background: #4299e1; color: white; border: none;
        border-radius: 8px; cursor: pointer; font-size: 14px;
      ">重新加载</button>
    </div>
  `;
}

/**
 * 在新窗口中打开 SSH 终端
 */
async function openSSHTerminalWindow(): Promise<void> {
  try {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const existingWindow = await WebviewWindow.getByLabel('ssh-terminal');
    if (existingWindow) {
      await existingWindow.setFocus();
      await existingWindow.unminimize();
      return;
    }

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
      decorations: isMacOS,
      alwaysOnTop: false,
      skipTaskbar: false
    });

    sshWindow.once('tauri://error', (error) => console.error('SSH 终端窗口创建错误:', error));
  } catch (error) {
    console.error('创建 SSH 终端窗口失败:', error);

    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const existingWindow = await WebviewWindow.getByLabel('ssh-terminal');
      if (existingWindow) {
        await existingWindow.setFocus();
        await existingWindow.unminimize();
        return;
      }
    } catch (focusError) {
      console.error('聚焦 SSH 终端窗口失败:', focusError);
    }

    const fallbackWindow = window.open(
      '/ssh-terminal.html',
      'ssh-terminal',
      'width=1000,height=700,resizable=yes,scrollbars=yes,status=yes'
    );
    if (!fallbackWindow) {
      window.showNotification?.('无法打开 SSH 终端窗口', 'error');
    }
  }
}

function bindPostBootDomListeners(logContextMenu: { showContextMenu(x: number, y: number, content: string): void }): void {
  if (postBootDomListenersBound) return;
  postBootDomListenersBound = true;

  document.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    const logEntry = target.closest('.log-entry');
    if (!logEntry) return;

    e.preventDefault();
    const content = logEntry.textContent?.trim().replace(/\s+/g, ' ') || '';
    if (content) {
      logContextMenu.showContextMenu(e.clientX, e.clientY, content);
    }
  });

  document.body.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const terminalBtn = target.closest('#ssh-terminal-title-btn');
    if (terminalBtn) {
      event.preventDefault();
      event.stopPropagation();
      void openSSHTerminalWindow();
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    if (!target.closest('tr') && !target.closest('[id$="-context-menu"]')) {
      document.querySelectorAll('.system-table tr.selected').forEach(row => {
        row.classList.remove('selected');
      });
    }
  });
}

async function bootstrapApp(): Promise<void> {
  if (bootPromise) {
    return bootPromise;
  }

  bootPromise = (async () => {
    removeLegacyAccessArtifacts();
    console.log('LovelyRes 启动中...');

    const [
      { LovelyResApp },
      { remoteOperationsManager },
      { sshTerminalManager },
      { SettingsManager },
      { SettingsPageManager },
      { FileViewerModal },
      { PermissionsModal },
      { EmergencyResultModal },
      { CommandHistoryModal },
      { FileContextMenu },
      { LogContextMenu },
      { initSftpContextMenuHandler },
      { initServerModalManager },
      { initTableFilterManager },
      { initSystemInfoTabManager },
      { initTableUpdateManager },
      { initLogAnalysisManager },
      { initCommandPalette },
      { initKeyboardShortcuts },
      { initGlobalFunctions },
      { logger },
      { i18n },
      { forensicManager }
    ] = await Promise.all([
      import('./modules/core/app'),
      import('./modules/remote/remoteOperationsManager'),
      import('./modules/ssh/sshTerminalManager'),
      import('./modules/settings/settingsManager'),
      import('./modules/settings/settingsPageManager'),
      import('./modules/ui/fileViewerModal'),
      import('./modules/ui/permissionsModal'),
      import('./modules/ui/emergencyModal'),
      import('./modules/ui/commandHistoryModal'),
      import('./modules/ui/fileContextMenu'),
      import('./modules/ui/logContextMenu'),
      import('./modules/ui/sftpContextMenuHandler'),
      import('./modules/ui/serverModalManager'),
      import('./modules/ui/tableFilterManager'),
      import('./modules/ui/systemInfoTabManager'),
      import('./modules/ui/tableUpdateManager'),
      import('./modules/ui/logAnalysisManager'),
      import('./modules/ui/commandPalette'),
      import('./modules/ui/keyboardShortcuts'),
      import('./modules/ui/globalFunctions'),
      import('./modules/core/logger'),
      import('./modules/i18n'),
      import('./modules/emergency/forensicManager')
    ]);

    initTableFilterManager();
    initTableUpdateManager();
    initSystemInfoTabManager();
    initServerModalManager();
    initSftpContextMenuHandler();
    initLogAnalysisManager();

    const log = logger.module('App');
    log.info(`LovelyRes 启动中... (语言: ${i18n.lang})`);
    forensicManager.loadFromStorage();

    const settingsManager = new SettingsManager();
    const settingsPageManager = new SettingsPageManager(settingsManager);

    app = new LovelyResApp();

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

    bindPostBootDomListeners(logContextMenu);

    await app.initialize();
    removeLoadingScreen();

    (window as any).app = app;
    (window as any).lovelyResApp = app;
    (window as any).openSSHTerminalWindow = openSSHTerminalWindow;

    setTimeout(() => {
      if (document.getElementById('ssh-terminal-container')) {
        sshTerminalManager.mountTerminal();
      }
    }, 1000);

    initGlobalFunctions({ app, settingsPageManager, openSSHTerminalWindow });

    await remoteOperationsManager.initialize();
    await sshTerminalManager.initialize();
    await settingsManager.initialize();

    initCommandPalette();
    initKeyboardShortcuts(app);

    console.log('LovelyRes 启动完成');
  })().catch((error) => {
    bootPromise = null;
    console.error('LovelyRes 启动失败:', error);
    showStartupFailure(error);
  });

  return bootPromise;
}

async function initializeApp(): Promise<void> {
  initNotificationManager();
  removeLegacyAccessArtifacts();
  await bootstrapApp();
}

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
  console.error('未处理的 Promise 拒绝:', event.reason);
});

window.addEventListener('beforeunload', () => {
  if (app) {
    console.log('LovelyRes 正在清理资源...');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  void initializeApp();
});
