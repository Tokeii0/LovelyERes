/**
 * 已安装软件包右键菜单管理器
 */

import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class PackageContextMenu extends BaseContextMenu {
  private currentPkg: any = {}

  constructor() {
    super('package')
  }

  protected onShowContextMenu(pkg: any) {
    this.currentPkg = pkg
  }

  protected async handleSpecialAction(action: string): Promise<boolean> {
    if (action === 'copy-name') {
      try {
        await navigator.clipboard.writeText(this.currentPkg.name || '')
        ;window.showNotification?.('包名已复制', 'success')
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
          <span>软件包信息</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="package-details">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>包详细信息</span>
            </span>
          </div>
          <div class="menu-item" data-action="package-files">
            <span class="menu-label">
              ${IconPark.FolderOpen({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>列出包文件</span>
            </span>
          </div>
          <div class="menu-item" data-action="package-deps">
            <span class="menu-label">
              ${IconPark.LinkOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看依赖关系</span>
            </span>
          </div>
          <div class="menu-item" data-action="package-changelog">
            <span class="menu-label">
              ${IconPark.Log({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>变更日志</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-name">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制包名</span>
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
          <div class="menu-item" data-action="verify-integrity">
            <span class="menu-label">
              ${IconPark.CheckOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>验证完整性</span>
            </span>
          </div>
          <div class="menu-item" data-action="check-config-files">
            <span class="menu-label">
              ${IconPark.SettingConfig({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>检查配置文件修改</span>
            </span>
          </div>
          <div class="menu-item" data-action="check-services">
            <span class="menu-label">
              ${IconPark.PlayOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>相关服务</span>
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
          <div class="menu-item" data-action="remove-package">
            <span class="menu-label">
              ${IconPark.Delete({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>卸载软件包</span>
            </span>
          </div>
          <div class="menu-item" data-action="hold-package">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>锁定版本(hold)</span>
            </span>
          </div>
        </div>
      </div>
    `
  }

  protected resolveAction(action: string): MenuAction | null {
    const name = this.currentPkg.name || ''

    const actions: Record<string, MenuAction> = {
      'package-details': {
        command: `dpkg -s ${name} 2>/dev/null || rpm -qi ${name} 2>/dev/null || echo '未找到包信息'`,
        title: `包详情 - ${name}`,
        actionName: '查看包详情'
      },
      'package-files': {
        command: `dpkg -L ${name} 2>/dev/null | head -50 || rpm -ql ${name} 2>/dev/null | head -50 || echo '无法列出文件'`,
        title: `包文件 - ${name}`,
        actionName: '列出包文件'
      },
      'package-deps': {
        command: `apt-cache depends ${name} 2>/dev/null || rpm -qR ${name} 2>/dev/null || echo '无法获取依赖'`,
        title: `依赖关系 - ${name}`,
        actionName: '查看依赖'
      },
      'package-changelog': {
        command: `apt changelog ${name} 2>/dev/null | head -50 || rpm -q --changelog ${name} 2>/dev/null | head -50 || echo '无法获取变更日志'`,
        title: `变更日志 - ${name}`,
        actionName: '查看变更日志'
      },
      'verify-integrity': {
        command: `dpkg --verify ${name} 2>/dev/null || rpm -V ${name} 2>/dev/null || echo '无法验证（结果为空表示完整）'`,
        title: `完整性 - ${name}`,
        actionName: '验证完整性'
      },
      'check-config-files': {
        command: `dpkg-query --showformat='$\{Conffiles}\n' --show ${name} 2>/dev/null | while read hash file; do [ -n "$file" ] && echo "--- $file ---" && md5sum "$file" 2>/dev/null; done || echo '无配置文件'`,
        title: `配置文件 - ${name}`,
        actionName: '检查配置文件'
      },
      'check-services': {
        command: `systemctl list-units --all --no-pager | grep -i "${name}" || echo '未找到相关服务'`,
        title: `相关服务 - ${name}`,
        actionName: '查看相关服务'
      },
      'remove-package': {
        command: `echo '⚠️ 将卸载: ${name}' && apt-get remove --dry-run ${name} 2>/dev/null || rpm -e --test ${name} 2>/dev/null || echo '请手动确认卸载'`,
        title: `卸载 - ${name}`,
        actionName: '卸载软件包(预览)'
      },
      'hold-package': {
        command: `apt-mark hold ${name} 2>/dev/null && echo '✓ 已锁定版本' || echo '锁定失败'`,
        title: `锁定 - ${name}`,
        actionName: '锁定版本'
      }
    }

    return actions[action] || null
  }
}
