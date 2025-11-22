/**
 * 主题管理器
 * 处理主题切换和用户自定义主题
 */

export class ThemeManager {
  private currentTheme: 'light' | 'dark' | 'sakura' = 'light';

  /**
   * 切换主题
   */
  toggleTheme(): string {
    const body = document.body;
    const currentTheme = body.getAttribute('data-theme') || 'light';

    let newTheme: string;
    switch (currentTheme) {
      case 'light':
        newTheme = 'dark';
        break;
      case 'dark':
        newTheme = 'sakura';
        break;
      case 'sakura':
        newTheme = 'light';
        break;
      default:
        newTheme = 'light';
    }

    this.setTheme(newTheme);
    return newTheme;
  }

  /**
   * 设置主题
   */
  setTheme(theme: string): void {
    const body = document.body;
    const html = document.documentElement;

    // 设置data-theme属性
    body.setAttribute('data-theme', theme);
    html.setAttribute('data-theme', theme);

    // 更新body类名
    body.classList.remove('light-theme', 'dark-theme', 'sakura-theme');
    body.classList.add(`${theme}-theme`);

    // 动态加载主题CSS文件
    this.loadThemeCSS(theme);

    // 保存到localStorage
    localStorage.setItem('lovelyres-theme', theme);

    this.currentTheme = theme as 'light' | 'dark' | 'sakura';

    console.log('主题已设置为:', theme);
  }

  /**
   * 动态加载主题CSS文件
   */
  private loadThemeCSS(theme: string): void {
    // 移除之前的主题CSS
    const existingThemeLinks = document.querySelectorAll('link[data-theme-css]');
    existingThemeLinks.forEach(link => link.remove());

    // 加载新的主题CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `/src/css/themes/${theme}.css`;
    link.setAttribute('data-theme-css', theme);

    // 添加加载完成事件监听
    link.onload = () => {
      console.log(`✅ 主题CSS已加载: ${theme}`);
    };

    link.onerror = () => {
      console.error(`❌ 主题CSS加载失败: ${theme}`);
    };

    document.head.appendChild(link);
  }

  /**
   * 获取当前主题
   */
  getCurrentTheme(): string {
    return document.body.getAttribute('data-theme') || 'light';
  }

  /**
   * 初始化主题
   */
  initializeTheme(): void {
    // 从localStorage加载保存的主题
    const savedTheme = localStorage.getItem('lovelyres-theme');

    if (savedTheme && ['light', 'dark', 'sakura'].includes(savedTheme)) {
      this.setTheme(savedTheme);
    } else {
      // 检查系统偏好
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setTheme(prefersDark ? 'dark' : 'light');
    }

    // 监听系统主题变化
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        // 只有在没有手动设置主题时才跟随系统
        const savedTheme = localStorage.getItem('lovelyres-theme');
        if (!savedTheme) {
          this.setTheme(e.matches ? 'dark' : 'light');
        }
      });
    }

    console.log('✅ 主题管理器初始化完成');
  }

  /**
   * 获取主题配置
   */
  getThemeConfig(theme?: string) {
    const targetTheme = theme || this.currentTheme;
    
    const configs = {
      light: {
        name: '浅色',
        icon: '☀️',
        description: '清新明亮的浅色主题',
        colors: {
          primary: '#4299e1',
          secondary: '#63b3ed',
          accent: '#81e6d9',
          background: '#f8fafc',
          surface: '#ffffff',
          text: '#1e293b'
        }
      },
      dark: {
        name: '深色',
        icon: '🌙',
        description: '护眼舒适的深色主题',
        colors: {
          primary: '#4299e1',
          secondary: '#63b3ed',
          accent: '#81e6d9',
          background: '#0f172a',
          surface: '#1e293b',
          text: '#f1f5f9'
        }
      },
      sakura: {
        name: '樱花粉',
        icon: '🌸',
        description: '温柔浪漫的樱花主题',
        colors: {
          primary: '#ff9bb3',
          secondary: '#ffb3c1',
          accent: '#ffc0cb',
          background: '#fef9f9',
          surface: '#fffefe',
          text: '#744c4c'
        }
      }
    };

    return configs[targetTheme as keyof typeof configs] || configs.light;
  }

  /**
   * 获取所有可用主题
   */
  getAvailableThemes() {
    return [
      this.getThemeConfig('light'),
      this.getThemeConfig('dark'),
      this.getThemeConfig('sakura')
    ];
  }

  /**
   * 应用自定义主题
   */
  applyCustomTheme(customColors: Record<string, string>): void {
    const root = document.documentElement;
    
    Object.entries(customColors).forEach(([property, value]) => {
      if (property.startsWith('--')) {
        root.style.setProperty(property, value);
      } else {
        root.style.setProperty(`--${property}`, value);
      }
    });
  }

  /**
   * 重置主题到默认值
   */
  resetTheme(): void {
    const root = document.documentElement;
    
    // 移除所有自定义CSS变量
    const computedStyle = getComputedStyle(root);
    const customProperties = Array.from(computedStyle).filter(prop => prop.startsWith('--'));
    
    customProperties.forEach(prop => {
      root.style.removeProperty(prop);
    });

    // 重新设置当前主题
    this.setTheme(this.currentTheme);
  }

  /**
   * 导出当前主题配置
   */
  exportThemeConfig(): string {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    const themeConfig: Record<string, string> = {};

    // 获取所有CSS变量
    Array.from(computedStyle).forEach(prop => {
      if (prop.startsWith('--')) {
        themeConfig[prop] = computedStyle.getPropertyValue(prop).trim();
      }
    });

    return JSON.stringify({
      theme: this.currentTheme,
      config: this.getThemeConfig(),
      customProperties: themeConfig
    }, null, 2);
  }

  /**
   * 导入主题配置
   */
  importThemeConfig(configJson: string): boolean {
    try {
      const config = JSON.parse(configJson);
      
      if (config.theme) {
        this.setTheme(config.theme);
      }

      if (config.customProperties) {
        this.applyCustomTheme(config.customProperties);
      }

      return true;
    } catch (error) {
      console.error('导入主题配置失败:', error);
      return false;
    }
  }

  /**
   * 检查是否为深色主题
   */
  isDarkTheme(): boolean {
    return this.currentTheme === 'dark';
  }

  /**
   * 检查是否为浅色主题
   */
  isLightTheme(): boolean {
    return this.currentTheme === 'light';
  }

  /**
   * 检查是否为樱花主题
   */
  isSakuraTheme(): boolean {
    return this.currentTheme === 'sakura';
  }

  /**
   * 获取主题对比色
   */
  getContrastColor(backgroundColor: string): string {
    // 简单的对比色计算
    const hex = backgroundColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // 计算亮度
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    
    return brightness > 128 ? '#000000' : '#ffffff';
  }

  /**
   * 生成主题预览
   */
  generateThemePreview(theme: string): string {
    const config = this.getThemeConfig(theme);
    
    return `
      <div style="
        background: ${config.colors.background};
        color: ${config.colors.text};
        padding: 16px;
        border-radius: 8px;
        border: 1px solid ${config.colors.primary};
        min-height: 100px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 20px;">${config.icon}</span>
          <strong>${config.name}</strong>
        </div>
        <div style="font-size: 12px; opacity: 0.8;">
          ${config.description}
        </div>
        <div style="
          background: ${config.colors.primary};
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          align-self: flex-start;
        ">
          示例按钮
        </div>
      </div>
    `;
  }
}
