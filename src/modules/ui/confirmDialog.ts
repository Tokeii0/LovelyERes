/**
 * 自定义对话框模块 — 替代浏览器原生 confirm / prompt / alert
 * Tauri webview 中原生对话框无效，统一使用此模块
 */

let dialogCounter = 0;
let stylesInjected = false;

function injectStyles(): void {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes cdFadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes cdSlideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    .cd-overlay {
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex; align-items: center; justify-content: center;
      z-index: 10002; padding: 20px;
      animation: cdFadeIn 0.2s ease-out;
      transition: opacity 0.2s ease;
    }
    .cd-modal {
      background: var(--bg-primary);
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
      max-width: 450px; width: 100%;
      animation: cdSlideUp 0.3s ease-out;
    }
    .cd-header {
      padding: 20px;
      border-bottom: 1px solid var(--border-color);
    }
    .cd-header-row {
      display: flex; align-items: center; gap: 12px;
    }
    .cd-icon {
      width: 40px; height: 40px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 20px; flex-shrink: 0;
    }
    .cd-title {
      margin: 0; font-size: 16px; font-weight: 600; color: var(--text-primary);
    }
    .cd-description {
      margin: 4px 0 0 0; font-size: 12px; color: var(--text-secondary);
    }
    .cd-body {
      padding: 20px;
    }
    .cd-message {
      font-size: 14px; color: var(--text-primary); line-height: 1.6;
      white-space: pre-line;
    }
    .cd-input {
      width: 100%; margin-top: 12px; padding: 10px 12px;
      font-size: 14px; border-radius: 8px;
      border: 1px solid var(--border-color);
      background: var(--bg-secondary); color: var(--text-primary);
      outline: none; box-sizing: border-box;
      font-family: inherit;
    }
    .cd-input:focus {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }
    .cd-footer {
      padding: 16px 20px;
      border-top: 1px solid var(--border-color);
      display: flex; justify-content: flex-end; gap: 12px;
    }
  `;
  document.head.appendChild(style);
}

interface ConfirmOptions {
  title: string;
  message: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  dangerous?: boolean;
}

interface PromptOptions {
  title: string;
  message: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
}

interface AlertOptions {
  title: string;
  message: string;
  description?: string;
  type?: 'info' | 'warning' | 'error';
  buttonText?: string;
}

function createOverlay(): HTMLDivElement {
  injectStyles();
  const overlay = document.createElement('div');
  overlay.className = 'cd-overlay';
  return overlay;
}

function buildHeader(title: string, description: string | undefined, icon: string, iconBg: string): string {
  return `
    <div class="cd-header">
      <div class="cd-header-row">
        <div class="cd-icon" style="background: ${iconBg};">${icon}</div>
        <div style="flex: 1;">
          <h3 class="cd-title">${escapeHtml(title)}</h3>
          ${description ? `<p class="cd-description">${escapeHtml(description)}</p>` : ''}
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function cleanup(overlay: HTMLDivElement, handleEscape: (e: KeyboardEvent) => void): void {
  overlay.style.opacity = '0';
  document.removeEventListener('keydown', handleEscape);
  setTimeout(() => {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }, 200);
}

/**
 * 自定义确认对话框 — 替代 confirm()
 */
export function showConfirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const id = ++dialogCounter;
    const overlay = createOverlay();
    const iconBg = options.dangerous ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)';
    const icon = options.dangerous ? '⚠️' : 'ℹ️';
    const confirmBg = options.dangerous ? '#ef4444' : 'var(--primary-color)';

    overlay.innerHTML = `
      <div class="cd-modal">
        ${buildHeader(options.title, options.description, icon, iconBg)}
        <div class="cd-body">
          <div class="cd-message">${escapeHtml(options.message)}</div>
        </div>
        <div class="cd-footer">
          <button id="cd-cancel-${id}" class="modern-btn secondary" style="padding: 8px 20px; font-size: 13px;">
            ${escapeHtml(options.cancelText || '取消')}
          </button>
          <button id="cd-confirm-${id}" class="modern-btn primary" style="padding: 8px 20px; font-size: 13px; background: ${confirmBg};">
            ${escapeHtml(options.confirmText || '确认')}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let resolved = false;
    const done = (val: boolean) => {
      if (resolved) return;
      resolved = true;
      cleanup(overlay, handleEscape);
      resolve(val);
    };

    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', handleEscape);

    overlay.querySelector(`#cd-cancel-${id}`)?.addEventListener('click', () => done(false));
    overlay.querySelector(`#cd-confirm-${id}`)?.addEventListener('click', () => done(true));
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(false); });

    // 自动聚焦确认按钮
    (overlay.querySelector(`#cd-confirm-${id}`) as HTMLElement)?.focus();
  });
}

/**
 * 自定义输入对话框 — 替代 prompt()
 */
export function showPrompt(options: PromptOptions): Promise<string | null> {
  return new Promise((resolve) => {
    const id = ++dialogCounter;
    const overlay = createOverlay();

    overlay.innerHTML = `
      <div class="cd-modal">
        ${buildHeader(options.title, undefined, '✏️', 'rgba(59, 130, 246, 0.1)')}
        <div class="cd-body">
          <div class="cd-message">${escapeHtml(options.message)}</div>
          <input id="cd-input-${id}" class="cd-input" type="text"
            value="${escapeHtml(options.defaultValue || '')}"
            placeholder="${escapeHtml(options.placeholder || '')}" />
        </div>
        <div class="cd-footer">
          <button id="cd-cancel-${id}" class="modern-btn secondary" style="padding: 8px 20px; font-size: 13px;">
            ${escapeHtml(options.cancelText || '取消')}
          </button>
          <button id="cd-confirm-${id}" class="modern-btn primary" style="padding: 8px 20px; font-size: 13px;">
            ${escapeHtml(options.confirmText || '确认')}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const input = overlay.querySelector(`#cd-input-${id}`) as HTMLInputElement;

    let resolved = false;
    const done = (val: string | null) => {
      if (resolved) return;
      resolved = true;
      cleanup(overlay, handleEscape);
      resolve(val);
    };

    const confirmValue = () => {
      const val = input?.value;
      done(val !== undefined ? val : null);
    };

    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') done(null); };
    document.addEventListener('keydown', handleEscape);

    overlay.querySelector(`#cd-cancel-${id}`)?.addEventListener('click', () => done(null));
    overlay.querySelector(`#cd-confirm-${id}`)?.addEventListener('click', confirmValue);
    input?.addEventListener('keydown', (e) => { if (e.key === 'Enter') confirmValue(); });
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(null); });

    // 自动聚焦并选中输入框
    requestAnimationFrame(() => {
      input?.focus();
      input?.select();
    });
  });
}

/**
 * 自定义提示对话框 — 替代 alert()
 */
export function showAlert(options: AlertOptions): Promise<void> {
  return new Promise((resolve) => {
    const id = ++dialogCounter;
    const overlay = createOverlay();

    const typeConfig = {
      info: { icon: 'ℹ️', bg: 'rgba(59, 130, 246, 0.1)' },
      warning: { icon: '⚠️', bg: 'rgba(245, 158, 11, 0.1)' },
      error: { icon: '❌', bg: 'rgba(239, 68, 68, 0.1)' },
    };
    const cfg = typeConfig[options.type || 'info'];

    overlay.innerHTML = `
      <div class="cd-modal">
        ${buildHeader(options.title, options.description, cfg.icon, cfg.bg)}
        <div class="cd-body">
          <div class="cd-message">${escapeHtml(options.message)}</div>
        </div>
        <div class="cd-footer">
          <button id="cd-ok-${id}" class="modern-btn primary" style="padding: 8px 20px; font-size: 13px;">
            ${escapeHtml(options.buttonText || '确定')}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let resolved = false;
    const done = () => {
      if (resolved) return;
      resolved = true;
      cleanup(overlay, handleEscape);
      resolve();
    };

    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') done(); };
    document.addEventListener('keydown', handleEscape);

    overlay.querySelector(`#cd-ok-${id}`)?.addEventListener('click', done);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) done(); });

    (overlay.querySelector(`#cd-ok-${id}`) as HTMLElement)?.focus();
  });
}
