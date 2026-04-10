/**
 * 现代化UI渲染器
 * 负责渲染应用的各个UI组件
 */

import type { StateManager } from '../core/stateManager';
import type { AppState } from '../core/app';
import { version as APP_VERSION } from '../../../package.json';
import { KubernetesRenderer } from './kubernetesRenderer';
import { dockerPageManager } from '../docker/dockerPageManager';
import { SftpContextMenuRenderer } from './sftpContextMenu';
import { LogAnalysisRenderer } from './logAnalysisRenderer';
import { DatabaseRenderer } from './databaseRenderer';
import { PacketCaptureRenderer } from './packetCaptureRenderer';

import { SystemInfoRenderer } from './renderers/systemInfoRenderer';
import { ServerModalRenderer } from './renderers/serverModalRenderer';
import { EmergencyRenderer } from './renderers/emergencyRenderer';
import { BaselineRenderer } from './renderers/baselineRenderer';
import {
  Rocket,
  SettingTwo,
  ApplicationMenu,
  FolderOpen,
  Whale,
  CheckOne,
  CloseOne,
  Code,
  Plus,
  LinkInterrupt,
  Connection,
  Up,
  Home,
  Refresh,
  Upload,
  FolderPlus,
  History,
  // 快速检测图标
  Shield,
  FileText,
  NetworkTree,
  System,
  SettingConfig,
  LinkCloud,
  Log,
  Left,
  Right,
  Data,
  // 设置菜单图标
  Bug,
  Fire,
  // 笔记 & 安全速查
  DocDetail,
  Protection
} from '@icon-park/svg';

// 添加系统信息页面的样式
const systemInfoStyles = `
  <style>
    /* 基础样式已移至 system-info.css */
  </style>
`;

export class ModernUIRenderer {
  private stateManager: StateManager;
  private state: AppState;
  public kubernetesRenderer: KubernetesRenderer;
  private logAnalysisRenderer: LogAnalysisRenderer;

  public sftpContextMenuRenderer: SftpContextMenuRenderer;
  public databaseRenderer: DatabaseRenderer;
  public packetCaptureRenderer: PacketCaptureRenderer;
  private systemInfoRenderer: SystemInfoRenderer;
  private serverModalRenderer: ServerModalRenderer;
  private emergencyRenderer: EmergencyRenderer;
  public baselineRenderer: BaselineRenderer;

  constructor(stateManager: StateManager) {
    this.stateManager = stateManager;
    this.state = stateManager.getState();
    this.kubernetesRenderer = new KubernetesRenderer();
    this.logAnalysisRenderer = new LogAnalysisRenderer();
    this.sftpContextMenuRenderer = new SftpContextMenuRenderer();
    this.databaseRenderer = new DatabaseRenderer();
    this.packetCaptureRenderer = new PacketCaptureRenderer();
    this.systemInfoRenderer = new SystemInfoRenderer();
    this.serverModalRenderer = new ServerModalRenderer();
    this.emergencyRenderer = new EmergencyRenderer(this.state);
    this.baselineRenderer = new BaselineRenderer(this.state);

    // 注入系统信息页面样式
    if (!document.querySelector('#system-info-styles')) {
      const styleElement = document.createElement('div');
      styleElement.id = 'system-info-styles';
      styleElement.innerHTML = systemInfoStyles;
      document.head.appendChild(styleElement.firstElementChild!);
    }

    // 注册 System Info Header 切换函数
    (window as any).toggleSystemInfoHeader = () => {
      const header = document.querySelector('.system-info-header');
      const content = document.querySelector('.system-info-content');
      const toggleBtn = document.querySelector('.header-toggle-icon');
      
      if (header && content) {
        header.classList.toggle('collapsed');
        content.classList.toggle('expanded');
        
        // 保存状态到 localStorage
        const isCollapsed = header.classList.contains('collapsed');
        localStorage.setItem('system-info-header-collapsed', String(isCollapsed));
        
        // 更新按钮图标
        if (toggleBtn) {
          toggleBtn.innerHTML = isCollapsed 
            ? Right({ theme: 'outline', size: '16', fill: 'currentColor' })
            : Left({ theme: 'outline', size: '16', fill: 'currentColor' });
        }
      }
    };

    // 注册Kubernetes Tab切换函数
    (window as any).switchKubernetesTab = (tabId: string) => {
      this.kubernetesRenderer.setTab(tabId as any);
    };
    (window as any).switchKubernetesSubTab = (subTabId: string) => {
      this.kubernetesRenderer.setSubTab(subTabId);
    };

    // 监听状态变化
    this.stateManager.addListener((newState) => {
      const oldTheme = this.state.theme;
      const oldConnected = this.state.isConnected;

      this.state = newState;

      // 如果主题或连接状态发生变化，重新渲染连接面板
      if (oldTheme !== newState.theme || oldConnected !== newState.isConnected) {
        console.log('🎨 状态监听器检测到变化，重新渲染连接面板', {
          oldTheme,
          newTheme: newState.theme,
          oldConnected,
          newConnected: newState.isConnected
        });
        this.rerenderConnectionPanel();
        this.rerenderStatusBar();

        // 如果是从未连接变为已连接，触发状态变化动画
        if (!oldConnected && newState.isConnected) {
          console.log('🎉 连接成功，触发状态变化动画');
          setTimeout(() => {
            const connectionCard = document.querySelector('.connection-card');
            if (connectionCard) {
              connectionCard.classList.add('status-change');
              setTimeout(() => {
                connectionCard.classList.remove('status-change');
              }, 800);
            }
          }, 50); // 等待DOM更新
        }
      }
    });

  }


  /**
   * 更新状态
   */
  updateState(newState: AppState): void {
    const oldTheme = this.state.theme;
    this.state = newState;
    this.emergencyRenderer.setState(this.state);
    this.baselineRenderer.setState(this.state);

    console.log('🔄 ModernUIRenderer.updateState - 主题变化:', { oldTheme, newTheme: newState.theme });

    // 如果主题发生变化，重新渲染连接面板
    if (oldTheme !== newState.theme) {
      console.log('🎨 主题已变化，重新渲染连接面板');
      this.rerenderConnectionPanel();
    }
  }

  /**
   * 重新渲染连接面板
   */
  private rerenderConnectionPanel(): void {
    console.log('🔄 开始重新渲染连接面板，当前主题:', this.state.theme);

    const sidebar = document.querySelector('.modern-sidebar');
    if (!sidebar) {
      console.warn('⚠️ 未找到 .modern-sidebar');
      return;
    }

    // 查找连接卡片包装器
    let targetElement = sidebar.querySelector('.connection-card-wrapper');
    
    // 如果没找到 wrapper，尝试查找 card (兼容旧结构)
    if (!targetElement) {
        targetElement = sidebar.querySelector('.connection-card');
    }

    console.log('📍 找到连接卡片元素:', !!targetElement);

    if (targetElement) {
      // 创建临时容器
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = this.renderConnectionPanel();
      const newElement = tempDiv.firstElementChild;

      if (newElement) {
        console.log('✅ 替换连接卡片');
        // 替换旧元素
        targetElement.replaceWith(newElement);
      } else {
        console.warn('⚠️ 未能创建新卡片');
      }
    }
  }

  /**
   * 重新渲染状态栏（连接状态变化时调用）
   */
  private rerenderStatusBar(): void {
    const bar = document.querySelector('.status-bar');
    if (!bar) return;
    const tmp = document.createElement('div');
    tmp.innerHTML = this.renderStatusBar();
    const newBar = tmp.firstElementChild;
    if (newBar) bar.replaceWith(newBar);
  }

  /**
   * 检测是否为 macOS
   */
  private isMacOS(): boolean {
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  }

  /**
   * 更新系统信息标签页的计数
   */
  public updateSystemInfoTabs(detailedInfo: any): void {
    if (!detailedInfo) return;

    const counts = {
      processes: detailedInfo.processes?.length || 0,
      network: detailedInfo.networkDetails?.length || 0,
      services: detailedInfo.services?.length || 0,
      users: detailedInfo.users?.length || 0,
      autostart: detailedInfo.autostart?.length || 0,
      cron: detailedInfo.cronJobs?.length || 0,
      firewall: detailedInfo.firewallRules?.length || 0,
      sshkeys: detailedInfo.sshKeys?.length || 0,
      loginhistory: detailedInfo.loginHistory?.length || 0,
      suidfiles: detailedInfo.suidFiles?.length || 0,
      envvars: detailedInfo.envVariables?.length || 0,
      shellconfigs: detailedInfo.shellConfigs?.length || 0,
      packages: detailedInfo.installedPackages?.length || 0,
      sudoers: detailedInfo.sudoersConfig?.length || 0,
      timers: detailedInfo.systemdTimers?.length || 0,
      kernelmodules: detailedInfo.kernelModules?.length || 0,
      recentfiles: detailedInfo.recentFiles?.length || 0
    };

    const tabNames: Record<string, string> = {
      processes: '进程详情',
      network: '网络详情',
      services: '系统服务',
      users: '用户列表',
      autostart: '自启动',
      cron: '计划任务',
      firewall: '防火墙',
      sshkeys: 'SSH密钥',
      loginhistory: '登录历史',
      suidfiles: 'SUID文件',
      envvars: '环境变量',
      shellconfigs: 'Shell配置',
      packages: '软件包',
      sudoers: 'Sudoers',
      timers: '定时器',
      kernelmodules: '内核模块',
      recentfiles: '最近文件'
    };

    Object.keys(counts).forEach(key => {
      const tabBtn = document.querySelector(`.tab-btn[data-tab="${key}"]`);
      if (tabBtn) {
        const count = counts[key as keyof typeof counts];
        const name = tabNames[key] || key;
        const badgeHtml = count > 0 ? `<span class="count-badge">${count}</span>` : '';
        // 保持 active 类和其他属性不变，只更新内容
        tabBtn.innerHTML = `${name} ${badgeHtml}`;
      }
    });
  }

  /**
   * 渲染标题栏
   */
  renderTitleBar(): string {
    const isMac = this.isMacOS();

    return `
      <div class="modern-title-bar" data-tauri-drag-region>
        <div class="title-bar-left">
          <div class="app-logo">
            <div class="logo-icon" style="width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;">
              <svg width="22" height="22" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="tbl-s" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#f9a8d4"/><stop offset="1" stop-color="#c4b5fd"/></linearGradient>
                  <linearGradient id="tbl-h" x1=".36" y1="0" x2=".5" y2=".5"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
                </defs>
                <g transform="rotate(-15 64 62)">
                  <path d="M64,16 L75.8,47.8 L109.2,48.8 L83.2,68.8 L93,101.2 L64,83.2 L35,101.2 L44.8,68.8 L18.8,48.8 L52.2,47.8 Z" fill="url(#tbl-s)" stroke="url(#tbl-s)" stroke-width="12" stroke-linejoin="round" paint-order="stroke fill"/>
                  <path d="M64,16 L75.8,47.8 L109.2,48.8 L83.2,68.8 L93,101.2 L64,83.2 L35,101.2 L44.8,68.8 L18.8,48.8 L52.2,47.8 Z" fill="url(#tbl-h)" stroke="url(#tbl-h)" stroke-width="12" stroke-linejoin="round" paint-order="stroke fill"/>
                </g>
              </svg>
            </div>
            <span class="app-name" style="font-size: 13px; font-weight: 600; color: var(--text-primary);">LovelyRes</span>
          </div>

        </div>

        <div class="title-bar-right">
          <!-- SSH终端按钮 -->
          ${this.renderSSHTerminalTitleButton()}

          ${!isMac ? `
          <div class="window-controls">
            <button class="control-button minimize-btn" title="最小化">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="2" y="5.5" width="8" height="1"/>
              </svg>
            </button>
            <button class="control-button maximize-btn" title="最大化">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="2" y="2" width="8" height="8" stroke="currentColor" stroke-width="1" fill="none"/>
              </svg>
            </button>
            <button class="control-button close-btn close" title="关闭">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M2.5 2.5L9.5 9.5M9.5 2.5L2.5 9.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * 渲染侧边栏
   */
  renderSidebar(): string {
    return `
      <div class="activity-bar">
        <div class="activity-bar-top">
          ${this.renderNavigationMenu()}
        </div>

        <div class="activity-bar-bottom">
          <!-- 展开/收缩按钮 -->
          <div class="activity-bar-toggle" onclick="window.toggleActivityBar()" data-tooltip="展开菜单">
            <span class="toggle-icon">
              ${Right({ theme: 'outline', size: '16', fill: 'currentColor' })}
            </span>
          </div>

          <!-- 设置按钮 -->
          <div class="sidebar-settings-container">
            ${this.renderSettingsMenu()}
            <div class="activity-bar-item" data-tooltip="设置" onclick="window.toggleSettingsDropdown()">
              <span class="nav-item-icon">
                ${SettingTwo({ theme: 'outline', size: '22', fill: 'currentColor' })}
              </span>
              <span class="nav-item-label">设置</span>
            </div>
          </div>

          <!-- 连接状态 -->
          <div class="connection-card-wrapper">
            ${this.renderConnectionPanel()}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染设置菜单
   */
  private renderSettingsMenu(): string {
    const currentTheme = this.state.theme;
    
    return `
      <div id="settings-dropdown-menu" class="settings-dropdown-menu">
        <div class="settings-group">
            <div class="settings-group-title">开发工具</div>
            <button class="settings-item" onclick="window.toggleDevTools(); window.hideSettingsDropdown();">
                <div class="settings-item-icon">
                    ${Bug({ theme: 'outline', size: '16', fill: 'currentColor' })}
                </div>
                <span>Debug 工具</span>
            </button>
        </div>

        <div class="dropdown-divider"></div>

        <div class="settings-group">
            <div class="settings-group-title">主题设置</div>
            <div class="theme-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; width: 100%;">
                <button class="theme-swatch ${currentTheme === 'light' ? 'active' : ''}" data-theme-value="light" title="浅色" style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 8px; border: 2px solid ${currentTheme === 'light' ? 'var(--primary-color)' : 'transparent'}; background: transparent; cursor: pointer; transition: all 0.2s;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #f8fafc, #e2e8f0); border: 2px solid #cbd5e1;"></div>
                    <span style="font-size: 10px; color: var(--text-secondary);">浅色</span>
                </button>
                <button class="theme-swatch ${currentTheme === 'dark' ? 'active' : ''}" data-theme-value="dark" title="深色" style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 8px; border: 2px solid ${currentTheme === 'dark' ? 'var(--primary-color)' : 'transparent'}; background: transparent; cursor: pointer; transition: all 0.2s;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #1e293b, #0f172a); border: 2px solid #4299e1;"></div>
                    <span style="font-size: 10px; color: var(--text-secondary);">深色</span>
                </button>
                <button class="theme-swatch ${currentTheme === 'sakura' ? 'active' : ''}" data-theme-value="sakura" title="樱花" style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 8px; border: 2px solid ${currentTheme === 'sakura' ? 'var(--primary-color)' : 'transparent'}; background: transparent; cursor: pointer; transition: all 0.2s;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #ffb3c1, #ff9bb3); border: 2px solid #ff9bb3;"></div>
                    <span style="font-size: 10px; color: var(--text-secondary);">樱花</span>
                </button>
                <button class="theme-swatch ${currentTheme === 'midnight' ? 'active' : ''}" data-theme-value="midnight" title="暗夜" style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 8px; border: 2px solid ${currentTheme === 'midnight' ? 'var(--primary-color)' : 'transparent'}; background: transparent; cursor: pointer; transition: all 0.2s;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #7c3aed, #000000); border: 2px solid #a855f7;"></div>
                    <span style="font-size: 10px; color: var(--text-secondary);">暗夜</span>
                </button>
                <button class="theme-swatch ${currentTheme === 'ocean' ? 'active' : ''}" data-theme-value="ocean" title="深海" style="display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; border-radius: 8px; border: 2px solid ${currentTheme === 'ocean' ? 'var(--primary-color)' : 'transparent'}; background: transparent; cursor: pointer; transition: all 0.2s;">
                    <div style="width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, #06b6d4, #0b1120); border: 2px solid #22d3ee;"></div>
                    <span style="font-size: 10px; color: var(--text-secondary);">深海</span>
                </button>
            </div>
        </div>

        <div class="dropdown-divider"></div>

        <div class="settings-group">
            <div class="settings-group-title">连接</div>
            <button class="settings-item ${this.state.isConnected ? 'danger' : 'disabled'}"
                onclick="window.confirmDisconnect()"
                ${this.state.isConnected ? '' : 'disabled'}>
                <div class="settings-item-icon" style="${this.state.isConnected ? 'color:var(--error-color)' : ''}">
                    ${LinkInterrupt({ theme: 'outline', size: '16', fill: 'currentColor' })}
                </div>
                <span>${this.state.isConnected ? '断开服务器' : '未连接'}</span>
            </button>
        </div>

        <div class="dropdown-divider"></div>

        <div class="settings-group">
            <div class="settings-group-title">通用</div>
            <button class="settings-item" onclick="window.handleUserMenuAction('settings'); window.hideSettingsDropdown();">
                 <div class="settings-item-icon">
                    ${SettingConfig({ theme: 'outline', size: '16', fill: 'currentColor' })}
                 </div>
                 <span>基础设置</span>
            </button>
        </div>
      </div>
    `;
  }

  /**
   * 公开版本：供 app.ts 在主题切换后重新渲染设置菜单
   */
  renderSettingsMenuPublic(): string {
    return this.renderSettingsMenu();
  }

  /**
   * 渲染连接面板
   */
  private renderConnectionPanel(): string {
    const isConnected = this.state.isConnected;

    let tooltipText = '连接服务器';
    if (isConnected && this.state.serverInfo) {
      tooltipText = this.state.serverInfo.name || this.state.serverInfo.host;
    }

    return `
      <!-- 连接下拉菜单 -->
      <div id="connection-dropdown-menu" class="connection-dropdown-menu">
        ${this.renderConnectionDropdownContent()}
      </div>

      <!-- 连接状态图标 -->
      <div class="activity-bar-connection ${isConnected ? 'connected' : ''}" onclick="window.toggleConnectionDropdown()" data-tooltip="${tooltipText}">
        <span class="nav-item-icon">
          ${isConnected
            ? Connection({ theme: 'filled', size: '22', fill: 'currentColor' })
            : Plus({ theme: 'outline', size: '22', fill: 'currentColor' })
          }
        </span>
        <span class="nav-item-label">${isConnected ? tooltipText : '连接服务器'}</span>
        ${isConnected ? `<span class="connection-status-dot"></span>` : ''}
      </div>
    `;
  }

  /**
   * 渲染导航菜单
   */
  private renderNavigationMenu(): string {
    const currentPage = this.state.currentPage;
    const menuItems = [
      {
        id: 'system-info',
        icon: ApplicationMenu({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: '系统信息',
        active: currentPage === 'system-info'
      },
      {
        id: 'remote-operations',
        icon: FolderOpen({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: 'SFTP文件',
        active: currentPage === 'remote-operations'
      },
      {
        id: 'docker',
        icon: Whale({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: 'Docker容器',
        active: currentPage === 'docker'
      },
      {
        id: 'kubernetes',
        icon: LinkCloud({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: 'Kubernetes',
        active: currentPage === 'kubernetes'
      },
      {
        id: 'database',
        icon: Data({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: '数据库',
        active: currentPage === 'database'
      },
      {
        id: 'java-hot-update',
        icon: Fire({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: 'Java热更新',
        active: currentPage === 'java-hot-update'
      },
      {
        id: 'emergency-commands',
        icon: Code({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: '命令执行',
        active: currentPage === 'emergency-commands'
      },
      {
        id: 'packet-capture',
        icon: NetworkTree({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: '网络抓包',
        active: currentPage === 'packet-capture'
      },
      {
        id: 'quick-detection',
        icon: Rocket({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: '快速检测',
        active: currentPage === 'quick-detection'
      },
      {
        id: 'baseline-quick-edit',
        icon: SettingConfig({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: '快速编辑',
        active: currentPage === 'baseline-quick-edit'
      },
      {
        id: 'log-analysis',
        icon: Log({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: '日志审计',
        active: currentPage === 'log-analysis'
      },
      {
        id: 'notes',
        icon: DocDetail({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: '笔记',
        active: currentPage === 'notes'
      },
      {
        id: 'secfix',
        icon: Protection({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: '安全速查',
        active: currentPage === 'secfix'
      },
      {
        id: 'check-audit',
        icon: Bug({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: 'Check审计',
        active: currentPage === 'check-audit'
      },
      {
        id: 'ai-history',
        icon: History({ theme: 'outline', size: '18', fill: 'currentColor' }),
        title: 'AI历史',
        active: currentPage === 'ai-history'
      }
    ];

    return menuItems.map(item => {
      const isActive = item.active;
      const isDisabled = (item as any).disabled;

      return `
        <div class="activity-bar-item ${isActive ? 'active' : ''} ${isDisabled ? 'disabled' : ''}" data-nav-id="${item.id}" data-tooltip="${item.title}">
          <span class="nav-item-icon">
            ${item.icon}
          </span>
          <span class="nav-item-label">${item.title}</span>
          ${isDisabled ? `<span class="activity-bar-badge"></span>` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * 渲染主工作区
   */
  renderMainWorkspace(): string {
    return `
      <div class="main-workspace">
        <!-- 工作区内容 -->
        <div class="workspace-content page-enter">
          ${this.renderWorkspaceContent()}
        </div>
      </div>
    `;
  }



  /**
   * 渲染连接下拉菜单内容
   */
  renderConnectionDropdownContent(): string {
    const sshManager = (window as any).app?.sshManager;
    const connections = sshManager ? sshManager.getConnections() : [];
    // 优先使用 getActiveConnection，如果不行则遍历 connections 找一个已连接的
    const activeConnection = (sshManager ? sshManager.getActiveConnection() : null) 
        || connections.find((c: any) => c.isConnected);

    let menuItems = '';

    // 如果已连接，显示断开连接选项
    if (activeConnection) {
      const disconnectIcon = LinkInterrupt({ theme: 'outline', size: '16', fill: 'currentColor' });
      menuItems += `
        <div class="dropdown-item danger" onclick="window.disconnectServer('${activeConnection.id}'); window.hideConnectionDropdown();">
          <div class="dropdown-item-icon danger">
              ${disconnectIcon}
          </div>
          <div class="dropdown-item-content">
            <span class="dropdown-item-title">断开当前连接</span>
            <span class="dropdown-item-subtitle">${activeConnection.name}</span>
          </div>
        </div>
        <div class="dropdown-divider"></div>
      `;
    }

    // 添加新连接选项 - 放在顶部作为主要操作
    menuItems += `
      <div class="dropdown-item primary" onclick="window.showServerModal(); window.hideConnectionDropdown();">
        <div class="dropdown-item-icon primary">
            ${Plus({ theme: 'outline', size: '16', fill: 'currentColor' })}
        </div>
        <div class="dropdown-item-content">
            <span class="dropdown-item-title">添加新服务器</span>
            <span class="dropdown-item-subtitle">配置 SSH 连接</span>
        </div>
      </div>
      <div class="dropdown-divider"></div>
    `;

    if (connections.length > 0) {
      menuItems += `
        <div class="dropdown-section-title">
          <span>快速连接</span>
          <span class="count-badge">${connections.length}</span>
        </div>
        <div class="dropdown-scroll-area">
      `;

      connections.forEach((conn: any) => {
        const isConnected = conn.isConnected;
        
        menuItems += `
          <div class="dropdown-item ${isConnected ? 'active' : ''}" onclick="window.connectServer('${conn.id}'); window.hideConnectionDropdown();">
            
            <div class="dropdown-item-icon ${isConnected ? 'success' : 'default'}">
                ${isConnected 
                    ? CheckOne({ theme: 'filled', size: '16', fill: 'currentColor' }) 
                    : System({ theme: 'outline', size: '16', fill: 'currentColor' })
                }
                ${isConnected ? `<div class="status-dot"></div>` : ''}
            </div>

            <div class="dropdown-item-content">
              <span class="dropdown-item-title">${conn.name}</span>
              <span class="dropdown-item-subtitle">${conn.username}@${conn.host}</span>
            </div>
            
            ${isConnected ? `
                <div class="status-badge">运行中</div>
            ` : ''}
          </div>
        `;
      });
      
      menuItems += `</div>`; // Close scroll container
    } else {
      menuItems += `
        <div class="dropdown-empty-state">
          <div class="empty-icon">
            ${Connection({ theme: 'outline', size: '24', fill: 'currentColor' })}
          </div>
          <div class="empty-text">暂无已保存的服务器</div>
        </div>
      `;
    }

    return menuItems;
  }



  /**
   * 渲染工作区内容
   */
  private renderWorkspaceContent(): string {
    if (this.state.loading) {
      return this.renderLoadingState();
    }

    if (!this.state.isConnected) {
      return this.renderConnectionPrompt();
    }

    // 根据当前页面渲染不同内容
    switch (this.state.currentPage) {
      case 'system-info':
        return this.renderSystemInfo();
      case 'ssh-terminal':
        // SSH终端在独立窗口中打开，这里显示提示信息
        return this.renderSSHTerminalRedirect();
      case 'remote-operations':
        return this.renderRemoteOperationsPage();
      case 'docker':
        return this.renderDockerPage();
      case 'emergency-commands':
        return this.renderEmergencyCommandsPage();
      case 'quick-detection':
        return this.renderQuickDetectionPage();
      case 'kubernetes':
        return this.renderKubernetesPage();
      case 'database':
        return this.databaseRenderer.render();
      case 'java-hot-update':
        return this.renderJavaHotUpdatePage();
      case 'notes':
        return this.renderNotesPage();
      case 'secfix':
        return this.renderSecfixPage();
      case 'check-audit':
        return this.renderCheckAuditPage();
      case 'ai-history':
        return this.renderAIHistoryPage();
      case 'packet-capture':
        // Initialize lifecycle (event delegation, Tauri listeners, rate timer)
        this.packetCaptureRenderer.initialize();
        // Async render: load interfaces then populate container
        setTimeout(async () => {
            const container = document.getElementById('packet-capture-wrapper');
            if (container) {
                try {
                    container.innerHTML = await this.packetCaptureRenderer.render();
                } catch (e) {
                    console.error('Failed to render packet capture:', e);
                    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-secondary);">网络抓包模块加载失败</div>';
                }
            }
        }, 0);
        return '<div id="packet-capture-wrapper" style="height:100%"><div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--text-secondary)">正在加载网络抓包工具...</div></div>';
      case 'baseline-quick-edit':
        return this.baselineRenderer.renderBaselineQuickEditPage();
      case 'log-analysis':
        return this.renderLogAnalysisPage();
      case 'settings':
        return this.renderSettingsPage();
      default:
        return this.renderSystemInfo();
    }
  }

  /**
   * 渲染系统信息页面
   */
  private renderSystemInfo(): string {
    return this.systemInfoRenderer.renderSystemInfo(this.state);
  }

  /**
   * 渲染系统信息标签页内容（供 systemInfoTabManager 调用）
   */
  renderSystemInfoTab(tab: string): string {
    return this.systemInfoRenderer.renderSystemInfoTab(this.state, tab);
  }



  /**
   * 渲染加载状态 — 居中显示连接进度
   */
  private renderLoadingState(): string {
    const step = this.state.loadingStep || '正在连接...';

    return `
      <div class="workspace-connecting-center">
        <div class="connecting-card">
          <svg width="36" height="36" viewBox="0 0 36 36" style="display:block;">
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border-color, #334155)" stroke-width="3"/>
            <circle cx="18" cy="18" r="15" fill="none" stroke="var(--primary-color, #4299e1)" stroke-width="3"
              stroke-dasharray="28 66" stroke-linecap="round">
              <animateTransform attributeName="transform" type="rotate"
                from="0 18 18" to="360 18 18" dur="0.9s" repeatCount="indefinite"/>
            </circle>
          </svg>
          <span class="connecting-step">${step}</span>
          <div class="connecting-progress-track">
            <div class="connecting-progress-fill"></div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染服务器管理模态框
   */
  renderServerModal(): string {
    return this.serverModalRenderer.renderServerModal();
  }

  /**
   * 仅渲染服务器列表内容（用于局部刷新，不替换整个模态框）
   */
  renderServerList(): string {
    return this.serverModalRenderer.renderServerList();
  }

  /**
   * 渲染 Java 热更新页面骨架
   */
  private renderJavaHotUpdatePage(): string {
    return `
      <div class="jhu-page">
        <div class="jhu-header">
          <div class="jhu-header-left">
            <h2>☕ Java 热更新</h2>
            <span class="jhu-badge">Hot Update</span>
          </div>
          <div class="jhu-header-actions">
            <button class="jhu-btn secondary" data-jhu-action="env-info">Java 环境</button>
            <button class="jhu-btn primary" data-jhu-action="refresh">刷新</button>
          </div>
        </div>
        <div class="jhu-tabs">
          <button class="jhu-tab-btn active" data-jhu-action="switch-tab" data-jhu-param="processes">进程管理</button>
          <button class="jhu-tab-btn" data-jhu-action="switch-tab" data-jhu-param="hotupdate">热更新</button>
          <button class="jhu-tab-btn" data-jhu-action="switch-tab" data-jhu-param="diagnostics">JVM 诊断</button>
          <button class="jhu-tab-btn" data-jhu-action="switch-tab" data-jhu-param="services">服务管理</button>
          <button class="jhu-tab-btn" data-jhu-action="switch-tab" data-jhu-param="deploy">部署管理</button>
          <button class="jhu-tab-btn" data-jhu-action="switch-tab" data-jhu-param="docker">Docker容器</button>
        </div>
        <div id="jhu-content" class="jhu-content"></div>
      </div>
    `;
  }


    /**
   * 渲染连接提示
   */
  private renderConnectionPrompt(): string {
    return this.serverModalRenderer.renderConnectionPrompt();
  }

  /**
   * 渲染笔记页面
   */
  private renderNotesPage(): string {
    return `
      <div class="notes-page">
        <div class="notes-header">
          <h2>笔记</h2>
        </div>
        <div id="notes-content" style="flex:1;overflow:hidden;"></div>
      </div>
    `;
  }

  /**
   * 渲染安全速查页面
   */
  private renderSecfixPage(): string {
    return `
      <div class="sf-page">
        <div class="sf-header">
          <div class="sf-header-left">
            <h2>安全速查</h2>
            <span class="sf-badge">CTF / 应急</span>
          </div>
        </div>
        <div id="secfix-content" class="sf-content"></div>
      </div>
    `;
  }

  private renderCheckAuditPage(): string {
    return `
      <div class="ca-page">
        <div class="ca-header">
          <div class="ca-header-left">
            <h2>Check 审计</h2>
            <span class="ca-badge">Check专武</span>
          </div>
          <div class="ca-header-actions">
            <button class="ca-btn primary" data-ca-action="refresh">刷新状态</button>
          </div>
        </div>
        <div class="ca-tabs">
          <button class="ca-tab-btn active" data-ca-action="switch-tab" data-ca-param="hijack">命令劫持</button>
          <button class="ca-tab-btn" data-ca-action="switch-tab" data-ca-param="audit-log">审计日志</button>
          <button class="ca-tab-btn" data-ca-action="switch-tab" data-ca-param="analysis">Check分析</button>
          <button class="ca-tab-btn" data-ca-action="switch-tab" data-ca-param="quick-fix">快速修复</button>
        </div>
        <div id="ca-content" class="ca-content"></div>
      </div>
    `;
  }

  private renderAIHistoryPage(): string {
    return `
      <div class="aih-page">
        <div class="aih-header"><h2>AI 历史</h2></div>
        <div id="ai-history-content" class="aih-content"></div>
      </div>
    `;
  }

  /**
   * 渲染远程操作页面（SFTP + SSH终端分屏）
   */
  private static remoteOperationsInitTimer: number | null = null;

  private renderRemoteOperationsPage(): string {
    // 防止重复设置定时器
    if (ModernUIRenderer.remoteOperationsInitTimer) {
      clearTimeout(ModernUIRenderer.remoteOperationsInitTimer);
    }

    // 延迟初始化远程操作页面
    ModernUIRenderer.remoteOperationsInitTimer = window.setTimeout(() => {
      (window as any).initRemoteOperationsPage?.();
      ModernUIRenderer.remoteOperationsInitTimer = null;
    }, 100);

    return `
      <div class="sftp-page-container">
        <!-- Compact Toolbar: nav + breadcrumb + actions -->
        <div class="sftp-toolbar">
          <div class="sftp-nav-controls">
            <button class="modern-btn icon-only secondary" onclick="sftpManager.navigateToParent()" title="返回上一级">
              ${Up({ theme: 'outline', size: '16', fill: 'currentColor' })}
            </button>
            <button class="modern-btn icon-only secondary" onclick="sftpManager.navigateToPath('/')" title="返回根目录">
              ${Home({ theme: 'outline', size: '16', fill: 'currentColor' })}
            </button>
          </div>

          <div class="sftp-breadcrumb-bar">
            <div id="sftp-breadcrumb" class="sftp-breadcrumb">
              <span class="breadcrumb-segment breadcrumb-root" onclick="sftpManager.navigateToPath('/')" title="根目录">/</span>
            </div>
            <input
              type="text"
              id="sftp-path-input"
              class="sftp-path-input"
              placeholder="输入路径..."
              onkeydown="if(event.key === 'Enter') sftpManager.navigateToPath(this.value)"
              onfocus="this.parentElement.classList.add('editing')"
              onblur="this.parentElement.classList.remove('editing')"
            />
          </div>

          <div class="sftp-actions">
            <button class="modern-btn icon-only secondary" onclick="window.sftpRefresh && window.sftpRefresh()" title="刷新列表">
              ${Refresh({ theme: 'outline', size: '16', fill: 'currentColor' })}
            </button>
            <button class="modern-btn icon-only secondary" onclick="window.sftpOpenCreateFolder && window.sftpOpenCreateFolder()" title="新建文件夹">
              ${FolderPlus({ theme: 'outline', size: '16', fill: 'currentColor' })}
            </button>
            <button class="modern-btn icon-only secondary" onclick="window.sftpCreateFile && window.sftpCreateFile()" title="新建文件">
              ${FileText({ theme: 'outline', size: '16', fill: 'currentColor' })}
            </button>
            <button class="modern-btn icon-only secondary" onclick="window.sftpIntegritySnapshot && window.sftpIntegritySnapshot()" title="完整性快照">
              ${Shield({ theme: 'outline', size: '16', fill: 'currentColor' })}
            </button>
            <button class="modern-btn icon-only secondary" onclick="window.toggleSftpHistory && window.toggleSftpHistory()" title="传输历史">
              ${History({ theme: 'outline', size: '16', fill: 'currentColor' })}
            </button>
            <button id="sftp-upload-btn" class="modern-btn primary small" onclick="window.sftpOpenUpload && window.sftpOpenUpload()" title="上传文件">
              ${Upload({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>上传</span>
            </button>
          </div>
        </div>

        <!-- Quick Jump Bar for Emergency Response -->
        <div class="sftp-quick-jump-bar">
          <span class="quick-jump-label">快速跳转</span>
          <div class="quick-jump-buttons">
            <button class="quick-jump-btn" onclick="sftpManager.navigateToPath('/')" title="根目录">/</button>
            <button class="quick-jump-btn" onclick="sftpManager.navigateToPath('/tmp')" title="临时文件">/tmp</button>
            <button class="quick-jump-btn" onclick="sftpManager.navigateToPath('/var/log')" title="系统日志">/var/log</button>
            <button class="quick-jump-btn" onclick="sftpManager.navigateToPath('/etc')" title="配置文件">/etc</button>
            <button class="quick-jump-btn" onclick="sftpManager.navigateToPath('/etc/cron.d')" title="计划任务">/etc/cron.d</button>
            <button class="quick-jump-btn risk-highlight" onclick="sftpManager.navigateToPath('/root/.ssh')" title="Root SSH密钥">/root/.ssh</button>
            <button class="quick-jump-btn" onclick="sftpManager.navigateToPath('/home')" title="用户主目录">/home</button>
            <button class="quick-jump-btn risk-highlight" onclick="sftpManager.navigateToPath('/var/spool/cron')" title="用户计划任务">/var/spool/cron</button>
            <button class="quick-jump-btn" onclick="sftpManager.navigateToPath('/etc/init.d')" title="启动脚本">/etc/init.d</button>
            <button class="quick-jump-btn" onclick="sftpManager.navigateToPath('/var/www')" title="Web根目录">/var/www</button>
            <button class="quick-jump-btn risk-highlight" onclick="sftpManager.navigateToPath('/dev/shm')" title="内存文件系统(常被利用)">/dev/shm</button>
            <button class="quick-jump-btn" onclick="sftpManager.navigateToPath('/opt')" title="第三方软件">/opt</button>
            <button class="quick-jump-btn" onclick="sftpManager.navigateToPath('/usr/local/bin')" title="本地二进制">/usr/local/bin</button>
          </div>
        </div>

        <!-- File List -->
        <div class="sftp-file-list-container">
          <table class="sftp-table">
            <thead>
              <tr>
                <th class="sftp-th-sortable" style="width: 38%;" onclick="window.setSftpSortMode(sftpManager.getSortMode() === 'name-asc' ? 'name-desc' : 'name-asc')" id="sftp-th-name">
                  名称 <span class="sort-indicator" id="sort-ind-name">▲</span>
                </th>
                <th class="sftp-th-sortable" style="width: 10%;" onclick="window.setSftpSortMode(sftpManager.getSortMode() === 'size-asc' ? 'size-desc' : 'size-asc')" id="sftp-th-size">
                  大小 <span class="sort-indicator" id="sort-ind-size"></span>
                </th>
                <th style="width: 12%;">权限</th>
                <th style="width: 12%;">所有者</th>
                <th class="sftp-th-sortable" style="width: 16%;" onclick="window.setSftpSortMode(sftpManager.getSortMode() === 'modified-asc' ? 'modified-desc' : 'modified-asc')" id="sftp-th-modified">
                  修改时间 <span class="sort-indicator" id="sort-ind-modified"></span>
                </th>
              </tr>
            </thead>
            <tbody id="sftp-file-list">
              <!-- File list content will be injected here -->
              <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: var(--text-secondary);">
                  <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                    <div class="loading-spinner" style="width: 24px; height: 24px;"></div>
                    <span>正在加载文件列表...</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Status Bar -->
        <div class="sftp-status-bar">
          <div class="sftp-status-left">
            <div class="status-item" id="sftp-status-count">
              <span>0 项</span>
            </div>
            <div class="status-item" id="sftp-status-risk" style="display: none;">
              <span style="color: var(--error-color);">⚠ <span id="sftp-risk-count">0</span> 个可疑项</span>
            </div>
          </div>
          <div class="sftp-status-right">
            <div class="status-item" id="sftp-status-path" style="opacity: 0.7;">
              <span>/</span>
            </div>
            <div class="status-item">
              ${this.state.isConnected ? '<span style="color: var(--success-color);">● 已连接</span>' : '<span style="color: var(--error-color);">● 未连接</span>'}
            </div>
          </div>
        </div>
      </div>
      ${this.sftpContextMenuRenderer.renderContextMenu()}
    `;
  }





  /**
   * 渲染Docker页面
   */
  private renderDockerPage(): string {
    // dockerPageManager is a singleton import, always available
    dockerPageManager.initialize();
    return dockerPageManager.renderPage();
  }

  /**
   * 渲染Kubernetes页面
   */
  private renderKubernetesPage(): string {
    return this.kubernetesRenderer.render();
  }

  /**
   * 渲染日志审计页面
   */
  private renderLogAnalysisPage(): string {
    return this.logAnalysisRenderer.render();
  }

  /**
   * 渲染应急命令页面
   */
  private renderEmergencyCommandsPage(): string {
    return this.emergencyRenderer.renderEmergencyCommandsPage();
  }

  /**
   * 渲染快速检测页面
   */
  private renderQuickDetectionPage(): string {
    return this.emergencyRenderer.renderQuickDetectionPage();
  }

  /**
   * 渲染快速检测报告模态框
   */
  renderDetectionReportModal(): string {
    return this.emergencyRenderer.renderDetectionReportModal();
  }

  /**
   * 渲染状态栏
   */
  renderStatusBar(): string {
    const connectedIcon = CheckOne({ theme: 'filled', size: '12', fill: '#22c55e' });
    const disconnectedIcon = CloseOne({ theme: 'filled', size: '12', fill: '#ef4444' });

    let statusText: string;
    if (this.state.isConnected) {
      const server = this.state.serverInfo?.name || this.state.currentServer || '';
      statusText = `${connectedIcon} 已连接${server ? ` — ${server}` : ''}`;
    } else {
      statusText = `${disconnectedIcon} 未连接`;
    }

    return `
      <div class="status-bar">
        <div class="status-left">
          <span style="margin-left: var(--spacing-md); display: flex; align-items: center; gap: 4px;">${statusText}</span>
        </div>
        <div class="status-right">
          <span>LovelyRes v${APP_VERSION}</span>
        </div>
      </div>
    `;
  }

  /**
   * 渲染 SSH 终端重定向页面
   */
  private renderSSHTerminalRedirect(): string {
    return `
      <div class="ssh-terminal-redirect" style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        text-align: center;
        padding: 2rem;
      ">
        <div style="
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 8px;
          padding: 2rem;
          max-width: 500px;
          width: 100%;
        ">
          <div style="
            font-size: 48px;
            margin-bottom: 1rem;
            color: var(--text-secondary);
          ">🖥️</div>

          <h2 style="
            color: var(--text-primary);
            margin-bottom: 1rem;
            font-size: 1.5rem;
          ">SSH 终端已在新窗口中打开</h2>

          <p style="
            color: var(--text-secondary);
            margin-bottom: 1.5rem;
            line-height: 1.6;
          ">
            SSH 终端现在在独立窗口中运行，这样可以：<br>
            • 保持会话持久性<br>
            • 不影响主界面操作<br>
            • 提供更好的终端体验
          </p>

          <button
            onclick="openSSHTerminalWindow()"
            style="
              background: var(--primary-color);
              color: white;
              border: none;
              padding: 0.75rem 1.5rem;
              border-radius: 6px;
              cursor: pointer;
              font-size: 1rem;
              transition: all 0.2s;
            "
            onmouseover="this.style.opacity='0.9'"
            onmouseout="this.style.opacity='1'"
          >
            重新打开 SSH 终端
          </button>
        </div>
      </div>
    `;
  }



  /**
   * 渲染设置页面（覆盖层模式）
   */
  renderSettingsPage(): string {
    return `
      <div class="settings-overlay" style="
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
      ">
        <div class="settings-page" style="
          width: 90%;
          max-width: 800px;
          max-height: 90%;
          padding: var(--spacing-lg);
          background: var(--bg-primary);
          border-radius: var(--border-radius-lg);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          overflow-y: auto;
          position: relative;
        ">
          <!-- 关闭按钮 -->
          <button class="settings-close-btn" style="
            position: absolute;
            top: var(--spacing-md);
            right: var(--spacing-md);
            background: none;
            border: none;
            color: var(--text-secondary);
            font-size: 20px;
            cursor: pointer;
            padding: 4px;
            border-radius: 4px;
            transition: all 0.2s;
          " title="关闭设置">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>

          <div class="settings-container" style="
            margin: 0;
          ">
          <div class="settings-header" style="
            margin-bottom: var(--spacing-xl);
            padding-bottom: var(--spacing-lg);
            border-bottom: 1px solid var(--border-color);
          ">
            <h1 style="
              font-size: 24px;
              font-weight: 600;
              color: var(--text-primary);
              margin: 0 0 var(--spacing-sm) 0;
            ">设置</h1>
            <p style="
              color: var(--text-secondary);
              margin: 0;
              font-size: 14px;
            ">配置应用程序的基础设置和AI功能</p>
          </div>

          <div class="settings-tabs" style="
            display: flex;
            gap: var(--spacing-sm);
            margin-bottom: var(--spacing-xl);
            border-bottom: 1px solid var(--border-color);
          ">
            <button class="settings-tab active" data-tab="basic" style="
              padding: var(--spacing-md) var(--spacing-lg);
              background: none;
              border: none;
              color: var(--text-primary);
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              border-bottom: 2px solid var(--accent-color);
              transition: all 0.2s;
            ">基础设置</button>
            <button class="settings-tab" data-tab="ai" style="
              padding: var(--spacing-md) var(--spacing-lg);
              background: none;
              border: none;
              color: var(--text-secondary);
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              border-bottom: 2px solid transparent;
              transition: all 0.2s;
            ">AI设置</button>
            <button class="settings-tab" data-tab="tools" style="
              padding: var(--spacing-md) var(--spacing-lg);
              background: none;
              border: none;
              color: var(--text-secondary);
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              border-bottom: 2px solid transparent;
              transition: all 0.2s;
            ">工具</button>
          </div>

          <div class="settings-content">
            <!-- 基础设置 -->
            <div class="settings-panel" id="basic-settings" style="display: block;">
              <div class="settings-section" style="
                background: var(--bg-secondary);
                border-radius: var(--border-radius-lg);
                padding: var(--spacing-lg);
                margin-bottom: var(--spacing-lg);
              ">
                <h3 style="
                  font-size: 16px;
                  font-weight: 600;
                  color: var(--text-primary);
                  margin: 0 0 var(--spacing-md) 0;
                ">界面设置</h3>

                <div class="setting-item" style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: var(--spacing-md);
                ">
                  <div>
                    <label style="
                      font-size: 14px;
                      font-weight: 500;
                      color: var(--text-primary);
                      display: block;
                      margin-bottom: 4px;
                    ">全局字体</label>
                    <p style="
                      font-size: 12px;
                      color: var(--text-secondary);
                      margin: 0;
                    ">设置应用程序的全局字体</p>
                  </div>
                  <select id="global-font" style="
                    padding: 8px 12px;
                    border: 1px solid var(--border-color);
                    border-radius: var(--border-radius);
                    background: var(--bg-primary);
                    color: var(--text-primary);
                    font-size: 14px;
                    min-width: 200px;
                  ">
                    <option value="system">正在加载字体...</option>
                  </select>
                </div>

                <div class="setting-item" style="
                  display: flex;
                  justify-content: space-between;
                  align-items: center;
                  margin-bottom: var(--spacing-md);
                ">
                  <div>
                    <label style="
                      font-size: 14px;
                      font-weight: 500;
                      color: var(--text-primary);
                      display: block;
                      margin-bottom: 4px;
                    ">字体大小</label>
                    <p style="
                      font-size: 12px;
                      color: var(--text-secondary);
                      margin: 0;
                    ">设置应用程序的全局字体大小（10-24px）</p>
                  </div>
                  <div style="display: flex; align-items: center; gap: var(--spacing-sm);">
                    <input type="range" id="global-font-size" min="10" max="24" step="1" value="14" style="
                      width: 120px;
                      accent-color: var(--accent-color);
                    " />
                    <span id="font-size-value" style="
                      font-size: 14px;
                      color: var(--text-primary);
                      min-width: 40px;
                      text-align: right;
                    ">14px</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- AI设置 -->
            <div class="settings-panel" id="ai-settings" style="display: none;">
              <div class="settings-section" style="
                background: var(--bg-secondary);
                border-radius: var(--border-radius-lg);
                padding: var(--spacing-lg);
                margin-bottom: var(--spacing-lg);
              ">
                <h3 style="
                  font-size: 16px;
                  font-weight: 600;
                  color: var(--text-primary);
                  margin: 0 0 var(--spacing-md) 0;
                ">AI配置</h3>

                <!-- AI提供商选择 -->
                <div class="setting-item" style="margin-bottom: var(--spacing-lg);">
                  <label style="
                    font-size: 14px;
                    font-weight: 500;
                    color: var(--text-primary);
                    display: block;
                    margin-bottom: 8px;
                  ">AI提供商</label>
                  <div style="display: flex; gap: var(--spacing-sm); align-items: flex-end;">
                    <div style="flex: 1; position: relative;">
                      <select id="ai-provider" style="
                        width: 100%;
                        padding: 10px 12px;
                        border: 1px solid var(--border-color);
                        border-radius: var(--border-radius);
                        background: var(--bg-primary);
                        color: var(--text-primary);
                        font-size: 14px;
                        box-sizing: border-box;
                      ">
                        <option value="openai">OpenAI (GPT-4o/GPT-3.5)</option>
                        <option value="deepseek">DeepSeek (国产大模型)</option>
                        <option value="claude">Claude (Anthropic)</option>
                        <option value="custom">自定义 API</option>
                      </select>
                    </div>
                    <button id="delete-ai-provider" class="modern-btn danger" style="
                      padding: 10px 12px;
                      font-size: 13px;
                      white-space: nowrap;
                      display: none;
                      align-items: center;
                      gap: 6px;
                    ">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                      删除
                    </button>
                    <button id="add-ai-provider" class="modern-btn secondary" style="
                      padding: 10px 16px;
                      font-size: 13px;
                      white-space: nowrap;
                      display: flex;
                      align-items: center;
                      gap: 6px;
                    ">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                      </svg>
                      新增
                    </button>
                  </div>
                </div>

                <!-- 当前提供商配置 -->
                <div id="ai-provider-config">
                  <div class="setting-item" style="margin-bottom: var(--spacing-md);">
                    <label style="
                      font-size: 14px;
                      font-weight: 500;
                      color: var(--text-primary);
                      display: block;
                      margin-bottom: 8px;
                    ">API Key</label>
                    <input type="password" id="ai-api-key" placeholder="输入您的AI API Key" style="
                      width: 100%;
                      padding: 10px 12px;
                      border: 1px solid var(--border-color);
                      border-radius: var(--border-radius);
                      background: var(--bg-primary);
                      color: var(--text-primary);
                      font-size: 14px;
                      box-sizing: border-box;
                    ">
                  </div>

                  <div class="setting-item" style="margin-bottom: var(--spacing-md);">
                    <label style="
                      font-size: 14px;
                      font-weight: 500;
                      color: var(--text-primary);
                      display: block;
                      margin-bottom: 8px;
                    ">模型</label>
                    <input type="text" id="ai-model" placeholder="例如: gpt-3.5-turbo" style="
                      width: 100%;
                      padding: 10px 12px;
                      border: 1px solid var(--border-color);
                      border-radius: var(--border-radius);
                      background: var(--bg-primary);
                      color: var(--text-primary);
                      font-size: 14px;
                      box-sizing: border-box;
                    ">
                  </div>

                  <div class="setting-item" style="margin-bottom: var(--spacing-lg);">
                    <label style="
                      font-size: 14px;
                      font-weight: 500;
                      color: var(--text-primary);
                      display: block;
                      margin-bottom: 8px;
                    ">Base URL</label>
                    <input type="url" id="ai-base-url" placeholder="例如: https://api.openai.com/v1" style="
                      width: 100%;
                      padding: 10px 12px;
                      border: 1px solid var(--border-color);
                      border-radius: var(--border-radius);
                      background: var(--bg-primary);
                      color: var(--text-primary);
                      font-size: 14px;
                      box-sizing: border-box;
                    ">
                  </div>

                  <!-- 代理设置 -->
                  <div class="setting-item" style="margin-bottom: var(--spacing-lg);">
                    <label style="
                      display: flex;
                      align-items: center;
                      gap: 8px;
                      font-size: 14px;
                      font-weight: 500;
                      color: var(--text-primary);
                      margin-bottom: 12px;
                      cursor: pointer;
                    ">
                      <input type="checkbox" id="ai-use-proxy" style="
                        width: 18px;
                        height: 18px;
                        cursor: pointer;
                      ">
                      使用代理
                    </label>

                    <div id="ai-proxy-settings" style="
                      display: none;
                      padding: 12px;
                      border: 1px solid var(--border-color);
                      border-radius: var(--border-radius);
                      background: var(--bg-secondary);
                    ">
                      <div style="margin-bottom: 12px;">
                        <label style="
                          font-size: 13px;
                          color: var(--text-secondary);
                          display: block;
                          margin-bottom: 6px;
                        ">代理类型</label>
                        <select id="ai-proxy-type" style="
                          width: 100%;
                          padding: 8px 10px;
                          border: 1px solid var(--border-color);
                          border-radius: var(--border-radius);
                          background: var(--bg-primary);
                          color: var(--text-primary);
                          font-size: 14px;
                          cursor: pointer;
                        ">
                          <option value="http">HTTP</option>
                          <option value="https">HTTPS</option>
                          <option value="socks5">SOCKS5</option>
                        </select>
                      </div>

                      <div>
                        <label style="
                          font-size: 13px;
                          color: var(--text-secondary);
                          display: block;
                          margin-bottom: 6px;
                        ">代理地址</label>
                        <input type="text" id="ai-proxy-url" placeholder="例如: 127.0.0.1:7890" style="
                          width: 100%;
                          padding: 8px 10px;
                          border: 1px solid var(--border-color);
                          border-radius: var(--border-radius);
                          background: var(--bg-primary);
                          color: var(--text-primary);
                          font-size: 14px;
                          box-sizing: border-box;
                        ">
                        <div style="
                          font-size: 12px;
                          color: var(--text-secondary);
                          margin-top: 4px;
                        ">格式: 主机:端口 或 协议://主机:端口</div>
                      </div>
                    </div>
                  </div>

                  <!-- AI测试功能 -->
                  <div class="setting-item" style="margin-bottom: var(--spacing-md);">
                    <div style="
                      display: flex;
                      align-items: center;
                      gap: var(--spacing-md);
                      margin-bottom: var(--spacing-sm);
                    ">
                      <button id="test-ai-connection" class="modern-btn secondary" style="
                        padding: 8px 16px;
                        font-size: 13px;
                        display: flex;
                        align-items: center;
                        gap: 6px;
                      ">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                        </svg>
                        测试连接
                      </button>
                      <span id="ai-test-status" style="
                        font-size: 13px;
                        color: var(--text-secondary);
                      ">点击测试AI连接状态</span>
                    </div>
                    <div id="ai-test-result" style="
                      padding: 10px;
                      border-radius: var(--border-radius);
                      background: var(--bg-primary);
                      border: 1px solid var(--border-color);
                      font-size: 13px;
                      color: var(--text-secondary);
                      display: none;
                      max-height: 100px;
                      overflow-y: auto;
                    "></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 工具设置 -->
            <div class="settings-panel" id="tools-settings" style="display: none;">
              <div class="settings-section" style="
                background: var(--bg-secondary);
                border-radius: var(--border-radius-lg);
                padding: var(--spacing-lg);
                margin-bottom: var(--spacing-lg);
              ">
                <h3 style="
                  font-size: 16px;
                  font-weight: 600;
                  color: var(--text-primary);
                  margin: 0 0 var(--spacing-md) 0;
                ">Busybox 可信命令执行</h3>
                <p style="font-size:12px;color:var(--text-secondary);margin:0 0 12px;">
                  busybox 是静态编译的工具集合，不受系统命令篡改和 LD_PRELOAD 劫持影响。启用后所有 SSH 命令将通过 busybox sh 执行。
                </p>
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                  <span id="settings-bb-status" style="font-size:12px;color:var(--text-secondary);">状态: 检测中...</span>
                  <span id="settings-bb-path" style="font-size:11px;color:var(--text-secondary);font-family:monospace;"></span>
                </div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                  <button class="modern-btn primary" id="settings-bb-upload" style="padding:8px 16px;font-size:13px;"
                    onclick="window.__settingsBusyboxUpload?.()">
                    上传本地 busybox
                  </button>
                  <button class="modern-btn secondary" id="settings-bb-enable" style="padding:8px 16px;font-size:13px;"
                    onclick="window.__settingsBusyboxEnable?.()">
                    启用
                  </button>
                  <button class="modern-btn secondary" id="settings-bb-disable" style="padding:8px 16px;font-size:13px;"
                    onclick="window.__settingsBusyboxDisable?.()">
                    禁用
                  </button>
                  <a href="https://busybox.net/downloads/binaries/" target="_blank" rel="noopener"
                    style="padding:8px 16px;font-size:13px;color:var(--accent-color);text-decoration:none;border:1px solid var(--border-color);border-radius:var(--border-radius);display:inline-flex;align-items:center;">
                    busybox 下载地址
                  </a>
                </div>
                <div id="settings-bb-log" style="
                  margin-top:12px;font-size:11px;font-family:monospace;
                  color:var(--text-secondary);white-space:pre-wrap;
                  max-height:120px;overflow-y:auto;display:none;
                  background:var(--bg-tertiary);padding:8px;border-radius:6px;
                "></div>
              </div>
            </div>

            <!-- 保存按钮 -->
            <div class="settings-actions" style="
              display: flex;
              justify-content: flex-end;
              gap: var(--spacing-md);
              padding-top: var(--spacing-lg);
              border-top: 1px solid var(--border-color);
            ">
              <button class="modern-btn secondary" id="reset-settings" style="
                padding: 10px 20px;
                font-size: 14px;
              ">重置默认</button>
              <button class="modern-btn primary" id="save-settings" style="
                padding: 10px 20px;
                font-size: 14px;
              ">保存设置</button>
            </div>
          </div>
        </div>

        <!-- 新增AI提供商弹窗 -->
        <div id="add-provider-modal" style="
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          z-index: 10001;
          align-items: center;
          justify-content: center;
        ">
          <div style="
            background: var(--bg-primary);
            border-radius: var(--border-radius-lg);
            padding: var(--spacing-xl);
            width: 90%;
            max-width: 500px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            border: 1px solid var(--border-color);
          ">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: var(--spacing-lg);
            ">
              <h3 style="
                font-size: 18px;
                font-weight: 600;
                color: var(--text-primary);
                margin: 0;
              ">新增AI提供商</h3>
              <button id="close-add-provider-modal" style="
                background: none;
                border: none;
                color: var(--text-secondary);
                cursor: pointer;
                padding: 4px;
                border-radius: var(--border-radius);
                transition: all 0.2s;
              ">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>

            <form id="add-provider-form">
              <div class="setting-item" style="margin-bottom: var(--spacing-md);">
                <label style="
                  font-size: 14px;
                  font-weight: 500;
                  color: var(--text-primary);
                  display: block;
                  margin-bottom: 8px;
                ">提供商名称 *</label>
                <input type="text" id="new-provider-name" placeholder="例如: 我的Claude、公司AI等" required style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1px solid var(--border-color);
                  border-radius: var(--border-radius);
                  background: var(--bg-primary);
                  color: var(--text-primary);
                  font-size: 14px;
                  box-sizing: border-box;
                ">
              </div>

              <div class="setting-item" style="margin-bottom: var(--spacing-md);">
                <label style="
                  font-size: 14px;
                  font-weight: 500;
                  color: var(--text-primary);
                  display: block;
                  margin-bottom: 8px;
                ">API Key</label>
                <input type="password" id="new-provider-api-key" placeholder="输入API Key" style="
                  width: 100%;
                  padding: 10px 12px;
                  border: 1px solid var(--border-color);
                  border-radius: var(--border-radius);
                  background: var(--bg-primary);
                  color: var(--text-primary);
                  font-size: 14px;
                  box-sizing: border-box;
                ">
              </div>

              <div class="setting-item" style="margin-bottom: var(--spacing-md);">
                <label style="font-size:14px;font-weight:500;color:var(--text-primary);display:block;margin-bottom:8px;">模型</label>
                <input type="text" id="new-provider-model" list="ai-model-hints" placeholder="选择或输入模型名称" style="
                  width:100%;padding:10px 12px;border:1px solid var(--border-color);border-radius:var(--border-radius);
                  background:var(--bg-primary);color:var(--text-primary);font-size:14px;box-sizing:border-box;">
                <datalist id="ai-model-hints">
                  <option value="gpt-4o" label="OpenAI GPT-4o（推荐，速度快）">
                  <option value="gpt-4o-mini" label="OpenAI GPT-4o Mini（最便宜）">
                  <option value="gpt-4-turbo" label="OpenAI GPT-4 Turbo">
                  <option value="gpt-3.5-turbo" label="OpenAI GPT-3.5（经济）">
                  <option value="claude-sonnet-4-20250514" label="Claude Sonnet 4（推荐）">
                  <option value="claude-3-5-sonnet-20241022" label="Claude 3.5 Sonnet">
                  <option value="claude-3-haiku-20240307" label="Claude 3 Haiku（最快）">
                  <option value="deepseek-chat" label="DeepSeek Chat（性价比高）">
                  <option value="deepseek-reasoner" label="DeepSeek Reasoner（推理）">
                  <option value="qwen-turbo" label="通义千问 Turbo">
                  <option value="qwen-plus" label="通义千问 Plus">
                  <option value="glm-4" label="智谱 GLM-4">
                </datalist>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">
                  💡 可从列表选择常见模型，也可手动输入自定义模型名称
                </div>
              </div>

              <div class="setting-item" style="margin-bottom: var(--spacing-md);">
                <label style="font-size:14px;font-weight:500;color:var(--text-primary);display:block;margin-bottom:8px;">
                  API 格式
                </label>
                <div style="display:flex;gap:8px;">
                  <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-secondary);cursor:pointer;">
                    <input type="radio" name="new-provider-format" value="openai" checked style="accent-color:var(--primary-color);">
                    OpenAI 兼容（大多数国产模型）
                  </label>
                  <label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text-secondary);cursor:pointer;">
                    <input type="radio" name="new-provider-format" value="claude" style="accent-color:var(--primary-color);">
                    Claude 格式
                  </label>
                </div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">
                  💡 DeepSeek/通义千问/智谱/Ollama 等均兼容 OpenAI 格式
                </div>
              </div>

              <div class="setting-item" style="margin-bottom: var(--spacing-lg);">
                <label style="font-size:14px;font-weight:500;color:var(--text-primary);display:block;margin-bottom:8px;">Base URL</label>
                <input type="url" id="new-provider-base-url" list="ai-baseurl-hints" placeholder="API 端点地址" style="
                  width:100%;padding:10px 12px;border:1px solid var(--border-color);border-radius:var(--border-radius);
                  background:var(--bg-primary);color:var(--text-primary);font-size:14px;box-sizing:border-box;">
                <datalist id="ai-baseurl-hints">
                  <option value="https://api.openai.com/v1/chat/completions" label="OpenAI 官方">
                  <option value="https://api.anthropic.com/v1/messages" label="Claude 官方">
                  <option value="https://api.deepseek.com/v1/chat/completions" label="DeepSeek 官方">
                  <option value="https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" label="通义千问">
                  <option value="https://open.bigmodel.cn/api/paas/v4/chat/completions" label="智谱 GLM">
                  <option value="http://localhost:11434/v1/chat/completions" label="Ollama 本地">
                </datalist>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:4px;">
                  💡 填入完整 API 地址。不填则使用提供商默认地址
                </div>
              </div>

              <div style="
                display: flex;
                gap: var(--spacing-md);
                justify-content: flex-end;
              ">
                <button type="button" id="cancel-add-provider" class="modern-btn secondary" style="
                  padding: 10px 20px;
                  font-size: 14px;
                ">取消</button>
                <button type="submit" id="save-new-provider" class="modern-btn primary" style="
                  padding: 10px 20px;
                  font-size: 14px;
                ">保存</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染SSH终端标题栏按钮
   */
  renderSSHTerminalTitleButton(): string {
    return `
      <button id="ssh-terminal-title-btn" class="modern-btn secondary" style="padding: 6px 12px; font-size: 11px; margin-right: var(--spacing-sm); display: flex; align-items: center; gap: 6px;" title="打开SSH终端">
        <svg width="14" height="14" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="4" y="8" width="40" height="32" rx="2" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="bevel"/>
          <path d="M12 18L19 24L12 30" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="bevel"/>
          <path d="M23 32H36" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="bevel"/>
        </svg>
        终端
      </button>
    `;
  }
}
