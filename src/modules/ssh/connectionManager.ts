/**
 * SSH 连接管理器
 * 负责SSH连接的增删改查和持久化存储
 */

import { invoke } from '@tauri-apps/api/core';

/**
 * SSH账号凭证
 */
export interface SSHAccountCredential {
  username: string;
  authType: 'password' | 'key' | 'certificate';
  encryptedPassword?: string; // AES加密的密码
  keyPath?: string;
  keyPassphrase?: string; // SSH密钥的密码短语
  certificatePath?: string;
  isDefault: boolean; // 是否为默认账号
  description?: string; // 账号描述（如：超级管理员、数据库管理员等）
}

export interface SSHConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  // 保留单账号字段用于向后兼容，将在未来版本废弃
  username: string;
  authType: 'password' | 'key' | 'certificate';
  encryptedPassword?: string; // AES加密的密码
  keyPath?: string;
  keyPassphrase?: string; // SSH密钥的密码短语
  certificatePath?: string;
  // 新增多账号支持
  accounts: SSHAccountCredential[]; // 多账号列表
  activeAccount?: string; // 当前活动的账号用户名
  // 其他字段
  isConnected: boolean;
  lastConnected?: Date;
  tags?: string[];
}

export class SSHConfigManager {
  private connections: SSHConnection[] = [];
  private activeConnection?: SSHConnection;

  constructor() {
    this.loadConnections();
  }

  /**
   * 加载SSH连接配置
   */
  async loadConnections(): Promise<void> {
    try {
      const backendConnections = await invoke('load_ssh_connections') as any[];
      // 转换后端字段名为前端字段名
      this.connections = backendConnections.map(conn => ({
        id: conn.id,
        name: conn.name,
        host: conn.host,
        port: conn.port,
        username: conn.username || '',
        authType: conn.auth_type || 'password', // 转换为驼峰命名
        encryptedPassword: conn.encrypted_password,
        keyPath: conn.key_path,
        keyPassphrase: conn.key_passphrase,
        certificatePath: conn.certificate_path,
        // 转换多账号数据
        accounts: (conn.accounts || []).map((acc: any) => ({
          username: acc.username,
          authType: acc.auth_type,
          encryptedPassword: acc.encrypted_password,
          keyPath: acc.key_path,
          keyPassphrase: acc.key_passphrase,
          certificatePath: acc.certificate_path,
          isDefault: acc.is_default,
          description: acc.description
        })),
        activeAccount: conn.active_account,
        isConnected: false, // 应用启动时重置所有连接状态为未连接
        lastConnected: conn.last_connected ? new Date(conn.last_connected) : undefined,
        tags: conn.tags
      }));
      console.log('✅ SSH连接配置已加载', this.connections.length, '个连接');
    } catch (error) {
      console.error('❌ 加载SSH连接配置失败:', error);
      this.connections = [];
    }
  }

  /**
   * 保存SSH连接配置
   */
  async saveConnections(): Promise<void> {
    try {
      // 转换字段名以匹配后端结构
      const backendConnections = this.connections.map((conn) => ({
        id: conn.id,
        name: conn.name,
        host: conn.host,
        port: conn.port,
        username: conn.username,
        auth_type: conn.authType, // 转换为下划线命名
        encrypted_password: conn.encryptedPassword || null,
        key_path: conn.keyPath || null,
        key_passphrase: conn.keyPassphrase || null,
        certificate_path: conn.certificatePath || null,
        // 转换多账号数据
        accounts: conn.accounts.map(acc => ({
          username: acc.username,
          auth_type: acc.authType,
          encrypted_password: acc.encryptedPassword || null,
          key_path: acc.keyPath || null,
          key_passphrase: acc.keyPassphrase || null,
          certificate_path: acc.certificatePath || null,
          is_default: acc.isDefault,
          description: acc.description || null
        })),
        active_account: conn.activeAccount || null,
        is_connected: conn.isConnected,
        last_connected: conn.lastConnected,
        tags: null
      }));

      await invoke('save_ssh_connections', { connections: backendConnections });
      console.log('✅ SSH连接配置已保存');
    } catch (error) {
      console.error('❌ 保存SSH连接配置失败:', error);
      throw new Error(`保存SSH连接配置失败: ${error}`);
    }
  }

  /**
   * 添加新的SSH连接
   */
  async addConnection(connection: Omit<SSHConnection, 'id' | 'isConnected' | 'lastConnected'>): Promise<SSHConnection> {
    console.log('🔐 [添加连接] 开始处理:', {
      name: connection.name,
      host: connection.host,
      authType: connection.authType,
      hasPassword: !!(connection as any).password,
      passwordLength: (connection as any).password?.length || 0,
      accountsCount: connection.accounts?.length || 0
    });

    const newConnection: SSHConnection = {
      ...connection,
      id: this.generateId(),
      isConnected: false,
      lastConnected: undefined,
      // 确保字段名正确映射
      authType: connection.authType || 'password',
      accounts: connection.accounts || []
    };

    // 如果有密码，进行加密（主账号）
    if (connection.authType === 'password' && (connection as any).password) {
      try {
        console.log('🔐 [添加连接] 正在加密主账号密码...');
        const encryptedPassword = await invoke('encrypt_password', {
          password: (connection as any).password
        }) as string;
        newConnection.encryptedPassword = encryptedPassword;
        console.log('✅ [添加连接] 主账号密码加密成功');
      } catch (error) {
        console.error('❌ 密码加密失败:', error);
        throw new Error('密码加密失败');
      }
    }

    // 加密额外账号的密码
    if (newConnection.accounts && newConnection.accounts.length > 0) {
      console.log('🔐 [添加连接] 正在加密额外账号密码...');
      for (const account of newConnection.accounts) {
        if (account.authType === 'password' && (account as any).password) {
          try {
            const encryptedPassword = await invoke('encrypt_password', {
              password: (account as any).password
            }) as string;
            account.encryptedPassword = encryptedPassword;
            delete (account as any).password; // 删除明文密码
            console.log(`✅ 账号 ${account.username} 密码加密成功`);
          } catch (error) {
            console.error(`❌ 账号 ${account.username} 密码加密失败:`, error);
            throw new Error(`账号 ${account.username} 密码加密失败`);
          }
        }
      }
    }

    this.connections.push(newConnection);
    await this.saveConnections();

    console.log('✅ 新增SSH连接:', newConnection.name, '主账号加密密码:', newConnection.encryptedPassword ? '已设置' : '未设置', '额外账号数:', newConnection.accounts.length);
    return newConnection;
  }

  /**
   * 更新SSH连接
   */
  async updateConnection(id: string, updates: Partial<SSHConnection>): Promise<SSHConnection> {
    const index = this.connections.findIndex(conn => conn.id === id);
    if (index === -1) {
      throw new Error('连接不存在');
    }

    console.log('🔐 [更新连接] 开始处理:', {
      id,
      authType: updates.authType,
      hasPassword: !!(updates as any).password,
      passwordLength: (updates as any).password?.length || 0,
      accountsCount: updates.accounts?.length || 0
    });

    // 如果更新了密码，需要重新加密（主账号）
    if (updates.authType === 'password' && (updates as any).password) {
      try {
        console.log('🔐 [更新连接] 正在加密主账号密码...');
        const encryptedPassword = await invoke('encrypt_password', {
          password: (updates as any).password
        }) as string;
        updates.encryptedPassword = encryptedPassword;
        delete (updates as any).password; // 删除明文密码
        console.log('✅ [更新连接] 主账号密码加密成功');
      } catch (error) {
        console.error('❌ 密码加密失败:', error);
        throw new Error('密码加密失败');
      }
    } else if ((updates as any).password === undefined || (updates as any).password === '') {
      console.log('ℹ️ [更新连接] 密码为空，保持原有密码不变');
    }

    // 加密额外账号的密码
    if (updates.accounts && updates.accounts.length > 0) {
      console.log('🔐 [更新连接] 正在加密额外账号密码...');
      for (const account of updates.accounts) {
        if (account.authType === 'password' && (account as any).password) {
          try {
            const encryptedPassword = await invoke('encrypt_password', {
              password: (account as any).password
            }) as string;
            account.encryptedPassword = encryptedPassword;
            delete (account as any).password; // 删除明文密码
            console.log(`✅ 账号 ${account.username} 密码加密成功`);
          } catch (error) {
            console.error(`❌ 账号 ${account.username} 密码加密失败:`, error);
            throw new Error(`账号 ${account.username} 密码加密失败`);
          }
        }
      }
    }

    this.connections[index] = { ...this.connections[index], ...updates };
    await this.saveConnections();

    console.log('✅ 更新SSH连接:', this.connections[index].name, '主账号加密密码:', this.connections[index].encryptedPassword ? '已设置' : '未设置', '额外账号数:', this.connections[index].accounts?.length || 0);
    return this.connections[index];
  }

  /**
   * 删除SSH连接
   */
  async deleteConnection(id: string): Promise<void> {
    const index = this.connections.findIndex(conn => conn.id === id);
    if (index === -1) {
      throw new Error('连接不存在');
    }

    const connection = this.connections[index];
    
    // 如果是当前活动连接，先断开
    if (this.activeConnection?.id === id) {
      await this.disconnect();
    }

    this.connections.splice(index, 1);
    await this.saveConnections();
    
    console.log('✅ 删除SSH连接:', connection.name);
  }

  /**
   * 获取所有连接
   */
  getConnections(): SSHConnection[] {
    return [...this.connections];
  }

  /**
   * 根据ID获取连接
   */
  getConnection(id: string): SSHConnection | undefined {
    return this.connections.find(conn => conn.id === id);
  }

  /**
   * 连接到SSH服务器
   */
  async connect(id: string): Promise<void> {
    const connection = this.getConnection(id);
    if (!connection) {
      throw new Error('连接不存在');
    }

    try {
      console.log(`🔗 正在连接到 ${connection.username}@${connection.host}:${connection.port}`);
      
      // 准备连接参数
      let password: string | undefined;
      if (connection.authType === 'password' && connection.encryptedPassword) {
        // 解密密码
        password = await invoke('decrypt_password', { 
          encryptedPassword: connection.encryptedPassword 
        }) as string;
      }

      // 调用后端SSH连接命令 (russh)
      const result = await invoke('ssh_connect_direct', {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authType: connection.authType,
        password,
        keyPath: connection.keyPath,
        keyPassphrase: connection.keyPassphrase,
      });

      // 连接成功，更新状态
      connection.isConnected = true;
      connection.lastConnected = new Date();
      this.activeConnection = connection;
      
      // 异步保存连接状态（不阻塞连接流程）
      this.saveConnections().catch(err => {
        console.warn('⚠️ 保存连接状态失败（不影响连接）:', err);
      });
      
      console.log('✅ SSH连接成功:', result);
      
    } catch (error) {
      console.error('❌ SSH连接失败:', error);
      throw new Error(`SSH连接失败: ${error}`);
    }
  }

  /**
   * 断开SSH连接
   */
  async disconnect(): Promise<void> {
    if (!this.activeConnection) {
      return;
    }

    try {
      await invoke('ssh_disconnect_direct');
      
      this.activeConnection.isConnected = false;
      this.activeConnection = undefined;
      
      await this.saveConnections();
      
      console.log('✅ SSH连接已断开');
    } catch (error) {
      console.error('❌ 断开SSH连接失败:', error);
      throw new Error(`断开SSH连接失败: ${error}`);
    }
  }

  /**
   * 获取当前活动连接
   */
  getActiveConnection(): SSHConnection | undefined {
    return this.activeConnection;
  }

  /**
   * 检查是否已连接
   */
  isConnected(): boolean {
    return this.activeConnection?.isConnected || false;
  }

  /**
   * 测试连接
   */
  async testConnection(connection: Omit<SSHConnection, 'id' | 'isConnected' | 'lastConnected'>): Promise<boolean> {
    try {
      let password: string | undefined;
      if (connection.authType === 'password' && (connection as any).password) {
        password = (connection as any).password;
      }

      await invoke('ssh_test_connection', {
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authType: connection.authType,
        password,
        keyPath: connection.keyPath,
        keyPassphrase: connection.keyPassphrase,
        certificatePath: connection.certificatePath
      });

      return true;
    } catch (error) {
      console.error('❌ 连接测试失败:', error);
      return false;
    }
  }

  /**
   * 根据标签筛选连接
   */
  getConnectionsByTag(tag: string): SSHConnection[] {
    return this.connections.filter(conn => 
      conn.tags && conn.tags.includes(tag)
    );
  }

  /**
   * 搜索连接
   */
  searchConnections(query: string): SSHConnection[] {
    const lowerQuery = query.toLowerCase();
    return this.connections.filter(conn =>
      conn.name.toLowerCase().includes(lowerQuery) ||
      conn.host.toLowerCase().includes(lowerQuery) ||
      conn.username.toLowerCase().includes(lowerQuery) ||
      (conn.tags && conn.tags.some(tag => tag.toLowerCase().includes(lowerQuery)))
    );
  }



  /**
   * 生成唯一ID
   */
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  /**
   * 导出连接配置
   */
  async exportConnections(): Promise<string> {
    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      connections: this.connections.map(conn => ({
        ...conn,
        encryptedPassword: undefined, // 不导出密码
        isConnected: false,
        lastConnected: undefined
      }))
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * 导入连接配置
   */
  async importConnections(jsonData: string): Promise<number> {
    try {
      const importData = JSON.parse(jsonData);
      
      if (!importData.connections || !Array.isArray(importData.connections)) {
        throw new Error('无效的导入数据格式');
      }

      let importedCount = 0;
      for (const conn of importData.connections) {
        // 检查是否已存在相同的连接
        const existing = this.connections.find(existing => 
          existing.host === conn.host && 
          existing.username === conn.username && 
          existing.port === conn.port
        );

        if (!existing) {
          const newConnection: SSHConnection = {
            ...conn,
            id: this.generateId(),
            isConnected: false,
            lastConnected: undefined,
            encryptedPassword: undefined // 导入时不包含密码
          };
          
          this.connections.push(newConnection);
          importedCount++;
        }
      }

      if (importedCount > 0) {
        await this.saveConnections();
      }

      console.log(`✅ 导入了 ${importedCount} 个SSH连接`);
      return importedCount;
    } catch (error) {
      console.error('❌ 导入SSH连接失败:', error);
      throw new Error(`导入失败: ${error}`);
    }
  }
}
