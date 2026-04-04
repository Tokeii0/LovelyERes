/**
 * 防火墙规则右键菜单管理器
 */

import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class FirewallContextMenu extends BaseContextMenu {
  private currentRule: {
    chain: string
    target: string
    protocol: string
    source: string
    destination: string
    options: string
  } | null = null

  constructor() {
    super('firewall')
  }

  protected onShowContextMenu(rule: {
    chain: string
    target: string
    protocol: string
    source: string
    destination: string
    options: string
  }) {
    this.currentRule = rule
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
          <div class="menu-item" data-action="rule-details">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>规则详情</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-rule">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制规则</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-source">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制源地址</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-destination">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制目标地址</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.SettingConfig({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>规则管理</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="list-all-rules">
            <span class="menu-label">
              ${IconPark.ListTwo({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看所有规则</span>
            </span>
          </div>
          <div class="menu-item" data-action="list-chain-rules">
            <span class="menu-label">
              ${IconPark.ListBottom({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看链规则</span>
            </span>
          </div>
          <div class="menu-item" data-action="save-rules">
            <span class="menu-label">
              ${IconPark.Save({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>保存规则</span>
            </span>
          </div>
          <div class="menu-item" data-action="restore-rules">
            <span class="menu-label">
              ${IconPark.Return({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>恢复规则</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Protection({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>IP管理</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="block-source-ip">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>阻止源IP</span>
            </span>
          </div>
          <div class="menu-item" data-action="allow-source-ip">
            <span class="menu-label">
              ${IconPark.Unlock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>允许源IP</span>
            </span>
          </div>
          <div class="menu-item" data-action="block-dest-ip">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>阻止目标IP</span>
            </span>
          </div>
          <div class="menu-item" data-action="ip-whitelist">
            <span class="menu-label">
              ${IconPark.CheckOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>加入白名单</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.PlugOne({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>端口管理</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="open-port">
            <span class="menu-label">
              ${IconPark.Unlock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>开放端口</span>
            </span>
          </div>
          <div class="menu-item" data-action="close-port">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>关闭端口</span>
            </span>
          </div>
          <div class="menu-item" data-action="port-forward">
            <span class="menu-label">
              ${IconPark.ShareOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>端口转发</span>
            </span>
          </div>
          <div class="menu-item" data-action="list-open-ports">
            <span class="menu-label">
              ${IconPark.ListTwo({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看开放端口</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Analysis({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>防火墙诊断</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="firewall-status">
            <span class="menu-label">
              ${IconPark.CheckOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>防火墙状态</span>
            </span>
          </div>
          <div class="menu-item" data-action="rule-statistics">
            <span class="menu-label">
              ${IconPark.ChartLine({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>规则统计</span>
            </span>
          </div>
          <div class="menu-item" data-action="recent-logs">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>最近日志</span>
            </span>
          </div>
          <div class="menu-item" data-action="test-rule">
            <span class="menu-label">
              ${IconPark.Experiment({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>测试规则</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Shield({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>安全策略</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="default-policy">
            <span class="menu-label">
              ${IconPark.SettingConfig({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看默认策略</span>
            </span>
          </div>
          <div class="menu-item" data-action="set-drop-policy">
            <span class="menu-label">
              ${IconPark.CloseOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>设置拒绝策略</span>
            </span>
          </div>
          <div class="menu-item" data-action="set-accept-policy">
            <span class="menu-label">
              ${IconPark.CheckOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>设置允许策略</span>
            </span>
          </div>
          <div class="menu-item" data-action="rate-limit">
            <span class="menu-label">
              ${IconPark.Speed({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>流量限制</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-divider"></div>

      <div class="menu-item" data-action="delete-rule">
        <span class="menu-label">
          ${IconPark.Delete({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>删除规则</span>
        </span>
      </div>

      <div class="menu-item" data-action="refresh">
        <span class="menu-label">
          ${IconPark.Refresh({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>刷新规则列表</span>
        </span>
      </div>
    `
  }

  protected async handleSpecialAction(action: string): Promise<boolean> {
    if (!this.currentRule) return false

    const { chain, target, protocol, source, destination, options } = this.currentRule

    switch (action) {
      case 'rule-details':
        this.showModal('防火墙规则详情', `链: ${chain}\n目标: ${target}\n协议: ${protocol}\n源地址: ${source}\n目标地址: ${destination}\n选项: ${options}`)
        return true

      case 'copy-rule':
        navigator.clipboard.writeText(`${chain} ${target} ${protocol} ${source} ${destination} ${options}`)
        this.showModal('复制成功', `已复制规则: ${chain} ${target} ${protocol}`)
        return true

      case 'copy-source':
        navigator.clipboard.writeText(source)
        this.showModal('复制成功', `已复制源地址: ${source}`)
        return true

      case 'copy-destination':
        navigator.clipboard.writeText(destination)
        this.showModal('复制成功', `已复制目标地址: ${destination}`)
        return true

      default:
        return false
    }
  }

  protected resolveAction(action: string): MenuAction | null {
    if (!this.currentRule) return null

    const { chain, protocol, source, destination, options } = this.currentRule

    const actions: Record<string, MenuAction> = {
      // 规则管理
      'list-all-rules': {
        command: `if command -v iptables >/dev/null 2>&1; then echo "=== iptables规则 ==="; iptables -L -n -v --line-numbers; elif command -v firewall-cmd >/dev/null 2>&1; then echo "=== firewalld规则 ==="; firewall-cmd --list-all; elif command -v ufw >/dev/null 2>&1; then echo "=== UFW规则 ==="; ufw status verbose; else echo "⚠️ 未找到防火墙工具"; fi`,
        title: '所有防火墙规则',
        actionName: '查看所有规则',
      },
      'list-chain-rules': {
        command: `if command -v iptables >/dev/null 2>&1; then echo "=== ${chain} 链规则 ==="; iptables -L ${chain} -n -v --line-numbers; else echo "⚠️ iptables命令不可用"; fi`,
        title: `${chain} 链规则`,
        actionName: '查看链规则',
      },
      'save-rules': {
        command: `if command -v iptables-save >/dev/null 2>&1; then iptables-save > /etc/iptables/rules.v4 2>/dev/null && echo "✓ iptables规则已保存" || echo "⚠️ 保存失败，需要root权限"; elif command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --runtime-to-permanent && echo "✓ firewalld规则已保存"; elif command -v ufw >/dev/null 2>&1; then echo "✓ UFW规则自动保存"; else echo "⚠️ 未找到防火墙工具"; fi`,
        title: '保存防火墙规则',
        actionName: '保存规则',
      },
      'restore-rules': {
        command: `if command -v iptables-restore >/dev/null 2>&1; then iptables-restore < /etc/iptables/rules.v4 2>/dev/null && echo "✓ iptables规则已恢复" || echo "⚠️ 恢复失败，需要root权限"; elif command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --reload && echo "✓ firewalld规则已重载"; else echo "⚠️ 未找到防火墙工具"; fi`,
        title: '恢复防火墙规则',
        actionName: '恢复规则',
      },

      // IP管理
      'block-source-ip': {
        command: `if command -v iptables >/dev/null 2>&1; then echo "阻止源IP: ${source}"; echo "命令: iptables -A INPUT -s ${source} -j DROP"; echo "⚠️ 需要root权限执行"; else echo "⚠️ iptables命令不可用"; fi`,
        title: `阻止源IP - ${source}`,
        actionName: '阻止源IP',
      },
      'allow-source-ip': {
        command: `if command -v iptables >/dev/null 2>&1; then echo "允许源IP: ${source}"; echo "命令: iptables -D INPUT -s ${source} -j DROP"; echo "⚠️ 需要root权限执行"; else echo "⚠️ iptables命令不可用"; fi`,
        title: `允许源IP - ${source}`,
        actionName: '允许源IP',
      },
      'block-dest-ip': {
        command: `if command -v iptables >/dev/null 2>&1; then echo "阻止目标IP: ${destination}"; echo "命令: iptables -A OUTPUT -d ${destination} -j DROP"; echo "⚠️ 需要root权限执行"; else echo "⚠️ iptables命令不可用"; fi`,
        title: `阻止目标IP - ${destination}`,
        actionName: '阻止目标IP',
      },
      'ip-whitelist': {
        command: `if command -v iptables >/dev/null 2>&1; then echo "加入白名单: ${source}"; echo "命令: iptables -I INPUT -s ${source} -j ACCEPT"; echo "⚠️ 需要root权限执行"; else echo "⚠️ iptables命令不可用"; fi`,
        title: `加入白名单 - ${source}`,
        actionName: '加入白名单',
      },

      // 端口管理
      'open-port': {
        command: `port=$(echo "${options}" | grep -oP 'dpt:\\K[0-9]+' || echo "未知"); if [ "$port" != "未知" ]; then if command -v iptables >/dev/null 2>&1; then echo "开放端口: $port"; echo "命令: iptables -A INPUT -p ${protocol} --dport $port -j ACCEPT"; echo "⚠️ 需要root权限执行"; elif command -v firewall-cmd >/dev/null 2>&1; then echo "命令: firewall-cmd --add-port=$port/${protocol} --permanent"; echo "⚠️ 需要root权限执行"; elif command -v ufw >/dev/null 2>&1; then echo "命令: ufw allow $port/${protocol}"; echo "⚠️ 需要root权限执行"; else echo "⚠️ 未找到防火墙工具"; fi; else echo "⚠️ 无法从规则中提取端口信息"; fi`,
        title: '开放端口',
        actionName: '开放端口',
      },
      'close-port': {
        command: `port=$(echo "${options}" | grep -oP 'dpt:\\K[0-9]+' || echo "未知"); if [ "$port" != "未知" ]; then if command -v iptables >/dev/null 2>&1; then echo "关闭端口: $port"; echo "命令: iptables -A INPUT -p ${protocol} --dport $port -j DROP"; echo "⚠️ 需要root权限执行"; elif command -v firewall-cmd >/dev/null 2>&1; then echo "命令: firewall-cmd --remove-port=$port/${protocol} --permanent"; echo "⚠️ 需要root权限执行"; elif command -v ufw >/dev/null 2>&1; then echo "命令: ufw deny $port/${protocol}"; echo "⚠️ 需要root权限执行"; else echo "⚠️ 未找到防火墙工具"; fi; else echo "⚠️ 无法从规则中提取端口信息"; fi`,
        title: '关闭端口',
        actionName: '关闭端口',
      },
      'port-forward': {
        command: `echo "端口转发配置"; echo "⚠️ 此功能需要root权限"; echo ""; echo "示例命令:"; echo "iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8080"`,
        title: '端口转发',
        actionName: '端口转发',
      },
      'list-open-ports': {
        command: `if command -v iptables >/dev/null 2>&1; then echo "=== 开放的端口 ==="; iptables -L INPUT -n | grep ACCEPT | grep -oP 'dpt:\\K[0-9]+' | sort -u; elif command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --list-ports; elif command -v ufw >/dev/null 2>&1; then ufw status | grep ALLOW; else echo "⚠️ 未找到防火墙工具"; fi`,
        title: '开放的端口',
        actionName: '查看开放端口',
      },

      // 防火墙诊断
      'firewall-status': {
        command: `if command -v iptables >/dev/null 2>&1; then echo "=== iptables状态 ==="; iptables -L -n | head -20; elif command -v firewall-cmd >/dev/null 2>&1; then echo "=== firewalld状态 ==="; firewall-cmd --state; firewall-cmd --get-active-zones; elif command -v ufw >/dev/null 2>&1; then echo "=== UFW状态 ==="; ufw status verbose; else echo "⚠️ 未找到防火墙工具"; fi`,
        title: '防火墙状态',
        actionName: '查看防火墙状态',
      },
      'rule-statistics': {
        command: `if command -v iptables >/dev/null 2>&1; then echo "=== 规则统计 ==="; echo "总规则数: $(iptables -L | grep -c '^Chain\\|^target')"; echo ""; echo "各链规则数:"; for chain in INPUT OUTPUT FORWARD; do echo "$chain: $(iptables -L $chain -n | grep -c '^ACCEPT\\|^DROP\\|^REJECT')"; done; else echo "⚠️ iptables命令不可用"; fi`,
        title: '规则统计',
        actionName: '规则统计',
      },
      'recent-logs': {
        command: `echo "=== 防火墙最近日志 ==="; echo ""; journalctl -u firewalld -n 50 2>/dev/null || journalctl | grep -i firewall | tail -50 2>/dev/null || grep -i firewall /var/log/syslog | tail -50 2>/dev/null || echo "⚠️ 无法读取日志"`,
        title: '防火墙日志',
        actionName: '查看日志',
      },
      'test-rule': {
        command: `echo "=== 测试规则 ==="; echo ""; echo "规则: ${chain} ${this.currentRule.target} ${protocol} ${source} ${destination}"; echo ""; echo "测试连接..."; echo "⚠️ 实际测试需要根据具体规则进行"`,
        title: '测试规则',
        actionName: '测试规则',
      },

      // 安全策略
      'default-policy': {
        command: `if command -v iptables >/dev/null 2>&1; then echo "=== 默认策略 ==="; iptables -L | grep "Chain" | grep "policy"; else echo "⚠️ iptables命令不可用"; fi`,
        title: '默认策略',
        actionName: '查看默认策略',
      },
      'set-drop-policy': {
        command: `echo "设置拒绝策略"; echo ""; echo "命令:"; echo "iptables -P INPUT DROP"; echo "iptables -P OUTPUT DROP"; echo "iptables -P FORWARD DROP"; echo ""; echo "⚠️ 需要root权限执行"`,
        title: '设置拒绝策略',
        actionName: '设置拒绝策略',
      },
      'set-accept-policy': {
        command: `echo "设置允许策略"; echo ""; echo "命令:"; echo "iptables -P INPUT ACCEPT"; echo "iptables -P OUTPUT ACCEPT"; echo "iptables -P FORWARD ACCEPT"; echo ""; echo "⚠️ 需要root权限执行"`,
        title: '设置允许策略',
        actionName: '设置允许策略',
      },
      'rate-limit': {
        command: `echo "流量限制示例"; echo ""; echo "限制连接速率:"; echo "iptables -A INPUT -p tcp --dport 80 -m limit --limit 25/minute --limit-burst 100 -j ACCEPT"; echo ""; echo "⚠️ 需要root权限执行"`,
        title: '流量限制',
        actionName: '流量限制',
      },

      // 其他操作
      'delete-rule': {
        command: `echo "删除规则"; echo ""; echo "⚠️ 此操作需要root权限"; echo ""; echo "示例命令:"; echo "iptables -D ${chain} <规则编号>"`,
        title: '删除规则',
        actionName: '删除规则',
      },
      'refresh': {
        command: `echo "刷新防火墙规则列表..."; if command -v iptables >/dev/null 2>&1; then iptables -L -n -v --line-numbers; elif command -v firewall-cmd >/dev/null 2>&1; then firewall-cmd --list-all; elif command -v ufw >/dev/null 2>&1; then ufw status verbose; else echo "⚠️ 未找到防火墙工具"; fi`,
        title: '刷新规则列表',
        actionName: '刷新规则列表',
      },
    }

    return actions[action] || null
  }
}
