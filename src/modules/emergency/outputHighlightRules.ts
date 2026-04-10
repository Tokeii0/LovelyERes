/**
 * 命令输出智能高亮规则配置
 * 独立配置文件，用于标记可疑项、危险项、信息项
 *
 * 每条规则包含:
 *  - pattern: 正则表达式（匹配单行）
 *  - level: 严重级别 (critical / warning / info / safe)
 *  - label: 标记文字（悬停提示）
 *  - description: 详细说明
 */

export type HighlightLevel = 'critical' | 'warning' | 'info' | 'safe';

export interface HighlightRule {
  id: string;
  pattern: RegExp;
  level: HighlightLevel;
  label: string;
  description: string;
}

// ════════════════════════════════════
// SUID / 权限相关
// ════════════════════════════════════

const suidRules: HighlightRule[] = [
  {
    id: 'suid-nmap', pattern: /nmap/i,
    level: 'critical', label: 'SUID提权',
    description: 'nmap 具有 SUID 位，可通过 --interactive 提权到 root',
  },
  {
    id: 'suid-find', pattern: /\/find\b/,
    level: 'critical', label: 'SUID提权',
    description: 'find 具有 SUID 位，可通过 -exec 提权',
  },
  {
    id: 'suid-vim', pattern: /\/vim?\b/,
    level: 'critical', label: 'SUID提权',
    description: 'vi/vim 具有 SUID 位，可通过 :!sh 提权',
  },
  {
    id: 'suid-python', pattern: /\/python[23]?(\.\d+)?\b/,
    level: 'critical', label: 'SUID提权',
    description: 'python 具有 SUID 位，可直接执行 os.system 提权',
  },
  {
    id: 'suid-perl', pattern: /\/perl\b/,
    level: 'critical', label: 'SUID提权',
    description: 'perl 具有 SUID 位，可执行系统命令提权',
  },
  {
    id: 'suid-ruby', pattern: /\/ruby\b/,
    level: 'critical', label: 'SUID提权',
    description: 'ruby 具有 SUID 位，可执行系统命令提权',
  },
  {
    id: 'suid-bash', pattern: /\/bash\b/,
    level: 'critical', label: 'SUID提权',
    description: 'bash 具有 SUID 位，可直接获取 root shell (bash -p)',
  },
  {
    id: 'suid-less', pattern: /\/less\b/,
    level: 'warning', label: 'SUID可疑',
    description: 'less 具有 SUID 位，可通过 !sh 提权',
  },
  {
    id: 'suid-more', pattern: /\/more\b/,
    level: 'warning', label: 'SUID可疑',
    description: 'more 具有 SUID 位，可通过 !sh 提权',
  },
  {
    id: 'suid-nano', pattern: /\/nano\b/,
    level: 'warning', label: 'SUID可疑',
    description: 'nano 具有 SUID 位，可读写任意文件',
  },
  {
    id: 'suid-wget', pattern: /\/wget\b/,
    level: 'critical', label: 'SUID提权',
    description: 'wget 具有 SUID 位，可覆盖系统文件 (wget -O /etc/passwd)',
  },
  {
    id: 'suid-curl', pattern: /\/curl\b/,
    level: 'warning', label: 'SUID可疑',
    description: 'curl 具有 SUID 位，可读取任意文件 (curl file:///etc/shadow)',
  },
  {
    id: 'suid-cp', pattern: /\/cp\b/,
    level: 'critical', label: 'SUID提权',
    description: 'cp 具有 SUID 位，可覆盖 /etc/passwd 或 /etc/shadow',
  },
  {
    id: 'suid-mv', pattern: /\/mv\b/,
    level: 'critical', label: 'SUID提权',
    description: 'mv 具有 SUID 位，可替换系统文件',
  },
  {
    id: 'suid-awk', pattern: /\/[gm]?awk\b/,
    level: 'critical', label: 'SUID提权',
    description: 'awk 具有 SUID 位，可通过 system() 提权',
  },
  {
    id: 'suid-env', pattern: /\/env\b/,
    level: 'critical', label: 'SUID提权',
    description: 'env 具有 SUID 位，可直接执行任意命令',
  },
  {
    id: 'suid-tar', pattern: /\/tar\b/,
    level: 'warning', label: 'SUID可疑',
    description: 'tar 具有 SUID 位，可通过 --checkpoint-action 执行命令',
  },
  {
    id: 'suid-docker', pattern: /\/docker\b/,
    level: 'critical', label: 'SUID提权',
    description: 'docker 具有 SUID 位，可直接挂载宿主机文件系统逃逸',
  },
  {
    id: 'suid-pkexec', pattern: /\/pkexec\b/,
    level: 'critical', label: 'CVE提权',
    description: 'pkexec 具有 SUID 位，CVE-2021-4034 可直接提权',
  },
];

// ════════════════════════════════════
// 异常进程
// ════════════════════════════════════

const processRules: HighlightRule[] = [
  {
    id: 'proc-nc', pattern: /\bnc\b.*-[elp]|ncat\b.*-[elp]|netcat\b/,
    level: 'critical', label: '反弹Shell',
    description: '检测到 nc/ncat/netcat 监听或反弹连接',
  },
  {
    id: 'proc-bash-i', pattern: /bash\s+-i\s+[>&]/,
    level: 'critical', label: '反弹Shell',
    description: '检测到 bash -i 反弹 shell 特征',
  },
  {
    id: 'proc-dev-tcp', pattern: /\/dev\/tcp\//,
    level: 'critical', label: '反弹Shell',
    description: '检测到 /dev/tcp 反弹 shell (Bash内置)',
  },
  {
    id: 'proc-python-pty', pattern: /python.*pty\.spawn/,
    level: 'critical', label: '反弹Shell',
    description: '检测到 python pty.spawn 交互式 shell',
  },
  {
    id: 'proc-crypto-miner', pattern: /xmrig|minerd|cpuminer|cryptonight|stratum\+tcp/i,
    level: 'critical', label: '挖矿木马',
    description: '检测到加密货币挖矿进程',
  },
  {
    id: 'proc-masscan', pattern: /masscan|zmap|nmap.*-sS/,
    level: 'warning', label: '扫描行为',
    description: '检测到网络扫描工具进程',
  },
  {
    id: 'proc-suspicious-tmp', pattern: /\/tmp\/\.\w+|\/dev\/shm\/\.\w+/,
    level: 'critical', label: '隐藏进程',
    description: '进程在 /tmp 或 /dev/shm 下执行隐藏文件',
  },
  {
    id: 'proc-deleted', pattern: /\(deleted\)/,
    level: 'warning', label: '已删除二进制',
    description: '进程对应的二进制文件已被删除，可能是恶意程序自删除',
  },
  {
    id: 'proc-high-cpu', pattern: /^\S+\s+\S+\s+(\d{2,3}\.\d)\s/,
    level: 'warning', label: 'CPU异常',
    description: 'CPU 占用过高，可能是挖矿或DoS',
  },
];

// ════════════════════════════════════
// 网络连接
// ════════════════════════════════════

const networkRules: HighlightRule[] = [
  {
    id: 'net-suspicious-port', pattern: /:(4444|5555|6666|7777|8888|9999|1234|31337)\b/,
    level: 'critical', label: '可疑端口',
    description: '常见的反弹Shell/木马/后门端口',
  },
  {
    id: 'net-foreign-ip', pattern: /ESTABLISHED\s+\d+\s+\d+\s+\S+:(\d+)\s+(\d+\.\d+\.\d+\.\d+)/,
    level: 'info', label: '外连',
    description: '已建立的外部连接',
  },
  {
    id: 'net-irc-port', pattern: /:(6667|6668|6669|6697)\b/,
    level: 'critical', label: 'IRC/C2',
    description: '检测到IRC端口连接，可能是C2通信',
  },
];

// ════════════════════════════════════
// 用户/认证
// ════════════════════════════════════

const userRules: HighlightRule[] = [
  {
    id: 'user-uid0', pattern: /^([^:]+):x:0:/,
    level: 'critical', label: 'UID=0',
    description: '非root用户UID为0，拥有root权限',
  },
  {
    id: 'user-no-shell-restrict', pattern: /:\/bin\/(bash|sh|zsh|fish)\s*$/,
    level: 'info', label: '可登录',
    description: '该用户具有登录Shell',
  },
  {
    id: 'user-empty-pass', pattern: /^([^:]+)::/,
    level: 'critical', label: '空密码',
    description: '该用户密码字段为空，可无密码登录',
  },
  {
    id: 'auth-failed', pattern: /Failed password|authentication failure|FAILED LOGIN/i,
    level: 'warning', label: '认证失败',
    description: '登录认证失败记录',
  },
  {
    id: 'auth-accepted-root', pattern: /Accepted.*\broot\b/,
    level: 'warning', label: 'root登录',
    description: 'root用户远程登录成功',
  },
];

// ════════════════════════════════════
// 文件/Cron/持久化
// ════════════════════════════════════

const persistenceRules: HighlightRule[] = [
  {
    id: 'cron-download', pattern: /curl|wget|python.*http/,
    level: 'critical', label: '下载执行',
    description: '定时任务中存在下载并执行的命令',
  },
  {
    id: 'cron-reverse', pattern: /\/dev\/tcp|nc\s+-|bash\s+-i|mkfifo/,
    level: 'critical', label: '反弹Shell',
    description: '定时任务中存在反弹Shell命令',
  },
  {
    id: 'file-world-writable', pattern: /d?-?[r-][w-][x-][r-][w-][x-][r-][w-][xXsStT-].*\s+0\s+/,
    level: 'info', label: '权限',
    description: '文件权限信息',
  },
  {
    id: 'file-suid-sgid', pattern: /^-[r-][w-][sS][r-][w-][xsS][r-][w-][xtT]/,
    level: 'warning', label: 'SUID/SGID',
    description: '文件设置了 SUID 或 SGID 位',
  },
  {
    id: 'webshell-keyword', pattern: /eval\(|base64_decode\(|assert\(|system\(|exec\(|passthru\(|shell_exec\(/,
    level: 'critical', label: 'WebShell特征',
    description: '检测到WebShell常见函数特征',
  },
  {
    id: 'ld-preload', pattern: /ld\.so\.preload|LD_PRELOAD/,
    level: 'critical', label: 'Rootkit',
    description: '检测到LD_PRELOAD劫持特征',
  },
  {
    id: 'ssh-authorized-keys', pattern: /authorized_keys/,
    level: 'warning', label: 'SSH密钥',
    description: '检测到 authorized_keys 文件，检查是否有未授权的密钥',
  },
  {
    id: 'file-immutable', pattern: /----i[aec-]+----|^\s*\S*i\S*\s+\//,
    level: 'warning', label: '不可变文件',
    description: '文件设置了 immutable 标志(chattr +i)，无法修改/删除。右键选择路径可移除',
  },
  {
    id: 'bin-script-tamper', pattern: /\/(?:usr\/)?s?bin\/\S+:.*(?:script|text|ASCII)/,
    level: 'critical', label: '命令被篡改',
    description: '系统命令被替换为脚本文件，可能是命令劫持或后门',
  },
];

// ════════════════════════════════════
// 安全标记 (绿色)
// ════════════════════════════════════

const safeRules: HighlightRule[] = [
  {
    id: 'safe-nologin', pattern: /\/sbin\/nologin|\/bin\/false/,
    level: 'safe', label: '禁止登录',
    description: '该用户已禁止Shell登录',
  },
  {
    id: 'safe-disabled', pattern: /disabled|inactive|not found|no such/i,
    level: 'safe', label: '已禁用',
    description: '服务或功能已禁用',
  },
];

// ════════════════════════════════════
// 导出全部规则
// ════════════════════════════════════

export const ALL_HIGHLIGHT_RULES: HighlightRule[] = [
  ...suidRules,
  ...processRules,
  ...networkRules,
  ...userRules,
  ...persistenceRules,
  ...safeRules,
];

/** 根据行内容返回匹配的最高优先级规则 */
export function matchLine(line: string): HighlightRule | null {
  const priority: Record<HighlightLevel, number> = { critical: 4, warning: 3, info: 2, safe: 1 };
  let best: HighlightRule | null = null;
  for (const rule of ALL_HIGHLIGHT_RULES) {
    if (rule.pattern.test(line)) {
      if (!best || priority[rule.level] > priority[best.level]) {
        best = rule;
      }
    }
  }
  return best;
}

/** CSS 类名映射 */
export const LEVEL_CSS: Record<HighlightLevel, string> = {
  critical: 'hl-critical',
  warning: 'hl-warning',
  info: 'hl-info',
  safe: 'hl-safe',
};
