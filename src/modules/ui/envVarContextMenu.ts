/**
 * 环境变量右键菜单管理器
 */

import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class EnvVarContextMenu extends BaseContextMenu {
  private currentVar: any = {}

  constructor() {
    super('envvar')
  }

  protected onShowContextMenu(envVar: any) {
    this.currentVar = envVar
  }

  protected async handleSpecialAction(action: string): Promise<boolean> {
    if (action === 'copy-name') {
      try {
        await navigator.clipboard.writeText(this.currentVar.name || '')
        ;window.showNotification?.('变量名已复制', 'success')
      } catch { /* ignore */ }
      return true
    }
    if (action === 'copy-value') {
      try {
        await navigator.clipboard.writeText(this.currentVar.value || '')
        ;window.showNotification?.('变量值已复制', 'success')
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
          <span>基本信息</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="view-full-value">
            <span class="menu-label">
              ${IconPark.FullScreen({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看完整值</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-name">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制变量名</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-value">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制变量值</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Shield({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>安全检查</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="trace-source">
            <span class="menu-label">
              ${IconPark.Search({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>追踪变量来源</span>
            </span>
          </div>
          <div class="menu-item" data-action="check-ld-preload">
            <span class="menu-label">
              ${IconPark.Caution({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>检查LD_PRELOAD劫持</span>
            </span>
          </div>
          <div class="menu-item" data-action="check-path-dirs">
            <span class="menu-label">
              ${IconPark.FolderOpen({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>检查PATH目录权限</span>
            </span>
          </div>
          <div class="menu-item" data-action="env-all-users">
            <span class="menu-label">
              ${IconPark.Peoples({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>各用户该变量值</span>
            </span>
          </div>
        </div>
      </div>
    `
  }

  protected resolveAction(action: string): MenuAction | null {
    const name = this.currentVar.name || ''
    const value = this.currentVar.value || ''

    const actions: Record<string, MenuAction> = {
      'view-full-value': {
        command: `echo "${name}=" && echo '${value}'`,
        title: `${name} 完整值`,
        actionName: '查看完整值'
      },
      'trace-source': {
        command: `grep -rn '${name}' /etc/profile /etc/profile.d/ /etc/environment /etc/bash.bashrc ~/.bashrc ~/.profile 2>/dev/null | head -20`,
        title: `变量来源 - ${name}`,
        actionName: '追踪变量来源'
      },
      'check-ld-preload': {
        command: `echo 'LD_PRELOAD:' && echo $LD_PRELOAD && echo '---/etc/ld.so.preload:' && cat /etc/ld.so.preload 2>/dev/null || echo '文件不存在' && echo '---LD_LIBRARY_PATH:' && echo $LD_LIBRARY_PATH`,
        title: 'LD_PRELOAD 劫持检查',
        actionName: '检查LD_PRELOAD'
      },
      'check-path-dirs': {
        command: `echo "$PATH" | tr ':' '\\n' | while read dir; do echo "--- $dir ---"; ls -ld "$dir" 2>/dev/null || echo '目录不存在'; done`,
        title: 'PATH 目录权限检查',
        actionName: '检查PATH目录权限'
      },
      'env-all-users': {
        command: `for user in $(getent passwd | cut -d: -f1 | head -20); do echo "=== $user ==="; su - $user -c "echo \\$${name}" 2>/dev/null; done`,
        title: `各用户 ${name} 值`,
        actionName: '查看各用户变量值'
      }
    }

    return actions[action] || null
  }
}
