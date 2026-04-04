/**
 * 通知管理器
 * 全局通知显示系统
 */

import { eventBus } from '../core/eventBus';

const typeColorMap: Record<string, string> = {
  success: 'var(--success-color)',
  error: 'var(--error-color)',
  info: 'var(--info-color)',
  warning: 'var(--warning-color)'
};

const typeIconMap: Record<string, string> = {
  success: 'M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0l-111 111-47-47c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l64 64c9.4 9.4 24.6 9.4 33.9 0L369 209z',
  error: 'M256 48a208 208 0 1 1 0 416 208 208 0 1 1 0-416zm0 464A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM175 175c-9.4 9.4-9.4 24.6 0 33.9l47 47-47 47c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l47-47 47 47c9.4 9.4 24.6 9.4 33.9 0s9.4-24.6 0-33.9l-47-47 47-47c9.4-9.4 9.4-24.6 0-33.9s-24.6-9.4-33.9 0z',
  info: 'M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM216 336h24V272H216c-13.3 0-24-10.7-24-24s10.7-24 24-24h48c13.3 0 24 10.7 24 24v88h8c13.3 0 24 10.7 24 24s-10.7 24-24 24H216c-13.3 0-24-10.7-24-24s10.7-24 24-24zm40-208a32 32 0 1 1 0 64 32 32 0 1 1 0-64z',
  warning: 'M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24V296c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm32 224a32 32 0 1 0 -64 0 32 32 0 1 0 64 0z'
};

const typeTitleMap: Record<string, string> = {
  success: '成功',
  error: '错误',
  info: '提示',
  warning: '警告'
};

function ensureContainer(): HTMLElement {
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
  return container;
}

function ensureAnimations(): void {
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
}

function dismissNotification(notification: HTMLElement): void {
  notification.style.animation = 'slideOutRight 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
  setTimeout(() => notification.remove(), 300);
}

export function showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
  const container = ensureContainer();
  ensureAnimations();

  const primaryColor = typeColorMap[type];
  const iconPath = typeIconMap[type];
  const title = typeTitleMap[type];

  const notification = document.createElement('div');
  notification.className = 'modern-notification';
  notification.style.cssText = `
    width: 100%;
    min-height: 76px;
    border-radius: 12px;
    box-sizing: border-box;
    padding: 16px;
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-lg);
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
      <div style="
        position: absolute;
        top: 0; left: 0; width: 100%; height: 100%;
        background-color: ${primaryColor};
        opacity: 0.15;
        border-radius: 10px;
      "></div>
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

  // 点击关闭按钮关闭
  const closeBtn = notification.querySelector('button');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissNotification(notification);
    });
  }

  container.appendChild(notification);

  // 4秒后自动移除
  setTimeout(() => {
    if (notification.parentElement) {
      dismissNotification(notification);
    }
  }, 4000);
}

/**
 * 初始化通知管理器，注册全局函数和 EventBus 监听
 */
export function initNotificationManager(): void {
  // 保留全局函数向后兼容
  (window as any).showNotification = showNotification;

  // 同时监听 EventBus 事件（新代码优先使用此方式）
  eventBus.on('notification', ({ message, type }) => {
    showNotification(message, type);
  });
}
