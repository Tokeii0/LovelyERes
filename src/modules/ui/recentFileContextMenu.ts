/**
 * 最近修改文件右键菜单管理器
 */

import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class RecentFileContextMenu extends BaseContextMenu {
  private currentFile: any = {}

  constructor() {
    super('recentfile')
  }

  protected onShowContextMenu(file: any) {
    this.currentFile = file
  }

  protected async handleSpecialAction(action: string): Promise<boolean> {
    if (action === 'copy-path') {
      try {
        await navigator.clipboard.writeText(this.currentFile.path || '')
        ;window.showNotification?.('路径已复制', 'success')
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
          <div class="menu-item" data-action="file-content">
            <span class="menu-label">
              ${IconPark.AlignTextLeft({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看文件内容</span>
            </span>
          </div>
          <div class="menu-item" data-action="file-hash">
            <span class="menu-label">
              ${IconPark.Key({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>文件哈希</span>
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
          <span>安全分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="file-strings">
            <span class="menu-label">
              ${IconPark.Text({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>可打印字符串</span>
            </span>
          </div>
          <div class="menu-item" data-action="file-permissions">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>权限与归属</span>
            </span>
          </div>
          <div class="menu-item" data-action="file-acl">
            <span class="menu-label">
              ${IconPark.Shield({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>文件ACL</span>
            </span>
          </div>
          <div class="menu-item" data-action="check-package">
            <span class="menu-label">
              ${IconPark.Box({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查找所属软件包</span>
            </span>
          </div>
          <div class="menu-item" data-action="nearby-files">
            <span class="menu-label">
              ${IconPark.FolderOpen({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>同目录最近修改</span>
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
          <div class="menu-item" data-action="backup-file">
            <span class="menu-label">
              ${IconPark.Save({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>备份文件</span>
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
        title: `详情 - ${filePath}`,
        actionName: '查看详情'
      },
      'file-type': {
        command: `file ${filePath}`,
        title: `类型 - ${filePath}`,
        actionName: '查看文件类型'
      },
      'file-content': {
        command: `head -100 ${filePath} 2>/dev/null || echo '无法读取文件内容'`,
        title: `内容 - ${filePath}`,
        actionName: '查看文件内容'
      },
      'file-hash': {
        command: `echo 'MD5:' && md5sum ${filePath} && echo 'SHA256:' && sha256sum ${filePath}`,
        title: `哈希 - ${filePath}`,
        actionName: '计算文件哈希'
      },
      'file-strings': {
        command: `strings ${filePath} 2>/dev/null | head -100`,
        title: `字符串 - ${filePath}`,
        actionName: '提取字符串'
      },
      'file-permissions': {
        command: `ls -la ${filePath} && echo '---' && stat -c 'Owner: %U, Group: %G, Perms: %a' ${filePath}`,
        title: `权限 - ${filePath}`,
        actionName: '查看权限'
      },
      'file-acl': {
        command: `getfacl ${filePath} 2>/dev/null || echo 'ACL不可用'`,
        title: `ACL - ${filePath}`,
        actionName: '查看ACL'
      },
      'check-package': {
        command: `dpkg -S ${filePath} 2>/dev/null || rpm -qf ${filePath} 2>/dev/null || echo '未找到所属软件包'`,
        title: `所属包 - ${filePath}`,
        actionName: '查找所属包'
      },
      'nearby-files': {
        command: `find $(dirname ${filePath}) -maxdepth 1 -mtime -7 -ls 2>/dev/null | head -30`,
        title: `同目录文件 - $(dirname ${filePath})`,
        actionName: '查看同目录修改'
      },
      'backup-file': {
        command: `cp -a ${filePath} ${filePath}.bak.$(date +%Y%m%d%H%M%S) && echo '✓ 已备份到 ${filePath}.bak.'$(date +%Y%m%d%H%M%S)`,
        title: `备份 - ${filePath}`,
        actionName: '备份文件'
      },
      'quarantine': {
        command: `mkdir -p /tmp/quarantine && cp -a ${filePath} /tmp/quarantine/ && chmod 000 ${filePath} && echo '✓ 文件已隔离到 /tmp/quarantine/'`,
        title: `隔离 - ${filePath}`,
        actionName: '隔离文件'
      }
    }

    return actions[action] || null
  }
}
