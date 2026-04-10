/**
 * AI 命令解释器
 * 对应急响应命令提供 AI 驱动的自然语言解释
 */

import { aiService } from './aiService';

// 本地缓存（命令 → 解释）
const explanationCache = new Map<string, string>();

/**
 * 获取命令的 AI 解释（带缓存）
 */
export async function explainCommand(command: string): Promise<string> {
  const trimmed = command.trim();
  if (!trimmed) return '';

  // 缓存命中
  if (explanationCache.has(trimmed)) {
    return explanationCache.get(trimmed)!;
  }

  // 调用 AI 服务
  const prompt = `请用简洁的中文解释以下 Linux 命令的作用，说明每个参数的含义和可能的风险。不要使用 Markdown 格式，直接给出纯文本说明。命令：\n\n${trimmed}`;

  try {
    const config = aiService.getConfig();
    if (!config || !config.apiKey) {
      return getFallbackExplanation(trimmed);
    }

    let result = '';
    await aiService.generateConciseSolutionStream(
      '命令解释',
      prompt,
      'info',
      undefined,
      undefined,
      (fullText) => { result = fullText; }
    );
    const explanation = result || '无法获取解释';
    explanationCache.set(trimmed, explanation);
    return explanation;
  } catch {
    return getFallbackExplanation(trimmed);
  }
}

/**
 * 本地备用解释（不需要 AI 的常见命令）
 */
function getFallbackExplanation(command: string): string {
  const firstWord = command.split(/\s+/)[0].replace(/^sudo\s+/, '');
  const knownCommands: Record<string, string> = {
    'netstat': '显示网络连接、路由表和网络接口信息',
    'ss': '显示套接字统计信息（netstat 的现代替代）',
    'ps': '列出当前运行的进程',
    'top': '实时显示系统资源使用和进程信息',
    'find': '在目录树中搜索文件',
    'grep': '在文本中搜索匹配模式的行',
    'cat': '查看或合并文件内容',
    'tail': '显示文件末尾内容',
    'head': '显示文件开头内容',
    'last': '显示最近的用户登录记录',
    'lastlog': '显示所有用户最后一次登录信息',
    'who': '显示当前登录的用户',
    'w': '显示当前登录的用户及其正在执行的命令',
    'crontab': '管理用户的定时任务',
    'systemctl': '管理 systemd 服务',
    'iptables': '配置 Linux 内核防火墙规则',
    'ufw': '简化的防火墙管理工具',
    'chmod': '更改文件权限',
    'chown': '更改文件所有者',
    'lsof': '列出打开的文件和使用它们的进程',
    'strace': '跟踪系统调用和信号',
    'tcpdump': '捕获和分析网络数据包',
    'chkrootkit': '检查系统是否被安装了 rootkit',
    'rkhunter': '扫描 rootkit、后门和本地漏洞',
    'auditctl': '管理 Linux 审计系统规则',
    'ausearch': '在审计日志中搜索事件',
    'journalctl': '查询和显示 systemd 日志',
    'dmesg': '显示内核环形缓冲区的消息',
    'free': '显示系统内存使用情况',
    'df': '显示文件系统磁盘空间使用情况',
    'du': '估计文件和目录的磁盘使用量',
    'docker': '管理 Docker 容器和镜像',
    'kubectl': '管理 Kubernetes 集群',
    'nmap': '网络扫描和安全审计工具',
    'traceroute': '跟踪数据包到目标主机的路由',
    'dig': 'DNS 查询工具',
    'curl': '发送 HTTP 请求',
    'wget': '从网络下载文件',
  };

  return knownCommands[firstWord] || `Linux 命令: ${firstWord}（AI 服务未配置，无法获取详细解释）`;
}

/**
 * 渲染命令解释 tooltip（挂载到元素上）
 */
export function attachCommandTooltip(element: HTMLElement, command: string): void {
  let tooltip: HTMLElement | null = null;
  let timeoutId: number | null = null;

  element.addEventListener('mouseenter', () => {
    timeoutId = window.setTimeout(async () => {
      const explanation = await explainCommand(command);
      if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.className = 'command-tooltip';
        tooltip.style.cssText = `
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: var(--bg-primary, #1e293b);
          color: var(--text-primary, #f8fafc);
          border: 1px solid var(--border-color, #334155);
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 12px;
          line-height: 1.6;
          max-width: 360px;
          min-width: 200px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.2);
          z-index: 9999;
          pointer-events: none;
          white-space: pre-wrap;
          word-break: break-word;
          animation: fadeIn 0.15s ease;
        `;
        element.style.position = 'relative';
        element.appendChild(tooltip);
      }
      tooltip.textContent = explanation;
    }, 500);
  });

  element.addEventListener('mouseleave', () => {
    if (timeoutId) clearTimeout(timeoutId);
    if (tooltip) {
      tooltip.remove();
      tooltip = null;
    }
  });
}
