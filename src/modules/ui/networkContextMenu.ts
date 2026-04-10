/**
 * 网络连接右键菜单管理器
 */

import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class NetworkContextMenu extends BaseContextMenu {
  private currentConnection: {
    protocol: string
    localAddress: string
    foreignAddress: string
    state: string
    pid: string
    process: string
  } | null = null

  constructor() {
    super('network')
  }

  protected onShowContextMenu(connection: {
    protocol: string
    localAddress: string
    foreignAddress: string
    state: string
    pid: string
    process: string
  }) {
    this.currentConnection = connection
  }

  /**
   * 提取IP地址（从 IP:Port 格式中提取IP）
   */
  private extractIP(address: string): string {
    if (address.includes('[')) {
      // IPv6格式: [::1]:8080
      const match = address.match(/\[([^\]]+)\]/)
      return match ? match[1] : address
    } else {
      // IPv4格式: 192.168.1.1:8080
      return address.split(':')[0]
    }
  }

  /**
   * 提取端口（从 IP:Port 格式中提取端口）
   */
  private extractPort(address: string): string {
    const parts = address.split(':')
    return parts[parts.length - 1] || ''
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
          <div class="menu-item" data-action="connection-details">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>连接详情</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-local">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制本地地址</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-foreign">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制远程地址</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-process">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制进程信息</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Earth({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>IP信息查询</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="whois">
            <span class="menu-label">
              ${IconPark.Search({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>WHOIS查询</span>
            </span>
          </div>
          <div class="menu-item" data-action="geolocation">
            <span class="menu-label">
              ${IconPark.Local({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>地理位置查询</span>
            </span>
          </div>
          <div class="menu-item" data-action="reverse-dns">
            <span class="menu-label">
              ${IconPark.Return({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>反向DNS查询</span>
            </span>
          </div>
          <div class="menu-item" data-action="ip-type">
            <span class="menu-label">
              ${IconPark.Tag({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>IP类型判断</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.PlugOne({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>端口分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="port-service">
            <span class="menu-label">
              ${IconPark.Application({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>端口服务识别</span>
            </span>
          </div>
          <div class="menu-item" data-action="port-process">
            <span class="menu-label">
              ${IconPark.Code({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看占用进程</span>
            </span>
          </div>
          <div class="menu-item" data-action="port-test">
            <span class="menu-label">
              ${IconPark.Check({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>端口连通性测试</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Analysis({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>网络诊断</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="ping">
            <span class="menu-label">
              ${IconPark.Signal({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>Ping测试</span>
            </span>
          </div>
          <div class="menu-item" data-action="traceroute">
            <span class="menu-label">
              ${IconPark.Direction({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>Traceroute追踪</span>
            </span>
          </div>
          <div class="menu-item" data-action="latency">
            <span class="menu-label">
              ${IconPark.Time({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>网络延迟测试</span>
            </span>
          </div>
          <div class="menu-item" data-action="tcp-test">
            <span class="menu-label">
              ${IconPark.Connection({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>TCP连接测试</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Protection({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>安全分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="threat-intel">
            <span class="menu-label">
              ${IconPark.Caution({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>威胁情报查询</span>
            </span>
          </div>
          <div class="menu-item" data-action="blacklist-check">
            <span class="menu-label">
              ${IconPark.CloseOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>黑名单检查</span>
            </span>
          </div>
          <div class="menu-item" data-action="anomaly-detect">
            <span class="menu-label">
              ${IconPark.Attention({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>异常连接检测</span>
            </span>
          </div>
          <div class="menu-item" data-action="connection-freq">
            <span class="menu-label">
              ${IconPark.ChartLine({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>连接频率分析</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Fire({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>防火墙操作</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="block-ip">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>阻止该IP</span>
            </span>
          </div>
          <div class="menu-item" data-action="allow-ip">
            <span class="menu-label">
              ${IconPark.Unlock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>允许该IP</span>
            </span>
          </div>
          <div class="menu-item" data-action="firewall-rules">
            <span class="menu-label">
              ${IconPark.ListTwo({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看防火墙规则</span>
            </span>
          </div>
          <div class="menu-item" data-action="temp-block">
            <span class="menu-label">
              ${IconPark.Timer({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>临时阻止（5分钟）</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.FileText({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>日志查询</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="connection-history">
            <span class="menu-label">
              ${IconPark.History({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看连接历史</span>
            </span>
          </div>
          <div class="menu-item" data-action="access-log">
            <span class="menu-label">
              ${IconPark.Log({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看访问日志</span>
            </span>
          </div>
          <div class="menu-item" data-action="security-log">
            <span class="menu-label">
              ${IconPark.Shield({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看安全日志</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-divider"></div>

      <div class="menu-item" data-action="disconnect">
        <span class="menu-label">
          ${IconPark.CloseOne({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>断开连接</span>
        </span>
      </div>

      <div class="menu-item" data-action="refresh">
        <span class="menu-label">
          ${IconPark.Refresh({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>刷新连接信息</span>
        </span>
      </div>
    `
  }

  protected async handleSpecialAction(action: string): Promise<boolean> {
    if (!this.currentConnection) return false

    const { protocol, localAddress, foreignAddress, state, pid, process } = this.currentConnection

    switch (action) {
      case 'connection-details':
        this.showModal('连接详情', `协议: ${protocol}\n本地地址: ${localAddress}\n远程地址: ${foreignAddress}\n状态: ${state}\nPID: ${pid}\n进程: ${process}`)
        return true

      case 'copy-local':
        navigator.clipboard.writeText(localAddress)
        this.showModal('复制成功', `已复制本地地址: ${localAddress}`)
        return true

      case 'copy-foreign':
        navigator.clipboard.writeText(foreignAddress)
        this.showModal('复制成功', `已复制远程地址: ${foreignAddress}`)
        return true

      case 'copy-process':
        navigator.clipboard.writeText(process)
        this.showModal('复制成功', `已复制进程信息: ${process}`)
        return true

      default:
        return false
    }
  }

  protected resolveAction(action: string): MenuAction | null {
    if (!this.currentConnection) return null

    const { protocol, localAddress, foreignAddress, state, pid: _pid, process } = this.currentConnection
    const foreignIP = this.extractIP(foreignAddress)
    const foreignPort = this.extractPort(foreignAddress)
    const localPort = this.extractPort(localAddress)

    const actions: Record<string, MenuAction> = {
      // IP信息查询
      'whois': {
        command: `whois ${foreignIP} 2>/dev/null || echo "whois命令不可用，请安装: apt install whois 或 yum install whois"`,
        title: `WHOIS查询 - ${foreignIP}`,
        actionName: 'WHOIS查询'
      },
      'geolocation': {
        command: `curl -s "http://ip-api.com/json/${foreignIP}" 2>/dev/null || echo "无法查询地理位置，请检查网络连接"`,
        title: `地理位置查询 - ${foreignIP}`,
        actionName: '地理位置查询'
      },
      'reverse-dns': {
        command: `dig -x ${foreignIP} +short 2>/dev/null || nslookup ${foreignIP} 2>/dev/null | grep "name =" || echo "无法解析反向DNS"`,
        title: `反向DNS查询 - ${foreignIP}`,
        actionName: '反向DNS查询'
      },
      'ip-type': {
        command: `echo "IP地址: ${foreignIP}"; echo ""; if [[ "${foreignIP}" =~ ^10\\. ]] || [[ "${foreignIP}" =~ ^172\\.(1[6-9]|2[0-9]|3[01])\\. ]] || [[ "${foreignIP}" =~ ^192\\.168\\. ]]; then echo "✓ 内网IP（私有地址）"; elif [[ "${foreignIP}" =~ ^127\\. ]]; then echo "✓ 回环地址（Loopback）"; elif [[ "${foreignIP}" =~ ^169\\.254\\. ]]; then echo "✓ 链路本地地址（Link-Local）"; elif [[ "${foreignIP}" =~ ^224\\. ]] || [[ "${foreignIP}" =~ ^239\\. ]]; then echo "✓ 组播地址（Multicast）"; else echo "✓ 公网IP（公共地址）"; fi`,
        title: `IP类型判断 - ${foreignIP}`,
        actionName: 'IP类型判断'
      },

      // 端口分析
      'port-service': {
        command: `echo "端口: ${foreignPort}"; echo ""; grep -w ${foreignPort} /etc/services 2>/dev/null | head -5 || echo "未找到标准服务定义"; echo ""; echo "常见端口服务:"; case ${foreignPort} in 80) echo "HTTP - 网页服务";; 443) echo "HTTPS - 安全网页服务";; 22) echo "SSH - 安全Shell";; 21) echo "FTP - 文件传输";; 25) echo "SMTP - 邮件发送";; 3306) echo "MySQL - 数据库";; 5432) echo "PostgreSQL - 数据库";; 6379) echo "Redis - 缓存数据库";; 27017) echo "MongoDB - 数据库";; 3389) echo "RDP - 远程桌面";; *) echo "未知服务";; esac`,
        title: `端口服务识别 - ${foreignPort}`,
        actionName: '端口服务识别'
      },
      'port-process': {
        command: `lsof -nP -i :${localPort} 2>/dev/null || ss -tlnp | grep ":${localPort}" 2>/dev/null || echo "无法查询端口占用进程"`,
        title: `端口占用进程 - ${localPort}`,
        actionName: '查看端口占用进程'
      },
      'port-test': {
        command: `timeout 3 bash -c "echo > /dev/tcp/${foreignIP}/${foreignPort}" 2>/dev/null && echo "✓ 端口 ${foreignPort} 可连接" || echo "✗ 端口 ${foreignPort} 不可连接或超时"`,
        title: `端口连通性测试 - ${foreignIP}:${foreignPort}`,
        actionName: '端口连通性测试'
      },

      // 网络诊断
      'ping': {
        command: `ping -c 4 ${foreignIP} 2>/dev/null || echo "Ping失败或权限不足"`,
        title: `Ping测试 - ${foreignIP}`,
        actionName: 'Ping测试'
      },
      'traceroute': {
        command: `traceroute -m 15 ${foreignIP} 2>/dev/null || tracepath ${foreignIP} 2>/dev/null || echo "traceroute命令不可用"`,
        title: `Traceroute追踪 - ${foreignIP}`,
        actionName: 'Traceroute追踪'
      },
      'latency': {
        command: `ping -c 10 ${foreignIP} 2>/dev/null | tail -1 | awk -F'/' '{print "平均延迟: "$5" ms"}' || echo "无法测试延迟"`,
        title: `网络延迟测试 - ${foreignIP}`,
        actionName: '网络延迟测试'
      },
      'tcp-test': {
        command: `timeout 5 bash -c "echo -e 'GET / HTTP/1.0\\r\\n\\r\\n' > /dev/tcp/${foreignIP}/${foreignPort}" 2>/dev/null && echo "✓ TCP连接成功" || echo "✗ TCP连接失败"`,
        title: `TCP连接测试 - ${foreignIP}:${foreignPort}`,
        actionName: 'TCP连接测试'
      },

      // 安全分析
      'threat-intel': {
        command: `echo "威胁情报查询 - ${foreignIP}"; echo ""; echo "⚠️ 注意：此功能需要API密钥"; echo ""; echo "建议使用以下服务:"; echo "1. VirusTotal: https://www.virustotal.com/"; echo "2. AbuseIPDB: https://www.abuseipdb.com/"; echo "3. IPVoid: https://www.ipvoid.com/"; echo ""; echo "IP地址: ${foreignIP}"; echo "端口: ${foreignPort}"; echo "协议: ${protocol}"`,
        title: `威胁情报查询 - ${foreignIP}`,
        actionName: '威胁情报查询'
      },
      'blacklist-check': {
        command: `echo "黑名单检查 - ${foreignIP}"; echo ""; echo "检查常见黑名单..."; echo ""; host ${foreignIP}.zen.spamhaus.org 2>/dev/null && echo "⚠️ 在Spamhaus黑名单中" || echo "✓ 不在Spamhaus黑名单中"; host ${foreignIP}.dnsbl.sorbs.net 2>/dev/null && echo "⚠️ 在SORBS黑名单中" || echo "✓ 不在SORBS黑名单中"`,
        title: `黑名单检查 - ${foreignIP}`,
        actionName: '黑名单检查'
      },
      'anomaly-detect': {
        command: `echo "异常连接检测 - ${foreignIP}:${foreignPort}"; echo ""; echo "1. 端口检查:"; if [ ${foreignPort} -lt 1024 ]; then echo "⚠️ 使用特权端口 (<1024)"; else echo "✓ 使用非特权端口"; fi; echo ""; echo "2. 常见端口检查:"; case ${foreignPort} in 22|80|443|3306|5432|6379|27017) echo "✓ 常见服务端口";; *) echo "⚠️ 非常见端口，需要注意";; esac; echo ""; echo "3. 连接状态:"; echo "状态: ${state}"; echo ""; echo "4. 进程信息:"; echo "${process}"`,
        title: `异常连接检测 - ${foreignIP}:${foreignPort}`,
        actionName: '异常连接检测'
      },
      'connection-freq': {
        command: `echo "连接频率分析 - ${foreignIP}"; echo ""; echo "当前连接数:"; ss -tn | grep "${foreignIP}" | wc -l; echo ""; echo "所有连接:"; ss -tn | grep "${foreignIP}" | head -20`,
        title: `连接频率分析 - ${foreignIP}`,
        actionName: '连接频率分析'
      },

      // 防火墙操作
      'block-ip': {
        command: `echo "阻止IP: ${foreignIP}"; echo ""; if command -v iptables >/dev/null 2>&1; then echo "使用iptables阻止..."; echo "命令: iptables -A INPUT -s ${foreignIP} -j DROP"; echo "⚠️ 需要root权限执行"; echo ""; echo "执行命令: sudo iptables -A INPUT -s ${foreignIP} -j DROP"; else echo "⚠️ iptables命令不可用"; fi`,
        title: `阻止IP - ${foreignIP}`,
        actionName: '阻止IP'
      },
      'allow-ip': {
        command: `echo "允许IP: ${foreignIP}"; echo ""; if command -v iptables >/dev/null 2>&1; then echo "使用iptables允许..."; echo "命令: iptables -D INPUT -s ${foreignIP} -j DROP"; echo "⚠️ 需要root权限执行"; echo ""; echo "执行命令: sudo iptables -D INPUT -s ${foreignIP} -j DROP"; else echo "⚠️ iptables命令不可用"; fi`,
        title: `允许IP - ${foreignIP}`,
        actionName: '允许IP'
      },
      'firewall-rules': {
        command: `echo "防火墙规则 - ${foreignIP}"; echo ""; if command -v iptables >/dev/null 2>&1; then echo "=== iptables规则 ==="; iptables -L -n | grep "${foreignIP}" || echo "无相关规则"; elif command -v firewall-cmd >/dev/null 2>&1; then echo "=== firewalld规则 ==="; firewall-cmd --list-all; else echo "⚠️ 防火墙命令不可用"; fi`,
        title: `防火墙规则 - ${foreignIP}`,
        actionName: '查看防火墙规则'
      },
      'temp-block': {
        command: `echo "临时阻止IP（5分钟）: ${foreignIP}"; echo ""; echo "命令: iptables -A INPUT -s ${foreignIP} -j DROP && sleep 300 && iptables -D INPUT -s ${foreignIP} -j DROP"; echo "⚠️ 需要root权限执行"; echo ""; echo "执行命令: sudo bash -c 'iptables -A INPUT -s ${foreignIP} -j DROP && sleep 300 && iptables -D INPUT -s ${foreignIP} -j DROP &'"`,
        title: `临时阻止IP - ${foreignIP}`,
        actionName: '临时阻止IP'
      },

      // 日志查询
      'connection-history': {
        command: `echo "连接历史 - ${foreignIP}"; echo ""; echo "=== 最近的连接记录 ==="; journalctl -n 100 | grep "${foreignIP}" || echo "无连接历史记录"`,
        title: `连接历史 - ${foreignIP}`,
        actionName: '查看连接历史'
      },
      'access-log': {
        command: `echo "访问日志 - ${foreignIP}"; echo ""; echo "=== Nginx访问日志 ==="; grep "${foreignIP}" /var/log/nginx/access.log 2>/dev/null | tail -20 || echo "无Nginx日志"; echo ""; echo "=== Apache访问日志 ==="; grep "${foreignIP}" /var/log/apache2/access.log 2>/dev/null | tail -20 || grep "${foreignIP}" /var/log/httpd/access_log 2>/dev/null | tail -20 || echo "无Apache日志"`,
        title: `访问日志 - ${foreignIP}`,
        actionName: '查看访问日志'
      },
      'security-log': {
        command: `echo "安全日志 - ${foreignIP}"; echo ""; echo "=== 认证日志 ==="; grep "${foreignIP}" /var/log/auth.log 2>/dev/null | tail -20 || grep "${foreignIP}" /var/log/secure 2>/dev/null | tail -20 || echo "无认证日志"; echo ""; echo "=== 系统日志 ==="; journalctl -n 50 | grep "${foreignIP}" || echo "无系统日志"`,
        title: `安全日志 - ${foreignIP}`,
        actionName: '查看安全日志'
      },

      // 连接操作
      'disconnect': {
        command: `echo "断开连接 - ${foreignIP}:${foreignPort}"; echo ""; echo "⚠️ 此操作需要root权限"; echo ""; echo "查找连接..."; ss -K dst ${foreignIP} dport = ${foreignPort} 2>/dev/null && echo "✓ 连接已断开" || echo "⚠️ 无法断开连接（可能需要root权限或ss版本不支持-K参数）"`,
        title: `断开连接 - ${foreignIP}:${foreignPort}`,
        actionName: '断开连接'
      },
      'refresh': {
        command: `echo "刷新连接信息..."; echo ""; ss -tunap | grep "${foreignIP}" || echo "无连接信息"`,
        title: `刷新连接信息 - ${foreignIP}`,
        actionName: '刷新连接信息'
      },
    }

    return actions[action] || null
  }
}
