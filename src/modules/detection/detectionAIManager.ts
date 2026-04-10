/**
 * Detection AI Manager
 * Handles AI solution generation, confirm dialogs, command execution,
 * and related modal UI for detection results.
 */

import { invoke } from '@tauri-apps/api/core';
import { aiService } from '../ai/aiService';
import { showAlert, showConfirm } from '../ui/confirmDialog';
import {
  Robot,
  ListBottom,
  Caution,
  Stopwatch,
} from '@icon-park/svg';
import type { DetectionReport } from './quickDetectionManager';

export class DetectionAIManager {
  public currentReport: DetectionReport | null = null;

  async generateAISolutionStream(title: string, description: string, severity: string, containerId: string): Promise<void> {
    // 检查是否配置了 AI
    if (!aiService.isConfigured()) {
      const goToSettings = await showConfirm({
        title: 'AI 服务未配置',
        message: 'AI 服务尚未配置，无法生成解决方案。',
        description: '是否前往设置页面配置 AI API？',
        confirmText: '前往设置',
        cancelText: '取消',
        dangerous: false
      });

      if (goToSettings) {
        // 打开设置页面
        const settingsBtn = document.querySelector('[data-page="settings"]') as HTMLElement;
        if (settingsBtn) {
          settingsBtn.click();
          // 切换到 AI 设置标签
          setTimeout(() => {
            const aiTab = document.querySelector('[data-tab="ai"]') as HTMLElement;
            if (aiTab) {
              aiTab.click();
            }
          }, 500);
        }
      }
      return;
    }

    const container = document.getElementById(containerId);
    if (!container) return;

    // 清空容器并显示加载状态
    container.innerHTML = `
      <div style="
        padding: 12px;
        background: var(--bg-secondary);
        border-radius: 6px;
        border-left: 3px solid var(--accent-color);
      ">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
          <div style="
            width: 12px;
            height: 12px;
            border: 2px solid var(--border-color);
            border-top-color: var(--accent-color);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          "></div>
          <span style="font-weight: 500; color: var(--text-primary); font-size: 13px;">AI 正在生成解决方案...</span>
        </div>
        <div id="${containerId}-content" style="
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.6;
          white-space: pre-wrap;
        "></div>
      </div>
    `;

    const contentElement = document.getElementById(`${containerId}-content`);
    if (!contentElement) return;

    let fullText = '';
    const buttonElement = document.getElementById(`${containerId}-btn`) as HTMLButtonElement;
    if (buttonElement) {
      buttonElement.disabled = true;
      buttonElement.style.opacity = '0.5';
      buttonElement.style.cursor = 'not-allowed';
    }

    try {
      // 获取服务器信息（如果可用）
      let serverInfo = '';
      if (this.currentReport) {
        serverInfo = this.currentReport.server;
      }

      // 调用 AI 服务流式生成
      await aiService.generateConciseSolutionStream(
        title,
        description,
        severity,
        serverInfo,
        // onChunk: 每次接收到新内容
        (text: string) => {
          fullText += text;
          // 渲染内容，包括命令按钮
          this.renderStreamContent(contentElement, fullText);
        },
        // onComplete: 生成完成
        (finalText: string) => {
          fullText = finalText;
          // 最终渲染
          this.renderStreamContent(contentElement, fullText);

          // 添加"不满意?点我生成详细方案"按钮
          const detailedBtn = document.createElement('button');
          detailedBtn.className = 'modern-btn secondary';
          detailedBtn.style.cssText = `
            position: absolute;
            bottom: 12px;
            right: 12px;
            font-size: 11px;
            padding: 4px 12px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            z-index: 10;
          `;
          detailedBtn.innerHTML = `
            ${Robot({ theme: 'outline', size: '12', fill: 'currentColor' })}
            <span>不满意? 点我生成详细方案</span>
          `;
          detailedBtn.onclick = () => {
            this.generateAISolution(title, description, severity);
          };

          // 将按钮添加到 wrapper 容器（已有相对定位）
          const wrapperContainer = document.getElementById(`${containerId}-wrapper`);
          if (wrapperContainer) {
            // 清除可能已存在的详细按钮
            const existingBtn = wrapperContainer.querySelector('.detailed-solution-btn');
            if (existingBtn) {
              existingBtn.remove();
            }
            detailedBtn.classList.add('detailed-solution-btn');
            wrapperContainer.appendChild(detailedBtn);
            // 添加底部padding为按钮留出空间
            wrapperContainer.style.paddingBottom = '40px';
          }

          // 恢复按钮状态
          if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.style.opacity = '1';
            buttonElement.style.cursor = 'pointer';
          }
        }
      );
    } catch (error: any) {
      // 显示错误信息
      container.innerHTML = `
        <div style="
          padding: 12px;
          background: rgba(239, 68, 68, 0.1);
          border-radius: 6px;
          border-left: 3px solid #ef4444;
        ">
          <div style="font-weight: 500; color: #ef4444; margin-bottom: 4px; font-size: 13px;">❌ AI 生成失败</div>
          <div style="font-size: 12px; color: var(--text-secondary);">${error.message}</div>
        </div>
      `;

      // 恢复按钮状态
      if (buttonElement) {
        buttonElement.disabled = false;
        buttonElement.style.opacity = '1';
        buttonElement.style.cursor = 'pointer';
      }

      console.error('AI 解决方案生成失败:', error);
    }
  }

  /**
   * 渲染流式内容，包括命令按钮
   */
  public renderStreamContent(element: HTMLElement, text: string): void {
    // 清空当前内容
    element.innerHTML = '';

    // 解析内容，识别命令块
    const parts = text.split(/```/);

    parts.forEach((part, index) => {
      if (index % 2 === 0) {
        // 普通文本
        if (part.trim()) {
          const textNode = document.createElement('div');
          textNode.textContent = part;
          textNode.style.cssText = 'margin-bottom: 8px;';
          element.appendChild(textNode);
        }
      } else {
        // 命令块 - 处理可能的语言标识符（如 bash, sh, shell 等）
        let commandText = part.trim();

        // 去除第一行的语言标识符（如果存在）
        const lines = commandText.split('\n');
        if (lines.length > 0 && /^(bash|sh|shell|zsh|powershell|cmd|console)$/i.test(lines[0].trim())) {
          lines.shift(); // 移除语言标识符行
          commandText = lines.join('\n').trim();
        }

        // 过滤掉命令提示符（如 $, #, > 等）
        commandText = commandText.replace(/^[\$#>]\s*/gm, '');

        if (commandText) {
          const commandContainer = document.createElement('div');
          commandContainer.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
            margin: 8px 0;
            padding: 8px;
            background: var(--bg-tertiary);
            border-radius: 4px;
            border: 1px solid var(--border-color);
          `;

          const commandCode = document.createElement('code');
          commandCode.textContent = commandText;
          commandCode.style.cssText = `
            flex: 1;
            font-family: var(--font-mono, monospace);
            font-size: 11px;
            color: var(--accent-color);
            white-space: pre;
          `;

          const executeBtn = document.createElement('button');
          executeBtn.className = 'modern-btn secondary';
          executeBtn.style.cssText = `
            font-size: 10px;
            padding: 3px 8px;
            white-space: nowrap;
            flex-shrink: 0;
          `;
          executeBtn.textContent = '执行';
          executeBtn.onclick = () => {
            this.executeCommand(commandText);
          };

          commandContainer.appendChild(commandCode);
          commandContainer.appendChild(executeBtn);
          element.appendChild(commandContainer);
        }
      }
    });
  }

  /**
   * 显示命令确认对话框
   */
  public async showConfirmDialog(command: string): Promise<boolean> {
    // 构建命令显示的HTML
    const commandHtml = `
      <div style="
        font-family: var(--font-mono, monospace);
        font-size: 13px;
        background: var(--bg-secondary);
        padding: 12px;
        border-radius: 6px;
        color: var(--accent-color);
        border-left: 3px solid var(--accent-color);
        word-break: break-all;
        white-space: pre-wrap;
        margin-bottom: 12px;
      ">${this.escapeHtml(command)}</div>
      <div style="
        padding: 10px 12px;
        background: rgba(239, 68, 68, 0.1);
        border-radius: 6px;
        border-left: 3px solid #ef4444;
      ">
        <div style="font-weight: 500; color: #ef4444; margin-bottom: 6px; font-size: 12px;">⚠️ 重要提示</div>
        <ul style="margin: 0; padding-left: 18px; font-size: 11px; color: var(--text-secondary); line-height: 1.6;">
          <li>请确保您了解此命令的作用</li>
          <li>命令将在SSH连接的服务器上执行</li>
          <li>某些命令可能影响系统稳定性</li>
        </ul>
      </div>
    `;

    return showConfirm({
      title: '确认执行命令',
      message: commandHtml,
      description: '此操作将在远程服务器上执行命令',
      confirmText: '确认执行',
      cancelText: '取消',
      dangerous: true
    });
  }

  /**
   * 执行命令（带二级确认）
   */
  public async executeCommand(command: string): Promise<void> {
    // 自定义二级确认对话框
    const confirmed = await this.showConfirmDialog(command);

    if (!confirmed) {
      return;
    }

    // 显示执行结果的模态框
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      padding: 20px;
    `;

    modal.innerHTML = `
      <div style="
        background: var(--bg-primary);
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        max-width: 800px;
        width: 100%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
      ">
        <div style="
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--text-primary);">命令执行结果</h3>
          <button onclick="this.closest('div[style*=fixed]').remove()" style="
            background: none;
            border: none;
            color: var(--text-secondary);
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
          ">×</button>
        </div>
        <div style="padding: 20px; overflow-y: auto; flex: 1;">
          <div style="
            font-family: var(--font-mono, monospace);
            font-size: 12px;
            background: var(--bg-secondary);
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 12px;
          ">
            <div style="color: var(--text-secondary); margin-bottom: 4px;">$ ${command}</div>
          </div>
          <div id="command-output" style="
            font-family: var(--font-mono, monospace);
            font-size: 12px;
            background: var(--bg-secondary);
            padding: 12px;
            border-radius: 6px;
            min-height: 100px;
            color: var(--text-primary);
            white-space: pre-wrap;
          ">正在执行命令...</div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const outputElement = document.getElementById('command-output');
    if (!outputElement) return;

    try {
      // 调用 Tauri 后端命令执行
      const result = await invoke('execute_detection_command', { command });

      // 显示执行结果
      if (result && typeof result === 'object') {
        const output = result as {
          command: string;
          output: string;
          exit_code: number | null;
          timestamp: string;
        };

        let outputHtml = '';

        // 显示命令输出
        if (output.output) {
          outputHtml += `<div style="color: var(--text-primary);">${this.escapeHtml(output.output)}</div>`;
        } else {
          outputHtml += `<div style="color: var(--text-secondary);">命令执行完成，无输出</div>`;
        }

        // 显示退出码
        if (output.exit_code !== null) {
          const exitCodeColor = output.exit_code === 0 ? '#22c55e' : '#ef4444';
          const exitCodeText = output.exit_code === 0 ? '成功' : '失败';
          outputHtml += `<div style="color: ${exitCodeColor}; margin-top: 8px; font-size: 11px; font-weight: 500;">
            ${exitCodeText} (退出码: ${output.exit_code})
          </div>`;
        }

        outputElement.innerHTML = outputHtml;
      } else {
        outputElement.innerHTML = `<div style="color: var(--text-secondary);">命令执行完成</div>`;
      }
    } catch (error: any) {
      outputElement.innerHTML = `
        <div style="color: #ef4444;">❌ 执行失败</div>
        <div style="margin-top: 8px; color: var(--text-secondary);">${this.escapeHtml(error.message || error.toString())}</div>
      `;
      console.error('命令执行失败:', error);
    }
  }

  /**
   * HTML 转义
   */
  public escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * AI 生成解决方案（完整版，用于详细方案）
   */
  async generateAISolution(title: string, description: string, severity: string = 'medium'): Promise<void> {
    // 检查是否配置了 AI
    if (!aiService.isConfigured()) {
      const goToSettings = await showConfirm({
        title: 'AI 服务未配置',
        message: 'AI 服务尚未配置，无法生成解决方案。',
        description: '是否前往设置页面配置 AI API？',
        confirmText: '前往设置',
        cancelText: '取消',
        dangerous: false
      });

      if (goToSettings) {
        // 打开设置页面
        const settingsBtn = document.querySelector('[data-page="settings"]') as HTMLElement;
        if (settingsBtn) {
          settingsBtn.click();
          // 切换到 AI 设置标签
          setTimeout(() => {
            const aiTab = document.querySelector('[data-tab="ai"]') as HTMLElement;
            if (aiTab) {
              aiTab.click();
            }
          }, 500);
        }
      }
      return;
    }

    // 显示加载提示
    const loadingModal = this.showLoadingModal('正在生成 AI 解决方案...');

    try {
      // 获取服务器信息（如果可用）
      let serverInfo = '';
      if (this.currentReport) {
        serverInfo = this.currentReport.server;
      }

      // 调用 AI 服务生成解决方案
      const solution = await aiService.generateSolution(
        title,
        description,
        severity,
        serverInfo
      );

      // 关闭加载提示
      this.closeLoadingModal(loadingModal);

      // 显示解决方案模态框
      this.showSolutionModal(title, description, solution);
    } catch (error: any) {
      // 关闭加载提示
      this.closeLoadingModal(loadingModal);

      // 显示错误信息
      showAlert({ title: 'AI 解决方案生成失败', message: `${error.message}\n\n请检查：\n1. AI API 配置是否正确\n2. API Key 是否有效\n3. 网络连接是否正常`, type: 'error' });
      console.error('AI 解决方案生成失败:', error);
    }
  }

  /**
   * 显示加载模态框
   */
  public showLoadingModal(message: string): HTMLElement {
    const modal = document.createElement('div');
    modal.id = 'ai-loading-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `;
    modal.innerHTML = `
      <div style="
        background: var(--bg-primary);
        padding: 30px 40px;
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        text-align: center;
      ">
        <div style="
          width: 50px;
          height: 50px;
          border: 3px solid var(--border-color);
          border-top-color: var(--accent-color);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 20px;
        "></div>
        <div style="
          font-size: 16px;
          color: var(--text-primary);
          font-weight: 500;
        ">${message}</div>
        <div style="
          font-size: 13px;
          color: var(--text-secondary);
          margin-top: 8px;
        ">这可能需要几秒钟...</div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  /**
   * 关闭加载模态框
   */
  public closeLoadingModal(modal: HTMLElement): void {
    if (modal && modal.parentNode) {
      modal.parentNode.removeChild(modal);
    }
  }

  /**
   * 显示 AI 解决方案模态框
   */
  public showSolutionModal(title: string, description: string, solution: any): void {
    // 创建模态框
    const modal = document.createElement('div');
    modal.id = 'ai-solution-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      padding: 20px;
    `;

    modal.innerHTML = `
      <div style="
        background: var(--bg-primary);
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        max-width: 800px;
        width: 100%;
        max-height: 90vh;
        display: flex;
        flex-direction: column;
      ">
        <!-- 头部 -->
        <div style="
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <h3 style="
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--text-primary);
          " style="display: inline-flex; align-items: center; gap: 8px;">
            ${Robot({ theme: 'outline', size: '20', fill: 'var(--text-primary)' })}
            <span>AI 生成的解决方案</span>
          </h3>
          <button onclick="this.closest('#ai-solution-modal').remove()" style="
            background: none;
            border: none;
            color: var(--text-secondary);
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s;
          " onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">×</button>
        </div>

        <!-- 内容 -->
        <div style="
          padding: 24px;
          overflow-y: auto;
          flex: 1;
        ">
          <!-- 问题信息 -->
          <div style="
            background: var(--bg-secondary);
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
          ">
            <div style="
              font-size: 14px;
              font-weight: 600;
              color: var(--text-primary);
              margin-bottom: 8px;
            ">问题: ${title}</div>
            <div style="
              font-size: 13px;
              color: var(--text-secondary);
              line-height: 1.5;
            ">${description}</div>
          </div>

          <!-- 解决步骤 -->
          ${solution.steps && solution.steps.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <h4 style="
                font-size: 15px;
                font-weight: 600;
                color: var(--text-primary);
                margin: 0 0 12px 0;
              " style="display: inline-flex; align-items: center; gap: 6px;">
                ${ListBottom({ theme: 'outline', size: '16', fill: 'var(--text-primary)' })}
                <span>解决步骤</span>
              </h4>
              <div style="
                background: var(--bg-secondary);
                padding: 16px;
                border-radius: 8px;
              ">
                <ol style="
                  margin: 0;
                  padding-left: 20px;
                  color: var(--text-primary);
                  line-height: 1.8;
                ">
                  ${solution.steps.map((step: string) => `<li style="margin-bottom: 8px;">${step}</li>`).join('')}
                </ol>
              </div>
            </div>
          ` : ''}

          <!-- 风险提示 -->
          ${solution.risks && solution.risks.length > 0 ? `
            <div style="margin-bottom: 20px;">
              <h4 style="
                font-size: 15px;
                font-weight: 600;
                color: var(--text-primary);
                margin: 0 0 12px 0;
              " style="display: inline-flex; align-items: center; gap: 6px;">
                ${Caution({ theme: 'outline', size: '16', fill: 'var(--text-primary)' })}
                <span>风险提示</span>
              </h4>
              <div style="
                background: #fef3c7;
                border-left: 3px solid #f59e0b;
                padding: 16px;
                border-radius: 8px;
              ">
                <ul style="
                  margin: 0;
                  padding-left: 20px;
                  color: #92400e;
                  line-height: 1.8;
                ">
                  ${solution.risks.map((risk: string) => `<li style="margin-bottom: 8px;">${risk}</li>`).join('')}
                </ul>
              </div>
            </div>
          ` : ''}

          <!-- 预计时间 -->
          ${solution.timeEstimate ? `
            <div style="
              background: var(--bg-secondary);
              padding: 12px 16px;
              border-radius: 8px;
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 13px;
              color: var(--text-secondary);
            ">
              ${Stopwatch({ theme: 'outline', size: '16', fill: 'var(--text-secondary)' })}
              <span>预计耗时: ${solution.timeEstimate}</span>
            </div>
          ` : ''}

          <!-- 完整方案 -->
          <details style="margin-top: 20px;">
            <summary style="
              cursor: pointer;
              font-size: 14px;
              font-weight: 600;
              color: var(--text-primary);
              padding: 12px;
              background: var(--bg-secondary);
              border-radius: 8px;
              user-select: none;
            ">查看完整 AI 方案</summary>
            <div style="
              margin-top: 12px;
              padding: 16px;
              background: var(--bg-secondary);
              border-radius: 8px;
              font-size: 13px;
              line-height: 1.8;
              color: var(--text-primary);
              white-space: pre-wrap;
              font-family: var(--font-mono, monospace);
              max-height: 300px;
              overflow-y: auto;
            ">${solution.solution}</div>
          </details>
        </div>

        <!-- 底部按钮 -->
        <div style="
          padding: 16px 24px;
          border-top: 1px solid var(--border-color);
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        ">
          <button onclick="navigator.clipboard.writeText(this.dataset.solution).then(() => window.showNotification?.('已复制到剪贴板', 'success'))" data-solution="${solution.solution.replace(/"/g, '&quot;')}" style="
            padding: 8px 16px;
            background: var(--bg-secondary);
            border: 1px solid var(--border-color);
            border-radius: 6px;
            color: var(--text-primary);
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.background='var(--bg-tertiary)'" onmouseout="this.style.background='var(--bg-secondary)'">复制方案</button>
          <button onclick="this.closest('#ai-solution-modal').remove()" style="
            padding: 8px 16px;
            background: var(--accent-color);
            border: none;
            border-radius: 6px;
            color: white;
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">关闭</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 点击背景关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });
  }
}

export const detectionAIManager = new DetectionAIManager();
