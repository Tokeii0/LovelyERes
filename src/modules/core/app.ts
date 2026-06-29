/**
 * LovelyRes 核心应用类
 * 负责应用初始化、状态管理和模块协调
 */

import { invoke } from "@tauri-apps/api/core";
import { StateManager } from './stateManager';
import { ModernUIRenderer } from '../ui/modernUIRenderer';
import { ThemeManager } from '../ui/theme';
import { SSHManager } from '../ssh/sshManager';
import { DockerManager } from '../docker/dockerManager';
import { DockerEmergencyManager } from '../docker/dockerEmergencyManager';
import { DockerSecurityAuditor } from '../docker/dockerSecurityAuditor';
import { KubernetesManager } from '../kubernetes/kubernetesManager';
import { KubernetesEmergencyManager } from '../kubernetes/kubernetesEmergencyManager';
import { KubernetesSecurityAuditor } from '../kubernetes/kubernetesSecurityAuditor';
import { SystemInfoManager } from '../system/systemInfoManager';
import { sshConnectionManager } from '../remote/sshConnectionManager';
import { showConfirm } from '../ui/confirmDialog';

export interface ServerInfo {
  name: string;
  host: string;
  port: number;
  username?: string;
  detailedInfo?: any; // 用于存储系统详细信息
}

export interface AppState {
  theme: 'light' | 'dark' | 'sakura' | 'midnight' | 'ocean';
  isConnected: boolean;
  currentServer?: string; // 保留向后兼容
  serverInfo?: ServerInfo; // 新增详细服务器信息
  loading: boolean;
  loadingStep?: string; // 当前连接步骤描述
  currentPage: 'system-info' | 'ssh-terminal' | 'remote-operations' | 'docker' | 'emergency-commands' | 'log-analysis' | 'settings' | 'kubernetes' | 'database' | 'packet-capture' | 'baseline-quick-edit' | 'java-hot-update' | 'notes' | 'secfix' | 'check-audit' | 'ai-history';
}

export class LovelyResApp {
  private stateManager: StateManager;
  private modernUIRenderer: ModernUIRenderer;
  private themeManager: ThemeManager;
  private sshManager: SSHManager;
  private dockerManager: DockerManager;
  private dockerEmergencyManager: DockerEmergencyManager;
  private dockerSecurityAuditor: DockerSecurityAuditor;
  private kubernetesManager: KubernetesManager;
  private kubernetesEmergencyManager: KubernetesEmergencyManager;
  private kubernetesSecurityAuditor: KubernetesSecurityAuditor;
  private systemInfoManager: SystemInfoManager;

  constructor() {
    this.stateManager = new StateManager();
    this.modernUIRenderer = new ModernUIRenderer(this.stateManager);
    this.themeManager = new ThemeManager();
    this.sshManager = new SSHManager();
    this.dockerManager = new DockerManager();
    this.dockerEmergencyManager = new DockerEmergencyManager(this.dockerManager);
    this.dockerSecurityAuditor = new DockerSecurityAuditor(this.dockerManager);
    this.kubernetesManager = new KubernetesManager();
    this.kubernetesEmergencyManager = new KubernetesEmergencyManager(this.kubernetesManager);
    this.kubernetesSecurityAuditor = new KubernetesSecurityAuditor(this.kubernetesManager);
    this.systemInfoManager = new SystemInfoManager();

    // 暴露管理器和应用实例给全局对象，供UI使用
    (window as any).app = {
      sshManager: this.sshManager,
      dockerManager: this.dockerManager,
      dockerEmergencyManager: this.dockerEmergencyManager,
      dockerSecurityAuditor: this.dockerSecurityAuditor,
      kubernetesManager: this.kubernetesManager,
      kubernetesEmergencyManager: this.kubernetesEmergencyManager,
      kubernetesSecurityAuditor: this.kubernetesSecurityAuditor,
      systemInfoManager: this.systemInfoManager,
      stateManager: this.stateManager,
      modernUIRenderer: this.modernUIRenderer,
      render: () => this.render() // 暴露render方法
    };
  }

  /**
   * 初始化应用
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 LovelyRes 应用初始化开始...');
      
      // 初始化状态管理器
      await this.stateManager.initialize();

      // 设置UI渲染器到状态管理器
      this.stateManager.setUIRenderer(this.modernUIRenderer);

      // 初始化主题
      await this.initializeTheme();
      
      // 注意: settingsManager 和 sshTerminalManager 的初始化
      // 已在 main.ts 的 initializeApp() 中统一执行，此处不再重复调用

      // 渲染UI
      this.render();

      // 绑定事件
      this.bindEvents();
      
      console.log('✅ LovelyRes 应用初始化完成');
    } catch (error) {
      console.error('❌ 应用初始化失败:', error);
      throw error;
    }
  }

  /**
   * 初始化主题系统
   */
  private async initializeTheme(): Promise<void> {
    try {
      // 从后端加载主题设置
      const savedTheme = await this.loadThemeFromBackend();
      if (savedTheme && ['light', 'dark', 'sakura', 'midnight', 'ocean'].includes(savedTheme)) {
        this.stateManager.setTheme(savedTheme as 'light' | 'dark' | 'sakura' | 'midnight' | 'ocean');
      }
      
      // 应用主题
      this.themeManager.setTheme(this.stateManager.getState().theme);
    } catch (error) {
      console.error('主题初始化失败:', error);
      // 使用默认主题
      this.themeManager.setTheme('light');
    }
  }

  /**
   * 从后端加载主题设置
   */
  private async loadThemeFromBackend(): Promise<string | null> {
    try {
      const themeSettings = await invoke('get_theme_settings') as any;
      return themeSettings?.current_theme || null;
    } catch (error) {
      console.error('从后端加载主题设置失败:', error);
      return null;
    }
  }

  /**
   * 设置主题
   */
  async setTheme(theme: 'light' | 'dark' | 'sakura' | 'midnight' | 'ocean'): Promise<void> {
    const themeNames: Record<string, string> = {
      'light': '浅色',
      'dark': '深色',
      'sakura': '樱花粉',
      'midnight': '暗夜',
      'ocean': '深海',
    };

    // 如果已经在该主题，不进行操作
    if (this.stateManager.getState().theme === theme) {
      return;
    }

    try {
      // 保存主题设置到后端
      await invoke('set_current_theme', { theme });
      console.log(`✅ 主题已保存到设置: ${theme}`);
      
      this.showMessage(`已切换到${themeNames[theme] || '未知'}模式`, 'success');
    } catch (error) {
      console.error('❌ 保存主题设置失败:', error);
      // 即使保存失败也继续切换UI
    }

    // 更新状态管理器
    this.stateManager.setTheme(theme);

    // 应用主题
    this.themeManager.setTheme(theme);
    
    // 更新UI
    this.modernUIRenderer.updateState(this.stateManager.getState());
    this.updateTitleBar();
    this.updateThemeToggleButton();
  }

  /**
   * 切换主题
   */
  async toggleTheme(): Promise<void> {
    const currentTheme = this.stateManager.getState().theme;
    const themes: ('light' | 'dark' | 'sakura' | 'midnight' | 'ocean')[] = ['light', 'dark', 'sakura', 'midnight', 'ocean'];
    const nextIndex = (themes.indexOf(currentTheme) + 1) % themes.length;
    await this.setTheme(themes[nextIndex]);
  }

  /**
   * 首次渲染：创建完整 DOM 结构（标题栏 + 侧边栏 + 工作区 + 状态栏）
   */
  private renderFull(): void {
    const app = document.getElementById('app');
    if (app) {
      app.innerHTML = `
        <div class="app-layout">
          ${this.modernUIRenderer.renderTitleBar()}
          <div class="main-container">
            ${this.modernUIRenderer.renderSidebar()}
            ${this.modernUIRenderer.renderMainWorkspace()}
          </div>
          ${this.modernUIRenderer.renderStatusBar()}
        </div>
      `;

      // 加载样式
      this.loadStyles();
    }
  }

  /**
   * 渲染应用界面
   * 如果 DOM 骨架已存在，只更新 main-workspace 内容（局部更新）；
   * 否则执行首次全量渲染。
   */
  render(): void {
    const workspace = document.querySelector('.main-workspace');
    if (!workspace) {
      // DOM 骨架不存在，执行全量渲染
      this.renderFull();
      return;
    }
    // 局部更新：替换整个 workspace 元素（renderMainWorkspace 返回含 wrapper 的完整 HTML）
    workspace.outerHTML = this.modernUIRenderer.renderMainWorkspace();

    // 同步更新侧边栏 active 状态
    const currentPage = this.stateManager.getState().currentPage;
    document.querySelectorAll('.sidebar-item[data-nav-id], .activity-bar-item[data-nav-id]').forEach(item => {
      const navId = (item as HTMLElement).getAttribute('data-nav-id');
      item.classList.toggle('active', navId === currentPage);
    });
    (window as any).syncSidebarActiveGroup && (window as any).syncSidebarActiveGroup();
  }

  /**
   * 加载样式文件 (已迁移至 main.css 模块化导入，无需动态加载)
   */
  private loadStyles(): void {
    // Styles are now imported via main.css in main.ts
    // No dynamic loading needed
  }

  /**
   * 绑定事件
   */
  private bindEvents(): void {
    // 定义全局窗口函数
    this.defineGlobalFunctions();

    // 全局点击事件处理
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      
      // 主题切换 - 分段控制器或主题色块
      const themeBtn = target.closest('[data-theme-value]');
      if (themeBtn) {
        const theme = themeBtn.getAttribute('data-theme-value');
        if (theme && ['light', 'dark', 'sakura', 'midnight', 'ocean'].includes(theme)) {
          this.setTheme(theme as 'light' | 'dark' | 'sakura' | 'midnight' | 'ocean');
          // 主题切换后重新渲染设置菜单以更新激活状态
          this.rerenderSettingsMenu();
          return; // 不要触发下方的"点击外部关闭"逻辑
        }
      }

      // 导航点击事件 (activity-bar-item for VS Code style, nav-item for legacy)
      const navItem = target.closest('.sidebar-item[data-nav-id], .activity-bar-item[data-nav-id], .nav-item[data-nav-id]');
      if (navItem && navItem.getAttribute('data-nav-id')) {
        const navId = navItem.getAttribute('data-nav-id');
        if (navId && (window as any).switchPage) {
            (window as any).switchPage(navId);
        }
      }

      // 点击外部关闭下拉菜单
      if (!target.closest('.sidebar-settings-container')) {
        (window as any).hideSettingsDropdown && (window as any).hideSettingsDropdown();
      }
      if (!target.closest('.connection-card-wrapper')) {
        (window as any).hideConnectionDropdown && (window as any).hideConnectionDropdown();
      }
    });

    // 窗口控制事件
    this.bindWindowControls();
    
    // SSH连接事件
    this.bindSSHEvents();
    
    // Docker管理事件
    this.bindDockerEvents();
  }

  /**
   * 定义全局窗口函数
   */
  private defineGlobalFunctions(): void {
    // 设置下拉菜单
    (window as any).toggleSettingsDropdown = () => {
      const menu = document.getElementById('settings-dropdown-menu');
      if (menu) {
        menu.classList.toggle('show');
      }
    };

    (window as any).hideSettingsDropdown = () => {
      const menu = document.getElementById('settings-dropdown-menu');
      if (menu) {
        menu.classList.remove('show');
      }
    };

    // 断开服务器（带二级确认）
    (window as any).confirmDisconnect = async () => {
      (window as any).hideSettingsDropdown?.();
      const serverName = this.stateManager.getState().serverInfo?.name || this.stateManager.getState().currentServer || '当前服务器';
      const confirmed = await showConfirm({
        title: '断开服务器连接',
        message: `确定要断开与 "${serverName}" 的连接吗？所有正在进行的操作将被中止。`,
        confirmText: '断开连接',
        cancelText: '取消',
        dangerous: true,
      });
      if (confirmed) {
        try {
          // 关闭终端会话
          await invoke('ssh_close_all_terminal_sessions').catch((e: any) => console.warn('清理操作忽略:', e));
          // 断开 SSH
          const sshMgr = (window as any).sshConnectionManager;
          if (sshMgr?.disconnect) {
            await sshMgr.disconnect();
          } else {
            await invoke('ssh_disconnect_direct').catch((e: any) => console.warn('清理操作忽略:', e));
          }
          this.stateManager.setConnected(false);
          window.showNotification?.('已断开服务器连接', 'success');
          requestAnimationFrame(() => {
            (window as any).refreshSidebar?.();
            (window as any).refreshDashboard?.();
          });
        } catch (e) {
          console.error('断开连接失败:', e);
          window.showNotification?.(`断开失败: ${e}`, 'error');
        }
      }
    };

    // 连接下拉菜单
    (window as any).toggleConnectionDropdown = () => {
      const menu = document.getElementById('connection-dropdown-menu');
      if (menu) {
        menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
      }
    };

    (window as any).hideConnectionDropdown = () => {
      const menu = document.getElementById('connection-dropdown-menu');
      if (menu) {
        menu.style.display = 'none';
      }
    };

    // Debug 工具
    (window as any).toggleDevTools = async () => {
      try {
        await invoke('open_devtools');
      } catch (e) {
        console.error('Failed to open devtools:', e);
      }
    };

    // 菜单操作
    (window as any).handleUserMenuAction = (action: string) => {
        if (action === 'settings') {
            this.stateManager.setCurrentPage('settings');
            this.modernUIRenderer.updateState(this.stateManager.getState());
            this.render();
        }
    };
  }

  /**
   * 绑定窗口控制事件
   *
   * Use closest() not classList.contains() — control buttons contain
   * inline <svg> icons, so e.target is often the SVG node, not the
   * <button> with the marker class. classList.contains misses those.
   */
  private bindWindowControls(): void {
    document.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;

      if (target.closest('.minimize-btn')) {
        await invoke('minimize_window');
      } else if (target.closest('.maximize-btn')) {
        await invoke('toggle_maximize');
      } else if (target.closest('.close-btn')) {
        await this.gracefulClose();
      }
    });
  }

  /**
   * 优雅关闭：先清理 SSH 连接和终端会话，再关闭窗口
   * 设置 3 秒超时保底，防止挂死
   */
  private async gracefulClose(): Promise<void> {
    try {
      // 带超时的清理，最多等 3 秒
      await Promise.race([
        this.cleanupBeforeClose(),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]);
    } catch (e) {
      console.error('关闭前清理失败:', e);
    }
    // 无论清理是否成功，都强制关闭窗口
    try {
      await invoke('close_window');
    } catch {
      // 如果 Tauri invoke 也失败，用 window.close() 兜底
      window.close();
    }
  }

  private async cleanupBeforeClose(): Promise<void> {
    try {
      // 1. 关闭所有终端会话
      await invoke('ssh_close_all_terminal_sessions').catch((e: any) => console.warn('清理操作忽略:', e));
      // 2. 断开 SSH 连接
      await invoke('ssh_disconnect_direct').catch((e: any) => console.warn('清理操作忽略:', e));
    } catch {
      // 忽略错误，不阻塞关闭
    }
  }

  /**
   * 绑定SSH事件
   */
  private bindSSHEvents(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target.closest('.ssh-connect-btn')) {
        this.handleSSHConnect();
        return;
      }

      if (target.closest('.disconnect-btn')) {
        this.handleSSHDisconnect();
      }
    });
  }

  /**
   * 绑定Docker事件
   */
  private bindDockerEvents(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.docker-manage-btn')) {
        this.handleDockerManage();
      }
    });
  }

  /**
   * 处理SSH连接
   */
  private async handleSSHConnect(): Promise<void> {
    try {
      this.stateManager.setLoading(true);

      // 获取连接列表，如果有连接则连接第一个
      const connections = this.sshManager.getConnections();
      if (connections.length === 0) {
        this.showMessage('请先添加SSH连接配置', 'warning');
        return;
      }

      // 连接到第一个配置的服务器
      await this.sshManager.connect(connections[0].id);
      this.stateManager.setConnected(true, connections[0].name);
      this.showMessage('SSH连接成功', 'success');
    } catch (error) {
      console.error('SSH连接失败:', error);
      this.showMessage('SSH连接失败', 'error');
    } finally {
      this.stateManager.setLoading(false);
    }
  }

  /**
   * 处理SSH断开
   */
  private async handleSSHDisconnect(): Promise<void> {
    try {
      this.stateManager.setLoading(true);
      await this.sshManager.disconnect();
      await sshConnectionManager.disconnect();
      this.stateManager.setConnected(false);
      this.showMessage('已断开 SSH 连接', 'info');
      const cache = (window as any).systemInfoCache;
      if (cache) {
        cache.detailedInfo = null;
        cache.lastUpdate = null;
        cache.isLoading = false;
      }
      (window as any).refreshServerList?.();
      (window as any).refreshSidebar?.();
      (window as any).refreshDashboard?.();
    } catch (error) {
      console.error('SSH 断开失败:', error);
      this.showMessage('SSH 断开失败', 'error');
    } finally {
      this.stateManager.setLoading(false);
    }
  }

  /**
   * 处理Docker管理
   */
  private async handleDockerManage(): Promise<void> {
    try {
      // Docker管理逻辑将在Docker模块中实现
      await this.dockerManager.listContainers();
      this.showMessage('Docker容器列表已更新', 'info');
    } catch (error) {
      console.error('Docker管理失败:', error);
      this.showMessage('Docker管理失败', 'error');
    }
  }

  /**
   * 更新标题栏
   */
  private updateTitleBar(): void {
    // 只更新主题切换按钮，避免重新渲染整个标题栏
    this.updateThemeToggleButton();
  }

  /**
   * 重新渲染设置下拉菜单（主题切换后更新激活状态）
   */
  private rerenderSettingsMenu(): void {
    const menu = document.getElementById('settings-dropdown-menu');
    if (menu) {
      const wasVisible = menu.classList.contains('show');
      // 用最新状态重新生成菜单 HTML
      const newHtml = this.modernUIRenderer.renderSettingsMenuPublic();
      menu.outerHTML = newHtml;
      // 保持菜单打开状态
      if (wasVisible) {
        const newMenu = document.getElementById('settings-dropdown-menu');
        if (newMenu) newMenu.classList.add('show');
      }
    }
  }

  /**
   * 更新主题切换按钮
   */
  private updateThemeToggleButton(): void {
    const currentTheme = this.stateManager.getState().theme;

    // Update segmented buttons
    document.querySelectorAll('.theme-switcher .segmented-btn').forEach(btn => {
      const themeValue = btn.getAttribute('data-theme-value');
      btn.classList.toggle('active', themeValue === currentTheme);
    });

    // Update theme swatches in settings dropdown
    document.querySelectorAll('.theme-swatch[data-theme-value]').forEach(btn => {
      const el = btn as HTMLElement;
      const themeValue = el.getAttribute('data-theme-value');
      const isActive = themeValue === currentTheme;
      el.classList.toggle('active', isActive);
      el.style.borderColor = isActive ? 'var(--primary-color)' : 'transparent';
    });
  }

  /**
   * 显示消息
   */
  private showMessage(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): void {
    // 简单的消息显示实现
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // 可以在这里实现更复杂的消息显示逻辑
    // 比如 toast 通知等
  }

  /**
   * 获取应用状态
   */
  getState(): AppState {
    return this.stateManager.getState();
  }

  /**
   * 获取状态管理器
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * 获取SSH管理器
   */
  getSSHManager(): SSHManager {
    return this.sshManager;
  }

  /**
   * 获取Docker管理器
   */
  getDockerManager(): DockerManager {
    return this.dockerManager;
  }

  /**
   * 获取Kubernetes管理器
   */
  getKubernetesManager(): KubernetesManager {
    return this.kubernetesManager;
  }
}
