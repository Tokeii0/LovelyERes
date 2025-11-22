import { K8sPod, K8sDeployment, K8sService, K8sNode, K8sClusterStats } from './types';

export class KubernetesManager {
    private mockPods: K8sPod[] = [];
    private mockDeployments: K8sDeployment[] = [];
    private mockServices: K8sService[] = [];
    private mockNodes: K8sNode[] = [];

    constructor() {
        this.initializeMockData();
    }

    private initializeMockData() {
        // Mock Nodes
        this.mockNodes = [
            {
                name: 'node-1',
                status: 'Ready',
                roles: ['control-plane', 'master'],
                version: 'v1.26.3',
                addresses: [{ type: 'InternalIP', address: '192.168.1.10' }],
                capacity: { cpu: '4', memory: '8Gi', pods: '110' },
                allocatable: { cpu: '3.8', memory: '7.5Gi', pods: '110' }
            },
            {
                name: 'node-2',
                status: 'Ready',
                roles: ['worker'],
                version: 'v1.26.3',
                addresses: [{ type: 'InternalIP', address: '192.168.1.11' }],
                capacity: { cpu: '8', memory: '16Gi', pods: '110' },
                allocatable: { cpu: '7.6', memory: '15Gi', pods: '110' }
            },
            {
                name: 'node-3',
                status: 'Ready',
                roles: ['worker'],
                version: 'v1.26.3',
                addresses: [{ type: 'InternalIP', address: '192.168.1.12' }],
                capacity: { cpu: '8', memory: '16Gi', pods: '110' },
                allocatable: { cpu: '7.6', memory: '15Gi', pods: '110' }
            }
        ];

        // Mock Deployments
        this.mockDeployments = [
            {
                id: 'd-1',
                name: 'nginx-deployment',
                namespace: 'default',
                creationTimestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
                labels: { app: 'nginx' },
                replicas: 3,
                availableReplicas: 3,
                updatedReplicas: 3,
                conditions: ['Available', 'Progressing']
            },
            {
                id: 'd-2',
                name: 'redis-cache',
                namespace: 'default',
                creationTimestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
                labels: { app: 'redis' },
                replicas: 1,
                availableReplicas: 1,
                updatedReplicas: 1,
                conditions: ['Available']
            },
            {
                id: 'd-3',
                name: 'backend-api',
                namespace: 'production',
                creationTimestamp: new Date(Date.now() - 86400000 * 10).toISOString(),
                labels: { app: 'backend', tier: 'api' },
                replicas: 5,
                availableReplicas: 4,
                updatedReplicas: 5,
                conditions: ['Available', 'ReplicaFailure']
            }
        ];

        // Mock Pods
        this.mockPods = [
            {
                id: 'p-1',
                name: 'nginx-deployment-5c68f8c-abcde',
                namespace: 'default',
                creationTimestamp: new Date(Date.now() - 3600000).toISOString(),
                labels: { app: 'nginx' },
                status: 'Running',
                node: 'node-2',
                ip: '10.244.1.5',
                restarts: 0,
                containers: [{ name: 'nginx', image: 'nginx:1.21', ready: true, restarts: 0 }]
            },
            {
                id: 'p-2',
                name: 'nginx-deployment-5c68f8c-fghij',
                namespace: 'default',
                creationTimestamp: new Date(Date.now() - 3500000).toISOString(),
                labels: { app: 'nginx' },
                status: 'Running',
                node: 'node-3',
                ip: '10.244.2.8',
                restarts: 1,
                containers: [{ name: 'nginx', image: 'nginx:1.21', ready: true, restarts: 1 }]
            },
            {
                id: 'p-3',
                name: 'nginx-deployment-5c68f8c-klmno',
                namespace: 'default',
                creationTimestamp: new Date(Date.now() - 3400000).toISOString(),
                labels: { app: 'nginx' },
                status: 'Running',
                node: 'node-2',
                ip: '10.244.1.6',
                restarts: 0,
                containers: [{ name: 'nginx', image: 'nginx:1.21', ready: true, restarts: 0 }]
            },
            {
                id: 'p-4',
                name: 'redis-cache-7d9cf9b-xyz12',
                namespace: 'default',
                creationTimestamp: new Date(Date.now() - 7200000).toISOString(),
                labels: { app: 'redis' },
                status: 'Running',
                node: 'node-3',
                ip: '10.244.2.3',
                restarts: 0,
                containers: [{ name: 'redis', image: 'redis:6.2', ready: true, restarts: 0 }]
            },
            {
                id: 'p-5',
                name: 'backend-api-8e2ad1-99887',
                namespace: 'production',
                creationTimestamp: new Date(Date.now() - 1800000).toISOString(),
                labels: { app: 'backend' },
                status: 'Pending',
                node: 'node-2',
                ip: '',
                restarts: 0,
                containers: [{ name: 'api', image: 'my-app/api:v2', ready: false, restarts: 0 }]
            }
        ];

        // Mock Services
        this.mockServices = [
            {
                id: 's-1',
                name: 'nginx-service',
                namespace: 'default',
                creationTimestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
                labels: { app: 'nginx' },
                type: 'LoadBalancer',
                clusterIP: '10.96.0.10',
                externalIPs: ['203.0.113.5'],
                ports: [{ name: 'http', port: 80, targetPort: 80, protocol: 'TCP' }]
            },
            {
                id: 's-2',
                name: 'redis-internal',
                namespace: 'default',
                creationTimestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
                labels: { app: 'redis' },
                type: 'ClusterIP',
                clusterIP: '10.96.0.15',
                externalIPs: [],
                ports: [{ name: 'redis', port: 6379, targetPort: 6379, protocol: 'TCP' }]
            },
            {
                id: 's-3',
                name: 'backend-api-svc',
                namespace: 'production',
                creationTimestamp: new Date(Date.now() - 86400000 * 10).toISOString(),
                labels: { app: 'backend' },
                type: 'NodePort',
                clusterIP: '10.96.0.20',
                externalIPs: [],
                ports: [{ name: 'http', port: 8080, targetPort: 8080, protocol: 'TCP' }]
            }
        ];
    }

    public async getPods(namespace?: string): Promise<K8sPod[]> {
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 300));
        if (namespace) {
            return this.mockPods.filter(p => p.namespace === namespace);
        }
        return this.mockPods;
    }

    public async getDeployments(namespace?: string): Promise<K8sDeployment[]> {
        await new Promise(resolve => setTimeout(resolve, 300));
        if (namespace) {
            return this.mockDeployments.filter(d => d.namespace === namespace);
        }
        return this.mockDeployments;
    }

    public async getServices(namespace?: string): Promise<K8sService[]> {
        await new Promise(resolve => setTimeout(resolve, 300));
        if (namespace) {
            return this.mockServices.filter(s => s.namespace === namespace);
        }
        return this.mockServices;
    }

    public async getNodes(): Promise<K8sNode[]> {
        await new Promise(resolve => setTimeout(resolve, 300));
        return this.mockNodes;
    }

    public async getClusterStats(): Promise<K8sClusterStats> {
        await new Promise(resolve => setTimeout(resolve, 300));
        const nodes = this.mockNodes;
        const pods = this.mockPods;
        
        return {
            totalPods: pods.length,
            runningPods: pods.filter(p => p.status === 'Running').length,
            totalDeployments: this.mockDeployments.length,
            totalServices: this.mockServices.length,
            totalNodes: nodes.length,
            healthyNodes: nodes.filter(n => n.status === 'Ready').length,
            cpuUsage: 45, // Mock
            memoryUsage: 62 // Mock
        };
    }
}
