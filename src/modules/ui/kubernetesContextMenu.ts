import { BaseContextMenu, MenuAction } from './contextMenu/baseContextMenu';
import {
    FileText, Log, Terminal, Delete, Shield, Lock,
    Copy, SettingConfig, Analysis, Refresh, CloseOne
} from '@icon-park/svg';
import { showConfirm } from './confirmDialog';

const icon = (fn: any, size = '14') => fn({ theme: 'outline', size, fill: 'currentColor' });

type K8sResourceKind = 'pod' | 'deployment' | 'service' | 'node' | 'daemonset' | 'statefulset' | 'networkpolicy' | 'configmap' | 'secret' | 'cronjob' | 'serviceaccount';

export class KubernetesContextMenu extends BaseContextMenu {
    private currentKind: K8sResourceKind = 'pod';
    private currentName: string = '';
    private currentNamespace: string = '';
    public currentLabels: Record<string, string> = {};

    constructor() {
        super('k8s');
    }

    onShowContextMenu(kind: K8sResourceKind, name: string, namespace: string, labels?: Record<string, string>): void {
        this.currentKind = kind;
        this.currentName = name;
        this.currentNamespace = namespace;
        this.currentLabels = labels || {};
    }

    getMenuItemsHTML(): string {
        switch (this.currentKind) {
            case 'pod': return this.getPodMenuHTML();
            case 'deployment': return this.getDeploymentMenuHTML();
            case 'service': return this.getServiceMenuHTML();
            case 'node': return this.getNodeMenuHTML();
            case 'cronjob': return this.getCronJobMenuHTML();
            case 'serviceaccount': return this.getServiceAccountMenuHTML();
            default: return this.getGenericMenuHTML();
        }
    }

    resolveAction(action: string): MenuAction | null {
        const name = this.currentName;
        const ns = this.currentNamespace;

        const actions: Record<string, MenuAction> = {
            // Pod actions
            'pod-yaml': { command: `kubectl get pod ${name} -n ${ns} -o yaml`, title: `Pod YAML — ${name}`, actionName: '查看 YAML' },
            'pod-describe': { command: `kubectl describe pod ${name} -n ${ns}`, title: `Describe Pod — ${name}`, actionName: 'Describe' },
            'pod-logs': { command: `kubectl logs ${name} -n ${ns} --tail=200`, title: `Pod 日志 — ${name}`, actionName: '查看日志' },
            'pod-logs-previous': { command: `kubectl logs ${name} -n ${ns} --tail=100 --previous`, title: `Pod 上一个日志 — ${name}`, actionName: '上一个容器日志' },
            'pod-exec-sh': { command: `kubectl exec ${name} -n ${ns} -- ps aux`, title: `Pod 进程 — ${name}`, actionName: 'Exec: ps aux' },
            'pod-env': { command: `kubectl exec ${name} -n ${ns} -- env`, title: `Pod 环境变量 — ${name}`, actionName: '查看环境变量' },
            'pod-delete': { command: `kubectl delete pod ${name} -n ${ns}`, title: `删除 Pod — ${name}`, actionName: '删除 Pod' },
            'pod-delete-force': { command: `kubectl delete pod ${name} -n ${ns} --force --grace-period=0`, title: `强制删除 Pod — ${name}`, actionName: '强制删除' },
            'pod-check-privileged': { command: `kubectl get pod ${name} -n ${ns} -o jsonpath='{.spec.containers[*].securityContext}'`, title: `安全上下文 — ${name}`, actionName: '检查特权' },
            'pod-check-sa': { command: `kubectl get pod ${name} -n ${ns} -o jsonpath='{.spec.serviceAccountName}'`, title: `ServiceAccount — ${name}`, actionName: '查看 ServiceAccount' },
            'pod-check-netpol': { command: `kubectl get networkpolicy -n ${ns} -o wide`, title: `网络策略 — ${ns}`, actionName: '检查网络策略' },

            // Deployment actions
            'deploy-yaml': { command: `kubectl get deployment ${name} -n ${ns} -o yaml`, title: `Deployment YAML — ${name}`, actionName: '查看 YAML' },
            'deploy-describe': { command: `kubectl describe deployment ${name} -n ${ns}`, title: `Describe Deployment — ${name}`, actionName: 'Describe' },
            'deploy-scale': { command: `kubectl scale deployment ${name} -n ${ns} --replicas=1`, title: `扩缩容 — ${name}`, actionName: '扩缩容' },
            'deploy-scale-zero': { command: `kubectl scale deployment ${name} -n ${ns} --replicas=0`, title: `缩容至 0 — ${name}`, actionName: '缩容至 0' },
            'deploy-rollback': { command: `kubectl rollout undo deployment ${name} -n ${ns}`, title: `回滚 — ${name}`, actionName: '回滚部署' },
            'deploy-history': { command: `kubectl rollout history deployment ${name} -n ${ns}`, title: `部署历史 — ${name}`, actionName: '查看部署历史' },

            // Service actions
            'svc-yaml': { command: `kubectl get service ${name} -n ${ns} -o yaml`, title: `Service YAML — ${name}`, actionName: '查看 YAML' },
            'svc-describe': { command: `kubectl describe service ${name} -n ${ns}`, title: `Describe Service — ${name}`, actionName: 'Describe' },
            'svc-endpoints': { command: `kubectl get endpoints ${name} -n ${ns} -o yaml`, title: `Endpoints — ${name}`, actionName: '查看 Endpoints' },

            // Node actions
            'node-yaml': { command: `kubectl get node ${name} -o yaml`, title: `Node YAML — ${name}`, actionName: '查看 YAML' },
            'node-describe': { command: `kubectl describe node ${name}`, title: `Describe Node — ${name}`, actionName: 'Describe' },
            'node-cordon': { command: `kubectl cordon ${name}`, title: `封锁节点 — ${name}`, actionName: '封锁节点' },
            'node-uncordon': { command: `kubectl uncordon ${name}`, title: `解封节点 — ${name}`, actionName: '解封节点' },
            'node-drain': { command: `kubectl drain ${name} --ignore-daemonsets --delete-emptydir-data --force`, title: `排空节点 — ${name}`, actionName: '排空节点' },
            'node-top': { command: `kubectl top node ${name}`, title: `节点资源 — ${name}`, actionName: '查看资源使用' },

            // CronJob actions
            'cronjob-yaml': { command: `kubectl get cronjob ${name} -n ${ns} -o yaml`, title: `CronJob YAML — ${name}`, actionName: '查看 YAML' },
            'cronjob-describe': { command: `kubectl describe cronjob ${name} -n ${ns}`, title: `Describe CronJob — ${name}`, actionName: 'Describe' },
            'cronjob-delete': { command: `kubectl delete cronjob ${name} -n ${ns}`, title: `删除 CronJob — ${name}`, actionName: '删除 CronJob' },

            // ServiceAccount actions
            'sa-yaml': { command: `kubectl get sa ${name} -n ${ns} -o yaml`, title: `SA YAML — ${name}`, actionName: '查看 YAML' },
            'sa-describe': { command: `kubectl describe sa ${name} -n ${ns}`, title: `Describe SA — ${name}`, actionName: 'Describe' },
            'sa-bindings': { command: `kubectl get rolebindings,clusterrolebindings -A -o json | python3 -c "import sys,json;d=json.load(sys.stdin);[print(f'{i[\"metadata\"][\"name\"]} -> {i[\"roleRef\"][\"name\"]}') for i in d['items'] for s in i.get('subjects',[]) if s.get('name')=='${name}' and s.get('kind')=='ServiceAccount']"`, title: `SA 绑定 — ${name}`, actionName: '查看绑定' },

            // Pod command inspection
            'pod-check-cmd': { command: `kubectl get pod ${name} -n ${ns} -o jsonpath='{range .spec.containers[*]}Container: {.name}\\nCommand: {.command}\\nArgs: {.args}\\n---\\n{end}'`, title: `Pod 启动命令 — ${name}`, actionName: '检查启动命令' },

            // Generic
            'generic-yaml': { command: `kubectl get ${this.currentKind} ${name} -n ${ns} -o yaml`, title: `${this.currentKind} YAML — ${name}`, actionName: '查看 YAML' },
            'generic-describe': { command: `kubectl describe ${this.currentKind} ${name} -n ${ns}`, title: `Describe ${this.currentKind} — ${name}`, actionName: 'Describe' },
        };

        return actions[action] || null;
    }

    async handleSpecialAction(action: string): Promise<boolean> {
        const pageManager = (window as any).kubernetesPageManager;
        if (!pageManager) return false;

        // Actions that need special handling (not just SSH execute)
        if (action === 'pod-isolate') {
            // Trigger the isolation dialog through page manager
            const pods = pageManager.getRenderer().getData().pods;
            const pod = pods.find((p: any) => p.name === this.currentName && p.namespace === this.currentNamespace);
            if (pod) {
                const emergencyMgr = (window as any).app?.kubernetesEmergencyManager;
                if (emergencyMgr) {
                    const confirmed = await showConfirm({ title: '隔离 Pod', message: `确定要隔离 Pod "${this.currentName}"？`, dangerous: true });
                    if (confirmed) {
                        const result = await emergencyMgr.isolatePod(this.currentName, this.currentNamespace, pod.labels);
                        if (result.status === 'completed') {
                            window.showNotification?.(`Pod ${this.currentName} 已隔离`, 'success');
                        } else {
                            window.showNotification?.(`隔离失败: ${result.error}`, 'error');
                        }
                    }
                }
            }
            return true;
        }

        if (action === 'cronjob-suspend') {
            const emergencyMgr = (window as any).app?.kubernetesEmergencyManager;
            if (emergencyMgr) {
                const confirmed = await showConfirm({ title: '暂停 CronJob', message: `确定要暂停 CronJob "${this.currentName}"？暂停后不再触发新的 Job。`, dangerous: true });
                if (confirmed) {
                    const result = await emergencyMgr.suspendCronJob(this.currentName, this.currentNamespace);
                    if (result.status === 'completed') {
                        window.showNotification?.(`CronJob ${this.currentName} 已暂停`, 'success');
                    } else {
                        window.showNotification?.(`暂停失败: ${result.error}`, 'error');
                    }
                }
            }
            return true;
        }

        if (action === 'sa-delete') {
            const emergencyMgr = (window as any).app?.kubernetesEmergencyManager;
            if (emergencyMgr) {
                const confirmed = await showConfirm({ title: '删除 ServiceAccount', message: `确定要删除 ServiceAccount "${this.currentName}" 及其关联的 RoleBinding/ClusterRoleBinding？`, dangerous: true });
                if (confirmed) {
                    const result = await emergencyMgr.deleteServiceAccount(this.currentName, this.currentNamespace);
                    if (result.status === 'completed') {
                        window.showNotification?.(`ServiceAccount ${this.currentName} 已删除`, 'success');
                    } else {
                        window.showNotification?.(`删除失败: ${result.error}`, 'error');
                    }
                }
            }
            return true;
        }

        if (action === 'pod-forensic') {
            const emergencyMgr = (window as any).app?.kubernetesEmergencyManager;
            if (emergencyMgr) {
                window.showNotification?.('正在采集取证数据...', 'warning');
                const report = await emergencyMgr.captureForensicSnapshot(this.currentName, this.currentNamespace);
                window.showNotification?.('取证数据采集完成', 'success');
                pageManager.getRenderer().updateData('forensicReport', report);
            }
            return true;
        }

        return false;
    }

    // ============================================================
    // Menu HTML Builders
    // ============================================================

    private getPodMenuHTML(): string {
        return `
        <div class="context-menu-group">
            <div class="context-menu-group-title">基本信息</div>
            <div class="context-menu-item" data-action="pod-yaml">
                <span class="context-menu-icon">${icon(FileText)}</span> 查看 YAML
            </div>
            <div class="context-menu-item" data-action="pod-describe">
                <span class="context-menu-icon">${icon(Analysis)}</span> Describe
            </div>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-group">
            <div class="context-menu-group-title">日志</div>
            <div class="context-menu-item" data-action="pod-logs">
                <span class="context-menu-icon">${icon(Log)}</span> 查看日志 (200 行)
            </div>
            <div class="context-menu-item" data-action="pod-logs-previous">
                <span class="context-menu-icon">${icon(Log)}</span> 上一个容器日志
            </div>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-group">
            <div class="context-menu-group-title">操作</div>
            <div class="context-menu-item" data-action="pod-exec-sh">
                <span class="context-menu-icon">${icon(Terminal)}</span> 查看进程
            </div>
            <div class="context-menu-item" data-action="pod-env">
                <span class="context-menu-icon">${icon(Terminal)}</span> 查看环境变量
            </div>
            <div class="context-menu-item" data-action="copy-name">
                <span class="context-menu-icon">${icon(Copy)}</span> 复制名称
            </div>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-group">
            <div class="context-menu-group-title" style="color:var(--error-color);">应急</div>
            <div class="context-menu-item danger" data-action="pod-isolate">
                <span class="context-menu-icon">${icon(Lock)}</span> 隔离 Pod
            </div>
            <div class="context-menu-item" data-action="pod-forensic">
                <span class="context-menu-icon">${icon(Analysis)}</span> 取证快照
            </div>
            <div class="context-menu-item danger" data-action="pod-delete-force">
                <span class="context-menu-icon">${icon(Delete)}</span> 强制删除
            </div>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-group">
            <div class="context-menu-group-title">安全</div>
            <div class="context-menu-item" data-action="pod-check-privileged">
                <span class="context-menu-icon">${icon(Shield)}</span> 检查特权
            </div>
            <div class="context-menu-item" data-action="pod-check-sa">
                <span class="context-menu-icon">${icon(Shield)}</span> 查看 ServiceAccount
            </div>
            <div class="context-menu-item" data-action="pod-check-netpol">
                <span class="context-menu-icon">${icon(Shield)}</span> 检查网络策略
            </div>
            <div class="context-menu-item" data-action="pod-check-cmd">
                <span class="context-menu-icon">${icon(Terminal)}</span> 检查启动命令
            </div>
        </div>`;
    }

    private getDeploymentMenuHTML(): string {
        return `
        <div class="context-menu-group">
            <div class="context-menu-group-title">基本信息</div>
            <div class="context-menu-item" data-action="deploy-yaml">
                <span class="context-menu-icon">${icon(FileText)}</span> 查看 YAML
            </div>
            <div class="context-menu-item" data-action="deploy-describe">
                <span class="context-menu-icon">${icon(Analysis)}</span> Describe
            </div>
            <div class="context-menu-item" data-action="deploy-history">
                <span class="context-menu-icon">${icon(Log)}</span> 部署历史
            </div>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-group">
            <div class="context-menu-group-title">操作</div>
            <div class="context-menu-item" data-action="deploy-scale">
                <span class="context-menu-icon">${icon(SettingConfig)}</span> 扩缩容
            </div>
            <div class="context-menu-item" data-action="deploy-rollback">
                <span class="context-menu-icon">${icon(Refresh)}</span> 回滚
            </div>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-group">
            <div class="context-menu-group-title" style="color:var(--error-color);">应急</div>
            <div class="context-menu-item danger" data-action="deploy-scale-zero">
                <span class="context-menu-icon">${icon(CloseOne)}</span> 缩容至 0
            </div>
        </div>`;
    }

    private getServiceMenuHTML(): string {
        return `
        <div class="context-menu-item" data-action="svc-yaml">
            <span class="context-menu-icon">${icon(FileText)}</span> 查看 YAML
        </div>
        <div class="context-menu-item" data-action="svc-describe">
            <span class="context-menu-icon">${icon(Analysis)}</span> Describe
        </div>
        <div class="context-menu-item" data-action="svc-endpoints">
            <span class="context-menu-icon">${icon(SettingConfig)}</span> 查看 Endpoints
        </div>`;
    }

    private getNodeMenuHTML(): string {
        return `
        <div class="context-menu-group">
            <div class="context-menu-group-title">基本信息</div>
            <div class="context-menu-item" data-action="node-yaml">
                <span class="context-menu-icon">${icon(FileText)}</span> 查看 YAML
            </div>
            <div class="context-menu-item" data-action="node-describe">
                <span class="context-menu-icon">${icon(Analysis)}</span> Describe
            </div>
            <div class="context-menu-item" data-action="node-top">
                <span class="context-menu-icon">${icon(Analysis)}</span> 查看资源使用
            </div>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-group">
            <div class="context-menu-group-title" style="color:var(--warning-color);">节点管理</div>
            <div class="context-menu-item" data-action="node-cordon">
                <span class="context-menu-icon">${icon(Shield)}</span> 封锁节点
            </div>
            <div class="context-menu-item" data-action="node-uncordon">
                <span class="context-menu-icon">${icon(Refresh)}</span> 解封节点
            </div>
            <div class="context-menu-item danger" data-action="node-drain">
                <span class="context-menu-icon">${icon(Delete)}</span> 排空节点
            </div>
        </div>`;
    }

    private getCronJobMenuHTML(): string {
        return `
        <div class="context-menu-group">
            <div class="context-menu-group-title">基本信息</div>
            <div class="context-menu-item" data-action="cronjob-yaml">
                <span class="context-menu-icon">${icon(FileText)}</span> 查看 YAML
            </div>
            <div class="context-menu-item" data-action="cronjob-describe">
                <span class="context-menu-icon">${icon(Analysis)}</span> Describe
            </div>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-group">
            <div class="context-menu-group-title" style="color:var(--error-color);">应急</div>
            <div class="context-menu-item danger" data-action="cronjob-suspend">
                <span class="context-menu-icon">${icon(Lock)}</span> 暂停 CronJob
            </div>
            <div class="context-menu-item danger" data-action="cronjob-delete">
                <span class="context-menu-icon">${icon(Delete)}</span> 删除 CronJob
            </div>
        </div>`;
    }

    private getServiceAccountMenuHTML(): string {
        return `
        <div class="context-menu-group">
            <div class="context-menu-group-title">基本信息</div>
            <div class="context-menu-item" data-action="sa-yaml">
                <span class="context-menu-icon">${icon(FileText)}</span> 查看 YAML
            </div>
            <div class="context-menu-item" data-action="sa-describe">
                <span class="context-menu-icon">${icon(Analysis)}</span> Describe
            </div>
            <div class="context-menu-item" data-action="sa-bindings">
                <span class="context-menu-icon">${icon(Shield)}</span> 查看绑定
            </div>
        </div>
        <div class="context-menu-divider"></div>
        <div class="context-menu-group">
            <div class="context-menu-group-title" style="color:var(--error-color);">应急</div>
            <div class="context-menu-item danger" data-action="sa-delete">
                <span class="context-menu-icon">${icon(Delete)}</span> 删除 ServiceAccount
            </div>
        </div>`;
    }

    private getGenericMenuHTML(): string {
        return `
        <div class="context-menu-item" data-action="generic-yaml">
            <span class="context-menu-icon">${icon(FileText)}</span> 查看 YAML
        </div>
        <div class="context-menu-item" data-action="generic-describe">
            <span class="context-menu-icon">${icon(Analysis)}</span> Describe
        </div>`;
    }
}

// Singleton instance
export const kubernetesContextMenu = new KubernetesContextMenu();
