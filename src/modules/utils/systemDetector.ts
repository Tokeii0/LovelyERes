/**
 * Linux 系统类型检测器
 * 支持检测各种 Linux 发行版，包括国产系统
 */

export type SystemType = 
  | 'ubuntu'      // Ubuntu
  | 'debian'      // Debian
  | 'centos'      // CentOS
  | 'rhel'        // Red Hat Enterprise Linux
  | 'fedora'      // Fedora
  | 'kylin'       // 麒麟 (Kylin)
  | 'uos'         // 统信 UOS (UnionTech OS)
  | 'deepin'      // 深度 (Deepin)
  | 'openeuler'   // 开放欧拉 (openEuler)
  | 'anolis'      // 龙蜥 (Anolis OS)
  | 'arch'        // Arch Linux
  | 'opensuse'    // openSUSE
  | 'alpine'      // Alpine Linux
  | 'generic';    // 通用 Linux

export interface SystemInfo {
  type: SystemType;
  name: string;
  version: string;
  prettyName: string;
  packageManager: 'apt' | 'yum' | 'dnf' | 'pacman' | 'zypper' | 'apk' | 'unknown';
  initSystem: 'systemd' | 'sysvinit' | 'upstart' | 'openrc' | 'unknown';
}

export class SystemDetector {
  private static cachedSystemInfo: SystemInfo | null = null;

  /**
   * 检测系统类型
   */
  static async detectSystem(): Promise<SystemInfo> {
    // 如果已经检测过，直接返回缓存
    if (this.cachedSystemInfo) {
      return this.cachedSystemInfo;
    }

    try {
      // 优先使用后端检测（更高效，一次性完成所有检测）
      const tauriInvoke = (window as any).__TAURI__?.core?.invoke;
      if (tauriInvoke) {
        console.log('🔍 开始检测系统类型...');
        const result = await tauriInvoke('detect_system_type');
        if (result) {
          console.log('✅ 系统检测完成:', result);
          this.cachedSystemInfo = result;
          return result;
        }
      }
    } catch (error) {
      console.warn('⚠️ 后端系统检测失败，使用前端检测:', error);
    }

    // 如果后端检测失败，回退到前端检测
    const systemInfo = await this.detectSystemByCommand();
    this.cachedSystemInfo = systemInfo;
    return systemInfo;
  }

  /**
   * 通过执行命令检测系统
   */
  private static async detectSystemByCommand(): Promise<SystemInfo> {
    try {
      const tauriInvoke = (window as any).__TAURI__?.core?.invoke;
      if (!tauriInvoke) {
        return this.getDefaultSystemInfo();
      }

      // 读取 /etc/os-release
      const osReleaseResult = await tauriInvoke('ssh_execute_command_direct', {
        command: 'cat /etc/os-release 2>/dev/null || cat /etc/lsb-release 2>/dev/null || echo "ID=generic"'
      });

      const osReleaseContent = osReleaseResult?.output || '';
      
      // 解析 os-release 内容
      const osInfo = this.parseOsRelease(osReleaseContent);
      
      // 检测包管理器
      const packageManager = await this.detectPackageManager();
      
      // 检测 init 系统
      const initSystem = await this.detectInitSystem();

      return {
        type: osInfo.type,
        name: osInfo.name,
        version: osInfo.version,
        prettyName: osInfo.prettyName,
        packageManager,
        initSystem
      };
    } catch (error) {
      console.error('系统检测失败:', error);
      return this.getDefaultSystemInfo();
    }
  }

  /**
   * 解析 /etc/os-release 内容
   */
  private static parseOsRelease(content: string): {
    type: SystemType;
    name: string;
    version: string;
    prettyName: string;
  } {
    const lines = content.split('\n');
    let id = 'generic';
    let idLike = '';
    let name = 'Linux';
    let version = '';
    let prettyName = 'Generic Linux';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('ID=') && !trimmed.startsWith('ID_LIKE=')) {
        id = trimmed.substring(3).replace(/['"]/g, '').toLowerCase();
      } else if (trimmed.startsWith('ID_LIKE=')) {
        idLike = trimmed.substring(8).replace(/['"]/g, '').toLowerCase();
      } else if (trimmed.startsWith('NAME=')) {
        name = trimmed.substring(5).replace(/['"]/g, '');
      } else if (trimmed.startsWith('VERSION_ID=')) {
        version = trimmed.substring(11).replace(/['"]/g, '');
      } else if (trimmed.startsWith('PRETTY_NAME=')) {
        prettyName = trimmed.substring(12).replace(/['"]/g, '');
      }
    }

    // 识别系统类型（使用 ID 和 ID_LIKE）
    const type = this.identifySystemType(id, idLike, name, prettyName);

    return { type, name, version, prettyName };
  }

  /**
   * 识别系统类型（使用 ID 和 ID_LIKE 字段）
   */
  private static identifySystemType(id: string, idLike: string, name: string, prettyName: string): SystemType {
    const combined = `${id} ${idLike} ${name} ${prettyName}`.toLowerCase();

    // 优先使用 ID 字段精确匹配
    // 国产系统
    if (id === 'kylin') return 'kylin';
    if (id === 'uos' || id === 'uniontech') return 'uos';
    if (id === 'deepin') return 'deepin';
    if (id === 'openeuler') return 'openeuler';
    if (id === 'anolis') return 'anolis';

    // 常见发行版
    if (id === 'ubuntu') return 'ubuntu';
    if (id === 'debian') return 'debian';
    if (id === 'centos') return 'centos';
    if (id === 'rhel') return 'rhel';
    if (id === 'fedora') return 'fedora';
    if (id === 'arch') return 'arch';
    if (id === 'opensuse' || id === 'opensuse-leap' || id === 'opensuse-tumbleweed') return 'opensuse';
    if (id === 'alpine') return 'alpine';

    // 使用 ID_LIKE 字段进行模糊匹配（处理派生发行版）
    if (idLike) {
      // 国产系统可能基于其他发行版
      if (combined.includes('kylin') || combined.includes('麒麟')) return 'kylin';
      if (combined.includes('uos') || combined.includes('uniontech') || combined.includes('统信')) return 'uos';
      if (combined.includes('deepin') || combined.includes('深度')) return 'deepin';
      if (combined.includes('openeuler') || combined.includes('欧拉')) return 'openeuler';
      if (combined.includes('anolis') || combined.includes('龙蜥')) return 'anolis';

      // 根据 ID_LIKE 判断系统族群
      if (idLike.includes('ubuntu')) return 'ubuntu';
      if (idLike.includes('debian')) return 'debian';
      if (idLike.includes('rhel') || idLike.includes('fedora')) {
        // 进一步区分 RHEL 系
        if (combined.includes('centos')) return 'centos';
        if (combined.includes('fedora')) return 'fedora';
        return 'rhel';
      }
      if (idLike.includes('arch')) return 'arch';
      if (idLike.includes('suse')) return 'opensuse';
    }

    // 最后使用名称进行模糊匹配
    if (combined.includes('ubuntu')) return 'ubuntu';
    if (combined.includes('debian')) return 'debian';
    if (combined.includes('centos')) return 'centos';
    if (combined.includes('rhel') || combined.includes('red hat')) return 'rhel';
    if (combined.includes('fedora')) return 'fedora';
    if (combined.includes('arch')) return 'arch';
    if (combined.includes('opensuse') || combined.includes('suse')) return 'opensuse';
    if (combined.includes('alpine')) return 'alpine';

    return 'generic';
  }

  /**
   * 检测包管理器
   */
  private static async detectPackageManager(): Promise<SystemInfo['packageManager']> {
    try {
      const tauriInvoke = (window as any).__TAURI__?.core?.invoke;
      if (!tauriInvoke) return 'unknown';

      const result = await tauriInvoke('ssh_execute_command_direct', {
        command: 'which apt 2>/dev/null && echo "apt" || which yum 2>/dev/null && echo "yum" || which dnf 2>/dev/null && echo "dnf" || which pacman 2>/dev/null && echo "pacman" || which zypper 2>/dev/null && echo "zypper" || which apk 2>/dev/null && echo "apk" || echo "unknown"'
      });

      const output = (result?.output || 'unknown').trim().split('\n').pop() || 'unknown';
      
      if (output.includes('apt')) return 'apt';
      if (output.includes('dnf')) return 'dnf';
      if (output.includes('yum')) return 'yum';
      if (output.includes('pacman')) return 'pacman';
      if (output.includes('zypper')) return 'zypper';
      if (output.includes('apk')) return 'apk';
      
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 检测 init 系统
   */
  private static async detectInitSystem(): Promise<SystemInfo['initSystem']> {
    try {
      const tauriInvoke = (window as any).__TAURI__?.core?.invoke;
      if (!tauriInvoke) return 'unknown';

      const result = await tauriInvoke('ssh_execute_command_direct', {
        command: 'ps -p 1 -o comm= 2>/dev/null'
      });

      const output = (result?.output || '').trim().toLowerCase();
      
      if (output.includes('systemd')) return 'systemd';
      if (output.includes('init')) return 'sysvinit';
      if (output.includes('upstart')) return 'upstart';
      if (output.includes('openrc')) return 'openrc';
      
      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 获取默认系统信息
   */
  private static getDefaultSystemInfo(): SystemInfo {
    return {
      type: 'generic',
      name: 'Linux',
      version: '',
      prettyName: 'Generic Linux',
      packageManager: 'unknown',
      initSystem: 'unknown'
    };
  }

  /**
   * 清除缓存
   */
  static clearCache(): void {
    this.cachedSystemInfo = null;
  }

  /**
   * 获取系统类型的显示名称
   */
  static getSystemDisplayName(type: SystemType): string {
    const names: Record<SystemType, string> = {
      ubuntu: 'Ubuntu',
      debian: 'Debian',
      centos: 'CentOS',
      rhel: 'Red Hat Enterprise Linux',
      fedora: 'Fedora',
      kylin: '麒麟 (Kylin)',
      uos: '统信 UOS',
      deepin: '深度 (Deepin)',
      openeuler: '开放欧拉 (openEuler)',
      anolis: '龙蜥 (Anolis OS)',
      arch: 'Arch Linux',
      opensuse: 'openSUSE',
      alpine: 'Alpine Linux',
      generic: 'Generic Linux'
    };
    return names[type] || type;
  }
}

