/**
 * 用户列表右键菜单管理器
 */

import { invoke } from '@tauri-apps/api/core'
import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class UserContextMenu extends BaseContextMenu {
  private currentUser: string = ''

  constructor() {
    super('user')
  }

  protected onShowContextMenu(username: string) {
    this.currentUser = username
  }

  protected getMenuItemsHTML(): string {
    return `
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Info({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>基本信息</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="user-details">
            <span class="menu-label">
              ${IconPark.User({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>用户详情</span>
            </span>
          </div>
          <div class="menu-item" data-action="group-info">
            <span class="menu-label">
              ${IconPark.Group({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>用户组信息</span>
            </span>
          </div>
          <div class="menu-item" data-action="home-dir">
            <span class="menu-label">
              ${IconPark.FolderOpen({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>主目录信息</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-username">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制用户名</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.SettingConfig({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>用户管理</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="lock-user">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>锁定用户账户</span>
            </span>
          </div>
          <div class="menu-item" data-action="unlock-user">
            <span class="menu-label">
              ${IconPark.Unlock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>解锁用户账户</span>
            </span>
          </div>
          <div class="menu-item" data-action="delete-user">
            <span class="menu-label">
              ${IconPark.Delete({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>删除用户账户</span>
            </span>
          </div>
          <div class="menu-item" data-action="passwd-expire">
            <span class="menu-label">
              ${IconPark.Timer({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看密码过期时间</span>
            </span>
          </div>
          <div class="menu-item" data-action="user-status">
            <span class="menu-label">
              ${IconPark.CheckOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看账户状态</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Lock({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>权限分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="sudo-permissions">
            <span class="menu-label">
              ${IconPark.Key({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看sudo权限</span>
            </span>
          </div>
          <div class="menu-item" data-action="group-membership">
            <span class="menu-label">
              ${IconPark.Group({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看用户组成员</span>
            </span>
          </div>
          <div class="menu-item" data-action="ssh-keys">
            <span class="menu-label">
              ${IconPark.Communication({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看SSH密钥</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.History({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>活动监控</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="login-history">
            <span class="menu-label">
              ${IconPark.Log({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看登录历史</span>
            </span>
          </div>
          <div class="menu-item" data-action="current-sessions">
            <span class="menu-label">
              ${IconPark.Connection({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看当前会话</span>
            </span>
          </div>
          <div class="menu-item" data-action="failed-logins">
            <span class="menu-label">
              ${IconPark.CloseOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看登录失败记录</span>
            </span>
          </div>
          <div class="menu-item" data-action="last-login">
            <span class="menu-label">
              ${IconPark.Time({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看最后登录时间</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.ChartPie({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>资源使用</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="user-processes">
            <span class="menu-label">
              ${IconPark.Application({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看用户进程</span>
            </span>
          </div>
          <div class="menu-item" data-action="disk-usage">
            <span class="menu-label">
              ${IconPark.HardDisk({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看磁盘使用</span>
            </span>
          </div>
          <div class="menu-item" data-action="open-files">
            <span class="menu-label">
              ${IconPark.FileCode({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看打开的文件</span>
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
          <div class="menu-item" data-action="abnormal-login">
            <span class="menu-label">
              ${IconPark.Attention({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>检查异常登录</span>
            </span>
          </div>
          <div class="menu-item" data-action="crontab">
            <span class="menu-label">
              ${IconPark.Schedule({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看定时任务</span>
            </span>
          </div>
          <div class="menu-item" data-action="ssh-config">
            <span class="menu-label">
              ${IconPark.Config({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看SSH配置</span>
            </span>
          </div>
          <div class="menu-item" data-action="suspicious-files">
            <span class="menu-label">
              ${IconPark.FolderFailed({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>检查可疑文件</span>
            </span>
          </div>
          <div class="menu-item" data-action="suid-files">
            <span class="menu-label">
              ${IconPark.Lightning({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看SUID文件</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Lightning({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>快速操作</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="kill-sessions">
            <span class="menu-label">
              ${IconPark.CloseOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>强制退出所有会话</span>
            </span>
          </div>
          <div class="menu-item" data-action="disable-ssh">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>禁用SSH登录</span>
            </span>
          </div>
        </div>
      </div>
    `
  }

  protected async handleSpecialAction(action: string): Promise<boolean> {
    const user = this.currentUser

    if (action === 'copy-username') {
      navigator.clipboard.writeText(user)
      this.showModal('复制成功', `已复制用户名: ${user}`)
      return true
    }

    if (action === 'delete-user') {
      // Safety checks for critical users
      if (user === 'root' || user === '0') {
        this.showModal('错误', '不能删除root用户！')
        return true
      }

      if (user === 'nobody' || user === 'daemon' || user === 'bin' || user === 'sys' || user === 'sync' || user === 'games' || user === 'man' || user === 'lp' || user === 'mail' || user === 'news' || user === 'uucp' || user === 'proxy' || user === 'www-data' || user === 'backup' || user === 'list' || user === 'irc' || user === 'gnats') {
        this.showModal('错误', `不能删除系统用户 ${user}！\n\n此用户是系统正常运行所必需的。`)
        return true
      }

      this.showDeleteConfirmation(user)
      return true
    }

    return false
  }

  protected resolveAction(action: string): MenuAction | null {
    const user = this.currentUser
    const actions: Record<string, MenuAction> = {
      // 基本信息
      'user-details': { command: `id ${user} 2>/dev/null && echo "" && grep "^${user}:" /etc/passwd 2>/dev/null || echo "无法获取用户详情"`, title: `用户详情 - ${user}`, actionName: '查看用户详情' },
      'group-info': { command: `groups ${user} 2>/dev/null && echo "" && id ${user} 2>/dev/null || echo "无法获取用户组信息"`, title: `用户组信息 - ${user}`, actionName: '查看用户组信息' },
      'home-dir': { command: `eval echo ~${user} | xargs -I {} sh -c 'echo "主目录: {}" && ls -lad {} 2>/dev/null && echo "" && du -sh {} 2>/dev/null' || echo "无法获取主目录信息"`, title: `主目录信息 - ${user}`, actionName: '查看主目录信息' },
      // 用户管理
      'lock-user': { command: `echo "锁定用户: ${user}"; echo ""; echo "命令: passwd -l ${user}"; echo "⚠️ 需要root权限执行"; echo ""; echo "执行: sudo passwd -l ${user}"`, title: `锁定用户 - ${user}`, actionName: '锁定用户账户' },
      'unlock-user': { command: `echo "解锁用户: ${user}"; echo ""; echo "命令: passwd -u ${user}"; echo "⚠️ 需要root权限执行"; echo ""; echo "执行: sudo passwd -u ${user}"`, title: `解锁用户 - ${user}`, actionName: '解锁用户账户' },
      'passwd-expire': { command: `chage -l ${user} 2>/dev/null || echo "⚠️ 需要root权限查看密码过期信息"`, title: `密码过期时间 - ${user}`, actionName: '查看密码过期时间' },
      'user-status': { command: `echo "=== 用户账户状态 ==="; echo ""; passwd -S ${user} 2>/dev/null || echo "⚠️ 需要root权限"; echo ""; echo "=== 最后登录 ==="; lastlog -u ${user} 2>/dev/null || echo "无登录记录"`, title: `账户状态 - ${user}`, actionName: '查看账户状态' },
      // 权限分析
      'sudo-permissions': { command: `echo "=== sudo权限检查 ==="; echo ""; sudo -l -U ${user} 2>/dev/null || echo "⚠️ 需要root权限或用户无sudo权限"; echo ""; echo "=== sudoers文件检查 ==="; grep -E "^${user}|^%.*${user}" /etc/sudoers 2>/dev/null || echo "sudoers文件中未找到配置"`, title: `sudo权限 - ${user}`, actionName: '查看sudo权限' },
      'group-membership': { command: `echo "=== 用户组成员 ==="; echo ""; groups ${user} 2>/dev/null; echo ""; echo "=== 详细组信息 ==="; id ${user} 2>/dev/null`, title: `用户组成员 - ${user}`, actionName: '查看用户组成员' },
      'ssh-keys': { command: `home=$(eval echo ~${user}); echo "=== SSH公钥 ==="; echo ""; cat "$home/.ssh/authorized_keys" 2>/dev/null || echo "无SSH公钥"; echo ""; echo "=== SSH私钥 ==="; ls -la "$home/.ssh/" 2>/dev/null | grep -E "id_.*[^.pub]$" || echo "无SSH私钥"`, title: `SSH密钥 - ${user}`, actionName: '查看SSH密钥' },
      // 活动监控
      'login-history': { command: `last ${user} -n 20 2>/dev/null || echo "无登录历史"`, title: `登录历史 - ${user}`, actionName: '查看登录历史' },
      'current-sessions': { command: `who | grep "^${user} " || w ${user} 2>/dev/null || echo "用户当前未登录"`, title: `当前会话 - ${user}`, actionName: '查看当前会话' },
      'failed-logins': { command: `lastb ${user} -n 20 2>/dev/null || grep "${user}" /var/log/auth.log 2>/dev/null | grep -i failed | tail -20 || echo "无失败登录记录"`, title: `登录失败记录 - ${user}`, actionName: '查看登录失败记录' },
      'last-login': { command: `lastlog -u ${user} 2>/dev/null || last ${user} -n 1 2>/dev/null || echo "无登录记录"`, title: `最后登录时间 - ${user}`, actionName: '查看最后登录时间' },
      // 资源使用
      'user-processes': { command: `ps -u ${user} -o pid,ppid,%cpu,%mem,vsz,rss,tty,stat,start,time,cmd 2>/dev/null || echo "用户没有运行的进程"`, title: `用户进程 - ${user}`, actionName: '查看用户进程' },
      'disk-usage': { command: `home=$(eval echo ~${user}); echo "=== 主目录磁盘使用 ==="; echo ""; du -sh "$home" 2>/dev/null || echo "无法获取"; echo ""; echo "=== 详细统计 ==="; du -h --max-depth=1 "$home" 2>/dev/null | sort -hr | head -20 || echo "无法获取详细统计"`, title: `磁盘使用 - ${user}`, actionName: '查看磁盘使用' },
      'open-files': { command: `lsof -u ${user} 2>/dev/null | head -100 || echo "⚠️ 需要root权限或用户无打开的文件"`, title: `打开的文件 - ${user}`, actionName: '查看打开的文件' },
      // 安全检查
      'abnormal-login': { command: `echo "=== 异常登录检查 ==="; echo ""; echo "1. 非工作时间登录:"; last ${user} 2>/dev/null | awk '{if($7 ~ /[0-2][0-9]:[0-5][0-9]/ || $7 ~ /0[0-6]:[0-5][0-9]/) print}' | head -10 || echo "无记录"; echo ""; echo "2. 异地登录:"; last ${user} -i 2>/dev/null | head -20 || echo "无记录"`, title: `异常登录检查 - ${user}`, actionName: '检查异常登录' },
      'crontab': { command: `echo "=== 用户定时任务 ==="; echo ""; crontab -u ${user} -l 2>/dev/null || echo "无定时任务或需要权限"; echo ""; echo "=== 系统定时任务 ==="; grep -r "${user}" /etc/cron* 2>/dev/null | head -20 || echo "无相关系统定时任务"`, title: `定时任务 - ${user}`, actionName: '查看定时任务' },
      'ssh-config': { command: `home=$(eval echo ~${user}); echo "=== SSH客户端配置 ==="; echo ""; cat "$home/.ssh/config" 2>/dev/null || echo "无SSH配置文件"; echo ""; echo "=== known_hosts ==="; wc -l "$home/.ssh/known_hosts" 2>/dev/null || echo "无known_hosts文件"`, title: `SSH配置 - ${user}`, actionName: '查看SSH配置' },
      'suspicious-files': { command: `home=$(eval echo ~${user}); echo "=== 可疑文件检查 ==="; echo ""; echo "1. 隐藏文件:"; find "$home" -name ".*" -type f 2>/dev/null | head -20; echo ""; echo "2. 最近修改的文件:"; find "$home" -type f -mtime -7 2>/dev/null | head -20`, title: `可疑文件检查 - ${user}`, actionName: '检查可疑文件' },
      'suid-files': { command: `home=$(eval echo ~${user}); echo "=== SUID文件检查 ==="; echo ""; find "$home" -perm -4000 -type f 2>/dev/null | head -20 || echo "未找到SUID文件"; echo ""; echo "=== SGID文件检查 ==="; find "$home" -perm -2000 -type f 2>/dev/null | head -20 || echo "未找到SGID文件"`, title: `SUID文件 - ${user}`, actionName: '查看SUID文件' },
      // 快速操作
      'kill-sessions': { command: `echo "强制退出用户会话: ${user}"; echo ""; echo "命令: pkill -u ${user} 或 killall -u ${user}"; echo "⚠️ 需要root权限执行"; echo ""; ps -u ${user} -o pid,cmd 2>/dev/null || echo "用户没有运行的进程"`, title: `强制退出会话 - ${user}`, actionName: '强制退出所有会话' },
      'disable-ssh': { command: `echo "禁用SSH登录: ${user}"; echo ""; echo "方法1: 编辑 /etc/ssh/sshd_config"; echo "添加: DenyUsers ${user}"; echo ""; echo "方法2: 使用PAM"; echo "编辑 /etc/security/access.conf"; echo "添加: -:${user}:ALL"; echo ""; echo "⚠️ 需要root权限执行并重启SSH服务"`, title: `禁用SSH登录 - ${user}`, actionName: '禁用SSH登录' },
    }

    return actions[action] || null
  }

  /**
   * 显示删除用户确认对话框
   */
  private async showDeleteConfirmation(username: string) {
    // 查询用户真实主目录（多方法兜底）
    let homeDir = `/home/${username}`;
    try {
      const result = await invoke('ssh_execute_command_direct', {
        command: `getent passwd ${username} 2>/dev/null | cut -d: -f6 | grep -v '^$' || awk -F: -v u="${username}" '$1==u{print $6}' /etc/passwd 2>/dev/null`
      }) as { output: string; exit_code: number };
      const parsed = (result.output || '').split('\n').map(l => l.trim()).filter(l => l.startsWith('/'))[0];
      if (parsed) {
        homeDir = parsed;
      }
    } catch (_) { /* fallback to default */ }

    // 创建确认对话框
    const confirmModal = document.createElement('div')
    confirmModal.id = 'delete-user-confirm-modal'
    confirmModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10002;
    `

    const homeDirWarning = homeDir !== `/home/${username}`
      ? `<div style="margin-bottom: var(--spacing-sm); padding: var(--spacing-sm); background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: var(--border-radius-sm);">
           <strong style="color: #f59e0b;">⚠ 注意：该用户主目录不在默认位置！</strong>
         </div>`
      : '';

    confirmModal.innerHTML = `
      <div class="modal-content" style="
        background: var(--bg-primary);
        border-radius: var(--border-radius);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        max-width: 500px;
        width: 90%;
        padding: 0;
      ">
        <div class="modal-header" style="
          padding: var(--spacing-md);
          border-bottom: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        ">
          ${IconPark.Delete({ theme: 'filled', size: '24', fill: '#ef4444' })}
          <h3 style="margin: 0; color: #ef4444; font-size: 18px;">删除用户确认</h3>
        </div>
        <div class="modal-body" style="
          padding: var(--spacing-md);
          color: var(--text-primary);
        ">
          <div style="margin-bottom: var(--spacing-md);">
            <strong style="color: #ef4444;">⚠️ 危险操作：即将删除用户 <code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 4px;">${username}</code></strong>
          </div>

          ${homeDirWarning}

          <div style="margin-bottom: var(--spacing-md);">
            <strong>此操作将永久删除：</strong>
            <ul style="margin: 8px 0; padding-left: 20px;">
              <li>用户账户 <code>${username}</code></li>
              <li>用户主目录 <code>${homeDir}</code></li>
              <li>用户邮件池</li>
              <li>用户所属的组（如果组中没有其他用户）</li>
            </ul>
          </div>

          <div style="margin-bottom: var(--spacing-md); padding: var(--spacing-sm); background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: var(--border-radius-sm);">
            <strong style="color: #ef4444;">⚠️ 此操作不可撤销！</strong>
          </div>

          <div style="margin-bottom: var(--spacing-md);">
            <strong>执行前请确认：</strong>
            <ul style="margin: 8px 0; padding-left: 20px; font-size: 13px;">
              <li>✓ 用户没有重要数据需要备份</li>
              <li>✓ 用户没有正在运行的进程</li>
              <li>✓ 已备份所有重要文件</li>
              <li>✓ 确认此用户不再需要</li>
            </ul>
          </div>

          <div style="padding: var(--spacing-sm); background: var(--bg-secondary); border-radius: var(--border-radius-sm); font-family: var(--font-mono); font-size: 12px;">
            <strong>执行命令：</strong><br>
            sudo pkill -9 -u ${username}  <span style="color: var(--text-secondary);"># 终止所有进程</span><br>
            sudo userdel -rf ${username}  <span style="color: var(--text-secondary);"># 强制删除用户</span>
          </div>
        </div>
        <div class="modal-footer" style="
          padding: var(--spacing-md);
          border-top: 1px solid var(--border-color);
          display: flex;
          justify-content: flex-end;
          gap: var(--spacing-sm);
        ">
          <button id="delete-user-cancel" class="modern-btn secondary" style="
            padding: 8px 16px;
            font-size: 14px;
          ">取消</button>
          <button id="delete-user-confirm" class="modern-btn danger" style="
            padding: 8px 16px;
            font-size: 14px;
            background: #ef4444;
            border-color: #ef4444;
          ">确认删除</button>
        </div>
      </div>
    `

    document.body.appendChild(confirmModal)

    // 绑定事件
    document.getElementById('delete-user-cancel')?.addEventListener('click', () => {
      document.body.removeChild(confirmModal)
    })

    document.getElementById('delete-user-confirm')?.addEventListener('click', async () => {
      document.body.removeChild(confirmModal)
      await this.executeDeleteUser(username)
    })

    // 点击外部关闭
    confirmModal.addEventListener('click', (e) => {
      if (e.target === confirmModal) {
        document.body.removeChild(confirmModal)
      }
    })

    // ESC键关闭
    const escHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        document.body.removeChild(confirmModal)
        document.removeEventListener('keydown', escHandler)
      }
    }
    document.addEventListener('keydown', escHandler)
  }

  /**
   * 执行删除用户操作 — 先杀进程再删除，验证结果
   */
  private async executeDeleteUser(username: string) {
    const title = `删除用户 - ${username}`

    try {
      const accountInfo = this.selectedUsername ? ` (账号: ${this.selectedUsername})` : ''
      this.showModal(title, `⏳ 正在删除用户: ${username}${accountInfo}...`)

      const makeParams = (command: string) => {
        const p: any = { command }
        if (this.selectedUsername) p.username = this.selectedUsername
        return p
      }

      // Step 1: 查询该用户的运行中进程
      const psResult = await invoke('ssh_execute_command_direct', makeParams(
        `ps -u ${username} -o pid,comm --no-headers 2>/dev/null`
      )) as { output: string; exit_code: number }

      const hasProcesses = psResult.exit_code === 0 && psResult.output.trim().length > 0

      // Step 2: 如果有进程，先强制终止
      if (hasProcesses) {
        this.showModal(title, `⏳ 正在终止用户 ${username} 的所有进程...\n\n运行中进程:\n${psResult.output.trim()}`)
        await invoke('ssh_execute_command_direct', makeParams(
          `sudo pkill -9 -u ${username} 2>/dev/null; sleep 1`
        ))
      }

      // Step 3: 执行 userdel -rf 强制删除
      await invoke('ssh_execute_command_direct', makeParams(
        `sudo userdel -rf ${username} 2>&1`
      ))

      // Step 4: 验证用户是否真的被删除（不依赖 userdel 的 exit_code）
      const verifyResult = await invoke('ssh_execute_command_direct', makeParams(
        `id ${username} 2>&1`
      )) as { output: string; exit_code: number }

      if (verifyResult.exit_code !== 0) {
        // id 命令返回非0 = 用户已不存在 = 删除成功
        const killInfo = hasProcesses ? '\n(已自动终止该用户的所有进程)' : ''
        this.showModal(title, `✅ 用户 ${username} 删除成功！${killInfo}`)
        window.showNotification?.(`用户 ${username} 删除成功`, 'success')
      } else {
        this.showModal(title, `❌ 删除用户失败，用户仍然存在\n\n${verifyResult.output}\n\n💡 提示: 可在终端中手动执行:\nsudo pkill -9 -u ${username} && sudo userdel -rf ${username}`)
        window.showNotification?.(`删除用户 ${username} 失败，用户仍然存在`, 'error')
      }
    } catch (error) {
      this.showModal(title, `❌ 删除用户失败: ${error}`)
      window.showNotification?.(`删除用户 ${username} 失败: ${error}`, 'error')
    }
  }
}
