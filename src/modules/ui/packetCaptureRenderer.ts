import {
  Play,
  Pause,
  Delete,
  NetworkTree
} from '@icon-park/svg';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

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

export class PacketCaptureRenderer {
  private packets: PacketEntry[] = [];
  private isCapturing: boolean = false;
  private interfaces: NetworkInterface[] = [];
  private selectedInterface: string = '';
  private maxPackets: number = 1000;
  private unlistenFn: (() => void) | null = null;

  constructor() {
    // Bind methods
    (window as any).startPacketCapture = this.startCapture.bind(this);
    (window as any).stopPacketCapture = this.stopCapture.bind(this);
    (window as any).clearPackets = this.clearPackets.bind(this);
    (window as any).selectInterface = this.selectInterface.bind(this);
    
    // Setup listeners
    this.setupListeners();
  }

  private async setupListeners() {
    if (this.unlistenFn) {
      this.unlistenFn();
    }

    const unlistenData = await listen('packet_capture_data', (event: any) => {
      this.addPacket(event.payload as PacketEntry);
    });
    
    const unlistenError = await listen('packet_capture_error', (event: any) => {
      console.error('Packet Capture Error:', event.payload);
      this.stopCapture();
      alert(`抓包错误: ${event.payload}`);
    });

    const unlistenStop = await listen('packet_capture_stopped', () => {
      this.isCapturing = false;
      this.updateControls();
    });

    this.unlistenFn = () => {
      unlistenData();
      unlistenError();
      unlistenStop();
    };
  }

  public async render(): Promise<string> {
    // Load interfaces if empty
    if (this.interfaces.length === 0) {
      try {
        const result = await invoke('get_network_interfaces');
        this.interfaces = Array.isArray(result) ? result : [];
        if (this.interfaces.length > 0 && !this.selectedInterface) {
          this.selectedInterface = this.interfaces[0].name;
        }
      } catch (e) {
        console.error('Failed to load network interfaces:', e);
        this.interfaces = [];
      }
    }

    return `
      <div class="packet-capture-container">
        <div class="packet-capture-header">
          <div class="header-title">
            <span class="header-icon">${NetworkTree({ theme: 'outline', size: '20', fill: 'currentColor' })}</span>
            <span>网络抓包</span>
          </div>
          
          <div class="header-controls">
            <div class="control-group">
              <label>接口:</label>
              <select id="interface-select" onchange="window.selectInterface(this.value)">
                ${this.interfaces.map(iface => `
                  <option value="${iface.name}" ${iface.name === this.selectedInterface ? 'selected' : ''}>
                    ${iface.name} (${iface.ips.join(', ')})
                  </option>
                `).join('')}
              </select>
            </div>
            
            <div class="control-group">
              <label>过滤:</label>
              <input type="text" id="capture-filter" placeholder="例如: port 80 or icmp" class="filter-input" />
            </div>

            <div class="control-group">
              <label>数量:</label>
              <input type="number" id="capture-count" value="100" class="count-input" style="width: 60px;" />
            </div>
            
            <div class="actions">
              <button id="start-capture-btn" class="action-btn primary ${this.isCapturing ? 'hidden' : ''}" onclick="window.startPacketCapture()">
                ${Play({ theme: 'outline', size: '16', fill: 'currentColor' })}
                开始
              </button>
              <button id="stop-capture-btn" class="action-btn danger ${!this.isCapturing ? 'hidden' : ''}" onclick="window.stopPacketCapture()">
                ${Pause({ theme: 'outline', size: '16', fill: 'currentColor' })}
                停止
              </button>
              <button class="action-btn" onclick="window.clearPackets()">
                ${Delete({ theme: 'outline', size: '16', fill: 'currentColor' })}
                清空
              </button>
            </div>
          </div>
        </div>

        <div class="packet-list-header">
          <div class="col-id">No.</div>
          <div class="col-time">Time</div>
          <div class="col-proto">Protocol</div>
          <div class="col-src">Source</div>
          <div class="col-dst">Destination</div>
          <div class="col-info">Info</div>
        </div>
        
        <div id="packet-list-container" class="packet-list-container">
          ${this.renderPacketList()}
        </div>
      </div>
      
      <style>
        .packet-capture-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--bg-primary);
          color: var(--text-primary);
        }
        
        .packet-capture-header {
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: var(--bg-secondary);
        }
        
        .header-title {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          font-weight: 600;
          font-size: 1.1em;
        }
        
        .header-controls {
          display: flex;
          align-items: center;
          gap: var(--spacing-lg);
        }
        
        .control-group {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
        }
        
        .control-group select, .control-group input {
          background: var(--bg-tertiary);
          border: 1px solid var(--border-color);
          color: var(--text-primary);
          padding: 4px 8px;
          border-radius: 4px;
        }
        
        .filter-input {
          width: 200px;
        }
        
        .actions {
          display: flex;
          gap: var(--spacing-sm);
        }
        
        .action-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border-radius: 4px;
          border: 1px solid var(--border-color);
          background: var(--bg-tertiary);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .action-btn:hover {
          background: var(--bg-hover);
        }
        
        .action-btn.primary {
          background: var(--primary-color);
          color: white;
          border-color: var(--primary-color);
        }
        
        .action-btn.danger {
          background: var(--error-color);
          color: white;
          border-color: var(--error-color);
        }
        
        .hidden {
          display: none !important;
        }
        
        .packet-list-header {
          display: grid;
          grid-template-columns: 60px 140px 80px 160px 160px 1fr;
          padding: 8px var(--spacing-md);
          background: var(--bg-secondary);
          border-bottom: 1px solid var(--border-color);
          font-weight: 600;
          font-size: 0.9em;
        }
        
        .packet-list-container {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
        }
        
        .packet-row {
          display: grid;
          grid-template-columns: 60px 140px 80px 160px 160px 1fr;
          padding: 4px var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
          font-family: monospace;
          font-size: 0.85em;
          cursor: pointer;
        }
        
        .packet-row:hover {
          background-color: var(--bg-hover);
        }
        
        /* Protocol colors */
        .proto-TCP { color: #4a9eff; }
        .proto-UDP { color: #ff9e4a; }
        .proto-ICMP { color: #ff4a9e; }
        .proto-HTTP { color: #4aff9e; }
        
        .col-id { color: var(--text-secondary); }
        .col-info { 
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      </style>
    `;
  }

  private renderPacketList(): string {
    return this.packets.map(packet => this.renderPacketRow(packet)).join('');
  }

  private renderPacketRow(packet: PacketEntry): string {
    return `
      <div class="packet-row" onclick="console.log('${packet.raw.replace(/'/g, "\\'")}')">
        <div class="col-id">${packet.id}</div>
        <div class="col-time">${packet.timestamp}</div>
        <div class="col-proto proto-${packet.protocol}">${packet.protocol}</div>
        <div class="col-src" title="${packet.src}">${packet.src}</div>
        <div class="col-dst" title="${packet.dst}">${packet.dst}</div>
        <div class="col-info" title="${packet.info}">${packet.info}</div>
      </div>
    `;
  }

  private addPacket(packet: PacketEntry) {
    this.packets.push(packet);
    if (this.packets.length > this.maxPackets) {
      this.packets.shift();
    }

    const container = document.getElementById('packet-list-container');
    if (container) {
      const div = document.createElement('div');
      div.innerHTML = this.renderPacketRow(packet);
      container.appendChild(div.firstElementChild!);
      
      // Auto-scroll
      if (container.scrollHeight - container.scrollTop - container.clientHeight < 100) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }

  private async startCapture() {
    const filter = (document.getElementById('capture-filter') as HTMLInputElement).value;
    const count = parseInt((document.getElementById('capture-count') as HTMLInputElement).value) || 0;
    
    if (!this.selectedInterface) {
      alert('请选择网络接口');
      return;
    }

    this.isCapturing = true;
    this.updateControls();
    
    try {
      await invoke('start_packet_capture', {
        interface: this.selectedInterface,
        filter: filter || null,
        count: count > 0 ? count : null
      });
    } catch (e) {
      console.error('Failed to start capture:', e);
      this.isCapturing = false;
      this.updateControls();
      alert(`启动抓包失败: ${e}`);
    }
  }

  private async stopCapture() {
    try {
      await invoke('stop_packet_capture');
    } catch (e) {
      console.error('Failed to stop capture:', e);
    }
    this.isCapturing = false;
    this.updateControls();
  }

  private clearPackets() {
    this.packets = [];
    const container = document.getElementById('packet-list-container');
    if (container) {
      container.innerHTML = '';
    }
  }

  private updateControls() {
    const startBtn = document.getElementById('start-capture-btn');
    const stopBtn = document.getElementById('stop-capture-btn');
    
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

  private selectInterface(iface: string) {
    this.selectedInterface = iface;
  }
  
  public destroy() {
    if (this.unlistenFn) {
      this.unlistenFn();
      this.unlistenFn = null;
    }
  }
}
