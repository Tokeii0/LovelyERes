/**
 * SSH连接管理器
 * 处理实际的SSH连接操作和状态管理
 * 与ssh/connectionManager.ts协同工作
 */

import { SSHConfigManager as ConfigManager } from '../ssh/connectionManager';

export interface SSHConnectionInfo {
  id?: string; // 连接配置ID
  host: string;
  port: number;
  username: string;
  connected: boolean;
  lastActivity?: Date;
}

export class SSHSessionManager {
  private connectionStatus: SSHConnectionInfo | null = null;
  private listeners: Array<(status: SSHConnectionInfo | null) => void> = [];
  private configManager: ConfigManager;

  constructor() {
    this.configManager = new ConfigManager();
  }

  /**
   * 获取当前连接状态
   */
  getConnectionStatus(): SSHConnectionInfo | null {
    return this.connectionStatus;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connectionStatus?.connected || false;
  }

  /**
   * 获取当前连接的ID
   */
  getCurrentConnectionId(): string | undefined {
    return this.connectionStatus?.id;
  }

  /**
   * 手动设置连接状态（用于同步主界面连接状态）
   */
  setConnectionStatus(status: SSHConnectionInfo | null): void {
    this.connectionStatus = status;
    this.notifyListeners();
  }

  /**
   * 建立SSH连接
   */
  async connect(host: string, port: number, username: string, password: string): Promise<void> {
    try {
      console.log('📞 [sshConnectionManager] connect 方法被调用');
      console.log('  参数详情:', {
        host,
        port,
        portType: typeof port,
        portValue: port,
        username,
        passwordLength: password?.length || 0
      });

      // 确保端口是数字类型
      const portNumber = typeof port === 'string' ? parseInt(port, 10) : port;
      if (isNaN(portNumber) || portNumber <= 0 || portNumber > 65535) {
        throw new Error(`无效的端口号: ${port} (类型: ${typeof port})`);
      }

      console.log('  转换后的端口:', portNumber, typeof portNumber);

      // 调用Tauri命令连接SSH
      console.log('⚡ 调用 Tauri invoke: ssh_connect_direct');
      await (window as any).__TAURI__.core.invoke('ssh_connect_direct', {
        host,
        port: portNumber,
        username,
        password
      });
      
      console.log('✅ [sshConnectionManager] Tauri invoke 返回成功');

      // 更新连接状态
      this.connectionStatus = {
        host,
        port,
        username,
        connected: true,
        lastActivity: new Date()
      };

      // 保存连接配置（如果不存在的话）
      await this.saveConnectionConfig(host, port, username);

      // 通知监听器
      this.notifyListeners();

      // 初始化终端工作目录
      if ((window as any).terminalManager && (window as any).terminalManager.initializeWorkingDirectory) {
        setTimeout(() => {
          (window as any).terminalManager.initializeWorkingDirectory();
        }, 500);
      }

    } catch (error) {
      console.error('SSH连接失败:', error);
      throw error;
    }
  }

  /**
   * 断开SSH连接
   */
  async disconnect(): Promise<void> {
    try {
      if (this.connectionStatus?.connected) {
        await (window as any).__TAURI__.core.invoke('ssh_disconnect_direct');

        this.connectionStatus = null;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('断开SSH连接失败:', error);
    }
  }

  /**
   * 更新最后活动时间（仅本地更新，不触发全局监听，以避免循环刷新）
   */
  updateLastActivity(): void {
    if (this.connectionStatus) {
      this.connectionStatus.lastActivity = new Date();
      // 不再调用 notifyListeners()，防止触发 UI 刷新循环
    }
  }

  /**
   * 添加状态监听器
   */
  addListener(listener: (status: SSHConnectionInfo | null) => void): void {
    this.listeners.push(listener);
  }

  /**
   * 移除状态监听器
   */
  removeListener(listener: (status: SSHConnectionInfo | null) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 保存连接配置
   */
  private async saveConnectionConfig(host: string, port: number, username: string): Promise<void> {
    try {
      // 检查是否已存在相同的连接配置
      const existingConnections = this.configManager.getConnections();
      const exists = existingConnections.some(conn =>
        conn.host === host && conn.port === port && conn.username === username
      );

      if (!exists) {
        // 创建新的连接配置
        const connectionName = `${username}@${host}:${port}`;
        await this.configManager.addConnection({
          name: connectionName,
          host,
          port,
          username,
          authType: 'password' as const,
          tags: ['auto-saved'],
          accounts: [{
            username,
            authType: 'password' as const,
            isDefault: true
          }]
        });
        console.log('✅ 连接配置已自动保存:', connectionName);
      }
    } catch (error) {
      console.error('保存连接配置失败:', error);
      // 不抛出错误，因为这不应该影响连接本身
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.connectionStatus);
      } catch (error) {
        console.error('SSH连接状态监听器执行失败:', error);
      }
    });
  }

  /**
   * 检查连接状态（从后端获取最新状态）
   */
  async checkConnectionStatus(): Promise<SSHConnectionInfo | null> {
    try {
      const status = await (window as any).__TAURI__.core.invoke('ssh_get_connection_status');
      if (status) {
        this.connectionStatus = {
          host: status.host,
          port: status.port,
          username: status.username,
          connected: status.connected,
          lastActivity: new Date(status.last_activity)
        };
        this.notifyListeners();
      } else {
        this.connectionStatus = null;
        this.notifyListeners();
      }
      return this.connectionStatus;
    } catch (error) {
      console.error('检查SSH连接状态失败:', error);
      return null;
    }
  }
}

// 全局SSH连接管理器实例
export const sshConnectionManager = new SSHSessionManager();
