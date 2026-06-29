/**
 * 表格更新管理器
 * 负责将系统信息数据渲染到各个表格中
 */

import { ProcessContextMenu } from './processContextMenu';
import { NetworkContextMenu } from './networkContextMenu';
import { ServiceContextMenu } from './serviceContextMenu';
import { UserContextMenu } from './userContextMenu';
import { StartupContextMenu } from './startupContextMenu';
import { CronContextMenu } from './cronContextMenu';
import { FirewallContextMenu } from './firewallContextMenu';
import { SSHKeyContextMenu } from './sshKeyContextMenu';
import { LoginHistoryContextMenu } from './loginHistoryContextMenu';
import { SUIDFileContextMenu } from './suidFileContextMenu';
import { EnvVarContextMenu } from './envVarContextMenu';
import { ShellConfigContextMenu } from './shellConfigContextMenu';
import { PackageContextMenu } from './packageContextMenu';
import { SudoersContextMenu } from './sudoersContextMenu';
import { TimerContextMenu } from './timerContextMenu';
import { KernelModuleContextMenu } from './kernelModuleContextMenu';
import { RecentFileContextMenu } from './recentFileContextMenu';
import { openProcessDrawer, scoreProcessRisk, buildNetByPid, fmtStartShort } from './processDetailDrawer';
import { analyzeShellFile, type ShellConfigFile } from '../system/shellConfigAnalyzer';

const HIGH_CPU_THRESHOLD = 10; // CPU% 超过该值计入“高 CPU”统计

function htmlEsc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function attrEsc(s: any): string {
  return htmlEsc(s).replace(/"/g, '&quot;');
}

// 创建右键菜单实例
const processContextMenu = new ProcessContextMenu();
const networkContextMenu = new NetworkContextMenu();
const serviceContextMenu = new ServiceContextMenu();
const userContextMenu = new UserContextMenu();
const startupContextMenu = new StartupContextMenu();
const cronContextMenu = new CronContextMenu();
const firewallContextMenu = new FirewallContextMenu();
const sshKeyContextMenu = new SSHKeyContextMenu();
const loginHistoryContextMenu = new LoginHistoryContextMenu();
const suidFileContextMenu = new SUIDFileContextMenu();
const envVarContextMenu = new EnvVarContextMenu();
const shellConfigContextMenu = new ShellConfigContextMenu();
const packageContextMenu = new PackageContextMenu();
const sudoersContextMenu = new SudoersContextMenu();
const timerContextMenu = new TimerContextMenu();
const kernelModuleContextMenu = new KernelModuleContextMenu();
const recentFileContextMenu = new RecentFileContextMenu();

/** 为表格行添加右键菜单事件 */
function addContextMenuListener(
  tbody: HTMLElement,
  selector: string,
  handler: (mouseEvent: MouseEvent, row: HTMLElement) => void
): void {
  tbody.addEventListener('contextmenu', (e) => { e.preventDefault(); });
  tbody.querySelectorAll(selector).forEach(row => {
    row.addEventListener('contextmenu', (e: Event) => {
      e.preventDefault();
      const mouseEvent = e as MouseEvent;
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
      (row as HTMLElement).classList.add('selected');
      handler(mouseEvent, row as HTMLElement);
    });
  });
}

/**
 * 左键点击表格行 → 打开右侧详情侧栏（与进程详情同款）。
 * tbody 的 tr 与数据数组一一对应，按索引取原始行对象传给 openSysDetail。
 */
function bindDetail(tbody: HTMLElement, tab: string, rows: any[]): void {
  const trs = Array.from(tbody.querySelectorAll('tr'));
  trs.forEach((tr, i) => {
    (tr as HTMLElement).addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));
      tr.classList.add('selected');
      const row = rows[i];
      if (row) (window as any).openSysDetail?.(tab, row);
    });
  });
}

function updateProcessChips(total: number, users: number, highCpu: number, susp: number): void {
  const set = (id: string, v: number) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
  set('proc-chip-total', total);
  set('proc-chip-users', users);
  set('proc-chip-cpu', highCpu);
  set('proc-chip-susp', susp);
  set('proc-title-count', total);
  const suspChip = document.getElementById('proc-chip-susp')?.closest('.sys-chip');
  if (suspChip) suspChip.classList.toggle('has-susp', susp > 0);
}

function updateProcessesTable(processes: any[]): void {
  const tbody = document.getElementById('processes-table-body');
  if (!tbody) return;

  if (!processes || processes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="sys-empty-cell">暂无进程信息</td></tr>`;
    updateProcessChips(0, 0, 0, 0);
    return;
  }

  // 动态填充用户筛选选项
  const userFilter = document.getElementById('processes-filter') as HTMLSelectElement;
  if (userFilter) {
    const users = [...new Set(processes.map(p => p.user))].sort();
    const currentValue = userFilter.value;
    userFilter.innerHTML = '<option value="">全部用户</option>' +
      users.map(user => `<option value="${attrEsc(user)}">${htmlEsc(user)}</option>`).join('');
    userFilter.value = currentValue;
  }

  // 关联网络连接做风险评分
  const cache = (window as any).systemInfoCache;
  const netByPid = buildNetByPid(cache?.detailedInfo?.networkDetails || []);

  let suspCount = 0;
  let highCpuCount = 0;
  const userSet = new Set<string>();

  tbody.innerHTML = processes.map((p) => {
    const conns = netByPid.get(String(p.pid)) || [];
    const risk = scoreProcessRisk(p, conns);
    const cpu = parseFloat(p.cpu) || 0;
    if (cpu >= HIGH_CPU_THRESHOLD) highCpuCount++;
    if (risk.level !== 'normal') suspCount++;
    userSet.add(p.user);

    const riskCell = risk.level === 'normal'
      ? `<span class="risk-dot normal"></span>`
      : `<span class="risk-dot ${risk.level}"></span>` +
        (risk.tags[0] ? `<span class="risk-tag ${risk.tags[0] === '外联' ? 'ext' : risk.level}">${htmlEsc(risk.tags[0])}</span>` : '');

    const statCode = p.stat || '-';
    const statChar = statCode.charAt(0);
    const startTime = fmtStartShort(parseInt(p.etimes || '0', 10) || 0);

    return `
    <tr data-pid="${attrEsc(p.pid)}" class="process-row${risk.level !== 'normal' ? ' is-risky ' + risk.level : ''}" data-suspicious="${risk.level !== 'normal' ? '1' : '0'}">
      <td class="col-risk">${riskCell}</td>
      <td class="col-pid">${htmlEsc(p.pid)}</td>
      <td class="col-ppid">${htmlEsc(p.ppid || '-')}</td>
      <td class="col-user">${htmlEsc(p.user)}</td>
      <td class="col-stat"><span class="stat-dot s-${statChar}"></span>${htmlEsc(statCode)}</td>
      <td class="col-cpu">${htmlEsc(p.cpu)}%</td>
      <td class="col-mem">${htmlEsc(p.memory)}%</td>
      <td class="col-time">${htmlEsc(startTime)}</td>
      <td class="col-cmd" title="${attrEsc(p.command)}">${htmlEsc(p.command)}</td>
    </tr>`;
  }).join('');

  updateProcessChips(processes.length, userSet.size, highCpuCount, suspCount);

  // 左键 → 详情抽屉
  tbody.querySelectorAll('tr[data-pid]').forEach(row => {
    row.addEventListener('click', () => {
      const pid = row.getAttribute('data-pid');
      if (pid) openProcessDrawer(pid);
    });
  });

  // 右键 → 上下文菜单（保留原有能力）
  addContextMenuListener(tbody, 'tr[data-pid]', (mouseEvent, row) => {
    const pid = row.getAttribute('data-pid');
    if (pid) processContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, pid);
  });
}

/** 导出当前进程列表为 CSV（复制到剪贴板） */
function exportProcesses(): void {
  const cache = (window as any).systemInfoCache;
  const procs: any[] = cache?.detailedInfo?.processes || [];
  if (!procs.length) { (window as any).showNotification?.('暂无进程数据可导出', 'warning'); return; }
  const netByPid = buildNetByPid(cache?.detailedInfo?.networkDetails || []);
  const header = ['PID', 'PPID', '用户', '状态', 'CPU%', '内存%', '启动时间', '风险', '标签', '命令'];
  const rows = procs.map(p => {
    const risk = scoreProcessRisk(p, netByPid.get(String(p.pid)) || []);
    const startTime = fmtStartShort(parseInt(p.etimes || '0', 10) || 0);
    const cell = (v: any) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [p.pid, p.ppid, p.user, p.stat, p.cpu, p.memory, startTime, risk.level, risk.tags.join('|'), p.command].map(cell).join(',');
  });
  const csv = header.join(',') + '\n' + rows.join('\n');
  navigator.clipboard.writeText(csv)
    .then(() => (window as any).showNotification?.(`已复制 ${procs.length} 条进程信息 (CSV) 到剪贴板`, 'success'))
    .catch(() => (window as any).showNotification?.('导出失败', 'error'));
}

function updateNetworkTable(networkDetails: any[]): void {
  const tbody = document.getElementById('network-table-body');
  if (!tbody) return;

  if (!networkDetails || networkDetails.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无网络连接信息</td></tr>`;
    return;
  }

  tbody.innerHTML = networkDetails.map((conn) => {
    const isEstablished = conn.state === 'ESTABLISHED' || conn.state === 'ESTAB';
    const standardPorts = [':22', ':80', ':443', ':3306', ':5432', ':6379', ':53', ':8080', ':8443'];
    const isSuspiciousConn = isEstablished && !standardPorts.some(p => (conn.foreignAddress || '').endsWith(p)) && conn.foreignAddress && conn.foreignAddress !== '*:*' && conn.foreignAddress !== '0.0.0.0:*';
    const rowBg = isSuspiciousConn ? 'background: #faad1408; border-left: 2px solid #faad14;' : '';
    return `
    <tr class="network-row" data-protocol="${conn.protocol}" data-local="${conn.localAddress}" data-foreign="${conn.foreignAddress}" data-state="${conn.state}" data-pid="${conn.pid || '-'}" data-process="${conn.process}" style="border-bottom: 1px solid var(--border-color); cursor: context-menu; ${rowBg}">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${conn.protocol}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${conn.localAddress}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${conn.foreignAddress}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${conn.state}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${conn.pid || '-'}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary);">${conn.process}</td>
    </tr>`;
  }).join('');

  addContextMenuListener(tbody, 'tr[data-protocol]', (mouseEvent, row) => {
    networkContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
      protocol: row.getAttribute('data-protocol') || '',
      localAddress: row.getAttribute('data-local') || '',
      foreignAddress: row.getAttribute('data-foreign') || '',
      state: row.getAttribute('data-state') || '',
      pid: row.getAttribute('data-pid') || '-',
      process: row.getAttribute('data-process') || ''
    });
  });
}

function updateServicesTable(services: any[]): void {
  const tbody = document.getElementById('services-table-body');
  if (!tbody) return;

  if (!services || services.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无系统服务信息</td></tr>`;
    return;
  }

  const statusFilter = document.getElementById('services-filter') as HTMLSelectElement;
  if (statusFilter) {
    const statuses = [...new Set(services.map(s => s.status))].sort();
    const currentValue = statusFilter.value;
    statusFilter.innerHTML = '<option value="">所有状态</option>' +
      statuses.map(status => `<option value="${status}">${status}</option>`).join('');
    statusFilter.value = currentValue;
  }

  tbody.innerHTML = services.map((service) => `
    <tr data-service-name="${service.name}" style="border-bottom: 1px solid var(--border-color); cursor: context-menu;">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${service.name}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">
        <span style="color: ${service.status === 'active' ? 'var(--success-color)' : 'var(--error-color)'};">${service.status}</span>
      </td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${service.enabled}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${service.description}">${service.description}</td>
    </tr>
  `).join('');

  addContextMenuListener(tbody, 'tr[data-service-name]', (mouseEvent, row) => {
    const serviceName = row.getAttribute('data-service-name');
    if (serviceName) serviceContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, serviceName);
  });
}

function updateUsersTable(users: any[]): void {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无用户信息</td></tr>`;
    return;
  }

  const shellFilter = document.getElementById('users-filter') as HTMLSelectElement;
  if (shellFilter) {
    const shells = [...new Set(users.map(u => u.shell))].sort();
    const currentValue = shellFilter.value;
    shellFilter.innerHTML = '<option value="">所有Shell</option>' +
      shells.map(shell => `<option value="${shell}">${shell}</option>`).join('');
    shellFilter.value = currentValue;
  }

  tbody.innerHTML = users.map((user) => {
    const isRoot = user.uid === '0' && user.username !== 'root';
    const hasLoginShell = ['/bin/bash', '/bin/sh', '/usr/bin/zsh', '/bin/zsh', '/bin/dash'].includes(user.shell);
    const rowStyle = isRoot ? 'background: #ff4d4f08; border-left: 3px solid #ff4d4f;' : '';
    const uidColor = isRoot ? '#ff4d4f; font-weight: 600' : 'var(--text-primary)';
    const shellColor = hasLoginShell ? 'var(--text-primary); font-weight: 500' : 'var(--text-secondary)';
    return `
    <tr data-username="${user.username}" style="border-bottom: 1px solid var(--border-color); cursor: context-menu; ${rowStyle}">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${user.username}${isRoot ? ' <span style="color:#ff4d4f;font-size:10px;">⚠️UID=0</span>' : ''}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: ${uidColor}; border-right: 1px solid var(--border-color-light);">${user.uid}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${user.gid}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${user.home}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: ${shellColor};">${user.shell}</td>
    </tr>`;
  }).join('');

  addContextMenuListener(tbody, 'tr[data-username]', (mouseEvent, row) => {
    const username = row.getAttribute('data-username');
    if (username) userContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, username);
  });
}

function updateAutostartTable(autostart: any[]): void {
  const tbody = document.getElementById('autostart-table-body');
  if (!tbody) return;

  if (!autostart || autostart.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无自启动服务信息</td></tr>`;
    return;
  }

  tbody.innerHTML = autostart.map((item) => `
    <tr data-startup-name="${item.name}" data-startup-type="${item.type}" data-startup-path="${item.path || ''}" data-startup-command="${item.command}" style="border-bottom: 1px solid var(--border-color); cursor: context-menu;">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${item.name}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-right: 1px solid var(--border-color-light);" title="${item.command}">${item.command}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">
        <span style="color: ${item.status === 'enabled' ? 'var(--success-color)' : 'var(--error-color)'};">${item.status}</span>
      </td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary);">${item.type}</td>
    </tr>
  `).join('');

  addContextMenuListener(tbody, 'tr[data-startup-name]', (mouseEvent, row) => {
    startupContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
      name: row.getAttribute('data-startup-name') || '',
      type: row.getAttribute('data-startup-type') || '',
      path: row.getAttribute('data-startup-path') || '',
      command: row.getAttribute('data-startup-command') || ''
    });
  });
}

function updateCronTable(cronJobs: any[]): void {
  const tbody = document.getElementById('cron-table-body');
  if (!tbody) return;

  if (!cronJobs || cronJobs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无计划任务信息</td></tr>`;
    return;
  }

  tbody.innerHTML = cronJobs.map((job) => {
    const suspiciousPatterns = ['wget', 'curl', 'nc ', '/dev/tcp', 'base64', 'python -c', 'perl -e', 'bash -i'];
    const isSuspicious = suspiciousPatterns.some(p => (job.command || '').toLowerCase().includes(p));
    const rowStyle = isSuspicious ? 'background: #ff4d4f08; border-left: 3px solid #ff4d4f;' : '';
    return `
    <tr data-cron-user="${job.user}" data-cron-schedule="${job.schedule}" data-cron-command="${job.command}" data-cron-source="${job.source || ''}" style="border-bottom: 1px solid var(--border-color); cursor: context-menu; ${rowStyle}">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${job.user}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); font-family: monospace; border-right: 1px solid var(--border-color-light);">${job.schedule}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${job.command}">${isSuspicious ? '⚠️ ' : ''}${job.command}</td>
    </tr>`;
  }).join('');

  addContextMenuListener(tbody, 'tr[data-cron-user]', (mouseEvent, row) => {
    const user = row.getAttribute('data-cron-user') || '';
    const command = row.getAttribute('data-cron-command') || '';
    if (user && command) {
      cronContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
        user,
        schedule: row.getAttribute('data-cron-schedule') || '',
        command,
        source: row.getAttribute('data-cron-source') || ''
      });
    }
  });
}

function updateFirewallTable(firewallRules: any[]): void {
  const tbody = document.getElementById('firewall-table-body');
  if (!tbody) return;

  if (!firewallRules || firewallRules.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无防火墙规则信息</td></tr>`;
    return;
  }

  tbody.innerHTML = firewallRules.map((rule) => `
    <tr data-chain="${rule.chain}" data-target="${rule.target}" data-protocol="${rule.protocol}" data-source="${rule.source}" data-destination="${rule.destination}" data-options="${rule.options}" style="border-bottom: 1px solid var(--border-color); cursor: context-menu;">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${rule.chain}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${rule.target}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${rule.protocol}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${rule.source}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${rule.destination}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${rule.options}">${rule.options}</td>
    </tr>
  `).join('');

  addContextMenuListener(tbody, 'tr[data-chain]', (mouseEvent, row) => {
    const chain = row.getAttribute('data-chain') || '';
    if (chain) {
      firewallContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
        chain,
        target: row.getAttribute('data-target') || '',
        protocol: row.getAttribute('data-protocol') || '',
        source: row.getAttribute('data-source') || '',
        destination: row.getAttribute('data-destination') || '',
        options: row.getAttribute('data-options') || ''
      });
    }
  });
}

// ==================== 新增应急响应增强表格更新函数 ====================

/** 风险标签渲染辅助 */
function renderRiskBadge(risk: string): string {
  const styles: Record<string, { bg: string; color: string; label: string }> = {
    high: { bg: '#ff4d4f22', color: '#ff4d4f', label: '⚠️ 高危' },
    warning: { bg: '#faad1422', color: '#faad14', label: '⚡ 可疑' },
    normal: { bg: '#52c41a22', color: '#52c41a', label: '✅ 正常' }
  };
  const s = styles[risk] || styles.normal;
  return `<span style="padding: 2px 8px; border-radius: 4px; font-size: 11px; background: ${s.bg}; color: ${s.color}; font-weight: 500;">${s.label}</span>`;
}

/** 高危行背景样式 */
function riskRowStyle(risk: string): string {
  if (risk === 'high') return 'background: #ff4d4f08; border-left: 3px solid #ff4d4f;';
  if (risk === 'warning') return 'background: #faad1408; border-left: 3px solid #faad14;';
  return '';
}

function updateSSHKeysTable(sshKeys: any[]): void {
  const tbody = document.getElementById('sshkeys-table-body');
  if (!tbody) return;
  if (!sshKeys || sshKeys.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">未发现SSH授权密钥</td></tr>`;
    return;
  }
  tbody.innerHTML = sshKeys.map((key) => `
    <tr data-sshkey-user="${key.user}" data-sshkey-type="${key.keyType}" data-sshkey-content="${key.keyContent}" data-sshkey-comment="${key.comment || ''}" data-sshkey-file="${key.file}" style="border-bottom: 1px solid var(--border-color); cursor: context-menu;">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-weight: 600;">${key.user}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace;">${key.keyType}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${key.keyContent}">${key.keyContent}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-secondary); border-right: 1px solid var(--border-color-light);">${key.comment || '-'}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-secondary); font-family: monospace;">${key.file}</td>
    </tr>
  `).join('');

  addContextMenuListener(tbody, 'tr[data-sshkey-user]', (mouseEvent, row) => {
    sshKeyContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
      user: row.getAttribute('data-sshkey-user') || '',
      keyType: row.getAttribute('data-sshkey-type') || '',
      keyContent: row.getAttribute('data-sshkey-content') || '',
      comment: row.getAttribute('data-sshkey-comment') || '',
      file: row.getAttribute('data-sshkey-file') || ''
    });
  });
}

function updateLoginHistoryTable(loginHistory: any[]): void {
  const tbody = document.getElementById('loginhistory-table-body');
  if (!tbody) return;
  if (!loginHistory || loginHistory.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无登录历史</td></tr>`;
    return;
  }
  tbody.innerHTML = loginHistory.map((entry) => {
    const statusColor = entry.status === 'failed' ? '#ff4d4f' : entry.status === 'active' ? '#52c41a' : 'var(--text-primary)';
    const statusLabel = entry.status === 'failed' ? '❌ 失败' : entry.status === 'active' ? '🟢 在线' : '登录';
    const rowBg = entry.status === 'failed' ? 'background: #ff4d4f08;' : '';
    return `
    <tr data-login-user="${entry.user}" data-login-terminal="${entry.terminal}" data-login-source="${entry.source}" data-login-time="${entry.loginTime}" data-login-status="${entry.status}" style="border-bottom: 1px solid var(--border-color); ${rowBg} cursor: context-menu;">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-weight: 600;">${entry.user}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace;">${entry.terminal}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${entry.source}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${entry.loginTime}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: ${statusColor}; font-weight: 500;">${statusLabel}</td>
    </tr>`;
  }).join('');

  addContextMenuListener(tbody, 'tr[data-login-user]', (mouseEvent, row) => {
    loginHistoryContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
      user: row.getAttribute('data-login-user') || '',
      terminal: row.getAttribute('data-login-terminal') || '',
      source: row.getAttribute('data-login-source') || '',
      loginTime: row.getAttribute('data-login-time') || '',
      status: row.getAttribute('data-login-status') || ''
    });
  });
}

function updateSUIDFilesTable(suidFiles: any[]): void {
  const tbody = document.getElementById('suidfiles-table-body');
  if (!tbody) return;
  if (!suidFiles || suidFiles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">未发现SUID/SGID文件</td></tr>`;
    return;
  }
  tbody.innerHTML = suidFiles.map((file) => `
    <tr data-suid-path="${file.path}" data-suid-perms="${file.permissions}" data-suid-owner="${file.owner}" data-suid-risk="${file.risk}" style="border-bottom: 1px solid var(--border-color); ${riskRowStyle(file.risk)} cursor: context-menu;">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${file.path}">${file.path}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace;">${file.permissions}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${file.owner}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${file.size}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${file.modified}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px;">${renderRiskBadge(file.risk)}</td>
    </tr>
  `).join('');

  addContextMenuListener(tbody, 'tr[data-suid-path]', (mouseEvent, row) => {
    suidFileContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
      path: row.getAttribute('data-suid-path') || '',
      permissions: row.getAttribute('data-suid-perms') || '',
      owner: row.getAttribute('data-suid-owner') || '',
      risk: row.getAttribute('data-suid-risk') || 'normal'
    });
  });
}

function updateEnvVariablesTable(envVariables: any[]): void {
  const tbody = document.getElementById('envvars-table-body');
  if (!tbody) return;
  if (!envVariables || envVariables.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无环境变量信息</td></tr>`;
    return;
  }
  tbody.innerHTML = envVariables.map((v) => `
    <tr data-env-name="${v.name}" data-env-risk="${v.risk}" style="border-bottom: 1px solid var(--border-color); ${riskRowStyle(v.risk)} cursor: context-menu;">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-weight: 600; font-family: monospace; white-space: nowrap;">${v.name}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace; max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${v.value}">${v.value}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px;">${renderRiskBadge(v.risk)}</td>
    </tr>
  `).join('');

  addContextMenuListener(tbody, 'tr[data-env-name]', (mouseEvent, row) => {
    const name = row.getAttribute('data-env-name') || '';
    const valueCell = row.querySelector('td:nth-child(2)');
    envVarContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
      name,
      value: valueCell?.getAttribute('title') || valueCell?.textContent || '',
      risk: row.getAttribute('data-env-risk') || 'normal'
    });
  });
}

// ──────── Shell 配置查看器（展示全文 + 协助定位后门） ────────
let shcData: ShellConfigFile[] = [];
let shcActiveIdx = 0;

function shcEsc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function shcRiskBadge(high: number, warn: number): string {
  if (high > 0) return `<span class="shc-badge high">${high}</span>`;
  if (warn > 0) return `<span class="shc-badge warn">${warn}</span>`;
  return `<span class="shc-badge ok">✓</span>`;
}

function renderShcFileList(): string {
  if (!shcData.length) return '<div class="shc-empty">未发现 Shell 配置文件</div>';
  return shcData.map((f, i) => {
    const st = analyzeShellFile(f);
    const base = f.file.split('/').pop() || f.file;
    const dir = f.file.slice(0, f.file.length - base.length) || '/';
    const cls = ['shc-file-card'];
    if (i === shcActiveIdx) cls.push('active');
    if (st.high > 0) cls.push('has-high'); else if (st.warning > 0) cls.push('has-warn');
    return `
      <button class="${cls.join(' ')}" type="button" onclick="window.shcSelectFile && window.shcSelectFile(${i})" title="${attrEsc(f.file)}">
        <div class="shc-file-top">
          <span class="shc-file-name">${shcEsc(base)}</span>
          ${shcRiskBadge(st.high, st.warning)}
        </div>
        <div class="shc-file-dir">${shcEsc(dir)}</div>
        <div class="shc-file-sub"><span>${shcEsc(f.owner || '?')}</span><span class="shc-dot">·</span><span>${f.lines.length} 行</span></div>
      </button>`;
  }).join('');
}

function renderShcViewer(): string {
  const f = shcData[shcActiveIdx];
  if (!f) return '<div class="shc-viewer-empty"><p>无内容</p></div>';
  const st = analyzeShellFile(f);

  const findingsBar = (st.high + st.warning) > 0
    ? `<div class="shc-findings">${Array.from(st.byLine.entries()).map(([num, fd]) =>
        `<button class="shc-find-chip ${fd.level}" type="button" onclick="window.shcJumpLine && window.shcJumpLine(${num})">L${num} · ${shcEsc(fd.label)}</button>`).join('')}</div>`
    : `<div class="shc-clean">✓ 未在该文件发现可疑配置</div>`;

  const linesHtml = f.lines.map(ln => {
    const fd = st.byLine.get(ln.num);
    const isComment = ln.content.trim().startsWith('#');
    const cls = ['shc-line'];
    if (fd) cls.push('hit', fd.level);
    if (isComment) cls.push('comment');
    return `<div class="${cls.join(' ')}" data-line="${ln.num}" data-hit="${fd ? '1' : '0'}">` +
      `<span class="shc-ln">${ln.num}</span>` +
      `<code class="shc-code">${shcEsc(ln.content) || ' '}</code>` +
      (fd ? `<span class="shc-tag ${fd.level}">${shcEsc(fd.label)}</span>` : '') +
      `</div>`;
  }).join('');

  return `
    <div class="shc-viewer-head">
      <div class="shc-vh-left">
        <span class="shc-vh-path">${shcEsc(f.file)}</span>
        <span class="shc-vh-meta">${shcEsc(f.owner || '?')} · ${shcEsc(f.mtime || '')} · ${f.lines.length} 行</span>
      </div>
      <div class="shc-vh-stat">
        ${st.high > 0 ? `<span class="shc-badge high">${st.high} 高危</span>` : ''}
        ${st.warning > 0 ? `<span class="shc-badge warn">${st.warning} 可疑</span>` : ''}
        ${(st.high + st.warning) === 0 ? `<span class="shc-badge ok">无可疑</span>` : ''}
      </div>
    </div>
    ${findingsBar}
    <div class="shc-code-wrap" id="shc-code-wrap">${linesHtml}</div>`;
}

function shcBindViewerContextMenu(): void {
  const wrap = document.getElementById('shc-code-wrap');
  const f = shcData[shcActiveIdx];
  if (!wrap || !f) return;
  const st = analyzeShellFile(f);
  wrap.addEventListener('contextmenu', (e) => {
    const lineEl = (e.target as HTMLElement).closest('.shc-line') as HTMLElement | null;
    if (!lineEl) return;
    e.preventDefault();
    const num = parseInt(lineEl.getAttribute('data-line') || '0', 10);
    const content = f.lines.find(l => l.num === num)?.content || '';
    const fd = st.byLine.get(num);
    const me = e as MouseEvent;
    shellConfigContextMenu.showContextMenu(me.clientX, me.clientY, {
      file: f.file, lineNum: num, content, risk: fd ? fd.level : 'normal'
    });
  });
}

function shcRenderActive(): void {
  const filesEl = document.getElementById('shc-files');
  const viewerEl = document.getElementById('shc-viewer');
  if (filesEl) filesEl.innerHTML = renderShcFileList();
  if (viewerEl) viewerEl.innerHTML = renderShcViewer();
  shcBindViewerContextMenu();
  // 复位工具栏过滤态
  const onlySusp = document.getElementById('shc-only-susp') as HTMLInputElement | null;
  if (onlySusp?.checked) shcToggleOnlySusp(true);
  const search = document.getElementById('shellconfigs-search') as HTMLInputElement | null;
  if (search?.value) shcFilterLines(search.value);
}

function shcSelectFile(idx: number): void {
  if (idx < 0 || idx >= shcData.length) return;
  shcActiveIdx = idx;
  shcRenderActive();
}

function shcFilterLines(q: string): void {
  const query = (q || '').trim().toLowerCase();
  document.querySelectorAll('#shc-code-wrap .shc-line').forEach(el => {
    const txt = (el.querySelector('.shc-code')?.textContent || '').toLowerCase();
    (el as HTMLElement).style.display = !query || txt.includes(query) ? '' : 'none';
  });
}

function shcToggleOnlySusp(on: boolean): void {
  document.querySelectorAll('#shc-code-wrap .shc-line').forEach(el => {
    if (!on) { (el as HTMLElement).style.display = ''; return; }
    (el as HTMLElement).style.display = el.getAttribute('data-hit') === '1' ? '' : 'none';
  });
}

function shcJumpLine(num: number): void {
  const el = document.querySelector(`#shc-code-wrap .shc-line[data-line="${num}"]`) as HTMLElement | null;
  if (!el) return;
  el.style.display = '';
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  el.classList.add('flash');
  setTimeout(() => el.classList.remove('flash'), 1200);
}

function updateShellConfigsTable(shellConfigs: any[]): void {
  shcData = Array.isArray(shellConfigs) ? shellConfigs : [];

  // 选中"高危最多"的文件，让用户第一眼看到后门；否则首个
  let bestIdx = 0, bestScore = -1, totHigh = 0, totWarn = 0;
  shcData.forEach((f, i) => {
    const st = analyzeShellFile(f);
    totHigh += st.high; totWarn += st.warning;
    const score = st.high * 100 + st.warning;
    if (score > bestScore) { bestScore = score; bestIdx = i; }
  });
  shcActiveIdx = bestIdx;

  const setTxt = (id: string, v: any) => { const el = document.getElementById(id); if (el) el.textContent = String(v); };
  setTxt('shellconfigs-title-count', shcData.length);
  setTxt('shellconfigs-chip-total', shcData.length);
  setTxt('shellconfigs-chip-susp', totHigh + totWarn);
  setTxt('shellconfigs-chip-high', totHigh);
  document.getElementById('shellconfigs-chip-susp-wrap')?.classList.toggle('has-susp', (totHigh + totWarn) > 0);
  document.getElementById('shellconfigs-chip-high-wrap')?.classList.toggle('has-susp', totHigh > 0);

  if (!shcData.length) {
    const filesEl = document.getElementById('shc-files');
    const viewerEl = document.getElementById('shc-viewer');
    if (filesEl) filesEl.innerHTML = '<div class="shc-empty">未发现 Shell 配置文件</div>';
    if (viewerEl) viewerEl.innerHTML = '<div class="shc-viewer-empty"><p>无 Shell 配置可显示</p></div>';
    return;
  }
  shcRenderActive();
}

function updateInstalledPackagesTable(installedPackages: any[]): void {
  const tbody = document.getElementById('packages-table-body');
  if (!tbody) return;
  if (!installedPackages || installedPackages.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无软件包信息</td></tr>`;
    return;
  }
  tbody.innerHTML = installedPackages.map((pkg) => `
    <tr data-pkg-name="${pkg.name}" data-pkg-version="${pkg.version || ''}" data-pkg-time="${pkg.installTime}" data-pkg-source="${pkg.source}" style="border-bottom: 1px solid var(--border-color); cursor: context-menu;">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-weight: 500;">${pkg.name}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace;">${pkg.version || '-'}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${pkg.installTime}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-secondary);">${pkg.source}</td>
    </tr>
  `).join('');

  addContextMenuListener(tbody, 'tr[data-pkg-name]', (mouseEvent, row) => {
    packageContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
      name: row.getAttribute('data-pkg-name') || '',
      version: row.getAttribute('data-pkg-version') || '',
      installTime: row.getAttribute('data-pkg-time') || '',
      source: row.getAttribute('data-pkg-source') || ''
    });
  });
}

function updateSudoersTable(sudoersConfig: any[]): void {
  const tbody = document.getElementById('sudoers-table-body');
  if (!tbody) return;
  if (!sudoersConfig || sudoersConfig.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无Sudoers配置</td></tr>`;
    return;
  }
  tbody.innerHTML = sudoersConfig.map((entry) => {
    const isNopasswd = entry.nopasswd === 'YES';
    const isAllCmd = entry.command.includes('ALL');
    const risk = isNopasswd && isAllCmd ? 'high' : isNopasswd ? 'warning' : 'normal';
    return `
    <tr data-sudoer-user="${entry.user}" data-sudoer-host="${entry.host}" data-sudoer-nopasswd="${entry.nopasswd}" data-sudoer-source="${entry.source}" style="border-bottom: 1px solid var(--border-color); ${riskRowStyle(risk)} cursor: context-menu;">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-weight: 600;">${entry.user}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${entry.host}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${entry.command}">${entry.command}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: ${isNopasswd ? '#ff4d4f' : 'var(--text-primary)'}; font-weight: ${isNopasswd ? '600' : '400'}; border-right: 1px solid var(--border-color-light);">${isNopasswd ? '⚠️ 免密' : '需要密码'}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-secondary); font-family: monospace;">${entry.source}</td>
    </tr>`;
  }).join('');

  addContextMenuListener(tbody, 'tr[data-sudoer-user]', (mouseEvent, row) => {
    sudoersContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
      user: row.getAttribute('data-sudoer-user') || '',
      host: row.getAttribute('data-sudoer-host') || '',
      command: row.querySelector('td:nth-child(3)')?.getAttribute('title') || '',
      nopasswd: row.getAttribute('data-sudoer-nopasswd') || 'NO',
      source: row.getAttribute('data-sudoer-source') || ''
    });
  });
}

function updateSystemdTimersTable(systemdTimers: any[]): void {
  const tbody = document.getElementById('timers-table-body');
  if (!tbody) return;
  if (!systemdTimers || systemdTimers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无Systemd定时器</td></tr>`;
    return;
  }
  tbody.innerHTML = systemdTimers.map((timer) => `
    <tr data-timer-name="${timer.timer}" data-timer-next="${timer.next}" data-timer-left="${timer.left}" data-timer-last="${timer.last}" data-timer-activates="${timer.activates}" style="border-bottom: 1px solid var(--border-color); cursor: context-menu;">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-weight: 500;">${timer.timer}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${timer.next}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${timer.left}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${timer.last}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); font-family: monospace;">${timer.activates}</td>
    </tr>
  `).join('');

  addContextMenuListener(tbody, 'tr[data-timer-name]', (mouseEvent, row) => {
    timerContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
      timer: row.getAttribute('data-timer-name') || '',
      next: row.getAttribute('data-timer-next') || '',
      left: row.getAttribute('data-timer-left') || '',
      last: row.getAttribute('data-timer-last') || '',
      activates: row.getAttribute('data-timer-activates') || ''
    });
  });
}

function updateKernelModulesTable(kernelModules: any[]): void {
  const tbody = document.getElementById('kernelmodules-table-body');
  if (!tbody) return;
  if (!kernelModules || kernelModules.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无内核模块信息</td></tr>`;
    return;
  }
  tbody.innerHTML = kernelModules.map((mod) => `
    <tr data-module-name="${mod.name}" data-module-size="${mod.size}" data-module-usedby="${mod.usedBy}" data-module-risk="${mod.risk}" style="border-bottom: 1px solid var(--border-color); ${riskRowStyle(mod.risk)} cursor: context-menu;">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-weight: 500; font-family: monospace;">${mod.name}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${mod.size}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${mod.usedBy}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px;">${renderRiskBadge(mod.risk)}</td>
    </tr>
  `).join('');

  addContextMenuListener(tbody, 'tr[data-module-name]', (mouseEvent, row) => {
    kernelModuleContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
      name: row.getAttribute('data-module-name') || '',
      size: row.getAttribute('data-module-size') || '',
      usedBy: row.getAttribute('data-module-usedby') || '',
      risk: row.getAttribute('data-module-risk') || 'normal'
    });
  });
}

function updateRecentFilesTable(recentFiles: any[]): void {
  const tbody = document.getElementById('recentfiles-table-body');
  if (!tbody) return;
  if (!recentFiles || recentFiles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">未发现近期修改文件</td></tr>`;
    return;
  }
  tbody.innerHTML = recentFiles.map((file) => `
    <tr data-file-path="${file.path}" data-file-modified="${file.modified}" data-file-size="${file.size}" data-file-owner="${file.owner}" data-file-risk="${file.risk}" style="border-bottom: 1px solid var(--border-color); ${riskRowStyle(file.risk)} cursor: context-menu;">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace; max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${file.path}">${file.path}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${file.modified}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${file.size}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${file.owner}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px;">${renderRiskBadge(file.risk)}</td>
    </tr>
  `).join('');

  addContextMenuListener(tbody, 'tr[data-file-path]', (mouseEvent, row) => {
    recentFileContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
      path: row.getAttribute('data-file-path') || '',
      modified: row.getAttribute('data-file-modified') || '',
      size: row.getAttribute('data-file-size') || '',
      owner: row.getAttribute('data-file-owner') || '',
      risk: row.getAttribute('data-file-risk') || 'normal'
    });
  });
}

// ──── Docker Table ────
function updateDockerTable(containers: any[]): void {
  const tbody = document.getElementById('docker-table-body');
  if (!tbody) return;
  if (!containers?.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-secondary);">未检测到 Docker 容器（Docker 可能未运行）</td></tr>';
    return;
  }
  tbody.innerHTML = containers.map((c: any) => {
    const isUp = (c.status || '').toLowerCase().includes('up');
    return `<tr>
      <td style="font-family:monospace;font-size:11px;">${c.id || ''}</td>
      <td><strong>${c.name || ''}</strong></td>
      <td style="font-size:11px;color:var(--text-secondary);">${c.image || ''}</td>
      <td><span class="status-badge ${isUp ? 'running' : 'stopped'}">${c.status || ''}</span></td>
      <td style="font-size:11px;">${c.ports || ''}</td>
      <td style="font-size:11px;color:var(--text-secondary);">${c.created || ''}</td>
    </tr>`;
  }).join('');
}

// ──── Kubernetes Table ────
function updateKubernetesTable(pods: any[]): void {
  const tbody = document.getElementById('kubernetes-table-body');
  if (!tbody) return;
  if (!pods?.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--text-secondary);">未检测到 K8s Pods（kubectl 可能不可用）</td></tr>';
    return;
  }
  tbody.innerHTML = pods.map((p: any) => {
    const isRunning = (p.status || '').toLowerCase() === 'running';
    return `<tr>
      <td style="font-size:11px;">${p.namespace || ''}</td>
      <td><strong>${p.name || ''}</strong></td>
      <td>${p.ready || ''}</td>
      <td><span class="status-badge ${isRunning ? 'running' : p.status?.toLowerCase() === 'completed' ? 'inactive' : 'failed'}">${p.status || ''}</span></td>
      <td>${p.restarts || ''}</td>
      <td style="font-size:11px;color:var(--text-secondary);">${p.age || ''}</td>
    </tr>`;
  }).join('');
}

/**
 * 初始化表格更新管理器
 */
/**
 * 通用「系统调查」统计卡片填充器。
 * 数据加载后由 loadSystemInfoTabData 调用：更新标题计数 `${tab}-title-count`
 * 与各 tab 的功能特色 chips `${tab}-chip-${key}`。进程页有独立的 updateProcessChips，
 * 故这里不处理 processes。
 */
function updateSysTabChips(tabId: string, data: any[]): void {
  const arr = Array.isArray(data) ? data : [];

  const tc = document.getElementById(`${tabId}-title-count`);
  if (tc) tc.textContent = String(arr.length);

  const ALERT_KEYS = new Set(['susp', 'high', 'failed', 'anomaly', 'drop', 'nopasswd']);
  const set = (key: string, n: number) => {
    const el = document.getElementById(`${tabId}-chip-${key}`);
    if (el) el.textContent = String(n);
    if (ALERT_KEYS.has(key)) {
      document.getElementById(`${tabId}-chip-${key}-wrap`)?.classList.toggle('has-susp', n > 0);
    }
  };
  const sv = (x: any) => String(x ?? '');
  const cnt = (pred: (x: any) => boolean) => arr.reduce((n, x) => n + (pred(x) ? 1 : 0), 0);
  const isLoginShell = (s: string) => ['/bin/bash', '/bin/sh', '/usr/bin/zsh', '/bin/zsh', '/bin/dash', '/usr/bin/fish', '/bin/ksh'].includes(s);
  const STD_PORTS = [':22', ':80', ':443', ':3306', ':5432', ':6379', ':53', ':8080', ':8443'];
  const CRON_SUSP = ['wget', 'curl', 'nc ', '/dev/tcp', 'base64', 'python -c', 'perl -e', 'bash -i'];

  switch (tabId) {
    case 'network':
      set('total', arr.length);
      set('listen', cnt(x => /LISTEN/i.test(sv(x.state))));
      set('estab', cnt(x => /ESTAB/i.test(sv(x.state))));
      set('susp', cnt(x => {
        const f = sv(x.foreignAddress);
        return /ESTAB/i.test(sv(x.state)) && !!f && f !== '*:*' && f !== '0.0.0.0:*' && !STD_PORTS.some(p => f.endsWith(p));
      }));
      break;
    case 'services':
      set('total', arr.length);
      set('active', cnt(x => /^(active|running)$/i.test(sv(x.status))));
      set('failed', cnt(x => /failed/i.test(sv(x.status))));
      set('inactive', cnt(x => /^(inactive|dead|stopped|exited)$/i.test(sv(x.status))));
      break;
    case 'users':
      set('total', arr.length);
      set('login', cnt(x => isLoginShell(sv(x.shell))));
      set('root', cnt(x => sv(x.uid) === '0'));
      set('anomaly', cnt(x => sv(x.uid) === '0' && sv(x.username) !== 'root'));
      break;
    case 'autostart':
      set('total', arr.length);
      set('enabled', cnt(x => /enabled/i.test(sv(x.status))));
      set('disabled', cnt(x => !/enabled/i.test(sv(x.status))));
      break;
    case 'cron':
      set('total', arr.length);
      set('susp', cnt(x => { const c = sv(x.command).toLowerCase(); return CRON_SUSP.some(p => c.includes(p)); }));
      break;
    case 'firewall':
      set('total', arr.length);
      set('accept', cnt(x => /ACCEPT|ALLOW/i.test(sv(x.target))));
      set('drop', cnt(x => /DROP|REJECT|DENY/i.test(sv(x.target))));
      break;
    case 'sshkeys':
      set('total', arr.length);
      set('users', new Set(arr.map(x => sv(x.user))).size);
      break;
    case 'loginhistory':
      set('total', arr.length);
      set('active', cnt(x => /active/i.test(sv(x.status))));
      set('failed', cnt(x => /failed/i.test(sv(x.status))));
      break;
    case 'suidfiles':
    case 'recentfiles':
    case 'envvars':
      set('total', arr.length);
      set('high', cnt(x => /high/i.test(sv(x.risk))));
      set('warn', cnt(x => /warn/i.test(sv(x.risk))));
      break;
    case 'kernelmodules':
      set('total', arr.length);
      set('susp', cnt(x => /high|warn/i.test(sv(x.risk))));
      break;
    // shellconfigs 的 chips 由 updateShellConfigsTable 直接计算（数据为整文件结构）
    case 'sudoers':
      set('total', arr.length);
      set('nopasswd', cnt(x => /nopasswd|^(true|yes|是|✓)$/i.test(sv(x.nopasswd ?? x.noPasswd ?? x.nopass))));
      break;
  }
}

export function initTableUpdateManager(): void {
  (window as any).updateSysTabChips = updateSysTabChips;
  // Shell 配置查看器交互
  (window as any).shcSelectFile = shcSelectFile;
  (window as any).shcFilterLines = shcFilterLines;
  (window as any).shcToggleOnlySusp = shcToggleOnlySusp;
  (window as any).shcJumpLine = shcJumpLine;
  // 行点击 → 详情侧栏（由 loadSystemInfoTabData 在数据渲染后统一绑定）
  (window as any).bindSysDetailRows = bindDetail;
  // 详情侧栏复用各右键菜单的 runAction
  (window as any).__sysMenus = {
    process: processContextMenu,
    service: serviceContextMenu, user: userContextMenu, network: networkContextMenu,
    cron: cronContextMenu, firewall: firewallContextMenu, sshkey: sshKeyContextMenu,
    loginhistory: loginHistoryContextMenu, suid: suidFileContextMenu, envvar: envVarContextMenu,
    package: packageContextMenu, sudoers: sudoersContextMenu, timer: timerContextMenu,
    kernelmodule: kernelModuleContextMenu, recentfile: recentFileContextMenu, startup: startupContextMenu,
  };
  (window as any).updateProcessesTable = updateProcessesTable;
  (window as any).updateNetworkTable = updateNetworkTable;
  (window as any).updateServicesTable = updateServicesTable;
  (window as any).updateUsersTable = updateUsersTable;
  (window as any).updateAutostartTable = updateAutostartTable;
  (window as any).updateCronTable = updateCronTable;
  (window as any).updateFirewallTable = updateFirewallTable;
  (window as any).updateSSHKeysTable = updateSSHKeysTable;
  (window as any).updateLoginHistoryTable = updateLoginHistoryTable;
  (window as any).updateSUIDFilesTable = updateSUIDFilesTable;
  (window as any).updateEnvVariablesTable = updateEnvVariablesTable;
  (window as any).updateShellConfigsTable = updateShellConfigsTable;
  (window as any).updateInstalledPackagesTable = updateInstalledPackagesTable;
  (window as any).updateSudoersTable = updateSudoersTable;
  (window as any).updateSystemdTimersTable = updateSystemdTimersTable;
  (window as any).updateKernelModulesTable = updateKernelModulesTable;
  (window as any).updateRecentFilesTable = updateRecentFilesTable;
  (window as any).updateDockerTable = updateDockerTable;
  (window as any).updateKubernetesTable = updateKubernetesTable;
  (window as any).exportProcesses = exportProcesses;

  // 通用表格更新器 — 将 any[] 的每个对象的 values 渲染为 tr/td
  const genericUpdate = (id: string) => (data: any[]) => {
    const tbody = document.getElementById(`${id}-table-body`);
    if (!tbody) return;
    if (!data?.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text-secondary);">无数据</td></tr>`;
      return;
    }
    tbody.innerHTML = data.map((row: any) => {
      const vals = Object.values(row) as string[];
      return `<tr>${vals.map((v: string) => {
        const s = String(v || '');
        // 高亮可疑项
        const isSus = /suspicious|backdoor|hack/i.test(s);
        const isClean = s === 'clean' || s === 'enabled';
        const cls = isSus ? ' style="color:#ef4444;font-weight:500;"' : isClean ? ' style="color:#22c55e;"' : '';
        return `<td${cls}>${s.replace(/</g, '&lt;')}</td>`;
      }).join('')}</tr>`;
    }).join('');
  };

  (window as any).updateGenericTable_webapps = genericUpdate('webapps');
  (window as any).updateGenericTable_openports = genericUpdate('openports');
  (window as any).updateGenericTable_established = genericUpdate('established');
  (window as any).updateGenericTable_autoruns = genericUpdate('autoruns');
  (window as any).updateGenericTable_rootcheck = genericUpdate('rootcheck');
  (window as any).updateGenericTable_sensitive = genericUpdate('sensitive');
}
