/**
 * 命令历史记录查看器
 * 显示所有已执行的命令历史，支持搜索、查看详情、重新执行
 */

import * as IconPark from '@icon-park/svg'
import { CommandHistoryManager, type CommandHistoryItem } from '../utils/commandHistoryManager'
import { showConfirm } from './confirmDialog'

export class CommandHistoryModal {
  private modal: HTMLElement | null = null;
  private isVisible = false;
  private currentFilter = '';

  constructor() {
    this.createModal();
    this.bindEvents();
  }

  private createModal(): void {
    const html = `
      <div id="command-history-modal" class="modal-overlay" style="
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: none;
        z-index: 10000;
        backdrop-filter: blur(3px);
      ">
        <div class="modal-content" style="
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 90%;
          max-width: 1200px;
          height: 80%;
          background: var(--bg-primary);
          border: 1px solid var(--border-color);
          border-radius: var(--border-radius-lg);
          box-shadow: 0 20px 40px rgba(0,0,0,0.35);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        ">
          <div class="modal-header" style="
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: var(--spacing-md);
            border-bottom: 1px solid var(--border-color);
            background: var(--bg-secondary);
          ">
            <div style="display:flex; align-items:center; gap:12px;">
              ${IconPark.History({ theme: 'outline', size: '20', fill: 'currentColor' })}
              <h3 style="margin:0; font-size:16px; color:var(--text-primary);">命令历史记录</h3>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
              <input id="cmd-history-search" type="text" placeholder="搜索命令、标题或输出..." autocomplete="off" style="
                width: 300px;
                padding: 8px 12px;
                border: 1px solid var(--border-color);
                border-radius: 6px;
                background: var(--bg-primary);
                color: var(--text-primary);
                font-size: 13px;
              ">
              <button id="cmd-history-clear" class="modern-btn secondary" style="font-size:13px; padding:8px 12px;">
                ${IconPark.Delete({ theme: 'outline', size: '16', fill: 'currentColor' })}
                <span>清空历史</span>
              </button>
              <button id="cmd-history-close" class="modern-btn secondary" style="font-size:13px; padding:8px 12px;">关闭</button>
            </div>
          </div>
          <div class="modal-body" style="
            padding: var(--spacing-md);
            overflow-y: auto;
            flex: 1;
          ">
            <div id="cmd-history-list" style="
              display: flex;
              flex-direction: column;
              gap: var(--spacing-sm);
            "></div>
            <div id="cmd-history-empty" style="
              display: none;
              text-align: center;
              padding: var(--spacing-xl);
              color: var(--text-secondary);
            ">
              <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
              <div style="font-size: 16px; margin-bottom: 8px;">暂无命令历史</div>
              <div style="font-size: 13px;">执行命令后会自动保存到这里</div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    this.modal = document.getElementById('command-history-modal');
  }

  private bindEvents(): void {
    document.getElementById('cmd-history-close')?.addEventListener('click', () => this.hide());
    
    this.modal?.addEventListener('click', (event) => {
      if (event.target === this.modal) this.hide();
    });

    document.addEventListener('keydown', (event) => {
      if (!this.isVisible) return;
      if (event.key === 'Escape') this.hide();
    });

    // 搜索功能
    const searchInput = document.getElementById('cmd-history-search') as HTMLInputElement;
    if (searchInput) {
      let timer: number | null = null;
      searchInput.addEventListener('input', () => {
        if (timer) window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          this.currentFilter = searchInput.value.trim();
          this.renderHistory();
        }, 300);
      });
    }

    // 清空历史
    document.getElementById('cmd-history-clear')?.addEventListener('click', async () => {
      if (await showConfirm({ title: '清空历史', message: '确定要清空所有命令历史吗？此操作不可恢复。', dangerous: true })) {
        CommandHistoryManager.clearHistory();
        this.renderHistory();
        window.showNotification?.('命令历史已清空', 'success');
      }
    });
  }

  show(): void {
    if (!this.modal) return;
    this.modal.style.display = 'flex';
    this.isVisible = true;
    this.currentFilter = '';
    
    const searchInput = document.getElementById('cmd-history-search') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
    
    this.renderHistory();
  }

  hide(): void {
    if (!this.modal) return;
    this.modal.style.display = 'none';
    this.isVisible = false;
  }

  private renderHistory(): void {
    const listEl = document.getElementById('cmd-history-list');
    const emptyEl = document.getElementById('cmd-history-empty');
    if (!listEl || !emptyEl) return;

    let history = this.currentFilter 
      ? CommandHistoryManager.search(this.currentFilter)
      : CommandHistoryManager.getHistory();

    if (history.length === 0) {
      listEl.innerHTML = '';
      emptyEl.style.display = 'block';
      return;
    }

    emptyEl.style.display = 'none';
    listEl.innerHTML = history.map(item => this.renderHistoryItem(item)).join('');

    // 绑定事件
    listEl.querySelectorAll('[data-cmd-history-id]').forEach(el => {
      const id = el.getAttribute('data-cmd-history-id');
      if (!id) return;

      el.querySelector('.cmd-history-view')?.addEventListener('click', () => {
        this.viewCommand(id);
      });

      el.querySelector('.cmd-history-execute')?.addEventListener('click', () => {
        this.executeCommand(id);
      });

      el.querySelector('.cmd-history-delete')?.addEventListener('click', () => {
        this.deleteCommand(id);
      });
    });
  }

  private renderHistoryItem(item: CommandHistoryItem): string {
    const date = new Date(item.timestamp);
    const dateStr = date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const commandPreview = item.command.length > 80 
      ? item.command.substring(0, 80) + '...'
      : item.command;

    return `
      <div data-cmd-history-id="${item.id}" style="
        padding: var(--spacing-md);
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        transition: all 0.2s;
      " onmouseover="this.style.borderColor='var(--primary-color)'" onmouseout="this.style.borderColor='var(--border-color)'">
        <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px; margin-bottom: 8px;">
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px; font-size: 14px;">
              ${this.escapeHtml(item.title)}
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 8px;">
              ${IconPark.Time({ theme: 'outline', size: '12', fill: 'currentColor' })}
              ${dateStr}
            </div>
            <code style="
              display: block;
              font-family: 'Consolas', 'Monaco', monospace;
              font-size: 12px;
              color: var(--text-primary);
              background: var(--bg-primary);
              padding: 8px;
              border-radius: 4px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            ">${this.escapeHtml(commandPreview)}</code>
          </div>
          <div style="display: flex; gap: 6px; flex-shrink: 0;">
            <button class="cmd-history-view modern-btn secondary" style="font-size: 12px; padding: 6px 10px;" title="查看详情">
              ${IconPark.PreviewOpen({ theme: 'outline', size: '14', fill: 'currentColor' })}
            </button>
            <button class="cmd-history-execute modern-btn primary" style="font-size: 12px; padding: 6px 10px;" title="重新执行">
              ${IconPark.Play({ theme: 'outline', size: '14', fill: 'currentColor' })}
            </button>
            <button class="cmd-history-delete modern-btn secondary" style="font-size: 12px; padding: 6px 10px;" title="删除">
              ${IconPark.Delete({ theme: 'outline', size: '14', fill: 'currentColor' })}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private viewCommand(id: string): void {
    const item = CommandHistoryManager.getById(id);
    if (!item) return;

    // 使用 EmergencyResultModal 显示命令详情
    const emergencyModal = (window as any).emergencyResultModal;
    if (emergencyModal) {
      emergencyModal.show(item.title, item.command, item.output);
      this.hide();
    } else {
      window.showNotification?.('命令详情窗口未初始化', 'error');
    }
  }

  private async executeCommand(id: string): Promise<void> {
    const item = CommandHistoryManager.getById(id);
    if (!item) return;

    // 关闭历史记录模态框
    this.hide();

    // 使用 EmergencyResultModal 执行命令
    const emergencyModal = (window as any).emergencyResultModal;
    if (emergencyModal) {
      // 先显示模态框
      emergencyModal.show(item.title, item.command, '⏳ 正在执行命令...');
      
      // 然后触发执行
      setTimeout(() => {
        const executeBtn = document.getElementById('em-modal-execute-btn');
        if (executeBtn) {
          executeBtn.click();
        }
      }, 100);
    } else {
      window.showNotification?.('命令执行窗口未初始化，无法重新执行', 'error');
    }
  }

  private async deleteCommand(id: string): Promise<void> {
    if (await showConfirm({ title: '删除记录', message: '确定要删除这条历史记录吗？' })) {
      CommandHistoryManager.deleteById(id);
      this.renderHistory();
      window.showNotification?.('历史记录已删除', 'success');
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

