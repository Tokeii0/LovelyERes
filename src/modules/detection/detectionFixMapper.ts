/**
 * 检测 → 修复映射表
 * 将每个检测 finding 关联到具体的修复动作（基线配置项 / shell 命令 / 代码片段）
 */

export type FixActionType = 'baseline' | 'command' | 'snippet';

export interface FixActionDef {
  type: FixActionType;
  title: string;
  description: string;
  // baseline 类型: 引用 baselineConfigs 中的配置项 ID
  baselineItemId?: string;
  recommendedValue?: string;
  // command 类型: 直接 shell 命令
  command?: string;
  // snippet 类型: 引用 secfixData 中的片段 ID
  snippetId?: string;
  priority: number;           // 越小越优先
  requiresRestart?: string;   // 需要重启的服务名
}

export interface FixMapping {
  detectionItemId: string;
  findingPattern?: string | RegExp;  // 匹配 finding.title, 为空则匹配该检测项所有 findings
  actions: FixActionDef[];
}

// ════════════════════════════════════════════════════
// 映射表: 检测项 → 修复动作
// ════════════════════════════════════════════════════

const FIX_MAPPINGS: FixMapping[] = [
  // ──── SSH 安全 ────
  {
    detectionItemId: 'ssh-audit',
    findingPattern: /PermitRootLogin|root.*登录|root.*login/i,
    actions: [{
      type: 'baseline', title: '禁止 root 远程登录',
      description: '设置 PermitRootLogin no',
      baselineItemId: 'ssh-permit-root-login', recommendedValue: 'no',
      priority: 1, requiresRestart: 'sshd',
    }],
  },
  {
    detectionItemId: 'ssh-audit',
    findingPattern: /PasswordAuthentication|密码认证/i,
    actions: [{
      type: 'baseline', title: '禁用密码认证',
      description: '设置 PasswordAuthentication no，仅允许密钥登录',
      baselineItemId: 'ssh-password-auth', recommendedValue: 'no',
      priority: 2, requiresRestart: 'sshd',
    }],
  },
  {
    detectionItemId: 'ssh-audit',
    findingPattern: /MaxAuthTries|最大.*尝试/i,
    actions: [{
      type: 'baseline', title: '限制认证尝试次数',
      description: '设置 MaxAuthTries 3',
      baselineItemId: 'ssh-max-auth-tries', recommendedValue: '3',
      priority: 3, requiresRestart: 'sshd',
    }],
  },
  {
    detectionItemId: 'ssh-audit',
    findingPattern: /端口|port.*22/i,
    actions: [{
      type: 'baseline', title: '修改 SSH 默认端口',
      description: '将 SSH 端口从 22 改为非标准端口',
      baselineItemId: 'ssh-port', recommendedValue: '22222',
      priority: 10, requiresRestart: 'sshd',
    }],
  },
  // ──── 防火墙 ────
  {
    detectionItemId: 'firewall-check',
    actions: [{
      type: 'command', title: '启用防火墙',
      description: '启动 firewalld 或 ufw',
      command: 'systemctl start firewalld 2>/dev/null && systemctl enable firewalld 2>/dev/null || (ufw --force enable 2>/dev/null)',
      priority: 1,
    }, {
      type: 'command', title: '设置默认拒绝入站',
      description: 'iptables 默认拒绝 + 放行 SSH/HTTP',
      command: 'iptables -P INPUT DROP && iptables -A INPUT -i lo -j ACCEPT && iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT && iptables -A INPUT -p tcp -m multiport --dports 22,80,443 -j ACCEPT',
      priority: 2,
    }],
  },
  // ──── 密码策略 ────
  {
    detectionItemId: 'password-policy',
    findingPattern: /PASS_MAX_DAYS|密码.*有效期|过期/i,
    actions: [{
      type: 'baseline', title: '设置密码最大有效期',
      description: 'PASS_MAX_DAYS 90',
      baselineItemId: 'pass-max-days', recommendedValue: '90',
      priority: 1,
    }],
  },
  {
    detectionItemId: 'password-policy',
    findingPattern: /PASS_MIN_LEN|密码.*长度/i,
    actions: [{
      type: 'baseline', title: '设置密码最小长度',
      description: 'PASS_MIN_LEN 8',
      baselineItemId: 'pass-min-len', recommendedValue: '8',
      priority: 2,
    }],
  },
  // ──── PAM 配置 ────
  {
    detectionItemId: 'pam-config',
    actions: [{
      type: 'baseline', title: '配置密码复杂度',
      description: 'pam_pwquality 设置 minlen=8 dcredit=-1 ucredit=-1',
      baselineItemId: 'pam-pwquality', recommendedValue: 'minlen=8 dcredit=-1 ucredit=-1 lcredit=-1 ocredit=-1',
      priority: 1,
    }],
  },
  // ──── 账号锁定 ────
  {
    detectionItemId: 'account-lockout',
    actions: [{
      type: 'baseline', title: '配置登录失败锁定',
      description: 'pam_faillock: deny=5 unlock_time=600',
      baselineItemId: 'pam-faillock', recommendedValue: 'deny=5 unlock_time=600',
      priority: 1,
    }],
  },
  // ──── Sudo 审计 ────
  {
    detectionItemId: 'sudo-audit',
    actions: [{
      type: 'command', title: '清理 NOPASSWD 条目',
      description: '移除 sudoers 中不安全的 NOPASSWD 配置',
      command: "grep -n 'NOPASSWD' /etc/sudoers /etc/sudoers.d/* 2>/dev/null",
      priority: 1,
    }],
  },
  // ──── SELinux ────
  {
    detectionItemId: 'selinux-status',
    actions: [{
      type: 'command', title: '启用 SELinux Enforcing',
      description: '设置 SELinux 为强制模式',
      command: 'setenforce 1 2>/dev/null && sed -i "s/SELINUX=.*/SELINUX=enforcing/" /etc/selinux/config 2>/dev/null && echo "SELinux set to enforcing"',
      priority: 1,
    }],
  },
  // ──── 内核参数 ────
  {
    detectionItemId: 'kernel-params',
    findingPattern: /ip_forward|转发/i,
    actions: [{
      type: 'baseline', title: '禁止 IP 转发',
      description: 'net.ipv4.ip_forward = 0',
      baselineItemId: 'kernel-ip-forward', recommendedValue: '0',
      priority: 1,
    }],
  },
  {
    detectionItemId: 'kernel-params',
    findingPattern: /syn.*cookie|SYN/i,
    actions: [{
      type: 'baseline', title: '启用 SYN Cookie',
      description: 'net.ipv4.tcp_syncookies = 1',
      baselineItemId: 'kernel-syn-cookies', recommendedValue: '1',
      priority: 2,
    }],
  },
  // ──── 端口扫描 ────
  {
    detectionItemId: 'port-scan',
    findingPattern: /23\b|telnet/i,
    actions: [{
      type: 'command', title: '关闭 Telnet 服务',
      description: '停止并禁用 telnet',
      command: 'systemctl stop telnet.socket 2>/dev/null; systemctl disable telnet.socket 2>/dev/null; systemctl stop xinetd 2>/dev/null; echo "telnet disabled"',
      priority: 1,
    }],
  },
  {
    detectionItemId: 'port-scan',
    findingPattern: /21\b|ftp/i,
    actions: [{
      type: 'command', title: '关闭 FTP 服务',
      description: '停止并禁用 vsftpd / proftpd',
      command: 'systemctl stop vsftpd 2>/dev/null; systemctl disable vsftpd 2>/dev/null; systemctl stop proftpd 2>/dev/null; echo "ftp disabled"',
      priority: 2,
    }],
  },
  // ──── 不必要服务 ────
  {
    detectionItemId: 'unnecessary-services',
    actions: [{
      type: 'command', title: '停止不必要服务',
      description: '停止常见不必要服务: avahi, cups, bluetooth',
      command: 'for svc in avahi-daemon cups bluetooth rpcbind; do systemctl stop $svc 2>/dev/null; systemctl disable $svc 2>/dev/null; done; echo "services disabled"',
      priority: 1,
    }],
  },
  // ──── 审计配置 ────
  {
    detectionItemId: 'audit-config',
    actions: [{
      type: 'command', title: '启用 auditd',
      description: '启动审计守护进程',
      command: 'systemctl start auditd 2>/dev/null && systemctl enable auditd 2>/dev/null && auditctl -e 1 2>/dev/null && echo "auditd enabled"',
      priority: 1,
    }],
  },
  // ──── NTP ────
  {
    detectionItemId: 'ntp-config',
    actions: [{
      type: 'command', title: '启用时间同步',
      description: '启动 chronyd 或 ntpd',
      command: 'systemctl start chronyd 2>/dev/null && systemctl enable chronyd 2>/dev/null || (systemctl start ntpd 2>/dev/null && systemctl enable ntpd 2>/dev/null); echo "NTP enabled"',
      priority: 1,
    }],
  },
  // ──── 文件权限 ────
  {
    detectionItemId: 'file-permission',
    actions: [{
      type: 'command', title: '修复关键文件权限',
      description: '设置 /etc/passwd 644, /etc/shadow 600, /etc/gshadow 600',
      command: 'chmod 644 /etc/passwd && chmod 600 /etc/shadow && chmod 600 /etc/gshadow && chmod 644 /etc/group && echo "permissions fixed"',
      priority: 1,
    }],
  },
  // ──── Webshell ────
  {
    detectionItemId: 'webshell-scan',
    actions: [{
      type: 'snippet', title: 'PHP 禁用危险函数',
      description: 'php.ini disable_functions 封堵命令执行',
      snippetId: 'php-disable',
      priority: 1,
    }, {
      type: 'command', title: '查找并隔离 WebShell',
      description: '将可疑 PHP 文件移动到隔离目录',
      command: 'mkdir -p /tmp/quarantine && find /var/www -name "*.php" -mmin -60 -exec grep -l "eval(\\|base64_decode(\\|system(" {} \\; | head -10 | while read f; do mv "$f" /tmp/quarantine/ && echo "quarantined: $f"; done',
      priority: 2,
    }],
  },
  // ──── Rootkit ────
  {
    detectionItemId: 'rootkit-scan',
    findingPattern: /LD_PRELOAD|ld\.so\.preload/i,
    actions: [{
      type: 'command', title: '清除 LD_PRELOAD 劫持',
      description: '清空 /etc/ld.so.preload',
      command: 'cat /etc/ld.so.preload 2>/dev/null && echo "--- clearing ---" && echo "" > /etc/ld.so.preload && echo "ld.so.preload cleared"',
      priority: 1,
    }],
  },
  // ──── 持久化 ────
  {
    detectionItemId: 'persistence-scan',
    actions: [{
      type: 'command', title: '检查并清理可疑定时任务',
      description: '列出所有用户的 crontab',
      command: 'for u in $(cut -d: -f1 /etc/passwd); do echo "==$u=="; crontab -l -u $u 2>/dev/null; done',
      priority: 1,
    }],
  },
  // ──── 网络后门 ────
  {
    detectionItemId: 'network-backdoor',
    actions: [{
      type: 'command', title: '查找可疑网络连接进程',
      description: '列出所有 ESTABLISHED 外连及对应进程',
      command: 'ss -antlp | grep ESTAB | awk \'{print $5, $6}\'',
      priority: 1,
    }],
  },
  // ──── 命令篡改 ────
  {
    detectionItemId: 'bin-tamper',
    actions: [{
      type: 'command', title: '验证系统命令完整性',
      description: '用包管理器验证已安装文件',
      command: 'rpm -Va 2>/dev/null | grep "^..5" | head -20 || dpkg -V 2>/dev/null | head -20 || echo "package verify not available"',
      priority: 1,
    }],
  },
  // ──── 不可变文件 ────
  {
    detectionItemId: 'immutable-files',
    actions: [{
      type: 'command', title: '移除可疑不可变标志',
      description: '对 /tmp 和 /var/www 下的不可变文件执行 chattr -i',
      command: 'lsattr -R /tmp /var/www 2>/dev/null | grep "^....i" | awk \'{print $2}\' | head -10 | while read f; do chattr -i "$f" 2>/dev/null && echo "unlocked: $f"; done',
      priority: 1,
    }],
  },
  // ──── History 审计 ────
  {
    detectionItemId: 'history-audit',
    actions: [{
      type: 'command', title: '启用命令历史记录',
      description: '确保 HISTSIZE 和 HISTFILESIZE 足够大',
      command: 'echo "export HISTSIZE=10000" >> /etc/profile && echo "export HISTFILESIZE=10000" >> /etc/profile && echo "export HISTTIMEFORMAT=\\"%F %T \\"" >> /etc/profile && echo "history settings applied"',
      priority: 1,
    }],
  },

  // ──── K8s 安全修复 ────
  {
    detectionItemId: 'k8s-privileged-pod',
    findingPattern: /特权容器/i,
    actions: [{
      type: 'command', title: '缩容包含特权容器的 Deployment',
      description: '将相关 Deployment 副本数设为 0，阻止特权容器运行',
      command: 'echo "请在 K8s 页面中右键对应的 Deployment → 缩容至 0"',
      priority: 1,
    }],
  },
  {
    detectionItemId: 'k8s-reverse-shell',
    findingPattern: /反弹Shell/i,
    actions: [{
      type: 'command', title: '强制删除反弹Shell Pod',
      description: '立即强制删除包含反弹Shell命令的 Pod',
      command: 'echo "请在 K8s 页面中右键目标 Pod → 强制删除，或使用: kubectl delete pod <name> -n <namespace> --force --grace-period=0"',
      priority: 1,
    }],
  },
  {
    detectionItemId: 'k8s-suspicious-cronjob',
    findingPattern: /恶意CronJob/i,
    actions: [{
      type: 'command', title: '暂停并删除恶意 CronJob',
      description: '暂停 CronJob 防止新 Job 创建，然后删除',
      command: 'echo "请在 K8s 页面中右键目标 CronJob → 暂停/删除"',
      priority: 1,
    }],
  },
  {
    detectionItemId: 'k8s-sa-audit',
    findingPattern: /高权限SA|通配符权限SA/i,
    actions: [{
      type: 'command', title: '删除可疑 ServiceAccount 及绑定',
      description: '删除攻击者创建的高权限 ServiceAccount 和关联的 RoleBinding/ClusterRoleBinding',
      command: 'echo "请在 K8s 页面中右键目标 ServiceAccount → 删除"',
      priority: 1,
    }],
  },
  {
    detectionItemId: 'k8s-network-policy',
    findingPattern: /无NetworkPolicy/i,
    actions: [{
      type: 'command', title: '创建默认拒绝 NetworkPolicy',
      description: '为命名空间创建 deny-all 入站/出站策略',
      command: 'echo "请在 K8s 页面中使用应急功能 → 隔离命名空间"',
      priority: 1,
    }],
  },
  {
    detectionItemId: 'k8s-container-escape',
    findingPattern: /hostPID|hostIPC|危险Capabilities/i,
    actions: [{
      type: 'command', title: '删除容器逃逸风险 Pod',
      description: '具有 hostPID/hostIPC/危险Capabilities 的 Pod 存在宿主机逃逸风险',
      command: 'echo "请在 K8s 页面中右键目标 Pod → 强制删除"',
      priority: 1,
    }],
  },
];

// ════════════════════════════════════════════════════
// 快速加固项 (Tab 5 用)
// ════════════════════════════════════════════════════

export interface HardeningItem {
  id: string;
  group: string;
  title: string;
  checkCommand: string;      // 检查当前状态
  checkPassed: RegExp;       // 输出匹配此正则 = 安全
  fixCommand: string;        // 一键修复命令
  priority: number;
}

export const HARDENING_ITEMS: HardeningItem[] = [
  // SSH
  { id: 'h-ssh-root', group: 'SSH加固', title: '禁止root登录', checkCommand: 'grep -E "^\\s*PermitRootLogin" /etc/ssh/sshd_config 2>/dev/null', checkPassed: /no/i, fixCommand: 'sed -i "s/^#*\\s*PermitRootLogin.*/PermitRootLogin no/" /etc/ssh/sshd_config && systemctl restart sshd', priority: 1 },
  { id: 'h-ssh-maxauth', group: 'SSH加固', title: '限制认证尝试(3次)', checkCommand: 'grep -E "^\\s*MaxAuthTries" /etc/ssh/sshd_config 2>/dev/null', checkPassed: /[1-3]$/, fixCommand: 'sed -i "s/^#*\\s*MaxAuthTries.*/MaxAuthTries 3/" /etc/ssh/sshd_config && systemctl restart sshd', priority: 2 },
  { id: 'h-ssh-empty', group: 'SSH加固', title: '禁止空密码', checkCommand: 'grep -E "^\\s*PermitEmptyPasswords" /etc/ssh/sshd_config 2>/dev/null', checkPassed: /no/i, fixCommand: 'sed -i "s/^#*\\s*PermitEmptyPasswords.*/PermitEmptyPasswords no/" /etc/ssh/sshd_config && systemctl restart sshd', priority: 3 },
  // 防火墙
  { id: 'h-fw-active', group: '防火墙', title: '防火墙已启用', checkCommand: 'systemctl is-active firewalld 2>/dev/null || ufw status 2>/dev/null | head -1', checkPassed: /active|Status: active/i, fixCommand: 'systemctl start firewalld 2>/dev/null && systemctl enable firewalld 2>/dev/null || ufw --force enable 2>/dev/null', priority: 1 },
  { id: 'h-fw-default', group: '防火墙', title: '默认拒绝入站', checkCommand: 'iptables -L INPUT 2>/dev/null | head -1', checkPassed: /DROP|REJECT/i, fixCommand: 'iptables -P INPUT DROP && iptables -A INPUT -i lo -j ACCEPT && iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT && iptables -A INPUT -p tcp -m multiport --dports 22,80,443 -j ACCEPT', priority: 2 },
  // PHP
  { id: 'h-php-disable', group: 'PHP加固', title: 'PHP禁用危险函数', checkCommand: 'php -i 2>/dev/null | grep disable_functions | head -1', checkPassed: /system|exec|passthru/, fixCommand: 'for f in /etc/php.ini /etc/php/*/fpm/php.ini /etc/php/*/apache2/php.ini; do [ -f "$f" ] && sed -i "s/^\\s*;*\\s*disable_functions.*/disable_functions = system,exec,passthru,shell_exec,popen,proc_open,pcntl_exec,eval,assert/" "$f" 2>/dev/null; done && systemctl restart php-fpm 2>/dev/null; true', priority: 1 },
  { id: 'h-php-expose', group: 'PHP加固', title: '隐藏PHP版本', checkCommand: 'php -i 2>/dev/null | grep expose_php | head -1', checkPassed: /Off/i, fixCommand: 'for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && sed -i "s/^\\s*;*\\s*expose_php.*/expose_php = Off/" "$f" 2>/dev/null; done && systemctl restart php-fpm 2>/dev/null; true', priority: 2 },
  { id: 'h-php-errors', group: 'PHP加固', title: '关闭错误显示', checkCommand: 'php -i 2>/dev/null | grep "display_errors =>" | head -1', checkPassed: /Off/i, fixCommand: 'for f in /etc/php.ini /etc/php/*/fpm/php.ini; do [ -f "$f" ] && sed -i "s/^\\s*;*\\s*display_errors.*/display_errors = Off/" "$f" 2>/dev/null; done && systemctl restart php-fpm 2>/dev/null; true', priority: 3 },
  // 用户权限
  { id: 'h-passwd-perms', group: '用户权限', title: '/etc/passwd 权限 644', checkCommand: 'stat -c "%a" /etc/passwd 2>/dev/null', checkPassed: /^644$/, fixCommand: 'chmod 644 /etc/passwd && echo "fixed"', priority: 1 },
  { id: 'h-shadow-perms', group: '用户权限', title: '/etc/shadow 权限 600', checkCommand: 'stat -c "%a" /etc/shadow 2>/dev/null', checkPassed: /^600$|^000$/, fixCommand: 'chmod 600 /etc/shadow && echo "fixed"', priority: 2 },
  { id: 'h-uid0', group: '用户权限', title: '无异常UID=0用户', checkCommand: 'awk -F: \'$3==0&&$1!="root"{print $1}\' /etc/passwd', checkPassed: /^$/, fixCommand: 'echo "需要手动检查 UID=0 的非 root 用户"', priority: 3 },
  // 文件权限
  { id: 'h-chattr-passwd', group: '文件权限', title: '锁定 passwd/shadow', checkCommand: 'lsattr /etc/passwd 2>/dev/null | head -1', checkPassed: /i/, fixCommand: 'chattr +i /etc/passwd /etc/shadow /etc/group && echo "locked"', priority: 1 },
  { id: 'h-tmp-noexec', group: '文件权限', title: '/tmp noexec 挂载', checkCommand: 'mount | grep "/tmp " | head -1', checkPassed: /noexec/, fixCommand: 'mount -o remount,noexec /tmp 2>/dev/null && echo "tmp noexec" || echo "remount failed"', priority: 2 },
  // 服务管理
  { id: 'h-svc-telnet', group: '服务管理', title: 'Telnet 已禁用', checkCommand: 'systemctl is-active telnet.socket 2>/dev/null || echo "inactive"', checkPassed: /inactive|unknown/, fixCommand: 'systemctl stop telnet.socket 2>/dev/null; systemctl disable telnet.socket 2>/dev/null; echo "telnet disabled"', priority: 1 },
  { id: 'h-svc-auditd', group: '服务管理', title: 'auditd 已启用', checkCommand: 'systemctl is-active auditd 2>/dev/null', checkPassed: /^active/, fixCommand: 'systemctl start auditd 2>/dev/null && systemctl enable auditd 2>/dev/null && echo "auditd started"', priority: 2 },
];

// ════════════════════════════════════════════════════
// 查询函数
// ════════════════════════════════════════════════════

export function getFixActionsForFinding(detectionItemId: string, findingTitle: string): FixActionDef[] {
  const results: FixActionDef[] = [];
  for (const mapping of FIX_MAPPINGS) {
    if (mapping.detectionItemId !== detectionItemId) continue;
    if (mapping.findingPattern) {
      const pat = mapping.findingPattern;
      const matches = typeof pat === 'string'
        ? findingTitle.includes(pat)
        : pat.test(findingTitle);
      if (!matches) continue;
    }
    results.push(...mapping.actions);
  }
  return results.sort((a, b) => a.priority - b.priority);
}

export function getFixActionsForDetectionItem(detectionItemId: string): FixActionDef[] {
  const results: FixActionDef[] = [];
  for (const mapping of FIX_MAPPINGS) {
    if (mapping.detectionItemId === detectionItemId) {
      results.push(...mapping.actions);
    }
  }
  return results.sort((a, b) => a.priority - b.priority);
}

export function getAllMappings(): FixMapping[] {
  return FIX_MAPPINGS;
}
