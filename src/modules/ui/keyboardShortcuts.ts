/**
 * 全局键盘快捷键模块
 * 注册 Ctrl+K / Ctrl+1~8 / Ctrl+Shift+T 等快捷键
 *
 * 从 main.ts 提取，原位置: 第 702–735 行
 */

import { openPalette, closePalette, commandPalettePages } from './commandPalette';
import type { LovelyResApp } from '../core/app';

/**
 * 初始化全局键盘快捷键
 * @param app 应用实例，用于主题切换
 */
export function initKeyboardShortcuts(app: LovelyResApp): void {
  document.addEventListener('keydown', (e) => {
    // Ctrl+K: Command Palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const overlay = document.getElementById('command-palette-overlay');
      if (overlay?.classList.contains('active')) {
        closePalette();
      } else {
        openPalette();
      }
    }

    // Ctrl+1~8: Quick page switch
    if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '8') {
      const index = parseInt(e.key) - 1;
      if (index < commandPalettePages.length) {
        e.preventDefault();
        const pageId = commandPalettePages[index].id;
        if ((window as any).switchPage) {
          (window as any).switchPage(pageId);
        }
        closePalette();
      }
    }

    // Ctrl+Shift+T: Cycle themes
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
      e.preventDefault();
      if (app) {
        app.toggleTheme();
      }
    }
  });
}
