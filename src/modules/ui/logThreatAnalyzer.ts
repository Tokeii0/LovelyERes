/**
 * 日志威胁分析面板渲染器
 * 渲染统计卡片、Top IP/用户排行、24小时时间线分布
 */

interface ThreatSummary {
  brute_force_count: number;
  successful_login_count: number;
  privilege_escalation_count: number;
  suspicious_activity_count: number;
  top_source_ips: IpCount[];
  top_target_users: UserCount[];
  hourly_distribution: number[];
  threat_level: string;
}

interface IpCount {
  ip: string;
  count: number;
  last_seen: string;
  action_type: string;
}

interface UserCount {
  username: string;
  count: number;
  success_count: number;
  fail_count: number;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const LEVEL_COLORS: Record<string, string> = {
  critical: 'var(--error-color)',
  high: '#f97316',
  medium: 'var(--warning-color)',
  low: 'var(--info-color)',
  none: 'var(--success-color)',
};

const LEVEL_LABELS: Record<string, string> = {
  critical: '严重', high: '高危', medium: '中危', low: '低危', none: '安全',
};

export function renderThreatPanel(summary: ThreatSummary | null, collapsed: boolean): string {
  if (!summary) {
    return `<div class="threat-panel" id="threat-panel">
      <div class="threat-panel-header" onclick="window.toggleThreatPanel()">
        <span class="threat-panel-title">威胁分析</span>
        <span class="threat-panel-hint">点击「分析」按钮开始</span>
      </div>
    </div>`;
  }

  const level = summary.threat_level;
  const color = LEVEL_COLORS[level] || LEVEL_COLORS.none;
  const label = LEVEL_LABELS[level] || '未知';

  return `
    <div class="threat-panel ${collapsed ? 'collapsed' : ''}" id="threat-panel">
      <div class="threat-panel-header" onclick="window.toggleThreatPanel()">
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="threat-level-badge" style="background:${color};">${label}</span>
          <span class="threat-panel-title">威胁分析</span>
          <span class="threat-panel-stats">
            暴力破解 ${summary.brute_force_count} · 成功登录 ${summary.successful_login_count} · 提权 ${summary.privilege_escalation_count} · 可疑 ${summary.suspicious_activity_count}
          </span>
        </div>
        <span class="threat-panel-toggle">${collapsed ? '▸' : '▾'}</span>
      </div>
      ${collapsed ? '' : renderThreatBody(summary)}
    </div>
  `;
}

function renderThreatBody(s: ThreatSummary): string {
  return `
    <div class="threat-panel-body">
      <div class="threat-cards">
        ${renderCard('暴力破解', s.brute_force_count, 'var(--error-color)', 'Failed password / auth failure')}
        ${renderCard('成功登录', s.successful_login_count, 'var(--success-color)', 'Accepted password / publickey')}
        ${renderCard('提权行为', s.privilege_escalation_count, '#f97316', 'sudo / su / COMMAND=')}
        ${renderCard('可疑活动', s.suspicious_activity_count, 'var(--warning-color)', '后门/反弹shell/提权关键词')}
      </div>
      <div class="threat-details">
        <div class="threat-col">
          <div class="threat-col-title">Top 攻击源 IP</div>
          ${s.top_source_ips.length === 0 ? '<div class="threat-empty">无数据</div>' :
            s.top_source_ips.slice(0, 8).map((ip, i) => `
              <div class="threat-rank-item">
                <span class="rank-num">${i + 1}</span>
                <span class="rank-ip" title="${escapeHtml(ip.last_seen)}">${escapeHtml(ip.ip)}</span>
                <span class="rank-bar"><span style="width:${barWidth(ip.count, s.top_source_ips[0]?.count)}%;background:${ip.action_type === 'failed_login' ? 'var(--error-color)' : 'var(--info-color)'}"></span></span>
                <span class="rank-count">${ip.count}</span>
              </div>
            `).join('')}
        </div>
        <div class="threat-col">
          <div class="threat-col-title">Top 目标用户</div>
          ${s.top_target_users.length === 0 ? '<div class="threat-empty">无数据</div>' :
            s.top_target_users.slice(0, 8).map((u, i) => `
              <div class="threat-rank-item">
                <span class="rank-num">${i + 1}</span>
                <span class="rank-user">${escapeHtml(u.username)}</span>
                <span class="rank-bar"><span style="width:${barWidth(u.count, s.top_target_users[0]?.count)}%;background:var(--warning-color)"></span></span>
                <span class="rank-count" title="成功${u.success_count} 失败${u.fail_count}">${u.count}</span>
              </div>
            `).join('')}
        </div>
        <div class="threat-col">
          <div class="threat-col-title">24h 时间分布</div>
          <div class="threat-timeline">
            ${s.hourly_distribution.map((v, h) => {
              const max = Math.max(...s.hourly_distribution, 1);
              const pct = Math.round((v / max) * 100);
              return `<div class="timeline-bar" title="${h}:00 — ${v}条">
                <div class="timeline-fill" style="height:${pct}%;${v > max * 0.7 ? 'background:var(--error-color)' : ''}"></div>
                <span class="timeline-label">${h % 6 === 0 ? h : ''}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderCard(title: string, count: number, color: string, desc: string): string {
  return `
    <div class="threat-card">
      <div class="threat-card-count" style="color:${color}">${count}</div>
      <div class="threat-card-title">${title}</div>
      <div class="threat-card-desc">${desc}</div>
    </div>
  `;
}

function barWidth(value: number, max: number): number {
  if (!max) return 0;
  return Math.round((value / max) * 100);
}

// ==================== IOC 搜索结果渲染 ====================

interface IocMatch {
  indicator: string;
  log_file: string;
  count: number;
  sample_lines: string[];
}

interface IocSearchResult {
  results: IocMatch[];
  total_matches: number;
}

export function renderIocResults(result: IocSearchResult | null): string {
  if (!result || result.results.length === 0) {
    return '';
  }

  return `
    <div class="ioc-results" id="ioc-results">
      <div class="ioc-results-header">
        <span>IOC 搜索结果 — 共 ${result.total_matches} 处匹配</span>
        <button class="modern-btn secondary sm" onclick="document.getElementById('ioc-results')?.remove()">关闭</button>
      </div>
      <div class="ioc-results-body">
        ${result.results.map(m => `
          <div class="ioc-match">
            <div class="ioc-match-header">
              <span class="ioc-indicator">${escapeHtml(m.indicator)}</span>
              <span class="ioc-file">${escapeHtml(m.log_file)}</span>
              <span class="ioc-count">${m.count} 次</span>
            </div>
            ${m.sample_lines.length > 0 ? `
              <div class="ioc-samples">
                ${m.sample_lines.map(l => `<div class="ioc-sample-line">${escapeHtml(l)}</div>`).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    </div>
  `;
}
