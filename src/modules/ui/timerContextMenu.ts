/**
 * Systemd定时器右键菜单管理器
 */

import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class TimerContextMenu extends BaseContextMenu {
  private currentTimer: any = {}

  constructor() {
    super('timer')
  }

  protected onShowContextMenu(timer: any) {
    this.currentTimer = timer
  }

  protected async handleSpecialAction(action: string): Promise<boolean> {
    if (action === 'copy-name') {
      try {
        await navigator.clipboard.writeText(this.currentTimer.timer || '')
        ;(window as any).showNotification?.('定时器名已复制', 'success')
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
          <span>定时器信息</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="timer-status">
            <span class="menu-label">
              ${IconPark.CheckOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>定时器状态</span>
            </span>
          </div>
          <div class="menu-item" data-action="timer-config">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>定时器配置</span>
            </span>
          </div>
          <div class="menu-item" data-action="unit-status">
            <span class="menu-label">
              ${IconPark.PlayOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>触发单元状态</span>
            </span>
          </div>
          <div class="menu-item" data-action="unit-config">
            <span class="menu-label">
              ${IconPark.SettingConfig({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>触发单元配置</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-name">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制定时器名</span>
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
          <div class="menu-item" data-action="timer-logs">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>定时器日志</span>
            </span>
          </div>
          <div class="menu-item" data-action="unit-logs">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>触发单元日志</span>
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
          <div class="menu-item" data-action="stop-timer">
            <span class="menu-label">
              ${IconPark.PauseOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>停止定时器</span>
            </span>
          </div>
          <div class="menu-item" data-action="disable-timer">
            <span class="menu-label">
              ${IconPark.CloseOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>禁用定时器</span>
            </span>
          </div>
          <div class="menu-item" data-action="mask-timer">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>屏蔽定时器(mask)</span>
            </span>
          </div>
        </div>
      </div>
    `
  }

  protected resolveAction(action: string): MenuAction | null {
    const timer = this.currentTimer.timer || ''
    const activates = this.currentTimer.activates || timer.replace('.timer', '.service')

    const actions: Record<string, MenuAction> = {
      'timer-status': {
        command: `systemctl status ${timer} --no-pager`,
        title: `定时器状态 - ${timer}`,
        actionName: '查看定时器状态'
      },
      'timer-config': {
        command: `systemctl cat ${timer} --no-pager`,
        title: `定时器配置 - ${timer}`,
        actionName: '查看定时器配置'
      },
      'unit-status': {
        command: `systemctl status ${activates} --no-pager`,
        title: `单元状态 - ${activates}`,
        actionName: '查看触发单元状态'
      },
      'unit-config': {
        command: `systemctl cat ${activates} --no-pager`,
        title: `单元配置 - ${activates}`,
        actionName: '查看触发单元配置'
      },
      'timer-logs': {
        command: `journalctl -u ${timer} --no-pager -n 50`,
        title: `日志 - ${timer}`,
        actionName: '查看定时器日志'
      },
      'unit-logs': {
        command: `journalctl -u ${activates} --no-pager -n 50`,
        title: `日志 - ${activates}`,
        actionName: '查看触发单元日志'
      },
      'stop-timer': {
        command: `systemctl stop ${timer} && echo '✓ 定时器已停止' && systemctl status ${timer} --no-pager`,
        title: `停止 - ${timer}`,
        actionName: '停止定时器'
      },
      'disable-timer': {
        command: `systemctl disable ${timer} && echo '✓ 定时器已禁用' && systemctl status ${timer} --no-pager`,
        title: `禁用 - ${timer}`,
        actionName: '禁用定时器'
      },
      'mask-timer': {
        command: `systemctl mask ${timer} && echo '✓ 定时器已屏蔽' && systemctl status ${timer} --no-pager`,
        title: `屏蔽 - ${timer}`,
        actionName: '屏蔽定时器'
      }
    }

    return actions[action] || null
  }
}
