/**
 * 计划任务右键菜单管理器
 */

import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class CronContextMenu extends BaseContextMenu {
  private currentCron: {
    user: string
    schedule: string
    command: string
    source: string
  } | null = null

  constructor() {
    super('cron')
  }

  protected onShowContextMenu(cronInfo: { user: string; schedule: string; command: string; source: string }) {
    this.currentCron = cronInfo
  }

  protected getMenuItemsHTML(): string {
    return `
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.FileCode({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>源文件操作</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="view-source">
            <span class="menu-label">
              ${IconPark.Find({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看源文件内容</span>
            </span>
          </div>
          <div class="menu-item" data-action="delete-task-file">
            <span class="menu-label">
              ${IconPark.Delete({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>删除任务及文件</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Info({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>基本信息</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="details">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看任务详情</span>
            </span>
          </div>
          <div class="menu-item" data-action="schedule">
            <span class="menu-label">
              ${IconPark.Schedule({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看执行时间表</span>
            </span>
          </div>
          <div class="menu-item" data-action="command">
            <span class="menu-label">
              ${IconPark.Terminal({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看执行命令</span>
            </span>
          </div>
          <div class="menu-item" data-action="copy-command">
            <span class="menu-label">
              ${IconPark.Copy({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>复制命令</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.SettingConfig({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>任务管理</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="run-now">
            <span class="menu-label">
              ${IconPark.Play({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>立即执行</span>
            </span>
          </div>
          <div class="menu-item" data-action="test-command">
            <span class="menu-label">
              ${IconPark.Experiment({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>测试命令</span>
            </span>
          </div>
          <div class="menu-item" data-action="view-crontab">
            <span class="menu-label">
              ${IconPark.FileSearch({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看完整crontab</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Log({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>执行历史</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="execution-logs">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看执行日志</span>
            </span>
          </div>
          <div class="menu-item" data-action="recent-runs">
            <span class="menu-label">
              ${IconPark.History({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>最近执行记录</span>
            </span>
          </div>
          <div class="menu-item" data-action="error-logs">
            <span class="menu-label">
              ${IconPark.Caution({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>查看错误日志</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Time({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>时间分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="parse-cron">
            <span class="menu-label">
              ${IconPark.Analysis({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>解析cron表达式</span>
            </span>
          </div>
          <div class="menu-item" data-action="next-run">
            <span class="menu-label">
              ${IconPark.Timer({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>下次执行时间</span>
            </span>
          </div>
          <div class="menu-item" data-action="frequency">
            <span class="menu-label">
              ${IconPark.ChartLine({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>执行频率分析</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Protection({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>安全检查</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="security-check">
            <span class="menu-label">
              ${IconPark.Shield({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>命令安全性检查</span>
            </span>
          </div>
          <div class="menu-item" data-action="check-path">
            <span class="menu-label">
              ${IconPark.FolderOpen({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>检查命令路径</span>
            </span>
          </div>
          <div class="menu-item" data-action="suspicious-check">
            <span class="menu-label">
              ${IconPark.Attention({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>可疑命令检测</span>
            </span>
          </div>
        </div>
      </div>

      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.SettingTwo({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>高级操作</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="backup">
            <span class="menu-label">
              ${IconPark.Save({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>备份crontab</span>
            </span>
          </div>
          <div class="menu-item" data-action="export">
            <span class="menu-label">
              ${IconPark.Export({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>导出任务配置</span>
            </span>
          </div>
        </div>
      </div>
    `
  }

  protected async handleSpecialAction(action: string): Promise<boolean> {
    if (!this.currentCron) return false

    const { command, source } = this.currentCron

    if (action === 'copy-command') {
      navigator.clipboard.writeText(command)
      this.showModal('复制成功', `已复制命令: ${command}`)
      return true
    }

    if (action === 'view-source') {
      if (source && source.startsWith('/')) {
        // Handled by resolveAction
        return false
      } else if (source && source.startsWith('crontab:')) {
        // Handled by resolveAction
        return false
      } else {
        this.showModal('提示', '无法确定源文件位置')
        return true
      }
    }

    if (action === 'delete-task-file') {
      if (source && source.startsWith('/')) {
        if (source === '/etc/crontab') {
          this.showModal('错误', '不能删除系统主crontab文件 (/etc/crontab)')
          return true
        }
        // Valid path, let resolveAction handle
        return false
      } else {
        this.showModal('提示', '此任务不是通过独立文件配置的，无法通过删除文件来删除任务。\n\n如果是用户任务，请使用"crontab -e"编辑。')
        return true
      }
    }

    return false
  }

  protected resolveAction(action: string): MenuAction | null {
    if (!this.currentCron) return null

    const { user, schedule, command, source } = this.currentCron

    const actions: Record<string, MenuAction | (() => MenuAction)> = {
      // 源文件操作
      'view-source': () => {
        if (source && source.startsWith('/')) {
          return { command: `echo "=== 源文件: ${source} ==="; echo ""; cat "${source}" 2>&1 || echo "无法读取文件"`, title: `源文件 - ${source}`, actionName: '查看源文件' }
        } else {
          const u = source.split(':')[1]
          return { command: `echo "=== 用户Crontab: ${u} ==="; echo ""; crontab -u ${u} -l`, title: `用户Crontab - ${u}`, actionName: '查看源文件' }
        }
      },
      'delete-task-file': {
        command: `echo "正在删除文件: ${source}"; rm -f "${source}" && echo "✓ 删除成功" || echo "✗ 删除失败"`,
        title: `删除任务文件 - ${source}`,
        actionName: '删除任务文件'
      },

      // 基本信息
      'details': {
        command: `echo "=== 计划任务详情 ==="; echo ""; echo "用户: ${user}"; echo "时间表: ${schedule}"; echo "命令: ${command}"; echo ""; echo "=== 任务状态 ==="; crontab -u ${user} -l 2>/dev/null | grep -F "${command}" || echo "任务可能已被删除或修改"`,
        title: `计划任务详情 - ${user}`,
        actionName: '查看任务详情'
      },
      'schedule': {
        command: `echo "=== 执行时间表分析 ==="; echo ""; echo "Cron表达式: ${schedule}"; echo ""; echo "字段说明:"; echo "分钟(0-59) 小时(0-23) 日(1-31) 月(1-12) 星期(0-7)"; echo ""; echo "当前表达式解析:"; echo "${schedule}" | awk '{print "分钟: "$1; print "小时: "$2; print "日期: "$3; print "月份: "$4; print "星期: "$5}'`,
        title: `执行时间表 - ${schedule}`,
        actionName: '查看执行时间表'
      },
      'command': {
        command: `echo "=== 执行命令 ==="; echo ""; echo "${command}"; echo ""; echo "=== 命令分析 ==="; which ${command.split(' ')[0]} 2>/dev/null || echo "命令路径: 未找到或不在PATH中"`,
        title: `执行命令 - ${command.substring(0, 120)}...`,
        actionName: '查看执行命令'
      },

      // 任务管理
      'run-now': {
        command: `echo "立即执行计划任务"; echo ""; echo "用户: ${user}"; echo "命令: ${command}"; echo ""; echo "执行中..."; echo ""; ${command}`,
        title: `立即执行 - ${command.substring(0, 120)}...`,
        actionName: '立即执行任务'
      },
      'test-command': {
        command: `echo "=== 测试命令 ==="; echo ""; echo "命令: ${command}"; echo ""; echo "检查命令语法..."; bash -n -c "${command}" 2>&1 && echo "✓ 语法检查通过" || echo "✗ 语法错误"; echo ""; echo "⚠️ 提示：这只是语法检查，实际执行可能需要其他条件"`,
        title: `测试命令 - ${command.substring(0, 120)}...`,
        actionName: '测试命令'
      },
      'view-crontab': {
        command: `crontab -u ${user} -l 2>/dev/null || echo "用户 ${user} 没有crontab"`,
        title: `完整crontab - ${user}`,
        actionName: '查看完整crontab'
      },

      // 执行历史
      'execution-logs': {
        command: `echo "=== 计划任务执行日志 ==="; echo ""; echo "搜索关键词: ${command.split(' ')[0]}"; echo ""; grep CRON /var/log/syslog 2>/dev/null | grep "${user}" | grep "${command.split(' ')[0]}" | tail -50 || journalctl -u cron 2>/dev/null | grep "${user}" | grep "${command.split(' ')[0]}" | tail -50 || echo "无执行日志或日志文件不可访问"`,
        title: `执行日志 - ${command.substring(0, 120)}...`,
        actionName: '查看执行日志'
      },
      'recent-runs': {
        command: `echo "=== 最近执行记录 ==="; echo ""; grep CRON /var/log/syslog 2>/dev/null | grep "(${user})" | tail -20 || journalctl -u cron 2>/dev/null | grep "${user}" | tail -20 || echo "无执行记录"`,
        title: `最近执行记录 - ${user}`,
        actionName: '查看最近执行记录'
      },
      'error-logs': {
        command: `echo "=== 错误日志 ==="; echo ""; grep -i "error\\|fail\\|cron" /var/log/syslog 2>/dev/null | grep "${user}" | tail -30 || journalctl -p err 2>/dev/null | grep cron | grep "${user}" | tail -30 || echo "无错误日志"`,
        title: `错误日志 - ${user}`,
        actionName: '查看错误日志'
      },

      // 时间分析
      'parse-cron': {
        command: `echo "=== Cron表达式解析 ==="; echo ""; echo "表达式: ${schedule}"; echo ""; if [[ "${schedule}" == "@hourly" ]]; then echo "含义: 每小时执行一次 (0 * * * *)"; elif [[ "${schedule}" == "@daily" ]] || [[ "${schedule}" == "@midnight" ]]; then echo "含义: 每天午夜执行 (0 0 * * *)"; elif [[ "${schedule}" == "@weekly" ]]; then echo "含义: 每周日午夜执行 (0 0 * * 0)"; elif [[ "${schedule}" == "@monthly" ]]; then echo "含义: 每月1号午夜执行 (0 0 1 * *)"; elif [[ "${schedule}" == "@yearly" ]] || [[ "${schedule}" == "@annually" ]]; then echo "含义: 每年1月1日午夜执行 (0 0 1 1 *)"; elif [[ "${schedule}" == "@reboot" ]]; then echo "含义: 系统启动时执行"; else echo "标准cron表达式"; echo "${schedule}" | awk '{print "分钟: "$1" (0-59)"; print "小时: "$2" (0-23)"; print "日期: "$3" (1-31)"; print "月份: "$4" (1-12)"; print "星期: "$5" (0-7, 0和7都表示周日)"}'; fi`,
        title: `Cron表达式解析 - ${schedule}`,
        actionName: '解析cron表达式'
      },
      'next-run': {
        command: `echo "=== 下次执行时间 ==="; echo ""; echo "当前时间: $(date '+%Y-%m-%d %H:%M:%S')"; echo "时间表: ${schedule}"; echo ""; echo "⚠️ 注意：精确计算需要安装croniter等工具"; echo ""; if [[ "${schedule}" == "@hourly" ]]; then echo "下次执行: 下一个整点"; elif [[ "${schedule}" == "@daily" ]]; then echo "下次执行: 明天 00:00"; elif [[ "${schedule}" == "@weekly" ]]; then echo "下次执行: 下周日 00:00"; elif [[ "${schedule}" == "@monthly" ]]; then echo "下次执行: 下月1日 00:00"; else echo "标准cron表达式，请使用cron计算工具"; fi`,
        title: `下次执行时间 - ${schedule}`,
        actionName: '查看下次执行时间'
      },
      'frequency': {
        command: `echo "=== 执行频率分析 ==="; echo ""; echo "时间表: ${schedule}"; echo ""; if [[ "${schedule}" == "@hourly" ]]; then echo "频率: 每小时1次"; echo "每天: 24次"; echo "每月: ~720次"; elif [[ "${schedule}" == "@daily" ]]; then echo "频率: 每天1次"; echo "每月: ~30次"; echo "每年: 365次"; elif [[ "${schedule}" == "@weekly" ]]; then echo "频率: 每周1次"; echo "每月: ~4次"; echo "每年: 52次"; elif [[ "${schedule}" == "@monthly" ]]; then echo "频率: 每月1次"; echo "每年: 12次"; elif [[ "${schedule}" =~ ^\\*.*\\*.*\\*.*\\*.*\\*$ ]]; then echo "频率: 每分钟1次"; echo "每小时: 60次"; echo "每天: 1440次"; else echo "自定义频率"; echo "请根据cron表达式计算"; fi`,
        title: `执行频率 - ${schedule}`,
        actionName: '执行频率分析'
      },

      // 安全检查
      'security-check': {
        command: `echo "=== 命令安全性检查 ==="; echo ""; echo "命令: ${command}"; echo ""; echo "1. 检查危险命令:"; if echo "${command}" | grep -qE "rm -rf|dd if=|mkfs|fdisk|>/dev/"; then echo "⚠️ 包含危险命令"; else echo "✓ 未发现明显危险命令"; fi; echo ""; echo "2. 检查网络操作:"; if echo "${command}" | grep -qE "wget|curl|nc|telnet|ssh"; then echo "⚠️ 包含网络操作命令"; else echo "✓ 未检测到网络操作"; fi; echo ""; echo "3. 检查权限提升:"; if echo "${command}" | grep -qE "sudo|su -"; then echo "⚠️ 包含权限提升命令"; else echo "✓ 未检测到权限提升"; fi`,
        title: `安全检查 - ${command.substring(0, 120)}...`,
        actionName: '命令安全性检查'
      },
      'check-path': {
        command: `echo "=== 命令路径检查 ==="; echo ""; cmd_name="${command.split(' ')[0]}"; echo "命令: $cmd_name"; echo ""; which "$cmd_name" 2>/dev/null && echo "" && ls -la $(which "$cmd_name") 2>/dev/null || echo "⚠️ 命令不在PATH中或不存在"`,
        title: `路径检查 - ${command.split(' ')[0]}`,
        actionName: '检查命令路径'
      },
      'suspicious-check': {
        command: `echo "=== 可疑命令检测 ==="; echo ""; echo "命令: ${command}"; echo ""; echo "检测项:"; echo ""; echo "1. 编码/混淆:"; if echo "${command}" | grep -qE "base64|eval|exec"; then echo "⚠️ 可能包含编码或混淆"; else echo "✓ 未发现编码"; fi; echo ""; echo "2. 反弹shell:"; if echo "${command}" | grep -qE "bash -i|/bin/sh|nc.*-e"; then echo "⚠️ 可能是反弹shell"; else echo "✓ 未发现反弹shell特征"; fi; echo ""; echo "3. 下载执行:"; if echo "${command}" | grep -qE "curl.*\\||wget.*\\||chmod\\+x"; then echo "⚠️ 可能下载并执行文件"; else echo "✓ 未发现下载执行"; fi`,
        title: `可疑检测 - ${command.substring(0, 120)}...`,
        actionName: '可疑命令检测'
      },

      // 高级操作
      'backup': {
        command: `echo "=== 备份crontab ==="; echo ""; backup_file="/tmp/crontab_${user}_$(date +%Y%m%d_%H%M%S).bak"; crontab -u ${user} -l > "$backup_file" 2>/dev/null && echo "✓ 备份成功" && echo "备份文件: $backup_file" && echo "" && cat "$backup_file" || echo "✗ 备份失败"`,
        title: `备份crontab - ${user}`,
        actionName: '备份crontab'
      },
      'export': {
        command: `echo "=== 导出任务配置 ==="; echo ""; echo "用户: ${user}"; echo "时间表: ${schedule}"; echo "命令: ${command}"; echo ""; echo "JSON格式:"; echo "{"; echo '  "user": "'${user}'",'; echo '  "schedule": "'${schedule}'",'; echo '  "command": "'${command}'"'; echo "}"`,
        title: `导出配置 - ${command.substring(0, 120)}...`,
        actionName: '导出任务配置'
      },
    }

    const entry = actions[action]
    if (!entry) return null

    if (typeof entry === 'function') {
      return entry()
    }
    return entry
  }
}
