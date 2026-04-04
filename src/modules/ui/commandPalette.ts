/**
 * Command Palette 模块
 * 提供 Ctrl+K 搜索面板，支持页面导航和命令搜索
 *
 * 从 main.ts 提取，原位置: 第 560–700 行
 */

export interface CommandPalettePage {
  id: string;
  title: string;
  desc: string;
  shortcut: string;
}

/** 可导航的页面列表 */
export const commandPalettePages: CommandPalettePage[] = [
  { id: 'dashboard', title: '仪表板', desc: '系统监控总览', shortcut: 'Ctrl+1' },
  { id: 'system-info', title: '系统信息', desc: '进程 / 网络 / 服务 / 用户', shortcut: 'Ctrl+2' },
  { id: 'remote-operations', title: 'SFTP文件', desc: '远程文件管理', shortcut: 'Ctrl+3' },
  { id: 'docker', title: 'Docker容器', desc: '容器管理', shortcut: 'Ctrl+4' },
  { id: 'emergency-commands', title: '命令执行', desc: '应急命令', shortcut: 'Ctrl+5' },
  { id: 'packet-capture', title: '网络抓包', desc: '流量分析', shortcut: 'Ctrl+6' },
  { id: 'quick-detection', title: '快速检测', desc: '安全检测', shortcut: 'Ctrl+7' },
  { id: 'log-analysis', title: '日志审计', desc: '日志分析', shortcut: 'Ctrl+8' },
];

function renderPaletteResults(query: string): void {
  const results = document.getElementById('command-palette-results');
  if (!results) return;

  const filtered = query.trim()
    ? commandPalettePages.filter(p =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.desc.toLowerCase().includes(query.toLowerCase()))
    : commandPalettePages;

  if (filtered.length === 0) {
    results.innerHTML = '<div class="command-palette-empty">没有找到匹配结果</div>';
    return;
  }

  results.innerHTML = `
    <div class="command-palette-group">
      <div class="command-palette-group-title">页面</div>
      ${filtered.map((p, i) => `
        <div class="command-palette-item ${i === 0 ? 'active' : ''}" data-page-id="${p.id}">
          <div class="command-palette-item-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M3 9h6"/></svg>
          </div>
          <div class="command-palette-item-text">
            <div class="command-palette-item-title">${p.title}</div>
            <div class="command-palette-item-desc">${p.desc}</div>
          </div>
          <span class="command-palette-item-shortcut">${p.shortcut}</span>
        </div>
      `).join('')}
    </div>
  `;

  // Click handler for results
  results.querySelectorAll('.command-palette-item').forEach(item => {
    item.addEventListener('click', () => {
      const pageId = item.getAttribute('data-page-id');
      if (pageId && (window as any).switchPage) {
        (window as any).switchPage(pageId);
      }
      closePalette();
    });
  });
}

export function openPalette(): void {
  const overlay = document.getElementById('command-palette-overlay');
  const input = document.getElementById('command-palette-input') as HTMLInputElement;
  if (overlay) {
    overlay.classList.add('active');
    if (input) {
      input.value = '';
      input.focus();
      renderPaletteResults('');
    }
  }
}

export function closePalette(): void {
  const overlay = document.getElementById('command-palette-overlay');
  if (overlay) overlay.classList.remove('active');
}

/**
 * 初始化 Command Palette
 * 注入 DOM 并绑定事件
 */
export function initCommandPalette(): void {
  // Inject DOM
  const paletteHTML = `
    <div id="command-palette-overlay" class="command-palette-overlay">
      <div class="command-palette">
        <div class="command-palette-header">
          <div class="command-palette-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          </div>
          <input id="command-palette-input" class="command-palette-input" type="text" placeholder="搜索页面、命令..." autocomplete="off" />
          <span class="command-palette-shortcut">ESC</span>
        </div>
        <div id="command-palette-results" class="command-palette-results"></div>
        <div class="command-palette-footer">
          <div class="command-palette-footer-hint">
            <span><kbd>↑↓</kbd> 导航</span>
            <span><kbd>↵</kbd> 选择</span>
            <span><kbd>Esc</kbd> 关闭</span>
          </div>
          <span>LovelyRes</span>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', paletteHTML);

  // Expose globally
  (window as any).openCommandPalette = openPalette;
  (window as any).closeCommandPalette = closePalette;

  // Input handler
  const paletteInput = document.getElementById('command-palette-input');
  if (paletteInput) {
    paletteInput.addEventListener('input', (e) => {
      renderPaletteResults((e.target as HTMLInputElement).value);
    });
    paletteInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closePalette();
      } else if (e.key === 'Enter') {
        const activeItem = document.querySelector('.command-palette-item.active') as HTMLElement;
        if (activeItem) activeItem.click();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = Array.from(document.querySelectorAll('.command-palette-item'));
        const activeIndex = items.findIndex(item => item.classList.contains('active'));
        items.forEach(item => item.classList.remove('active'));
        let nextIndex: number;
        if (e.key === 'ArrowDown') {
          nextIndex = activeIndex < items.length - 1 ? activeIndex + 1 : 0;
        } else {
          nextIndex = activeIndex > 0 ? activeIndex - 1 : items.length - 1;
        }
        items[nextIndex]?.classList.add('active');
        items[nextIndex]?.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  // Close on overlay click
  const paletteOverlay = document.getElementById('command-palette-overlay');
  if (paletteOverlay) {
    paletteOverlay.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).classList.contains('command-palette-overlay')) {
        closePalette();
      }
    });
  }
}
