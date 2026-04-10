/**
 * 日志审计管理器 — 应急响应增强版
 * 管理：日志加载、威胁分析、IOC搜索、多日志关联、自定义规则、导出
 */

import { invoke } from "@tauri-apps/api/core";
import { renderThreatPanel, renderIocResults } from './logThreatAnalyzer';

// ==================== 类型 ====================

interface LogEntry {
  timestamp: string;
  level: string;
  service: string;
  message: string;
  raw: string;
  highlighted: boolean;
  source?: string;
}

interface ThreatSummary {
  brute_force_count: number;
  successful_login_count: number;
  privilege_escalation_count: number;
  suspicious_activity_count: number;
  top_source_ips: any[];
  top_target_users: any[];
  hourly_distribution: number[];
  threat_level: string;
}

interface LogAnalysisResult {
  entries: LogEntry[];
  total_count: number;
  highlighted_count: number;
  file_info: any;
  threat_summary?: ThreatSummary;
}

interface CustomRule {
  name: string;
  regex: string;
  severity: string;
}

// ==================== 工具函数 ====================

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function getLevelClass(level: string): string {
  const u = level.toUpperCase();
  if (u.includes('ERROR') || u.includes('FAIL')) return 'level-error';
  if (u.includes('WARN')) return 'level-warn';
  if (u.includes('DEBUG')) return 'level-debug';
  return 'level-info';
}

// ==================== 状态 ====================

let threatPanelCollapsed = false;
let lastThreatSummary: ThreatSummary | null = null;
let customRules: CustomRule[] = [];

function loadCustomRules(): void {
  try {
    const saved = localStorage.getItem('log-custom-rules');
    if (saved) customRules = JSON.parse(saved);
  } catch { /* ignore */ }
}

function saveCustomRules(): void {
  localStorage.setItem('log-custom-rules', JSON.stringify(customRules));
}

// ==================== 日志条目渲染 ====================

function renderLogEntries(entries: LogEntry[]): string {
  return `<div class="log-entries">
    ${entries.map(entry => {
      const levelClass = getLevelClass(entry.level);
      const highlightClass = entry.highlighted ? 'highlighted' : '';
      const ruleMatch = matchCustomRules(entry.raw);
      const ruleClass = ruleMatch ? 'custom-rule-match' : '';
      let displayTime = entry.timestamp || '-';
      if (displayTime.length > 19) displayTime = displayTime.substring(0, 19);
      const cleanMessage = (entry.message || '').trim();
      const sourceTag = entry.source ? `<span class="log-source-tag">${escapeHtml(entry.source.split('/').pop() || '')}</span>` : '';

      return `
        <div class="log-entry ${levelClass} ${highlightClass} ${ruleClass}">
          <div class="log-timestamp" title="${escapeHtml(entry.timestamp)}">${displayTime}</div>
          <div class="log-level ${levelClass}">${entry.level}</div>
          ${sourceTag}
          <div class="log-message">${entry.highlighted ? '<span class="log-marker">!</span>' : ''}${ruleMatch ? `<span class="rule-badge" title="${escapeHtml(ruleMatch)}">[R]</span>` : ''}${escapeHtml(cleanMessage)}</div>
        </div>`;
    }).join('')}
  </div>`;
}

function matchCustomRules(raw: string): string | null {
  for (const rule of customRules) {
    try {
      if (new RegExp(rule.regex, 'i').test(raw)) return rule.name;
    } catch { /* invalid regex */ }
  }
  return null;
}

// ==================== 核心刷新 ====================

async function refreshLogAnalysis(): Promise<void> {
  loadLogFileList();

  try {
    const logContainer = document.getElementById('log-container');
    if (!logContainer) return;
    logContainer.innerHTML = `<div class="loading-placeholder"><div class="spinner"></div><p>加载日志中...</p></div>`;

    const state = (window as any).logAnalysisState || {};
    const useJournalctl = state.useJournalctl || false;
    const logPath = state.logPath || '/var/log/auth.log';
    const pageSize = parseInt(state.lines || '100');
    const page = state.page || 1;
    const filter = state.filter || '';
    const journalUnit = state.journalUnit || '';
    const dateFilter = state.date || '';

    let result: LogAnalysisResult;

    if (useJournalctl) {
      result = await invoke('read_journalctl_log', {
        page, pageSize,
        unit: journalUnit || null,
        filter: filter || null,
        since: dateFilter ? `${dateFilter} 00:00:00` : null,
        until: dateFilter ? `${dateFilter} 23:59:59` : null,
        withAnalysis: false,
      });
      const el = document.getElementById('current-source');
      if (el) el.textContent = `journalctl${journalUnit ? ` -u ${journalUnit}` : ''}`;
    } else if (logPath.startsWith('docker:')) {
      const containerId = logPath.replace('docker:', '');
      const logs = await invoke('docker_container_logs', {
        containerId, tail: pageSize.toString()
      }) as string;

      const entries = logs.split('\n').filter(l => l.trim()).map(line => ({
        timestamp: '', level: 'INFO', service: `docker:${containerId.substring(0, 8)}`,
        message: line, raw: line, highlighted: false,
      }));
      const filtered = filter ? entries.filter(e => e.message.toLowerCase().includes(filter.toLowerCase())) : entries;
      result = { total_count: filtered.length, highlighted_count: 0, entries: filtered, file_info: null };
      const el = document.getElementById('current-source');
      if (el) el.textContent = `Container ${containerId.substring(0, 8)}`;
    } else {
      result = await invoke('read_system_log', {
        logPath, page, pageSize,
        filter: filter || null,
        dateFilter: dateFilter || null,
        withAnalysis: false,
      });
      const el = document.getElementById('current-source');
      if (el) el.textContent = logPath.split('/').pop() || logPath;
    }

    // 更新统计
    const totalEl = document.getElementById('total-logs');
    if (totalEl) totalEl.textContent = result.total_count.toString();
    const hlEl = document.getElementById('highlighted-logs');
    if (hlEl) hlEl.textContent = (result.highlighted_count || 0).toString();

    // 分页
    const prevBtn = document.querySelector('.pagination-btn[title="上一页"]') as HTMLButtonElement;
    const nextBtn = document.querySelector('.pagination-btn[title="下一页"]') as HTMLButtonElement;
    const pageDisplay = document.querySelector('.page-display');
    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = result.entries.length < pageSize;
    if (pageDisplay) pageDisplay.textContent = `第 ${page} 页`;

    // 渲染日志
    if (result.entries && result.entries.length > 0) {
      logContainer.innerHTML = renderLogEntries(result.entries);
    } else {
      logContainer.innerHTML = `<div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor">
          <path d="M39 8H9c-1.1 0-2 .9-2 2v28c0 1.1.9 2 2 2h30c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-2 28H11V12h26v24z"/>
        </svg>
        <p>没有找到日志记录</p>
        <small>请检查日志文件路径或调整过滤条件</small>
      </div>`;
    }
  } catch (error) {
    console.error('刷新日志失败:', error);
    const logContainer = document.getElementById('log-container');
    if (logContainer) logContainer.innerHTML = `<div class="error-state"><p>加载日志失败</p><small>${error}</small></div>`;
  }
}

// ==================== 威胁分析 ====================

async function runThreatAnalysis(): Promise<void> {
  const panelContainer = document.getElementById('threat-panel-container');
  if (!panelContainer) return;

  panelContainer.innerHTML = `<div class="threat-panel"><div class="threat-panel-header"><span class="threat-panel-title">正在分析...</span></div></div>`;

  try {
    const state = (window as any).logAnalysisState || {};
    const useJournalctl = state.useJournalctl || false;
    const logPath = state.logPath || '/var/log/auth.log';

    let result: LogAnalysisResult;
    if (useJournalctl) {
      result = await invoke('read_journalctl_log', {
        page: 1, pageSize: 2000,
        unit: state.journalUnit || null,
        filter: null, since: null, until: null,
        withAnalysis: true,
      });
    } else if (logPath.startsWith('docker:')) {
      // Docker 暂不支持威胁分析
      panelContainer.innerHTML = renderThreatPanel(null, false);
      window.showNotification?.('Docker 容器日志暂不支持威胁分析', 'info');
      return;
    } else {
      result = await invoke('read_system_log', {
        logPath, page: 1, pageSize: 2000,
        filter: null, dateFilter: null,
        withAnalysis: true,
      });
    }

    lastThreatSummary = result.threat_summary || null;
    threatPanelCollapsed = false;
    panelContainer.innerHTML = renderThreatPanel(lastThreatSummary, threatPanelCollapsed);
    window.showNotification?.('威胁分析完成', 'success');
  } catch (error) {
    console.error('威胁分析失败:', error);
    panelContainer.innerHTML = renderThreatPanel(null, false);
    window.showNotification?.(`威胁分析失败: ${error}`, 'error');
  }
}

// ==================== 多日志关联 ====================

async function runMultiLogAnalysis(): Promise<void> {
  const logContainer = document.getElementById('log-container');
  if (!logContainer) return;
  logContainer.innerHTML = `<div class="loading-placeholder"><div class="spinner"></div><p>正在关联分析多个日志源...</p></div>`;

  try {
    const logPaths = ['/var/log/auth.log', '/var/log/syslog', '/var/log/secure', '/var/log/messages'];
    const result: any = await invoke('analyze_multi_log', { logPaths, lineLimit: 500 });

    // 更新威胁面板
    if (result.threat_summary) {
      lastThreatSummary = result.threat_summary;
      const panelContainer = document.getElementById('threat-panel-container');
      if (panelContainer) panelContainer.innerHTML = renderThreatPanel(lastThreatSummary, false);
    }

    const el = document.getElementById('current-source');
    if (el) el.textContent = `关联分析 (${result.sources?.length || 0} 个源)`;
    const totalEl = document.getElementById('total-logs');
    if (totalEl) totalEl.textContent = result.total_count?.toString() || '0';

    if (result.entries && result.entries.length > 0) {
      logContainer.innerHTML = renderLogEntries(result.entries);
    } else {
      logContainer.innerHTML = `<div class="empty-state"><p>未找到日志数据</p><small>确认目标服务器上存在日志文件</small></div>`;
    }
    window.showNotification?.('关联分析完成', 'success');
  } catch (error) {
    console.error('关联分析失败:', error);
    logContainer.innerHTML = `<div class="error-state"><p>关联分析失败</p><small>${error}</small></div>`;
  }
}

// ==================== IOC 搜索 ====================

function showIocSearch(): void {
  // 切换到 IOC tab
  const app = (window as any).app;
  if (app) {
    const renderer = app.getStateManager?.().getUIRenderer?.()?.['logAnalysisRenderer'];
    if (renderer) renderer.setTab('ioc');
  }
}

async function executeIocSearch(): Promise<void> {
  const textarea = document.getElementById('ioc-input') as HTMLTextAreaElement;
  if (!textarea) return;
  const raw = textarea.value.trim();
  if (!raw) return;

  const indicators = raw.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 0);
  const logPaths = ['/var/log/auth.log', '/var/log/syslog', '/var/log/secure', '/var/log/messages', '/var/log/audit/audit.log'];

  window.showNotification?.(`正在搜索 ${indicators.length} 个 IOC...`, 'info');

  try {
    const result: any = await invoke('search_ioc_in_logs', { indicators, logPaths });
    const container = document.getElementById('ioc-results-container');
    if (container) container.innerHTML = renderIocResults(result);
    window.showNotification?.(`IOC 搜索完成: ${result.total_matches} 处匹配`, result.total_matches > 0 ? 'warning' : 'success');
  } catch (error) {
    console.error('IOC 搜索失败:', error);
    window.showNotification?.(`IOC 搜索失败: ${error}`, 'error');
  }
}

// ==================== 自定义规则 ====================

function showCustomRules(): void {
  // 切换到规则 tab
  const app = (window as any).app;
  if (app) {
    const renderer = app.getStateManager?.().getUIRenderer?.()?.['logAnalysisRenderer'];
    if (renderer) renderer.setTab('rules');
  }
  loadCustomRules();
  setTimeout(() => renderRulesList(), 50);
}

function renderRulesList(): void {
  const list = document.getElementById('custom-rules-list');
  if (!list) return;
  if (customRules.length === 0) {
    list.innerHTML = '<p style="color:var(--text-secondary);font-size:12px;margin:0">暂无自定义规则</p>';
    return;
  }
  list.innerHTML = customRules.map((r, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--border-color)">
      <span style="flex:1;font-size:12px">${escapeHtml(r.name)}</span>
      <code style="flex:2;font-size:11px;color:var(--text-secondary)">${escapeHtml(r.regex)}</code>
      <span class="threat-level-badge" style="font-size:10px">${r.severity}</span>
      <button class="modern-btn secondary sm" onclick="window.removeCustomRule(${i})">删除</button>
    </div>
  `).join('');
}

function addCustomRule(): void {
  const nameEl = document.getElementById('rule-name') as HTMLInputElement;
  const regexEl = document.getElementById('rule-regex') as HTMLInputElement;
  const sevEl = document.getElementById('rule-severity') as HTMLSelectElement;
  if (!nameEl || !regexEl) return;
  const name = nameEl.value.trim();
  const regex = regexEl.value.trim();
  if (!name || !regex) return;

  // 验证正则
  try { new RegExp(regex); } catch {
    window.showNotification?.('正则表达式无效', 'error');
    return;
  }

  customRules.push({ name, regex, severity: sevEl?.value || 'medium' });
  saveCustomRules();
  nameEl.value = '';
  regexEl.value = '';
  renderRulesList();
  window.showNotification?.(`规则「${name}」已添加`, 'success');
}

function removeCustomRule(index: number): void {
  customRules.splice(index, 1);
  saveCustomRules();
  renderRulesList();
}

// ==================== 导出报告 ====================

function exportLogReport(): void {
  const state = (window as any).logAnalysisState || {};
  const source = state.logPath || 'unknown';
  const entries = document.querySelectorAll('.log-entry');

  let logHtml = '';
  entries.forEach(el => {
    logHtml += `<div style="font-family:monospace;font-size:11px;padding:2px 4px;border-bottom:1px solid #eee">${el.textContent}</div>`;
  });

  const threatHtml = lastThreatSummary ? `
    <h2>威胁摘要</h2>
    <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;margin:12px 0">
      <tr><td>暴力破解</td><td>${lastThreatSummary.brute_force_count}</td></tr>
      <tr><td>成功登录</td><td>${lastThreatSummary.successful_login_count}</td></tr>
      <tr><td>提权行为</td><td>${lastThreatSummary.privilege_escalation_count}</td></tr>
      <tr><td>可疑活动</td><td>${lastThreatSummary.suspicious_activity_count}</td></tr>
      <tr><td>威胁等级</td><td><strong>${lastThreatSummary.threat_level}</strong></td></tr>
    </table>
    <h3>Top 攻击源 IP</h3>
    <ul>${lastThreatSummary.top_source_ips.map((ip: any) => `<li>${ip.ip} — ${ip.count} 次</li>`).join('')}</ul>
    <h3>Top 目标用户</h3>
    <ul>${lastThreatSummary.top_target_users.map((u: any) => `<li>${u.username} — 成功${u.success_count} 失败${u.fail_count}</li>`).join('')}</ul>
  ` : '';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>日志审计报告 — ${source}</title>
    <style>body{font-family:sans-serif;max-width:900px;margin:0 auto;padding:20px}h1{color:#1e293b}table{width:100%}</style></head>
    <body><h1>日志审计报告</h1>
    <p>来源: ${escapeHtml(source)} | 时间: ${new Date().toLocaleString()}</p>
    ${threatHtml}
    <h2>日志详情 (${entries.length} 条)</h2>
    ${logHtml}
    <footer style="margin-top:20px;color:#888;font-size:11px">Generated by LovelyRes</footer>
    </body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `log-report-${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
  window.showNotification?.('报告已导出', 'success');
}

// ==================== 日志文件列表 ====================

async function loadLogFileList(): Promise<void> {
  const select = document.getElementById('log-file-select') as HTMLSelectElement;
  if (!select) return;
  try {
    const [logFiles, containers] = await Promise.all([
      invoke('list_log_files') as Promise<any[]>,
      invoke('docker_list_containers').catch(() => []) as Promise<any[]>,
    ]);

    const currentValue = select.value;
    let html = '';

    if (Array.isArray(containers) && containers.length > 0) {
      html += `<optgroup label="Docker 容器">`;
      containers.forEach((c: any) => {
        const id = c.Id || c.id;
        const name = c.Name || c.name || (Array.isArray(c.Names || c.names) ? (c.Names || c.names)[0]?.replace(/^\//, '') : 'Unknown');
        const state = c.State || c.state;
        if (!id) return;
        const shortId = String(id).substring(0, 12);
        const displayName = typeof name === 'string' ? name.replace(/^\//, '') : 'Unknown';
        const icon = state === 'running' ? '🟢' : '🔴';
        const val = `docker:${shortId}`;
        html += `<option value="${val}" ${val === currentValue ? 'selected' : ''}>${icon} ${displayName} (${shortId})</option>`;
      });
      html += `</optgroup>`;
    }

    if (Array.isArray(logFiles) && logFiles.length > 0) {
      html += `<optgroup label="系统日志">`;
      logFiles.forEach((f: any) => {
        const sizeStr = f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${(f.size / 1024).toFixed(1)} KB`;
        const recent = Date.now() - parseInt(f.modified) * 1000 < 86400000;
        html += `<option value="${f.path}" ${f.path === currentValue ? 'selected' : ''}>${recent ? '🕒 ' : ''}${f.name} (${sizeStr})</option>`;
      });
      html += `</optgroup>`;
    }

    if (html) select.innerHTML = html;
  } catch (error) {
    console.error('加载日志源列表失败:', error);
  }
}

// ==================== 初始化 ====================

export function initLogAnalysisManager(): void {
  loadCustomRules();

  (window as any).refreshLogAnalysis = refreshLogAnalysis;
  (window as any).runThreatAnalysis = runThreatAnalysis;
  (window as any).runMultiLogAnalysis = runMultiLogAnalysis;
  (window as any).showIocSearch = showIocSearch;
  (window as any).executeIocSearch = executeIocSearch;
  (window as any).showCustomRules = showCustomRules;
  (window as any).addCustomRule = addCustomRule;
  (window as any).removeCustomRule = removeCustomRule;
  (window as any).exportLogReport = exportLogReport;

  // Tab 切换 — 事件委托
  document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-la-action="switch-tab"]') as HTMLElement;
    if (!target) return;
    const tab = target.getAttribute('data-tab');
    if (!tab) return;
    const app = (window as any).app;
    if (app) {
      const renderer = app.getStateManager?.().getUIRenderer?.()?.['logAnalysisRenderer'];
      if (renderer) {
        renderer.setTab(tab);
        if (tab === 'viewer') setTimeout(() => refreshLogAnalysis(), 50);
        if (tab === 'rules') setTimeout(() => renderRulesList(), 50);
      }
    }
  });

  (window as any).toggleThreatPanel = () => {
    threatPanelCollapsed = !threatPanelCollapsed;
    const container = document.getElementById('threat-panel-container');
    if (container) container.innerHTML = renderThreatPanel(lastThreatSummary, threatPanelCollapsed);
  };

  (window as any).switchLogSource = (source: string) => {
    (window as any).logAnalysisState = (window as any).logAnalysisState || {};
    (window as any).logAnalysisState.useJournalctl = source === 'journalctl';
    (window as any).logAnalysisState.page = 1;
    const app = (window as any).app;
    if (app) {
      const wc = document.querySelector('.workspace-content');
      if (wc) {
        const renderer = app.getStateManager().getUIRenderer();
        renderer['logAnalysisRenderer'].setUseJournalctl(source === 'journalctl');
        wc.innerHTML = renderer['renderLogAnalysisPage']();
        setTimeout(() => refreshLogAnalysis(), 100);
      }
    }
  };

  (window as any).updateLogPath = (path: string) => {
    (window as any).logAnalysisState = (window as any).logAnalysisState || {};
    (window as any).logAnalysisState.logPath = path;
    (window as any).logAnalysisState.page = 1;
    refreshLogAnalysis();
  };

  (window as any).updateLogLines = (lines: string) => {
    (window as any).logAnalysisState = (window as any).logAnalysisState || {};
    (window as any).logAnalysisState.lines = lines;
    (window as any).logAnalysisState.page = 1;
    refreshLogAnalysis();
  };

  (window as any).updateLogFilter = (filter: string) => {
    (window as any).logAnalysisState = (window as any).logAnalysisState || {};
    (window as any).logAnalysisState.filter = filter;
    (window as any).logAnalysisState.page = 1;
    refreshLogAnalysis();
  };

  (window as any).updateLogDate = (date: string) => {
    (window as any).logAnalysisState = (window as any).logAnalysisState || {};
    (window as any).logAnalysisState.date = date;
    (window as any).logAnalysisState.page = 1;
    refreshLogAnalysis();
  };

  (window as any).changeLogPage = (delta: number) => {
    (window as any).logAnalysisState = (window as any).logAnalysisState || {};
    let p = (window as any).logAnalysisState.page || 1;
    p = Math.max(1, p + delta);
    (window as any).logAnalysisState.page = p;
    const el = document.querySelector('.page-display');
    if (el) el.textContent = `第 ${p} 页`;
    refreshLogAnalysis();
  };

  (window as any).clearLogFilter = () => {
    const input = document.getElementById('log-filter-input') as HTMLInputElement;
    if (input) input.value = '';
    (window as any).logAnalysisState = (window as any).logAnalysisState || {};
    (window as any).logAnalysisState.filter = '';
    (window as any).logAnalysisState.page = 1;
    refreshLogAnalysis();
  };

  (window as any).updateJournalUnit = (unit: string) => {
    (window as any).logAnalysisState = (window as any).logAnalysisState || {};
    (window as any).logAnalysisState.journalUnit = unit;
    (window as any).logAnalysisState.page = 1;
    refreshLogAnalysis();
  };
}
