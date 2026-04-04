/**
 * 取证快照管理器
 * 一键采集系统状态快照，支持快照对比
 */

import { invoke } from '@tauri-apps/api/core';

// ========== 数据类型 ==========

export interface ForensicSnapshot {
  id: string;
  timestamp: Date;
  server: string;
  data: SnapshotData;
}

export interface SnapshotData {
  processes: string;
  networkConnections: string;
  listeningPorts: string;
  loginHistory: string;
  cronJobs: string;
  startupServices: string;
  authorizedKeys: string;
  sudoers: string;
  runningUsers: string;
  loadedModules: string;
  recentModifiedFiles: string;
  envVariables: string;
}

// 快照采集命令
const SNAPSHOT_COMMANDS: Record<keyof SnapshotData, string> = {
  processes:            'ps auxf 2>/dev/null | head -200',
  networkConnections:   'ss -tunap 2>/dev/null || netstat -tunap 2>/dev/null | head -100',
  listeningPorts:       'ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null',
  loginHistory:         'last -20 2>/dev/null; echo "---"; w 2>/dev/null',
  cronJobs:             '(crontab -l 2>/dev/null; echo "===root==="; sudo crontab -l 2>/dev/null; echo "===/etc/crontab==="; cat /etc/crontab 2>/dev/null) | head -100',
  startupServices:      'systemctl list-unit-files --type=service --state=enabled 2>/dev/null || chkconfig --list 2>/dev/null | head -50',
  authorizedKeys:       'find /home /root -name authorized_keys -exec echo "=== {} ===" \\; -exec cat {} \\; 2>/dev/null | head -50',
  sudoers:              'sudo cat /etc/sudoers 2>/dev/null | grep -v "^#" | grep -v "^$" | head -30',
  runningUsers:         'who 2>/dev/null; echo "---"; id 2>/dev/null',
  loadedModules:        'lsmod 2>/dev/null | head -50',
  recentModifiedFiles:  'find /etc /usr/bin /usr/sbin -mtime -3 -type f 2>/dev/null | head -50',
  envVariables:         'env 2>/dev/null | sort | head -60',
};

// ========== 管理器 ==========

export class ForensicManager {
  private snapshots: ForensicSnapshot[] = [];

  /** 采集一次完整快照 */
  async captureSnapshot(server: string, onProgress?: (pct: number, label: string) => void): Promise<ForensicSnapshot> {
    const keys = Object.keys(SNAPSHOT_COMMANDS) as (keyof SnapshotData)[];
    const data: Partial<SnapshotData> = {};

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const label = key.replace(/([A-Z])/g, ' $1').trim();
      onProgress?.(Math.round((i / keys.length) * 100), label);

      try {
        const result: any = await invoke('ssh_execute_dashboard_command_direct', {
          command: SNAPSHOT_COMMANDS[key],
        });
        data[key] = result?.output?.trim() || '(empty)';
      } catch {
        data[key] = '(failed to collect)';
      }
    }
    onProgress?.(100, '完成');

    const snapshot: ForensicSnapshot = {
      id: `snap-${Date.now()}`,
      timestamp: new Date(),
      server,
      data: data as SnapshotData,
    };

    this.snapshots.push(snapshot);
    // 持久化到 localStorage
    this.saveToStorage();
    return snapshot;
  }

  /** 获取所有快照 */
  getSnapshots(): ForensicSnapshot[] {
    return [...this.snapshots];
  }

  /** 比对两个快照并返回差异 */
  diffSnapshots(a: ForensicSnapshot, b: ForensicSnapshot): Record<keyof SnapshotData, { added: string[]; removed: string[] }> {
    const result = {} as Record<keyof SnapshotData, { added: string[]; removed: string[] }>;
    const keys = Object.keys(a.data) as (keyof SnapshotData)[];

    for (const key of keys) {
      const linesA = new Set(a.data[key].split('\n').map(l => l.trim()).filter(Boolean));
      const linesB = new Set(b.data[key].split('\n').map(l => l.trim()).filter(Boolean));
      const added = [...linesB].filter(l => !linesA.has(l));
      const removed = [...linesA].filter(l => !linesB.has(l));
      result[key] = { added, removed };
    }

    return result;
  }

  /** 导出快照为 JSON */
  exportSnapshot(snapshot: ForensicSnapshot): void {
    const json = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forensic-snapshot-${snapshot.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ========== 存储 ==========

  private saveToStorage(): void {
    try {
      // 只保留最近 10 个快照
      const recent = this.snapshots.slice(-10);
      localStorage.setItem('lovelyres-forensic-snapshots', JSON.stringify(recent));
    } catch { /* quota exceeded, ignore */ }
  }

  loadFromStorage(): void {
    try {
      const raw = localStorage.getItem('lovelyres-forensic-snapshots');
      if (raw) {
        this.snapshots = JSON.parse(raw);
      }
    } catch { /* ignore */ }
  }
}

export const forensicManager = new ForensicManager();
