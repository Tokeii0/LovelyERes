/**
 * 系统信息通用「详情侧栏」(System Detail Drawer)
 *
 * 与进程详情抽屉同款的右侧常驻可收缩侧栏，供「系统信息」里除进程外的各 tab 复用：
 * 点击表格行后展示该条目的关键信息，并把我们之前为右键菜单设计的大量功能
 * 以按钮形式直接放到侧栏里（复用各 ContextMenu.runAction，命令/结果弹窗/AI 完全一致）。
 *
 * 侧栏 DOM 由 renderSysSide() 注入到 .sys-view 中；行点击 → openSysDetail(tab, row)。
 *
 * 「概要」：能直接读出来的关键信息在点开时自动拉取并内联展示（无需再点按钮），
 * 与进程详情的 fetchExtended 同思路；命令均为只读，输出 KEY:value 行。
 */

import { invoke } from '@tauri-apps/api/core';

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** shell 单引号安全包裹（用于把实体值拼进只读命令） */
function sq(s: any): string {
  return `'${String(s ?? '').replace(/'/g, `'\\''`)}'`;
}

const I_CHEV = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
const I_PANEL = '<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M14 4v16"/></svg>';

interface ActionDef { label: string; action: string; tone?: 'danger' | 'primary'; }
interface DetailSpec {
  title: string;
  badge?: { level: 'high' | 'warn' | 'ok'; text: string };
  tags?: string[];
  sections: Array<{ label: string; kv?: Array<[string, string]>; code?: string }>;
  menuKey: string;
  entity: any;
  actions: ActionDef[];
  foot?: ActionDef[];
  /** 点开即自动拉取并内联展示的「概要」（只读命令，输出 KEY:value 行） */
  autoload?: { cmd: string; fields: Array<{ key: string; label: string }> };
}

/** 侧栏标题（每个 tab 不同） */
const SIDE_TITLE: Record<string, string> = {
  services: '服务详情', users: '用户详情', network: '连接详情', cron: '任务详情',
  firewall: '规则详情', sshkeys: '密钥详情', loginhistory: '登录详情', suidfiles: '文件详情',
  envvars: '变量详情', packages: '软件包详情', sudoers: 'Sudo 详情', timers: '定时器详情',
  kernelmodules: '模块详情', recentfiles: '文件详情', autostart: '启动项详情',
};

function riskBadge(risk: string): DetailSpec['badge'] | undefined {
  const r = (risk || '').toLowerCase();
  if (r === 'high') return { level: 'high', text: '高危' };
  if (r === 'warning' || r === 'warn') return { level: 'warn', text: '可疑' };
  return undefined;
}

// ─────────────────────────── 各 tab 的详情提供器 ───────────────────────────

const PROVIDERS: Record<string, (row: any) => DetailSpec> = {
  services: (r) => ({
    title: r.name || '服务',
    tags: [r.status === 'active' || r.status === 'running' ? '运行中' : (r.status || '')].filter(Boolean),
    sections: [
      { label: '基本信息', kv: [['状态', r.status || '-'], ['开机自启', r.enabled || '-'], ['描述', r.description || '-']] },
    ],
    menuKey: 'service', entity: r.name,
    autoload: {
      cmd: `systemctl show ${sq(r.name)} -p ActiveState,SubState,UnitFileState,MainPID,User,FragmentPath,MemoryCurrent 2>/dev/null | sed 's/=/:/'`,
      fields: [
        { key: 'ActiveState', label: '运行状态' }, { key: 'SubState', label: '子状态' },
        { key: 'UnitFileState', label: '开机自启' }, { key: 'MainPID', label: '主进程PID' },
        { key: 'User', label: '运行用户' }, { key: 'MemoryCurrent', label: '内存占用' },
        { key: 'FragmentPath', label: '单元文件' },
      ],
    },
    actions: [
      { label: '服务状态', action: 'status' }, { label: '详细信息', action: 'details' },
      { label: '配置文件', action: 'edit-service' }, { label: '运行用户', action: 'run-user' },
      { label: '依赖服务', action: 'dependencies' }, { label: '被依赖', action: 'reverse-dependencies' },
      { label: '服务日志', action: 'logs' }, { label: '错误日志', action: 'errors' },
      { label: '安全检查', action: 'security-check' }, { label: '进程列表', action: 'process-list' },
      { label: '启用自启', action: 'enable' }, { label: '重新加载', action: 'reload' },
    ],
    foot: [
      { label: '重启', action: 'restart', tone: 'primary' },
      { label: '启动', action: 'start' },
      { label: '停止', action: 'stop', tone: 'danger' },
    ],
  }),

  users: (r) => ({
    title: r.username || '用户',
    tags: [r.uid === '0' ? 'UID=0' : '', r.username === 'root' ? '' : (r.uid === '0' ? '异常' : '')].filter(Boolean),
    sections: [
      { label: '基本信息', kv: [['UID', r.uid || '-'], ['GID', r.gid || '-'], ['主目录', r.home || '-'], ['Shell', r.shell || '-']] },
    ],
    menuKey: 'user', entity: r.username,
    autoload: {
      cmd: `u=${sq(r.username)}; echo "Groups:$(id -nG "$u" 2>/dev/null)"; echo "Pw:$(passwd -S "$u" 2>/dev/null | awk '{print $2}')"; echo "Sudo:$(sudo -nl -U "$u" 2>/dev/null | grep -c '(' )"; echo "Last:$(lastlog -u "$u" 2>/dev/null | tail -1 | tr -s ' ' | cut -d' ' -f4-)"`,
      fields: [
        { key: 'Groups', label: '所属组' }, { key: 'Pw', label: '密码状态' },
        { key: 'Sudo', label: 'sudo 规则' }, { key: 'Last', label: '最后登录' },
      ],
    },
    actions: [
      { label: '用户详情', action: 'user-details' }, { label: '账户状态', action: 'user-status' },
      { label: '密码过期', action: 'passwd-expire' }, { label: 'sudo 权限', action: 'sudo-permissions' },
      { label: 'SSH 密钥', action: 'ssh-keys' }, { label: '登录历史', action: 'login-history' },
      { label: '失败登录', action: 'failed-logins' }, { label: '当前会话', action: 'current-sessions' },
      { label: '用户进程', action: 'user-processes' }, { label: '定时任务', action: 'crontab' },
      { label: '可疑文件', action: 'suspicious-files' }, { label: '异常登录', action: 'abnormal-login' },
    ],
    foot: [
      { label: '锁定账户', action: 'lock-user', tone: 'danger' },
      { label: '解锁', action: 'unlock-user' },
      { label: '退出会话', action: 'kill-sessions', tone: 'danger' },
    ],
  }),

  network: (r) => ({
    title: r.foreignAddress || r.localAddress || '连接',
    tags: [r.state, r.protocol].filter(Boolean),
    sections: [
      { label: '连接信息', kv: [['协议', r.protocol || '-'], ['本地地址', r.localAddress || '-'], ['远程地址', r.foreignAddress || '-'], ['状态', r.state || '-'], ['PID', r.pid || '-'], ['进程', r.process || '-']] },
    ],
    menuKey: 'network', entity: r,
    actions: [
      { label: 'WHOIS', action: 'whois' },
      { label: '地理位置', action: 'geolocation' }, { label: '反向DNS', action: 'reverse-dns' },
      { label: 'IP类型', action: 'ip-type' }, { label: '占用进程', action: 'port-process' },
      { label: 'Ping', action: 'ping' }, { label: '威胁情报', action: 'threat-intel' },
      { label: '黑名单检查', action: 'blacklist-check' }, { label: '异常检测', action: 'anomaly-detect' },
      { label: '连接频率', action: 'connection-freq' }, { label: '防火墙规则', action: 'firewall-rules' },
    ],
    foot: [
      { label: '阻止IP', action: 'block-ip', tone: 'danger' },
      { label: '临时阻止', action: 'temp-block' },
      { label: '断开', action: 'disconnect', tone: 'danger' },
    ],
  }),

  cron: (r) => ({
    title: (r.command || '计划任务').slice(0, 40),
    sections: [
      { label: '任务信息', kv: [['用户', r.user || '-'], ['时间表', r.schedule || '-'], ['来源', r.source || '-']] },
      { label: '命令', code: r.command || '' },
    ],
    menuKey: 'cron', entity: { user: r.user, schedule: r.schedule, command: r.command, source: r.source || '' },
    actions: [
      { label: '执行时间表', action: 'schedule' },
      { label: '解析表达式', action: 'parse-cron' }, { label: '下次执行', action: 'next-run' },
      { label: '安全检查', action: 'security-check' }, { label: '可疑检测', action: 'suspicious-check' },
      { label: '检查路径', action: 'check-path' }, { label: '执行日志', action: 'execution-logs' },
      { label: '最近执行', action: 'recent-runs' }, { label: '查看 crontab', action: 'view-crontab' },
      { label: '立即执行', action: 'run-now' }, { label: '备份', action: 'backup' },
    ],
    foot: [
      { label: '备份', action: 'backup', tone: 'primary' },
      { label: '删除任务', action: 'delete-task-file', tone: 'danger' },
    ],
  }),

  firewall: (r) => ({
    title: `${r.chain || ''} · ${r.target || ''}`,
    tags: [r.target, r.protocol].filter(Boolean),
    sections: [
      { label: '规则信息', kv: [['链', r.chain || '-'], ['目标', r.target || '-'], ['协议', r.protocol || '-'], ['源地址', r.source || '-'], ['目标地址', r.destination || '-'], ['选项', r.options || '-']] },
    ],
    menuKey: 'firewall', entity: r,
    actions: [
      { label: '所有规则', action: 'list-all-rules' },
      { label: '链规则', action: 'list-chain-rules' }, { label: '防火墙状态', action: 'firewall-status' },
      { label: '默认策略', action: 'default-policy' }, { label: '开放端口', action: 'list-open-ports' },
      { label: '阻止源IP', action: 'block-source-ip' }, { label: '加入白名单', action: 'ip-whitelist' },
      { label: '保存规则', action: 'save-rules' }, { label: '查看日志', action: 'recent-logs' },
    ],
    foot: [
      { label: '阻止源IP', action: 'block-source-ip', tone: 'danger' },
      { label: '删除规则', action: 'delete-rule', tone: 'danger' },
    ],
  }),

  sshkeys: (r) => ({
    title: r.user || 'SSH 密钥',
    tags: [r.keyType].filter(Boolean),
    sections: [
      { label: '密钥信息', kv: [['用户', r.user || '-'], ['类型', r.keyType || '-'], ['备注', r.comment || '-'], ['文件', r.file || '-']] },
      { label: '公钥内容', code: r.keyContent || '' },
    ],
    menuKey: 'sshkey', entity: r,
    autoload: {
      cmd: `echo ${sq(`${r.keyType || ''} ${r.keyContent || ''} ${r.comment || ''}`)} | ssh-keygen -lf - 2>/dev/null | awk '{print "Fp:"$0}'`,
      fields: [{ key: 'Fp', label: '指纹' }],
    },
    actions: [
      { label: '查看 authorized_keys', action: 'view-authorized-keys' }, { label: '密钥指纹', action: 'key-fingerprint' },
      { label: '文件权限', action: 'check-permissions' }, { label: '.ssh 目录', action: 'check-ssh-dir' },
      { label: '创建时间', action: 'check-key-age' }, { label: '用户所有密钥', action: 'all-user-keys' },
      { label: 'sshd 认证配置', action: 'disable-key-auth' },
    ],
    foot: [{ label: '备份密钥', action: 'backup-keys', tone: 'primary' }],
  }),

  loginhistory: (r) => ({
    title: r.user || '登录',
    tags: [r.status === 'failed' ? '失败' : r.status === 'active' ? '在线' : ''].filter(Boolean),
    sections: [
      { label: '登录信息', kv: [['用户', r.user || '-'], ['终端', r.terminal || '-'], ['来源IP', r.source || '-'], ['登录时间', r.loginTime || '-'], ['状态', r.status || '-']] },
    ],
    menuKey: 'loginhistory', entity: r,
    actions: [
      { label: '用户详情', action: 'user-details' }, { label: '登录统计', action: 'user-login-count' },
      { label: '失败登录', action: 'user-failed-count' }, { label: 'sudo 记录', action: 'user-sudo-history' },
      { label: 'IP 登录记录', action: 'ip-logins' }, { label: 'WHOIS', action: 'whois' },
      { label: '反向DNS', action: 'reverse-dns' }, { label: '认证日志', action: 'auth-logs' },
      { label: '暴破检测', action: 'brute-force-check' },
    ],
    foot: [
      { label: '封禁IP', action: 'block-ip', tone: 'danger' },
      { label: '锁定用户', action: 'lock-user', tone: 'danger' },
    ],
  }),

  suidfiles: (r) => ({
    title: (r.path || '').split('/').pop() || r.path || '文件',
    badge: riskBadge(r.risk),
    sections: [
      { label: '文件信息', kv: [['权限', r.permissions || '-'], ['所有者', r.owner || '-'], ['大小', r.size || '-'], ['修改时间', r.modified || '-']] },
      { label: '路径', code: r.path || '' },
    ],
    menuKey: 'suid', entity: r,
    autoload: {
      cmd: `f=${sq(r.path)}; echo "Type:$(file -b "$f" 2>/dev/null)"; echo "Pkg:$(dpkg -S "$f" 2>/dev/null | head -1 || rpm -qf "$f" 2>/dev/null)"; echo "Md5:$(md5sum "$f" 2>/dev/null | cut -d' ' -f1)"; echo "Caps:$(getcap "$f" 2>/dev/null | sed "s|^$f ||")"`,
      fields: [{ key: 'Type', label: '文件类型' }, { key: 'Pkg', label: '所属软件包' }, { key: 'Md5', label: 'MD5' }, { key: 'Caps', label: 'capabilities' }],
    },
    actions: [
      { label: '文件详情', action: 'file-details' }, { label: '文件类型', action: 'file-type' },
      { label: '计算哈希', action: 'file-hash' }, { label: '提取字符串', action: 'file-strings' },
      { label: '所属软件包', action: 'check-package' }, { label: '验证完整性', action: 'verify-integrity' },
      { label: 'capabilities', action: 'check-capabilities' }, { label: '硬链接', action: 'check-links' },
    ],
    foot: [
      { label: '移除 SUID', action: 'remove-suid', tone: 'danger' },
      { label: '隔离文件', action: 'quarantine', tone: 'danger' },
    ],
  }),

  envvars: (r) => ({
    title: r.name || '环境变量',
    badge: riskBadge(r.risk),
    sections: [
      { label: '变量', kv: [['名称', r.name || '-']] },
      { label: '值', code: r.value || '' },
    ],
    menuKey: 'envvar', entity: r,
    actions: [
      { label: '完整值', action: 'view-full-value' }, { label: '追踪来源', action: 'trace-source' },
      { label: '检查 LD_PRELOAD', action: 'check-ld-preload' }, { label: 'PATH 目录权限', action: 'check-path-dirs' },
      { label: '各用户取值', action: 'env-all-users' },
    ],
  }),

  packages: (r) => ({
    title: r.name || '软件包',
    sections: [
      { label: '软件包信息', kv: [['版本', r.version || '-'], ['安装时间', r.installTime || '-'], ['来源', r.source || '-']] },
    ],
    menuKey: 'package', entity: r,
    autoload: {
      cmd: `p=${sq(r.name)}; if command -v dpkg >/dev/null 2>&1; then echo "Status:$(dpkg -s "$p" 2>/dev/null | sed -n 's/^Status: //p')"; echo "Arch:$(dpkg -s "$p" 2>/dev/null | sed -n 's/^Architecture: //p')"; echo "Size:$(dpkg -s "$p" 2>/dev/null | sed -n 's/^Installed-Size: //p')"; else echo "Status:$(rpm -q "$p" 2>/dev/null)"; fi`,
      fields: [{ key: 'Status', label: '状态' }, { key: 'Arch', label: '架构' }, { key: 'Size', label: '安装大小(KB)' }],
    },
    actions: [
      { label: '包详情', action: 'package-details' }, { label: '包文件', action: 'package-files' },
      { label: '依赖', action: 'package-deps' }, { label: '变更日志', action: 'package-changelog' },
      { label: '验证完整性', action: 'verify-integrity' }, { label: '配置文件', action: 'check-config-files' },
      { label: '相关服务', action: 'check-services' },
    ],
    foot: [
      { label: '锁定版本', action: 'hold-package' },
      { label: '卸载(预览)', action: 'remove-package', tone: 'danger' },
    ],
  }),

  sudoers: (r) => ({
    title: r.user || 'Sudoers',
    tags: [/yes|nopasswd|是/i.test(String(r.nopasswd)) ? 'NOPASSWD' : ''].filter(Boolean),
    sections: [
      { label: '规则信息', kv: [['用户/组', r.user || '-'], ['主机', r.host || '-'], ['免密', r.nopasswd || '-'], ['来源', r.source || '-']] },
      { label: '命令', code: r.command || '' },
    ],
    menuKey: 'sudoers', entity: r,
    actions: [
      { label: '查看 sudoers', action: 'view-sudoers' }, { label: '配置来源', action: 'view-source-file' },
      { label: '语法检查', action: 'check-syntax' }, { label: 'sudoers.d', action: 'list-sudoers-d' },
      { label: '用户权限', action: 'user-permissions' }, { label: 'sudo 历史', action: 'user-sudo-history' },
      { label: '用户组', action: 'user-groups' }, { label: '查找 NOPASSWD', action: 'find-nopasswd' },
    ],
    foot: [{ label: '备份 sudoers', action: 'backup-sudoers', tone: 'primary' }],
  }),

  timers: (r) => ({
    title: r.timer || r.unit || '定时器',
    sections: [
      { label: '定时器信息', kv: [['下次触发', r.next || '-'], ['剩余', r.left || '-'], ['上次触发', r.last || '-'], ['触发单元', r.activates || '-']] },
    ],
    menuKey: 'timer', entity: { timer: r.timer || r.unit, activates: r.activates },
    actions: [
      { label: '定时器状态', action: 'timer-status' }, { label: '定时器配置', action: 'timer-config' },
      { label: '触发单元状态', action: 'unit-status' }, { label: '触发单元配置', action: 'unit-config' },
      { label: '定时器日志', action: 'timer-logs' }, { label: '单元日志', action: 'unit-logs' },
    ],
    foot: [
      { label: '停止', action: 'stop-timer', tone: 'danger' },
      { label: '禁用', action: 'disable-timer', tone: 'danger' },
      { label: '屏蔽', action: 'mask-timer', tone: 'danger' },
    ],
  }),

  kernelmodules: (r) => ({
    title: r.name || '内核模块',
    badge: riskBadge(r.risk),
    sections: [
      { label: '模块信息', kv: [['大小', r.size || '-'], ['引用计数', r.refcount || r.usedBy || '-']] },
    ],
    menuKey: 'kernelmodule', entity: r,
    autoload: {
      cmd: `m=${sq(r.name)}; echo "Desc:$(modinfo -F description "$m" 2>/dev/null)"; echo "File:$(modinfo -F filename "$m" 2>/dev/null)"; echo "Signer:$(modinfo -F signer "$m" 2>/dev/null)"; echo "Deps:$(modinfo -F depends "$m" 2>/dev/null)"`,
      fields: [{ key: 'Desc', label: '描述' }, { key: 'File', label: '文件路径' }, { key: 'Signer', label: '签名者' }, { key: 'Deps', label: '依赖' }],
    },
    actions: [
      { label: '模块详情', action: 'module-info' }, { label: '依赖关系', action: 'module-deps' },
      { label: '模块参数', action: 'module-params' }, { label: '模块路径', action: 'module-path' },
      { label: '检查签名', action: 'check-signing' }, { label: '内核污染', action: 'check-taint' },
      { label: '计算哈希', action: 'check-hash' }, { label: 'dmesg 日志', action: 'dmesg-module' },
    ],
    foot: [
      { label: '卸载模块', action: 'unload-module', tone: 'danger' },
      { label: '加入黑名单', action: 'blacklist-module', tone: 'danger' },
    ],
  }),

  recentfiles: (r) => ({
    title: (r.path || '').split('/').pop() || r.path || '文件',
    badge: riskBadge(r.risk),
    sections: [
      { label: '文件信息', kv: [['修改时间', r.modified || '-'], ['大小', r.size || '-'], ['所有者', r.owner || '-']] },
      { label: '路径', code: r.path || '' },
    ],
    menuKey: 'recentfile', entity: r,
    autoload: {
      cmd: `f=${sq(r.path)}; echo "Type:$(file -b "$f" 2>/dev/null)"; echo "Pkg:$(dpkg -S "$f" 2>/dev/null | head -1)"; echo "Md5:$(md5sum "$f" 2>/dev/null | cut -d' ' -f1)"`,
      fields: [{ key: 'Type', label: '文件类型' }, { key: 'Pkg', label: '所属软件包' }, { key: 'Md5', label: 'MD5' }],
    },
    actions: [
      { label: '文件详情', action: 'file-details' }, { label: '文件类型', action: 'file-type' },
      { label: '查看内容', action: 'file-content' }, { label: '计算哈希', action: 'file-hash' },
      { label: '提取字符串', action: 'file-strings' }, { label: '查看权限', action: 'file-permissions' },
      { label: '所属软件包', action: 'check-package' }, { label: '同目录修改', action: 'nearby-files' },
    ],
    foot: [
      { label: '备份文件', action: 'backup-file', tone: 'primary' },
      { label: '隔离文件', action: 'quarantine', tone: 'danger' },
    ],
  }),

  autostart: (r) => ({
    title: r.name || '启动项',
    tags: [r.type, r.status].filter(Boolean),
    sections: [
      { label: '启动项信息', kv: [['类型', r.type || '-'], ['状态', r.status || '-'], ['路径', r.path || '-']] },
      { label: '命令', code: r.command || '' },
    ],
    menuKey: 'startup', entity: { name: r.name, type: r.type, path: r.path || '', command: r.command },
    actions: [
      { label: '启动项详情', action: 'details' }, { label: '启动命令', action: 'command' },
      { label: '查看配置', action: 'view-config' }, { label: '启动类型', action: 'startup-type' },
      { label: '可疑路径', action: 'suspicious-path' }, { label: '恶意检测', action: 'malware-check' },
      { label: '文件签名', action: 'file-signature' }, { label: '修改时间', action: 'modification-time' },
      { label: '资源占用', action: 'resource-usage' }, { label: '启动日志', action: 'startup-logs' },
    ],
    foot: [
      { label: '立即运行', action: 'run-now', tone: 'primary' },
      { label: '启用自启', action: 'enable' },
      { label: '禁用自启', action: 'disable', tone: 'danger' },
    ],
  }),
};

// ─────────────────────────── 渲染 ───────────────────────────

/** 侧栏外壳（注入到 .sys-view 中，与进程详情同款） */
export function renderSysSide(tab: string): string {
  const collapsed = (() => { try { return localStorage.getItem('sys-side-collapsed') === 'true'; } catch { return false; } })();
  return `
    <aside class="sys-side${collapsed ? ' collapsed' : ''}" id="sys-side">
      <div class="sys-side-head">
        <span class="sys-side-title" id="sys-side-title">${esc(SIDE_TITLE[tab] || '详情')}</span>
        <button class="sys-side-toggle" onclick="window.toggleSysSide && window.toggleSysSide()" title="收起 / 展开详情">${I_CHEV}</button>
      </div>
      <div class="sys-side-body" id="sys-side-body">
        <div class="sys-side-empty">
          <span class="sys-side-empty-icon">${I_PANEL}</span>
          <p>点击左侧条目<br>查看详情与可用操作</p>
        </div>
      </div>
      <div class="sys-side-foot" id="sys-side-foot"></div>
    </aside>`;
}

function actionBtns(menuKey: string, list: ActionDef[]): string {
  return list.map(a =>
    `<button class="sd-act${a.tone ? ' ' + a.tone : ''}" onclick="window.sysDetailRun && window.sysDetailRun('${esc(menuKey)}','${esc(a.action)}')">${esc(a.label)}</button>`
  ).join('');
}

function renderDetailBody(d: DetailSpec): string {
  const badge = d.badge
    ? `<span class="pd-rbadge ${d.badge.level}">${esc(d.badge.text)}</span>`
    : '';
  const tags = (d.tags || []).map(t => `<span class="pd-tag">${esc(t)}</span>`).join('');
  const sections = d.sections.map(s => {
    if (s.code !== undefined) {
      return `<div class="pd-section">${esc(s.label)}</div>
        <div class="pd-code"><code>${esc(s.code) || ' '}</code><button class="pd-copy" title="复制" data-copy="${esc(s.code)}" onclick="window.sysDetailCopy(this)">${'<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>'}</button></div>`;
    }
    const kv = (s.kv || []).map(([k, v]) => `<div class="pd-k">${esc(k)}</div><div class="pd-v">${esc(v)}</div>`).join('');
    return `<div class="pd-section">${esc(s.label)}</div><div class="pd-kv">${kv}</div>`;
  }).join('');

  const auto = d.autoload
    ? `<div class="pd-section">概要</div><div class="pd-kv">${d.autoload.fields.map(f =>
        `<div class="pd-k">${esc(f.label)}</div><div class="pd-v" id="sd-auto-${esc(f.key)}"><span class="sd-auto-wait">读取中…</span></div>`).join('')}</div>`
    : '';

  return `
    <div class="pd-id"><span class="pd-title">${esc(d.title)}</span>${badge}${tags}</div>
    ${sections}
    ${auto}
    <div class="pd-section">可用操作</div>
    <div class="sd-actions">${actionBtns(d.menuKey, d.actions)}</div>`;
}

// ─────────────────────────── 交互 ───────────────────────────

let sdActiveEntity: any = null;
let sdToken = 0; // 防止旧行的异步「概要」回填到新行

/** 在右侧侧栏展示某 tab 某行的详情 */
export function openSysDetail(tab: string, row: any): void {
  const provider = PROVIDERS[tab];
  if (!provider || !row) return;
  const d = provider(row);
  sdActiveEntity = d.entity;
  const myToken = ++sdToken;

  const titleEl = document.getElementById('sys-side-title');
  if (titleEl) titleEl.textContent = SIDE_TITLE[tab] || '详情';

  const body = document.getElementById('sys-side-body');
  if (body) body.innerHTML = renderDetailBody(d);

  const foot = document.getElementById('sys-side-foot');
  if (foot) foot.innerHTML = d.foot && d.foot.length ? actionBtns(d.menuKey, d.foot) : '';

  // 自动展开（若用户之前收起）
  const side = document.getElementById('sys-side');
  if (side?.classList.contains('collapsed')) {
    side.classList.remove('collapsed');
    try { localStorage.setItem('sys-side-collapsed', 'false'); } catch { /* ignore */ }
  }

  // 「概要」：自动拉取可直接展示的只读信息并内联填充
  if (d.autoload) void runAutoload(d.autoload, myToken);
}

async function runAutoload(al: NonNullable<DetailSpec['autoload']>, token: number): Promise<void> {
  const fill = (out: string) => {
    if (token !== sdToken) return; // 已切到别的行，丢弃
    for (const f of al.fields) {
      const el = document.getElementById(`sd-auto-${f.key}`);
      if (!el) continue;
      const m = out.match(new RegExp(`^${f.key}:(.*)$`, 'm'));
      const v = (m?.[1] || '').trim();
      el.textContent = v || '-';
    }
  };
  try {
    const res = await invoke('ssh_execute_dashboard_command_direct', { command: al.cmd }) as { output?: string };
    fill(res?.output || '');
  } catch {
    fill(''); // 离线 / 无后端：占位改为 -
  }
}

function toggleSysSide(): void {
  const side = document.getElementById('sys-side');
  if (!side) return;
  const collapsed = side.classList.toggle('collapsed');
  try { localStorage.setItem('sys-side-collapsed', collapsed ? 'true' : 'false'); } catch { /* ignore */ }
}

/** 详情侧栏按钮 → 运行对应右键菜单 action（实体为当前选中行） */
async function sysDetailRun(menuKey: string, action: string): Promise<void> {
  const menus = (window as any).__sysMenus;
  const menu = menus?.[menuKey];
  if (!menu || typeof menu.runAction !== 'function') {
    (window as any).showNotification?.('该操作暂不可用', 'warning');
    return;
  }
  if (sdActiveEntity == null) return;
  try { await menu.runAction(action, sdActiveEntity); }
  catch (e) { (window as any).showNotification?.(`操作失败: ${e}`, 'error'); }
}

function registerSysDetailHandlers(): void {
  const w = window as any;
  w.openSysDetail = openSysDetail;
  w.toggleSysSide = toggleSysSide;
  w.sysDetailRun = sysDetailRun;
  w.sysDetailCopy = (btn: HTMLElement) => {
    const text = btn.getAttribute('data-copy') || '';
    navigator.clipboard?.writeText(text).then(
      () => w.showNotification?.('已复制', 'success'),
      () => w.showNotification?.('复制失败', 'error'),
    );
  };
  /** 哪些 tab 启用了详情侧栏（renderSysPanel 据此决定是否包裹 .sys-view） */
  w.__sysDetailTabs = new Set(Object.keys(PROVIDERS));
}

registerSysDetailHandlers();
