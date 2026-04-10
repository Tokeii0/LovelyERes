/**
 * 右键菜单基类
 * 所有右键菜单（进程、用户、服务、网络、防火墙、启动项、Cron、文件、日志、SFTP）的公共逻辑
 */

import { invoke } from '@tauri-apps/api/core'
import * as IconPark from '@icon-park/svg'

export interface MenuAction {
  command: string
  title: string
  actionName: string
}

export abstract class BaseContextMenu {
  protected contextMenu: HTMLElement | null = null
  protected modal: HTMLElement | null = null
  protected selectedUsername: string | null = null
  protected accounts: any[] = []
  /** 右键时捕获的行文本内容，用于 AI 解释 */
  protected lastRowText: string = ''

  /** 唯一前缀，用于生成不冲突的 DOM ID */
  protected readonly prefix: string

  constructor(prefix: string) {
    this.prefix = prefix
    this.createContextMenu()
    this.createModal()
    this.setupEventListeners()
    this.loadAccountList()
  }

  // ===== 子类必须实现 =====

  /** 返回菜单项的 HTML（不含外层容器和账号选择器） */
  protected abstract getMenuItemsHTML(): string

  /** 根据 action 字符串返回要执行的命令信息，或 null 表示未知 */
  protected abstract resolveAction(action: string): MenuAction | null

  // ===== 子类可选覆盖 =====

  /** 在 executeAction 之前做额外处理（如特殊的 copy-name 等），返回 true 表示已处理 */
  protected async handleSpecialAction(_action: string): Promise<boolean> {
    return false
  }

  // ===== 公共 API =====

  public async showContextMenu(x: number, y: number, ...entityArgs: any[]) {
    if (!this.contextMenu) return

    this.onShowContextMenu(...entityArgs)
    // 捕获条目信息用于 AI 解释
    this.lastRowText = entityArgs.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' | ')
    await this.loadAccountList()

    this.contextMenu.style.left = `${x}px`
    this.contextMenu.style.top = `${y}px`
    this.contextMenu.style.display = 'block'

    // 确保菜单不超出屏幕
    const rect = this.contextMenu.getBoundingClientRect()
    if (rect.right > window.innerWidth) {
      this.contextMenu.style.left = `${window.innerWidth - rect.width - 10}px`
    }
    if (rect.bottom > window.innerHeight) {
      this.contextMenu.style.top = `${window.innerHeight - rect.height - 10}px`
    }
  }

  /** 子类在 showContextMenu 时保存实体信息（pid, service name 等） */
  protected abstract onShowContextMenu(...args: any[]): void

  // ===== DOM 创建 =====

  private createContextMenu() {
    const menu = document.createElement('div')
    menu.id = `${this.prefix}-context-menu`
    menu.style.cssText = `
      position: fixed;
      display: none;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 10000;
      min-width: 200px;
      padding: var(--spacing-xs) 0;
    `

    const menuId = `${this.prefix}-context-menu`
    const selectId = `${this.prefix}-username-select`

    menu.innerHTML = `
      <div class="account-selector" style="
        padding: var(--spacing-sm);
        border-bottom: 1px solid var(--border-color);
        margin-bottom: var(--spacing-xs);
      ">
        <div style="
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: 12px;
          color: var(--text-secondary);
        ">
          <span>${IconPark.User({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
          <span>执行账号:</span>
          <select id="${selectId}" style="
            flex: 1;
            padding: 4px 8px;
            border: 1px solid var(--border-color);
            border-radius: var(--border-radius-sm);
            background: var(--bg-tertiary);
            color: var(--text-primary);
            font-size: 12px;
            outline: none;
            cursor: pointer;
          ">
            <option value="">默认账号</option>
          </select>
        </div>
      </div>
      ${this.getMenuItemsHTML()}
      <div class="menu-divider" style="height:1px;background:var(--border-color);margin:4px 8px;"></div>
      <div class="menu-item" data-action="__ai_explain_row__">
        <span>AI 解释该条目</span>
      </div>
    `

    // 添加样式
    const style = document.createElement('style')
    style.textContent = `
      #${menuId} .menu-item {
        padding: 8px 12px;
        cursor: pointer;
        font-size: 13px;
        color: var(--text-primary);
        transition: background-color 0.2s ease;
        position: relative;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      #${menuId} .menu-item:hover {
        background: var(--bg-tertiary);
      }
      #${menuId} .menu-label {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #${menuId} .menu-label svg {
        flex-shrink: 0;
      }
      #${menuId} .menu-parent {
        position: relative;
      }
      #${menuId} .menu-parent .arrow {
        font-size: 10px;
        color: var(--text-secondary);
        margin-left: 8px;
      }
      #${menuId} .submenu {
        display: none;
        position: absolute;
        left: 100%;
        top: 0;
        background: var(--bg-secondary);
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        min-width: 200px;
        z-index: 10001;
      }
      #${menuId} .menu-parent:hover > .submenu {
        display: block;
      }
      #${menuId} .submenu .menu-item {
        padding: 8px 16px;
      }
      #${menuId} .menu-divider {
        height: 1px;
        background: var(--border-color);
        margin: 4px 0;
      }
    `
    document.head.appendChild(style)
    document.body.appendChild(menu)
    this.contextMenu = menu
  }

  private createModal() {
    const modal = document.createElement('div')
    modal.id = `${this.prefix}-detail-modal`
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 10001;
    `

    modal.innerHTML = `
      <div class="modal-content" style="
        background: var(--bg-primary);
        border-radius: var(--border-radius);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        max-width: 900px;
        max-height: 85vh;
        width: 90%;
        display: flex;
        flex-direction: column;
      ">
        <div class="modal-header" style="
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--spacing-md);
        ">
          <h3 id="${this.prefix}-modal-title" style="margin: 0; color: var(--text-primary); font-size: 16px; flex: 1;"></h3>
          <button id="${this.prefix}-ai-explain-btn" class="modern-btn secondary" style="
            padding: 6px 12px;
            font-size: 13px;
            gap: 6px;
          ">
            ${IconPark.Brain({ theme: 'outline', size: '16', fill: 'currentColor' })}
            <span>AI解释</span>
          </button>
          <button id="${this.prefix}-modal-close" style="
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: var(--text-secondary);
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: var(--border-radius-sm);
          ">&times;</button>
        </div>
        <div class="modal-body" style="
          padding: var(--spacing-md);
          overflow-y: auto;
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: var(--spacing-md);
        ">
          <div id="${this.prefix}-modal-content" style="
            font-family: var(--font-mono);
            font-size: 12px;
            color: var(--text-primary);
            white-space: pre-wrap;
            word-break: break-all;
            padding: var(--spacing-sm);
            background: var(--bg-secondary);
            border-radius: var(--border-radius-sm);
            border: 1px solid var(--border-color);
          "></div>
          <div id="${this.prefix}-ai-explanation" style="
            display: none;
            padding: var(--spacing-md);
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%);
            border-radius: var(--border-radius-sm);
            border: 1px solid rgba(102, 126, 234, 0.2);
          ">
            <div style="
              display: flex;
              align-items: center;
              gap: 8px;
              margin-bottom: var(--spacing-sm);
              color: var(--text-primary);
              font-weight: 600;
            ">
              ${IconPark.Brain({ theme: 'outline', size: '18', fill: 'currentColor' })}
              <span>AI解释</span>
            </div>
            <div id="${this.prefix}-ai-explanation-content" style="
              font-size: 13px;
              line-height: 1.6;
              color: var(--text-primary);
              white-space: pre-wrap;
              word-break: break-word;
            "></div>
          </div>
        </div>
      </div>
    `

    document.body.appendChild(modal)
    this.modal = modal
  }

  // ===== 事件处理 =====

  private setupEventListeners() {
    const selectId = `${this.prefix}-username-select`

    // 账号选择器变化事件
    document.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement
      if (target.id === selectId) {
        this.selectedUsername = target.value || null
        console.log('👤 切换执行账号:', this.selectedUsername || '默认')
      }
    })

    // 鼠标悬停在父菜单项上时，调整二级菜单位置
    this.contextMenu?.querySelectorAll('.menu-parent').forEach(parent => {
      parent.addEventListener('mouseenter', () => {
        const submenu = parent.querySelector('.submenu') as HTMLElement
        if (submenu) {
          submenu.style.top = '0'
          submenu.style.bottom = 'auto'

          setTimeout(() => {
            const submenuRect = submenu.getBoundingClientRect()
            const windowHeight = window.innerHeight

            if (submenuRect.bottom > windowHeight) {
              const overflow = submenuRect.bottom - windowHeight + 10
              submenu.style.top = `-${overflow}px`

              const newRect = submenu.getBoundingClientRect()
              if (newRect.top < 0) {
                submenu.style.top = 'auto'
                submenu.style.bottom = '0'
              }
            }
          }, 10)
        }
      })
    })

    // 点击菜单项
    this.contextMenu?.addEventListener('click', (e) => {
      const target = e.target as HTMLElement
      const menuItem = target.closest('.menu-item[data-action]') as HTMLElement
      if (menuItem) {
        const action = menuItem.getAttribute('data-action')
        if (action) {
          console.log(`执行操作: ${action}`)
          this.executeAction(action)
        }
        this.hideContextMenu()
      }
    })

    // 点击模态框外部关闭
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hideModal()
      }
    })

    // 关闭按钮
    document.getElementById(`${this.prefix}-modal-close`)?.addEventListener('click', () => {
      this.hideModal()
    })

    // AI解释按钮
    document.getElementById(`${this.prefix}-ai-explain-btn`)?.addEventListener('click', () => {
      this.explainWithAI()
    })

    // 点击其他地方关闭菜单
    document.addEventListener('click', (e) => {
      if (this.contextMenu && this.contextMenu.style.display !== 'none') {
        if (!this.contextMenu.contains(e.target as Node)) {
          this.hideContextMenu()
        }
      }
    })

    // ESC键关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideContextMenu()
        this.hideModal()
      }
    })
  }

  // ===== 账号管理 =====

  protected async loadAccountList() {
    try {
      const connections = await invoke('load_ssh_connections') as any[]
      if (connections.length === 0) return

      const connection = connections[0]
      this.accounts = connection.accounts || []

      const select = document.getElementById(`${this.prefix}-username-select`) as HTMLSelectElement
      if (!select) return

      select.innerHTML = '<option value="">默认账号</option>'
      this.accounts.forEach((account: any) => {
        const option = document.createElement('option')
        option.value = account.username
        option.textContent = `${account.username}${account.description ? ` (${account.description})` : ''}${account.is_default ? ' [默认]' : ''}`
        select.appendChild(option)
      })
    } catch (error) {
      console.error('❌ 加载账号列表失败:', error)
    }
  }

  // ===== 菜单/模态框控制 =====

  protected hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none'
    }
  }

  protected showModal(title: string, content: string) {
    if (!this.modal) return

    const titleEl = document.getElementById(`${this.prefix}-modal-title`)
    const contentEl = document.getElementById(`${this.prefix}-modal-content`)
    const explanationEl = document.getElementById(`${this.prefix}-ai-explanation`)

    if (titleEl) titleEl.textContent = title
    if (contentEl) contentEl.textContent = content

    if (explanationEl) {
      explanationEl.style.display = 'none'
      const explanationContentEl = document.getElementById(`${this.prefix}-ai-explanation-content`)
      if (explanationContentEl) {
        explanationContentEl.textContent = ''
      }
    }

    this.modal.style.display = 'flex'
  }

  protected hideModal() {
    if (this.modal) {
      this.modal.style.display = 'none'

      const explanationEl = document.getElementById(`${this.prefix}-ai-explanation`)
      if (explanationEl) {
        explanationEl.style.display = 'none'
        const explanationContentEl = document.getElementById(`${this.prefix}-ai-explanation-content`)
        if (explanationContentEl) {
          explanationContentEl.textContent = ''
        }
      }
    }
  }

  // ===== 命令执行 =====

  protected async executeAction(action: string) {
    // AI 解释该条目 — 通用处理
    if (action === '__ai_explain_row__') {
      await this.aiExplainRow()
      return
    }

    // 先检查子类是否有特殊处理
    const handled = await this.handleSpecialAction(action)
    if (handled) return

    const resolved = this.resolveAction(action)
    if (!resolved) {
      console.warn(`未知操作: ${action}`)
      this.showModal('错误', `未知操作: ${action}`)
      return
    }

    const { command, title, actionName } = resolved

    try {
      const userInfo = this.selectedUsername ? ` (用户: ${this.selectedUsername})` : ''
      this.showModal(title, `⏳ 正在执行: ${actionName}${userInfo}...\n\n命令: ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`)

      const result = await invoke('ssh_execute_command_direct', {
        command,
        username: this.selectedUsername
      }) as { output: string; exit_code: number }

      this.showModal(title, result.output || '✓ 命令执行完成，无输出')
    } catch (error) {
      this.showModal(title, `❌ 执行失败: ${error}`)
    }
  }

  // ===== AI 解释 =====

  protected async explainWithAI() {
    const contentEl = document.getElementById(`${this.prefix}-modal-content`)
    const explanationEl = document.getElementById(`${this.prefix}-ai-explanation`)
    const explanationContentEl = document.getElementById(`${this.prefix}-ai-explanation-content`)
    const titleEl = document.getElementById(`${this.prefix}-modal-title`)

    if (!contentEl || !explanationEl || !explanationContentEl || !titleEl) return

    const content = contentEl.textContent || ''
    const title = titleEl.textContent || ''

    explanationEl.style.display = 'block'
    explanationContentEl.textContent = '🤔 AI正在分析...'

    try {
      // 使用统一的 aiService
      const { aiService } = await import('../../ai/aiService')

      if (!aiService.isConfigured()) {
        throw new Error('请先在设置中配置 AI 服务')
      }

      explanationContentEl.textContent = ''

      const prompt = `标题：${title}\n\n内容：\n${content}\n\n请提供：\n1. 信息概要\n2. 关键发现\n3. 安全评估\n4. 建议操作`

      await aiService.explainLogStream(
        prompt,
        '右键菜单 AI 分析',
        (chunk: string) => {
          explanationContentEl.textContent += chunk
        }
      )
    } catch (error) {
      explanationContentEl.textContent = `❌ AI分析失败: ${error}\n\n提示：请在设置中配置AI服务。`
    }
  }

  // ===== AI 解释该条目（右键直接调用） =====

  protected async aiExplainRow() {
    const rowData = this.lastRowText || '(无条目数据)'
    const menuTitle = this.prefix.replace(/-/g, ' ')

    this.showModal('AI 分析', '正在分析...')

    try {
      const { aiService } = await import('../../ai/aiService')
      if (!aiService.isConfigured()) {
        this.showModal('AI 分析', '请先在设置中配置 AI 服务')
        return
      }

      const contentEl = document.getElementById(`${this.prefix}-modal-content`)
      if (contentEl) contentEl.textContent = ''

      const prompt = `你是 Linux 安全应急响应专家。请分析以下系统条目信息:\n\n类型: ${menuTitle}\n条目数据: ${rowData}\n\n请简要说明:\n1. 该条目的含义\n2. 是否存在安全风险\n3. 如果有风险，给出处置建议`

      await aiService.explainLogStream(
        prompt,
        'AI 解释条目',
        (chunk: string) => {
          if (contentEl) contentEl.textContent += chunk
        },
        (fullText: string) => {
          // 记录到 AI 历史
          import('../../ai/aiHistoryManager').then(({ aiHistoryManager }) => {
            aiHistoryManager.addRecord({
              question: `[${menuTitle}] ${rowData}`,
              answer: fullText,
              source: 'context-menu',
            })
          }).catch(() => {})
        }
      )
    } catch (error) {
      this.showModal('AI 分析', `分析失败: ${error}`)
    }
  }
}
