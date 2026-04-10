/**
 * Baseline Quick Edit Page Manager
 * 管理基线配置的读取、编辑、保存流程
 */

import {
  baselineCategories,
  resolveForDistro,
  type BaselineCategory,
  type BaselineConfigItem,
} from './baselineConfigs';
import { SystemDetector, type SystemInfo } from '../utils/systemDetector';

interface ChangeHistoryEntry {
  timestamp: string;
  server: string;
  changes: Array<{ name: string; oldValue: string; newValue: string; itemId: string }>;
}

export class BaselineQuickEditManager {
  private eventsBound = false;
  private selectedCategoryId: string | null = null;
  private currentValues: Map<string, string> = new Map();
  private pendingChanges: Map<string, string> = new Map();
  private systemInfo: string = '';
  private detectedDistro: string = 'generic';  // 当前检测到的发行版 ID
  private detectedSystemInfo: SystemInfo | null = null;
  private debounceTimer: number | null = null;
  // 新增：文件编辑器状态
  private editorFilePath: string = '';
  private editorOriginalContent: string = '';
  private editorModified: boolean = false;

  async initialize(): Promise<void> {
    if (!this.eventsBound) {
      this.bindEvents();
      this.eventsBound = true;
    }

    // 检测系统类型
    this.detectSystem();
  }

  // ─── 系统检测 ───

  private async detectSystem(): Promise<void> {
    const badge = document.getElementById('bl-sys-name');
    try {
      const info = await SystemDetector.detectSystem();
      this.detectedSystemInfo = info;
      this.detectedDistro = info.type;
      this.systemInfo = info.prettyName || info.name || 'Linux';
    } catch {
      // 回退到手动解析
      try {
        const output = await this.executeCommand('cat /etc/os-release 2>/dev/null | grep -E "^(PRETTY_NAME|ID)=" | head -2');
        const nameMatch = output.match(/PRETTY_NAME="?([^"\n]+)"?/);
        const idMatch = output.match(/\nID="?([^"\n]+)"?/) || output.match(/^ID="?([^"\n]+)"?/);
        this.systemInfo = nameMatch ? nameMatch[1] : 'Linux';
        this.detectedDistro = idMatch ? idMatch[1].toLowerCase() : 'generic';
      } catch {
        this.systemInfo = 'Linux';
        this.detectedDistro = 'generic';
      }
    }
    // 显示发行版标识
    const pkgMgr = this.detectedSystemInfo?.packageManager || '';
    const initSys = this.detectedSystemInfo?.initSystem || '';
    const extra = [pkgMgr, initSys].filter(Boolean).join(' / ');
    if (badge) badge.textContent = this.systemInfo + (extra ? ` (${extra})` : '');
  }

  // ─── 事件绑定 ───

  private bindEvents(): void {
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const actionEl = target.closest('[data-bl-action]') as HTMLElement;
      if (!actionEl) return;

      const action = actionEl.getAttribute('data-bl-action');
      const itemId = actionEl.getAttribute('data-bl-item-id') || '';
      const categoryId = actionEl.getAttribute('data-bl-category-id') || '';

      switch (action) {
        case 'select-category':
          this.selectCategory(categoryId);
          break;
        case 'apply-recommended':
          this.applyRecommended(itemId);
          break;
        case 'revert-item':
          this.revertItem(itemId);
          break;
        case 'cancel-all':
          this.cancelAllChanges();
          break;
        case 'apply-changes':
          this.applyChanges();
          break;
        case 'toggle-diff':
          this.toggleDiffPanel();
          break;
        // ── 新增模式切换 & 文件编辑 & 快捷操作 ──
        case 'switch-mode':
          this.switchMode(actionEl.getAttribute('data-bl-mode') as any);
          break;
        case 'open-file':
          this.openFile(actionEl.getAttribute('data-bl-filepath') || '');
          break;
        case 'open-custom-file': {
          const input = document.getElementById('bl-custom-path') as HTMLInputElement;
          if (input?.value.trim()) this.openFile(input.value.trim());
          break;
        }
        case 'save-file':
          this.saveCurrentFile();
          break;
        case 'reload-file':
          if (this.editorFilePath) this.openFile(this.editorFilePath);
          break;
        case 'exec-quick-action':
          this.executeQuickAction(actionEl.getAttribute('data-bl-qa-id') || '');
          break;
      }
    });

    // 表单控件变化
    document.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;
      if (target.getAttribute('data-bl-action') !== 'change-value') return;
      const itemId = target.getAttribute('data-bl-item-id') || '';
      this.handleValueChange(itemId, target);
    });

    document.addEventListener('input', (e) => {
      const target = e.target as HTMLElement;
      if (target.getAttribute('data-bl-action') !== 'change-value') return;
      if (target instanceof HTMLInputElement && (target.type === 'number' || target.type === 'text')) {
        const itemId = target.getAttribute('data-bl-item-id') || '';
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = window.setTimeout(() => {
          this.handleValueChange(itemId, target);
        }, 300);
      }
    });

    // 搜索
    const searchInput = document.getElementById('bl-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        const query = (searchInput as HTMLInputElement).value.trim().toLowerCase();
        this.filterItems(query);
      });
    }

    // 工具栏按钮
    document.getElementById('bl-btn-refresh')?.addEventListener('click', () => {
      if (this.selectedCategoryId) {
        this.loadCategoryValues(this.selectedCategoryId);
      }
    });

    document.getElementById('bl-btn-recommend-all')?.addEventListener('click', () => {
      this.applyAllRecommended();
    });

    document.getElementById('bl-btn-history')?.addEventListener('click', () => {
      this.showHistory();
    });
  }

  // ─── 分类选择 ───

  private async selectCategory(categoryId: string): Promise<void> {
    this.selectedCategoryId = categoryId;

    // 更新侧边栏激活状态
    document.querySelectorAll('.bl-group').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-bl-category') === categoryId);
    });

    await this.loadCategoryValues(categoryId);
  }

  // ─── 读取配置值 ───

  private async loadCategoryValues(categoryId: string): Promise<void> {
    const category = baselineCategories.find(c => c.id === categoryId);
    if (!category) return;

    const mainEl = document.getElementById('bl-main');
    if (!mainEl) return;

    // 显示加载状态
    mainEl.innerHTML = `
      <div class="bl-loading">
        <div class="bl-loading-spinner"></div>
        <div class="bl-loading-text">正在从服务器读取配置...</div>
      </div>
    `;

    try {
      // 批量读取所有配置项的当前值（使用发行版感知的命令）
      const commands = category.items.map(item => resolveForDistro(item, this.detectedDistro).readCommand);
      const results = await this.executeBatchCommands(commands);

      // 解析结果
      for (let i = 0; i < category.items.length; i++) {
        const item = category.items[i];
        const output = results[i] || '';
        const regex = new RegExp(item.parseRegex, 'i');
        const match = output.match(regex);
        const value = match ? match[1].trim() : 'not set';
        this.currentValues.set(item.id, value);
      }

      // 渲染编辑器
      this.renderEditor(category);

      // 更新分类状态
      this.updateCategoryStatus(category);

    } catch (err) {
      mainEl.innerHTML = `
        <div class="bl-empty-state">
          <div class="bl-empty-title" style="color: #ef4444;">读取配置失败</div>
          <div class="bl-empty-desc">${String(err)}</div>
        </div>
      `;
    }
  }

  // ─── 渲染编辑器 ───

  private renderEditor(category: BaselineCategory): void {
    const mainEl = document.getElementById('bl-main');
    if (!mainEl) return;

    const renderer = (window as any).app?.modernUIRenderer?.baselineRenderer;
    if (!renderer) return;

    mainEl.innerHTML = renderer.renderConfigEditor(category, this.currentValues, this.pendingChanges);
  }

  // ─── 值变更处理 ───

  private handleValueChange(itemId: string, el: HTMLElement): void {
    let value: string;

    if (el instanceof HTMLSelectElement) {
      value = el.value;
    } else if (el instanceof HTMLInputElement) {
      if (el.type === 'checkbox') {
        // 查找配置项确定值格式
        const item = this.findItem(itemId);
        if (item && (item.enumValues?.includes('0') || item.enumValues?.includes('1'))) {
          value = el.checked ? '1' : '0';
        } else {
          value = el.checked ? 'yes' : 'no';
        }
      } else {
        value = el.value;
      }
    } else {
      return;
    }

    const currentVal = this.currentValues.get(itemId);
    if (value === currentVal) {
      this.pendingChanges.delete(itemId);
    } else {
      this.pendingChanges.set(itemId, value);
    }

    // 更新 UI
    this.updateItemUI(itemId);
    this.updateDiffBar();
  }

  // ─── 应用推荐值 ───

  private applyRecommended(itemId: string): void {
    const item = this.findItem(itemId);
    if (!item) return;

    this.pendingChanges.set(itemId, item.recommendedValue);

    // 刷新当前分类编辑器
    if (this.selectedCategoryId) {
      const category = baselineCategories.find(c => c.id === this.selectedCategoryId);
      if (category) this.renderEditor(category);
    }
    this.updateDiffBar();
  }

  private applyAllRecommended(): void {
    if (!this.selectedCategoryId) {
      (window as any).showNotification?.('请先选择一个配置分类', 'warning');
      return;
    }

    const category = baselineCategories.find(c => c.id === this.selectedCategoryId);
    if (!category) return;

    for (const item of category.items) {
      // 跳过不适用推荐值的项
      if (['按需设置', '按需配置', '无 NOPASSWD 条目', '非默认端口'].includes(item.recommendedValue)) continue;
      const currentVal = this.currentValues.get(item.id);
      if (currentVal !== item.recommendedValue) {
        this.pendingChanges.set(item.id, item.recommendedValue);
      }
    }

    this.renderEditor(category);
    this.updateDiffBar();
    (window as any).showNotification?.(`已将 ${category.title} 的配置项设为推荐值`, 'success');
  }

  // ─── 撤销 ───

  private revertItem(itemId: string): void {
    this.pendingChanges.delete(itemId);

    if (this.selectedCategoryId) {
      const category = baselineCategories.find(c => c.id === this.selectedCategoryId);
      if (category) this.renderEditor(category);
    }
    this.updateDiffBar();
  }

  private cancelAllChanges(): void {
    this.pendingChanges.clear();

    if (this.selectedCategoryId) {
      const category = baselineCategories.find(c => c.id === this.selectedCategoryId);
      if (category) this.renderEditor(category);
    }
    this.updateDiffBar();
  }

  // ─── 应用变更 ───

  private async applyChanges(): Promise<void> {
    if (this.pendingChanges.size === 0) {
      (window as any).showNotification?.('没有待应用的变更', 'info');
      return;
    }

    // 构建变更摘要
    const changeList: Array<{ item: BaselineConfigItem; oldValue: string; newValue: string }> = [];
    for (const [itemId, newVal] of this.pendingChanges) {
      const item = this.findItem(itemId);
      if (!item) continue;
      const oldVal = this.currentValues.get(itemId) ?? '?';
      if (oldVal !== newVal) {
        changeList.push({ item, oldValue: oldVal, newValue: newVal });
      }
    }

    if (changeList.length === 0) {
      (window as any).showNotification?.('没有实际需要变更的配置项', 'info');
      this.pendingChanges.clear();
      this.updateDiffBar();
      return;
    }

    // SSH 防锁定检查
    const sshPortChange = changeList.find(c => c.item.id === 'ssh-port');
    const sshPasswordChange = changeList.find(c => c.item.id === 'ssh-password-auth' && c.newValue === 'no');
    if (sshPortChange) {
      const { showConfirm } = await import('../ui/confirmDialog');
      const confirmed = await showConfirm({
        title: '危险操作警告',
        message: `您正在修改 SSH 端口 (${sshPortChange.oldValue} → ${sshPortChange.newValue})。\n\n如果防火墙未放行新端口，您可能会失去对服务器的访问！\n\n请确认已做好准备。`,
        confirmText: '我已确认',
        cancelText: '取消',
        dangerous: true,
      });
      if (!confirmed) return;
    }

    if (sshPasswordChange) {
      const { showConfirm } = await import('../ui/confirmDialog');
      const confirmed = await showConfirm({
        title: '注意',
        message: '您正在关闭 SSH 密码认证。请确保已配置密钥认证，否则可能无法登录服务器。',
        confirmText: '已配置密钥',
        cancelText: '取消',
        dangerous: true,
      });
      if (!confirmed) return;
    }

    // 确认对话框
    const summary = changeList.map(c => `  ${c.item.name}: ${c.oldValue} → ${c.newValue}`).join('\n');
    const { showConfirm } = await import('../ui/confirmDialog');
    const confirmed = await showConfirm({
      title: '确认应用变更',
      message: `即将修改以下 ${changeList.length} 项配置：\n\n${summary}\n\n将在修改前自动备份原文件。`,
      confirmText: '应用变更',
      cancelText: '取消',
    });
    if (!confirmed) return;

    // 执行备份 + 写入
    const applyBtn = document.getElementById('bl-btn-apply') as HTMLButtonElement;
    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.textContent = '应用中...';
    }

    try {
      // 按文件分组备份
      const backupCommands = new Set<string>();
      for (const c of changeList) {
        backupCommands.add(resolveForDistro(c.item, this.detectedDistro).backupCommand);
      }

      // 执行备份
      if (backupCommands.size > 0) {
        await this.executeBatchCommands(Array.from(backupCommands));
      }

      // 执行写入
      const writeCommands = changeList.map(c => resolveForDistro(c.item, this.detectedDistro).writeCommand(c.newValue));
      const results = await this.executeBatchCommands(writeCommands);

      // 检查结果
      let failCount = 0;
      for (let i = 0; i < results.length; i++) {
        if (results[i] === null) {
          failCount++;
          (window as any).showNotification?.(`${changeList[i].item.name} 写入失败`, 'error');
        }
      }

      if (failCount === 0) {
        (window as any).showNotification?.(`${changeList.length} 项配置已成功应用`, 'success');
      } else {
        (window as any).showNotification?.(`${changeList.length - failCount}/${changeList.length} 项配置已应用，${failCount} 项失败`, 'warning');
      }

      // 检查是否需要重启服务
      const services = new Set<string>();
      const restartCommands = new Map<string, string>();
      for (const c of changeList) {
        const resolved = resolveForDistro(c.item, this.detectedDistro);
        if (c.item.restartService && resolved.restartCommand) {
          services.add(c.item.restartService);
          restartCommands.set(c.item.restartService, resolved.restartCommand);
        }
      }

      if (services.size > 0) {
        const serviceNames = Array.from(services).join(', ');
        const restartConfirmed = await showConfirm({
          title: '重启服务',
          message: `以下服务需要重启才能使配置生效：\n\n${serviceNames}\n\n是否立即重启？`,
          confirmText: '重启服务',
          cancelText: '稍后手动重启',
        });

        if (restartConfirmed) {
          const cmds = Array.from(restartCommands.values());
          await this.executeBatchCommands(cmds);
          (window as any).showNotification?.(`服务 ${serviceNames} 已重启`, 'success');
        }
      }

      // 保存历史
      this.saveHistory(changeList);

      // 更新 currentValues 并清除 pendingChanges
      for (const c of changeList) {
        this.currentValues.set(c.item.id, c.newValue);
      }
      this.pendingChanges.clear();

      // 刷新编辑器
      if (this.selectedCategoryId) {
        const category = baselineCategories.find(cat => cat.id === this.selectedCategoryId);
        if (category) {
          this.renderEditor(category);
          this.updateCategoryStatus(category);
        }
      }
      this.updateDiffBar();

    } catch (err) {
      (window as any).showNotification?.(`应用变更失败: ${err}`, 'error');
    } finally {
      if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.textContent = '应用并保存';
      }
    }
  }

  // ─── UI 更新 ───

  private updateItemUI(itemId: string): void {
    const itemEl = document.querySelector(`[data-bl-item-id="${itemId}"].bl-config-item`) as HTMLElement;
    if (!itemEl) return;

    const isModified = this.pendingChanges.has(itemId);
    itemEl.classList.toggle('bl-modified', isModified);
  }

  private updateDiffBar(): void {
    const diffBar = document.getElementById('bl-diff-bar');
    const diffTitle = document.getElementById('bl-diff-title');
    const diffList = document.getElementById('bl-diff-list');

    // 计算实际变更数（排除值相同的）
    let realChangeCount = 0;
    for (const [itemId, newVal] of this.pendingChanges) {
      if (this.currentValues.get(itemId) !== newVal) realChangeCount++;
    }

    if (realChangeCount === 0) {
      if (diffBar) diffBar.style.display = 'none';
      return;
    }

    if (diffBar) diffBar.style.display = '';
    if (diffTitle) diffTitle.textContent = `待应用变更 (${realChangeCount}项)`;

    if (diffList) {
      const renderer = (window as any).app?.modernUIRenderer?.baselineRenderer;
      if (renderer) {
        diffList.innerHTML = renderer.renderDiffItems(this.pendingChanges, this.currentValues);
      }
    }
  }

  private toggleDiffPanel(): void {
    const diffBar = document.getElementById('bl-diff-bar');
    const diffContent = document.getElementById('bl-diff-content');
    if (!diffBar || !diffContent) return;

    const isExpanded = diffBar.classList.toggle('expanded');
    diffContent.style.display = isExpanded ? '' : 'none';
  }

  private updateCategoryStatus(category: BaselineCategory): void {
    const statusEl = document.getElementById(`bl-status-${category.id}`);
    if (!statusEl) return;

    let nonCompliantCount = 0;
    for (const item of category.items) {
      const val = this.currentValues.get(item.id) ?? '';
      const skipRecommended = ['按需设置', '按需配置', '无 NOPASSWD 条目', '非默认端口'];
      if (val && val !== 'not set' && val !== 'unknown' && val !== '...' && !skipRecommended.includes(item.recommendedValue) && val !== item.recommendedValue) {
        nonCompliantCount++;
      }
    }

    if (nonCompliantCount > 0) {
      statusEl.innerHTML = `<span style="color: #f97316; font-weight: 600;">⚠${nonCompliantCount}</span>`;
    } else {
      statusEl.innerHTML = `<span style="color: #22c55e;">✓</span>`;
    }
  }

  // ─── 搜索过滤 ───

  private filterItems(query: string): void {
    const items = document.querySelectorAll('.bl-config-item');
    items.forEach(el => {
      const itemEl = el as HTMLElement;
      if (!query) {
        itemEl.style.display = '';
        return;
      }

      const nameEl = itemEl.querySelector('.bl-item-name');
      const descEl = itemEl.querySelector('.bl-item-desc');
      const name = (nameEl?.textContent || '').toLowerCase();
      const desc = (descEl?.textContent || '').toLowerCase();
      const match = name.includes(query) || desc.includes(query);
      itemEl.style.display = match ? '' : 'none';
    });
  }

  // ─── 变更历史 ───

  private getHistoryKey(): string {
    const server = (window as any).app?.stateManager?.getState()?.currentServer || 'unknown';
    return `bl-history-${server}`;
  }

  private saveHistory(changeList: Array<{ item: BaselineConfigItem; oldValue: string; newValue: string }>): void {
    try {
      const key = this.getHistoryKey();
      const history: ChangeHistoryEntry[] = JSON.parse(localStorage.getItem(key) || '[]');
      const server = (window as any).app?.stateManager?.getState()?.currentServer || 'unknown';

      history.unshift({
        timestamp: new Date().toLocaleString('zh-CN'),
        server,
        changes: changeList.map(c => ({
          name: c.item.name,
          oldValue: c.oldValue,
          newValue: c.newValue,
          itemId: c.item.id,
        })),
      });

      // 最多保留 100 条
      if (history.length > 100) history.length = 100;
      localStorage.setItem(key, JSON.stringify(history));
    } catch {}
  }

  private async showHistory(): Promise<void> {
    const key = this.getHistoryKey();
    const history: ChangeHistoryEntry[] = JSON.parse(localStorage.getItem(key) || '[]');

    const renderer = (window as any).app?.modernUIRenderer?.baselineRenderer;
    if (!renderer) return;

    const content = renderer.renderHistoryModal(history);

    // 创建弹窗
    const overlay = document.createElement('div');
    overlay.className = 'bl-history-overlay';
    overlay.innerHTML = `
      <div class="bl-history-modal">
        <div class="bl-history-modal-header">
          <span class="bl-history-modal-title">变更历史</span>
          <button class="bl-history-modal-close" id="bl-history-close">&times;</button>
        </div>
        <div class="bl-history-modal-body">${content}</div>
      </div>
    `;

    document.body.appendChild(overlay);

    // 关闭事件
    const close = () => { overlay.remove(); };
    overlay.querySelector('#bl-history-close')?.addEventListener('click', close);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
    });
  }

  // ─── SSH 命令执行 ───

  private async executeCommand(command: string): Promise<string> {
    const tauriInvoke = (window as any).__TAURI__?.core?.invoke;
    const sshManager = (window as any).app?.sshManager;

    const withTimeout = <T>(p: Promise<T>, ms = 30000): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('执行超时')), ms);
        p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
      });
    };

    if (tauriInvoke) {
      try {
        const result: any = await withTimeout(tauriInvoke('ssh_execute_command_direct', { command }));
        if (result && typeof result === 'object') {
          return typeof result.output === 'string' ? result.output : typeof result.stdout === 'string' ? result.stdout : JSON.stringify(result);
        }
        return String(result ?? '');
      } catch (e: any) {
        if (sshManager?.executeCommand) {
          return await withTimeout(sshManager.executeCommand(command), 20000);
        }
        throw e;
      }
    } else if (sshManager?.executeCommand) {
      return await withTimeout(sshManager.executeCommand(command));
    }

    throw new Error('未连接到服务器');
  }

  private async executeBatchCommands(commands: string[]): Promise<string[]> {
    const tauriInvoke = (window as any).__TAURI__?.core?.invoke;

    if (tauriInvoke) {
      try {
        const results: any[] = await tauriInvoke('ssh_execute_batch_commands', { commands });
        return results.map((r: any) => {
          if (r.success && r.output) {
            return typeof r.output === 'object' ? (r.output.output || r.output.stdout || '') : String(r.output);
          }
          return r.error || '';
        });
      } catch {
        // 回退到逐条执行
        const results: string[] = [];
        for (const cmd of commands) {
          try {
            results.push(await this.executeCommand(cmd));
          } catch {
            results.push('');
          }
        }
        return results;
      }
    }

    // 逐条执行
    const results: string[] = [];
    for (const cmd of commands) {
      try {
        results.push(await this.executeCommand(cmd));
      } catch {
        results.push('');
      }
    }
    return results;
  }

  // ─── 工具 ───

  private findItem(itemId: string): BaselineConfigItem | undefined {
    for (const cat of baselineCategories) {
      const item = cat.items.find(i => i.id === itemId);
      if (item) return item;
    }
    return undefined;
  }

  // ═══════════════════════════════════════════
  //  新增：模式切换 / 文件编辑 / 快捷操作
  // ═══════════════════════════════════════════

  private switchMode(mode: 'form' | 'editor' | 'actions'): void {
    // 更新 tab 激活
    document.querySelectorAll('.bl-mode-tab').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-bl-mode') === mode);
    });

    const mainEl = document.getElementById('bl-main');
    if (!mainEl) return;

    const renderer = (window as any).app?.modernUIRenderer?.baselineRenderer;
    if (!renderer) return;

    const diffBar = document.getElementById('bl-diff-bar');

    if (mode === 'form') {
      // 恢复表单模式
      if (diffBar) diffBar.style.display = this.pendingChanges.size > 0 ? '' : 'none';
      if (this.selectedCategoryId) {
        const cat = baselineCategories.find(c => c.id === this.selectedCategoryId);
        if (cat) { this.renderEditor(cat); return; }
      }
      mainEl.innerHTML = `
        <div class="bl-empty-state">
          <div class="bl-empty-title">选择一个配置分类</div>
          <div class="bl-empty-desc">从左侧选择需要编辑的配置分类</div>
        </div>
      `;
    } else if (mode === 'editor') {
      if (diffBar) diffBar.style.display = 'none';
      mainEl.innerHTML = renderer.renderFileEditorPanel(
        this.editorFilePath || undefined,
        this.editorFilePath ? this.editorOriginalContent : undefined,
        false,
        this.editorModified,
      );
      if (this.editorFilePath) this.setupEditorLineNumbers();
    } else if (mode === 'actions') {
      if (diffBar) diffBar.style.display = 'none';
      mainEl.innerHTML = renderer.renderQuickActionsPanel();
    }
  }

  // ─── 文件编辑 ───

  private async openFile(filePath: string): Promise<void> {
    const mainEl = document.getElementById('bl-main');
    const renderer = (window as any).app?.modernUIRenderer?.baselineRenderer;
    if (!mainEl || !renderer) return;

    // 更新自定义路径输入
    const pathInput = document.getElementById('bl-custom-path') as HTMLInputElement;
    if (pathInput) pathInput.value = filePath;

    // 显示加载
    this.editorFilePath = filePath;
    mainEl.innerHTML = renderer.renderFileEditorPanel(filePath, undefined, true, false);

    // 更新选中状态
    document.querySelectorAll('.bl-file-chip').forEach(el => {
      el.classList.toggle('active', el.getAttribute('data-bl-filepath') === filePath);
    });

    try {
      // 优先 SFTP 读取
      const tauriInvoke = (window as any).__TAURI__?.core?.invoke;
      let content: string;
      if (tauriInvoke) {
        try {
          content = await tauriInvoke('sftp_read_file', { path: filePath, maxBytes: 1024 * 1024 });
        } catch {
          content = await this.executeCommand(`cat ${filePath} 2>/dev/null`);
        }
      } else {
        content = await this.executeCommand(`cat ${filePath} 2>/dev/null`);
      }

      this.editorOriginalContent = content;
      this.editorModified = false;
      mainEl.innerHTML = renderer.renderFileEditorPanel(filePath, content, false, false);
      this.setupEditorLineNumbers();

    } catch (err) {
      mainEl.innerHTML = renderer.renderFileEditorPanel(filePath, `读取文件失败: ${err}`, false, false);
    }
  }

  private setupEditorLineNumbers(): void {
    const textarea = document.getElementById('bl-file-textarea') as HTMLTextAreaElement;
    const lineNumbers = document.getElementById('bl-line-numbers');
    if (!textarea || !lineNumbers) return;

    const updateLineNumbers = () => {
      const lines = textarea.value.split('\n').length;
      lineNumbers.innerHTML = Array.from({ length: lines }, (_, i) => `<div>${i + 1}</div>`).join('');
    };

    updateLineNumbers();

    textarea.addEventListener('input', () => {
      updateLineNumbers();
      this.editorModified = textarea.value !== this.editorOriginalContent;
      const saveBtn = document.getElementById('bl-file-save-btn') as HTMLButtonElement;
      if (saveBtn) saveBtn.disabled = !this.editorModified;
      // 更新修改标记
      const badge = document.querySelector('.bl-file-editor-toolbar .bl-modified-badge');
      if (badge) (badge as HTMLElement).style.display = this.editorModified ? '' : 'none';
    });

    textarea.addEventListener('scroll', () => {
      lineNumbers.scrollTop = textarea.scrollTop;
    });

    // Ctrl+S 保存
    textarea.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.saveCurrentFile();
      }
      // Tab 缩进
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.substring(0, start) + '    ' + textarea.value.substring(end);
        textarea.selectionStart = textarea.selectionEnd = start + 4;
        textarea.dispatchEvent(new Event('input'));
      }
    });
  }

  private async saveCurrentFile(): Promise<void> {
    const textarea = document.getElementById('bl-file-textarea') as HTMLTextAreaElement;
    if (!textarea || !this.editorFilePath) return;

    const newContent = textarea.value;
    const saveBtn = document.getElementById('bl-file-save-btn') as HTMLButtonElement;
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '保存中...'; }

    try {
      // 备份
      await this.executeCommand(`cp -n ${this.editorFilePath} ${this.editorFilePath}_bak_$(date +%Y%m%d%H%M%S) 2>/dev/null; true`);

      // 写入
      const tauriInvoke = (window as any).__TAURI__?.core?.invoke;
      if (tauriInvoke) {
        try {
          await tauriInvoke('sftp_write_file', { path: this.editorFilePath, content: newContent });
        } catch {
          // 回退到 SSH tee
          await this.executeCommand(`cat << 'BLEOF' | tee ${this.editorFilePath} > /dev/null\n${newContent}\nBLEOF`);
        }
      } else {
        await this.executeCommand(`cat << 'BLEOF' | tee ${this.editorFilePath} > /dev/null\n${newContent}\nBLEOF`);
      }

      this.editorOriginalContent = newContent;
      this.editorModified = false;
      (window as any).showNotification?.(`${this.editorFilePath} 已保存（已备份原文件）`, 'success');

    } catch (err) {
      (window as any).showNotification?.(`保存失败: ${err}`, 'error');
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '备份并保存'; }
    }
  }

  // ─── 快捷操作 ───

  private async executeQuickAction(actionId: string): Promise<void> {
    const paramInput = document.getElementById(`bl-qa-input-${actionId}`) as HTMLInputElement;
    const param = paramInput?.value?.trim() || '';

    // 需要参数但没填
    const needsParam = ['block-ip', 'unblock-ip', 'block-port', 'kick-user', 'kill-pid', 'kill-name', 'kill-port',
      'lock-user', 'unlock-user', 'force-passwd', 'clear-crontab', 'clear-authkeys', 'clear-history', 'remove-sshkey-line',
      'query-user-chage', 'set-user-maxdays', 'set-user-warndays', 'set-user-mindays', 'expire-user-passwd',
      'set-user-nologin', 'delete-user', 'query-user-sudo-log'];
    if (needsParam.includes(actionId) && !param) {
      (window as any).showNotification?.('请输入参数', 'warning');
      paramInput?.focus();
      return;
    }

    // 安全校验
    if (param && /[;&|`$(){}]/.test(param)) {
      (window as any).showNotification?.('参数包含非法字符', 'error');
      return;
    }

    // 根据发行版选择防火墙命令
    const d = this.detectedDistro;
    const isAlpine = d === 'alpine';
    const hasNft = d === 'fedora' || d === 'rhel' || d === 'openeuler' || d === 'anolis';
    const blockIpCmd = (ip: string) => {
      if (isAlpine) return `iptables -A INPUT -s ${ip} -j DROP`;
      if (hasNft) return `firewall-cmd --permanent --add-rich-rule='rule family=ipv4 source address=${ip} drop' && firewall-cmd --reload || iptables -A INPUT -s ${ip} -j DROP`;
      return `(command -v ufw >/dev/null 2>&1 && ufw deny from ${ip}) || iptables -A INPUT -s ${ip} -j DROP`;
    };
    const unblockIpCmd = (ip: string) => {
      if (hasNft) return `firewall-cmd --permanent --remove-rich-rule='rule family=ipv4 source address=${ip} drop' 2>/dev/null; firewall-cmd --reload 2>/dev/null; iptables -D INPUT -s ${ip} -j DROP 2>/dev/null; echo done`;
      return `(command -v ufw >/dev/null 2>&1 && ufw delete deny from ${ip} 2>/dev/null); iptables -D INPUT -s ${ip} -j DROP 2>/dev/null; echo done`;
    };
    const blockPortCmd = (port: string) => {
      if (hasNft) return `firewall-cmd --permanent --remove-port=${port}/tcp 2>/dev/null; firewall-cmd --permanent --remove-port=${port}/udp 2>/dev/null; firewall-cmd --reload || (iptables -A INPUT -p tcp --dport ${port} -j DROP && iptables -A INPUT -p udp --dport ${port} -j DROP)`;
      return `(command -v ufw >/dev/null 2>&1 && ufw deny ${port}) || (iptables -A INPUT -p tcp --dport ${port} -j DROP && iptables -A INPUT -p udp --dport ${port} -j DROP)`;
    };
    // Alpine 没有 usermod -s，用 /etc/passwd 直接改
    const lockUserCmd = (u: string) => isAlpine
      ? `passwd -l ${u} 2>/dev/null; sed -i 's|^${u}:\\([^:]*\\):\\([^:]*\\):\\([^:]*\\):\\([^:]*\\):\\([^:]*\\):.*|${u}:\\1:\\2:\\3:\\4:\\5:/sbin/nologin|' /etc/passwd`
      : `passwd -l ${u} && usermod -s /sbin/nologin ${u}`;
    const unlockUserCmd = (u: string) => isAlpine
      ? `passwd -u ${u} 2>/dev/null; sed -i 's|^${u}:\\([^:]*\\):\\([^:]*\\):\\([^:]*\\):\\([^:]*\\):\\([^:]*\\):.*|${u}:\\1:\\2:\\3:\\4:\\5:/bin/sh|' /etc/passwd`
      : `passwd -u ${u} && usermod -s /bin/bash ${u}`;
    // Alpine 没有 chage
    const forcePasswdCmd = (u: string) => isAlpine
      ? `passwd -e ${u} 2>/dev/null || echo 'Alpine: 请手动执行 passwd ${u}'`
      : `chage -d 0 ${u}`;
    // Ctrl+Alt+Del: Alpine 用 inittab
    const disableCtrlAltDelCmd = isAlpine
      ? `sed -i 's/^ca::ctrlaltdel:/#ca::ctrlaltdel:/' /etc/inittab 2>/dev/null; echo done`
      : `systemctl mask ctrl-alt-del.target && systemctl daemon-reload && echo done`;

    const commandMap: Record<string, () => { cmd: string; desc: string; dangerous?: boolean }> = {
      'block-ip':      () => ({ cmd: blockIpCmd(param), desc: `封禁 IP: ${param}`, dangerous: true }),
      'unblock-ip':    () => ({ cmd: unblockIpCmd(param), desc: `解封 IP: ${param}` }),
      'block-port':    () => ({ cmd: blockPortCmd(param), desc: `封禁端口: ${param}`, dangerous: true }),
      'kick-user':     () => ({ cmd: `pkill -KILL -u ${param}`, desc: `踢出用户: ${param}`, dangerous: true }),
      'kill-pid':      () => ({ cmd: `kill -9 ${param}`, desc: `杀进程 PID: ${param}`, dangerous: true }),
      'kill-name':     () => ({ cmd: `pkill -9 ${param}`, desc: `杀进程: ${param}`, dangerous: true }),
      'kill-port':     () => ({ cmd: `fuser -k ${param}/tcp 2>/dev/null; fuser -k ${param}/udp 2>/dev/null; echo done`, desc: `杀端口监听: ${param}`, dangerous: true }),
      'lock-user':     () => ({ cmd: lockUserCmd(param), desc: `锁定用户: ${param}`, dangerous: true }),
      'unlock-user':   () => ({ cmd: unlockUserCmd(param), desc: `解锁用户: ${param}` }),
      'force-passwd':  () => ({ cmd: forcePasswdCmd(param), desc: `强制用户 ${param} 下次登录改密` }),
      'who-online':    () => ({ cmd: `echo '=== who ===' && who && echo '=== w ===' && w`, desc: '查看在线用户' }),
      'clear-crontab': () => ({ cmd: `crontab -r -u ${param} 2>/dev/null; echo "crontab cleared for ${param}"`, desc: `清理 ${param} 的 crontab`, dangerous: true }),
      'clear-authkeys': () => ({ cmd: `eval h=~${param} && > "$h/.ssh/authorized_keys" 2>/dev/null && echo "cleared" || echo "failed"`, desc: `清空 ${param} 的 authorized_keys`, dangerous: true }),
      'clear-history':  () => ({ cmd: `eval h=~${param} && > "$h/.bash_history" 2>/dev/null && echo "cleared"`, desc: `清空 ${param} 的 bash_history` }),
      'clean-tmp':      () => ({ cmd: `find /tmp /var/tmp /dev/shm -type f -executable -delete 2>/dev/null; echo "cleaned"`, desc: '清理 /tmp 可执行文件', dangerous: true }),
      'remove-sshkey-line': () => ({ cmd: `grep -rl '${param}' /root/.ssh/authorized_keys /home/*/.ssh/authorized_keys 2>/dev/null | while read f; do sed -i '/${param}/d' "$f" && echo "cleaned: $f"; done; echo done`, desc: `删除含 "${param}" 的公钥行`, dangerous: true }),
      // 一键加固
      'set-tmout':     () => ({ cmd: `grep -q '^\\(export \\)\\?TMOUT=' /etc/profile && sed -i 's/^\\(export \\)\\?TMOUT=.*/export TMOUT=600/' /etc/profile || echo 'export TMOUT=600' >> /etc/profile`, desc: '设置会话超时 600s' }),
      'set-histformat': () => ({ cmd: `grep -q 'HISTTIMEFORMAT' /etc/profile && sed -i "s/^.*HISTTIMEFORMAT.*/export HISTTIMEFORMAT='%F %T '/" /etc/profile || echo "export HISTTIMEFORMAT='%F %T '" >> /etc/profile`, desc: '启用历史时间戳' }),
      'disable-usb':    () => ({ cmd: `echo 'install usb-storage /bin/true' > /etc/modprobe.d/disable-usb-storage.conf && rmmod usb_storage 2>/dev/null; echo done`, desc: '禁用 USB 存储' }),
      'disable-ctrlaltdel': () => ({ cmd: disableCtrlAltDelCmd, desc: '禁用 Ctrl+Alt+Del' }),
      'set-banner':     () => ({ cmd: `echo 'Authorized users only. All activity may be monitored and reported.' | tee /etc/issue /etc/issue.net > /dev/null && echo done`, desc: '设置登录警告 Banner' }),
      'disable-core':   () => ({ cmd: `grep -q '^\\*.*hard.*core' /etc/security/limits.conf && sed -i 's/^\\*.*hard.*core.*/*               hard    core            0/' /etc/security/limits.conf || echo '*               hard    core            0' >> /etc/security/limits.conf`, desc: '禁用 Core dump' }),
      // ── 用户账户操作 ──
      'query-user-chage': () => ({ cmd: `chage -l ${param} 2>/dev/null || echo '用户不存在或无权限'`, desc: `查询 ${param} 密码策略` }),
      'set-user-maxdays': () => {
        const parts = param.split(/\s+/);
        return { cmd: `chage -M ${parts[0]} ${parts[1]} && chage -l ${parts[1]}`, desc: `设置 ${parts[1]} 密码最大天数=${parts[0]}` };
      },
      'set-user-warndays': () => {
        const parts = param.split(/\s+/);
        return { cmd: `chage -W ${parts[0]} ${parts[1]} && chage -l ${parts[1]}`, desc: `设置 ${parts[1]} 密码警告天数=${parts[0]}` };
      },
      'set-user-mindays': () => {
        const parts = param.split(/\s+/);
        return { cmd: `chage -m ${parts[0]} ${parts[1]} && chage -l ${parts[1]}`, desc: `设置 ${parts[1]} 密码最小天数=${parts[0]}` };
      },
      'expire-user-passwd': () => ({ cmd: `chage -d 0 ${param} && echo '已设置，用户下次登录需修改密码'`, desc: `强制 ${param} 下次改密` }),
      'set-user-nologin': () => ({ cmd: isAlpine ? `sed -i 's|^${param}:.*:/bin/.*|${param}:\\&:/sbin/nologin|' /etc/passwd` : `usermod -s /sbin/nologin ${param}`, desc: `禁止 ${param} 登录`, dangerous: true }),
      'delete-user': () => ({ cmd: `userdel -r ${param} 2>/dev/null && echo '用户已删除' || echo '删除失败'`, desc: `删除用户 ${param}`, dangerous: true }),
      // ── 信息采集 ──
      'query-ssh-version': () => ({ cmd: `ssh -V 2>&1`, desc: '查看 SSH 版本' }),
      'query-kernel': () => ({ cmd: `uname -a`, desc: '查看内核版本' }),
      'query-login-defs': () => ({ cmd: `grep -E '^PASS_MAX_DAYS|^PASS_MIN_DAYS|^PASS_MIN_LEN|^PASS_WARN_AGE' /etc/login.defs 2>/dev/null || echo '文件不存在'`, desc: '查看密码策略文件' }),
      'query-user-sudo-log': () => ({ cmd: `(grep -i '${param}.*sudo\\|sudo.*${param}' /var/log/auth.log /var/log/secure 2>/dev/null || journalctl _COMM=sudo 2>/dev/null | grep -i '${param}') | tail -30 || echo '(无记录)'`, desc: `查询 ${param} 的 sudo 日志` }),
      'query-malicious-ports': () => ({ cmd: `echo '=== 恶意端口扫描 ===' && (ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) | grep -E ':1234\\b|:2333\\b|:3333\\b|:4444\\b|:4445\\b|:5555\\b|:6666\\b|:6667\\b|:7777\\b|:8888\\b|:9999\\b|:1080\\b|:3128\\b|:4443\\b|:5900\\b|:31337\\b|:12345\\b|:23456\\b|:65535\\b|:14444\\b|:55553\\b' || echo '(未发现已知恶意端口)' && echo '=== 高端口(>10000) ===' && (ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) | awk '{if(match($0,/:([0-9]+) /,m) && m[1]>10000)print}'`, desc: '恶意端口扫描' }),
      'query-suspicious-users': () => ({ cmd: `echo '=== UID=0 ===' && awk -F: '$3==0{print $1}' /etc/passwd && echo '=== 空密码 ===' && awk -F: '($2==""){print $1}' /etc/shadow 2>/dev/null && echo '=== 异常Shell ===' && awk -F: '$7 ~ /(bash|sh|zsh)$/ && ($3>=1000||$3==0){print $1,"UID="$3}' /etc/passwd && echo '=== 权限分离检查 ===' && getent group sudo wheel 2>/dev/null && echo '=== NOPASSWD ===' && grep -r NOPASSWD /etc/sudoers /etc/sudoers.d/ 2>/dev/null | grep -v '^#'`, desc: '可疑用户全面检测' }),
      'query-all-listening': () => ({ cmd: `(ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) && echo '=== UDP ===' && (ss -ulnp 2>/dev/null || netstat -ulnp 2>/dev/null)`, desc: '所有监听端口' }),
    };

    const gen = commandMap[actionId];
    if (!gen) { (window as any).showNotification?.('未知操作', 'error'); return; }
    const { cmd, desc, dangerous } = gen();

    // 危险操作确认
    if (dangerous) {
      const { showConfirm } = await import('../ui/confirmDialog');
      const ok = await showConfirm({
        title: '确认执行',
        message: `${desc}\n\n命令: ${cmd}`,
        confirmText: '执行',
        cancelText: '取消',
        dangerous: true,
      });
      if (!ok) return;
    }

    // 执行
    const execBtn = document.querySelector(`[data-bl-action="exec-quick-action"][data-bl-qa-id="${actionId}"]`) as HTMLButtonElement;
    if (execBtn) { execBtn.disabled = true; execBtn.textContent = '执行中...'; }

    try {
      const output = await this.executeCommand(cmd);
      (window as any).showNotification?.(`${desc} — 完成`, 'success');

      // 对于有输出的命令（如 who-online），显示结果
      // 查询类操作展示结果
      const showResultActions = ['who-online', 'query-user-chage', 'query-ssh-version', 'query-kernel',
        'query-login-defs', 'query-user-sudo-log', 'query-malicious-ports', 'query-suspicious-users', 'query-all-listening'];
      if (output.trim() && showResultActions.includes(actionId)) {
        const { showAlert } = await import('../ui/confirmDialog');
        await showAlert({ title: desc, message: output.substring(0, 2000), type: 'info' });
      }
    } catch (err) {
      (window as any).showNotification?.(`${desc} — 失败: ${err}`, 'error');
    } finally {
      if (execBtn) { execBtn.disabled = false; execBtn.textContent = needsParam.includes(actionId) ? '执行' : '一键执行'; }
    }
  }
}
