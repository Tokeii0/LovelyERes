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

    // Dangerous Linux capabilities that allow container escape
    private readonly DANGEROUS_CAPABILITIES = [
        'SYS_ADMIN', 'SYS_PTRACE', 'SYS_MODULE', 'DAC_READ_SEARCH',
        'NET_ADMIN', 'NET_RAW', 'SYS_RAWIO', 'MKNOD', 'SETUID', 'SETGID',
    ];

    // Suspicious command patterns in pod/cronjob specs (reverse shells, C2 callbacks)
    private readonly SUSPICIOUS_CMD_PATTERNS = [
        /\/dev\/tcp\//i,
        /bash\s+-i\s+>&/i,
        /nc\s+(-e|--exec)\s/i,
        /ncat\s.*-e\s/i,
        /python.*socket/i,
        /perl.*socket/i,
        /ruby.*socket/i,
        /php\s+-r.*fsockopen/i,
        /socat\s+.*exec/i,
        /mkfifo.*\/tmp/i,
        /curl.*\|\s*(bash|sh)/i,
        /wget.*\|\s*(bash|sh)/i,
    ];

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
        const results = await Promise.allSettled([
            this.auditPrivilegedContainers(namespace, nextId),
            this.auditHostPathMounts(namespace, nextId),
            this.auditRBAC(nextId),
            this.auditImages(namespace, nextId),
            this.auditNetworkExposure(namespace, nextId),
            this.auditResourceLimits(namespace, nextId),
            this.auditRootUsers(namespace, nextId),
            this.auditSuspiciousCronJobs(namespace, nextId),
            this.auditSuspiciousPodCommands(namespace, nextId),
            this.auditHighPrivilegeServiceAccounts(nextId),
            this.auditContainerEscape(namespace, nextId),
            this.auditSATokenMount(namespace, nextId),
            this.auditStaticPods(namespace, nextId),
            this.auditRBACEscalation(nextId),
            this.auditInitContainers(namespace, nextId),
        ]);

        for (const result of results) {
            if (result.status === 'fulfilled') allFindings.push(...result.value);
        }

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
    // Suspicious CronJobs (reverse shells, C2 callbacks)
    // ============================================================

    private async auditSuspiciousCronJobs(namespace: string | undefined, nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];
        const rawCronJobs = await this.manager.getRawCronJobSpecs(namespace);

        for (const cj of rawCronJobs) {
            const containers = cj.spec?.jobTemplate?.spec?.template?.spec?.containers || [];
            for (const container of containers) {
                const fullCmd = [...(container.command || []), ...(container.args || [])].join(' ');
                for (const pattern of this.SUSPICIOUS_CMD_PATTERNS) {
                    if (pattern.test(fullCmd)) {
                        findings.push({
                            id: nextId(),
                            severity: 'critical',
                            category: 'cronJob',
                            resource: `${cj.metadata.name}/${container.name}`,
                            namespace: cj.metadata.namespace,
                            description: `CronJob "${cj.metadata.name}" has suspicious command pattern (possible reverse shell/C2): ${fullCmd.substring(0, 120)}`,
                            remediation: 'Review and delete this CronJob immediately. Use: kubectl delete cronjob <name> -n <namespace>'
                        });
                        break;
                    }
                }
            }
        }
        return findings;
    }

    // ============================================================
    // Suspicious Pod Commands (reverse shells in running pods)
    // ============================================================

    private async auditSuspiciousPodCommands(namespace: string | undefined, nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];
        const rawPods = await this.manager.getRawPodSpecs(namespace);

        for (const pod of rawPods) {
            if (pod.metadata.namespace === 'kube-system') continue;

            for (const container of pod.spec.containers) {
                const fullCmd = [...(container.command || []), ...(container.args || [])].join(' ');
                for (const pattern of this.SUSPICIOUS_CMD_PATTERNS) {
                    if (pattern.test(fullCmd)) {
                        findings.push({
                            id: nextId(),
                            severity: 'critical',
                            category: 'cronJob',
                            resource: `${pod.metadata.name}/${container.name}`,
                            namespace: pod.metadata.namespace,
                            description: `Pod "${pod.metadata.name}" runs suspicious command (possible reverse shell): ${fullCmd.substring(0, 120)}`,
                            remediation: 'Investigate this pod immediately. Check if it was created by an attacker. Delete with: kubectl delete pod <name> -n <namespace> --force'
                        });
                        break;
                    }
                }
            }
        }
        return findings;
    }

    // ============================================================
    // High-Privilege Service Accounts (non-system SA with wildcard or cluster-admin)
    // ============================================================

    private async auditHighPrivilegeServiceAccounts(nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];

        const [clusterRoleBindings, roleBindings, roles] = await Promise.all([
            this.manager.getClusterRoleBindings(),
            this.manager.getRoleBindings(),
            this.manager.getRoles()
        ]);

        // Check non-system SA with cluster-admin ClusterRoleBinding
        for (const binding of clusterRoleBindings) {
            if (binding.roleRef.name === 'cluster-admin') {
                for (const subject of binding.subjects) {
                    if (subject.kind === 'ServiceAccount' &&
                        !subject.name.startsWith('system:') &&
                        subject.namespace !== 'kube-system') {
                        findings.push({
                            id: nextId(),
                            severity: 'critical',
                            category: 'serviceAccount',
                            resource: `${subject.name}`,
                            namespace: subject.namespace || 'default',
                            description: `ServiceAccount "${subject.name}" in "${subject.namespace || 'default'}" has cluster-admin privileges — potential attacker persistence`,
                            remediation: 'Delete this ServiceAccount and its bindings: kubectl delete sa <name> -n <namespace> && kubectl delete clusterrolebinding <binding-name>'
                        });
                    }
                }
            }
        }

        // Check namespace-scoped RoleBindings with wildcard Roles
        for (const rb of roleBindings) {
            const matchingRole = roles.find(r => r.name === rb.roleRef.name && r.namespace === rb.namespace);
            if (matchingRole) {
                const hasWildcard = matchingRole.rules.some(
                    rule => rule.verbs.includes('*') && rule.resources.includes('*')
                );
                if (hasWildcard) {
                    for (const subject of rb.subjects) {
                        if (subject.kind === 'ServiceAccount' &&
                            !subject.name.startsWith('system:') &&
                            subject.name !== 'default') {
                            findings.push({
                                id: nextId(),
                                severity: 'high',
                                category: 'serviceAccount',
                                resource: `${subject.name}`,
                                namespace: rb.namespace,
                                description: `ServiceAccount "${subject.name}" bound to Role "${rb.roleRef.name}" with wildcard permissions (*/*) in namespace "${rb.namespace}"`,
                                remediation: 'Review if this ServiceAccount is legitimate. Delete SA, Role, and RoleBinding if unauthorized.'
                            });
                        }
                    }
                }
            }
        }

        return findings;
    }

    // ============================================================
    // Container Escape Risk (hostPID/hostIPC/Capabilities)
    // ============================================================

    private async auditContainerEscape(namespace: string | undefined, nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];
        const rawPods = await this.manager.getRawPodSpecs(namespace);

        for (const pod of rawPods) {
            if (pod.metadata.namespace === 'kube-system') continue;

            // hostPID
            if (pod.spec.hostPID) {
                findings.push({
                    id: nextId(), severity: 'critical', category: 'containerEscape',
                    resource: pod.metadata.name, namespace: pod.metadata.namespace,
                    description: `Pod "${pod.metadata.name}" has hostPID: true — can see and signal host processes (nsenter escape risk)`,
                    remediation: 'Remove hostPID: true. If process visibility is needed, use a sidecar with limited capabilities.'
                });
            }

            // hostIPC
            if (pod.spec.hostIPC) {
                findings.push({
                    id: nextId(), severity: 'high', category: 'containerEscape',
                    resource: pod.metadata.name, namespace: pod.metadata.namespace,
                    description: `Pod "${pod.metadata.name}" has hostIPC: true — can access host shared memory`,
                    remediation: 'Remove hostIPC: true unless absolutely required.'
                });
            }

            // Dangerous capabilities
            for (const container of pod.spec.containers) {
                const addCaps = container.securityContext?.capabilities?.add || [];
                const dangerousCaps = addCaps.filter(c => this.DANGEROUS_CAPABILITIES.includes(c));

                if (dangerousCaps.length > 0) {
                    findings.push({
                        id: nextId(), severity: dangerousCaps.includes('SYS_ADMIN') ? 'critical' : 'high',
                        category: 'containerEscape',
                        resource: `${pod.metadata.name}/${container.name}`, namespace: pod.metadata.namespace,
                        description: `Container "${container.name}" has dangerous capabilities: ${dangerousCaps.join(', ')}`,
                        remediation: `Remove dangerous capabilities. Drop ALL and only add specific needed caps. Current dangerous: ${dangerousCaps.join(', ')}`
                    });
                }

                // allowPrivilegeEscalation not set to false
                if (container.securityContext?.allowPrivilegeEscalation !== false && !container.securityContext?.privileged) {
                    findings.push({
                        id: nextId(), severity: 'medium', category: 'containerEscape',
                        resource: `${pod.metadata.name}/${container.name}`, namespace: pod.metadata.namespace,
                        description: `Container "${container.name}" allows privilege escalation (default or explicit true)`,
                        remediation: 'Set allowPrivilegeEscalation: false in securityContext.'
                    });
                }
            }
        }
        return findings;
    }

    // ============================================================
    // SA Token Auto-Mount Detection
    // ============================================================

    private async auditSATokenMount(namespace: string | undefined, nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];
        const rawPods = await this.manager.getRawPodSpecs(namespace);

        for (const pod of rawPods) {
            if (pod.metadata.namespace === 'kube-system') continue;

            const saName = pod.spec.serviceAccountName || 'default';
            const autoMount = pod.spec.automountServiceAccountToken;

            // If not explicitly disabled and using a non-default SA
            if (autoMount !== false && saName !== 'default') {
                findings.push({
                    id: nextId(), severity: 'medium', category: 'tokenMount',
                    resource: `${pod.metadata.name} (SA: ${saName})`, namespace: pod.metadata.namespace,
                    description: `Pod "${pod.metadata.name}" auto-mounts token for SA "${saName}" — if compromised, attacker gets SA permissions`,
                    remediation: 'Set automountServiceAccountToken: false if the pod does not need API access. Use projected volumes with audience/expiry for required access.'
                });
            }
        }
        return findings;
    }

    // ============================================================
    // Static Pod Detection (persistence technique)
    // ============================================================

    private async auditStaticPods(namespace: string | undefined, nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];
        const rawPods = await this.manager.getRawPodSpecs(namespace);

        for (const pod of rawPods) {
            if (pod.metadata.namespace === 'kube-system') continue;

            const isStatic = pod.metadata.annotations?.['kubernetes.io/config.source'] === 'file' ||
                             pod.metadata.annotations?.['kubernetes.io/config.mirror'];

            if (isStatic) {
                findings.push({
                    id: nextId(), severity: 'critical', category: 'persistence',
                    resource: pod.metadata.name, namespace: pod.metadata.namespace,
                    description: `Pod "${pod.metadata.name}" is a STATIC POD (config.source=file) — cannot be deleted via kubectl, used for persistence`,
                    remediation: 'Check /etc/kubernetes/manifests/ on the node. Remove the manifest file to delete the static pod. This is a known attack persistence technique.'
                });
            }
        }
        return findings;
    }

    // ============================================================
    // RBAC Escalation Path Detection
    // ============================================================

    private async auditRBACEscalation(nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];
        const clusterRoles = await this.manager.getClusterRoles();

        // Dangerous verbs + resources that allow self-escalation
        const escalationPatterns = [
            { resources: ['roles', 'clusterroles'], verbs: ['create', 'update', 'patch', 'bind', 'escalate'] },
            { resources: ['rolebindings', 'clusterrolebindings'], verbs: ['create', 'update', 'patch'] },
            { resources: ['serviceaccounts'], verbs: ['create', 'impersonate'] },
            { resources: ['secrets'], verbs: ['get', 'list'] },
            { resources: ['pods/exec', 'pods/attach'], verbs: ['create', 'get'] },
            { resources: ['nodes/proxy', 'pods/proxy'], verbs: ['create', 'get'] },
        ];

        for (const role of clusterRoles) {
            if (role.name.startsWith('system:')) continue;

            for (const rule of role.rules) {
                for (const pattern of escalationPatterns) {
                    const hasResource = pattern.resources.some(r => rule.resources.includes(r) || rule.resources.includes('*'));
                    const hasVerb = pattern.verbs.some(v => rule.verbs.includes(v) || rule.verbs.includes('*'));

                    if (hasResource && hasVerb) {
                        const matchedResources = pattern.resources.filter(r => rule.resources.includes(r) || rule.resources.includes('*'));
                        const matchedVerbs = pattern.verbs.filter(v => rule.verbs.includes(v) || rule.verbs.includes('*'));

                        findings.push({
                            id: nextId(), severity: 'high', category: 'rbac',
                            resource: role.name, namespace: 'cluster',
                            description: `ClusterRole "${role.name}" has escalation-capable permissions: ${matchedVerbs.join('/')} on ${matchedResources.join('/')}`,
                            remediation: 'Review this role. Permissions to create/modify RBAC resources or access secrets/exec allow privilege escalation.'
                        });
                        break; // One finding per role per pattern group
                    }
                }
            }
        }
        return findings;
    }

    // ============================================================
    // Init Container Audit (persistence/post-exploit)
    // ============================================================

    private async auditInitContainers(namespace: string | undefined, nextId: () => string): Promise<K8sSecurityFinding[]> {
        const findings: K8sSecurityFinding[] = [];
        const rawPods = await this.manager.getRawPodSpecs(namespace);

        for (const pod of rawPods) {
            if (pod.metadata.namespace === 'kube-system') continue;
            const initContainers = pod.spec.initContainers || [];

            for (const ic of initContainers) {
                // Check for privileged init containers
                if (ic.securityContext?.privileged) {
                    findings.push({
                        id: nextId(), severity: 'critical', category: 'privileged',
                        resource: `${pod.metadata.name}/init:${ic.name}`, namespace: pod.metadata.namespace,
                        description: `Init container "${ic.name}" in pod "${pod.metadata.name}" runs in privileged mode`,
                        remediation: 'Review if privileged init container is needed. Remove privileged: true.'
                    });
                }

                // Check for suspicious commands in init containers
                const fullCmd = [...(ic.command || []), ...(ic.args || [])].join(' ');
                for (const pattern of this.SUSPICIOUS_CMD_PATTERNS) {
                    if (pattern.test(fullCmd)) {
                        findings.push({
                            id: nextId(), severity: 'critical', category: 'persistence',
                            resource: `${pod.metadata.name}/init:${ic.name}`, namespace: pod.metadata.namespace,
                            description: `Init container "${ic.name}" has suspicious command: ${fullCmd.substring(0, 100)}`,
                            remediation: 'Investigate this init container immediately. It may be used for pre-exploit setup.'
                        });
                        break;
                    }
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
