// ============================================================
// Docker Core Types
// ============================================================

export interface DockerPortMapping {
  ip?: string;
  privatePort: string;
  publicPort?: string;
  protocol: string;
}

export interface DockerNetworkAttachment {
  name: string;
  networkId?: string;
  endpointId?: string;
  macAddress?: string;
  ipv4Address?: string;
  ipv6Address?: string;
}

export interface DockerMountInfo {
  mountType: string;
  source?: string;
  destination: string;
  mode?: string;
  rw: boolean;
}

export interface DockerQuickCheck {
  networkAttached: boolean;
  privileged: boolean;
  health?: string;
}

export interface DockerStatsSnapshot {
  cpuPercent?: number;
  memoryUsage?: string;
  memoryPercent?: number;
  netIo?: string;
  blockIo?: string;
  pids?: number;
}

export interface DockerContainerSummary {
  id: string;
  shortId: string;
  name: string;
  image: string;
  state: string;
  status: string;
  createdAt: string;
  uptime?: string;
  command?: string;
  ports: DockerPortMapping[];
  cpuPercent?: number;
  memoryUsage?: string;
  memoryPercent?: number;
  netIo?: string;
  blockIo?: string;
  pids?: number;
  networkMode?: string;
  networks: DockerNetworkAttachment[];
  mounts: DockerMountInfo[];
  quickChecks: DockerQuickCheck;
}

export interface DockerActionResult {
  success: boolean;
  message: string;
  updatedState?: string | null;
  updatedStatus?: string | null;
}

export interface DockerLogsOptions {
  tail?: number;
  since?: string;
  timestamps?: boolean;
  stdout?: boolean;
  stderr?: boolean;
}

export type DockerCopyDirection = 'container-to-host' | 'host-to-container' | 'in-container';

export interface DockerCopyRequest {
  direction: DockerCopyDirection;
  source: string;
  target: string;
}

// ============================================================
// Docker Image Types
// ============================================================

export interface DockerImage {
  id: string;
  shortId: string;
  repository: string;
  tag: string;
  size: string;
  created: string;
  containers: number;
}

// ============================================================
// Docker Network Types
// ============================================================

export interface DockerNetwork {
  id: string;
  shortId: string;
  name: string;
  driver: string;
  scope: string;
  ipam: string;
  containers: number;
  internal: boolean;
}

// ============================================================
// Docker Volume Types
// ============================================================

export interface DockerVolume {
  name: string;
  driver: string;
  mountpoint: string;
  scope: string;
  labels: Record<string, string>;
  usedBy: string[];
}

// ============================================================
// Docker Compose Types
// ============================================================

export interface DockerComposeProject {
  name: string;
  status: string;
  configFiles: string;
  services: number;
  running: number;
  stopped: number;
}

export interface DockerComposeService {
  name: string;
  project: string;
  status: string;
  image: string;
  ports: string;
  replicas: string;
}

// ============================================================
// Docker System Types
// ============================================================

export interface DockerSystemInfo {
  serverVersion: string;
  apiVersion: string;
  storageDriver: string;
  totalContainers: number;
  runningContainers: number;
  pausedContainers: number;
  stoppedContainers: number;
  totalImages: number;
  totalMemory: string;
  cpus: number;
  rootDir: string;
  runtimeName: string;
}

export interface DockerDiskUsage {
  images: { totalCount: number; totalSize: string; reclaimable: string };
  containers: { totalCount: number; totalSize: string; reclaimable: string };
  volumes: { totalCount: number; totalSize: string; reclaimable: string };
  buildCache: { totalSize: string; reclaimable: string };
}

// ============================================================
// Docker Stats (for Overview)
// ============================================================

export interface DockerOverviewStats {
  totalContainers: number;
  runningContainers: number;
  stoppedContainers: number;
  pausedContainers: number;
  totalImages: number;
  totalNetworks: number;
  totalVolumes: number;
  privilegedContainers: number;
  unhealthyContainers: number;
  totalCpuPercent: number;
  totalMemoryPercent: number;
}

// ============================================================
// Docker Security Types
// ============================================================

export type DockerSecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface DockerSecurityFinding {
  id: string;
  severity: DockerSecuritySeverity;
  category: 'privileged' | 'capabilities' | 'network' | 'mount' | 'image' | 'rootUser' | 'resourceLimits' | 'secrets';
  container: string;
  description: string;
  remediation: string;
}

export interface DockerSecurityAuditResult {
  timestamp: string;
  duration: number;
  findings: DockerSecurityFinding[];
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
// Docker Emergency Types
// ============================================================

export type DockerEmergencyActionType = 'stop' | 'kill' | 'pause' | 'disconnect_network' | 'remove' | 'rollback';

export interface DockerEmergencyAction {
  id: string;
  type: DockerEmergencyActionType;
  target: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  timestamp: string;
  rollbackCommand: string;
  result?: string;
  error?: string;
}

export interface DockerForensicReport {
  containerName: string;
  containerId: string;
  timestamp: string;
  inspect: string;
  logs: string;
  processes: string;
  diff: string;
  envVars: string;
  networkSettings: string;
  mounts: string;
}

// ============================================================
// Docker Page State
// ============================================================

export type DockerMainTab = 'overview' | 'containers' | 'images' | 'networks' | 'volumes' | 'compose' | 'security';

export interface DockerPageState {
  currentTab: DockerMainTab;
  searchTerm: string;
  autoRefreshEnabled: boolean;
  autoRefreshInterval: number;
  emergencyMode: boolean;
}
