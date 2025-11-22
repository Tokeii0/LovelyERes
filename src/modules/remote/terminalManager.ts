/**
 * SSH终端管理器
 * 处理SSH终端操作和命令执行
 */

import { sshConnectionManager } from './sshConnectionManager';

export interface TerminalOutput {
  command: string;
  output: string;
  exit_code?: number;
  timestamp: Date;
}

export class TerminalManager {
  private commandHistory: TerminalOutput[] = [];
  private listeners: Array<(history: TerminalOutput[]) => void> = [];
  private currentWorkingDirectory: string = '~';
  private bashEnvironmentInfo: any = null;
  private inputHistory: string[] = [];
  private historyIndex: number = -1;

  /**
   * 获取命令历史
   */
  getCommandHistory(): TerminalOutput[] {
    return this.commandHistory;
  }

  /**
   * 获取当前工作目录
   */
  getCurrentWorkingDirectory(): string {
    return this.currentWorkingDirectory;
  }

  /**
   * 获取用于 prompt 显示的路径（简化显示）
   */
  private getPromptPath(): string {
    if (!this.currentWorkingDirectory) return '~';

    const homeDir = this.bashEnvironmentInfo?.home ||
      (this.bashEnvironmentInfo?.user === 'root' ? '/root' : `/home/${this.bashEnvironmentInfo?.user || 'user'}`);

    // 如果在用户主目录，显示 ~
    if (this.currentWorkingDirectory === homeDir) {
      return '~';
    }

    // 如果在用户主目录的子目录，显示 ~/子目录
    if (this.currentWorkingDirectory.startsWith(homeDir + '/')) {
      return '~' + this.currentWorkingDirectory.substring(homeDir.length);
    }

    // 其他情况显示完整路径，但如果太长则只显示最后几个目录
    const parts = this.currentWorkingDirectory.split('/').filter(p => p);
    if (parts.length > 3) {
      return '.../' + parts.slice(-2).join('/');
    }

    return this.currentWorkingDirectory;
  }

  /**
   * 添加命令到历史记录
   */
  private addToInputHistory(command: string): void {
    if (command.trim() && this.inputHistory[this.inputHistory.length - 1] !== command.trim()) {
      this.inputHistory.push(command.trim());
      // 限制历史记录长度
      if (this.inputHistory.length > 1000) {
        this.inputHistory = this.inputHistory.slice(-1000);
      }
    }
    this.historyIndex = -1; // 重置历史索引
  }

  /**
   * 获取上一个历史命令
   */
  getPreviousCommand(): string | null {
    if (this.inputHistory.length === 0) return null;

    if (this.historyIndex === -1) {
      this.historyIndex = this.inputHistory.length - 1;
    } else if (this.historyIndex > 0) {
      this.historyIndex--;
    }

    return this.inputHistory[this.historyIndex] || null;
  }

  /**
   * 获取下一个历史命令
   */
  getNextCommand(): string | null {
    if (this.inputHistory.length === 0 || this.historyIndex === -1) return null;

    if (this.historyIndex < this.inputHistory.length - 1) {
      this.historyIndex++;
      return this.inputHistory[this.historyIndex];
    } else {
      this.historyIndex = -1;
      return '';
    }
  }

  /**
   * 初始化当前工作目录
   */
  async initializeWorkingDirectory(): Promise<void> {
    if (sshConnectionManager.isConnected()) {
      const connectionStatus = sshConnectionManager.getConnectionStatus();
      if (connectionStatus?.username === 'root') {
        this.currentWorkingDirectory = '/root';
      } else {
        this.currentWorkingDirectory = `/home/${connectionStatus?.username || 'user'}`;
      }
      console.log(`初始化工作目录为: ${this.currentWorkingDirectory}`);

      // 更新显示
      this.updateTerminalDisplay();
    }
  }

  /**
   * 初始化 Bash 环境信息
   */
  async initializeBashEnvironment(): Promise<void> {
    if (sshConnectionManager.isConnected()) {
      try {
        const envInfo = await (window as any).__TAURI__.core.invoke('get_bash_environment_info');
        this.bashEnvironmentInfo = envInfo;
        console.log('🐚 Bash 环境信息:', envInfo);

        // 更新工作目录为实际的 pwd 结果
        if (envInfo.pwd) {
          this.currentWorkingDirectory = envInfo.pwd;
        }

        // 更新显示
        this.updateTerminalDisplay();
      } catch (error) {
        console.error('获取 Bash 环境信息失败:', error);
      }
    }
  }

  


  


  /**
   * 执行命令
   */
  async executeCommand(command: string): Promise<void> {
    if (!sshConnectionManager.isConnected()) {
      console.error('SSH未连接，无法执行命令');
      return;
    }

    const raw = command || '';
    const trimmed = raw.trim();
    if (!trimmed) return;

    // 添加到输入历史记录
    this.addToInputHistory(trimmed);

    // 处理 cd 命令（前端模拟，不发送到后端）
    const cdMatch = trimmed.match(/^cd(?:\s+(.*))?$/);
    if (cdMatch) {
      // 解析目标目录
      const arg = (cdMatch[1] || '~').trim();
      const argClean = arg.replace(/["']/g, '').replace(/\\/g, '/');

      const joinAndNormalize = (base: string, target: string): string => {
        // 绝对路径
        let path = target.startsWith('/') ? target : (base === '/' ? '/' + target : base + '/' + target);
        // 规范化 .. 和 . 以及重复斜杠
        const parts: string[] = [];
        path.split('/').forEach(seg => {
          if (!seg || seg === '.') return;
          if (seg === '..') {
            if (parts.length > 0) parts.pop();
          } else {
            parts.push(seg);
          }
        });
        return '/' + parts.join('/');
      };

      const status = sshConnectionManager.getConnectionStatus();
      const home = status?.username === 'root' ? '/root' : `/home/${status?.username || 'user'}`;

      let newCwd = this.currentWorkingDirectory || home;
      if (argClean === '~' || argClean === '') {
        newCwd = home;
      } else if (argClean === '-') {
        // 暂不支持上一个目录，保持不变
      } else if (argClean.startsWith('/')) {
        newCwd = joinAndNormalize('/', argClean);
      } else if (argClean === '..') {
        newCwd = joinAndNormalize(newCwd, '..');
      } else if (argClean === '.') {
        // 不变
      } else {
        newCwd = joinAndNormalize(newCwd, argClean);
      }

      // 更新内部工作目录并记录到历史（输出为空，模拟终端行为）
      console.log(`CD 更新工作目录: ${this.currentWorkingDirectory} -> ${newCwd}`);
      this.currentWorkingDirectory = newCwd;
      this.commandHistory.push({
        command: trimmed,
        output: '',
        exit_code: 0,
        timestamp: new Date()
      });
      this.notifyListeners();
      sshConnectionManager.updateLastActivity();
      return;
    }

    // 非 cd 命令：在当前工作目录下执行
    const cwd = (this.currentWorkingDirectory || '').replace(/["']/g, '');
    const prefixed = cwd ? `cd "${cwd}" && ${trimmed}` : trimmed;

    try {
      const result = await (window as any).__TAURI__.core.invoke('ssh_execute_command_direct', {
        command: prefixed
      });

      const terminalOutput: TerminalOutput = {
        command: trimmed,
        output: result.output,
        exit_code: result.exit_code,
        timestamp: new Date()
      };

      this.commandHistory.push(terminalOutput);

      // 仅当用户显式执行 pwd 时，同步一次（此时结果已在 cwd 下执行）
      if (trimmed === 'pwd') {
        const lines = (result.output || '').trim().split('\n');
        const last = (lines[lines.length - 1] || '').trim();
        if (last.startsWith('/')) this.currentWorkingDirectory = last;
      }

      this.notifyListeners();
      sshConnectionManager.updateLastActivity();

    } catch (error) {
      console.error('执行命令失败:', error);
      (window as any).showConnectionStatus(`命令执行失败: ${error}`, 'error');

      this.commandHistory.push({
        command: trimmed,
        output: `错误: ${error}`,
        exit_code: -1,
        timestamp: new Date()
      });
      this.notifyListeners();
    }
  }

  /**
   * 使用指定账号执行命令
   */
  async executeCommandAsUser(command: string, username: string): Promise<void> {
    if (!sshConnectionManager.isConnected()) {
      console.error('SSH未连接，无法执行命令');
      return;
    }

    const raw = command || '';
    const trimmed = raw.trim();
    if (!trimmed) return;

    // 添加到输入历史记录
    this.addToInputHistory(trimmed);

    // 在当前工作目录下执行（账号切换会影响权限，但不影响路径）
    const cwd = (this.currentWorkingDirectory || '').replace(/["']/g, '');
    const prefixed = cwd ? `cd "${cwd}" && ${trimmed}` : trimmed;

    try {
      const result = await (window as any).__TAURI__.core.invoke('ssh_execute_command_direct', {
        command: prefixed,
        username: username
      });

      const terminalOutput: TerminalOutput = {
        command: `[${username}] ${trimmed}`,
        output: result.output,
        exit_code: result.exit_code,
        timestamp: new Date()
      };

      this.commandHistory.push(terminalOutput);

      // 如果执行 pwd，同步工作目录
      if (trimmed === 'pwd') {
        const lines = (result.output || '').trim().split('\n');
        const last = (lines[lines.length - 1] || '').trim();
        if (last.startsWith('/')) this.currentWorkingDirectory = last;
      }

      this.notifyListeners();
      sshConnectionManager.updateLastActivity();

    } catch (error) {
      console.error(`使用账号 ${username} 执行命令失败:`, error);
      (window as any).showConnectionStatus(`使用账号 ${username} 执行命令失败: ${error}`, 'error');

      this.commandHistory.push({
        command: `[${username}] ${trimmed}`,
        output: `错误: ${error}`,
        exit_code: -1,
        timestamp: new Date()
      });
      this.notifyListeners();
    }
  }

  /**
   * 清空终端历史
   */
  clearHistory(): void {
    this.commandHistory = [];
    this.notifyListeners();
  }

  /**
   * 加载账号列表
   */
  private async loadAccountList(): Promise<void> {
    try {
      // 获取当前所有SSH连接
      const invoke = (window as any).__TAURI__?.core?.invoke;
      if (!invoke) {
        console.warn('⚠️ Tauri invoke 不可用，无法加载账号列表');
        return;
      }

      const connections = await invoke('load_ssh_connections') as any[];
      if (connections.length === 0) {
        console.log('📋 没有可用的SSH连接');
        return;
      }

      // 假设使用第一个连接的账号列表（在实际应用中，应该获取当前活动连接）
      const connection = connections[0];
      const accounts = connection.accounts || [];

      // 更新账号下拉列表
      const select = document.getElementById('terminal-account-select') as HTMLSelectElement;
      if (!select) {
        console.warn('⚠️ 终端账号选择下拉框未找到');
        return;
      }

      // 清空现有选项
      select.innerHTML = '<option value="">默认账号</option>';

      // 添加账号选项
      accounts.forEach((account: any) => {
        const option = document.createElement('option');
        option.value = account.username;
        option.textContent = `${account.username}${account.description ? ` (${account.description})` : ''}${account.is_default ? ' [默认]' : ''}`;
        select.appendChild(option);
      });

      console.log(`✅ 终端输入区域加载了 ${accounts.length} 个账号`);
    } catch (error) {
      console.error('❌ 终端加载账号列表失败:', error);
    }
  }

  /**
   * 渲染终端内容HTML
   */
  renderTerminalHTML(): string {
    const connectionStatus = sshConnectionManager.getConnectionStatus();
    
    if (!connectionStatus?.connected) {
      return `
        <div style="
          text-align: center;
          padding: var(--spacing-lg);
          color: #888;
          font-size: 12px;
        ">
          <div style="margin-bottom: var(--spacing-sm);">
            <svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="color: #888;">
              <rect x="6" y="8" width="36" height="24" rx="2" ry="2" stroke="currentColor" stroke-width="2" fill="none"/>
              <rect x="6" y="32" width="36" height="8" rx="2" ry="2" stroke="currentColor" stroke-width="2" fill="none"/>
              <circle cx="24" cy="20" r="3" fill="currentColor"/>
            </svg>
          </div>
          <div>SSH终端未连接</div>
          <div style="margin-top: var(--spacing-xs); font-size: 10px;">
            请先在左上角建立SSH连接
          </div>
        </div>
      `;
    }

    // 显示连接信息和 shell 类型
    const shellInfo = this.bashEnvironmentInfo ?
      `${this.bashEnvironmentInfo.shell_type} ${this.bashEnvironmentInfo.bash_version}` :
      'shell';

    let html = `
      <div style="color: #00ff00; margin-bottom: 8px;">
        SSH连接已建立: ${connectionStatus.username}@${connectionStatus.host}:${connectionStatus.port} (${shellInfo})
      </div>
    `;

    if (this.commandHistory.length === 0) {
      html += `
        <div style="color: #888; font-size: 12px; margin-bottom: 16px;">
          ${this.bashEnvironmentInfo?.shell_type === 'bash' ? 'Bash' : 'Shell'} 终端已就绪，可以执行命令
        </div>
      `;
    } else {
      // 显示命令历史
      this.commandHistory.forEach(entry => {
        const promptPath = this.getPromptPath();
        html += `
          <div style="margin-bottom: 8px;">
            <div style="color: #00ff00; margin-bottom: 4px;">
              <span style="color: #00ff00;">${connectionStatus.username}</span><span style="color: #ffffff;">@</span><span style="color: #00ff00;">${connectionStatus.host}</span><span style="color: #ffffff;">:</span><span style="color: #0080ff;">${promptPath}</span><span style="color: #ffffff;">$ </span><span style="color: #ffffff;">${entry.command}</span>
            </div>
            <div style="color: #cccccc; margin-bottom: 8px; white-space: pre-wrap;">${entry.output}</div>
          </div>
        `;
      });
    }

    return html;
  }

  /**
   * 渲染终端输入区HTML
   */
  renderTerminalInputHTML(): string {
    const connectionStatus = sshConnectionManager.getConnectionStatus();
    const isConnected = connectionStatus?.connected || false;

    const promptPath = this.getPromptPath();
    const promptText = isConnected
      ? `${connectionStatus!.username}@${connectionStatus!.host}:${promptPath}$`
      : '$';

    const placeholder = isConnected ? '输入命令...' : '请先连接SSH...';
    const shellType = this.bashEnvironmentInfo?.shell_type || 'shell';

    // 获取当前连接的账号列表
    const currentConnectionId = sshConnectionManager.getCurrentConnectionId();
    const sshManager = (window as any).app?.sshManager;
    let accountsOptions = '<option value="">默认账号</option>';

    if (isConnected && currentConnectionId && sshManager) {
      const connection = sshManager.getConnection(currentConnectionId);
      if (connection && connection.accounts && connection.accounts.length > 0) {
        connection.accounts.forEach((account: any) => {
          const label = account.description
            ? `${account.username} (${account.description})`
            : account.username;
          accountsOptions += `<option value="${account.username}">${label}</option>`;
        });
      }
    }

    return `
      <div style="
        background: #2a2a2a;
        padding: var(--spacing-sm) var(--spacing-md);
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
      ">
        <span
          style="color: #00ff00; font-size: 12px; cursor: help;"
          id="terminal-prompt"
          title="当前工作目录: ${isConnected ? this.currentWorkingDirectory : '未连接'}&#10;Shell: ${shellType}${this.bashEnvironmentInfo?.bash_version ? ' ' + this.bashEnvironmentInfo.bash_version : ''}"
        >${promptText}</span>
        <input
          type="text"
          id="terminal-input"
          placeholder="${placeholder}"
          ${isConnected ? '' : 'disabled'}
          style="
            flex: 1;
            background: transparent;
            border: none;
            color: #ffffff;
            font-family: 'Courier New', monospace;
            font-size: 14px;
            outline: none;
          "
          onkeypress="if(event.key==='Enter') terminalManager.executeCommandFromInput()"
        />
        <select
          id="terminal-account-select"
          ${isConnected ? '' : 'disabled'}
          style="
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: #ffffff;
            padding: 4px 8px;
            font-size: 11px;
            border-radius: 4px;
            outline: none;
            cursor: pointer;
          "
          title="选择执行命令的账号"
        >
          ${accountsOptions}
        </select>
        <button
          class="modern-btn primary"
          style="padding: 4px 12px; font-size: 12px;"
          id="terminal-execute-btn"
          onclick="terminalManager.executeCommandFromInput()"
          ${isConnected ? '' : 'disabled'}
        >
          执行
        </button>
      </div>
    `;
  }

  /**
   * 从输入框执行命令
   */
  async executeCommandFromInput(): Promise<void> {
    const terminalInput = document.getElementById('terminal-input') as HTMLInputElement;
    const accountSelect = document.getElementById('terminal-account-select') as HTMLSelectElement;
    if (!terminalInput) return;

    const command = terminalInput.value.trim();
    if (!command) return;

    // 获取选中的账号
    const selectedUsername = accountSelect?.value || '';

    // 清空输入框
    terminalInput.value = '';

    // 如果选择了特定账号，使用账号切换执行
    if (selectedUsername) {
      await this.executeCommandAsUser(command, selectedUsername);
    } else {
      // 否则使用默认账号执行
      await this.executeCommand(command);
    }

    // 更新终端显示
    this.updateTerminalDisplay();
  }

  /**
   * 更新终端显示
   */
  updateTerminalDisplay(): void {
    const terminalOutput = document.getElementById('terminal-output');
    if (terminalOutput) {
      terminalOutput.innerHTML = this.renderTerminalHTML();
      terminalOutput.scrollTop = terminalOutput.scrollHeight;
    }

    // 确保输入区已渲染（如未渲染则插入一次）
    const inputArea = document.getElementById('terminal-input-area');
    if (inputArea && !inputArea.querySelector('#terminal-input')) {
      inputArea.innerHTML = this.renderTerminalInputHTML();
      // 渲染后动态加载账号列表
      this.loadAccountList();
    }

    // 更新输入区状态
    const terminalPrompt = document.getElementById('terminal-prompt');
    const terminalInput = document.getElementById('terminal-input') as HTMLInputElement;
    const terminalExecuteBtn = document.getElementById('terminal-execute-btn') as HTMLButtonElement;

    const connectionStatus = sshConnectionManager.getConnectionStatus();
    const isConnected = connectionStatus?.connected || false;

    if (terminalPrompt && connectionStatus) {
      const promptText = isConnected
        ? `${connectionStatus.username}@${connectionStatus.host}:~$`
        : '$';
      terminalPrompt.textContent = promptText;
      terminalPrompt.title = `当前工作目录: ${isConnected ? this.currentWorkingDirectory : '未连接'}`;
    }

    if (terminalInput) {
      terminalInput.disabled = !isConnected;
      terminalInput.placeholder = isConnected ? '输入命令...' : '请先连接SSH...';

      // 移除旧的事件监听器（如果存在）
      const newInput = terminalInput.cloneNode(true) as HTMLInputElement;
      terminalInput.parentNode?.replaceChild(newInput, terminalInput);

      // 添加键盘事件监听器（使用箭头函数保持 this 上下文）
      newInput.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          const prevCommand = this.getPreviousCommand();
          if (prevCommand !== null) {
            newInput.value = prevCommand;
          }
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          const nextCommand = this.getNextCommand();
          if (nextCommand !== null) {
            newInput.value = nextCommand;
          }
        } else if (e.key === 'Enter') {
          e.preventDefault();
          // 直接调用执行逻辑，不依赖 handleTerminalInput 方法
          const command = newInput.value.trim();
          if (command) {
            newInput.value = '';
            this.executeCommand(command).then(() => {
              this.updateTerminalDisplay();
            });
          }
        } else if (e.key === 'Tab') {
          e.preventDefault();
          // TODO: 实现 Tab 补全
          console.log('Tab 补全功能待实现');
        }
      });
    }

    if (terminalExecuteBtn) {
      terminalExecuteBtn.disabled = !isConnected;
    }
  }

  /**
   * 添加监听器
   */
  addListener(listener: (history: TerminalOutput[]) => void): void {
    this.listeners.push(listener);
  }

  /**
   * 移除监听器
   */
  removeListener(listener: (history: TerminalOutput[]) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.commandHistory);
      } catch (error) {
        console.error('终端历史监听器执行失败:', error);
      }
    });
  }
}

// 全局终端管理器实例
export const terminalManager = new TerminalManager();

