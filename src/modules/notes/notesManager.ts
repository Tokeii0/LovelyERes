/**
 * 笔记管理器 — 应急响应快速记录
 * 支持多条笔记、标签、搜索、导出、本地持久化
 */

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

const STORAGE_KEY = 'lovelyres-notes';

class NotesManager {
  private notes: NoteItem[] = [];
  private activeNoteId: string | null = null;
  private searchQuery = '';
  private initialized = false;
  private eventsBound = false;
  private dirty = false;
  private autoSaveTimer: number | null = null;

  initialize(): void {
    this.loadFromStorage();
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    this.render();
  }

  deactivate(): void {
    if (this.dirty) this.saveToStorage();
  }

  // ──── 持久化 ────

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.notes = JSON.parse(raw);
    } catch { this.notes = []; }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.notes));
      this.dirty = false;
    } catch (e) { console.warn('笔记保存失败:', e); }
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
    this.autoSaveTimer = window.setTimeout(() => this.saveToStorage(), 1000);
  }

  // ──── 事件 ────

  private bindEvents(): void {
    if (this.eventsBound) return;
    this.eventsBound = true;

    document.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-note-action]') as HTMLElement;
      if (!t) return;
      const action = t.getAttribute('data-note-action') || '';
      const param = t.getAttribute('data-note-param') || '';

      switch (action) {
        case 'new': this.createNote(); break;
        case 'select': this.selectNote(param); break;
        case 'delete': this.deleteNote(param); break;
        case 'pin': this.togglePin(param); break;
        case 'export': this.exportNotes(); break;
        case 'export-one': this.exportNote(param); break;
        case 'copy': this.copyNote(param); break;
        case 'tag-filter': this.filterByTag(param); break;
        case 'clear-search': this.searchQuery = ''; this.render(); break;
      }
    });

    document.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      if (target.id === 'note-editor-content') {
        this.updateContent((target as HTMLTextAreaElement).value);
      } else if (target.id === 'note-editor-title') {
        this.updateTitle((target as HTMLInputElement).value);
      } else if (target.id === 'note-search') {
        this.searchQuery = (target as HTMLInputElement).value;
        this.renderList();
      } else if (target.id === 'note-tags-input') {
        // tags on enter handled by keydown
      }
    });

    document.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).id === 'note-tags-input' && e.key === 'Enter') {
        e.preventDefault();
        const input = e.target as HTMLInputElement;
        const tag = input.value.trim();
        if (tag && this.activeNoteId) {
          const note = this.getNote(this.activeNoteId);
          if (note && !note.tags.includes(tag)) {
            note.tags.push(tag);
            note.updatedAt = Date.now();
            this.scheduleSave();
            this.renderEditor();
          }
          input.value = '';
        }
      }
    });
  }

  // ──── CRUD ────

  private createNote(): void {
    const note: NoteItem = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      title: `笔记 ${new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      content: '',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
    };
    this.notes.unshift(note);
    this.activeNoteId = note.id;
    this.scheduleSave();
    this.render();
    // 自动 focus 到标题
    setTimeout(() => (document.getElementById('note-editor-title') as HTMLInputElement)?.select(), 50);
  }

  private selectNote(id: string): void {
    this.activeNoteId = id;
    this.render();
  }

  private deleteNote(id: string): void {
    this.notes = this.notes.filter(n => n.id !== id);
    if (this.activeNoteId === id) {
      this.activeNoteId = this.notes[0]?.id || null;
    }
    this.scheduleSave();
    this.render();
  }

  private togglePin(id: string): void {
    const n = this.getNote(id);
    if (n) { n.pinned = !n.pinned; this.scheduleSave(); this.renderList(); }
  }

  private updateTitle(title: string): void {
    const n = this.activeNoteId ? this.getNote(this.activeNoteId) : null;
    if (n) { n.title = title; n.updatedAt = Date.now(); this.scheduleSave(); this.renderList(); }
  }

  private updateContent(content: string): void {
    const n = this.activeNoteId ? this.getNote(this.activeNoteId) : null;
    if (n) { n.content = content; n.updatedAt = Date.now(); this.scheduleSave(); }
  }

  private getNote(id: string): NoteItem | undefined {
    return this.notes.find(n => n.id === id);
  }

  private filterByTag(tag: string): void {
    this.searchQuery = `#${tag}`;
    const input = document.getElementById('note-search') as HTMLInputElement;
    if (input) input.value = this.searchQuery;
    this.renderList();
  }

  // ──── 导出 ────

  private exportNotes(): void {
    const text = this.notes.map(n =>
      `# ${n.title}\n时间: ${new Date(n.updatedAt).toLocaleString()}\n标签: ${n.tags.join(', ') || '无'}\n\n${n.content}\n\n---\n`
    ).join('\n');
    this.copyToClipboard(text);
    window.showNotification?.('已复制全部笔记到剪贴板', 'success');
  }

  private exportNote(id: string): void {
    const n = this.getNote(id);
    if (n) { this.copyToClipboard(n.content); window.showNotification?.('已复制笔记内容', 'success'); }
  }

  private copyNote(id: string): void {
    const n = this.getNote(id);
    if (n) { this.copyToClipboard(n.content); window.showNotification?.('已复制', 'success'); }
  }

  private copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    });
  }

  // ──── 渲染 ────

  render(): void {
    const container = document.getElementById('notes-content');
    if (!container) return;

    container.innerHTML = `
      <div class="notes-layout">
        <div class="notes-sidebar">
          <div class="notes-sidebar-header">
            <input id="note-search" class="notes-search" placeholder="搜索笔记..." value="${this.esc(this.searchQuery)}" />
            <button class="notes-new-btn" data-note-action="new" title="新建笔记">+</button>
          </div>
          <div id="notes-list" class="notes-list"></div>
          <div class="notes-sidebar-footer">
            <span>${this.notes.length} 条笔记</span>
            <button class="notes-export-btn" data-note-action="export" title="导出全部">导出全部</button>
          </div>
        </div>
        <div id="notes-editor" class="notes-editor"></div>
      </div>
    `;
    this.renderList();
    this.renderEditor();
  }

  private renderList(): void {
    const list = document.getElementById('notes-list');
    if (!list) return;

    let filtered = this.notes;
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      if (q.startsWith('#')) {
        const tag = q.slice(1);
        filtered = filtered.filter(n => n.tags.some(t => t.toLowerCase().includes(tag)));
      } else {
        filtered = filtered.filter(n =>
          n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
        );
      }
    }

    // 置顶的排前面
    filtered.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt - a.updatedAt;
    });

    if (filtered.length === 0) {
      list.innerHTML = `<div class="notes-empty-list">${this.searchQuery ? '无匹配结果' : '暂无笔记，点击 + 创建'}</div>`;
      return;
    }

    list.innerHTML = filtered.map(n => {
      const isActive = n.id === this.activeNoteId;
      const preview = n.content.replace(/\n/g, ' ').substring(0, 60) || '空笔记';
      const time = this.relativeTime(n.updatedAt);
      return `
        <div class="notes-item ${isActive ? 'active' : ''}" data-note-action="select" data-note-param="${n.id}">
          <div class="notes-item-header">
            <span class="notes-item-title">${n.pinned ? '[顶] ' : ''}${this.esc(n.title)}</span>
            <div class="notes-item-actions">
              <button class="notes-item-btn" data-note-action="pin" data-note-param="${n.id}" title="${n.pinned ? '取消置顶' : '置顶'}">${n.pinned ? '★' : '☆'}</button>
              <button class="notes-item-btn" data-note-action="copy" data-note-param="${n.id}" title="复制">复制</button>
              <button class="notes-item-btn danger" data-note-action="delete" data-note-param="${n.id}" title="删除">✕</button>
            </div>
          </div>
          <div class="notes-item-preview">${this.esc(preview)}</div>
          <div class="notes-item-meta">
            <span>${time}</span>
            ${n.tags.length > 0 ? n.tags.map(t => `<span class="notes-tag" data-note-action="tag-filter" data-note-param="${this.esc(t)}">${this.esc(t)}</span>`).join('') : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  private renderEditor(): void {
    const editor = document.getElementById('notes-editor');
    if (!editor) return;

    const note = this.activeNoteId ? this.getNote(this.activeNoteId) : null;
    if (!note) {
      editor.innerHTML = `<div class="notes-empty-editor">
        <div class="notes-empty-icon">NOTE</div>
        <p>选择或创建笔记开始记录</p>
        <button class="notes-new-btn large" data-note-action="new">+ 新建笔记</button>
      </div>`;
      return;
    }

    editor.innerHTML = `
      <div class="notes-editor-header">
        <input id="note-editor-title" class="notes-title-input" value="${this.esc(note.title)}" placeholder="笔记标题" />
        <div class="notes-editor-actions">
          <button class="notes-item-btn" data-note-action="export-one" data-note-param="${note.id}" title="复制内容">复制</button>
        </div>
      </div>
      <div class="notes-tags-bar">
        ${note.tags.map(t => `<span class="notes-tag removable">${this.esc(t)}<button data-note-action="remove-tag" data-note-param="${this.esc(t)}">×</button></span>`).join('')}
        <input id="note-tags-input" class="notes-tag-input" placeholder="添加标签 (回车确认)" />
      </div>
      <textarea id="note-editor-content" class="notes-textarea" placeholder="开始记录...">${this.esc(note.content)}</textarea>
      <div class="notes-editor-footer">
        <span>创建于 ${new Date(note.createdAt).toLocaleString()}</span>
        <span>更新于 ${new Date(note.updatedAt).toLocaleString()}</span>
      </div>
    `;
  }

  // ──── 工具 ────

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private relativeTime(ts: number): string {
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    return `${Math.floor(diff / 86400000)} 天前`;
  }
}

export const notesManager = new NotesManager();
