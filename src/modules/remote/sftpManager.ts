/**
 * SFTP文件管理器
 * 处理远程文件操作
 */

import { sshConnectionManager } from './sshConnectionManager';

export interface SftpFileInfo {
  name: string;
  path: string;
  file_type: string; // "file", "directory", "symlink"
  size: number;
  permissions: string;
  modified?: string;
  owner?: string;
  group?: string;
}

// Common UID→name mapping for emergency response
const COMMON_UID_MAP: Record<string, string> = {
  '0': 'root', '1': 'daemon', '2': 'bin', '33': 'www-data',
  '65534': 'nobody', '65533': 'nogroup', '99': 'nobody',
  '1000': 'user', '48': 'apache', '1001': 'user',
};

export class SftpManager {
  private currentPath: string = '/';
  private fileList: SftpFileInfo[] = [];
  private listeners: Array<(files: SftpFileInfo[], path: string) => void> = [];
  private sortMode: 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'modified-asc' | 'modified-desc' = 'name-asc';
  private collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true, ignorePunctuation: true });
  private uidNameCache: Record<string, string> = {};
  private uidCacheLoaded = false;

  /**
   * 设置排序方式，目录始终排在文件之前
   */
  setSortMode(mode: 'name-asc' | 'name-desc' | 'size-asc' | 'size-desc' | 'modified-asc' | 'modified-desc'): void {
    this.sortMode = mode;
    this.notifyListeners();
  }

  /**
   * 获取当前排序模式
   */
  getSortMode(): string {
    return this.sortMode;
  }

  private sortFiles(files: SftpFileInfo[]): SftpFileInfo[] {
    const isDir = (f: SftpFileInfo) => f.file_type === 'directory';
    const dirFirst = (a: SftpFileInfo, b: SftpFileInfo) => {
      if (isDir(a) && !isDir(b)) return -1;
      if (!isDir(a) && isDir(b)) return 1;
      return 0;
    };

    const nameCmp = (a: SftpFileInfo, b: SftpFileInfo) => this.collator.compare(a.name, b.name);
    const sizeCmp = (a: SftpFileInfo, b: SftpFileInfo) => a.size - b.size;
    const modifiedCmp = (a: SftpFileInfo, b: SftpFileInfo) => {
      const aTime = a.modified ? new Date(a.modified).getTime() : 0;
      const bTime = b.modified ? new Date(b.modified).getTime() : 0;
      return aTime - bTime;
    };

    const withinGroupCmp = (a: SftpFileInfo, b: SftpFileInfo) => {
      let cmp = 0;
      if (this.sortMode.startsWith('name-')) {
        cmp = nameCmp(a, b);
        return this.sortMode === 'name-desc' ? -cmp : cmp;
      } else if (this.sortMode.startsWith('size-')) {
        cmp = sizeCmp(a, b);
        return this.sortMode === 'size-desc' ? -cmp : cmp;
      } else if (this.sortMode.startsWith('modified-')) {
        cmp = modifiedCmp(a, b);
        return this.sortMode === 'modified-desc' ? -cmp : cmp;
      }
      return 0;
    };

    return [...files].sort((a, b) => {
      const group = dirFirst(a, b);
      if (group !== 0) return group;
      return withinGroupCmp(a, b);
    });
  }

  /**
   * 获取当前文件列表
   */
  getCurrentFiles(): SftpFileInfo[] {
    return this.sortFiles(this.fileList);
  }

  /**
   * 刷新当前目录
   */
  async refreshCurrentDirectory(): Promise<void> {
    try {
      await this.refreshFileList();
    } catch (error) {
      console.error('刷新目录失败:', error);
    }
  }

  /**
   * 获取当前路径
   */
  getCurrentPath(): string {
    return this.currentPath;
  }

  /**
   * 规范化远程路径：统一为POSIX风格，去重/及去除末尾/
   */
  public normalizePath(p: string): string {
    let np = (p || '/').replace(/\\/g, '/');
    np = np.replace(/\/+/g, '/');
    if (!np.startsWith('/')) np = '/' + np;
    if (np.length > 1 && np.endsWith('/')) np = np.slice(0, -1);
    return np;
  }

  /**
   * 获取当前文件列表
   */
  getFileList(): SftpFileInfo[] {
    return this.fileList;
  }

  /**
   * 异步加载 uid→username 映射缓存
   */
  private async loadUidNameCache(): Promise<void> {
    if (this.uidCacheLoaded) return;
    try {
      const result: any = await (window as any).__TAURI__.core.invoke('ssh_execute_command_direct', {
        command: "cat /etc/passwd 2>/dev/null | cut -d: -f1,3"
      });
      const output = result?.output || '';
      for (const line of output.split('\n')) {
        const [name, uid] = line.split(':');
        if (name && uid) this.uidNameCache[uid.trim()] = name.trim();
      }
      // Also load group names
      const gResult: any = await (window as any).__TAURI__.core.invoke('ssh_execute_command_direct', {
        command: "cat /etc/group 2>/dev/null | cut -d: -f1,3"
      });
      const gOutput = gResult?.output || '';
      for (const line of gOutput.split('\n')) {
        const [name, gid] = line.split(':');
        if (name && gid) this.uidNameCache[`g${gid.trim()}`] = name.trim();
      }
      this.uidCacheLoaded = true;
    } catch {
      // Silent fail - will show numeric uids
    }
  }

  /**
   * 解析 owner 显示名称
   */
  resolveOwnerName(uid: string | undefined): string {
    if (!uid) return '-';
    // If it's already a name (not purely numeric), return as-is
    if (!/^\d+$/.test(uid)) return uid;
    return this.uidNameCache[uid] || COMMON_UID_MAP[uid] || uid;
  }

  /**
   * 解析 group 显示名称
   */
  resolveGroupName(gid: string | undefined): string {
    if (!gid) return '-';
    if (!/^\d+$/.test(gid)) return gid;
    return this.uidNameCache[`g${gid}`] || COMMON_UID_MAP[gid] || gid;
  }

  /**
   * 刷新文件列表
   */
  async refreshFileList(): Promise<void> {
    if (!sshConnectionManager.isConnected()) {
      console.warn('SSH未连接，无法刷新SFTP文件列表');
      return;
    }

    try {
      // Load uid cache in background on first access
      if (!this.uidCacheLoaded) {
        this.loadUidNameCache().catch(() => {});
      }

      const files = await (window as any).__TAURI__.core.invoke('sftp_list_files', {
        path: this.currentPath
      });

      this.fileList = this.sortFiles(files);
      this.notifyListeners();

      sshConnectionManager.updateLastActivity();

    } catch (error) {
      console.error('获取SFTP文件列表失败:', error);
      (window as any).showNotification && (window as any).showNotification(`获取文件列表失败: ${error}`, 'error');
    }
  }

  /**
   * 导航到指定路径
   */
  async navigateToPath(path: string): Promise<void> {
    if (this.isNavigating) {
      console.log('⏳ 正在导航中，忽略新的导航请求');
      return;
    }

    try {
      this.isNavigating = true;
      const normalized = this.normalizePath(path);
      console.log('📂 导航到路径:', normalized);
      this.currentPath = normalized;
      await this.refreshFileList();
    } finally {
      this.isNavigating = false;
    }
  }

  /**
   * 导航到上级目录
   */
  async navigateToParent(): Promise<void> {
    const cur = this.normalizePath(this.currentPath);
    if (cur === '/') return;
    const parentPath = cur.split('/').slice(0, -1).join('/') || '/';
    await this.navigateToPath(parentPath);
  }

  /**
   * 处理文件点击
   */
  async handleFileClick(file: SftpFileInfo): Promise<void> {
    if (file.file_type === 'directory') {
      await this.navigateToPath(file.path);
    } else {
      console.log('点击文件:', file.name);
    }
  }

  /**
   * 检测文件风险等级 (用于应急响应高亮)
   * 返回: 'risk-critical' | 'risk-warning' | 'risk-info' | ''
   */
  private getFileRiskClass(file: SftpFileInfo): string {
    const name = file.name;
    const perms = file.permissions || '';
    const permsNum = parseInt(perms, 8) || 0;
    const lowBits = permsNum & 0o7777;

    // Critical: SUID/SGID 可执行文件
    if ((permsNum & 0o4000) || (permsNum & 0o2000)) {
      if (file.file_type === 'file') return 'risk-critical';
    }

    // Critical: 777 权限
    if ((lowBits & 0o777) === 0o777) return 'risk-critical';

    // Warning: 可疑文件名模式
    const suspiciousPatterns = [
      /\.(php|jsp|asp|aspx|cgi)$/i,        // Web shell 常见扩展
      /^\..*\.(sh|py|pl|rb)$/i,            // 隐藏脚本
      /^(shell|backdoor|hack|exploit|c99|r57|b374k|webshell)/i,
      /\.(suspected|malware|infected)$/i,
      /^\.\.[ ]/,                            // 伪装的 ..空格 目录
    ];
    for (const pat of suspiciousPatterns) {
      if (pat.test(name)) return 'risk-warning';
    }

    // Warning: 特殊隐藏文件在敏感目录
    if (name.startsWith('.') && name !== '..' && name !== '.' && file.file_type === 'file') {
      const sensitiveDirs = ['/tmp', '/dev/shm', '/var/tmp', '/run'];
      if (sensitiveDirs.some(d => this.currentPath.startsWith(d))) {
        return 'risk-warning';
      }
    }

    // Info: 隐藏文件
    if (name.startsWith('.') && name !== '..' && name !== '.') {
      return 'risk-info';
    }

    // Info: 世界可写文件 (不含目录)
    if (file.file_type === 'file' && (lowBits & 0o002)) {
      return 'risk-info';
    }

    return '';
  }

  /**
   * 获取风险标签 HTML — 仅用颜色高亮，不加图标
   */
  private getFileRiskBadge(_riskClass: string): string {
    return '';
  }

  /**
   * 渲染面包屑导航 HTML
   */
  renderBreadcrumbHTML(): string {
    const parts = this.currentPath.split('/').filter(Boolean);
    let html = '<span class="breadcrumb-segment breadcrumb-root" onclick="sftpManager.navigateToPath(\'/\')" title="根目录">/</span>';
    
    let accumulated = '';
    for (let i = 0; i < parts.length; i++) {
      accumulated += '/' + parts[i];
      const isLast = i === parts.length - 1;
      html += '<span class="breadcrumb-sep">›</span>';
      html += `<span class="breadcrumb-segment${isLast ? ' breadcrumb-current' : ''}" onclick="sftpManager.navigateToPath('${accumulated}')" title="${accumulated}">${parts[i]}</span>`;
    }
    return html;
  }

  /**
   * 更新排序指示器
   */
  updateSortIndicators(): void {
    const indicators: Record<string, string> = { name: '', size: '', modified: '' };
    const [field, direction] = this.sortMode.split('-');
    if (field && indicators.hasOwnProperty(field)) {
      indicators[field] = direction === 'asc' ? '▲' : '▼';
    }

    // Update indicator text and active state
    for (const [key, arrow] of Object.entries(indicators)) {
      const ind = document.getElementById(`sort-ind-${key}`);
      const th = document.getElementById(`sftp-th-${key}`);
      if (ind) ind.textContent = arrow;
      if (th) {
        if (arrow) th.classList.add('sort-active');
        else th.classList.remove('sort-active');
      }
    }
  }

  /**
   * 渲染文件列表HTML（返回<tr>行，供#sftp-file-list tbody插入）
   */
  renderFileListHTML(): string {
    // 未连接时显示一行提示
    if (!sshConnectionManager.isConnected()) {
      return `
        <tr>
          <td colspan="5" style="padding: 40px; text-align: center; color: var(--text-secondary); font-size: 13px;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
              <div style="font-size: 24px; opacity: 0.5;">📡</div>
              <span>SSH未连接 — 请先建立连接</span>
            </div>
          </td>
        </tr>
      `;
    }

    // 空目录
    if (this.fileList.length === 0) {
      return `
        <tr>
          <td colspan="5" style="padding: 40px; text-align: center; color: var(--text-secondary); font-size: 13px;">
            <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
              <div style="font-size: 24px; opacity: 0.5;">📁</div>
              <span>目录为空</span>
            </div>
          </td>
        </tr>
      `;
    }

    let html = '';
    let riskCount = 0;

    // 上级目录项
    if (this.currentPath !== '/') {
      html += `
        <tr class="sftp-file-row parent-dir-item" data-action="parent" oncontextmenu="return false;" onclick="sftpManager.navigateToParent()">
          <td class="file-icon-cell">
            <div class="file-icon">📁</div>
            <span class="file-name">..</span>
          </td>
          <td>-</td>
          <td>-</td>
          <td>-</td>
          <td>上级目录</td>
        </tr>
      `;
    }

    // 已按规则排序的文件和目录
    const sortedFiles = this.getCurrentFiles();
    sortedFiles.forEach((file, index) => {
      const icon = this.getFileIcon(file);
      const sizeText = file.file_type === 'directory' ? '-' : this.formatFileSize(file.size);
      const perms = this.formatPermissionsSymbolic(file.permissions);
      const modified = this.formatModifiedDate((file as any).modified);
      const ownerName = this.resolveOwnerName(file.owner);
      const groupName = this.resolveGroupName(file.group);
      const ownerDisplay = groupName !== '-' ? `${ownerName}:${groupName}` : ownerName;

      // Risk detection
      const riskClass = this.getFileRiskClass(file);
      const riskBadge = this.getFileRiskBadge(riskClass);
      if (riskClass === 'risk-critical' || riskClass === 'risk-warning') riskCount++;

      // Root owner highlight
      const ownerClass = ownerName === 'root' ? 'owner-root' : '';

      const style = `--row-index: ${index}`;

      html += `
        <tr class="sftp-file-row ${riskClass}" data-file-index="${index}" 
            oncontextmenu="window.showSftpContextMenu(event, ${index}); return false;" 
            ondblclick="sftpManager.handleFileClickByIndex(${index})"
            style="${style}">
          <td class="file-icon-cell">
            <div class="file-icon">${icon}</div>
            <span class="file-name" title="${file.name}">${riskBadge}${file.name}</span>
          </td>
          <td style="font-size: 12px; color: var(--text-secondary);">${sizeText}</td>
          <td class="perms-cell" style="font-family: monospace; font-size: 11px;">${perms}</td>
          <td class="owner-cell ${ownerClass}" style="font-size: 12px;">${ownerDisplay}</td>
          <td style="font-size: 12px; color: var(--text-secondary);">${modified}</td>
        </tr>
      `;
    });

    // Update status bar
    setTimeout(() => {
      const countEl = document.getElementById('sftp-status-count');
      if (countEl) countEl.innerHTML = `<span>${sortedFiles.length} 项</span>`;

      // Update risk count
      const riskEl = document.getElementById('sftp-status-risk');
      const riskCountEl = document.getElementById('sftp-risk-count');
      if (riskEl && riskCountEl) {
        if (riskCount > 0) {
          riskEl.style.display = '';
          riskCountEl.textContent = String(riskCount);
        } else {
          riskEl.style.display = 'none';
        }
      }

      // Update breadcrumb
      const breadcrumb = document.getElementById('sftp-breadcrumb');
      if (breadcrumb) breadcrumb.innerHTML = this.renderBreadcrumbHTML();

      // Update path in status bar
      const pathEl = document.getElementById('sftp-status-path');
      if (pathEl) pathEl.innerHTML = `<span>${this.currentPath}</span>`;

      // Update sort indicators
      this.updateSortIndicators();
    }, 0);

    return html;
  }

  /**
   * 通过索引处理文件点击（用于HTML onclick）
   */
  async handleFileClickByIndex(index: number): Promise<void> {
    try {
      if (index >= 0 && index < this.fileList.length) {
        const file = this.fileList[index];
        console.log('🖱️ 点击文件:', file.name, '类型:', file.file_type);

        if (this.isNavigating) {
          console.log('⏳ 正在导航中，忽略点击');
          return;
        }

        await this.handleFileClick(file);
      }
    } catch (error) {
      console.error('处理文件点击失败:', error);
    }
  }


  public getFileByIndex(index: number): SftpFileInfo | null {
    if (index < 0 || index >= this.fileList.length) return null;
    return this.fileList[index];
  }

  private isNavigating: boolean = false;

  /**
   * 获取文件图标 (增强版，更多文件类型)
   */
  private getFileIcon(file: SftpFileInfo): string {
    if (file.file_type === 'directory') return '📁';
    if (file.file_type === 'symlink') return '🔗';

    const name = file.name.toLowerCase();
    // Executables & scripts
    if (name.endsWith('.sh') || name.endsWith('.bash')) return '🐧';
    if (name.endsWith('.py')) return '🐍';
    if (name.endsWith('.rb')) return '💎';
    if (name.endsWith('.pl') || name.endsWith('.pm')) return '🐪';
    if (name.endsWith('.js') || name.endsWith('.ts')) return '📜';
    // Web & config
    if (name.endsWith('.php') || name.endsWith('.jsp') || name.endsWith('.asp')) return '🌐';
    if (name.endsWith('.html') || name.endsWith('.htm')) return '🌐';
    if (name.endsWith('.conf') || name.endsWith('.cfg') || name.endsWith('.ini') || name.endsWith('.yaml') || name.endsWith('.yml') || name.endsWith('.toml')) return '⚙️';
    if (name.endsWith('.json') || name.endsWith('.xml')) return '📋';
    // Logs & text
    if (name.endsWith('.log')) return '📊';
    if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.rst')) return '📄';
    // Archives
    if (name.endsWith('.zip') || name.endsWith('.tar') || name.endsWith('.gz') || name.endsWith('.bz2') || name.endsWith('.xz') || name.endsWith('.7z') || name.endsWith('.rar')) return '📦';
    // Images
    if (name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.gif') || name.endsWith('.svg') || name.endsWith('.bmp')) return '🖼️';
    // Binaries & system
    if (name.endsWith('.so') || name.endsWith('.ko') || name.endsWith('.o') || name.endsWith('.a')) return '🔧';
    if (name.endsWith('.deb') || name.endsWith('.rpm')) return '📦';
    // Crypto & keys
    if (name.endsWith('.pem') || name.endsWith('.key') || name.endsWith('.crt') || name.endsWith('.pub') || name === 'authorized_keys' || name === 'known_hosts') return '🔑';
    // Database
    if (name.endsWith('.db') || name.endsWith('.sqlite') || name.endsWith('.sql')) return '🗄️';
    return '📄';
  }

  /**
   * 格式化文件大小
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * 格式化上次修改时间
   */
  private formatModifiedDate(input: any): string {
    if (input === undefined || input === null || input === '') return '';
    let date: Date;
    if (typeof input === 'number') {
      const ms = input < 1e12 ? input * 1000 : input;
      date = new Date(ms);
    } else if (typeof input === 'string') {
      const num = Number(input);
      if (!isNaN(num)) {
        const ms = num < 1e12 ? num * 1000 : num;
        date = new Date(ms);
      } else {
        date = new Date(input);
      }
    } else {
      return '';
    }
    if (isNaN(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(undefined, {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }).format(date);
    } catch {
      return date.toLocaleString();
    }
  }

  /**
   * 格式化权限为符号形式 (如 rwxr-xr-x)
   */
  private formatPermissionsSymbolic(octal: string): string {
    const digits = (octal || '').replace(/^0+/, '').padStart(3, '0').slice(-3);
    const toTriplet = (n: number) => {
      const r = (n & 4) ? 'r' : '-';
      const w = (n & 2) ? 'w' : '-';
      const x = (n & 1) ? 'x' : '-';
      return r + w + x;
    };
    const u = parseInt(digits[0], 8);
    const g = parseInt(digits[1], 8);
    const o = parseInt(digits[2], 8);
    return toTriplet(u) + toTriplet(g) + toTriplet(o);
  }


  /**
   * 添加监听器
   */
  addListener(listener: (files: SftpFileInfo[], path: string) => void): void {
    this.listeners.push(listener);
  }

  /**
   * 移除监听器
   */
  removeListener(listener: (files: SftpFileInfo[], path: string) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.fileList, this.currentPath);
      } catch (error) {
        console.error('SFTP文件列表监听器执行失败:', error);
      }
    });
  }
}

// 全局SFTP管理器实例
export const sftpManager = new SftpManager();
