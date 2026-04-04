/**
 * 日志审计管理器
 * 管理日志审计页面的所有功能：日志加载、过滤、分页、来源切换
 */

import { invoke } from "@tauri-apps/api/core";

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getLevelClass(level: string): string {
  const levelUpper = level.toUpperCase();
  if (levelUpper.includes('ERROR') || levelUpper.includes('FAIL')) return 'level-error';
  if (levelUpper.includes('WARN')) return 'level-warn';
  if (levelUpper.includes('INFO')) return 'level-info';
  if (levelUpper.includes('DEBUG')) return 'level-debug';
  return 'level-info';
}

function renderLogEntries(entries: any[]): string {
  return `
    <div class="log-entries">
      ${entries.map(entry => {
        const levelClass = getLevelClass(entry.level);
        const highlightClass = entry.highlighted ? 'highlighted' : '';
        let displayTime = entry.timestamp || '-';
        if (displayTime.length > 19) displayTime = displayTime.substring(0, 19);
        const cleanMessage = (entry.message || '').trim();

        return `
          <div class="log-entry ${levelClass} ${highlightClass}">
            <div class="log-timestamp" title="${entry.timestamp}">${displayTime}</div>
            <div class="log-level ${levelClass}">${entry.level}</div>
            <div class="log-message">${entry.highlighted ? '<span class="log-marker">!</span>' : ''}${escapeHtml(cleanMessage)}</div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function loadLogFileList(): Promise<void> {
  const select = document.getElementById('log-file-select') as HTMLSelectElement;
  if (!select) return;

  console.log('📂 正在加载日志源列表...');
  try {
    const [logFiles, containers] = await Promise.all([
      invoke('list_log_files') as Promise<any[]>,
      invoke('docker_list_containers') as Promise<any[]>
    ]);

    const currentValue = select.value;
    let optionsHtml = '';

    // Docker 容器分组
    if (Array.isArray(containers) && containers.length > 0) {
      optionsHtml += `<optgroup label="Docker 容器">`;
      containers.forEach((container: any) => {
        const id = container.Id || container.id;
        const names = container.Names || container.names;
        const name = container.Name || container.name;
        const state = container.State || container.state;
        if (!id) return;

        const shortId = String(id).substring(0, 12);
        let displayName = 'Unknown';
        if (Array.isArray(names) && names.length > 0) {
          displayName = names[0].replace(/^\//, '');
        } else if (name) {
          displayName = name.replace(/^\//, '');
        }

        const statusIcon = state === 'running' ? '🟢' : '🔴';
        const value = `docker:${shortId}`;
        optionsHtml += `<option value="${value}" ${value === currentValue ? 'selected' : ''}>${statusIcon} ${displayName} (${shortId})</option>`;
      });
      optionsHtml += `</optgroup>`;
    } else {
      optionsHtml += `<optgroup label="Docker 容器"><option value="" disabled>无运行中容器</option></optgroup>`;
    }

    // 系统日志分组
    if (Array.isArray(logFiles) && logFiles.length > 0) {
      optionsHtml += `<optgroup label="系统日志">`;
      logFiles.forEach((file: any) => {
        const sizeStr = file.size > 1024 * 1024
          ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
          : `${(file.size / 1024).toFixed(1)} KB`;
        const isRecent = Date.now() - parseInt(file.modified) * 1000 < 24 * 60 * 60 * 1000;
        const recentMark = isRecent ? '🕒 ' : '';
        optionsHtml += `<option value="${file.path}" ${file.path === currentValue ? 'selected' : ''}>${recentMark}${file.name} (${sizeStr})</option>`;
      });
      optionsHtml += `</optgroup>`;
    }

    if (optionsHtml) {
      select.innerHTML = optionsHtml;
      console.log(`✅ 已加载日志源: ${logFiles.length} 个文件, ${containers.length} 个容器`);
    }
  } catch (error) {
    console.error('❌ 加载日志源列表失败:', error);
  }
}

async function refreshLogAnalysis(): Promise<void> {
  console.log('🔄 刷新日志审计');
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

    let result: any;

    if (useJournalctl) {
      result = await invoke('read_journalctl_log', {
        page, pageSize,
        unit: journalUnit || null,
        filter: filter || null,
        since: dateFilter ? `${dateFilter} 00:00:00` : null,
        until: dateFilter ? `${dateFilter} 23:59:59` : null
      });
      document.getElementById('current-source')!.textContent = `journalctl${journalUnit ? ` -u ${journalUnit}` : ''}`;
    } else if (logPath.startsWith('docker:')) {
      const containerId = logPath.replace('docker:', '');
      const logs = await invoke('docker_container_logs', {
        containerId, tail: pageSize.toString()
      }) as string;

      const entries = logs.split('\n')
        .filter(line => line.trim())
        .map(line => ({
          timestamp: '', level: 'INFO',
          service: `docker:${containerId.substring(0, 8)}`,
          message: line, raw: line, highlighted: false
        }));

      const filteredEntries = filter
        ? entries.filter(e => e.message.toLowerCase().includes(filter.toLowerCase()))
        : entries;

      result = {
        total_count: filteredEntries.length,
        highlighted_count: 0,
        entries: filteredEntries,
        file_info: null
      };
      document.getElementById('current-source')!.textContent = `Container ${containerId.substring(0, 8)}`;
    } else {
      result = await invoke('read_system_log', {
        logPath, page, pageSize,
        filter: filter || null,
        dateFilter: dateFilter || null
      });
      const fileName = logPath.split('/').pop() || logPath;
      document.getElementById('current-source')!.textContent = fileName;
    }

    document.getElementById('total-logs')!.textContent = result.total_count.toString();

    const prevBtn = document.querySelector('.pagination-btn[title="上一页"]') as HTMLButtonElement;
    const nextBtn = document.querySelector('.pagination-btn[title="下一页"]') as HTMLButtonElement;
    const pageDisplay = document.querySelector('.page-display');

    if (prevBtn) prevBtn.disabled = page <= 1;
    if (nextBtn) nextBtn.disabled = result.entries.length < pageSize;
    if (pageDisplay) pageDisplay.textContent = `第 ${page} 页`;

    if (result.entries && result.entries.length > 0) {
      logContainer.innerHTML = renderLogEntries(result.entries);
    } else {
      logContainer.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 48 48" fill="currentColor">
            <path d="M39 8H9c-1.1 0-2 .9-2 2v28c0 1.1.9 2 2 2h30c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-2 28H11V12h26v24z"/>
          </svg>
          <p>没有找到日志记录</p>
          <small>请检查日志文件路径或调整过滤条件</small>
        </div>
      `;
    }
  } catch (error) {
    console.error('❌ 刷新日志失败:', error);
    const logContainer = document.getElementById('log-container');
    if (logContainer) {
      logContainer.innerHTML = `<div class="error-state"><p>加载日志失败</p><small>${error}</small></div>`;
    }
  }
}

/**
 * 初始化日志审计管理器
 */
export function initLogAnalysisManager(): void {
  (window as any).refreshLogAnalysis = refreshLogAnalysis;

  (window as any).switchLogSource = (source: string) => {
    (window as any).logAnalysisState = (window as any).logAnalysisState || {};
    (window as any).logAnalysisState.useJournalctl = source === 'journalctl';
    (window as any).logAnalysisState.page = 1;

    const app = (window as any).app;
    if (app) {
      const workspaceContent = document.querySelector('.workspace-content');
      if (workspaceContent) {
        const renderer = app.getStateManager().getUIRenderer();
        renderer['logAnalysisRenderer'].setUseJournalctl(source === 'journalctl');
        workspaceContent.innerHTML = renderer['renderLogAnalysisPage']();
        setTimeout(() => { refreshLogAnalysis(); }, 100);
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
    let currentPage = (window as any).logAnalysisState.page || 1;
    currentPage += delta;
    if (currentPage < 1) currentPage = 1;
    (window as any).logAnalysisState.page = currentPage;

    const pageDisplay = document.querySelector('.page-display');
    if (pageDisplay) pageDisplay.textContent = `第 ${currentPage} 页`;
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
