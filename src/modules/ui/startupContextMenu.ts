import { invoke } from '@tauri-apps/api/core'
import * as IconPark from '@icon-park/svg'
import { wrapCommandWithBash } from '../utils/shellUtils'

/**
 * 自启动项右键菜单管理器
 */
export class StartupContextMenu {
  private contextMenu: HTMLElement | null = null
  private modal: HTMLElement | null = null
  private currentStartup: {
    name: string
    type: string  // systemd, rc.local, cron, init.d
    path: string
    command: string
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
    menu.id = 'startup-context-menu'
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
        <select id="startup-account-select" style="
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
          <div class="menu-item" data-action="details">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>启动项详情</span>
            </span>
          </div>
          <div class="menu-item" data-action="command">
            <span class="menu-label">
              ${IconPark.Terminal({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看启动命令</span>
            </span>
          </div>
          <div class="menu-item" data-action="file-path">
            <span class="menu-label">
              ${IconPark.FolderOpen({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看文件路径</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-name">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制启动项名称</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.SettingConfig({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>启动项管理</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="enable">
            <span class="menu-label">
              ${IconPark.Check({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>启用自启动</span>
            </span>
          </div>
          <div class="menu-item" data-action="disable">
            <span class="menu-label">
              ${IconPark.Close({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>禁用自启动</span>
            </span>
          </div>
          <div class="menu-item" data-action="run-now">
            <span class="menu-label">
              ${IconPark.Play({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>立即运行</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Local({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>位置分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="startup-type">
            <span class="menu-label">
              ${IconPark.Tag({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看启动类型</span>
            </span>
          </div>
          <div class="menu-item" data-action="config-location">
            <span class="menu-label">
              ${IconPark.FolderOpen({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>配置文件位置</span>
            </span>
          </div>
          <div class="menu-item" data-action="view-config">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看配置文件</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Protection({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>安全检查</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="suspicious-path">
            <span class="menu-label">
              ${IconPark.FolderFailed({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>检查可疑路径</span>
            </span>
          </div>
          <div class="menu-item" data-action="file-signature">
            <span class="menu-label">
              ${IconPark.Shield({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>检查文件签名</span>
            </span>
          </div>
          <div class="menu-item" data-action="modification-time">
            <span class="menu-label">
              ${IconPark.Time({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看修改时间</span>
            </span>
          </div>
          <div class="menu-item" data-action="malware-check">
            <span class="menu-label">
              ${IconPark.Caution({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>恶意软件检测</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.NetworkTree({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>依赖分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="dependencies">
            <span class="menu-label">
              ${IconPark.Connection({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看依赖项</span>
            </span>
          </div>
          <div class="menu-item" data-action="boot-order">
            <span class="menu-label">
              ${IconPark.Sort({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看启动顺序</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.ChartPie({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>资源影响</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="boot-time">
            <span class="menu-label">
              ${IconPark.Timer({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>启动时间影响</span>
            </span>
          </div>
          <div class="menu-item" data-action="resource-usage">
            <span class="menu-label">
              ${IconPark.Cpu({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>资源占用</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Log({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>日志查询</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="startup-logs">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看启动日志</span>
            </span>
          </div>
          <div class="menu-item" data-action="error-logs">
            <span class="menu-label">
              ${IconPark.Caution({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看错误日志</span>
            </span>
          </div>
          <div class="menu-item" data-action="run-history">
            <span class="menu-label">
              ${IconPark.History({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看运行记录</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.SettingTwo({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>高级操作</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="delay-start">
            <span class="menu-label">
              ${IconPark.Timer({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看延迟启动配置</span>
            </span>
          </div>
          <div class="menu-item" data-action="backup">
            <span class="menu-label">
              ${IconPark.Save({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>备份配置信息</span>
            </span>
          </div>
        </div>
      </div>
    `

    // 添加样式
    const style = document.createElement('style')
    style.textContent = `
      #startup-context-menu .menu-item {
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
      #startup-context-menu .menu-item:hover {
        background: var(--bg-tertiary);
      }
      #startup-context-menu .menu-label {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      #startup-context-menu .menu-label svg {
        flex-shrink: 0;
      }
      #startup-context-menu .menu-parent {
        position: relative;
      }
      #startup-context-menu .menu-parent .arrow {
        font-size: 10px;
        color: var(--text-secondary);
        margin-left: 8px;
      }
      #startup-context-menu .submenu {
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
      #startup-context-menu .menu-parent:hover > .submenu {
        display: block;
      }
      #startup-context-menu .submenu .menu-item {
        padding: 8px 16px;
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
    modal.id = 'startup-detail-modal'
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
          <h3 id="startup-modal-title" style="margin: 0; color: var(--text-primary); font-size: 16px; flex: 1;"></h3>
          <button id="startup-ai-explain-btn" class="modern-btn secondary" style="
            padding: 6px 12px;
            font-size: 13px;
            gap: 6px;
          ">
            ${IconPark.Brain({ theme: 'outline', size: '16', fill: 'currentColor' })}
            <span>AI解释</span>
          </button>
          <button id="startup-modal-close" style="
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
          <div id="startup-modal-content" style="
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
          <div id="startup-ai-explanation" style="
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
            <div id="startup-ai-explanation-content" style="
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

      const connection = connections[0]
      this.accounts = connection.accounts || []

      const select = document.getElementById('startup-account-select') as HTMLSelectElement
      if (!select) {
        console.warn('⚠️ 启动项账号选择下拉框未找到')
        return
      }

      select.innerHTML = '<option value="">默认账号</option>'

      this.accounts.forEach((account: any) => {
        const option = document.createElement('option')
        option.value = account.username
        option.textContent = `${account.username}${account.description ? ` (${account.description})` : ''}${account.is_default ? ' [默认]' : ''}`
        select.appendChild(option)
      })

      //console.log(`✅ 启动项右键菜单加载了 ${this.accounts.length} 个账号`)
    } catch (error) {
      console.error('❌ 启动项右键菜单加载账号列表失败:', error)
    }
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners() {
    // 账号选择下拉框change事件
    document.addEventListener('change', (e) => {
      const target = e.target as HTMLElement
      if (target.id === 'startup-account-select') {
        const select = target as HTMLSelectElement
        this.selectedUsername = select.value
        console.log('👤 启动项菜单选择账号:', this.selectedUsername || '默认账号')
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

    // 关闭按钮
    document.getElementById('startup-modal-close')?.addEventListener('click', () => {
      this.hideModal()
    })

    // AI解释按钮
    document.getElementById('startup-ai-explain-btn')?.addEventListener('click', () => {
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
  async showContextMenu(x: number, y: number, startup: {
    name: string
    type: string
    path: string
    command: string
  }) {
    if (!this.contextMenu) return


    this.currentStartup = startup

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

    const titleEl = document.getElementById('startup-modal-title')
    const contentEl = document.getElementById('startup-modal-content')
    const explanationEl = document.getElementById('startup-ai-explanation')

    if (titleEl) titleEl.textContent = title
    if (contentEl) contentEl.textContent = content

    // 隐藏AI解释区域（每次显示新内容时重置）
    if (explanationEl) {
      explanationEl.style.display = 'none'
      const explanationContentEl = document.getElementById('startup-ai-explanation-content')
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

      const explanationEl = document.getElementById('startup-ai-explanation')
      if (explanationEl) {
        explanationEl.style.display = 'none'
        const explanationContentEl = document.getElementById('startup-ai-explanation-content')
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
    if (!this.currentStartup) return

    const { name, type, path, command } = this.currentStartup
    let cmd = ''
    let title = ''
    let actionName = ''

    switch (action) {
      // 基本信息
      case 'details':
        cmd = `echo "=== 启动项详情 ==="; echo ""; echo "名称: ${name}"; echo "类型: ${type}"; echo "路径: ${path}"; echo "命令: ${command}"; echo ""; if [ "${type}" = "systemd" ]; then systemctl show ${name} 2>/dev/null || echo "无法获取详细信息"; fi`
        title = `启动项详情 - ${name}`
        actionName = '查看启动项详情'
        break

      case 'command':
        cmd = `echo "=== 启动命令 ==="; echo ""; echo "${command}"; echo ""; echo "=== 命令解析 ==="; which ${command.split(' ')[0]} 2>/dev/null || echo "命令路径: 未找到"`
        title = `启动命令 - ${name}`
        actionName = '查看启动命令'
        break

      case 'file-path':
        cmd = `echo "=== 文件路径 ==="; echo ""; echo "${path}"; echo ""; ls -la "${path}" 2>/dev/null || echo "文件不存在或无法访问"`
        title = `文件路径 - ${name}`
        actionName = '查看文件路径'
        break

      case 'copy-name':
        navigator.clipboard.writeText(name)
        this.showModal('复制成功', `已复制启动项名称: ${name}`)
        return

      // 启动项管理
      case 'enable':
        if (type === 'systemd') {
          cmd = `systemctl enable ${name} 2>&1 && echo "✓ 已启用自启动" || echo "✗ 启用失败"`
        } else {
          cmd = `echo "启动类型: ${type}"; echo ""; echo "⚠️ 该类型的启动项需要手动配置"`
        }
        title = `启用自启动 - ${name}`
        actionName = '启用自启动'
        break

      case 'disable':
        if (type === 'systemd') {
          cmd = `systemctl disable ${name} 2>&1 && echo "✓ 已禁用自启动" || echo "✗ 禁用失败"`
        } else {
          cmd = `echo "启动类型: ${type}"; echo ""; echo "⚠️ 该类型的启动项需要手动配置"`
        }
        title = `禁用自启动 - ${name}`
        actionName = '禁用自启动'
        break

      case 'run-now':
        if (type === 'systemd') {
          cmd = `systemctl start ${name} 2>&1 || echo "启动失败"`
        } else {
          cmd = `${command} 2>&1 &`
        }
        title = `立即运行 - ${name}`
        actionName = '立即运行'
        break

      // 位置分析
      case 'startup-type':
        cmd = `echo "=== 启动类型分析 ==="; echo ""; echo "类型: ${type}"; echo ""; case "${type}" in systemd) echo "systemd服务单元，由systemd管理";; rc.local) echo "传统启动脚本，在/etc/rc.local中配置";; cron) echo "定时任务，由cron管理";; init.d) echo"传统SysV init脚本";; *) echo "其他类型";; esac`
        title = `启动类型 - ${name}`
        actionName = '查看启动类型'
        break

      case 'config-location':
        cmd = `echo "=== 配置文件位置 ==="; echo ""; echo "${path}"; echo ""; dirname "${path}" | xargs ls -la 2>/dev/null || echo "无法访问目录"`
        title = `配置文件位置 - ${name}`
        actionName = '配置文件位置'
        break

      case 'view-config':
        cmd = `cat "${path}" 2>/dev/null || systemctl cat ${name} 2>/dev/null || echo "无法读取配置文件"`
        title = `配置文件 - ${name}`
        actionName = '查看配置文件'
        break

      // 安全检查
      case 'suspicious-path':
        cmd = `echo "=== 可疑路径检测 ==="; echo ""; echo "文件路径: ${path}"; echo "命令: ${command}"; echo ""; if [[ "${path}" =~ ^(/tmp|/dev/shm|/var/tmp) ]]; then echo "⚠️ 文件位于可疑目录: ${path}"; else echo "✓ 文件路径正常"; fi; echo ""; if [[ "${command}" =~ ^(/tmp|/dev/shm|/var/tmp) ]]; then echo "⚠️ 命令位于可疑目录"; else echo "✓ 命令路径正常"; fi`
        title = `可疑路径检测 - ${name}`
        actionName = '检查可疑路径'
        break

      case 'file-signature':
        cmd = `echo "=== 文件签名检查 ==="; echo ""; file "${path}" 2>/dev/null || echo "无法获取文件类型"; echo ""; md5sum "${path}" 2>/dev/null || echo "无法计算MD5"; echo ""; sha256sum "${path}" 2>/dev/null || echo "无法计算SHA256"`
        title = `文件签名 - ${name}`
        actionName = '检查文件签名'
        break

      case 'modification-time':
        cmd = `echo "=== 文件修改时间 ==="; echo ""; stat "${path}" 2>/dev/null || ls -la "${path}" 2>/dev/null || echo "无法获取文件信息"; echo ""; echo "=== 最近修改检查 ==="; find "${path}" -mtime -7 2>/dev/null && echo "⚠️ 文件在最近7天内被修改" || echo "✓ 文件未在最近7天内修改"`
        title = `修改时间 - ${name}`
        actionName = '查看修改时间'
        break

      case 'malware-check':
        cmd = `echo "=== 恶意软件检测 ==="; echo ""; echo "文件: ${path}"; echo ""; echo "1. 检查可疑字符串:"; strings "${path}" 2>/dev/null | grep -iE "(wget|curl|/tmp|/dev/shm|nc -|bash -i|/bin/sh)" | head -10 || echo "未发现可疑字符串"; echo ""; echo "2. 检查网络连接代码:"; strings "${path}" 2>/dev/null | grep -iE "(socket|connect|bind|listen)" | head -5 || echo "未发现网络代码"; echo ""; echo "⚠️ 建议使用专业杀毒软件进行全面检查"`
        title = `恶意软件检测 - ${name}`
        actionName = '恶意软件检测'
        break

      // 依赖分析
      case 'dependencies':
        if (type === 'systemd') {
          cmd = `systemctl list-dependencies ${name} --no-pager 2>/dev/null || echo "无法获取依赖信息"`
        } else {
          cmd = `echo "启动类型: ${type}"; echo ""; echo "该类型的启动项依赖分析需要手动检查配置文件"`
        }
        title = `依赖项 - ${name}`
        actionName = '查看依赖项'
        break

      case 'boot-order':
        if (type === 'systemd') {
          cmd = `systemd-analyze critical-chain ${name} 2>/dev/null || echo "无法获取启动顺序"`
        } else {
          cmd = `echo "启动类型: ${type}"; echo ""; echo "该类型的启动项启动顺序需要手动分析"`
        }
        title = `启动顺序 - ${name}`
        actionName = '查看启动顺序'
        break

      // 资源影响
      case 'boot-time':
        if (type === 'systemd') {
          cmd = `systemd-analyze blame | grep ${name} 2>/dev/null || echo "无法获取启动时间影响"; echo ""; echo "=== 系统启动分析 ==="; systemd-analyze time 2>/dev/null`
        } else {
          cmd = `echo "启动类型: ${type}"; echo ""; echo "该类型的启动项时间分析需要手动测量"`
        }
        title = `启动时间影响 - ${name}`
        actionName = '启动时间影响'
        break

      case 'resource-usage':
        if (type === 'systemd') {
          cmd = `systemctl status ${name} 2>/dev/null | grep -E "(CPU|Memory|Tasks)" || echo "服务未运行或无法获取资源信息"`
        } else {
          cmd = `ps aux | grep "${command}" | grep -v grep || echo "进程未运行"`
        }
        title = `资源占用 - ${name}`
        actionName = '查看资源占用'
        break

      // 日志查询
      case 'startup-logs':
        if (type === 'systemd') {
          cmd = `journalctl -u ${name} -n 50 --no-pager 2>/dev/null || echo "无法获取日志"`
        } else {
          cmd = `echo "启动类型: ${type}"; echo ""; echo "该类型的启动项日志需要手动查找"`
        }
        title = `启动日志 - ${name}`
        actionName = '查看启动日志'
        break

      case 'error-logs':
        if (type === 'systemd') {
          cmd = `journalctl -u ${name} -p err -n 30 --no-pager 2>/dev/null || echo "无错误日志"`
        } else {
          cmd = `grep -i error /var/log/syslog 2>/dev/null | grep "${name}" | tail -30 || echo "无错误日志"`
        }
        title = `错误日志 - ${name}`
        actionName = '查看错误日志'
        break

      case 'run-history':
        if (type === 'systemd') {
          cmd = `journalctl -u ${name} --no-pager 2>/dev/null | grep -E "(Started|Stopped)" | tail -20 || echo "无运行记录"`
        } else {
          cmd = `grep "${name}" /var/log/syslog 2>/dev/null | tail -20 || echo "无运行记录"`
        }
        title = `运行记录 - ${name}`
        actionName = '查看运行记录'
        break

      // 高级操作
      case 'delay-start':
        if (type === 'systemd') {
          cmd = `echo "=== 延迟启动配置 ==="; echo ""; systemctl show ${name} --property=TimeoutStartUSec,TimeoutStopUSec 2>/dev/null || echo "无法获取配置"`
        } else {
          cmd = `echo "启动类型: ${type}"; echo ""; echo "该类型的启动项延迟配置需要手动设置"`
        }
        title = `延迟启动配置 - ${name}`
        actionName = '查看延迟启动配置'
        break

      case 'backup':
        cmd = `echo "=== 备份配置信息 ==="; echo ""; echo "名称: ${name}"; echo "类型: ${type}"; echo "路径: ${path}"; echo "命令: ${command}"; echo ""; echo "=== 配置文件内容 ==="; cat "${path}" 2>/dev/null || systemctl cat ${name} 2>/dev/null || echo "无法读取配置"`
        title = `备份配置 - ${name}`
        actionName = '备份配置信息'
        break

      default:
        console.warn(`未知操作: ${action}`)
        this.showModal('错误', `未知操作: ${action}`)
        return
    }

    if (!actionName) {
      actionName = '执行命令'
    }

    try {
      const accountInfo = this.selectedUsername ? ` (账号: ${this.selectedUsername})` : ''
      this.showModal(title, `⏳ 正在执行: ${actionName}${accountInfo}...\n\n命令: ${cmd.substring(0, 100)}${cmd.length > 100 ? '...' : ''}`)

      const finalCommand = wrapCommandWithBash(cmd);
      const params: any = { command: finalCommand }
      if (this.selectedUsername) {
        params.username = this.selectedUsername
        console.log('👤 使用账号执行启动项命令:', this.selectedUsername)
      }
      const result = await invoke('ssh_execute_command_direct', params) as { output: string; exit_code: number }

      this.showModal(title, result.output || '✓ 命令执行完成，无输出')
    } catch (error) {
      this.showModal(title, `❌ 执行失败: ${error}`)
    }
  }

  /**
   * 使用AI解释当前内容
   */
  private async explainWithAI() {

    const contentEl = document.getElementById('startup-modal-content')
    const explanationEl = document.getElementById('startup-ai-explanation')
    const explanationContentEl = document.getElementById('startup-ai-explanation-content')
    const titleEl = document.getElementById('startup-modal-title')

    if (!contentEl || !explanationEl || !explanationContentEl || !titleEl) return

    const content = contentEl.textContent || ''
    const title = titleEl.textContent || ''

    explanationEl.style.display = 'block'
    explanationContentEl.textContent = '🤔 AI正在分析...'

    try {
      const settingsContent = await invoke('read_settings_file') as string
      let settings: any = {}

      if (settingsContent) {
        settings = JSON.parse(settingsContent)
      }

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

      const systemPrompt = `你是一个Linux系统启动和安全专家，擅长分析自启动项、启动脚本、服务配置等。请用简洁专业的语言解释用户提供的信息，重点关注安全风险和潜在问题。

请分析并解释以下自启动项信息：

标题：${title}

内容：
${content}

请提供：
1. 信息概要
2. 关键发现
3. 安全评估（如果适用）
4. 建议操作（如果适用）`

      explanationContentEl.textContent = ''

      await this.callAIAPI(systemPrompt, providerConfig, (chunk: string) => {
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
        stream: true
      }

      console.log('📤 AI请求体:', requestBody)

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
