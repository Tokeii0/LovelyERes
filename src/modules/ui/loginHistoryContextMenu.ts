/**
 * 登录历史右键菜单管理器
 */

import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class LoginHistoryContextMenu extends BaseContextMenu {
  private currentEntry: any = {}

  constructor() {
    super('loginhistory')
  }

  protected onShowContextMenu(entry: any) {
    this.currentEntry = entry
  }

  protected async handleSpecialAction(action: string): Promise<boolean> {
    if (action === 'copy-ip') {
      try {
        await navigator.clipboard.writeText(this.currentEntry.source || '')
        ;window.showNotification?.('IP地址已复制', 'success')
      } catch { /* ignore */ }
      return true
    }
    return false
  }

  protected getMenuItemsHTML(): string {
    return `
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.User({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>用户分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="user-details">
            <span class="menu-label">
              ${IconPark.Info({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>用户详情</span>
            </span>
          </div>
          <div class="menu-item" data-action="user-login-count">
            <span class="menu-label">
              ${IconPark.Data({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>该用户登录统计</span>
            </span>
          </div>
          <div class="menu-item" data-action="user-failed-count">
            <span class="menu-label">
              ${IconPark.Caution({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>该用户失败登录</span>
            </span>
          </div>
          <div class="menu-item" data-action="user-sudo-history">
            <span class="menu-label">
              ${IconPark.Shield({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>该用户sudo记录</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Earth({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>来源分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="ip-logins">
            <span class="menu-label">
              ${IconPark.List({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>来自此IP的所有登录</span>
            </span>
          </div>
          <div class="menu-item" data-action="whois">
            <span class="menu-label">
              ${IconPark.Search({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>Whois查询</span>
            </span>
          </div>
          <div class="menu-item" data-action="reverse-dns">
            <span class="menu-label">
              ${IconPark.LinkCloud({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>反向DNS解析</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-ip">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制IP地址</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Log({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>日志审计</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="auth-logs">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>认证日志</span>
            </span>
          </div>
          <div class="menu-item" data-action="recent-failures">
            <span class="menu-label">
              ${IconPark.CloseOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>最近失败登录</span>
            </span>
          </div>
          <div class="menu-item" data-action="brute-force-check">
            <span class="menu-label">
              ${IconPark.Caution({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>暴力破解检测</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-divider"></div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Shield({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>应急操作</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="block-ip">
            <span class="menu-label">
              ${IconPark.CloseOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>封禁来源IP</span>
            </span>
          </div>
          <div class="menu-item" data-action="lock-user">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>锁定该用户</span>
            </span>
          </div>
        </div>
      </div>
    `
  }

  protected resolveAction(action: string): MenuAction | null {
    const entry = this.currentEntry
    const user = entry.user || ''
    const source = entry.source || ''

    const actions: Record<string, MenuAction> = {
      'user-details': {
        command: `id ${user} && echo '---' && getent passwd ${user} && echo '---' && chage -l ${user} 2>/dev/null`,
        title: `用户详情 - ${user}`,
        actionName: '查看用户详情'
      },
      'user-login-count': {
        command: `last ${user} | head -50 && echo '---总计:' && last ${user} | grep -c "${user}"`,
        title: `登录统计 - ${user}`,
        actionName: '查看登录统计'
      },
      'user-failed-count': {
        command: `lastb ${user} 2>/dev/null | head -50 && echo '---总计:' && lastb ${user} 2>/dev/null | grep -c "${user}"`,
        title: `失败登录 - ${user}`,
        actionName: '查看失败登录'
      },
      'user-sudo-history': {
        command: `grep "${user}" /var/log/auth.log 2>/dev/null | grep sudo | tail -30 || journalctl _COMM=sudo | grep "${user}" | tail -30`,
        title: `sudo记录 - ${user}`,
        actionName: '查看sudo记录'
      },
      'ip-logins': {
        command: `last -i | grep "${source}" | head -30`,
        title: `来自 ${source} 的登录`,
        actionName: '查看IP登录记录'
      },
      'whois': {
        command: `whois ${source} 2>/dev/null | head -50 || echo 'whois命令不可用'`,
        title: `Whois - ${source}`,
        actionName: 'Whois查询'
      },
      'reverse-dns': {
        command: `host ${source} 2>/dev/null || nslookup ${source} 2>/dev/null || dig -x ${source} +short 2>/dev/null || echo 'DNS解析失败'`,
        title: `反向DNS - ${source}`,
        actionName: '反向DNS解析'
      },
      'auth-logs': {
        command: `grep "${user}" /var/log/auth.log 2>/dev/null | tail -50 || journalctl -u sshd --no-pager | grep "${user}" | tail -50`,
        title: `认证日志 - ${user}`,
        actionName: '查看认证日志'
      },
      'recent-failures': {
        command: `lastb 2>/dev/null | head -30 || echo '无法读取btmp'`,
        title: '最近失败登录',
        actionName: '查看失败登录'
      },
      'brute-force-check': {
        command: `grep 'Failed password' /var/log/auth.log 2>/dev/null | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn | head -20 || journalctl -u sshd --no-pager | grep 'Failed password' | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn | head -20`,
        title: '暴力破解检测',
        actionName: '暴力破解检测'
      },
      'block-ip': {
        command: `echo '⚠️ 将封禁IP: ${source}' && iptables -A INPUT -s ${source} -j DROP 2>/dev/null && echo '✓ 已通过iptables封禁' || echo '封禁失败，请检查权限'`,
        title: `封禁IP - ${source}`,
        actionName: '封禁来源IP'
      },
      'lock-user': {
        command: `passwd -l ${user} && echo '✓ 用户 ${user} 已锁定' || echo '锁定失败，请检查权限'`,
        title: `锁定用户 - ${user}`,
        actionName: '锁定用户'
      }
    }

    return actions[action] || null
  }
}
