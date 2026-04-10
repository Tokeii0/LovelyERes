/**
 * Check 审计管理器 (Check专武)
 * 劫持系统命令记录 check 脚本行为，逆向分析 check 逻辑
 */

import { invoke } from '@tauri-apps/api/core';
import { sshConnectionManager } from '../remote/sshConnectionManager';

// ──── 类型 ────

export type CaTab = 'hijack' | 'audit-log' | 'analysis' | 'quick-fix';
export type HijackStatus = 'original' | 'hijacked' | 'missing' | 'checking';

export interface HijackCommand {
  name: string;
  path: string;
  status: HijackStatus;
  origPath: string;
  custom: boolean;
}

export interface AuditLogEntry {
  timestamp: string;
  command: string;
  args: string;
  user: string;
  pid: number;
  ppid: number;
  caller: string;
  raw: string;
}

export interface CheckCycle {
  command: string;
  args: string;
  intervalSeconds: number | null;
  count: number;
  lastSeen: string;
  category: string;
}

export interface FixSuggestion {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
  checkCommand: string;
  fixCommand: string;
  category: string;
}

// ──── 常量 ────

const LOG_PATH = '/tmp/.cmd_audit.log';
// 默认只劫持 check 脚本最常用的：读文件 + shell 解释器 + 网络请求
const DEFAULT_COMMANDS = [
  'cat', 'head', 'tail', 'more', 'less',   // 读文件
  'grep', 'awk', 'sed',                     // 文本处理
  'bash', 'sh',                             // shell 解释器
  'curl', 'wget',                           // 网络请求
  'mysql', 'redis-cli', 'psql', 'mongo',    // 数据库客户端
];
const SUSPICIOUS_RE = [
  /flag/i, /\/etc\/passwd/, /\/etc\/shadow/, /\.ssh/,
  /secret/i, /token/i, /password/i, /key[_.]?file/i,
];
const LOG_LINE_RE = /^\[(.+?)\] CMD=(\S+) ARGS=(.*?) USER=(\S+) PID=(\d+) PPID=(\d+) CALLER=(.*)$/;

// ──── 管理器 ────

class CheckAuditManager {
  private isRoot = false;
  private currentTab: CaTab = 'hijack';
  private commands: HijackCommand[] = [];
  private logEntries: AuditLogEntry[] = [];
  private cycles: CheckCycle[] = [];
  private suggestions: FixSuggestion[] = [];

  private initialized = false;
  private eventsBound = false;
  private loading = false;
  private autoRefreshTimer: number | null = null;
  private autoRefreshEnabled = false;
  private refreshInterval = 5000;

  // ──── 生命周期 ────

  initialize(): void {
    if (!this.initialized) {
      this.bindEvents();
      this.initialized = true;
    }
    (window as any).__caManager = this;
    this.initCommands();
    this.renderContent();
    if (sshConnectionManager.isConnected()) {
      // 检测当前用户是否为 root
      this.exec('id -u').then(out => {
        this.isRoot = out.trim() === '0';
      });
      this.detectStatuses();
    }
  }

  deactivate(): void {
    this.stopAutoRefresh();
  }

  // ──── 事件 ────

  private bindEvents(): void {
    if (this.eventsBound) return;
    this.eventsBound = true;

    document.addEventListener('click', (e) => {
      const t = (e.target as HTMLElement).closest('[data-ca-action]') as HTMLElement;
      if (!t) return;
      const action = t.getAttribute('data-ca-action') || '';
      const param = t.getAttribute('data-ca-param') || '';

      switch (action) {
        case 'switch-tab': this.switchTab(param as CaTab); break;
        case 'refresh': this.detectStatuses(); break;
        case 'deploy-cmd': this.deployHijack(param); break;
        case 'restore-cmd': this.restoreCommand(param); break;
        case 'deploy-all': this.deployAll(); break;
        case 'restore-all': this.restoreAll(); break;
        case 'add-custom': this.addCustomCommand(); break;
        case 'remove-custom': this.removeCustomCommand(param); break;
        case 'refresh-log': this.refreshLog(); break;
        case 'toggle-auto': this.toggleAutoRefresh(); break;
        case 'set-interval': this.setRefreshInterval(parseInt(param)); break;
        case 'clear-log': this.clearLog(); break;
        case 'export-log': this.exportLog(); break;
        case 'run-analysis': this.runAnalysis(); break;
        case 'copy-cmd': this.copyText(param); break;
      }
    });
  }

  private switchTab(tab: CaTab): void {
    this.currentTab = tab;
    document.querySelectorAll('.ca-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-ca-action="switch-tab"][data-ca-param="${tab}"]`)?.classList.add('active');
    if (tab === 'audit-log' && this.logEntries.length === 0) this.refreshLog();
    this.renderContent();
  }

  // ──── SSH ────

  /** 需要 root 权限的命令：如果当前不是 root 则自动加 sudo */
  private priv(cmd: string): string {
    return this.isRoot ? cmd : `sudo ${cmd}`;
  }

  private async exec(cmd: string): Promise<string> {
    try {
      const r = await invoke('ssh_execute_command_direct', { command: cmd }) as any;
      return r?.output || '';
    } catch (e) {
      console.warn('SSH failed:', cmd, e);
      return '';
    }
  }

  // ──── 命令劫持 ────

  private initCommands(): void {
    if (this.commands.length > 0) return;
    this.commands = DEFAULT_COMMANDS.map(name => ({
      name, path: '', status: 'checking' as HijackStatus, origPath: '', custom: false,
    }));
  }

  async detectStatuses(): Promise<void> {
    this.loading = true;
    this.renderContent();
    const batchSize = 5;
    for (let i = 0; i < this.commands.length; i += batchSize) {
      const batch = this.commands.slice(i, i + batchSize);
      const names = batch.map(c => c.name).join(' ');
      const out = await this.exec(
        `for cmd in ${names}; do p=$(which $cmd 2>/dev/null); if [ -z "$p" ]; then echo "$cmd|MISSING|"; elif file "$p" 2>/dev/null | grep -qE "script|text"; then echo "$cmd|HIJACKED|$p"; else echo "$cmd|ORIGINAL|$p"; fi; done`
      );
      out.split('\n').filter(Boolean).forEach(line => {
        const parts = line.split('|');
        if (parts.length < 2) return;
        const [cname, status, path] = parts;
        const cmd = this.commands.find(c => c.name === cname);
        if (cmd) {
          cmd.status = (status === 'HIJACKED' ? 'hijacked' : status === 'ORIGINAL' ? 'original' : 'missing') as HijackStatus;
          cmd.path = path || '';
          cmd.origPath = path ? path + '_orig' : '';
        }
      });
    }
    this.loading = false;
    this.renderContent();
  }

  /**
   * 生成 wrapper 脚本内容
   * bash/sh 特殊处理: shebang 必须指向备份的原始解释器，否则无限递归
   */
  private buildWrapperContent(name: string, origPath: string): string {
    // bash/sh 被劫持后，wrapper 的 shebang 不能再指向 /bin/bash (那就是 wrapper 自己)
    // 必须指向备份的原始二进制
    const isShell = ['bash', 'sh'].includes(name);
    const shebang = isShell ? '#!' + origPath : '#!/bin/bash';

    return [
      shebang,
      'ORIG="' + origPath + '"',
      'LOG="' + LOG_PATH + '"',
      "TS=$(date '+%Y-%m-%d %H:%M:%S')",
      'CALLER=$(ps -o comm= $PPID 2>/dev/null)',
      'echo "[$TS] CMD=' + name + ' ARGS=$* USER=$(whoami) PID=$$ PPID=$PPID CALLER=$CALLER" >> $LOG',
      'exec "$ORIG" "$@"',
    ].join('\n');
  }

  async deployHijack(name: string): Promise<void> {
    const cmd = this.commands.find(c => c.name === name);
    if (!cmd || !cmd.path) {
      window.showNotification?.(`命令 ${name} 路径未知，无法劫持`, 'warning');
      return;
    }
    if (cmd.status === 'hijacked') {
      window.showNotification?.(`${name} 已处于劫持状态`, 'info');
      return;
    }
    if (cmd.status === 'missing') {
      window.showNotification?.(`${name} 未安装，跳过`, 'warning');
      return;
    }

    const origPath = cmd.path + '_orig';
    this.showOutput(`正在部署 ${name} 劫持...\n路径: ${cmd.path}\n备份: ${origPath}`);

    // 步骤 1: 备份原始二进制
    const bkOut = await this.exec(this.priv(`cp -n "${cmd.path}" "${origPath}"`));

    // 验证备份
    const bkCheck = await this.exec(`ls "${origPath}" 2>/dev/null && echo "BK_OK"`);
    if (!bkCheck.includes('BK_OK')) {
      this.showOutput(`备份失败，无法继续\n输出: ${bkOut}\n\n请确认:\n1. 当前身份: ${this.isRoot ? 'root' : '非root'}\n2. 路径是否可写: ls -la $(dirname ${cmd.path})`);
      window.showNotification?.(`${name} 备份失败`, 'error');
      return;
    }

    // 步骤 2: 生成 wrapper 并写入
    // 劫持 bash/sh 时，写入命令本身不能依赖被劫持的 shell
    // 所以统一用 /usr/bin/env + 已备份的原始 bash 来执行
    const wrapper = this.buildWrapperContent(name, origPath);
    const b64 = btoa(wrapper);
    const writeOut = await this.exec(this.priv(`/bin/sh -c 'echo ${b64} | base64 -d > "${cmd.path}" && chmod +x "${cmd.path}"'`));

    // 步骤 3: 验证写入
    const verify = await this.exec(`file "${cmd.path}" 2>/dev/null`);
    const isScript = /script|text|ASCII/.test(verify);

    // 步骤 4: 验证 wrapper 能正常工作（用 --help 或无参数快速测试）
    if (isScript) {
      const testOut = await this.exec(`"${cmd.path}" --help 2>&1 | head -1 || "${cmd.path}" 2>&1 | head -1`);
      const testOk = testOut.length > 0;

      cmd.status = 'hijacked';
      cmd.origPath = origPath;
      this.showOutput(`${name} 劫持部署成功\n\n备份: ${origPath}\nWrapper: ${cmd.path}\n验证: file → ${verify.trim()}\n功能测试: ${testOk ? '通过' : '未确认'} ${testOut.substring(0, 100)}\n${writeOut}`);
      window.showNotification?.(`${name} 劫持成功`, 'success');
    } else {
      // 写入失败，恢复原始
      await this.exec(this.priv(`mv "${origPath}" "${cmd.path}"`));
      this.showOutput(`${name} wrapper 写入失败，已自动恢复原始文件\n\nfile 输出: ${verify}\n写入输出: ${writeOut}\n\n可能原因:\n1. base64 命令不可用 (尝试: which base64)\n2. 文件系统只读\n3. SELinux/AppArmor 阻止`);
      window.showNotification?.(`${name} 劫持失败，已恢复`, 'error');
    }
    this.renderContent();
  }

  async restoreCommand(name: string): Promise<void> {
    const cmd = this.commands.find(c => c.name === name);
    if (!cmd || !cmd.path) return;

    const origPath = cmd.origPath || (cmd.path + '_orig');

    // 先检查备份文件是否存在
    const backupCheck = await this.exec(`ls "${origPath}" 2>/dev/null && echo "EXISTS"`);
    if (!backupCheck.includes('EXISTS')) {
      // 备份可能用别的后缀，尝试查找
      const search = await this.exec(`ls "${cmd.path}"_orig* "${cmd.path}".bak* 2>/dev/null | head -5`);
      if (search.trim()) {
        this.showOutput(`标准备份 ${origPath} 不存在，但找到以下备份:\n${search}\n\n请手动选择恢复，例如:\n${this.isRoot ? '' : 'sudo '}mv "${search.split('\\n')[0].trim()}" "${cmd.path}"`);
      } else {
        this.showOutput(`恢复失败: 未找到任何备份文件\n\n已搜索:\n  ${origPath}\n  ${cmd.path}_orig*\n  ${cmd.path}.bak*\n\n可能原因:\n1. 从未部署过劫持\n2. 备份已被删除`);
      }
      window.showNotification?.(`${name} 恢复失败: 未找到备份`, 'error');
      return;
    }

    const out = await this.exec(this.priv(`mv "${origPath}" "${cmd.path}"`) + ' 2>&1 && echo "RESTORE_OK"');
    if (out.includes('RESTORE_OK')) {
      cmd.status = 'original';
      this.showOutput(`${name} 已恢复为原始二进制`);
      window.showNotification?.(`${name} 已恢复`, 'success');
    } else {
      this.showOutput(`${name} 恢复失败:\n${out}`);
      window.showNotification?.(`${name} 恢复失败`, 'error');
    }
    this.renderContent();
  }

  async deployAll(): Promise<void> {
    const targets = this.commands.filter(c => c.status === 'original' && c.path);
    if (targets.length === 0) { window.showNotification?.('没有可部署的命令', 'info'); return; }
    for (const cmd of targets) {
      await this.deployHijack(cmd.name);
    }
    window.showNotification?.(`已部署 ${targets.length} 个命令`, 'success');
  }

  async restoreAll(): Promise<void> {
    const targets = this.commands.filter(c => c.status === 'hijacked');
    if (targets.length === 0) { window.showNotification?.('没有已劫持的命令', 'info'); return; }
    for (const cmd of targets) {
      await this.restoreCommand(cmd.name);
    }
    window.showNotification?.(`已恢复 ${targets.length} 个命令`, 'success');
  }

  addCustomCommand(): void {
    const input = document.getElementById('ca-custom-input') as HTMLInputElement;
    if (!input) return;
    const name = input.value.trim();
    if (!name || this.commands.find(c => c.name === name)) {
      window.showNotification?.(!name ? '请输入命令名' : '命令已存在', 'warning');
      return;
    }
    this.commands.push({ name, path: '', status: 'checking', origPath: '', custom: true });
    input.value = '';
    this.detectStatuses();
  }

  removeCustomCommand(name: string): void {
    this.commands = this.commands.filter(c => !(c.name === name && c.custom));
    this.renderContent();
  }

  // ──── 审计日志 ────

  async refreshLog(): Promise<void> {
    const raw = await this.exec(`tail -500 ${LOG_PATH} 2>/dev/null`);
    this.logEntries = [];
    raw.split('\n').filter(Boolean).forEach(line => {
      const m = LOG_LINE_RE.exec(line);
      if (m) {
        this.logEntries.push({
          timestamp: m[1], command: m[2], args: m[3].trim(),
          user: m[4], pid: parseInt(m[5]), ppid: parseInt(m[6]),
          caller: m[7].trim(), raw: line,
        });
      }
    });
    this.renderContent();
  }

  toggleAutoRefresh(): void {
    this.autoRefreshEnabled = !this.autoRefreshEnabled;
    if (this.autoRefreshEnabled) {
      this.autoRefreshTimer = window.setInterval(() => this.refreshLog(), this.refreshInterval);
    } else {
      this.stopAutoRefresh();
    }
    this.renderContent();
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshTimer) { clearInterval(this.autoRefreshTimer); this.autoRefreshTimer = null; }
    this.autoRefreshEnabled = false;
  }

  setRefreshInterval(ms: number): void {
    this.refreshInterval = ms;
    if (this.autoRefreshEnabled) {
      this.stopAutoRefresh();
      this.autoRefreshEnabled = true;
      this.autoRefreshTimer = window.setInterval(() => this.refreshLog(), ms);
    }
  }

  async clearLog(): Promise<void> {
    await this.exec(`> ${LOG_PATH}`);
    this.logEntries = [];
    this.renderContent();
    window.showNotification?.('日志已清空', 'success');
  }

  exportLog(): void {
    const text = this.logEntries.map(e => e.raw).join('\n');
    navigator.clipboard.writeText(text).catch(() => {});
    window.showNotification?.('日志已复制到剪贴板', 'success');
  }

  private isSuspicious(entry: AuditLogEntry): boolean {
    const full = `${entry.command} ${entry.args}`;
    return SUSPICIOUS_RE.some(re => re.test(full));
  }

  private computeStats(): { total: number; cmdCounts: [string, number][]; suspiciousCount: number } {
    const map = new Map<string, number>();
    let sus = 0;
    for (const e of this.logEntries) {
      map.set(e.command, (map.get(e.command) || 0) + 1);
      if (this.isSuspicious(e)) sus++;
    }
    const cmdCounts = [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    return { total: this.logEntries.length, cmdCounts, suspiciousCount: sus };
  }

  // ──── Check 分析 ────

  async runAnalysis(): Promise<void> {
    if (this.logEntries.length === 0) await this.refreshLog();
    if (this.logEntries.length === 0) { window.showNotification?.('审计日志为空，请先部署劫持', 'warning'); return; }

    // 按 cmd+args 分组
    const groups = new Map<string, AuditLogEntry[]>();
    for (const e of this.logEntries) {
      const key = `${e.command}|${e.args}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }

    this.cycles = [];
    groups.forEach((entries, key) => {
      if (entries.length < 2) return;
      const [cmd, args] = key.split('|');
      const interval = this.detectPeriod(entries.map(e => e.timestamp));
      const category = this.classifyCommand(cmd, args);
      this.cycles.push({
        command: cmd, args: args || '',
        intervalSeconds: interval,
        count: entries.length,
        lastSeen: entries[entries.length - 1].timestamp,
        category,
      });
    });

    this.cycles.sort((a, b) => b.count - a.count);
    this.generateSuggestions();
    this.currentTab = 'analysis';
    document.querySelectorAll('.ca-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-ca-param="analysis"]')?.classList.add('active');
    this.renderContent();
  }

  private detectPeriod(timestamps: string[]): number | null {
    if (timestamps.length < 3) return null;
    const times = timestamps.map(t => new Date(t).getTime()).filter(t => !isNaN(t));
    if (times.length < 3) return null;
    const intervals: number[] = [];
    for (let i = 1; i < times.length; i++) intervals.push((times[i] - times[i - 1]) / 1000);
    const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
    if (avg <= 0) return null;
    const withinTolerance = intervals.every(iv => Math.abs(iv - avg) / avg < 0.3);
    return withinTolerance ? Math.round(avg) : null;
  }

  private classifyCommand(cmd: string, args: string): string {
    if (['cat', 'grep', 'find', 'ls', 'head', 'tail'].includes(cmd) && args.includes('/')) return 'file-read';
    if (['systemctl', 'service', 'ss', 'netstat'].includes(cmd)) return 'service-check';
    if (['curl', 'wget'].includes(cmd)) return 'network';
    if (['mysql', 'redis-cli', 'psql', 'mongo'].includes(cmd)) return 'database';
    return 'process';
  }

  private generateSuggestions(): void {
    this.suggestions = [];
    for (const c of this.cycles) {
      const s = this.cycleToSuggestion(c);
      if (s) this.suggestions.push(s);
    }
  }

  private cycleToSuggestion(c: CheckCycle): FixSuggestion | null {
    const id = `fix-${c.command}-${this.suggestions.length}`;
    if (c.category === 'file-read' && c.args) {
      return {
        id, severity: 'critical', category: 'file',
        title: `确保文件 ${c.args} 存在且内容正确`,
        description: `Check 脚本${c.intervalSeconds ? `每 ${c.intervalSeconds} 秒` : ''}使用 ${c.command} 读取此文件`,
        checkCommand: `${c.command} ${c.args}`,
        fixCommand: `ls -la ${c.args} && ${c.command} ${c.args} | head -5`,
      };
    }
    if (c.category === 'network') {
      const urlMatch = c.args.match(/https?:\/\/\S+/);
      const url = urlMatch ? urlMatch[0] : c.args;
      return {
        id, severity: 'critical', category: 'network',
        title: `确保 ${url} 可访问`,
        description: `Check 脚本${c.intervalSeconds ? `每 ${c.intervalSeconds} 秒` : ''}请求此 URL`,
        checkCommand: `${c.command} ${c.args}`,
        fixCommand: `curl -sI ${url} | head -5`,
      };
    }
    if (c.category === 'service-check') {
      const svc = c.args.replace(/status\s*/i, '').trim().split(/\s+/)[0] || '';
      return {
        id, severity: 'warning', category: 'service',
        title: `确保服务 ${svc || c.command} 正在运行`,
        description: `Check 脚本检查服务状态: ${c.command} ${c.args}`,
        checkCommand: `${c.command} ${c.args}`,
        fixCommand: svc ? `systemctl start ${svc} && systemctl status ${svc}` : `${c.command} ${c.args}`,
      };
    }
    if (c.category === 'database') {
      return {
        id, severity: 'critical', category: 'database',
        title: `确保数据库连接正常`,
        description: `Check 脚本使用 ${c.command} 测试数据库: ${c.args.substring(0, 60)}`,
        checkCommand: `${c.command} ${c.args}`,
        fixCommand: c.command === 'mysql' ? `systemctl status mysql && ${c.command} ${c.args}` : `systemctl status redis && ${c.command} ${c.args}`,
      };
    }
    if (c.count >= 3) {
      return {
        id, severity: 'info', category: 'process',
        title: `Check 执行 ${c.command} ${c.args.substring(0, 40)}`,
        description: `共 ${c.count} 次${c.intervalSeconds ? `，周期约 ${c.intervalSeconds}s` : ''}`,
        checkCommand: `${c.command} ${c.args}`,
        fixCommand: `${c.command} ${c.args}`,
      };
    }
    return null;
  }

  // ──── 工具 ────

  private esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  private copyText(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {});
    window.showNotification?.('已复制', 'success');
  }

  private showOutput(text: string): void {
    const p = document.getElementById('ca-output-panel');
    if (p) p.innerHTML = `<pre class="ca-output-pre">${this.esc(text)}</pre>`;
  }

  // ──── 渲染 ────

  renderContent(): void {
    const el = document.getElementById('ca-content');
    if (!el) return;
    if (!sshConnectionManager.isConnected()) { el.innerHTML = '<div class="ca-empty">请先连接服务器</div>'; return; }
    if (this.loading) { el.innerHTML = '<div class="ca-loading"><div class="ca-spinner"></div>正在检测命令状态...</div>'; return; }

    switch (this.currentTab) {
      case 'hijack': el.innerHTML = this.renderHijackTab(); break;
      case 'audit-log': el.innerHTML = this.renderAuditLogTab(); break;
      case 'analysis': el.innerHTML = this.renderAnalysisTab(); break;
      case 'quick-fix': el.innerHTML = this.renderQuickFixTab(); break;
    }
  }

  private renderHijackTab(): string {
    const rows = this.commands.map(c => {
      const statusClass = c.status === 'hijacked' ? 'hijacked' : c.status === 'original' ? 'original' : 'missing';
      const statusLabel = c.status === 'hijacked' ? '已劫持' : c.status === 'original' ? '原始' : c.status === 'missing' ? '未安装' : '检测中';
      return `<tr>
        <td><code>${this.esc(c.name)}</code></td>
        <td class="ca-cell-path">${this.esc(c.path || '-')}</td>
        <td><span class="ca-status ${statusClass}">${statusLabel}</span></td>
        <td class="ca-cell-actions">
          ${c.status === 'original' ? `<button class="ca-btn primary small" data-ca-action="deploy-cmd" data-ca-param="${c.name}">部署劫持</button>` : ''}
          ${c.status === 'hijacked' ? `<button class="ca-btn secondary small" data-ca-action="restore-cmd" data-ca-param="${c.name}">恢复原始</button>` : ''}
          ${c.custom ? `<button class="ca-btn danger small" data-ca-action="remove-custom" data-ca-param="${c.name}">移除</button>` : ''}
        </td>
      </tr>`;
    }).join('');

    const hijackedCount = this.commands.filter(c => c.status === 'hijacked').length;

    return `
      <div class="ca-section">
        <div class="ca-section-header">
          <h4>命令劫持管理</h4>
          <div class="ca-header-actions">
            <span class="ca-hint">已劫持 ${hijackedCount} / ${this.commands.length}</span>
            <button class="ca-btn primary" data-ca-action="deploy-all">一键全部部署</button>
            <button class="ca-btn secondary" data-ca-action="restore-all">一键全部恢复</button>
            <button class="ca-btn secondary" data-ca-action="refresh">刷新状态</button>
          </div>
        </div>
        <div class="ca-form-row">
          <input id="ca-custom-input" class="ca-input" placeholder="自定义命令名 (如 flag_reader)" />
          <button class="ca-btn secondary" data-ca-action="add-custom">添加</button>
        </div>
        <div class="ca-table-wrapper">
          <table class="ca-table">
            <thead><tr><th>命令</th><th>路径</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>
      <div id="ca-output-panel" class="ca-output-panel"></div>
    `;
  }

  private renderAuditLogTab(): string {
    const stats = this.computeStats();
    const filterInput = `<input id="ca-log-filter" class="ca-input" placeholder="过滤命令/参数..." style="max-width:200px" />`;

    const cmdBadges = stats.cmdCounts.map(([cmd, cnt]) =>
      `<span class="ca-badge">${this.esc(cmd)}: ${cnt}</span>`
    ).join('');

    const filtered = this.getFilteredLog();
    const logRows = filtered.slice(-200).reverse().map(e => {
      const sus = this.isSuspicious(e);
      return `<tr class="${sus ? 'ca-suspicious' : ''}">
        <td class="ca-cell-ts">${this.esc(e.timestamp)}</td>
        <td><code>${this.esc(e.command)}</code></td>
        <td class="ca-cell-args" title="${this.esc(e.args)}">${this.esc(e.args.substring(0, 80))}</td>
        <td>${this.esc(e.user)}</td>
        <td>${e.pid}</td>
        <td>${this.esc(e.caller)}</td>
      </tr>`;
    }).join('');

    return `
      <div class="ca-section">
        <div class="ca-log-toolbar">
          ${filterInput}
          <select class="ca-select" data-ca-action="set-interval" onchange="this.setAttribute('data-ca-param',this.value);this.click()">
            <option value="3000" ${this.refreshInterval === 3000 ? 'selected' : ''}>3s</option>
            <option value="5000" ${this.refreshInterval === 5000 ? 'selected' : ''}>5s</option>
            <option value="10000" ${this.refreshInterval === 10000 ? 'selected' : ''}>10s</option>
          </select>
          <button class="ca-btn ${this.autoRefreshEnabled ? 'primary' : 'secondary'}" data-ca-action="toggle-auto">
            ${this.autoRefreshEnabled ? '[ ON ] 自动刷新' : '自动刷新'}
          </button>
          <button class="ca-btn secondary" data-ca-action="refresh-log">刷新</button>
          <button class="ca-btn secondary" data-ca-action="clear-log">清空</button>
          <button class="ca-btn secondary" data-ca-action="export-log">导出</button>
        </div>
        <div class="ca-stats-bar">
          <span>共 ${stats.total} 条</span>
          ${stats.suspiciousCount > 0 ? `<span class="ca-badge danger">可疑 ${stats.suspiciousCount}</span>` : ''}
          ${cmdBadges}
        </div>
        ${filtered.length === 0
          ? '<div class="ca-empty">暂无审计记录。请先在"命令劫持"Tab 部署劫持，等待 check 脚本执行后查看。</div>'
          : `<div class="ca-table-wrapper"><table class="ca-table">
            <thead><tr><th>时间</th><th>命令</th><th>参数</th><th>用户</th><th>PID</th><th>调用者</th></tr></thead>
            <tbody>${logRows}</tbody>
          </table></div>`}
      </div>
    `;
  }

  private getFilteredLog(): AuditLogEntry[] {
    const filter = (document.getElementById('ca-log-filter') as HTMLInputElement)?.value?.toLowerCase() || '';
    if (!filter) return this.logEntries;
    return this.logEntries.filter(e =>
      e.command.toLowerCase().includes(filter) || e.args.toLowerCase().includes(filter) || e.caller.toLowerCase().includes(filter)
    );
  }

  private renderAnalysisTab(): string {
    if (this.cycles.length === 0) {
      return `<div class="ca-empty">
        <p>暂无分析数据</p>
        <button class="ca-btn primary" data-ca-action="run-analysis">运行 Check 分析</button>
        <p class="ca-hint">需要先部署命令劫持并等待 check 脚本执行若干次后再分析</p>
      </div>`;
    }

    const cards = this.cycles.map(c => {
      const periodLabel = c.intervalSeconds ? `~${c.intervalSeconds}s` : '不规律';
      const catLabels: Record<string, string> = {
        'file-read': '文件读取', 'service-check': '服务检查',
        'network': '网络请求', 'database': '数据库', 'process': '进程',
      };
      return `<div class="ca-cycle-card">
        <div class="ca-cycle-left">
          <span class="ca-category-tag">${catLabels[c.category] || c.category}</span>
          <code class="ca-cycle-cmd">${this.esc(c.command)} ${this.esc(c.args.substring(0, 80))}</code>
        </div>
        <div class="ca-cycle-right">
          <span class="ca-interval-badge">${periodLabel}</span>
          <span class="ca-badge">${c.count} 次</span>
          <span class="ca-hint">${this.esc(c.lastSeen)}</span>
        </div>
      </div>`;
    }).join('');

    return `
      <div class="ca-section">
        <div class="ca-section-header">
          <h4>Check 脚本行为分析</h4>
          <button class="ca-btn primary" data-ca-action="run-analysis">重新分析</button>
        </div>
        ${cards}
      </div>
    `;
  }

  private renderQuickFixTab(): string {
    if (this.suggestions.length === 0) {
      return `<div class="ca-empty">
        <p>暂无修复建议</p>
        <button class="ca-btn primary" data-ca-action="run-analysis">先运行 Check 分析</button>
      </div>`;
    }

    const items = this.suggestions.map(s => `
      <div class="ca-fix-card ca-fix-${s.severity}">
        <div class="ca-fix-header">
          <span class="ca-severity-badge ${s.severity}">${s.severity === 'critical' ? '严重' : s.severity === 'warning' ? '警告' : '信息'}</span>
          <span class="ca-fix-title">${this.esc(s.title)}</span>
        </div>
        <p class="ca-fix-desc">${this.esc(s.description)}</p>
        <div class="ca-fix-cmds">
          <div class="ca-fix-cmd-row">
            <span class="ca-fix-cmd-label">Check 命令:</span>
            <code>${this.esc(s.checkCommand)}</code>
            <button class="ca-btn secondary small" data-ca-action="copy-cmd" data-ca-param="${this.esc(s.checkCommand)}">复制</button>
          </div>
          ${s.fixCommand ? `<div class="ca-fix-cmd-row">
            <span class="ca-fix-cmd-label">验证/修复:</span>
            <code>${this.esc(s.fixCommand)}</code>
            <button class="ca-btn primary small" data-ca-action="copy-cmd" data-ca-param="${this.esc(s.fixCommand)}">复制</button>
          </div>` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div class="ca-section">
        <div class="ca-section-header">
          <h4>基于 Check 行为的修复建议</h4>
          <span class="ca-hint">${this.suggestions.length} 条建议</span>
        </div>
        ${items}
      </div>
    `;
  }
}

export const checkAuditManager = new CheckAuditManager();
