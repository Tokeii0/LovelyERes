/**
 * 实时系统监控管理器
 * 提供 CPU/内存/磁盘/网络的定时轮询与数据缓存
 */

import { invoke } from '@tauri-apps/api/core';
import { eventBus } from '../core/eventBus';

// ========== 数据类型 ==========

export interface SystemMetrics {
  timestamp: number;
  cpu: { usage: number; cores: number };
  memory: { total: number; used: number; available: number; percent: number };
  disk: { total: number; used: number; available: number; percent: number };
  network: { rxBytes: number; txBytes: number; rxRate: number; txRate: number };
  load: { load1: number; load5: number; load15: number };
  uptime: string;
}

export interface MetricsHistory {
  timestamps: number[];
  cpu: number[];
  memory: number[];
  disk: number[];
  rxRate: number[];
  txRate: number[];
  load1: number[];
}

// ========== 监控管理器 ==========

export class LiveMonitor {
  private static instance: LiveMonitor;
  private intervalId: number | null = null;
  private isPolling = false;
  private history: MetricsHistory = {
    timestamps: [], cpu: [], memory: [], disk: [],
    rxRate: [], txRate: [], load1: [],
  };
  private readonly MAX_HISTORY = 60; // 保留最近 60 个采样点
  private lastMetrics: SystemMetrics | null = null;
  private lastNetRx = 0;
  private lastNetTx = 0;
  private lastNetTime = 0;
  private listeners: Array<(m: SystemMetrics, h: MetricsHistory) => void> = [];

  private constructor() {}

  static getInstance(): LiveMonitor {
    if (!LiveMonitor.instance) {
      LiveMonitor.instance = new LiveMonitor();
    }
    return LiveMonitor.instance;
  }

  /** 添加监听器 */
  onUpdate(fn: (m: SystemMetrics, h: MetricsHistory) => void): void {
    this.listeners.push(fn);
  }

  /** 移除监听器 */
  offUpdate(fn: (m: SystemMetrics, h: MetricsHistory) => void): void {
    this.listeners = this.listeners.filter(f => f !== fn);
  }

  /** 启动定时采集 */
  start(intervalMs = 5000): void {
    if (this.intervalId) return;
    console.log(`📊 实时监控启动 (每 ${intervalMs / 1000}s)`);

    // 立即采集一次
    this.poll();

    this.intervalId = window.setInterval(() => this.poll(), intervalMs);
    eventBus.emit('dashboard:autoRefreshStart');
  }

  /** 停止采集 */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('📊 实时监控已停止');
      eventBus.emit('dashboard:autoRefreshStop');
    }
  }

  get running(): boolean {
    return this.intervalId !== null;
  }

  get latest(): SystemMetrics | null {
    return this.lastMetrics;
  }

  get metricsHistory(): MetricsHistory {
    return this.history;
  }

  // ========== 内部方法 ==========

  private async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const raw = await this.fetchMetrics();
      if (raw) {
        this.lastMetrics = raw;
        this.pushHistory(raw);
        this.notify(raw);
      }
    } catch (e) {
      console.warn('📊 监控采集异常:', e);
    } finally {
      this.isPolling = false;
    }
  }

  private async fetchMetrics(): Promise<SystemMetrics | null> {
    const cmd = `
      echo "===CPU==="
      top -bn1 2>/dev/null | head -5
      echo "===MEM==="
      free -m 2>/dev/null | grep -E "^Mem:"
      echo "===DISK==="
      df -h / 2>/dev/null | tail -1
      echo "===NET==="
      cat /proc/net/dev 2>/dev/null | grep -E '(eth|ens|eno|enp|wlan|wlp)' | head -1
      echo "===LOAD==="
      cat /proc/loadavg 2>/dev/null
      echo "===UP==="
      uptime -p 2>/dev/null || uptime
    `.trim();

    try {
      const result: any = await invoke('ssh_execute_dashboard_command_direct', { command: cmd });
      return this.parseMetrics(result?.output || '');
    } catch {
      return null;
    }
  }

  private parseMetrics(output: string): SystemMetrics {
    const now = Date.now();
    const sections = output.split(/===(\w+)===/);
    const get = (key: string) => {
      const idx = sections.indexOf(key);
      return idx >= 0 ? sections[idx + 1].trim() : '';
    };

    // CPU
    const cpuRaw = get('CPU');
    let cpuUsage = 0;
    let cores = 1;
    const cpuMatch = cpuRaw.match(/%Cpu\(s\):\s*([\d.]+)\s*us/i) || cpuRaw.match(/([\d.]+)\s*%?\s*us/i);
    if (cpuMatch) cpuUsage = parseFloat(cpuMatch[1]);
    // Also try id (idle) and compute usage = 100 - idle
    const idleMatch = cpuRaw.match(/([\d.]+)\s*id/i);
    if (idleMatch && !cpuMatch) cpuUsage = 100 - parseFloat(idleMatch[1]);
    const coresMatch = cpuRaw.match(/(\d+)\s*total\s.*threads/i); // from /proc/cpuinfo fallback
    if (coresMatch) cores = parseInt(coresMatch[1]);

    // Memory
    const memRaw = get('MEM');
    const memParts = memRaw.split(/\s+/);
    const memTotal = parseInt(memParts[1]) || 0;
    const memUsed = parseInt(memParts[2]) || 0;
    const memAvail = parseInt(memParts[6]) || parseInt(memParts[3]) || 0;

    // Disk
    const diskRaw = get('DISK');
    const diskParts = diskRaw.split(/\s+/);
    const diskPercent = parseInt((diskParts[4] || '0').replace('%', ''));

    // Network
    const netRaw = get('NET');
    const netParts = netRaw.split(/[\s:]+/).filter(Boolean);
    // format: iface rx_bytes rx_packets ... tx_bytes tx_packets ...
    const rxBytes = parseInt(netParts[1]) || 0;
    const txBytes = parseInt(netParts[9]) || 0;
    let rxRate = 0, txRate = 0;
    if (this.lastNetTime > 0) {
      const dt = (now - this.lastNetTime) / 1000;
      if (dt > 0) {
        rxRate = Math.max(0, (rxBytes - this.lastNetRx) / dt);
        txRate = Math.max(0, (txBytes - this.lastNetTx) / dt);
      }
    }
    this.lastNetRx = rxBytes;
    this.lastNetTx = txBytes;
    this.lastNetTime = now;

    // Load
    const loadRaw = get('LOAD');
    const loadParts = loadRaw.split(/\s+/);
    const load1 = parseFloat(loadParts[0]) || 0;
    const load5 = parseFloat(loadParts[1]) || 0;
    const load15 = parseFloat(loadParts[2]) || 0;

    // Uptime
    const uptime = get('UP').trim() || 'unknown';

    return {
      timestamp: now,
      cpu: { usage: cpuUsage, cores },
      memory: { total: memTotal, used: memUsed, available: memAvail, percent: memTotal > 0 ? (memUsed / memTotal * 100) : 0 },
      disk: { total: 0, used: 0, available: 0, percent: diskPercent },
      network: { rxBytes, txBytes, rxRate, txRate },
      load: { load1, load5, load15 },
      uptime,
    };
  }

  private pushHistory(m: SystemMetrics): void {
    const h = this.history;
    h.timestamps.push(m.timestamp);
    h.cpu.push(m.cpu.usage);
    h.memory.push(m.memory.percent);
    h.disk.push(m.disk.percent);
    h.rxRate.push(m.network.rxRate);
    h.txRate.push(m.network.txRate);
    h.load1.push(m.load.load1);

    // 滑动窗口
    if (h.timestamps.length > this.MAX_HISTORY) {
      h.timestamps.shift(); h.cpu.shift(); h.memory.shift();
      h.disk.shift(); h.rxRate.shift(); h.txRate.shift(); h.load1.shift();
    }
  }

  private notify(m: SystemMetrics): void {
    this.listeners.forEach(fn => {
      try { fn(m, this.history); } catch (e) { console.error(e); }
    });
  }
}

export const liveMonitor = LiveMonitor.getInstance();
