import {
    K8sPod, K8sDeployment, K8sService, K8sNode, K8sClusterStats,
    K8sNamespace, K8sConfigMap, K8sSecret, K8sIngress, K8sNetworkPolicy,
    K8sEvent, K8sRole, K8sClusterRole, K8sRoleBinding, K8sClusterRoleBinding,
    K8sPersistentVolume, K8sPersistentVolumeClaim,
    K8sDaemonSet, K8sStatefulSet, K8sCronJob, K8sJob, K8sHPA,
    K8sLogOptions
} from './types';
import { sshConnectionManager } from '../remote/sshConnectionManager';

// ============================================================
// Kubectl JSON Output Interfaces
// ============================================================

interface KubectlList<T> {
    items: T[];
}

interface KubectlMetadata {
    name: string;
    namespace: string;
    creationTimestamp: string;
    labels?: Record<string, string>;
    uid: string;
    annotations?: Record<string, string>;
}

interface KubectlPod {
    metadata: KubectlMetadata;
    status: {
        phase: string;
        podIP?: string;
        containerStatuses?: Array<{
            name: string;
            image: string;
            ready: boolean;
            restartCount: number;
            state?: Record<string, any>;
        }>;
        qosClass?: string;
    };
    spec: {
        nodeName?: string;
        hostNetwork?: boolean;
        hostPID?: boolean;
        hostIPC?: boolean;
        serviceAccountName?: string;
        automountServiceAccountToken?: boolean;
        initContainers?: Array<{
            name: string;
            image: string;
            command?: string[];
            args?: string[];
            securityContext?: {
                privileged?: boolean;
                capabilities?: { add?: string[]; drop?: string[] };
                runAsUser?: number;
            };
        }>;
        containers: Array<{
            name: string;
            image: string;
            command?: string[];
            args?: string[];
            securityContext?: {
                privileged?: boolean;
                runAsRoot?: boolean;
                runAsUser?: number;
                capabilities?: { add?: string[]; drop?: string[] };
                allowPrivilegeEscalation?: boolean;
                readOnlyRootFilesystem?: boolean;
                seccompProfile?: { type: string };
            };
            resources?: {
                limits?: Record<string, string>;
                requests?: Record<string, string>;
            };
            volumeMounts?: Array<{ name: string; mountPath: string }>;
        }>;
        volumes?: Array<{
            name: string;
            hostPath?: { path: string };
            secret?: { secretName: string };
            configMap?: { name: string };
        }>;
    };
}

interface KubectlDeployment {
    metadata: KubectlMetadata;
    status: {
        replicas?: number;
        availableReplicas?: number;
        updatedReplicas?: number;
        conditions?: Array<{ type: string; status: string }>;
    };
    spec: {
        replicas: number;
        strategy?: { type: string };
        template: {
            spec: {
                containers: Array<{ name: string; image: string }>;
            };
        };
    };
}

interface KubectlService {
    metadata: KubectlMetadata;
    spec: {
        type: string;
        clusterIP: string;
        externalIPs?: string[];
        ports?: Array<{
            name?: string;
            port: number;
            targetPort: number | string;
            protocol: string;
            nodePort?: number;
        }>;
    };
}

interface KubectlNode {
    metadata: KubectlMetadata;
    status: {
        conditions: Array<{ type: string; status: string; message?: string }>;
        nodeInfo: { kubeletVersion: string };
        addresses: Array<{ type: string; address: string }>;
        capacity: { cpu: string; memory: string; pods: string };
        allocatable: { cpu: string; memory: string; pods: string };
    };
}

// ============================================================
// KubernetesManager
// ============================================================

export class KubernetesManager {
    constructor() {}

    // ============================================================
    // Core Execution
    // ============================================================

    private async executeKubectl(command: string): Promise<any> {
        if (!sshConnectionManager.isConnected()) {
            console.warn('SSH not connected, returning empty data for K8s');
            return null;
        }

        try {
            const result = await (window as any).__TAURI__.core.invoke('ssh_execute_dashboard_command_direct', {
                command: `${command} -o json`
            });

            if (result.exit_code !== 0) {
                console.error(`Kubectl command failed: ${command}`, result.output);
                return null;
            }

            return JSON.parse(result.output);
        } catch (error) {
            console.error(`Failed to execute kubectl command: ${command}`, error);
            return null;
        }
    }

    private async executeKubectlRaw(command: string): Promise<{ output: string; exit_code: number } | null> {
        if (!sshConnectionManager.isConnected()) {
            return null;
        }

        try {
            const result = await (window as any).__TAURI__.core.invoke('ssh_execute_dashboard_command_direct', {
                command
            });
            return result;
        } catch (error) {
            console.error(`Failed to execute kubectl command: ${command}`, error);
            return null;
        }
    }

    // ============================================================
    // Namespace
    // ============================================================

    public async getNamespaces(): Promise<K8sNamespace[]> {
        const data = await this.executeKubectl('kubectl get namespaces');
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            name: item.metadata.name,
            status: item.status?.phase || 'Active',
            labels: item.metadata.labels || {},
            creationTimestamp: item.metadata.creationTimestamp
        }));
    }

    // ============================================================
    // Workload Resources
    // ============================================================

    public async getPods(namespace?: string): Promise<K8sPod[]> {
        const cmd = namespace
            ? `kubectl get pods -n ${namespace}`
            : `kubectl get pods --all-namespaces`;

        const data = await this.executeKubectl(cmd) as KubectlList<KubectlPod>;
        if (!data || !data.items) return [];

        return data.items.map(item => {
            let status = (item.status.phase || 'Unknown') as K8sPod['status'];
            // Detect CrashLoopBackOff from container state
            const containerStatuses = item.status.containerStatuses || [];
            for (const cs of containerStatuses) {
                if (cs.state?.waiting?.reason === 'CrashLoopBackOff') {
                    status = 'CrashLoopBackOff';
                    break;
                }
            }

            return {
                id: item.metadata.uid,
                name: item.metadata.name,
                namespace: item.metadata.namespace,
                creationTimestamp: item.metadata.creationTimestamp,
                labels: item.metadata.labels || {},
                status,
                node: item.spec.nodeName || 'N/A',
                ip: item.status.podIP || '',
                restarts: containerStatuses.reduce((sum, c) => sum + c.restartCount, 0),
                containers: containerStatuses.map(c => {
                    const specContainer = item.spec.containers.find(sc => sc.name === c.name);
                    return {
                        name: c.name,
                        image: c.image,
                        ready: c.ready,
                        restarts: c.restartCount,
                        command: specContainer?.command,
                        args: specContainer?.args
                    };
                }),
                hostNetwork: item.spec.hostNetwork || false,
                hostPID: item.spec.hostPID || false,
                hostIPC: item.spec.hostIPC || false,
                serviceAccount: item.spec.serviceAccountName || 'default',
                qosClass: item.status.qosClass || 'BestEffort',
                isStaticPod: !!(item.metadata.annotations?.['kubernetes.io/config.source'] === 'file' ||
                    item.metadata.annotations?.['kubernetes.io/config.mirror'])
            };
        });
    }

    public async getDeployments(namespace?: string): Promise<K8sDeployment[]> {
        const cmd = namespace
            ? `kubectl get deployments -n ${namespace}`
            : `kubectl get deployments --all-namespaces`;

        const data = await this.executeKubectl(cmd) as KubectlList<KubectlDeployment>;
        if (!data || !data.items) return [];

        return data.items.map(item => {
            const conditions = item.status.conditions
                ?.filter(c => c.status === 'True')
                .map(c => c.type) || [];

            const images = item.spec.template?.spec?.containers?.map(c => c.image) || [];

            return {
                id: item.metadata.uid,
                name: item.metadata.name,
                namespace: item.metadata.namespace,
                creationTimestamp: item.metadata.creationTimestamp,
                labels: item.metadata.labels || {},
                replicas: item.spec.replicas || 0,
                availableReplicas: item.status.availableReplicas || 0,
                updatedReplicas: item.status.updatedReplicas || 0,
                conditions,
                strategy: item.spec.strategy?.type || 'RollingUpdate',
                images
            };
        });
    }

    public async getDaemonSets(namespace?: string): Promise<K8sDaemonSet[]> {
        const cmd = namespace
            ? `kubectl get daemonsets -n ${namespace}`
            : `kubectl get daemonsets --all-namespaces`;

        const data = await this.executeKubectl(cmd);
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            id: item.metadata.uid,
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            creationTimestamp: item.metadata.creationTimestamp,
            labels: item.metadata.labels || {},
            desiredNumberScheduled: item.status?.desiredNumberScheduled || 0,
            currentNumberScheduled: item.status?.currentNumberScheduled || 0,
            numberReady: item.status?.numberReady || 0,
            images: item.spec?.template?.spec?.containers?.map((c: any) => c.image) || []
        }));
    }

    public async getStatefulSets(namespace?: string): Promise<K8sStatefulSet[]> {
        const cmd = namespace
            ? `kubectl get statefulsets -n ${namespace}`
            : `kubectl get statefulsets --all-namespaces`;

        const data = await this.executeKubectl(cmd);
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            id: item.metadata.uid,
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            creationTimestamp: item.metadata.creationTimestamp,
            labels: item.metadata.labels || {},
            replicas: item.spec?.replicas || 0,
            readyReplicas: item.status?.readyReplicas || 0,
            serviceName: item.spec?.serviceName || '',
            images: item.spec?.template?.spec?.containers?.map((c: any) => c.image) || []
        }));
    }

    public async getCronJobs(namespace?: string): Promise<K8sCronJob[]> {
        const cmd = namespace
            ? `kubectl get cronjobs -n ${namespace}`
            : `kubectl get cronjobs --all-namespaces`;

        const data = await this.executeKubectl(cmd);
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            id: item.metadata.uid,
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            creationTimestamp: item.metadata.creationTimestamp,
            labels: item.metadata.labels || {},
            schedule: item.spec?.schedule || '',
            lastScheduleTime: item.status?.lastScheduleTime || '',
            suspend: item.spec?.suspend || false,
            activeJobs: item.status?.active?.length || 0
        }));
    }

    public async getJobs(namespace?: string): Promise<K8sJob[]> {
        const cmd = namespace
            ? `kubectl get jobs -n ${namespace}`
            : `kubectl get jobs --all-namespaces`;

        const data = await this.executeKubectl(cmd);
        if (!data || !data.items) return [];

        return data.items.map((item: any) => {
            const start = item.status?.startTime || '';
            const end = item.status?.completionTime || '';
            let duration = '';
            if (start && end) {
                const ms = new Date(end).getTime() - new Date(start).getTime();
                duration = ms < 60000 ? `${Math.round(ms / 1000)}s` : `${Math.round(ms / 60000)}m`;
            }

            return {
                id: item.metadata.uid,
                name: item.metadata.name,
                namespace: item.metadata.namespace,
                creationTimestamp: item.metadata.creationTimestamp,
                labels: item.metadata.labels || {},
                completions: item.spec?.completions || 1,
                succeeded: item.status?.succeeded || 0,
                failed: item.status?.failed || 0,
                startTime: start,
                completionTime: end,
                duration
            };
        });
    }

    public async getHPAs(namespace?: string): Promise<K8sHPA[]> {
        const cmd = namespace
            ? `kubectl get hpa -n ${namespace}`
            : `kubectl get hpa --all-namespaces`;

        const data = await this.executeKubectl(cmd);
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            id: item.metadata.uid,
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            creationTimestamp: item.metadata.creationTimestamp,
            labels: item.metadata.labels || {},
            minReplicas: item.spec?.minReplicas || 1,
            maxReplicas: item.spec?.maxReplicas || 1,
            currentReplicas: item.status?.currentReplicas || 0,
            targetRef: {
                kind: item.spec?.scaleTargetRef?.kind || '',
                name: item.spec?.scaleTargetRef?.name || ''
            },
            currentCPUUtilization: item.status?.currentCPUUtilizationPercentage ?? null,
            targetCPUUtilization: item.spec?.targetCPUUtilizationPercentage ?? null
        }));
    }

    // ============================================================
    // Networking Resources
    // ============================================================

    public async getServices(namespace?: string): Promise<K8sService[]> {
        const cmd = namespace
            ? `kubectl get services -n ${namespace}`
            : `kubectl get services --all-namespaces`;

        const data = await this.executeKubectl(cmd) as KubectlList<KubectlService>;
        if (!data || !data.items) return [];

        return data.items.map(item => ({
            id: item.metadata.uid,
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            creationTimestamp: item.metadata.creationTimestamp,
            labels: item.metadata.labels || {},
            type: (item.spec.type || 'ClusterIP') as K8sService['type'],
            clusterIP: item.spec.clusterIP,
            externalIPs: item.spec.externalIPs || [],
            ports: item.spec.ports?.map(p => ({
                name: p.name || '',
                port: p.port,
                targetPort: p.targetPort,
                protocol: (p.protocol || 'TCP') as 'TCP' | 'UDP' | 'SCTP',
                nodePort: p.nodePort
            })) || []
        }));
    }

    public async getIngresses(namespace?: string): Promise<K8sIngress[]> {
        const cmd = namespace
            ? `kubectl get ingress -n ${namespace}`
            : `kubectl get ingress --all-namespaces`;

        const data = await this.executeKubectl(cmd);
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            id: item.metadata.uid,
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            creationTimestamp: item.metadata.creationTimestamp,
            labels: item.metadata.labels || {},
            ingressClassName: item.spec?.ingressClassName || '',
            rules: (item.spec?.rules || []).map((r: any) => ({
                host: r.host || '*',
                paths: (r.http?.paths || []).map((p: any) => ({
                    path: p.path || '/',
                    pathType: p.pathType || 'Prefix',
                    backend: p.backend?.service
                        ? `${p.backend.service.name}:${p.backend.service.port?.number || p.backend.service.port?.name || ''}`
                        : ''
                }))
            })),
            tls: (item.spec?.tls || []).map((t: any) => ({
                hosts: t.hosts || [],
                secretName: t.secretName || ''
            }))
        }));
    }

    public async getNetworkPolicies(namespace?: string): Promise<K8sNetworkPolicy[]> {
        const cmd = namespace
            ? `kubectl get networkpolicies -n ${namespace}`
            : `kubectl get networkpolicies --all-namespaces`;

        const data = await this.executeKubectl(cmd);
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            id: item.metadata.uid,
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            creationTimestamp: item.metadata.creationTimestamp,
            labels: item.metadata.labels || {},
            podSelector: item.spec?.podSelector?.matchLabels || {},
            policyTypes: item.spec?.policyTypes || ['Ingress'],
            ingressRuleCount: item.spec?.ingress?.length || 0,
            egressRuleCount: item.spec?.egress?.length || 0,
            isIsolationPolicy: item.metadata.labels?.['lovelyres-emergency'] === 'true'
        }));
    }

    // ============================================================
    // Storage Resources
    // ============================================================

    public async getConfigMaps(namespace?: string): Promise<K8sConfigMap[]> {
        const cmd = namespace
            ? `kubectl get configmaps -n ${namespace}`
            : `kubectl get configmaps --all-namespaces`;

        const data = await this.executeKubectl(cmd);
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            id: item.metadata.uid,
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            creationTimestamp: item.metadata.creationTimestamp,
            labels: item.metadata.labels || {},
            dataKeys: Object.keys(item.data || {}),
            dataCount: Object.keys(item.data || {}).length
        }));
    }

    public async getSecrets(namespace?: string): Promise<K8sSecret[]> {
        const cmd = namespace
            ? `kubectl get secrets -n ${namespace}`
            : `kubectl get secrets --all-namespaces`;

        const data = await this.executeKubectl(cmd);
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            id: item.metadata.uid,
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            creationTimestamp: item.metadata.creationTimestamp,
            labels: item.metadata.labels || {},
            type: item.type || 'Opaque',
            dataKeys: Object.keys(item.data || {}),
            dataCount: Object.keys(item.data || {}).length
        }));
    }

    public async getPersistentVolumes(): Promise<K8sPersistentVolume[]> {
        const data = await this.executeKubectl('kubectl get pv');
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            name: item.metadata.name,
            capacity: item.spec?.capacity?.storage || '',
            accessModes: item.spec?.accessModes || [],
            reclaimPolicy: item.spec?.persistentVolumeReclaimPolicy || 'Retain',
            status: item.status?.phase || 'Available',
            storageClassName: item.spec?.storageClassName || '',
            claimRef: item.spec?.claimRef ? `${item.spec.claimRef.namespace}/${item.spec.claimRef.name}` : undefined
        }));
    }

    public async getPersistentVolumeClaims(namespace?: string): Promise<K8sPersistentVolumeClaim[]> {
        const cmd = namespace
            ? `kubectl get pvc -n ${namespace}`
            : `kubectl get pvc --all-namespaces`;

        const data = await this.executeKubectl(cmd);
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            id: item.metadata.uid,
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            creationTimestamp: item.metadata.creationTimestamp,
            labels: item.metadata.labels || {},
            status: item.status?.phase || 'Pending',
            volume: item.spec?.volumeName || '',
            capacity: item.status?.capacity?.storage || item.spec?.resources?.requests?.storage || '',
            accessModes: item.spec?.accessModes || [],
            storageClassName: item.spec?.storageClassName || ''
        }));
    }

    // ============================================================
    // RBAC Resources
    // ============================================================

    public async getRoles(namespace?: string): Promise<K8sRole[]> {
        const cmd = namespace
            ? `kubectl get roles -n ${namespace}`
            : `kubectl get roles --all-namespaces`;

        const data = await this.executeKubectl(cmd);
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            id: item.metadata.uid,
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            creationTimestamp: item.metadata.creationTimestamp,
            labels: item.metadata.labels || {},
            rules: (item.rules || []).map((r: any) => ({
                apiGroups: r.apiGroups || [''],
                resources: r.resources || [],
                verbs: r.verbs || []
            }))
        }));
    }

    public async getClusterRoles(): Promise<K8sClusterRole[]> {
        const data = await this.executeKubectl('kubectl get clusterroles');
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            name: item.metadata.name,
            creationTimestamp: item.metadata.creationTimestamp,
            labels: item.metadata.labels || {},
            rules: (item.rules || []).map((r: any) => ({
                apiGroups: r.apiGroups || [''],
                resources: r.resources || [],
                verbs: r.verbs || []
            })),
            isAggregated: !!(item.metadata.labels?.['rbac.authorization.k8s.io/aggregate-to-admin'] ||
                            item.metadata.labels?.['rbac.authorization.k8s.io/aggregate-to-edit'] ||
                            item.metadata.labels?.['rbac.authorization.k8s.io/aggregate-to-view'])
        }));
    }

    public async getRoleBindings(namespace?: string): Promise<K8sRoleBinding[]> {
        const cmd = namespace
            ? `kubectl get rolebindings -n ${namespace}`
            : `kubectl get rolebindings --all-namespaces`;

        const data = await this.executeKubectl(cmd);
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            id: item.metadata.uid,
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            creationTimestamp: item.metadata.creationTimestamp,
            labels: item.metadata.labels || {},
            subjects: (item.subjects || []).map((s: any) => ({
                kind: s.kind,
                name: s.name,
                namespace: s.namespace
            })),
            roleRef: {
                kind: item.roleRef?.kind || '',
                name: item.roleRef?.name || '',
                apiGroup: item.roleRef?.apiGroup || ''
            }
        }));
    }

    public async getClusterRoleBindings(): Promise<K8sClusterRoleBinding[]> {
        const data = await this.executeKubectl('kubectl get clusterrolebindings');
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            name: item.metadata.name,
            creationTimestamp: item.metadata.creationTimestamp,
            labels: item.metadata.labels || {},
            subjects: (item.subjects || []).map((s: any) => ({
                kind: s.kind,
                name: s.name,
                namespace: s.namespace
            })),
            roleRef: {
                kind: item.roleRef?.kind || '',
                name: item.roleRef?.name || '',
                apiGroup: item.roleRef?.apiGroup || ''
            }
        }));
    }

    // ============================================================
    // Events
    // ============================================================

    public async getEvents(namespace?: string): Promise<K8sEvent[]> {
        const cmd = namespace
            ? `kubectl get events -n ${namespace} --sort-by=.lastTimestamp`
            : `kubectl get events --all-namespaces --sort-by=.lastTimestamp`;

        const data = await this.executeKubectl(cmd);
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            id: item.metadata.uid,
            namespace: item.metadata.namespace || '',
            type: (item.type || 'Normal') as 'Normal' | 'Warning',
            reason: item.reason || '',
            message: item.message || '',
            source: item.source?.component || '',
            involvedObject: {
                kind: item.involvedObject?.kind || '',
                name: item.involvedObject?.name || '',
                namespace: item.involvedObject?.namespace || ''
            },
            count: item.count || 1,
            firstTimestamp: item.firstTimestamp || item.metadata.creationTimestamp,
            lastTimestamp: item.lastTimestamp || item.metadata.creationTimestamp
        }));
    }

    // ============================================================
    // Nodes
    // ============================================================

    public async getNodes(): Promise<K8sNode[]> {
        const data = await this.executeKubectl('kubectl get nodes') as KubectlList<KubectlNode>;
        if (!data || !data.items) return [];

        return data.items.map(item => {
            const readyCondition = item.status.conditions.find(c => c.type === 'Ready');
            const status = (readyCondition?.status === 'True' ? 'Ready' : 'NotReady') as K8sNode['status'];

            const roles = Object.keys(item.metadata.labels || {})
                .filter(k => k.startsWith('node-role.kubernetes.io/'))
                .map(k => k.split('/')[1]);

            return {
                name: item.metadata.name,
                status,
                roles: roles.length > 0 ? roles : ['worker'],
                version: item.status.nodeInfo.kubeletVersion,
                addresses: item.status.addresses,
                capacity: item.status.capacity,
                allocatable: item.status.allocatable,
                conditions: item.status.conditions.map(c => ({
                    type: c.type,
                    status: c.status,
                    message: c.message
                }))
            };
        });
    }

    // ============================================================
    // Cluster Stats
    // ============================================================

    public async getClusterStats(): Promise<K8sClusterStats> {
        if (!sshConnectionManager.isConnected()) {
            return {
                totalPods: 0, runningPods: 0,
                totalDeployments: 0, totalServices: 0,
                totalNodes: 0, healthyNodes: 0,
                cpuUsage: 0, memoryUsage: 0,
                warningEventCount: 0, crashLoopPodCount: 0
            };
        }

        const [pods, deployments, services, nodes, events] = await Promise.all([
            this.getPods(),
            this.getDeployments(),
            this.getServices(),
            this.getNodes(),
            this.getEvents()
        ]);

        const runningPods = pods.filter(p => p.status === 'Running').length;
        const healthyNodes = nodes.filter(n => n.status === 'Ready').length;
        const warningEventCount = events.filter(e => e.type === 'Warning').length;
        const crashLoopPodCount = pods.filter(p => p.status === 'CrashLoopBackOff').length;

        let cpuUsage = 0;
        let memoryUsage = 0;

        try {
            const topResult = await this.executeKubectlRaw('kubectl top nodes --no-headers');
            if (topResult && topResult.exit_code === 0 && topResult.output) {
                const lines = topResult.output.trim().split('\n');
                let totalCpuPercent = 0;
                let totalMemPercent = 0;
                let count = 0;

                lines.forEach((line: string) => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length >= 5) {
                        const cpu = parseInt(parts[2].replace('%', ''));
                        const mem = parseInt(parts[4].replace('%', ''));
                        if (!isNaN(cpu) && !isNaN(mem)) {
                            totalCpuPercent += cpu;
                            totalMemPercent += mem;
                            count++;
                        }
                    }
                });

                if (count > 0) {
                    cpuUsage = Math.round(totalCpuPercent / count);
                    memoryUsage = Math.round(totalMemPercent / count);
                }
            }
        } catch (e) {
            // Metrics server might not be installed
        }

        return {
            totalPods: pods.length,
            runningPods,
            totalDeployments: deployments.length,
            totalServices: services.length,
            totalNodes: nodes.length,
            healthyNodes,
            cpuUsage,
            memoryUsage,
            warningEventCount,
            crashLoopPodCount
        };
    }

    // ============================================================
    // Operations
    // ============================================================

    public async getPodLogs(options: K8sLogOptions): Promise<string> {
        let cmd = `kubectl logs ${options.pod} -n ${options.namespace}`;
        if (options.container) cmd += ` -c ${options.container}`;
        if (options.tailLines) cmd += ` --tail=${options.tailLines}`;
        if (options.sinceSeconds) cmd += ` --since=${options.sinceSeconds}s`;
        if (options.previous) cmd += ` --previous`;

        const result = await this.executeKubectlRaw(cmd);
        return result?.output || '';
    }

    public async execInPod(pod: string, namespace: string, container: string, command: string): Promise<string> {
        let cmd = `kubectl exec ${pod} -n ${namespace}`;
        if (container) cmd += ` -c ${container}`;
        cmd += ` -- ${command}`;

        const result = await this.executeKubectlRaw(cmd);
        return result?.output || '';
    }

    public async describeResource(kind: string, name: string, namespace?: string): Promise<string> {
        let cmd = `kubectl describe ${kind} ${name}`;
        if (namespace) cmd += ` -n ${namespace}`;

        const result = await this.executeKubectlRaw(cmd);
        return result?.output || '';
    }

    public async getResourceYaml(kind: string, name: string, namespace?: string): Promise<string> {
        let cmd = `kubectl get ${kind} ${name} -o yaml`;
        if (namespace) cmd += ` -n ${namespace}`;

        const result = await this.executeKubectlRaw(cmd);
        return result?.output || '';
    }

    public async applyYaml(yamlContent: string): Promise<{ success: boolean; output: string }> {
        // Write YAML to temp file then apply
        const escapedYaml = yamlContent.replace(/'/g, "'\\''");
        const cmd = `echo '${escapedYaml}' | kubectl apply -f -`;

        const result = await this.executeKubectlRaw(cmd);
        return {
            success: result?.exit_code === 0,
            output: result?.output || ''
        };
    }

    public async deleteResource(kind: string, name: string, namespace?: string): Promise<{ success: boolean; output: string }> {
        let cmd = `kubectl delete ${kind} ${name}`;
        if (namespace) cmd += ` -n ${namespace}`;

        const result = await this.executeKubectlRaw(cmd);
        return {
            success: result?.exit_code === 0,
            output: result?.output || ''
        };
    }

    public async scaleDeployment(name: string, namespace: string, replicas: number): Promise<{ success: boolean; output: string }> {
        const cmd = `kubectl scale deployment ${name} -n ${namespace} --replicas=${replicas}`;
        const result = await this.executeKubectlRaw(cmd);
        return {
            success: result?.exit_code === 0,
            output: result?.output || ''
        };
    }

    public async cordonNode(nodeName: string): Promise<{ success: boolean; output: string }> {
        const result = await this.executeKubectlRaw(`kubectl cordon ${nodeName}`);
        return {
            success: result?.exit_code === 0,
            output: result?.output || ''
        };
    }

    public async uncordonNode(nodeName: string): Promise<{ success: boolean; output: string }> {
        const result = await this.executeKubectlRaw(`kubectl uncordon ${nodeName}`);
        return {
            success: result?.exit_code === 0,
            output: result?.output || ''
        };
    }

    public async drainNode(nodeName: string): Promise<{ success: boolean; output: string }> {
        const cmd = `kubectl drain ${nodeName} --ignore-daemonsets --delete-emptydir-data --force --timeout=120s`;
        const result = await this.executeKubectlRaw(cmd);
        return {
            success: result?.exit_code === 0,
            output: result?.output || ''
        };
    }

    // ============================================================
    // Utility: Get raw pod JSON for security analysis
    // ============================================================

    public async getRawPodSpecs(namespace?: string): Promise<KubectlPod[]> {
        const cmd = namespace
            ? `kubectl get pods -n ${namespace}`
            : `kubectl get pods --all-namespaces`;

        const data = await this.executeKubectl(cmd) as KubectlList<KubectlPod>;
        return data?.items || [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public async getRawCronJobSpecs(namespace?: string): Promise<any[]> {
        const cmd = namespace
            ? `kubectl get cronjobs -n ${namespace}`
            : `kubectl get cronjobs --all-namespaces`;

        const data = await this.executeKubectl(cmd);
        return data?.items || [];
    }

    public async deleteServiceAccount(name: string, namespace: string): Promise<{ success: boolean; output: string }> {
        return this.deleteResource('serviceaccount', name, namespace);
    }

    public async suspendCronJob(name: string, namespace: string): Promise<{ success: boolean; output: string }> {
        const cmd = `kubectl patch cronjob ${name} -n ${namespace} -p '{"spec":{"suspend":true}}'`;
        const result = await this.executeKubectlRaw(cmd);
        return {
            success: result?.exit_code === 0,
            output: result?.output || ''
        };
    }

    public async getServiceAccounts(namespace?: string): Promise<any[]> {
        const cmd = namespace
            ? `kubectl get serviceaccounts -n ${namespace}`
            : `kubectl get serviceaccounts --all-namespaces`;

        const data = await this.executeKubectl(cmd);
        if (!data || !data.items) return [];

        return data.items.map((item: any) => ({
            name: item.metadata.name,
            namespace: item.metadata.namespace,
            creationTimestamp: item.metadata.creationTimestamp,
            automountServiceAccountToken: item.automountServiceAccountToken,
            secrets: (item.secrets || []).map((s: any) => s.name),
        }));
    }

    public async isolateNamespace(namespace: string): Promise<{ success: boolean; output: string }> {
        const policyYaml = `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: lovelyres-deny-all
  namespace: ${namespace}
  labels:
    lovelyres-emergency: "true"
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress`;
        return this.applyYaml(policyYaml);
    }

    public async etcdDeletePod(_podName: string, namespace: string): Promise<{ success: boolean; output: string }> {
        // This requires etcdctl access inside the control plane node
        // Used when a pod's etcd key has been tampered with and kubectl delete doesn't work
        const cmd = `docker exec minikube /bin/sh -c 'ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 --cacert=/var/lib/minikube/certs/etcd/ca.crt --cert=/var/lib/minikube/certs/etcd/healthcheck-client.crt --key=/var/lib/minikube/certs/etcd/healthcheck-client.key del /registry/pods/${namespace}/ --prefix --keys-only 2>&1' | while read key; do echo "Found key: $key"; done`;
        const result = await this.executeKubectlRaw(cmd);
        return {
            success: result?.exit_code === 0,
            output: result?.output || ''
        };
    }
}
