/**
 * 状态管理器
 * 负责应用状态的管理和同步
 */

import type { AppState } from './types';
import type { ModernUIRenderer } from '../ui/modernUIRenderer';

export class StateManager {
  private state: AppState;
  private listeners: Array<(state: AppState) => void> = [];
  private uiRenderer?: ModernUIRenderer;

  constructor() {
    this.state = {
      theme: 'light',
      isConnected: false,
      currentServer: undefined,
      loading: false,
      currentPage: 'dashboard',
    };
  }

  /**
   * 初始化状态管理器
   */
  async initialize(): Promise<void> {
    try {
      // 从本地存储加载状态
      await this.loadStateFromStorage();
      
      // 从后端加载状态
      await this.loadStateFromBackend();
      
      console.log('✅ 状态管理器初始化完成');
    } catch (error) {
      console.error('❌ 状态管理器初始化失败:', error);
    }
  }

  /**
   * 从本地存储加载状态
   */
  private async loadStateFromStorage(): Promise<void> {
    try {
      const savedTheme = localStorage.getItem('lovelyres-theme');
      if (savedTheme && ['light', 'dark', 'sakura'].includes(savedTheme)) {
        this.state.theme = savedTheme as 'light' | 'dark' | 'sakura';
      }
    } catch (error) {
      console.error('从本地存储加载状态失败:', error);
    }
  }

  /**
   * 从后端加载状态
   */
  private async loadStateFromBackend(): Promise<void> {
    try {
      // 这里可以调用后端API加载状态
      // const backendState = await invoke('get_app_state');
      // if (backendState) {
      //   this.setState(backendState);
      // }
    } catch (error) {
      console.error('从后端加载状态失败:', error);
    }
  }

  /**
   * 获取当前状态
   */
  getState(): AppState {
    return { ...this.state };
  }

  /**
   * 设置状态
   */
  setState(newState: Partial<AppState>): void {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...newState };
    
    // 保存到本地存储
    this.saveStateToStorage();
    
    // 通知监听器
    this.notifyListeners();
    
    console.log('状态已更新:', { oldState, newState: this.state });
  }

  /**
   * 设置主题
   */
  setTheme(theme: 'light' | 'dark' | 'sakura'): void {
    this.setState({ theme });

    // 应用主题到DOM
    this.applyTheme(theme);
  }

  /**
   * 设置当前页面
   */
  setCurrentPage(page: 'dashboard' | 'system-info' | 'ssh-terminal' | 'remote-operations' | 'docker' | 'emergency-commands' | 'log-analysis' | 'settings'): void {
    this.setState({ currentPage: page });
  }

  /**
   * 切换主题
   */
  toggleTheme(): 'light' | 'dark' | 'sakura' {
    const themes: ('light' | 'dark' | 'sakura')[] = ['light', 'dark', 'sakura'];
    const currentIndex = themes.indexOf(this.state.theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const newTheme = themes[nextIndex];
    
    this.setTheme(newTheme);
    return newTheme;
  }

  /**
   * 应用主题到DOM
   */
  private applyTheme(theme: 'light' | 'dark' | 'sakura'): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme);
      document.body.classList.remove('light-theme', 'dark-theme', 'sakura-theme');
      document.body.classList.add(`${theme}-theme`);
    }
  }

  /**
   * 设置连接状态
   */
  setConnected(isConnected: boolean, server?: string, serverInfo?: any): void {
    this.setState({
      isConnected,
      currentServer: isConnected ? server : undefined,
      serverInfo: isConnected ? serverInfo : undefined
    });
  }

  /**
   * 设置加载状态
   */
  setLoading(loading: boolean): void {
    this.setState({ loading });
  }

  /**
   * 保存状态到本地存储
   */
  private saveStateToStorage(): void {
    try {
      localStorage.setItem('lovelyres-theme', this.state.theme);
      localStorage.setItem('lovelyres-state', JSON.stringify({
        theme: this.state.theme,
        // 不保存敏感信息如连接状态
      }));
    } catch (error) {
      console.error('保存状态到本地存储失败:', error);
    }
  }

  /**
   * 添加状态监听器
   */
  addListener(listener: (state: AppState) => void): void {
    this.listeners.push(listener);
  }

  /**
   * 移除状态监听器
   */
  removeListener(listener: (state: AppState) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        console.error('状态监听器执行失败:', error);
      }
    });
  }

  /**
   * 重置状态
   */
  reset(): void {
    this.state = {
      theme: 'light',
      isConnected: false,
      currentServer: undefined,
      loading: false,
      currentPage: 'dashboard',
    };
    
    // 清除本地存储
    try {
      localStorage.removeItem('lovelyres-theme');
      localStorage.removeItem('lovelyres-state');
    } catch (error) {
      console.error('清除本地存储失败:', error);
    }
    
    // 通知监听器
    this.notifyListeners();
  }

  /**
   * 获取主题配置
   */
  getThemeConfig() {
    const themeConfigs = {
      light: {
        name: '浅色',
        icon: '☀️',
        description: '清新明亮的浅色主题'
      },
      dark: {
        name: '深色',
        icon: '🌙',
        description: '护眼舒适的深色主题'
      },
      sakura: {
        name: '樱花粉',
        icon: '🌸',
        description: '温柔浪漫的樱花主题'
      }
    };

    return themeConfigs[this.state.theme];
  }

  /**
   * 获取下一个主题配置
   */
  getNextThemeConfig() {
    const themes: ('light' | 'dark' | 'sakura')[] = ['light', 'dark', 'sakura'];
    const currentIndex = themes.indexOf(this.state.theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];

    const themeConfigs = {
      light: { name: '浅色', icon: '☀️' },
      dark: { name: '深色', icon: '🌙' },
      sakura: { name: '樱花粉', icon: '🌸' }
    };

    return themeConfigs[nextTheme];
  }

  /**
   * 检查是否为深色主题
   */
  isDarkTheme(): boolean {
    return this.state.theme === 'dark';
  }

  /**
   * 检查是否为浅色主题
   */
  isLightTheme(): boolean {
    return this.state.theme === 'light';
  }

  /**
   * 检查是否为樱花主题
   */
  isSakuraTheme(): boolean {
    return this.state.theme === 'sakura';
  }

  /**
   * 设置UI渲染器
   */
  setUIRenderer(renderer: ModernUIRenderer): void {
    this.uiRenderer = renderer;
  }

  /**
   * 获取UI渲染器
   */
  getUIRenderer(): ModernUIRenderer {
    if (!this.uiRenderer) {
      throw new Error('UI渲染器未初始化');
    }
    return this.uiRenderer;
  }
}
