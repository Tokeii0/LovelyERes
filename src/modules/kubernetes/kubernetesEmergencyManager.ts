import { KubernetesManager } from './kubernetesManager';
import {
    K8sEmergencyAction, K8sPodForensicReport,
    K8sAnomalyAlert, K8sPod, K8sEvent,
    EmergencyActionType
} from './types';

export class KubernetesEmergencyManager {
    private manager: KubernetesManager;
    private actionHistory: K8sEmergencyAction[] = [];
    private anomalyAlerts: K8sAnomalyAlert[] = [];
    private isolationPolicies: Map<string, string> = new Map(); // podKey -> policyName

    // Thresholds for anomaly detection
    private readonly RESTART_THRESHOLD = 5;
    private readonly KNOWN_REGISTRIES = [
        'docker.io', 'gcr.io', 'ghcr.io', 'quay.io',
        'registry.k8s.io', 'k8s.gcr.io', 'mcr.microsoft.com',
        'public.ecr.aws', 'registry.cn-'
    ];

    constructor(manager: KubernetesManager) {
        this.manager = manager;
    }

    // ============================================================
    // Pod Isolation
    // ============================================================

    public async isolatePod(podName: string, namespace: string, podLabels: Record<string, string>): Promise<K8sEmergencyAction> {
        const action = this.createAction('isolate', podName, namespace);

        try {
            const policyName = `lovelyres-isolate-${podName}-${Date.now()}`;
            const policyYaml = this.generateIsolationPolicy(policyName, namespace, podLabels);

            const result = await this.manager.applyYaml(policyYaml);

            if (result.success) {
                action.status = 'completed';
                action.result = `NetworkPolicy "${policyName}" applied successfully`;
                action.rollbackCommand = `kubectl delete networkpolicy ${policyName} -n ${namespace}`;
                this.isolationPolicies.set(`${namespace}/${podName}`, policyName);
            } else {
                action.status = 'failed';
                action.error = result.output;
            }
        } catch (e) {
            action.status = 'failed';
            action.error = String(e);
        }

        this.actionHistory.unshift(action);
        return action;
    }

    public async removeIsolation(podName: string, namespace: string): Promise<K8sEmergencyAction> {
        const action = this.createAction('remove_isolation', podName, namespace);
        const key = `${namespace}/${podName}`;
        const policyName = this.isolationPolicies.get(key);

        if (!policyName) {
            action.status = 'failed';
            action.error = `No isolation policy found for ${key}`;
            this.actionHistory.unshift(action);
            return action;
        }

        try {
            const result = await this.manager.deleteResource('networkpolicy', policyName, namespace);
            if (result.success) {
                action.status = 'completed';
                action.result = `Isolation policy "${policyName}" removed`;
                this.isolationPolicies.delete(key);
            } else {
                action.status = 'failed';
                action.error = result.output;
            }
        } catch (e) {
            action.status = 'failed';
            action.error = String(e);
        }

        this.actionHistory.unshift(action);
        return action;
    }

    // ============================================================
    // Emergency Actions
    // ============================================================

    public async scaleToZero(deploymentName: string, namespace: string): Promise<K8sEmergencyAction> {
        const action = this.createAction('scale_zero', deploymentName, namespace);

        try {
            // Get current replicas for rollback
            const deployments = await this.manager.getDeployments(namespace);
            const deploy = deployments.find(d => d.name === deploymentName);
            const currentReplicas = deploy?.replicas || 1;

            const result = await this.manager.scaleDeployment(deploymentName, namespace, 0);
            if (result.success) {
                action.status = 'completed';
                action.result = `Scaled ${deploymentName} to 0 replicas`;
                action.rollbackCommand = `kubectl scale deployment ${deploymentName} -n ${namespace} --replicas=${currentReplicas}`;
            } else {
                action.status = 'failed';
                action.error = result.output;
            }
        } catch (e) {
            action.status = 'failed';
            action.error = String(e);
        }

        this.actionHistory.unshift(action);
        return action;
    }

    public async cordonNode(nodeName: string): Promise<K8sEmergencyAction> {
        const action = this.createAction('cordon', nodeName, '');

        try {
            const result = await this.manager.cordonNode(nodeName);
            if (result.success) {
                action.status = 'completed';
                action.result = `Node ${nodeName} cordoned`;
                action.rollbackCommand = `kubectl uncordon ${nodeName}`;
            } else {
                action.status = 'failed';
                action.error = result.output;
            }
        } catch (e) {
            action.status = 'failed';
            action.error = String(e);
        }

        this.actionHistory.unshift(action);
        return action;
    }

    public async drainNode(nodeName: string): Promise<K8sEmergencyAction> {
        const action = this.createAction('drain', nodeName, '');

        try {
            const result = await this.manager.drainNode(nodeName);
            if (result.success) {
                action.status = 'completed';
                action.result = `Node ${nodeName} drained`;
                action.rollbackCommand = `kubectl uncordon ${nodeName}`;
            } else {
                action.status = 'failed';
                action.error = result.output;
            }
        } catch (e) {
            action.status = 'failed';
            action.error = String(e);
        }

        this.actionHistory.unshift(action);
        return action;
    }

    public async deletePod(podName: string, namespace: string, force: boolean = false): Promise<K8sEmergencyAction> {
        const action = this.createAction('delete_pod', podName, namespace);

        try {
            const cmd = force
                ? `kubectl delete pod ${podName} -n ${namespace} --force --grace-period=0`
                : `kubectl delete pod ${podName} -n ${namespace}`;

            const result = await (window as any).__TAURI__.core.invoke('ssh_execute_dashboard_command_direct', { command: cmd });

            if (result.exit_code === 0) {
                action.status = 'completed';
                action.result = `Pod ${podName} deleted${force ? ' (force)' : ''}`;
                action.rollbackCommand = ''; // Cannot rollback a pod delete
            } else {
                action.status = 'failed';
                action.error = result.output;
            }
        } catch (e) {
            action.status = 'failed';
            action.error = String(e);
        }

        this.actionHistory.unshift(action);
        return action;
    }

    // ============================================================
    // Forensic Capture
    // ============================================================

    public async captureForensicSnapshot(podName: string, namespace: string, container?: string): Promise<K8sPodForensicReport> {
        const report: K8sPodForensicReport = {
            podName,
            namespace,
            timestamp: new Date().toISOString(),
            describe: '',
            logs: '',
            previousLogs: '',
            envVars: {},
            mountedSecrets: [],
            networkPolicies: [],
            processTree: '',
            fileSystemSnapshot: ''
        };

        // Parallel forensic data collection
        const containerArg = container ? container : '';

        const [describe, logs, previousLogs, envResult, processResult, fsResult, networkPolicies] = await Promise.allSettled([
            this.manager.describeResource('pod', podName, namespace),
            this.manager.getPodLogs({ pod: podName, namespace, container: containerArg, tailLines: 500 }),
            this.manager.getPodLogs({ pod: podName, namespace, container: containerArg, tailLines: 200, previous: true }),
            this.manager.execInPod(podName, namespace, containerArg, 'env'),
            this.manager.execInPod(podName, namespace, containerArg, 'ps auxf 2>/dev/null || ps aux'),
            this.manager.execInPod(podName, namespace, containerArg, 'ls -la / 2>/dev/null; cat /proc/self/mountinfo 2>/dev/null'),
            this.manager.getNetworkPolicies(namespace)
        ]);

        if (describe.status === 'fulfilled') report.describe = describe.value;
        if (logs.status === 'fulfilled') report.logs = logs.value;
        if (previousLogs.status === 'fulfilled') report.previousLogs = previousLogs.value;

        if (envResult.status === 'fulfilled' && envResult.value) {
            const envLines = envResult.value.split('\n');
            for (const line of envLines) {
                const eqIdx = line.indexOf('=');
                if (eqIdx > 0) {
                    report.envVars[line.substring(0, eqIdx)] = line.substring(eqIdx + 1);
                }
            }
        }

        if (processResult.status === 'fulfilled') report.processTree = processResult.value;
        if (fsResult.status === 'fulfilled') report.fileSystemSnapshot = fsResult.value;

        if (networkPolicies.status === 'fulfilled') {
            report.networkPolicies = networkPolicies.value.map(np => np.name);
        }

        // Extract mounted secrets from describe output
        if (report.describe) {
            const secretMatches = report.describe.match(/SecretName:\s+(\S+)/g);
            if (secretMatches) {
                report.mountedSecrets = secretMatches.map(m => m.replace('SecretName:', '').trim());
            }
        }

        return report;
    }

    // ============================================================
    // Anomaly Detection
    // ============================================================

    public detectAnomalies(pods: K8sPod[]): K8sAnomalyAlert[] {
        const alerts: K8sAnomalyAlert[] = [];
        let alertId = 0;

        for (const pod of pods) {
            // High restart count
            if (pod.restarts >= this.RESTART_THRESHOLD) {
                alerts.push({
                    id: `anomaly-${++alertId}`,
                    timestamp: new Date().toISOString(),
                    type: 'restart_spike',
                    severity: pod.restarts >= 20 ? 'critical' : pod.restarts >= 10 ? 'high' : 'medium',
                    pod: pod.name,
                    namespace: pod.namespace,
                    details: `Pod has ${pod.restarts} restarts (threshold: ${this.RESTART_THRESHOLD})`,
                    acknowledged: false
                });
            }

            // CrashLoopBackOff
            if (pod.status === 'CrashLoopBackOff') {
                alerts.push({
                    id: `anomaly-${++alertId}`,
                    timestamp: new Date().toISOString(),
                    type: 'crash_loop',
                    severity: 'high',
                    pod: pod.name,
                    namespace: pod.namespace,
                    details: `Pod is in CrashLoopBackOff state`,
                    acknowledged: false
                });
            }

            // Host network
            if (pod.hostNetwork) {
                alerts.push({
                    id: `anomaly-${++alertId}`,
                    timestamp: new Date().toISOString(),
                    type: 'host_network',
                    severity: 'medium',
                    pod: pod.name,
                    namespace: pod.namespace,
                    details: `Pod is using host network`,
                    acknowledged: false
                });
            }

            // Unauthorized image registry
            for (const container of pod.containers) {
                const isKnown = this.KNOWN_REGISTRIES.some(reg => container.image.includes(reg)) ||
                    !container.image.includes('/'); // Official images like nginx, redis
                if (!isKnown) {
                    alerts.push({
                        id: `anomaly-${++alertId}`,
                        timestamp: new Date().toISOString(),
                        type: 'unauthorized_image',
                        severity: 'medium',
                        pod: pod.name,
                        namespace: pod.namespace,
                        details: `Container "${container.name}" uses image from unrecognized registry: ${container.image}`,
                        acknowledged: false
                    });
                }
            }
        }

        this.anomalyAlerts = alerts;
        return alerts;
    }

    // ============================================================
    // Event Timeline
    // ============================================================

    public async buildEventTimeline(namespace?: string, limitMinutes: number = 60): Promise<K8sEvent[]> {
        const events = await this.manager.getEvents(namespace);
        const cutoff = new Date(Date.now() - limitMinutes * 60 * 1000);

        return events
            .filter(e => new Date(e.lastTimestamp) >= cutoff)
            .sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime());
    }

    // ============================================================
    // Helpers
    // ============================================================

    public generateIsolationPolicy(policyName: string, namespace: string, podLabels: Record<string, string>): string {
        const matchLabels = Object.entries(podLabels)
            .map(([k, v]) => `        ${k}: "${v}"`)
            .join('\n');

        return `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ${policyName}
  namespace: ${namespace}
  labels:
    lovelyres-emergency: "true"
    lovelyres-action: "isolate"
spec:
  podSelector:
    matchLabels:
${matchLabels}
  policyTypes:
  - Ingress
  - Egress`;
    }

    public getActionHistory(): K8sEmergencyAction[] {
        return [...this.actionHistory];
    }

    public getAnomalyAlerts(): K8sAnomalyAlert[] {
        return [...this.anomalyAlerts];
    }

    public getIsolatedPods(): { pod: string; policy: string }[] {
        return Array.from(this.isolationPolicies.entries()).map(([pod, policy]) => ({ pod, policy }));
    }

    public acknowledgeAlert(alertId: string): void {
        const alert = this.anomalyAlerts.find(a => a.id === alertId);
        if (alert) alert.acknowledged = true;
    }

    public async executeRollback(actionId: string): Promise<{ success: boolean; output: string }> {
        const action = this.actionHistory.find(a => a.id === actionId);
        if (!action || !action.rollbackCommand) {
            return { success: false, output: 'No rollback command available' };
        }

        try {
            const result = await (window as any).__TAURI__.core.invoke('ssh_execute_dashboard_command_direct', {
                command: action.rollbackCommand
            });
            return {
                success: result.exit_code === 0,
                output: result.output || ''
            };
        } catch (e) {
            return { success: false, output: String(e) };
        }
    }

    private createAction(type: EmergencyActionType, target: string, namespace: string): K8sEmergencyAction {
        return {
            id: `action-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            type,
            target,
            namespace,
            status: 'executing',
            timestamp: new Date().toISOString(),
            performedBy: 'LovelyRes',
            rollbackCommand: ''
        };
    }
}
