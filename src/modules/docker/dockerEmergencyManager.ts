import { DockerManager } from './dockerManager';
import type {
    DockerEmergencyAction,
    DockerForensicReport,
    DockerEmergencyActionType,
    DockerContainerSummary
} from './types';

const MAX_ACTION_HISTORY = 100;

export class DockerEmergencyManager {
    private manager: DockerManager;
    private actionHistory: DockerEmergencyAction[] = [];

    constructor(manager: DockerManager) {
        this.manager = manager;
    }

    private recordAction(action: DockerEmergencyAction): void {
        this.actionHistory.push(action);
        if (this.actionHistory.length > MAX_ACTION_HISTORY) {
            this.actionHistory.length = MAX_ACTION_HISTORY;
        }
    }

    // ============================================================
    // Emergency Actions
    // ============================================================

    public async emergencyStop(containerRef: string): Promise<DockerEmergencyAction> {
        const action = this.createAction('stop', containerRef);
        try {
            const result = await this.manager.performAction(containerRef, 'stop');
            if (result.success) {
                action.status = 'completed';
                action.result = `Container ${containerRef} stopped`;
                action.rollbackCommand = `docker start ${containerRef}`;
            } else {
                action.status = 'failed';
                action.error = result.message;
            }
        } catch (e) {
            action.status = 'failed';
            action.error = String(e);
        }
        this.recordAction(action);
        return action;
    }

    public async emergencyKill(containerRef: string): Promise<DockerEmergencyAction> {
        const action = this.createAction('kill', containerRef);
        try {
            const result = await this.manager.performAction(containerRef, 'kill');
            if (result.success) {
                action.status = 'completed';
                action.result = `Container ${containerRef} killed`;
                action.rollbackCommand = `docker start ${containerRef}`;
            } else {
                action.status = 'failed';
                action.error = result.message;
            }
        } catch (e) {
            action.status = 'failed';
            action.error = String(e);
        }
        this.recordAction(action);
        return action;
    }

    public async emergencyPause(containerRef: string): Promise<DockerEmergencyAction> {
        const action = this.createAction('pause', containerRef);
        try {
            const result = await this.manager.performAction(containerRef, 'pause');
            if (result.success) {
                action.status = 'completed';
                action.result = `Container ${containerRef} paused`;
                action.rollbackCommand = `docker unpause ${containerRef}`;
            } else {
                action.status = 'failed';
                action.error = result.message;
            }
        } catch (e) {
            action.status = 'failed';
            action.error = String(e);
        }
        this.recordAction(action);
        return action;
    }

    public async emergencyDisconnectNetwork(containerRef: string): Promise<DockerEmergencyAction> {
        const action = this.createAction('disconnect_network', containerRef);
        try {
            const result = await this.manager.disconnectAllNetworks(containerRef);
            if (result.success) {
                action.status = 'completed';
                action.result = `Network disconnected:\n${result.output}`;
                action.rollbackCommand = `docker restart ${containerRef}`;
            } else {
                action.status = 'failed';
                action.error = result.output;
            }
        } catch (e) {
            action.status = 'failed';
            action.error = String(e);
        }
        this.recordAction(action);
        return action;
    }

    public async emergencyRemove(containerRef: string, force: boolean = true): Promise<DockerEmergencyAction> {
        const action = this.createAction('remove', containerRef);
        try {
            const cmd = force ? `docker rm -f ${containerRef}` : `docker rm ${containerRef}`;
            const result = await (window as any).__TAURI__.core.invoke('ssh_execute_dashboard_command_direct', { command: cmd });
            if (result.exit_code === 0) {
                action.status = 'completed';
                action.result = `Container ${containerRef} removed`;
                action.rollbackCommand = '';
            } else {
                action.status = 'failed';
                action.error = result.output;
            }
        } catch (e) {
            action.status = 'failed';
            action.error = String(e);
        }
        this.recordAction(action);
        return action;
    }

    // ============================================================
    // Forensic Capture
    // ============================================================

    public async captureForensicSnapshot(containerRef: string, containerName: string): Promise<DockerForensicReport> {
        const report: DockerForensicReport = {
            containerName,
            containerId: containerRef,
            timestamp: new Date().toISOString(),
            inspect: '',
            logs: '',
            processes: '',
            diff: '',
            envVars: '',
            networkSettings: '',
            mounts: ''
        };

        const [inspect, logs, processes, diff, envVars] = await Promise.allSettled([
            this.manager.inspect(containerRef).then(r => JSON.stringify(r, null, 2)),
            this.manager.getLogs(containerRef, { tail: 500 }),
            this.manager.getContainerProcesses(containerRef),
            this.manager.getContainerDiff(containerRef),
            this.manager.getContainerEnv(containerRef)
        ]);

        if (inspect.status === 'fulfilled') report.inspect = inspect.value ?? '';
        else console.warn('Forensic: inspect failed:', inspect.reason);
        if (logs.status === 'fulfilled') report.logs = logs.value ?? '';
        else console.warn('Forensic: logs failed:', logs.reason);
        if (processes.status === 'fulfilled') report.processes = processes.value ?? '';
        else console.warn('Forensic: processes failed:', processes.reason);
        if (diff.status === 'fulfilled') report.diff = diff.value ?? '';
        else console.warn('Forensic: diff failed:', diff.reason);
        if (envVars.status === 'fulfilled') report.envVars = envVars.value ?? '';
        else console.warn('Forensic: envVars failed:', envVars.reason);

        // Extract network settings and mounts from inspect
        if (report.inspect) {
            try {
                const inspectData = JSON.parse(report.inspect);
                report.networkSettings = JSON.stringify(inspectData.NetworkSettings, null, 2) || '';
                report.mounts = JSON.stringify(inspectData.Mounts, null, 2) || '';
            } catch {}
        }

        return report;
    }

    // ============================================================
    // Anomaly Detection
    // ============================================================

    public detectAnomalies(containers: DockerContainerSummary[]): string[] {
        const warnings: string[] = [];

        for (const c of containers) {
            // Privileged containers
            if (c.quickChecks?.privileged) {
                warnings.push(`[CRITICAL] Container "${c.name}" runs in privileged mode`);
            }

            // Unhealthy containers
            if (c.quickChecks?.health === 'unhealthy') {
                warnings.push(`[HIGH] Container "${c.name}" is unhealthy`);
            }

            // Docker socket mounted
            for (const mount of c.mounts) {
                if (mount.source?.includes('docker.sock')) {
                    warnings.push(`[CRITICAL] Container "${c.name}" has Docker socket mounted`);
                }
            }

            // Host network
            if (c.networkMode === 'host') {
                warnings.push(`[HIGH] Container "${c.name}" uses host network mode`);
            }

            // High CPU
            if ((c.cpuPercent || 0) > 90) {
                warnings.push(`[MEDIUM] Container "${c.name}" CPU usage: ${c.cpuPercent}%`);
            }

            // High memory
            if ((c.memoryPercent || 0) > 90) {
                warnings.push(`[MEDIUM] Container "${c.name}" memory usage: ${c.memoryPercent}%`);
            }
        }

        return warnings;
    }

    // ============================================================
    // History & Rollback
    // ============================================================

    public getActionHistory(): DockerEmergencyAction[] {
        return [...this.actionHistory];
    }

    public async executeRollback(actionId: string): Promise<{ success: boolean; output: string }> {
        const action = this.actionHistory.find(a => a.id === actionId);
        if (!action?.rollbackCommand) {
            return { success: false, output: 'No rollback command available' };
        }
        try {
            const result = await (window as any).__TAURI__.core.invoke('ssh_execute_dashboard_command_direct', {
                command: action.rollbackCommand
            });
            return { success: result.exit_code === 0, output: result.output || '' };
        } catch (e) {
            return { success: false, output: String(e) };
        }
    }

    private createAction(type: DockerEmergencyActionType, target: string): DockerEmergencyAction {
        return {
            id: `docker-action-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            type, target,
            status: 'executing',
            timestamp: new Date().toISOString(),
            rollbackCommand: ''
        };
    }
}
