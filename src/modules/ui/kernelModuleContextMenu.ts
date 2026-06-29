/**
 * 内核模块右键菜单管理器
 */

import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class KernelModuleContextMenu extends BaseContextMenu {
  private currentModule: any = {}

  constructor() {
    super('kernelmodule')
  }

  protected onShowContextMenu(mod: any) {
    this.currentModule = mod
  }

  protected async handleSpecialAction(action: string): Promise<boolean> {
    if (action === 'copy-name') {
      try {
        await navigator.clipboard.writeText(this.currentModule.name || '')
        ;window.showNotification?.('模块名已复制', 'success')
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
          <span>模块信息</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="module-info">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>模块详情(modinfo)</span>
            </span>
          </div>
          <div class="menu-item" data-action="module-deps">
            <span class="menu-label">
              ${IconPark.LinkOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>模块依赖关系</span>
            </span>
          </div>
          <div class="menu-item" data-action="module-params">
            <span class="menu-label">
              ${IconPark.SettingConfig({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>模块参数</span>
            </span>
          </div>
          <div class="menu-item" data-action="module-path">
            <span class="menu-label">
              ${IconPark.FolderOpen({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>模块文件路径</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-name">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制模块名</span>
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
          <div class="menu-item" data-action="check-signing">
            <span class="menu-label">
              ${IconPark.Key({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>检查模块签名</span>
            </span>
          </div>
          <div class="menu-item" data-action="check-taint">
            <span class="menu-label">
              ${IconPark.Caution({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>检查内核污染标志</span>
            </span>
          </div>
          <div class="menu-item" data-action="check-hash">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>模块文件哈希</span>
            </span>
          </div>
          <div class="menu-item" data-action="dmesg-module">
            <span class="menu-label">
              ${IconPark.Log({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>相关dmesg日志</span>
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
          <div class="menu-item" data-action="unload-module">
            <span class="menu-label">
              ${IconPark.ReduceOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>卸载模块(rmmod)</span>
            </span>
          </div>
          <div class="menu-item" data-action="blacklist-module">
            <span class="menu-label">
              ${IconPark.CloseOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>加入黑名单</span>
            </span>
          </div>
        </div>
      </div>
    `
  }

  protected resolveAction(action: string): MenuAction | null {
    const name = this.currentModule.name || ''

    const actions: Record<string, MenuAction> = {
      'module-info': {
        command: `modinfo ${name} 2>/dev/null || echo '无法获取模块信息'`,
        title: `模块详情 - ${name}`,
        actionName: '查看模块详情'
      },
      'module-deps': {
        command: `modinfo -F depends ${name} 2>/dev/null && echo '---被依赖:' && lsmod | grep ${name}`,
        title: `依赖关系 - ${name}`,
        actionName: '查看依赖关系'
      },
      'module-params': {
        command: `modinfo -p ${name} 2>/dev/null || echo '无参数信息' && echo '---当前参数:' && cat /sys/module/${name}/parameters/* 2>/dev/null || echo '无运行时参数'`,
        title: `参数 - ${name}`,
        actionName: '查看模块参数'
      },
      'module-path': {
        command: `modinfo -n ${name} 2>/dev/null && echo '---' && modinfo -F filename ${name} 2>/dev/null | xargs ls -la`,
        title: `文件路径 - ${name}`,
        actionName: '查看模块路径'
      },
      'check-signing': {
        command: `modinfo -F sig_id ${name} 2>/dev/null && modinfo -F signer ${name} 2>/dev/null || echo '模块未签名或无签名信息'`,
        title: `签名 - ${name}`,
        actionName: '检查模块签名'
      },
      'check-taint': {
        command: `cat /proc/sys/kernel/tainted && echo '---说明: 0=无污染, 非0=有污染' && echo '---taint flags:' && cat /proc/sys/kernel/tainted`,
        title: '内核污染标志',
        actionName: '检查内核污染'
      },
      'check-hash': {
        command: `modpath=$(modinfo -n ${name} 2>/dev/null) && echo "MD5:" && md5sum "$modpath" && echo "SHA256:" && sha256sum "$modpath"`,
        title: `哈希 - ${name}`,
        actionName: '计算模块哈希'
      },
      'dmesg-module': {
        command: `dmesg | grep -i "${name}" | tail -30 || echo '无相关日志'`,
        title: `dmesg - ${name}`,
        actionName: '查看dmesg日志'
      },
      'unload-module': {
        command: `rmmod ${name} 2>&1 && echo '✓ 模块已卸载' || echo '❌ 卸载失败（可能正在使用）'`,
        title: `卸载 - ${name}`,
        actionName: '卸载模块'
      },
      'blacklist-module': {
        command: `echo "blacklist ${name}" >> /etc/modprobe.d/blacklist-emergency.conf && echo "install ${name} /bin/false" >> /etc/modprobe.d/blacklist-emergency.conf && echo '✓ 已加入黑名单: /etc/modprobe.d/blacklist-emergency.conf'`,
        title: `黑名单 - ${name}`,
        actionName: '加入黑名单'
      }
    }

    return actions[action] || null
  }
}
