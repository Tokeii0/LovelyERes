import { invoke } from '@tauri-apps/api/core'
import * as IconPark from '@icon-park/svg'
import { vipGuard } from '../auth/vipGuard'

/**
 * 防火墙规则右键菜单管理器
 */
export class FirewallContextMenu {
  private contextMenu: HTMLElement | null = null
  private modal: HTMLElement | null = null
  private currentRule: {
    chain: string
    target: string
    protocol: string
    source: string
    destination: string
    options: string
  } | null = null
  private selectedUsername: string = ''
  private accounts: any[] = []

  constructor() {
    this.createContextMenu()
    this.createModal()
    this.setupEventListeners()
    this.loadAccountList()
  }

  /**
   * 创建右键菜单
   */
  private createContextMenu() {
    const menu = document.createElement('div')
    menu.id = 'firewall-context-menu'
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

    menu.innerHTML = `
      <div class="menu-account-selector" style="
        padding: 8px 12px;
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-tertiary);
      ">
        <label style="
          display: block;
          font-size: 11px;
          color: var(--text-secondary);
          margin-bottom: 4px;
        ">执行账号:</label>
        <select id="firewall-account-select" style="
          width: 100%;
          padding: 4px 8px;
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 4px;
          color: var(--text-primary);
          font-size: 12px;
          outline: none;
          cursor: pointer;
        ">
          <option value="">默认账号</option>
        </select>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Info({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>基本信息</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="rule-details">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>规则详情</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-rule">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制规则</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-source">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制源地址</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-destination">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制目标地址</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.SettingConfig({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>规则管理</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="list-all-rules">
            <span class="menu-label">
              ${IconPark.ListTwo({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看所有规则</span>
            </span>
          </div>
          <div class="menu-item" data-action="list-chain-rules">
            <span class="menu-label">
              ${IconPark.ListBottom({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看链规则</span>
            </span>
          </div>
          <div class="menu-item" data-action="save-rules">
            <span class="menu-label">
              ${IconPark.Save({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>保存规则</span>
            </span>
          </div>
          <div class="menu-item" data-action="restore-rules">
            <span class="menu-label">
              ${IconPark.Return({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>恢复规则</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Protection({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>IP管理</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="block-source-ip">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>阻止源IP</span>
            </span>
          </div>
          <div class="menu-item" data-action="allow-source-ip">
            <span class="menu-label">
              ${IconPark.Unlock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>允许源IP</span>
            </span>
          </div>
          <div class="menu-item" data-action="block-dest-ip">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>阻止目标IP</span>
            </span>
          </div>
          <div class="menu-item" data-action="ip-whitelist">
            <span class="menu-label">
              ${IconPark.CheckOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>加入白名单</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.PlugOne({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>端口管理</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="open-port">
            <span class="menu-label">
              ${IconPark.Unlock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>开放端口</span>
            </span>
          </div>
          <div class="menu-item" data-action="close-port">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>关闭端口</span>
            </span>
          </div>
          <div class="menu-item" data-action="port-forward">
            <span class="menu-label">
              ${IconPark.ShareOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>端口转发</span>
            </span>
          </div>
          <div class="menu-item" data-action="list-open-ports">
            <span class="menu-label">
              ${IconPark.ListTwo({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看开放端口</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Analysis({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>防火墙诊断</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="firewall-status">
            <span class="menu-label">
              ${IconPark.CheckOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>防火墙状态</span>
            </span>
          </div>
          <div class="menu-item" data-action="rule-statistics">
            <span class="menu-label">
              ${IconPark.ChartLine({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>规则统计</span>
            </span>
          </div>
          <div class="menu-item" data-action="recent-logs">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>最近日志</span>
            </span>
          </div>
          <div class="menu-item" data-action="test-rule">
            <span class="menu-label">
              ${IconPark.Experiment({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>测试规则</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Shield({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>安全策略</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="default-policy">
            <span class="menu-label">
              ${IconPark.SettingConfig({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看默认策略</span>
            </span>
          </div>
          <div class="menu-item" data-action="set-drop-policy">
            <span class="menu-label">
              ${IconPark.CloseOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>设置拒绝策略</span>
            </span>
          </div>
          <div class="menu-item" data-action="set-accept-policy">
            <span class="menu-label">
              ${IconPark.CheckOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>设置允许策略</span>
            </span>
          </div>
          <div class="menu-item" data-action="rate-limit">
            <span class="menu-label">
              ${IconPark.Speed({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>流量限制</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-divider"></div>

      <div class="menu-item" data-action="delete-rule">
        <span class="menu-label">
          ${IconPark.Delete({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>删除规则</span>
        </span>
      </div>

      <div class="menu-item" data-action="refresh">
        <span class="menu-label">
          ${IconPark.Refresh({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>刷新规则列表</span>
        </span>
      </div>
    `

    // 添加样式
    const style = document.createElement('style')
    style.textContent = `
      #firewall-context-menu .menu-item {
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
      #firewall-context-menu .menu-item:hover {
        background: var(--bg-tertiary);
      }
      #firewall-context-menu .menu-label {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #firewall-context-menu .menu-label svg {
        flex-shrink: 0;
      }
      #firewall-context-menu .menu-parent {
        position: relative;
      }
      #firewall-context-menu .menu-parent .arrow {
        font-size: 10px;
        color: var(--text-secondary);
        margin-left: 8px;
      }
      #firewall-context-menu .submenu {
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
      #firewall-context-menu .menu-parent:hover > .submenu {
        display: block;
      }
      #firewall-context-menu .submenu .menu-item {
        padding: 8px 16px;
      }
      #firewall-context-menu .menu-divider {
        height: 1px;
        background: var(--border-color);
        margin: 4px 0;
      }
    `
    document.head.appendChild(style)

    document.body.appendChild(menu)
    this.contextMenu = menu
  }

  /**
   * 创建模态框
   */
  private createModal() {
    const modal = document.createElement('div')
    modal.id = 'firewall-detail-modal'
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
          <h3 id="firewall-modal-title" style="margin: 0; color: var(--text-primary); font-size: 16px; flex: 1;"></h3>
          <button id="firewall-ai-explain-btn" class="modern-btn secondary" style="
            padding: 6px 12px;
            font-size: 13px;
            gap: 6px;
          ">
            ${IconPark.Brain({ theme: 'outline', size: '16', fill: 'currentColor' })}
            <span>AI解释</span>
          </button>
          <button id="firewall-modal-close" style="
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
          <div id="firewall-modal-content" style="
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
          <div id="firewall-ai-explanation" style="
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
            <div id="firewall-ai-explanation-content" style="
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

  /**
   * 加载账号列表
   */
  private async loadAccountList() {
    try {
      const connections = await invoke('load_ssh_connections') as any[]
      if (connections.length === 0) {
        console.log('📋 没有可用的SSH连接')
        return
      }

      // 假设使用第一个连接的账号列表（在实际应用中，应该获取当前活动连接）
      const connection = connections[0]
      this.accounts = connection.accounts || []

      // 更新账号下拉列表
      const select = document.getElementById('firewall-account-select') as HTMLSelectElement
      if (!select) {
        console.warn('⚠️ 防火墙账号选择下拉框未找到')
        return
      }

      // 清空现有选项
      select.innerHTML = '<option value="">默认账号</option>'

      // 添加账号选项
      this.accounts.forEach((account: any) => {
        const option = document.createElement('option')
        option.value = account.username
        option.textContent = `${account.username}${account.description ? ` (${account.description})` : ''}${account.is_default ? ' [默认]' : ''}`
        select.appendChild(option)
      })

      console.log(`✅ 防火墙右键菜单加载了 ${this.accounts.length} 个账号`)
    } catch (error) {
      console.error('❌ 防火墙右键菜单加载账号列表失败:', error)
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    // 账号选择下拉框change事件
    document.addEventListener('change', (e) => {
      const target = e.target as HTMLElement
      if (target.id === 'firewall-account-select') {
        const select = target as HTMLSelectElement
        this.selectedUsername = select.value
        console.log('👤 防火墙菜单选择账号:', this.selectedUsername || '默认账号')
      }
    })

    // 鼠标悬停在父菜单项上时，调整二级菜单位置
    this.contextMenu?.querySelectorAll('.menu-parent').forEach(parent => {
      parent.addEventListener('mouseenter', () => {
        const submenu = parent.querySelector('.submenu') as HTMLElement
        if (submenu) {
          // 重置位置
          submenu.style.top = '0'
          submenu.style.bottom = 'auto'

          // 等待submenu显示后再计算位置
          setTimeout(() => {
            const submenuRect = submenu.getBoundingClientRect()
            const windowHeight = window.innerHeight

            // 如果二级菜单底部超出窗口
            if (submenuRect.bottom > windowHeight) {
              // 计算需要向上移动的距离
              const overflow = submenuRect.bottom - windowHeight + 10 // 10px缓冲
              submenu.style.top = `-${overflow}px`

              // 如果向上移动后顶部还是超出窗口，则固定在窗口底部
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
      // 查找最近的带有data-action属性的menu-item
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

    // 关闭按钮
    document.getElementById('firewall-modal-close')?.addEventListener('click', () => {
      this.hideModal()
    })

    // AI解释按钮
    document.getElementById('firewall-ai-explain-btn')?.addEventListener('click', () => {
      this.explainWithAI()
    })

    // 点击模态框外部关闭
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.hideModal()
      }
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

  /**
   * 显示右键菜单
   */
  async showContextMenu(x: number, y: number, rule: {
    chain: string
    target: string
    protocol: string
    source: string
    destination: string
    options: string
  }) {
    if (!this.contextMenu) return

    // VIP 权限检查
    if (!vipGuard.requireVIP('防火墙规则右键菜单')) {
      return
    }

    this.currentRule = rule

    // 重新加载账号列表
    await this.loadAccountList()

    // 调整位置，确保菜单不会超出屏幕
    const menuWidth = 200
    const menuHeight = 600
    const adjustedX = Math.min(x, window.innerWidth - menuWidth)
    const adjustedY = Math.min(y, window.innerHeight - menuHeight)

    this.contextMenu.style.left = `${adjustedX}px`
    this.contextMenu.style.top = `${adjustedY}px`
    this.contextMenu.style.display = 'block'
  }

  /**
   * 隐藏右键菜单
   */
  private hideContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.style.display = 'none'
    }
  }

  /**
   * 显示模态框
   */
  private showModal(title: string, content: string) {
    if (!this.modal) return

    const titleEl = document.getElementById('firewall-modal-title')
    const contentEl = document.getElementById('firewall-modal-content')
    const explanationEl = document.getElementById('firewall-ai-explanation')

    if (titleEl) titleEl.textContent = title
    if (contentEl) contentEl.textContent = content

    // 隐藏AI解释区域（每次显示新内容时重置）
    if (explanationEl) {
      explanationEl.style.display = 'none'
      const explanationContentEl = document.getElementById('firewall-ai-explanation-content')
      if (explanationContentEl) {
        explanationContentEl.textContent = ''
      }
    }

    this.modal.style.display = 'flex'
  }

  /**
   * 隐藏模态框
   */
  private hideModal() {
    if (this.modal) {
      this.modal.style.display = 'none'

      // 隐藏AI解释区域
      const explanationEl = document.getElementById('firewall-ai-explanation')
      if (explanationEl) {
        explanationEl.style.display = 'none'
        const explanationContentEl = document.getElementById('firewall-ai-explanation-content')
        if (explanationContentEl) {
          explanationContentEl.textContent = ''
        }
      }
    }
  }

  /**
   * 执行操作
   */
  private async executeAction(action: string) {
    if (!this.currentRule) return

    const { chain, target, protocol, source, destination, options } = this.currentRule

    let command = ''
    let title = ''
    let actionName = ''

    switch (action) {
      // 基本信息
      case 'rule-details':
        title = '防火墙规则详情'
        actionName = '查看规则详情'
        this.showModal(title, `链: ${chain}\n目标: ${target}\n协议: ${protocol}\n源地址: ${source}\n目标地址: ${destination}\n选项: ${options}`)
        return

      case 'copy-rule':
        navigator.clipboard.writeText(`${chain} ${target} ${protocol} ${source} ${destination} ${options}`)
        this.showModal('复制成功', `已复制规则: ${chain} ${target} ${protocol}`)
        return

      case 'copy-source':
        navigator.clipboard.writeText(source)
        this.showModal('复制成功', `已复制源地址: ${source}`)
        return

      case 'copy-destination':
        navigator.clipboard.writeText(destination)
        this.showModal('复制成功', `已复制目标地址: ${destination}`)
        return

      // 规则管理
      case 'list-all-rules':
        command = `if command -v iptables >/dev/null 2>&1; then echo "=== iptables规则 ==="; iptables -L -n -v --line-numbers; elif command -v firewall-cmd >/dev/null 2>&1; then echo "=== firewalld规则 ==="; firewall-cmd --list-all; elif command -v ufw >/dev/null 2>&1; then echo "=== UFW规则 ==="; ufw status verbose; else echo "⚠️ 未找到防火墙工具"; fi`
        title = '所有防火墙规则'
        actionName = '查看所有规则'
        break

      case 'list-chain-rules':
        command = `if command -v iptables >/dev/null 2>&1; then echo "=== ${chain} 链规则 ==="; iptables -L ${chain} -n -v --line-numbers; else echo "⚠️ iptables命令不可用"; fi`
        title = `${chain} 链规则`
        actionName = '查看链规则'
        break

      case 'save-rules':
        command = `if command -v iptables-save >/dev/null 2>&1; then iptables-save > /etc/iptables/rules.v4 2>/dev/null && echo "✓ iptables规则已保存" || echo "⚠️ 保存失败，需要root权限"; elif command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --runtime-to-permanent && echo "✓ firewalld规则已保存"; elif command -v ufw >/dev/null 2>&1; then echo "✓ UFW规则自动保存"; else echo "⚠️ 未找到防火墙工具"; fi`
        title = '保存防火墙规则'
        actionName = '保存规则'
        break

      case 'restore-rules':
        command = `if command -v iptables-restore >/dev/null 2>&1; then iptables-restore < /etc/iptables/rules.v4 2>/dev/null && echo "✓ iptables规则已恢复" || echo "⚠️ 恢复失败，需要root权限"; elif command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --reload && echo "✓ firewalld规则已重载"; else echo "⚠️ 未找到防火墙工具"; fi`
        title = '恢复防火墙规则'
        actionName = '恢复规则'
        break

      // IP管理
      case 'block-source-ip':
        command = `if command -v iptables >/dev/null 2>&1; then echo "阻止源IP: ${source}"; echo "命令: iptables -A INPUT -s ${source} -j DROP"; echo "⚠️ 需要root权限执行"; else echo "⚠️ iptables命令不可用"; fi`
        title = `阻止源IP - ${source}`
        actionName = '阻止源IP'
        break

      case 'allow-source-ip':
        command = `if command -v iptables >/dev/null 2>&1; then echo "允许源IP: ${source}"; echo "命令: iptables -D INPUT -s ${source} -j DROP"; echo "⚠️ 需要root权限执行"; else echo "⚠️ iptables命令不可用"; fi`
        title = `允许源IP - ${source}`
        actionName = '允许源IP'
        break

      case 'block-dest-ip':
        command = `if command -v iptables >/dev/null 2>&1; then echo "阻止目标IP: ${destination}"; echo "命令: iptables -A OUTPUT -d ${destination} -j DROP"; echo "⚠️ 需要root权限执行"; else echo "⚠️ iptables命令不可用"; fi`
        title = `阻止目标IP - ${destination}`
        actionName = '阻止目标IP'
        break

      case 'ip-whitelist':
        command = `if command -v iptables >/dev/null 2>&1; then echo "加入白名单: ${source}"; echo "命令: iptables -I INPUT -s ${source} -j ACCEPT"; echo "⚠️ 需要root权限执行"; else echo "⚠️ iptables命令不可用"; fi`
        title = `加入白名单 - ${source}`
        actionName = '加入白名单'
        break

      // 端口管理
      case 'open-port':
        command = `port=$(echo "${options}" | grep -oP 'dpt:\\K[0-9]+' || echo "未知"); if [ "$port" != "未知" ]; then if command -v iptables >/dev/null 2>&1; then echo "开放端口: $port"; echo "命令: iptables -A INPUT -p ${protocol} --dport $port -j ACCEPT"; echo "⚠️ 需要root权限执行"; elif command -v firewall-cmd >/dev/null 2>&1; then echo "命令: firewall-cmd --add-port=$port/${protocol} --permanent"; echo "⚠️ 需要root权限执行"; elif command -v ufw >/dev/null 2>&1; then echo "命令: ufw allow $port/${protocol}"; echo "⚠️ 需要root权限执行"; else echo "⚠️ 未找到防火墙工具"; fi; else echo "⚠️ 无法从规则中提取端口信息"; fi`
        title = '开放端口'
        actionName = '开放端口'
        break

      case 'close-port':
        command = `port=$(echo "${options}" | grep -oP 'dpt:\\K[0-9]+' || echo "未知"); if [ "$port" != "未知" ]; then if command -v iptables >/dev/null 2>&1; then echo "关闭端口: $port"; echo "命令: iptables -A INPUT -p ${protocol} --dport $port -j DROP"; echo "⚠️ 需要root权限执行"; elif command -v firewall-cmd >/dev/null 2>&1; then echo "命令: firewall-cmd --remove-port=$port/${protocol} --permanent"; echo "⚠️ 需要root权限执行"; elif command -v ufw >/dev/null 2>&1; then echo "命令: ufw deny $port/${protocol}"; echo "⚠️ 需要root权限执行"; else echo "⚠️ 未找到防火墙工具"; fi; else echo "⚠️ 无法从规则中提取端口信息"; fi`
        title = '关闭端口'
        actionName = '关闭端口'
        break

      case 'port-forward':
        command = `echo "端口转发配置"; echo "⚠️ 此功能需要root权限"; echo ""; echo "示例命令:"; echo "iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080"`
        title = '端口转发'
        actionName = '端口转发'
        break

      case 'list-open-ports':
        command = `if command -v iptables >/dev/null 2>&1; then echo "=== 开放的端口 ==="; iptables -L INPUT -n | grep ACCEPT | grep -oP 'dpt:\\K[0-9]+' | sort -u; elif command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --list-ports; elif command -v ufw >/dev/null 2>&1; then ufw status | grep ALLOW; else echo "⚠️ 未找到防火墙工具"; fi`
        title = '开放的端口'
        actionName = '查看开放端口'
        break

      // 防火墙诊断
      case 'firewall-status':
        command = `if command -v iptables >/dev/null 2>&1; then echo "=== iptables状态 ==="; iptables -L -n | head -20; elif command -v firewall-cmd >/dev/null 2>&1; then echo "=== firewalld状态 ==="; firewall-cmd --state; firewall-cmd --get-active-zones; elif command -v ufw >/dev/null 2>&1; then echo "=== UFW状态 ==="; ufw status verbose; else echo "⚠️ 未找到防火墙工具"; fi`
        title = '防火墙状态'
        actionName = '查看防火墙状态'
        break

      case 'rule-statistics':
        command = `if command -v iptables >/dev/null 2>&1; then echo "=== 规则统计 ==="; echo "总规则数: $(iptables -L | grep -c '^Chain\\|^target')"; echo ""; echo "各链规则数:"; for chain in INPUT OUTPUT FORWARD; do echo "$chain: $(iptables -L $chain -n | grep -c '^ACCEPT\\|^DROP\\|^REJECT')"; done; else echo "⚠️ iptables命令不可用"; fi`
        title = '规则统计'
        actionName = '规则统计'
        break

      case 'recent-logs':
        command = `echo "=== 防火墙最近日志 ==="; echo ""; journalctl -u firewalld -n 50 2>/dev/null || journalctl | grep -i firewall | tail -50 2>/dev/null || grep -i firewall /var/log/syslog | tail -50 2>/dev/null || echo "⚠️ 无法读取日志"`
        title = '防火墙日志'
        actionName = '查看日志'
        break

      case 'test-rule':
        command = `echo "=== 测试规则 ==="; echo ""; echo "规则: ${chain} ${target} ${protocol} ${source} ${destination}"; echo ""; echo "测试连接..."; echo "⚠️ 实际测试需要根据具体规则进行"`
        title = '测试规则'
        actionName = '测试规则'
        break

      // 安全策略
      case 'default-policy':
        command = `if command -v iptables >/dev/null 2>&1; then echo "=== 默认策略 ==="; iptables -L | grep "Chain" | grep "policy"; else echo "⚠️ iptables命令不可用"; fi`
        title = '默认策略'
        actionName = '查看默认策略'
        break

      case 'set-drop-policy':
        command = `echo "设置拒绝策略"; echo ""; echo "命令:"; echo "iptables -P INPUT DROP"; echo "iptables -P OUTPUT DROP"; echo "iptables -P FORWARD DROP"; echo ""; echo "⚠️ 需要root权限执行"`
        title = '设置拒绝策略'
        actionName = '设置拒绝策略'
        break

      case 'set-accept-policy':
        command = `echo "设置允许策略"; echo ""; echo "命令:"; echo "iptables -P INPUT ACCEPT"; echo "iptables -P OUTPUT ACCEPT"; echo "iptables -P FORWARD ACCEPT"; echo ""; echo "⚠️ 需要root权限执行"`
        title = '设置允许策略'
        actionName = '设置允许策略'
        break

      case 'rate-limit':
        command = `echo "流量限制示例"; echo ""; echo "限制连接速率:"; echo "iptables -A INPUT -p tcp --dport 80 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT"; echo ""; echo "⚠️ 需要root权限执行"`
        title = '流量限制'
        actionName = '流量限制'
        break

      // 其他操作
      case 'delete-rule':
        command = `echo "删除规则"; echo ""; echo "⚠️ 此操作需要root权限"; echo ""; echo "示例命令:"; echo "iptables -D ${chain} <规则编号>"`
        title = '删除规则'
        actionName = '删除规则'
        break

      case 'refresh':
        command = `echo "刷新防火墙规则列表..."; if command -v iptables >/dev/null 2>&1; then iptables -L -n -v --line-numbers; elif command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --list-all; elif command -v ufw >/dev/null 2>&1; then ufw status verbose; else echo "⚠️ 未找到防火墙工具"; fi`
        title = '刷新规则列表'
        actionName = '刷新规则列表'
        break

      default:
        console.warn(`未知操作: ${action}`)
        this.showModal('错误', `未知操作: ${action}`)
        return
    }

    // 如果没有设置actionName，使用默认值
    if (!actionName) {
      actionName = '执行命令'
    }

    try {
      // 显示"正在执行"提示
      const accountInfo = this.selectedUsername ? ` (账号: ${this.selectedUsername})` : ''
      this.showModal(title, `⏳ 正在执行: ${actionName}${accountInfo}...\n\n命令: ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`)

      // 执行命令
      const params: any = { command }
      if (this.selectedUsername) {
        params.username = this.selectedUsername
        console.log('👤 使用账号执行防火墙命令:', this.selectedUsername)
      }
      const result = await invoke('ssh_execute_command_direct', params) as { output: string; exit_code: number }

      // 显示结果
      this.showModal(title, result.output || '✓ 命令执行完成，无输出')
    } catch (error) {
      this.showModal(title, `❌ 执行失败: ${error}`)
    }
  }

  /**
   * 使用AI解释当前内容
   */
  private async explainWithAI() {
    // VIP 权限检查
    if (!vipGuard.requireVIP('AI 解释功能')) {
      return
    }

    const contentEl = document.getElementById('firewall-modal-content')
    const explanationEl = document.getElementById('firewall-ai-explanation')
    const explanationContentEl = document.getElementById('firewall-ai-explanation-content')
    const titleEl = document.getElementById('firewall-modal-title')

    if (!contentEl || !explanationEl || !explanationContentEl || !titleEl) return

    const content = contentEl.textContent || ''
    const title = titleEl.textContent || ''

    // 显示AI解释区域
    explanationEl.style.display = 'block'
    explanationContentEl.textContent = '🤔 AI正在分析...'

    try {
      // 获取AI设置
      const settingsContent = await invoke('read_settings_file') as string
      let settings: any = {}

      if (settingsContent) {
        settings = JSON.parse(settingsContent)
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
        }
      }

      if (!settings.ai || !settings.ai.currentProvider) {
        throw new Error('AI配置异常，请在设置中配置AI')
      }

      const currentProvider = settings.ai.currentProvider
      const providerConfig = settings.ai.providers[currentProvider]

      if (!providerConfig) {
        throw new Error('AI提供商配置不存在')
      }

      if (!providerConfig.apiKey && currentProvider !== 'ollama') {
        throw new Error('请在设置中配置AI API Key')
      }

      // 构建提示词
      const systemPrompt = `你是一个网络安全和防火墙配置专家，擅长分析防火墙规则、iptables、firewalld等配置。请用简洁专业的语言解释用户提供的信息，重点关注安全风险和配置建议。

请分析并解释以下防火墙信息：

标题：${title}

内容：
${content}

请提供：
1. 信息概要
2. 关键发现
3. 安全评估（如果适用）
4. 配置建议（如果适用）`

      // 清空"正在分析"提示
      explanationContentEl.textContent = ''

      // 调用AI API，使用真正的流式输出
      await this.callAIAPI(systemPrompt, providerConfig, (chunk: string) => {
        // 实时更新UI
        explanationContentEl.textContent += chunk
      })
    } catch (error) {
      explanationContentEl.textContent = `❌ AI解释失败: ${error}\n\n提示：请在设置中配置AI，或者检查AI服务是否可用。`
    }
  }

  /**
   * 调用AI API（流式输出）
   */
  private async callAIAPI(prompt: string, config: any, onChunk?: (chunk: string) => void): Promise<string> {
    try {
      console.log('🤖 调用AI API (流式模式):', config.name, config.baseUrl)

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
      }

      console.log('📤 AI请求体:', requestBody)

      // 发送请求到AI API
      const response = await fetch(config.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ AI API响应错误:', response.status, errorText)
        throw new Error(`AI API请求失败: ${response.status} ${response.statusText}`)
      }

      // 处理流式响应
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('无法获取响应流')
      }

      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n').filter(line => line.trim() !== '')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const content = parsed.choices?.[0]?.delta?.content || ''
              if (content) {
                fullContent += content
                // 调用回调函数，实时更新UI
                if (onChunk) {
                  onChunk(content)
                }
              }
            } catch (e) {
              console.warn('解析流式数据失败:', e, data)
            }
          }
        }
      }

      console.log('✅ AI生成的解释:', fullContent)
      return fullContent.trim()
    } catch (error) {
      console.error('❌ AI API调用失败:', error)
      throw error
    }
  }
}
