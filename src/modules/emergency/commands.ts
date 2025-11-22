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
      { id: 'ctn-docker-ps', name: 'docker ps 概览', cmd: `docker ps --format '{{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}' 2>/dev/null || echo 'docker 不可用或权限不足'`, desc: 'Docker ps 概览' },
      { id: 'ctn-docker-group', name: 'docker 组 & id', cmd: `getent group docker 2>/dev/null; echo; id 2>/dev/null`, desc: 'docker 组与当前用户' },
      { id: 'ctn-docker-root', name: '/var/lib/docker 权限', cmd: `ls -l /var/lib/docker 2>/dev/null || echo '目录不可访问'`, desc: '数据目录可见性' },
    ],
  },
  {
    id: 'ctf',
    title: 'CTF 提权辅助',
    hint: '提权线索快速枚举（只读）',
    items: [
      { id: 'ctf-sudo-l', name: 'sudo -l 调查', cmd: `sudo -l 2>/dev/null || echo '需要交互式口令或无sudo权限'`, desc: '可无密码的命令' },
      { id: 'ctf-suid-interesting', name: 'SUID 常见提权', cmd: `find / -xdev -perm -4000 -type f 2>/dev/null | xargs -r ls -la 2>/dev/null | egrep 'bash|sh|nmap|find|python|perl|ruby|vim|nano|less|more|cp|mv|tar|rsync' || true`, desc: '常见可滥用组件' },
      { id: 'ctf-cap-interesting', name: 'Capabilities 提权线索', cmd: `command -v getcap >/dev/null 2>&1 && getcap -r / 2>/dev/null | egrep 'cap_setuid|cap_setgid|cap_dac_read_search' || echo 'getcap 未安装'`, desc: '可提权能力' },
      { id: 'ctf-path-writable', name: 'PATH Writable 路径', cmd: `echo $PATH | tr ':' '\n' | while read d; do [ -w "$d" ] && echo "$d"; done 2>/dev/null`, desc: '路径投毒风险' },
      { id: 'ctf-cron-writable', name: '可写 cron 文件', cmd: `find /etc/cron* -type f -writable 2>/dev/null | head -n 200`, desc: '不安全的计划任务' },
      { id: 'ctf-secrets-home', name: '/home 可读敏感信息', cmd: `grep -R --exclude-dir=.git -iE 'password|passwd|secret|token|apikey|api_key' /home 2>/dev/null | head -n 200`, desc: '快速凭据枚举' },
    ],
  },
  {
    id: 'incident-scan',
    title: '赛事快排',
    hint: 'Incident triage · 快速定位异常进程/端口/账号',
    items: [
      { id: 'is-hot-proc', name: 'Top CPU/内存 25', cmd: `ps -eo pid,ppid,user,%cpu,%mem,etime,cmd --sort=-%cpu | head -n 25`, desc: '排查高负载或异常指挥进程' },
      { id: 'is-susp-listen', name: 'LISTEN 非标准端口', cmd: `ss -tulpen 2>/dev/null | awk 'NR==1 || ($5 !~ /:(22|80|443|3306|5432|6379)$/)'`, desc: '监听非常见端口的后门服务' },
      { id: 'is-recent-suid', name: '3天内新 SUID', cmd: `find / -xdev -type f -perm -4000 -mtime -3 2>/dev/null`, desc: '最近被赋予 SUID 的二进制' },
      { id: 'is-home-recent', name: '/home 7日内新目录', cmd: `find /home -mindepth 1 -maxdepth 1 -type d -mtime -7 -printf '%TY-%Tm-%Td %TH:%TM %p\n' 2>/dev/null`, desc: '发现新增或可疑用户目录' },
      { id: 'is-failed-service', name: 'systemd Failed Units', cmd: `systemctl list-units --state=failed --no-pager 2>/dev/null`, desc: '失败服务排查潜在破坏行为' },
      { id: 'is-reboots', name: '近期重启记录', cmd: `last reboot -n 10 2>/dev/null`, desc: '定位异常重启时间线' },
    ],
  },
  {
    id: 'forensics',
    title: '取证采集',
    hint: 'CTF / 比赛常见取证 Artefacts',
    items: [
      { id: 'fx-bash-history', name: '普通用户 bash_history', cmd: `for u in $(getent passwd | awk -F: '$3>=1000 && $3!=65534 {print $1}'); do hist=~$u/.bash_history; [ -f "$hist" ] && { echo "===== $u ====="; tail -n 40 "$hist"; echo; }; done`, desc: '抽取普通账号最近的命令历史' },
      { id: 'fx-root-history', name: 'root bash_history', cmd: `tail -n 80 /root/.bash_history 2>/dev/null`, desc: '快速查看管理员历史命令' },
      { id: 'fx-auth-journal', name: 'SSH 成功/失败登录', cmd: `journalctl -u ssh -n 120 --no-pager 2>/dev/null || tail -n 120 /var/log/auth.log 2>/dev/null`, desc: '整合 SSH 登录事件' },
      { id: 'fx-tmp-recent', name: '/tmp Recent 文件', cmd: `find /tmp /var/tmp -maxdepth 2 -type f -mtime -1 -size -5M -printf '%TY-%Tm-%Td %TH:%TM %p\n' 2>/dev/null`, desc: '挂载木马常驻的临时文件' },
      { id: 'fx-webshell-hunt', name: 'Webshell 快速检索', cmd: `grep -R --include='*.php' -n "eval(" /var/www 2>/dev/null | head -n 60`, desc: '检索常见 PHP Webshell 关键字' },
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
      }
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
      }
    ],
  },
  {
    id: 'multi-system',
    title: '多系统适配示例',
    hint: '展示不同系统的命令适配（包管理、服务管理等）',
    items: [
      {
        id: 'ms-list-packages',
        name: '列出已安装软件包',
        desc: '根据不同系统使用对应的包管理器',
        commands: {
          default: 'echo "未知包管理器"',
          ubuntu: 'dpkg -l | head -n 100',
          debian: 'dpkg -l | head -n 100',
          centos: 'rpm -qa | head -n 100',
          rhel: 'rpm -qa | head -n 100',
          fedora: 'dnf list installed | head -n 100',
          kylin: 'dpkg -l | head -n 100',  // 麒麟基于 Debian
          uos: 'dpkg -l | head -n 100',    // 统信基于 Debian
          deepin: 'dpkg -l | head -n 100', // 深度基于 Debian
          openeuler: 'rpm -qa | head -n 100',  // 欧拉基于 RPM
          anolis: 'rpm -qa | head -n 100',     // 龙蜥基于 RPM
          arch: 'pacman -Q | head -n 100',
          opensuse: 'zypper se --installed-only | head -n 100',
          alpine: 'apk list --installed | head -n 100'
        }
      },
      {
        id: 'ms-service-list',
        name: '列出系统服务',
        desc: '根据不同 init 系统使用对应命令',
        commands: {
          default: 'systemctl list-units --type=service --no-pager 2>/dev/null | head -n 100 || service --status-all 2>/dev/null | head -n 100',
          ubuntu: 'systemctl list-units --type=service --no-pager | head -n 100',
          debian: 'systemctl list-units --type=service --no-pager | head -n 100',
          centos: 'systemctl list-units --type=service --no-pager | head -n 100',
          rhel: 'systemctl list-units --type=service --no-pager | head -n 100',
          fedora: 'systemctl list-units --type=service --no-pager | head -n 100',
          kylin: 'systemctl list-units --type=service --no-pager | head -n 100',
          uos: 'systemctl list-units --type=service --no-pager | head -n 100',
          deepin: 'systemctl list-units --type=service --no-pager | head -n 100',
          openeuler: 'systemctl list-units --type=service --no-pager | head -n 100',
          anolis: 'systemctl list-units --type=service --no-pager | head -n 100',
          arch: 'systemctl list-units --type=service --no-pager | head -n 100',
          opensuse: 'systemctl list-units --type=service --no-pager | head -n 100',
          alpine: 'rc-status -a 2>/dev/null || service --status-all 2>/dev/null | head -n 100'
        }
      },
      {
        id: 'ms-firewall-status',
        name: '防火墙状态',
        desc: '检查不同系统的防火墙配置',
        commands: {
          default: 'iptables -L -n -v 2>/dev/null | head -n 50',
          ubuntu: 'ufw status verbose 2>/dev/null || iptables -L -n -v | head -n 50',
          debian: 'iptables -L -n -v | head -n 50',
          centos: 'firewall-cmd --list-all 2>/dev/null || iptables -L -n -v | head -n 50',
          rhel: 'firewall-cmd --list-all 2>/dev/null || iptables -L -n -v | head -n 50',
          fedora: 'firewall-cmd --list-all 2>/dev/null || iptables -L -n -v | head -n 50',
          kylin: 'ufw status verbose 2>/dev/null || iptables -L -n -v | head -n 50',
          uos: 'ufw status verbose 2>/dev/null || iptables -L -n -v | head -n 50',
          deepin: 'ufw status verbose 2>/dev/null || iptables -L -n -v | head -n 50',
          openeuler: 'firewall-cmd --list-all 2>/dev/null || iptables -L -n -v | head -n 50',
          anolis: 'firewall-cmd --list-all 2>/dev/null || iptables -L -n -v | head -n 50',
          arch: 'iptables -L -n -v | head -n 50',
          opensuse: 'firewall-cmd --list-all 2>/dev/null || iptables -L -n -v | head -n 50',
          alpine: 'iptables -L -n -v | head -n 50'
        }
      },
      {
        id: 'ms-update-check',
        name: '检查系统更新',
        desc: '查看可用的系统更新',
        commands: {
          default: 'echo "请手动检查系统更新"',
          ubuntu: 'apt list --upgradable 2>/dev/null | head -n 50',
          debian: 'apt list --upgradable 2>/dev/null | head -n 50',
          centos: 'yum check-update 2>/dev/null | head -n 50',
          rhel: 'yum check-update 2>/dev/null | head -n 50',
          fedora: 'dnf check-update 2>/dev/null | head -n 50',
          kylin: 'apt list --upgradable 2>/dev/null | head -n 50',
          uos: 'apt list --upgradable 2>/dev/null | head -n 50',
          deepin: 'apt list --upgradable 2>/dev/null | head -n 50',
          openeuler: 'dnf check-update 2>/dev/null | head -n 50',
          anolis: 'dnf check-update 2>/dev/null | head -n 50',
          arch: 'pacman -Qu 2>/dev/null | head -n 50',
          opensuse: 'zypper list-updates 2>/dev/null | head -n 50',
          alpine: 'apk version -l "<" 2>/dev/null | head -n 50'
        }
      },
      {
        id: 'ms-system-info',
        name: '系统详细信息',
        desc: '显示系统版本和硬件信息',
        commands: {
          default: 'cat /etc/os-release 2>/dev/null; echo "---"; uname -a',
          ubuntu: 'lsb_release -a 2>/dev/null; echo "---"; uname -a; echo "---"; hostnamectl 2>/dev/null',
          debian: 'cat /etc/debian_version 2>/dev/null; echo "---"; uname -a; echo "---"; hostnamectl 2>/dev/null',
          centos: 'cat /etc/centos-release 2>/dev/null; echo "---"; uname -a; echo "---"; hostnamectl 2>/dev/null',
          rhel: 'cat /etc/redhat-release 2>/dev/null; echo "---"; uname -a; echo "---"; hostnamectl 2>/dev/null',
          fedora: 'cat /etc/fedora-release 2>/dev/null; echo "---"; uname -a; echo "---"; hostnamectl 2>/dev/null',
          kylin: 'cat /etc/kylin-release 2>/dev/null || cat /etc/os-release; echo "---"; uname -a; echo "---"; hostnamectl 2>/dev/null',
          uos: 'cat /etc/os-release 2>/dev/null; echo "---"; uname -a; echo "---"; hostnamectl 2>/dev/null',
          deepin: 'cat /etc/deepin-version 2>/dev/null || cat /etc/os-release; echo "---"; uname -a',
          openeuler: 'cat /etc/openEuler-release 2>/dev/null || cat /etc/os-release; echo "---"; uname -a; echo "---"; hostnamectl 2>/dev/null',
          anolis: 'cat /etc/anolis-release 2>/dev/null || cat /etc/os-release; echo "---"; uname -a; echo "---"; hostnamectl 2>/dev/null',
          arch: 'cat /etc/os-release; echo "---"; uname -a',
          opensuse: 'cat /etc/os-release; echo "---"; uname -a; echo "---"; hostnamectl 2>/dev/null',
          alpine: 'cat /etc/alpine-release 2>/dev/null; echo "---"; uname -a'
        }
      }
    ],
  },
];