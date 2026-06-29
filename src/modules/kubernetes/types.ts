// ============================================================
// K8s Base Types
// ============================================================

export interface K8sResource {
    id: string;
    name: string;
    namespace: string;
    creationTimestamp: string;
    labels: Record<string, string>;
}

// ============================================================
// Workload Resources
// ============================================================

export interface K8sContainer {
    name: string;
    image: string;
    ready: boolean;
    restarts: number;
    command?: string[];
    args?: string[];
}

export interface K8sPod extends K8sResource {
    status: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown' | 'CrashLoopBackOff' | 'Terminating';
    node: string;
    ip: string;
    restarts: number;
    containers: K8sContainer[];
    hostNetwork?: boolean;
    hostPID?: boolean;
    hostIPC?: boolean;
    serviceAccount?: string;
    qosClass?: string;
    isStaticPod?: boolean;
}

export interface K8sServiceAccount extends K8sResource {
    automountServiceAccountToken?: boolean;
    secrets: string[];
}

export interface K8sDeployment extends K8sResource {
    replicas: number;
    availableReplicas: number;
    updatedReplicas: number;
    conditions: string[];
    strategy?: string;
    images: string[];
}

export interface K8sDaemonSet extends K8sResource {
    desiredNumberScheduled: number;
    currentNumberScheduled: number;
    numberReady: number;
    images: string[];
}

export interface K8sStatefulSet extends K8sResource {
    replicas: number;
    readyReplicas: number;
    serviceName: string;
    images: string[];
}

export interface K8sCronJob extends K8sResource {
    schedule: string;
    lastScheduleTime: string;
    suspend: boolean;
    activeJobs: number;
}

export interface K8sJob extends K8sResource {
    completions: number;
    succeeded: number;
    failed: number;
    startTime: string;
    completionTime: string;
    duration: string;
}

export interface K8sHPA extends K8sResource {
    minReplicas: number;
    maxReplicas: number;
    currentReplicas: number;
    targetRef: { kind: string; name: string };
    currentCPUUtilization: number | null;
    targetCPUUtilization: number | null;
}

// ============================================================
// Networking Resources
// ============================================================

export interface K8sService extends K8sResource {
    type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName';
    clusterIP: string;
    externalIPs: string[];
    ports: K8sServicePort[];
}

export interface K8sServicePort {
    name: string;
    port: number;
    targetPort: number | string;
    protocol: 'TCP' | 'UDP' | 'SCTP';
    nodePort?: number;
}

export interface K8sIngress extends K8sResource {
    ingressClassName: string;
    rules: K8sIngressRule[];
    tls: { hosts: string[]; secretName: string }[];
}

export interface K8sIngressRule {
    host: string;
    paths: { path: string; pathType: string; backend: string }[];
}

export interface K8sNetworkPolicy extends K8sResource {
    podSelector: Record<string, string>;
    policyTypes: string[];
    ingressRuleCount: number;
    egressRuleCount: number;
    isIsolationPolicy?: boolean;
}

// ============================================================
// Storage Resources
// ============================================================

export interface K8sPersistentVolume {
    name: string;
    capacity: string;
    accessModes: string[];
    reclaimPolicy: string;
    status: 'Available' | 'Bound' | 'Released' | 'Failed';
    storageClassName: string;
    claimRef?: string;
}

export interface K8sPersistentVolumeClaim extends K8sResource {
    status: 'Pending' | 'Bound' | 'Lost';
    volume: string;
    capacity: string;
    accessModes: string[];
    storageClassName: string;
}

export interface K8sConfigMap extends K8sResource {
    dataKeys: string[];
    dataCount: number;
}

export interface K8sSecret extends K8sResource {
    type: string;
    dataKeys: string[];
    dataCount: number;
}

// ============================================================
// RBAC Resources
// ============================================================

export interface K8sRole extends K8sResource {
    rules: K8sRBACRule[];
}

export interface K8sClusterRole {
    name: string;
    creationTimestamp: string;
    labels: Record<string, string>;
    rules: K8sRBACRule[];
    isAggregated: boolean;
}

export interface K8sRBACRule {
    apiGroups: string[];
    resources: string[];
    verbs: string[];
}

export interface K8sRoleBinding extends K8sResource {
    subjects: K8sRBACSubject[];
    roleRef: { kind: string; name: string; apiGroup: string };
}

export interface K8sClusterRoleBinding {
    name: string;
    creationTimestamp: string;
    labels: Record<string, string>;
    subjects: K8sRBACSubject[];
    roleRef: { kind: string; name: string; apiGroup: string };
}

export interface K8sRBACSubject {
    kind: 'User' | 'Group' | 'ServiceAccount';
    name: string;
    namespace?: string;
}

// ============================================================
// Cluster Resources
// ============================================================

export interface K8sNode {
    name: string;
    status: 'Ready' | 'NotReady' | 'Unknown';
    roles: string[];
    version: string;
    addresses: { type: string; address: string }[];
    capacity: {
        cpu: string;
        memory: string;
        pods: string;
    };
    allocatable: {
        cpu: string;
        memory: string;
        pods: string;
    };
    conditions?: { type: string; status: string; message?: string }[];
}

export interface K8sNamespace {
    name: string;
    status: 'Active' | 'Terminating';
    labels: Record<string, string>;
    creationTimestamp: string;
}

export interface K8sEvent {
    id: string;
    namespace: string;
    type: 'Normal' | 'Warning';
    reason: string;
    message: string;
    source: string;
    involvedObject: { kind: string; name: string; namespace: string };
    count: number;
    firstTimestamp: string;
    lastTimestamp: string;
}

export interface K8sClusterStats {
    totalPods: number;
    runningPods: number;
    totalDeployments: number;
    totalServices: number;
    healthyNodes: number;
    totalNodes: number;
    cpuUsage: number;
    memoryUsage: number;
    warningEventCount?: number;
    crashLoopPodCount?: number;
}

// ============================================================
// Emergency Response Types
// ============================================================

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface K8sSecurityFinding {
    id: string;
    severity: SecuritySeverity;
    category: 'rbac' | 'privileged' | 'hostPath' | 'network' | 'image' | 'serviceAccount' | 'resourceLimits' | 'rootUser' | 'cronJob' | 'etcdTamper' | 'persistence' | 'containerEscape' | 'tokenMount';
    resource: string;
    namespace: string;
    description: string;
    remediation: string;
}

export type AnomalyType = 'restart_spike' | 'crash_loop' | 'unauthorized_image' | 'suspicious_exec' | 'host_network' | 'resource_spike' | 'reverse_shell_pod' | 'suspicious_cronjob' | 'suspicious_sa';

export interface K8sAnomalyAlert {
    id: string;
    timestamp: string;
    type: AnomalyType;
    severity: SecuritySeverity;
    pod: string;
    namespace: string;
    details: string;
    acknowledged: boolean;
}

export interface K8sPodForensicReport {
    podName: string;
    namespace: string;
    timestamp: string;
    describe: string;
    logs: string;
    previousLogs: string;
    envVars: Record<string, string>;
    mountedSecrets: string[];
    networkPolicies: string[];
    processTree: string;
    fileSystemSnapshot: string;
}

export type EmergencyActionType = 'isolate' | 'scale_zero' | 'cordon' | 'uncordon' | 'drain' | 'delete_pod' | 'remove_isolation' | 'delete_sa' | 'suspend_cronjob' | 'etcd_delete_pod' | 'isolate_namespace' | 'batch_delete';

export interface K8sForensicTimelineEntry {
    timestamp: string;
    type: 'pod_created' | 'rbac_change' | 'sa_created' | 'event_warning' | 'cronjob_created' | 'node_change';
    severity: SecuritySeverity;
    resource: string;
    namespace: string;
    details: string;
}

export interface K8sEmergencyAction {
    id: string;
    type: EmergencyActionType;
    target: string;
    namespace: string;
    status: 'pending' | 'executing' | 'completed' | 'failed';
    timestamp: string;
    performedBy: string;
    rollbackCommand: string;
    result?: string;
    error?: string;
}

export interface K8sSecurityAuditResult {
    timestamp: string;
    duration: number;
    findings: K8sSecurityFinding[];
    summary: {
        critical: number;
        high: number;
        medium: number;
        low: number;
        info: number;
        total: number;
        score: number;
    };
}

// ============================================================
// Page State
// ============================================================

export type K8sMainTab = 'overview' | 'workloads' | 'networking' | 'storage' | 'security' | 'events' | 'emergency';
export type K8sWorkloadSubTab = 'pods' | 'deployments' | 'daemonsets' | 'statefulsets' | 'jobs' | 'cronjobs';
export type K8sNetworkSubTab = 'services' | 'ingress' | 'networkpolicies';
export type K8sStorageSubTab = 'pv' | 'pvc' | 'configmaps' | 'secrets';
export type K8sSecuritySubTab = 'rbac' | 'audit' | 'pod-security';
export type K8sEventsSubTab = 'events' | 'logs';

export interface K8sPageState {
    currentNamespace: string;
    currentTab: K8sMainTab;
    currentSubTab: string;
    searchTerm: string;
    emergencyMode: boolean;
    autoRefreshEnabled: boolean;
    autoRefreshInterval: number;
}

export interface K8sLogOptions {
    pod: string;
    namespace: string;
    container?: string;
    tailLines?: number;
    sinceSeconds?: number;
    previous?: boolean;
}
