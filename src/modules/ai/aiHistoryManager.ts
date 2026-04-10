/**
 * AI 历史记录管理器
 * 记录所有 AI 调用的问答内容，支持搜索、导出、清空
 */

export interface AIHistoryRecord {
  id: string;
  timestamp: number;
  question: string;
  answer: string;
  source: string;   // context-menu / emergency / detection / terminal / manual
}

const STORAGE_KEY = 'lovelyres-ai-history';
const MAX_RECORDS = 500;

class AIHistoryManager {
  private records: AIHistoryRecord[] = [];
  private initialized = false;
  private eventsBound = false;

  private load(): void {
    if (this.initialized) return;
    this.initialized = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.records = JSON.parse(raw);
    } catch { this.records = []; }
  }

  private save(): void {
    try {
      // 限制最大条数
      if (this.records.length > MAX_RECORDS) {
        this.records = this.records.slice(-MAX_RECORDS);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch (e) { console.warn('AI历史保存失败:', e); }
  }

  /** 新增一条记录 */
  addRecord(data: { question: string; answer: string; source: string }): void {
    this.load();
    this.records.push({
      id: `ai_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: Date.now(),
      question: data.question,
      answer: data.answer,
      source: data.source,
    });
    this.save();
  }

  /** 获取全部记录 (最新在前) */
  getRecords(): AIHistoryRecord[] {
    this.load();
    return [...this.records].reverse();
  }

  /** 搜索记录 */
  search(query: string): AIHistoryRecord[] {
    this.load();
    const q = query.toLowerCase();
    return this.records
      .filter(r => r.question.toLowerCase().includes(q) || r.answer.toLowerCase().includes(q))
      .reverse();
  }

  /** 清空全部 */
  clear(): void {
    this.records = [];
    this.save();
  }

  /** 删除单条 */
  remove(id: string): void {
    this.load();
    this.records = this.records.filter(r => r.id !== id);
    this.save();
  }

  /** 导出为文本 */
  exportAll(): string {
    this.load();
    return this.records.map(r =>
      `[${new Date(r.timestamp).toLocaleString()}] (${r.source})\nQ: ${r.question}\nA: ${r.answer}\n${'─'.repeat(40)}`
    ).join('\n\n');
  }

  getCount(): number {
    this.load();
    return this.records.length;
  }

  // ──── 页面渲染 (侧边栏页面) ────

  initialize(): void {
    this.load();
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
    this.render();
  }

  private bindEvents(): void {
    document.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-aih-action]') as HTMLElement;
      if (!t) return;
      const action = t.getAttribute('data-aih-action') || '';
      const param = t.getAttribute('data-aih-param') || '';

      switch (action) {
        case 'clear':
          this.clear();
          this.render();
          window.showNotification?.('AI 历史已清空', 'success');
          break;
        case 'export':
          navigator.clipboard.writeText(this.exportAll()).catch(() => {});
          window.showNotification?.('已复制到剪贴板', 'success');
          break;
        case 'delete':
          this.remove(param);
          this.render();
          break;
        case 'copy-answer':
          { const r = this.records.find(x => x.id === param);
            if (r) { navigator.clipboard.writeText(r.answer).catch(() => {}); window.showNotification?.('已复制', 'success'); }
          }
          break;
        case 'toggle':
          { const detail = document.getElementById(`aih-detail-${param}`);
            if (detail) detail.style.display = detail.style.display === 'none' ? '' : 'none';
          }
          break;
      }
    });

    document.addEventListener('input', (e) => {
      if ((e.target as HTMLElement).id === 'aih-search') {
        this.render((e.target as HTMLInputElement).value);
      }
    });
  }

  render(searchQuery?: string): void {
    const container = document.getElementById('ai-history-content');
    if (!container) return;

    const records = searchQuery ? this.search(searchQuery) : this.getRecords();
    const sourceLabels: Record<string, string> = {
      'context-menu': '右键菜单', 'emergency': '应急命令', 'detection': '检测',
      'terminal': '终端', 'manual': '手动', 'command-explain': '命令解释',
    };

    container.innerHTML = `
      <div class="aih-toolbar">
        <input id="aih-search" class="aih-search" placeholder="搜索历史记录..." value="${this.esc(searchQuery || '')}" />
        <span class="aih-count">${records.length} 条</span>
        <button class="aih-btn" data-aih-action="export">导出全部</button>
        <button class="aih-btn danger" data-aih-action="clear">清空</button>
      </div>
      ${records.length === 0
        ? '<div class="aih-empty">暂无 AI 历史记录</div>'
        : `<div class="aih-list">${records.map(r => `
          <div class="aih-card">
            <div class="aih-card-header" data-aih-action="toggle" data-aih-param="${r.id}">
              <div class="aih-card-left">
                <span class="aih-source">${sourceLabels[r.source] || r.source}</span>
                <span class="aih-question">${this.esc(r.question.substring(0, 100))}</span>
              </div>
              <div class="aih-card-right">
                <span class="aih-time">${this.relativeTime(r.timestamp)}</span>
                <button class="aih-icon-btn" data-aih-action="copy-answer" data-aih-param="${r.id}" title="复制回答">C</button>
                <button class="aih-icon-btn danger" data-aih-action="delete" data-aih-param="${r.id}" title="删除">x</button>
              </div>
            </div>
            <div class="aih-detail" id="aih-detail-${r.id}" style="display:none;">
              <div class="aih-detail-q"><strong>Q:</strong> ${this.esc(r.question)}</div>
              <div class="aih-detail-a"><strong>A:</strong> ${this.esc(r.answer)}</div>
            </div>
          </div>
        `).join('')}</div>`}
    `;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private relativeTime(ts: number): string {
    const d = Date.now() - ts;
    if (d < 60000) return '刚刚';
    if (d < 3600000) return `${Math.floor(d / 60000)}分钟前`;
    if (d < 86400000) return `${Math.floor(d / 3600000)}小时前`;
    return `${Math.floor(d / 86400000)}天前`;
  }
}

export const aiHistoryManager = new AIHistoryManager();
