/**
 * 远程操作管理器
 * 统一协调SSH连接、SFTP文件管理和终端操作
 */

import { sshConnectionManager, SSHConnectionInfo } from './sshConnectionManager';
import { sftpManager } from './sftpManager';
import { terminalManager } from './terminalManager';

export class RemoteOperationsManager {
  private initialized = false;
  private lastConnectionStatus: SSHConnectionInfo | null = null;
  private lastSftpPath: string = '';
  private lastSftpFileCount: number = 0;

  /**
   * 初始化远程操作管理器
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // 设置SSH连接状态监听器
    sshConnectionManager.addListener(this.onSSHConnectionStatusChanged.bind(this));

    // 设置SFTP文件列表监听器
    sftpManager.addListener(this.onSftpFileListChanged.bind(this));

    // 设置终端历史监听器
    terminalManager.addListener(this.onTerminalHistoryChanged.bind(this));

    // 检查现有连接状态
    await this.checkExistingConnection();

    this.initialized = true;
    console.log('✅ 远程操作管理器初始化完成');
  }

  /**
   * 检查现有连接状态
   */
  private async checkExistingConnection(): Promise<void> {
    try {
      await sshConnectionManager.checkConnectionStatus();
      const status = sshConnectionManager.getConnectionStatus();
      
      if (status?.connected) {
        console.log('🔗 发现现有SSH连接:', status);
        // 刷新SFTP文件列表
        await sftpManager.refreshFileList();
        // 更新终端状态
        terminalManager.updateTerminalDisplay();
      }
    } catch (error) {
      console.error('检查现有连接状态失败:', error);
    }
  }

  /**
   * SSH连接状态变化处理
   */
  private onSSHConnectionStatusChanged(status: SSHConnectionInfo | null): void {
    // 只在"连接/断开"状态真正变化时作出反应，避免因 lastActivity 变化触发刷新
    const prevConnected = this.lastConnectionStatus?.connected || false;
    const nextConnected = status?.connected || false;

    const stateChanged = prevConnected !== nextConnected;

    if (stateChanged) {
      console.log('🔄 SSH连接状态变化:', {
        from: prevConnected ? '已连接' : '未连接',
        to: nextConnected ? '已连接' : '未连接',
        host: status?.host
      });
      this.lastConnectionStatus = status;

      if (nextConnected) {
        // 仅在从未连接 -> 已连接时刷新
        this.refreshRemoteOperations();
      } else {
        // 仅在从已连接 -> 未连接时清理
        this.clearRemoteOperations();
      }
    } else {
      // 连接状态未变化（例如仅 lastActivity 更新），不触发任何刷新，保持静默
    }
  }

  /**
   * SFTP文件列表变化处理
   */
  private onSftpFileListChanged(files: any[], path: string): void {
    // 只在路径变化或文件数量显著变化时记录日志
    const lastPath = this.lastSftpPath;
    const lastFileCount = this.lastSftpFileCount;

    if (lastPath !== path || Math.abs(lastFileCount - files.length) > 5) {
      console.log('📁 SFTP文件列表更新:', {
        path,
        fileCount: files.length,
        changed: lastPath !== path ? '路径变化' : '文件数量变化'
      });
      this.lastSftpPath = path;
      this.lastSftpFileCount = files.length;
    }

    this.updateSftpDisplay();
  }

  /**
   * 终端历史变化处理
   */
  private onTerminalHistoryChanged(history: any[]): void {
    console.log('💻 终端历史更新:', { commandCount: history.length });
    terminalManager.updateTerminalDisplay();
  }

  /**
   * 刷新远程操作（连接成功后调用）
   */
  private async refreshRemoteOperations(): Promise<void> {
    try {
      // 刷新SFTP文件列表
      await sftpManager.refreshFileList();
      
      // 更新终端状态
      terminalManager.updateTerminalDisplay();
      
      // 更新UI显示
      this.updateSftpDisplay();
      
    } catch (error) {
      console.error('刷新远程操作失败:', error);
    }
  }

  /**
   * 清理远程操作（连接断开后调用）
   */
  private clearRemoteOperations(): void {
    // 更新SFTP显示
    this.updateSftpDisplay();
    
    // 更新终端显示
    terminalManager.updateTerminalDisplay();
  }

  /**
   * 更新SFTP显示
   */
  private updateSftpDisplay(): void {
    const sftpFileList = document.getElementById('sftp-file-list');
    if (sftpFileList) {
      sftpFileList.innerHTML = sftpManager.renderFileListHTML();
    }

    // 更新路径显示
    const pathInput = document.querySelector('#sftp-path-input') as HTMLInputElement;
    if (pathInput) {
      pathInput.value = sftpManager.getCurrentPath();
    }
  }

  /**
   * 获取SSH连接状态
   */
  getSSHConnectionStatus(): SSHConnectionInfo | null {
    return sshConnectionManager.getConnectionStatus();
  }

  /**
   * 检查是否已连接SSH
   */
  isSSHConnected(): boolean {
    return sshConnectionManager.isConnected();
  }

  /**
   * 刷新SFTP文件列表
   */
  async refreshSftpFiles(): Promise<void> {
    await sftpManager.refreshFileList();
  }

  /**
   * 执行终端命令
   */
  async executeTerminalCommand(command: string): Promise<void> {
    await terminalManager.executeCommand(command);
  }

  /**
   * 清空终端历史
   */
  clearTerminalHistory(): void {
    terminalManager.clearHistory();
  }

  /**
   * 导航到SFTP路径
   */
  async navigateToSftpPath(path: string): Promise<void> {
    await sftpManager.navigateToPath(path);
  }

  /**
   * 销毁管理器
   */
  destroy(): void {
    // 移除监听器
    sshConnectionManager.removeListener(this.onSSHConnectionStatusChanged.bind(this));
    sftpManager.removeListener(this.onSftpFileListChanged.bind(this));
    terminalManager.removeListener(this.onTerminalHistoryChanged.bind(this));
    
    this.initialized = false;
    console.log('🗑️ 远程操作管理器已销毁');
  }
}

// 全局远程操作管理器实例
export const remoteOperationsManager = new RemoteOperationsManager();
