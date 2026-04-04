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

        this.auditPrivileged(containers, findings, nextId);
        this.auditDangerousMounts(containers, findings, nextId);
        this.auditNetworkMode(containers, findings, nextId);
        this.auditImageTags(containers, findings, nextId);
        this.auditResourceLimits(containers, findings, nextId);
        this.auditHealthCheck(containers, findings, nextId);

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
                    description: `容器 "${c.name}" 以特权模式运行，拥有宿主机完全访问权限`,
                    remediation: '移除 --privileged 标志。使用 --cap-add 添加所需的特定 Linux capabilities 代替。'
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
                        description: `容器 "${c.name}" 挂载了危险的宿主机路径: ${mount.source} -> ${mount.destination}${isDockerSocket ? ' (Docker Socket 暴露!)' : ''}`,
                        remediation: isDockerSocket
                            ? '绝不应挂载 Docker Socket。请使用基于 TLS 的 Docker API 或权限受限的 Docker 代理。'
                            : '避免挂载敏感的宿主机路径。使用命名卷 (named volume) 或 tmpfs 替代。'
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
                    description: `容器 "${c.name}" 使用 host 网络模式，与宿主机共享网络栈`,
                    remediation: '使用 bridge 或自定义网络。仅在对性能有绝对需求时才使用 host 模式。'
                });
            }
            for (const port of c.ports) {
                if (port.publicPort && (!port.ip || port.ip === '0.0.0.0')) {
                    findings.push({
                        id: nextId(), severity: 'medium', category: 'network',
                        container: c.name,
                        description: `容器 "${c.name}" 在所有网络接口 (0.0.0.0) 上暴露了端口 ${port.publicPort}->${port.privatePort}`,
                        remediation: '将端口绑定到特定接口 (例如 127.0.0.1:8080:80) 而非所有接口。'
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
                    description: `容器 "${c.name}" 使用了 :latest 或未指定标签的镜像: ${c.image}`,
                    remediation: '将镜像固定到具体版本 (例如 nginx:1.25.3) 以确保可复现性和安全性。'
                });
            }
        }
    }

    private auditResourceLimits(containers: DockerContainerSummary[], findings: DockerSecurityFinding[], nextId: () => string): void {
        for (const c of containers) {
            if (c.state !== 'running') continue;
            if (c.memoryUsage && !c.memoryPercent) {
                findings.push({
                    id: nextId(), severity: 'low', category: 'resourceLimits',
                    container: c.name,
                    description: `容器 "${c.name}" 可能未配置内存限制`,
                    remediation: '使用 --memory 标志设置内存限制以防止资源耗尽 (例如 --memory=512m)。'
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
                    description: `容器 "${c.name}" 健康检查报告不健康状态`,
                    remediation: '排查容器健康问题。检查日志并修复导致健康检查失败的根本原因。'
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
