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

