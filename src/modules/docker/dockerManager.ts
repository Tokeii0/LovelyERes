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
import { logger } from '../core/logger';

const log = logger.module('DockerManager');

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
      log.error(`SSH 命令失败: ${command}`, e);
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
    // Try --format json first (Docker 23.0+), fallback to Go template
    let result = await this.execSSH('docker images --format json');
    if (!result || result.exit_code !== 0 || !result.output.trim()) {
      result = await this.execSSH('docker images --format "{{json .}}"');
    }
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
    let result = await this.execSSH('docker network ls --format json');
    if (!result || result.exit_code !== 0 || !result.output.trim()) {
      result = await this.execSSH('docker network ls --format "{{json .}}"');
    }
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
    let result = await this.execSSH('docker volume ls --format json');
    if (!result || result.exit_code !== 0 || !result.output.trim()) {
      result = await this.execSSH('docker volume ls --format "{{json .}}"');
    }
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
    let result = await this.execSSH('docker info --format json');
    if (!result || result.exit_code !== 0 || !result.output.trim()) {
      result = await this.execSSH('docker info --format "{{json .}}"');
    }
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
    let result = await this.execSSH('docker system df --format json');
    if (!result || result.exit_code !== 0 || !result.output.trim()) {
      result = await this.execSSH('docker system df --format "{{json .}}"');
    }
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

  /**
   * 取消容器特权模式：停止容器 → 提取配置 → 删除旧容器 → 用相同配置(去除 --privileged)重建
   */
  async removePrivileged(containerRef: string): Promise<{ success: boolean; output: string }> {
    const logs: string[] = [];

    // 1. 获取容器完整配置
    const inspectResult = await this.execSSH(
      `docker inspect ${containerRef} --format '{{json .}}'`
    );
    if (!inspectResult || inspectResult.exit_code !== 0) {
      return { success: false, output: '无法获取容器配置' };
    }

    let config: any;
    try { config = JSON.parse(inspectResult.output); } catch {
      return { success: false, output: '解析容器配置失败' };
    }

    // 确认确实是特权容器
    if (!config.HostConfig?.Privileged) {
      return { success: false, output: '该容器并非特权模式' };
    }

    const image = config.Config?.Image || '';
    const name = config.Name?.replace(/^\//, '') || containerRef;
    if (!image) return { success: false, output: '无法获取容器镜像' };

    // 2. 提取重建所需的参数
    const envArgs = (config.Config?.Env || [])
      .filter((e: string) => !e.startsWith('PATH=') && !e.startsWith('HOME=') && !e.startsWith('HOSTNAME='))
      .map((e: string) => `-e '${e}'`).join(' ');

    const portBindings = config.HostConfig?.PortBindings || {};
    const portArgs = Object.entries(portBindings).map(([containerPort, hostBindings]: [string, any]) => {
      return (hostBindings || []).map((hb: any) => {
        const hostPort = hb.HostPort || '';
        const hostIp = hb.HostIp || '';
        const cp = containerPort.replace('/tcp', '').replace('/udp', '');
        return hostIp ? `-p ${hostIp}:${hostPort}:${cp}` : `-p ${hostPort}:${cp}`;
      }).join(' ');
    }).join(' ');

    const mounts = config.Mounts || [];
    const volumeArgs = mounts.map((m: any) => {
      if (m.Type === 'bind') return `-v ${m.Source}:${m.Destination}${m.RW === false ? ':ro' : ''}`;
      if (m.Type === 'volume') return `-v ${m.Name}:${m.Destination}`;
      return '';
    }).filter(Boolean).join(' ');

    const networkMode = config.HostConfig?.NetworkMode || 'bridge';
    const networkArg = networkMode !== 'default' && networkMode !== 'bridge' ? `--network ${networkMode}` : '';

    const restartPolicy = config.HostConfig?.RestartPolicy?.Name || '';
    const restartArg = restartPolicy && restartPolicy !== 'no' ? `--restart ${restartPolicy}` : '';

    const cmd = config.Config?.Cmd;
    const entrypoint = config.Config?.Entrypoint;
    const cmdStr = cmd && cmd.length > 0 ? cmd.map((c: string) => `'${c}'`).join(' ') : '';
    const entrypointArg = entrypoint && entrypoint.length > 0
      ? `--entrypoint '${entrypoint.join(' ')}'` : '';

    const workdir = config.Config?.WorkingDir;
    const workdirArg = workdir ? `-w ${workdir}` : '';

    // 3. 停止并删除旧容器
    logs.push(`[1/3] 停止容器 ${name}...`);
    const stopResult = await this.execSSH(`docker stop ${name} --time 10`);
    if (stopResult?.exit_code !== 0) {
      // 强制停止
      await this.execSSH(`docker kill ${name}`);
    }
    logs.push(`[2/3] 删除旧容器...`);
    const rmResult = await this.execSSH(`docker rm ${name}`);
    if (rmResult?.exit_code !== 0) {
      logs.push(`删除失败: ${rmResult?.output || 'unknown'}`);
      return { success: false, output: logs.join('\n') };
    }

    // 4. 用相同配置重建(去除 --privileged, 加 --security-opt=no-new-privileges)
    const runCmd = [
      'docker run -d',
      `--name ${name}`,
      '--security-opt=no-new-privileges:true',
      networkArg,
      restartArg,
      workdirArg,
      portArgs,
      volumeArgs,
      envArgs,
      entrypointArg,
      image,
      cmdStr,
    ].filter(Boolean).join(' ');

    logs.push(`[3/3] 重建容器(非特权)...`);
    logs.push(`命令: ${runCmd}`);

    const runResult = await this.execSSH(runCmd);
    if (runResult?.exit_code !== 0) {
      logs.push(`重建失败: ${runResult?.output || 'unknown'}`);
      // 尝试恢复: 用原始配置重建
      logs.push('尝试恢复原容器...');
      const recoverCmd = runCmd.replace('--security-opt=no-new-privileges:true', '--privileged');
      await this.execSSH(recoverCmd);
      return { success: false, output: logs.join('\n') };
    }

    logs.push(`✓ 容器 ${name} 已重建为非特权模式`);
    return { success: true, output: logs.join('\n') };
  }

  async disconnectAllNetworks(containerRef: string): Promise<{ success: boolean; output: string }> {
    const networks = await this.execSSH(
      `docker inspect ${containerRef} --format "{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}"`
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
