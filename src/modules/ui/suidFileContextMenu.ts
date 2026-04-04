/**
 * SUID文件右键菜单管理器
 */

import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class SUIDFileContextMenu extends BaseContextMenu {
  private currentFile: any = {}

  constructor() {
    super('suidfile')
  }

  protected onShowContextMenu(fileInfo: any) {
    this.currentFile = fileInfo
  }

  protected async handleSpecialAction(action: string): Promise<boolean> {
    if (action === 'copy-path') {
      try {
        await navigator.clipboard.writeText(this.currentFile.path || '')
        ;(window as any).showNotification?.('路径已复制', 'success')
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
          <span>文件信息</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="file-details">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>详细信息(stat)</span>
            </span>
          </div>
          <div class="menu-item" data-action="file-type">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>文件类型</span>
            </span>
          </div>
          <div class="menu-item" data-action="file-hash">
            <span class="menu-label">
              ${IconPark.Key({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>文件哈希(MD5/SHA256)</span>
            </span>
          </div>
          <div class="menu-item" data-action="file-strings">
            <span class="menu-label">
              ${IconPark.Text({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>可打印字符串</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-path">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制文件路径</span>
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
          <div class="menu-item" data-action="check-package">
            <span class="menu-label">
              ${IconPark.Box({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查找所属软件包</span>
            </span>
          </div>
          <div class="menu-item" data-action="verify-integrity">
            <span class="menu-label">
              ${IconPark.CheckOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>验证软件包完整性</span>
            </span>
          </div>
          <div class="menu-item" data-action="check-capabilities">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>检查文件capabilities</span>
            </span>
          </div>
          <div class="menu-item" data-action="check-links">
            <span class="menu-label">
              ${IconPark.LinkOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查找硬链接</span>
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
          <div class="menu-item" data-action="remove-suid">
            <span class="menu-label">
              ${IconPark.ReduceOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>移除SUID位</span>
            </span>
          </div>
          <div class="menu-item" data-action="quarantine">
            <span class="menu-label">
              ${IconPark.FolderClose({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>隔离文件</span>
            </span>
          </div>
        </div>
      </div>
    `
  }

  protected resolveAction(action: string): MenuAction | null {
    const filePath = this.currentFile.path || ''

    const actions: Record<string, MenuAction> = {
      'file-details': {
        command: `stat ${filePath} && echo '---' && ls -la ${filePath}`,
        title: `文件详情 - ${filePath}`,
        actionName: '查看文件详情'
      },
      'file-type': {
        command: `file ${filePath}`,
        title: `文件类型 - ${filePath}`,
        actionName: '查看文件类型'
      },
      'file-hash': {
        command: `echo 'MD5:' && md5sum ${filePath} && echo 'SHA256:' && sha256sum ${filePath}`,
        title: `文件哈希 - ${filePath}`,
        actionName: '计算文件哈希'
      },
      'file-strings': {
        command: `strings ${filePath} 2>/dev/null | head -100`,
        title: `字符串 - ${filePath}`,
        actionName: '提取可打印字符串'
      },
      'check-package': {
        command: `dpkg -S ${filePath} 2>/dev/null || rpm -qf ${filePath} 2>/dev/null || echo '未找到所属软件包（可能是手动安装）'`,
        title: `所属软件包 - ${filePath}`,
        actionName: '查找所属软件包'
      },
      'verify-integrity': {
        command: `pkg=$(dpkg -S ${filePath} 2>/dev/null | cut -d: -f1); if [ -n "$pkg" ]; then dpkg --verify $pkg 2>/dev/null || echo '无法验证'; else rpm -V $(rpm -qf ${filePath} 2>/dev/null) 2>/dev/null || echo '无法验证'; fi`,
        title: `完整性验证 - ${filePath}`,
        actionName: '验证完整性'
      },
      'check-capabilities': {
        command: `getcap ${filePath} 2>/dev/null || echo '无特殊capabilities'`,
        title: `Capabilities - ${filePath}`,
        actionName: '检查capabilities'
      },
      'check-links': {
        command: `find / -inum $(stat -c %i ${filePath}) 2>/dev/null | head -10`,
        title: `硬链接 - ${filePath}`,
        actionName: '查找硬链接'
      },
      'remove-suid': {
        command: `chmod u-s ${filePath} && echo '✓ 已移除SUID位' && ls -la ${filePath}`,
        title: `移除SUID - ${filePath}`,
        actionName: '移除SUID位'
      },
      'quarantine': {
        command: `mkdir -p /tmp/quarantine && cp -a ${filePath} /tmp/quarantine/ && chmod 000 ${filePath} && echo '✓ 文件已隔离到 /tmp/quarantine/ 并移除所有权限'`,
        title: `隔离文件 - ${filePath}`,
        actionName: '隔离文件'
      }
    }

    return actions[action] || null
  }
}
