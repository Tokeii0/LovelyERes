/**
 * 设置管理器
 * 负责应用设置的管理和持久化
 */

export interface AppSettings {
  theme: 'light' | 'dark' | 'sakura';
  language: 'zh-CN' | 'en-US';
  autoConnect: boolean;
  defaultSSHPort: number;
  terminalFont: string;
  terminalFontSize: number;
  maxLogLines: number;
  autoSaveInterval: number;
  notifications: {
    enabled: boolean;
    connectionStatus: boolean;
    commandCompletion: boolean;
    errorAlerts: boolean;
  };
  security: {
    savePasswords: boolean;
    sessionTimeout: number;
    requireConfirmation: boolean;
  };
  ui: {
    sidebarWidth: number;
    showStatusBar: boolean;
    compactMode: boolean;
    animationsEnabled: boolean;
    globalFont: string; // 新增：全局字体设置
    globalFontSize: number; // 新增：全局字体大小设置
  };
  docker: {
    autoRefresh: boolean;
    refreshInterval: number;
    showSystemContainers: boolean;
  };
  ssh: {
    keepAliveInterval: number;
    connectionTimeout: number;
    maxRetries: number;
  };
  // 新增：AI设置
  ai: {
    currentProvider: string; // 当前选择的AI提供商
    providers: {
      [key: string]: {
        name: string;
        apiKey: string;
        model: string;
        baseUrl: string;
        // 代理设置
        useProxy: boolean;
        proxyType: 'http' | 'https' | 'socks5';
        proxyUrl: string;
      };
    };
  };
}

export class SettingsManager {
  private settings: AppSettings;
  private listeners: Array<(settings: AppSettings) => void> = [];

  constructor() {
    this.settings = this.getDefaultSettings();
  }

  /**
   * 获取默认设置
   */
  private getDefaultSettings(): AppSettings {
    // 检测操作系统：Windows 下默认隐藏状态栏，macOS 下默认显示
    const isWindows = navigator.userAgent.toLowerCase().includes('windows');
    const showStatusBar = !isWindows; // Windows: false, 其他: true

    return {
      theme: 'light',
      language: 'zh-CN',
      autoConnect: false,
      defaultSSHPort: 22,
      terminalFont: 'Monaco, Consolas, monospace',
      terminalFontSize: 14,
      maxLogLines: 1000,
      autoSaveInterval: 30000, // 30秒
      notifications: {
        enabled: true,
        connectionStatus: true,
        commandCompletion: false,
        errorAlerts: true
      },
      security: {
        savePasswords: false,
        sessionTimeout: 86400000, // 24小时 - 大幅增加避免频繁超时
        requireConfirmation: false // 关闭确认要求，减少操作限制
      },
      ui: {
        sidebarWidth: 280,
        showStatusBar, // 根据操作系统动态设置
        compactMode: false,
        animationsEnabled: true,
        globalFont: 'system', // 新增：默认使用系统字体
        globalFontSize: 14 // 新增：默认字体大小14px
      },
      docker: {
        autoRefresh: true,
        refreshInterval: 5000, // 5秒
        showSystemContainers: false
      },
      ssh: {
        keepAliveInterval: 30000, // 30秒
        connectionTimeout: 0, // 0 = 禁用超时，避免长时间操作被中断
        maxRetries: 3
      },
      // 新增：AI设置默认值
      ai: {
        currentProvider: 'openai',
        providers: {
          openai: {
            name: 'OpenAI',
            apiKey: '',
            model: 'gpt-3.5-turbo',
            baseUrl: 'https://api.openai.com/v1',
            useProxy: false,
            proxyType: 'http',
            proxyUrl: ''
          },
          qwen: {
            name: 'Qwen',
            apiKey: '',
            model: 'qwen-turbo',
            baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
            useProxy: false,
            proxyType: 'http',
            proxyUrl: ''
          },
          ollama: {
            name: 'Ollama',
            apiKey: '',
            model: 'llama2',
            baseUrl: 'http://localhost:11434/api',
            useProxy: false,
            proxyType: 'http',
            proxyUrl: ''
          }
        }
      }
    };
  }

  /**
   * 初始化设置管理器
   */
  async initialize(): Promise<void> {
    try {
      await this.loadSettings();
      console.log('✅ 设置管理器初始化完成');
    } catch (error) {
      console.error('❌ 设置管理器初始化失败:', error);
    }
  }

  /**
   * 加载设置
   */
  async loadSettings(): Promise<void> {
    try {
      // 从本地存储加载
      const localSettings = this.loadFromLocalStorage();

      // 从后端加载（如果有的话）
      const backendSettings = await this.loadFromBackend();

      // 判断后端设置是否为空（意味着文件不存在或为空）
      // 注意：loadFromBackend 出错返回 {}，文件不存在也返回 {}
      // 我们通过检查返回对象的键数量来判断
      const isBackendEmpty = Object.keys(backendSettings).length === 0;

      // 使用深度合并，避免嵌套对象（如ai.providers）被覆盖
      this.settings = this.deepMerge(
        this.getDefaultSettings(),
        localSettings,
        backendSettings
      ) as AppSettings;

      // 通知监听器
      this.notifyListeners();

      // 如果后端没有设置（文件不存在或为空），则自动生成并保存默认设置到后端文件
      if (isBackendEmpty) {
        console.log('⚠️ 检测到配置文件不存在或为空，正在自动生成默认配置文件...');
        try {
          // 保存当前合并后的设置（即默认+本地）作为新的配置文件
          // 这样可以确保配置文件的存在，避免后续可能的读取错误
          await this.saveToBackend();
          console.log('✅ 默认配置文件已自动生成');
        } catch (saveError) {
          console.error('❌ 自动生成配置文件失败:', saveError);
        }
      }

    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  /**
   * 从本地存储加载设置
   */
  private loadFromLocalStorage(): Partial<AppSettings> {
    try {
      const saved = localStorage.getItem('lovelyres-settings');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error('从本地存储加载设置失败:', error);
    }
    return {};
  }

  /**
   * 从后端加载设置
   */
  private async loadFromBackend(): Promise<Partial<AppSettings>> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const settingsContent = await invoke('read_settings_file') as string;

      if (settingsContent) {
        try {
          const settings = JSON.parse(settingsContent);
          console.log('✅ 从settings.json加载设置成功');
          return settings;
        } catch (parseError) {
          console.error('❌ settings.json 格式错误，重置为默认设置:', parseError);
          console.error('原始内容:', settingsContent.substring(0, 100) + '...');
          // 如果解析失败，可能是文件损坏，返回空对象让它使用默认值
          return {};
        }
      }

      return {};
    } catch (error) {
      console.error('从后端加载设置失败:', error);
      return {};
    }
  }

  /**
   * 保存设置
   */
  async saveSettings(): Promise<void> {
    try {
      // 保存到本地存储
      this.saveToLocalStorage();
      
      // 保存到后端
      await this.saveToBackend();
      
      // 通知监听器
      this.notifyListeners();
      
      console.log('设置已保存');
    } catch (error) {
      console.error('保存设置失败:', error);
      throw error;
    }
  }

  /**
   * 保存到本地存储
   */
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem('lovelyres-settings', JSON.stringify(this.settings));
    } catch (error) {
      console.error('保存设置到本地存储失败:', error);
    }
  }

  /**
   * 保存到后端
   */
  private async saveToBackend(): Promise<void> {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const settingsJson = JSON.stringify(this.settings, null, 2);
      await invoke('write_settings_file', { content: settingsJson });
      console.log('✅ 设置保存到settings.json成功');
    } catch (error) {
      console.error('保存设置到后端失败:', error);
      throw error;
    }
  }

  /**
   * 获取设置
   */
  getSettings(): AppSettings {
    return { ...this.settings };
  }

  /**
   * 更新设置（使用深度合并，避免嵌套对象被覆盖）
   */
  updateSettings(updates: Partial<AppSettings>): void {
    this.settings = this.deepMerge(this.settings, updates) as AppSettings;
  }

  /**
   * 获取特定设置值
   */
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.settings[key];
  }

  /**
   * 设置特定值
   */
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.settings[key] = value;
  }

  /**
   * 重置设置到默认值
   */
  resetToDefaults(): void {
    this.settings = this.getDefaultSettings();
  }

  /**
   * 导出设置
   */
  exportSettings(): string {
    return JSON.stringify(this.settings, null, 2);
  }

  /**
   * 导入设置（使用深度合并）
   */
  importSettings(settingsJson: string): boolean {
    try {
      const importedSettings = JSON.parse(settingsJson);

      // 验证设置格式
      if (this.validateSettings(importedSettings)) {
        this.settings = this.deepMerge(
          this.getDefaultSettings(),
          importedSettings
        ) as AppSettings;
        return true;
      }

      return false;
    } catch (error) {
      console.error('导入设置失败:', error);
      return false;
    }
  }

  /**
   * 深度合并对象，避免嵌套对象被覆盖
   */
  private deepMerge(...objects: any[]): any {
    const isObject = (obj: any) => obj && typeof obj === 'object' && !Array.isArray(obj);

    return objects.reduce((prev, obj) => {
      if (!obj) return prev;

      Object.keys(obj).forEach(key => {
        const prevValue = prev[key];
        const objValue = obj[key];

        if (isObject(prevValue) && isObject(objValue)) {
          // 递归合并嵌套对象
          prev[key] = this.deepMerge(prevValue, objValue);
        } else if (objValue !== undefined) {
          // 直接赋值（包括数组）
          prev[key] = objValue;
        }
      });

      return prev;
    }, {});
  }

  /**
   * 验证设置格式
   */
  private validateSettings(settings: any): boolean {
    // 基本验证
    if (typeof settings !== 'object' || settings === null) {
      return false;
    }

    // 验证主题
    if (settings.theme && !['light', 'dark', 'sakura'].includes(settings.theme)) {
      return false;
    }

    // 验证语言
    if (settings.language && !['zh-CN', 'en-US'].includes(settings.language)) {
      return false;
    }

    // 验证数字类型
    const numberFields = ['defaultSSHPort', 'terminalFontSize', 'maxLogLines', 'autoSaveInterval'];
    for (const field of numberFields) {
      if (settings[field] !== undefined && typeof settings[field] !== 'number') {
        return false;
      }
    }

    return true;
  }

  /**
   * 添加设置监听器
   */
  addListener(listener: (settings: AppSettings) => void): void {
    this.listeners.push(listener);
  }

  /**
   * 移除设置监听器
   */
  removeListener(listener: (settings: AppSettings) => void): void {
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
        listener(this.getSettings());
      } catch (error) {
        console.error('设置监听器执行失败:', error);
      }
    });

    // 应用设置到界面
    this.applySettingsToUI();
  }

  /**
   * 应用设置到界面
   */
  private applySettingsToUI(): void {
    try {
      // 应用全局字体设置
      if (this.settings.ui.globalFont && this.settings.ui.globalFont !== 'system') {
        // 如果字体名称不包含引号，自动添加
        let fontFamily = this.settings.ui.globalFont;
        if (!fontFamily.includes("'") && !fontFamily.includes('"')) {
          fontFamily = `'${fontFamily}', sans-serif`;
        }
        document.documentElement.style.setProperty('--font-family', fontFamily);
      } else {
        document.documentElement.style.removeProperty('--font-family');
      }

      // 应用全局字体大小设置
      if (this.settings.ui.globalFontSize) {
        document.documentElement.style.setProperty('--font-size', `${this.settings.ui.globalFontSize}px`);
      } else {
        document.documentElement.style.removeProperty('--font-size');
      }

      console.log('✅ 设置已应用到界面');
    } catch (error) {
      console.error('❌ 应用设置失败:', error);
    }
  }

  /**
   * 获取主题相关设置
   */
  getThemeSettings() {
    return {
      theme: this.settings.theme,
      animationsEnabled: this.settings.ui.animationsEnabled,
      compactMode: this.settings.ui.compactMode
    };
  }

  /**
   * 获取UI相关设置
   */
  getUISettings() {
    return {
      ...this.settings.ui,
      theme: this.settings.theme,
      language: this.settings.language
    };
  }

  /**
   * 获取安全相关设置
   */
  getSecuritySettings() {
    return { ...this.settings.security };
  }

  /**
   * 获取通知相关设置
   */
  getNotificationSettings() {
    return { ...this.settings.notifications };
  }

  /**
   * 获取SSH相关设置
   */
  getSSHSettings() {
    return {
      ...this.settings.ssh,
      defaultPort: this.settings.defaultSSHPort,
      autoConnect: this.settings.autoConnect
    };
  }

  /**
   * 获取Docker相关设置
   */
  getDockerSettings() {
    return { ...this.settings.docker };
  }

  /**
   * 获取终端相关设置
   */
  getTerminalSettings() {
    return {
      font: this.settings.terminalFont,
      fontSize: this.settings.terminalFontSize,
      maxLogLines: this.settings.maxLogLines
    };
  }

  /**
   * 检查是否启用了特定功能
   */
  isFeatureEnabled(feature: string): boolean {
    switch (feature) {
      case 'notifications':
        return this.settings.notifications.enabled;
      case 'animations':
        return this.settings.ui.animationsEnabled;
      case 'autoConnect':
        return this.settings.autoConnect;
      case 'dockerAutoRefresh':
        return this.settings.docker.autoRefresh;
      default:
        return false;
    }
  }

  /**
   * 切换功能开关
   */
  toggleFeature(feature: string): boolean {
    switch (feature) {
      case 'notifications':
        this.settings.notifications.enabled = !this.settings.notifications.enabled;
        return this.settings.notifications.enabled;
      case 'animations':
        this.settings.ui.animationsEnabled = !this.settings.ui.animationsEnabled;
        return this.settings.ui.animationsEnabled;
      case 'autoConnect':
        this.settings.autoConnect = !this.settings.autoConnect;
        return this.settings.autoConnect;
      case 'dockerAutoRefresh':
        this.settings.docker.autoRefresh = !this.settings.docker.autoRefresh;
        return this.settings.docker.autoRefresh;
      default:
        return false;
    }
  }
}
