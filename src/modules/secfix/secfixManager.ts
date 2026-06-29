/**
 * 安全速查管理器 — 漏洞修复代码片段浏览/搜索/复制
 */

import { ALL_SNIPPETS, LANGUAGES, type SecFixSnippet } from './secfixData';

const FAV_STORAGE_KEY = 'lovelyres-secfix-favorites';

class SecfixManager {
  private currentLang = 'all';
  private searchQuery = '';
  private expandedId: string | null = null;
  private initialized = false;
  private eventsBound = false;
  private favorites = new Set<string>();
  /** 仅显示收藏 */
  private favOnly = false;

  initialize(): void {
    if (!this.initialized) {
      this.loadFavorites();
      this.bindEvents();
      this.initialized = true;
    }
    this.render();
  }

  deactivate(): void { /* 无状态需清理 */ }

  // ─── 收藏持久化 ───

  private loadFavorites(): void {
    try {
      const raw = localStorage.getItem(FAV_STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) this.favorites = new Set(arr);
      }
    } catch { /* 隐私模式或 JSON 破损, 忽略 */ }
  }

  private saveFavorites(): void {
    try {
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify([...this.favorites]));
    } catch { /* ignore */ }
  }

  private toggleFavorite(id: string): void {
    if (this.favorites.has(id)) this.favorites.delete(id);
    else this.favorites.add(id);
    this.saveFavorites();
    this.renderContent();
  }

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
        case 'copy-verify':
          this.copySnippet(param, 'verify');
          break;
        case 'copy-find':
          this.copySnippet(param, 'oneliner');
          break;
        case 'toggle-fav': {
          // 阻止触发卡片展开
          e.stopPropagation();
          this.toggleFavorite(param);
          break;
        }
        case 'toggle-fav-only':
          this.favOnly = !this.favOnly;
          this.render();
          break;
        case 'export-oneliners':
          this.exportOneliners();
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

  private copyText(text: string, notice: string): void {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    });
    window.showNotification?.(notice, 'success');
  }

  private copySnippet(id: string, field: 'fix' | 'oneliner' | 'bad' | 'verify'): void {
    const s = ALL_SNIPPETS.find(x => x.id === id);
    if (!s) return;
    const text = field === 'fix' ? s.fix
               : field === 'oneliner' ? (s.oneliner || '')
               : field === 'verify' ? (s.verify || '')
               : (s.bad || '');
    if (!text) {
      window.showNotification?.('该条目无对应内容', 'warning');
      return;
    }
    this.copyText(text, '已复制到剪贴板');
  }

  /** 导出当前筛选列表中所有 oneliner 到剪贴板, 便于批量贴到终端 */
  private exportOneliners(): void {
    const list = this.getFiltered();
    const lines: string[] = [];
    lines.push(`# === LovelyRes SecFix Oneliners ===`);
    lines.push(`# 筛选: lang=${this.currentLang} query="${this.searchQuery}" favOnly=${this.favOnly}`);
    lines.push(`# 导出时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push(`# 共 ${list.filter(s => s.oneliner).length} 条 oneliner`);
    lines.push('');
    for (const s of list) {
      if (!s.oneliner) continue;
      lines.push(`# ---- ${s.lang} / ${s.title}${s.cve ? ' ('+s.cve+')' : ''} ----`);
      lines.push(s.oneliner);
      lines.push('');
    }
    const text = lines.join('\n');
    this.copyText(text, `已导出 ${list.filter(s => s.oneliner).length} 条 oneliner`);
  }

  private getFiltered(): SecFixSnippet[] {
    let list = ALL_SNIPPETS;
    if (this.favOnly) {
      list = list.filter(s => this.favorites.has(s.id));
    }
    if (this.currentLang !== 'all') {
      list = list.filter(s => s.lang === this.currentLang);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.vuln.toLowerCase().includes(q) ||
        s.desc.toLowerCase().includes(q) ||
        (s.cve?.toLowerCase().includes(q) ?? false) ||
        (s.affected?.toLowerCase().includes(q) ?? false) ||
        s.tags.some(t => t.toLowerCase().includes(q)) ||
        s.fix.toLowerCase().includes(q)
      );
    }
    // 已收藏的置顶
    list = [...list].sort((a, b) => {
      const fa = this.favorites.has(a.id) ? 1 : 0;
      const fb = this.favorites.has(b.id) ? 1 : 0;
      return fb - fa;
    });
    return list;
  }

  render(): void {
    const container = document.getElementById('secfix-content');
    if (!container) return;

    const favCount = this.favorites.size;

    container.innerHTML = `
      <div class="sf-toolbar">
        <div class="sf-lang-bar">
          ${LANGUAGES.map(l => `<button class="sf-lang-btn ${this.currentLang === l.key ? 'active' : ''}" data-sf-action="lang" data-sf-param="${l.key}">${l.label}</button>`).join('')}
        </div>
        <div class="sf-toolbar-right">
          <button class="sf-lang-btn ${this.favOnly ? 'active' : ''}" data-sf-action="toggle-fav-only" title="仅显示收藏">
            ★ 收藏${favCount ? ` (${favCount})` : ''}
          </button>
          <button class="sf-lang-btn" data-sf-action="export-oneliners" title="导出当前筛选的所有 oneliner 到剪贴板">
            📋 导出全部 oneliner
          </button>
          <input id="sf-search" class="sf-search" placeholder="搜索漏洞/CVE/中间件..." value="${this.esc(this.searchQuery)}" />
        </div>
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
        const isFav = this.favorites.has(s.id);
        const cveTag = s.cve ? `<span class="sf-cve-chip">${this.esc(s.cve.split(',')[0].trim())}</span>` : '';
        html += `
          <div class="sf-card ${expanded ? 'expanded' : ''} ${isFav ? 'favorited' : ''}">
            <div class="sf-card-header" data-sf-action="toggle" data-sf-param="${s.id}">
              <div class="sf-card-left">
                <button class="sf-fav-btn ${isFav ? 'on' : ''}" data-sf-action="toggle-fav" data-sf-param="${s.id}" title="${isFav ? '取消收藏' : '收藏置顶'}">${isFav ? '★' : '☆'}</button>
                <span class="sf-card-lang">${s.lang}</span>
                <span class="sf-card-title">${this.esc(s.title)}</span>
                ${cveTag}
              </div>
              <div class="sf-card-right">
                ${s.oneliner ? `<button class="sf-copy-btn highlight" data-sf-action="copy-oneliner" data-sf-param="${s.id}" title="复制一键修复命令">一键命令</button>` : ''}
                ${s.verify ? `<button class="sf-copy-btn" data-sf-action="copy-verify" data-sf-param="${s.id}" title="复制验证命令">验证</button>` : ''}
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
    const metaBits: string[] = [];
    if (s.cve) metaBits.push(`<div class="sf-meta-row"><span class="sf-meta-label">CVE</span><span class="sf-meta-val">${this.esc(s.cve)}</span></div>`);
    if (s.affected) metaBits.push(`<div class="sf-meta-row"><span class="sf-meta-label">受影响</span><span class="sf-meta-val">${this.esc(s.affected)}</span></div>`);
    const meta = metaBits.length ? `<div class="sf-meta">${metaBits.join('')}</div>` : '';

    return `
      <div class="sf-expanded">
        ${meta}
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
        ${s.verify ? `
          <div class="sf-code-section">
            <div class="sf-code-label">
              <span>[ VERIFY ] 修复后验证</span>
              <button class="sf-copy-btn small" data-sf-action="copy-verify" data-sf-param="${s.id}">复制</button>
            </div>
            <pre class="sf-code verify">${this.esc(s.verify)}</pre>
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
