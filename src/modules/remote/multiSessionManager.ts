/**
 * 多会话管理器
 * 管理多个SSH服务器连接的会话状态，支持Tab切换
 */

import { sshConnectionManager, SSHConnectionInfo } from './sshConnectionManager';

export interface MultiSessionEntry {
  sessionId: string;
  connection: SSHConnectionInfo;
  isActive: boolean;
  createdAt: Date;
}

type SessionChangeListener = (sessions: MultiSessionEntry[], activeId: string | null) => void;

class MultiSessionManager {
  private sessions: Map<string, MultiSessionEntry> = new Map();
  private activeSessionId: string | null = null;
  private listeners: SessionChangeListener[] = [];

  /**
   * 获取所有活跃会话
   */
  getSessions(): MultiSessionEntry[] {
    return Array.from(this.sessions.values());
  }

  /**
   * 获取当前激活的会话ID
   */
  getActiveSessionId(): string | null {
    return this.activeSessionId;
  }

  /**
   * 获取当前激活的会话
   */
  getActiveSession(): MultiSessionEntry | null {
    if (!this.activeSessionId) return null;
    return this.sessions.get(this.activeSessionId) || null;
  }

  /**
   * 添加新会话（连接成功后调用）
   */
  addSession(sessionId: string, connection: SSHConnectionInfo): void {
    const entry: MultiSessionEntry = {
      sessionId,
      connection: { ...connection, sessionId },
      isActive: true,
      createdAt: new Date()
    };
    
    // 将其他会话设为非活跃
    this.sessions.forEach(session => {
      session.isActive = false;
    });
    
    this.sessions.set(sessionId, entry);
    this.activeSessionId = sessionId;
    
    console.log(`📡 [MultiSessionManager] 添加会话: ${sessionId}, 当前会话数: ${this.sessions.size}`);
    this.notifyListeners();
  }

  /**
   * 移除会话（断开连接后调用）
   */
  removeSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    
    // 如果移除的是当前活跃会话，切换到另一个
    if (this.activeSessionId === sessionId) {
      const remaining = Array.from(this.sessions.keys());
      if (remaining.length > 0) {
        this.switchSession(remaining[0]);
      } else {
        this.activeSessionId = null;
      }
    }
    
    console.log(`🔌 [MultiSessionManager] 移除会话: ${sessionId}, 剩余会话数: ${this.sessions.size}`);
    this.notifyListeners();
  }

  /**
   * 切换到指定会话
   */
  async switchSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`⚠️ [MultiSessionManager] 会话不存在: ${sessionId}`);
      return false;
    }

    // 先通知后端切换当前会话
    try {
      await (window as any).__TAURI__.core.invoke('ssh_set_current_session', {
        sessionId
      });
      console.log(`🔄 [MultiSessionManager] 后端会话已切换: ${sessionId}`);
    } catch (error) {
      console.error(`❌ [MultiSessionManager] 后端切换会话失败:`, error);
      return false;
    }

    // 更新前端活跃状态
    this.sessions.forEach((s, id) => {
      s.isActive = id === sessionId;
    });
    this.activeSessionId = sessionId;

    // 更新 sshConnectionManager 的状态
    sshConnectionManager.setConnectionStatus(session.connection);
    
    console.log(`🔄 [MultiSessionManager] 切换到会话: ${sessionId}`);
    this.notifyListeners();
    return true;
  }

  /**
   * 添加会话变化监听器
   */
  addListener(listener: SessionChangeListener): void {
    this.listeners.push(listener);
  }

  /**
   * 移除监听器
   */
  removeListener(listener: SessionChangeListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    const sessions = this.getSessions();
    this.listeners.forEach(listener => {
      try {
        listener(sessions, this.activeSessionId);
      } catch (error) {
        console.error('会话监听器执行失败:', error);
      }
    });
  }

  /**
   * 获取会话数量
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * 检查是否有活跃会话
   */
  hasActiveSessions(): boolean {
    return this.sessions.size > 0;
  }
}

// 导出单例
export const multiSessionManager = new MultiSessionManager();
