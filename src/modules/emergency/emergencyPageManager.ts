import { emergencyCategories, type EmergencyCategory, type EmergencyCommand } from './commands';
import { CommandHistoryManager } from '../utils/commandHistoryManager';
import { SystemDetector, type SystemInfo } from '../utils/systemDetector';
import { CommandAdapter } from './commandAdapter';
import { aiService } from '../ai/aiService';
import { matchLine, LEVEL_CSS } from './outputHighlightRules';
import { initOutputContextMenu } from './outputContextMenu';
import { busyboxManager } from '../core/busyboxManager';

class EmergencyPageManager {
  private categories: EmergencyCategory[] = emergencyCategories;
  private byId: Map<string, EmergencyCommand> = new Map();
  private initialized = false;
  private systemInfo: SystemInfo | null = null;
  private eventsBound = false;
  private debounceTimer: number | null = null;
  private boundClickHandler: ((e: Event) => void) | null = null;
  private boundInputHandler: ((e: Event) => void) | null = null;

  private selectedCmd: EmergencyCommand | null = null;
  private lastOutput = '';
  private isExecuting = false;

  constructor() {
    this.rebuildIndex();
  }

  // ──── Search ────

  handleSearch(query: string): void {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = window.setTimeout(() => {
      this.performSearch(query.trim().toLowerCase());
    }, 200);
  }

  private performSearch(query: string): void {
    const items = document.querySelectorAll('.em-list-item');
    const groups = document.querySelectorAll('.em-group');

    items.forEach(el => {
      const name = (el.querySelector('.em-item-name')?.textContent || '').toLowerCase();
      const id = el.getAttribute('data-em-id') || '';
      const cmd = this.byId.get(id);
      const desc = cmd?.desc?.toLowerCase() || '';
      const match = !query || name.includes(query) || desc.includes(query);
      (el as HTMLElement).style.display = match ? '' : 'none';
    });

    groups.forEach(g => {
      const visibleItems = g.querySelectorAll('.em-list-item');
      let hasVisible = false;
      visibleItems.forEach(i => { if ((i as HTMLElement).style.display !== 'none') hasVisible = true; });
      (g as HTMLElement).style.display = hasVisible ? '' : 'none';
    });
  }

  // ──── Init ────

  private rebuildIndex(): void {
    this.byId.clear();
    for (const cat of this.categories) {
      for (const item of cat.items) this.byId.set(item.id, item);
    }
  }

  getCategories(): EmergencyCategory[] { return this.categories; }

  async initialize(): Promise<void> {
    // 事件绑定只做一次，但要在 DOM 渲染后立即绑定，不等 async 操作
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }

    // 初始化命令输出右键菜单(全局仅绑定一次)
    initOutputContextMenu();

    // busybox 开关
    this.setupBusyboxToggle();

    (window as any).emergencyPageManager = this;

    if (this.initialized) {
      await this.loadAccountList();
      if (this.systemInfo) this.displaySystemInfo();
      return;
    }

    // async 操作不阻塞事件绑定
    await this.detectSystem();
    await this.loadAccountList();

    this.initialized = true;
  }

  deactivate(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.boundClickHandler) {
      document.removeEventListener('click', this.boundClickHandler);
      this.boundClickHandler = null;
    }
    if (this.boundInputHandler) {
      document.removeEventListener('input', this.boundInputHandler);
      this.boundInputHandler = null;
    }
    this.eventsBound = false;
  }

  // ──── Busybox Toggle ────

  private setupBusyboxToggle(): void {
    (window as any).__busyboxToggle = async () => {
      const btn = document.getElementById('em-busybox-btn');
      const label = document.getElementById('em-busybox-label');
      const dot = document.getElementById('em-busybox-indicator');
      if (!btn || !label || !dot) return;

      if (busyboxManager.isEnabled()) {
        // 关闭
        await busyboxManager.disable();
        dot.className = 'em-busybox-dot off';
        label.textContent = 'Busybox';
        window.showNotification?.('Busybox 模式已关闭，使用系统原生命令', 'info');
      } else {
        // 一键部署并启用
        label.textContent = '部署中...';
        dot.className = 'em-busybox-dot loading';
        try {
          const log = await busyboxManager.deployAndEnable();
          dot.className = 'em-busybox-dot on';
          label.textContent = 'Busybox ON';
          window.showNotification?.('Busybox 可信模式已启用', 'success');
          console.log('[busybox]', log);
        } catch (e) {
          dot.className = 'em-busybox-dot off';
          label.textContent = 'Busybox';
          window.showNotification?.(`Busybox 部署失败: ${e}`, 'error');
        }
      }
    };

    // 初始检测 busybox 状态
    busyboxManager.detect().then(({ status }) => {
      const dot = document.getElementById('em-busybox-indicator');
      const label = document.getElementById('em-busybox-label');
      if (dot && label) {
        if (status === 'enabled') {
          dot.className = 'em-busybox-dot on';
          label.textContent = 'Busybox ON';
        } else if (status === 'installed') {
          dot.className = 'em-busybox-dot installed';
          label.textContent = 'Busybox (就绪)';
        }
      }
    });
  }

  // ──── System Detection ────

  private async detectSystem(): Promise<void> {
    try {
      this.systemInfo = await SystemDetector.detectSystem();
      this.displaySystemInfo();
    } catch {
      this.systemInfo = {
        type: 'generic', name: 'Linux', version: '',
        prettyName: 'Generic Linux', packageManager: 'unknown', initSystem: 'unknown'
      };
    }
  }

  private displaySystemInfo(): void {
    if (!this.systemInfo) return;
    const name = SystemDetector.getSystemDisplayName(this.systemInfo.type);
    const text = `${name} ${this.systemInfo.version}`.trim();
    const el = document.getElementById('detected-system-info');
    if (el) {
      el.textContent = text;
      el.title = `${this.systemInfo.prettyName}\n${this.systemInfo.packageManager} / ${this.systemInfo.initSystem}`;
    }
    (window as any).showNotification?.(`已检测到系统: ${text}`, 'success');
  }

  getSystemInfo(): SystemInfo | null { return this.systemInfo; }

  // ──── Account List ────

  private async loadAccountList(): Promise<void> {
    try {
      const invoke = (window as any).__TAURI__?.core?.invoke;
      if (!invoke) return;
      const connections = await invoke('load_ssh_connections') as any[];
      if (!connections.length) return;

      const accounts = connections[0].accounts || [];
      const select = document.getElementById('emergency-account-select') as HTMLSelectElement;
      if (!select) return;

      select.innerHTML = '<option value="">默认账号</option>';
      accounts.forEach((a: any) => {
        const opt = document.createElement('option');
        opt.value = a.username;
        opt.textContent = `${a.username}${a.description ? ` (${a.description})` : ''}${a.is_default ? ' [默认]' : ''}`;
        select.appendChild(opt);
      });
    } catch (e) {
      console.error('加载账号列表失败:', e);
    }
  }

  // ──── Events ────

  private bindEvents(): void {
    this.boundClickHandler = async (event: Event) => {
      const target = (event as MouseEvent).target as HTMLElement;

      // Group collapse/expand
      const groupHeader = target.closest('.em-group-header') as HTMLElement | null;
      if (groupHeader) {
        const group = groupHeader.closest('.em-group');
        if (group) group.classList.toggle('collapsed');
        return;
      }

      // List item click
      const listItem = target.closest('.em-list-item[data-em-id]') as HTMLElement | null;
      if (listItem) {
        const id = listItem.getAttribute('data-em-id') || '';
        this.selectCommand(id);
        return;
      }

      // Only handle if on emergency page
      const currentPage = (window as any).app?.stateManager?.getState()?.currentPage;
      if (currentPage !== 'emergency-commands') return;

      if (target.closest('#em-btn-execute')) {
        await this.executeSelectedCommand();
        return;
      }
      if (target.closest('#em-btn-edit')) {
        this.toggleEdit();
        return;
      }
      if (target.closest('#em-btn-copy')) {
        this.copyCommand();
        return;
      }
      if (target.closest('#em-btn-ai')) {
        await this.explainWithAI();
        return;
      }
    };
    document.addEventListener('click', this.boundClickHandler);

    // Output search
    this.boundInputHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.id === 'em-output-search') {
        this.highlightOutput((target as HTMLInputElement).value);
      }
    };
    document.addEventListener('input', this.boundInputHandler);
  }

  // ──── Select Command ────

  selectCommand(id: string): void {
    const cmd = this.byId.get(id);
    if (!cmd) return;

    this.selectedCmd = cmd;

    // Update active state in sidebar
    document.querySelectorAll('.em-list-item').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-em-id') === id);
    });

    // Get adapted command (use generic fallback if system not yet detected)
    const sysInfo = this.systemInfo || {
      type: 'generic', name: 'Linux', version: '',
      prettyName: 'Generic Linux', packageManager: 'unknown', initSystem: 'unknown'
    };
    const adaptedCmd = CommandAdapter.getAdaptedCommand(cmd, sysInfo);

    // Show detail panel, hide empty state
    const emptyState = document.getElementById('em-empty-state');
    const detailPanel = document.getElementById('em-detail-panel');
    const outputPanel = document.getElementById('em-output-panel');

    if (emptyState) emptyState.style.display = 'none';
    if (detailPanel) detailPanel.style.display = '';
    if (outputPanel) outputPanel.style.display = '';

    // Fill detail
    const titleEl = document.getElementById('em-detail-title');
    const descEl = document.getElementById('em-detail-desc');
    const codeEl = document.getElementById('em-detail-code');

    if (titleEl) titleEl.textContent = cmd.name;
    if (descEl) descEl.textContent = cmd.desc || '';
    if (codeEl) {
      codeEl.textContent = adaptedCmd;
      codeEl.contentEditable = 'false';
    }

    // Reset edit button text
    const editBtn = document.getElementById('em-btn-edit');
    if (editBtn) editBtn.textContent = '编辑命令';

    // Clear previous output
    const outputContent = document.getElementById('em-output-content');
    if (outputContent) outputContent.textContent = '';
    const aiBox = document.getElementById('em-ai-box');
    if (aiBox) aiBox.style.display = 'none';
    const searchInput = document.getElementById('em-output-search') as HTMLInputElement;
    if (searchInput) searchInput.value = '';

    this.lastOutput = '';
  }

  // ──── Edit / Copy ────

  private toggleEdit(): void {
    const codeEl = document.getElementById('em-detail-code');
    const editBtn = document.getElementById('em-btn-edit');
    if (!codeEl || !editBtn) return;

    const isEditing = codeEl.contentEditable === 'true';
    codeEl.contentEditable = isEditing ? 'false' : 'true';
    editBtn.textContent = isEditing ? '编辑命令' : '完成编辑';
    if (!isEditing) codeEl.focus();
  }

  private copyCommand(): void {
    const codeEl = document.getElementById('em-detail-code');
    if (!codeEl) return;
    navigator.clipboard.writeText(codeEl.textContent || '');
    (window as any).showNotification?.('命令已复制', 'success');
  }

  // ──── 一键执行分组 ────

  async runGroup(groupId: string): Promise<void> {
    const cat = this.categories.find(c => c.id === groupId);
    if (!cat || cat.items.length === 0) return;

    const tauriInvoke = (window as any).__TAURI__?.core?.invoke;
    const sshMgr = (window as any).sshConnectionManager;
    if (!tauriInvoke && !sshMgr?.isConnected?.()) {
      window.showNotification?.('未连接到服务器', 'warning');
      return;
    }

    const outputPanel = document.getElementById('em-output-panel');
    const outputContent = document.getElementById('em-output-content');
    const scrollEl = document.getElementById('em-output-scroll');
    if (outputPanel) outputPanel.style.display = '';

    const accountSelect = document.getElementById('emergency-account-select') as HTMLSelectElement;
    const username = accountSelect?.value || '';

    let fullOutput = '';
    const total = cat.items.length;

    for (let i = 0; i < total; i++) {
      const item = cat.items[i];
      let command: string;
      try { command = CommandAdapter.getAdaptedCommand(item, this.systemInfo || { type: 'generic', name: 'Linux', version: '', prettyName: 'Linux', packageManager: 'unknown', initSystem: 'unknown' }); }
      catch { command = item.cmd || ''; }
      if (!command) continue;

      const header = `\n${'═'.repeat(60)}\n[${i + 1}/${total}] ${item.name}\n$ ${command}\n${'─'.repeat(60)}\n`;
      fullOutput += header;

      if (outputContent) {
        outputContent.innerHTML = this.applyHighlight(fullOutput + '(执行中...)');
        if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
      }

      try {
        const params: any = { command };
        if (username) params.username = username;
        const result = await tauriInvoke('ssh_execute_emergency_command_direct', params) as any;
        const output = result?.output || result?.command?.output || '(无输出)';
        fullOutput += output + '\n';
        CommandHistoryManager.saveCommand(command, item.name, output);
      } catch (e) {
        fullOutput += `执行失败: ${e}\n`;
      }
    }

    fullOutput += `\n${'═'.repeat(60)}\n分组 [${cat.title}] 全部执行完成 (${total} 项)\n`;
    this.lastOutput = fullOutput;
    if (outputContent) {
      outputContent.innerHTML = this.applyHighlight(fullOutput);
      if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
    }

    window.showNotification?.(`${cat.title}: ${total} 项命令执行完成`, 'success');
  }

  // ──── Execute ────

  private async executeSelectedCommand(): Promise<void> {
    if (!this.selectedCmd || this.isExecuting) return;

    const codeEl = document.getElementById('em-detail-code');
    const command = codeEl?.textContent?.trim() || '';
    if (!command) return;

    const app = (window as any).app;
    const sshManager = app?.sshManager;
    const sshConnectionManager = (window as any).sshConnectionManager;
    const tauriInvoke = (window as any).__TAURI__?.core?.invoke;

    const hasCoordinatorConn = sshManager?.isConnected?.() ?? false;
    const hasDirectConn = sshConnectionManager?.isConnected?.() ?? false;

    if (!hasCoordinatorConn && !hasDirectConn) {
      (window as any).showNotification?.('未连接到服务器', 'warning');
      return;
    }

    const accountSelect = document.getElementById('emergency-account-select') as HTMLSelectElement;
    const selectedUsername = accountSelect?.value || '';

    // UI: show loading
    this.isExecuting = true;
    const executeBtn = document.getElementById('em-btn-execute') as HTMLButtonElement;
    const outputContent = document.getElementById('em-output-content');
    const outputPanel = document.getElementById('em-output-panel');
    const aiBox = document.getElementById('em-ai-box');

    if (executeBtn) executeBtn.disabled = true;
    if (outputPanel) outputPanel.style.display = '';
    if (aiBox) aiBox.style.display = 'none';
    if (outputContent) outputContent.innerHTML = '<div class="em-loading"><div class="em-loading-spinner"></div>执行中...</div>';

    const withTimeout = <T>(p: Promise<T>, ms = 30000): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('执行超时')), ms);
        p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
      });
    };

    let output = '';
    let displayedCommand = command;

    try {
      if (hasDirectConn && tauriInvoke) {
        try {
          const params: any = { command };
          if (selectedUsername) params.username = selectedUsername;
          const result: any = await withTimeout(tauriInvoke('ssh_execute_emergency_command_direct', params));
          if (result && typeof result === 'object') {
            if (typeof result.command === 'string' && result.command.length > 0) displayedCommand = result.command;
            if (typeof result.output === 'string') output = result.output;
            else if (typeof result.stdout === 'string') output = result.stdout;
            else output = JSON.stringify(result, null, 2);
          } else if (typeof result === 'string') {
            output = result;
          } else {
            output = String(result ?? '');
          }
        } catch (e: any) {
          if (hasCoordinatorConn && sshManager?.executeCommand) {
            output = await withTimeout(sshManager.executeCommand(command), 20000);
          } else {
            throw e;
          }
        }
      } else if (hasCoordinatorConn && sshManager?.executeCommand) {
        output = await withTimeout(sshManager.executeCommand(command));
      } else {
        throw new Error('当前连接状态不支持执行命令');
      }

      (window as any).showNotification?.('命令执行完成', 'success');
    } catch (err) {
      output = `命令执行失败: ${err}`;
      (window as any).showNotification?.(String(output), 'error');
    }

    // Save to history
    const title = `${this.selectedCmd.name} · ${this.selectedCmd.id}`;
    CommandHistoryManager.saveCommand(displayedCommand, title, output ?? '');

    // Display output with smart highlighting
    this.lastOutput = output;
    if (outputContent) {
      outputContent.innerHTML = this.applyHighlight(output || '(无输出)');
    }

    // Scroll to top
    const scrollEl = document.getElementById('em-output-scroll');
    if (scrollEl) scrollEl.scrollTop = 0;

    this.isExecuting = false;
    if (executeBtn) executeBtn.disabled = false;
  }

  // ──── 智能高亮引擎 ────

  private escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** 对命令输出的每一行应用规则匹配，标记可疑项 */
  private applyHighlight(output: string): string {
    return output.split('\n').map(rawLine => {
      const escaped = this.escHtml(rawLine);
      const rule = matchLine(rawLine);
      if (rule) {
        const cls = LEVEL_CSS[rule.level];
        return `<span class="hl-line ${cls}" title="${this.escHtml(rule.description)}">${escaped}<span class="hl-badge">${this.escHtml(rule.label)}</span></span>`;
      }
      return escaped;
    }).join('\n');
  }

  // ──── Output Search Highlight ────

  private highlightOutput(query: string): void {
    const contentEl = document.getElementById('em-output-content');
    if (!contentEl || !this.lastOutput) return;

    if (!query) {
      // 无搜索词时，恢复智能高亮
      contentEl.innerHTML = this.applyHighlight(this.lastOutput);
      return;
    }

    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    // 先应用智能高亮，再叠加搜索高亮
    const highlighted = this.applyHighlight(this.lastOutput);
    contentEl.innerHTML = highlighted.replace(regex, '<mark>$1</mark>');
  }

  // ──── AI Explain ────

  private async explainWithAI(): Promise<void> {
    if (!this.lastOutput || !this.selectedCmd) {
      window.showNotification?.('请先执行命令', 'info');
      return;
    }

    // 创建/复用模态框
    let overlay = document.getElementById('em-ai-modal-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'em-ai-modal-overlay';
      overlay.className = 'out-ctx-modal-overlay';
      overlay.innerHTML = `
        <div class="out-ctx-modal" style="max-width:800px;">
          <div class="out-ctx-modal-header">
            <span>AI 分析</span>
            <button class="out-ctx-modal-close" id="em-ai-modal-close">&times;</button>
          </div>
          <pre class="out-ctx-modal-body" id="em-ai-modal-body" style="min-height:200px;">正在分析...</pre>
          <div class="out-ctx-modal-footer">
            <button class="out-ctx-modal-btn" id="em-ai-modal-copy">复制</button>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay!.style.display = 'none'; });
      overlay.querySelector('#em-ai-modal-close')?.addEventListener('click', () => { overlay!.style.display = 'none'; });
      overlay.querySelector('#em-ai-modal-copy')?.addEventListener('click', () => {
        const body = document.getElementById('em-ai-modal-body');
        if (body) { navigator.clipboard.writeText(body.textContent || '').catch(() => {}); window.showNotification?.('已复制', 'success'); }
      });
    }

    const body = document.getElementById('em-ai-modal-body');
    if (!body) return;
    overlay.style.display = '';
    body.textContent = '正在分析...';

    try {
      const codeEl = document.getElementById('em-detail-code');
      const command = codeEl?.textContent || '';
      const question = `命令: ${command}\n\n输出:\n${this.lastOutput.substring(0, 8000)}`;
      const prompt = `请分析以下 Linux 命令的输出结果，用中文简要说明发现了什么，有哪些需要注意的安全问题：\n\n${question}`;

      body.textContent = '';
      let fullText = '';
      await aiService.generateConciseSolutionStream(
        this.selectedCmd.name,
        prompt,
        'info',
        undefined,
        (chunk: string) => { fullText = chunk; body.textContent = chunk; },
        (final: string) => {
          // 记录到 AI 历史
          import('../ai/aiHistoryManager').then(({ aiHistoryManager }) => {
            aiHistoryManager.addRecord({ question: `[${this.selectedCmd?.name}] ${command}`, answer: final, source: 'emergency' });
          }).catch(() => {});
        }
      );
      if (!body.textContent) body.textContent = fullText || '分析完成';
    } catch (e) {
      body.textContent = `AI 分析失败: ${e}`;
    }
  }
}

export const emergencyPageManager = new EmergencyPageManager();
