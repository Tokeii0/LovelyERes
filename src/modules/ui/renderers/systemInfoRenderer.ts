/**
 * 系统信息渲染器
 * 负责渲染系统信息页面的各个表格和标签页
 */

import type { AppState } from '../../core/app';
import {
  List,
  Peoples,
  Earth,
  Rocket,
  Calendar,
  SettingTwo,
  User,
  Shield,
  Refresh,
  Left,
  Right,
  System,
  Time,
  Fire,
  Key,
  History,
  Lock,
  Terminal,
  Config,
  Box,
  DataFile,
  Cpu,
  FolderOpen
} from '@icon-park/svg';

export class SystemInfoRenderer {

  /**
   * 渲染系统信息页面
   */
  public renderSystemInfo(state: AppState): string {
    const detailedInfo = state.serverInfo?.detailedInfo;
    const counts = {
      processes: detailedInfo?.processes?.length || 0,
      network: detailedInfo?.networkDetails?.length || 0,
      services: detailedInfo?.services?.length || 0,
      users: detailedInfo?.users?.length || 0,
      autostart: detailedInfo?.autostart?.length || 0,
      cron: detailedInfo?.cronJobs?.length || 0,
      firewall: detailedInfo?.firewallRules?.length || 0,
      sshkeys: detailedInfo?.sshKeys?.length || 0,
      loginhistory: detailedInfo?.loginHistory?.length || 0,
      suidfiles: detailedInfo?.suidFiles?.length || 0,
      envvars: detailedInfo?.envVariables?.length || 0,
      shellconfigs: detailedInfo?.shellConfigs?.length || 0,
      packages: detailedInfo?.installedPackages?.length || 0,
      sudoers: detailedInfo?.sudoersConfig?.length || 0,
      timers: detailedInfo?.systemdTimers?.length || 0,
      kernelmodules: detailedInfo?.kernelModules?.length || 0,
      recentfiles: detailedInfo?.recentFiles?.length || 0
    };

    // 读取折叠状态
    const isCollapsed = localStorage.getItem('system-info-header-collapsed') === 'true';
    const collapsedClass = isCollapsed ? 'collapsed' : '';
    const contentExpandedClass = isCollapsed ? 'expanded' : '';
    const toggleIcon = isCollapsed
      ? Right({ theme: 'outline', size: '16', fill: 'currentColor' })
      : Left({ theme: 'outline', size: '16', fill: 'currentColor' });

    return `
      <div class="system-info-container">
        <div class="system-info-header ${collapsedClass}">
          <div class="header-toggle-btn" onclick="window.toggleSystemInfoHeader()" title="切换菜单">
            <span class="header-toggle-icon">${toggleIcon}</span>
          </div>

          <div class="system-info-menu-title">
            <span>系统概览</span>
          </div>

          <div class="system-info-tabs">
            <button class="tab-btn active" data-tab="processes" onclick="window.switchSystemInfoTab('processes')">
              <span class="tab-icon">${List({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">进程详情</span>
              ${counts.processes > 0 ? `<span class="count-badge">${counts.processes}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="network" onclick="window.switchSystemInfoTab('network')">
              <span class="tab-icon">${Earth({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">网络详情</span>
              ${counts.network > 0 ? `<span class="count-badge">${counts.network}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="services" onclick="window.switchSystemInfoTab('services')">
              <span class="tab-icon">${System({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">系统服务</span>
              ${counts.services > 0 ? `<span class="count-badge">${counts.services}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="users" onclick="window.switchSystemInfoTab('users')">
              <span class="tab-icon">${User({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">用户列表</span>
              ${counts.users > 0 ? `<span class="count-badge">${counts.users}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="autostart" onclick="window.switchSystemInfoTab('autostart')">
              <span class="tab-icon">${Rocket({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">自启动</span>
              ${counts.autostart > 0 ? `<span class="count-badge">${counts.autostart}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="cron" onclick="window.switchSystemInfoTab('cron')">
              <span class="tab-icon">${Time({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">计划任务</span>
              ${counts.cron > 0 ? `<span class="count-badge">${counts.cron}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="firewall" onclick="window.switchSystemInfoTab('firewall')">
              <span class="tab-icon">${Shield({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">防火墙</span>
              ${counts.firewall > 0 ? `<span class="count-badge">${counts.firewall}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="sshkeys" onclick="window.switchSystemInfoTab('sshkeys')">
              <span class="tab-icon">${Key({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">SSH密钥</span>
              ${counts.sshkeys > 0 ? `<span class="count-badge">${counts.sshkeys}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="loginhistory" onclick="window.switchSystemInfoTab('loginhistory')">
              <span class="tab-icon">${History({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">登录历史</span>
              ${counts.loginhistory > 0 ? `<span class="count-badge">${counts.loginhistory}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="suidfiles" onclick="window.switchSystemInfoTab('suidfiles')">
              <span class="tab-icon">${Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">SUID文件</span>
              ${counts.suidfiles > 0 ? `<span class="count-badge">${counts.suidfiles}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="envvars" onclick="window.switchSystemInfoTab('envvars')">
              <span class="tab-icon">${Terminal({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">环境变量</span>
              ${counts.envvars > 0 ? `<span class="count-badge">${counts.envvars}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="shellconfigs" onclick="window.switchSystemInfoTab('shellconfigs')">
              <span class="tab-icon">${Config({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">Shell配置</span>
              ${counts.shellconfigs > 0 ? `<span class="count-badge danger-badge">${counts.shellconfigs}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="packages" onclick="window.switchSystemInfoTab('packages')">
              <span class="tab-icon">${Box({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">软件包</span>
              ${counts.packages > 0 ? `<span class="count-badge">${counts.packages}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="sudoers" onclick="window.switchSystemInfoTab('sudoers')">
              <span class="tab-icon">${DataFile({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">Sudoers</span>
              ${counts.sudoers > 0 ? `<span class="count-badge">${counts.sudoers}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="timers" onclick="window.switchSystemInfoTab('timers')">
              <span class="tab-icon">${Calendar({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">定时器</span>
              ${counts.timers > 0 ? `<span class="count-badge">${counts.timers}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="kernelmodules" onclick="window.switchSystemInfoTab('kernelmodules')">
              <span class="tab-icon">${Cpu({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">内核模块</span>
              ${counts.kernelmodules > 0 ? `<span class="count-badge">${counts.kernelmodules}</span>` : ''}
            </button>
            <button class="tab-btn" data-tab="recentfiles" onclick="window.switchSystemInfoTab('recentfiles')">
              <span class="tab-icon">${FolderOpen({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
              <span class="tab-label">最近文件</span>
              ${counts.recentfiles > 0 ? `<span class="count-badge">${counts.recentfiles}</span>` : ''}
            </button>
          </div>

          <div class="system-info-actions">
            <span id="system-info-last-update" class="last-update-time" style="font-size: 11px; color: var(--text-secondary); margin-right: 8px;"></span>
            <button class="refresh-btn" onclick="window.refreshAllSystemInfo()" title="刷新所有系统信息">
              ${Refresh({ theme: 'outline', size: '16', fill: 'currentColor' })}
              <span>刷新</span>
            </button>
          </div>
        </div>

        <div class="system-info-content ${contentExpandedClass}" id="system-info-content">
          ${this.renderSystemInfoTab(state, 'processes')}
        </div>
      </div>
    `;
  }

  /**
   * 渲染系统信息标签页内容
   */
  public renderSystemInfoTab(_state: AppState, tab: string): string {
    switch (tab) {
      case 'processes':
        return this.renderProcessesTable();
      case 'network':
        return this.renderNetworkTable();
      case 'services':
        return this.renderServicesTable();
      case 'users':
        return this.renderUsersTable();
      case 'autostart':
        return this.renderAutostartTable();
      case 'cron':
        return this.renderCronTable();
      case 'firewall':
        return this.renderFirewallTable();
      case 'sshkeys':
        return this.renderSSHKeysTable();
      case 'loginhistory':
        return this.renderLoginHistoryTable();
      case 'suidfiles':
        return this.renderSUIDFilesTable();
      case 'envvars':
        return this.renderEnvVariablesTable();
      case 'shellconfigs':
        return this.renderShellConfigsTable();
      case 'packages':
        return this.renderInstalledPackagesTable();
      case 'sudoers':
        return this.renderSudoersTable();
      case 'timers':
        return this.renderSystemdTimersTable();
      case 'kernelmodules':
        return this.renderKernelModulesTable();
      case 'recentfiles':
        return this.renderRecentFilesTable();
      default:
        return '<p>选择一个标签页查看详细信息</p>';
    }
  }

  /**
   * 渲染进程表格
   */
  public renderProcessesTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${List({ theme: 'outline', size: '20', fill: 'currentColor' })}
            运行中的进程
          </span>
          <div class="search-container">
            <select
              id="processes-filter"
              class="system-select"
              style="width: 100px;"
              onchange="window.filterTableByCategory('processes', this.value)"
            >
              <option value="">所有用户</option>
            </select>
            <select
              id="processes-stat-filter"
              class="system-select"
              style="width: 100px;"
              onchange="window.filterTableByStatus('processes', this.value)"
            >
              <option value="">所有状态</option>
              <option value="R">运行中 (R)</option>
              <option value="S">休眠 (S)</option>
              <option value="D">不可中断 (D)</option>
              <option value="Z">僵尸 (Z)</option>
              <option value="T">停止 (T)</option>
            </select>
            <input
              type="text"
              id="processes-search"
              class="system-input"
              placeholder="搜索进程..."
              style="width: 120px;"
              oninput="window.filterTable('processes', this.value)"
            />
            <button
              class="system-btn"
              onclick="document.getElementById('processes-search').value = ''; document.getElementById('processes-filter').value = ''; document.getElementById('processes-stat-filter').value = ''; window.filterTable('processes', '');"
            >清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>用户</th>
                <th>状态</th>
                <th>CPU%</th>
                <th>内存%</th>
                <th>命令</th>
              </tr>
            </thead>
            <tbody id="processes-table-body">
              <tr>
                <td colspan="6" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
                  正在加载进程信息...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * 渲染网络表格
   */
  public renderNetworkTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${Earth({ theme: 'outline', size: '20', fill: 'currentColor' })}
            网络连接详情
          </span>
          <div class="search-container">
            <select
              id="network-filter"
              class="system-select"
              style="width: 120px;"
              onchange="window.filterTableByCategory('network', this.value)"
            >
              <option value="">所有状态</option>
              <option value="LISTEN">LISTEN</option>
              <option value="ESTABLISHED">ESTABLISHED</option>
              <option value="TIME_WAIT">TIME_WAIT</option>
              <option value="CLOSE_WAIT">CLOSE_WAIT</option>
              <option value="SYN_SENT">SYN_SENT</option>
              <option value="SYN_RECV">SYN_RECV</option>
              <option value="FIN_WAIT1">FIN_WAIT1</option>
              <option value="FIN_WAIT2">FIN_WAIT2</option>
              <option value="CLOSED">CLOSED</option>
            </select>
            <input
              type="text"
              id="network-search"
              class="system-input"
              placeholder="搜索连接..."
              style="width: 150px;"
              oninput="window.filterTable('network', this.value)"
            />
            <button
              class="system-btn"
              onclick="document.getElementById('network-search').value = ''; document.getElementById('network-filter').value = ''; window.filterTable('network', '');"
            >清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>协议</th>
                <th>本地地址</th>
                <th>远程地址</th>
                <th>状态</th>
                <th>PID</th>
                <th>进程</th>
              </tr>
            </thead>
            <tbody id="network-table-body">
              <tr>
                <td colspan="6" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
                  正在加载网络连接信息...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * 渲染系统服务表格
   */
  public renderServicesTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${SettingTwo({ theme: 'outline', size: '20', fill: 'currentColor' })}
            系统服务状态
          </span>
          <div class="search-container">
            <select
              id="services-filter"
              class="system-select"
              style="width: 100px;"
              onchange="window.filterTableByCategory('services', this.value)"
            >
              <option value="">所有状态</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
              <option value="failed">failed</option>
              <option value="running">running</option>
              <option value="stopped">stopped</option>
            </select>
            <input
              type="text"
              id="services-search"
              class="system-input"
              placeholder="搜索服务..."
              style="width: 120px;"
              oninput="window.filterTable('services', this.value)"
            />
            <button
              class="system-btn"
              onclick="document.getElementById('services-search').value = ''; document.getElementById('services-filter').value = ''; window.filterTable('services', '');"
            >清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>服务名</th>
                <th>状态</th>
                <th>启用状态</th>
                <th>描述</th>
              </tr>
            </thead>
            <tbody id="services-table-body">
              <tr>
                <td colspan="4" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
                  正在加载系统服务信息...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * 渲染用户列表表格
   */
  public renderUsersTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${Peoples({ theme: 'outline', size: '20', fill: 'currentColor' })}
            系统用户列表
          </span>
          <div class="search-container">
            <select
              id="users-filter"
              class="system-select"
              style="width: 120px;"
              onchange="window.filterTableByCategory('users', this.value)"
            >
              <option value="">所有Shell</option>
              <option value="/bin/bash">/bin/bash</option>
              <option value="/bin/sh">/bin/sh</option>
              <option value="/usr/sbin/nologin">/usr/sbin/nologin</option>
              <option value="/bin/false">/bin/false</option>
              <option value="/usr/bin/zsh">/usr/bin/zsh</option>
              <option value="/bin/dash">/bin/dash</option>
            </select>
            <input
              type="text"
              id="users-search"
              class="system-input"
              placeholder="搜索用户..."
              style="width: 100px;"
              oninput="window.filterTable('users', this.value)"
            />
            <button
              class="system-btn"
              onclick="document.getElementById('users-search').value = ''; document.getElementById('users-filter').value = ''; window.filterTable('users', '');"
            >清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>用户名</th>
                <th>UID</th>
                <th>GID</th>
                <th>主目录</th>
                <th>Shell</th>
              </tr>
            </thead>
            <tbody id="users-table-body">
              <tr>
                <td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
                  正在加载用户信息...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * 渲染自启动服务表格
   */
  public renderAutostartTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${Rocket({ theme: 'outline', size: '20', fill: 'currentColor' })}
            自启动服务
          </span>
          <div class="search-container">
            <input
              type="text"
              id="autostart-search"
              class="system-input"
              placeholder="搜索服务..."
              style="width: 150px;"
              oninput="window.filterTable('autostart', this.value)"
            />
            <button
              class="system-btn"
              onclick="document.getElementById('autostart-search').value = ''; window.filterTable('autostart', '');"
            >清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>服务名</th>
                <th>命令</th>
                <th>状态</th>
                <th>类型</th>
              </tr>
            </thead>
            <tbody id="autostart-table-body">
              <tr>
                <td colspan="4" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
                  正在加载自启动服务信息...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * 渲染计划任务表格
   */
  public renderCronTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${Calendar({ theme: 'outline', size: '20', fill: 'currentColor' })}
            计划任务 (Cron Jobs)
          </span>
          <div class="search-container">
            <input
              type="text"
              id="cron-search"
              class="system-input"
              placeholder="搜索任务..."
              style="width: 150px;"
              oninput="window.filterTable('cron', this.value)"
            />
            <button
              class="system-btn"
              onclick="document.getElementById('cron-search').value = ''; window.filterTable('cron', '');"
            >清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>用户</th>
                <th>时间表</th>
                <th>命令</th>
              </tr>
            </thead>
            <tbody id="cron-table-body">
              <tr>
                <td colspan="3" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
                  正在加载计划任务信息...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  /**
   * 渲染防火墙表格
   */
  public renderFirewallTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${Fire({ theme: 'outline', size: '20', fill: 'currentColor' })}
            防火墙规则
          </span>
          <div class="search-container">
            <select
              id="firewall-type-filter"
              class="system-select"
              style="width: 100px;"
              onchange="window.filterTableByCategory('firewall', this.value)"
            >
              <option value="">所有规则</option>
              <option value="iptables">iptables</option>
              <option value="firewalld">firewalld</option>
              <option value="ufw">UFW</option>
            </select>
            <input
              type="text"
              id="firewall-search"
              class="system-input"
              placeholder="搜索规则..."
              style="width: 150px;"
              oninput="window.filterTable('firewall', this.value)"
            />
            <button
              class="system-btn"
              onclick="document.getElementById('firewall-search').value = ''; document.getElementById('firewall-type-filter').value = ''; window.filterTable('firewall', '');"
            >清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>链</th>
                <th>目标</th>
                <th>协议</th>
                <th>源地址</th>
                <th>目标地址</th>
                <th>选项</th>
              </tr>
            </thead>
            <tbody id="firewall-table-body">
              <tr>
                <td colspan="6" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">
                  正在加载防火墙规则信息...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ==================== 新增应急响应增强栏目渲染 ====================

  public renderSSHKeysTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${Key({ theme: 'outline', size: '20', fill: 'currentColor' })}
            SSH 授权密钥 (authorized_keys)
          </span>
          <div class="search-container">
            <input type="text" id="sshkeys-search" class="system-input" placeholder="搜索密钥..." style="width: 150px;" oninput="window.filterTable('sshkeys', this.value)" />
            <button class="system-btn" onclick="document.getElementById('sshkeys-search').value = ''; window.filterTable('sshkeys', '');">清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>用户</th>
                <th>密钥类型</th>
                <th>密钥摘要</th>
                <th>备注</th>
                <th>文件路径</th>
              </tr>
            </thead>
            <tbody id="sshkeys-table-body">
              <tr><td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">正在加载SSH密钥信息...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  public renderLoginHistoryTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${History({ theme: 'outline', size: '20', fill: 'currentColor' })}
            登录历史 (last/lastb)
          </span>
          <div class="search-container">
            <select id="loginhistory-filter" class="system-select" style="width: 100px;" onchange="window.filterTableByCategory('loginhistory', this.value)">
              <option value="">所有状态</option>
              <option value="active">在线</option>
              <option value="login">已登录</option>
              <option value="failed">失败</option>
            </select>
            <input type="text" id="loginhistory-search" class="system-input" placeholder="搜索..." style="width: 120px;" oninput="window.filterTable('loginhistory', this.value)" />
            <button class="system-btn" onclick="document.getElementById('loginhistory-search').value = ''; document.getElementById('loginhistory-filter').value = ''; window.filterTable('loginhistory', '');">清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>用户</th>
                <th>终端</th>
                <th>来源IP</th>
                <th>登录时间</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody id="loginhistory-table-body">
              <tr><td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">正在加载登录历史...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  public renderSUIDFilesTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${Lock({ theme: 'outline', size: '20', fill: 'currentColor' })}
            SUID/SGID 特权文件
          </span>
          <div class="search-container">
            <select id="suidfiles-filter" class="system-select" style="width: 100px;" onchange="window.filterTableByCategory('suidfiles', this.value)">
              <option value="">所有风险</option>
              <option value="high">⚠️ 高危</option>
              <option value="normal">正常</option>
            </select>
            <input type="text" id="suidfiles-search" class="system-input" placeholder="搜索文件..." style="width: 150px;" oninput="window.filterTable('suidfiles', this.value)" />
            <button class="system-btn" onclick="document.getElementById('suidfiles-search').value = ''; document.getElementById('suidfiles-filter').value = ''; window.filterTable('suidfiles', '');">清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>文件路径</th>
                <th>权限</th>
                <th>所有者</th>
                <th>大小</th>
                <th>修改时间</th>
                <th>风险</th>
              </tr>
            </thead>
            <tbody id="suidfiles-table-body">
              <tr><td colspan="6" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">正在加载SUID文件信息...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  public renderEnvVariablesTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${Terminal({ theme: 'outline', size: '20', fill: 'currentColor' })}
            环境变量
          </span>
          <div class="search-container">
            <input type="text" id="envvars-search" class="system-input" placeholder="搜索变量..." style="width: 150px;" oninput="window.filterTable('envvars', this.value)" />
            <button class="system-btn" onclick="document.getElementById('envvars-search').value = ''; window.filterTable('envvars', '');">清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>变量名</th>
                <th>值</th>
                <th>风险</th>
              </tr>
            </thead>
            <tbody id="envvars-table-body">
              <tr><td colspan="3" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">正在加载环境变量...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  public renderShellConfigsTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${Config({ theme: 'outline', size: '20', fill: 'currentColor' })}
            Shell配置后门检测
          </span>
          <div class="search-container">
            <input type="text" id="shellconfigs-search" class="system-input" placeholder="搜索..." style="width: 150px;" oninput="window.filterTable('shellconfigs', this.value)" />
            <button class="system-btn" onclick="document.getElementById('shellconfigs-search').value = ''; window.filterTable('shellconfigs', '');">清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>文件</th>
                <th>行号</th>
                <th>可疑内容</th>
                <th>风险</th>
              </tr>
            </thead>
            <tbody id="shellconfigs-table-body">
              <tr><td colspan="4" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">正在检测Shell配置...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  public renderInstalledPackagesTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${Box({ theme: 'outline', size: '20', fill: 'currentColor' })}
            最近安装的软件包
          </span>
          <div class="search-container">
            <input type="text" id="packages-search" class="system-input" placeholder="搜索软件包..." style="width: 150px;" oninput="window.filterTable('packages', this.value)" />
            <button class="system-btn" onclick="document.getElementById('packages-search').value = ''; window.filterTable('packages', '');">清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>软件包名</th>
                <th>版本</th>
                <th>安装时间</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody id="packages-table-body">
              <tr><td colspan="4" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">正在加载软件包信息...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  public renderSudoersTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${DataFile({ theme: 'outline', size: '20', fill: 'currentColor' })}
            Sudoers 权限配置
          </span>
          <div class="search-container">
            <input type="text" id="sudoers-search" class="system-input" placeholder="搜索..." style="width: 150px;" oninput="window.filterTable('sudoers', this.value)" />
            <button class="system-btn" onclick="document.getElementById('sudoers-search').value = ''; window.filterTable('sudoers', '');">清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>用户/组</th>
                <th>主机</th>
                <th>命令</th>
                <th>免密</th>
                <th>来源</th>
              </tr>
            </thead>
            <tbody id="sudoers-table-body">
              <tr><td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">正在加载Sudoers配置...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  public renderSystemdTimersTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${Calendar({ theme: 'outline', size: '20', fill: 'currentColor' })}
            Systemd 定时器
          </span>
          <div class="search-container">
            <input type="text" id="timers-search" class="system-input" placeholder="搜索定时器..." style="width: 150px;" oninput="window.filterTable('timers', this.value)" />
            <button class="system-btn" onclick="document.getElementById('timers-search').value = ''; window.filterTable('timers', '');">清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>定时器</th>
                <th>下次触发</th>
                <th>剩余时间</th>
                <th>上次触发</th>
                <th>触发单元</th>
              </tr>
            </thead>
            <tbody id="timers-table-body">
              <tr><td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">正在加载定时器信息...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  public renderKernelModulesTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${Cpu({ theme: 'outline', size: '20', fill: 'currentColor' })}
            内核模块 (lsmod)
          </span>
          <div class="search-container">
            <input type="text" id="kernelmodules-search" class="system-input" placeholder="搜索模块..." style="width: 150px;" oninput="window.filterTable('kernelmodules', this.value)" />
            <button class="system-btn" onclick="document.getElementById('kernelmodules-search').value = ''; window.filterTable('kernelmodules', '');">清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>模块名</th>
                <th>大小</th>
                <th>引用计数</th>
                <th>风险</th>
              </tr>
            </thead>
            <tbody id="kernelmodules-table-body">
              <tr><td colspan="4" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">正在加载内核模块信息...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  public renderRecentFilesTable(): string {
    return `
      <div class="info-table-container">
        <div class="table-header-toolbar">
          <span class="table-title">
            ${FolderOpen({ theme: 'outline', size: '20', fill: 'currentColor' })}
            最近修改文件 (72h)
          </span>
          <div class="search-container">
            <select id="recentfiles-filter" class="system-select" style="width: 100px;" onchange="window.filterTableByCategory('recentfiles', this.value)">
              <option value="">所有风险</option>
              <option value="high">⚠️ 高危</option>
              <option value="warning">⚡ 可疑</option>
              <option value="normal">正常</option>
            </select>
            <input type="text" id="recentfiles-search" class="system-input" placeholder="搜索文件..." style="width: 150px;" oninput="window.filterTable('recentfiles', this.value)" />
            <button class="system-btn" onclick="document.getElementById('recentfiles-search').value = ''; document.getElementById('recentfiles-filter').value = ''; window.filterTable('recentfiles', '');">清除</button>
          </div>
        </div>
        <div class="table-content">
          <table class="system-table">
            <thead>
              <tr>
                <th>文件路径</th>
                <th>修改时间</th>
                <th>大小</th>
                <th>所有者</th>
                <th>风险</th>
              </tr>
            </thead>
            <tbody id="recentfiles-table-body">
              <tr><td colspan="5" style="padding: var(--spacing-lg); text-align: center; color: var(--text-secondary);">正在加载最近修改文件...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  }
}
