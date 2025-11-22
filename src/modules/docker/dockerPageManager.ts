import { dockerManager } from './dockerManager';
import type {
  DockerActionResult,
  DockerContainerSummary,
  DockerCopyDirection,
  DockerCopyRequest,
} from './types';
import { sshConnectionManager } from '../remote/sshConnectionManager';
import { DockerLogsModal, DockerFileModal } from '../ui/dockerModals';

const AUTO_REFRESH_INTERVAL = 30000; // 30 秒


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
  private containers: DockerContainerSummary[] = [];
  private filtered: DockerContainerSummary[] = [];
  private searchTerm = '';
  private initialized = false;
  private loading = false;
  private autoRefreshTimer: number | null = null;
  private autoRefreshEnabled = false;
  private logsModal = new DockerLogsModal();
  private fileModal = new DockerFileModal();
  private globalEventsBound = false;

  initialize(): void {
    console.log('Docker page manager initializing...'); // 调试信息
    if (this.initialized) {
      console.log('Docker page manager already initialized'); // 调试信息
      return;
    }
    this.bindEvents();
    this.initialized = true;
    (window as any).dockerPageManager = this;
    console.log('Docker page manager initialized successfully'); // 调试信息
  }

  async refresh(showNotification = false): Promise<void> {
    if (!sshConnectionManager.isConnected()) {
      this.renderDisconnected();
      return;
    }

    try {
      this.setLoading(true);
      const containers = await dockerManager.listContainers();
      this.containers = containers;
      this.applyFilter();
      if (showNotification) {
        window.showNotification?.('Docker 容器列表已更新', 'success');
      }
    } catch (error) {
      console.error('刷新 Docker 容器列表失败', error);
      window.showNotification?.(`刷新 Docker 容器失败: ${error}`, 'error');
    } finally {
      this.setLoading(false);
      this.render();
    }
  }

  deactivate(): void {
    this.stopAutoRefresh();
  }

  private bindEvents(): void {
    console.log('Binding Docker page events...'); // 调试信息

    // 绑定一次全局事件，防止渲染后监听器丢失
    if (!this.globalEventsBound) {
      document.addEventListener('click', (event) => {
        const currentPage = (window as any).app?.stateManager?.getState()?.currentPage;
        if (currentPage !== 'docker') return;

        const targetEl = event.target as HTMLElement;
        const actionBtn = targetEl.closest('[data-docker-action]') as HTMLElement | null;
        if (!actionBtn) return;

        const toolbarAncestor = actionBtn.closest('.docker-toolbar');
        const gridAncestor = actionBtn.closest('#docker-container-grid');
        const action = actionBtn.getAttribute('data-docker-action') || '';

        if (toolbarAncestor) {
          if (action === 'refresh') {
            this.refresh(true);
          } else if (action === 'toggle-auto-refresh') {
            this.toggleAutoRefresh(actionBtn as HTMLElement);
          }
          return;
        }

        if (gridAncestor) {
          const containerName = actionBtn.getAttribute('data-container');
          if (!action || !containerName) return;
          const container = this.containers.find((item) => item.name === containerName || item.id === containerName);
          if (!container) {
            window.showNotification?.('未找到容器信息', 'error');
            return;
          }
          this.handleContainerAction(action, container);
          return;
        }
      });
      this.globalEventsBound = true;
      console.log('Global click handler for Docker page bound');
    }

    const toolbar = document.querySelector('.docker-toolbar');
    console.log('Docker toolbar found:', toolbar); // 调试信息
    // toolbar events handled by global click handler

    const searchInput = document.getElementById('docker-search') as HTMLInputElement | null;
    console.log('Docker search input found:', searchInput); // 调试信息
    if (searchInput) {
      let debounceTimer: number | null = null;
      searchInput.addEventListener('input', () => {
        if (debounceTimer) {
          window.clearTimeout(debounceTimer);
        }
        debounceTimer = window.setTimeout(() => {
          this.searchTerm = searchInput.value.trim().toLowerCase();
          this.applyFilter();
        }, 200);
      });
    }

    const grid = document.getElementById('docker-container-grid');
    console.log('Docker container grid found:', grid); // 调试信息
    // grid events handled by global click handler

    console.log('Docker page events bound successfully'); // 调试信息
  }

  private setLoading(isLoading: boolean): void {
    this.loading = isLoading;
    const grid = document.getElementById('docker-container-grid');
    if (!grid) return;
    if (isLoading) {
      grid.classList.add('docker-grid-loading');
      grid.innerHTML = '<div class="docker-loading">加载容器信息中...</div>';
    } else {
      grid.classList.remove('docker-grid-loading');
    }
  }

  private applyFilter(): void {
    if (!this.searchTerm) {
      this.filtered = [...this.containers];
    } else {
      const term = this.searchTerm;
      this.filtered = this.containers.filter((container) =>
        [
          container.name,
          container.image,
          container.state,
          container.status,
          container.shortId,
        ]
          .join(' ')
          .toLowerCase()
          .includes(term)
      );
    }
    this.render();
  }

  private render(): void {
    if (!sshConnectionManager.isConnected()) {
      this.renderDisconnected();
      return;
    }

    this.renderStats(this.filtered);
    this.renderGrid(this.filtered);
    this.renderEmptyState(this.filtered.length === 0);
  }

  private renderStats(containers: DockerContainerSummary[]): void {
    const statsEl = document.getElementById('docker-stats');
    if (!statsEl) return;

    const total = containers.length;
    const running = containers.filter((item) => item.state.toLowerCase() === 'running').length;
    const privileged = containers.filter((item) => item.quickChecks.privileged).length;
    const networkIssues = containers.filter((item) => !item.quickChecks.networkAttached).length;

    statsEl.innerHTML = `
      <div class="docker-stat-card">
        <div class="docker-stat-title">容器总数</div>
        <div class="docker-stat-value">${total}</div>
      </div>
      <div class="docker-stat-card">
        <div class="docker-stat-title">运行中</div>
        <div class="docker-stat-value">${running}</div>
      </div>
      <div class="docker-stat-card">
        <div class="docker-stat-title">特权容器</div>
        <div class="docker-stat-value">${privileged}</div>
      </div>
      <div class="docker-stat-card">
        <div class="docker-stat-title">网络异常</div>
        <div class="docker-stat-value">${networkIssues}</div>
      </div>
    `;
  }

  private renderGrid(containers: DockerContainerSummary[]): void {
    const grid = document.getElementById('docker-container-grid');
    if (!grid) return;

    if (this.loading) {
      return;
    }

    const cards = containers.map((container) => this.renderCard(container)).join('');
    grid.innerHTML = cards;
  }

  private renderCard(container: DockerContainerSummary): string {
    const isRunning = container.state.toLowerCase() === 'running';
    const statusClass = isRunning ? 'status-running' : container.state.toLowerCase() === 'paused' ? 'status-paused' : 'status-stopped';
    const cpu = container.cpuPercent != null ? `${container.cpuPercent.toFixed(1)}%` : '--';
    const memoryRaw = container.memoryUsage ?? '--';
    // Extract only the used memory part (before the " / ")
    const memory = memoryRaw.includes(' / ') ? memoryRaw.split(' / ')[0] : memoryRaw;
    const networkMode = container.networkMode ?? '未知';
    const firstNetwork = container.networks[0]?.ipv4Address ?? '无';

    // Simplify port display
    const portChips = container.ports.length
      ? container.ports
          .slice(0, 3) // Limit to 3 ports
          .map((port) => `<span class="docker-chip port">${port.publicPort ?? '*'}→${port.privatePort}</span>`)
          .join('') + (container.ports.length > 3 ? `<span class="docker-chip port-more">+${container.ports.length - 3}</span>` : '')
      : '<span class="docker-chip muted">无端口</span>';

    // Action Buttons Grouped
    const primaryAction = isRunning
      ? `<button class="docker-icon-btn stop" data-docker-action="stop" data-container="${container.name}" title="停止">${ICONS.stop}</button>
         <button class="docker-icon-btn restart" data-docker-action="restart" data-container="${container.name}" title="重启">${ICONS.restart}</button>`
      : `<button class="docker-icon-btn start" data-docker-action="start" data-container="${container.name}" title="启动">${ICONS.start}</button>`;

    const terminalAction = isRunning 
      ? `<button class="docker-icon-btn terminal" data-docker-action="terminal" data-container="${container.name}" title="终端">${ICONS.terminal}</button>` 
      : '';

    return `
      <div class="docker-card">
        <div class="docker-card-header">
          <div class="docker-identity">
            <h3>${container.name}</h3>
            <div class="docker-image" title="${container.image}">${container.image}</div>
          </div>
          <div class="docker-status-wrapper">
             <span class="docker-status-dot ${statusClass}"></span>
             <span class="docker-status-text ${statusClass}">${container.state}</span>
          </div>
        </div>
        
        <div class="docker-card-body">
           <div class="docker-metrics-row">
             <div class="metric-box">
               <span class="metric-label">CPU</span>
               <span class="metric-value">${cpu}</span>
             </div>
             <div class="metric-box">
               <span class="metric-label">MEM</span>
               <span class="metric-value">${memory}</span>
             </div>
             <div class="metric-box">
               <span class="metric-label">NET</span>
               <span class="metric-value">${networkMode}</span>
             </div>
           </div>
           
           <div class="docker-info-row">
              <div class="info-label">IP: ${firstNetwork}</div>
              <div class="docker-chip-group">${portChips}</div>
           </div>
        </div>

        <div class="docker-card-footer">
           <div class="docker-action-group primary">
             ${primaryAction}
           </div>
           <div class="docker-action-divider"></div>
           <div class="docker-action-group tools">
             ${terminalAction}
             <button class="docker-icon-btn" data-docker-action="logs" data-container="${container.name}" title="日志">${ICONS.logs}</button>
             <button class="docker-icon-btn" data-docker-action="inspect" data-container="${container.name}" title="详情">${ICONS.inspect}</button>
             <button class="docker-icon-btn" data-docker-action="edit" data-container="${container.name}" title="编辑">${ICONS.edit}</button>
             <button class="docker-icon-btn" data-docker-action="copy" data-container="${container.name}" title="复制">${ICONS.copy}</button>
           </div>
        </div>
      </div>
    `;
  }

  private renderEmptyState(isEmpty: boolean): void {
    const emptyState = document.getElementById('docker-empty-state');
    if (!emptyState) return;

    if (isEmpty) {
      emptyState.innerHTML = `
        <div class="docker-empty">
          <div class="docker-empty-icon">🐳</div>
          <div class="docker-empty-title">没有匹配的容器</div>
          <p class="docker-empty-description">尝试修改搜索条件，或检查服务器上的 Docker 服务是否正常运行。</p>
        </div>
      `;
      emptyState.style.display = 'block';
    } else {
      emptyState.style.display = 'none';
    }
  }

  private renderDisconnected(): void {
    const statsEl = document.getElementById('docker-stats');
    const grid = document.getElementById('docker-container-grid');
    const emptyState = document.getElementById('docker-empty-state');

    if (statsEl) {
      statsEl.innerHTML = `
        <div class="docker-disconnected">
          <div class="docker-empty-icon">🔌</div>
          <div>
            <div class="docker-empty-title">尚未连接 SSH</div>
            <p class="docker-empty-description">请先建立 SSH 连接后，再刷新 Docker 状态。</p>
          </div>
        </div>
      `;
    }

    if (grid) {
      grid.innerHTML = '';
    }

    if (emptyState) {
      emptyState.style.display = 'none';
    }
  }

  private async handleContainerAction(action: string, container: DockerContainerSummary): Promise<void> {
    console.log('Handling container action:', action, 'for container:', container.name); // 调试信息
    try {
      if (!sshConnectionManager.isConnected()) {
        window.showNotification?.('请先建立 SSH 连接', 'warning');
        return;
      }

      if (['start', 'stop', 'restart', 'kill', 'pause', 'unpause'].includes(action)) {
        const result = await dockerManager.performAction(container.name, action as any);
        window.showNotification?.(result.message, 'success');
        await this.refresh(false);
        return;
      }

      if (action === 'logs') {
        await this.showLogs(container);
        return;
      }

      if (action === 'inspect') {
        await this.showInspect(container);
        return;
      }

      if (action === 'edit') {
        await this.showEditModal(container);
        return;
      }

      if (action === 'copy') {
        this.showCopyModal(container);
        return;
      }

      if (action === 'terminal') {
        this.showTerminalModal(container);
        return;
      }
    } catch (error) {
      console.error('执行容器操作失败', error);
      window.showNotification?.(`操作失败: ${error}`, 'error');
    }
  }

  private async showLogs(container: DockerContainerSummary): Promise<void> {
    try {
      const logs = await dockerManager.getLogs(container.name, { tail: 200, timestamps: true });
      this.logsModal.show(`容器日志 - ${container.name}`, logs || '日志为空');
    } catch (error) {
      console.error('获取容器日志失败', error);
      window.showNotification?.(`获取日志失败: ${error}`, 'error');
    }
  }

  private async showInspect(container: DockerContainerSummary): Promise<void> {
    try {
      const detail = await dockerManager.inspect(container.name);
      const content = JSON.stringify(detail, null, 2);
      this.logsModal.show(`容器详情 - ${container.name}`, content);
    } catch (error) {
      console.error('获取容器详情失败', error);
      window.showNotification?.(`获取详情失败: ${error}`, 'error');
    }
  }

  private async showEditModal(container: DockerContainerSummary): Promise<void> {
    this.fileModal.showEdit({
      containerName: container.name,
      loadContent: (path) => dockerManager.readFile(container.name, path),
      saveContent: (path, content) => dockerManager.writeFile(container.name, path, content).then(() => undefined),
    });
  }

  private showCopyModal(container: DockerContainerSummary): void {
    this.fileModal.showCopy({
      containerName: container.name,
      onSubmit: (request) => this.handleCopy(container, request),
    });
  }

  private async handleCopy(
    container: DockerContainerSummary,
    request: DockerCopyRequest
  ): Promise<void> {
    const normalized: DockerCopyRequest = {
      direction: request.direction as DockerCopyDirection,
      source: request.source.trim(),
      target: request.target.trim(),
    };
    if (!normalized.source || !normalized.target) {
      throw new Error('源路径或目标路径不能为空');
    }
    const result: DockerActionResult = await dockerManager.copy(container.name, normalized);
    window.showNotification?.(result.message, 'success');
  }

  private toggleAutoRefresh(button: HTMLElement): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    if (this.autoRefreshEnabled) {
      button.classList.add('active');
      button.textContent = '自动刷新·开';
      this.startAutoRefresh();
      window.showNotification?.('Docker 自动刷新已开启 (30 秒)', 'info');
    } else {
      button.classList.remove('active');
      button.textContent = '自动刷新·关';
      this.stopAutoRefresh();
      window.showNotification?.('Docker 自动刷新已关闭', 'info');
    }
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.autoRefreshTimer = window.setInterval(() => {
      const currentPage = (window as any).app?.stateManager?.getState()?.currentPage;
      if (currentPage === 'docker') {
        this.refresh(false);
      } else {
        this.stopAutoRefresh();
      }
    }, AUTO_REFRESH_INTERVAL);
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshTimer) {
      window.clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }

  private async showTerminalModal(container: DockerContainerSummary): Promise<void> {
    console.log('Showing terminal modal for container:', container.name); // 调试信息
    try {
      console.log('Calling createContainerTerminalWindow...'); // 调试信息
      const windowLabel = await dockerManager.createContainerTerminalWindow(container.name, container.id);
      console.log('Terminal window created:', windowLabel); // 调试信息
      window.showNotification?.(`已打开容器 ${container.name} 的终端窗口`, 'success');
    } catch (error) {
      console.error('创建容器终端窗口失败:', error);
      window.showNotification?.(`创建终端窗口失败: ${error}`, 'error');
    }
  }


}

export const dockerPageManager = new DockerPageManager();


