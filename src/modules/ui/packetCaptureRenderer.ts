import {
  NetworkTree,
  Play,
  Pause,
  Delete,
  Shield,
  Search,
  Export
} from '@icon-park/svg';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { showAlert } from './confirmDialog';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface PacketEntry {
  id: number;
  timestamp: string;
  protocol: string;
  src: string;
  dst: string;
  length: string;
  info: string;
  raw: string;
}

interface NetworkInterface {
  name: string;
  index: number;
  ips: string[];
}

type PacketTab = 'realtime' | 'statistics' | 'conversations' | 'dns-http' | 'threat';

interface ConversationEntry {
  key: string;
  ipA: string;
  ipB: string;
  packetsAtoB: number;
  packetsBtoA: number;
  totalBytes: number;
  lastSeen: string;
}

interface DnsEntry {
  timestamp: string;
  queryName: string;
  queryType: string;
  responseIp: string;
}

interface HttpEntry {
  timestamp: string;
  method: string;
  url: string;
  status: string;
}

interface ThreatAlert {
  id: number;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium';
  type: string;
  description: string;
  packetId: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const icon = (fn: any, size = '16', theme = 'outline') =>
  fn({ theme, size, fill: 'currentColor' });

const MAX_PACKETS = 5000;

const PRESET_FILTERS = [
  { label: 'HTTP', filter: 'port 80 or port 8080 or port 443' },
  { label: 'DNS', filter: 'port 53' },
  { label: 'ICMP', filter: 'icmp' },
  { label: 'SSH', filter: 'port 22' },
  { label: 'TCP', filter: 'tcp' },
  { label: 'UDP', filter: 'udp' },
];

const C2_PORTS = [4444, 5555, 6666, 8888, 1234, 31337, 9999, 12345];

// ─── Tab configuration ────────────────────────────────────────────────────────

const TAB_CONFIG: { key: PacketTab; label: string }[] = [
  { key: 'realtime', label: '实时抓包' },
  { key: 'statistics', label: '统计分析' },
  { key: 'conversations', label: '会话追踪' },
  { key: 'dns-http', label: 'DNS/HTTP' },
  { key: 'threat', label: '威胁检测' },
];

// ─── Class ────────────────────────────────────────────────────────────────────

export class PacketCaptureRenderer {
  // Core state
  private packets: PacketEntry[] = [];
  private isCapturing = false;
  private interfaces: NetworkInterface[] = [];
  private selectedInterface = '';
  private currentTab: PacketTab = 'realtime';
  private selectedPacketId: number | null = null;
  private searchTerm = '';
  private conversationFilter: string | null = null;
  private iocList: string[] = [];

  // Aggregated statistics
  private protocolCounts: Map<string, number> = new Map();
  private conversations: Map<string, ConversationEntry> = new Map();
  private dnsEntries: DnsEntry[] = [];
  private httpEntries: HttpEntry[] = [];
  private threatAlerts: ThreatAlert[] = [];
  private timelineBuckets: number[] = [];
  private timelineAlertBuckets: Set<number> = new Set();
  private captureStartTime = 0;

  // Rate tracking
  private rateTimestamps: number[] = [];
  private currentPps = 0;
  private rateInterval: number | null = null;
  private statsDebounce: number | null = null;

  // Threat detection trackers
  private portScanTracker: Map<string, Set<string>> = new Map();
  private connectionIntervals: Map<string, number[]> = new Map();
  private ipMacMap: Map<string, Set<string>> = new Map();
  private bytesPerDst: Map<string, number> = new Map();
  private synCount = 0;
  private totalCount = 0;
  private alertIdCounter = 0;
  private iocHitCounts: Map<string, number> = new Map();

  // Internal
  private unlistenFn: (() => void) | null = null;
  private listenersReady = false;
  private boundClickHandler: ((e: MouseEvent) => void) | null = null;
  private boundChangeHandler: ((e: Event) => void) | null = null;
  private initialized = false;

  constructor() {
    (window as any).packetCaptureRenderer = this;
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  public async initialize(): Promise<void> {
    if (this.initialized) return;

    this.boundClickHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const actionEl = target.closest<HTMLElement>('[data-pc-action]');
      if (actionEl) {
        e.preventDefault();
        this.handleAction(actionEl.dataset.pcAction!, actionEl);
      }
    };

    this.boundChangeHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLSelectElement && target.dataset.pcAction === 'select-interface') {
        this.selectedInterface = target.value;
      }
      if (target instanceof HTMLInputElement && target.id === 'pc-search-input') {
        this.searchTerm = target.value.toLowerCase();
        this.refreshPacketList();
      }
    };

    document.addEventListener('click', this.boundClickHandler);
    document.addEventListener('change', this.boundChangeHandler);
    document.addEventListener('input', this.boundChangeHandler);

    await this.setupListeners();

    this.rateInterval = window.setInterval(() => {
      const now = Date.now();
      this.rateTimestamps = this.rateTimestamps.filter(t => now - t < 1000);
      this.currentPps = this.rateTimestamps.length;
      const ppsEl = document.getElementById('pc-pps');
      if (ppsEl) ppsEl.textContent = `${this.currentPps} pkt/s`;
      const totalEl = document.getElementById('pc-total-count');
      if (totalEl) totalEl.textContent = String(this.packets.length);
    }, 1000);

    this.initialized = true;
  }

  private async setupListeners(): Promise<void> {
    if (this.unlistenFn) {
      this.unlistenFn();
    }

    const unlistenData = await listen('packet_capture_data', (event: any) => {
      this.addPacket(event.payload as PacketEntry);
    });

    const unlistenError = await listen('packet_capture_error', (event: any) => {
      console.error('Packet Capture Error:', event.payload);
      this.stopCapture();
      showAlert({ title: '抓包错误', message: `${event.payload}`, type: 'error' });
    });

    const unlistenStop = await listen('packet_capture_stopped', () => {
      this.isCapturing = false;
      this.updateCaptureButtons();
    });

    this.unlistenFn = () => {
      unlistenData();
      unlistenError();
      unlistenStop();
    };
    this.listenersReady = true;
  }

  public destroy(): void {
    if (this.boundClickHandler) {
      document.removeEventListener('click', this.boundClickHandler);
      this.boundClickHandler = null;
    }
    if (this.boundChangeHandler) {
      document.removeEventListener('change', this.boundChangeHandler);
      document.removeEventListener('input', this.boundChangeHandler);
      this.boundChangeHandler = null;
    }
    if (this.rateInterval !== null) {
      clearInterval(this.rateInterval);
      this.rateInterval = null;
    }
    if (this.statsDebounce !== null) {
      clearTimeout(this.statsDebounce);
      this.statsDebounce = null;
    }
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
    this.listenersReady = false;
    this.initialized = false;
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  public async render(): Promise<string> {
    if (!this.listenersReady) {
      await this.setupListeners();
    }

    try {
      const result = await invoke('get_network_interfaces') as NetworkInterface[];
      this.interfaces = Array.isArray(result) ? result : [];
      if (this.interfaces.length > 0 && !this.selectedInterface) {
        this.selectedInterface = this.interfaces[0].name;
      }
    } catch (e) {
      console.error('Failed to load network interfaces:', e);
      this.interfaces = [];
    }

    const interfaceOptions = this.interfaces
      .map(
        iface =>
          `<option value="${iface.name}" ${iface.name === this.selectedInterface ? 'selected' : ''}>${iface.name} (${iface.ips.join(', ')})</option>`
      )
      .join('');

    return `
      <div class="pc-page">
        <div class="pc-header">
          <div class="pc-header-left">
            <div class="pc-header-icon">${icon(NetworkTree, '22', 'filled')}</div>
            <div>
              <h2 class="pc-header-title">网络抓包</h2>
              <div class="pc-header-subtitle">网络流量实时捕获 · 协议分析 · 威胁检测</div>
            </div>
          </div>
          <div class="pc-header-right">
            <select data-pc-action="select-interface">${interfaceOptions}</select>
            <input placeholder="BPF 过滤器..." id="pc-filter-input" class="pc-filter-input" />
            <input type="number" value="0" placeholder="数量" id="pc-count-input" style="width:60px" class="pc-count-input" />
            <button class="modern-btn primary" data-pc-action="start-capture" id="pc-start-btn">${icon(Play)} 开始</button>
            <button class="modern-btn secondary hidden" data-pc-action="stop-capture" id="pc-stop-btn">${icon(Pause)} 停止</button>
            <button class="modern-btn secondary" data-pc-action="clear-packets">${icon(Delete)} 清空</button>
          </div>
        </div>
        <div class="pc-tabs" id="pc-tabs-area">${this.renderTabs()}</div>
        <div class="pc-content" id="pc-content-area">${this.renderCurrentTab()}</div>
      </div>
      ${this.renderStyles()}
    `;
  }

  // ─── Tabs ─────────────────────────────────────────────────────────────────

  private renderTabs(): string {
    return TAB_CONFIG.map(
      t =>
        `<button class="pc-tab-btn ${this.currentTab === t.key ? 'active' : ''}" data-pc-action="switch-tab" data-tab="${t.key}">${t.label}</button>`
    ).join('');
  }

  private renderCurrentTab(): string {
    switch (this.currentTab) {
      case 'realtime':
        return this.renderRealtimeTab();
      case 'statistics':
        return this.renderStatisticsTab();
      case 'conversations':
        return this.renderConversationsTab();
      case 'dns-http':
        return this.renderDnsHttpTab();
      case 'threat':
        return this.renderThreatTab();
      default:
        return '';
    }
  }

  // ─── Realtime Tab ─────────────────────────────────────────────────────────

  private renderRealtimeTab(): string {
    const presetButtons = PRESET_FILTERS.map(
      p =>
        `<button class="pc-preset-btn" data-pc-action="preset-filter" data-filter="${p.filter}">${p.label}</button>`
    ).join('');

    const convFilterBtn = this.conversationFilter
      ? `<button class="pc-preset-btn active" data-pc-action="clear-conv-filter">清除会话过滤 ✕</button>`
      : '';

    const protoBar = this.buildMiniProtoBar();

    return `
      <div class="pc-split-panel">
        <div class="pc-controls-bar">
          ${presetButtons}
          <div style="flex:1"></div>
          <div class="pc-search-box">
            ${icon(Search, '12')}
            <input placeholder="搜索..." id="pc-search-input" data-pc-action="search" />
          </div>
          <button class="pc-preset-btn" data-pc-action="export-csv">${icon(Export, '12')} CSV</button>
          <button class="pc-preset-btn" data-pc-action="export-json">${icon(Export, '12')} JSON</button>
        </div>
        <div class="pc-stats-bar">
          <div class="pc-stats-item"><span class="pc-stats-label">总计</span><span class="pc-stats-value" id="pc-total-count">${this.packets.length}</span></div>
          <div class="pc-stats-item"><span class="pc-stats-label">速率</span><span class="pc-stats-value" id="pc-pps">${this.currentPps} pkt/s</span></div>
          <div class="pc-stats-item"><span class="pc-stats-label">协议</span><div class="pc-mini-bar" id="pc-proto-bar">${protoBar}</div></div>
          ${convFilterBtn}
        </div>
        <div class="pc-packet-list-area">
          <div class="pc-packet-header">
            <span>No.</span><span>时间</span><span>协议</span><span>源地址</span><span>目标地址</span><span>长度</span><span>信息</span>
          </div>
          <div id="pc-packet-list" style="overflow:auto;flex:1">${this.renderPacketRows()}</div>
        </div>
        <div id="pc-detail-panel" class="pc-detail-panel" style="display:none"></div>
      </div>
    `;
  }

  private renderPacketRows(): string {
    const filtered = this.getFilteredPackets();
    return filtered
      .map(p => this.buildPacketRowHtml(p))
      .join('');
  }

  private getFilteredPackets(): PacketEntry[] {
    let list = this.packets;
    if (this.conversationFilter) {
      list = list.filter(p => {
        const srcIp = this.extractIp(p.src);
        const dstIp = this.extractIp(p.dst);
        if (!srcIp || !dstIp) return false;
        const key = [srcIp, dstIp].sort().join(' <-> ');
        return key === this.conversationFilter;
      });
    }
    if (this.searchTerm) {
      const term = this.searchTerm;
      list = list.filter(
        p =>
          p.protocol.toLowerCase().includes(term) ||
          p.src.toLowerCase().includes(term) ||
          p.dst.toLowerCase().includes(term) ||
          p.info.toLowerCase().includes(term)
      );
    }
    return list;
  }

  private buildPacketRowHtml(packet: PacketEntry): string {
    const proto = (packet.protocol || 'OTHER').toUpperCase();
    const isSelected = this.selectedPacketId === packet.id;
    const iocHit = this.isIocHit(packet);
    const classes = [
      'pc-packet-row',
      `pc-proto-${proto}`,
      isSelected ? 'selected' : '',
      iocHit ? 'ioc-hit' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return `<div class="${classes}" data-pc-action="select-packet" data-packet-id="${packet.id}"><span>${packet.id}</span><span>${packet.timestamp}</span><span>${packet.protocol}</span><span title="${packet.src}">${packet.src}</span><span title="${packet.dst}">${packet.dst}</span><span>${packet.length}</span><span class="pc-info-cell" title="${this.escapeHtml(packet.info)}">${this.escapeHtml(packet.info)}</span></div>`;
  }

  private buildMiniProtoBar(): string {
    const total = [...this.protocolCounts.values()].reduce((a, b) => a + b, 0);
    if (total === 0) return '';
    const colors: Record<string, string> = {
      TCP: '#4a9eff',
      UDP: '#ff9e4a',
      ICMP: '#ff4a9e',
      DNS: '#9e4aff',
      HTTP: '#4aff9e',
      HTTPS: '#4affcc',
      ARP: '#ffd84a',
    };
    return [...this.protocolCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([proto, count]) => {
        const pct = ((count / total) * 100).toFixed(1);
        const color = colors[proto.toUpperCase()] || '#888';
        return `<div class="pc-mini-bar-seg" style="width:${pct}%;background:${color}" title="${proto} ${pct}%"></div>`;
      })
      .join('');
  }

  // ─── Statistics Tab ───────────────────────────────────────────────────────

  private renderStatisticsTab(): string {
    const protoData = [...this.protocolCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([label, value]) => ({ label, value }));

    const srcIpCounts = new Map<string, number>();
    const dstIpCounts = new Map<string, number>();
    const portPairCounts = new Map<string, number>();

    for (const p of this.packets) {
      const srcIp = this.extractIp(p.src);
      const dstIp = this.extractIp(p.dst);
      if (srcIp) srcIpCounts.set(srcIp, (srcIpCounts.get(srcIp) || 0) + 1);
      if (dstIp) dstIpCounts.set(dstIp, (dstIpCounts.get(dstIp) || 0) + 1);
      if (srcIp && dstIp) {
        const srcPort = this.extractPort(p.src) || '?';
        const dstPort = this.extractPort(p.dst) || '?';
        const pair = `${srcIp}:${srcPort} → ${dstIp}:${dstPort}`;
        portPairCounts.set(pair, (portPairCounts.get(pair) || 0) + 1);
      }
    }

    const topSrc = [...srcIpCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }));

    const topDst = [...dstIpCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }));

    const topPairs = [...portPairCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([label, value]) => ({ label, value }));

    return `
      <div class="pc-stats-grid">
        ${this.renderBarChart('协议分布', protoData)}
        ${this.renderBarChart('Top 源 IP', topSrc)}
        ${this.renderBarChart('Top 目标 IP', topDst)}
        ${this.renderBarChart('Top 连接对', topPairs)}
      </div>
    `;
  }

  private renderBarChart(title: string, data: { label: string; value: number; color?: string }[]): string {
    if (data.length === 0) {
      return `<div class="pc-stat-card"><div class="pc-stat-card-title">${title}</div><div class="pc-empty-hint">暂无数据</div></div>`;
    }
    const maxVal = Math.max(...data.map(d => d.value), 1);
    const bars = data
      .map(d => {
        const pct = ((d.value / maxVal) * 100).toFixed(1);
        const color = d.color || 'var(--primary-color, #4a9eff)';
        return `<div class="pc-bar-item"><span class="pc-bar-label" title="${d.label}">${d.label}</span><div class="pc-bar-track"><div class="pc-bar-fill" style="width:${pct}%;background:${color}"></div></div><span class="pc-bar-value">${d.value}</span></div>`;
      })
      .join('');
    return `<div class="pc-stat-card"><div class="pc-stat-card-title">${title}</div><div class="pc-bar-chart">${bars}</div></div>`;
  }

  // ─── Conversations Tab ────────────────────────────────────────────────────

  private renderConversationsTab(): string {
    const entries = [...this.conversations.values()].sort(
      (a, b) => b.totalBytes - a.totalBytes
    );

    if (entries.length === 0) {
      return `<div class="pc-empty-hint" style="padding:40px;text-align:center">暂未捕获到会话数据</div>`;
    }

    const rows = entries
      .map(
        c =>
          `<tr class="pc-conv-row" data-pc-action="filter-conversation" data-conv-key="${c.key}"><td>${c.ipA} ↔ ${c.ipB}</td><td>${c.packetsAtoB}</td><td>${c.packetsBtoA}</td><td>${this.formatBytes(c.totalBytes)}</td><td>${c.lastSeen}</td></tr>`
      )
      .join('');

    return `
      <div class="pc-table-wrap">
        <table class="pc-table">
          <thead><tr><th>IP 对</th><th>A→B</th><th>B→A</th><th>总字节</th><th>最后活跃</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  // ─── DNS / HTTP Tab ───────────────────────────────────────────────────────

  private renderDnsHttpTab(): string {
    const dnsRows =
      this.dnsEntries.length > 0
        ? this.dnsEntries
            .slice(-200)
            .reverse()
            .map(
              d =>
                `<tr><td>${d.timestamp}</td><td>${this.escapeHtml(d.queryName)}</td><td>${d.queryType}</td><td>${d.responseIp}</td></tr>`
            )
            .join('')
        : `<tr><td colspan="4" class="pc-empty-hint">暂未捕获到 DNS 请求</td></tr>`;

    const httpRows =
      this.httpEntries.length > 0
        ? this.httpEntries
            .slice(-200)
            .reverse()
            .map(
              h =>
                `<tr><td>${h.timestamp}</td><td><span class="pc-http-method">${h.method}</span></td><td class="pc-url-cell" title="${this.escapeHtml(h.url)}">${this.escapeHtml(h.url)}</td><td>${h.status}</td></tr>`
            )
            .join('')
        : `<tr><td colspan="4" class="pc-empty-hint">暂未捕获到 HTTP 请求</td></tr>`;

    return `
      <div class="pc-dns-http-wrap">
        <div class="pc-section-title">${icon(Search, '14')} DNS 请求 (${this.dnsEntries.length})</div>
        <div class="pc-table-wrap">
          <table class="pc-table">
            <thead><tr><th>时间</th><th>域名</th><th>类型</th><th>响应 IP</th></tr></thead>
            <tbody>${dnsRows}</tbody>
          </table>
        </div>
        <div class="pc-section-title" style="margin-top:16px">${icon(Shield, '14')} HTTP 请求 (${this.httpEntries.length})</div>
        <div class="pc-table-wrap">
          <table class="pc-table">
            <thead><tr><th>时间</th><th>方法</th><th>URL</th><th>状态</th></tr></thead>
            <tbody>${httpRows}</tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ─── Threat Tab ───────────────────────────────────────────────────────────

  private renderThreatTab(): string {
    return `
      <div class="pc-threat-section">
        <div class="pc-ioc-area">
          <div class="pc-ioc-input-wrap">
            <div style="font-size:13px;font-weight:600;margin-bottom:6px">${icon(Shield, '14')} IOC 实时匹配</div>
            <textarea class="pc-ioc-input" id="pc-ioc-input" placeholder="输入可疑 IP/域名，每行一个">${this.iocList.join('\n')}</textarea>
            <button class="modern-btn primary sm" data-pc-action="apply-ioc" style="margin-top:6px">应用 IOC</button>
          </div>
          <div id="pc-ioc-results" style="flex:1">${this.renderIocResults()}</div>
        </div>
        <div class="pc-threat-cards">${this.renderThreatCards()}</div>
        <div style="font-size:12px;font-weight:600;margin-bottom:4px">带宽时间线</div>
        <div class="pc-timeline" id="pc-timeline">${this.renderTimeline()}</div>
        <div style="font-size:12px;font-weight:600;margin:12px 0 4px">告警详情 (${this.threatAlerts.length})</div>
        <div class="pc-alert-list" id="pc-alert-list">${this.renderAlertList()}</div>
      </div>
    `;
  }

  private renderThreatCards(): string {
    let critical = 0;
    let high = 0;
    let medium = 0;
    for (const a of this.threatAlerts) {
      if (a.severity === 'critical') critical++;
      else if (a.severity === 'high') high++;
      else medium++;
    }
    const normal = Math.max(0, this.packets.length - this.threatAlerts.length);

    return `
      <div class="pc-threat-card critical"><div class="pc-threat-card-num">${critical}</div><div class="pc-threat-card-label">严重</div></div>
      <div class="pc-threat-card high"><div class="pc-threat-card-num">${high}</div><div class="pc-threat-card-label">高危</div></div>
      <div class="pc-threat-card medium"><div class="pc-threat-card-num">${medium}</div><div class="pc-threat-card-label">中危</div></div>
      <div class="pc-threat-card normal"><div class="pc-threat-card-num">${normal}</div><div class="pc-threat-card-label">正常</div></div>
    `;
  }

  private renderTimeline(): string {
    if (this.timelineBuckets.length === 0) {
      return '<div class="pc-empty-hint" style="padding:10px;text-align:center;font-size:11px">暂无数据</div>';
    }
    const maxVal = Math.max(...this.timelineBuckets, 1);
    const bars = this.timelineBuckets
      .map((count, idx) => {
        const h = Math.max(2, (count / maxVal) * 50);
        const isAlert = this.timelineAlertBuckets.has(idx);
        const color = isAlert ? '#ef4444' : 'var(--primary-color, #4a9eff)';
        return `<div class="pc-timeline-bar" style="height:${h}px;background:${color}" title="Bucket ${idx}: ${count} packets"></div>`;
      })
      .join('');
    return bars;
  }

  private renderAlertList(): string {
    if (this.threatAlerts.length === 0) {
      return '<div class="pc-empty-hint" style="padding:20px;text-align:center">暂无威胁告警</div>';
    }
    return this.threatAlerts
      .slice(-50)
      .reverse()
      .map(
        a =>
          `<div class="pc-alert-item ${a.severity}" data-pc-action="goto-packet" data-packet-id="${a.packetId}"><span class="pc-alert-badge ${a.severity}">${a.severity === 'critical' ? '严重' : a.severity === 'high' ? '高危' : '中危'}</span><span class="pc-alert-type">${this.escapeHtml(a.type)}</span><span class="pc-alert-desc">${this.escapeHtml(a.description)}</span><span class="pc-alert-time">${a.timestamp}</span></div>`
      )
      .join('');
  }

  private renderIocResults(): string {
    if (this.iocList.length === 0) {
      return '<div class="pc-empty-hint" style="font-size:11px;padding:10px">未设置 IOC 指标</div>';
    }
    const rows = this.iocList
      .map(ioc => {
        const count = this.iocHitCounts.get(ioc.toLowerCase()) || 0;
        return `<tr><td>${this.escapeHtml(ioc)}</td><td>${count}</td></tr>`;
      })
      .join('');
    return `<table class="pc-table compact"><thead><tr><th>IOC</th><th>命中</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  // ─── Packet Processing (Critical Path) ────────────────────────────────────

  private addPacket(packet: PacketEntry): void {
    this.packets.push(packet);
    if (this.packets.length > MAX_PACKETS) this.packets.shift();
    this.totalCount++;

    // 1. Protocol counts
    const proto = packet.protocol || 'OTHER';
    this.protocolCounts.set(proto, (this.protocolCounts.get(proto) || 0) + 1);

    // 2. Conversations
    const srcIp = this.extractIp(packet.src);
    const dstIp = this.extractIp(packet.dst);
    if (srcIp && dstIp) {
      const sorted = [srcIp, dstIp].sort();
      const key = sorted.join(' <-> ');
      const conv = this.conversations.get(key) || {
        key,
        ipA: sorted[0],
        ipB: sorted[1],
        packetsAtoB: 0,
        packetsBtoA: 0,
        totalBytes: 0,
        lastSeen: '',
      };
      if (srcIp === conv.ipA) conv.packetsAtoB++;
      else conv.packetsBtoA++;
      conv.totalBytes += parseInt(packet.length) || 0;
      conv.lastSeen = packet.timestamp;
      this.conversations.set(key, conv);
    }

    // 3. DNS/HTTP extraction
    this.extractDnsHttp(packet);

    // 4. Threat detection
    this.runThreatDetection(packet, srcIp, dstIp);

    // 5. Timeline
    if (this.captureStartTime > 0) {
      const bucketIdx = Math.floor((Date.now() - this.captureStartTime) / 5000);
      while (this.timelineBuckets.length <= bucketIdx) this.timelineBuckets.push(0);
      this.timelineBuckets[bucketIdx]++;
    }

    // 6. Rate tracking
    this.rateTimestamps.push(Date.now());

    // 7. DOM update (only if on realtime tab)
    if (this.currentTab === 'realtime') {
      this.appendPacketRow(packet);
    }

    // 8. Debounced stats update for non-realtime tabs
    if (this.currentTab !== 'realtime') {
      this.debouncedStatsUpdate();
    }
  }

  private appendPacketRow(packet: PacketEntry): void {
    const container = document.getElementById('pc-packet-list');
    if (!container) return;

    // Check search filter
    if (this.searchTerm) {
      const term = this.searchTerm;
      const matches =
        packet.protocol.toLowerCase().includes(term) ||
        packet.src.toLowerCase().includes(term) ||
        packet.dst.toLowerCase().includes(term) ||
        packet.info.toLowerCase().includes(term);
      if (!matches) return;
    }

    // Check conversation filter
    if (this.conversationFilter) {
      const srcIp = this.extractIp(packet.src);
      const dstIp = this.extractIp(packet.dst);
      if (srcIp && dstIp) {
        const key = [srcIp, dstIp].sort().join(' <-> ');
        if (key !== this.conversationFilter) return;
      } else {
        return;
      }
    }

    const div = document.createElement('div');
    div.innerHTML = this.buildPacketRowHtml(packet);
    const row = div.firstElementChild;
    if (row) {
      container.appendChild(row);
      // Auto-scroll if near bottom
      if (container.scrollHeight - container.scrollTop - container.clientHeight < 100) {
        container.scrollTop = container.scrollHeight;
      }
    }

    // Update mini proto bar
    const protoBar = document.getElementById('pc-proto-bar');
    if (protoBar) protoBar.innerHTML = this.buildMiniProtoBar();
  }

  private debouncedStatsUpdate(): void {
    if (this.statsDebounce !== null) return;
    this.statsDebounce = window.setTimeout(() => {
      this.statsDebounce = null;
      const contentArea = document.getElementById('pc-content-area');
      if (contentArea) {
        contentArea.innerHTML = this.renderCurrentTab();
      }
    }, 2000);
  }

  // ─── Extraction helpers ───────────────────────────────────────────────────

  private extractIp(addr: string): string {
    if (!addr) return '';
    // addr may be like "192.168.1.1.80" or "192.168.1.1" or "fe80::1.443"
    const lastDot = addr.lastIndexOf('.');
    if (lastDot === -1) return addr;
    const suffix = addr.substring(lastDot + 1);
    const port = parseInt(suffix, 10);
    if (!isNaN(port) && port >= 0 && port < 65536 && suffix === String(port)) {
      return addr.substring(0, lastDot);
    }
    return addr;
  }

  private extractPort(addr: string): string | null {
    if (!addr) return null;
    const lastDot = addr.lastIndexOf('.');
    if (lastDot === -1) return null;
    const suffix = addr.substring(lastDot + 1);
    const port = parseInt(suffix, 10);
    if (!isNaN(port) && port >= 0 && port < 65536 && suffix === String(port)) {
      return suffix;
    }
    return null;
  }

  private extractDnsHttp(packet: PacketEntry): void {
    const info = packet.info || '';
    const proto = (packet.protocol || '').toUpperCase();

    // DNS extraction
    if (proto === 'DNS' || packet.src.includes('.53') || packet.dst.includes('.53')) {
      const domainMatches = info.match(/[\w-]+\.[\w.-]+\.\w{2,}/g);
      const ipMatches = info.match(/\d+\.\d+\.\d+\.\d+/g);
      const queryName = domainMatches ? domainMatches[0] : '';
      const responseIp = ipMatches ? ipMatches[ipMatches.length - 1] : '';
      if (queryName) {
        const queryType = info.includes('AAAA')
          ? 'AAAA'
          : info.includes('MX')
          ? 'MX'
          : info.includes('CNAME')
          ? 'CNAME'
          : info.includes('PTR')
          ? 'PTR'
          : 'A';
        this.dnsEntries.push({
          timestamp: packet.timestamp,
          queryName,
          queryType,
          responseIp,
        });
      }
    }

    // HTTP extraction
    if (
      proto === 'HTTP' ||
      proto === 'HTTPS' ||
      packet.src.includes('.80') ||
      packet.dst.includes('.80') ||
      packet.src.includes('.443') ||
      packet.dst.includes('.443')
    ) {
      const methodMatch = info.match(/\b(GET|POST|PUT|DELETE|HEAD|PATCH|OPTIONS)\b/);
      if (methodMatch) {
        const urlMatch = info.match(/(https?:\/\/[^\s]+|\/[^\s]*)/);
        const statusMatch = info.match(/\b(\d{3})\b/);
        this.httpEntries.push({
          timestamp: packet.timestamp,
          method: methodMatch[1],
          url: urlMatch ? urlMatch[0] : '',
          status: statusMatch ? statusMatch[1] : '',
        });
      }
    }
  }

  // ─── Threat Detection Engine ──────────────────────────────────────────────

  private runThreatDetection(packet: PacketEntry, srcIp: string, dstIp: string): void {
    const now = Date.now();

    // IOC matching
    if (this.iocList.length > 0) {
      const packetText = `${packet.src} ${packet.dst} ${packet.info}`.toLowerCase();
      for (const ioc of this.iocList) {
        const iocLower = ioc.toLowerCase();
        if (packetText.includes(iocLower)) {
          this.iocHitCounts.set(iocLower, (this.iocHitCounts.get(iocLower) || 0) + 1);
        }
      }
    }

    // Port scan detection
    if (srcIp && dstIp) {
      const dstPort = this.extractPort(packet.dst);
      if (dstPort) {
        if (!this.portScanTracker.has(srcIp)) this.portScanTracker.set(srcIp, new Set());
        const ports = this.portScanTracker.get(srcIp)!;
        ports.add(dstPort);
        if (ports.size > 20) {
          this.addThreatAlert('high', '端口扫描', `${srcIp} 连接了 ${ports.size} 个不同目标端口`, packet.id);
          this.portScanTracker.set(srcIp, new Set());
        }
      }
    }

    // SYN flood detection
    if (packet.info.includes('Flags [S]') || packet.info.includes('SYN')) {
      this.synCount++;
    }
    if (this.totalCount > 100 && this.synCount / this.totalCount > 0.7) {
      this.addThreatAlert(
        'critical',
        'SYN Flood',
        `SYN 包比例 ${Math.round((this.synCount / this.totalCount) * 100)}%，可能存在 SYN Flood 攻击`,
        packet.id
      );
      this.synCount = 0;
      this.totalCount = 0;
    }

    // C2 port detection
    if (dstIp) {
      const dstPort = parseInt(this.extractPort(packet.dst) || '0');
      if (C2_PORTS.includes(dstPort)) {
        this.addThreatAlert('critical', '异常端口外联', `${srcIp} → ${dstIp}:${dstPort} (C2 常用端口)`, packet.id);
      }
    }

    // DNS tunnel detection
    if ((packet.protocol || '').toUpperCase() === 'DNS') {
      const domainMatch = packet.info.match(/([a-zA-Z0-9-]+\.){3,}[a-zA-Z]+/);
      if (domainMatch && domainMatch[0].length > 50) {
        this.addThreatAlert(
          'high',
          'DNS 隧道嫌疑',
          `异常长域名: ${domainMatch[0].substring(0, 60)}...`,
          packet.id
        );
      }
    }

    // Large outbound data detection
    if (dstIp) {
      const bytes = parseInt(packet.length) || 0;
      this.bytesPerDst.set(dstIp, (this.bytesPerDst.get(dstIp) || 0) + bytes);
      if ((this.bytesPerDst.get(dstIp) || 0) > 1048576) {
        this.addThreatAlert(
          'medium',
          '大流量外联',
          `向 ${dstIp} 发送 ${Math.round((this.bytesPerDst.get(dstIp) || 0) / 1024)}KB`,
          packet.id
        );
        this.bytesPerDst.set(dstIp, 0);
      }
    }

    // ARP spoofing
    if ((packet.protocol || '').toUpperCase() === 'ARP' && packet.info) {
      const ipMatch = packet.info.match(/(\d+\.\d+\.\d+\.\d+)/);
      const macMatch = packet.info.match(
        /([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/i
      );
      if (ipMatch && macMatch) {
        const ip = ipMatch[1];
        const mac = macMatch[1];
        if (!this.ipMacMap.has(ip)) this.ipMacMap.set(ip, new Set());
        this.ipMacMap.get(ip)!.add(mac);
        if (this.ipMacMap.get(ip)!.size > 1) {
          this.addThreatAlert(
            'high',
            'ARP 欺骗',
            `IP ${ip} 对应多个 MAC: ${[...this.ipMacMap.get(ip)!].join(', ')}`,
            packet.id
          );
        }
      }
    }

    // C2 Beacon detection (periodic connections to same dst)
    if (dstIp) {
      if (!this.connectionIntervals.has(dstIp)) this.connectionIntervals.set(dstIp, []);
      const timestamps = this.connectionIntervals.get(dstIp)!;
      timestamps.push(now);
      if (timestamps.length > 20) timestamps.shift();
      if (timestamps.length >= 10) {
        const intervals: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
          intervals.push(timestamps[i] - timestamps[i - 1]);
        }
        const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
        const stddev = Math.sqrt(variance);
        if (stddev < 2000 && mean > 1000 && mean < 60000) {
          this.addThreatAlert(
            'critical',
            'C2 心跳 Beacon',
            `${dstIp} 呈周期性连接 (间隔≈${Math.round(mean / 1000)}s, σ=${Math.round(stddev / 1000)}s)`,
            packet.id
          );
          this.connectionIntervals.set(dstIp, []);
        }
      }
    }
  }

  private addThreatAlert(
    severity: 'critical' | 'high' | 'medium',
    type: string,
    description: string,
    packetId: number
  ): void {
    this.alertIdCounter++;
    const now = new Date();
    const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    this.threatAlerts.push({
      id: this.alertIdCounter,
      timestamp: ts,
      severity,
      type,
      description,
      packetId,
    });

    // Mark timeline bucket as alert
    if (this.captureStartTime > 0) {
      const bucketIdx = Math.floor((Date.now() - this.captureStartTime) / 5000);
      this.timelineAlertBuckets.add(bucketIdx);
    }
  }

  private isIocHit(packet: PacketEntry): boolean {
    if (this.iocList.length === 0) return false;
    const text = `${packet.src} ${packet.dst} ${packet.info}`.toLowerCase();
    return this.iocList.some(ioc => text.includes(ioc.toLowerCase()));
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  private handleAction(action: string, el: HTMLElement): void {
    switch (action) {
      case 'start-capture':
        this.startCapture();
        break;
      case 'stop-capture':
        this.stopCapture();
        break;
      case 'clear-packets':
        this.clearAll();
        break;
      case 'switch-tab':
        this.switchTab(el.dataset.tab as PacketTab);
        break;
      case 'select-packet':
        this.selectPacket(parseInt(el.dataset.packetId!));
        break;
      case 'preset-filter': {
        const filterInput = document.getElementById('pc-filter-input') as HTMLInputElement | null;
        if (filterInput && el.dataset.filter) {
          filterInput.value = el.dataset.filter;
        }
        break;
      }
      case 'export-csv':
        this.exportCSV();
        break;
      case 'export-json':
        this.exportJSON();
        break;
      case 'filter-conversation':
        this.conversationFilter = el.dataset.convKey || null;
        this.switchTab('realtime');
        break;
      case 'clear-conv-filter':
        this.conversationFilter = null;
        this.switchTab('realtime');
        break;
      case 'apply-ioc':
        this.applyIoc();
        break;
      case 'goto-packet':
        this.gotoPacket(parseInt(el.dataset.packetId!));
        break;
      case 'close-detail': {
        const panel = document.getElementById('pc-detail-panel');
        if (panel) panel.style.display = 'none';
        break;
      }
    }
  }

  private async startCapture(): Promise<void> {
    const filterInput = document.getElementById('pc-filter-input') as HTMLInputElement | null;
    const countInput = document.getElementById('pc-count-input') as HTMLInputElement | null;
    const filter = filterInput?.value || '';
    const count = parseInt(countInput?.value || '0') || 0;

    if (!this.selectedInterface) {
      showAlert({ title: '提示', message: '请选择网络接口', type: 'warning' });
      return;
    }

    // Clear all state
    this.clearAll();

    this.captureStartTime = Date.now();
    this.isCapturing = true;
    this.updateCaptureButtons();

    try {
      await invoke('start_packet_capture', {
        interface: this.selectedInterface,
        filter: filter || null,
        count: count > 0 ? count : null,
      });
    } catch (e) {
      console.error('Failed to start capture:', e);
      this.isCapturing = false;
      this.updateCaptureButtons();
      showAlert({ title: '启动失败', message: `启动抓包失败: ${e}`, type: 'error' });
    }
  }

  private async stopCapture(): Promise<void> {
    try {
      await invoke('stop_packet_capture');
    } catch (e) {
      console.error('Failed to stop capture:', e);
    }
    this.isCapturing = false;
    this.updateCaptureButtons();
  }

  private clearAll(): void {
    this.packets = [];
    this.protocolCounts.clear();
    this.conversations.clear();
    this.dnsEntries = [];
    this.httpEntries = [];
    this.threatAlerts = [];
    this.timelineBuckets = [];
    this.timelineAlertBuckets.clear();
    this.rateTimestamps = [];
    this.currentPps = 0;
    this.synCount = 0;
    this.totalCount = 0;
    this.alertIdCounter = 0;
    this.portScanTracker.clear();
    this.connectionIntervals.clear();
    this.ipMacMap.clear();
    this.bytesPerDst.clear();
    this.iocHitCounts.clear();
    this.selectedPacketId = null;
    this.conversationFilter = null;

    const container = document.getElementById('pc-packet-list');
    if (container) container.innerHTML = '';
    const detail = document.getElementById('pc-detail-panel');
    if (detail) detail.style.display = 'none';

    // Re-render current tab
    const contentArea = document.getElementById('pc-content-area');
    if (contentArea) contentArea.innerHTML = this.renderCurrentTab();
  }

  private updateCaptureButtons(): void {
    const startBtn = document.getElementById('pc-start-btn');
    const stopBtn = document.getElementById('pc-stop-btn');
    if (startBtn && stopBtn) {
      if (this.isCapturing) {
        startBtn.classList.add('hidden');
        stopBtn.classList.remove('hidden');
      } else {
        startBtn.classList.remove('hidden');
        stopBtn.classList.add('hidden');
      }
    }
  }

  private switchTab(tab: PacketTab): void {
    this.currentTab = tab;
    const tabsArea = document.getElementById('pc-tabs-area');
    if (tabsArea) tabsArea.innerHTML = this.renderTabs();
    const contentArea = document.getElementById('pc-content-area');
    if (contentArea) contentArea.innerHTML = this.renderCurrentTab();
  }

  private selectPacket(id: number): void {
    this.selectedPacketId = id;

    // Highlight selected row
    const container = document.getElementById('pc-packet-list');
    if (container) {
      container.querySelectorAll('.pc-packet-row.selected').forEach(el => el.classList.remove('selected'));
      const row = container.querySelector(`[data-packet-id="${id}"]`);
      if (row) row.classList.add('selected');
    }

    // Show detail panel
    const packet = this.packets.find(p => p.id === id);
    if (!packet) return;

    const panel = document.getElementById('pc-detail-panel');
    if (!panel) return;
    panel.style.display = 'block';

    const srcIp = this.extractIp(packet.src);
    const dstIp = this.extractIp(packet.dst);
    const srcPort = this.extractPort(packet.src) || '-';
    const dstPort = this.extractPort(packet.dst) || '-';

    panel.innerHTML = `
      <div class="pc-detail-header">
        <span>数据包 #${packet.id} 详情</span>
        <button class="pc-detail-close" data-pc-action="close-detail">✕</button>
      </div>
      <div class="pc-detail-body">
        <div class="pc-detail-grid">
          <div class="pc-detail-field"><span class="pc-detail-label">时间</span><span>${packet.timestamp}</span></div>
          <div class="pc-detail-field"><span class="pc-detail-label">协议</span><span class="pc-proto-badge">${packet.protocol}</span></div>
          <div class="pc-detail-field"><span class="pc-detail-label">源 IP</span><span>${srcIp}</span></div>
          <div class="pc-detail-field"><span class="pc-detail-label">源端口</span><span>${srcPort}</span></div>
          <div class="pc-detail-field"><span class="pc-detail-label">目标 IP</span><span>${dstIp}</span></div>
          <div class="pc-detail-field"><span class="pc-detail-label">目标端口</span><span>${dstPort}</span></div>
          <div class="pc-detail-field"><span class="pc-detail-label">长度</span><span>${packet.length} bytes</span></div>
        </div>
        <div class="pc-detail-info"><span class="pc-detail-label">信息</span><div class="pc-detail-info-text">${this.escapeHtml(packet.info)}</div></div>
        <div class="pc-detail-raw"><span class="pc-detail-label">原始数据</span><pre class="pc-detail-raw-pre">${this.escapeHtml(packet.raw)}</pre></div>
      </div>
    `;
  }

  private gotoPacket(packetId: number): void {
    this.currentTab = 'realtime';
    const tabsArea = document.getElementById('pc-tabs-area');
    if (tabsArea) tabsArea.innerHTML = this.renderTabs();
    const contentArea = document.getElementById('pc-content-area');
    if (contentArea) contentArea.innerHTML = this.renderCurrentTab();

    // After rendering, scroll to and select the packet
    setTimeout(() => {
      this.selectPacket(packetId);
      const container = document.getElementById('pc-packet-list');
      if (container) {
        const row = container.querySelector(`[data-packet-id="${packetId}"]`);
        if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 50);
  }

  private applyIoc(): void {
    const textarea = document.getElementById('pc-ioc-input') as HTMLTextAreaElement | null;
    if (!textarea) return;
    this.iocList = textarea.value
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);
    this.iocHitCounts.clear();

    // Re-scan existing packets for IOC hits
    for (const packet of this.packets) {
      const text = `${packet.src} ${packet.dst} ${packet.info}`.toLowerCase();
      for (const ioc of this.iocList) {
        const iocLower = ioc.toLowerCase();
        if (text.includes(iocLower)) {
          this.iocHitCounts.set(iocLower, (this.iocHitCounts.get(iocLower) || 0) + 1);
        }
      }
    }

    // Update IOC results display
    const resultsEl = document.getElementById('pc-ioc-results');
    if (resultsEl) resultsEl.innerHTML = this.renderIocResults();
  }

  private refreshPacketList(): void {
    const container = document.getElementById('pc-packet-list');
    if (container) {
      container.innerHTML = this.renderPacketRows();
    }
  }

  // ─── Export ───────────────────────────────────────────────────────────────

  private exportCSV(): void {
    const header = 'No,Time,Protocol,Source,Destination,Length,Info\n';
    const rows = this.packets
      .map(
        p =>
          `${p.id},"${p.timestamp}","${p.protocol}","${p.src}","${p.dst}","${p.length}","${p.info.replace(/"/g, '""')}"`
      )
      .join('\n');
    const csv = header + rows;
    this.downloadBlob(csv, 'packets.csv', 'text/csv');
  }

  private exportJSON(): void {
    const json = JSON.stringify(this.packets, null, 2);
    this.downloadBlob(json, 'packets.json', 'application/json');
  }

  private downloadBlob(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private escapeHtml(text: string): string {
    if (!text) return '';
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  }

  // ─── Styles ───────────────────────────────────────────────────────────────

  private renderStyles(): string {
    return `<style>
      .pc-page {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--bg-primary);
        color: var(--text-primary);
        font-size: 13px;
      }

      /* Header */
      .pc-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-secondary);
        gap: 16px;
        flex-wrap: wrap;
      }
      .pc-header-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .pc-header-icon {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        background: var(--primary-color, #4a9eff);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
      }
      .pc-header-title {
        font-size: 15px;
        font-weight: 700;
        margin: 0;
        line-height: 1.2;
      }
      .pc-header-subtitle {
        font-size: 11px;
        color: var(--text-secondary);
        margin-top: 2px;
      }
      .pc-header-right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .pc-header-right select,
      .pc-header-right input {
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        color: var(--text-primary);
        padding: 5px 8px;
        border-radius: 6px;
        font-size: 12px;
      }
      .pc-filter-input { width: 180px; }
      .pc-count-input { width: 60px; }

      /* Tabs */
      .pc-tabs {
        display: flex;
        gap: 0;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-secondary);
        padding: 0 12px;
      }
      .pc-tab-btn {
        padding: 8px 16px;
        font-size: 12px;
        font-weight: 500;
        border: none;
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
      }
      .pc-tab-btn:hover { color: var(--text-primary); background: var(--bg-hover); }
      .pc-tab-btn.active {
        color: var(--primary-color, #4a9eff);
        border-bottom-color: var(--primary-color, #4a9eff);
        font-weight: 600;
      }

      /* Content */
      .pc-content {
        flex: 1;
        overflow: auto;
        padding: 0;
      }

      /* Controls bar */
      .pc-controls-bar {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-secondary);
        flex-wrap: wrap;
      }
      .pc-preset-btn {
        padding: 3px 10px;
        font-size: 11px;
        border: 1px solid var(--border-color);
        border-radius: 4px;
        background: var(--bg-tertiary);
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.15s;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .pc-preset-btn:hover { background: var(--bg-hover); color: var(--text-primary); }
      .pc-preset-btn.active {
        background: var(--primary-color, #4a9eff);
        color: #fff;
        border-color: var(--primary-color, #4a9eff);
      }
      .pc-search-box {
        display: flex;
        align-items: center;
        gap: 4px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 4px;
        padding: 2px 8px;
      }
      .pc-search-box input {
        border: none;
        background: transparent;
        color: var(--text-primary);
        font-size: 11px;
        outline: none;
        width: 120px;
      }

      /* Stats bar */
      .pc-stats-bar {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 6px 12px;
        border-bottom: 1px solid var(--border-color);
        font-size: 11px;
        background: var(--bg-primary);
      }
      .pc-stats-item { display: flex; align-items: center; gap: 6px; }
      .pc-stats-label { color: var(--text-secondary); }
      .pc-stats-value { font-weight: 600; font-variant-numeric: tabular-nums; }
      .pc-mini-bar {
        display: flex;
        height: 8px;
        width: 120px;
        border-radius: 4px;
        overflow: hidden;
        background: var(--bg-tertiary);
      }
      .pc-mini-bar-seg { min-width: 2px; transition: width 0.3s; }

      /* Split panel */
      .pc-split-panel {
        display: flex;
        flex-direction: column;
        height: 100%;
      }

      /* Packet list */
      .pc-packet-list-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .pc-packet-header {
        display: grid;
        grid-template-columns: 56px 90px 70px 1fr 1fr 60px 2fr;
        padding: 6px 12px;
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-secondary);
      }
      .pc-packet-row {
        display: grid;
        grid-template-columns: 56px 90px 70px 1fr 1fr 60px 2fr;
        padding: 3px 12px;
        font-size: 11px;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        cursor: pointer;
        border-bottom: 1px solid color-mix(in srgb, var(--border-color) 40%, transparent);
        transition: background 0.1s;
        align-items: center;
      }
      .pc-packet-row:hover { background: var(--bg-hover); }
      .pc-packet-row.selected { background: color-mix(in srgb, var(--primary-color, #4a9eff) 15%, transparent); }
      .pc-packet-row.ioc-hit { background: color-mix(in srgb, #ef4444 12%, transparent); }
      .pc-info-cell {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* Protocol coloring */
      .pc-proto-TCP { border-left: 2px solid #4a9eff; }
      .pc-proto-UDP { border-left: 2px solid #ff9e4a; }
      .pc-proto-ICMP { border-left: 2px solid #ff4a9e; }
      .pc-proto-DNS { border-left: 2px solid #9e4aff; }
      .pc-proto-HTTP { border-left: 2px solid #4aff9e; }
      .pc-proto-HTTPS { border-left: 2px solid #4affcc; }
      .pc-proto-ARP { border-left: 2px solid #ffd84a; }
      .pc-proto-OTHER { border-left: 2px solid #888; }

      /* Detail panel */
      .pc-detail-panel {
        border-top: 1px solid var(--border-color);
        background: var(--bg-secondary);
        max-height: 260px;
        overflow: auto;
      }
      .pc-detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        font-weight: 600;
        font-size: 12px;
        border-bottom: 1px solid var(--border-color);
      }
      .pc-detail-close {
        background: none;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        font-size: 14px;
      }
      .pc-detail-close:hover { color: var(--text-primary); }
      .pc-detail-body { padding: 10px 12px; }
      .pc-detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 8px;
        margin-bottom: 10px;
      }
      .pc-detail-field {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .pc-detail-label {
        font-size: 10px;
        color: var(--text-secondary);
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 0.5px;
      }
      .pc-proto-badge {
        display: inline-block;
        padding: 1px 6px;
        border-radius: 3px;
        background: var(--primary-color, #4a9eff);
        color: #fff;
        font-size: 10px;
        font-weight: 600;
      }
      .pc-detail-info { margin-bottom: 8px; }
      .pc-detail-info-text {
        padding: 6px 8px;
        background: var(--bg-tertiary);
        border-radius: 4px;
        font-size: 11px;
        margin-top: 4px;
        word-break: break-all;
      }
      .pc-detail-raw-pre {
        padding: 8px;
        background: var(--bg-tertiary);
        border-radius: 4px;
        font-size: 10px;
        max-height: 100px;
        overflow: auto;
        white-space: pre-wrap;
        word-break: break-all;
        margin-top: 4px;
      }

      /* Statistics */
      .pc-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
        gap: 12px;
        padding: 12px;
      }
      .pc-stat-card {
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 12px;
      }
      .pc-stat-card-title {
        font-size: 12px;
        font-weight: 600;
        margin-bottom: 10px;
        color: var(--text-primary);
      }
      .pc-bar-chart { display: flex; flex-direction: column; gap: 4px; }
      .pc-bar-item {
        display: grid;
        grid-template-columns: 130px 1fr 50px;
        align-items: center;
        gap: 8px;
        font-size: 11px;
      }
      .pc-bar-label {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--text-secondary);
      }
      .pc-bar-track {
        height: 6px;
        background: var(--bg-tertiary);
        border-radius: 3px;
        overflow: hidden;
      }
      .pc-bar-fill {
        height: 100%;
        border-radius: 3px;
        transition: width 0.3s;
      }
      .pc-bar-value {
        text-align: right;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--text-primary);
      }

      /* Tables */
      .pc-table-wrap { overflow: auto; max-height: 400px; }
      .pc-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      .pc-table.compact { font-size: 11px; }
      .pc-table thead th {
        position: sticky;
        top: 0;
        background: var(--bg-secondary);
        padding: 6px 10px;
        text-align: left;
        font-weight: 600;
        color: var(--text-secondary);
        border-bottom: 1px solid var(--border-color);
        font-size: 11px;
      }
      .pc-table tbody td {
        padding: 5px 10px;
        border-bottom: 1px solid color-mix(in srgb, var(--border-color) 40%, transparent);
      }
      .pc-conv-row { cursor: pointer; }
      .pc-conv-row:hover { background: var(--bg-hover); }
      .pc-http-method {
        font-weight: 600;
        color: var(--primary-color, #4a9eff);
      }
      .pc-url-cell {
        max-width: 400px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* DNS/HTTP section */
      .pc-dns-http-wrap { padding: 12px; }
      .pc-section-title {
        font-size: 13px;
        font-weight: 600;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      /* Threat section */
      .pc-threat-section { padding: 12px; }
      .pc-ioc-area {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
      }
      .pc-ioc-input-wrap { min-width: 240px; }
      .pc-ioc-input {
        width: 100%;
        min-height: 80px;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        border-radius: 6px;
        color: var(--text-primary);
        padding: 8px;
        font-size: 11px;
        font-family: monospace;
        resize: vertical;
      }
      .pc-threat-cards {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 16px;
      }
      .pc-threat-card {
        border-radius: 8px;
        padding: 14px;
        text-align: center;
        border: 1px solid var(--border-color);
      }
      .pc-threat-card.critical { background: color-mix(in srgb, #ef4444 12%, var(--bg-secondary)); border-color: #ef4444; }
      .pc-threat-card.high { background: color-mix(in srgb, #f97316 12%, var(--bg-secondary)); border-color: #f97316; }
      .pc-threat-card.medium { background: color-mix(in srgb, #eab308 12%, var(--bg-secondary)); border-color: #eab308; }
      .pc-threat-card.normal { background: var(--bg-secondary); }
      .pc-threat-card-num { font-size: 24px; font-weight: 700; }
      .pc-threat-card.critical .pc-threat-card-num { color: #ef4444; }
      .pc-threat-card.high .pc-threat-card-num { color: #f97316; }
      .pc-threat-card.medium .pc-threat-card-num { color: #eab308; }
      .pc-threat-card.normal .pc-threat-card-num { color: #22c55e; }
      .pc-threat-card-label { font-size: 11px; color: var(--text-secondary); margin-top: 4px; }

      /* Timeline */
      .pc-timeline {
        display: flex;
        align-items: flex-end;
        gap: 2px;
        height: 55px;
        padding: 2px;
        background: var(--bg-tertiary);
        border-radius: 6px;
        overflow: hidden;
        margin-bottom: 12px;
      }
      .pc-timeline-bar {
        flex: 1;
        min-width: 3px;
        max-width: 12px;
        border-radius: 2px 2px 0 0;
        transition: height 0.2s;
      }

      /* Alert list */
      .pc-alert-list {
        max-height: 300px;
        overflow: auto;
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .pc-alert-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        border-radius: 6px;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        cursor: pointer;
        transition: background 0.15s;
        font-size: 11px;
      }
      .pc-alert-item:hover { background: var(--bg-hover); }
      .pc-alert-item.critical { border-left: 3px solid #ef4444; }
      .pc-alert-item.high { border-left: 3px solid #f97316; }
      .pc-alert-item.medium { border-left: 3px solid #eab308; }
      .pc-alert-badge {
        padding: 1px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: 600;
        color: #fff;
        white-space: nowrap;
      }
      .pc-alert-badge.critical { background: #ef4444; }
      .pc-alert-badge.high { background: #f97316; }
      .pc-alert-badge.medium { background: #eab308; }
      .pc-alert-type { font-weight: 600; white-space: nowrap; }
      .pc-alert-desc {
        flex: 1;
        color: var(--text-secondary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pc-alert-time { color: var(--text-secondary); font-size: 10px; white-space: nowrap; }

      /* Common */
      .pc-empty-hint {
        color: var(--text-secondary);
        font-size: 12px;
        text-align: center;
        padding: 20px;
      }
      .hidden { display: none !important; }
      .modern-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        border-radius: 6px;
        border: 1px solid var(--border-color);
        background: var(--bg-tertiary);
        color: var(--text-primary);
        cursor: pointer;
        font-size: 12px;
        transition: all 0.15s;
      }
      .modern-btn:hover { background: var(--bg-hover); }
      .modern-btn.primary {
        background: var(--primary-color, #4a9eff);
        color: #fff;
        border-color: var(--primary-color, #4a9eff);
      }
      .modern-btn.primary:hover { filter: brightness(1.1); }
      .modern-btn.secondary {
        background: var(--bg-tertiary);
      }
      .modern-btn.sm { padding: 4px 10px; font-size: 11px; }
    </style>`;
  }
}
