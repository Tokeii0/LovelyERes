/**
 * 安全速查管理器 — 漏洞修复代码片段浏览/搜索/复制
 */

import { ALL_SNIPPETS, LANGUAGES, type SecFixSnippet } from './secfixData';

class SecfixManager {
  private currentLang = 'all';
  private searchQuery = '';
  private expandedId: string | null = null;
  private initialized = false;
  private eventsBound = false;

  initialize(): void {
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    this.render();
  }

  deactivate(): void { /* 无状态需清理 */ }

  private bindEvents(): void {
    if (this.eventsBound) return;
    this.eventsBound = true;

    document.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-sf-action]') as HTMLElement;
      if (!t) return;
      const action = t.getAttribute('data-sf-action') || '';
      const param = t.getAttribute('data-sf-param') || '';

      switch (action) {
        case 'lang':
          this.currentLang = param;
          this.renderContent();
          // 更新激活状态
          document.querySelectorAll('.sf-lang-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-sf-param') === param));
          break;
        case 'toggle':
          this.expandedId = this.expandedId === param ? null : param;
          this.renderContent();
          break;
        case 'copy-fix':
          this.copySnippet(param, 'fix');
          break;
        case 'copy-oneliner':
          this.copySnippet(param, 'oneliner');
          break;
        case 'copy-bad':
          this.copySnippet(param, 'bad');
          break;
        case 'copy-find':
          this.copySnippet(param, 'oneliner');
          break;
      }
    });

    document.addEventListener('input', (e) => {
      if ((e.target as HTMLElement).id === 'sf-search') {
        this.searchQuery = (e.target as HTMLInputElement).value;
        this.renderContent();
      }
    });
  }

  private copySnippet(id: string, field: 'fix' | 'oneliner' | 'bad'): void {
    const s = ALL_SNIPPETS.find(x => x.id === id);
    if (!s) return;
    const text = field === 'fix' ? s.fix : field === 'oneliner' ? (s.oneliner || '') : (s.bad || '');
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    });
    window.showNotification?.('已复制到剪贴板', 'success');
  }

  private getFiltered(): SecFixSnippet[] {
    let list = ALL_SNIPPETS;
    if (this.currentLang !== 'all') {
      list = list.filter(s => s.lang === this.currentLang);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.vuln.toLowerCase().includes(q) ||
        s.desc.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q)) ||
        s.fix.toLowerCase().includes(q)
      );
    }
    return list;
  }

  render(): void {
    const container = document.getElementById('secfix-content');
    if (!container) return;

    container.innerHTML = `
      <div class="sf-toolbar">
        <div class="sf-lang-bar">
          ${LANGUAGES.map(l => `<button class="sf-lang-btn ${this.currentLang === l.key ? 'active' : ''}" data-sf-action="lang" data-sf-param="${l.key}">${l.label}</button>`).join('')}
        </div>
        <input id="sf-search" class="sf-search" placeholder="搜索漏洞类型、关键字..." value="${this.esc(this.searchQuery)}" />
      </div>
      <div id="sf-list" class="sf-list"></div>
    `;
    this.renderContent();
  }

  private renderContent(): void {
    const list = document.getElementById('sf-list');
    if (!list) return;

    const filtered = this.getFiltered();
    if (filtered.length === 0) {
      list.innerHTML = '<div class="sf-empty">未找到匹配的修复代码</div>';
      return;
    }

    // 按漏洞类型分组
    const groups = new Map<string, SecFixSnippet[]>();
    filtered.forEach(s => {
      const key = `${s.lang} — ${s.vuln}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    });

    let html = '';
    groups.forEach((items, groupName) => {
      html += `<div class="sf-group"><div class="sf-group-title">${this.esc(groupName)}</div>`;
      items.forEach(s => {
        const expanded = this.expandedId === s.id;
        html += `
          <div class="sf-card ${expanded ? 'expanded' : ''}">
            <div class="sf-card-header" data-sf-action="toggle" data-sf-param="${s.id}">
              <div class="sf-card-left">
                <span class="sf-card-lang">${s.lang}</span>
                <span class="sf-card-title">${this.esc(s.title)}</span>
              </div>
              <div class="sf-card-right">
                ${s.oneliner ? `<button class="sf-copy-btn highlight" data-sf-action="copy-oneliner" data-sf-param="${s.id}" title="复制一键修复命令">一键命令</button>` : ''}
                <button class="sf-copy-btn" data-sf-action="copy-fix" data-sf-param="${s.id}" title="复制修复代码">复制修复</button>
                <span class="sf-expand-icon">${expanded ? '▼' : '▶'}</span>
              </div>
            </div>
            ${expanded ? this.renderExpanded(s) : `<div class="sf-card-desc">${this.esc(s.desc)}</div>`}
          </div>
        `;
      });
      html += `</div>`;
    });

    list.innerHTML = html;
  }

  private renderExpanded(s: SecFixSnippet): string {
    return `
      <div class="sf-expanded">
        <p class="sf-desc">${this.esc(s.desc)}</p>
        ${s.bad ? `
          <div class="sf-code-section">
            <div class="sf-code-label">
              <span>[ BAD ] 漏洞代码</span>
              <button class="sf-copy-btn small" data-sf-action="copy-bad" data-sf-param="${s.id}">复制</button>
            </div>
            <pre class="sf-code bad">${this.esc(s.bad)}</pre>
          </div>
        ` : ''}
        <div class="sf-code-section">
          <div class="sf-code-label">
            <span>[ FIX ] 修复代码</span>
            <button class="sf-copy-btn small" data-sf-action="copy-fix" data-sf-param="${s.id}">复制</button>
          </div>
          <pre class="sf-code fix">${this.esc(s.fix)}</pre>
        </div>
        ${s.oneliner ? `
          <div class="sf-code-section">
            <div class="sf-code-label">
              <span>[ CMD ] 一键修复 / 查找命令</span>
              <button class="sf-copy-btn small highlight" data-sf-action="copy-oneliner" data-sf-param="${s.id}">复制</button>
            </div>
            <pre class="sf-code oneliner">${this.esc(s.oneliner)}</pre>
          </div>
        ` : ''}
        <div class="sf-tags">${s.tags.map(t => `<span class="sf-tag">${this.esc(t)}</span>`).join('')}</div>
      </div>
    `;
  }

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

export const secfixManager = new SecfixManager();
