/**
 * SFTP 右键菜单渲染器
 */

import * as IconPark from '@icon-park/svg'

export class SftpContextMenuRenderer {
  /**
   * 渲染 SFTP 右键菜单 HTML
   */
  public renderContextMenu(): string {
    return `
      <!-- Context Menu Container -->
      <div id="sftp-context-menu" class="sftp-ctx-menu" style="
        position: fixed;
        z-index: 9999;
        display: none;
        min-width: 180px;
        background: var(--bg-primary);
        border: 1px solid var(--border-color);
        box-shadow: var(--shadow-sm);
        border-radius: var(--border-radius);
        overflow: visible;
      ">
        <!-- 文件安全分析主菜单 -->
        <div class="ctx-item ctx-parent" id="sftp-ctx-security-analysis">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${IconPark.Protection({ theme: 'outline', size: '14', fill: 'currentColor' })}
            <span>文件安全分析</span>
          </div>
          <span style="font-size: 10px; color: var(--text-secondary);">▶</span>

          <!-- 二级菜单 -->
          <div class="ctx-submenu ctx-submenu-level2">
            <!-- 基础分析 (三级菜单) -->
            <div class="ctx-item ctx-parent">
              <div style="display: flex; align-items: center; gap: 8px;">
                ${IconPark.Fingerprint({ theme: 'outline', size: '14', fill: 'currentColor' })}
                <span>基础分析</span>
              </div>
              <span style="font-size: 10px; color: var(--text-secondary);">▶</span>

              <!-- 三级菜单 -->
              <div class="ctx-submenu ctx-submenu-level3">
                <div class="ctx-item" data-action="file-hash">
                  ${IconPark.Fingerprint({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>文件哈希值</span>
                </div>
                <div class="ctx-item" data-action="file-signature">
                  ${IconPark.FileCode({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>文件类型识别</span>
                </div>
                <div class="ctx-item" data-action="file-size">
                  ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>文件大小详情</span>
                </div>
                <div class="ctx-item" data-action="file-permissions">
                  ${IconPark.Permissions({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>权限分析</span>
                </div>
                <div class="ctx-item" data-action="file-timestamps">
                  ${IconPark.Time({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>时间戳分析</span>
                </div>
                <div class="ctx-item" data-action="inode">
                  ${IconPark.FileHash({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>Inode 信息</span>
                </div>
                <div class="ctx-item" data-action="mime-type">
                  ${IconPark.FileCode({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>MIME 类型</span>
                </div>
              </div>
            </div>

            <!-- 可疑检测 (三级菜单) -->
            <div class="ctx-item ctx-parent">
              <div style="display: flex; align-items: center; gap: 8px;">
                ${IconPark.FolderFailed({ theme: 'outline', size: '14', fill: 'currentColor' })}
                <span>可疑检测</span>
              </div>
              <span style="font-size: 10px; color: var(--text-secondary);">▶</span>

              <!-- 三级菜单 -->
              <div class="ctx-submenu ctx-submenu-level3">
                <div class="ctx-item" data-action="suspicious-path">
                  ${IconPark.FolderFailed({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>可疑路径检测</span>
                </div>
                <div class="ctx-item" data-action="hidden-file">
                  ${IconPark.Ghost({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>隐藏文件检测</span>
                </div>
                <div class="ctx-item" data-action="suid-sgid">
                  ${IconPark.Shield({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>SUID/SGID检测</span>
                </div>
              </div>
            </div>

            <!-- 内容分析 (三级菜单) -->
            <div class="ctx-item ctx-parent">
              <div style="display: flex; align-items: center; gap: 8px;">
                ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
                <span>内容分析</span>
              </div>
              <span style="font-size: 10px; color: var(--text-secondary);">▶</span>

              <!-- 三级菜单 -->
              <div class="ctx-submenu ctx-submenu-level3">
                <div class="ctx-item" data-action="file-strings">
                  ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>字符串提取</span>
                </div>
                <div class="ctx-item" data-action="hex-dump">
                  ${IconPark.Code({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>HEX 十六进制</span>
                </div>
                <div class="ctx-item" data-action="line-count">
                  ${IconPark.ListNumbers({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>行数统计</span>
                </div>
                <div class="ctx-item" data-action="archive-list">
                  ${IconPark.FolderOpen({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>压缩文件列表</span>
                </div>
                <div class="ctx-item" data-action="elf-header">
                  ${IconPark.FileCode({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>ELF 头解析</span>
                </div>
              </div>
            </div>

            <!-- 系统关联 (三级菜单) -->
            <div class="ctx-item ctx-parent">
              <div style="display: flex; align-items: center; gap: 8px;">
                ${IconPark.Connection({ theme: 'outline', size: '14', fill: 'currentColor' })}
                <span>系统关联</span>
              </div>
              <span style="font-size: 10px; color: var(--text-secondary);">▶</span>

              <!-- 三级菜单 -->
              <div class="ctx-submenu ctx-submenu-level3">
                <div class="ctx-item" data-action="file-processes">
                  ${IconPark.LinkOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>关联进程</span>
                </div>
                <div class="ctx-item" data-action="package-owner">
                  ${IconPark.Box({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>所属包查询</span>
                </div>
                <div class="ctx-item" data-action="hard-links">
                  ${IconPark.LinkOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>硬链接查找</span>
                </div>
                <div class="ctx-item" data-action="process-maps">
                  ${IconPark.Connection({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>进程内存映射</span>
                </div>
              </div>
            </div>

            <!-- 元数据与签名 (三级菜单) -->
            <div class="ctx-item ctx-parent">
              <div style="display: flex; align-items: center; gap: 8px;">
                ${IconPark.Shield({ theme: 'outline', size: '14', fill: 'currentColor' })}
                <span>元数据与签名</span>
              </div>
              <span style="font-size: 10px; color: var(--text-secondary);">▶</span>

              <!-- 三级菜单 -->
              <div class="ctx-submenu ctx-submenu-level3">
                <div class="ctx-item" data-action="xattr">
                  ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>扩展属性</span>
                </div>
                <div class="ctx-item" data-action="capabilities">
                  ${IconPark.Shield({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>文件能力</span>
                </div>
                <div class="ctx-item" data-action="selinux-context">
                  ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>SELinux 标签</span>
                </div>
              </div>
            </div>

            <!-- 文件关系 (三级菜单) -->
            <div class="ctx-item ctx-parent">
              <div style="display: flex; align-items: center; gap: 8px;">
                ${IconPark.LinkOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
                <span>文件关系</span>
              </div>
              <span style="font-size: 10px; color: var(--text-secondary);">▶</span>

              <!-- 三级菜单 -->
              <div class="ctx-submenu ctx-submenu-level3">
                <div class="ctx-item" data-action="dynamic-deps">
                  ${IconPark.Connection({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>动态依赖分析</span>
                </div>
                <div class="ctx-item" data-action="config-references">
                  ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>配置文件引用</span>
                </div>
                <div class="ctx-item" data-action="symlink-analysis">
                  ${IconPark.LinkOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>符号链接分析</span>
                </div>
              </div>
            </div>

            <!-- 恶意软件检测 (三级菜单 + VIP) -->
            <div class="ctx-item ctx-parent">
              <div style="display: flex; align-items: center; gap: 8px;">
                ${IconPark.Bug({ theme: 'outline', size: '14', fill: 'currentColor' })}
                <span>恶意软件检测 🔒</span>
              </div>
              <span style="font-size: 10px; color: var(--text-secondary);">▶</span>

              <!-- 三级菜单 -->
              <div class="ctx-submenu ctx-submenu-level3">
                <div class="ctx-item" data-action="webshell-detection">
                  ${IconPark.Bug({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>Webshell检测</span>
                </div>
                <div class="ctx-item" data-action="backdoor-detection">
                  ${IconPark.Ghost({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>后门检测</span>
                </div>
                <div class="ctx-item" data-action="crypto-mining-detection">
                  ${IconPark.Bitcoin({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>挖矿程序检测</span>
                </div>
                <div class="ctx-item" data-action="reverse-shell-detection">
                  ${IconPark.Terminal({ theme: 'outline', size: '14', fill: 'currentColor' })}
                  <span>反弹Shell检测</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style="height: 1px; background: var(--border-color); margin: 4px 0;"></div>

        <div class="ctx-item" id="sftp-ctx-quick-view">
          ${IconPark.Search({ theme: 'outline', size: '14', fill: 'currentColor' })}
          <span>快速编辑/查看文件</span>
        </div>
        <div class="ctx-item" id="sftp-ctx-rename">
          ${IconPark.Edit({ theme: 'outline', size: '14', fill: 'currentColor' })}
          <span>重命名</span>
        </div>
        <div class="ctx-item" id="sftp-ctx-edit-perms">
          ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
          <span>修改权限</span>
        </div>
        <div class="ctx-item" id="sftp-ctx-compress" style="display: none;">
          ${IconPark.Box({ theme: 'outline', size: '14', fill: 'currentColor' })}
          <span>打包</span>
        </div>
        <div class="ctx-item" id="sftp-ctx-extract" style="display: none;">
          ${IconPark.FolderOpen({ theme: 'outline', size: '14', fill: 'currentColor' })}
          <span>解压</span>
        </div>
        <div class="ctx-item" id="sftp-ctx-download">
          ${IconPark.Save({ theme: 'outline', size: '14', fill: 'currentColor' })}
          <span>下载</span>
        </div>

        <div style="height: 1px; background: var(--border-color); margin: 4px 0;"></div>

        <div class="ctx-item" id="sftp-ctx-copy-path">
          ${IconPark.Clipboard({ theme: 'outline', size: '14', fill: 'currentColor' })}
          <span>复制完整路径</span>
        </div>
        <div class="ctx-item" id="sftp-ctx-copy-name">
          ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
          <span>复制文件名</span>
        </div>
        <div class="ctx-item" id="sftp-ctx-open-terminal">
          ${IconPark.Terminal({ theme: 'outline', size: '14', fill: 'currentColor' })}
          <span>在终端中打开</span>
        </div>
        <div class="ctx-item" id="sftp-ctx-file-details">
          ${IconPark.ChartHistogramOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
          <span>查看详细信息</span>
        </div>

        <div style="height: 1px; background: var(--border-color); margin: 4px 0;"></div>

        <div class="ctx-item ctx-item-danger" id="sftp-ctx-delete">
          ${IconPark.Delete({ theme: 'outline', size: '14', fill: 'currentColor' })}
          <span>删除</span>
        </div>
      </div>
    `
  }

  /**
   * 初始化菜单的鼠标事件处理
   * 必须在菜单渲染到 DOM 后调用
   * 注意：现在大部分悬停效果由 CSS 处理，这里只处理特殊逻辑
   */
  public initializeMenuEvents(): void {
    // CSS 已经处理了大部分悬停效果，这里可以添加额外的逻辑
    console.log('SFTP 右键菜单事件已初始化（使用 CSS :hover）')
  }
}
