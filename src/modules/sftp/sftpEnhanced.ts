/**
 * SFTP 增强功能
 * 远程文件搜索、批量操作进度追踪
 */

import { invoke } from '@tauri-apps/api/core';

// ========== 文件搜索 ==========

export interface FileSearchOptions {
  pattern: string;        // 文件名模式 (支持 glob)
  basePath: string;       // 搜索起始目录
  maxDepth?: number;      // 最大递归深度
  fileType?: 'file' | 'directory' | 'all';
  maxResults?: number;    // 最大返回数量
  modifiedWithin?: number; // 最近 N 天修改过的文件
  minSize?: number;       // 最小文件大小 (bytes)
  maxSize?: number;       // 最大文件大小 (bytes)
  contentMatch?: string;  // 文件内容搜索 (grep)
}

export interface FileSearchResult {
  path: string;
  name: string;
  size: number;
  modified: string;
  isDirectory: boolean;
  matchType: 'name' | 'content';
  contentSnippet?: string;
}

/**
 * 远程文件搜索
 */
export async function searchRemoteFiles(options: FileSearchOptions): Promise<FileSearchResult[]> {
  const {
    pattern,
    basePath,
    maxDepth = 5,
    fileType = 'all',
    maxResults = 200,
    modifiedWithin,
    minSize,
    maxSize,
    contentMatch,
  } = options;

  // 构建 find 命令
  const parts: string[] = ['find', `"${basePath}"`];

  // 深度限制
  parts.push(`-maxdepth ${maxDepth}`);

  // 文件类型
  if (fileType === 'file') parts.push('-type f');
  else if (fileType === 'directory') parts.push('-type d');

  // 文件名匹配
  if (pattern) {
    parts.push(`-name "${pattern}"`);
  }

  // 修改时间
  if (modifiedWithin) {
    parts.push(`-mtime -${modifiedWithin}`);
  }

  // 文件大小
  if (minSize !== undefined) {
    parts.push(`-size +${minSize}c`);
  }
  if (maxSize !== undefined) {
    parts.push(`-size -${maxSize}c`);
  }

  // 格式化输出
  parts.push(`-printf '%s|%T+|%y|%p\\n'`);
  parts.push(`2>/dev/null`);
  parts.push(`| head -${maxResults}`);

  const findCmd = parts.join(' ');

  try {
    const result: any = await invoke('ssh_execute_command_direct', { command: findCmd });
    const output = result?.output || '';
    const results: FileSearchResult[] = [];

    for (const line of output.split('\n').filter(Boolean)) {
      const [size, modified, type, ...pathParts] = line.split('|');
      const path = pathParts.join('|');
      if (!path) continue;

      const name = path.split('/').pop() || path;
      results.push({
        path,
        name,
        size: parseInt(size) || 0,
        modified: modified || '',
        isDirectory: type === 'd',
        matchType: 'name',
      });
    }

    // 内容搜索
    if (contentMatch && results.length < maxResults) {
      const grepCmd = `grep -rl "${contentMatch.replace(/"/g, '\\"')}" "${basePath}" --include="${pattern || '*'}" -m ${maxResults} 2>/dev/null | head -${maxResults}`;
      try {
        const grepResult: any = await invoke('ssh_execute_command_direct', { command: grepCmd });
        const grepOutput = grepResult?.output || '';
        for (const filePath of grepOutput.split('\n').filter(Boolean)) {
          if (!results.some(r => r.path === filePath)) {
            const fileName = filePath.split('/').pop() || filePath;
            results.push({
              path: filePath,
              name: fileName,
              size: 0,
              modified: '',
              isDirectory: false,
              matchType: 'content',
              contentSnippet: contentMatch,
            });
          }
        }
      } catch { /* grep failed, ignore */ }
    }

    return results;
  } catch (e) {
    console.error('远程文件搜索失败:', e);
    throw new Error(`搜索失败: ${e}`);
  }
}

// ========== 批量操作进度 ==========

export interface TransferProgress {
  id: string;
  filename: string;
  direction: 'upload' | 'download';
  totalBytes: number;
  transferredBytes: number;
  percent: number;
  speed: number;           // bytes/s
  status: 'pending' | 'transferring' | 'completed' | 'failed';
  error?: string;
  startTime: number;
}

export class TransferQueue {
  private queue: TransferProgress[] = [];
  private listeners: Array<(queue: TransferProgress[]) => void> = [];

  /** 添加传输任务 */
  addTransfer(filename: string, direction: 'upload' | 'download', totalBytes: number): string {
    const id = `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const item: TransferProgress = {
      id, filename, direction, totalBytes,
      transferredBytes: 0,
      percent: 0,
      speed: 0,
      status: 'pending',
      startTime: Date.now(),
    };
    this.queue.push(item);
    this.notify();
    return id;
  }

  /** 更新传输进度 */
  updateProgress(id: string, transferred: number): void {
    const item = this.queue.find(t => t.id === id);
    if (!item) return;

    item.transferredBytes = transferred;
    item.percent = item.totalBytes > 0 ? Math.round((transferred / item.totalBytes) * 100) : 0;
    const elapsed = (Date.now() - item.startTime) / 1000;
    item.speed = elapsed > 0 ? transferred / elapsed : 0;
    item.status = 'transferring';
    this.notify();
  }

  /** 标记完成 */
  markCompleted(id: string): void {
    const item = this.queue.find(t => t.id === id);
    if (item) {
      item.status = 'completed';
      item.percent = 100;
      item.transferredBytes = item.totalBytes;
      this.notify();
    }
  }

  /** 标记失败 */
  markFailed(id: string, error: string): void {
    const item = this.queue.find(t => t.id === id);
    if (item) {
      item.status = 'failed';
      item.error = error;
      this.notify();
    }
  }

  /** 获取活动传输 */
  getActiveTransfers(): TransferProgress[] {
    return this.queue.filter(t => t.status === 'pending' || t.status === 'transferring');
  }

  /** 获取所有传输 */
  getAll(): TransferProgress[] {
    return [...this.queue];
  }

  /** 清除已完成 */
  clearCompleted(): void {
    this.queue = this.queue.filter(t => t.status !== 'completed' && t.status !== 'failed');
    this.notify();
  }

  /** 监听变化 */
  onChange(fn: (queue: TransferProgress[]) => void): void {
    this.listeners.push(fn);
  }

  /** 移除监听 */
  offChange(fn: (queue: TransferProgress[]) => void): void {
    this.listeners = this.listeners.filter(f => f !== fn);
  }

  private notify(): void {
    this.listeners.forEach(fn => fn([...this.queue]));
  }

  /** 格式化速度 */
  static formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec >= 1024 * 1024) return `${(bytesPerSec / 1024 / 1024).toFixed(1)} MB/s`;
    if (bytesPerSec >= 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    return `${bytesPerSec.toFixed(0)} B/s`;
  }

  /** 格式化文件大小 */
  static formatSize(bytes: number): string {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  }
}

export const transferQueue = new TransferQueue();
