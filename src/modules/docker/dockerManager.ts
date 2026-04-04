import { invoke } from '@tauri-apps/api/core';
import type {
  DockerActionResult,
  DockerContainerSummary,
  DockerCopyRequest,
  DockerLogsOptions,
  DockerImage,
  DockerNetwork,
  DockerVolume,
  DockerComposeProject,
  DockerSystemInfo,
  DockerDiskUsage,
  DockerOverviewStats,
} from './types';
import { sshConnectionManager } from '../remote/sshConnectionManager';

type DockerContainerAction = 'start' | 'stop' | 'restart' | 'kill' | 'pause' | 'unpause';

export class DockerManager {
  private containers: DockerContainerSummary[] = [];

  // ============================================================
  // SSH Command Helper
  // ============================================================

  private async execSSH(command: string): Promise<{ output: string; exit_code: number } | null> {
    if (!sshConnectionManager.isConnected()) return null;
    try {
      return await (window as any).__TAURI__.core.invoke('ssh_execute_dashboard_command_direct', { command });
    } catch (e) {
      console.error(`Docker SSH command failed: ${command}`, e);
      return null;
    }
  }

  // ============================================================
  // Container Operations (existing, via Tauri invoke)
  // ============================================================

  getCachedContainers(): DockerContainerSummary[] {
    return [...this.containers];
  }

  async listContainers(): Promise<DockerContainerSummary[]> {
    const containers = await invoke<DockerContainerSummary[]>('docker_list_containers');
    this.containers = containers;
    return [...containers];
  }

  async performAction(containerRef: string, action: DockerContainerAction): Promise<DockerActionResult> {
    return invoke<DockerActionResult>('docker_container_action', {
      containerId: containerRef,
      action,
    });
  }

  async getLogs(containerRef: string, options?: Partial<DockerLogsOptions>): Promise<string> {
    const payload: DockerLogsOptions | undefined = options
      ? {
          tail: options.tail,
          since: options.since,
          timestamps: options.timestamps ?? false,
          stdout: options.stdout ?? true,
          stderr: options.stderr ?? true,
        }
      : undefined;

    return invoke<string>('docker_container_logs', {
      containerId: containerRef,
      options: payload,
    });
  }

  async inspect(containerRef: string): Promise<unknown> {
    return invoke('docker_inspect_container', { containerId: containerRef });
  }

  async readFile(containerRef: string, path: string): Promise<string> {
    return invoke<string>('docker_read_container_file', { containerId: containerRef, path });
  }

  async execCommand(containerRef: string, command: string): Promise<any> {
    return invoke('docker_exec_command', { containerId: containerRef, command });
  }

  async createContainerTerminalWindow(containerName: string, containerId: string): Promise<string> {
    return invoke<string>('create_container_terminal_window', { containerName, containerId });
  }

  async writeFile(containerRef: string, path: string, content: string): Promise<DockerActionResult> {
    return invoke<DockerActionResult>('docker_write_container_file', { containerId: containerRef, path, content });
  }

  async copy(containerRef: string, request: DockerCopyRequest): Promise<DockerActionResult> {
    return invoke<DockerActionResult>('docker_copy', { containerId: containerRef, request });
  }

  // ============================================================
  // Image Operations (via SSH)
  // ============================================================

  async listImages(): Promise<DockerImage[]> {
    const result = await this.execSSH('docker images --format \'{{json .}}\'');
    if (!result || result.exit_code !== 0) return [];

    return result.output.trim().split('\n').filter(Boolean).map(line => {
      try {
        const img = JSON.parse(line);
        return {
          id: img.ID || '',
          shortId: (img.ID || '').substring(0, 12),
          repository: img.Repository || '<none>',
          tag: img.Tag || '<none>',
          size: img.Size || '',
          created: img.CreatedSince || img.CreatedAt || '',
          containers: 0
        };
      } catch { return null; }
    }).filter(Boolean) as DockerImage[];
  }

  async removeImage(imageRef: string, force: boolean = false): Promise<{ success: boolean; output: string }> {
    const cmd = force ? `docker rmi -f ${imageRef}` : `docker rmi ${imageRef}`;
    const result = await this.execSSH(cmd);
    return { success: result?.exit_code === 0, output: result?.output || '' };
  }

  async pullImage(imageName: string): Promise<{ success: boolean; output: string }> {
    const result = await this.execSSH(`docker pull ${imageName}`);
    return { success: result?.exit_code === 0, output: result?.output || '' };
  }

  async pruneImages(): Promise<{ success: boolean; output: string }> {
    const result = await this.execSSH('docker image prune -f');
    return { success: result?.exit_code === 0, output: result?.output || '' };
  }

  // ============================================================
  // Network Operations (via SSH)
  // ============================================================

  async listNetworks(): Promise<DockerNetwork[]> {
    const result = await this.execSSH('docker network ls --format \'{{json .}}\'');
    if (!result || result.exit_code !== 0) return [];

    return result.output.trim().split('\n').filter(Boolean).map(line => {
      try {
        const net = JSON.parse(line);
        return {
          id: net.ID || '',
          shortId: (net.ID || '').substring(0, 12),
          name: net.Name || '',
          driver: net.Driver || '',
          scope: net.Scope || '',
          ipam: '',
          containers: 0,
          internal: net.Internal === 'true'
        };
      } catch { return null; }
    }).filter(Boolean) as DockerNetwork[];
  }

  async inspectNetwork(networkRef: string): Promise<string> {
    const result = await this.execSSH(`docker network inspect ${networkRef}`);
    return result?.output || '';
  }

  async removeNetwork(networkRef: string): Promise<{ success: boolean; output: string }> {
    const result = await this.execSSH(`docker network rm ${networkRef}`);
    return { success: result?.exit_code === 0, output: result?.output || '' };
  }

  async disconnectContainer(networkRef: string, containerRef: string): Promise<{ success: boolean; output: string }> {
    const result = await this.execSSH(`docker network disconnect ${networkRef} ${containerRef}`);
    return { success: result?.exit_code === 0, output: result?.output || '' };
  }

  async pruneNetworks(): Promise<{ success: boolean; output: string }> {
    const result = await this.execSSH('docker network prune -f');
    return { success: result?.exit_code === 0, output: result?.output || '' };
  }

  // ============================================================
  // Volume Operations (via SSH)
  // ============================================================

  async listVolumes(): Promise<DockerVolume[]> {
    const result = await this.execSSH('docker volume ls --format \'{{json .}}\'');
    if (!result || result.exit_code !== 0) return [];

    return result.output.trim().split('\n').filter(Boolean).map(line => {
      try {
        const vol = JSON.parse(line);
        return {
          name: vol.Name || '',
          driver: vol.Driver || 'local',
          mountpoint: vol.Mountpoint || '',
          scope: vol.Scope || 'local',
          labels: {},
          usedBy: []
        };
      } catch { return null; }
    }).filter(Boolean) as DockerVolume[];
  }

  async removeVolume(volumeRef: string, force: boolean = false): Promise<{ success: boolean; output: string }> {
    const cmd = force ? `docker volume rm -f ${volumeRef}` : `docker volume rm ${volumeRef}`;
    const result = await this.execSSH(cmd);
    return { success: result?.exit_code === 0, output: result?.output || '' };
  }

  async pruneVolumes(): Promise<{ success: boolean; output: string }> {
    const result = await this.execSSH('docker volume prune -f');
    return { success: result?.exit_code === 0, output: result?.output || '' };
  }

  // ============================================================
  // Compose Operations (via SSH)
  // ============================================================

  async listComposeProjects(): Promise<DockerComposeProject[]> {
    const result = await this.execSSH('docker compose ls --format json 2>/dev/null || echo "[]"');
    if (!result || result.exit_code !== 0) return [];

    try {
      const projects = JSON.parse(result.output);
      if (!Array.isArray(projects)) return [];
      return projects.map((p: any) => ({
        name: p.Name || '',
        status: p.Status || '',
        configFiles: p.ConfigFiles || '',
        services: 0,
        running: (p.Status || '').match(/running\((\d+)\)/)?.[1] ? parseInt((p.Status || '').match(/running\((\d+)\)/)[1]) : 0,
        stopped: 0
      }));
    } catch { return []; }
  }

  async composeAction(projectPath: string, action: 'up' | 'down' | 'restart' | 'stop' | 'pull'): Promise<{ success: boolean; output: string }> {
    let cmd = `docker compose -f ${projectPath}`;
    switch (action) {
      case 'up': cmd += ' up -d'; break;
      case 'down': cmd += ' down'; break;
      case 'restart': cmd += ' restart'; break;
      case 'stop': cmd += ' stop'; break;
      case 'pull': cmd += ' pull'; break;
    }
    const result = await this.execSSH(cmd);
    return { success: result?.exit_code === 0, output: result?.output || '' };
  }

  // ============================================================
  // System Info (via SSH)
  // ============================================================

  async getSystemInfo(): Promise<DockerSystemInfo | null> {
    const result = await this.execSSH('docker info --format \'{{json .}}\'');
    if (!result || result.exit_code !== 0) return null;

    try {
      const info = JSON.parse(result.output);
      return {
        serverVersion: info.ServerVersion || '',
        apiVersion: info.ClientInfo?.ApiVersion || '',
        storageDriver: info.Driver || '',
        totalContainers: info.Containers || 0,
        runningContainers: info.ContainersRunning || 0,
        pausedContainers: info.ContainersPaused || 0,
        stoppedContainers: info.ContainersStopped || 0,
        totalImages: info.Images || 0,
        totalMemory: info.MemTotal ? `${Math.round(info.MemTotal / 1073741824)}GB` : '',
        cpus: info.NCPU || 0,
        rootDir: info.DockerRootDir || '',
        runtimeName: info.DefaultRuntime || 'runc'
      };
    } catch { return null; }
  }

  async getDiskUsage(): Promise<DockerDiskUsage | null> {
    const result = await this.execSSH('docker system df --format \'{{json .}}\'');
    if (!result || result.exit_code !== 0) return null;

    try {
      const lines = result.output.trim().split('\n').filter(Boolean);
      const usage: DockerDiskUsage = {
        images: { totalCount: 0, totalSize: '0B', reclaimable: '0B' },
        containers: { totalCount: 0, totalSize: '0B', reclaimable: '0B' },
        volumes: { totalCount: 0, totalSize: '0B', reclaimable: '0B' },
        buildCache: { totalSize: '0B', reclaimable: '0B' }
      };
      for (const line of lines) {
        try {
          const item = JSON.parse(line);
          const type = (item.Type || '').toLowerCase();
          const entry = { totalCount: item.TotalCount || 0, totalSize: item.Size || '0B', reclaimable: item.Reclaimable || '0B' };
          if (type.includes('image')) usage.images = entry;
          else if (type.includes('container')) usage.containers = entry;
          else if (type.includes('volume')) usage.volumes = entry;
          else if (type.includes('build')) usage.buildCache = { totalSize: item.Size || '0B', reclaimable: item.Reclaimable || '0B' };
        } catch {}
      }
      return usage;
    } catch { return null; }
  }

  async systemPrune(all: boolean = false): Promise<{ success: boolean; output: string }> {
    const cmd = all ? 'docker system prune -af' : 'docker system prune -f';
    const result = await this.execSSH(cmd);
    return { success: result?.exit_code === 0, output: result?.output || '' };
  }

  // ============================================================
  // Overview Stats
  // ============================================================

  async getOverviewStats(): Promise<DockerOverviewStats> {
    const [containers, images, networks, volumes] = await Promise.all([
      this.listContainers(),
      this.listImages(),
      this.listNetworks(),
      this.listVolumes()
    ]);

    const running = containers.filter(c => c.state === 'running');
    const privileged = containers.filter(c => c.quickChecks?.privileged);
    const unhealthy = containers.filter(c => c.quickChecks?.health === 'unhealthy');

    let totalCpu = 0;
    let totalMem = 0;
    running.forEach(c => {
      totalCpu += c.cpuPercent || 0;
      totalMem += c.memoryPercent || 0;
    });

    return {
      totalContainers: containers.length,
      runningContainers: running.length,
      stoppedContainers: containers.filter(c => c.state === 'exited' || c.state === 'dead').length,
      pausedContainers: containers.filter(c => c.state === 'paused').length,
      totalImages: images.length,
      totalNetworks: networks.length,
      totalVolumes: volumes.length,
      privilegedContainers: privileged.length,
      unhealthyContainers: unhealthy.length,
      totalCpuPercent: Math.round(totalCpu * 10) / 10,
      totalMemoryPercent: Math.round(totalMem * 10) / 10
    };
  }

  // ============================================================
  // Forensic / Emergency
  // ============================================================

  async getContainerProcesses(containerRef: string): Promise<string> {
    const result = await this.execSSH(`docker top ${containerRef}`);
    return result?.output || '';
  }

  async getContainerDiff(containerRef: string): Promise<string> {
    const result = await this.execSSH(`docker diff ${containerRef}`);
    return result?.output || '';
  }

  async getContainerEnv(containerRef: string): Promise<string> {
    const result = await this.execSSH(`docker exec ${containerRef} env 2>/dev/null`);
    return result?.output || '';
  }

  async disconnectAllNetworks(containerRef: string): Promise<{ success: boolean; output: string }> {
    const networks = await this.execSSH(
      `docker inspect ${containerRef} --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}'`
    );
    if (!networks || !networks.output.trim()) {
      return { success: false, output: 'No networks found' };
    }

    const netNames = networks.output.trim().split(/\s+/).filter(Boolean);
    const results: string[] = [];
    for (const net of netNames) {
      if (net === 'bridge' || net === 'host' || net === 'none') continue;
      const r = await this.execSSH(`docker network disconnect ${net} ${containerRef}`);
      results.push(`${net}: ${r?.exit_code === 0 ? 'disconnected' : 'failed'}`);
    }
    return { success: true, output: results.join('\n') };
  }
}

export const dockerManager = new DockerManager();
