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
import { KubernetesManager } from '../kubernetes/kubernetesManager';
import { SettingsManager } from '../settings/settingsManager';
import { SystemInfoManager } from '../system/systemInfoManager';
import { sshConnectionManager } from '../remote/sshConnectionManager';
import { sshTerminalManager } from '../ssh/sshTerminalManager';

export interface ServerInfo {
  name: string;
  host: string;
  port: number;
  username?: string;
}

export interface AppState {
  theme: 'light' | 'dark' | 'sakura';
  isConnected: boolean;
  currentServer?: string; // 保留向后兼容
  serverInfo?: ServerInfo; // 新增详细服务器信息
  loading: boolean;
  currentPage: 'dashboard' | 'system-info' | 'ssh-terminal' | 'remote-operations' | 'docker' | 'emergency-commands' | 'log-analysis' | 'settings' | 'quick-detection' | 'kubernetes' | 'database';
}

export class LovelyResApp {
  private stateManager: StateManager;
  private modernUIRenderer: ModernUIRenderer;
  private themeManager: ThemeManager;
  private sshManager: SSHManager;
  private dockerManager: DockerManager;
  private kubernetesManager: KubernetesManager;
  private settingsManager: SettingsManager;
  private systemInfoManager: SystemInfoManager;

  constructor() {
    this.stateManager = new StateManager();
    this.modernUIRenderer = new ModernUIRenderer(this.stateManager);
    this.themeManager = new ThemeManager();
    this.sshManager = new SSHManager();
    this.dockerManager = new DockerManager();
    this.kubernetesManager = new KubernetesManager();
    this.settingsManager = new SettingsManager();
    this.systemInfoManager = new SystemInfoManager();

    // 暴露管理器和应用实例给全局对象，供UI使用
    (window as any).app = {
      sshManager: this.sshManager,
      kubernetesManager: this.kubernetesManager,
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
      
      // 初始化设置
      await this.settingsManager.initialize();

      // 初始化SSH终端管理器
      await sshTerminalManager.initialize();

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
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'sakura')) {
        this.stateManager.setTheme(savedTheme);
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
   * 切换主题
   */
  async toggleTheme(): Promise<void> {
    const newTheme = this.stateManager.toggleTheme();
    const themeNames = {
      'light': '浅色',
      'dark': '深色',
      'sakura': '樱花粉',
    };

    try {
      // 保存主题设置到后端
      await invoke('set_current_theme', { theme: newTheme });
      console.log(`✅ 主题已保存到设置: ${newTheme}`);
      
      // 显示成功消息
      this.showMessage(`已切换到${themeNames[newTheme as keyof typeof themeNames] || '未知'}模式`, 'success');
    } catch (error) {
      console.error('❌ 保存主题设置失败:', error);
      this.showMessage('保存主题设置失败', 'error');
    }

    // 应用主题
    this.themeManager.setTheme(newTheme);
    
    // 更新UI
    this.modernUIRenderer.updateState(this.stateManager.getState());
    this.updateTitleBar();
  }

  /**
   * 渲染应用界面
   */
  render(): void {
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
   * 加载样式文件
   */
  private loadStyles(): void {
    const existingLink = document.querySelector('link[href*="base.css"]');
    if (!existingLink) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/src/css/base.css';
      document.head.appendChild(link);
    }
  }

  /**
   * 绑定事件
   */
  private bindEvents(): void {
    // 主题切换事件
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('theme-toggle-btn')) {
        this.toggleTheme();
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
   * 绑定窗口控制事件
   */
  private bindWindowControls(): void {
    document.addEventListener('click', async (e) => {
      const target = e.target as HTMLElement;
      
      if (target.classList.contains('minimize-btn')) {
        await invoke('minimize_window');
      } else if (target.classList.contains('maximize-btn')) {
        await invoke('toggle_maximize');
      } else if (target.classList.contains('close-btn')) {
        await invoke('close_window');
      }
    });
  }

  /**
   * 绑定SSH事件
   */
  private bindSSHEvents(): void {
    // SSH连接按钮
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;

      if (target.classList.contains('ssh-connect-btn')) {
        this.handleSSHConnect();
        return;
      }

      if (target.classList.contains('disconnect-btn') || target.closest('.disconnect-btn')) {
        this.handleSSHDisconnect();
      }
    });
  }

  /**
   * 绑定Docker事件
   */
  private bindDockerEvents(): void {
    // Docker管理按钮
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains('docker-manage-btn')) {
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
      (window as any).stopDashboardAutoRefresh?.();
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
   * 更新主题切换按钮
   */
  private updateThemeToggleButton(): void {
    const themeButton = document.querySelector('.theme-toggle-btn');
    if (themeButton) {
      const currentThemeConfig = this.stateManager.getThemeConfig();
      const nextThemeConfig = this.stateManager.getNextThemeConfig();

      themeButton.innerHTML = `${currentThemeConfig.icon} ${currentThemeConfig.name}`;
      themeButton.setAttribute('title', `切换到${nextThemeConfig.name}主题`);
    }
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
