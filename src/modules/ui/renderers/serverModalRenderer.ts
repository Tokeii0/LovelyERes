/**
 * Server Connection Renderer — Full Page Card Layout + Step Form
 */

import {
  Connection,
  Plus,
  SettingConfig,
  System,
} from '@icon-park/svg';

const icon = (fn: any, size = '16', theme = 'outline') =>
  fn({ theme, size, fill: 'currentColor' });

export class ServerModalRenderer {

  /** 渲染全页面连接管理 */
  renderConnectionPage(): string {
    const servers = this.getServers();
    const cards = servers.map(s => this.renderCard(s)).join('');
    const addCard = `<div class="sc-card sc-card-add" onclick="window.showAddServerForm()"><span class="sc-card-add-icon">+</span><span>新建连接</span></div>`;

    return `
      <div class="sc-page">
        <div class="sc-header">
          <img class="sc-logo" src="/logo.png" alt="LovelyRes" />
          <h1 class="sc-title">LovelyRes</h1>
          <p class="sc-subtitle">Linux 应急响应工具 - 连接远程服务器开始</p>
        </div>
        <div class="sc-quick-bar">
          <span style="font-size:12px;color:var(--text-secondary);white-space:nowrap;">快速连接</span>
          <input class="sc-quick-input" id="sc-quick-input" placeholder="user@host:port (回车连接)" onkeydown="if(event.key==='Enter') window.scQuickConnect?.()">
          <button class="sc-toolbar-btn primary" onclick="window.scQuickConnect?.()">连接</button>
        </div>
        <div class="sc-toolbar">
          <input class="sc-search" id="sc-search" placeholder="搜索服务器..." oninput="window.scFilterServers?.(this.value)">
          <button class="sc-toolbar-btn" onclick="window.scImportConfig?.()">导入</button>
          <button class="sc-toolbar-btn" onclick="window.scExportConfig?.()">导出</button>
          <button class="sc-toolbar-btn primary" onclick="window.showAddServerForm?.()">
            ${icon(Plus, '14')} 新建
          </button>
        </div>
        <div class="sc-grid" id="sc-grid">${cards}${addCard}</div>
        <div class="sc-footer"><span>${servers.length} 台服务器</span></div>
      </div>
    `;
  }

  private renderCard(server: any): string {
    const isConn = server.status === 'connected';
    const cls = isConn ? 'connected' : '';
    const authLabel = server.authType === 'key' ? '密钥' : '密码';
    const authCls = server.authType === 'key' ? 'auth-key' : '';

    return `
      <div class="sc-card ${cls}" id="sc-card-${server.id}">
        <div class="sc-card-status"></div>
        <button class="sc-card-edit" onclick="event.stopPropagation();window.editServer?.('${server.id}')" title="编辑">${icon(SettingConfig, '12')}</button>
        <div class="sc-card-icon">${isConn ? icon(Connection, '18', 'filled') : icon(System, '18')}</div>
        <div class="sc-card-name">${this.esc(server.name)}</div>
        <div class="sc-card-addr">${this.esc(server.username)}@${this.esc(server.host)}:${server.port}</div>
        <div class="sc-card-tags">
          <span class="sc-tag ${authCls}">${authLabel}</span>
          ${server.accountCount > 0 ? `<span class="sc-tag">${server.accountCount} 账户</span>` : ''}
        </div>
        <div class="sc-card-actions">
          ${isConn
            ? `<button class="sc-card-btn danger" onclick="window.disconnectServer?.('${server.id}')">断开</button>`
            : `<button class="sc-card-btn primary" onclick="window.connectServer?.('${server.id}')">连接</button>`}
          <button class="sc-card-btn" onclick="window.deleteServer?.('${server.id}')">删除</button>
        </div>
      </div>`;
  }

  /** 新建/编辑连接表单 (单页) */
  renderStepForm(editData?: any): string {
    const isEdit = !!editData;
    const title = isEdit ? '编辑连接' : '新建连接';
    const d = editData || {};
    const authType = d.authType || 'password';

    return `
      <div class="sc-form-overlay" id="sc-form-overlay" onclick="if(event.target===this)window.hideAddServerForm?.()">
        <div class="sc-form-panel">
          <div class="sc-form-header">
            <h3 class="sc-form-title">${title}</h3>
            <button class="sc-form-close" onclick="window.hideAddServerForm?.()">&times;</button>
          </div>
          <div class="sc-form-body">
            <div class="sc-field"><label>连接名称</label><input id="sc-name" placeholder="留空自动生成" value="${this.esc(d.name || '')}"></div>
            <div style="display:flex;gap:10px;">
              <div class="sc-field" style="flex:1;"><label>主机地址</label><input id="sc-host" placeholder="IP 或域名" value="${this.esc(d.host || '')}"></div>
              <div class="sc-field" style="width:90px;"><label>端口</label><input id="sc-port" type="number" value="${d.port || 22}" min="1" max="65535"></div>
            </div>
            <div class="sc-field"><label>用户名</label><input id="sc-username" placeholder="root" value="${this.esc(d.username || 'root')}"></div>
            <div class="sc-auth-toggle">
              <button class="sc-auth-option ${authType === 'password' ? 'active' : ''}" onclick="window.scSetAuthType?.('password')">密码认证</button>
              <button class="sc-auth-option ${authType === 'key' ? 'active' : ''}" onclick="window.scSetAuthType?.('key')">密钥认证</button>
            </div>
            <div id="sc-auth-password" style="${authType === 'key' ? 'display:none' : ''}">
              <div class="sc-field"><label>密码</label><input id="sc-password" type="password" placeholder="SSH 密码"></div>
            </div>
            <div id="sc-auth-key" style="${authType === 'password' ? 'display:none' : ''}">
              <div class="sc-field"><label>私钥文件</label>
                <div class="sc-file-row"><input id="sc-keypath" placeholder="选择私钥文件" value="${this.esc(d.keyPath || '')}" readonly><button class="sc-file-btn" onclick="window.selectPrivateKeyFile?.()">选择</button></div>
              </div>
              <div class="sc-field"><label>密钥密码 (可选)</label><input id="sc-keypass" type="password" placeholder="如果私钥有密码"></div>
            </div>
            <div class="sc-field"><label>备注 (可选)</label><input id="sc-notes" placeholder="连接备注" value="${this.esc(d.notes || '')}"></div>
          </div>
          <div class="sc-form-footer">
            <button class="sc-form-btn" onclick="window.hideAddServerForm?.()">取消</button>
            <div style="display:flex;gap:8px;">
              <button class="sc-form-btn" onclick="window.testConnection?.()">测试连接</button>
              <button class="sc-form-btn primary" onclick="window.saveServer?.()">保存</button>
            </div>
          </div>
          <input type="hidden" id="sc-editing-id" value="${d.id || ''}">
          <input type="hidden" id="sc-auth-type" value="${authType}">
        </div>
      </div>`;
  }

  /** 仅渲染卡片列表 (局部刷新用) */
  renderServerList(): string {
    const servers = this.getServers();
    return servers.map(s => this.renderCard(s)).join('') +
      `<div class="sc-card sc-card-add" onclick="window.showAddServerForm()"><span class="sc-card-add-icon">+</span><span>新建连接</span></div>`;
  }

  /** 向后兼容 */
  renderServerModal(): string { return '<div id="server-modal" style="display:none;"></div>'; }
  renderConnectionPrompt(): string { return this.renderConnectionPage(); }

  private getServers(): any[] {
    const mgr = (window as any).app?.sshManager;
    if (!mgr) return [];
    return mgr.getConnections().map((c: any) => ({
      id: c.id, name: c.name, host: c.host, port: c.port,
      username: c.username, authType: c.authType || 'password',
      status: c.isConnected ? 'connected' : 'disconnected',
      accounts: c.accounts || [], accountCount: c.accounts?.length || 0,
      keyPath: c.keyPath || '', notes: c.notes || '', tags: c.tags || '',
    }));
  }

  private esc(s: string): string {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
