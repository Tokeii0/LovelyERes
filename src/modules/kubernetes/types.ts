export interface K8sResource {
    id: string;
    name: string;
    namespace: string;
    creationTimestamp: string;
    labels: Record<string, string>;
}

export interface K8sPod extends K8sResource {
    status: 'Running' | 'Pending' | 'Failed' | 'Succeeded' | 'Unknown';
    node: string;
    ip: string;
    restarts: number;
    containers: K8sContainer[];
}

export interface K8sContainer {
    name: string;
    image: string;
    ready: boolean;
    restarts: number;
}

export interface K8sDeployment extends K8sResource {
    replicas: number;
    availableReplicas: number;
    updatedReplicas: number;
    conditions: string[];
}

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
}

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
}

export interface K8sClusterStats {
    totalPods: number;
    runningPods: number;
    totalDeployments: number;
    totalServices: number;
    healthyNodes: number;
    totalNodes: number;
    cpuUsage: number; // percentage
    memoryUsage: number; // percentage
}
