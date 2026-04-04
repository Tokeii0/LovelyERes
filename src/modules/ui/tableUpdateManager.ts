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

// 创建右键菜单实例
const processContextMenu = new ProcessContextMenu();
const networkContextMenu = new NetworkContextMenu();
const serviceContextMenu = new ServiceContextMenu();
const userContextMenu = new UserContextMenu();
const startupContextMenu = new StartupContextMenu();
const cronContextMenu = new CronContextMenu();
const firewallContextMenu = new FirewallContextMenu();

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

function updateProcessesTable(processes: any[]): void {
  const tbody = document.getElementById('processes-table-body');
  if (!tbody) return;

  if (!processes || processes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无进程信息</td></tr>`;
    return;
  }

  // 动态填充用户筛选选项
  const userFilter = document.getElementById('processes-filter') as HTMLSelectElement;
  if (userFilter) {
    const users = [...new Set(processes.map(p => p.user))].sort();
    const currentValue = userFilter.value;
    userFilter.innerHTML = '<option value="">所有用户</option>' +
      users.map(user => `<option value="${user}">${user}</option>`).join('');
    userFilter.value = currentValue;
  }

  tbody.innerHTML = processes.map((process) => `
    <tr data-pid="${process.pid}" class="process-row" style="border-bottom: 1px solid var(--border-color); cursor: context-menu;">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${process.pid}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${process.user}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace;">${process.stat || '-'}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${process.cpu}%</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${process.memory}%</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${process.command}">${process.command}</td>
    </tr>
  `).join('');

  addContextMenuListener(tbody, 'tr[data-pid]', (mouseEvent, row) => {
    const pid = row.getAttribute('data-pid');
    if (pid) processContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, pid);
  });
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
    <tr style="border-bottom: 1px solid var(--border-color);">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-weight: 600;">${key.user}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace;">${key.keyType}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${key.keyContent}">${key.keyContent}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-secondary); border-right: 1px solid var(--border-color-light);">${key.comment || '-'}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-secondary); font-family: monospace;">${key.file}</td>
    </tr>
  `).join('');
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
    <tr style="border-bottom: 1px solid var(--border-color); ${rowBg}">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-weight: 600;">${entry.user}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace;">${entry.terminal}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${entry.source}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${entry.loginTime}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: ${statusColor}; font-weight: 500;">${statusLabel}</td>
    </tr>`;
  }).join('');
}

function updateSUIDFilesTable(suidFiles: any[]): void {
  const tbody = document.getElementById('suidfiles-table-body');
  if (!tbody) return;
  if (!suidFiles || suidFiles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">未发现SUID/SGID文件</td></tr>`;
    return;
  }
  tbody.innerHTML = suidFiles.map((file) => `
    <tr style="border-bottom: 1px solid var(--border-color); ${riskRowStyle(file.risk)}">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${file.path}">${file.path}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace;">${file.permissions}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${file.owner}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${file.size}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${file.modified}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px;">${renderRiskBadge(file.risk)}</td>
    </tr>
  `).join('');
}

function updateEnvVariablesTable(envVariables: any[]): void {
  const tbody = document.getElementById('envvars-table-body');
  if (!tbody) return;
  if (!envVariables || envVariables.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无环境变量信息</td></tr>`;
    return;
  }
  tbody.innerHTML = envVariables.map((v) => `
    <tr style="border-bottom: 1px solid var(--border-color); ${riskRowStyle(v.risk)}">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-weight: 600; font-family: monospace; white-space: nowrap;">${v.name}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace; max-width: 500px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${v.value}">${v.value}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px;">${renderRiskBadge(v.risk)}</td>
    </tr>
  `).join('');
}

function updateShellConfigsTable(shellConfigs: any[]): void {
  const tbody = document.getElementById('shellconfigs-table-body');
  if (!tbody) return;
  if (!shellConfigs || shellConfigs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
      <div style="font-size: 20px; margin-bottom: 8px;">✅</div>
      未检测到可疑Shell配置
    </td></tr>`;
    return;
  }
  tbody.innerHTML = shellConfigs.map((cfg) => `
    <tr style="border-bottom: 1px solid var(--border-color); ${riskRowStyle(cfg.risk)}">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace;">${cfg.file}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); text-align: center;">${cfg.lineNum}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${cfg.content}">${cfg.content}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px;">${renderRiskBadge(cfg.risk)}</td>
    </tr>
  `).join('');
}

function updateInstalledPackagesTable(installedPackages: any[]): void {
  const tbody = document.getElementById('packages-table-body');
  if (!tbody) return;
  if (!installedPackages || installedPackages.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无软件包信息</td></tr>`;
    return;
  }
  tbody.innerHTML = installedPackages.map((pkg) => `
    <tr style="border-bottom: 1px solid var(--border-color);">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-weight: 500;">${pkg.name}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace;">${pkg.version || '-'}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${pkg.installTime}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-secondary);">${pkg.source}</td>
    </tr>
  `).join('');
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
    <tr style="border-bottom: 1px solid var(--border-color); ${riskRowStyle(risk)}">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-weight: 600;">${entry.user}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${entry.host}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace; max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${entry.command}">${entry.command}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: ${isNopasswd ? '#ff4d4f' : 'var(--text-primary)'}; font-weight: ${isNopasswd ? '600' : '400'}; border-right: 1px solid var(--border-color-light);">${isNopasswd ? '⚠️ 免密' : '需要密码'}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-secondary); font-family: monospace;">${entry.source}</td>
    </tr>`;
  }).join('');
}

function updateSystemdTimersTable(systemdTimers: any[]): void {
  const tbody = document.getElementById('timers-table-body');
  if (!tbody) return;
  if (!systemdTimers || systemdTimers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无Systemd定时器</td></tr>`;
    return;
  }
  tbody.innerHTML = systemdTimers.map((timer) => `
    <tr style="border-bottom: 1px solid var(--border-color);">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-weight: 500;">${timer.timer}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${timer.next}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${timer.left}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${timer.last}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); font-family: monospace;">${timer.activates}</td>
    </tr>
  `).join('');
}

function updateKernelModulesTable(kernelModules: any[]): void {
  const tbody = document.getElementById('kernelmodules-table-body');
  if (!tbody) return;
  if (!kernelModules || kernelModules.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">暂无内核模块信息</td></tr>`;
    return;
  }
  tbody.innerHTML = kernelModules.map((mod) => `
    <tr style="border-bottom: 1px solid var(--border-color); ${riskRowStyle(mod.risk)}">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-weight: 500; font-family: monospace;">${mod.name}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${mod.size}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${mod.usedBy}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px;">${renderRiskBadge(mod.risk)}</td>
    </tr>
  `).join('');
}

function updateRecentFilesTable(recentFiles: any[]): void {
  const tbody = document.getElementById('recentfiles-table-body');
  if (!tbody) return;
  if (!recentFiles || recentFiles.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">未发现近期修改文件</td></tr>`;
    return;
  }
  tbody.innerHTML = recentFiles.map((file) => `
    <tr style="border-bottom: 1px solid var(--border-color); ${riskRowStyle(file.risk)}">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace; max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${file.path}">${file.path}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${file.modified}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${file.size}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light);">${file.owner}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px;">${renderRiskBadge(file.risk)}</td>
    </tr>
  `).join('');
}

/**
 * 初始化表格更新管理器
 */
export function initTableUpdateManager(): void {
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
}
