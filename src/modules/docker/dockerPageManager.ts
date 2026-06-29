import { dockerManager } from './dockerManager';
import { showConfirm } from '../ui/confirmDialog';
import type {
  DockerContainerSummary,
  DockerCopyDirection,
  DockerCopyRequest,
  DockerImage,
  DockerNetwork,
  DockerVolume,
  DockerComposeProject,
  DockerOverviewStats,
  DockerMainTab,
  DockerSecurityAuditResult,
  DockerDiskUsage,
  DockerSystemInfo,
} from './types';
import { sshConnectionManager } from '../remote/sshConnectionManager';
import { DockerLogsModal, DockerFileModal } from '../ui/dockerModals';
import {
  Whale, Refresh, Shield, Fire,
  Delete, SettingConfig, Cube, Config,
  NetworkTree, Data
} from '@icon-park/svg';

const AUTO_REFRESH_INTERVAL = 30000;
const SEARCH_DEBOUNCE = 200;

const icon = (fn: any, size = '16', theme = 'outline') =>
  fn({ theme, size, fill: 'currentColor' });

const ICONS = {
  start: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`,
  stop: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`,
  restart: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
  terminal: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>`,
  logs: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
  inspect: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`,
  edit: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
  copy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
};

export class DockerPageManager {
  // State
  private containers: DockerContainerSummary[] = [];
  private filtered: DockerContainerSummary[] = [];
  private images: DockerImage[] = [];
  private networks: DockerNetwork[] = [];
  private volumes: DockerVolume[] = [];
  private composeProjects: DockerComposeProject[] = [];
  private overviewStats: DockerOverviewStats | null = null;
  private auditResult: DockerSecurityAuditResult | null = null;
  private diskUsage: DockerDiskUsage | null = null;
  private systemInfo: DockerSystemInfo | null = null;
  private currentTab: DockerMainTab = 'overview';
  private searchTerm = '';
  private initialized = false;
  private loading = false;
  private autoRefreshTimer: number | null = null;
  private autoRefreshEnabled = false;
  private logsModal = new DockerLogsModal();
  private fileModal = new DockerFileModal();
  private globalEventsBound = false;
  private searchDebounceTimer: number | null = null;
  private boundClickHandler: ((e: Event) => void) | null = null;
  private boundInputHandler: ((e: Event) => void) | null = null;

  // ============================================================
  // Lifecycle
  // ============================================================

  initialize(): void {
    if (this.initialized) return;
    this.bindEvents();
    this.initialized = true;
    (window as any).dockerPageManager = this;
  }

  async refresh(showNotification = false): Promise<void> {
    if (!sshConnectionManager.isConnected()) {
      this.renderDisconnected();
      return;
    }
    if (this.loading) return; // 防止并发刷新

    try {
      this.loading = true;
      this.updateContentArea();

      // Always fetch containers
      this.containers = await dockerManager.listContainers();
      this.applyFilter();

      // Fetch tab-specific data
      await this.fetchTabData();

      if (showNotification) {
        window.showNotification?.('Docker 数据已刷新', 'success');
      }
    } catch (error) {
      console.error('刷新 Docker 数据失败', error);
      window.showNotification?.(`刷新失败: ${error}`, 'error');
    } finally {
      this.loading = false;
      this.renderFullPage();
    }
  }

  deactivate(): void {
    this.stopAutoRefresh();
    if (this.searchDebounceTimer) {
      clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }
    if (this.boundClickHandler) {
      document.removeEventListener('click', this.boundClickHandler);
      this.boundClickHandler = null;
    }
    if (this.boundInputHandler) {
      document.removeEventListener('input', this.boundInputHandler);
      this.boundInputHandler = null;
    }
    this.globalEventsBound = false;
  }

  // ============================================================
  // Full Page Render
  // ============================================================

  renderPage(): string {
    return `
    <div class="docker-page">
      ${this.renderHeader()}
      <div id="docker-tabs-area">${this.renderTabs()}</div>
      <div id="docker-content-area" class="docker-content">
        ${this.loading ? this.renderLoading() : this.renderCurrentTab()}
      </div>
    </div>`;
  }

  private renderFullPage(): void {
    // Update tabs (for active state)
    const tabsArea = document.getElementById('docker-tabs-area');
    if (tabsArea) tabsArea.innerHTML = this.renderTabs();
    // Update content
    const contentArea = document.getElementById('docker-content-area');
    if (contentArea) {
      contentArea.innerHTML = this.loading ? this.renderLoading() : this.renderCurrentTab();
    }
  }

  private updateContentArea(): void {
    const el = document.getElementById('docker-content-area');
    if (el) el.innerHTML = this.renderLoading();
  }

  // ============================================================
  // Header
  // ============================================================

  private renderHeader(): string {
    return `
    <div class="docker-header">
      <div class="docker-header-left">
        <div class="docker-header-icon">${icon(Whale, '24', 'filled')}</div>
        <div>
          <h2 class="docker-header-title">Docker 管理</h2>
          <div class="docker-header-subtitle">容器编排与应急响应</div>
        </div>
      </div>
      <div class="docker-header-right">
        <input type="text" class="docker-search-input" placeholder="搜索容器 / 镜像..." value="${this.searchTerm}" data-docker-action="search" autocomplete="off" />
        <button class="modern-btn secondary" data-docker-action="refresh" style="display:flex;align-items:center;gap:6px;">
          ${icon(Refresh, '16')} 刷新
        </button>
        <button class="modern-btn ${this.autoRefreshEnabled ? 'primary' : 'secondary'}" data-docker-action="toggle-auto-refresh" style="display:flex;align-items:center;gap:6px;">
          ${this.autoRefreshEnabled ? '自动刷新·开' : '自动刷新·关'}
        </button>
      </div>
    </div>`;
  }

  // ============================================================
  // Tabs
  // ============================================================

  private renderTabs(): string {
    const tabs: { id: DockerMainTab; label: string; iconFn: any }[] = [
      { id: 'overview', label: '概览', iconFn: Whale },
      { id: 'containers', label: '容器', iconFn: Cube },
      { id: 'images', label: '镜像', iconFn: Data },
      { id: 'networks', label: '网络', iconFn: NetworkTree },
      { id: 'volumes', label: '卷', iconFn: Config },
      { id: 'compose', label: 'Compose', iconFn: SettingConfig },
      { id: 'security', label: '安全', iconFn: Shield },
    ];

    return `
    <div class="docker-tabs">
      ${tabs.map(tab => `
        <button class="docker-tab-btn ${this.currentTab === tab.id ? 'active' : ''}"
                data-docker-action="switch-tab" data-tab="${tab.id}">
          ${icon(tab.iconFn, '16', this.currentTab === tab.id ? 'filled' : 'outline')}
          ${tab.label}
        </button>
      `).join('')}
    </div>`;
  }

  // ============================================================
  // Tab Routing
  // ============================================================

  private renderCurrentTab(): string {
    if (!sshConnectionManager.isConnected()) {
      return this.renderDisconnectedInline();
    }
    switch (this.currentTab) {
      case 'overview': return this.renderOverviewTab();
      case 'containers': return this.renderContainersTab();
      case 'images': return this.renderImagesTab();
      case 'networks': return this.renderNetworksTab();
      case 'volumes': return this.renderVolumesTab();
      case 'compose': return this.renderComposeTab();
      case 'security': return this.renderSecurityTab();
      default: return this.renderOverviewTab();
    }
  }

  private async fetchTabData(): Promise<void> {
    switch (this.currentTab) {
      case 'overview': {
        const results = await Promise.allSettled([
          dockerManager.getOverviewStats(),
          dockerManager.getDiskUsage(),
          dockerManager.getSystemInfo()
        ]);
        this.overviewStats = results[0].status === 'fulfilled' ? results[0].value : null;
        this.diskUsage = results[1].status === 'fulfilled' ? results[1].value : null;
        this.systemInfo = results[2].status === 'fulfilled' ? results[2].value : null;
        break;
      }
      case 'images':
        this.images = await dockerManager.listImages();
        break;
      case 'networks':
        this.networks = await dockerManager.listNetworks();
        break;
      case 'volumes':
        this.volumes = await dockerManager.listVolumes();
        break;
      case 'compose':
        this.composeProjects = await dockerManager.listComposeProjects();
        break;
    }
  }

  // ============================================================
  // OVERVIEW TAB
  // ============================================================

  private renderOverviewTab(): string {
    const s = this.overviewStats || {
      totalContainers: 0, runningContainers: 0, stoppedContainers: 0, pausedContainers: 0,
      totalImages: 0, totalNetworks: 0, totalVolumes: 0, privilegedContainers: 0,
      unhealthyContainers: 0, totalCpuPercent: 0, totalMemoryPercent: 0
    };

    const warningBanner = (s.privilegedContainers > 0 || s.unhealthyContainers > 0) ? `
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.3);border-radius:var(--border-radius-lg);padding:10px var(--spacing-lg);margin-bottom:var(--spacing-md);display:flex;align-items:center;gap:var(--spacing-sm);font-size:13px;">
        ${icon(Fire, '16')} <span style="color:var(--warning-color);font-weight:600;">
          ${s.privilegedContainers > 0 ? `${s.privilegedContainers} 个特权容器` : ''}
          ${s.privilegedContainers > 0 && s.unhealthyContainers > 0 ? ' · ' : ''}
          ${s.unhealthyContainers > 0 ? `${s.unhealthyContainers} 个不健康容器` : ''}
        </span>
        <button class="modern-btn secondary" data-docker-action="switch-tab" data-tab="security" style="margin-left:auto;font-size:12px;padding:4px 12px;">查看安全详情</button>
      </div>` : '';

    const cpuClass = s.totalCpuPercent > 80 ? 'danger' : s.totalCpuPercent > 50 ? 'warning' : 'good';
    const memClass = s.totalMemoryPercent > 80 ? 'danger' : s.totalMemoryPercent > 50 ? 'warning' : 'primary';

    return `
    ${warningBanner}
    <div class="docker-stats">
      ${this.renderStatCard('容器总数', `${s.totalContainers}`, 'var(--primary-color)', `${s.runningContainers} 运行中`)}
      ${this.renderStatCard('运行中', `${s.runningContainers}`, 'var(--success-color)', `${s.stoppedContainers} 已停止`)}
      ${this.renderStatCard('镜像', `${s.totalImages}`, 'var(--primary-color)', '')}
      ${this.renderStatCard('网络', `${s.totalNetworks}`, 'var(--primary-color)', '')}
      ${this.renderStatCard('卷', `${s.totalVolumes}`, 'var(--primary-color)', '')}
      ${this.renderStatCard('特权容器', `${s.privilegedContainers}`, s.privilegedContainers > 0 ? 'var(--error-color)' : 'var(--success-color)', s.privilegedContainers > 0 ? '安全风险' : '安全')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing-md);margin-top:var(--spacing-md);">
      <div class="docker-card">
        <h3>资源使用率</h3>
        <div style="display:flex;flex-direction:column;gap:var(--spacing-md);">
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span>CPU</span><span>${s.totalCpuPercent}%</span></div>
            <div class="docker-progress-bar"><div class="docker-progress-fill ${cpuClass}" style="width:${Math.min(s.totalCpuPercent, 100)}%;"></div></div>
          </div>
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;"><span>Memory</span><span>${s.totalMemoryPercent}%</span></div>
            <div class="docker-progress-bar"><div class="docker-progress-fill ${memClass}" style="width:${Math.min(s.totalMemoryPercent, 100)}%;"></div></div>
          </div>
        </div>
      </div>

      <div class="docker-card">
        <h3>Docker 信息</h3>
        <div style="display:grid;grid-template-columns:auto 1fr;gap:6px 16px;font-size:13px;">
          <span style="color:var(--text-secondary);">版本</span><span>${this.systemInfo?.serverVersion || '-'}</span>
          <span style="color:var(--text-secondary);">存储驱动</span><span>${this.systemInfo?.storageDriver || '-'}</span>
          <span style="color:var(--text-secondary);">CPU</span><span>${this.systemInfo?.cpus || '-'} 核</span>
          <span style="color:var(--text-secondary);">内存</span><span>${this.systemInfo?.totalMemory || '-'}</span>
          <span style="color:var(--text-secondary);">运行时</span><span>${this.systemInfo?.runtimeName || '-'}</span>
        </div>
      </div>
    </div>

    ${this.diskUsage ? `
    <div class="docker-card" style="margin-top:var(--spacing-md);">
      <h3>磁盘使用</h3>
      <div class="docker-disk-usage-grid">
        <div class="docker-disk-item">
          <div class="docker-disk-item-title">镜像</div>
          <div class="docker-disk-item-value">${this.diskUsage.images.totalSize}</div>
          <div class="docker-disk-item-sub">可回收: ${this.diskUsage.images.reclaimable}</div>
        </div>
        <div class="docker-disk-item">
          <div class="docker-disk-item-title">容器</div>
          <div class="docker-disk-item-value">${this.diskUsage.containers.totalSize}</div>
          <div class="docker-disk-item-sub">可回收: ${this.diskUsage.containers.reclaimable}</div>
        </div>
        <div class="docker-disk-item">
          <div class="docker-disk-item-title">卷</div>
          <div class="docker-disk-item-value">${this.diskUsage.volumes.totalSize}</div>
          <div class="docker-disk-item-sub">可回收: ${this.diskUsage.volumes.reclaimable}</div>
        </div>
        <div class="docker-disk-item">
          <div class="docker-disk-item-title">构建缓存</div>
          <div class="docker-disk-item-value">${this.diskUsage.buildCache.totalSize}</div>
          <div class="docker-disk-item-sub">可回收: ${this.diskUsage.buildCache.reclaimable}</div>
        </div>
      </div>
      <div style="margin-top:var(--spacing-md);display:flex;gap:var(--spacing-sm);">
        <button class="modern-btn secondary" data-docker-action="prune-system" style="font-size:12px;">清理未使用资源</button>
        <button class="modern-btn danger" data-docker-action="prune-system-all" style="font-size:12px;">深度清理 (含所有镜像)</button>
      </div>
    </div>` : ''}`;
  }

  // ============================================================
  // CONTAINERS TAB
  // ============================================================

  private renderContainersTab(): string {
    const containers = this.filtered;
    if (containers.length === 0) {
      return `<div style="padding:60px;text-align:center;color:var(--text-secondary);">
        <div style="font-size:40px;margin-bottom:12px;">🐳</div>
        <div style="font-size:16px;font-weight:500;color:var(--text-primary);margin-bottom:4px;">没有匹配的容器</div>
        <div style="font-size:13px;">尝试修改搜索条件，或检查 Docker 服务是否正常运行。</div>
      </div>`;
    }

    // Stats bar
    const total = containers.length;
    const running = containers.filter(c => c.state === 'running').length;
    const privileged = containers.filter(c => c.quickChecks?.privileged).length;

    const statsBar = `
    <div class="docker-stats" style="margin-bottom:var(--spacing-md);">
      ${this.renderStatCard('总数', `${total}`, 'var(--primary-color)', '')}
      ${this.renderStatCard('运行中', `${running}`, 'var(--success-color)', '')}
      ${this.renderStatCard('已停止', `${total - running}`, total - running > 0 ? 'var(--warning-color)' : 'var(--text-secondary)', '')}
      ${this.renderStatCard('特权', `${privileged}`, privileged > 0 ? 'var(--error-color)' : 'var(--success-color)', '')}
    </div>`;

    // Card grid
    const cards = containers.map(c => this.renderContainerCard(c)).join('');
    return statsBar + `<div class="docker-grid">${cards}</div>`;
  }

  private renderContainerCard(c: DockerContainerSummary): string {
    const isRunning = c.state === 'running';
    const statusClass = isRunning ? 'status-running' : c.state === 'paused' ? 'status-paused' : 'status-stopped';
    const cpu = c.cpuPercent != null ? `${c.cpuPercent.toFixed(1)}%` : '--';
    const memory = (c.memoryUsage ?? '--').split(' / ')[0];
    const netMode = c.networkMode ?? '未知';
    const firstIP = c.networks[0]?.ipv4Address ?? '无';

    const portChips = c.ports.length
      ? c.ports.slice(0, 3).map(p => `<span class="docker-chip port">${p.publicPort ?? '*'}→${p.privatePort}</span>`).join('')
        + (c.ports.length > 3 ? `<span class="docker-chip port-more">+${c.ports.length - 3}</span>` : '')
      : '<span class="docker-chip muted">无端口</span>';

    const primaryAction = isRunning
      ? `<button class="docker-icon-btn stop" data-docker-action="stop" data-container="${c.name}" title="停止">${ICONS.stop}</button>
         <button class="docker-icon-btn restart" data-docker-action="restart" data-container="${c.name}" title="重启">${ICONS.restart}</button>`
      : `<button class="docker-icon-btn start" data-docker-action="start" data-container="${c.name}" title="启动">${ICONS.start}</button>`;

    const terminalBtn = isRunning
      ? `<button class="docker-icon-btn terminal" data-docker-action="terminal" data-container="${c.name}" title="终端">${ICONS.terminal}</button>` : '';

    return `
    <div class="docker-container-card">
      <div class="docker-card-header">
        <div class="docker-identity">
          <h3>${c.name}</h3>
          <div class="docker-image" title="${c.image}">${c.image}</div>
        </div>
        <div class="docker-status-wrapper">
          <span class="docker-status-dot ${statusClass}"></span>
          <span class="docker-status-text ${statusClass}">${c.state}</span>
        </div>
      </div>
      <div class="docker-card-body">
        <div class="docker-metrics-row">
          <div class="metric-box"><span class="metric-label">CPU</span><span class="metric-value">${cpu}</span></div>
          <div class="metric-box"><span class="metric-label">MEM</span><span class="metric-value">${memory}</span></div>
          <div class="metric-box"><span class="metric-label">NET</span><span class="metric-value">${netMode}</span></div>
        </div>
        <div class="docker-info-row">
          <div class="info-label">IP: ${firstIP}</div>
          <div class="docker-chip-group">${portChips}</div>
        </div>
      </div>
      <div class="docker-card-footer">
        <div class="docker-action-group primary">${primaryAction}</div>
        <div class="docker-action-divider"></div>
        <div class="docker-action-group tools">
          ${terminalBtn}
          <button class="docker-icon-btn" data-docker-action="logs" data-container="${c.name}" title="日志">${ICONS.logs}</button>
          <button class="docker-icon-btn" data-docker-action="inspect" data-container="${c.name}" title="详情">${ICONS.inspect}</button>
          <button class="docker-icon-btn" data-docker-action="edit" data-container="${c.name}" title="编辑文件">${ICONS.edit}</button>
          <button class="docker-icon-btn" data-docker-action="copy" data-container="${c.name}" title="复制文件">${ICONS.copy}</button>
        </div>
      </div>
    </div>`;
  }

  // ============================================================
  // IMAGES TAB
  // ============================================================

  private renderImagesTab(): string {
    if (this.images.length === 0) return this.renderEmptyInline('暂无镜像数据', '请点击刷新按钮加载镜像列表，或检查 Docker 服务状态');

    const filtered = this.searchTerm
      ? this.images.filter(i => `${i.repository} ${i.tag} ${i.shortId}`.toLowerCase().includes(this.searchTerm))
      : this.images;

    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--spacing-md);">
      <span style="font-size:13px;color:var(--text-secondary);">${filtered.length} 个镜像</span>
      <button class="modern-btn secondary" data-docker-action="prune-images" style="font-size:12px;">清理悬空镜像</button>
    </div>
    <div class="docker-card"><div style="overflow-x:auto;">
      <table class="docker-table">
        <thead><tr><th>仓库</th><th>标签</th><th>ID</th><th>大小</th><th>创建时间</th><th style="text-align:right;">操作</th></tr></thead>
        <tbody>${filtered.map(img => `
          <tr>
            <td class="cell-name">${img.repository}</td>
            <td><span class="docker-chip">${img.tag}</span></td>
            <td class="cell-mono cell-secondary">${img.shortId}</td>
            <td>${img.size}</td>
            <td class="cell-secondary">${img.created}</td>
            <td class="cell-actions">
              <button class="docker-icon-btn danger" title="删除" data-docker-action="remove-image" data-image="${img.repository}:${img.tag}">${icon(Delete)}</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div></div>`;
  }

  // ============================================================
  // NETWORKS TAB
  // ============================================================

  private renderNetworksTab(): string {
    if (this.networks.length === 0) return this.renderEmptyInline('暂无网络数据', '请点击刷新按钮加载网络列表，或检查 Docker 服务状态');

    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--spacing-md);">
      <span style="font-size:13px;color:var(--text-secondary);">${this.networks.length} 个网络</span>
      <button class="modern-btn secondary" data-docker-action="prune-networks" style="font-size:12px;">清理未使用网络</button>
    </div>
    <div class="docker-card"><div style="overflow-x:auto;">
      <table class="docker-table">
        <thead><tr><th>名称</th><th>ID</th><th>驱动</th><th>范围</th><th style="text-align:right;">操作</th></tr></thead>
        <tbody>${this.networks.map(n => `
          <tr>
            <td class="cell-name">${n.name}</td>
            <td class="cell-mono cell-secondary">${n.shortId}</td>
            <td><span class="docker-chip">${n.driver}</span></td>
            <td>${n.scope}</td>
            <td class="cell-actions">
              <button class="docker-icon-btn" title="详情" data-docker-action="inspect-network" data-network="${n.name}">${ICONS.inspect}</button>
              ${['bridge', 'host', 'none'].includes(n.name) ? '' :
                `<button class="docker-icon-btn danger" title="删除" data-docker-action="remove-network" data-network="${n.name}">${icon(Delete)}</button>`}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div></div>`;
  }

  // ============================================================
  // VOLUMES TAB
  // ============================================================

  private renderVolumesTab(): string {
    if (this.volumes.length === 0) return this.renderEmptyInline('暂无卷数据', '请点击刷新按钮加载卷列表，或检查 Docker 服务状态');

    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--spacing-md);">
      <span style="font-size:13px;color:var(--text-secondary);">${this.volumes.length} 个卷</span>
      <button class="modern-btn secondary" data-docker-action="prune-volumes" style="font-size:12px;">清理未使用卷</button>
    </div>
    <div class="docker-card"><div style="overflow-x:auto;">
      <table class="docker-table">
        <thead><tr><th>名称</th><th>驱动</th><th>挂载点</th><th style="text-align:right;">操作</th></tr></thead>
        <tbody>${this.volumes.map(v => `
          <tr>
            <td class="cell-name" style="max-width:250px;overflow:hidden;text-overflow:ellipsis;">${v.name}</td>
            <td><span class="docker-chip">${v.driver}</span></td>
            <td class="cell-mono cell-secondary" style="max-width:300px;overflow:hidden;text-overflow:ellipsis;">${v.mountpoint}</td>
            <td class="cell-actions">
              <button class="docker-icon-btn danger" title="删除" data-docker-action="remove-volume" data-volume="${v.name}">${icon(Delete)}</button>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div></div>`;
  }

  // ============================================================
  // COMPOSE TAB
  // ============================================================

  private renderComposeTab(): string {
    if (this.composeProjects.length === 0) {
      return this.renderEmptyInline('暂无 Compose 项目', '未检测到运行中的 Docker Compose 项目');
    }

    return `
    <div class="docker-card">
      ${this.composeProjects.map(p => `
        <div class="docker-compose-card">
          <div>
            <div style="font-weight:600;font-size:14px;color:var(--text-primary);">${p.name}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">${p.status}</div>
            <div style="font-size:11px;color:var(--text-secondary);font-family:var(--font-mono);margin-top:4px;">${p.configFiles}</div>
          </div>
          <div style="display:flex;gap:var(--spacing-sm);">
            <span class="docker-status-badge running">${p.running} 运行</span>
          </div>
        </div>
      `).join('')}
    </div>`;
  }

  // ============================================================
  // SECURITY TAB
  // ============================================================

  private renderSecurityTab(): string {
    const scanBtn = `
    <div style="display:flex;align-items:center;gap:var(--spacing-md);margin-bottom:var(--spacing-md);">
      <button class="modern-btn primary" data-docker-action="run-audit" style="display:flex;align-items:center;gap:6px;">
        ${icon(Shield, '16')} 运行安全审计
      </button>
      ${this.auditResult ? `<span style="font-size:12px;color:var(--text-secondary);">耗时 ${this.auditResult.duration}ms · ${this.auditResult.summary.total} 项发现</span>` : ''}
    </div>`;

    if (!this.auditResult) {
      return scanBtn + this.renderEmptyInline('安全审计', '点击上方按钮运行 Docker 安全审计');
    }

    const r = this.auditResult;
    const scoreClass = r.summary.score >= 80 ? 'good' : r.summary.score >= 50 ? 'warning' : 'danger';

    return scanBtn + `
    <div style="display:grid;grid-template-columns:auto 1fr;gap:var(--spacing-lg);margin-bottom:var(--spacing-md);">
      <div style="display:flex;flex-direction:column;align-items:center;gap:var(--spacing-sm);">
        <div class="docker-score-gauge ${scoreClass}">${r.summary.score}</div>
        <div style="font-size:12px;color:var(--text-secondary);">安全评分</div>
      </div>
      <div style="display:flex;gap:var(--spacing-lg);align-items:center;flex-wrap:wrap;">
        ${r.summary.critical > 0 ? `<span class="docker-severity-badge docker-severity-critical">${r.summary.critical} 严重</span>` : ''}
        ${r.summary.high > 0 ? `<span class="docker-severity-badge docker-severity-high">${r.summary.high} 高危</span>` : ''}
        ${r.summary.medium > 0 ? `<span class="docker-severity-badge docker-severity-medium">${r.summary.medium} 中危</span>` : ''}
        ${r.summary.low > 0 ? `<span class="docker-severity-badge docker-severity-low">${r.summary.low} 低危</span>` : ''}
      </div>
    </div>
    <div>
      ${r.findings.map(f => `
        <div class="docker-audit-finding">
          <span class="docker-severity-badge docker-severity-${f.severity}" style="flex-shrink:0;">${{critical:'严重',high:'高危',medium:'中危',low:'低危',info:'信息'}[f.severity] || f.severity}</span>
          <div style="flex:1;">
            <div style="font-size:12px;font-family:var(--font-mono);color:var(--text-secondary);">${f.container} · ${{privileged:'特权模式',capabilities:'健康检查',network:'网络暴露',mount:'危险挂载',image:'镜像标签',rootUser:'Root用户',resourceLimits:'资源限制',secrets:'敏感信息'}[f.category] || f.category}</div>
            <div class="docker-audit-finding-desc">${f.description}</div>
            <div class="docker-audit-finding-remediation">${f.remediation}</div>
          </div>
          ${f.category === 'privileged' ? `<button class="modern-btn danger" style="flex-shrink:0;font-size:11px;padding:4px 10px;" data-docker-action="remove-privileged" data-container="${f.container}">取消特权</button>` : ''}
        </div>
      `).join('')}
    </div>`;
  }

  // ============================================================
  // Shared Components
  // ============================================================

  private renderStatCard(title: string, value: string, color: string, sub: string): string {
    return `<div class="docker-stat-card">
      <div class="docker-stat-title">${title}</div>
      <div class="docker-stat-value" style="color:${color};">${value}</div>
      ${sub ? `<div class="docker-stat-sub">${sub}</div>` : ''}
    </div>`;
  }

  private renderLoading(): string {
    // Use inline SVG spinner — CSS @keyframes doesn't work reliably in Tauri WebView
    return `<div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:200px;gap:16px;">
      <svg width="36" height="36" viewBox="0 0 36 36" style="display:block;">
        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(148,163,184,0.2)" stroke-width="3"/>
        <circle cx="18" cy="18" r="15" fill="none" stroke="#3b82f6" stroke-width="3"
          stroke-dasharray="28 66" stroke-linecap="round">
          <animateTransform attributeName="transform" type="rotate"
            from="0 18 18" to="360 18 18" dur="0.9s" repeatCount="indefinite"/>
        </circle>
      </svg>
      <span style="font-size:13px;color:var(--text-secondary);">加载中...</span>
    </div>`;
  }

  private renderEmptyInline(title: string, desc: string): string {
    return `<div style="padding:60px;text-align:center;color:var(--text-secondary);">
      <div style="font-size:32px;margin-bottom:12px;">🐳</div>
      <div style="font-size:16px;font-weight:500;color:var(--text-primary);margin-bottom:4px;">${title}</div>
      <div style="font-size:13px;">${desc}</div>
    </div>`;
  }

  private renderDisconnected(): void {
    const contentArea = document.getElementById('docker-content-area');
    if (contentArea) contentArea.innerHTML = this.renderDisconnectedInline();
  }

  private renderDisconnectedInline(): string {
    return `<div style="padding:60px;text-align:center;color:var(--text-secondary);">
      <div style="font-size:40px;margin-bottom:12px;">🔌</div>
      <div style="font-size:16px;font-weight:500;color:var(--text-primary);margin-bottom:4px;">尚未连接 SSH</div>
      <div style="font-size:13px;">请先建立 SSH 连接后，再刷新 Docker 状态。</div>
    </div>`;
  }

  // ============================================================
  // Event Binding
  // ============================================================

  private bindEvents(): void {
    if (this.globalEventsBound) return;
    this.globalEventsBound = true;

    // Global click delegation
    this.boundClickHandler = (event: Event) => {
      const currentPage = (window as any).app?.stateManager?.getState()?.currentPage;
      if (currentPage !== 'docker') return;

      const targetEl = (event as MouseEvent).target as HTMLElement;
      const actionBtn = targetEl.closest('[data-docker-action]') as HTMLElement | null;
      if (!actionBtn) return;

      const action = actionBtn.getAttribute('data-docker-action') || '';
      this.handleAction(action, actionBtn);
    };
    document.addEventListener('click', this.boundClickHandler);

    // Search input
    this.boundInputHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.matches('[data-docker-action="search"]')) {
        if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
        this.searchDebounceTimer = window.setTimeout(() => {
          this.searchTerm = (target as HTMLInputElement).value.trim().toLowerCase();
          this.applyFilter();
          this.renderFullPage();
        }, SEARCH_DEBOUNCE);
      }
    };
    document.addEventListener('input', this.boundInputHandler);
  }

  // ============================================================
  // Action Handler
  // ============================================================

  private async handleAction(action: string, el: HTMLElement): Promise<void> {
    try {
      switch (action) {
        case 'refresh': await this.refresh(true); break;
        case 'switch-tab': this.switchTab(el.getAttribute('data-tab') as DockerMainTab); break;
        case 'toggle-auto-refresh': this.toggleAutoRefresh(el); break;

        // Container actions
        case 'start': case 'stop': case 'restart': case 'kill': case 'pause': case 'unpause': {
          const name = el.getAttribute('data-container');
          if (name) await this.performContainerAction(action, name);
          break;
        }
        case 'logs': { const n = el.getAttribute('data-container'); if (n) await this.showLogs(n); break; }
        case 'inspect': { const n = el.getAttribute('data-container'); if (n) await this.showInspect(n); break; }
        case 'edit': { const n = el.getAttribute('data-container'); if (n) this.showEditModal(n); break; }
        case 'copy': { const n = el.getAttribute('data-container'); if (n) this.showCopyModal(n); break; }
        case 'terminal': { const n = el.getAttribute('data-container'); if (n) await this.showTerminal(n); break; }

        // Image actions
        case 'remove-image': await this.removeImage(el.getAttribute('data-image')!); break;
        case 'prune-images': await this.pruneImages(); break;

        // Network actions
        case 'inspect-network': await this.inspectNetwork(el.getAttribute('data-network')!); break;
        case 'remove-network': await this.removeNetwork(el.getAttribute('data-network')!); break;
        case 'prune-networks': await this.pruneNetworks(); break;

        // Volume actions
        case 'remove-volume': await this.removeVolume(el.getAttribute('data-volume')!); break;
        case 'prune-volumes': await this.pruneVolumes(); break;

        // System
        case 'prune-system': await this.pruneSystem(false); break;
        case 'prune-system-all': await this.pruneSystem(true); break;

        // Security
        case 'run-audit': await this.runAudit(); break;
        case 'remove-privileged': {
          const name = el.getAttribute('data-container');
          if (name) await this.removePrivileged(name);
          break;
        }
      }
    } catch (error) {
      window.showNotification?.(`操作失败: ${error}`, 'error');
    }
  }

  private switchTab(tab: DockerMainTab): void {
    this.currentTab = tab;
    this.refresh(false);
  }

  // ============================================================
  // Container Actions
  // ============================================================

  private async performContainerAction(action: string, containerName: string): Promise<void> {
    const result = await dockerManager.performAction(containerName, action as any);
    window.showNotification?.(result.message, result.success ? 'success' : 'error');
    await this.refresh(false);
  }

  private async showLogs(name: string): Promise<void> {
    const logs = await dockerManager.getLogs(name, { tail: 200, timestamps: true });
    this.logsModal.show(`容器日志 — ${name}`, logs || '日志为空');
  }

  private async showInspect(name: string): Promise<void> {
    const detail = await dockerManager.inspect(name);
    this.logsModal.show(`容器详情 — ${name}`, JSON.stringify(detail, null, 2));
  }

  private showEditModal(name: string): void {
    this.fileModal.showEdit({
      containerName: name,
      loadContent: (path) => dockerManager.readFile(name, path),
      saveContent: (path, content) => dockerManager.writeFile(name, path, content).then(() => undefined),
    });
  }

  private showCopyModal(name: string): void {
    this.fileModal.showCopy({
      containerName: name,
      onSubmit: async (request) => {
        const normalized: DockerCopyRequest = {
          direction: request.direction as DockerCopyDirection,
          source: request.source.trim(),
          target: request.target.trim(),
        };
        const result = await dockerManager.copy(name, normalized);
        window.showNotification?.(result.message, 'success');
      },
    });
  }

  private async showTerminal(name: string): Promise<void> {
    const container = this.containers.find(c => c.name === name);
    if (!container) return;
    await dockerManager.createContainerTerminalWindow(container.name, container.id);
    window.showNotification?.(`已打开容器 ${name} 的终端窗口`, 'success');
  }

  // ============================================================
  // Privileged Container Removal
  // ============================================================

  private async removePrivileged(containerName: string): Promise<void> {
    const confirmed = await showConfirm({
      title: '取消特权模式',
      message: `确定要将容器 "${containerName}" 从特权模式重建为非特权模式？\n\n操作过程：停止容器 → 删除 → 以相同配置(去除 --privileged)重建\n\n⚠️ 容器将短暂中断服务`,
      dangerous: true
    });
    if (!confirmed) return;

    window.showNotification?.(`正在重建容器 ${containerName}...`, 'warning');

    const result = await dockerManager.removePrivileged(containerName);
    if (result.success) {
      window.showNotification?.(`容器 ${containerName} 已重建为非特权模式`, 'success');
    } else {
      window.showNotification?.(`取消特权失败: ${result.output.split('\n').pop()}`, 'error');
    }

    // 显示详细日志
    this.logsModal.show(`取消特权 — ${containerName}`, result.output);

    // 刷新数据
    await this.refresh(false);
  }

  // ============================================================
  // Image/Network/Volume Actions
  // ============================================================

  private async removeImage(ref: string): Promise<void> {
    if (!(await showConfirm({ title: '删除镜像', message: `确定要删除镜像 ${ref}？`, dangerous: true }))) return;
    const r = await dockerManager.removeImage(ref);
    window.showNotification?.(r.success ? '镜像已删除' : `删除失败: ${r.output}`, r.success ? 'success' : 'error');
    if (r.success) { this.images = await dockerManager.listImages(); this.renderFullPage(); }
  }

  private async pruneImages(): Promise<void> {
    if (!(await showConfirm({ title: '清理镜像', message: '确定要清理所有悬空（dangling）镜像？', dangerous: true }))) return;
    const r = await dockerManager.pruneImages();
    window.showNotification?.(r.success ? '清理完成' : `清理失败: ${r.output}`, r.success ? 'success' : 'error');
    if (r.success) await this.refresh(false);
  }

  private async inspectNetwork(name: string): Promise<void> {
    const detail = await dockerManager.inspectNetwork(name);
    this.logsModal.show(`网络详情 — ${name}`, detail || '无数据');
  }

  private async removeNetwork(name: string): Promise<void> {
    if (!(await showConfirm({ title: '删除网络', message: `确定要删除网络 ${name}？`, dangerous: true }))) return;
    const r = await dockerManager.removeNetwork(name);
    window.showNotification?.(r.success ? '网络已删除' : `删除失败: ${r.output}`, r.success ? 'success' : 'error');
    if (r.success) { this.networks = await dockerManager.listNetworks(); this.renderFullPage(); }
  }

  private async pruneNetworks(): Promise<void> {
    if (!(await showConfirm({ title: '清理网络', message: '确定要清理所有未使用的网络？', dangerous: true }))) return;
    const r = await dockerManager.pruneNetworks();
    window.showNotification?.(r.success ? '清理完成' : `清理失败`, r.success ? 'success' : 'error');
    if (r.success) await this.refresh(false);
  }

  private async removeVolume(name: string): Promise<void> {
    if (!(await showConfirm({ title: '删除卷', message: `确定要删除卷 ${name}？此操作不可恢复！`, dangerous: true }))) return;
    const r = await dockerManager.removeVolume(name);
    window.showNotification?.(r.success ? '卷已删除' : `删除失败: ${r.output}`, r.success ? 'success' : 'error');
    if (r.success) { this.volumes = await dockerManager.listVolumes(); this.renderFullPage(); }
  }

  private async pruneVolumes(): Promise<void> {
    if (!(await showConfirm({ title: '清理卷', message: '确定要清理所有未使用的卷？此操作不可恢复！', dangerous: true }))) return;
    const r = await dockerManager.pruneVolumes();
    window.showNotification?.(r.success ? '清理完成' : `清理失败`, r.success ? 'success' : 'error');
    if (r.success) await this.refresh(false);
  }

  private async pruneSystem(all: boolean): Promise<void> {
    const msg = all ? '确定要深度清理？将删除所有未使用的镜像、容器、网络和卷！' : '确定要清理未使用的资源？';
    if (!(await showConfirm({ title: '系统清理', message: msg, dangerous: true }))) return;
    const r = await dockerManager.systemPrune(all);
    window.showNotification?.(r.success ? '系统清理完成' : `清理失败: ${r.output}`, r.success ? 'success' : 'error');
    if (r.success) await this.refresh(false);
  }

  private async runAudit(): Promise<void> {
    window.showNotification?.('正在运行安全审计...', 'info');
    const auditor = (window as any).app?.dockerSecurityAuditor;
    if (!auditor) { window.showNotification?.('安全审计器未初始化', 'error'); return; }
    this.auditResult = await auditor.runFullAudit();
    const r = this.auditResult!;
    window.showNotification?.(
      `安全审计完成: 评分 ${r.summary.score}/100, ${r.summary.total} 项发现`,
      r.summary.score >= 80 ? 'success' : r.summary.score >= 50 ? 'warning' : 'error'
    );
    this.renderFullPage();
  }

  // ============================================================
  // Auto Refresh
  // ============================================================

  private toggleAutoRefresh(_button: HTMLElement): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    if (this.autoRefreshEnabled) {
      this.startAutoRefresh();
      window.showNotification?.('Docker 自动刷新已开启 (30秒)', 'info');
    } else {
      this.stopAutoRefresh();
      window.showNotification?.('Docker 自动刷新已关闭', 'info');
    }
    // Re-render to update button state
    this.renderFullPage();
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.autoRefreshTimer = window.setInterval(() => {
      const currentPage = (window as any).app?.stateManager?.getState()?.currentPage;
      if (currentPage === 'docker') this.refresh(false);
      else this.stopAutoRefresh();
    }, AUTO_REFRESH_INTERVAL);
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshTimer) { clearInterval(this.autoRefreshTimer); this.autoRefreshTimer = null; }
  }

  // ============================================================
  // Helpers
  // ============================================================

  private applyFilter(): void {
    if (!this.searchTerm) {
      this.filtered = [...this.containers];
    } else {
      const term = this.searchTerm;
      this.filtered = this.containers.filter(c =>
        [c.name, c.image, c.state, c.status, c.shortId].join(' ').toLowerCase().includes(term)
      );
    }
  }
}

export const dockerPageManager = new DockerPageManager();
