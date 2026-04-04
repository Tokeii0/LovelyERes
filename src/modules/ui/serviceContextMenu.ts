/**
 * 系统服务右键菜单管理器
 */

import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class ServiceContextMenu extends BaseContextMenu {
  private currentService: string = ''

  constructor() {
    super('service')
  }

  protected onShowContextMenu(serviceName: string) {
    this.currentService = serviceName
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
          <div class="menu-item" data-action="status">
            <span class="menu-label">
              ${IconPark.CheckOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>服务状态</span>
            </span>
          </div>
          <div class="menu-item" data-action="config">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看配置文件</span>
            </span>
          </div>
          <div class="menu-item" data-action="details">
            <span class="menu-label">
              ${IconPark.FileSearch({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>服务详细信息</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-name">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制服务名称</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Power({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>服务控制</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="start">
            <span class="menu-label">
              ${IconPark.Play({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>启动服务</span>
            </span>
          </div>
          <div class="menu-item" data-action="stop">
            <span class="menu-label">
              ${IconPark.Pause({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>停止服务</span>
            </span>
          </div>
          <div class="menu-item" data-action="restart">
            <span class="menu-label">
              ${IconPark.Refresh({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>重启服务</span>
            </span>
          </div>
          <div class="menu-item" data-action="reload">
            <span class="menu-label">
              ${IconPark.Redo({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>重新加载配置</span>
            </span>
          </div>
          <div class="menu-item" data-action="enable">
            <span class="menu-label">
              ${IconPark.Check({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>启用开机自启</span>
            </span>
          </div>
          <div class="menu-item" data-action="disable">
            <span class="menu-label">
              ${IconPark.Close({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>禁用开机自启</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Log({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>日志查询</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="logs">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看服务日志</span>
            </span>
          </div>
          <div class="menu-item" data-action="errors">
            <span class="menu-label">
              ${IconPark.Caution({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看错误日志</span>
            </span>
          </div>
          <div class="menu-item" data-action="live-logs">
            <span class="menu-label">
              ${IconPark.Connection({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看实时日志</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.NetworkTree({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>依赖分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="dependencies">
            <span class="menu-label">
              ${IconPark.Connection({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看依赖服务</span>
            </span>
          </div>
          <div class="menu-item" data-action="reverse-dependencies">
            <span class="menu-label">
              ${IconPark.Return({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看被依赖服务</span>
            </span>
          </div>
          <div class="menu-item" data-action="service-tree">
            <span class="menu-label">
              ${IconPark.Tree({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看服务树</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.ChartPie({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>资源监控</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="cpu-usage">
            <span class="menu-label">
              ${IconPark.Cpu({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>CPU使用率</span>
            </span>
          </div>
          <div class="menu-item" data-action="memory-usage">
            <span class="menu-label">
              ${IconPark.DatabaseConfig({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>内存使用</span>
            </span>
          </div>
          <div class="menu-item" data-action="process-list">
            <span class="menu-label">
              ${IconPark.ListTwo({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>进程列表</span>
            </span>
          </div>
          <div class="menu-item" data-action="open-files">
            <span class="menu-label">
              ${IconPark.FileCode({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>打开的文件</span>
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
          <div class="menu-item" data-action="run-user">
            <span class="menu-label">
              ${IconPark.User({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看运行用户</span>
            </span>
          </div>
          <div class="menu-item" data-action="permissions">
            <span class="menu-label">
              ${IconPark.Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看权限配置</span>
            </span>
          </div>
          <div class="menu-item" data-action="security-check">
            <span class="menu-label">
              ${IconPark.Shield({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>配置安全性检查</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.SettingConfig({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>高级操作</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="edit-service">
            <span class="menu-label">
              ${IconPark.Edit({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看服务文件</span>
            </span>
          </div>
          <div class="menu-item" data-action="timer">
            <span class="menu-label">
              ${IconPark.Timer({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看定时器配置</span>
            </span>
          </div>
          <div class="menu-item" data-action="environment">
            <span class="menu-label">
              ${IconPark.Config({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看环境变量</span>
            </span>
          </div>
        </div>
      </div>
    `
  }

  protected async handleSpecialAction(action: string): Promise<boolean> {
    if (action === 'copy-name') {
      navigator.clipboard.writeText(this.currentService)
      this.showModal('复制成功', `已复制服务名称: ${this.currentService}`)
      return true
    }
    return false
  }

  protected resolveAction(action: string): MenuAction | null {
    const service = this.currentService
    const actions: Record<string, MenuAction> = {
      // 基本信息
      'status': { command: `systemctl status ${service} 2>/dev/null || service ${service} status 2>/dev/null || echo "无法获取服务状态"`, title: `服务状态 - ${service}`, actionName: '查看服务状态' },
      'config': { command: `systemctl cat ${service} 2>/dev/null || cat /etc/init.d/${service} 2>/dev/null || echo "无法找到配置文件"`, title: `配置文件 - ${service}`, actionName: '查看配置文件' },
      'details': { command: `systemctl show ${service} 2>/dev/null || echo "无法获取详细信息"`, title: `详细信息 - ${service}`, actionName: '查看详细信息' },

      // 服务控制
      'start': { command: `systemctl start ${service} 2>&1 || service ${service} start 2>&1`, title: `启动服务 - ${service}`, actionName: '启动服务' },
      'stop': { command: `systemctl stop ${service} 2>&1 || service ${service} stop 2>&1`, title: `停止服务 - ${service}`, actionName: '停止服务' },
      'restart': { command: `systemctl restart ${service} 2>&1 || service ${service} restart 2>&1`, title: `重启服务 - ${service}`, actionName: '重启服务' },
      'reload': { command: `systemctl reload ${service} 2>&1 || service ${service} reload 2>&1 || echo "该服务不支持reload操作"`, title: `重新加载配置 - ${service}`, actionName: '重新加载配置' },
      'enable': { command: `systemctl enable ${service} 2>&1 && echo "✓ 已启用开机自启" || echo "✗ 启用失败"`, title: `启用开机自启 - ${service}`, actionName: '启用开机自启' },
      'disable': { command: `systemctl disable ${service} 2>&1 && echo "✓ 已禁用开机自启" || echo "✗ 禁用失败"`, title: `禁用开机自启 - ${service}`, actionName: '禁用开机自启' },

      // 日志查询
      'logs': { command: `journalctl -u ${service} -n 100 --no-pager 2>/dev/null || tail -100 /var/log/${service}.log 2>/dev/null || echo "无法获取日志"`, title: `服务日志 - ${service}`, actionName: '查看服务日志' },
      'errors': { command: `journalctl -u ${service} -p err -n 50 --no-pager 2>/dev/null || grep -i error /var/log/${service}.log 2>/dev/null | tail -50 || echo "无错误日志"`, title: `错误日志 - ${service}`, actionName: '查看错误日志' },
      'live-logs': { command: `echo "实时日志查看（最新20行）:"; echo ""; journalctl -u ${service} -n 20 -f --no-pager 2>/dev/null || tail -20 -f /var/log/${service}.log 2>/dev/null || echo "无法获取实时日志"`, title: `实时日志 - ${service}`, actionName: '查看实时日志' },

      // 依赖分析
      'dependencies': { command: `systemctl list-dependencies ${service} --no-pager 2>/dev/null || echo "无法获取依赖信息"`, title: `依赖服务 - ${service}`, actionName: '查看依赖服务' },
      'reverse-dependencies': { command: `systemctl list-dependencies ${service} --reverse --no-pager 2>/dev/null || echo "无法获取反向依赖信息"`, title: `被依赖服务 - ${service}`, actionName: '查看被依赖服务' },
      'service-tree': { command: `systemctl list-dependencies ${service} --all --no-pager 2>/dev/null || echo "无法获取服务树"`, title: `服务树 - ${service}`, actionName: '查看服务树' },

      // 资源监控
      'cpu-usage': { command: `echo "=== CPU使用率 ==="; echo ""; systemctl status ${service} 2>/dev/null | grep "CPU:" || ps aux | grep ${service} | grep -v grep | awk '{print "CPU: "$3"%"}' || echo "无法获取CPU使用率"`, title: `CPU使用率 - ${service}`, actionName: '查看CPU使用率' },
      'memory-usage': { command: `echo "=== 内存使用 ==="; echo ""; systemctl status ${service} 2>/dev/null | grep "Memory:" || ps aux | grep ${service} | grep -v grep | awk '{print "Memory: "$4"% ("$6" KB)"}' || echo "无法获取内存使用"`, title: `内存使用 - ${service}`, actionName: '查看内存使用' },
      'process-list': { command: `systemctl status ${service} 2>/dev/null | grep -A 20 "CGroup:" || ps aux | grep ${service} | grep -v grep || echo "无法获取进程列表"`, title: `进程列表 - ${service}`, actionName: '查看进程列表' },
      'open-files': { command: `pid=$(systemctl show ${service} --property=MainPID --value 2>/dev/null); if [ -n "$pid" ] && [ "$pid" != "0" ]; then lsof -p $pid 2>/dev/null | head -50 || echo "无法获取打开的文件"; else echo "服务未运行或无法获取PID"; fi`, title: `打开的文件 - ${service}`, actionName: '查看打开的文件' },

      // 安全分析
      'run-user': { command: `systemctl show ${service} --property=User,Group,UID,GID 2>/dev/null || ps aux | grep ${service} | grep -v grep | awk '{print "User: "$1}' || echo "无法获取运行用户"`, title: `运行用户 - ${service}`, actionName: '查看运行用户' },
      'permissions': { command: `systemctl show ${service} --property=CapabilityBoundingSet,AmbientCapabilities,NoNewPrivileges,PrivateTmp,ProtectSystem,ProtectHome 2>/dev/null || echo "无法获取权限配置"`, title: `权限配置 - ${service}`, actionName: '查看权限配置' },
      'security-check': { command: `echo "=== 安全配置检查 ==="; echo ""; systemctl show ${service} --property=User,DynamicUser,PrivateTmp,ProtectSystem,ProtectHome,NoNewPrivileges,PrivateDevices,ProtectKernelTunables,ProtectControlGroups,RestrictRealtime 2>/dev/null || echo "无法获取安全配置"`, title: `安全检查 - ${service}`, actionName: '配置安全性检查' },

      // 高级操作
      'edit-service': { command: `systemctl cat ${service} 2>/dev/null || cat /etc/init.d/${service} 2>/dev/null || cat /lib/systemd/system/${service}.service 2>/dev/null || echo "无法找到服务文件"`, title: `服务文件 - ${service}`, actionName: '查看服务文件' },
      'timer': { command: `systemctl list-timers --all | grep ${service} || echo "该服务没有关联的定时器"`, title: `定时器配置 - ${service}`, actionName: '查看定时器配置' },
      'environment': { command: `systemctl show ${service} --property=Environment,EnvironmentFiles 2>/dev/null || echo "无法获取环境变量"`, title: `环境变量 - ${service}`, actionName: '查看环境变量' },
    }

    return actions[action] || null
  }
}
