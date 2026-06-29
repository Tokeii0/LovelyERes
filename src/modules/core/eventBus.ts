/**
 * 全局事件总线
 * 替代 (window as any) 的模块间通信方式
 *
 * 使用方式：
 *   import { eventBus } from '@/modules/core/eventBus';
 *   eventBus.emit('notification', { message: '...', type: 'success' });
 *   eventBus.on('notification', ({ message, type }) => { ... });
 */

import mitt from 'mitt';

// ========== 事件类型定义 ==========

export type AppEvents = {
  // 通知
  'notification': { message: string; type: 'success' | 'error' | 'info' | 'warning'; title?: string };

  // 页面切换
  'page:switch': { pageId: string };

  // 连接状态
  'connection:changed': { connected: boolean; server?: string };

  // SSH 终端
  'ssh:openTerminal': void;

  // SFTP
  'sftp:refresh': void;
  'sftp:openUpload': { path: string };
  'sftp:openCreateFolder': { path: string };
  'sftp:toggleHistory': void;
  'sftp:setSortMode': { mode: string };

  // 仪表盘
  'dashboard:refresh': void;
  'dashboard:autoRefreshStart': void;
  'dashboard:autoRefreshStop': void;

  // 侧边栏
  'sidebar:refresh': void;

  // 系统信息
  'systemInfo:loadDetailed': { forceRefresh?: boolean };
  'systemInfo:tabSwitch': { tabId: string };

  // 日志分析
  'logAnalysis:refresh': void;

  // 设置
  'settings:show': void;
  'settings:hide': void;
  'settings:changed': { key: string; value: any };

  // 主题
  'theme:changed': { theme: 'light' | 'dark' | 'sakura' | 'midnight' | 'ocean' };

  // 服务器
  'server:listRefresh': void;

  // 开发者工具
  'devtools:toggle': void;

  // Kubernetes
  'k8s:refresh': void;
  'k8s:namespaceChanged': { namespace: string };
  'k8s:emergencyMode': { enabled: boolean };
  'k8s:anomalyDetected': { count: number; critical: number };
  'k8s:actionCompleted': { type: string; target: string; status: string };
};

// ========== 创建并导出事件总线 ==========

export const eventBus = mitt<AppEvents>();

/**
 * 便捷函数：显示通知（可直接调用替代 window.showNotification）
 */
export function showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
  eventBus.emit('notification', { message, type });
}
