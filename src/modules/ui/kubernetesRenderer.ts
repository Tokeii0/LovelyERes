import {
    LinkCloud, Cube, NetworkTree, SettingConfig,
    Refresh, Delete, Shield, Lock, Fire,
    Log, Terminal, FileText, Analysis,
    Config, Rocket,
    CheckOne, CloseOne
} from '@icon-park/svg';
import {
    K8sPod, K8sDeployment, K8sService, K8sNode, K8sClusterStats,
    K8sNamespace, K8sEvent, K8sNetworkPolicy, K8sConfigMap, K8sSecret,
    K8sPersistentVolume, K8sPersistentVolumeClaim,
    K8sDaemonSet, K8sStatefulSet, K8sCronJob, K8sJob, K8sHPA,
    K8sRole, K8sClusterRole, K8sRoleBinding, K8sClusterRoleBinding,
    K8sIngress,
    K8sMainTab, K8sWorkloadSubTab, K8sNetworkSubTab, K8sStorageSubTab,
    K8sSecuritySubTab, K8sEventsSubTab,
    K8sSecurityAuditResult, K8sAnomalyAlert, K8sEmergencyAction,
    K8sSecurityFinding, K8sPodForensicReport
} from '../kubernetes/types';

// ============================================================
// Icon helper
// ============================================================
const icon = (fn: any, size = '16', theme = 'outline') =>
    fn({ theme, size, fill: 'currentColor' });

// ============================================================
// KubernetesRenderer - 7-Tab System
// ============================================================

export class KubernetesRenderer {
    // State
    private currentTab: K8sMainTab = 'overview';
    private currentSubTab: string = '';
    private currentNamespace: string = '';
    private searchTerm: string = '';
    private emergencyMode: boolean = false;
    private loading: boolean = false;
    private initialized: boolean = false;

    // Data
    private data: {
        pods: K8sPod[];
        deployments: K8sDeployment[];
        services: K8sService[];
        nodes: K8sNode[];
        stats: K8sClusterStats | null;
        namespaces: K8sNamespace[];
        events: K8sEvent[];
        networkPolicies: K8sNetworkPolicy[];
        configMaps: K8sConfigMap[];
        secrets: K8sSecret[];
        pvs: K8sPersistentVolume[];
        pvcs: K8sPersistentVolumeClaim[];
        daemonSets: K8sDaemonSet[];
        statefulSets: K8sStatefulSet[];
        cronJobs: K8sCronJob[];
        jobs: K8sJob[];
        hpas: K8sHPA[];
        ingresses: K8sIngress[];
        roles: K8sRole[];
        clusterRoles: K8sClusterRole[];
        roleBindings: K8sRoleBinding[];
        clusterRoleBindings: K8sClusterRoleBinding[];
        auditResult: K8sSecurityAuditResult | null;
        anomalies: K8sAnomalyAlert[];
        emergencyActions: K8sEmergencyAction[];
        isolatedPods: { pod: string; policy: string }[];
        forensicReport: K8sPodForensicReport | null;
    } = {
        pods: [], deployments: [], services: [], nodes: [],
        stats: null, namespaces: [], events: [],
        networkPolicies: [], configMaps: [], secrets: [],
        pvs: [], pvcs: [], daemonSets: [], statefulSets: [],
        cronJobs: [], jobs: [], hpas: [], ingresses: [],
        roles: [], clusterRoles: [], roleBindings: [], clusterRoleBindings: [],
        auditResult: null, anomalies: [], emergencyActions: [],
        isolatedPods: [], forensicReport: null
    };

    constructor() {}

    // ============================================================
    // Public API
    // ============================================================

    public render(): string {
        if (!this.initialized) {
            this.initialized = true;
            this.refreshData();
        }

        const emergencyClass = this.emergencyMode ? ' emergency-mode' : '';

        return `
        <div class="k8s-page${emergencyClass}">
            ${this.emergencyMode ? this.renderEmergencyBanner() : ''}
            ${this.renderHeader()}
            ${this.renderTabs()}
            <div id="k8s-content-area" class="k8s-content">
                ${this.loading ? this.renderLoading() : this.renderCurrentTab()}
            </div>
        </div>`;
    }

    public async refreshData(): Promise<void> {
        this.loading = true;
        this.updateContentArea();

        try {
            const manager = (window as any).app?.kubernetesManager;
            if (!manager) { console.error('KubernetesManager not found'); return; }

            const ns = this.currentNamespace || undefined;

            // Always fetch namespaces and stats
            const [namespaces, stats] = await Promise.all([
                manager.getNamespaces(),
                manager.getClusterStats()
            ]);
            this.data.namespaces = namespaces;
            this.data.stats = stats;

            // Fetch tab-specific data
            await this.fetchTabData(manager, ns);

            // Run anomaly detection if we have pods
            if (this.data.pods.length > 0) {
                const emergencyMgr = (window as any).app?.kubernetesEmergencyManager;
                if (emergencyMgr) {
                    this.data.anomalies = emergencyMgr.detectAnomalies(this.data.pods);
                    this.data.emergencyActions = emergencyMgr.getActionHistory();
                    this.data.isolatedPods = emergencyMgr.getIsolatedPods();
                }
            }
        } catch (e) {
            console.error('Failed to load Kubernetes data', e);
        } finally {
            this.loading = false;
            this.updateContentArea();
        }
    }

    private async fetchTabData(manager: any, ns?: string): Promise<void> {
        switch (this.currentTab) {
            case 'overview':
                const [pods, nodes, events] = await Promise.all([
                    manager.getPods(ns), manager.getNodes(), manager.getEvents(ns)
                ]);
                this.data.pods = pods;
                this.data.nodes = nodes;
                this.data.events = events;
                break;
            case 'workloads':
                this.data.pods = await manager.getPods(ns);
                this.data.deployments = await manager.getDeployments(ns);
                this.data.daemonSets = await manager.getDaemonSets(ns);
                this.data.statefulSets = await manager.getStatefulSets(ns);
                this.data.jobs = await manager.getJobs(ns);
                this.data.cronJobs = await manager.getCronJobs(ns);
                break;
            case 'networking':
                [this.data.services, this.data.ingresses, this.data.networkPolicies] = await Promise.all([
                    manager.getServices(ns), manager.getIngresses(ns), manager.getNetworkPolicies(ns)
                ]);
                break;
            case 'storage':
                [this.data.pvs, this.data.pvcs, this.data.configMaps, this.data.secrets] = await Promise.all([
                    manager.getPersistentVolumes(), manager.getPersistentVolumeClaims(ns),
                    manager.getConfigMaps(ns), manager.getSecrets(ns)
                ]);
                break;
            case 'security':
                [this.data.roles, this.data.clusterRoles, this.data.roleBindings, this.data.clusterRoleBindings] = await Promise.all([
                    manager.getRoles(ns), manager.getClusterRoles(),
                    manager.getRoleBindings(ns), manager.getClusterRoleBindings()
                ]);
                break;
            case 'events':
                [this.data.events, this.data.pods] = await Promise.all([
                    manager.getEvents(ns), manager.getPods(ns)
                ]);
                break;
            case 'emergency':
                [this.data.pods, this.data.events, this.data.networkPolicies] = await Promise.all([
                    manager.getPods(ns), manager.getEvents(ns), manager.getNetworkPolicies(ns)
                ]);
                break;
        }
    }

    public setTab(tabId: K8sMainTab): void {
        this.currentTab = tabId;
        this.currentSubTab = '';
        this.refreshData();
    }

    public setSubTab(subTabId: string): void {
        this.currentSubTab = subTabId;
        this.updateContentArea();
    }

    public setNamespace(ns: string): void {
        this.currentNamespace = ns;
        this.refreshData();
    }

    public setSearch(term: string): void {
        this.searchTerm = term;
        this.updateContentArea();
    }

    public setEmergencyMode(enabled: boolean): void {
        this.emergencyMode = enabled;
        // Re-render full page for emergency mode border
        const page = document.querySelector('.k8s-page');
        if (page) {
            if (enabled) page.classList.add('emergency-mode');
            else page.classList.remove('emergency-mode');
        }

        // Insert/remove banner
        const headerEl = document.querySelector('.k8s-header');
        if (headerEl) {
            const existingBanner = document.querySelector('.k8s-emergency-banner');
            if (enabled && !existingBanner) {
                headerEl.insertAdjacentHTML('beforebegin', this.renderEmergencyBanner());
            } else if (!enabled && existingBanner) {
                existingBanner.remove();
            }
        }
    }

    public setLoading(val: boolean): void {
        this.loading = val;
        this.updateContentArea();
    }

    public updateData(key: string, value: any): void {
        (this.data as any)[key] = value;
        this.updateContentArea();
    }

    public getData(): typeof this.data {
        return this.data;
    }

    // ============================================================
    // Private: Update DOM
    // ============================================================

    private updateContentArea(): void {
        const el = document.getElementById('k8s-content-area');
        if (el) el.innerHTML = this.loading ? this.renderLoading() : this.renderCurrentTab();

        // Sync tab button active states
        document.querySelectorAll('.k8s-tab-btn').forEach(btn => {
            const tabId = btn.getAttribute('data-tab');
            btn.classList.toggle('active', tabId === this.currentTab);
        });
        // Sync sub-tab active states
        document.querySelectorAll('.k8s-sub-tab-btn').forEach(btn => {
            const subTabId = btn.getAttribute('data-sub-tab');
            btn.classList.toggle('active', subTabId === this.currentSubTab);
        });
    }

    // ============================================================
    // Header
    // ============================================================

    private renderHeader(): string {
        const nsOptions = this.data.namespaces.length > 0
            ? this.data.namespaces.map(ns =>
                `<option value="${ns.name}" ${this.currentNamespace === ns.name ? 'selected' : ''}>${ns.name}</option>`
            ).join('')
            : '<option value="">default</option>';

        return `
        <div class="k8s-header">
            <div class="k8s-header-left">
                <div class="k8s-header-icon">${icon(LinkCloud, '24', 'filled')}</div>
                <div>
                    <h2 class="k8s-header-title">Kubernetes 管理</h2>
                    <div class="k8s-header-subtitle">集群资源管理与应急响应</div>
                </div>
            </div>
            <div class="k8s-header-right">
                <select class="k8s-namespace-selector" data-k8s-action="switch-namespace">
                    <option value="">所有命名空间</option>
                    ${nsOptions}
                </select>
                <input type="text" class="k8s-search-input" placeholder="搜索资源..." value="${this.searchTerm}" data-k8s-action="search" />
                <button class="modern-btn ${this.emergencyMode ? 'danger' : 'secondary'}" data-k8s-action="toggle-emergency" style="display:flex;align-items:center;gap:6px;">
                    ${icon(Fire, '16')}
                    ${this.emergencyMode ? '退出应急' : '应急模式'}
                </button>
                <button class="modern-btn secondary" data-k8s-action="refresh" style="display:flex;align-items:center;gap:6px;">
                    ${icon(Refresh, '16')}
                    刷新
                </button>
            </div>
        </div>`;
    }

    // ============================================================
    // Emergency Banner
    // ============================================================

    private renderEmergencyBanner(): string {
        return `
        <div class="k8s-emergency-banner">
            <div class="k8s-emergency-banner-text">
                <span class="k8s-emergency-dot"></span>
                应急模式已激活 — 刷新频率提升至 10 秒，应急操作已解锁
            </div>
            <button class="modern-btn secondary" data-k8s-action="toggle-emergency" style="font-size:12px;padding:4px 12px;">
                退出应急模式
            </button>
        </div>`;
    }

    // ============================================================
    // Tabs
    // ============================================================

    private renderTabs(): string {
        const tabs: { id: K8sMainTab; label: string; iconFn: any; badge?: number }[] = [
            { id: 'overview', label: '概览', iconFn: LinkCloud },
            { id: 'workloads', label: '工作负载', iconFn: Cube },
            { id: 'networking', label: '网络', iconFn: NetworkTree },
            { id: 'storage', label: '存储', iconFn: Config },
            { id: 'security', label: '安全', iconFn: Shield },
            { id: 'events', label: '事件与日志', iconFn: Log },
            { id: 'emergency', label: '应急响应', iconFn: Fire,
              badge: this.data.anomalies.filter(a => !a.acknowledged).length || undefined },
        ];

        return `
        <div class="k8s-tabs">
            ${tabs.map(tab => `
                <button class="k8s-tab-btn ${this.currentTab === tab.id ? 'active' : ''}"
                        data-k8s-action="switch-tab" data-tab="${tab.id}">
                    ${icon(tab.iconFn, '16', this.currentTab === tab.id ? 'filled' : 'outline')}
                    ${tab.label}
                    ${tab.badge ? `<span class="k8s-severity-badge k8s-severity-critical" style="margin-left:4px;">${tab.badge}</span>` : ''}
                </button>
            `).join('')}
        </div>`;
    }

    // ============================================================
    // Tab Routing
    // ============================================================

    private renderCurrentTab(): string {
        switch (this.currentTab) {
            case 'overview': return this.renderOverviewTab();
            case 'workloads': return this.renderWorkloadsTab();
            case 'networking': return this.renderNetworkingTab();
            case 'storage': return this.renderStorageTab();
            case 'security': return this.renderSecurityTab();
            case 'events': return this.renderEventsTab();
            case 'emergency': return this.renderEmergencyTab();
            default: return this.renderOverviewTab();
        }
    }

    // ============================================================
    // OVERVIEW TAB
    // ============================================================

    private renderOverviewTab(): string {
        const s = this.data.stats || { totalPods: 0, runningPods: 0, totalDeployments: 0, totalServices: 0, healthyNodes: 0, totalNodes: 0, cpuUsage: 0, memoryUsage: 0, warningEventCount: 0, crashLoopPodCount: 0 };

        const anomalyBanner = this.data.anomalies.length > 0 ? `
            <div class="k8s-anomaly-alert critical" style="margin-bottom: var(--spacing-md);">
                <span>${icon(Fire, '18')}</span>
                <div>
                    <strong>检测到 ${this.data.anomalies.length} 个异常</strong>
                    <span style="font-size:12px;color:var(--text-secondary);margin-left:8px;">
                        ${this.data.anomalies.filter(a => a.severity === 'critical').length} 严重 /
                        ${this.data.anomalies.filter(a => a.severity === 'high').length} 高危
                    </span>
                </div>
                <button class="modern-btn danger" data-k8s-action="switch-tab" data-tab="emergency" style="margin-left:auto;font-size:12px;padding:4px 12px;">
                    查看详情
                </button>
            </div>` : '';

        return `
        ${anomalyBanner}
        <div class="k8s-stats-grid" style="margin-bottom: var(--spacing-md);">
            ${this.renderStatCard('节点', `${s.healthyNodes}/${s.totalNodes}`, s.healthyNodes === s.totalNodes ? 'var(--success-color)' : 'var(--warning-color)', '健康/总数')}
            ${this.renderStatCard('Pods', `${s.runningPods}/${s.totalPods}`, s.runningPods === s.totalPods ? 'var(--success-color)' : 'var(--warning-color)', '运行中/总数')}
            ${this.renderStatCard('Deployments', `${s.totalDeployments}`, 'var(--primary-color)', '部署数')}
            ${this.renderStatCard('Services', `${s.totalServices}`, 'var(--primary-color)', '服务数')}
            ${this.renderStatCard('Warning 事件', `${s.warningEventCount || 0}`, (s.warningEventCount || 0) > 0 ? 'var(--warning-color)' : 'var(--success-color)', '告警事件数')}
            ${this.renderStatCard('CrashLoop', `${s.crashLoopPodCount || 0}`, (s.crashLoopPodCount || 0) > 0 ? 'var(--error-color)' : 'var(--success-color)', '异常 Pod')}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--spacing-md);margin-bottom:var(--spacing-md);">
            ${this.renderResourceUsageCard(s)}
            ${this.renderRecentEventsCard()}
        </div>

        <div class="k8s-card">
            <h3>节点列表</h3>
            <div class="k8s-node-grid">
                ${this.data.nodes.map(node => this.renderNodeCard(node)).join('')}
                ${this.data.nodes.length === 0 ? '<div class="k8s-empty-desc">暂无节点数据</div>' : ''}
            </div>
        </div>`;
    }

    private renderStatCard(title: string, value: string, color: string, sub: string): string {
        return `
        <div class="k8s-stat-card">
            <div class="k8s-stat-title">${title}</div>
            <div class="k8s-stat-value" style="color:${color};">${value}</div>
            <div class="k8s-stat-sub">${sub}</div>
        </div>`;
    }

    private renderResourceUsageCard(s: K8sClusterStats): string {
        const cpuClass = s.cpuUsage > 80 ? 'danger' : s.cpuUsage > 60 ? 'warning' : 'good';
        const memClass = s.memoryUsage > 80 ? 'danger' : s.memoryUsage > 60 ? 'warning' : 'primary';
        return `
        <div class="k8s-card">
            <h3>资源使用率</h3>
            <div style="display:flex;flex-direction:column;gap:var(--spacing-md);">
                <div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                        <span>CPU</span><span>${s.cpuUsage}%</span>
                    </div>
                    <div class="k8s-progress-bar"><div class="k8s-progress-fill ${cpuClass}" style="width:${s.cpuUsage}%;"></div></div>
                </div>
                <div>
                    <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
                        <span>Memory</span><span>${s.memoryUsage}%</span>
                    </div>
                    <div class="k8s-progress-bar"><div class="k8s-progress-fill ${memClass}" style="width:${s.memoryUsage}%;"></div></div>
                </div>
            </div>
        </div>`;
    }

    private renderRecentEventsCard(): string {
        const recentEvents = this.data.events.slice(0, 8);
        return `
        <div class="k8s-card">
            <h3>最近事件</h3>
            <div style="max-height:200px;overflow:auto;">
                ${recentEvents.length === 0 ? '<div class="k8s-empty-desc" style="text-align:center;padding:20px;">暂无事件</div>' : ''}
                ${recentEvents.map(e => `
                    <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid var(--bg-tertiary);font-size:12px;">
                        <span class="k8s-status-badge k8s-status-${e.type === 'Warning' ? 'failed' : 'running'}" style="flex-shrink:0;">${e.type}</span>
                        <div style="flex:1;min-width:0;">
                            <div style="color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${e.message}</div>
                            <div style="color:var(--text-secondary);font-size:11px;">${e.involvedObject.kind}/${e.involvedObject.name} · ${this.timeAgo(e.lastTimestamp)}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    private renderNodeCard(node: K8sNode): string {
        return `
        <div class="k8s-node-card">
            <div class="k8s-node-card-header">
                <span class="k8s-node-card-name">${node.name}</span>
                <span class="k8s-status-badge k8s-status-${node.status.toLowerCase()}">${node.status}</span>
            </div>
            <div class="k8s-node-card-info">
                <span class="k8s-node-card-label">角色</span>
                <span class="k8s-node-card-value">${node.roles.map(r => `<span class="k8s-chip role">${r}</span>`).join(' ')}</span>
                <span class="k8s-node-card-label">版本</span>
                <span class="k8s-node-card-value">${node.version}</span>
                <span class="k8s-node-card-label">CPU</span>
                <span class="k8s-node-card-value">${node.allocatable.cpu}</span>
                <span class="k8s-node-card-label">内存</span>
                <span class="k8s-node-card-value">${node.allocatable.memory}</span>
            </div>
        </div>`;
    }

    // ============================================================
    // WORKLOADS TAB
    // ============================================================

    private renderWorkloadsTab(): string {
        const subTab = (this.currentSubTab || 'pods') as K8sWorkloadSubTab;
        const subTabs: { id: K8sWorkloadSubTab; label: string; count: number }[] = [
            { id: 'pods', label: 'Pods', count: this.data.pods.length },
            { id: 'deployments', label: 'Deployments', count: this.data.deployments.length },
            { id: 'daemonsets', label: 'DaemonSets', count: this.data.daemonSets.length },
            { id: 'statefulsets', label: 'StatefulSets', count: this.data.statefulSets.length },
            { id: 'jobs', label: 'Jobs', count: this.data.jobs.length },
            { id: 'cronjobs', label: 'CronJobs', count: this.data.cronJobs.length },
        ];

        let content = '';
        switch (subTab) {
            case 'pods': content = this.renderPodsTable(); break;
            case 'deployments': content = this.renderDeploymentsTable(); break;
            case 'daemonsets': content = this.renderDaemonSetsTable(); break;
            case 'statefulsets': content = this.renderStatefulSetsTable(); break;
            case 'jobs': content = this.renderJobsTable(); break;
            case 'cronjobs': content = this.renderCronJobsTable(); break;
        }

        return this.renderSubTabs(subTabs, subTab) + `<div class="k8s-card">${content}</div>`;
    }

    private renderPodsTable(): string {
        const pods = this.filterBySearch(this.data.pods, p => `${p.name} ${p.namespace} ${p.status} ${p.ip} ${p.node}`);
        if (pods.length === 0) return this.renderEmptyInline('暂无 Pods');

        return `
        <div style="overflow-x:auto;">
            <table class="k8s-table">
                <thead><tr>
                    <th>名称</th><th>命名空间</th><th>状态</th><th>重启</th><th>Age</th><th>IP</th><th>节点</th><th style="text-align:right;">操作</th>
                </tr></thead>
                <tbody>
                    ${pods.map(pod => `
                    <tr data-k8s-resource="pod" data-name="${pod.name}" data-namespace="${pod.namespace}">
                        <td>
                            <div class="cell-name">${pod.name}</div>
                            <div class="cell-secondary">${pod.containers.length} container(s)</div>
                        </td>
                        <td><span class="k8s-chip">${pod.namespace}</span></td>
                        <td><span class="k8s-status-badge k8s-status-${this.statusClass(pod.status)}">${pod.status}</span></td>
                        <td style="${pod.restarts >= 5 ? 'color:var(--error-color);font-weight:600;' : ''}">${pod.restarts}</td>
                        <td>${this.calculateAge(pod.creationTimestamp)}</td>
                        <td class="cell-mono">${pod.ip || '-'}</td>
                        <td>${pod.node || '-'}</td>
                        <td class="cell-actions">
                            <button class="k8s-icon-btn" title="日志" data-k8s-action="pod-logs" data-name="${pod.name}" data-namespace="${pod.namespace}">${icon(Log)}</button>
                            <button class="k8s-icon-btn" title="YAML" data-k8s-action="view-yaml" data-kind="pod" data-name="${pod.name}" data-namespace="${pod.namespace}">${icon(FileText)}</button>
                            <button class="k8s-icon-btn" title="Exec" data-k8s-action="pod-exec" data-name="${pod.name}" data-namespace="${pod.namespace}">${icon(Terminal)}</button>
                            <button class="k8s-icon-btn danger" title="删除" data-k8s-action="delete-resource" data-kind="pod" data-name="${pod.name}" data-namespace="${pod.namespace}">${icon(Delete)}</button>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
    }

    private renderDeploymentsTable(): string {
        const items = this.filterBySearch(this.data.deployments, d => `${d.name} ${d.namespace}`);
        if (items.length === 0) return this.renderEmptyInline('暂无 Deployments');

        return `
        <div style="overflow-x:auto;">
            <table class="k8s-table">
                <thead><tr>
                    <th>名称</th><th>命名空间</th><th>就绪</th><th>副本</th><th>Age</th><th>镜像</th><th style="text-align:right;">操作</th>
                </tr></thead>
                <tbody>
                    ${items.map(d => {
                        const readyPct = d.replicas > 0 ? Math.round(d.availableReplicas / d.replicas * 100) : 0;
                        const barClass = readyPct === 100 ? 'good' : readyPct > 50 ? 'warning' : 'danger';
                        return `
                        <tr data-k8s-resource="deployment" data-name="${d.name}" data-namespace="${d.namespace}">
                            <td><div class="cell-name">${d.name}</div></td>
                            <td><span class="k8s-chip">${d.namespace}</span></td>
                            <td>
                                <div style="display:flex;align-items:center;gap:8px;">
                                    <span>${d.availableReplicas}/${d.replicas}</span>
                                    <div class="k8s-progress-bar" style="width:60px;"><div class="k8s-progress-fill ${barClass}" style="width:${readyPct}%;"></div></div>
                                </div>
                            </td>
                            <td>${d.replicas}</td>
                            <td>${this.calculateAge(d.creationTimestamp)}</td>
                            <td class="cell-mono cell-secondary" style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">${d.images.join(', ')}</td>
                            <td class="cell-actions">
                                <button class="k8s-icon-btn" title="扩缩容" data-k8s-action="scale" data-name="${d.name}" data-namespace="${d.namespace}">${icon(SettingConfig)}</button>
                                <button class="k8s-icon-btn" title="YAML" data-k8s-action="view-yaml" data-kind="deployment" data-name="${d.name}" data-namespace="${d.namespace}">${icon(FileText)}</button>
                                <button class="k8s-icon-btn danger" title="缩容至0" data-k8s-action="scale-zero" data-name="${d.name}" data-namespace="${d.namespace}">${icon(CloseOne)}</button>
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
    }

    private renderDaemonSetsTable(): string {
        const items = this.filterBySearch(this.data.daemonSets, d => `${d.name} ${d.namespace}`);
        if (items.length === 0) return this.renderEmptyInline('暂无 DaemonSets');
        return `<div style="overflow-x:auto;"><table class="k8s-table">
            <thead><tr><th>名称</th><th>命名空间</th><th>期望</th><th>就绪</th><th>Age</th><th style="text-align:right;">操作</th></tr></thead>
            <tbody>${items.map(d => `
                <tr><td class="cell-name">${d.name}</td><td><span class="k8s-chip">${d.namespace}</span></td>
                <td>${d.desiredNumberScheduled}</td><td>${d.numberReady}/${d.desiredNumberScheduled}</td>
                <td>${this.calculateAge(d.creationTimestamp)}</td>
                <td class="cell-actions"><button class="k8s-icon-btn" title="YAML" data-k8s-action="view-yaml" data-kind="daemonset" data-name="${d.name}" data-namespace="${d.namespace}">${icon(FileText)}</button></td>
                </tr>`).join('')}</tbody></table></div>`;
    }

    private renderStatefulSetsTable(): string {
        const items = this.filterBySearch(this.data.statefulSets, d => `${d.name} ${d.namespace}`);
        if (items.length === 0) return this.renderEmptyInline('暂无 StatefulSets');
        return `<div style="overflow-x:auto;"><table class="k8s-table">
            <thead><tr><th>名称</th><th>命名空间</th><th>就绪</th><th>副本</th><th>Service</th><th>Age</th><th style="text-align:right;">操作</th></tr></thead>
            <tbody>${items.map(d => `
                <tr><td class="cell-name">${d.name}</td><td><span class="k8s-chip">${d.namespace}</span></td>
                <td>${d.readyReplicas}/${d.replicas}</td><td>${d.replicas}</td>
                <td class="cell-mono">${d.serviceName}</td><td>${this.calculateAge(d.creationTimestamp)}</td>
                <td class="cell-actions"><button class="k8s-icon-btn" title="YAML" data-k8s-action="view-yaml" data-kind="statefulset" data-name="${d.name}" data-namespace="${d.namespace}">${icon(FileText)}</button></td>
                </tr>`).join('')}</tbody></table></div>`;
    }

    private renderJobsTable(): string {
        const items = this.filterBySearch(this.data.jobs, j => `${j.name} ${j.namespace}`);
        if (items.length === 0) return this.renderEmptyInline('暂无 Jobs');
        return `<div style="overflow-x:auto;"><table class="k8s-table">
            <thead><tr><th>名称</th><th>命名空间</th><th>完成</th><th>成功</th><th>失败</th><th>耗时</th><th>Age</th></tr></thead>
            <tbody>${items.map(j => `
                <tr><td class="cell-name">${j.name}</td><td><span class="k8s-chip">${j.namespace}</span></td>
                <td>${j.succeeded}/${j.completions}</td><td style="color:var(--success-color);">${j.succeeded}</td>
                <td style="${j.failed > 0 ? 'color:var(--error-color);font-weight:600;' : ''}">${j.failed}</td>
                <td>${j.duration || '-'}</td><td>${this.calculateAge(j.creationTimestamp)}</td>
                </tr>`).join('')}</tbody></table></div>`;
    }

    private renderCronJobsTable(): string {
        const items = this.filterBySearch(this.data.cronJobs, c => `${c.name} ${c.namespace} ${c.schedule}`);
        if (items.length === 0) return this.renderEmptyInline('暂无 CronJobs');
        return `<div style="overflow-x:auto;"><table class="k8s-table">
            <thead><tr><th>名称</th><th>命名空间</th><th>Schedule</th><th>暂停</th><th>活跃</th><th>上次调度</th><th>Age</th></tr></thead>
            <tbody>${items.map(c => `
                <tr><td class="cell-name">${c.name}</td><td><span class="k8s-chip">${c.namespace}</span></td>
                <td class="cell-mono">${c.schedule}</td>
                <td>${c.suspend ? '<span class="k8s-status-badge k8s-status-pending">暂停</span>' : '<span class="k8s-status-badge k8s-status-running">活跃</span>'}</td>
                <td>${c.activeJobs}</td><td>${c.lastScheduleTime ? this.timeAgo(c.lastScheduleTime) : '-'}</td>
                <td>${this.calculateAge(c.creationTimestamp)}</td>
                </tr>`).join('')}</tbody></table></div>`;
    }

    // ============================================================
    // NETWORKING TAB
    // ============================================================

    private renderNetworkingTab(): string {
        const subTab = (this.currentSubTab || 'services') as K8sNetworkSubTab;
        const subTabs = [
            { id: 'services' as K8sNetworkSubTab, label: 'Services', count: this.data.services.length },
            { id: 'ingress' as K8sNetworkSubTab, label: 'Ingress', count: this.data.ingresses.length },
            { id: 'networkpolicies' as K8sNetworkSubTab, label: 'NetworkPolicies', count: this.data.networkPolicies.length },
        ];

        let content = '';
        switch (subTab) {
            case 'services': content = this.renderServicesTable(); break;
            case 'ingress': content = this.renderIngressTable(); break;
            case 'networkpolicies': content = this.renderNetworkPoliciesTable(); break;
        }
        return this.renderSubTabs(subTabs, subTab) + `<div class="k8s-card">${content}</div>`;
    }

    private renderServicesTable(): string {
        const items = this.filterBySearch(this.data.services, s => `${s.name} ${s.namespace} ${s.type} ${s.clusterIP}`);
        if (items.length === 0) return this.renderEmptyInline('暂无 Services');
        return `<div style="overflow-x:auto;"><table class="k8s-table">
            <thead><tr><th>名称</th><th>命名空间</th><th>类型</th><th>Cluster IP</th><th>端口</th><th>Age</th><th style="text-align:right;">操作</th></tr></thead>
            <tbody>${items.map(s => `
                <tr><td class="cell-name">${s.name}</td><td><span class="k8s-chip">${s.namespace}</span></td>
                <td><span class="k8s-chip type">${s.type}</span></td>
                <td class="cell-mono">${s.clusterIP}</td>
                <td>${s.ports.map(p => `<span class="k8s-chip port">${p.port}${p.nodePort ? ':' + p.nodePort : ''}/${p.protocol}</span>`).join(' ')}</td>
                <td>${this.calculateAge(s.creationTimestamp)}</td>
                <td class="cell-actions"><button class="k8s-icon-btn" title="YAML" data-k8s-action="view-yaml" data-kind="service" data-name="${s.name}" data-namespace="${s.namespace}">${icon(FileText)}</button></td>
                </tr>`).join('')}</tbody></table></div>`;
    }

    private renderIngressTable(): string {
        const items = this.filterBySearch(this.data.ingresses, i => `${i.name} ${i.namespace} ${i.rules.map(r => r.host).join(' ')}`);
        if (items.length === 0) return this.renderEmptyInline('暂无 Ingress');
        return `<div style="overflow-x:auto;"><table class="k8s-table">
            <thead><tr><th>名称</th><th>命名空间</th><th>Class</th><th>主机</th><th>TLS</th><th>Age</th></tr></thead>
            <tbody>${items.map(i => `
                <tr><td class="cell-name">${i.name}</td><td><span class="k8s-chip">${i.namespace}</span></td>
                <td>${i.ingressClassName || '-'}</td>
                <td>${i.rules.map(r => `<div>${r.host} → ${r.paths.map(p => `${p.path} → ${p.backend}`).join(', ')}</div>`).join('')}</td>
                <td>${i.tls.length > 0 ? `<span class="k8s-status-badge k8s-status-running">TLS</span>` : '-'}</td>
                <td>${this.calculateAge(i.creationTimestamp)}</td>
                </tr>`).join('')}</tbody></table></div>`;
    }

    private renderNetworkPoliciesTable(): string {
        const items = this.filterBySearch(this.data.networkPolicies, n => `${n.name} ${n.namespace}`);
        if (items.length === 0) return this.renderEmptyInline('暂无 NetworkPolicies');
        return `<div style="overflow-x:auto;"><table class="k8s-table">
            <thead><tr><th>名称</th><th>命名空间</th><th>Pod 选择器</th><th>类型</th><th>Ingress 规则</th><th>Egress 规则</th><th>来源</th></tr></thead>
            <tbody>${items.map(n => `
                <tr>
                <td class="cell-name">${n.name} ${n.isIsolationPolicy ? '<span class="k8s-severity-badge k8s-severity-critical" style="margin-left:4px;">应急隔离</span>' : ''}</td>
                <td><span class="k8s-chip">${n.namespace}</span></td>
                <td class="cell-mono cell-secondary">${Object.entries(n.podSelector).map(([k,v]) => `${k}=${v}`).join(', ') || 'All'}</td>
                <td>${n.policyTypes.join(', ')}</td>
                <td>${n.ingressRuleCount}</td><td>${n.egressRuleCount}</td>
                <td>${n.isIsolationPolicy ? '<span style="color:var(--error-color);">LovelyRes</span>' : '-'}</td>
                </tr>`).join('')}</tbody></table></div>`;
    }

    // ============================================================
    // STORAGE TAB
    // ============================================================

    private renderStorageTab(): string {
        const subTab = (this.currentSubTab || 'pvc') as K8sStorageSubTab;
        const subTabs = [
            { id: 'pvc' as K8sStorageSubTab, label: 'PVC', count: this.data.pvcs.length },
            { id: 'pv' as K8sStorageSubTab, label: 'PV', count: this.data.pvs.length },
            { id: 'configmaps' as K8sStorageSubTab, label: 'ConfigMaps', count: this.data.configMaps.length },
            { id: 'secrets' as K8sStorageSubTab, label: 'Secrets', count: this.data.secrets.length },
        ];

        let content = '';
        switch (subTab) {
            case 'pvc': content = this.renderPVCTable(); break;
            case 'pv': content = this.renderPVTable(); break;
            case 'configmaps': content = this.renderConfigMapsTable(); break;
            case 'secrets': content = this.renderSecretsTable(); break;
        }
        return this.renderSubTabs(subTabs, subTab) + `<div class="k8s-card">${content}</div>`;
    }

    private renderPVCTable(): string {
        const items = this.data.pvcs;
        if (items.length === 0) return this.renderEmptyInline('暂无 PVC');
        return `<div style="overflow-x:auto;"><table class="k8s-table">
            <thead><tr><th>名称</th><th>命名空间</th><th>状态</th><th>Volume</th><th>容量</th><th>访问模式</th><th>Storage Class</th><th>Age</th></tr></thead>
            <tbody>${items.map(p => `
                <tr><td class="cell-name">${p.name}</td><td><span class="k8s-chip">${p.namespace}</span></td>
                <td><span class="k8s-status-badge k8s-status-${p.status.toLowerCase()}">${p.status}</span></td>
                <td class="cell-mono">${p.volume || '-'}</td><td>${p.capacity || '-'}</td>
                <td>${p.accessModes.join(', ')}</td><td>${p.storageClassName || '-'}</td>
                <td>${this.calculateAge(p.creationTimestamp)}</td>
                </tr>`).join('')}</tbody></table></div>`;
    }

    private renderPVTable(): string {
        const items = this.data.pvs;
        if (items.length === 0) return this.renderEmptyInline('暂无 PV');
        return `<div style="overflow-x:auto;"><table class="k8s-table">
            <thead><tr><th>名称</th><th>容量</th><th>访问模式</th><th>回收策略</th><th>状态</th><th>Claim</th><th>Storage Class</th></tr></thead>
            <tbody>${items.map(p => `
                <tr><td class="cell-name">${p.name}</td><td>${p.capacity}</td>
                <td>${p.accessModes.join(', ')}</td><td>${p.reclaimPolicy}</td>
                <td><span class="k8s-status-badge k8s-status-${p.status.toLowerCase()}">${p.status}</span></td>
                <td class="cell-mono">${p.claimRef || '-'}</td><td>${p.storageClassName || '-'}</td>
                </tr>`).join('')}</tbody></table></div>`;
    }

    private renderConfigMapsTable(): string {
        const items = this.data.configMaps;
        if (items.length === 0) return this.renderEmptyInline('暂无 ConfigMaps');
        return `<div style="overflow-x:auto;"><table class="k8s-table">
            <thead><tr><th>名称</th><th>命名空间</th><th>数据键数</th><th>Age</th><th style="text-align:right;">操作</th></tr></thead>
            <tbody>${items.map(c => `
                <tr><td class="cell-name">${c.name}</td><td><span class="k8s-chip">${c.namespace}</span></td>
                <td>${c.dataCount}</td><td>${this.calculateAge(c.creationTimestamp)}</td>
                <td class="cell-actions"><button class="k8s-icon-btn" title="YAML" data-k8s-action="view-yaml" data-kind="configmap" data-name="${c.name}" data-namespace="${c.namespace}">${icon(FileText)}</button></td>
                </tr>`).join('')}</tbody></table></div>`;
    }

    private renderSecretsTable(): string {
        const items = this.data.secrets;
        if (items.length === 0) return this.renderEmptyInline('暂无 Secrets');
        return `<div style="overflow-x:auto;"><table class="k8s-table">
            <thead><tr><th>名称</th><th>命名空间</th><th>类型</th><th>数据键数</th><th>Age</th></tr></thead>
            <tbody>${items.map(s => `
                <tr><td class="cell-name">${s.name}</td><td><span class="k8s-chip">${s.namespace}</span></td>
                <td class="cell-mono cell-secondary">${s.type}</td><td>${s.dataCount}</td>
                <td>${this.calculateAge(s.creationTimestamp)}</td>
                </tr>`).join('')}</tbody></table></div>`;
    }

    // ============================================================
    // SECURITY TAB
    // ============================================================

    private renderSecurityTab(): string {
        const subTab = (this.currentSubTab || 'audit') as K8sSecuritySubTab;
        const subTabs = [
            { id: 'audit' as K8sSecuritySubTab, label: '安全审计', count: this.data.auditResult?.findings.length || 0 },
            { id: 'rbac' as K8sSecuritySubTab, label: 'RBAC', count: this.data.clusterRoleBindings.length },
            { id: 'pod-security' as K8sSecuritySubTab, label: 'Pod 安全', count: 0 },
        ];

        let content = '';
        switch (subTab) {
            case 'audit': content = this.renderAuditTab(); break;
            case 'rbac': content = this.renderRBACTab(); break;
            case 'pod-security': content = this.renderPodSecurityTab(); break;
        }
        return this.renderSubTabs(subTabs, subTab) + content;
    }

    private renderAuditTab(): string {
        const result = this.data.auditResult;

        const scanButton = `
        <div style="display:flex;align-items:center;gap:var(--spacing-md);margin-bottom:var(--spacing-md);">
            <button class="modern-btn primary" data-k8s-action="run-audit" style="display:flex;align-items:center;gap:6px;">
                ${icon(Shield, '16')} 运行安全审计
            </button>
            ${result ? `<span style="font-size:12px;color:var(--text-secondary);">上次扫描: ${this.timeAgo(result.timestamp)} · 耗时 ${result.duration}ms</span>` : ''}
        </div>`;

        if (!result) {
            return scanButton + `
            <div class="k8s-empty-state">
                <div class="k8s-empty-icon">${icon(Shield, '32')}</div>
                <div class="k8s-empty-title">安全审计</div>
                <div class="k8s-empty-desc">点击上方按钮运行一键安全审计，检测集群中的安全风险</div>
            </div>`;
        }

        const scoreClass = result.summary.score >= 80 ? 'good' : result.summary.score >= 50 ? 'warning' : 'danger';

        return scanButton + `
        <div style="display:grid;grid-template-columns:auto 1fr;gap:var(--spacing-lg);margin-bottom:var(--spacing-md);">
            <div style="display:flex;flex-direction:column;align-items:center;gap:var(--spacing-sm);">
                <div class="k8s-score-gauge ${scoreClass}">${result.summary.score}</div>
                <div style="font-size:12px;color:var(--text-secondary);">安全评分</div>
            </div>
            <div style="display:flex;gap:var(--spacing-lg);align-items:center;flex-wrap:wrap;">
                ${result.summary.critical > 0 ? `<div><span class="k8s-severity-badge k8s-severity-critical">${result.summary.critical} 严重</span></div>` : ''}
                ${result.summary.high > 0 ? `<div><span class="k8s-severity-badge k8s-severity-high">${result.summary.high} 高危</span></div>` : ''}
                ${result.summary.medium > 0 ? `<div><span class="k8s-severity-badge k8s-severity-medium">${result.summary.medium} 中危</span></div>` : ''}
                ${result.summary.low > 0 ? `<div><span class="k8s-severity-badge k8s-severity-low">${result.summary.low} 低危</span></div>` : ''}
                <div style="font-size:13px;color:var(--text-secondary);">共 ${result.summary.total} 项发现</div>
            </div>
        </div>
        <div>
            ${result.findings.map(f => this.renderAuditFinding(f)).join('')}
        </div>`;
    }

    private renderAuditFinding(f: K8sSecurityFinding): string {
        return `
        <div class="k8s-audit-finding">
            <span class="k8s-severity-badge k8s-severity-${f.severity}" style="flex-shrink:0;">${f.severity.toUpperCase()}</span>
            <div class="k8s-audit-finding-content">
                <div class="k8s-audit-finding-resource">${f.namespace}/${f.resource} · ${f.category}</div>
                <div class="k8s-audit-finding-desc">${f.description}</div>
                <div class="k8s-audit-finding-remediation">${f.remediation}</div>
            </div>
        </div>`;
    }

    private renderRBACTab(): string {
        return `
        <div class="k8s-card" style="margin-bottom:var(--spacing-md);">
            <h3>ClusterRoleBindings (${this.data.clusterRoleBindings.length})</h3>
            <div style="overflow-x:auto;"><table class="k8s-table">
                <thead><tr><th>名称</th><th>角色</th><th>主体</th><th>Age</th></tr></thead>
                <tbody>${this.data.clusterRoleBindings.slice(0, 50).map(b => `
                    <tr><td class="cell-name">${b.name}</td>
                    <td><span class="k8s-chip role">${b.roleRef.kind}/${b.roleRef.name}</span></td>
                    <td>${b.subjects.map(s => `<span class="k8s-chip">${s.kind}/${s.name}${s.namespace ? '@' + s.namespace : ''}</span>`).join(' ')}</td>
                    <td>${this.calculateAge(b.creationTimestamp)}</td>
                    </tr>`).join('')}</tbody>
            </table></div>
        </div>
        <div class="k8s-card">
            <h3>RoleBindings (${this.data.roleBindings.length})</h3>
            <div style="overflow-x:auto;"><table class="k8s-table">
                <thead><tr><th>名称</th><th>命名空间</th><th>角色</th><th>主体</th></tr></thead>
                <tbody>${this.data.roleBindings.slice(0, 50).map(b => `
                    <tr><td class="cell-name">${b.name}</td>
                    <td><span class="k8s-chip">${b.namespace}</span></td>
                    <td><span class="k8s-chip role">${b.roleRef.name}</span></td>
                    <td>${b.subjects.map(s => `<span class="k8s-chip">${s.kind}/${s.name}</span>`).join(' ')}</td>
                    </tr>`).join('')}</tbody>
            </table></div>
        </div>`;
    }

    private renderPodSecurityTab(): string {
        const privilegedPods = this.data.pods.filter(p => p.hostNetwork);
        return `
        <div class="k8s-card">
            <h3>使用 Host Network 的 Pod (${privilegedPods.length})</h3>
            ${privilegedPods.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--text-secondary);">无使用 hostNetwork 的 Pod</div>' :
            `<div style="overflow-x:auto;"><table class="k8s-table">
                <thead><tr><th>名称</th><th>命名空间</th><th>状态</th><th>ServiceAccount</th><th>节点</th></tr></thead>
                <tbody>${privilegedPods.map(p => `
                    <tr><td class="cell-name">${p.name}</td><td><span class="k8s-chip">${p.namespace}</span></td>
                    <td><span class="k8s-status-badge k8s-status-${this.statusClass(p.status)}">${p.status}</span></td>
                    <td class="cell-mono">${p.serviceAccount || 'default'}</td><td>${p.node}</td>
                    </tr>`).join('')}</tbody></table></div>`}
        </div>`;
    }

    // ============================================================
    // EVENTS & LOGS TAB
    // ============================================================

    private renderEventsTab(): string {
        const subTab = (this.currentSubTab || 'events') as K8sEventsSubTab;
        const subTabs = [
            { id: 'events' as K8sEventsSubTab, label: '事件流', count: this.data.events.length },
            { id: 'logs' as K8sEventsSubTab, label: 'Pod 日志', count: 0 },
        ];

        let content = '';
        switch (subTab) {
            case 'events': content = this.renderEventsStream(); break;
            case 'logs': content = this.renderPodLogSelector(); break;
        }
        return this.renderSubTabs(subTabs, subTab) + content;
    }

    private renderEventsStream(): string {
        const events = this.filterBySearch(this.data.events, e => `${e.message} ${e.reason} ${e.involvedObject.kind} ${e.involvedObject.name}`);
        if (events.length === 0) return `<div class="k8s-card">${this.renderEmptyInline('暂无事件')}</div>`;

        return `
        <div class="k8s-card">
            <div style="overflow-x:auto;max-height:600px;overflow-y:auto;">
                <table class="k8s-table">
                    <thead><tr><th>类型</th><th>原因</th><th>对象</th><th>消息</th><th>次数</th><th>时间</th></tr></thead>
                    <tbody>${events.map(e => `
                        <tr>
                        <td><span class="k8s-status-badge k8s-status-${e.type === 'Warning' ? 'failed' : 'running'}">${e.type}</span></td>
                        <td style="font-weight:500;">${e.reason}</td>
                        <td class="cell-mono cell-secondary">${e.involvedObject.kind}/${e.involvedObject.name}</td>
                        <td style="max-width:400px;overflow:hidden;text-overflow:ellipsis;">${e.message}</td>
                        <td>${e.count}</td>
                        <td class="cell-secondary">${this.timeAgo(e.lastTimestamp)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        </div>`;
    }

    private renderPodLogSelector(): string {
        return `
        <div class="k8s-card">
            <h3>Pod 日志查看器</h3>
            <div style="display:flex;gap:var(--spacing-sm);margin-bottom:var(--spacing-md);flex-wrap:wrap;">
                <select class="k8s-namespace-selector" id="k8s-log-pod-select" style="min-width:200px;">
                    <option value="">选择 Pod...</option>
                    ${this.data.pods.map(p => `<option value="${p.namespace}/${p.name}">${p.namespace}/${p.name}</option>`).join('')}
                </select>
                <select class="k8s-namespace-selector" id="k8s-log-tail-select">
                    <option value="100">100 行</option>
                    <option value="500">500 行</option>
                    <option value="1000">1000 行</option>
                </select>
                <button class="modern-btn primary" data-k8s-action="fetch-logs" style="display:flex;align-items:center;gap:6px;">
                    ${icon(Log, '16')} 获取日志
                </button>
            </div>
            <div id="k8s-log-output" class="k8s-log-viewer" style="min-height:200px;">
                <span style="color:var(--text-secondary);">选择一个 Pod 并点击"获取日志"</span>
            </div>
        </div>`;
    }

    // ============================================================
    // EMERGENCY RESPONSE TAB
    // ============================================================

    private renderEmergencyTab(): string {
        return `
        ${this.renderEmergencyQuickActions()}
        ${this.renderAnomalyAlerts()}
        ${this.renderIsolationStatus()}
        ${this.renderActionHistory()}
        ${this.renderEventTimeline()}`;
    }

    private renderEmergencyQuickActions(): string {
        return `
        <div class="k8s-card" style="margin-bottom:var(--spacing-md);">
            <h3 style="display:flex;align-items:center;gap:8px;">${icon(Fire, '18')} 快速操作</h3>
            <div class="k8s-emergency-actions">
                <button class="k8s-emergency-action-btn danger" data-k8s-action="emergency-isolate">
                    <div class="k8s-emergency-action-icon" style="background:rgba(220,38,38,0.1);color:#dc2626;">${icon(Lock, '24')}</div>
                    <div class="k8s-emergency-action-title">隔离 Pod</div>
                    <div class="k8s-emergency-action-desc">应用 deny-all NetworkPolicy</div>
                </button>
                <button class="k8s-emergency-action-btn danger" data-k8s-action="emergency-scale-zero">
                    <div class="k8s-emergency-action-icon" style="background:rgba(239,68,68,0.1);color:#ef4444;">${icon(CloseOne, '24')}</div>
                    <div class="k8s-emergency-action-title">缩容至 0</div>
                    <div class="k8s-emergency-action-desc">将 Deployment 副本数缩至 0</div>
                </button>
                <button class="k8s-emergency-action-btn" data-k8s-action="emergency-cordon">
                    <div class="k8s-emergency-action-icon" style="background:rgba(245,158,11,0.1);color:#f59e0b;">${icon(Shield, '24')}</div>
                    <div class="k8s-emergency-action-title">封锁节点</div>
                    <div class="k8s-emergency-action-desc">阻止新 Pod 调度到节点</div>
                </button>
                <button class="k8s-emergency-action-btn" data-k8s-action="emergency-drain">
                    <div class="k8s-emergency-action-icon" style="background:rgba(59,130,246,0.1);color:#3b82f6;">${icon(Rocket, '24')}</div>
                    <div class="k8s-emergency-action-title">排空节点</div>
                    <div class="k8s-emergency-action-desc">安全驱逐节点上所有 Pod</div>
                </button>
                <button class="k8s-emergency-action-btn" data-k8s-action="emergency-forensic">
                    <div class="k8s-emergency-action-icon" style="background:rgba(139,92,246,0.1);color:#8b5cf6;">${icon(Analysis, '24')}</div>
                    <div class="k8s-emergency-action-title">取证快照</div>
                    <div class="k8s-emergency-action-desc">捕获 Pod 完整取证数据</div>
                </button>
                <button class="k8s-emergency-action-btn" data-k8s-action="run-audit">
                    <div class="k8s-emergency-action-icon" style="background:rgba(16,185,129,0.1);color:#10b981;">${icon(CheckOne, '24')}</div>
                    <div class="k8s-emergency-action-title">安全审计</div>
                    <div class="k8s-emergency-action-desc">一键扫描集群安全风险</div>
                </button>
            </div>
        </div>`;
    }

    private renderAnomalyAlerts(): string {
        if (this.data.anomalies.length === 0) return '';

        return `
        <div class="k8s-card" style="margin-bottom:var(--spacing-md);">
            <h3>异常告警 (${this.data.anomalies.length})</h3>
            ${this.data.anomalies.map(a => `
                <div class="k8s-anomaly-alert ${a.severity}">
                    <span class="k8s-severity-badge k8s-severity-${a.severity}" style="flex-shrink:0;">${a.severity.toUpperCase()}</span>
                    <div style="flex:1;">
                        <div style="font-weight:500;font-size:13px;color:var(--text-primary);">${a.type.replace(/_/g, ' ').toUpperCase()}</div>
                        <div style="font-size:12px;color:var(--text-secondary);">${a.namespace}/${a.pod} — ${a.details}</div>
                    </div>
                    <span style="font-size:11px;color:var(--text-secondary);">${this.timeAgo(a.timestamp)}</span>
                </div>
            `).join('')}
        </div>`;
    }

    private renderIsolationStatus(): string {
        if (this.data.isolatedPods.length === 0) return '';

        return `
        <div class="k8s-card" style="margin-bottom:var(--spacing-md);">
            <h3 style="color:var(--error-color);">当前隔离状态 (${this.data.isolatedPods.length})</h3>
            ${this.data.isolatedPods.map(item => `
                <div class="k8s-isolation-card">
                    <div class="k8s-isolation-card-info">
                        <div class="k8s-isolation-card-pod">${icon(Lock, '14')} ${item.pod}</div>
                        <div class="k8s-isolation-card-policy">Policy: ${item.policy}</div>
                    </div>
                    <button class="modern-btn secondary" data-k8s-action="remove-isolation" data-pod="${item.pod}" style="font-size:12px;">
                        解除隔离
                    </button>
                </div>
            `).join('')}
        </div>`;
    }

    private renderActionHistory(): string {
        if (this.data.emergencyActions.length === 0) return '';

        return `
        <div class="k8s-card" style="margin-bottom:var(--spacing-md);">
            <h3>操作历史</h3>
            ${this.data.emergencyActions.slice(0, 20).map(a => `
                <div class="k8s-action-history-item">
                    <span class="action-type">${a.type}</span>
                    <span class="action-target">${a.namespace ? a.namespace + '/' : ''}${a.target}</span>
                    <span class="k8s-status-badge k8s-status-${a.status === 'completed' ? 'running' : a.status === 'failed' ? 'failed' : 'pending'}">${a.status}</span>
                    ${a.rollbackCommand ? `<button class="k8s-icon-btn" title="回滚" data-k8s-action="rollback" data-action-id="${a.id}">${icon(Refresh, '14')}</button>` : ''}
                    <span class="action-time">${this.timeAgo(a.timestamp)}</span>
                </div>
            `).join('')}
        </div>`;
    }

    private renderEventTimeline(): string {
        const warningEvents = this.data.events.filter(e => e.type === 'Warning').slice(0, 15);
        if (warningEvents.length === 0) return '';

        return `
        <div class="k8s-card">
            <h3>Warning 事件时间线</h3>
            <div class="k8s-timeline">
                ${warningEvents.map(e => `
                    <div class="k8s-timeline-item">
                        <div class="k8s-timeline-dot warning"></div>
                        <div class="k8s-timeline-time">${this.timeAgo(e.lastTimestamp)}</div>
                        <div class="k8s-timeline-content">${e.reason}: ${e.message}</div>
                        <div class="k8s-timeline-source">${e.involvedObject.kind}/${e.involvedObject.name}</div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    // ============================================================
    // Shared Components
    // ============================================================

    private renderSubTabs(tabs: { id: string; label: string; count: number }[], active: string): string {
        return `
        <div class="k8s-sub-tabs">
            ${tabs.map(t => `
                <button class="k8s-sub-tab-btn ${active === t.id ? 'active' : ''}"
                        data-k8s-action="switch-sub-tab" data-sub-tab="${t.id}">
                    ${t.label} ${t.count > 0 ? `<span style="opacity:0.7;">(${t.count})</span>` : ''}
                </button>
            `).join('')}
        </div>`;
    }

    private renderLoading(): string {
        return `<div style="display:flex;justify-content:center;align-items:center;height:200px;gap:10px;">
            <svg width="28" height="28" viewBox="0 0 36 36" style="display:block;">
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

    private renderEmptyInline(msg: string): string {
        return `<div style="padding:40px;text-align:center;color:var(--text-secondary);">${icon(Cube, '32')}<div style="margin-top:8px;">${msg}</div></div>`;
    }

    // ============================================================
    // Utilities
    // ============================================================

    private calculateAge(timestamp: string): string {
        if (!timestamp) return '-';
        const diff = Date.now() - new Date(timestamp).getTime();
        const days = Math.floor(diff / 86400000);
        if (days > 0) return `${days}d`;
        const hours = Math.floor(diff / 3600000);
        if (hours > 0) return `${hours}h`;
        const minutes = Math.floor(diff / 60000);
        return `${minutes}m`;
    }

    private timeAgo(timestamp: string): string {
        if (!timestamp) return '-';
        const diff = Date.now() - new Date(timestamp).getTime();
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
        return `${Math.floor(diff / 86400000)} 天前`;
    }

    private statusClass(status: string): string {
        const map: Record<string, string> = {
            'Running': 'running', 'Ready': 'ready', 'Succeeded': 'succeeded',
            'Pending': 'pending', 'Failed': 'failed', 'CrashLoopBackOff': 'crashloopbackoff',
            'NotReady': 'notready', 'Terminating': 'terminating', 'Unknown': 'unknown',
            'Active': 'active', 'Bound': 'bound', 'Available': 'running'
        };
        return map[status] || 'unknown';
    }

    private filterBySearch<T>(items: T[], getText: (item: T) => string): T[] {
        if (!this.searchTerm) return items;
        const term = this.searchTerm.toLowerCase();
        return items.filter(item => getText(item).toLowerCase().includes(term));
    }
}
