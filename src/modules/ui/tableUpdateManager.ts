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
    <tr data-shellcfg-file="${cfg.file}" data-shellcfg-line="${cfg.lineNum}" data-shellcfg-risk="${cfg.risk}" style="border-bottom: 1px solid var(--border-color); ${riskRowStyle(cfg.risk)} cursor: context-menu;">
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace;">${cfg.file}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); text-align: center;">${cfg.lineNum}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px; color: var(--text-primary); border-right: 1px solid var(--border-color-light); font-family: monospace; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${cfg.content}">${cfg.content}</td>
      <td style="padding: var(--spacing-sm); font-size: 12px;">${renderRiskBadge(cfg.risk)}</td>
    </tr>
  `).join('');

  addContextMenuListener(tbody, 'tr[data-shellcfg-file]', (mouseEvent, row) => {
    shellConfigContextMenu.showContextMenu(mouseEvent.clientX, mouseEvent.clientY, {
      file: row.getAttribute('data-shellcfg-file') || '',
      lineNum: parseInt(row.getAttribute('data-shellcfg-line') || '1'),
      content: row.querySelector('td:nth-child(3)')?.getAttribute('title') || '',
      risk: row.getAttribute('data-shellcfg-risk') || 'normal'
    });
  });
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
  (window as any).updateDockerTable = updateDockerTable;
  (window as any).updateKubernetesTable = updateKubernetesTable;

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
