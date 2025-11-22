import { invoke } from '@tauri-apps/api/core';

interface ContainerInfo {
  name: string;
  id: string;
}

interface TerminalOutput {
  command: string;
  output: string;
  exit_code: number;
  timestamp: Date;
}

class ContainerTerminalManager {
  private containerInfo: ContainerInfo | null = null;
  private currentShell = 'bash';
  private commandHistory: string[] = [];
  private historyIndex = -1;

  async initialize(): Promise<void> {
    // 设置主题
    await this.setupTheme();

    // 获取容器信息
    this.containerInfo = (window as any).containerInfo;

    if (!this.containerInfo) {
      this.showError('无法获取容器信息');
      return;
    }

    // 更新标题
    const titleElement = document.getElementById('terminal-title');
    if (titleElement) {
      titleElement.textContent = `容器终端 - ${this.containerInfo.name}`;
    }

    // 绑定事件
    this.bindEvents();

    // 隐藏加载屏幕
    const loadingScreen = document.getElementById('loading-screen');
    const terminal = document.getElementById('container-terminal');
    if (loadingScreen && terminal) {
      loadingScreen.style.display = 'none';
      terminal.style.display = 'flex';
    }

    // 聚焦输入框
    const input = document.getElementById('command-input') as HTMLInputElement;
    if (input) {
      input.focus();
    }

    // 显示欢迎信息
    this.addSystemMessage(`已连接到容器: ${this.containerInfo.name} (${this.containerInfo.id})`);
    this.addSystemMessage(`当前 shell: ${this.currentShell}`);
  }

  private async setupTheme(): Promise<void> {
    try {
      // 初始化：从后端获取当前主题
      const themeSettings = await invoke('get_theme_settings');
      const currentTheme = (themeSettings as any)?.current_theme || 'dark';
      document.documentElement.setAttribute('data-theme', currentTheme);
      // 初次加载对应主题CSS
      const firstLink = document.createElement('link');
      firstLink.rel = 'stylesheet';
      firstLink.href = `/src/css/themes/${currentTheme}.css`;
      firstLink.setAttribute('data-theme-css', currentTheme);
      document.head.appendChild(firstLink);
      console.log('容器终端主题已设置:', currentTheme);

      // 通过 localStorage 轮询同步主程序主题（避免权限限制）
      // 动态加载主题CSS（与主程序一致）
      const ensureThemeCss = (t: string) => {
        // 移除旧的主题CSS
        const existing = document.querySelectorAll('link[data-theme-css]');
        existing.forEach(l => l.remove());
        // 加载新的主题CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `/src/css/themes/${t}.css`;
        link.setAttribute('data-theme-css', t);
        document.head.appendChild(link);
      };

      const applyTheme = (t: string) => {
        const prev = document.documentElement.getAttribute('data-theme');
        if (prev !== t) {
          document.documentElement.setAttribute('data-theme', t);
          ensureThemeCss(t);
          console.log('容器终端主题已同步为:', t);
        }
      };

      // 初始应用一次从 localStorage 读取的主题
      const saved = localStorage.getItem('lovelyres-theme');
      if (saved && typeof saved === 'string') {
        applyTheme(saved);
      }

      // 每秒检查一次（轻量且稳定）
      setInterval(() => {
        try {
          const t = localStorage.getItem('lovelyres-theme');
          if (t) applyTheme(t);
        } catch {}
      }, 1000);
    } catch (error) {
      console.warn('获取主题设置失败，使用默认主题:', error);
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  }

  private bindEvents(): void {
    const input = document.getElementById('command-input') as HTMLInputElement;
    const executeBtn = document.getElementById('execute-btn');
    const clearBtn = document.getElementById('clear-btn');
    const closeBtn = document.getElementById('close-btn');
    const shellSelector = document.getElementById('shell-selector') as HTMLSelectElement;

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          this.executeCommand();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.navigateHistory(-1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.navigateHistory(1);
        }
      });
    }

    if (executeBtn) {
      executeBtn.addEventListener('click', () => this.executeCommand());
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearOutput());
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeWindow());
    }

    if (shellSelector) {
      shellSelector.addEventListener('change', (e) => {
        this.currentShell = (e.target as HTMLSelectElement).value;
        this.addSystemMessage(`已切换到 ${this.currentShell} shell`);
      });
    }
  }

  private async executeCommand(): Promise<void> {
    const input = document.getElementById('command-input') as HTMLInputElement;
    if (!input || !this.containerInfo) return;

    const command = input.value.trim();
    if (!command) return;

    // 添加到历史记录
    this.commandHistory.push(command);
    this.historyIndex = this.commandHistory.length;

    // 显示执行的命令
    this.addCommandLine(command);

    // 显示加载状态
    const loadingDiv = this.addLoadingIndicator();

    try {
      // 直接传递原始命令与所选 shell，由后端构建 docker exec
      const result = await invoke<TerminalOutput>('docker_exec_command', {
        containerId: this.containerInfo.name,
        command,
        shell: this.currentShell,
      });

      // 移除加载状态
      if (loadingDiv) {
        loadingDiv.remove();
      }

      // 显示输出
      this.addCommandOutput(result.output || '(无输出)');

      // 如果有错误码，显示
      if (result.exit_code !== 0) {
        this.addErrorMessage(`退出码: ${result.exit_code}`);
      }

    } catch (error) {
      // 移除加载状态
      if (loadingDiv) {
        loadingDiv.remove();
      }

      // 显示错误
      this.addErrorMessage(`执行失败: ${error}`);
    }

    // 清空输入框
    input.value = '';

    // 滚动到底部
    this.scrollToBottom();
  }

  private navigateHistory(direction: number): void {
    if (this.commandHistory.length === 0) return;

    this.historyIndex += direction;
    
    if (this.historyIndex < 0) {
      this.historyIndex = 0;
    } else if (this.historyIndex >= this.commandHistory.length) {
      this.historyIndex = this.commandHistory.length;
    }

    const input = document.getElementById('command-input') as HTMLInputElement;
    if (input) {
      if (this.historyIndex < this.commandHistory.length) {
        input.value = this.commandHistory[this.historyIndex];
      } else {
        input.value = '';
      }
    }
  }

  private addCommandLine(command: string): void {
    const output = document.getElementById('terminal-output');
    if (!output) return;

    const div = document.createElement('div');
    div.className = 'command-line';
    div.textContent = `$ ${command}`;
    output.appendChild(div);
  }

  private addCommandOutput(text: string): void {
    const output = document.getElementById('terminal-output');
    if (!output) return;

    const div = document.createElement('div');
    div.className = 'command-output';
    div.textContent = text;
    output.appendChild(div);
  }

  private addErrorMessage(message: string): void {
    const output = document.getElementById('terminal-output');
    if (!output) return;

    const div = document.createElement('div');
    div.className = 'command-error';
    div.textContent = message;
    output.appendChild(div);
  }

  private addSystemMessage(message: string): void {
    const output = document.getElementById('terminal-output');
    if (!output) return;

    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = message;
    output.appendChild(div);
  }

  private addLoadingIndicator(): HTMLElement {
    const output = document.getElementById('terminal-output');
    if (!output) return document.createElement('div');

    const div = document.createElement('div');
    div.className = 'loading-indicator';
    div.textContent = '执行中...';
    output.appendChild(div);
    return div;
  }

  private clearOutput(): void {
    const output = document.getElementById('terminal-output');
    if (!output) return;

    output.innerHTML = '<div class="system-message">终端已清空。</div>';
  }

  private scrollToBottom(): void {
    const output = document.getElementById('terminal-output');
    if (output) {
      output.scrollTop = output.scrollHeight;
    }
  }

  private showError(message: string): void {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      const loadingText = loadingScreen.querySelector('.loading-text');
      if (loadingText) {
        loadingText.textContent = `错误: ${message}`;
      }
    }
  }

  private async closeWindow(): Promise<void> {
    try {
      await invoke('close_window');
    } catch (error) {
      console.error('关闭窗口失败:', error);
      window.close();
    }
  }
}

// 初始化终端管理器
const terminalManager = new ContainerTerminalManager();

// 等待页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  // 延迟一点时间确保容器信息已设置
  setTimeout(() => {
    terminalManager.initialize();
  }, 100);
});

// 导出到全局作用域以便调试
(window as any).terminalManager = terminalManager;
