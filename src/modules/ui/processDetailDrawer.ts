/**
 * 进程详情抽屉 (Process Detail Drawer)
 *
 * 点击进程行后从右侧滑出，展示基本信息、完整命令、网络连接、文件路径，
 * 以及复制 / 终止 / 加入处置等操作。同时提供进程风险评分（外联 / 下载执行 /
 * 反弹Shell / 伪装 等），供进程表格与统计 chips 复用。
 */

import { invoke } from '@tauri-apps/api/core';
import { showConfirm } from './confirmDialog';

// ─────────────────────────── 风险评分 ───────────────────────────

export interface ProcessRisk {
  level: 'high' | 'warn' | 'normal';
  tags: string[];
}

const SUSPICIOUS_PATHS = ['/tmp/', '/var/tmp/', '/dev/shm/', '/run/shm/'];
const DOWNLOAD_EXEC_RE = /\b(curl|wget|fetch|tftp)\b[^\n]*?(\||;|&&|`|\$\()[^\n]*?\b(sh|bash|zsh|python[0-9]?|perl|ruby|php|node)\b/i;
const ENCODED_EXEC_RE = /\bbase64\b[^\n]*-d[^\n]*\|\s*(sh|bash|python)/i;
const REVSHELL_RE = /(\/dev\/(tcp|udp)\/|\bnc\b[^\n]*\s-e|\bncat\b[^\n]*\s-e|\bbash\b\s+-i|\bsh\b\s+-i|python[0-9]?\s+-c[^\n]*socket|perl\s+-e[^\n]*[Ss]ocket|mkfifo[^\n]*\|)/i;
const MASQUERADE_RE = /(kworker|kthreadd?|kswapd|ksoftirqd|migration|rcu_|systemd|dbus|crond?|sshd|nginx|mysqld)/i;

/** 判断远程地址是否为外部（公网）地址 */
function isExternalRemote(foreign: string): boolean {
  if (!foreign) return false;
  let ip = foreign.trim();
  // strip trailing :port (handle IPv6 [::1]:443 and v4 1.2.3.4:443)
  const m6 = ip.match(/^\[([^\]]+)\]/);
  if (m6) ip = m6[1];
  else if (ip.includes(':') && ip.split(':').length === 2) ip = ip.split(':')[0];
  if (!ip || ip === '*' || ip === '0.0.0.0' || ip === '::') return false;
  if (ip.startsWith('127.') || ip === '::1') return false;
  if (/^10\./.test(ip)) return false;
  if (/^192\.168\./.test(ip)) return false;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return false;
  if (/^169\.254\./.test(ip)) return false;
  if (/^(fe80|fc|fd)/i.test(ip)) return false;
  return true;
}

/** 按 pid 分组网络连接 */
export function buildNetByPid(networkDetails: any[]): Map<string, any[]> {
  const map = new Map<string, any[]>();
  (networkDetails || []).forEach((c) => {
    const pid = String(c.pid || '').trim();
    if (!pid || pid === '-') return;
    if (!map.has(pid)) map.set(pid, []);
    map.get(pid)!.push(c);
  });
  return map;
}

const isEstablished = (s: string) => s === 'ESTABLISHED' || s === 'ESTAB';

/** 给单个进程评分 */
export function scoreProcessRisk(p: any, conns: any[] = []): ProcessRisk {
  const cmd = p?.command || '';
  const tags: string[] = [];

  const inSusPath = SUSPICIOUS_PATHS.some((s) => cmd.includes(s));
  const downloadExec = DOWNLOAD_EXEC_RE.test(cmd) || ENCODED_EXEC_RE.test(cmd);
  const revShell = REVSHELL_RE.test(cmd);
  const external = (conns || []).some((c) => isEstablished(c.state) && isExternalRemote(c.foreignAddress));
  const masquerade = inSusPath && MASQUERADE_RE.test(cmd);

  if (external) tags.push('外联');
  if (downloadExec) tags.push('下载执行');
  if (revShell) tags.push('反弹Shell');
  if (masquerade) tags.push('伪装');
  if (inSusPath && !downloadExec && !revShell && !masquerade) tags.push('可疑路径');

  let level: ProcessRisk['level'] = 'normal';
  if (revShell || downloadExec || masquerade || (external && inSusPath)) level = 'high';
  else if (external || inSusPath) level = 'warn';

  return { level, tags };
}

// ─────────────────────────── 格式化 ───────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

/** 服务器当前时间（毫秒）：用进程采集时记录的服务器时钟偏移校正本地时钟 */
function serverNowMs(): number {
  const skew = (typeof window !== 'undefined' && (window as any).__siServerSkewMs) || 0;
  return Date.now() + skew;
}

export function fmtDuration(sec: number): string {
  if (!sec || sec < 0) return '-';
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return d > 0 ? `${d}天 ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/** 表格用启动时间：今日显示 HH:MM:SS，否则 MM-DD HH:MM（客户端时钟近似） */
export function fmtStartShort(etimes: number): string {
  if (!etimes || etimes < 0) return '-';
  const d = new Date(serverNowMs() - etimes * 1000);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtStartFull(etimes: number): string {
  if (!etimes || etimes < 0) return '-';
  const d = new Date(serverNowMs() - etimes * 1000);
  const now = new Date();
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  if (d.toDateString() === now.toDateString()) return hm;
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`;
}

const STAT_LABEL: Record<string, string> = {
  R: '运行', S: '睡眠', D: '不可中断', Z: '僵尸', T: '停止', t: '跟踪', I: '空闲', X: '死亡',
};
export function statText(stat: string): string {
  const c = (stat || '').charAt(0);
  return STAT_LABEL[c] ? `${stat} (${STAT_LABEL[c]})` : (stat || '-');
}

function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 命令行首个 token（近似可执行路径） */
function firstToken(cmd: string): string {
  const c = (cmd || '').trim();
  if (c.startsWith('[')) return c; // 内核线程 [kworker/0:0]
  return c.split(/\s+/)[0] || '-';
}

// ─────────────────────────── 图标 ───────────────────────────

const I_COPY = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>`;
const I_KILL = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15 9l-6 6M9 9l6 6"/></svg>`;
const I_SHIELD = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3 8-8 9-5-1-8-4.5-8-9V6z"/></svg>`;

// ─────────────────────────── 抽屉渲染 ───────────────────────────

function kvRow(k: string, v: string, id?: string): string {
  return `<div class="pd-k">${k}</div><div class="pd-v"${id ? ` id="${id}"` : ''}>${v}</div>`;
}

/** 详情主体（注入常驻侧栏的 #proc-side-body） */
function detailBodyHTML(p: any, conns: any[], risk: ProcessRisk, etimes: number): string {
  const badge =
    risk.level === 'high' ? '<span class="pd-rbadge high">高风险</span>'
    : risk.level === 'warn' ? '<span class="pd-rbadge warn">可疑</span>'
    : '<span class="pd-rbadge ok">正常</span>';
  const tags = risk.tags.map((t) => `<span class="pd-tag ${t === '外联' ? 'ext' : ''}">${esc(t)}</span>`).join('');
  const exe = firstToken(p.command);

  const netRows = conns.length
    ? `<table class="pd-net">
         <thead><tr><th>本地地址</th><th>远程地址</th><th>状态</th><th>协议</th></tr></thead>
         <tbody>${conns.map((c) => `
           <tr>
             <td>${esc(c.localAddress)}</td>
             <td>${esc(c.foreignAddress)}</td>
             <td><span class="pd-net-state ${isEstablished(c.state) ? 'est' : ''}">${esc(c.state)}</span></td>
             <td>${esc((c.protocol || '').toUpperCase())}</td>
           </tr>`).join('')}
         </tbody>
       </table>`
    : '<div class="pd-empty">无网络连接</div>';

  return `
    <div class="pd-id">
      <span class="pd-dot ${risk.level}"></span>
      <span class="pd-pid">${esc(p.pid)}</span>
      ${badge}
      ${tags}
    </div>

    <div class="pd-section">基本信息</div>
    <div class="pd-kv">
      ${kvRow('用户', esc(p.user))}
      ${kvRow('父进程', esc(p.ppid || '-'), 'pd-parent')}
      ${kvRow('状态', `<span class="pd-state-dot ${(p.stat || '').charAt(0)}"></span>${esc(statText(p.stat))}`)}
      ${kvRow('启动时间', fmtStartFull(etimes))}
      ${kvRow('运行时长', fmtDuration(etimes))}
      ${kvRow('优先级', '-', 'pd-prio')}
      ${kvRow('工作目录', '-', 'pd-cwd')}
      ${kvRow('进程组', '-', 'pd-pgid')}
      ${kvRow('会话', '-', 'pd-sid')}
      ${kvRow('线程数', '-', 'pd-threads')}
    </div>

    <div class="pd-section">完整命令</div>
    <div class="pd-code">
      <code>${esc(p.command)}</code>
      <button class="pd-copy" title="复制" data-copy="${esc(p.command)}" onclick="window.pdCopy(this)">${I_COPY}</button>
    </div>

    <div class="pd-section">网络连接 (${conns.length})</div>
    ${netRows}

    <div class="pd-section">文件路径</div>
    <div class="pd-code">
      <code id="pd-exe">${esc(exe)}</code>
      <button class="pd-copy" title="复制" data-copy="${esc(exe)}" onclick="window.pdCopy(this)">${I_COPY}</button>
    </div>

    <div class="pd-section">调查操作</div>
    <div class="sd-actions">
      ${PROC_ACTS.map(([a, l]) => `<button class="sd-act" onclick="window.procAct('${a}','${esc(p.pid)}')">${l}</button>`).join('')}
    </div>
  `;
}

/** 进程详情里可一键执行的调查项（复用 ProcessContextMenu 的命令/结果弹窗） */
const PROC_ACTS: Array<[string, string]> = [
  ['exe', '可执行路径'], ['cwd', '当前目录'], ['cmdline', '命令行'], ['status', '进程状态'],
  ['fd', '打开文件'], ['maps', '内存映射'], ['limits', '资源限制'], ['network', '网络连接'],
  ['ports', '监听端口'], ['pstree', '进程树'], ['children', '子进程'], ['environ', '环境变量'],
  ['io', 'I/O 统计'], ['namespaces', '命名空间'], ['cgroup', 'Cgroup'], ['container', '容器检测'],
  ['suspicious-path', '可疑路径'], ['ld-preload', 'LD_PRELOAD'], ['deleted-exe', '已删除 exe'],
  ['suspicious-network', '可疑网络'], ['crypto-mining', '挖矿检测'], ['hidden-process', '隐藏进程'],
];

/** 底部操作（注入 #proc-side-foot） */
function footActionsHTML(pid: string): string {
  return `
    <button class="pd-action" onclick="window.copyProcessInfo('${esc(pid)}')">${I_COPY} 复制信息</button>
    <button class="pd-action danger" onclick="window.killProcessFromDrawer('${esc(pid)}')">${I_KILL} 终止进程</button>
    <button class="pd-action primary" onclick="window.addProcessToHandling('${esc(pid)}')">${I_SHIELD} 加入处置</button>
  `;
}

/** 在右侧常驻详情侧栏中展示某个进程的详情 */
export function openProcessDrawer(pid: string): void {
  const cache = (window as any).systemInfoCache;
  const procs = cache?.detailedInfo?.processes || [];
  const net = cache?.detailedInfo?.networkDetails || [];
  const p = procs.find((x: any) => String(x.pid) === String(pid));
  if (!p) return;

  const conns = (net || []).filter((c: any) => String(c.pid) === String(pid));
  const risk = scoreProcessRisk(p, conns);
  const etimes = parseInt(p.etimes || '0', 10) || 0;

  // 高亮当前行
  document.querySelectorAll('#processes-table-body tr').forEach((r) => r.classList.remove('selected'));
  document.querySelector(`#processes-table-body tr[data-pid="${CSS.escape(String(pid))}"]`)?.classList.add('selected');

  const body = document.getElementById('proc-side-body');
  if (!body) return;
  body.innerHTML = detailBodyHTML(p, conns, risk, etimes);
  const foot = document.getElementById('proc-side-foot');
  if (foot) foot.innerHTML = footActionsHTML(String(pid));

  // 选中进程时自动展开侧栏（若用户之前收起了）
  const side = document.getElementById('proc-side');
  if (side?.classList.contains('collapsed')) {
    side.classList.remove('collapsed');
    try { localStorage.setItem('proc-side-collapsed', 'false'); } catch { /* ignore */ }
  }

  void fetchExtended(String(pid));
}

/** 收起 / 展开右侧详情侧栏 */
function toggleProcSide(): void {
  const side = document.getElementById('proc-side');
  if (!side) return;
  const collapsed = side.classList.toggle('collapsed');
  try { localStorage.setItem('proc-side-collapsed', collapsed ? 'true' : 'false'); } catch { /* ignore */ }
}

/** 异步拉取扩展信息（父进程名 / 优先级 / cwd / pgid / sid / 线程 / exe） */
async function fetchExtended(pid: string): Promise<void> {
  const p = pid.replace(/[^0-9]/g, '');
  if (!p) return;
  const cmd =
    `echo "PPID:$(ps -o ppid= -p ${p} 2>/dev/null | tr -d ' ')";` +
    `echo "PNAME:$(ps -o comm= -p $(ps -o ppid= -p ${p} 2>/dev/null | tr -d ' ') 2>/dev/null)";` +
    `echo "PGID:$(ps -o pgid= -p ${p} 2>/dev/null | tr -d ' ')";` +
    `echo "SID:$(ps -o sess= -p ${p} 2>/dev/null | tr -d ' ')";` +
    `echo "PRI:$(ps -o pri= -p ${p} 2>/dev/null | tr -d ' ')";` +
    `echo "THREADS:$(ps -o nlwp= -p ${p} 2>/dev/null | tr -d ' ')";` +
    `echo "CWD:$(readlink /proc/${p}/cwd 2>/dev/null)";` +
    `echo "EXE:$(readlink /proc/${p}/exe 2>/dev/null)"`;
  try {
    const res = (await invoke('ssh_execute_dashboard_command_direct', { command: cmd })) as { output: string };
    const out = res?.output || '';
    const get = (k: string) => (out.match(new RegExp(`^${k}:(.*)$`, 'm'))?.[1] || '').trim();
    const set = (id: string, v: string) => { const el = document.getElementById(id); if (el && v) el.textContent = v; };

    const ppid = get('PPID');
    const pname = get('PNAME');
    if (ppid) set('pd-parent', pname ? `${pname} (${ppid})` : ppid);
    set('pd-prio', get('PRI'));
    set('pd-cwd', get('CWD'));
    set('pd-pgid', get('PGID'));
    set('pd-sid', get('SID'));
    set('pd-threads', get('THREADS'));
    const exe = get('EXE');
    if (exe) {
      const el = document.getElementById('pd-exe');
      if (el) { el.textContent = exe; const btn = el.parentElement?.querySelector('.pd-copy') as HTMLElement; if (btn) btn.setAttribute('data-copy', exe); }
    }
  } catch {
    /* 离线 / 无后端：保留基础信息占位 */
  }
}

// ─────────────────────────── 操作处理 ───────────────────────────

function notify(msg: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  (window as any).showNotification?.(msg, type);
}

async function copyText(text: string): Promise<void> {
  try { await navigator.clipboard.writeText(text); notify('已复制', 'success'); }
  catch { notify('复制失败', 'error'); }
}

function registerHandlers(): void {
  const w = window as any;
  w.toggleProcSide = toggleProcSide;
  w.openProcessDrawer = openProcessDrawer;

  w.pdCopy = (btn: HTMLElement) => { void copyText(btn.getAttribute('data-copy') || ''); };

  // 进程调查操作：复用 ProcessContextMenu 的命令执行 + 结果弹窗
  w.procAct = (action: string, pid: string) => {
    const menu = (window as any).__sysMenus?.process;
    if (menu?.runAction) void menu.runAction(action, String(pid));
    else (window as any).showNotification?.('该操作暂不可用', 'warning');
  };

  w.copyProcessInfo = (pid: string) => {
    const cache = w.systemInfoCache;
    const p = (cache?.detailedInfo?.processes || []).find((x: any) => String(x.pid) === String(pid));
    if (!p) return;
    const conns = (cache?.detailedInfo?.networkDetails || []).filter((c: any) => String(c.pid) === String(pid));
    const risk = scoreProcessRisk(p, conns);
    const lines = [
      `PID: ${p.pid}`,
      `PPID: ${p.ppid || '-'}`,
      `用户: ${p.user}`,
      `状态: ${statText(p.stat)}`,
      `CPU: ${p.cpu}%  内存: ${p.memory}%`,
      `运行时长: ${fmtDuration(parseInt(p.etimes || '0', 10) || 0)}`,
      `风险: ${risk.level}${risk.tags.length ? ' [' + risk.tags.join(', ') + ']' : ''}`,
      `命令: ${p.command}`,
    ];
    if (conns.length) {
      lines.push('网络连接:');
      conns.forEach((c: any) => lines.push(`  ${c.localAddress} -> ${c.foreignAddress} ${c.state} ${c.protocol}`));
    }
    void copyText(lines.join('\n'));
  };

  w.killProcessFromDrawer = async (pid: string) => {
    const p = pid.replace(/[^0-9]/g, '');
    if (!p) return;
    const ok = await showConfirm({
      title: '终止进程',
      message: `确定要终止进程 ${p} 吗？此操作会向其发送 SIGKILL。`,
      confirmText: '终止', cancelText: '取消', dangerous: true,
    });
    if (!ok) return;
    try {
      await invoke('ssh_execute_dashboard_command_direct', { command: `kill -9 ${p} 2>&1` });
      notify(`已发送终止信号到进程 ${p}`, 'success');
      const body = document.getElementById('proc-side-body');
      if (body) body.innerHTML = '<div class="proc-side-empty"><p>进程已终止</p></div>';
      const foot = document.getElementById('proc-side-foot');
      if (foot) foot.innerHTML = '';
      document.querySelectorAll('#processes-table-body tr.selected').forEach((r) => r.classList.remove('selected'));
      setTimeout(() => (window as any).refreshAllSystemInfo?.(), 400);
    } catch (e) {
      notify(`终止进程失败: ${e}`, 'error');
    }
  };

  w.addProcessToHandling = (pid: string) => {
    const cache = w.systemInfoCache;
    const p = (cache?.detailedInfo?.processes || []).find((x: any) => String(x.pid) === String(pid));
    if (!p) return;
    try {
      const raw = localStorage.getItem('handling-list');
      const list = raw ? JSON.parse(raw) : [];
      if (!list.some((x: any) => String(x.pid) === String(pid))) {
        list.push({ pid: p.pid, user: p.user, command: p.command, addedAt: Date.now() });
        localStorage.setItem('handling-list', JSON.stringify(list));
      }
      notify(`进程 ${pid} 已加入处置清单`, 'success');
    } catch {
      notify('加入处置失败', 'error');
    }
  };
}

registerHandlers();
