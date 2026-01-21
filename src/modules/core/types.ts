/**
 * 核心类型定义
 */

export interface ServerInfo {
  name: string;
  host: string;
  port: number;
  username?: string;
  detailedInfo?: any; // 用于存储系统详细信息
}

export interface AppState {
  theme: 'light' | 'dark' | 'sakura';
  isConnected: boolean;
  currentServer?: string; // 保留向后兼容
  serverInfo?: ServerInfo; // 新增详细服务器信息
  loading: boolean;
  currentPage: 'dashboard' | 'system-info' | 'ssh-terminal' | 'remote-operations' | 'docker' | 'emergency-commands' | 'log-analysis' | 'settings' | 'quick-detection' | 'kubernetes' | 'database';
}
