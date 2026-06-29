/**
 * Shell 配置后门分析器
 *
 * 不再"只把可疑行抓出来"，而是对展示出来的完整 shell 配置逐行分析，
 * 协助用户在全文里定位潜在后门。规则按严重度排序，命中即返回。
 * 纯注释行不计入发现（已被注释 = 未生效），但仍会在查看器里展示（变暗）。
 */

export type ShellFindingLevel = 'high' | 'warning';

export interface ShellFinding {
  level: ShellFindingLevel;
  label: string;
}

interface Rule {
  re: RegExp;
  level: ShellFindingLevel;
  label: string;
}

// 顺序即优先级：越靠前越严重，命中即停。
const RULES: Rule[] = [
  { re: /\/dev\/(tcp|udp)\//i, level: 'high', label: '反弹Shell · /dev/tcp' },
  { re: /\bnc(at)?\b[^|\n]*\s-e\b/i, level: 'high', label: '反弹Shell · nc -e' },
  { re: /\b(bash|sh|zsh)\s+-i\b/i, level: 'high', label: '交互式反弹Shell' },
  { re: /\bmkfifo\b/i, level: 'high', label: '命名管道反弹' },
  { re: /\b(curl|wget|fetch)\b[^|\n]*\|\s*(sudo\s+)?(bash|sh|zsh|python[0-9.]*|perl|ruby|php)\b/i, level: 'high', label: '下载即执行 · 管道' },
  { re: /\bbase64\b\s*(-d|--decode|-D)\b|\bbase64\b[^|\n]*\|\s*(bash|sh)\b/i, level: 'high', label: 'Base64 解码执行' },
  { re: /\b(python[0-9.]*|perl|ruby|php)\b\s+-[ce]\b/i, level: 'high', label: '脚本内联执行' },
  { re: /\bLD_PRELOAD\b/i, level: 'high', label: 'LD_PRELOAD 注入' },
  { re: /(^|[\s;&])(source|\.)\s+(\/tmp\/|\/dev\/shm\/|\/var\/tmp\/)/i, level: 'high', label: '加载临时目录脚本' },
  { re: /\b(curl|wget|fetch)\b[^|\n]*\b(-o|-O|--output)\b/i, level: 'warning', label: '远程下载文件' },
  { re: /\beval\b/i, level: 'warning', label: 'eval 动态执行' },
  { re: /\bLD_LIBRARY_PATH\b/i, level: 'warning', label: 'LD_LIBRARY_PATH 篡改' },
  { re: /\bPROMPT_COMMAND\b/i, level: 'warning', label: 'PROMPT_COMMAND 持久化' },
  { re: /\btrap\b[^\n]*\bDEBUG\b/i, level: 'warning', label: 'trap DEBUG 持久化' },
  // 仅当别名定义里藏了链式/下载/临时目录命令才告警，避免误报常见的 `alias ls='ls --color'`
  { re: /\balias\s+\w+\s*=\s*["']?[^"'\n]*(;|&&|\|\||\||\$\(|`|\/tmp\/|\/dev\/shm\/|\/var\/tmp\/|\bcurl\b|\bwget\b|\bnc\b|base64)/i, level: 'warning', label: '别名藏命令' },
  { re: /\bexport\s+PATH=[^\n]*(^|[:=])(\.|\/tmp|\/dev\/shm|\/var\/tmp)/i, level: 'warning', label: 'PATH 注入可疑目录' },
  { re: /\bchattr\s+\+i\b/i, level: 'warning', label: '文件锁定 · 防删' },
  { re: /\b(crontab|at)\b[^\n]*(-|now|<<)/i, level: 'warning', label: '计划任务写入' },
  { re: /\/(tmp|dev\/shm|var\/tmp)\//i, level: 'warning', label: '引用可写临时目录' },
];

/** 分析单行 shell 配置内容；返回命中的最高优先级发现，或 null。注释行不计入。 */
export function analyzeShellLine(content: string): ShellFinding | null {
  const t = (content || '').trim();
  if (!t || t.startsWith('#')) return null;
  for (const r of RULES) {
    if (r.re.test(content)) return { level: r.level, label: r.label };
  }
  return null;
}

export interface ShellConfigFile {
  file: string;
  owner?: string;
  mtime?: string;
  lines: Array<{ num: number; content: string }>;
}

export interface ShellFileStats {
  high: number;
  warning: number;
  /** 命中行号 → 发现 */
  byLine: Map<number, ShellFinding>;
}

/** 统计某个文件内的发现 */
export function analyzeShellFile(f: ShellConfigFile): ShellFileStats {
  let high = 0, warning = 0;
  const byLine = new Map<number, ShellFinding>();
  for (const ln of f.lines || []) {
    const fd = analyzeShellLine(ln.content);
    if (fd) {
      byLine.set(ln.num, fd);
      if (fd.level === 'high') high++; else warning++;
    }
  }
  return { high, warning, byLine };
}
