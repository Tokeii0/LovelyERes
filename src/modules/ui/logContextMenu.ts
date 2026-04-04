/**
 * 日志分析右键菜单
 * 提供复制和 AI 解释功能
 */

import * as IconPark from '@icon-park/svg'
import { aiService } from '../ai/aiService'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class LogContextMenu extends BaseContextMenu {
  private currentLogContent: string = ''

  constructor() {
    super('log')
  }

  protected onShowContextMenu(content: string) {
    this.currentLogContent = content
  }

  protected getMenuItemsHTML(): string {
    return `
      <div class="menu-item" data-action="copy">
        <span class="menu-label">
          ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
          <span>复制内容</span>
        </span>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" data-action="ai-explain">
        <span class="menu-label">
          ${IconPark.Brain({ theme: 'outline', size: '14', fill: 'currentColor' })}
          <span>AI 解释含义</span>
        </span>
      </div>
    `
  }

  protected resolveAction(action: string): MenuAction | null {
    const actions: Record<string, MenuAction> = {
      'copy': { command: '', title: '复制内容', actionName: '复制' },
      'ai-explain': { command: '', title: 'AI 解释含义', actionName: 'AI解释' },
    }

    return actions[action] || null
  }

  /**
   * 日志菜单的所有操作都是特殊操作（不走 ssh_execute_command_direct）
   */
  protected async handleSpecialAction(action: string): Promise<boolean> {
    switch (action) {
      case 'copy':
        await navigator.clipboard.writeText(this.currentLogContent)
        console.log('日志内容已复制')
        return true
      case 'ai-explain':
        await this.showModalWithAI()
        return true
      default:
        return false
    }
  }

  /**
   * 显示带有 AI 解释的模态框
   */
  private async showModalWithAI() {
    const contentEl = document.getElementById(`${this.prefix}-modal-content`)
    const explanationEl = document.getElementById(`${this.prefix}-ai-explanation`)
    const explanationContentEl = document.getElementById(`${this.prefix}-ai-explanation-content`)
    const titleEl = document.getElementById(`${this.prefix}-modal-title`)

    if (!contentEl || !explanationEl || !explanationContentEl || !titleEl) return

    titleEl.textContent = '日志详情'
    contentEl.textContent = this.currentLogContent
    explanationEl.style.display = 'block'
    explanationContentEl.textContent = '🤔 AI 正在分析日志内容...'

    if (this.modal) {
      this.modal.style.display = 'flex'
    }

    try {
      await aiService.explainLogStream(
        this.currentLogContent,
        undefined,
        (chunk) => {
          if (explanationContentEl.textContent?.startsWith('🤔')) {
            explanationContentEl.textContent = ''
          }
          explanationContentEl.textContent += chunk
        },
        () => {
          console.log('AI 分析完成')
        }
      )
    } catch (error) {
      explanationContentEl.innerHTML = `<span style="color: var(--error-color)">❌ 分析失败: ${error instanceof Error ? error.message : String(error)}</span><br><br><small>请检查 设置 -> AI 配置 是否正确。</small>`
    }
  }
}
