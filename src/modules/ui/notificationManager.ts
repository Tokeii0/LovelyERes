/**
 * 通知管理器
 * 全局通知显示系统 — 底部居中紧凑 Toast 风格
 */

import { eventBus } from '../core/eventBus';

const typeColorMap: Record<string, string> = {
  success: 'var(--success-color)',
  error: 'var(--error-color)',
  info: 'var(--info-color)',
  warning: 'var(--warning-color)'
};

const typeIconMap: Record<string, string> = {
  success: '<polyline points="20 6 9 17 4 12"></polyline>',
  error: '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>',
  info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
  warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'
};

function ensureContainer(): HTMLElement {
  let container = document.getElementById('notification-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'notification-container';
    document.body.appendChild(container);
  }
  return container;
}

function ensureAnimations(): void {
  if (!document.getElementById('notification-animations')) {
    const style = document.createElement('style');
    style.id = 'notification-animations';
    style.textContent = `
      @keyframes toastIn {
        from { transform: translateY(16px) scale(0.96); opacity: 0; }
        to   { transform: translateY(0) scale(1); opacity: 1; }
      }
      @keyframes toastOut {
        from { transform: translateY(0) scale(1); opacity: 1; }
        to   { transform: translateY(16px) scale(0.96); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

function dismissNotification(notification: HTMLElement): void {
  notification.style.animation = 'toastOut 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards';
  setTimeout(() => notification.remove(), 250);
}

export function showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
  const container = ensureContainer();
  ensureAnimations();

  const color = typeColorMap[type];
  const iconSvg = typeIconMap[type];

  const notification = document.createElement('div');
  notification.className = 'modern-notification';
  notification.style.cssText = `
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 14px;
    border-radius: 8px;
    background: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    box-shadow: 0 4px 16px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08);
    font-size: 13px;
    line-height: 1.4;
    pointer-events: auto;
    animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    backdrop-filter: blur(12px);
    max-width: 460px;
    cursor: pointer;
  `;

  notification.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
      style="width:16px; height:16px; flex-shrink:0;">
      ${iconSvg}
    </svg>
    <span style="color: var(--text-secondary); word-break: break-word;">${escapeHtml(message)}</span>
  `;

  // 点击关闭
  notification.addEventListener('click', () => dismissNotification(notification));

  container.appendChild(notification);

  // 自动移除：error 类型 5 秒，其他 3 秒
  const duration = type === 'error' ? 5000 : 3000;
  setTimeout(() => {
    if (notification.parentElement) {
      dismissNotification(notification);
    }
  }, duration);
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 初始化通知管理器，注册全局函数和 EventBus 监听
 */
export function initNotificationManager(): void {
  (window as any).showNotification = showNotification;

  eventBus.on('notification', ({ message, type }) => {
    showNotification(message, type);
  });
}
