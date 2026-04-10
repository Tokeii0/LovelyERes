export type EmergencyCommand = {
  id: string;
  name: string;
  cmd?: string;  // 默认命令（向后兼容）
  desc?: string;
  // 多系统命令支持
  commands?: {
    default: string;      // 通用命令
    ubuntu?: string;      // Ubuntu 特定
    debian?: string;      // Debian 特定
    centos?: string;      // CentOS 特定
    rhel?: string;        // RHEL 特定
    fedora?: string;      // Fedora 特定
    kylin?: string;       // 麒麟特定
    uos?: string;         // 统信特定
    deepin?: string;      // 深度特定
    openeuler?: string;   // 开放欧拉特定
    anolis?: string;      // 龙蜥特定
    arch?: string;        // Arch Linux 特定
    opensuse?: string;    // openSUSE 特定
    alpine?: string;      // Alpine 特定
  };
};

export type EmergencyCategory = {
  id: string;
  title: string;
  hint?: string;
  items: EmergencyCommand[];
};

// 常用应急命令清单（按类别组织）
export const emergencyCategories: EmergencyCategory[] = [
  {
    id: 'permissions',
    title: '权限安全',
    hint: '快速查看 SUID/SGID、可写、能力集等',
    items: [
      { id: 'perm-suid', name: 'SUID 可执行', cmd: `find / -xdev -perm -4000 -type f 2>/dev/null | sort | head -n 300`, desc: '含SUID位的可执行文件' },
      { id: 'perm-sgid', name: 'SGID 可执行', cmd: `find / -xdev -perm -2000 -type f 2>/dev/null | sort | head -n 300`, desc: '含SGID位的可执行文件' },
      { id: 'perm-ww-dirs', name: 'World-writable 目录', cmd: `find / -xdev -type d -perm -0002 -not -path '/proc/*' -not -path '/sys/*' 2>/dev/null | sort | head -n 200`, desc: '可能被任意用户写入' },
      { id: 'perm-ww-files', name: 'World-writable 文件', cmd: `find / -xdev -type f -perm -0002 -not -path '/proc/*' -not -path '/sys/*' 2>/dev/null | sort | head -n 200`, desc: '可能被任意用户写入' },
      { id: 'perm-cap', name: 'Capabilities 概览', cmd: `command -v getcap >/dev/null 2>&1 && getcap -r / 2>/dev/null | head -n 300 || echo 'getcap 未安装'`, desc: 'Linux capabilities 检查' },
      { id: 'perm-unowned', name: 'No Owner/Nogroup 文件', cmd: `find / -xdev \( -nouser -o -nogroup \) 2>/dev/null | head -n 200`, desc: '潜在遗留或异常文件' },
      { id: 'perm-sudoers', name: 'sudoers 配置', cmd: `echo '[group sudo]'; getent group sudo; echo '\n[sudoers]'; grep -vE '^(#|$)' /etc/sudoers 2>/dev/null; ls -l /etc/sudoers.d 2>/dev/null`, desc: 'sudoers 基本核查' },
    ],
  },
  {
    id: 'baseline',
    title: '安全基线',
    hint: '账户策略、SSH、服务与计划任务等',
    items: [
      { id: 'base-users', name: 'Users & Shells', cmd: `getent passwd | cut -d: -f1,3,7 | sort`, desc: '用户名/UID/登录Shell' },
      { id: 'base-passwd-policy', name: '密码策略 login.defs', cmd: `grep -E 'PASS_MAX_DAYS|PASS_MIN_DAYS|PASS_MIN_LEN|PASS_WARN_AGE' /etc/login.defs 2>/dev/null`, desc: '账号口令策略' },
      { id: 'base-ssh', name: 'sshd_config 核查', cmd: `grep -iE '^(PermitRootLogin|PasswordAuthentication|PubkeyAuthentication|ChallengeResponseAuthentication)\b' /etc/ssh/sshd_config 2>/dev/null`, desc: 'sshd 配置快照' },
      {
        id: 'base-services-enabled',
        name: '已启用服务列表',
        desc: '查看系统中已启用的服务',
        commands: {
          default: 'systemctl list-unit-files --type=service --no-pager 2>/dev/null | sed -n "1,300p"',
          ubuntu: 'systemctl list-unit-files --type=service --no-pager | sed -n "1,300p"',
          debian: 'systemctl list-unit-files --type=service --no-pager | sed -n "1,300p"',
          centos: 'systemctl list-unit-files --type=service --no-pager | sed -n "1,300p"',
          rhel: 'systemctl list-unit-files --type=service --no-pager | sed -n "1,300p"',
          fedora: 'systemctl list-unit-files --type=service --no-pager | sed -n "1,300p"',
          kylin: 'systemctl list-unit-files --type=service --no-pager | sed -n "1,300p"',
          uos: 'systemctl list-unit-files --type=service --no-pager | sed -n "1,300p"',
          deepin: 'systemctl list-unit-files --type=service --no-pager | sed -n "1,300p"',
          openeuler: 'systemctl list-unit-files --type=service --no-pager | sed -n "1,300p"',
          anolis: 'systemctl list-unit-files --type=service --no-pager | sed -n "1,300p"',
          arch: 'systemctl list-unit-files --type=service --no-pager | sed -n "1,300p"',
          opensuse: 'systemctl list-unit-files --type=service --no-pager | sed -n "1,300p"',
          alpine: 'rc-status -a 2>/dev/null || service --status-all 2>/dev/null | head -n 300'
        }
      },
      {
        id: 'base-services-running',
        name: '运行中的服务',
        desc: '查看当前正在运行的服务',
        commands: {
          default: 'systemctl list-units --type=service --state=running --no-pager 2>/dev/null | sed -n "1,300p"',
          ubuntu: 'systemctl list-units --type=service --state=running --no-pager | sed -n "1,300p"',
          debian: 'systemctl list-units --type=service --state=running --no-pager | sed -n "1,300p"',
          centos: 'systemctl list-units --type=service --state=running --no-pager | sed -n "1,300p"',
          rhel: 'systemctl list-units --type=service --state=running --no-pager | sed -n "1,300p"',
          fedora: 'systemctl list-units --type=service --state=running --no-pager | sed -n "1,300p"',
          kylin: 'systemctl list-units --type=service --state=running --no-pager | sed -n "1,300p"',
          uos: 'systemctl list-units --type=service --state=running --no-pager | sed -n "1,300p"',
          deepin: 'systemctl list-units --type=service --state=running --no-pager | sed -n "1,300p"',
          openeuler: 'systemctl list-units --type=service --state=running --no-pager | sed -n "1,300p"',
          anolis: 'systemctl list-units --type=service --state=running --no-pager | sed -n "1,300p"',
          arch: 'systemctl list-units --type=service --state=running --no-pager | sed -n "1,300p"',
          opensuse: 'systemctl list-units --type=service --state=running --no-pager | sed -n "1,300p"',
          alpine: 'rc-status 2>/dev/null | grep started || ps aux | head -n 100'
        }
      },
      { id: 'base-cron', name: 'cron 任务总览', cmd: 'for u in $(cut -f1 -d: /etc/passwd); do echo "===== $u ====="; crontab -u "$u" -l 2>/dev/null; done; echo "===== system ====="; ls -l /etc/cron.* /etc/cron.d 2>/dev/null', desc: '用户/系统定时任务' },
      { id: 'base-packages', name: '核心组件版本', cmd: `(uname -a; echo; bash --version 2>/dev/null | head -n1; echo; openssl version 2>/dev/null; echo; ssh -V 2>&1 | head -n1) 2>/dev/null`, desc: '内核/常见组件' },
      {
        id: 'base-selinux-status',
        name: 'SELinux/AppArmor 状态',
        desc: '检查强制访问控制状态',
        commands: {
          default: 'getenforce 2>/dev/null || echo "SELinux not available"; echo "---"; aa-status 2>/dev/null || echo "AppArmor not available"',
          ubuntu: 'aa-status 2>/dev/null || echo "AppArmor not available"',
          debian: 'aa-status 2>/dev/null || echo "AppArmor not available"',
          centos: 'getenforce 2>/dev/null; echo "---"; sestatus 2>/dev/null',
          rhel: 'getenforce 2>/dev/null; echo "---"; sestatus 2>/dev/null',
          fedora: 'getenforce 2>/dev/null; echo "---"; sestatus 2>/dev/null',
          kylin: 'getenforce 2>/dev/null; echo "---"; sestatus 2>/dev/null || aa-status 2>/dev/null',
          uos: 'aa-status 2>/dev/null || getenforce 2>/dev/null',
          deepin: 'aa-status 2>/dev/null || echo "AppArmor not available"',
          openeuler: 'getenforce 2>/dev/null; echo "---"; sestatus 2>/dev/null',
          anolis: 'getenforce 2>/dev/null; echo "---"; sestatus 2>/dev/null',
          arch: 'aa-status 2>/dev/null || echo "AppArmor not available"',
          opensuse: 'aa-status 2>/dev/null || echo "AppArmor not available"',
          alpine: 'echo "SELinux/AppArmor not typically used on Alpine"'
        }
      },
      {
        id: 'base-password-aging',
        name: '密码过期策略检查',
        desc: '检查用户密码过期设置',
        cmd: 'for user in $(cut -d: -f1 /etc/passwd); do chage -l "$user" 2>/dev/null | grep -E "Password expires|Maximum|Minimum|Warning" | head -n 4 && echo "---"; done | head -n 200'
      },
      {
        id: 'base-empty-password',
        name: '空密码账户检查',
        desc: '检查是否存在空密码账户',
        cmd: 'awk -F: \'($2 == "" || $2 == "!" || $2 == "*") {print $1 " : " $2}\' /etc/shadow 2>/dev/null | head -n 50'
      },
      {
        id: 'base-uid-0-accounts',
        name: 'UID 0 账户检查',
        desc: '检查除root外是否有其他UID为0的账户',
        cmd: 'awk -F: \'($3 == 0) {print $1 " (UID=" $3 ")"}\' /etc/passwd'
      },
      {
        id: 'base-sudo-nopasswd',
        name: 'sudo 免密配置检查',
        desc: '检查sudo免密配置',
        cmd: 'grep -r "NOPASSWD" /etc/sudoers /etc/sudoers.d/ 2>/dev/null'
      },
      {
        id: 'base-ssh-keys',
        name: 'SSH 密钥检查',
        desc: '检查所有用户的SSH授权密钥',
        cmd: 'for home in /root /home/*; do [ -f "$home/.ssh/authorized_keys" ] && echo "=== $home ===" && cat "$home/.ssh/authorized_keys" 2>/dev/null; done'
      },
      {
        id: 'base-failed-logins',
        name: '失败登录尝试',
        desc: '查看最近的失败登录记录',
        cmd: 'lastb -n 50 2>/dev/null || echo "lastb command not available"'
      },
      {
        id: 'base-umask',
        name: 'umask 设置检查',
        desc: '检查系统默认umask设置',
        cmd: 'echo "Current umask: $(umask)"; echo "---"; grep -r "umask" /etc/profile /etc/bashrc /etc/bash.bashrc /etc/profile.d/ 2>/dev/null | head -n 20'
      },
      {
        id: 'base-core-dumps',
        name: 'Core Dump 配置',
        desc: '检查core dump设置',
        cmd: 'ulimit -c; echo "---"; cat /etc/security/limits.conf 2>/dev/null | grep -v "^#" | grep -v "^$" | head -n 30'
      },
      {
        id: 'base-kernel-params',
        name: '内核安全参数',
        desc: '检查关键内核安全参数',
        cmd: 'sysctl kernel.randomize_va_space kernel.exec-shield kernel.dmesg_restrict kernel.kptr_restrict net.ipv4.conf.all.accept_source_route net.ipv4.conf.all.accept_redirects net.ipv4.icmp_echo_ignore_broadcasts 2>/dev/null'
      }
    ],
  },
  {
    id: 'network',
    title: '网络安全排查',
    hint: '端口、连接、路由、防火墙与DNS',
    items: [
      { id: 'net-listen', name: 'ss 监听端口', cmd: `ss -tulpen 2>/dev/null | sed -n '1,300p'`, desc: 'TCP/UDP 监听' },
      { id: 'net-established', name: 'ss 活动连接', cmd: `ss -tanp 2>/dev/null | sed -n '1,500p'`, desc: '活动 TCP 连接' },
      { id: 'net-route', name: '路由表 ip route', cmd: `ip route 2>/dev/null || route -n 2>/dev/null`, desc: '网络路由' },
      { id: 'net-dns', name: '/etc/resolv.conf', cmd: `cat /etc/resolv.conf 2>/dev/null`, desc: 'nameserver/搜索域' },
      {
        id: 'net-firewall-status',
        name: '防火墙状态',
        desc: '检查防火墙配置和状态',
        commands: {
          default: 'iptables -L -n -v 2>/dev/null | head -n 100',
          ubuntu: 'ufw status verbose 2>/dev/null || iptables -L -n -v | head -n 100',
          debian: 'iptables -L -n -v | head -n 100',
          centos: 'firewall-cmd --state 2>/dev/null; echo "---"; firewall-cmd --list-all 2>/dev/null || iptables -L -n -v | head -n 100',
          rhel: 'firewall-cmd --state 2>/dev/null; echo "---"; firewall-cmd --list-all 2>/dev/null || iptables -L -n -v | head -n 100',
          fedora: 'firewall-cmd --state 2>/dev/null; echo "---"; firewall-cmd --list-all 2>/dev/null',
          kylin: 'firewall-cmd --state 2>/dev/null; echo "---"; firewall-cmd --list-all 2>/dev/null || ufw status verbose 2>/dev/null',
          uos: 'ufw status verbose 2>/dev/null || firewall-cmd --list-all 2>/dev/null || iptables -L -n -v | head -n 100',
          deepin: 'ufw status verbose 2>/dev/null || iptables -L -n -v | head -n 100',
          openeuler: 'firewall-cmd --state 2>/dev/null; echo "---"; firewall-cmd --list-all 2>/dev/null',
          anolis: 'firewall-cmd --state 2>/dev/null; echo "---"; firewall-cmd --list-all 2>/dev/null',
          arch: 'iptables -L -n -v | head -n 100',
          opensuse: 'firewall-cmd --state 2>/dev/null; echo "---"; firewall-cmd --list-all 2>/dev/null || iptables -L -n -v | head -n 100',
          alpine: 'iptables -L -n -v | head -n 100'
        }
      },
      {
        id: 'net-iptables-rules',
        name: 'iptables 详细规则',
        desc: '查看iptables所有链的规则',
        cmd: 'iptables -L -n -v --line-numbers 2>/dev/null | head -n 200'
      },
      {
        id: 'net-nftables-rules',
        name: 'nftables 规则集',
        desc: '查看nftables规则',
        cmd: 'nft list ruleset 2>/dev/null | head -n 200 || echo "nftables not available"'
      },
      {
        id: 'net-open-ports',
        name: '开放端口统计',
        desc: '统计所有监听端口',
        cmd: 'ss -tuln 2>/dev/null | grep LISTEN | awk \'{print $5}\' | awk -F: \'{print $NF}\' | sort -n | uniq -c | sort -rn'
      },
      {
        id: 'net-suspicious-connections',
        name: '可疑外部连接',
        desc: '检查非常见端口的外部连接',
        cmd: 'ss -tanp 2>/dev/null | grep ESTAB | grep -vE ":(80|443|22|3306|6379|27017|5432|9200|8080)" | head -n 100'
      },
      {
        id: 'net-interfaces',
        name: '网络接口配置',
        desc: '查看所有网络接口详细信息',
        cmd: 'ip addr show 2>/dev/null || ifconfig -a 2>/dev/null'
      },
      {
        id: 'net-arp-table',
        name: 'ARP 缓存表',
        desc: '查看ARP缓存',
        cmd: 'ip neigh show 2>/dev/null || arp -an 2>/dev/null | head -n 100'
      },
      {
        id: 'net-hosts-file',
        name: '/etc/hosts 文件',
        desc: '检查hosts文件配置',
        cmd: 'cat /etc/hosts 2>/dev/null | grep -v "^#" | grep -v "^$"'
      },
      {
        id: 'net-tcp-wrappers',
        name: 'TCP Wrappers 配置',
        desc: '检查hosts.allow和hosts.deny',
        cmd: 'echo "=== /etc/hosts.allow ==="; cat /etc/hosts.allow 2>/dev/null | grep -v "^#" | grep -v "^$"; echo "=== /etc/hosts.deny ==="; cat /etc/hosts.deny 2>/dev/null | grep -v "^#" | grep -v "^$"'
      },
      {
        id: 'net-ipv6-status',
        name: 'IPv6 状态',
        desc: '检查IPv6是否启用',
        cmd: 'cat /proc/sys/net/ipv6/conf/all/disable_ipv6 2>/dev/null; echo "---"; ip -6 addr show 2>/dev/null | head -n 50'
      },
      {
        id: 'net-syn-flood-protection',
        name: 'SYN Flood 防护',
        desc: '检查SYN flood防护参数',
        cmd: 'sysctl net.ipv4.tcp_syncookies net.ipv4.tcp_max_syn_backlog net.ipv4.tcp_synack_retries 2>/dev/null'
      },
      {
        id: 'net-icmp-settings',
        name: 'ICMP 设置',
        desc: '检查ICMP相关安全设置',
        cmd: 'sysctl net.ipv4.icmp_echo_ignore_all net.ipv4.icmp_echo_ignore_broadcasts net.ipv4.icmp_ignore_bogus_error_responses 2>/dev/null'
      },
      {
        id: 'net-ip-forwarding',
        name: 'IP 转发状态',
        desc: '检查IP转发是否启用',
        cmd: 'sysctl net.ipv4.ip_forward net.ipv6.conf.all.forwarding 2>/dev/null'
      },
      {
        id: 'net-rp-filter',
        name: '反向路径过滤',
        desc: '检查反向路径过滤设置',
        cmd: 'sysctl net.ipv4.conf.all.rp_filter net.ipv4.conf.default.rp_filter 2>/dev/null'
      }
    ],
  },
  {
    id: 'system',
    title: '系统安全排查',
    hint: '进程、模块、文件修改与异常检测',
    items: [
      { id: 'sys-proc-top', name: 'Top CPU 进程', cmd: `ps aux --sort=-%cpu | sed -n '1,60p'`, desc: 'CPU 占用排行' },
      { id: 'sys-root-proc', name: 'Root 进程', cmd: `ps -U root -u root u 2>/dev/null | sed -n '1,200p'`, desc: '以root运行的进程' },
      { id: 'sys-recent-files', name: '24h Modified 文件', cmd: `find / -xdev -type f -mtime -1 2>/dev/null | head -n 200`, desc: '最近修改排查' },
      { id: 'sys-modules', name: '内核模块 lsmod', cmd: `lsmod 2>/dev/null | sed -n '1,200p'`, desc: '已加载模块' },
      { id: 'sys-logins', name: '登录历史 last/lastlog', cmd: `(last -n 80 2>/dev/null || lastlog 2>/dev/null | tail -n 120)`, desc: 'last/lastlog 摘要' },
      { id: 'sys-path', name: 'PATH 可写检测', cmd: `echo $PATH; echo; for d in $(echo $PATH | tr ':' ' '); do ls -ld "$d" 2>/dev/null; done`, desc: '可写PATH风险' },
      {
        id: 'sys-hidden-processes',
        name: '隐藏进程检测',
        desc: '检测可能被隐藏的进程',
        cmd: 'ps aux | wc -l; echo "---"; ls /proc | grep -E "^[0-9]+$" | wc -l; echo "---"; ps aux | awk \'{print $2}\' | sort -n | uniq | wc -l'
      },
      {
        id: 'sys-suspicious-processes',
        name: '可疑进程检测',
        desc: '检测可疑的进程名称',
        cmd: 'ps aux | grep -E "(nc|ncat|netcat|/dev/tcp|/dev/udp|base64|python -c|perl -e|ruby -e|php -r)" | grep -v grep | head -n 50'
      },
      {
        id: 'sys-deleted-running',
        name: '已删除但仍运行的程序',
        desc: '检测被删除但仍在运行的可执行文件',
        cmd: 'lsof +L1 2>/dev/null | head -n 100 || echo "lsof not available"'
      },
      {
        id: 'sys-memory-usage',
        name: '内存使用排行',
        desc: '查看内存占用最高的进程',
        cmd: 'ps aux --sort=-%mem | head -n 30'
      },
      {
        id: 'sys-zombie-processes',
        name: '僵尸进程检测',
        desc: '检测系统中的僵尸进程',
        cmd: 'ps aux | awk \'$8=="Z" {print}\' | head -n 50'
      },
      {
        id: 'sys-startup-scripts',
        name: '启动脚本检查',
        desc: '检查系统启动脚本',
        cmd: 'ls -la /etc/rc*.d/ 2>/dev/null | head -n 100; echo "---"; ls -la /etc/init.d/ 2>/dev/null | head -n 50'
      },
      {
        id: 'sys-systemd-units',
        name: 'systemd 单元文件',
        desc: '列出所有systemd单元文件',
        cmd: 'systemctl list-unit-files --no-pager 2>/dev/null | head -n 200'
      },
      {
        id: 'sys-environment-vars',
        name: '环境变量检查',
        desc: '检查系统环境变量',
        cmd: 'env | sort | head -n 100'
      },
      {
        id: 'sys-ld-preload',
        name: 'LD_PRELOAD 检查',
        desc: '检查LD_PRELOAD劫持',
        cmd: 'cat /etc/ld.so.preload 2>/dev/null || echo "No ld.so.preload file"; echo "---"; echo $LD_PRELOAD; echo "---"; cat /etc/ld.so.conf 2>/dev/null | head -n 30'
      },
      {
        id: 'sys-shared-libraries',
        name: '共享库检查',
        desc: '检查系统共享库配置',
        cmd: 'ldconfig -p 2>/dev/null | head -n 100'
      },
      {
        id: 'sys-tmp-files',
        name: '/tmp 可疑文件',
        desc: '检查/tmp目录中的可疑文件',
        cmd: 'find /tmp /var/tmp -type f -mtime -7 2>/dev/null | head -n 100; echo "---"; ls -lah /tmp /var/tmp 2>/dev/null | head -n 50'
      },
      {
        id: 'sys-dev-shm',
        name: '/dev/shm 检查',
        desc: '检查共享内存目录',
        cmd: 'ls -lah /dev/shm 2>/dev/null; echo "---"; find /dev/shm -type f 2>/dev/null'
      },
      {
        id: 'sys-unusual-files',
        name: '异常文件名检测',
        desc: '检测包含特殊字符的文件名',
        cmd: 'find / -xdev -type f -name "*[[:space:]]*" -o -name ".*[[:space:]]*" 2>/dev/null | head -n 100'
      },
      {
        id: 'sys-large-files',
        name: '大文件检测',
        desc: '查找大于100MB的文件',
        cmd: 'find / -xdev -type f -size +100M 2>/dev/null | head -n 50'
      },
      {
        id: 'sys-immutable-files',
        name: '不可变文件检查',
        desc: '检查设置了不可变属性的文件',
        cmd: 'lsattr / 2>/dev/null | grep -E "i-|a-" | head -n 100 || echo "lsattr not available"'
      }
    ],
  },
  {
    id: 'audit',
    title: '日志审计与监控',
    hint: '认证、系统错误、审计日志',
    items: [
      {
        id: 'audit-auth-fail',
        name: '认证失败日志',
        desc: '查看认证失败记录',
        commands: {
          default: 'grep -iE "fail|invalid|error|refused" /var/log/auth.log 2>/dev/null | tail -n 200 || grep -iE "fail|invalid|error|refused" /var/log/secure 2>/dev/null | tail -n 200',
          ubuntu: 'grep -iE "fail|invalid|error|refused" /var/log/auth.log 2>/dev/null | tail -n 200',
          debian: 'grep -iE "fail|invalid|error|refused" /var/log/auth.log 2>/dev/null | tail -n 200',
          centos: 'grep -iE "fail|invalid|error|refused" /var/log/secure 2>/dev/null | tail -n 200',
          rhel: 'grep -iE "fail|invalid|error|refused" /var/log/secure 2>/dev/null | tail -n 200',
          fedora: 'grep -iE "fail|invalid|error|refused" /var/log/secure 2>/dev/null | tail -n 200 || journalctl -u sshd -p err -n 200 --no-pager',
          kylin: 'grep -iE "fail|invalid|error|refused" /var/log/secure 2>/dev/null | tail -n 200 || grep -iE "fail|invalid|error|refused" /var/log/auth.log 2>/dev/null | tail -n 200',
          uos: 'grep -iE "fail|invalid|error|refused" /var/log/auth.log 2>/dev/null | tail -n 200',
          deepin: 'grep -iE "fail|invalid|error|refused" /var/log/auth.log 2>/dev/null | tail -n 200',
          openeuler: 'grep -iE "fail|invalid|error|refused" /var/log/secure 2>/dev/null | tail -n 200',
          anolis: 'grep -iE "fail|invalid|error|refused" /var/log/secure 2>/dev/null | tail -n 200',
          arch: 'journalctl -u sshd -p err -n 200 --no-pager 2>/dev/null',
          opensuse: 'grep -iE "fail|invalid|error|refused" /var/log/messages 2>/dev/null | tail -n 200',
          alpine: 'grep -iE "fail|invalid|error|refused" /var/log/messages 2>/dev/null | tail -n 200'
        }
      },
      { id: 'audit-journal-err', name: 'journalctl 错误', cmd: `journalctl -p err -n 200 --no-pager 2>/dev/null || echo 'journalctl 不可用'`, desc: '优先级 error' },
      { id: 'audit-syslog', name: 'Syslog Warning/Error', cmd: `grep -iE 'error|warn|critical' /var/log/syslog 2>/dev/null | tail -n 200 || grep -iE 'error|warn|critical' /var/log/messages 2>/dev/null | tail -n 200`, desc: 'syslog 快照' },
      { id: 'audit-sudo', name: 'sudo 使用记录', cmd: `grep -i sudo /var/log/auth.log 2>/dev/null | tail -n 200 || grep -i sudo /var/log/secure 2>/dev/null | tail -n 200`, desc: 'sudo 关键记录' },
      {
        id: 'audit-auditd-status',
        name: 'auditd 审计状态',
        desc: '检查auditd审计服务状态',
        commands: {
          default: 'systemctl status auditd 2>/dev/null || service auditd status 2>/dev/null',
          ubuntu: 'systemctl status auditd 2>/dev/null || echo "auditd not installed"',
          debian: 'systemctl status auditd 2>/dev/null || echo "auditd not installed"',
          centos: 'systemctl status auditd 2>/dev/null',
          rhel: 'systemctl status auditd 2>/dev/null',
          fedora: 'systemctl status auditd 2>/dev/null',
          kylin: 'systemctl status auditd 2>/dev/null',
          uos: 'systemctl status auditd 2>/dev/null || echo "auditd not installed"',
          deepin: 'systemctl status auditd 2>/dev/null || echo "auditd not installed"',
          openeuler: 'systemctl status auditd 2>/dev/null',
          anolis: 'systemctl status auditd 2>/dev/null',
          arch: 'systemctl status auditd 2>/dev/null || echo "auditd not installed"',
          opensuse: 'systemctl status auditd 2>/dev/null',
          alpine: 'rc-service auditd status 2>/dev/null || echo "auditd not available"'
        }
      },
      {
        id: 'audit-rules',
        name: 'auditd 审计规则',
        desc: '查看当前审计规则',
        cmd: 'auditctl -l 2>/dev/null | head -n 100 || echo "auditd not available or no rules configured"'
      },
      {
        id: 'audit-log-size',
        name: '日志文件大小',
        desc: '检查关键日志文件大小',
        cmd: 'du -sh /var/log/* 2>/dev/null | sort -rh | head -n 30'
      },
      {
        id: 'audit-log-rotation',
        name: '日志轮转配置',
        desc: '检查logrotate配置',
        cmd: 'cat /etc/logrotate.conf 2>/dev/null | grep -v "^#" | grep -v "^$" | head -n 50; echo "---"; ls -lh /etc/logrotate.d/ 2>/dev/null'
      },
      {
        id: 'audit-rsyslog-config',
        name: 'rsyslog 配置',
        desc: '检查rsyslog配置',
        cmd: 'systemctl status rsyslog 2>/dev/null; echo "---"; cat /etc/rsyslog.conf 2>/dev/null | grep -v "^#" | grep -v "^$" | head -n 50'
      },
      {
        id: 'audit-ssh-logins',
        name: 'SSH 登录记录',
        desc: '查看SSH登录历史',
        cmd: 'grep "Accepted" /var/log/auth.log 2>/dev/null | tail -n 100 || grep "Accepted" /var/log/secure 2>/dev/null | tail -n 100 || journalctl -u sshd | grep "Accepted" | tail -n 100'
      },
      {
        id: 'audit-failed-ssh',
        name: 'SSH 失败登录',
        desc: '查看SSH失败登录尝试',
        cmd: 'grep "Failed password" /var/log/auth.log 2>/dev/null | tail -n 100 || grep "Failed password" /var/log/secure 2>/dev/null | tail -n 100'
      },
      {
        id: 'audit-user-commands',
        name: '用户命令历史',
        desc: '查看用户bash历史',
        cmd: 'for home in /root /home/*; do [ -f "$home/.bash_history" ] && echo "=== $home ===" && tail -n 30 "$home/.bash_history" 2>/dev/null; done | head -n 500'
      },
      {
        id: 'audit-file-integrity',
        name: '关键文件完整性',
        desc: '检查关键系统文件的修改时间',
        cmd: 'ls -lt /etc/passwd /etc/shadow /etc/group /etc/sudoers /etc/ssh/sshd_config /etc/hosts /etc/crontab 2>/dev/null'
      },
      {
        id: 'audit-wtmp-btmp',
        name: 'wtmp/btmp 日志',
        desc: '查看登录日志文件信息',
        cmd: 'ls -lh /var/log/wtmp /var/log/btmp /var/log/lastlog 2>/dev/null; echo "---"; last -n 50 2>/dev/null'
      }
    ],
  },
  {
    id: 'containers',
    title: '容器排查',
    hint: '容器环境与特权风险',
    items: [
      { id: 'ctn-docker-ps', name: 'docker ps 概览', cmd: `docker ps -a --format 'table {{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}\t{{.Ports}}' 2>/dev/null || echo 'docker 不可用或权限不足'`, desc: '所有容器含停止的' },
      { id: 'ctn-docker-group', name: 'docker 组 & id', cmd: `getent group docker 2>/dev/null; echo; id 2>/dev/null`, desc: 'docker 组与当前用户' },
      { id: 'ctn-docker-root', name: '/var/lib/docker 权限', cmd: `ls -l /var/lib/docker 2>/dev/null || echo '目录不可访问'`, desc: '数据目录可见性' },
      { id: 'ctn-docker-images', name: 'Docker 镜像列表', cmd: `docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}' 2>/dev/null | head -n 50`, desc: '所有本地镜像' },
      { id: 'ctn-docker-volumes', name: 'Docker 卷挂载', cmd: `docker volume ls 2>/dev/null; echo "---"; docker ps --format '{{.Names}}' 2>/dev/null | while read c; do echo "=== $c ==="; docker inspect "$c" --format '{{range .Mounts}}{{.Type}} {{.Source}} -> {{.Destination}} ({{.Mode}}){{println}}{{end}}' 2>/dev/null; done | head -n 100`, desc: '容器卷/挂载检查' },
      { id: 'ctn-docker-privileged', name: '特权容器检测', cmd: `docker ps --format '{{.Names}}' 2>/dev/null | while read c; do priv=$(docker inspect "$c" --format '{{.HostConfig.Privileged}}' 2>/dev/null); [ "$priv" = "true" ] && echo "[PRIVILEGED] $c"; caps=$(docker inspect "$c" --format '{{.HostConfig.CapAdd}}' 2>/dev/null); [ "$caps" != "[]" ] && [ -n "$caps" ] && echo "[CAPS: $caps] $c"; done`, desc: '特权或额外 capability 容器' },
      { id: 'ctn-docker-network', name: '容器网络模式', cmd: `docker ps --format '{{.Names}}' 2>/dev/null | while read c; do mode=$(docker inspect "$c" --format '{{.HostConfig.NetworkMode}}' 2>/dev/null); echo "$c: $mode"; done | head -n 50`, desc: 'host/bridge/none 网络模式' },
      { id: 'ctn-docker-logs', name: '容器异常日志', cmd: `docker ps --format '{{.Names}}' 2>/dev/null | while read c; do echo "=== $c ==="; docker logs --tail 20 "$c" 2>&1 | grep -iE "error|warn|fail|panic|fatal" | head -n 5; done | head -n 100`, desc: '各容器最近的错误日志' },
      { id: 'ctn-k8s-pods', name: 'K8s Pod 概览', cmd: `kubectl get pods -A -o wide 2>/dev/null | head -n 100 || echo 'kubectl 不可用'`, desc: '所有命名空间的 Pod' },
      { id: 'ctn-k8s-privileged', name: 'K8s 特权 Pod', cmd: `kubectl get pods -A -o json 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);[print(f'{i[\"metadata\"][\"namespace\"]}/{i[\"metadata\"][\"name\"]}') for i in d.get('items',[]) for c in i.get('spec',{}).get('containers',[]) if c.get('securityContext',{}).get('privileged')]" 2>/dev/null || echo 'kubectl/python3 不可用'`, desc: '检测特权 Pod' },
      { id: 'ctn-container-detect', name: '容器环境检测', cmd: `echo "=== cgroup ==="; head -n5 /proc/1/cgroup 2>/dev/null; echo "=== dockerenv ==="; ls -la /.dockerenv 2>/dev/null; echo "=== k8s ==="; ls /var/run/secrets/kubernetes.io 2>/dev/null; echo "=== hostname ==="; hostname; echo "=== overlay ==="; mount | grep overlay | head -n5`, desc: '判断当前是否在容器内' },
    ],
  },
  {
    id: 'incident-triage',
    title: '应急快排',
    hint: '快速定位异常进程/端口/账号/取证',
    items: [
      { id: 'is-hot-proc', name: 'Top CPU/内存 25', cmd: `ps -eo pid,ppid,user,%cpu,%mem,etime,cmd --sort=-%cpu | head -n 25`, desc: '排查高负载或异常进程' },
      { id: 'is-susp-listen', name: 'LISTEN 非标准端口', cmd: `ss -tulpen 2>/dev/null | awk 'NR==1 || ($5 !~ /:(22|80|443|3306|5432|6379)$/)'`, desc: '监听非常见端口的后门服务' },
      { id: 'is-recent-suid', name: '3天内新 SUID', cmd: `find / -xdev -type f -perm -4000 -mtime -3 2>/dev/null`, desc: '最近被赋予 SUID 的二进制' },
      { id: 'is-home-recent', name: '/home 7日内新目录', cmd: `find /home -mindepth 1 -maxdepth 1 -type d -mtime -7 -printf '%TY-%Tm-%Td %TH:%TM %p\n' 2>/dev/null`, desc: '发现新增或可疑用户目录' },
      { id: 'is-failed-service', name: 'systemd Failed Units', cmd: `systemctl list-units --state=failed --no-pager 2>/dev/null`, desc: '失败服务排查潜在破坏行为' },
      { id: 'is-reboots', name: '近期重启记录', cmd: `last reboot -n 10 2>/dev/null`, desc: '定位异常重启时间线' },
      { id: 'fx-bash-history', name: '普通用户 bash_history', cmd: `for u in $(getent passwd | awk -F: '$3>=1000 && $3!=65534 {print $1}'); do hist=~$u/.bash_history; [ -f "$hist" ] && { echo "===== $u ====="; tail -n 40 "$hist"; echo; }; done`, desc: '抽取普通账号最近的命令历史' },
      { id: 'fx-root-history', name: 'root bash_history', cmd: `tail -n 80 /root/.bash_history 2>/dev/null`, desc: '快速查看管理员历史命令' },
      { id: 'fx-tmp-recent', name: '/tmp 近期文件', cmd: `find /tmp /var/tmp -maxdepth 2 -type f -mtime -1 -size -5M -printf '%TY-%Tm-%Td %TH:%TM %p\n' 2>/dev/null`, desc: '木马常驻的临时文件' },
      { id: 'is-new-users-7d', name: '7天内新建用户', cmd: `awk -F: '{if($3>=1000)print $1,$3}' /etc/passwd | while read u uid; do find /home/"$u" -maxdepth 0 -mtime -7 -printf "$u (UID=$uid) created %TY-%Tm-%Td\\n" 2>/dev/null; done; awk -F: '$3>=1000 && $3!=65534{print $1,$3}' /etc/passwd | while read u uid; do chage -l "$u" 2>/dev/null | grep "Last password change" | sed "s/^/$u: /"; done | head -n 30`, desc: '近期新增账号排查' },
      { id: 'is-passwd-shadow-diff', name: 'passwd/shadow 一致性', cmd: `echo "=== passwd 用户数 ==="; wc -l /etc/passwd; echo "=== shadow 用户数 ==="; wc -l /etc/shadow 2>/dev/null; echo "=== 仅在passwd中 ==="; diff <(cut -d: -f1 /etc/passwd | sort) <(cut -d: -f1 /etc/shadow 2>/dev/null | sort) 2>/dev/null | head -n 20`, desc: 'passwd 与 shadow 不一致可能被篡改' },
      { id: 'is-open-fd', name: '异常打开文件描述符', cmd: `lsof -nP 2>/dev/null | awk '{print $1}' | sort | uniq -c | sort -rn | head -n 20`, desc: '排查文件描述符泄漏或恶意打开' },
      { id: 'is-proc-tree', name: '进程父子关系树', cmd: `ps -ef --forest 2>/dev/null | head -n 100 || pstree -pa 2>/dev/null | head -n 100`, desc: '进程树，发现异常父子关系' },
      { id: 'is-login-ips', name: '登录 IP 统计 Top20', cmd: `grep "Accepted" /var/log/auth.log 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="from") print $(i+1)}' | sort | uniq -c | sort -rn | head -n 20 || grep "Accepted" /var/log/secure 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="from") print $(i+1)}' | sort | uniq -c | sort -rn | head -n 20`, desc: '登录来源 IP 频率统计' },
      { id: 'is-bruteforce-ips', name: '暴力破解 IP Top20', cmd: `grep "Failed password" /var/log/auth.log 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="from") print $(i+1)}' | sort | uniq -c | sort -rn | head -n 20 || grep "Failed password" /var/log/secure 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="from") print $(i+1)}' | sort | uniq -c | sort -rn | head -n 20`, desc: '暴力破解来源 IP 统计' },
      { id: 'is-disk-usage', name: '磁盘占用异常', cmd: `df -hT 2>/dev/null; echo "---"; du -sh /var/log /tmp /var/tmp /root /home 2>/dev/null | sort -rh`, desc: '磁盘空间和关键目录占用' },
      { id: 'is-network-connections-by-proc', name: '各进程网络连接数', cmd: `ss -tanp 2>/dev/null | grep ESTAB | awk '{print $NF}' | sort | uniq -c | sort -rn | head -n 20`, desc: '哪些进程建立了最多连接' },
    ],
  },
  {
    id: 'privesc',
    title: '提权检测',
    hint: '提权线索枚举 · SUID/Capabilities/PATH/凭据',
    items: [
      { id: 'ctf-sudo-l', name: 'sudo -l 调查', cmd: `sudo -l 2>/dev/null || echo '需要交互式口令或无sudo权限'`, desc: '可无密码执行的命令' },
      { id: 'ctf-suid-interesting', name: 'SUID 可提权组件', cmd: `find / -xdev -perm -4000 -type f 2>/dev/null | xargs -r ls -la 2>/dev/null | egrep 'bash|sh|nmap|find|python|perl|ruby|vim|nano|less|more|cp|mv|tar|rsync' || true`, desc: '常见可滥用的 SUID 二进制' },
      { id: 'ctf-cap-interesting', name: 'Capabilities 提权', cmd: `command -v getcap >/dev/null 2>&1 && getcap -r / 2>/dev/null | egrep 'cap_setuid|cap_setgid|cap_dac_read_search' || echo 'getcap 未安装'`, desc: '可提权的 capabilities' },
      { id: 'ctf-path-writable', name: 'PATH 可写路径', cmd: `echo $PATH | tr ':' '\n' | while read d; do [ -w "$d" ] && echo "$d"; done 2>/dev/null`, desc: '路径投毒风险' },
      { id: 'ctf-cron-writable', name: '可写 cron 文件', cmd: `find /etc/cron* -type f -writable 2>/dev/null | head -n 200`, desc: '不安全的计划任务' },
      { id: 'ctf-secrets-home', name: '/home 敏感信息', cmd: `grep -R --exclude-dir=.git -iE 'password|passwd|secret|token|apikey|api_key' /home 2>/dev/null | head -n 200`, desc: '快速凭据枚举' },
    ],
  },
  {
    id: 'threat-detection',
    title: '威胁检测与入侵排查',
    hint: 'Rootkit、后门、恶意软件检测',
    items: [
      {
        id: 'threat-rootkit-check',
        name: 'Rootkit 基础检测',
        desc: '检测常见rootkit特征',
        cmd: 'echo "=== Checking /dev ==="; ls -la /dev | grep -E "(tcp|udp|raw)" | head -n 20; echo "=== Checking hidden processes ==="; ps aux | wc -l; ls /proc | grep -E "^[0-9]+$" | wc -l'
      },
      {
        id: 'threat-chkrootkit',
        name: 'chkrootkit 扫描',
        desc: '运行chkrootkit检测',
        cmd: 'which chkrootkit >/dev/null 2>&1 && chkrootkit -q 2>/dev/null | head -n 100 || echo "chkrootkit not installed"'
      },
      {
        id: 'threat-rkhunter',
        name: 'rkhunter 扫描',
        desc: '运行rkhunter检测',
        cmd: 'which rkhunter >/dev/null 2>&1 && rkhunter --check --skip-keypress --report-warnings-only 2>/dev/null | head -n 100 || echo "rkhunter not installed"'
      },
      {
        id: 'threat-reverse-shells',
        name: '反向Shell检测',
        desc: '检测可能的反向shell连接',
        cmd: 'netstat -antp 2>/dev/null | grep -E "ESTABLISHED|SYN_SENT" | grep -vE ":(80|443|22|3306|53)" | head -n 100 || ss -antp 2>/dev/null | grep -E "ESTAB|SYN-SENT" | head -n 100'
      },
      {
        id: 'threat-webshell-scan',
        name: 'Webshell 特征扫描',
        desc: '扫描常见webshell特征',
        cmd: 'find /var/www /usr/share/nginx /opt -type f \\( -name "*.php" -o -name "*.jsp" -o -name "*.asp" \\) -exec grep -l -E "(eval|base64_decode|gzinflate|system|exec|shell_exec|passthru)" {} \\; 2>/dev/null | head -n 50'
      },
      {
        id: 'threat-suspicious-scripts',
        name: '可疑脚本检测',
        desc: '检测可疑的shell脚本',
        cmd: 'find /tmp /var/tmp /dev/shm -type f \\( -name "*.sh" -o -name "*.py" -o -name "*.pl" \\) 2>/dev/null | head -n 50'
      },
      {
        id: 'threat-malware-signatures',
        name: '恶意软件特征',
        desc: '检测常见恶意软件特征',
        cmd: 'ps aux | grep -E "(miner|xmrig|cryptonight|stratum)" | grep -v grep; echo "---"; find / -xdev -name "*miner*" -o -name "*xmrig*" 2>/dev/null | head -n 50'
      },
      {
        id: 'threat-suspicious-network',
        name: '可疑网络活动',
        desc: '检测异常网络连接',
        cmd: 'ss -antp 2>/dev/null | awk \'$1=="ESTAB" {print $5}\' | cut -d: -f1 | sort | uniq -c | sort -rn | head -n 30'
      },
      {
        id: 'threat-dns-tunneling',
        name: 'DNS隧道检测',
        desc: '检测可能的DNS隧道',
        cmd: 'ss -anup 2>/dev/null | grep ":53" | head -n 50; echo "---"; lsof -i :53 2>/dev/null | head -n 30'
      },
      {
        id: 'threat-privilege-escalation',
        name: '提权风险检测',
        desc: '检测可能的提权向量',
        cmd: 'find / -xdev -perm -4000 -type f 2>/dev/null | head -n 100; echo "=== Writable /etc/passwd ==="; ls -l /etc/passwd /etc/shadow'
      },
      {
        id: 'threat-container-escape',
        name: '容器逃逸检测',
        desc: '检测容器环境和逃逸风险',
        cmd: 'cat /proc/1/cgroup 2>/dev/null | head -n 10; echo "---"; ls -la /.dockerenv 2>/dev/null; echo "---"; cat /proc/self/mountinfo 2>/dev/null | grep docker | head -n 10'
      },
      {
        id: 'threat-kernel-exploits',
        name: '内核漏洞检测',
        desc: '检查内核版本和已知漏洞',
        cmd: 'uname -a; echo "---"; cat /proc/version; echo "---"; dmesg | grep -i "exploit\\|vulnerability" | tail -n 20'
      },
      { id: 'threat-icmp-backdoor', name: 'ICMP 后门检测', cmd: `ss -anp 2>/dev/null | grep -i icmp | head -n 20; echo "---"; lsof -i | grep -i icmp 2>/dev/null | head -n 20`, desc: 'ICMP 隧道/后门进程' },
      { id: 'threat-bind-shell', name: 'Bind Shell 检测', cmd: `ss -tulpn 2>/dev/null | grep -E "0\\.0\\.0\\.0:(4444|5555|6666|7777|8888|9999|1234|31337|12345)" | head -n 20; echo "---"; lsof -i -P 2>/dev/null | grep -E "(LISTEN)" | grep -vE ":(22|80|443|3306|8080|8443)" | head -n 30`, desc: '常见 bind shell 端口' },
      { id: 'threat-crypto-mining', name: '挖矿进程检测', cmd: `ps aux | grep -iE "(miner|xmrig|xmr-stak|cpuminer|cgminer|bfgminer|minerd|cryptonight|stratum)" | grep -v grep; echo "---"; find /tmp /var/tmp /dev/shm /opt -name "*miner*" -o -name "*xmrig*" -o -name "*xmr*" 2>/dev/null | head -n 30; echo "---"; top -bn1 | awk '$9>80{print}' | head -n 10`, desc: '挖矿特征进程和文件' },
      { id: 'threat-proc-injection', name: '进程注入检测', cmd: `find /proc/*/maps -exec grep -l "\\[vdso\\]" {} 2>/dev/null | head -n 5; echo "---"; grep -c "deleted" /proc/*/maps 2>/dev/null | awk -F: '$2>0{print}' | sort -t: -k2 -rn | head -n 20`, desc: '内存映射中的可疑删除文件' },
      { id: 'threat-ioc-ip-check', name: '外连 IP 地理分布', cmd: `ss -tanp 2>/dev/null | grep ESTAB | awk '{print $5}' | cut -d: -f1 | grep -vE "^(127\\.|10\\.|192\\.168\\.|172\\.(1[6-9]|2[0-9]|3[01])\\.|::1|0\\.0\\.0\\.0)" | sort | uniq -c | sort -rn | head -n 30`, desc: '外部连接 IP 频率（排除内网）' },
      { id: 'threat-suspicious-cron', name: '可疑 crontab 下载', cmd: `crontab -l 2>/dev/null | grep -iE "(wget|curl|python|bash|sh|nc|/dev/tcp)"; echo "---"; for u in $(cut -d: -f1 /etc/passwd); do c=$(crontab -u "$u" -l 2>/dev/null | grep -iE "(wget|curl|python|bash|nc)"); [ -n "$c" ] && echo "=== $u ===" && echo "$c"; done | head -n 50`, desc: '排查 crontab 中的下载/执行命令' },
      { id: 'threat-so-preload', name: '动态库劫持全检', cmd: `echo "=== ld.so.preload ==="; cat /etc/ld.so.preload 2>/dev/null || echo "(empty)"; echo "=== LD_PRELOAD env ==="; env | grep LD_PRELOAD; echo "=== /etc/ld.so.conf.d ==="; ls -la /etc/ld.so.conf.d/ 2>/dev/null; echo "=== 近期修改的 .so ==="; find /lib /lib64 /usr/lib /usr/lib64 -name "*.so*" -mtime -7 2>/dev/null | head -n 30`, desc: '全面检测 so 劫持' }
    ],
  },
  {
    id: 'persistence',
    title: '持久化 & Backdoor',
    hint: '持久化后门/定时任务排查',
    items: [
      { id: 'ps-systemd-timers', name: 'systemd Timers', cmd: `systemctl list-timers --all --no-pager 2>/dev/null`, desc: '查看自定义定时任务或后门执行' },
      { id: 'ps-cron-susp', name: 'cron 恶意关键字', cmd: `grep -R -n -E '(wget|curl|bash|python|perl|nc|sh)' /etc/cron* 2>/dev/null | head -n 120`, desc: '匹配 cron 中的可疑命令' },
      { id: 'ps-ld-preload', name: '/etc/ld.so.preload', cmd: `cat /etc/ld.so.preload 2>/dev/null`, desc: '排查动态库劫持后门' },
      { id: 'ps-systemd-fresh', name: '48h 内新 service', cmd: `find /etc/systemd/system -maxdepth 2 -type f -name '*.service' -mtime -2 -printf '%TY-%Tm-%Td %TH:%TM %p\n' 2>/dev/null`, desc: '发现最近被投放的 systemd 服务' },
      { id: 'ps-ssh-keys', name: 'authorized_keys 巡检', cmd: `grep -R -n '' /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys 2>/dev/null`, desc: '查找未授权的 SSH 公钥植入' },
      {
        id: 'ps-bashrc-profile',
        name: 'bashrc/profile 后门',
        desc: '检查bash配置文件中的后门',
        cmd: 'grep -E "(wget|curl|nc|/dev/tcp)" /etc/profile /etc/bash.bashrc /etc/bashrc ~/.bashrc ~/.bash_profile /home/*/.bashrc /home/*/.bash_profile 2>/dev/null | head -n 50'
      },
      {
        id: 'ps-motd-backdoor',
        name: 'MOTD 后门检测',
        desc: '检查MOTD脚本',
        cmd: 'ls -la /etc/update-motd.d/ 2>/dev/null; echo "---"; cat /etc/motd 2>/dev/null | head -n 30'
      },
      {
        id: 'ps-pam-backdoor',
        name: 'PAM 后门检测',
        desc: '检查PAM配置',
        cmd: 'ls -la /etc/pam.d/ 2>/dev/null | head -n 50; echo "---"; grep -r "pam_" /etc/pam.d/ 2>/dev/null | grep -v "^#" | head -n 50'
      },
      {
        id: 'ps-kernel-modules',
        name: '可疑内核模块',
        desc: '检测可疑的内核模块',
        cmd: 'lsmod | head -n 50; echo "---"; find /lib/modules/$(uname -r) -type f -name "*.ko" -mtime -30 2>/dev/null | head -n 30'
      },
      {
        id: 'ps-init-scripts',
        name: 'init 脚本后门',
        desc: '检查init脚本',
        cmd: 'ls -la /etc/init.d/ 2>/dev/null | head -n 50; echo "---"; find /etc/init.d/ -type f -mtime -30 2>/dev/null'
      },
      {
        id: 'ps-xinetd-services',
        name: 'xinetd 服务检查',
        desc: '检查xinetd配置的服务',
        cmd: 'ls -la /etc/xinetd.d/ 2>/dev/null; echo "---"; cat /etc/xinetd.conf 2>/dev/null | grep -v "^#" | grep -v "^$"'
      },
      {
        id: 'ps-at-jobs',
        name: 'at 定时任务',
        desc: '检查at定时任务',
        cmd: 'atq 2>/dev/null; echo "---"; ls -la /var/spool/at/ 2>/dev/null | head -n 50'
      },
      { id: 'ps-rc-local', name: 'rc.local 后门', cmd: `cat /etc/rc.local 2>/dev/null | grep -v "^#" | grep -v "^$"; echo "---"; cat /etc/rc.d/rc.local 2>/dev/null | grep -v "^#" | grep -v "^$"`, desc: '排查 rc.local 启动后门' },
      { id: 'ps-prelib-hijack', name: '预加载库劫持', cmd: `echo "=== /etc/ld.so.preload ==="; cat /etc/ld.so.preload 2>/dev/null; echo "=== LD_PRELOAD ==="; grep -r "LD_PRELOAD" /etc/profile /etc/profile.d/ /etc/environment /etc/bash.bashrc /home/*/.bashrc 2>/dev/null | head -n 20; echo "=== 近7天新增.so ==="; find /usr/lib /usr/lib64 /lib /lib64 -name "*.so*" -mtime -7 2>/dev/null | head -n 20`, desc: '全面检测预加载劫持' },
      { id: 'ps-socket-backdoor', name: 'Unix Socket 后门', cmd: `ss -xlp 2>/dev/null | head -n 50; echo "---"; find /tmp /var/tmp /dev/shm -type s 2>/dev/null | head -n 20`, desc: '隐蔽的 Unix Socket 通信' },
      { id: 'ps-alias-backdoor', name: 'alias 命令劫持', cmd: `alias 2>/dev/null; echo "---"; for f in /etc/profile /etc/bashrc /etc/bash.bashrc /root/.bashrc /root/.bash_profile /home/*/.bashrc /home/*/.bash_aliases; do [ -f "$f" ] && grep "alias " "$f" 2>/dev/null | grep -v "^#" && echo "--- $f ---"; done | head -n 50`, desc: '排查恶意 alias 覆盖' },
    ],
  },
  {
    id: 'web-security',
    title: 'Web 应用排查',
    hint: 'Webshell、Web 日志分析、中间件安全',
    items: [
      { id: 'web-shell-php', name: 'PHP Webshell', cmd: `find /var/www /usr/share/nginx /opt/www /srv/www -type f -name "*.php" -exec grep -lE "(eval|assert|base64_decode|gzinflate|gzuncompress|str_rot13|preg_replace.*e|system|exec|passthru|shell_exec|proc_open|popen|\\$_(?:GET|POST|REQUEST|COOKIE)\\s*\\[)" {} \\; 2>/dev/null | head -n 50`, desc: '扫描 PHP Webshell 特征' },
      { id: 'web-shell-jsp', name: 'JSP Webshell', cmd: `find / -type f -name "*.jsp" -o -name "*.jspx" 2>/dev/null | xargs grep -lE "(Runtime\\.getRuntime|ProcessBuilder|exec\\(|cmd|shell)" 2>/dev/null | head -n 30`, desc: '扫描 JSP Webshell' },
      { id: 'web-shell-asp', name: 'ASP Webshell', cmd: `find / -type f \\( -name "*.asp" -o -name "*.aspx" \\) 2>/dev/null | xargs grep -lE "(eval|execute|cmd|shell|wscript)" 2>/dev/null | head -n 30`, desc: '扫描 ASP/ASPX Webshell' },
      { id: 'web-new-files-24h', name: 'Web目录24h新文件', cmd: `find /var/www /usr/share/nginx /opt/www /srv -type f -mtime -1 2>/dev/null | head -n 80`, desc: '最近24小时 Web 目录变更' },
      { id: 'web-access-suspicious', name: 'Web 可疑请求 Top', cmd: `cat /var/log/nginx/access.log /var/log/apache2/access.log /var/log/httpd/access_log 2>/dev/null | grep -iE "(eval|exec|cmd=|/etc/passwd|union.*select|<script|/bin/sh|/bin/bash|wget|curl)" | tail -n 50`, desc: 'Web 日志中的攻击特征' },
      { id: 'web-4xx-5xx', name: 'Web 错误请求统计', cmd: `cat /var/log/nginx/access.log /var/log/apache2/access.log /var/log/httpd/access_log 2>/dev/null | awk '{print $9}' | grep -E "^[45]" | sort | uniq -c | sort -rn | head -n 20`, desc: '4xx/5xx 状态码分布' },
      { id: 'web-attack-ips', name: 'Web 攻击 IP Top20', cmd: `cat /var/log/nginx/access.log /var/log/apache2/access.log /var/log/httpd/access_log 2>/dev/null | grep -iE "(eval|exec|union|select|script|passwd|bash)" | awk '{print $1}' | sort | uniq -c | sort -rn | head -n 20`, desc: '攻击来源 IP 排行' },
      { id: 'web-upload-dirs', name: 'Web 上传目录检查', cmd: `find /var/www /usr/share/nginx /opt/www /srv -type d \\( -name "upload*" -o -name "uploads" -o -name "tmp" -o -name "temp" -o -name "cache" \\) -exec ls -la {} \\; 2>/dev/null | head -n 80`, desc: '检查上传目录中的可疑文件' },
      { id: 'web-nginx-config', name: 'Nginx 配置审计', cmd: `nginx -T 2>/dev/null | head -n 200 || cat /etc/nginx/nginx.conf 2>/dev/null | head -n 100`, desc: 'Nginx 完整配置检查' },
      { id: 'web-apache-config', name: 'Apache 配置审计', cmd: `apachectl -S 2>/dev/null | head -n 50; echo "---"; cat /etc/apache2/apache2.conf /etc/httpd/conf/httpd.conf 2>/dev/null | grep -vE "^(#|$)" | head -n 100`, desc: 'Apache 站点和配置检查' },
      { id: 'web-tomcat-check', name: 'Tomcat 安全检查', cmd: `find / -name "tomcat-users.xml" 2>/dev/null | xargs cat 2>/dev/null | head -n 30; echo "---"; find / -name "server.xml" -path "*/tomcat*" 2>/dev/null | xargs grep -E "(port|Connector)" 2>/dev/null | head -n 20`, desc: 'Tomcat 用户和端口配置' },
      { id: 'web-sensitive-files', name: 'Web 敏感文件泄露', cmd: `for p in /var/www /usr/share/nginx /opt/www /srv; do find "$p" -type f \\( -name ".env" -o -name "*.bak" -o -name "*.sql" -o -name "*.tar.gz" -o -name "*.zip" -o -name "config.php" -o -name "wp-config.php" -o -name "database.yml" \\) 2>/dev/null; done | head -n 50`, desc: '检查 Web 目录中的敏感/备份文件' },
    ],
  },
  {
    id: 'credential-harvest',
    title: '凭据与敏感信息',
    hint: '密码、密钥、Token、数据库凭据采集',
    items: [
      { id: 'cred-ssh-private-keys', name: 'SSH 私钥搜索', cmd: `find / -xdev -name "id_rsa" -o -name "id_ed25519" -o -name "id_ecdsa" -o -name "id_dsa" -o -name "*.pem" -o -name "*.key" 2>/dev/null | head -n 50`, desc: '全盘搜索 SSH 私钥' },
      { id: 'cred-passwords-in-files', name: '文件中的密码', cmd: `grep -rn --include="*.conf" --include="*.cfg" --include="*.ini" --include="*.env" --include="*.yml" --include="*.yaml" --include="*.xml" --include="*.properties" -iE "(password|passwd|pwd|secret|token|api_key|apikey)\\s*[=:]" /etc /opt /srv /var/www 2>/dev/null | grep -v "^Binary" | head -n 80`, desc: '配置文件中的硬编码凭据' },
      { id: 'cred-env-secrets', name: '环境变量敏感信息', cmd: `env | grep -iE "(pass|secret|token|key|api|credential|auth)" 2>/dev/null | head -n 30; echo "---"; cat /etc/environment 2>/dev/null | grep -iE "(pass|secret|token|key)" | head -n 20`, desc: '环境变量中的密码和密钥' },
      { id: 'cred-mysql-config', name: 'MySQL 凭据', cmd: `cat /etc/mysql/debian.cnf 2>/dev/null; echo "---"; cat /root/.my.cnf 2>/dev/null; echo "---"; grep -rn "password" /etc/mysql/ 2>/dev/null | head -n 20`, desc: 'MySQL 配置中的密码' },
      { id: 'cred-docker-secrets', name: 'Docker 敏感信息', cmd: `docker ps --format '{{.Names}}' 2>/dev/null | while read c; do echo "=== $c ==="; docker inspect "$c" --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep -iE "(pass|secret|token|key|api)" | head -n 5; done | head -n 80`, desc: '容器环境变量中的密码' },
      { id: 'cred-git-secrets', name: 'Git 仓库密钥', cmd: `find / -xdev -name ".git" -type d 2>/dev/null | while read d; do echo "=== $d ==="; git -C "$(dirname $d)" log --diff-filter=A --name-only --format="" 2>/dev/null | grep -iE "(password|secret|key|credential|token)" | head -n 5; done | head -n 50`, desc: 'Git 仓库中的敏感文件提交' },
      { id: 'cred-history-secrets', name: '历史命令敏感信息', cmd: `cat /root/.bash_history /home/*/.bash_history 2>/dev/null | grep -iE "(pass|mysql.*-p|curl.*token|wget.*auth|ssh.*-i|scp|rsync.*:)" | head -n 40`, desc: '命令历史中泄露的密码和密钥' },
      { id: 'cred-cloud-tokens', name: '云平台凭据', cmd: `ls -la /root/.aws /root/.azure /root/.config/gcloud /home/*/.aws /home/*/.azure 2>/dev/null; echo "---"; cat /root/.aws/credentials 2>/dev/null | head -n 20; echo "---"; find / -xdev -name "credentials" -o -name "cloud.cfg" 2>/dev/null | head -n 20`, desc: 'AWS/Azure/GCP 凭据文件' },
      { id: 'cred-redis-config', name: 'Redis 配置密码', cmd: `cat /etc/redis/redis.conf /etc/redis.conf 2>/dev/null | grep -E "^requirepass|^masterauth" | head -n 10; echo "---"; redis-cli CONFIG GET requirepass 2>/dev/null`, desc: 'Redis 认证配置' },
      { id: 'cred-ssl-certs', name: 'SSL 证书检查', cmd: `find /etc/ssl /etc/pki /etc/nginx/ssl /etc/letsencrypt -type f \\( -name "*.pem" -o -name "*.crt" -o -name "*.key" \\) -exec ls -la {} \\; 2>/dev/null | head -n 30; echo "---"; find /etc -name "*.key" -exec ls -la {} \\; 2>/dev/null | head -n 20`, desc: 'SSL 证书和私钥文件' },
    ],
  },
  {
    id: 'system-hardening',
    title: '系统加固检查',
    hint: '安全配置合规检测',
    items: [
      { id: 'hard-banner', name: '登录横幅检查', cmd: `cat /etc/issue /etc/issue.net /etc/motd 2>/dev/null | head -n 30`, desc: '登录前/后警告横幅' },
      { id: 'hard-grub-password', name: 'GRUB 密码保护', cmd: `grep -E "^password|^set superusers" /etc/grub.d/* /boot/grub/grub.cfg /boot/grub2/grub.cfg 2>/dev/null | head -n 10 || echo "未设置 GRUB 密码"`, desc: 'GRUB 引导密码配置' },
      { id: 'hard-usb-storage', name: 'USB 存储禁用', cmd: `lsmod | grep -i usb_storage; echo "---"; cat /etc/modprobe.d/*usb* 2>/dev/null; echo "---"; find /etc/modprobe.d -name "*.conf" -exec grep -l "usb-storage" {} \\; 2>/dev/null`, desc: 'USB 存储设备策略' },
      { id: 'hard-noexec-mount', name: 'noexec/nosuid 挂载', cmd: `mount | grep -vE "^(sysfs|proc|devtmpfs|securityfs|cgroup)" | head -n 30`, desc: '分区挂载选项检查' },
      { id: 'hard-aslr', name: 'ASLR 地址随机化', cmd: `cat /proc/sys/kernel/randomize_va_space; echo "---"; sysctl kernel.randomize_va_space 2>/dev/null`, desc: '2=完全随机化，1=部分，0=关闭' },
      { id: 'hard-nx-bit', name: 'NX/DEP 保护', cmd: `dmesg | grep -i "NX" | head -n 5; echo "---"; grep -c "nx" /proc/cpuinfo`, desc: 'CPU NX 位支持' },
      { id: 'hard-tcp-hardening', name: 'TCP/IP 安全参数', cmd: `sysctl net.ipv4.conf.all.accept_redirects net.ipv4.conf.all.send_redirects net.ipv4.conf.all.accept_source_route net.ipv4.conf.all.log_martians net.ipv4.tcp_syncookies net.ipv4.icmp_echo_ignore_broadcasts 2>/dev/null`, desc: 'TCP/IP 协议栈加固参数' },
      { id: 'hard-password-quality', name: '密码复杂度策略', cmd: `cat /etc/security/pwquality.conf 2>/dev/null | grep -v "^#" | grep -v "^$"; echo "---"; cat /etc/pam.d/common-password 2>/dev/null | grep -v "^#" | head -n 20 || cat /etc/pam.d/system-auth 2>/dev/null | grep -v "^#" | head -n 20`, desc: 'PAM 密码质量策略' },
      { id: 'hard-account-lockout', name: '账户锁定策略', cmd: `grep "pam_tally2\\|pam_faillock" /etc/pam.d/* 2>/dev/null | head -n 20; echo "---"; faillock 2>/dev/null | head -n 20`, desc: '登录失败锁定配置' },
      { id: 'hard-unused-services', name: '不必要服务检测', cmd: `systemctl list-units --type=service --state=running --no-pager 2>/dev/null | grep -iE "(telnet|ftp|rsh|rlogin|rexec|talk|finger|tftp|xinetd|avahi|cups)" | head -n 20`, desc: '运行中的不安全/不必要服务' },
      { id: 'hard-world-readable-keys', name: '密钥权限检查', cmd: `find / -xdev -name "*.key" -o -name "*.pem" -o -name "id_rsa" -o -name "id_ed25519" 2>/dev/null | xargs ls -la 2>/dev/null | grep -v "^total" | awk '{if(substr($1,5,1)=="r" || substr($1,8,1)=="r") print "[WARN] " $0; else print "[OK] " $0}' | head -n 30`, desc: '私钥文件权限过大检测' },
    ],
  },
];