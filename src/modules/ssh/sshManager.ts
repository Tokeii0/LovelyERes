/**
 * SSH管理器 - 协调器
 * 负责协调SSH连接管理器和系统信息管理器
 */

import { invoke } from '@tauri-apps/api/core';
import { SSHConnectionManager, type SSHConnection } from './connectionManager';
import { SystemInfoManager, type SystemInfo } from '../system/systemInfoManager';

export interface SSHCommand {
  id: string;
  name: string;
  command: string;
  description: string;
  category: string;
  favorite: boolean;
}

export class SSHManager {
  private connectionManager: SSHConnectionManager;
  private systemInfoManager: SystemInfoManager;
  private commands: SSHCommand[] = [];

  constructor() {
    this.connectionManager = new SSHConnectionManager();
    this.systemInfoManager = new SystemInfoManager();
    this.initializeDefaultCommands();
  }

  // ===== 连接管理代理方法 =====

  /**
   * 获取所有SSH连接
   */
  getConnections(): SSHConnection[] {
    return this.connectionManager.getConnections();
  }

  /**
   * 获取单个SSH连接
   */
  getConnection(id: string): SSHConnection | undefined {
    return this.connectionManager.getConnection(id);
  }

  /**
   * 添加SSH连接
   */
  async addConnection(connection: Omit<SSHConnection, 'id' | 'isConnected' | 'lastConnected'>): Promise<SSHConnection> {
    return this.connectionManager.addConnection(connection);
  }

  /**
   * 更新SSH连接
   */
  async updateConnection(id: string, updates: Partial<SSHConnection>): Promise<SSHConnection> {
    return this.connectionManager.updateConnection(id, updates);
  }

  /**
   * 删除SSH连接
   */
  async deleteConnection(id: string): Promise<void> {
    return this.connectionManager.deleteConnection(id);
  }

  /**
   * 连接到服务器
   */
  async connectToServer(id: string): Promise<void> {
    const connection = this.connectionManager.getConnection(id);
    if (!connection) {
      throw new Error('连接配置不存在');
    }

    try {
      console.log(`🔗 正在连接到 ${connection.name} (${connection.host}:${connection.port})`);

      // 调用后端建立真正的SSH连接
      await invoke('ssh_connect_with_auth', {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authType: connection.authType,
        password: connection.encryptedPassword ? await invoke('decrypt_password', { encryptedPassword: connection.encryptedPassword }) : undefined,
        keyPath: connection.keyPath,
        keyPassphrase: connection.keyPassphrase
      });

      console.log(`✅ SSH连接已建立到 ${connection.name}`);

      // 更新连接状态
      await this.connectionManager.updateConnection(id, {
        isConnected: true,
        lastConnected: new Date()
      });

      // 连接成功后立即获取系统信息
      console.log('📊 正在获取系统信息...');
      await this.systemInfoManager.fetchSystemInfo();

      console.log(`✅ 成功连接到 ${connection.name}`);
    } catch (error) {
      console.error(`❌ 连接失败: ${error}`);
      throw error;
    }
  }

  /**
   * 设置当前会话ID (用于多服务器切换)
   * 强制清除所有缓存以确保刷新时获取新会话数据
   */
  setSessionId(sessionId: string): void {
    console.log(`🔄 [SSHManager] 设置会话 ID: ${sessionId}`);
    // 强制清除 systemInfoManager 的缓存
    this.systemInfoManager.setSessionId(sessionId);
    // 额外调用 clearCache 确保完全清除
    if (this.systemInfoManager.clearCache) {
      this.systemInfoManager.clearCache();
      console.log('🗑️ [SSHManager] 已清除 SystemInfoManager 缓存');
    }
  }

  /**
   * 断开服务器连接
   */
  async disconnectFromServer(id: string): Promise<void> {
    const connection = this.connectionManager.getConnection(id);
    if (!connection) {
      throw new Error('连接配置不存在');
    }

    try {
      console.log(`🔌 正在断开 ${connection.name} 的连接`);

      // 调用后端断开SSH连接
      await invoke('ssh_disconnect');

      // 更新连接状态
      await this.connectionManager.updateConnection(id, {
        isConnected: false
      });

      console.log(`✅ 已断开 ${connection.name} 的连接`);
    } catch (error) {
      console.error(`❌ 断开连接失败: ${error}`);
      throw error;
    }
  }

  /**
   * 连接到SSH服务器
   */
  async connect(id: string): Promise<void> {
    await this.connectionManager.connect(id);

    // 连接成功后，开始自动更新系统信息
    try {
      await this.systemInfoManager.fetchSystemInfo();
      this.systemInfoManager.startAutoUpdate(30000); // 30秒更新一次
    } catch (error) {
      console.warn('⚠️ 获取系统信息失败，但SSH连接成功:', error);
    }
  }

  /**
   * 断开SSH连接
   */
  async disconnect(): Promise<void> {
    await this.connectionManager.disconnect();
    this.systemInfoManager.stopAutoUpdate();
  }

  /**
   * 获取当前活动连接
   */
  getActiveConnection(): SSHConnection | undefined {
    return this.connectionManager.getActiveConnection();
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.connectionManager.isConnected();
  }

  /**
   * 测试连接
   */
  async testConnection(connection: Omit<SSHConnection, 'id' | 'isConnected' | 'lastConnected'>): Promise<boolean> {
    return this.connectionManager.testConnection(connection);
  }

  // ===== 系统信息代理方法 =====

  /**
   * 获取系统信息
   */
  async fetchSystemInfo(force: boolean = false): Promise<SystemInfo> {
    return this.systemInfoManager.fetchSystemInfo(force);
  }

  /**
   * 获取当前系统信息
   */
  getSystemInfo(): SystemInfo | undefined {
    return this.systemInfoManager.getSystemInfo();
  }

  /**
   * 开始自动更新系统信息
   */
  startSystemInfoAutoUpdate(intervalMs: number = 30000): void {
    this.systemInfoManager.startAutoUpdate(intervalMs);
  }

  /**
   * 停止自动更新系统信息
   */
  stopSystemInfoAutoUpdate(): void {
    this.systemInfoManager.stopAutoUpdate();
  }

  // ===== 命令管理 =====

  /**
   * 执行SSH命令
   */
  async executeCommand(command: string): Promise<string> {
    if (!this.isConnected()) {
      throw new Error('没有活动的SSH连接');
    }

    try {
      const result = await invoke('ssh_execute_command', { command });
      console.log(`✅ 命令执行成功: ${command}`);
      return result as string;
    } catch (error) {
      console.error(`❌ 命令执行失败: ${command}`, error);
      throw new Error(`命令执行失败: ${error}`);
    }
  }

  /**
   * 获取所有SSH命令
   */
  getCommands(): SSHCommand[] {
    return [...this.commands];
  }

  /**
   * 初始化默认命令
   */
  private initializeDefaultCommands(): void {
    const defaultCommands: Omit<SSHCommand, 'id'>[] = [
      {
        name: '查看系统信息',
        command: 'uname -a',
        description: '显示系统内核信息',
        category: '系统信息',
        favorite: true
      },
      {
        name: '查看内存使用',
        command: 'free -h',
        description: '显示内存使用情况',
        category: '系统监控',
        favorite: true
      },
      {
        name: '查看磁盘使用',
        command: 'df -h',
        description: '显示磁盘使用情况',
        category: '系统监控',
        favorite: true
      }
    ];

    this.commands = defaultCommands.map(cmd => ({
      ...cmd,
      id: this.generateId()
    }));

    console.log('✅ 默认SSH命令已初始化');
  }

  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.systemInfoManager.destroy();
    console.log('✅ SSH管理器资源已清理');
  }
}

// 导出类型
export type { SSHConnection, SystemInfo };