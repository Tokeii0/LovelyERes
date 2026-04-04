import { DockerManager } from './dockerManager';
import type {
    DockerContainerSummary,
    DockerSecurityFinding,
    DockerSecurityAuditResult,
    DockerSecuritySeverity
} from './types';

export class DockerSecurityAuditor {
    private manager: DockerManager;

    private readonly DANGEROUS_MOUNTS = [
        '/var/run/docker.sock', '/proc', '/sys',
        '/etc/shadow', '/etc/passwd', '/root',
        '/dev', '/boot', '/var/run/containerd'
    ];

    constructor(manager: DockerManager) {
        this.manager = manager;
    }

    public async runFullAudit(): Promise<DockerSecurityAuditResult> {
        const startTime = Date.now();
        const findings: DockerSecurityFinding[] = [];
        let findingId = 0;
        const nextId = () => `docker-finding-${++findingId}`;

        const containers = await this.manager.listContainers();

        // Run all checks
        this.auditPrivileged(containers, findings, nextId);
        this.auditDangerousMounts(containers, findings, nextId);
        this.auditNetworkMode(containers, findings, nextId);
        this.auditImageTags(containers, findings, nextId);
        this.auditResourceLimits(containers, findings, nextId);
        this.auditHealthCheck(containers, findings, nextId);

        // Sort by severity
        const order: Record<DockerSecuritySeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
        findings.sort((a, b) => order[a.severity] - order[b.severity]);

        const summary = {
            critical: findings.filter(f => f.severity === 'critical').length,
            high: findings.filter(f => f.severity === 'high').length,
            medium: findings.filter(f => f.severity === 'medium').length,
            low: findings.filter(f => f.severity === 'low').length,
            info: findings.filter(f => f.severity === 'info').length,
            total: findings.length,
            score: this.calculateScore(findings)
        };

        return { timestamp: new Date().toISOString(), duration: Date.now() - startTime, findings, summary };
    }

    private auditPrivileged(containers: DockerContainerSummary[], findings: DockerSecurityFinding[], nextId: () => string): void {
        for (const c of containers) {
            if (c.quickChecks?.privileged) {
                findings.push({
                    id: nextId(), severity: 'critical', category: 'privileged',
                    container: c.name,
                    description: `Container "${c.name}" runs in privileged mode with full host access`,
                    remediation: 'Remove --privileged flag. Use specific --cap-add for required capabilities instead.'
                });
            }
        }
    }

    private auditDangerousMounts(containers: DockerContainerSummary[], findings: DockerSecurityFinding[], nextId: () => string): void {
        for (const c of containers) {
            for (const mount of c.mounts) {
                const isDangerous = this.DANGEROUS_MOUNTS.some(p => mount.source?.startsWith(p));
                if (isDangerous) {
                    const isDockerSocket = mount.source?.includes('docker.sock');
                    findings.push({
                        id: nextId(),
                        severity: isDockerSocket ? 'critical' : 'high',
                        category: 'mount',
                        container: c.name,
                        description: `Container "${c.name}" mounts dangerous host path: ${mount.source} → ${mount.destination}${isDockerSocket ? ' (Docker socket exposure!)' : ''}`,
                        remediation: isDockerSocket
                            ? 'Never mount Docker socket. Use Docker API over TLS or a Docker proxy with restricted access.'
                            : 'Avoid mounting sensitive host paths. Use named volumes or tmpfs instead.'
                    });
                }
            }
        }
    }

    private auditNetworkMode(containers: DockerContainerSummary[], findings: DockerSecurityFinding[], nextId: () => string): void {
        for (const c of containers) {
            if (c.networkMode === 'host') {
                findings.push({
                    id: nextId(), severity: 'high', category: 'network',
                    container: c.name,
                    description: `Container "${c.name}" uses host network mode - shares host network stack`,
                    remediation: 'Use bridge or custom network. Only use host mode when absolutely necessary for performance.'
                });
            }
            // Exposed ports on 0.0.0.0
            for (const port of c.ports) {
                if (port.publicPort && (!port.ip || port.ip === '0.0.0.0')) {
                    findings.push({
                        id: nextId(), severity: 'medium', category: 'network',
                        container: c.name,
                        description: `Container "${c.name}" exposes port ${port.publicPort}→${port.privatePort} on all interfaces (0.0.0.0)`,
                        remediation: 'Bind ports to specific interfaces (e.g., 127.0.0.1:8080:80) instead of all interfaces.'
                    });
                }
            }
        }
    }

    private auditImageTags(containers: DockerContainerSummary[], findings: DockerSecurityFinding[], nextId: () => string): void {
        for (const c of containers) {
            if (c.image.endsWith(':latest') || !c.image.includes(':')) {
                findings.push({
                    id: nextId(), severity: 'medium', category: 'image',
                    container: c.name,
                    description: `Container "${c.name}" uses :latest or untagged image: ${c.image}`,
                    remediation: 'Pin images to specific versions (e.g., nginx:1.25.3) for reproducibility and security.'
                });
            }
        }
    }

    private auditResourceLimits(containers: DockerContainerSummary[], findings: DockerSecurityFinding[], nextId: () => string): void {
        for (const c of containers) {
            if (c.state !== 'running') continue;
            // Check if memory is unlimited (memoryUsage will show but no limit indicator)
            if (c.memoryUsage && !c.memoryPercent) {
                findings.push({
                    id: nextId(), severity: 'low', category: 'resourceLimits',
                    container: c.name,
                    description: `Container "${c.name}" may not have memory limits configured`,
                    remediation: 'Set memory limits with --memory flag to prevent resource exhaustion (e.g., --memory=512m).'
                });
            }
        }
    }

    private auditHealthCheck(containers: DockerContainerSummary[], findings: DockerSecurityFinding[], nextId: () => string): void {
        for (const c of containers) {
            if (c.state !== 'running') continue;
            if (c.quickChecks?.health === 'unhealthy') {
                findings.push({
                    id: nextId(), severity: 'high', category: 'capabilities',
                    container: c.name,
                    description: `Container "${c.name}" health check reports unhealthy status`,
                    remediation: 'Investigate container health issues. Check logs and fix the underlying health check failures.'
                });
            }
        }
    }

    private calculateScore(findings: DockerSecurityFinding[]): number {
        let score = 100;
        for (const f of findings) {
            switch (f.severity) {
                case 'critical': score -= 15; break;
                case 'high': score -= 8; break;
                case 'medium': score -= 4; break;
                case 'low': score -= 2; break;
            }
        }
        return Math.max(0, Math.min(100, score));
    }
}
