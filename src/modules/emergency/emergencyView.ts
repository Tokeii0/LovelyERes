/**
 * 应急命令库页 — 纯渲染 + 输出解析（供 emergencyRenderer 初次渲染 & emergencyPageManager 交互更新复用）
 *
 * 布局：命令分类列 + 检查项列 + 详情(命令框/操作/Tab/统计/结果表) + 发现详情面板。
 * 发现(findings)复用 outputHighlightRules.matchLine + 常见 SUID 二进制风险表。
 */

import { emergencyCategories, type EmergencyCategory, type EmergencyCommand } from './commands';
import { matchLine } from './outputHighlightRules';

// ─────────────────────────── 工具 ───────────────────────────

export function esc(s: any): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function getCmdString(cmd: EmergencyCommand): string {
  return cmd.cmd || cmd.commands?.default || '';
}

/** 从命令文本启发式推断元数据：只读 / 需root / 预计耗时 */
export function deriveMeta(cmdStr: string): { readonly: boolean; needRoot: boolean; est: string } {
  const c = cmdStr || '';
  // 重定向到真实文件视为写操作，但排除 2>/dev/null、>/dev/null 等无害的丢弃重定向
  const writeOps = /\b(rm|mv|cp|chmod|chown|chattr|truncate|dd|mkfs|kill|pkill|userdel|usermod|groupadd|tee)\b|sed\s+-i|systemctl\s+(start|stop|restart|disable|enable|mask)|iptables\s+-[AIDF]|ufw\s+(allow|deny|delete)|passwd\s+\S|(?:>>?|&>)\s*\/(?!dev\/(?:null|stderr|stdout)\b)/.test(c);
  const readonly = !writeOps;
  const needRoot = /(\/etc\/shadow|\/etc\/sudoers|\/etc\/gshadow|\/root\/|\/proc\/\d+\/|find\s+\/\s|auditctl|dmesg|journalctl|iptables\s+-[LS]|ss\s+-|netstat|lsof|tcpdump|debsums|rpm\s+-V)/.test(c);
  let est = '约1秒';
  if (/find\s+\/\s/.test(c) && !/-maxdepth/.test(c)) est = c.length > 110 ? '较慢' : '约3秒';
  else if (/find\s+\//.test(c)) est = '约2秒';
  else if (/(journalctl|dmesg|ausearch|\blast\b|\blastb\b|rpm\s+-V|debsums)/.test(c)) est = '约2秒';
  return { readonly, needRoot, est };
}

// ─────────────────────────── 分类图标 ───────────────────────────

const ic = (path: string) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
const CATEGORY_ICONS: Record<string, string> = {
  permissions: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
  baseline: ic('<path d="M12 3l8 3v6c0 4.5-3 8-8 9-5-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  network: ic('<circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v4M12 11l-5 6M12 11l5 6"/>'),
  system: ic('<path d="M12 3l8 3v6c0 4.5-3 8-8 9-5-1-8-4.5-8-9V6z"/>'),
  logging: ic('<path d="M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v6h6M8 13h8M8 17h6"/>'),
  container: ic('<path d="M12 3l8 4v10l-8 4-8-4V7z"/><path d="M4 7l8 4 8-4M12 11v10"/>'),
  'quick-scan': ic('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  'privilege-escalation': ic('<path d="M12 19V5M5 12l7-7 7 7"/>'),
  'threat-detection': ic('<path d="M12 3l9 16H3z"/><path d="M12 10v4M12 17.5v.5"/>'),
  persistence: ic('<circle cx="12" cy="5" r="2"/><path d="M12 7v14M5 14a7 7 0 0 0 14 0"/>'),
  webapp: ic('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'),
  credentials: ic('<circle cx="8" cy="12" r="4"/><path d="M12 12h9M17 12v4M21 12v3"/>'),
  hardening: ic('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
};
const catIcon = (id: string) => CATEGORY_ICONS[id] || CATEGORY_ICONS.system;

const I_STAR = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5 6 .5-4.5 4 1.4 6L12 16l-5.4 3 1.4-6L3.5 9l6-.5z"/></svg>';
const I_COPY = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';

export function findCategory(catId: string): EmergencyCategory | undefined {
  return emergencyCategories.find(c => c.id === catId);
}
export function findCommand(cmdId: string): { cat: EmergencyCategory; cmd: EmergencyCommand } | undefined {
  for (const cat of emergencyCategories) {
    const cmd = cat.items.find(i => i.id === cmdId);
    if (cmd) return { cat, cmd };
  }
  return undefined;
}

// ─────────────────────────── 命令分类列 ───────────────────────────

export function renderCatsColumn(activeCatId: string): string {
  const items = emergencyCategories.map(cat => `
    <button class="em-cat-item${cat.id === activeCatId ? ' active' : ''}" type="button" data-em-cat="${cat.id}" title="${esc(cat.title)}">
      <span class="em-cat-icon">${catIcon(cat.id)}</span>
      <span class="em-cat-name">${esc(cat.title)}</span>
      <span class="em-cat-count">${cat.items.length}</span>
    </button>`).join('');
  return `
    <div class="em-col-head">
      <span>命令分类</span>
      <button class="em-col-head-btn" title="筛选"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 5h18l-7 8v6l-4-2v-4z"/></svg></button>
    </div>
    <div class="em-cat-list">${items}</div>`;
}

// ─────────────────────────── 检查项列 ───────────────────────────

export function renderCheckCard(cmd: EmergencyCommand, active: boolean): string {
  const meta = deriveMeta(getCmdString(cmd));
  const rootBadge = meta.needRoot
    ? '<span class="em-check-badge root">需root</span>'
    : '<span class="em-check-badge ro">只读</span>';
  return `
    <button class="em-check-card${active ? ' active' : ''}" type="button" data-em-id="${cmd.id}" title="${esc(cmd.desc || cmd.name)}">
      <div class="em-check-main">
        <div class="em-check-name">${esc(cmd.name)}</div>
        <div class="em-check-desc">${esc(cmd.desc || '')}</div>
        <div class="em-check-badges">
          ${rootBadge}
          <span class="em-check-badge time">${meta.est}</span>
        </div>
      </div>
      <span class="em-check-star" data-em-fav="${cmd.id}" title="收藏">${I_STAR}</span>
    </button>`;
}

export function renderChecksColumn(catId: string, activeCmdId: string): string {
  const cat = findCategory(catId);
  if (!cat) return '';
  const cards = cat.items.map(cmd => renderCheckCard(cmd, cmd.id === activeCmdId)).join('');
  return `
    <div class="em-col-head">
      <span>${esc(cat.title)}</span>
      <span class="em-col-head-sub">${cat.items.length} 个检查项</span>
    </div>
    <div class="em-check-list">${cards}</div>`;
}

export function renderFavoritesColumn(cmds: EmergencyCommand[], activeCmdId: string): string {
  const cards = cmds.map(cmd => renderCheckCard(cmd, cmd.id === activeCmdId)).join('');
  return `
    <div class="em-col-head">
      <span>我的收藏</span>
      <span class="em-col-head-sub">${cmds.length} 项</span>
    </div>
    <div class="em-check-list">${cards || '<div class="em-notrun">暂无收藏</div>'}</div>`;
}

// ─────────────────────────── 详情壳 ───────────────────────────

export function emptyDetail(): string {
  return `
    <div class="em-empty">
      <div class="em-empty-icon"><svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></div>
      <p>从左侧选择一个检查项</p>
    </div>`;
}

export function renderDetailShell(catTitle: string, cmd: EmergencyCommand, cmdStr: string): string {
  const meta = deriveMeta(cmdStr);
  return `
    <div class="em-detail-inner">
      <div class="em-bc">
        <button class="em-bc-back" type="button" data-em-back="1" title="返回">←</button>
        <span>${esc(catTitle)}</span><span class="em-bc-sep">/</span><span class="em-bc-cur">${esc(cmd.name)}</span>
      </div>

      <div class="em-detail-head">
        <div class="em-detail-headleft">
          <h2 class="em-title">${esc(cmd.name)}</h2>
          <p class="em-subtitle">${esc(cmd.desc || '')}</p>
        </div>
        <div class="em-detail-headright">
          <span class="em-exec-status" id="em-exec-status"></span>
          <div class="em-meta-badges">
            <span class="em-mb ${meta.readonly ? 'ro' : 'rw'}">${meta.readonly ? '只读' : '可写'}</span>
            <span class="em-mb risk-low">低风险</span>
            <span class="em-mb time">${meta.est}</span>
          </div>
        </div>
      </div>

      <div class="em-cmdbox">
        <span class="em-cmd-ln">1</span>
        <code class="em-cmd-code" id="em-cmd-code" contenteditable="false">${esc(cmdStr)}</code>
        <button class="em-cmd-copy" id="em-btn-copy" title="复制命令">${I_COPY}</button>
      </div>

      <div class="em-detail-actions">
        <button class="em-action-btn primary" id="em-btn-execute"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>执行检查</button>
        <button class="em-action-btn" id="em-btn-edit">编辑参数</button>
        <button class="em-action-btn" id="em-btn-copy2">复制命令</button>
        <button class="em-action-btn" id="em-btn-ai">查看说明</button>
      </div>

      <div class="em-readonly-banner ${meta.readonly ? '' : 'rw'}">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l8 3v6c0 4.5-3 8-8 9-5-1-8-4.5-8-9V6z"/></svg>
        <span>${meta.readonly ? '只读命令，不会修改远程系统' : '该命令可能修改远程系统，请谨慎执行'}</span>
      </div>

      <div class="em-tabs">
        <button class="em-tab active" type="button" data-em-tab="findings">分析结果 <span class="em-tab-count" id="em-tabc-findings">0</span></button>
        <button class="em-tab" type="button" data-em-tab="raw">原始输出 <span class="em-tab-count" id="em-tabc-raw">0</span></button>
        <button class="em-tab" type="button" data-em-tab="info">执行信息</button>
        <div class="em-tab-tools">
          <div class="em-tab-search"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><input id="em-find-search" placeholder="搜索结果..." oninput="window.emergencyPageManager?.filterFindings(this.value)"></div>
          <button class="em-tab-tool" id="em-btn-export" title="导出">导出</button>
          <button class="em-tab-tool icon" title="更多">⋮</button>
        </div>
      </div>

      <div class="em-tab-body">
        <div class="em-tabpane" id="em-pane-findings">
          <div class="em-notrun">点击「执行检查」获取分析结果</div>
        </div>
        <div class="em-tabpane" id="em-pane-raw" style="display:none;"><pre class="em-output-content" id="em-output-content"></pre></div>
        <div class="em-tabpane" id="em-pane-info" style="display:none;"><div class="em-info-empty">尚未执行</div></div>
      </div>
    </div>`;
}

// ─────────────────────────── 输出解析（findings） ───────────────────────────

export interface Finding {
  risk: 'high' | 'attention' | 'normal';
  path: string;
  owner: string;
  perms: string;
  desc: string;
  raw: string;
}

// 常见 SUID 二进制风险表（覆盖率优先于穷举）
const SUID_RISK: Record<string, { risk: Finding['risk']; desc: string }> = {
  pkexec: { risk: 'high', desc: 'CVE-2021-4034' },
  nmap: { risk: 'high', desc: '可交互提权' },
  find: { risk: 'high', desc: '-exec 提权' },
  vim: { risk: 'high', desc: ':!sh 提权' },
  vi: { risk: 'high', desc: ':!sh 提权' },
  python: { risk: 'high', desc: 'os.system 提权' },
  python3: { risk: 'high', desc: 'os.system 提权' },
  perl: { risk: 'high', desc: 'exec 提权' },
  bash: { risk: 'high', desc: '-p 提权' },
  sh: { risk: 'high', desc: '-p 提权' },
  awk: { risk: 'high', desc: "'system' 提权" },
  passwd: { risk: 'attention', desc: '系统默认' },
  su: { risk: 'attention', desc: '检查使用记录' },
  mount: { risk: 'normal', desc: '系统默认' },
  umount: { risk: 'normal', desc: '系统默认' },
  sudo: { risk: 'normal', desc: '系统默认' },
  chfn: { risk: 'normal', desc: '系统默认' },
  chsh: { risk: 'normal', desc: '系统默认' },
  newgrp: { risk: 'normal', desc: '系统默认' },
  gpasswd: { risk: 'normal', desc: '系统默认' },
  ping: { risk: 'normal', desc: '系统默认' },
};

const LS_RE = /^([-dlbcps][rwxsStT@.+-]{9})[+@.]?\s+\d+\s+(\S+)\s+(\S+)\s+\S+\s+.*?\s(\/\S.*?)\s*$/;

export function parseFindings(output: string): { findings: Finding[]; stats: { total: number; normal: number; attention: number; high: number } } {
  const lines = (output || '').split('\n')
    .map(l => l.replace(/\r$/, ''))
    .filter(l => l.trim() && !/^\[.*\]\s*$/.test(l.trim()) && !/^\(无输出\)$/.test(l.trim()));
  const findings: Finding[] = [];
  let high = 0, attention = 0, normal = 0;

  for (const line of lines) {
    let perms = '-', owner = '-', path = line.trim();
    const m = line.match(LS_RE);
    if (m) { perms = m[1]; owner = `${m[2]}:${m[3]}`; path = m[4]; }
    else {
      const toks = line.trim().split(/\s+/);
      const last = toks[toks.length - 1];
      if (last && last.startsWith('/')) path = last;
    }

    let risk: Finding['risk'] = 'normal';
    let desc = '系统默认';

    const base = path.split('/').pop() || '';
    const known = SUID_RISK[base];
    if (known) { risk = known.risk; desc = known.desc; }
    else {
      const rule = matchLine(line);
      if (rule) {
        desc = rule.label || rule.description || '';
        if (rule.level === 'critical') risk = 'high';
        else if (rule.level === 'warning' || rule.level === 'info') risk = 'attention';
        else risk = 'normal';
      } else {
        risk = 'normal';
        desc = '系统默认';
      }
    }

    if (risk === 'high') high++; else if (risk === 'attention') attention++; else normal++;
    findings.push({ risk, path, owner, perms, desc, raw: line });
  }

  return { findings, stats: { total: findings.length, normal, attention, high } };
}

// ─────────────────────────── 分析结果 Tab（chips + 表格） ───────────────────────────

const RISK_LABEL: Record<Finding['risk'], string> = { high: '高风险', attention: '需关注', normal: '正常' };

export function renderFindingsPane(findings: Finding[], stats: { total: number; normal: number; attention: number; high: number }): string {
  if (!findings.length) {
    return `<div class="em-notrun">无分析结果</div>`;
  }
  const chips = `
    <div class="em-chips">
      <div class="em-chip"><span class="em-chip-label">发现</span><span class="em-chip-val">${stats.total}<small>项</small></span></div>
      <div class="em-chip ok"><span class="em-chip-label">正常</span><span class="em-chip-val">${stats.normal}</span></div>
      <div class="em-chip warn"><span class="em-chip-label">需关注</span><span class="em-chip-val">${stats.attention}</span></div>
      <div class="em-chip high"><span class="em-chip-label">高风险</span><span class="em-chip-val">${stats.high}</span></div>
    </div>`;

  const rows = findings.map((f, i) => `
    <tr class="em-find-row" data-em-find="${i}" data-risk="${f.risk}">
      <td class="em-fc-risk"><span class="em-risk-tag ${f.risk}">${RISK_LABEL[f.risk]}</span></td>
      <td class="em-fc-path" title="${esc(f.path)}">${esc(f.path)}</td>
      <td class="em-fc-owner">${esc(f.owner)}</td>
      <td class="em-fc-perms">${esc(f.perms)}</td>
      <td class="em-fc-desc">${f.risk === 'high' ? `<span class="em-desc-tag">${esc(f.desc)}</span>` : esc(f.desc)}</td>
      <td class="em-fc-ops">
        <button class="em-find-op" data-em-find-detail="${i}" title="查看发现详情">详情</button>
        <button class="em-find-op" data-em-find-add="${i}" title="加入调查清单">调查</button>
      </td>
    </tr>`).join('');

  return `
    ${chips}
    <div class="em-find-table-wrap">
      <table class="em-find-table">
        <thead><tr><th class="em-fc-risk">风险</th><th class="em-fc-path">路径</th><th class="em-fc-owner">所有者</th><th class="em-fc-perms">权限</th><th class="em-fc-desc">说明</th><th class="em-fc-ops">操作</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ─────────────────────────── 执行信息 Tab ───────────────────────────

export function renderInfoPane(cmdStr: string, exitCode: number | null, durationMs: number, account: string): string {
  const kv = (k: string, v: string) => `<div class="em-info-k">${k}</div><div class="em-info-v">${esc(v)}</div>`;
  return `
    <div class="em-info-kv">
      ${kv('执行账户', account || 'root')}
      ${kv('退出码', exitCode === null ? '-' : String(exitCode))}
      ${kv('耗时', durationMs > 0 ? `${(durationMs / 1000).toFixed(2)} 秒` : '-')}
      ${kv('命令', cmdStr)}
    </div>`;
}

// ─────────────────────────── 发现详情面板 ───────────────────────────

export function renderFindingPanel(f: Finding | null): string {
  if (!f) {
    return `<div class="em-finding-empty"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg><p>选择一项发现查看详情</p></div>`;
  }
  const advice = f.risk === 'high'
    ? ['确认软件包版本', '检查异常调用记录', '评估升级或隔离']
    : f.risk === 'attention'
    ? ['核对是否系统默认', '检查最近修改记录', '比对已知基线']
    : ['系统默认项，无需处理'];
  return `
    <div class="em-finding-head">
      <span class="em-finding-title">发现详情</span>
    </div>
    <div class="em-finding-body">
      <div><span class="em-risk-tag ${f.risk}">${RISK_LABEL[f.risk]}</span></div>

      <div class="em-finding-section">文件信息</div>
      <div class="em-finding-kv">
        <div class="em-fk">路径</div><div class="em-fv">${esc(f.path)}</div>
        <div class="em-fk">所有者</div><div class="em-fv">${esc(f.owner)}</div>
        <div class="em-fk">权限</div><div class="em-fv">${esc(f.perms)}</div>
      </div>

      <div class="em-finding-section">风险说明</div>
      <p class="em-finding-text">${f.risk === 'high' ? `检测到可能受 ${esc(f.desc)} 影响的 ${esc(f.path.split('/').pop() || '')}` : esc(f.desc)}</p>

      <div class="em-finding-section">建议操作</div>
      <ul class="em-finding-advice">${advice.map(a => `<li>${esc(a)}</li>`).join('')}</ul>

      <div class="em-finding-section">关联操作</div>
      <div class="em-finding-rels">
        <button class="em-rel-btn" onclick="window.emergencyOpenTerminal && window.emergencyOpenTerminal('${esc(f.path)}')">打开终端</button>
        <button class="em-rel-btn" onclick="window.emergencyLocateFile && window.emergencyLocateFile('${esc(f.path)}')">定位文件</button>
      </div>
    </div>
    <div class="em-finding-foot">
      <button class="em-finding-add" onclick="window.emergencyAddFinding && window.emergencyAddFinding('${esc(f.path)}')">+ 加入调查</button>
    </div>`;
}
