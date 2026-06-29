/**
 * 系统信息渲染器
 * 负责渲染系统信息页面的各个表格和标签页
 */

import type { AppState } from '../../core/app';
import { renderSysSide } from '../systemDetailDrawer';
import {
  List,
  Earth,
  Rocket,
  Calendar,
  User,
  Shield,
  System,
  Time,
  Key,
  History,
  Lock,
  Terminal,
  Config,
  Box,
  DataFile,
  Cpu,
  FolderOpen,
  Whale,
  NetworkTree
} from '@icon-park/svg';

export class SystemInfoRenderer {

  /**
   * 渲染系统信息页面
   */
  public renderSystemInfo(state: AppState): string {
    // 子导航已并入主侧边栏左侧的 section-tree（见 renderSectionTree），
    // 这里只渲染全宽的内容区，默认展示进程详情。
    return `
      <div class="system-info-container">
        <div class="system-info-content" id="system-info-content">
          ${this.renderSystemInfoTab(state, 'processes')}
        </div>
      </div>
    `;
  }

  /**
   * 渲染「系统信息」页内子导航（嵌套在主侧边栏「系统信息」项下方，二级）。
   * 叶子复用 .sidebar-item[data-tab] + window.switchSystemInfoTab + 计数徽标，
   * 因此切换/高亮逻辑沿用原有实现；分类以 .sidebar-subsec 分隔标签呈现，非独立一级分组。
   */
  public renderSidebarSubtree(state: AppState): string {
    const di: any = state.serverInfo?.detailedInfo;
    const countMap: Record<string, any[] | undefined> = {
      processes: di?.processes, network: di?.networkDetails, services: di?.services,
      established: di?.established, openports: di?.openPorts,
      users: di?.users, autostart: di?.autostart, cron: di?.cronJobs, sshkeys: di?.sshKeys,
      loginhistory: di?.loginHistory, suidfiles: di?.suidFiles, autoruns: di?.autoruns,
      firewall: di?.firewallRules, envvars: di?.envVariables, shellconfigs: di?.shellConfigs,
      packages: di?.installedPackages, sudoers: di?.sudoersConfig, timers: di?.systemdTimers,
      kernelmodules: di?.kernelModules, recentfiles: di?.recentFiles, sensitive: di?.sensitiveFiles,
      docker: di?.dockerContainers, kubernetes: di?.kubernetesPods, webapps: di?.webApps,
    };
    const count = (id: string) => countMap[id]?.length || 0;
    const i18 = (fn: any) => fn({ theme: 'outline', size: '18', fill: 'currentColor' });

    // 侧边栏重渲时保留当前激活的 tab 高亮；默认进程详情
    let activeTab = 'processes';
    try {
      activeTab = document.querySelector('.sidebar-item[data-tab].active')?.getAttribute('data-tab') || 'processes';
    } catch { /* 非浏览器环境 */ }

    type Leaf = { id: string; label: string; icon: any };
    const groups: Array<{ id: string; label: string; accent: string; icon: any; items: Leaf[] }> = [
      { id: 'si-realtime', label: '实时状态', accent: '#6db3ff', icon: System, items: [
        { id: 'processes', label: '进程详情', icon: List },
        { id: 'network', label: '网络详情', icon: Earth },
        { id: 'services', label: '系统服务', icon: System },
        { id: 'established', label: '外连排查', icon: NetworkTree },
        { id: 'openports', label: '开放端口', icon: Lock },
      ]},
      { id: 'si-persist', label: '账户与持久化', accent: '#a855f7', icon: User, items: [
        { id: 'users', label: '用户列表', icon: User },
        { id: 'autostart', label: '自启动', icon: Rocket },
        { id: 'cron', label: '计划任务', icon: Time },
        { id: 'sshkeys', label: 'SSH密钥', icon: Key },
        { id: 'loginhistory', label: '登录历史', icon: History },
        { id: 'suidfiles', label: 'SUID文件', icon: Lock },
        { id: 'autoruns', label: '启动项汇总', icon: Rocket },
      ]},
      { id: 'si-security', label: '安全配置', accent: '#f87171', icon: Shield, items: [
        { id: 'firewall', label: '防火墙', icon: Shield },
        { id: 'envvars', label: '环境变量', icon: Terminal },
        { id: 'shellconfigs', label: 'Shell配置', icon: Config },
        { id: 'packages', label: '软件包', icon: Box },
        { id: 'sudoers', label: 'Sudoers', icon: DataFile },
        { id: 'timers', label: '定时器', icon: Calendar },
        { id: 'kernelmodules', label: '内核模块', icon: Cpu },
        { id: 'rootcheck', label: 'Rootkit检查', icon: Shield },
        { id: 'sensitive', label: '敏感文件', icon: Key },
        { id: 'recentfiles', label: '最近文件', icon: FolderOpen },
      ]},
      { id: 'si-workload', label: '工作负载', accent: '#34d399', icon: Box, items: [
        { id: 'docker', label: 'Docker', icon: Whale },
        { id: 'kubernetes', label: 'Kubernetes', icon: NetworkTree },
        { id: 'webapps', label: 'Web应用', icon: Earth },
      ]},
    ];

    return groups.map(g => {
      const leaves = g.items.map(it => {
        const n = count(it.id);
        const active = it.id === activeTab;
        return `
          <button class="sidebar-item sidebar-subitem${active ? ' active' : ''}" type="button" data-tab="${it.id}" title="${it.label}" onclick="window.switchSystemInfoTab && window.switchSystemInfoTab('${it.id}')">
            <span class="sidebar-item-icon">${i18(it.icon)}</span>
            <span class="sidebar-item-label">${it.label}</span>
            ${n > 0 ? `<span class="sidebar-item-badge">${n}</span>` : ''}
          </button>`;
      }).join('');
      return `<div class="sidebar-subsec" style="--accent:${g.accent}">${g.label}</div>${leaves}`;
    }).join('');
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
      case 'docker':
        return this.renderDockerTable();
      case 'kubernetes':
        return this.renderKubernetesTable();
      case 'webapps':
        return this.renderGenericTable('webapps', 'Web 应用/站点', ['类型', '路径/URL', '状态', '配置文件', '运行用户']);
      case 'openports':
        return this.renderGenericTable('openports', '开放端口', ['协议', '地址', '端口', '进程PID', '进程名', '用户']);
      case 'established':
        return this.renderGenericTable('established', '外连排查 (ESTABLISHED)', ['本地地址', '远程地址', '远程端口', '进程PID', '进程名', '用户']);
      case 'autoruns':
        return this.renderGenericTable('autoruns', '启动项汇总', ['类型', '名称', '状态', '路径/命令', '用户']);
      case 'rootcheck':
        return this.renderGenericTable('rootcheck', 'Rootkit 检查', ['检查项', '结果', '详情']);
      case 'sensitive':
        return this.renderGenericTable('sensitive', '敏感文件', ['文件路径', '类型', '权限', '所有者', '修改时间']);
      default:
        return '<p>选择一个标签页查看详细信息</p>';
    }
  }

  // ──────────────────────────────────────────────────────────
  // 通用「系统调查」面板壳（与进程详情同一套 .sys-panel 视觉）
  // 各 tab 复用：面包屑 + 标题计数 + 功能特色统计 chips + 工具栏 + .sys-table。
  // 表格列 / tbody id / 筛选与右键逻辑沿用各自的 updateXTable，不破坏数据流。
  // ──────────────────────────────────────────────────────────
  private static readonly SYS_IC: Record<string, string> = (() => {
    const s = (p: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
    return {
      list: s('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
      globe: s('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
      signal: s('<path d="M4 18v-3M9 18v-7M14 18v-11M19 18V6"/>'),
      link: s('<path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/>'),
      warn: s('<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17.5v.5"/>'),
      gear: s('<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1"/>'),
      check: s('<path d="M20 6L9 17l-5-5"/>'),
      x: s('<circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/>'),
      user: s('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
      terminal: s('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9l3 3-3 3M13 15h4"/>'),
      shield: s('<path d="M12 3l8 3v6c0 4.5-3 8-8 9-5-1-8-4.5-8-9V6z"/>'),
      power: s('<path d="M12 3v9M6.4 6.4a8 8 0 1 0 11.2 0"/>'),
      clock: s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
      ban: s('<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>'),
      key: s('<circle cx="8" cy="12" r="4"/><path d="M12 12h9M17 12v4M21 12v3"/>'),
      file: s('<path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v6h6"/>'),
      skull: s('<path d="M12 3a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14z"/><circle cx="9.3" cy="12" r="1.2"/><circle cx="14.7" cy="12" r="1.2"/>'),
      box: s('<path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/>'),
      cpu: s('<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>'),
    };
  })();

  private static readonly SYS_REFRESH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/></svg>';
  private static readonly SYS_SEARCH_IC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>';

  /**
   * 构建一个「系统调查」面板。
   * @param cfg.tab        tab id（决定 tbody id `${tab}-table-body`、计数 id `${tab}-title-count`、chip id `${tab}-chip-${key}`）
   * @param cfg.chips      功能特色统计卡片（值由 updateSysTabChips 在数据加载后填充）
   * @param cfg.columns    表头列（须与对应 updateXTable 输出的 td 列对齐）
   * @param cfg.toolbar    `.sys-toolbar` 的内部 HTML（搜索 + 各自的筛选控件 + 重置），沿用各 tab 原有筛选逻辑
   */
  private renderSysPanel(cfg: {
    tab: string;
    title: string;
    crumb: string;
    chips?: Array<{ key: string; label: string; tone: string; icon: string }>;
    columns: Array<{ label: string; cls?: string }>;
    toolbar: string;
    actions?: string;
    loadingText?: string;
    side?: boolean;
  }): string {
    const SIC = SystemInfoRenderer.SYS_IC;
    const chips = cfg.chips || [];
    const chipsHtml = chips.map(c => `
      <div class="sys-chip" id="${cfg.tab}-chip-${c.key}-wrap">
        <span class="sys-chip-ico ${c.tone}">${SIC[c.icon] || SIC.list}</span>
        <span class="sys-chip-label">${c.label}</span>
        <span class="sys-chip-val" id="${cfg.tab}-chip-${c.key}">0</span>
      </div>`).join('');
    const ths = cfg.columns.map(c => `<th${c.cls ? ` class="${c.cls}"` : ''}>${c.label}</th>`).join('');
    const panel = `
      <div class="sys-panel">
        <div class="sys-breadcrumb"><span>系统调查</span><span class="sys-bc-sep">/</span><span class="sys-bc-cur">${cfg.crumb}</span></div>

        <div class="sys-panel-head">
          <div class="sys-title-wrap">
            <h2 class="sys-title">${cfg.title}</h2>
            <span class="sys-title-count" id="${cfg.tab}-title-count">0</span>
          </div>
          <div class="sys-head-actions">
            <button class="sys-act-btn" onclick="window.refreshAllSystemInfo?.()">${SystemInfoRenderer.SYS_REFRESH}<span>刷新</span></button>
            ${cfg.actions || ''}
          </div>
        </div>

        ${chips.length ? `<div class="sys-chips">${chipsHtml}</div>` : ''}

        <div class="sys-toolbar">${cfg.toolbar}</div>

        <div class="sys-table-wrap">
          <table class="sys-table">
            <thead><tr>${ths}</tr></thead>
            <tbody id="${cfg.tab}-table-body">
              <tr><td colspan="${cfg.columns.length}" class="sys-empty-cell">${cfg.loadingText || '正在加载...'}</td></tr>
            </tbody>
          </table>
        </div>
      </div>`;
    // 带详情侧栏的 tab：表格 + 右侧常驻可收缩详情侧栏（与进程详情同款）
    return cfg.side ? `<div class="sys-view">${panel}${renderSysSide(cfg.tab)}</div>` : panel;
  }

  /** 生成标准搜索框（沿用 filterTable 过滤逻辑） */
  private sysSearch(tab: string, placeholder: string): string {
    return `<div class="sys-search">${SystemInfoRenderer.SYS_SEARCH_IC}<input type="text" id="${tab}-search" placeholder="${placeholder}" oninput="window.filterTable('${tab}', this.value)"></div>`;
  }

  /** 生成「重置」按钮：清空搜索框与可选的筛选下拉，并重跑过滤 */
  private sysReset(tab: string, filterIds: string[] = []): string {
    const clears = [`var s=document.getElementById('${tab}-search');if(s)s.value='';`]
      .concat(filterIds.map(id => `var f_${id.replace(/[^a-z0-9]/gi, '')}=document.getElementById('${id}');if(f_${id.replace(/[^a-z0-9]/gi, '')})f_${id.replace(/[^a-z0-9]/gi, '')}.value='';`))
      .join('');
    return `<button class="sys-reset" onclick="${clears}window.filterTable('${tab}','');">重置</button>`;
  }

  /**
   * 渲染进程表格
   */
  public renderProcessesTable(): string {
    const ic = (path: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
    const I_REFRESH = ic('<path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 4v5h-5"/>');
    const I_EXPORT = ic('<path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 15v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"/>');
    const I_SEARCH = ic('<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>');
    const I_PROC = ic('<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/>');
    const I_USER = ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>');
    const I_CPU = ic('<rect x="7" y="7" width="10" height="10" rx="1.5"/><path d="M9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>');
    const I_WARN = ic('<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17.5v.5"/>');
    const I_CHEV = ic('<path d="M9 6l6 6-6 6"/>');
    const I_PANEL = ic('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/>');
    const sideCollapsed = (() => { try { return localStorage.getItem('proc-side-collapsed') === 'true'; } catch { return false; } })();

    return `
      <div class="proc-view">
      <div class="sys-panel">
        <div class="sys-breadcrumb"><span>系统调查</span><span class="sys-bc-sep">/</span><span class="sys-bc-cur">进程详情</span></div>

        <div class="sys-panel-head">
          <div class="sys-title-wrap">
            <h2 class="sys-title">运行中的进程</h2>
            <span class="sys-title-count" id="proc-title-count">0</span>
          </div>
          <div class="sys-head-actions">
            <button class="sys-act-btn" onclick="window.refreshAllSystemInfo?.()">${I_REFRESH}<span>刷新</span></button>
            <button class="sys-act-btn" onclick="window.exportProcesses?.()">${I_EXPORT}<span>导出</span></button>
          </div>
        </div>

        <div class="sys-chips">
          <div class="sys-chip"><span class="sys-chip-ico c-proc">${I_PROC}</span><span class="sys-chip-label">进程</span><span class="sys-chip-val" id="proc-chip-total">0</span></div>
          <div class="sys-chip"><span class="sys-chip-ico c-user">${I_USER}</span><span class="sys-chip-label">用户</span><span class="sys-chip-val" id="proc-chip-users">0</span></div>
          <div class="sys-chip"><span class="sys-chip-ico c-cpu">${I_CPU}</span><span class="sys-chip-label">高 CPU</span><span class="sys-chip-val" id="proc-chip-cpu">0</span></div>
          <div class="sys-chip"><span class="sys-chip-ico c-susp">${I_WARN}</span><span class="sys-chip-label">可疑</span><span class="sys-chip-val" id="proc-chip-susp">0</span></div>
        </div>

        <div class="sys-toolbar">
          <div class="sys-search">${I_SEARCH}<input type="text" id="processes-search" placeholder="搜索 PID、用户或命令..." oninput="window.filterTable('processes', this.value)"></div>
          <select id="processes-filter" class="sys-select" onchange="window.filterTableByCategory('processes', this.value)">
            <option value="">全部用户</option>
          </select>
          <select id="processes-stat-filter" class="sys-select" onchange="window.filterTableByStatus('processes', this.value)">
            <option value="">全部状态</option>
            <option value="R">运行 (R)</option>
            <option value="S">休眠 (S)</option>
            <option value="D">不可中断 (D)</option>
            <option value="Z">僵尸 (Z)</option>
            <option value="T">停止 (T)</option>
          </select>
          <div class="sys-seg" id="processes-risk-toggle">
            <button class="sys-seg-opt active" data-risk="all" onclick="window.filterByRisk('processes','all',this)">全部</button>
            <button class="sys-seg-opt" data-risk="suspicious" onclick="window.filterByRisk('processes','suspicious',this)">可疑</button>
          </div>
          <button class="sys-reset" onclick="document.getElementById('processes-search').value='';document.getElementById('processes-filter').value='';document.getElementById('processes-stat-filter').value='';window.filterByRisk('processes','all');window.filterTable('processes','');">重置</button>
        </div>

        <div class="sys-table-wrap">
          <table class="sys-table proc-table">
            <thead>
              <tr>
                <th class="col-risk">风险</th>
                <th class="col-pid">PID</th>
                <th class="col-ppid">PPID</th>
                <th class="col-user">用户</th>
                <th class="col-stat">状态</th>
                <th class="col-cpu">CPU%</th>
                <th class="col-mem">内存%</th>
                <th class="col-time">启动时间</th>
                <th class="col-cmd">命令</th>
              </tr>
            </thead>
            <tbody id="processes-table-body">
              <tr><td colspan="9" class="sys-empty-cell">正在加载进程信息...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <aside class="proc-side${sideCollapsed ? ' collapsed' : ''}" id="proc-side">
        <div class="proc-side-head">
          <span class="proc-side-title">进程详情</span>
          <button class="proc-side-toggle" onclick="window.toggleProcSide()" title="收起 / 展开详情">${I_CHEV}</button>
        </div>
        <div class="proc-side-body" id="proc-side-body">
          <div class="proc-side-empty">
            <span class="proc-side-empty-icon">${I_PANEL}</span>
            <p>点击左侧进程<br>查看详细信息</p>
          </div>
        </div>
        <div class="proc-side-foot" id="proc-side-foot"></div>
      </aside>
      </div>
    `;
  }

  /**
   * 渲染网络表格
   */
  public renderNetworkTable(): string {
    const toolbar = `${this.sysSearch('network', '搜索协议、地址或进程...')}
      <select id="network-filter" class="sys-select" onchange="window.filterTableByCategory('network', this.value)">
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
      ${this.sysReset('network', ['network-filter'])}`;
    return this.renderSysPanel({
      tab: 'network', title: '网络连接', crumb: '网络详情', side: true,
      chips: [
        { key: 'total', label: '连接', tone: 'c-info', icon: 'globe' },
        { key: 'listen', label: 'LISTEN', tone: 'c-ok', icon: 'signal' },
        { key: 'estab', label: 'ESTAB', tone: 'c-net', icon: 'link' },
        { key: 'susp', label: '可疑外连', tone: 'c-susp', icon: 'warn' },
      ],
      columns: [{ label: '协议' }, { label: '本地地址' }, { label: '远程地址' }, { label: '状态' }, { label: 'PID' }, { label: '进程' }],
      toolbar,
      loadingText: '正在加载网络连接信息...',
    });
  }

  /**
   * 渲染系统服务表格
   */
  public renderServicesTable(): string {
    const toolbar = `${this.sysSearch('services', '搜索服务名或描述...')}
      <select id="services-filter" class="sys-select" onchange="window.filterTableByCategory('services', this.value)">
        <option value="">所有状态</option>
        <option value="active">active</option>
        <option value="inactive">inactive</option>
        <option value="failed">failed</option>
        <option value="running">running</option>
        <option value="stopped">stopped</option>
      </select>
      ${this.sysReset('services', ['services-filter'])}`;
    return this.renderSysPanel({
      tab: 'services', title: '系统服务', crumb: '系统服务', side: true,
      chips: [
        { key: 'total', label: '服务', tone: 'c-info', icon: 'gear' },
        { key: 'active', label: '运行中', tone: 'c-ok', icon: 'check' },
        { key: 'failed', label: '失败', tone: 'c-high', icon: 'x' },
        { key: 'inactive', label: '未运行', tone: 'c-warn', icon: 'power' },
      ],
      columns: [{ label: '服务名' }, { label: '状态' }, { label: '启用状态' }, { label: '描述' }],
      toolbar,
      loadingText: '正在加载系统服务信息...',
    });
  }

  /**
   * 渲染用户列表表格
   */
  public renderUsersTable(): string {
    const toolbar = `${this.sysSearch('users', '搜索用户名、UID 或主目录...')}
      <select id="users-filter" class="sys-select" onchange="window.filterTableByCategory('users', this.value)">
        <option value="">所有Shell</option>
        <option value="/bin/bash">/bin/bash</option>
        <option value="/bin/sh">/bin/sh</option>
        <option value="/usr/sbin/nologin">/usr/sbin/nologin</option>
        <option value="/bin/false">/bin/false</option>
        <option value="/usr/bin/zsh">/usr/bin/zsh</option>
        <option value="/bin/dash">/bin/dash</option>
      </select>
      ${this.sysReset('users', ['users-filter'])}`;
    return this.renderSysPanel({
      tab: 'users', title: '系统用户', crumb: '用户列表', side: true,
      chips: [
        { key: 'total', label: '用户', tone: 'c-user', icon: 'user' },
        { key: 'login', label: '可登录', tone: 'c-info', icon: 'terminal' },
        { key: 'root', label: 'root 权限', tone: 'c-warn', icon: 'shield' },
        { key: 'anomaly', label: '异常 UID=0', tone: 'c-susp', icon: 'warn' },
      ],
      columns: [{ label: '用户名' }, { label: 'UID' }, { label: 'GID' }, { label: '主目录' }, { label: 'Shell' }],
      toolbar,
      loadingText: '正在加载用户信息...',
    });
  }

  /**
   * 渲染自启动服务表格
   */
  public renderAutostartTable(): string {
    const toolbar = `${this.sysSearch('autostart', '搜索服务名或命令...')}${this.sysReset('autostart')}`;
    return this.renderSysPanel({
      tab: 'autostart', title: '自启动服务', crumb: '自启动', side: true,
      chips: [
        { key: 'total', label: '自启动项', tone: 'c-info', icon: 'power' },
        { key: 'enabled', label: '已启用', tone: 'c-ok', icon: 'check' },
        { key: 'disabled', label: '已禁用', tone: 'c-warn', icon: 'x' },
      ],
      columns: [{ label: '服务名' }, { label: '命令' }, { label: '状态' }, { label: '类型' }],
      toolbar,
      loadingText: '正在加载自启动服务信息...',
    });
  }

  /**
   * 渲染计划任务表格
   */
  public renderCronTable(): string {
    const toolbar = `${this.sysSearch('cron', '搜索用户、时间表或命令...')}${this.sysReset('cron')}`;
    return this.renderSysPanel({
      tab: 'cron', title: '计划任务', crumb: '计划任务', side: true,
      chips: [
        { key: 'total', label: '任务', tone: 'c-info', icon: 'clock' },
        { key: 'susp', label: '可疑命令', tone: 'c-susp', icon: 'warn' },
      ],
      columns: [{ label: '用户' }, { label: '时间表' }, { label: '命令' }],
      toolbar,
      loadingText: '正在加载计划任务信息...',
    });
  }

  /**
   * 渲染防火墙表格
   */
  public renderFirewallTable(): string {
    const toolbar = `${this.sysSearch('firewall', '搜索链、地址或选项...')}
      <select id="firewall-type-filter" class="sys-select" onchange="window.filterTableByCategory('firewall', this.value)">
        <option value="">所有规则</option>
        <option value="iptables">iptables</option>
        <option value="firewalld">firewalld</option>
        <option value="ufw">UFW</option>
      </select>
      ${this.sysReset('firewall', ['firewall-type-filter'])}`;
    return this.renderSysPanel({
      tab: 'firewall', title: '防火墙规则', crumb: '防火墙', side: true,
      chips: [
        { key: 'total', label: '规则', tone: 'c-info', icon: 'shield' },
        { key: 'accept', label: '放行', tone: 'c-ok', icon: 'check' },
        { key: 'drop', label: '拦截', tone: 'c-high', icon: 'ban' },
      ],
      columns: [{ label: '链' }, { label: '目标' }, { label: '协议' }, { label: '源地址' }, { label: '目标地址' }, { label: '选项' }],
      toolbar,
      loadingText: '正在加载防火墙规则信息...',
    });
  }

  // ==================== 新增应急响应增强栏目渲染 ====================

  public renderSSHKeysTable(): string {
    const toolbar = `${this.sysSearch('sshkeys', '搜索用户、类型或文件...')}${this.sysReset('sshkeys')}`;
    return this.renderSysPanel({
      tab: 'sshkeys', title: 'SSH 授权密钥', crumb: 'SSH密钥', side: true,
      chips: [
        { key: 'total', label: '密钥', tone: 'c-key', icon: 'key' },
        { key: 'users', label: '涉及用户', tone: 'c-user', icon: 'user' },
      ],
      columns: [{ label: '用户' }, { label: '密钥类型' }, { label: '公钥内容' }, { label: '备注' }, { label: '文件路径' }],
      toolbar,
      loadingText: '正在加载SSH密钥信息...',
    });
  }

  public renderLoginHistoryTable(): string {
    const toolbar = `${this.sysSearch('loginhistory', '搜索用户、终端或来源IP...')}
      <select id="loginhistory-filter" class="sys-select" onchange="window.filterTableByCategory('loginhistory', this.value)">
        <option value="">所有状态</option>
        <option value="active">在线</option>
        <option value="login">已登录</option>
        <option value="failed">失败</option>
      </select>
      ${this.sysReset('loginhistory', ['loginhistory-filter'])}`;
    return this.renderSysPanel({
      tab: 'loginhistory', title: '登录历史', crumb: '登录历史', side: true,
      chips: [
        { key: 'total', label: '记录', tone: 'c-info', icon: 'clock' },
        { key: 'active', label: '在线', tone: 'c-ok', icon: 'check' },
        { key: 'failed', label: '失败登录', tone: 'c-high', icon: 'x' },
      ],
      columns: [{ label: '用户' }, { label: '终端' }, { label: '来源IP' }, { label: '登录时间' }, { label: '状态' }],
      toolbar,
      loadingText: '正在加载登录历史...',
    });
  }

  public renderSUIDFilesTable(): string {
    const toolbar = `${this.sysSearch('suidfiles', '搜索文件路径或所有者...')}
      <select id="suidfiles-filter" class="sys-select" onchange="window.filterTableByCategory('suidfiles', this.value)">
        <option value="">所有风险</option>
        <option value="high">⚠️ 高危</option>
        <option value="normal">正常</option>
      </select>
      ${this.sysReset('suidfiles', ['suidfiles-filter'])}`;
    return this.renderSysPanel({
      tab: 'suidfiles', title: 'SUID/SGID 特权文件', crumb: 'SUID文件', side: true,
      chips: [
        { key: 'total', label: '特权文件', tone: 'c-info', icon: 'file' },
        { key: 'high', label: '高危', tone: 'c-high', icon: 'skull' },
        { key: 'warn', label: '可疑', tone: 'c-warn', icon: 'warn' },
      ],
      columns: [{ label: '文件路径' }, { label: '权限' }, { label: '所有者' }, { label: '大小' }, { label: '修改时间' }, { label: '风险' }],
      toolbar,
      loadingText: '正在加载SUID文件信息...',
    });
  }

  public renderEnvVariablesTable(): string {
    const toolbar = `${this.sysSearch('envvars', '搜索变量名或值...')}${this.sysReset('envvars')}`;
    return this.renderSysPanel({
      tab: 'envvars', title: '环境变量', crumb: '环境变量', side: true,
      chips: [
        { key: 'total', label: '变量', tone: 'c-info', icon: 'terminal' },
        { key: 'high', label: '高危', tone: 'c-high', icon: 'warn' },
        { key: 'warn', label: '可疑', tone: 'c-warn', icon: 'warn' },
      ],
      columns: [{ label: '变量名' }, { label: '值' }, { label: '风险' }],
      toolbar,
      loadingText: '正在加载环境变量...',
    });
  }

  public renderShellConfigsTable(): string {
    const I = SystemInfoRenderer.SYS_IC;
    const chip = (key: string, label: string, tone: string, icon: string) => `
      <div class="sys-chip" id="shellconfigs-chip-${key}-wrap">
        <span class="sys-chip-ico ${tone}">${I[icon] || I.list}</span>
        <span class="sys-chip-label">${label}</span>
        <span class="sys-chip-val" id="shellconfigs-chip-${key}">0</span>
      </div>`;
    return `
      <div class="sys-panel shc-panel">
        <div class="sys-breadcrumb"><span>系统调查</span><span class="sys-bc-sep">/</span><span class="sys-bc-cur">Shell配置</span></div>

        <div class="sys-panel-head">
          <div class="sys-title-wrap">
            <h2 class="sys-title">Shell 配置</h2>
            <span class="sys-title-count" id="shellconfigs-title-count">0</span>
          </div>
          <div class="sys-head-actions">
            <button class="sys-act-btn" onclick="window.refreshAllSystemInfo?.()">${SystemInfoRenderer.SYS_REFRESH}<span>刷新</span></button>
          </div>
        </div>

        <div class="sys-chips">
          ${chip('total', '配置文件', 'c-info', 'file')}
          ${chip('susp', '可疑行', 'c-warn', 'warn')}
          ${chip('high', '高危', 'c-high', 'skull')}
        </div>

        <div class="shc-toolbar">
          <div class="sys-search">${SystemInfoRenderer.SYS_SEARCH_IC}<input type="text" id="shellconfigs-search" placeholder="在当前文件内搜索..." oninput="window.shcFilterLines && window.shcFilterLines(this.value)"></div>
          <label class="shc-toggle"><input type="checkbox" id="shc-only-susp" onchange="window.shcToggleOnlySusp && window.shcToggleOnlySusp(this.checked)"><span>只看可疑行</span></label>
          <span class="shc-hint">右键可疑行可查看上下文 / 注释 / 备份</span>
        </div>

        <div class="shc-body">
          <aside class="shc-files" id="shc-files">
            <div class="shc-empty">正在加载 Shell 配置...</div>
          </aside>
          <section class="shc-viewer" id="shc-viewer">
            <div class="shc-viewer-empty">
              <span class="shc-viewer-empty-ico">${SystemInfoRenderer.SYS_IC.file}</span>
              <p>从左侧选择一个配置文件查看全文<br>可疑行会自动高亮标注</p>
            </div>
          </section>
        </div>
      </div>`;
  }

  public renderInstalledPackagesTable(): string {
    const toolbar = `${this.sysSearch('packages', '搜索软件包名或版本...')}${this.sysReset('packages')}`;
    return this.renderSysPanel({
      tab: 'packages', title: '最近安装的软件包', crumb: '软件包', side: true,
      columns: [{ label: '软件包名' }, { label: '版本' }, { label: '安装时间' }, { label: '来源' }],
      toolbar,
      loadingText: '正在加载软件包信息...',
    });
  }

  public renderSudoersTable(): string {
    const toolbar = `${this.sysSearch('sudoers', '搜索用户、命令或来源...')}${this.sysReset('sudoers')}`;
    return this.renderSysPanel({
      tab: 'sudoers', title: 'Sudoers 权限配置', crumb: 'Sudoers', side: true,
      chips: [
        { key: 'total', label: '条目', tone: 'c-info', icon: 'shield' },
        { key: 'nopasswd', label: '免密', tone: 'c-susp', icon: 'warn' },
      ],
      columns: [{ label: '用户/组' }, { label: '主机' }, { label: '命令' }, { label: '免密' }, { label: '来源' }],
      toolbar,
      loadingText: '正在加载Sudoers配置...',
    });
  }

  public renderSystemdTimersTable(): string {
    const toolbar = `${this.sysSearch('timers', '搜索定时器或触发单元...')}${this.sysReset('timers')}`;
    return this.renderSysPanel({
      tab: 'timers', title: 'Systemd 定时器', crumb: '定时器', side: true,
      columns: [{ label: '定时器' }, { label: '下次触发' }, { label: '剩余时间' }, { label: '上次触发' }, { label: '触发单元' }],
      toolbar,
      loadingText: '正在加载定时器信息...',
    });
  }

  public renderKernelModulesTable(): string {
    const toolbar = `${this.sysSearch('kernelmodules', '搜索模块名...')}${this.sysReset('kernelmodules')}`;
    return this.renderSysPanel({
      tab: 'kernelmodules', title: '内核模块', crumb: '内核模块', side: true,
      chips: [
        { key: 'total', label: '模块', tone: 'c-info', icon: 'cpu' },
        { key: 'susp', label: '可疑', tone: 'c-susp', icon: 'warn' },
      ],
      columns: [{ label: '模块名' }, { label: '大小' }, { label: '引用计数' }, { label: '风险' }],
      toolbar,
      loadingText: '正在加载内核模块信息...',
    });
  }

  public renderRecentFilesTable(): string {
    const toolbar = `${this.sysSearch('recentfiles', '搜索文件路径或所有者...')}
      <select id="recentfiles-filter" class="sys-select" onchange="window.filterTableByCategory('recentfiles', this.value)">
        <option value="">所有风险</option>
        <option value="high">⚠️ 高危</option>
        <option value="warning">⚡ 可疑</option>
        <option value="normal">正常</option>
      </select>
      ${this.sysReset('recentfiles', ['recentfiles-filter'])}`;
    return this.renderSysPanel({
      tab: 'recentfiles', title: '最近修改文件 (72h)', crumb: '最近文件', side: true,
      chips: [
        { key: 'total', label: '文件', tone: 'c-info', icon: 'file' },
        { key: 'high', label: '高危', tone: 'c-high', icon: 'skull' },
        { key: 'warn', label: '可疑', tone: 'c-warn', icon: 'warn' },
      ],
      columns: [{ label: '文件路径' }, { label: '修改时间' }, { label: '大小' }, { label: '所有者' }, { label: '风险' }],
      toolbar,
      loadingText: '正在加载最近修改文件...',
    });
  }

  // ──── Generic Table (复用 sys-panel 模板，搜索走 searchInTable) ────
  private renderGenericTable(id: string, title: string, columns: string[]): string {
    // 面包屑用简短标题（去掉括号补充说明）
    const crumb = title.replace(/\s*[（(].*$/, '');
    const toolbar = `<div class="sys-search">${SystemInfoRenderer.SYS_SEARCH_IC}<input type="text" id="${id}-search" placeholder="搜索..." oninput="window.searchInTable('${id}', this.value)"></div>
      <button class="sys-reset" onclick="var s=document.getElementById('${id}-search');if(s)s.value='';window.searchInTable('${id}','');">重置</button>`;
    return this.renderSysPanel({
      tab: id,
      title,
      crumb,
      columns: columns.map(c => ({ label: c })),
      toolbar,
      loadingText: '点击加载...',
    });
  }

  // ──── Docker Table ────
  private renderDockerTable(): string {
    const toolbar = `<div class="sys-search">${SystemInfoRenderer.SYS_SEARCH_IC}<input type="text" id="docker-search" placeholder="搜索容器名或镜像..." oninput="window.searchInTable('docker', this.value)"></div>
      <button class="sys-reset" onclick="var s=document.getElementById('docker-search');if(s)s.value='';window.searchInTable('docker','');">重置</button>`;
    return this.renderSysPanel({
      tab: 'docker', title: 'Docker 容器', crumb: 'Docker',
      columns: [{ label: 'ID' }, { label: '名称' }, { label: '镜像' }, { label: '状态' }, { label: '端口' }, { label: '创建时间' }],
      toolbar,
      loadingText: '点击此 Tab 加载 Docker 容器列表',
    });
  }

  // ──── Kubernetes Table ────
  private renderKubernetesTable(): string {
    const toolbar = `<div class="sys-search">${SystemInfoRenderer.SYS_SEARCH_IC}<input type="text" id="kubernetes-search" placeholder="搜索 Pod 或命名空间..." oninput="window.searchInTable('kubernetes', this.value)"></div>
      <button class="sys-reset" onclick="var s=document.getElementById('kubernetes-search');if(s)s.value='';window.searchInTable('kubernetes','');">重置</button>`;
    return this.renderSysPanel({
      tab: 'kubernetes', title: 'Kubernetes Pods', crumb: 'Kubernetes',
      columns: [{ label: 'Namespace' }, { label: '名称' }, { label: 'Ready' }, { label: '状态' }, { label: '重启' }, { label: 'Age' }],
      toolbar,
      loadingText: '点击此 Tab 加载 K8s Pod 列表',
    });
  }
}
