/**
 * 日志审计页面渲染器 — 重新设计
 * 采用 Header + Tabs + Content 布局，对齐 Docker 页面风格
 */

import {
  Log, FileText, Refresh, Search,
  Calendar, Left, Right, Shield, LinkCloud, Export,
  SettingConfig,
} from '@icon-park/svg';

const icon = (fn: any, size = '16', theme = 'outline') =>
  fn({ theme, size, fill: 'currentColor' });

type LogTab = 'viewer' | 'threat' | 'ioc' | 'rules';

export class LogAnalysisRenderer {
  private currentLogPath: string = '/var/log/auth.log';
  private currentLines: number = 100;
  private currentFilter: string = '';
  private useJournalctl: boolean = false;
  private journalUnit: string = '';
  private currentPage: number = 1;
  private currentDate: string = '';
  private currentTab: LogTab = 'viewer';

  render(): string {
    return `
      <div class="la-page">
        ${this.renderHeader()}
        <div class="la-tabs" id="la-tabs-area">${this.renderTabs()}</div>
        <div class="la-content" id="la-content-area">
          ${this.renderCurrentTab()}
        </div>
      </div>
    `;
  }

  // ==================== Header ====================

  private renderHeader(): string {
    const today = new Date().toISOString().split('T')[0];

    return `
      <div class="la-header">
        <div class="la-header-left">
          <div class="la-header-icon">${icon(Log, '22', 'filled')}</div>
          <div>
            <h2 class="la-header-title">日志审计</h2>
            <div class="la-header-subtitle">应急响应 · 威胁分析 · 取证溯源</div>
          </div>
        </div>
        <div class="la-header-right">
          ${!this.useJournalctl ? this.renderFileSelector() : this.renderJournalInput()}

          <div class="la-source-toggle">
            <button class="la-toggle-btn ${!this.useJournalctl ? 'active' : ''}"
                    onclick="window.switchLogSource('file')">
              ${icon(FileText, '14')} 文件
            </button>
            <button class="la-toggle-btn ${this.useJournalctl ? 'active' : ''}"
                    onclick="window.switchLogSource('journalctl')">
              Journal
            </button>
          </div>

          <div class="la-search-box">
            ${icon(Search, '14')}
            <input type="text" class="la-search-input" id="log-filter-input"
              placeholder="搜索关键词..." value="${this.currentFilter}"
              onchange="window.updateLogFilter(this.value)" />
          </div>

          <div class="la-date-box">
            ${icon(Calendar, '14')}
            <input type="date" class="la-date-input" id="log-date-input"
              value="${this.currentDate}" max="${today}"
              onchange="window.updateLogDate(this.value)" />
          </div>

          <button class="modern-btn primary icon-only" onclick="window.refreshLogAnalysis()" title="刷新">
            ${icon(Refresh)}
          </button>
        </div>
      </div>
    `;
  }

  // ==================== Tabs ====================

  private renderTabs(): string {
    const tabs: { id: LogTab; label: string; iconFn: any }[] = [
      { id: 'viewer', label: '日志查看', iconFn: Log },
      { id: 'threat', label: '威胁分析', iconFn: Shield },
      { id: 'ioc', label: 'IOC 搜索', iconFn: Search },
      { id: 'rules', label: '规则 & 导出', iconFn: SettingConfig },
    ];

    return tabs.map(tab => `
      <button class="la-tab-btn ${this.currentTab === tab.id ? 'active' : ''}"
              data-la-action="switch-tab" data-tab="${tab.id}">
        ${icon(tab.iconFn, '16', this.currentTab === tab.id ? 'filled' : 'outline')}
        ${tab.label}
      </button>
    `).join('');
  }

  renderCurrentTab(): string {
    switch (this.currentTab) {
      case 'viewer': return this.renderViewerTab();
      case 'threat': return this.renderThreatTab();
      case 'ioc': return this.renderIocTab();
      case 'rules': return this.renderRulesTab();
      default: return this.renderViewerTab();
    }
  }

  // ==================== Tab: 日志查看 ====================

  private renderViewerTab(): string {
    return `
      <div class="la-viewer">
        <div class="la-stats-bar">
          <div class="la-stat">
            <span class="la-stat-label">来源</span>
            <span class="la-stat-value mono" id="current-source">-</span>
          </div>
          <div class="la-stat-divider"></div>
          <div class="la-stat">
            <span class="la-stat-label">总计</span>
            <span class="la-stat-value" id="total-logs">0</span>
          </div>
          <div class="la-stat-divider"></div>
          <div class="la-stat">
            <span class="la-stat-label">告警</span>
            <span class="la-stat-value" id="highlighted-logs" style="color:var(--warning-color)">0</span>
          </div>
          <div style="flex:1"></div>
          ${this.renderPaginationInline()}
        </div>
        <div class="la-log-viewer" id="log-container">
          <div class="la-loading"><div class="spinner"></div><p>正在获取日志数据...</p></div>
        </div>
      </div>
    `;
  }

  private renderPaginationInline(): string {
    return `
      <div class="la-pagination">
        <select class="la-mini-select" id="log-lines-select"
          onchange="window.updateLogLines(this.value)">
          <option value="50">50</option>
          <option value="100" ${this.currentLines === 100 ? 'selected' : ''}>100</option>
          <option value="200">200</option>
          <option value="500">500</option>
          <option value="1000">1000</option>
        </select>
        <button class="la-page-btn" onclick="window.changeLogPage(-1)"
          ${this.currentPage <= 1 ? 'disabled' : ''} title="上一页">
          ${icon(Left, '14')}
        </button>
        <span class="la-page-num page-display">第 ${this.currentPage} 页</span>
        <button class="la-page-btn" onclick="window.changeLogPage(1)" title="下一页">
          ${icon(Right, '14')}
        </button>
      </div>
    `;
  }

  // ==================== Tab: 威胁分析 ====================

  private renderThreatTab(): string {
    return `
      <div class="la-threat-tab">
        <div class="la-action-bar">
          <p class="la-action-hint">分析最近 2000 条日志记录，提取攻击指标</p>
          <div class="la-action-buttons">
            <button class="modern-btn primary" onclick="window.runThreatAnalysis()">
              ${icon(Shield)} 开始分析
            </button>
            <button class="modern-btn secondary" onclick="window.runMultiLogAnalysis()">
              ${icon(LinkCloud)} 多源关联分析
            </button>
          </div>
        </div>
        <div id="threat-panel-container"></div>
        <div id="la-multi-log-container"></div>
      </div>
    `;
  }

  // ==================== Tab: IOC 搜索 ====================

  private renderIocTab(): string {
    return `
      <div class="la-ioc-tab">
        <div class="la-ioc-input-area">
          <div class="la-ioc-left">
            <h3 class="la-section-title">IOC 批量搜索</h3>
            <p class="la-section-desc">输入 IP / 域名 / 哈希值，每行一个或逗号分隔，将在 auth.log / syslog / secure / messages / audit.log 中搜索</p>
            <textarea id="ioc-input" class="la-ioc-textarea" rows="8"
              placeholder="192.168.1.100&#10;10.0.0.5&#10;evil.example.com&#10;e99a18c428cb38d5f260853678922e03"></textarea>
            <button class="modern-btn primary" onclick="window.executeIocSearch()" style="margin-top:8px">
              ${icon(Search)} 搜索
            </button>
          </div>
          <div class="la-ioc-right" id="ioc-results-container">
            <div class="la-empty-hint">搜索结果将显示在这里</div>
          </div>
        </div>
      </div>
    `;
  }

  // ==================== Tab: 规则 & 导出 ====================

  private renderRulesTab(): string {
    return `
      <div class="la-rules-tab">
        <div class="la-rules-section">
          <h3 class="la-section-title">自定义匹配规则</h3>
          <p class="la-section-desc">定义正则规则，匹配的日志行将在查看器中标记 [R] 徽章</p>
          <div id="custom-rules-list" class="la-rules-list"></div>
          <div class="la-rule-add">
            <input id="rule-name" placeholder="规则名称" class="la-rule-input" />
            <input id="rule-regex" placeholder="正则表达式（如 eval\\(|base64_decode）" class="la-rule-input" style="flex:2" />
            <select id="rule-severity" class="la-mini-select">
              <option value="critical">严重</option>
              <option value="high">高危</option>
              <option value="medium" selected>中危</option>
              <option value="low">低危</option>
            </select>
            <button class="modern-btn primary sm" onclick="window.addCustomRule()">添加</button>
          </div>
        </div>

        <div class="la-export-section">
          <h3 class="la-section-title">导出报告</h3>
          <p class="la-section-desc">导出当前日志和威胁分析结果为 HTML 报告</p>
          <button class="modern-btn secondary" onclick="window.exportLogReport()">
            ${icon(Export)} 导出 HTML 报告
          </button>
        </div>
      </div>
    `;
  }

  // ==================== 日志源选择器 ====================

  private renderFileSelector(): string {
    return `
      <select class="la-source-select" id="log-file-select"
        onchange="window.updateLogPath(this.value)">
        <optgroup label="系统日志">
          <option value="/var/log/auth.log" ${this.currentLogPath === '/var/log/auth.log' ? 'selected' : ''}>auth.log</option>
          <option value="/var/log/secure">secure</option>
          <option value="/var/log/syslog">syslog</option>
          <option value="/var/log/messages">messages</option>
          <option value="/var/log/kern.log">kern.log</option>
          <option value="/var/log/cron">cron</option>
          <option value="/var/log/audit/audit.log">audit.log</option>
          <option value="/var/log/boot.log">boot.log</option>
        </optgroup>
        <optgroup label="Docker 容器">
          <option value="docker:all">所有容器</option>
        </optgroup>
      </select>
    `;
  }

  private renderJournalInput(): string {
    return `
      <input type="text" class="la-source-select" id="journal-unit-input"
        list="journal-units" placeholder="服务单元 (sshd)"
        value="${this.journalUnit}" onchange="window.updateJournalUnit(this.value)" />
      <datalist id="journal-units">
        <option value="sshd"><option value="nginx"><option value="docker">
        <option value="cron"><option value="firewalld"><option value="mysqld">
      </datalist>
    `;
  }

  // ==================== Setters ====================

  setLogPath(path: string): void { this.currentLogPath = path; }
  setLines(lines: number): void { this.currentLines = lines; }
  setFilter(filter: string): void { this.currentFilter = filter; }
  setUseJournalctl(use: boolean): void { this.useJournalctl = use; }
  setJournalUnit(unit: string): void { this.journalUnit = unit; }
  setTab(tab: string): void {
    this.currentTab = tab as LogTab;
    // Re-render tabs + content
    const tabsArea = document.getElementById('la-tabs-area');
    if (tabsArea) tabsArea.innerHTML = this.renderTabs();
    const contentArea = document.getElementById('la-content-area');
    if (contentArea) contentArea.innerHTML = this.renderCurrentTab();
  }
}
