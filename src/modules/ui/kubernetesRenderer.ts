
import {
    LinkCloud,
    Cube,
    ApplicationMenu,
    NetworkTree,
    SettingConfig,
    Refresh,
    Plus,
    More,
    Delete
} from '@icon-park/svg';
import { K8sPod, K8sDeployment, K8sService, K8sNode, K8sClusterStats } from '../kubernetes/types';

export class KubernetesRenderer {
    private currentTab: string = 'overview';
    private loading: boolean = false;
    private initialized: boolean = false;
    
    private data: {
        pods: K8sPod[];
        deployments: K8sDeployment[];
        services: K8sService[];
        nodes: K8sNode[];
        stats: K8sClusterStats | null;
    } = {
        pods: [],
        deployments: [],
        services: [],
        nodes: [],
        stats: null
    };

    constructor() {
        // Initialize
    }

    /**
     * Render the Kubernetes management page
     */
    render(): string {
        // Trigger data load if not initialized
        if (!this.initialized) {
            this.initialized = true;
            this.refreshData();
        }

        return `
      <div class="kubernetes-page" style="height: 100%; display: flex; flex-direction: column; gap: var(--spacing-md);">
        ${this.renderHeader()}
        ${this.renderTabs()}
        <div id="k8s-content-area" class="kubernetes-content" style="flex: 1; overflow: auto;">
          ${this.loading ? this.renderLoading() : this.renderCurrentTab()}
        </div>
      </div>
    `;
    }

    public async refreshData() {
        this.loading = true;
        this.updateView(); // Show loading

        try {
            const manager = (window as any).app.kubernetesManager;
            if (!manager) {
                console.error('KubernetesManager not found');
                return;
            }

            const [pods, deployments, services, nodes, stats] = await Promise.all([
                manager.getPods(),
                manager.getDeployments(),
                manager.getServices(),
                manager.getNodes(),
                manager.getClusterStats()
            ]);

            this.data = { pods, deployments, services, nodes, stats };
        } catch (e) {
            console.error('Failed to load Kubernetes data', e);
        } finally {
            this.loading = false;
            this.updateView();
        }
    }

    private updateView() {
        const contentArea = document.getElementById('k8s-content-area');
        if (contentArea) {
            contentArea.innerHTML = this.loading ? this.renderLoading() : this.renderCurrentTab();
        }
    }

    private renderLoading(): string {
        return `
            <div style="display: flex; justify-content: center; align-items: center; height: 100%;">
                <div class="loading-spinner" style="border: 3px solid var(--bg-tertiary); border-top: 3px solid var(--primary-color); border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite;"></div>
                <span style="margin-left: 10px; color: var(--text-secondary);">加载中...</span>
            </div>
        `;
    }

    private renderHeader(): string {
        return `
      <div class="kubernetes-header" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: var(--spacing-md);
        background: var(--bg-secondary);
        border-radius: var(--border-radius-lg);
        border: 1px solid var(--border-color);
      ">
        <div style="display: flex; align-items: center; gap: var(--spacing-md);">
          <div style="
            width: 40px;
            height: 40px;
            border-radius: var(--border-radius);
            background: rgba(59, 130, 246, 0.1);
            color: #3b82f6;
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            ${LinkCloud({ theme: 'filled', size: '24', fill: 'currentColor' })}
          </div>
          <div>
            <h2 style="margin: 0; font-size: 18px; font-weight: 600; color: var(--text-primary);">Kubernetes 管理</h2>
            <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
              管理您的 K8s 集群资源
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: var(--spacing-sm);">
          <button class="modern-btn secondary" onclick="(window as any).app.modernUIRenderer.kubernetesRenderer.refreshData()" style="display: flex; align-items: center; gap: 6px;">
            ${Refresh({ theme: 'outline', size: '16', fill: 'currentColor' })}
            刷新
          </button>
          <button class="modern-btn primary" style="display: flex; align-items: center; gap: 6px;">
            ${Plus({ theme: 'outline', size: '16', fill: 'currentColor' })}
            添加集群
          </button>
        </div>
      </div>
    `;
    }

    private renderTabs(): string {
        const tabs = [
            { id: 'overview', label: '概览', icon: LinkCloud },
            { id: 'pods', label: 'Pods', icon: Cube },
            { id: 'deployments', label: 'Deployments', icon: ApplicationMenu },
            { id: 'services', label: 'Services', icon: NetworkTree },
            { id: 'config', label: '配置', icon: SettingConfig }
        ];

        return `
      <div class="kubernetes-tabs" style="
        display: flex;
        gap: var(--spacing-sm);
        border-bottom: 1px solid var(--border-color);
        padding-bottom: 2px;
      ">
        ${tabs.map(tab => `
          <button 
            class="k8s-tab-btn ${this.currentTab === tab.id ? 'active' : ''}" 
            onclick="window.switchKubernetesTab('${tab.id}')"
            style="
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 8px 16px;
              border: none;
              background: transparent;
              color: ${this.currentTab === tab.id ? 'var(--primary-color)' : 'var(--text-secondary)'};
              border-bottom: 2px solid ${this.currentTab === tab.id ? 'var(--primary-color)' : 'transparent'};
              cursor: pointer;
              font-size: 14px;
              font-weight: 500;
              transition: all 0.2s;
            "
          >
            ${tab.icon({ theme: this.currentTab === tab.id ? 'filled' : 'outline', size: '16', fill: 'currentColor' })}
            ${tab.label}
          </button>
        `).join('')}
      </div>
    `;
    }

    private renderCurrentTab(): string {
        switch (this.currentTab) {
            case 'pods':
                return this.renderPodsTab();
            case 'deployments':
                return this.renderDeploymentsTab();
            case 'services':
                return this.renderServicesTab();
            case 'config':
                return this.renderConfigTab();
            case 'overview':
            default:
                return this.renderOverviewTab();
        }
    }

    private renderOverviewTab(): string {
        const stats = this.data.stats || {
            totalPods: 0,
            runningPods: 0,
            totalDeployments: 0,
            totalServices: 0,
            healthyNodes: 0,
            totalNodes: 0,
            cpuUsage: 0,
            memoryUsage: 0
        };

        return `
      <div class="k8s-overview-grid" style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: var(--spacing-md);
      ">
        <!-- Cluster Status -->
        <div class="modern-card" style="padding: var(--spacing-md);">
          <h3 style="margin-top: 0; margin-bottom: var(--spacing-md); font-size: 16px;">集群状态</h3>
          <div style="display: flex; gap: var(--spacing-lg);">
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: var(--success-color);">Active</div>
              <div style="font-size: 12px; color: var(--text-secondary);">状态</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: var(--text-primary);">v1.26.3</div>
              <div style="font-size: 12px; color: var(--text-secondary);">版本</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: var(--text-primary);">${stats.totalNodes}</div>
              <div style="font-size: 12px; color: var(--text-secondary);">节点数</div>
            </div>
            <div style="text-align: center;">
                <div style="font-size: 24px; font-weight: bold; color: var(--text-primary);">${stats.totalPods}</div>
                <div style="font-size: 12px; color: var(--text-secondary);">Pods</div>
            </div>
          </div>
        </div>

        <!-- Resource Usage -->
        <div class="modern-card" style="padding: var(--spacing-md);">
          <h3 style="margin-top: 0; margin-bottom: var(--spacing-md); font-size: 16px;">资源使用率</h3>
          <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                <span>CPU</span>
                <span>${stats.cpuUsage}%</span>
              </div>
              <div style="height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">
                <div style="width: ${stats.cpuUsage}%; height: 100%; background: var(--primary-color);"></div>
              </div>
            </div>
            <div>
              <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px;">
                <span>Memory</span>
                <span>${stats.memoryUsage}%</span>
              </div>
              <div style="height: 6px; background: var(--bg-tertiary); border-radius: 3px; overflow: hidden;">
                <div style="width: ${stats.memoryUsage}%; height: 100%; background: var(--warning-color);"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Nodes List (Brief) -->
        <div class="modern-card" style="padding: var(--spacing-md); grid-column: 1 / -1;">
            <h3 style="margin-top: 0; margin-bottom: var(--spacing-md); font-size: 16px;">节点列表</h3>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <thead>
                        <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
                            <th style="padding: 8px; color: var(--text-secondary);">Name</th>
                            <th style="padding: 8px; color: var(--text-secondary);">Status</th>
                            <th style="padding: 8px; color: var(--text-secondary);">Roles</th>
                            <th style="padding: 8px; color: var(--text-secondary);">Version</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.data.nodes.map(node => `
                            <tr style="border-bottom: 1px solid var(--bg-tertiary);">
                                <td style="padding: 8px;">${node.name}</td>
                                <td style="padding: 8px;">
                                    <span style="
                                        padding: 2px 6px; 
                                        border-radius: 4px; 
                                        background: ${node.status === 'Ready' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)'}; 
                                        color: ${node.status === 'Ready' ? 'var(--success-color)' : 'var(--error-color)'};
                                        font-size: 12px;
                                    ">
                                        ${node.status}
                                    </span>
                                </td>
                                <td style="padding: 8px;">${node.roles.join(', ')}</td>
                                <td style="padding: 8px;">${node.version}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
      </div>
    `;
    }

    private renderPodsTab(): string {
        if (this.data.pods.length === 0) {
            return this.renderEmptyState('暂无 Pods', '当前命名空间下没有运行中的 Pod');
        }

        return `
            <div class="modern-card" style="padding: var(--spacing-md);">
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
                                <th style="padding: 12px; color: var(--text-secondary);">Name</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Namespace</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Status</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Restarts</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Age</th>
                                <th style="padding: 12px; color: var(--text-secondary);">IP</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Node</th>
                                <th style="padding: 12px; color: var(--text-secondary); text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.data.pods.map(pod => {
                                const age = this.calculateAge(pod.creationTimestamp);
                                let statusColor = 'var(--text-primary)';
                                let bg = 'var(--bg-tertiary)';
                                if (pod.status === 'Running') {
                                    statusColor = 'var(--success-color)';
                                    bg = 'rgba(16, 185, 129, 0.1)';
                                } else if (pod.status === 'Pending') {
                                    statusColor = 'var(--warning-color)';
                                    bg = 'rgba(245, 158, 11, 0.1)';
                                } else if (pod.status === 'Failed') {
                                    statusColor = 'var(--error-color)';
                                    bg = 'rgba(239, 68, 68, 0.1)';
                                }

                                return `
                                <tr style="border-bottom: 1px solid var(--bg-tertiary); transition: background 0.2s;" onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='transparent'">
                                    <td style="padding: 12px;">
                                        <div style="font-weight: 500;">${pod.name}</div>
                                        <div style="font-size: 12px; color: var(--text-secondary);">${Object.entries(pod.labels).map(([k,v]) => `${k}=${v}`).join(' ')}</div>
                                    </td>
                                    <td style="padding: 12px;">${pod.namespace}</td>
                                    <td style="padding: 12px;">
                                        <span style="padding: 2px 8px; border-radius: 4px; background: ${bg}; color: ${statusColor}; font-size: 12px; font-weight: 500;">
                                            ${pod.status}
                                        </span>
                                    </td>
                                    <td style="padding: 12px;">${pod.restarts}</td>
                                    <td style="padding: 12px;">${age}</td>
                                    <td style="padding: 12px;">${pod.ip || '-'}</td>
                                    <td style="padding: 12px;">${pod.node || '-'}</td>
                                    <td style="padding: 12px; text-align: right;">
                                        <button class="icon-btn" title="日志" style="color: var(--text-secondary); cursor: pointer; background: none; border: none;">
                                            ${More({ theme: 'outline', size: '16', fill: 'currentColor' })}
                                        </button>
                                        <button class="icon-btn" title="删除" style="color: var(--error-color); cursor: pointer; background: none; border: none;">
                                            ${Delete({ theme: 'outline', size: '16', fill: 'currentColor' })}
                                        </button>
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    private renderDeploymentsTab(): string {
        if (this.data.deployments.length === 0) {
            return this.renderEmptyState('暂无 Deployments', '当前命名空间下没有 Deployment');
        }
        return `
            <div class="modern-card" style="padding: var(--spacing-md);">
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
                                <th style="padding: 12px; color: var(--text-secondary);">Name</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Namespace</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Pods</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Replicas</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Age</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Conditions</th>
                                <th style="padding: 12px; color: var(--text-secondary); text-align: right;">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.data.deployments.map(deploy => {
                                return `
                                <tr style="border-bottom: 1px solid var(--bg-tertiary);">
                                    <td style="padding: 12px; font-weight: 500;">${deploy.name}</td>
                                    <td style="padding: 12px;">${deploy.namespace}</td>
                                    <td style="padding: 12px;">${deploy.availableReplicas}/${deploy.replicas}</td>
                                    <td style="padding: 12px;">${deploy.replicas}</td>
                                    <td style="padding: 12px;">${this.calculateAge(deploy.creationTimestamp)}</td>
                                    <td style="padding: 12px;">
                                        ${deploy.conditions.map(c => `
                                            <span style="font-size: 12px; padding: 2px 4px; background: var(--bg-secondary); border-radius: 2px; margin-right: 4px;">${c}</span>
                                        `).join('')}
                                    </td>
                                    <td style="padding: 12px; text-align: right;">
                                        <button class="icon-btn" title="编辑" style="background: none; border: none; cursor: pointer;">${SettingConfig({ theme: 'outline', size: '16', fill: 'currentColor' })}</button>
                                    </td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    private renderServicesTab(): string {
        if (this.data.services.length === 0) {
            return this.renderEmptyState('暂无 Services', '当前命名空间下没有 Service');
        }
        return `
            <div class="modern-card" style="padding: var(--spacing-md);">
                <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <thead>
                            <tr style="border-bottom: 1px solid var(--border-color); text-align: left;">
                                <th style="padding: 12px; color: var(--text-secondary);">Name</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Namespace</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Type</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Cluster IP</th>
                                <th style="padding: 12px; color: var(--text-secondary);">External IP</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Ports</th>
                                <th style="padding: 12px; color: var(--text-secondary);">Age</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this.data.services.map(svc => {
                                return `
                                <tr style="border-bottom: 1px solid var(--bg-tertiary);">
                                    <td style="padding: 12px; font-weight: 500;">${svc.name}</td>
                                    <td style="padding: 12px;">${svc.namespace}</td>
                                    <td style="padding: 12px;">${svc.type}</td>
                                    <td style="padding: 12px;">${svc.clusterIP}</td>
                                    <td style="padding: 12px;">${svc.externalIPs.join(', ') || '-'}</td>
                                    <td style="padding: 12px;">${svc.ports.map(p => `${p.port}:${p.targetPort}/${p.protocol}`).join(', ')}</td>
                                    <td style="padding: 12px;">${this.calculateAge(svc.creationTimestamp)}</td>
                                </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    private renderConfigTab(): string {
        return this.renderEmptyState('配置管理', 'KubeConfig 配置管理即将上线');
    }

    private renderEmptyState(title: string, description: string): string {
        return `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 300px;
        color: var(--text-secondary);
        text-align: center;
      ">
        <div style="
          width: 64px;
          height: 64px;
          background: var(--bg-secondary);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: var(--spacing-md);
        ">
          ${Cube({ theme: 'outline', size: '32', fill: 'currentColor' })}
        </div>
        <div style="font-size: 16px; font-weight: 500; color: var(--text-primary); margin-bottom: 4px;">${title}</div>
        <div style="font-size: 13px;">${description}</div>
      </div>
    `;
    }

    private calculateAge(timestamp: string): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (days > 0) return `${days}d`;
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours > 0) return `${hours}h`;
        
        const minutes = Math.floor(diff / (1000 * 60));
        return `${minutes}m`;
    }

    public setTab(tabId: string): void {
        this.currentTab = tabId;
        this.updateView();
    }
}
