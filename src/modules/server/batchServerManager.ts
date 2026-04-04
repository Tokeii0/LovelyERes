/**
 * 多服务器批量管理器
 * 在多台服务器上批量执行命令、收集结果
 */

import { invoke } from '@tauri-apps/api/core';
import { SSHConfigManager, type SSHConnection } from '../ssh/connectionManager';
import { eventBus } from '../core/eventBus';

// ========== 类型 ==========

export interface BatchTask {
  id: string;
  name: string;
  command: string;
  targets: string[];        // 连接 ID 列表
  status: 'pending' | 'running' | 'completed' | 'cancelled';
  results: BatchResult[];
  createdAt: Date;
  completedAt?: Date;
}

export interface BatchResult {
  connectionId: string;
  serverName: string;
  host: string;
  status: 'success' | 'failed' | 'skipped';
  output: string;
  error?: string;
  duration: number;         // ms
}

export interface BatchProgress {
  taskId: string;
  totalServers: number;
  completedServers: number;
  currentServer: string;
  percent: number;
}

// ========== 批量管理器 ==========

export class BatchServerManager {
  private connectionManager: SSHConfigManager;
  private taskHistory: BatchTask[] = [];
  private activeTask: BatchTask | null = null;
  private cancelled = false;

  constructor(connectionManager: SSHConfigManager) {
    this.connectionManager = connectionManager;
    this.loadHistory();
  }

  /** 获取所有可用的服务器 */
  getAvailableServers(): SSHConnection[] {
    return this.connectionManager.getConnections();
  }

  /** 获取任务历史 */
  getHistory(): BatchTask[] {
    return [...this.taskHistory];
  }

  /** 获取当前活动任务 */
  getActiveTask(): BatchTask | null {
    return this.activeTask;
  }

  /**
   * 在多台服务器上批量执行命令
   */
  async executeBatch(
    name: string,
    command: string,
    targetIds: string[],
    onProgress?: (p: BatchProgress) => void,
  ): Promise<BatchTask> {
    if (this.activeTask?.status === 'running') {
      throw new Error('已有批量任务正在运行');
    }

    this.cancelled = false;

    const task: BatchTask = {
      id: `batch-${Date.now()}`,
      name,
      command,
      targets: targetIds,
      status: 'running',
      results: [],
      createdAt: new Date(),
    };

    this.activeTask = task;

    // 保存当前连接状态，任务结束后恢复
    const activeConn = this.connectionManager.getActiveConnection();
    const activeConnId = activeConn?.id;

    try {
      for (let i = 0; i < targetIds.length; i++) {
        if (this.cancelled) {
          task.status = 'cancelled';
          break;
        }

        const connId = targetIds[i];
        const conn = this.connectionManager.getConnection(connId);
        if (!conn) {
          task.results.push({
            connectionId: connId,
            serverName: '未知',
            host: '未知',
            status: 'skipped',
            output: '',
            error: '连接配置不存在',
            duration: 0,
          });
          continue;
        }

        onProgress?.({
          taskId: task.id,
          totalServers: targetIds.length,
          completedServers: i,
          currentServer: conn.name,
          percent: Math.round((i / targetIds.length) * 100),
        });

        const result = await this.executeOnServer(conn, command);
        task.results.push(result);
      }

      if (task.status !== 'cancelled') {
        task.status = 'completed';
      }
      task.completedAt = new Date();

      onProgress?.({
        taskId: task.id,
        totalServers: targetIds.length,
        completedServers: targetIds.length,
        currentServer: '完成',
        percent: 100,
      });
    } catch (e: any) {
      task.status = 'completed';
      task.completedAt = new Date();
    }

    // 恢复原始连接
    if (activeConnId) {
      try {
        await this.connectionManager.connect(activeConnId);
      } catch { /* best effort */ }
    }

    // 保存到历史
    this.taskHistory.push(task);
    if (this.taskHistory.length > 50) this.taskHistory.shift();
    this.saveHistory();
    this.activeTask = null;

    eventBus.emit('notification', {
      type: task.status === 'completed' ? 'success' : 'warning',
      message: `批量任务「${name}」${task.status === 'completed' ? '完成' : '已取消'}`,
      title: '批量执行',
    });

    return task;
  }

  /** 取消当前任务 */
  cancelBatch(): void {
    this.cancelled = true;
  }

  // ========== 内部方法 ==========

  /**
   * 在单台服务器上执行命令
   * 使用 ssh_connect_direct / ssh_execute_command_direct / ssh_disconnect_direct
   * 独立于主连接，不影响当前活动连接
   */
  private async executeOnServer(conn: SSHConnection, command: string): Promise<BatchResult> {
    const start = Date.now();
    try {
      // 解密密码
      let password: string | undefined;
      if (conn.authType === 'password' && conn.encryptedPassword) {
        password = await invoke('decrypt_password', {
          encryptedPassword: conn.encryptedPassword,
        }) as string;
      }

      // 使用独立连接：connect_direct
      await invoke('ssh_connect_direct', {
        host: conn.host,
        port: conn.port,
        username: conn.username,
        password,
        keyPath: conn.keyPath || null,
      });

      // 执行命令
      const result: any = await invoke('ssh_execute_command_direct', { command });

      // 断开
      try { await invoke('ssh_disconnect_direct'); } catch { /* ignore */ }

      return {
        connectionId: conn.id,
        serverName: conn.name,
        host: conn.host,
        status: 'success',
        output: result?.output || '',
        duration: Date.now() - start,
      };
    } catch (e: any) {
      // 断开（清理）
      try { await invoke('ssh_disconnect_direct'); } catch { /* ignore */ }

      return {
        connectionId: conn.id,
        serverName: conn.name,
        host: conn.host,
        status: 'failed',
        output: '',
        error: String(e),
        duration: Date.now() - start,
      };
    }
  }

  // ========== 持久化 ==========

  private saveHistory(): void {
    try {
      const data = this.taskHistory.slice(-20);
      localStorage.setItem('lovelyres-batch-history', JSON.stringify(data));
    } catch { /* ignore */ }
  }

  private loadHistory(): void {
    try {
      const raw = localStorage.getItem('lovelyres-batch-history');
      if (raw) this.taskHistory = JSON.parse(raw);
    } catch { /* ignore */ }
  }

  /**
   * 导出批量任务结果为 CSV
   */
  exportTaskAsCSV(task: BatchTask): void {
    const header = '服务器,主机,状态,耗时(s),输出,错误\n';
    const rows = task.results.map(r =>
      `"${r.serverName}","${r.host}","${r.status}","${(r.duration / 1000).toFixed(1)}","${(r.output || '').replace(/"/g, '""').slice(0, 500)}","${(r.error || '').replace(/"/g, '""')}"`
    ).join('\n');

    const csv = '\uFEFF' + header + rows; // BOM for Excel
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch-${task.id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
