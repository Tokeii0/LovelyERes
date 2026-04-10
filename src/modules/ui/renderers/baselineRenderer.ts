/**
 * Baseline Quick Edit Renderer
 * 渲染基线配置快速编辑页面
 */

import type { AppState } from '../../core/app';
import {
  baselineCategories,
  riskColors,
  riskLabels,
  type BaselineCategory,
  type BaselineConfigItem,
} from '../../baseline/baselineConfigs';
import {
  Key,
  Lock,
  Cpu,
  Shield,
  User,
  System,
  Log,
  NetworkTree,
  Search,
  Refresh,
  Lightning,
  History,
  CheckOne,
  CloseOne,
  Caution,
  Down,
  Time,
  FileText,
  Fire,
  Config,
  Analysis,
} from '@icon-park/svg';

const iconMap: Record<string, (opts: any) => string> = {
  Key, Lock, Cpu, Shield, User, System, Log, NetworkTree,
  Time, FileText, Fire, Config, Analysis,
};

export class BaselineRenderer {
  constructor(_state: AppState) {}

  setState(_state: AppState): void {}


  // ─── 主页面 ───

  renderBaselineQuickEditPage(): string {
    return `
      <div class="baseline-quick-edit-page">
        ${this.renderToolbar()}
        ${this.renderModeTabs('form')}
        <div class="bl-panels">
          ${this.renderSidebar()}
          <div class="bl-main" id="bl-main">
            ${this.renderEmptyState()}
          </div>
        </div>
        ${this.renderDiffBar()}
      </div>
    `;
  }

  // ─── 模式 Tab ───

  renderModeTabs(currentMode: string): string {
    const tabs = [
      { id: 'form', label: '表单模式', icon: Config({ theme: 'outline', size: '14', fill: 'currentColor' }) },
      { id: 'editor', label: '文件编辑', icon: FileText({ theme: 'outline', size: '14', fill: 'currentColor' }) },
      { id: 'actions', label: '快捷操作', icon: Lightning({ theme: 'outline', size: '14', fill: 'currentColor' }) },
    ];
    return `
      <div class="bl-mode-tabs">
        ${tabs.map(t => `
          <button class="bl-mode-tab ${currentMode === t.id ? 'active' : ''}" data-bl-action="switch-mode" data-bl-mode="${t.id}">
            ${t.icon} ${t.label}
          </button>
        `).join('')}
      </div>
    `;
  }

  // ─── 文件编辑器面板 ───

  renderFileEditorPanel(filePath?: string, content?: string, isLoading?: boolean, isModified?: boolean): string {
    const commonFiles = [
      '/etc/ssh/sshd_config', '/etc/login.defs', '/etc/sysctl.conf',
      '/etc/security/pwquality.conf', '/etc/pam.d/system-auth', '/etc/pam.d/common-password',
      '/etc/audit/auditd.conf', '/etc/selinux/config', '/etc/hosts.allow',
      '/etc/hosts.deny', '/etc/issue', '/etc/issue.net',
      '/etc/profile', '/etc/bashrc', '/etc/security/limits.conf',
      '/etc/crontab', '/etc/resolv.conf', '/etc/rsyslog.conf',
      '/etc/security/faillock.conf', '/etc/systemd/coredump.conf',
      '/etc/passwd', '/etc/shadow', '/etc/group',
    ];

    const fileChips = commonFiles.map(f => `
      <button class="bl-file-chip ${filePath === f ? 'active' : ''}" data-bl-action="open-file" data-bl-filepath="${f}" title="${f}">
        ${f.split('/').pop()}
      </button>
    `).join('');

    const editorContent = isLoading
      ? `<div class="bl-loading"><div class="bl-loading-spinner"></div><div class="bl-loading-text">加载文件中...</div></div>`
      : filePath && content !== undefined
        ? `<div class="bl-file-editor-area">
            <div class="bl-file-editor-toolbar">
              <span class="bl-file-path-display">${this.escapeHtml(filePath)}</span>
              ${isModified ? '<span class="bl-modified-badge">已修改</span>' : ''}
              <div class="bl-file-editor-actions">
                <button class="bl-btn-secondary" data-bl-action="reload-file" title="重新加载">
                  ${Refresh({ theme: 'outline', size: '14', fill: 'currentColor' })} 重新加载
                </button>
                <button class="bl-btn-primary" id="bl-file-save-btn" data-bl-action="save-file" ${!isModified ? 'disabled' : ''}>
                  ${CheckOne({ theme: 'outline', size: '14', fill: 'currentColor' })} 备份并保存
                </button>
              </div>
            </div>
            <div class="bl-file-editor-wrapper">
              <div class="bl-line-numbers" id="bl-line-numbers"></div>
              <textarea class="bl-file-textarea" id="bl-file-textarea" spellcheck="false">${this.escapeHtml(content)}</textarea>
            </div>
          </div>`
        : `<div class="bl-empty-state">
            <div class="bl-empty-icon">${FileText({ theme: 'outline', size: '48', fill: 'currentColor' })}</div>
            <div class="bl-empty-title">选择一个配置文件</div>
            <div class="bl-empty-desc">点击上方文件名快速打开，或输入自定义路径</div>
          </div>`;

    return `
      <div class="bl-file-editor-panel">
        <div class="bl-file-selector">
          <div class="bl-file-chips">${fileChips}</div>
          <div class="bl-custom-path-row">
            <input type="text" class="bl-input-text bl-custom-path" id="bl-custom-path" placeholder="输入文件路径，如 /etc/nginx/nginx.conf" value="${filePath ? this.escapeHtml(filePath) : ''}" />
            <button class="bl-btn-primary" data-bl-action="open-custom-file" style="white-space:nowrap;">打开</button>
          </div>
        </div>
        <div class="bl-file-content" id="bl-file-content">
          ${editorContent}
        </div>
      </div>
    `;
  }

  // ─── 快捷操作面板 ───

  renderQuickActionsPanel(): string {
    const groups = [
      {
        title: '应急封堵',
        icon: Shield({ theme: 'outline', size: '16', fill: 'currentColor' }),
        actions: [
          { id: 'block-ip', name: '封禁 IP', desc: 'iptables -A INPUT -s IP -j DROP', param: 'IP 地址', placeholder: '192.168.1.100', risk: 'high' as const },
          { id: 'unblock-ip', name: '解封 IP', desc: 'iptables -D INPUT -s IP -j DROP', param: 'IP 地址', placeholder: '192.168.1.100', risk: 'medium' as const },
          { id: 'block-port', name: '封禁端口', desc: '阻止指定端口的入站连接', param: '端口号', placeholder: '4444', risk: 'high' as const },
          { id: 'kick-user', name: '踢出用户', desc: 'pkill -KILL -u username', param: '用户名', placeholder: 'hacker', risk: 'high' as const },
          { id: 'kill-pid', name: '杀进程(PID)', desc: 'kill -9 PID', param: 'PID', placeholder: '12345', risk: 'high' as const },
          { id: 'kill-name', name: '杀进程(名称)', desc: 'pkill -9 name', param: '进程名', placeholder: 'nc', risk: 'high' as const },
          { id: 'kill-port', name: '杀端口监听', desc: '杀监听指定端口的进程', param: '端口号', placeholder: '4444', risk: 'high' as const },
        ],
      },
      {
        title: '账户安全',
        icon: User({ theme: 'outline', size: '16', fill: 'currentColor' }),
        actions: [
          { id: 'lock-user', name: '锁定用户', desc: 'passwd -l && 禁止登录Shell', param: '用户名', placeholder: 'testuser', risk: 'high' as const },
          { id: 'unlock-user', name: '解锁用户', desc: 'passwd -u && 恢复登录Shell', param: '用户名', placeholder: 'testuser', risk: 'medium' as const },
          { id: 'force-passwd', name: '强制改密', desc: '下次登录必须修改密码', param: '用户名', placeholder: 'testuser', risk: 'medium' as const },
          { id: 'who-online', name: '查看在线用户', desc: '显示当前登录的用户列表', param: '', placeholder: '', risk: 'low' as const },
        ],
      },
      {
        title: '应急清理',
        icon: Fire({ theme: 'outline', size: '16', fill: 'currentColor' }),
        actions: [
          { id: 'clear-crontab', name: '清理用户 crontab', desc: '删除指定用户的所有定时任务', param: '用户名', placeholder: 'www-data', risk: 'critical' as const },
          { id: 'clear-authkeys', name: '清空 authorized_keys', desc: '删除指定用户的 SSH 公钥', param: '用户名', placeholder: 'root', risk: 'critical' as const },
          { id: 'clear-history', name: '清空 bash_history', desc: '清除指定用户的命令历史', param: '用户名', placeholder: 'root', risk: 'medium' as const },
          { id: 'clean-tmp', name: '清理 /tmp 可执行文件', desc: '删除 /tmp 下所有可执行文件', param: '', placeholder: '', risk: 'critical' as const },
          { id: 'remove-sshkey-line', name: '删除指定公钥行', desc: '从 authorized_keys 中删除包含关键字的行', param: '关键字', placeholder: 'attacker@', risk: 'high' as const },
        ],
      },
      {
        title: '快速加固',
        icon: Lightning({ theme: 'outline', size: '16', fill: 'currentColor' }),
        actions: [
          { id: 'set-tmout', name: '设置会话超时', desc: 'export TMOUT=600 写入 /etc/profile', param: '', placeholder: '', risk: 'low' as const },
          { id: 'set-histformat', name: '启用历史时间戳', desc: 'HISTTIMEFORMAT 写入 /etc/profile', param: '', placeholder: '', risk: 'low' as const },
          { id: 'disable-usb', name: '禁用 USB 存储', desc: '加载黑名单到 modprobe.d', param: '', placeholder: '', risk: 'medium' as const },
          { id: 'disable-ctrlaltdel', name: '禁用 Ctrl+Alt+Del', desc: 'mask ctrl-alt-del.target', param: '', placeholder: '', risk: 'low' as const },
          { id: 'set-banner', name: '设置登录警告', desc: '写入标准授权警告到 issue/issue.net', param: '', placeholder: '', risk: 'low' as const },
          { id: 'disable-core', name: '禁用 Core dump', desc: '限制 core dump 到 limits.conf', param: '', placeholder: '', risk: 'low' as const },
        ],
      },
      {
        title: '用户账户操作',
        icon: User({ theme: 'outline', size: '16', fill: 'currentColor' }),
        actions: [
          { id: 'query-user-chage', name: '查询用户密码策略', desc: 'chage -l username 查看密码过期信息', param: '用户名', placeholder: 'xiaoming', risk: 'low' as const },
          { id: 'set-user-maxdays', name: '设置密码最大天数', desc: 'chage -M days username', param: '天数 用户名', placeholder: '90 xiaoming', risk: 'medium' as const },
          { id: 'set-user-warndays', name: '设置密码警告天数', desc: 'chage -W days username', param: '天数 用户名', placeholder: '14 xiaoming', risk: 'low' as const },
          { id: 'set-user-mindays', name: '设置密码最小天数', desc: 'chage -m days username', param: '天数 用户名', placeholder: '7 xiaoming', risk: 'low' as const },
          { id: 'expire-user-passwd', name: '立即过期密码', desc: 'chage -d 0 username 下次登录必须改密', param: '用户名', placeholder: 'zhangsan', risk: 'medium' as const },
          { id: 'set-user-nologin', name: '禁止用户登录', desc: 'usermod -s /sbin/nologin', param: '用户名', placeholder: 'ftpuser', risk: 'high' as const },
          { id: 'delete-user', name: '删除用户', desc: 'userdel -r username 连同家目录', param: '用户名', placeholder: 'hacker', risk: 'critical' as const },
        ],
      },
      {
        title: '信息采集',
        icon: Search({ theme: 'outline', size: '16', fill: 'currentColor' }),
        actions: [
          { id: 'query-ssh-version', name: '查看 SSH 版本', desc: 'ssh -V', param: '', placeholder: '', risk: 'low' as const },
          { id: 'query-kernel', name: '查看内核版本', desc: 'uname -r', param: '', placeholder: '', risk: 'low' as const },
          { id: 'query-login-defs', name: '查看密码策略文件', desc: '/etc/login.defs 中的 PASS_* 配置', param: '', placeholder: '', risk: 'low' as const },
          { id: 'query-user-sudo-log', name: '查询用户sudo日志', desc: '在日志中搜索指定用户的 sudo 记录', param: '用户名', placeholder: 'zhangsan', risk: 'low' as const },
          { id: 'query-malicious-ports', name: '恶意端口扫描', desc: '扫描常见木马/后门/挖矿端口', param: '', placeholder: '', risk: 'low' as const },
          { id: 'query-suspicious-users', name: '可疑用户检测', desc: 'UID=0 + 空密码 + 异常Shell', param: '', placeholder: '', risk: 'low' as const },
          { id: 'query-all-listening', name: '所有监听端口', desc: 'ss -tlnp 显示监听端口和进程', param: '', placeholder: '', risk: 'low' as const },
        ],
      },
    ];

    return `
      <div class="bl-quick-actions-panel">
        ${groups.map(g => `
          <div class="bl-qa-group">
            <div class="bl-qa-group-header">${g.icon} ${g.title}</div>
            <div class="bl-qa-grid">
              ${g.actions.map(a => {
                const riskColor = riskColors[a.risk];
                const riskLabel = riskLabels[a.risk];
                return `
                  <div class="bl-qa-card" data-bl-qa-id="${a.id}">
                    <div class="bl-qa-card-header">
                      <span class="bl-qa-name">${a.name}</span>
                      <span class="bl-risk-badge" style="background:${riskColor}15;color:${riskColor};border:1px solid ${riskColor}40">${riskLabel}</span>
                    </div>
                    <div class="bl-qa-desc">${a.desc}</div>
                    ${a.param ? `
                      <div class="bl-qa-input-row">
                        <input type="text" class="bl-qa-input" id="bl-qa-input-${a.id}" placeholder="${a.placeholder}" data-bl-qa-param="${a.id}" />
                        <button class="bl-qa-exec-btn" data-bl-action="exec-quick-action" data-bl-qa-id="${a.id}">执行</button>
                      </div>
                    ` : `
                      <button class="bl-qa-exec-btn bl-qa-exec-full" data-bl-action="exec-quick-action" data-bl-qa-id="${a.id}">一键执行</button>
                    `}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ─── 工具栏 ───

  private renderToolbar(): string {
    return `
      <div class="bl-toolbar">
        <div class="bl-system-badge" id="bl-system-badge">
          <span class="bl-sys-icon">${System({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
          <span class="bl-sys-name" id="bl-sys-name">检测中...</span>
        </div>
        <div class="bl-search-wrapper">
          <span>${Search({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
          <input type="text" class="bl-search-input" id="bl-search-input" placeholder="搜索配置项..." />
        </div>
        <button class="bl-toolbar-btn" id="bl-btn-refresh" title="刷新当前分类">
          ${Refresh({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span class="bl-btn-label">刷新</span>
        </button>
        <button class="bl-toolbar-btn bl-btn-recommend" id="bl-btn-recommend-all" title="将当前分类所有项设为推荐值">
          ${Lightning({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span class="bl-btn-label">一键推荐</span>
        </button>
        <button class="bl-toolbar-btn" id="bl-btn-history" title="查看变更历史">
          ${History({ theme: 'outline', size: '16', fill: 'currentColor' })}
          <span class="bl-btn-label">历史</span>
        </button>
      </div>
    `;
  }

  // ─── 左侧分类列表 ───

  private renderSidebar(): string {
    const groups = baselineCategories.map((cat) => {
      const iconFn = iconMap[cat.icon];
      const icon = iconFn ? iconFn({ theme: 'outline', size: '16', fill: 'currentColor' }) : '';
      return `
        <div class="bl-group" data-bl-category="${cat.id}">
          <div class="bl-group-header" data-bl-action="select-category" data-bl-category-id="${cat.id}">
            <span class="bl-group-icon">${icon}</span>
            <span class="bl-group-title">${cat.title}</span>
            <span class="bl-group-count">${cat.items.length}项</span>
            <span class="bl-group-status" id="bl-status-${cat.id}"></span>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="bl-sidebar">
        <div class="bl-sidebar-header">配置分类</div>
        <div class="bl-sidebar-list">
          ${groups}
        </div>
      </div>
    `;
  }

  // ─── 空状态 ───

  private renderEmptyState(): string {
    return `
      <div class="bl-empty-state">
        <div class="bl-empty-icon">${Shield({ theme: 'outline', size: '48', fill: 'currentColor' })}</div>
        <div class="bl-empty-title">选择一个配置分类</div>
        <div class="bl-empty-desc">从左侧选择需要编辑的配置分类，将自动从服务器读取当前配置值</div>
      </div>
    `;
  }

  // ─── 配置编辑器 ───

  renderConfigEditor(
    category: BaselineCategory,
    currentValues: Map<string, string>,
    pendingChanges: Map<string, string>,
  ): string {
    const items = category.items.map(item => {
      const currentVal = currentValues.get(item.id) ?? '...';
      const pendingVal = pendingChanges.get(item.id);
      const displayVal = pendingVal !== undefined ? pendingVal : currentVal;
      const isModified = pendingVal !== undefined && pendingVal !== currentVal;
      const isNonCompliant = currentVal !== '...' && currentVal !== 'unknown' && currentVal !== item.recommendedValue && item.recommendedValue !== '按需设置' && item.recommendedValue !== '按需配置' && item.recommendedValue !== '无 NOPASSWD 条目' && item.recommendedValue !== '非默认端口';
      const riskColor = riskColors[item.riskLevel];
      const riskLabel = riskLabels[item.riskLevel];

      return `
        <div class="bl-config-item ${isModified ? 'bl-modified' : ''} ${isNonCompliant ? 'bl-noncompliant' : ''}" data-bl-item-id="${item.id}">
          <div class="bl-item-header">
            <span class="bl-item-name">${this.escapeHtml(item.name)}</span>
            <span class="bl-risk-badge" style="background: ${riskColor}15; color: ${riskColor}; border: 1px solid ${riskColor}40">${riskLabel}</span>
            ${item.complianceRef ? `<span class="bl-compliance-ref">${this.escapeHtml(item.complianceRef)}</span>` : ''}
            ${isModified ? `<span class="bl-modified-badge">已修改</span>` : ''}
          </div>
          <div class="bl-item-desc">${this.escapeHtml(item.description)}</div>
          <div class="bl-item-values">
            <div class="bl-value-row">
              <span class="bl-value-label">当前值:</span>
              <span class="bl-value-current ${isNonCompliant ? 'bl-value-warn' : 'bl-value-ok'}" id="bl-current-${item.id}">${this.escapeHtml(currentVal)}</span>
              <span class="bl-value-label">推荐值:</span>
              <span class="bl-value-recommended">${this.escapeHtml(item.recommendedValue)}</span>
              ${item.filePath !== '(动态检测)' && item.filePath !== '(systemd)' ? `<span class="bl-value-filepath" title="${this.escapeHtml(item.filePath)}">${this.escapeHtml(item.filePath)}</span>` : ''}
            </div>
            <div class="bl-edit-row">
              ${this.renderEditControl(item, displayVal)}
              ${item.recommendedValue !== '按需设置' && item.recommendedValue !== '按需配置' && item.recommendedValue !== '无 NOPASSWD 条目' && item.recommendedValue !== '非默认端口' ? `
                <button class="bl-btn-apply-rec" data-bl-action="apply-recommended" data-bl-item-id="${item.id}" title="应用推荐值: ${this.escapeHtml(item.recommendedValue)}">
                  ${Lightning({ theme: 'outline', size: '14', fill: 'currentColor' })} 推荐值
                </button>
              ` : ''}
              ${isModified ? `
                <button class="bl-btn-revert" data-bl-action="revert-item" data-bl-item-id="${item.id}" title="撤销修改">
                  ${CloseOne({ theme: 'outline', size: '14', fill: 'currentColor' })} 撤销
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    const iconFn = iconMap[category.icon];
    const icon = iconFn ? iconFn({ theme: 'outline', size: '20', fill: 'currentColor' }) : '';

    return `
      <div class="bl-editor">
        <div class="bl-editor-header">
          <span class="bl-editor-icon">${icon}</span>
          <span class="bl-editor-title">${this.escapeHtml(category.title)}</span>
          ${category.hint ? `<span class="bl-editor-hint">${this.escapeHtml(category.hint)}</span>` : ''}
        </div>
        <div class="bl-config-list" id="bl-config-list">
          ${items}
        </div>
      </div>
    `;
  }

  // ─── 编辑控件 ───

  private renderEditControl(item: BaselineConfigItem, currentValue: string): string {
    const val = currentValue === '...' || currentValue === 'unknown' || currentValue === 'not set' ? item.defaultValue : currentValue;

    if (item.type === 'enum' && item.enumValues) {
      const options = item.enumValues.map(v => {
        const selected = v === val ? 'selected' : '';
        return `<option value="${this.escapeHtml(v)}" ${selected}>${this.escapeHtml(v)}</option>`;
      }).join('');
      return `<select class="bl-select" data-bl-action="change-value" data-bl-item-id="${item.id}">${options}</select>`;
    }

    if (item.type === 'boolean') {
      const checked = val === 'yes' || val === '1' || val === 'true' ? 'checked' : '';
      return `
        <label class="bl-toggle">
          <input type="checkbox" ${checked} data-bl-action="change-value" data-bl-item-id="${item.id}" />
          <span class="bl-toggle-slider"></span>
        </label>
      `;
    }

    if (item.type === 'number') {
      const min = item.validation?.min ?? 0;
      const max = item.validation?.max ?? 99999;
      return `<input type="number" class="bl-input-number" value="${this.escapeHtml(val)}" min="${min}" max="${max}" data-bl-action="change-value" data-bl-item-id="${item.id}" />`;
    }

    // string
    return `<input type="text" class="bl-input-text" value="${this.escapeHtml(val)}" data-bl-action="change-value" data-bl-item-id="${item.id}" />`;
  }

  // ─── 底部变更预览栏 ───

  private renderDiffBar(): string {
    return `
      <div class="bl-diff-bar" id="bl-diff-bar" style="display: none;">
        <div class="bl-diff-header" id="bl-diff-header" data-bl-action="toggle-diff">
          <span class="bl-diff-icon">${Caution({ theme: 'outline', size: '16', fill: 'currentColor' })}</span>
          <span class="bl-diff-title" id="bl-diff-title">待应用变更 (0项)</span>
          <span class="bl-diff-toggle" id="bl-diff-toggle">${Down({ theme: 'outline', size: '14', fill: 'currentColor' })}</span>
        </div>
        <div class="bl-diff-content" id="bl-diff-content" style="display: none;">
          <div class="bl-diff-list" id="bl-diff-list"></div>
          <div class="bl-diff-actions">
            <button class="bl-btn-secondary" id="bl-btn-cancel-all" data-bl-action="cancel-all">取消所有变更</button>
            <button class="bl-btn-primary" id="bl-btn-apply" data-bl-action="apply-changes">
              ${CheckOne({ theme: 'outline', size: '16', fill: 'currentColor' })} 应用并保存
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ─── 更新变更预览 ───

  renderDiffItems(
    pendingChanges: Map<string, string>,
    currentValues: Map<string, string>,
  ): string {
    if (pendingChanges.size === 0) return '';

    const allItems = new Map<string, BaselineConfigItem>();
    for (const cat of baselineCategories) {
      for (const item of cat.items) {
        allItems.set(item.id, item);
      }
    }

    const rows = Array.from(pendingChanges.entries()).map(([itemId, newVal]) => {
      const item = allItems.get(itemId);
      if (!item) return '';
      const oldVal = currentValues.get(itemId) ?? '?';
      if (oldVal === newVal) return '';
      return `
        <div class="bl-diff-row">
          <span class="bl-diff-item-name">${this.escapeHtml(item.name)}</span>
          <span class="bl-diff-old">${this.escapeHtml(oldVal)}</span>
          <span class="bl-diff-arrow">&rarr;</span>
          <span class="bl-diff-new">${this.escapeHtml(newVal)}</span>
          <button class="bl-diff-remove" data-bl-action="revert-item" data-bl-item-id="${itemId}" title="撤销">
            ${CloseOne({ theme: 'outline', size: '12', fill: 'currentColor' })}
          </button>
        </div>
      `;
    }).filter(Boolean).join('');

    return rows;
  }

  // ─── 变更历史弹窗 ───

  renderHistoryModal(history: Array<{
    timestamp: string;
    server: string;
    changes: Array<{ name: string; oldValue: string; newValue: string }>;
  }>): string {
    if (history.length === 0) {
      return `
        <div class="bl-history-empty">
          <p>暂无变更历史记录</p>
        </div>
      `;
    }

    const entries = history.slice(0, 50).map(entry => {
      const items = entry.changes.map(c => `
        <div class="bl-history-change">
          <span class="bl-history-name">${this.escapeHtml(c.name)}</span>
          <span class="bl-diff-old">${this.escapeHtml(c.oldValue)}</span>
          <span class="bl-diff-arrow">&rarr;</span>
          <span class="bl-diff-new">${this.escapeHtml(c.newValue)}</span>
        </div>
      `).join('');

      return `
        <div class="bl-history-entry">
          <div class="bl-history-header">
            <span class="bl-history-time">${this.escapeHtml(entry.timestamp)}</span>
            <span class="bl-history-server">${this.escapeHtml(entry.server)}</span>
          </div>
          ${items}
        </div>
      `;
    }).join('');

    return entries;
  }

  // ─── 加载状态 ───

  renderLoadingState(): string {
    return `
      <div class="bl-loading">
        <div class="bl-loading-spinner"></div>
        <div class="bl-loading-text">正在从服务器读取配置...</div>
      </div>
    `;
  }

  // ─── 工具 ───

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
