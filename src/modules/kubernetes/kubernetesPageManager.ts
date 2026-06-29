import { KubernetesManager } from './kubernetesManager';
import { KubernetesEmergencyManager } from './kubernetesEmergencyManager';
import { KubernetesSecurityAuditor } from './kubernetesSecurityAuditor';
import { KubernetesRenderer } from '../ui/kubernetesRenderer';
import { sshConnectionManager } from '../remote/sshConnectionManager';
import { showConfirm, showPrompt } from '../ui/confirmDialog';
import type { K8sMainTab } from './types';

const AUTO_REFRESH_EMERGENCY = 10000;
const SEARCH_DEBOUNCE = 200;

export class KubernetesPageManager {
    private manager: KubernetesManager;
    private emergencyManager: KubernetesEmergencyManager;
    private securityAuditor: KubernetesSecurityAuditor;
    private renderer: KubernetesRenderer;

    private initialized = false;
    private globalEventsBound = false;
    private autoRefreshTimer: number | null = null;
    private emergencyMode = false;
    private loading = false;
    private searchDebounceTimer: number | null = null;
    private boundClickHandler: ((e: Event) => void) | null = null;
    private boundChangeHandler: ((e: Event) => void) | null = null;
    private boundInputHandler: ((e: Event) => void) | null = null;

    constructor(
        manager: KubernetesManager,
        emergencyManager: KubernetesEmergencyManager,
        securityAuditor: KubernetesSecurityAuditor,
        renderer: KubernetesRenderer
    ) {
        this.manager = manager;
        this.emergencyManager = emergencyManager;
        this.securityAuditor = securityAuditor;
        this.renderer = renderer;
    }

    // ============================================================
    // Lifecycle
    // ============================================================

    public initialize(): void {
        if (this.initialized) return;
        this.bindEvents();
        this.initialized = true;

        // Expose managers on window for renderer access
        (window as any).app = (window as any).app || {};
        (window as any).app.kubernetesManager = this.manager;
        (window as any).app.kubernetesEmergencyManager = this.emergencyManager;
        (window as any).app.kubernetesSecurityAuditor = this.securityAuditor;
        (window as any).kubernetesPageManager = this;
    }

    public deactivate(): void {
        this.stopAutoRefresh();
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
            this.searchDebounceTimer = null;
        }
        if (this.boundClickHandler) {
            document.removeEventListener('click', this.boundClickHandler);
            this.boundClickHandler = null;
        }
        if (this.boundChangeHandler) {
            document.removeEventListener('change', this.boundChangeHandler);
            this.boundChangeHandler = null;
        }
        if (this.boundInputHandler) {
            document.removeEventListener('input', this.boundInputHandler);
            this.boundInputHandler = null;
        }
        this.globalEventsBound = false;
    }

    public async refresh(showNotification = false): Promise<void> {
        if (!sshConnectionManager.isConnected()) {
            return;
        }
        if (this.loading) return; // 防止并发刷新

        try {
            this.loading = true;
            await this.renderer.refreshData();
            if (showNotification) {
                window.showNotification?.('Kubernetes 数据已刷新', 'success');
            }
        } catch (error) {
            console.error('Failed to refresh K8s data', error);
            window.showNotification?.(`刷新 K8s 数据失败: ${error}`, 'error');
        } finally {
            this.loading = false;
        }
    }

    public getRenderer(): KubernetesRenderer {
        return this.renderer;
    }

    // ============================================================
    // Event Binding
    // ============================================================

    private bindEvents(): void {
        if (this.globalEventsBound) return;
        this.globalEventsBound = true;

        // Global click delegation
        this.boundClickHandler = (e: Event) => {
            const target = (e as MouseEvent).target as HTMLElement;
            const actionEl = target.closest('[data-k8s-action]') as HTMLElement;
            if (!actionEl) return;

            const action = actionEl.getAttribute('data-k8s-action')!;
            this.handleAction(action, actionEl);
        };
        document.addEventListener('click', this.boundClickHandler);

        // Global change delegation (for selects)
        this.boundChangeHandler = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target.matches('[data-k8s-action="switch-namespace"]')) {
                const ns = (target as HTMLSelectElement).value;
                this.renderer.setNamespace(ns);
            }
        };
        document.addEventListener('change', this.boundChangeHandler);

        // Search input
        this.boundInputHandler = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target.matches('[data-k8s-action="search"]')) {
                if (this.searchDebounceTimer) clearTimeout(this.searchDebounceTimer);
                this.searchDebounceTimer = window.setTimeout(() => {
                    this.renderer.setSearch((target as HTMLInputElement).value);
                }, SEARCH_DEBOUNCE);
            }
        };
        document.addEventListener('input', this.boundInputHandler);

        // Register global functions
        (window as any).switchKubernetesTab = (tabId: string) => {
            this.renderer.setTab(tabId as K8sMainTab);
        };
        (window as any).switchKubernetesSubTab = (subTabId: string) => {
            this.renderer.setSubTab(subTabId);
        };
    }

    // ============================================================
    // Action Handler
    // ============================================================

    private async handleAction(action: string, el: HTMLElement): Promise<void> {
        switch (action) {
            case 'refresh':
                await this.refresh(true);
                break;

            case 'switch-tab':
                this.renderer.setTab(el.getAttribute('data-tab') as K8sMainTab);
                break;

            case 'switch-sub-tab':
                this.renderer.setSubTab(el.getAttribute('data-sub-tab')!);
                break;

            case 'toggle-emergency':
                this.toggleEmergencyMode();
                break;

            case 'run-audit':
                await this.runSecurityAudit();
                break;

            case 'view-yaml':
                await this.viewYaml(
                    el.getAttribute('data-kind')!,
                    el.getAttribute('data-name')!,
                    el.getAttribute('data-namespace') || undefined
                );
                break;

            case 'pod-logs':
                await this.viewPodLogs(
                    el.getAttribute('data-name')!,
                    el.getAttribute('data-namespace')!
                );
                break;

            case 'pod-exec':
                await this.execInPod(
                    el.getAttribute('data-name')!,
                    el.getAttribute('data-namespace')!
                );
                break;

            case 'delete-resource':
                await this.deleteResource(
                    el.getAttribute('data-kind')!,
                    el.getAttribute('data-name')!,
                    el.getAttribute('data-namespace') || undefined
                );
                break;

            case 'scale':
                await this.scaleDeployment(
                    el.getAttribute('data-name')!,
                    el.getAttribute('data-namespace')!
                );
                break;

            case 'scale-zero':
                await this.scaleToZero(
                    el.getAttribute('data-name')!,
                    el.getAttribute('data-namespace')!
                );
                break;

            case 'emergency-isolate':
                await this.showIsolateDialog();
                break;

            case 'emergency-scale-zero':
                await this.showScaleZeroDialog();
                break;

            case 'emergency-cordon':
                await this.showCordonDialog();
                break;

            case 'emergency-drain':
                await this.showDrainDialog();
                break;

            case 'emergency-forensic':
                await this.showForensicDialog();
                break;

            case 'remove-isolation':
                await this.removeIsolation(el.getAttribute('data-pod')!);
                break;

            case 'rollback':
                await this.rollbackAction(el.getAttribute('data-action-id')!);
                break;

            case 'fetch-logs':
                await this.fetchSelectedPodLogs();
                break;
        }
    }

    // ============================================================
    // Emergency Mode
    // ============================================================

    private toggleEmergencyMode(): void {
        this.emergencyMode = !this.emergencyMode;
        this.renderer.setEmergencyMode(this.emergencyMode);

        if (this.emergencyMode) {
            this.startAutoRefresh(AUTO_REFRESH_EMERGENCY);
            window.showNotification?.('应急模式已激活 — 刷新频率提升至 10 秒', 'warning');
        } else {
            this.stopAutoRefresh();
            window.showNotification?.('应急模式已关闭', 'info');
        }
    }

    // ============================================================
    // Auto Refresh
    // ============================================================

    private isRefreshing = false;

    private startAutoRefresh(interval: number): void {
        this.stopAutoRefresh();
        this.autoRefreshTimer = window.setInterval(() => {
            if (!this.isRefreshing) {
                this.isRefreshing = true;
                this.refresh().finally(() => { this.isRefreshing = false; });
            }
        }, interval);
    }

    private stopAutoRefresh(): void {
        if (this.autoRefreshTimer) {
            clearInterval(this.autoRefreshTimer);
            this.autoRefreshTimer = null;
        }
    }

    // ============================================================
    // Actions: YAML Viewer
    // ============================================================

    private async viewYaml(kind: string, name: string, namespace?: string): Promise<void> {
        try {
            window.showNotification?.(`正在获取 ${kind}/${name} YAML...`, 'info');
            const yaml = await this.manager.getResourceYaml(kind, name, namespace);
            if (!yaml) {
                window.showNotification?.('获取 YAML 失败', 'error');
                return;
            }
            this.showYamlModal(kind, name, yaml);
        } catch (e) {
            window.showNotification?.(`获取 YAML 失败: ${e}`, 'error');
        }
    }

    private showYamlModal(kind: string, name: string, yaml: string): void {
        const coloredYaml = this.colorizeYaml(yaml);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px);';
        modal.innerHTML = `
        <div style="background:var(--bg-secondary);border-radius:var(--border-radius-lg);border:1px solid var(--border-color);width:80%;max-width:800px;max-height:85vh;display:flex;flex-direction:column;box-shadow:var(--shadow-lg);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--spacing-md) var(--spacing-lg);border-bottom:1px solid var(--border-color);">
                <h3 style="margin:0;font-size:16px;color:var(--text-primary);">${kind}/${name} — YAML</h3>
                <div style="display:flex;gap:var(--spacing-sm);">
                    <button class="modern-btn secondary" onclick="navigator.clipboard.writeText(this.closest('.modal-overlay').querySelector('.k8s-yaml-viewer').textContent);window.showNotification?.('已复制到剪贴板','success');" style="font-size:12px;">复制</button>
                    <button class="modern-btn secondary" onclick="this.closest('.modal-overlay').remove();" style="font-size:12px;">关闭</button>
                </div>
            </div>
            <div class="k8s-yaml-viewer" style="flex:1;overflow:auto;margin:var(--spacing-md);">${coloredYaml}</div>
        </div>`;
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }

    private colorizeYaml(yaml: string): string {
        return yaml
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/(#.*)$/gm, '<span class="k8s-yaml-comment">$1</span>')
            .replace(/^(\s*)([\w.-]+)(:)/gm, '$1<span class="k8s-yaml-key">$2</span>$3')
            .replace(/:\s+"([^"]*)"$/gm, ': <span class="k8s-yaml-string">"$1"</span>')
            .replace(/:\s+(\d+)$/gm, ': <span class="k8s-yaml-number">$1</span>')
            .replace(/:\s+(true|false)$/gm, ': <span class="k8s-yaml-bool">$1</span>');
    }

    // ============================================================
    // Actions: Pod Logs
    // ============================================================

    private async viewPodLogs(podName: string, namespace: string): Promise<void> {
        try {
            window.showNotification?.(`正在获取 ${podName} 日志...`, 'info');
            const logs = await this.manager.getPodLogs({ pod: podName, namespace, tailLines: 200 });
            this.showLogModal(podName, logs);
        } catch (e) {
            window.showNotification?.(`获取日志失败: ${e}`, 'error');
        }
    }

    private showLogModal(podName: string, logs: string): void {
        const coloredLogs = this.colorizeLogs(logs);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px);';
        modal.innerHTML = `
        <div style="background:var(--bg-secondary);border-radius:var(--border-radius-lg);border:1px solid var(--border-color);width:80%;max-width:900px;max-height:85vh;display:flex;flex-direction:column;box-shadow:var(--shadow-lg);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--spacing-md) var(--spacing-lg);border-bottom:1px solid var(--border-color);">
                <h3 style="margin:0;font-size:16px;color:var(--text-primary);">Pod 日志 ��� ${podName}</h3>
                <button class="modern-btn secondary" onclick="this.closest('.modal-overlay').remove();" style="font-size:12px;">关闭</button>
            </div>
            <div class="k8s-log-viewer" style="flex:1;overflow:auto;margin:var(--spacing-md);">${coloredLogs || '<span style="color:var(--text-secondary);">无日志输��</span>'}</div>
        </div>`;
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }

    private colorizeLogs(logs: string): string {
        if (!logs) return '';
        return logs
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .split('\n')
            .map(line => {
                if (/\b(error|fatal|panic|exception)\b/i.test(line)) return `<span class="k8s-log-line-error">${line}</span>`;
                if (/\b(warn|warning)\b/i.test(line)) return `<span class="k8s-log-line-warn">${line}</span>`;
                if (/\b(info)\b/i.test(line)) return `<span class="k8s-log-line-info">${line}</span>`;
                return line;
            })
            .join('\n');
    }

    // ============================================================
    // Actions: Pod Exec
    // ============================================================

    private async execInPod(podName: string, namespace: string): Promise<void> {
        // 检查是否已经展开了终端
        const existingTerminal = document.getElementById(`k8s-terminal-${podName}`);
        if (existingTerminal) {
            existingTerminal.remove();
            return; // toggle: 点击关闭
        }

        // 找到 Pod 所在的 <tr>
        const podRow = document.querySelector(`tr[data-name="${podName}"][data-namespace="${namespace}"]`);
        if (!podRow) {
            // fallback: 用老方式弹 prompt
            const command = await showPrompt({ title: '执行命令', message: `在 Pod "${podName}" 中执行命令:`, defaultValue: 'sh -c "ps aux"' });
            if (!command) return;
            try {
                const output = await this.manager.execInPod(podName, namespace, '', command);
                this.showLogModal(`${podName} — exec`, output);
            } catch (e) {
                window.showNotification?.(`执行失败: ${e}`, 'error');
            }
            return;
        }

        // 在该行下方插入内嵌终端
        const colCount = podRow.querySelectorAll('td').length;
        const terminalRow = document.createElement('tr');
        terminalRow.id = `k8s-terminal-${podName}`;
        terminalRow.innerHTML = `
          <td colspan="${colCount}" style="padding:0;border:none;">
            <div style="background:var(--bg-primary);border:1px solid var(--primary-color);border-radius:0 0 var(--border-radius) var(--border-radius);margin:0 4px 4px 4px;overflow:hidden;">
              <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 12px;background:var(--bg-secondary);border-bottom:1px solid var(--border-color);">
                <span style="font-size:12px;font-weight:600;color:var(--primary-color);font-family:var(--font-mono);">
                  ▶ kubectl exec ${podName} -n ${namespace} --
                </span>
                <button onclick="document.getElementById('k8s-terminal-${podName}')?.remove()" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:16px;padding:0 4px;" title="关闭">✕</button>
              </div>
              <pre id="k8s-term-output-${podName}" style="padding:8px 12px;margin:0;font-family:var(--font-mono);font-size:12px;line-height:1.5;max-height:300px;overflow:auto;color:var(--text-primary);white-space:pre-wrap;word-break:break-all;min-height:40px;background:var(--bg-primary);"></pre>
              <div style="display:flex;gap:6px;padding:6px 8px;border-top:1px solid var(--border-color);background:var(--bg-secondary);">
                <span style="color:var(--text-secondary);font-family:var(--font-mono);font-size:12px;line-height:28px;flex-shrink:0;">$</span>
                <input id="k8s-term-input-${podName}" type="text" value="ps aux" placeholder="输入命令..." style="flex:1;padding:4px 8px;border:1px solid var(--border-color);border-radius:var(--border-radius);background:var(--bg-primary);color:var(--text-primary);font-family:var(--font-mono);font-size:12px;outline:none;" />
                <button id="k8s-term-run-${podName}" style="padding:4px 12px;background:var(--primary-color);color:#fff;border:none;border-radius:var(--border-radius);font-size:12px;cursor:pointer;white-space:nowrap;">执行</button>
              </div>
            </div>
          </td>`;

        podRow.insertAdjacentElement('afterend', terminalRow);

        // 命令历史
        const cmdHistory: string[] = [];
        let historyIdx = -1;

        // 绑定事件
        const input = document.getElementById(`k8s-term-input-${podName}`) as HTMLInputElement;
        const output = document.getElementById(`k8s-term-output-${podName}`) as HTMLPreElement;
        const runBtn = document.getElementById(`k8s-term-run-${podName}`) as HTMLButtonElement;

        const runCommand = async () => {
            const cmd = input.value.trim();
            if (!cmd) return;
            cmdHistory.unshift(cmd);
            historyIdx = -1;

            output.textContent += `$ ${cmd}\n`;
            input.value = '';
            runBtn.disabled = true;
            runBtn.textContent = '执行中...';

            try {
                const result = await this.manager.execInPod(podName, namespace, '', cmd);
                output.textContent += (result || '(无输出)') + '\n';
            } catch (e) {
                output.textContent += `ERROR: ${e}\n`;
            }

            runBtn.disabled = false;
            runBtn.textContent = '执行';
            output.scrollTop = output.scrollHeight;
            input.focus();
        };

        runBtn.addEventListener('click', runCommand);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                runCommand();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                if (cmdHistory.length > 0) {
                    historyIdx = Math.min(historyIdx + 1, cmdHistory.length - 1);
                    input.value = cmdHistory[historyIdx];
                }
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                if (historyIdx > 0) {
                    historyIdx--;
                    input.value = cmdHistory[historyIdx];
                } else {
                    historyIdx = -1;
                    input.value = '';
                }
            }
        });

        input.focus();
        input.select();
    }

    // ============================================================
    // Actions: Delete Resource
    // ============================================================

    private async deleteResource(kind: string, name: string, namespace?: string): Promise<void> {
        const confirmed = await showConfirm({ title: '删除资源', message: `确定要删除 ${kind}/${name}${namespace ? ` (${namespace})` : ''} 吗？`, dangerous: true });
        if (!confirmed) return;

        try {
            const result = await this.manager.deleteResource(kind, name, namespace);
            if (result.success) {
                window.showNotification?.(`${kind}/${name} 已删除`, 'success');
                await this.refresh();
            } else {
                window.showNotification?.(`删除失败: ${result.output}`, 'error');
            }
        } catch (e) {
            window.showNotification?.(`删除失败: ${e}`, 'error');
        }
    }

    // ============================================================
    // Actions: Scale
    // ============================================================

    private async scaleDeployment(name: string, namespace: string): Promise<void> {
        const replicas = await showPrompt({ title: '缩放部署', message: `将 Deployment "${name}" 缩放到多少副本？`, defaultValue: '1' });
        if (replicas === null) return;

        const num = parseInt(replicas);
        if (isNaN(num) || num < 0) {
            window.showNotification?.('请输入有效的副本数', 'error');
            return;
        }

        try {
            const result = await this.manager.scaleDeployment(name, namespace, num);
            if (result.success) {
                window.showNotification?.(`${name} 已缩放到 ${num} 副��`, 'success');
                await this.refresh();
            } else {
                window.showNotification?.(`缩放失败: ${result.output}`, 'error');
            }
        } catch (e) {
            window.showNotification?.(`缩放失败: ${e}`, 'error');
        }
    }

    private async scaleToZero(name: string, namespace: string): Promise<void> {
        const confirmed = await showConfirm({ title: '缩容至零', message: `确定要将 Deployment "${name}" 缩容至 0 副本吗？\n这将停止所有关联的 Pod。`, dangerous: true });
        if (!confirmed) return;

        try {
            const action = await this.emergencyManager.scaleToZero(name, namespace);
            if (action.status === 'completed') {
                window.showNotification?.(`${name} 已缩容至 0`, 'success');
                this.renderer.updateData('emergencyActions', this.emergencyManager.getActionHistory());
                await this.refresh();
            } else {
                window.showNotification?.(`缩容失败: ${action.error}`, 'error');
            }
        } catch (e) {
            window.showNotification?.(`缩容失败: ${e}`, 'error');
        }
    }

    // ============================================================
    // Emergency: Dialogs
    // ============================================================

    private async showIsolateDialog(): Promise<void> {
        const pods = this.renderer.getData().pods;
        const podNames = pods.map(p => `${p.namespace}/${p.name}`);

        const selected = await showPrompt({ title: '隔离 Pod', message: `选择要隔离的 Pod:\n${podNames.slice(0, 20).join('\n')}\n\n请输入格式: namespace/podname` });
        if (!selected) return;

        const [ns, name] = selected.split('/');
        const pod = pods.find(p => p.namespace === ns && p.name === name);
        if (!pod) {
            window.showNotification?.('未找到该 Pod', 'error');
            return;
        }

        const confirmed = await showConfirm({ title: '隔离 Pod', message: `确定要隔离 Pod "${name}" (${ns})？\n这将创建 deny-all NetworkPolicy 阻断所有网络流量。`, dangerous: true });
        if (!confirmed) return;

        try {
            window.showNotification?.('正在隔离 Pod...', 'warning');
            const action = await this.emergencyManager.isolatePod(name, ns, pod.labels);
            if (action.status === 'completed') {
                window.showNotification?.(`Pod ${name} 已被隔离`, 'success');
                this.renderer.updateData('isolatedPods', this.emergencyManager.getIsolatedPods());
                this.renderer.updateData('emergencyActions', this.emergencyManager.getActionHistory());
            } else {
                window.showNotification?.(`隔离失败: ${action.error}`, 'error');
            }
        } catch (e) {
            window.showNotification?.(`隔离失败: ${e}`, 'error');
        }
    }

    private async showScaleZeroDialog(): Promise<void> {
        const deployments = this.renderer.getData().deployments;
        const names = deployments.map(d => `${d.namespace}/${d.name} (${d.availableReplicas}/${d.replicas})`);

        const selected = await showPrompt({ title: '缩容 Deployment', message: `选择要缩容至 0 的 Deployment:\n${names.slice(0, 20).join('\n')}\n\n请输入格式: namespace/name` });
        if (!selected) return;

        const [ns, name] = selected.split('/');
        await this.scaleToZero(name, ns);
    }

    private async showCordonDialog(): Promise<void> {
        const nodes = this.renderer.getData().nodes;
        const names = nodes.map(n => `${n.name} (${n.status})`);

        const selected = await showPrompt({ title: '封锁节点', message: `选择要封锁的节点:\n${names.join('\n')}\n\n请输入节点名称:` });
        if (!selected) return;

        const confirmed = await showConfirm({ title: '封锁节点', message: `确定要封锁节点 "${selected}"？\n新的 Pod 将不会被调度到此节点。`, dangerous: true });
        if (!confirmed) return;

        try {
            const action = await this.emergencyManager.cordonNode(selected);
            if (action.status === 'completed') {
                window.showNotification?.(`节点 ${selected} 已封锁`, 'success');
                this.renderer.updateData('emergencyActions', this.emergencyManager.getActionHistory());
                await this.refresh();
            } else {
                window.showNotification?.(`封锁失败: ${action.error}`, 'error');
            }
        } catch (e) {
            window.showNotification?.(`封锁失败: ${e}`, 'error');
        }
    }

    private async showDrainDialog(): Promise<void> {
        const nodes = this.renderer.getData().nodes;
        const names = nodes.map(n => `${n.name} (${n.status})`);

        const selected = await showPrompt({ title: '排空节点', message: `选择要排空的节点:\n${names.join('\n')}\n\n请输入节点名称:` });
        if (!selected) return;

        const confirmed = await showConfirm({ title: '排空节点', message: `确定要排空节点 "${selected}"？\n这将驱逐节点上所有 Pod（DaemonSet 除外）。\n\n此操作可能需要较长时间。`, dangerous: true });
        if (!confirmed) return;

        try {
            window.showNotification?.('正在排空节点...', 'warning');
            const action = await this.emergencyManager.drainNode(selected);
            if (action.status === 'completed') {
                window.showNotification?.(`节点 ${selected} 已排空`, 'success');
                this.renderer.updateData('emergencyActions', this.emergencyManager.getActionHistory());
                await this.refresh();
            } else {
                window.showNotification?.(`排空失败: ${action.error}`, 'error');
            }
        } catch (e) {
            window.showNotification?.(`排空失败: ${e}`, 'error');
        }
    }

    private async showForensicDialog(): Promise<void> {
        const pods = this.renderer.getData().pods;
        const podNames = pods.map(p => `${p.namespace}/${p.name}`);

        const selected = await showPrompt({ title: '取证数据采集', message: `选择要采集取证数据的 Pod:\n${podNames.slice(0, 20).join('\n')}\n\n请输入格式: namespace/podname` });
        if (!selected) return;

        const [ns, name] = selected.split('/');

        try {
            window.showNotification?.('正在采集取证数据...', 'warning');
            const report = await this.emergencyManager.captureForensicSnapshot(name, ns);
            this.renderer.updateData('forensicReport', report);
            window.showNotification?.(`取证数据采集完成`, 'success');
            this.showForensicReport(report);
        } catch (e) {
            window.showNotification?.(`取证采集失败: ${e}`, 'error');
        }
    }

    private showForensicReport(report: any): void {
        const sections = [
            { title: 'Describe', content: report.describe },
            { title: '日志', content: report.logs },
            { title: '上一个容器日志', content: report.previousLogs },
            { title: '环境变量', content: Object.entries(report.envVars).map(([k, v]) => `${k}=${v}`).join('\n') },
            { title: '进程树', content: report.processTree },
            { title: '文件系统快照', content: report.fileSystemSnapshot },
            { title: '挂载的 Secrets', content: report.mountedSecrets.join('\n') || '无' },
            { title: '网络策略', content: report.networkPolicies.join('\n') || '无' },
        ];

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:1000;backdrop-filter:blur(4px);';
        modal.innerHTML = `
        <div style="background:var(--bg-secondary);border-radius:var(--border-radius-lg);border:1px solid var(--border-color);width:85%;max-width:1000px;max-height:90vh;display:flex;flex-direction:column;box-shadow:var(--shadow-lg);">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:var(--spacing-md) var(--spacing-lg);border-bottom:1px solid var(--border-color);">
                <h3 style="margin:0;font-size:16px;color:var(--text-primary);">取证报告 — ${report.podName} (${report.namespace})</h3>
                <div style="display:flex;gap:var(--spacing-sm);">
                    <button class="modern-btn secondary" onclick="navigator.clipboard.writeText(JSON.stringify(${JSON.stringify(report).replace(/"/g, '&quot;')}, null, 2));window.showNotification?.('已复制 JSON','success');" style="font-size:12px;">导出 JSON</button>
                    <button class="modern-btn secondary" onclick="this.closest('.modal-overlay').remove();" style="font-size:12px;">关闭</button>
                </div>
            </div>
            <div style="flex:1;overflow:auto;padding:var(--spacing-md);">
                ${sections.map(s => `
                <div class="k8s-forensic-section">
                    <div class="k8s-forensic-section-header" onclick="this.parentElement.classList.toggle('collapsed');">
                        <span>${s.title}</span>
                        <span style="font-size:12px;color:var(--text-secondary);">${s.content ? s.content.split('\n').length + ' 行' : '空'}</span>
                    </div>
                    <div class="k8s-forensic-section-body">
                        <pre style="margin:0;font-size:12px;font-family:var(--font-mono);white-space:pre-wrap;word-break:break-all;">${(s.content || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
                    </div>
                </div>`).join('')}
            </div>
        </div>`;
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        document.body.appendChild(modal);
    }

    // ============================================================
    // Actions: Security Audit
    // ============================================================

    private async runSecurityAudit(): Promise<void> {
        try {
            window.showNotification?.('正在运行安全审计...', 'info');
            const result = await this.securityAuditor.runFullAudit(
                this.renderer.getData().pods.length > 0 ? undefined : undefined
            );
            this.renderer.updateData('auditResult', result);
            window.showNotification?.(
                `安全审计完成: 评分 ${result.summary.score}/100, ${result.summary.total} 项发现`,
                result.summary.score >= 80 ? 'success' : result.summary.score >= 50 ? 'warning' : 'error'
            );
        } catch (e) {
            window.showNotification?.(`安全审计失败: ${e}`, 'error');
        }
    }

    // ============================================================
    // Actions: Remove Isolation & Rollback
    // ============================================================

    private async removeIsolation(podKey: string): Promise<void> {
        const [ns, name] = podKey.includes('/') ? podKey.split('/') : ['', podKey];

        const confirmed = await showConfirm({ title: '解除隔离', message: `确定要解除 Pod "${name || podKey}" 的隔离？\n这将删除对应的 NetworkPolicy。`, dangerous: true });
        if (!confirmed) return;

        try {
            const action = await this.emergencyManager.removeIsolation(name || podKey, ns);
            if (action.status === 'completed') {
                window.showNotification?.(`隔离已解除`, 'success');
                this.renderer.updateData('isolatedPods', this.emergencyManager.getIsolatedPods());
                this.renderer.updateData('emergencyActions', this.emergencyManager.getActionHistory());
            } else {
                window.showNotification?.(`解除隔离失败: ${action.error}`, 'error');
            }
        } catch (e) {
            window.showNotification?.(`解除隔离失败: ${e}`, 'error');
        }
    }

    private async rollbackAction(actionId: string): Promise<void> {
        const confirmed = await showConfirm({ title: '回滚操作', message: '确定要回滚此操作？', dangerous: true });
        if (!confirmed) return;

        try {
            const result = await this.emergencyManager.executeRollback(actionId);
            if (result.success) {
                window.showNotification?.('回滚成功', 'success');
                await this.refresh();
            } else {
                window.showNotification?.(`回滚失败: ${result.output}`, 'error');
            }
        } catch (e) {
            window.showNotification?.(`回滚失败: ${e}`, 'error');
        }
    }

    // ============================================================
    // Actions: Fetch Pod Logs (from Events tab selector)
    // ============================================================

    private async fetchSelectedPodLogs(): Promise<void> {
        const selectEl = document.getElementById('k8s-log-pod-select') as HTMLSelectElement;
        const tailEl = document.getElementById('k8s-log-tail-select') as HTMLSelectElement;
        const outputEl = document.getElementById('k8s-log-output');
        if (!selectEl || !outputEl) return;

        const selected = selectEl.value;
        if (!selected) {
            window.showNotification?.('请先选择一个 Pod', 'warning');
            return;
        }

        const [ns, name] = selected.split('/');
        const tailLines = parseInt(tailEl?.value || '100');

        outputEl.innerHTML = '<span style="color:var(--text-secondary);">正在获取日志...</span>';

        try {
            const logs = await this.manager.getPodLogs({ pod: name, namespace: ns, tailLines });
            outputEl.innerHTML = this.colorizeLogs(logs) || '<span style="color:var(--text-secondary);">无日志输出</span>';
            outputEl.scrollTop = outputEl.scrollHeight;
        } catch (e) {
            outputEl.innerHTML = `<span class="k8s-log-line-error">获取日志失败: ${e}</span>`;
        }
    }
}
