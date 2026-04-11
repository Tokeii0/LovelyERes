/**
 * 修复历史管理器 — 记录所有检测修复操作，支持回滚
 */

import { invoke } from '@tauri-apps/api/core';

export interface FixHistoryEntry {
  id: string;
  timestamp: number;
  detectionItemId: string;
  findingTitle: string;
  fixTitle: string;
  type: 'baseline' | 'command' | 'snippet';
  baselineItemId?: string;
  beforeValue?: string;
  afterValue?: string;
  backupInfo?: string;      // 备份文件路径或命令
  restoreCommand?: string;  // 回滚命令
  command?: string;
  output: string;
  success: boolean;
  rolledBack: boolean;
  server: string;
}

const STORAGE_KEY = 'detection-fix-history';
const MAX_ENTRIES = 200;

class FixHistoryManager {
  private history: FixHistoryEntry[] = [];
  private loaded = false;

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) this.history = JSON.parse(raw);
    } catch { this.history = []; }
  }

  private save(): void {
    if (this.history.length > MAX_ENTRIES) this.history = this.history.slice(-MAX_ENTRIES);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.history)); } catch { /* ignore */ }
  }

  addEntry(entry: Omit<FixHistoryEntry, 'id' | 'timestamp' | 'rolledBack'>): FixHistoryEntry {
    this.load();
    const full: FixHistoryEntry = {
      ...entry,
      id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: Date.now(),
      rolledBack: false,
    };
    this.history.push(full);
    this.save();
    return full;
  }

  getHistory(): FixHistoryEntry[] {
    this.load();
    return [...this.history].reverse();
  }

  getForDetection(detectionItemId: string): FixHistoryEntry[] {
    this.load();
    return this.history.filter(e => e.detectionItemId === detectionItemId).reverse();
  }

  async rollback(entryId: string): Promise<{ success: boolean; output: string }> {
    this.load();
    const entry = this.history.find(e => e.id === entryId);
    if (!entry) return { success: false, output: '记录不存在' };
    if (entry.rolledBack) return { success: false, output: '已回滚过' };
    if (!entry.restoreCommand) return { success: false, output: '无回滚命令' };

    try {
      const result = await invoke('ssh_execute_command_direct', { command: entry.restoreCommand }) as any;
      const output = result?.output || '';
      entry.rolledBack = true;
      this.save();
      return { success: true, output };
    } catch (e) {
      return { success: false, output: `回滚失败: ${e}` };
    }
  }

  markRolledBack(entryId: string): void {
    this.load();
    const e = this.history.find(x => x.id === entryId);
    if (e) { e.rolledBack = true; this.save(); }
  }

  clear(): void {
    this.history = [];
    this.save();
  }

  getCount(): number {
    this.load();
    return this.history.length;
  }

  exportAll(): string {
    this.load();
    return this.history.map(e =>
      `[${new Date(e.timestamp).toLocaleString()}] ${e.success ? 'OK' : 'FAIL'} ${e.fixTitle}\n  ${e.detectionItemId}: ${e.beforeValue || ''} -> ${e.afterValue || ''}\n  ${e.output.substring(0, 200)}`
    ).join('\n\n');
  }
}

export const fixHistoryManager = new FixHistoryManager();
