import { invoke } from '@tauri-apps/api/core'
import * as IconPark from '@icon-park/svg'
import { vipGuard } from '../auth/vipGuard'

/**
 * 网络连接右键菜单管理器
 */
export class NetworkContextMenu {
  private contextMenu: HTMLElement | null = null
  private modal: HTMLElement | null = null
  private currentConnection: {
    protocol: string
    localAddress: string
    foreignAddress: string
    state: string
    pid: string
    process: string
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
    menu.id = 'network-context-menu'
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
        <select id="network-account-select" style="
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
          <div class="menu-item" data-action="connection-details">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>连接详情</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-local">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制本地地址</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-foreign">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制远程地址</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-process">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制进程信息</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Earth({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>IP信息查询</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="whois">
            <span class="menu-label">
              ${IconPark.Search({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>WHOIS查询</span>
            </span>
          </div>
          <div class="menu-item" data-action="geolocation">
            <span class="menu-label">
              ${IconPark.Local({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>地理位置查询</span>
            </span>
          </div>
          <div class="menu-item" data-action="reverse-dns">
            <span class="menu-label">
              ${IconPark.Return({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>反向DNS查询</span>
            </span>
          </div>
          <div class="menu-item" data-action="ip-type">
            <span class="menu-label">
              ${IconPark.Tag({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>IP类型判断</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.PlugOne({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>端口分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="port-service">
            <span class="menu-label">
              ${IconPark.Application({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>端口服务识别</span>
            </span>
          </div>
          <div class="menu-item" data-action="port-process">
            <span class="menu-label">
              ${IconPark.Code({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看占用进程</span>
            </span>
          </div>
          <div class="menu-item" data-action="port-test">
            <span class="menu-label">
              ${IconPark.Check({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>端口连通性测试</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Analysis({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>网络诊断</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="ping">
            <span class="menu-label">
              ${IconPark.Signal({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>Ping测试</span>
            </span>
          </div>
          <div class="menu-item" data-action="traceroute">
            <span class="menu-label">
              ${IconPark.Direction({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>Traceroute追踪</span>
            </span>
          </div>
          <div class="menu-item" data-action="latency">
            <span class="menu-label">
              ${IconPark.Time({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>网络延迟测试</span>
            </span>
          </div>
          <div class="menu-item" data-action="tcp-test">
            <span class="menu-label">
              ${IconPark.Connection({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>TCP连接测试</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Protection({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>安全分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="threat-intel">
            <span class="menu-label">
              ${IconPark.Caution({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>威胁情报查询</span>
            </span>
          </div>
          <div class="menu-item" data-action="blacklist-check">
            <span class="menu-label">
              ${IconPark.CloseOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>黑名单检查</span>
            </span>
          </div>
          <div class="menu-item" data-action="anomaly-detect">
            <span class="menu-label">
              ${IconPark.Attention({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>异常连接检测</span>
            </span>
          </div>
          <div class="menu-item" data-action="connection-freq">
            <span class="menu-label">
              ${IconPark.ChartLine({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>连接频率分析</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Fire({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>防火墙操作</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="block-ip">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>阻止该IP</span>
            </span>
          </div>
          <div class="menu-item" data-action="allow-ip">
            <span class="menu-label">
              ${IconPark.Unlock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>允许该IP</span>
            </span>
          </div>
          <div class="menu-item" data-action="firewall-rules">
            <span class="menu-label">
              ${IconPark.ListTwo({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看防火墙规则</span>
            </span>
          </div>
          <div class="menu-item" data-action="temp-block">
            <span class="menu-label">
              ${IconPark.Timer({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>临时阻止（5分钟）</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.FileText({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>日志查询</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="connection-history">
            <span class="menu-label">
              ${IconPark.History({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看连接历史</span>
            </span>
          </div>
          <div class="menu-item" data-action="access-log">
            <span class="menu-label">
              ${IconPark.Log({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看访问日志</span>
            </span>
          </div>
          <div class="menu-item" data-action="security-log">
            <span class="menu-label">
              ${IconPark.Shield({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看安全日志</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-divider"></div>

      <div class="menu-item" data-action="disconnect">
        <span class="menu-label">
          ${IconPark.CloseOne({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>断开连接</span>
        </span>
      </div>

      <div class="menu-item" data-action="refresh">
        <span class="menu-label">
          ${IconPark.Refresh({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>刷新连接信息</span>
        </span>
      </div>
    `

    // 添加样式
    const style = document.createElement('style')
    style.textContent = `
      #network-context-menu .menu-item {
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
      #network-context-menu .menu-item:hover {
        background: var(--bg-tertiary);
      }
      #network-context-menu .menu-label {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #network-context-menu .menu-label svg {
        flex-shrink: 0;
      }
      #network-context-menu .menu-parent {
        position: relative;
      }
      #network-context-menu .menu-parent .arrow {
        font-size: 10px;
        color: var(--text-secondary);
        margin-left: 8px;
      }
      #network-context-menu .submenu {
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
      #network-context-menu .menu-parent:hover > .submenu {
        display: block;
      }
      #network-context-menu .submenu .menu-item {
        padding: 8px 16px;
      }
      #network-context-menu .menu-divider {
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
    modal.id = 'network-detail-modal'
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
          <h3 id="network-modal-title" style="margin: 0; color: var(--text-primary); font-size: 16px; flex: 1;"></h3>
          <button id="network-ai-explain-btn" class="modern-btn secondary" style="
            padding: 6px 12px;
            font-size: 13px;
            gap: 6px;
          ">
            ${IconPark.Brain({ theme: 'outline', size: '16', fill: 'currentColor' })}
            <span>AI解释</span>
          </button>
          <button id="network-modal-close" style="
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
          <div id="network-modal-content" style="
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
          <div id="network-ai-explanation" style="
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
            <div id="network-ai-explanation-content" style="
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
      const select = document.getElementById('network-account-select') as HTMLSelectElement
      if (!select) {
        console.warn('⚠️ 网络账号选择下拉框未找到')
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

      console.log(`✅ 网络右键菜单加载了 ${this.accounts.length} 个账号`)
    } catch (error) {
      console.error('❌ 网络右键菜单加载账号列表失败:', error)
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    // 账号选择下拉框change事件
    document.addEventListener('change', (e) => {
      const target = e.target as HTMLElement
      if (target.id === 'network-account-select') {
        const select = target as HTMLSelectElement
        this.selectedUsername = select.value
        console.log('👤 网络菜单选择账号:', this.selectedUsername || '默认账号')
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
    document.getElementById('network-modal-close')?.addEventListener('click', () => {
      this.hideModal()
    })

    // AI解释按钮
    document.getElementById('network-ai-explain-btn')?.addEventListener('click', () => {
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
  async showContextMenu(x: number, y: number, connection: {
    protocol: string
    localAddress: string
    foreignAddress: string
    state: string
    pid: string
    process: string
  }) {
    if (!this.contextMenu) return

    // VIP 权限检查
    if (!vipGuard.requireVIP('网络连接右键菜单')) {
      return
    }

    this.currentConnection = connection

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

    const titleEl = document.getElementById('network-modal-title')
    const contentEl = document.getElementById('network-modal-content')
    const explanationEl = document.getElementById('network-ai-explanation')

    if (titleEl) titleEl.textContent = title
    if (contentEl) contentEl.textContent = content

    // 隐藏AI解释区域（每次显示新内容时重置）
    if (explanationEl) {
      explanationEl.style.display = 'none'
      const explanationContentEl = document.getElementById('network-ai-explanation-content')
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
      const explanationEl = document.getElementById('network-ai-explanation')
      if (explanationEl) {
        explanationEl.style.display = 'none'
        const explanationContentEl = document.getElementById('network-ai-explanation-content')
        if (explanationContentEl) {
          explanationContentEl.textContent = ''
        }
      }
    }
  }

  /**
   * 提取IP地址（从 IP:Port 格式中提取IP）
   */
  private extractIP(address: string): string {
    // 处理IPv4和IPv6
    if (address.includes('[')) {
      // IPv6格式: [::1]:8080
      const match = address.match(/\[([^\]]+)\]/)
      return match ? match[1] : address
    } else {
      // IPv4格式: 192.168.1.1:8080
      return address.split(':')[0]
    }
  }

  /**
   * 提取端口（从 IP:Port 格式中提取端口）
   */
  private extractPort(address: string): string {
    const parts = address.split(':')
    return parts[parts.length - 1] || ''
  }

  /**
   * 执行操作
   */
  private async executeAction(action: string) {
    if (!this.currentConnection) return

    const { protocol, localAddress, foreignAddress, state, pid, process } = this.currentConnection
    const foreignIP = this.extractIP(foreignAddress)
    const foreignPort = this.extractPort(foreignAddress)
    const localPort = this.extractPort(localAddress)

    let command = ''
    let title = ''
    let actionName = ''

    switch (action) {
      // 基本信息
      case 'connection-details':
        title = '连接详情'
        actionName = '查看连接详情'
        this.showModal(title, `协议: ${protocol}\n本地地址: ${localAddress}\n远程地址: ${foreignAddress}\n状态: ${state}\nPID: ${pid}\n进程: ${process}`)
        return

      case 'copy-local':
        navigator.clipboard.writeText(localAddress)
        this.showModal('复制成功', `已复制本地地址: ${localAddress}`)
        return

      case 'copy-foreign':
        navigator.clipboard.writeText(foreignAddress)
        this.showModal('复制成功', `已复制远程地址: ${foreignAddress}`)
        return

      case 'copy-process':
        navigator.clipboard.writeText(process)
        this.showModal('复制成功', `已复制进程信息: ${process}`)
        return

      // IP信息查询
      case 'whois':
        command = `whois ${foreignIP} 2>/dev/null || echo "whois命令不可用，请安装: apt install whois 或 yum install whois"`
        title = `WHOIS查询 - ${foreignIP}`
        actionName = 'WHOIS查询'
        break

      case 'geolocation':
        command = `curl -s "http://ip-api.com/json/${foreignIP}" 2>/dev/null || echo "无法查询地理位置，请检查网络连接"`
        title = `地理位置查询 - ${foreignIP}`
        actionName = '地理位置查询'
        break

      case 'reverse-dns':
        command = `dig -x ${foreignIP} +short 2>/dev/null || nslookup ${foreignIP} 2>/dev/null | grep "name =" || echo "无法解析反向DNS"`
        title = `反向DNS查询 - ${foreignIP}`
        actionName = '反向DNS查询'
        break

      case 'ip-type':
        command = `echo "IP地址: ${foreignIP}"; echo ""; if [[ "${foreignIP}" =~ ^10\\. ]] || [[ "${foreignIP}" =~ ^172\\.(1[6-9]|2[0-9]|3[01])\\. ]] || [[ "${foreignIP}" =~ ^192\\.168\\. ]]; then echo "✓ 内网IP（私有地址）"; elif [[ "${foreignIP}" =~ ^127\\. ]]; then echo "✓ 回环地址（Loopback）"; elif [[ "${foreignIP}" =~ ^169\\.254\\. ]]; then echo "✓ 链路本地地址（Link-Local）"; elif [[ "${foreignIP}" =~ ^224\\. ]] || [[ "${foreignIP}" =~ ^239\\. ]]; then echo "✓ 组播地址（Multicast）"; else echo "✓ 公网IP（公共地址）"; fi`
        title = `IP类型判断 - ${foreignIP}`
        actionName = 'IP类型判断'
        break

      // 端口分析
      case 'port-service':
        command = `echo "端口: ${foreignPort}"; echo ""; grep -w ${foreignPort} /etc/services 2>/dev/null | head -5 || echo "未找到标准服务定义"; echo ""; echo "常见端口服务:"; case ${foreignPort} in 80) echo "HTTP - 网页服务";; 443) echo "HTTPS - 安全网页服务";; 22) echo "SSH - 安全Shell";; 21) echo "FTP - 文件传输";; 25) echo "SMTP - 邮件发送";; 3306) echo "MySQL - 数据库";; 5432) echo "PostgreSQL - 数据库";; 6379) echo "Redis - 缓存数据库";; 27017) echo "MongoDB - 数据库";; 3389) echo "RDP - 远程桌面";; *) echo "未知服务";; esac`
        title = `端口服务识别 - ${foreignPort}`
        actionName = '端口服务识别'
        break

      case 'port-process':
        command = `lsof -nP -i :${localPort} 2>/dev/null || ss -tlnp | grep ":${localPort}" 2>/dev/null || echo "无法查询端口占用进程"`
        title = `端口占用进程 - ${localPort}`
        actionName = '查看端口占用进程'
        break

      case 'port-test':
        command = `timeout 3 bash -c "echo > /dev/tcp/${foreignIP}/${foreignPort}" 2>/dev/null && echo "✓ 端口 ${foreignPort} 可连接" || echo "✗ 端口 ${foreignPort} 不可连接或超时"`
        title = `端口连通性测试 - ${foreignIP}:${foreignPort}`
        actionName = '端口连通性测试'
        break

      // 网络诊断
      case 'ping':
        command = `ping -c 4 ${foreignIP} 2>/dev/null || echo "Ping失败或权限不足"`
        title = `Ping测试 - ${foreignIP}`
        actionName = 'Ping测试'
        break

      case 'traceroute':
        command = `traceroute -m 15 ${foreignIP} 2>/dev/null || tracepath ${foreignIP} 2>/dev/null || echo "traceroute命令不可用"`
        title = `Traceroute追踪 - ${foreignIP}`
        actionName = 'Traceroute追踪'
        break

      case 'latency':
        command = `ping -c 10 ${foreignIP} 2>/dev/null | tail -1 | awk -F'/' '{print "平均延迟: "$5" ms"}' || echo "无法测试延迟"`
        title = `网络延迟测试 - ${foreignIP}`
        actionName = '网络延迟测试'
        break

      case 'tcp-test':
        command = `timeout 5 bash -c "echo -e 'GET / HTTP/1.0\\r\\n\\r\\n' > /dev/tcp/${foreignIP}/${foreignPort}" 2>/dev/null && echo "✓ TCP连接成功" || echo "✗ TCP连接失败"`
        title = `TCP连接测试 - ${foreignIP}:${foreignPort}`
        actionName = 'TCP连接测试'
        break

      // 安全分析
      case 'threat-intel':
        command = `echo "威胁情报查询 - ${foreignIP}"; echo ""; echo "⚠️ 注意：此功能需要API密钥"; echo ""; echo "建议使用以下服务:"; echo "1. VirusTotal: https://www.virustotal.com/"; echo "2. AbuseIPDB: https://www.abuseipdb.com/"; echo "3. IPVoid: https://www.ipvoid.com/"; echo ""; echo "IP地址: ${foreignIP}"; echo "端口: ${foreignPort}"; echo "协议: ${protocol}"`
        title = `威胁情报查询 - ${foreignIP}`
        actionName = '威胁情报查询'
        break

      case 'blacklist-check':
        command = `echo "黑名单检查 - ${foreignIP}"; echo ""; echo "检查常见黑名单..."; echo ""; host ${foreignIP}.zen.spamhaus.org 2>/dev/null && echo "⚠️ 在Spamhaus黑名单中" || echo "✓ 不在Spamhaus黑名单中"; host ${foreignIP}.dnsbl.sorbs.net 2>/dev/null && echo "⚠️ 在SORBS黑名单中" || echo "✓ 不在SORBS黑名单中"`
        title = `黑名单检查 - ${foreignIP}`
        actionName = '黑名单检查'
        break

      case 'anomaly-detect':
        command = `echo "异常连接检测 - ${foreignIP}:${foreignPort}"; echo ""; echo "1. 端口检查:"; if [ ${foreignPort} -lt 1024 ]; then echo "⚠️ 使用特权端口 (<1024)"; else echo "✓ 使用非特权端口"; fi; echo ""; echo "2. 常见端口检查:"; case ${foreignPort} in 22|80|443|3306|5432|6379|27017) echo "✓ 常见服务端口";; *) echo "⚠️ 非常见端口，需要注意";; esac; echo ""; echo "3. 连接状态:"; echo "状态: ${state}"; echo ""; echo "4. 进程信息:"; echo "${process}"`
        title = `异常连接检测 - ${foreignIP}:${foreignPort}`
        actionName = '异常连接检测'
        break

      case 'connection-freq':
        command = `echo "连接频率分析 - ${foreignIP}"; echo ""; echo "当前连接数:"; ss -tn | grep "${foreignIP}" | wc -l; echo ""; echo "所有连接:"; ss -tn | grep "${foreignIP}" | head -20`
        title = `连接频率分析 - ${foreignIP}`
        actionName = '连接频率分析'
        break

      // 防火墙操作
      case 'block-ip':
        command = `echo "阻止IP: ${foreignIP}"; echo ""; if command -v iptables >/dev/null 2>&1; then echo "使用iptables阻止..."; echo "命令: iptables -A INPUT -s ${foreignIP} -j DROP"; echo "⚠️ 需要root权限执行"; echo ""; echo "执行命令: sudo iptables -A INPUT -s ${foreignIP} -j DROP"; else echo "⚠️ iptables命令不可用"; fi`
        title = `阻止IP - ${foreignIP}`
        actionName = '阻止IP'
        break

      case 'allow-ip':
        command = `echo "允许IP: ${foreignIP}"; echo ""; if command -v iptables >/dev/null 2>&1; then echo "使用iptables允许..."; echo "命令: iptables -D INPUT -s ${foreignIP} -j DROP"; echo "⚠️ 需要root权限执行"; echo ""; echo "执行命令: sudo iptables -D INPUT -s ${foreignIP} -j DROP"; else echo "⚠️ iptables命令不可用"; fi`
        title = `允许IP - ${foreignIP}`
        actionName = '允许IP'
        break

      case 'firewall-rules':
        command = `echo "防火墙规则 - ${foreignIP}"; echo ""; if command -v iptables >/dev/null 2>&1; then echo "=== iptables规则 ==="; iptables -L -n | grep "${foreignIP}" || echo "无相关规则"; elif command -v firewall-cmd >/dev/null 2>&1; then echo "=== firewalld规则 ==="; firewall-cmd --list-all; else echo "⚠️ 防火墙命令不可用"; fi`
        title = `防火墙规则 - ${foreignIP}`
        actionName = '查看防火墙规则'
        break

      case 'temp-block':
        command = `echo "临时阻止IP（5分钟）: ${foreignIP}"; echo ""; echo "命令: iptables -A INPUT -s ${foreignIP} -j DROP && sleep 300 && iptables -D INPUT -s ${foreignIP} -j DROP"; echo "⚠️ 需要root权限执行"; echo ""; echo "执行命令: sudo bash -c 'iptables -A INPUT -s ${foreignIP} -j DROP && sleep 300 && iptables -D INPUT -s ${foreignIP} -j DROP &'"`
        title = `临时阻止IP - ${foreignIP}`
        actionName = '临时阻止IP'
        break

      // 日志查询
      case 'connection-history':
        command = `echo "连接历史 - ${foreignIP}"; echo ""; echo "=== 最近的连接记录 ==="; journalctl -n 100 | grep "${foreignIP}" || echo "无连接历史记录"`
        title = `连接历史 - ${foreignIP}`
        actionName = '查看连接历史'
        break

      case 'access-log':
        command = `echo "访问日志 - ${foreignIP}"; echo ""; echo "=== Nginx访问日志 ==="; grep "${foreignIP}" /var/log/nginx/access.log 2>/dev/null | tail -20 || echo "无Nginx日志"; echo ""; echo "=== Apache访问日志 ==="; grep "${foreignIP}" /var/log/apache2/access.log 2>/dev/null | tail -20 || grep "${foreignIP}" /var/log/httpd/access_log 2>/dev/null | tail -20 || echo "无Apache日志"`
        title = `访问日志 - ${foreignIP}`
        actionName = '查看访问日志'
        break

      case 'security-log':
        command = `echo "安全日志 - ${foreignIP}"; echo ""; echo "=== 认证日志 ==="; grep "${foreignIP}" /var/log/auth.log 2>/dev/null | tail -20 || grep "${foreignIP}" /var/log/secure 2>/dev/null | tail -20 || echo "无认证日志"; echo ""; echo "=== 系统日志 ==="; journalctl -n 50 | grep "${foreignIP}" || echo "无系统日志"`
        title = `安全日志 - ${foreignIP}`
        actionName = '查看安全日志'
        break

      // 连接操作
      case 'disconnect':
        command = `echo "断开连接 - ${foreignIP}:${foreignPort}"; echo ""; echo "⚠️ 此操作需要root权限"; echo ""; echo "查找连接..."; ss -K dst ${foreignIP} dport = ${foreignPort} 2>/dev/null && echo "✓ 连接已断开" || echo "⚠️ 无法断开连接（可能需要root权限或ss版本不支持-K参数）"`
        title = `断开连接 - ${foreignIP}:${foreignPort}`
        actionName = '断开连接'
        break

      case 'refresh':
        command = `echo "刷新连接信息..."; echo ""; ss -tunap | grep "${foreignIP}" || echo "无连接信息"`
        title = `刷新连接信息 - ${foreignIP}`
        actionName = '刷新连接信息'
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
        console.log('👤 使用账号执行网络命令:', this.selectedUsername)
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

    const contentEl = document.getElementById('network-modal-content')
    const explanationEl = document.getElementById('network-ai-explanation')
    const explanationContentEl = document.getElementById('network-ai-explanation-content')
    const titleEl = document.getElementById('network-modal-title')

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
      const systemPrompt = `你是一个网络安全专家，擅长分析网络连接、IP地址、端口信息等。请用简洁专业的语言解释用户提供的信息，重点关注安全风险和异常情况。

请分析并解释以下网络信息：

标题：${title}

内容：
${content}

请提供：
1. 信息概要
2. 关键发现
3. 安全评估（如果适用）
4. 建议操作（如果适用）`

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
