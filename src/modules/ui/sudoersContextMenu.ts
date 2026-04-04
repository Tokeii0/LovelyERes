/**
 * Sudoers配置右键菜单管理器
 */

import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class SudoersContextMenu extends BaseContextMenu {
  private currentEntry: any = {}

  constructor() {
    super('sudoers')
  }

  protected onShowContextMenu(entry: any) {
    this.currentEntry = entry
  }

  protected async handleSpecialAction(action: string): Promise<boolean> {
    if (action === 'copy-rule') {
      try {
        const rule = `${this.currentEntry.user} ${this.currentEntry.host}=(ALL) ${this.currentEntry.nopasswd === 'YES' ? 'NOPASSWD:' : ''} ${this.currentEntry.command}`
        await navigator.clipboard.writeText(rule)
        ;(window as any).showNotification?.('规则已复制', 'success')
      } catch { /* ignore */ }
      return true
    }
    return false
  }

  protected getMenuItemsHTML(): string {
    return `
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Info({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>配置查看</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="view-sudoers">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看sudoers主文件</span>
            </span>
          </div>
          <div class="menu-item" data-action="view-source-file">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看来源配置文件</span>
            </span>
          </div>
          <div class="menu-item" data-action="check-syntax">
            <span class="menu-label">
              ${IconPark.CheckOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>语法检查(visudo -c)</span>
            </span>
          </div>
          <div class="menu-item" data-action="list-sudoers-d">
            <span class="menu-label">
              ${IconPark.FolderOpen({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>列出sudoers.d目录</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-rule">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制规则</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.User({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>用户分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="user-permissions">
            <span class="menu-label">
              ${IconPark.Shield({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>该用户完整权限</span>
            </span>
          </div>
          <div class="menu-item" data-action="user-sudo-history">
            <span class="menu-label">
              ${IconPark.Log({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>该用户sudo历史</span>
            </span>
          </div>
          <div class="menu-item" data-action="user-groups">
            <span class="menu-label">
              ${IconPark.Group({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>该用户组信息</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-divider"></div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Caution({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>应急操作</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="backup-sudoers">
            <span class="menu-label">
              ${IconPark.Save({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>备份sudoers配置</span>
            </span>
          </div>
          <div class="menu-item" data-action="find-nopasswd">
            <span class="menu-label">
              ${IconPark.Search({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查找所有NOPASSWD规则</span>
            </span>
          </div>
        </div>
      </div>
    `
  }

  protected resolveAction(action: string): MenuAction | null {
    const entry = this.currentEntry
    const user = entry.user || ''
    const source = entry.source || '/etc/sudoers'

    const actions: Record<string, MenuAction> = {
      'view-sudoers': {
        command: `cat /etc/sudoers 2>/dev/null | grep -v '^#' | grep -v '^$'`,
        title: 'sudoers 主文件',
        actionName: '查看sudoers'
      },
      'view-source-file': {
        command: `cat ${source} 2>/dev/null || echo '文件不存在或无权限'`,
        title: `配置来源 - ${source}`,
        actionName: '查看配置来源'
      },
      'check-syntax': {
        command: `visudo -c 2>&1 && echo '✓ 语法检查通过'`,
        title: 'sudoers 语法检查',
        actionName: '语法检查'
      },
      'list-sudoers-d': {
        command: `ls -la /etc/sudoers.d/ 2>/dev/null && echo '---内容:' && cat /etc/sudoers.d/* 2>/dev/null | grep -v '^#' | grep -v '^$'`,
        title: 'sudoers.d 目录',
        actionName: '列出sudoers.d'
      },
      'user-permissions': {
        command: `sudo -l -U ${user} 2>/dev/null || echo '无法查看权限'`,
        title: `权限 - ${user}`,
        actionName: '查看用户权限'
      },
      'user-sudo-history': {
        command: `grep "${user}" /var/log/auth.log 2>/dev/null | grep sudo | tail -30 || journalctl _COMM=sudo | grep "${user}" | tail -30`,
        title: `sudo历史 - ${user}`,
        actionName: '查看sudo历史'
      },
      'user-groups': {
        command: `id ${user} && echo '---' && groups ${user}`,
        title: `组信息 - ${user}`,
        actionName: '查看用户组'
      },
      'backup-sudoers': {
        command: `cp /etc/sudoers /etc/sudoers.bak.$(date +%Y%m%d%H%M%S) && echo '✓ 已备份到 /etc/sudoers.bak.'$(date +%Y%m%d%H%M%S)`,
        title: '备份 sudoers',
        actionName: '备份sudoers'
      },
      'find-nopasswd': {
        command: `grep -rn 'NOPASSWD' /etc/sudoers /etc/sudoers.d/ 2>/dev/null`,
        title: 'NOPASSWD 规则',
        actionName: '查找NOPASSWD规则'
      }
    }

    return actions[action] || null
  }
}
