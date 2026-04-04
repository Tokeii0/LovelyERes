import { KubernetesManager } from './kubernetesManager';
import {
    K8sSecurityFinding, K8sSecurityAuditResult, SecuritySeverity
} from './types';

export class KubernetesSecurityAuditor {
    private manager: KubernetesManager;

    // Dangerous hostPath mounts
    private readonly DANGEROUS_HOST_PATHS = [
        '/var/run/docker.sock', '/var/run/crio/crio.sock',
        '/var/run/containerd', '/etc/shadow', '/etc/passwd',
        '/etc/kubernetes', '/root', '/proc', '/sys'
    ];

    // High-risk ClusterRole names
    private readonly HIGH_RISK_ROLES = ['cluster-admin', 'admin', 'edit'];

    constructor(manager: KubernetesManager) {
        this.manager = manager;
    }

    // ============================================================
    // Full Audit
    // ============================================================

    public async runFullAudit(namespace?: string): Promise<K8sSecurityAuditResult> {
        const startTime = Date.now();
        const allFindings: K8sSecurityFinding[] = [];
        let findingId = 0;

        const nextId = () => `finding-${++findingId}`;

        // Run all audit checks in parallel
        const [
            privilegedFindings,
            hostPathFindings,
            rbacFindings,
            imageFindings,
            networkFindings,
            resourceLimitFindings,
            rootUserFindings
        ] = await Promise.allSettled([
            this.auditPrivilegedContainers(namespace, nextId),
            this.auditHostPathMounts(namespace, nextId),
            this.auditRBAC(nextId),
            this.auditImages(namespace, nextId),
            this.auditNetworkExposure(namespace, nextId),
            this.auditResourceLimits(namespace, nextId),
            this.auditRootUsers(namespace, nextId)
        ]);

        const collectFindings = (result: PromiseSettledResult<K8sSecurityFinding[]>) => {
            if (result.status === 'fulfilled') allFindings.push(...result.value);
        };

        collectFindings(privilegedFindings);
        collectFindings(hostPathFindings);
        collectFindings(rbacFindings);
        collectFindings(imageFindings);
        collectFindings(networkFindings);
        collectFindings(resourceLimitFindings);
        collectFindings(rootUserFindings);

        // Sort by severity
        const severityOrder: Record<SecuritySeverity, number> = {
            critical: 0, high: 1, medium: 2, low: 3, info: 4
        };
        allFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

        // Calculate summary
        const summary = {
            critical: allFindings.filter(f => f.severity === 'critical').length,
            high: allFindings.filter(f => f.severity === 'high').length,
            medium: allFindings.filter(f => f.severity === 'medium').length,
            low: allFindings.filter(f => f.severity === 'low').length,
            info: allFindings.filter(f => f.severity === 'info').length,
            total: allFindings.length,
            score: this.calculateScore(allFindings)
        };

        return {
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime,
            findings: allFindings,
            summary
        };
    }

    // ============================================================
    // Privileged Containers
    // ============================================================

    private async auditPrivilegedContainers(namespace: string | undefined, nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];
        const rawPods = await this.manager.getRawPodSpecs(namespace);

        for (const pod of rawPods) {
            for (const container of pod.spec.containers) {
                if (container.securityContext?.privileged) {
                    findings.push({
                        id: nextId(),
                        severity: 'critical',
                        category: 'privileged',
                        resource: `${pod.metadata.name}/${container.name}`,
                        namespace: pod.metadata.namespace,
                        description: `Container "${container.name}" in pod "${pod.metadata.name}" runs in privileged mode`,
                        remediation: 'Remove `securityContext.privileged: true` from the container spec. Use specific Linux capabilities instead.'
                    });
                }
            }
        }
        return findings;
    }

    // ============================================================
    // HostPath Mounts
    // ============================================================

    private async auditHostPathMounts(namespace: string | undefined, nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];
        const rawPods = await this.manager.getRawPodSpecs(namespace);

        for (const pod of rawPods) {
            const volumes = pod.spec.volumes || [];
            for (const vol of volumes) {
                if (vol.hostPath) {
                    const isDangerous = this.DANGEROUS_HOST_PATHS.some(
                        p => vol.hostPath!.path.startsWith(p)
                    );

                    findings.push({
                        id: nextId(),
                        severity: isDangerous ? 'critical' : 'high',
                        category: 'hostPath',
                        resource: pod.metadata.name,
                        namespace: pod.metadata.namespace,
                        description: `Pod "${pod.metadata.name}" mounts host path "${vol.hostPath.path}"${isDangerous ? ' (DANGEROUS)' : ''}`,
                        remediation: 'Avoid hostPath volumes. Use PersistentVolumeClaims or emptyDir volumes instead.'
                    });
                }
            }
        }
        return findings;
    }

    // ============================================================
    // RBAC Analysis
    // ============================================================

    private async auditRBAC(nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];

        const [clusterRoleBindings, clusterRoles] = await Promise.all([
            this.manager.getClusterRoleBindings(),
            this.manager.getClusterRoles()
        ]);

        // Check cluster-admin bindings
        for (const binding of clusterRoleBindings) {
            if (binding.roleRef.name === 'cluster-admin') {
                for (const subject of binding.subjects) {
                    // Skip system accounts
                    if (subject.name.startsWith('system:') || subject.namespace === 'kube-system') continue;

                    findings.push({
                        id: nextId(),
                        severity: 'critical',
                        category: 'rbac',
                        resource: `${binding.name} -> ${subject.kind}/${subject.name}`,
                        namespace: subject.namespace || 'cluster',
                        description: `${subject.kind} "${subject.name}" has cluster-admin privileges via binding "${binding.name}"`,
                        remediation: 'Review if cluster-admin access is truly needed. Create a more restrictive ClusterRole with only required permissions.'
                    });
                }
            }
        }

        // Check for wildcard permissions
        for (const role of clusterRoles) {
            // Skip system roles
            if (role.name.startsWith('system:')) continue;

            for (const rule of role.rules) {
                const hasWildcard = rule.verbs.includes('*') || rule.resources.includes('*');
                if (hasWildcard) {
                    findings.push({
                        id: nextId(),
                        severity: 'high',
                        category: 'rbac',
                        resource: role.name,
                        namespace: 'cluster',
                        description: `ClusterRole "${role.name}" has wildcard permissions: verbs=${rule.verbs.join(',')} resources=${rule.resources.join(',')}`,
                        remediation: 'Replace wildcard (*) permissions with explicit resource names and verbs following the principle of least privilege.'
                    });
                }
            }
        }

        // Check service account bindings to high-risk roles
        for (const binding of clusterRoleBindings) {
            if (this.HIGH_RISK_ROLES.includes(binding.roleRef.name)) {
                for (const subject of binding.subjects) {
                    if (subject.kind === 'ServiceAccount' && !subject.name.startsWith('system:')) {
                        findings.push({
                            id: nextId(),
                            severity: 'medium',
                            category: 'serviceAccount',
                            resource: `${subject.name}`,
                            namespace: subject.namespace || 'default',
                            description: `ServiceAccount "${subject.name}" in namespace "${subject.namespace || 'default'}" bound to high-risk ClusterRole "${binding.roleRef.name}"`,
                            remediation: 'Review if this ServiceAccount needs such broad permissions. Consider creating a namespace-scoped Role instead.'
                        });
                    }
                }
            }
        }

        return findings;
    }

    // ============================================================
    // Image Security
    // ============================================================

    private async auditImages(namespace: string | undefined, nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];
        const rawPods = await this.manager.getRawPodSpecs(namespace);

        for (const pod of rawPods) {
            for (const container of pod.spec.containers) {
                const image = container.image;

                // Check for :latest tag
                if (image.endsWith(':latest') || !image.includes(':')) {
                    findings.push({
                        id: nextId(),
                        severity: 'medium',
                        category: 'image',
                        resource: `${pod.metadata.name}/${container.name}`,
                        namespace: pod.metadata.namespace,
                        description: `Container "${container.name}" uses "latest" or untagged image: ${image}`,
                        remediation: 'Pin images to specific versions or digests (e.g., nginx:1.25.3 or nginx@sha256:...) for reproducibility and security.'
                    });
                }
            }
        }
        return findings;
    }

    // ============================================================
    // Network Exposure
    // ============================================================

    private async auditNetworkExposure(namespace: string | undefined, nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];

        const [services, networkPolicies] = await Promise.all([
            this.manager.getServices(namespace),
            this.manager.getNetworkPolicies(namespace)
        ]);

        // Check NodePort/LoadBalancer services
        for (const svc of services) {
            if (svc.type === 'NodePort') {
                findings.push({
                    id: nextId(),
                    severity: 'medium',
                    category: 'network',
                    resource: svc.name,
                    namespace: svc.namespace,
                    description: `Service "${svc.name}" exposes NodePort(s): ${svc.ports.filter(p => p.nodePort).map(p => p.nodePort).join(', ')}`,
                    remediation: 'Consider using ClusterIP with Ingress or LoadBalancer instead of NodePort for production workloads.'
                });
            } else if (svc.type === 'LoadBalancer') {
                findings.push({
                    id: nextId(),
                    severity: 'low',
                    category: 'network',
                    resource: svc.name,
                    namespace: svc.namespace,
                    description: `Service "${svc.name}" is exposed via LoadBalancer`,
                    remediation: 'Ensure LoadBalancer has appropriate security groups/firewall rules and consider using Ingress with TLS.'
                });
            }
        }

        // Check namespaces without NetworkPolicies
        const nsWithPolicies = new Set(networkPolicies.map(np => np.namespace));
        const pods = await this.manager.getPods(namespace);
        const podNamespaces = new Set(pods.map(p => p.namespace).filter(ns => ns !== 'kube-system'));

        for (const ns of podNamespaces) {
            if (!nsWithPolicies.has(ns)) {
                findings.push({
                    id: nextId(),
                    severity: 'medium',
                    category: 'network',
                    resource: ns,
                    namespace: ns,
                    description: `Namespace "${ns}" has no NetworkPolicies defined - all pod traffic is unrestricted`,
                    remediation: 'Create default-deny NetworkPolicies and explicitly allow required traffic.'
                });
            }
        }

        return findings;
    }

    // ============================================================
    // Resource Limits
    // ============================================================

    private async auditResourceLimits(namespace: string | undefined, nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];
        const rawPods = await this.manager.getRawPodSpecs(namespace);

        for (const pod of rawPods) {
            // Skip kube-system pods
            if (pod.metadata.namespace === 'kube-system') continue;

            for (const container of pod.spec.containers) {
                if (!container.resources?.limits) {
                    findings.push({
                        id: nextId(),
                        severity: 'low',
                        category: 'resourceLimits',
                        resource: `${pod.metadata.name}/${container.name}`,
                        namespace: pod.metadata.namespace,
                        description: `Container "${container.name}" has no resource limits defined`,
                        remediation: 'Set CPU and memory limits to prevent resource exhaustion and noisy neighbor issues.'
                    });
                }
            }
        }
        return findings;
    }

    // ============================================================
    // Root User
    // ============================================================

    private async auditRootUsers(namespace: string | undefined, nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];
        const rawPods = await this.manager.getRawPodSpecs(namespace);

        for (const pod of rawPods) {
            if (pod.metadata.namespace === 'kube-system') continue;

            for (const container of pod.spec.containers) {
                const sc = container.securityContext;
                if (sc?.runAsUser === 0) {
                    findings.push({
                        id: nextId(),
                        severity: 'high',
                        category: 'rootUser',
                        resource: `${pod.metadata.name}/${container.name}`,
                        namespace: pod.metadata.namespace,
                        description: `Container "${container.name}" explicitly runs as root (runAsUser: 0)`,
                        remediation: 'Set runAsNonRoot: true and specify a non-root runAsUser in the security context.'
                    });
                }
            }
        }
        return findings;
    }

    // ============================================================
    // Score Calculation
    // ============================================================

    private calculateScore(findings: K8sSecurityFinding[]): number {
        let score = 100;
        for (const finding of findings) {
            switch (finding.severity) {
                case 'critical': score -= 15; break;
                case 'high': score -= 8; break;
                case 'medium': score -= 4; break;
                case 'low': score -= 2; break;
                case 'info': score -= 0; break;
            }
        }
        return Math.max(0, Math.min(100, score));
    }
}
