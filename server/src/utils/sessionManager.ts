/**
 * 会话管理模块
 * 管理客户端会话和 AES 密钥
 */

interface Session {
  aesKey: Buffer;
  createdAt: number;
  requestCount: number;
  lastAccessAt: number;
}

class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private readonly SESSION_TIMEOUT = 60 * 60 * 1000; // 1 小时
  private readonly MAX_REQUESTS = 1000; // 最大请求数
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 每 5 分钟清理一次过期会话
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, 5 * 60 * 1000);
    
    console.log('✅ 会话管理器已启动');
  }

  /**
   * 创建新会话
   */
  createSession(sessionId: string, aesKey: Buffer): void {
    this.sessions.set(sessionId, {
      aesKey,
      createdAt: Date.now(),
      requestCount: 0,
      lastAccessAt: Date.now()
    });
    
    console.log(`📝 创建新会话: ${sessionId}`);
  }

  /**
   * 获取会话的 AES 密钥
   */
  getAESKey(sessionId: string): Buffer | null {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      console.warn(`⚠️ 会话不存在: ${sessionId}`);
      return null;
    }
    
    const now = Date.now();
    
    // 检查会话是否过期
    if (now - session.createdAt > this.SESSION_TIMEOUT) {
      console.warn(`⚠️ 会话已过期: ${sessionId}`);
      this.sessions.delete(sessionId);
      return null;
    }
    
    // 检查请求次数是否超限
    if (session.requestCount >= this.MAX_REQUESTS) {
      console.warn(`⚠️ 会话请求次数超限: ${sessionId} (${session.requestCount}/${this.MAX_REQUESTS})`);
      this.sessions.delete(sessionId);
      return null;
    }
    
    // 更新会话信息
    session.requestCount++;
    session.lastAccessAt = now;
    
    return session.aesKey;
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): void {
    if (this.sessions.delete(sessionId)) {
      console.log(`🗑️ 删除会话: ${sessionId}`);
    }
  }

  /**
   * 清理过期会话
   */
  cleanupExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.createdAt > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      console.log(`🧹 清理了 ${cleanedCount} 个过期会话`);
    }
  }

  /**
   * 获取会话统计信息
   */
  getStats(): {
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
  } {
    const now = Date.now();
    let activeSessions = 0;
    let expiredSessions = 0;
    
    for (const session of this.sessions.values()) {
      if (now - session.createdAt > this.SESSION_TIMEOUT) {
        expiredSessions++;
      } else {
        activeSessions++;
      }
    }
    
    return {
      totalSessions: this.sessions.size,
      activeSessions,
      expiredSessions
    };
  }

  /**
   * 停止会话管理器
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      console.log('🛑 会话管理器已停止');
    }
  }
}

// 导出单例
export const sessionManager = new SessionManager();

