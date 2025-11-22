import { invoke } from '@tauri-apps/api/core';
import type {
  DockerActionResult,
  DockerContainerSummary,
  DockerCopyRequest,
  DockerLogsOptions,
} from './types';

type DockerContainerAction = 'start' | 'stop' | 'restart' | 'kill' | 'pause' | 'unpause';

export class DockerManager {
  private containers: DockerContainerSummary[] = [];

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
    return invoke('docker_inspect_container', {
      containerId: containerRef,
    });
  }

  async readFile(containerRef: string, path: string): Promise<string> {
    return invoke<string>('docker_read_container_file', {
      containerId: containerRef,
      path,
    });
  }

  async execCommand(containerRef: string, command: string): Promise<any> {
    return invoke('docker_exec_command', {
      containerId: containerRef,
      command,
    });
  }

  async createContainerTerminalWindow(containerName: string, containerId: string): Promise<string> {
    return invoke<string>('create_container_terminal_window', {
      containerName,
      containerId,
    });
  }

  async writeFile(containerRef: string, path: string, content: string): Promise<DockerActionResult> {
    return invoke<DockerActionResult>('docker_write_container_file', {
      containerId: containerRef,
      path,
      content,
    });
  }

  async copy(containerRef: string, request: DockerCopyRequest): Promise<DockerActionResult> {
    return invoke<DockerActionResult>('docker_copy', {
      containerId: containerRef,
      request,
    });
  }
}

export const dockerManager = new DockerManager();
