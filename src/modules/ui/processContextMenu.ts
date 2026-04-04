/**
 * 进程右键菜单和详情模态框
 */

import * as IconPark from '@icon-park/svg'
import { BaseContextMenu, type MenuAction } from './contextMenu/baseContextMenu'

export class ProcessContextMenu extends BaseContextMenu {
  private currentPid: string = ''

  constructor() {
    super('process')
  }

  protected onShowContextMenu(pid: string) {
    this.currentPid = pid
  }

  protected getMenuItemsHTML(): string {
    return `
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.FileText({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>基本信息</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="cmdline">
            <span class="menu-label">
              ${IconPark.Terminal({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>命令行参数</span>
            </span>
          </div>
          <div class="menu-item" data-action="exe">
            <span class="menu-label">
              ${IconPark.Application({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>可执行路径</span>
            </span>
          </div>
          <div class="menu-item" data-action="cwd">
            <span class="menu-label">
              ${IconPark.FolderClose({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>当前目录</span>
            </span>
          </div>
        </div>
      </div>
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Lock({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>用户与权限</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="status">
            <span class="menu-label">
              ${IconPark.Info({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>进程状态/权限</span>
            </span>
          </div>
          <div class="menu-item" data-action="capabilities">
            <span class="menu-label">
              ${IconPark.Key({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>Capabilities</span>
            </span>
          </div>
          <div class="menu-item" data-action="uid">
            <span class="menu-label">
              ${IconPark.User({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>UID/GID信息</span>
            </span>
          </div>
        </div>
      </div>
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.FolderOpen({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>文件与内存</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="fd">
            <span class="menu-label">
              ${IconPark.FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>打开的文件</span>
            </span>
          </div>
          <div class="menu-item" data-action="maps">
            <span class="menu-label">
              ${IconPark.DataAll({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>内存映射</span>
            </span>
          </div>
          <div class="menu-item" data-action="limits">
            <span class="menu-label">
              ${IconPark.Caution({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>资源限制</span>
            </span>
          </div>
          <div class="menu-item" data-action="io">
            <span class="menu-label">
              ${IconPark.DataFile({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>I/O 统计</span>
            </span>
          </div>
          <div class="menu-item" data-action="memory">
            <span class="menu-label">
              ${IconPark.Cpu({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>内存使用</span>
            </span>
          </div>
          <div class="menu-item" data-action="smaps">
            <span class="menu-label">
              ${IconPark.ChartHistogram({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>内存详细信息</span>
            </span>
          </div>
          <div class="menu-item" data-action="environ">
            <span class="menu-label">
              ${IconPark.Setting({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>环境变量</span>
            </span>
          </div>
        </div>
      </div>
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.NetworkTree({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>网络分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="network">
            <span class="menu-label">
              ${IconPark.Connection({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>网络连接</span>
            </span>
          </div>
          <div class="menu-item" data-action="ports">
            <span class="menu-label">
              ${IconPark.Connection({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>监听端口</span>
            </span>
          </div>
          <div class="menu-item" data-action="netstat">
            <span class="menu-label">
              ${IconPark.DataAll({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>详细网络状态</span>
            </span>
          </div>
          <div class="menu-item" data-action="dns">
            <span class="menu-label">
              ${IconPark.Search({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>DNS查询记录</span>
            </span>
          </div>
        </div>
      </div>
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.TreeDiagram({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>进程关系</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="pstree">
            <span class="menu-label">
              ${IconPark.MindMapping({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>父子进程树</span>
            </span>
          </div>
          <div class="menu-item" data-action="children">
            <span class="menu-label">
              ${IconPark.Peoples({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>子进程列表</span>
            </span>
          </div>
          <div class="menu-item" data-action="parent">
            <span class="menu-label">
              ${IconPark.User({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>父进程信息</span>
            </span>
          </div>
          <div class="menu-item" data-action="threads">
            <span class="menu-label">
              ${IconPark.Cpu({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>线程数</span>
            </span>
          </div>
        </div>
      </div>
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Dashboard({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>性能分析</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="cpu-usage">
            <span class="menu-label">
              ${IconPark.ChartLine({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>CPU使用率</span>
            </span>
          </div>
          <div class="menu-item" data-action="cpu">
            <span class="menu-label">
              ${IconPark.Cpu({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>CPU亲和性</span>
            </span>
          </div>
          <div class="menu-item" data-action="context-switches">
            <span class="menu-label">
              ${IconPark.Exchange({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>上下文切换</span>
            </span>
          </div>
          <div class="menu-item" data-action="oom-score">
            <span class="menu-label">
              ${IconPark.Caution({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>OOM分数</span>
            </span>
          </div>
          <div class="menu-item" data-action="scheduler">
            <span class="menu-label">
              ${IconPark.Time({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>调度策略</span>
            </span>
          </div>
          <div class="menu-item" data-action="syscalls">
            <span class="menu-label">
              ${IconPark.Code({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>系统调用统计</span>
            </span>
          </div>
          <div class="menu-item" data-action="stack">
            <span class="menu-label">
              ${IconPark.Layers({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>调用栈</span>
            </span>
          </div>
          <div class="menu-item" data-action="fd-stats">
            <span class="menu-label">
              ${IconPark.ChartHistogram({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>文件描述符统计</span>
            </span>
          </div>
        </div>
      </div>
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Box({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>隔离与运行时</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="signals">
            <span class="menu-label">
              ${IconPark.Lightning({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>信号处理</span>
            </span>
          </div>
          <div class="menu-item" data-action="namespaces">
            <span class="menu-label">
              ${IconPark.Box({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>Namespace信息</span>
            </span>
          </div>
          <div class="menu-item" data-action="cgroup">
            <span class="menu-label">
              ${IconPark.CategoryManagement({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>Cgroup信息</span>
            </span>
          </div>
          <div class="menu-item" data-action="container">
            <span class="menu-label">
              ${IconPark.Application({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>容器检测</span>
            </span>
          </div>
          <div class="menu-item" data-action="uptime">
            <span class="menu-label">
              ${IconPark.Time({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>运行时长</span>
            </span>
          </div>
        </div>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item menu-parent">
        <span class="menu-label">
          ${IconPark.Protection({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>安全检测</span>
        </span>
        <span class="arrow">▶</span>
        <div class="submenu">
          <div class="menu-item" data-action="suspicious-path">
            <span class="menu-label">
              ${IconPark.FolderFailed({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>可疑路径检测</span>
            </span>
          </div>
          <div class="menu-item" data-action="hidden-process">
            <span class="menu-label">
              ${IconPark.Ghost({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>隐藏进程检测</span>
            </span>
          </div>
          <div class="menu-item" data-action="ld-preload">
            <span class="menu-label">
              ${IconPark.LinkInterrupt({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>LD_PRELOAD检测</span>
            </span>
          </div>
          <div class="menu-item" data-action="deleted-exe">
            <span class="menu-label">
              ${IconPark.Delete({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>已删除可执行文件</span>
            </span>
          </div>
          <div class="menu-item" data-action="suspicious-network">
            <span class="menu-label">
              ${IconPark.LinkCloudFaild({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>可疑网络连接</span>
            </span>
          </div>
          <div class="menu-item" data-action="crypto-mining">
            <span class="menu-label">
              ${IconPark.Bitcoin({ theme: 'outline', size: '14', fill: 'currentColor' })}
              <span>挖矿特征检测</span>
            </span>
          </div>
        </div>
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" data-action="kill">
        <span class="menu-label">
          ${IconPark.CloseOne({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>终止进程</span>
        </span>
      </div>
      <div class="menu-item" data-action="kill-9">
        <span class="menu-label">
          ${IconPark.Caution({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span>强制终止进程</span>
        </span>
      </div>
    `
  }

  protected resolveAction(action: string): MenuAction | null {
    const pid = this.currentPid
    const actions: Record<string, MenuAction> = {
      'cmdline': { command: `cat /proc/${pid}/cmdline | tr '\\0' ' '`, title: `进程 ${pid} - 命令行参数`, actionName: '获取命令行参数' },
      'exe': { command: `ls -l /proc/${pid}/exe 2>/dev/null || echo "无法访问"`, title: `进程 ${pid} - 可执行路径`, actionName: '获取可执行路径' },
      'cwd': { command: `ls -l /proc/${pid}/cwd 2>/dev/null || echo "无法访问"`, title: `进程 ${pid} - 当前目录`, actionName: '获取当前目录' },
      'status': { command: `cat /proc/${pid}/status 2>/dev/null || echo "无法访问"`, title: `进程 ${pid} - 状态/权限`, actionName: '获取进程状态' },
      'capabilities': { command: `grep Cap /proc/${pid}/status 2>/dev/null || echo "无法访问"`, title: `进程 ${pid} - Capabilities`, actionName: '获取Capabilities' },
      'uid': { command: `grep -E "^(Uid|Gid|Groups):" /proc/${pid}/status 2>/dev/null || echo "无法访问"`, title: `进程 ${pid} - UID/GID信息`, actionName: '获取UID/GID信息' },
      'fd': { command: `ls -l /proc/${pid}/fd 2>/dev/null | head -100 || echo "无法访问"`, title: `进程 ${pid} - 打开的文件（前100个）`, actionName: '获取打开的文件' },
      'maps': { command: `cat /proc/${pid}/maps 2>/dev/null | head -100 || echo "无法访问"`, title: `进程 ${pid} - 内存映射（前100行）`, actionName: '获取内存映射' },
      'limits': { command: `cat /proc/${pid}/limits 2>/dev/null || echo "无法访问"`, title: `进程 ${pid} - 资源限制`, actionName: '获取资源限制' },
      'network': { command: `lsof -nP -i -a -p ${pid} 2>/dev/null || (ss -tnp 2>/dev/null | grep "pid=${pid}"; ss -unp 2>/dev/null | grep "pid=${pid}") || echo "无网络连接或权限不足"`, title: `进程 ${pid} - 网络连接`, actionName: '获取网络连接' },
      'ports': { command: `lsof -nP -i -a -p ${pid} 2>/dev/null | grep LISTEN || ss -tlnp 2>/dev/null | grep "pid=${pid}" || ss -ulnp 2>/dev/null | grep "pid=${pid}" || echo "无监听端口或权限不足"`, title: `进程 ${pid} - 监听端口`, actionName: '获取监听端口' },
      'netstat': { command: `echo "=== TCP连接 ==="; lsof -nP -i TCP -a -p ${pid} 2>/dev/null || ss -tnp 2>/dev/null | grep "pid=${pid}" || echo "无TCP连接"; echo ""; echo "=== UDP连接 ==="; lsof -nP -i UDP -a -p ${pid} 2>/dev/null || ss -unp 2>/dev/null | grep "pid=${pid}" || echo "无UDP连接"; echo ""; echo "=== 所有网络文件描述符 ==="; ls -l /proc/${pid}/fd 2>/dev/null | grep socket || echo "无socket文件描述符"`, title: `进程 ${pid} - 详细网络状态`, actionName: '获取详细网络状态' },
      'dns': { command: `lsof -p ${pid} 2>/dev/null | grep -i dns || echo "无DNS查询记录"`, title: `进程 ${pid} - DNS查询记录`, actionName: '获取DNS查询记录' },
      'pstree': { command: `pstree -p ${pid} 2>/dev/null || echo "pstree命令不可用"`, title: `进程 ${pid} - 父子进程树`, actionName: '获取父子进程树' },
      'children': { command: `ls /proc/${pid}/task/*/children 2>/dev/null | xargs cat 2>/dev/null || echo "无子进程"`, title: `进程 ${pid} - 子进程列表`, actionName: '获取子进程列表' },
      'parent': { command: `cat /proc/${pid}/status 2>/dev/null | grep PPid | awk '{print $2}' | xargs -I {} ps -p {} -o pid,user,cmd 2>/dev/null || echo "无法获取父进程"`, title: `进程 ${pid} - 父进程信息`, actionName: '获取父进程信息' },
      'io': { command: `cat /proc/${pid}/io 2>/dev/null || echo "无法访问"`, title: `进程 ${pid} - I/O 统计`, actionName: '获取I/O统计' },
      'threads': { command: `ls /proc/${pid}/task 2>/dev/null | wc -l || echo "无法访问"`, title: `进程 ${pid} - 线程数`, actionName: '获取线程数' },
      'memory': { command: `cat /proc/${pid}/status 2>/dev/null | grep -E "^Vm" || echo "无法访问"`, title: `进程 ${pid} - 内存使用`, actionName: '获取内存使用' },
      'cpu': { command: `taskset -cp ${pid} 2>/dev/null || echo "无法获取CPU亲和性"`, title: `进程 ${pid} - CPU亲和性`, actionName: '获取CPU亲和性' },
      'stack': { command: `cat /proc/${pid}/stack 2>/dev/null || echo "无法访问"`, title: `进程 ${pid} - 调用栈`, actionName: '获取调用栈' },
      'environ': { command: `cat /proc/${pid}/environ 2>/dev/null | tr '\\0' '\\n' || echo "无法访问"`, title: `进程 ${pid} - 环境变量`, actionName: '获取环境变量' },
      'smaps': { command: `cat /proc/${pid}/smaps 2>/dev/null | head -200 || echo "无法访问"`, title: `进程 ${pid} - 内存详细信息（前200行）`, actionName: '获取内存详细信息' },
      'cpu-usage': { command: `echo "=== CPU使用率监控 ==="; echo ""; ps -p ${pid} -o pid,ppid,%cpu,%mem,vsz,rss,tty,stat,start,time,cmd 2>/dev/null || echo "无法获取"; echo ""; echo "=== 实时CPU使用率（5秒采样）==="; for i in {1..5}; do ps -p ${pid} -o %cpu --no-headers 2>/dev/null && sleep 1; done | awk '{sum+=$1; count++} END {if(count>0) print "平均CPU使用率: " sum/count "%"; else print "进程已退出"}'`, title: `进程 ${pid} - CPU使用率`, actionName: '获取CPU使用率' },
      'context-switches': { command: `echo "=== 上下文切换统计 ==="; echo ""; cat /proc/${pid}/status 2>/dev/null | grep -E "^(voluntary_ctxt_switches|nonvoluntary_ctxt_switches):" || echo "无法访问"; echo ""; echo "说明:"; echo "voluntary_ctxt_switches: 自愿上下文切换（进程主动放弃CPU）"; echo "nonvoluntary_ctxt_switches: 非自愿上下文切换（被调度器强制切换）"`, title: `进程 ${pid} - 上下文切换`, actionName: '获取上下文切换统计' },
      'oom-score': { command: `echo "=== OOM (Out Of Memory) 分数 ==="; echo ""; echo "OOM Score: $(cat /proc/${pid}/oom_score 2>/dev/null || echo '无法访问')"; echo "OOM Score Adj: $(cat /proc/${pid}/oom_score_adj 2>/dev/null || echo '无法访问')"; echo "OOM Adj: $(cat /proc/${pid}/oom_adj 2>/dev/null || echo '无法访问')"; echo ""; echo "说明:"; echo "- OOM Score: 系统计算的OOM分数（0-1000），分数越高越容易被杀死"; echo "- OOM Score Adj: 管理员设置的调整值（-1000到1000）"; echo "- OOM Adj: 旧版本的调整值（-17到15）"`, title: `进程 ${pid} - OOM分数`, actionName: '获取OOM分数' },
      'scheduler': { command: `echo "=== 调度策略和优先级 ==="; echo ""; cat /proc/${pid}/stat 2>/dev/null | awk '{print "调度策略: " $41; print "优先级: " $18; print "Nice值: " $19; print "实时优先级: " $40}' || echo "无法访问"; echo ""; echo "进程状态:"; ps -p ${pid} -o pid,pri,ni,rtprio,sched,stat,wchan:20,cmd 2>/dev/null || echo "无法获取"`, title: `进程 ${pid} - 调度策略`, actionName: '获取调度策略' },
      'syscalls': { command: `echo "=== 系统调用统计（采样5秒）==="; echo ""; echo "正在采样..."; timeout 5 strace -c -p ${pid} 2>&1 | tail -20 || echo "⚠️ 需要root权限或strace未安装"`, title: `进程 ${pid} - 系统调用统计`, actionName: '获取系统调用统计' },
      'signals': { command: `echo "=== 信号处理信息 ==="; echo ""; cat /proc/${pid}/status 2>/dev/null | grep -E "^(Sig|Shd):" || echo "无法访问"; echo ""; echo "说明:"; echo "SigQ: 信号队列"; echo "SigPnd: 待处理信号"; echo "ShdPnd: 共享待处理信号"; echo "SigBlk: 被阻塞的信号"; echo "SigIgn: 被忽略的信号"; echo "SigCgt: 被捕获的信号"`, title: `进程 ${pid} - 信号处理`, actionName: '获取信号处理信息' },
      'namespaces': { command: `echo "=== Namespace 信息 ==="; echo ""; ls -l /proc/${pid}/ns/ 2>/dev/null || echo "无法访问"; echo ""; echo "=== Namespace 类型说明 ==="; echo "- mnt: 挂载命名空间"; echo "- uts: UTS命名空间"; echo "- ipc: IPC命名空间"; echo "- pid: PID命名空间"; echo "- net: 网络命名空间"; echo "- user: 用户命名空间"; echo "- cgroup: Cgroup命名空间"`, title: `进程 ${pid} - Namespace信息`, actionName: '获取Namespace信息' },
      'cgroup': { command: `echo "=== Cgroup 信息 ==="; echo ""; cat /proc/${pid}/cgroup 2>/dev/null || echo "无法访问"`, title: `进程 ${pid} - Cgroup信息`, actionName: '获取Cgroup信息' },
      'container': { command: `echo "=== 容器环境检测 ==="; echo ""; echo "1. 检查/.dockerenv文件:"; [ -f /.dockerenv ] && echo "✓ 检测到Docker容器" || echo "✗ 未检测到Docker容器"; echo ""; echo "2. 检查cgroup:"; cat /proc/${pid}/cgroup 2>/dev/null | grep -qE "docker|lxc|kubepods" && echo "✓ 检测到容器cgroup" || echo "✗ 未检测到容器cgroup"; echo ""; echo "3. 检查进程namespace:"; ls -l /proc/${pid}/ns/ 2>/dev/null | wc -l | awk '{if($1>4) print "✓ 可能在容器中"; else print "✗ 可能不在容器中"}'`, title: `进程 ${pid} - 容器检测`, actionName: '检测容器环境' },
      'uptime': { command: `echo "=== 进程运行时长 ==="; echo ""; start_time=$(cat /proc/${pid}/stat 2>/dev/null | awk '{print $22}'); system_uptime=$(cat /proc/uptime | awk '{print $1}'); if [ -n "$start_time" ]; then hz=$(getconf CLK_TCK); start_sec=$((start_time / hz)); current_sec=$(echo "$system_uptime" | cut -d. -f1); runtime=$((current_sec - start_sec)); days=$((runtime / 86400)); hours=$(((runtime % 86400) / 3600)); minutes=$(((runtime % 3600) / 60)); seconds=$((runtime % 60)); echo "启动时间: $(ps -p ${pid} -o lstart --no-headers 2>/dev/null)"; echo "运行时长: \${days}天 \${hours}小时 \${minutes}分钟 \${seconds}秒"; else echo "无法获取运行时长"; fi`, title: `进程 ${pid} - 运行时长`, actionName: '获取运行时长' },
      'fd-stats': { command: `echo "=== 文件描述符统计 ==="; echo ""; fd_count=$(ls /proc/${pid}/fd 2>/dev/null | wc -l); fd_limit=$(cat /proc/${pid}/limits 2>/dev/null | grep "Max open files" | awk '{print $4}'); echo "当前打开: $fd_count"; echo "最大限制: $fd_limit"; echo "使用率: $(echo "scale=2; $fd_count * 100 / $fd_limit" | bc 2>/dev/null || echo '无法计算')%"`, title: `进程 ${pid} - 文件描述符统计`, actionName: '获取文件描述符统计' },
      'suspicious-path': { command: `exe=$(readlink /proc/${pid}/exe 2>/dev/null); cwd=$(readlink /proc/${pid}/cwd 2>/dev/null); echo "可执行文件: $exe"; echo "工作目录: $cwd"; echo ""; echo "可疑路径检测:"; [[ "$exe" =~ ^(/tmp|/dev/shm|/var/tmp) ]] && echo "⚠️ 可执行文件位于可疑目录: $exe" || echo "✓ 可执行文件路径正常"; [[ "$cwd" =~ ^(/tmp|/dev/shm|/var/tmp) ]] && echo "⚠️ 工作目录位于可疑目录: $cwd" || echo "✓ 工作目录正常"`, title: `进程 ${pid} - 可疑路径检测`, actionName: '检测可疑路径' },
      'hidden-process': { command: `ps -p ${pid} >/dev/null 2>&1 && echo "✓ 进程在ps中可见" || echo "⚠️ 进程在ps中不可见（可能被隐藏）"; ls -la /proc/${pid} 2>/dev/null | head -5 || echo "⚠️ 无法访问/proc/${pid}"`, title: `进程 ${pid} - 隐藏进程检测`, actionName: '检测隐藏进程' },
      'ld-preload': { command: `cat /proc/${pid}/environ 2>/dev/null | tr '\\0' '\\n' | grep -E "^(LD_PRELOAD|LD_LIBRARY_PATH)=" && echo "⚠️ 检测到LD_PRELOAD或LD_LIBRARY_PATH" || echo "✓ 未检测到LD_PRELOAD"`, title: `进程 ${pid} - LD_PRELOAD检测`, actionName: '检测LD_PRELOAD' },
      'deleted-exe': { command: `ls -l /proc/${pid}/exe 2>/dev/null | grep deleted && echo "⚠️ 可执行文件已被删除（可能是恶意进程）" || echo "✓ 可执行文件未被删除"`, title: `进程 ${pid} - 已删除可执行文件检测`, actionName: '检测已删除可执行文件' },
      'suspicious-network': { command: `echo "网络连接:"; ss -tnp 2>/dev/null | grep "pid=${pid}"; echo ""; echo "可疑连接检测:"; ss -tnp 2>/dev/null | grep "pid=${pid}" | awk '{print $5}' | cut -d: -f1 | sort -u | while read ip; do echo "连接到: $ip"; whois $ip 2>/dev/null | grep -E "^(Country|OrgName):" || echo "无法查询"; done`, title: `进程 ${pid} - 可疑网络连接检测`, actionName: '检测可疑网络连接' },
      'crypto-mining': { command: `echo "挖矿特征检测:"; echo ""; echo "1. 命令行检测:"; cat /proc/${pid}/cmdline 2>/dev/null | tr '\\0' ' ' | grep -iE "(xmrig|minerd|cpuminer|stratum|pool|mining)" && echo "⚠️ 检测到挖矿关键词" || echo "✓ 未检测到挖矿关键词"; echo ""; echo "2. 网络连接检测:"; ss -tnp 2>/dev/null | grep "pid=${pid}" | grep -E ":(3333|4444|5555|8080|14444)" && echo "⚠️ 检测到常见矿池端口" || echo "✓ 未检测到矿池端口"; echo ""; echo "3. CPU使用率:"; ps -p ${pid} -o %cpu,cmd 2>/dev/null`, title: `进程 ${pid} - 挖矿特征检测`, actionName: '检测挖矿特征' },
      'kill': { command: `kill ${pid} 2>&1 && echo "✓ 进程已发送终止信号" || echo "✗ 终止失败"`, title: `进程 ${pid} - 终止进程`, actionName: '终止进程' },
      'kill-9': { command: `kill -9 ${pid} 2>&1 && echo "✓ 进程已强制终止" || echo "✗ 强制终止失败"`, title: `进程 ${pid} - 强制终止进程`, actionName: '强制终止进程' },
    }

    return actions[action] || null
  }
}
