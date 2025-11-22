/**
 * 命令历史记录管理器
 * 负责持久化存储和管理命令执行历史
 */

export interface CommandHistoryItem {
  id: string;
  command: string;
  title: string;
  output: string;
  timestamp: number;
  exitCode?: number;
}

export class CommandHistoryManager {
  private static readonly STORAGE_KEY = 'lovelyres_command_history';
  private static readonly MAX_HISTORY_SIZE = 100; // 最多保存100条历史记录

  /**
   * 保存命令到历史记录
   */
  static saveCommand(command: string, title: string, output: string, exitCode?: number): void {
    try {
      const history = this.getHistory();
      
      const newItem: CommandHistoryItem = {
        id: this.generateId(),
        command,
        title,
        output,
        timestamp: Date.now(),
        exitCode
      };

      // 添加到历史记录开头
      history.unshift(newItem);

      // 限制历史记录大小
      if (history.length > this.MAX_HISTORY_SIZE) {
        history.splice(this.MAX_HISTORY_SIZE);
      }

      // 保存到 localStorage
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(history));
      
      console.log('✅ 命令已保存到历史记录:', command.substring(0, 50));
    } catch (error) {
      console.error('❌ 保存命令历史失败:', error);
    }
  }

  /**
   * 获取所有历史记录
   */
  static getHistory(): CommandHistoryItem[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return [];
      
      const history = JSON.parse(data) as CommandHistoryItem[];
      return Array.isArray(history) ? history : [];
    } catch (error) {
      console.error('❌ 读取命令历史失败:', error);
      return [];
    }
  }

  /**
   * 根据ID获取历史记录
   */
  static getById(id: string): CommandHistoryItem | null {
    const history = this.getHistory();
    return history.find(item => item.id === id) || null;
  }

  /**
   * 清空历史记录
   */
  static clearHistory(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('✅ 命令历史已清空');
    } catch (error) {
      console.error('❌ 清空命令历史失败:', error);
    }
  }

  /**
   * 删除指定的历史记录
   */
  static deleteById(id: string): void {
    try {
      const history = this.getHistory();
      const filtered = history.filter(item => item.id !== id);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      console.log('✅ 已删除历史记录:', id);
    } catch (error) {
      console.error('❌ 删除历史记录失败:', error);
    }
  }

  /**
   * 搜索历史记录
   */
  static search(keyword: string): CommandHistoryItem[] {
    const history = this.getHistory();
    const lowerKeyword = keyword.toLowerCase();
    
    return history.filter(item => 
      item.command.toLowerCase().includes(lowerKeyword) ||
      item.title.toLowerCase().includes(lowerKeyword) ||
      item.output.toLowerCase().includes(lowerKeyword)
    );
  }

  /**
   * 生成唯一ID
   */
  private static generateId(): string {
    return `cmd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 获取最近的N条历史记录
   */
  static getRecent(count: number = 10): CommandHistoryItem[] {
    const history = this.getHistory();
    return history.slice(0, count);
  }

  /**
   * 获取历史记录统计信息
   */
  static getStats(): { total: number; oldestTimestamp: number | null; newestTimestamp: number | null } {
    const history = this.getHistory();
    
    if (history.length === 0) {
      return { total: 0, oldestTimestamp: null, newestTimestamp: null };
    }

    return {
      total: history.length,
      oldestTimestamp: history[history.length - 1].timestamp,
      newestTimestamp: history[0].timestamp
    };
  }
}

