/**
 * 结构化日志记录器
 * 替代散落在各处的 console.log / console.error
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  details?: any;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0, info: 1, warn: 2, error: 3,
};

const LOG_ICONS: Record<LogLevel, string> = {
  debug: '🔍', info: 'ℹ️', warn: '⚠️', error: '❌',
};

const LOG_STYLES: Record<LogLevel, string> = {
  debug: 'color: #6b7280',
  info:  'color: #3b82f6',
  warn:  'color: #f59e0b; font-weight: 600',
  error: 'color: #ef4444; font-weight: 600',
};

class Logger {
  private minLevel: LogLevel = 'info';
  private buffer: LogEntry[] = [];
  private readonly MAX_BUFFER = 500;

  /** 设置最低日志级别 */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /** 创建模块级别的子 Logger */
  module(name: string): ModuleLogger {
    return new ModuleLogger(name, this);
  }

  /** 通用日志方法 */
  log(level: LogLevel, module: string, message: string, details?: any): void {
    if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[this.minLevel]) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level, module, message, details,
    };

    this.buffer.push(entry);
    if (this.buffer.length > this.MAX_BUFFER) {
      this.buffer.shift();
    }

    // 输出到控制台
    const icon = LOG_ICONS[level];
    const style = LOG_STYLES[level];
    const tag = `[${module}]`;
    if (details !== undefined) {
      console.log(`%c${icon} ${tag} ${message}`, style, details);
    } else {
      console.log(`%c${icon} ${tag} ${message}`, style);
    }
  }

  /** 获取日志缓冲区（用于导出或 UI 展示） */
  getBuffer(): LogEntry[] {
    return [...this.buffer];
  }

  /** 导出日志为文本 */
  exportAsText(): string {
    return this.buffer.map(e =>
      `[${e.timestamp}] [${e.level.toUpperCase()}] [${e.module}] ${e.message}${e.details ? ' | ' + JSON.stringify(e.details) : ''}`
    ).join('\n');
  }

  /** 清空缓冲区 */
  clear(): void {
    this.buffer = [];
  }
}

class ModuleLogger {
  constructor(
    private name: string,
    private parent: Logger,
  ) {}

  debug(msg: string, details?: any): void { this.parent.log('debug', this.name, msg, details); }
  info(msg: string, details?: any): void  { this.parent.log('info',  this.name, msg, details); }
  warn(msg: string, details?: any): void  { this.parent.log('warn',  this.name, msg, details); }
  error(msg: string, details?: any): void { this.parent.log('error', this.name, msg, details); }
}

export const logger = new Logger();

// 便捷导出：按模块使用
// 示例: import { logger } from '../core/logger';
//       const log = logger.module('SSHManager');
//       log.info('连接成功', { host, port });
//       log.error('连接失败', error);
