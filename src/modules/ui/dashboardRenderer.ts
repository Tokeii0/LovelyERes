/**
 * 系统信息仪表盘渲染器
 * 负责渲染系统监控信息和统计数据
 */

import type { SystemInfo } from '../ssh/sshManager';
import { sshConnectionManager } from '../remote/sshConnectionManager';
import {
  Computer,
  TrendTwo,
  Earth,
  LinkOne,
  SettingTwo,
  Peoples,
  Dashboard as DashboardIcon,
  Refresh
} from '@icon-park/svg';

export class DashboardRenderer {
  private charts: Map<string, any> = new Map();
  private currentTheme: string = 'dark';
  private history: {
    cpu: { x: number; y: number }[];
    memory: { x: number; y: number }[];
    network: { rx: { x: number; y: number }[]; tx: { x: number; y: number }[] };
  } = {
      cpu: [],
      memory: [],
      network: { rx: [], tx: [] }
    };
  private lastNetworkData: { rx: number; tx: number; timestamp: number } | null = null;

  constructor() {
    // Expose this instance to window for the trigger hack
    (window as any).dashboardRendererInstance = this;
  }

  /**
   * 渲染系统信息仪表盘
   */
  renderDashboard(systemInfo?: SystemInfo, theme: string = 'dark'): string {
    this.currentTheme = theme;
    const isConnected = sshConnectionManager.isConnected();

    if (!systemInfo || !isConnected) {
      return this.renderEmptyDashboard();
    }

    // Update history data
    this.updateHistory(systemInfo);

    // Trigger chart initialization after render
    const triggerScript = `<img src="x" style="display:none" onerror="if(window.dashboardRendererInstance) window.dashboardRendererInstance.initCharts()" />`;

    return `
      <div class="dashboard-container">
        <div class="dashboard-header">
          <div class="header-left">
            <div class="header-icon">
              ${DashboardIcon({ theme: 'filled', size: '24', fill: 'currentColor' })}
            </div>
            <div class="header-info">
              <h2>系统监控仪表盘</h2>
              <div class="last-update">
                <span>最后更新: ${this.formatTime(systemInfo.lastUpdate)}</span>
                <span class="separator">•</span>
                <span>自动刷新: 30秒</span>
              </div>
            </div>
          </div>
          <button class="modern-btn secondary refresh-btn" onclick="window.loadSystemDetailedInfo(true)">
            ${Refresh({ theme: 'outline', size: '14', fill: 'currentColor' })}
            <span>刷新数据</span>
          </button>
        </div>

        <!-- 关键指标概览 (Top Row) -->
        <div class="metrics-overview">
          ${this.renderMetricCard('CPU使用率', this.getCpuUsage(systemInfo), '%', 'warning')}
          ${this.renderMetricCard('内存使用率', this.getMemoryUsage(systemInfo), '%', 'primary')}
          ${this.renderMetricCard('磁盘使用率', this.getDiskUsage(systemInfo), '%', 'error')}
          ${this.renderMetricCard('网络连接', systemInfo.networkConnections.toString(), '个', 'success')}
        </div>

        <!-- Bento Grid Layout -->
        <div class="dashboard-grid-bento">
          
          <!-- Row 1: Real-time Trends -->
          <div class="dashboard-card modern-card span-2 chart-cpu-memory">
            <div class="card-header">
              <div class="card-icon blue">
                ${TrendTwo({ theme: 'filled', size: '18', fill: 'currentColor' })}
              </div>
              <h3>CPU & 内存趋势</h3>
            </div>
            <div class="card-content chart-container">
              <div id="chart-cpu-memory"></div>
            </div>
          </div>

          <div class="dashboard-card modern-card chart-network">
             <div class="card-header">
              <div class="card-icon green">
                ${Earth({ theme: 'filled', size: '18', fill: 'currentColor' })}
              </div>
              <h3>网络流量实时监控</h3>
            </div>
            <div class="card-content chart-container">
              <div id="chart-network"></div>
            </div>
          </div>

          <!-- Row 2: Distribution & Details -->
          <div class="dashboard-card modern-card chart-disk">
            <div class="card-header">
              <div class="card-icon purple">
                ${Computer({ theme: 'filled', size: '18', fill: 'currentColor' })}
              </div>
              <h3>磁盘空间分布</h3>
            </div>
            <div class="card-content chart-container">
              <div id="chart-disk"></div>
              <div class="diinfo-text">
                 <span class="dipercentage">${systemInfo.diskUsage.percentage}</span>
                 <span class="dilabel">已使用</span>
              </div>
            </div>
          </div>

          <div class="dashboard-card modern-card chart-load">
            <div class="card-header">
              <div class="card-icon orange">
                ${SettingTwo({ theme: 'filled', size: '18', fill: 'currentColor' })}
              </div>
              <h3>系统负载 (Load Average)</h3>
            </div>
            <div class="card-content chart-container">
              <div id="chart-load"></div>
            </div>
          </div>

          <div class="dashboard-card modern-card metric-card">
             <div class="card-header">
              <div class="card-icon secondary">
                ${Peoples({ theme: 'filled', size: '18', fill: 'currentColor' })}
              </div>
              <h3>系统概览</h3>
            </div>
            <div class="card-content">
               <div class="info-list">
                <div class="info-item">
                  <span class="label">主机名</span>
                  <span class="value">${systemInfo.hostname}</span>
                </div>
                <div class="info-item">
                  <span class="label">运行时间</span>
                  <span class="value">${systemInfo.uptime}</span>
                </div>
                <div class="info-item">
                  <span class="label">CPU型号</span>
                  <span class="value" title="${systemInfo.cpuInfo.model}">
                    ${this.truncateText(systemInfo.cpuInfo.model, 20)}
                  </span>
                </div>
                 <div class="info-item">
                  <span class="label">核心数</span>
                  <span class="value">${systemInfo.cpuInfo.cores} 核</span>
                </div>
                 <div class="info-item">
                  <span class="label">进程数</span>
                  <span class="value">${systemInfo.processCount}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
      ${triggerScript}
    `;
  }

  /**
   * Initialize ApexCharts
   */
  public initCharts() {
    // Check if ApexCharts is loaded
    if (typeof ApexCharts === 'undefined') {
      console.warn('ApexCharts not loaded yet.');
      return;
    }

    // Destroy existing charts
    this.charts.forEach(chart => {
      try {
        chart.destroy();
      } catch (e) {
        console.warn('Failed to destroy chart:', e);
      }
    });
    this.charts.clear();

    this.initCpuMemoryChart();
    this.initNetworkChart();
    this.initDiskChart();
    this.initLoadChart();
  }

  private getThemeOptions() {
    const isDark = this.currentTheme === 'dark';
    return {
      mode: isDark ? 'dark' : 'light',
      textColor: isDark ? '#94a3b8' : '#475569',
      gridColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      dataLabelColor: isDark ? '#fff' : '#1e293b'
    };
  }

  private initCpuMemoryChart() {
    const themeOpts = this.getThemeOptions();
    const options = {
      series: [{
        name: 'CPU使用率',
        data: this.history.cpu
      }, {
        name: '内存使用率',
        data: this.history.memory
      }],
      chart: {
        type: 'area',
        height: '100%',
        fontFamily: 'inherit',
        background: 'transparent',
        toolbar: { show: false },
        animations: { enabled: true, easing: 'linear', dynamicAnimation: { speed: 1000 } }
      },
      colors: ['#F59E0B', '#3B82F6'],
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 2 },
      fill: { type: 'gradient', gradient: { opacityFrom: 0.5, opacityTo: 0.1 } },
      xaxis: {
        type: 'datetime',
        labels: { show: false },
        tooltip: { enabled: false },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        max: 100,
        min: 0,
        labels: { style: { colors: themeOpts.textColor } }
      },
      grid: {
        borderColor: themeOpts.gridColor,
        strokeDashArray: 4,
        padding: { top: 0, right: 0, bottom: 0, left: 10 }
      },
      theme: { mode: themeOpts.mode },
      legend: { position: 'top', horizontalAlign: 'right' }
    };

    const chart = new ApexCharts(document.querySelector("#chart-cpu-memory"), options);
    chart.render();
    this.charts.set('cpu-memory', chart);
  }

  private initNetworkChart() {
    const themeOpts = this.getThemeOptions();
    const options = {
      series: [{
        name: '接收 (RX)',
        data: this.history.network.rx
      }, {
        name: '发送 (TX)',
        data: this.history.network.tx
      }],
      chart: {
        type: 'line',
        height: '100%',
        fontFamily: 'inherit',
        background: 'transparent',
        toolbar: { show: false },
        animations: { enabled: true, easing: 'linear', dynamicAnimation: { speed: 1000 } }
      },
      colors: ['#10B981', '#8B5CF6'],
      dataLabels: { enabled: false },
      stroke: { curve: 'monotoneCubic', width: 2 },
      xaxis: {
        type: 'datetime',
        labels: { show: false },
        tooltip: { enabled: false },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        labels: {
          style: { colors: themeOpts.textColor },
          formatter: (value: number) => {
            if (value >= 1024) {
              return (value / 1024).toFixed(1) + ' MB/s';
            }
            return value.toFixed(1) + ' KB/s';
          }
        }
      },
      grid: {
        borderColor: themeOpts.gridColor,
        strokeDashArray: 4,
        padding: { top: 0, right: 0, bottom: 0, left: 10 }
      },
      theme: { mode: themeOpts.mode },
      legend: { position: 'top', horizontalAlign: 'right' }
    };

    const chart = new ApexCharts(document.querySelector("#chart-network"), options);
    chart.render();
    this.charts.set('network', chart);
  }

  private initDiskChart() {
    const systemInfo = (this as any).currentSystemInfo;
    if (!systemInfo) return;

    const themeOpts = this.getThemeOptions();
    const diskUsed = parseFloat(systemInfo.diskUsage.percentage.replace('%', ''));
    const diskFree = 100 - diskUsed;

    const options = {
      series: [diskUsed, diskFree],
      labels: ['已用', '可用'],
      chart: { type: 'donut', height: '100%', fontFamily: 'inherit', background: 'transparent' },
      colors: ['#EF4444', '#10B981'],
      plotOptions: {
        pie: {
          donut: {
            size: '75%',
            labels: { show: false }
          }
        }
      },
      dataLabels: { enabled: false },
      legend: { position: 'bottom', fontSize: '12px', markers: { width: 8, height: 8 } },
      theme: { mode: themeOpts.mode },
      stroke: { show: false }
    };
    const chart = new ApexCharts(document.querySelector("#chart-disk"), options);
    chart.render();
    this.charts.set('disk', chart);
  }

  private initLoadChart() {
    const systemInfo = (this as any).currentSystemInfo;
    if (!systemInfo) return;

    const themeOpts = this.getThemeOptions();
    const load = systemInfo.loadAverage.map((v: string) => parseFloat(v));
    const options = {
      series: [{ name: '负载', data: load }],
      chart: { type: 'bar', height: '100%', fontFamily: 'inherit', background: 'transparent', toolbar: { show: false } },
      colors: ['#8B5CF6'],
      plotOptions: { bar: { borderRadius: 4, horizontal: false, columnWidth: '40%', distributed: true } },
      xaxis: {
        categories: ['1分钟', '5分钟', '15分钟'],
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { colors: themeOpts.textColor } }
      },
      yaxis: { show: false },
      grid: { show: false },
      dataLabels: { enabled: true, style: { colors: [themeOpts.dataLabelColor] }, offsetY: -20 },
      theme: { mode: themeOpts.mode },
      legend: { show: false }
    };
    const chart = new ApexCharts(document.querySelector("#chart-load"), options);
    chart.render();
    this.charts.set('load', chart);
  }

  private updateHistory(systemInfo: SystemInfo) {
    const now = new Date().getTime();

    // CPU
    const cpuUsage = parseFloat(this.getCpuUsage(systemInfo));
    this.history.cpu.push({ x: now, y: cpuUsage });
    if (this.history.cpu.length > 60) this.history.cpu.shift();

    // Memory
    const memUsage = parseFloat(this.getMemoryUsage(systemInfo));
    this.history.memory.push({ x: now, y: memUsage });
    if (this.history.memory.length > 60) this.history.memory.shift();

    // Network Speed Calculation
    let rxSpeed = 0;
    let txSpeed = 0;

    if (this.lastNetworkData && systemInfo.networkInfo) {
      const timeDiff = (now - this.lastNetworkData.timestamp) / 1000; // seconds
      if (timeDiff > 0) {
        const rxDiff = systemInfo.networkInfo.rxBytes - this.lastNetworkData.rx;
        const txDiff = systemInfo.networkInfo.txBytes - this.lastNetworkData.tx;

        // Calculate KB/s
        rxSpeed = Math.max(0, rxDiff / 1024 / timeDiff);
        txSpeed = Math.max(0, txDiff / 1024 / timeDiff);
      }
    }

    // Update last network data
    if (systemInfo.networkInfo) {
      this.lastNetworkData = {
        rx: systemInfo.networkInfo.rxBytes,
        tx: systemInfo.networkInfo.txBytes,
        timestamp: now
      };
    }

    this.history.network.rx.push({ x: now, y: rxSpeed });
    this.history.network.tx.push({ x: now, y: txSpeed });
    if (this.history.network.rx.length > 60) this.history.network.rx.shift();
    if (this.history.network.tx.length > 60) this.history.network.tx.shift();

    // Store current system info for static charts
    (this as any).currentSystemInfo = systemInfo;

    // If charts exist, update them
    // this.updateCharts();
  }

  private updateCharts() {
    if (this.charts.has('cpu-memory')) {
      this.charts.get('cpu-memory').updateSeries([{
        data: this.history.cpu
      }, {
        data: this.history.memory
      }]);
    }
    if (this.charts.has('network')) {
      this.charts.get('network').updateSeries([{
        data: this.history.network.rx
      }, {
        data: this.history.network.tx
      }]);
    }

    const systemInfo = (this as any).currentSystemInfo;
    if (systemInfo) {
      // Disk Chart - Update if exists
      if (this.charts.has('disk')) {
        const diskUsed = parseFloat(systemInfo.diskUsage.percentage.replace('%', ''));
        const diskFree = 100 - diskUsed;
        this.charts.get('disk').updateSeries([diskUsed, diskFree]);
      } else {
        // Initialize if not exists (should be handled by initCharts but just in case)
        this.initDiskChart();
      }

      // Load Chart - Update if exists
      if (this.charts.has('load')) {
        const load = systemInfo.loadAverage.map((v: string) => parseFloat(v));
        this.charts.get('load').updateSeries([{ data: load }]);
      } else {
        this.initLoadChart();
      }
    }
  }

  /**
   * 渲染空仪表盘
   */
  private renderEmptyDashboard(): string {
    return `
      <div class="dashboard-empty">
        <div class="empty-state-icon">
          ${DashboardIcon({ theme: 'filled', size: '48', fill: 'currentColor' })}
        </div>
        <h3>系统监控仪表盘</h3>
        <p>请先连接到Linux服务器以查看系统监控信息。连接成功后，这里将显示详细的系统状态和性能指标。</p>
        <button class="modern-btn primary" onclick="window.showServerModal()">
          ${LinkOne({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>连接服务器</span>
        </button>
      </div>
    `;
  }

  /**
   * 截断文本
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  /**
   * 格式化时间
   */
  private formatTime(date: Date): string {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * 渲染指标卡片
   */
  private renderMetricCard(title: string, value: string, unit: string, type: string): string {
    return `
      <div class="metric-card ${type}">
        <div class="metric-header">
          <span class="metric-title">${title}</span>
        </div>
        <div class="metric-content">
          <span class="metric-value">${value}</span>
          <span class="metric-unit">${unit}</span>
        </div>
      </div>
    `;
  }

  /**
   * 获取CPU使用率
   */
  private getCpuUsage(systemInfo: SystemInfo): string {
    // 从cpuInfo.usage中提取数字
    const usage = systemInfo.cpuInfo.usage.replace('%', '');
    return parseFloat(usage).toFixed(1);
  }

  /**
   * 获取内存使用率
   */
  private getMemoryUsage(systemInfo: SystemInfo): string {
    const total = this.parseMemoryValue(systemInfo.memoryUsage.total);
    const used = this.parseMemoryValue(systemInfo.memoryUsage.used);
    return ((used / total) * 100).toFixed(1);
  }

  /**
   * 获取磁盘使用率
   */
  private getDiskUsage(systemInfo: SystemInfo): string {
    return systemInfo.diskUsage.percentage.replace('%', '');
  }

  /**
   * 解析内存值
   */
  private parseMemoryValue(memStr: string): number {
    const value = parseFloat(memStr.replace(/[^\d.]/g, ''));
    if (memStr.includes('GB')) return value * 1024;
    return value;
  }
}

// Declare ApexCharts global
declare var ApexCharts: any;
