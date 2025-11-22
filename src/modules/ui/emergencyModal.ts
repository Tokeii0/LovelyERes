// EmergencyResultModal - 显示命令执行结果（命令 + 输出 + 搜索高亮）

import { invoke } from '@tauri-apps/api/core'
import * as IconPark from '@icon-park/svg'
import { CommandHistoryManager } from '../utils/commandHistoryManager'
import { vipGuard } from '../auth/vipGuard'

export class EmergencyResultModal {
  private modal: HTMLElement | null = null;
  private titleEl: HTMLElement | null = null;
  private commandEl: HTMLElement | null = null;
  private outputEl: HTMLElement | null = null;
  private searchInput: HTMLInputElement | null = null;
  private isVisible = false;
  private originalOutput = '';
  private commandText = '';
  private currentTitle = '';
  private isEditMode = false;
  private eventsBound = false;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    this.createModal();
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }
  }

  private createModal(): void {
    console.log('🧩 创建 EmergencyResultModal DOM');
    const existing = document.getElementById('emergency-result-modal');
    if (existing) {
      console.log('ℹ️ EmergencyResultModal 已存在，跳过创建');
      this.modal = existing;
      this.titleEl = document.getElementById('em-modal-title');
      this.commandEl = document.getElementById('em-modal-command');
      this.outputEl = document.getElementById('em-modal-content');
      this.searchInput = document.getElementById('em-modal-search') as HTMLInputElement | null;
      return;
    }

    const html = `
      <div id="emergency-result-modal" class="em-result-modal">
        <div class="em-modal-container">
          <div class="em-modal-header">
            <div class="em-modal-title-group">
              <span style="font-size:16px">📄</span>
              <h3 id="em-modal-title" class="em-modal-title">命令输出</h3>
            </div>
            <div class="em-modal-actions">
              <input id="em-modal-search" type="text" class="em-modal-search" placeholder="在输出中搜索..." autocomplete="off">
              <button id="em-modal-ai-explain" class="modern-btn secondary" style="
                font-size: 12px;
                padding: 6px 10px;
                display: flex;
                align-items: center;
                gap: 6px;
              ">
                ${IconPark.Brain({ theme: 'outline', size: '16', fill: 'currentColor' })}
                <span>AI解释</span>
              </button>
              <button id="em-modal-copy" class="modern-btn secondary" style="font-size:12px; padding:6px 10px;">复制输出</button>
              <button id="em-modal-close" class="modern-btn secondary" style="font-size:12px; padding:6px 10px;">关闭</button>
            </div>
          </div>
          
          <div class="em-modal-body">
            <div class="em-modal-command-card">
              <div class="em-modal-command-header">
                <span class="em-modal-command-label">执行命令</span>
                <div class="em-modal-command-actions">
                  <button id="em-modal-edit-btn" class="modern-btn secondary" style="
                    font-size: 12px;
                    padding: 4px 8px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                  ">
                    ${IconPark.Edit({ theme: 'outline', size: '14', fill: 'currentColor' })}
                    <span>修改</span>
                  </button>
                  <button id="em-modal-execute-btn" class="modern-btn primary" style="
                    font-size: 12px;
                    padding: 4px 8px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                  ">
                    ${IconPark.Play({ theme: 'outline', size: '14', fill: 'currentColor' })}
                    <span>执行</span>
                  </button>
                </div>
              </div>
              <code id="em-modal-command" class="em-modal-command-code" contenteditable="false"></code>
            </div>

            <div class="em-modal-output-container">
              <div class="em-modal-output-scroll">
                <pre id="em-modal-content" class="em-modal-output-content"></pre>
              </div>
              
              <div id="em-modal-ai-explanation" class="em-modal-ai-box">
                <div class="em-modal-ai-header">
                  ${IconPark.Brain({ theme: 'outline', size: '18', fill: 'currentColor' })}
                  <span>AI解释</span>
                </div>
                <div id="em-modal-ai-explanation-content" class="em-modal-ai-content"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    this.modal = document.getElementById('emergency-result-modal');
    this.titleEl = document.getElementById('em-modal-title');
    this.commandEl = document.getElementById('em-modal-command');
    this.outputEl = document.getElementById('em-modal-content');
    this.searchInput = document.getElementById('em-modal-search') as HTMLInputElement | null;
  }


  private bindEvents(): void {
    console.log('🔗 绑定 EmergencyResultModal 事件监听器');

    document.getElementById('em-modal-close')?.addEventListener('click', () => this.hide());
    this.modal?.addEventListener('click', (event) => {
      if (event.target === this.modal) this.hide();
    });

    // 保存 keydown 处理器的引用，以便后续可以移除
    this.keydownHandler = (event: KeyboardEvent) => {
      if (!this.isVisible) return;
      if (event.key === 'Escape') this.hide();
    };
    document.addEventListener('keydown', this.keydownHandler);
    document.getElementById('em-modal-copy')?.addEventListener('click', () => {
      navigator.clipboard.writeText(this.originalOutput).then(() => {
        (window as any).showNotification?.('命令输出已复制', 'success');
      }).catch((error) => {
        console.error('复制失败', error);
        (window as any).showNotification?.('复制失败', 'error');
      });
    });

    // AI解释按钮
    document.getElementById('em-modal-ai-explain')?.addEventListener('click', () => {
      this.explainWithAI();
    });

    // 修改按钮
    document.getElementById('em-modal-edit-btn')?.addEventListener('click', () => {
      this.toggleEditMode();
    });

    // 执行按钮
    document.getElementById('em-modal-execute-btn')?.addEventListener('click', () => {
      this.executeCommand();
    });

    if (this.searchInput) {
      let timer: number | null = null;
      this.searchInput.addEventListener('input', () => {
        if (timer) window.clearTimeout(timer);
        const value = this.searchInput?.value ?? '';
        timer = window.setTimeout(() => {
          this.renderOutput(value.trim() || undefined);
        }, 150);
      });
    }
  }

  show(title: string, command: string, output: unknown): void {
    console.log('\u2728 EmergencyResultModal.show', { title, hasModal: !!this.modal });
    if (!this.modal) {
      console.warn('EmergencyResultModal.show: modal 不存在，尝试重新创建');
      this.createModal();
      this.bindEvents();
      if (!this.modal) {
        console.error('EmergencyResultModal.show: 仍然无法创建 modal');
        return;
      }
    }

    this.originalOutput = this.normalizeOutput(output);
    this.commandText = command || '';
    this.currentTitle = title || '命令输出';
    this.isEditMode = false;

    if (this.titleEl) this.titleEl.textContent = this.currentTitle;
    if (this.commandEl) {
      this.commandEl.textContent = this.commandText || '（无命令）';
      this.commandEl.setAttribute('contenteditable', 'false');
      this.commandEl.classList.remove('editing');
    }
    if (this.searchInput) this.searchInput.value = '';

    // 重置AI解释区域
    const aiExplanationEl = document.getElementById('em-modal-ai-explanation');
    if (aiExplanationEl) {
      aiExplanationEl.style.display = 'none';
      const aiContentEl = document.getElementById('em-modal-ai-explanation-content');
      if (aiContentEl) aiContentEl.textContent = '';
    }

    // 更新编辑按钮文本
    const editBtn = document.getElementById('em-modal-edit-btn');
    if (editBtn) {
      editBtn.innerHTML = `${IconPark.Edit({ theme: 'outline', size: '14', fill: 'currentColor' })}<span>修改</span>`;
    }

    this.renderOutput();
    this.modal.style.display = 'flex';
    this.isVisible = true;
  }

  hide(): void {
    if (!this.modal) return;
    this.modal.style.display = 'none';
    this.isVisible = false;
  }

  private renderOutput(searchTerm?: string): void {
    if (!this.outputEl) return;
    const safe = this.escapeHtml(this.originalOutput);
    if (!safe) {
      this.outputEl.innerHTML = '';
      return;
    }
    if (!searchTerm || searchTerm.length === 0) {
      this.outputEl.innerHTML = safe;
      return;
    }
    const regex = new RegExp(this.escapeRegExp(searchTerm), 'gi');
    this.outputEl.innerHTML = safe.replace(regex, (match) => `<mark>${match}</mark>`);
  }

  private normalizeOutput(output: unknown): string {
    if (output == null) {
      return '';
    }
    if (typeof output === 'string') {
      return output;
    }
    if (typeof output === 'number' || typeof output === 'boolean') {
      return String(output);
    }
    if (output instanceof Uint8Array) {
      try {
        return new TextDecoder().decode(output);
      } catch (error) {
        console.warn('无法解码 Uint8Array 输出', error);
        return '[binary data]';
      }
    }
    try {
      return JSON.stringify(output, null, 2);
    } catch (error) {
      console.warn('无法序列化命令输出', error);
      return String(output);
    }
  }

  private escapeHtml(input: string): string {
    return (input || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private escapeRegExp(input: string): string {
    return input.replace(/[-\^$*+?.()|[\]{}]/g, '\\$&');
  }

  /**
   * 切换编辑模式
   */
  private toggleEditMode(): void {
    this.isEditMode = !this.isEditMode;
    const commandEl = this.commandEl;
    const editBtn = document.getElementById('em-modal-edit-btn');

    if (!commandEl || !editBtn) return;

    if (this.isEditMode) {
      // 进入编辑模式
      commandEl.setAttribute('contenteditable', 'true');
      commandEl.classList.add('editing');
      commandEl.focus();
      editBtn.innerHTML = `${IconPark.Save({ theme: 'outline', size: '14', fill: 'currentColor' })}<span>保存</span>`;
      editBtn.classList.remove('secondary');
      editBtn.classList.add('primary');
    } else {
      // 退出编辑模式，保存修改
      commandEl.setAttribute('contenteditable', 'false');
      commandEl.classList.remove('editing');
      this.commandText = commandEl.textContent || '';
      editBtn.innerHTML = `${IconPark.Edit({ theme: 'outline', size: '14', fill: 'currentColor' })}<span>修改</span>`;
      editBtn.classList.remove('primary');
      editBtn.classList.add('secondary');

      (window as any).showNotification?.('命令已更新', 'success');
    }
  }


  /**
   * 执行命令
   */
  private async executeCommand(): Promise<void> {
    const commandEl = this.commandEl;
    if (!commandEl) return;

    // 如果在编辑模式，先保存
    if (this.isEditMode) {
      this.toggleEditMode();
    }

    const command = commandEl.textContent?.trim() || '';
    if (!command) {
      (window as any).showNotification?.('命令不能为空', 'warning');
      return;
    }

    // 显示执行中状态
    const executeBtn = document.getElementById('em-modal-execute-btn');
    if (executeBtn) {
      executeBtn.textContent = '执行中...';
      (executeBtn as HTMLButtonElement).disabled = true;
    }

    try {
      // 获取SSH连接
      const app = (window as any).app;
      const sshManager = app?.sshManager;
      const sshConnectionManager = (window as any).sshConnectionManager;
      const tauriInvoke = (window as any).__TAURI__?.core?.invoke;

      const hasCoordinatorConn = sshManager?.isConnected?.() ?? false;
      const hasDirectConn = sshConnectionManager?.isConnected?.() ?? false;

      if (!hasCoordinatorConn && !hasDirectConn) {
        throw new Error('未连接到服务器');
      }

      let output = '';
      let displayedCommand = command;

      if (hasCoordinatorConn && sshManager?.executeCommand) {
        output = await sshManager.executeCommand(command);
      } else if (hasDirectConn && tauriInvoke) {
        const result: any = await tauriInvoke('ssh_execute_command_direct', { command });
        if (result && typeof result === 'object') {
          if (typeof result.command === 'string' && result.command.length > 0) {
            displayedCommand = result.command;
          }
          if (typeof result.output === 'string') {
            output = result.output;
          } else if (typeof result.stdout === 'string') {
            output = result.stdout;
          } else {
            output = JSON.stringify(result, null, 2);
          }
        } else if (typeof result === 'string') {
          output = result;
        } else {
          output = String(result ?? '');
        }
      }

      // 更新显示
      this.originalOutput = output;
      this.commandText = displayedCommand;
      if (this.commandEl) this.commandEl.textContent = displayedCommand;
      this.renderOutput();

      // 隐藏AI解释（因为是新的输出）
      const aiExplanationEl = document.getElementById('em-modal-ai-explanation');
      if (aiExplanationEl) {
        aiExplanationEl.style.display = 'none';
      }

      // 保存到命令历史
      CommandHistoryManager.saveCommand(displayedCommand, this.currentTitle, output);

      (window as any).showNotification?.('命令执行完成', 'success');
    } catch (error) {
      console.error('执行命令失败:', error);
      (window as any).showNotification?.(`执行失败: ${error}`, 'error');
    } finally {
      // 恢复按钮状态
      if (executeBtn) {
        executeBtn.innerHTML = `${IconPark.Play({ theme: 'outline', size: '14', fill: 'currentColor' })}<span>执行</span>`;
        (executeBtn as HTMLButtonElement).disabled = false;
      }
    }
  }

  /**
   * 使用AI解释当前内容
   */
  private async explainWithAI(): Promise<void> {
    // VIP 权限检查
    if (!vipGuard.requireVIP('AI 解释功能')) {
      return
    }

    const aiExplanationEl = document.getElementById('em-modal-ai-explanation');
    const aiContentEl = document.getElementById('em-modal-ai-explanation-content');

    if (!aiExplanationEl || !aiContentEl) return;

    // 显示AI解释区域
    aiExplanationEl.style.display = 'block';
    aiContentEl.textContent = '🤔 AI正在分析...';

    try {
      // 获取AI设置
      const settingsContent = await invoke('read_settings_file') as string;
      let settings: any = {};

      if (settingsContent) {
        settings = JSON.parse(settingsContent);
      }

      // 如果后端设置文件没有AI配置，使用默认AI配置
      if (!settings.ai) {
        settings.ai = {
          currentProvider: 'openai',
          providers: {
            openai: {
              name: 'OpenAI',
              apiKey: '',
              model: 'gpt-3.5-turbo',
              baseUrl: 'https://api.openai.com/v1'
            }
          }
        };
      }

      if (!settings.ai || !settings.ai.currentProvider) {
        throw new Error('AI配置异常，请在设置中配置AI');
      }

      const currentProvider = settings.ai.currentProvider;
      const providerConfig = settings.ai.providers[currentProvider];

      if (!providerConfig) {
        throw new Error('AI提供商配置不存在');
      }

      if (!providerConfig.apiKey && currentProvider !== 'ollama') {
        throw new Error('请在设置中配置AI API Key');
      }

      // 构建提示词
      const systemPrompt = `你是一个Linux系统安全专家，擅长分析命令输出、系统日志等。请用简洁专业的语言解释用户提供的命令和输出，重点关注安全风险和异常情况。

请分析并解释以下信息：

标题：${this.currentTitle}

命令：
${this.commandText}

输出：
${this.originalOutput}

请提供：
1. 命令功能说明
2. 输出内容解读
3. 关键发现
4. 安全评估（如果适用）
5. 建议操作（如果适用）`;

      // 清空"正在分析"提示
      aiContentEl.textContent = '';

      // 调用AI API，使用真正的流式输出
      await this.callAIAPI(systemPrompt, providerConfig, (chunk: string) => {
        // 实时更新UI
        aiContentEl.textContent += chunk;
      });
    } catch (error) {
      aiContentEl.textContent = `❌ AI解释失败: ${error}\n\n提示：请在设置中配置AI，或者检查AI服务是否可用。`;
    }
  }

  /**
   * 调用AI API（流式输出）
   */
  private async callAIAPI(prompt: string, config: any, onChunk?: (chunk: string) => void): Promise<string> {
    try {
      console.log('🤖 调用AI API (流式模式):', config.name, config.baseUrl);

      // 构建请求体 - 启用流式输出
      const requestBody = {
        model: config.model,
        messages: [
          {
            role: 'system',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
        stream: true  // 启用流式输出
      };

      console.log('📤 AI请求体:', requestBody);

      // 发送请求到AI API
      const response = await fetch(config.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ AI API响应错误:', response.status, errorText);
        throw new Error(`AI API请求失败: ${response.status} ${response.statusText}`);
      }

      // 处理流式响应
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法获取响应流');
      }

      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                // 调用回调函数，实时更新UI
                if (onChunk) {
                  onChunk(content);
                }
              }
            } catch (e) {
              console.warn('解析流式数据失败:', e, data);
            }
          }
        }
      }

      console.log('✅ AI生成的解释:', fullContent);
      return fullContent.trim();
    } catch (error) {
      console.error('❌ AI API调用失败:', error);
      throw error;
    }
  }
}
