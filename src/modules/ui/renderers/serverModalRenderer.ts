/**
 * Server Connection Renderer — Welcome / Quick-Connect split layout
 *
 * Prefix: sc- (server-connect). The welcome quick-connect form uses scw-
 * ids so it never collides with the sc- step form (which can be opened as
 * an overlay on top of the welcome screen via "管理记录 → 新建").
 */

import {
  Connection,
  Plus,
  SettingConfig,
  System,
  Right,
  SettingTwo,
} from '@icon-park/svg';
import { version as APP_VERSION } from '../../../../package.json';

const icon = (fn: any, size = '16', theme = 'outline') =>
  fn({ theme, size, fill: 'currentColor' });

const BRAND_STAR = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 1.6l2.95 7.0 7.55.62-5.75 4.94 1.74 7.38L12 17.9l-6.49 3.64 1.74-7.38L1.5 9.22l7.55-.62z"/></svg>`;
const EYE_OPEN = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3"/></svg>`;
const EYE_OFF = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18M10.6 10.7a3 3 0 004.2 4.2M9.3 5.3A9.6 9.6 0 0112 5c7 0 10.5 7 10.5 7a17 17 0 01-3.4 4.3M6.1 6.2A17 17 0 001.5 12S5 19 12 19a9.6 9.6 0 003.3-.6"/></svg>`;

export class ServerModalRenderer {

  /** 渲染全页面连接界面 (分屏：历史连接 + 快速连接) */
  renderConnectionPage(): string {
    const servers = this.getServers();
    const times = this.getLastConnectedMap();
    // 最近使用优先排序
    const sorted = [...servers].sort((a, b) => (times[b.id] || 0) - (times[a.id] || 0));

    const history = sorted.length
      ? sorted.map((s, i) => this.renderHistoryItem(s, i === 0, times[s.id])).join('')
      : `<div class="sc-hist-empty">
           <span class="sc-hist-empty-icon">${icon(Connection, '22')}</span>
           <p>暂无历史连接<br>在右侧填写信息开始连接</p>
         </div>`;

    return `
      <div class="sc-welcome">
        <!-- 左侧：品牌 + 历史连接 -->
        <aside class="sc-left">
          <div class="sc-brand">
            <span class="sc-brand-star">${BRAND_STAR}</span>
            <span class="sc-brand-name">LovelyRes</span>
          </div>

          <div class="sc-hero">
            <h1 class="sc-hero-title">连接服务器</h1>
            <p class="sc-hero-sub">建立 SSH 会话，开始 Linux 应急响应</p>
          </div>

          <div class="sc-history">
            <div class="sc-history-head">
              <span class="sc-history-title">历史连接</span>
              <button class="sc-history-manage" onclick="window.scManageServers?.()">
                管理记录 ${icon(Right, '14')}
              </button>
            </div>
            <div class="sc-history-list" id="sc-history-list">${history}</div>
          </div>

          <span class="sc-star-watermark" aria-hidden="true">${BRAND_STAR}</span>
        </aside>

        <!-- 右侧：快速连接表单 -->
        <section class="sc-right">
          <div class="sc-form-wrap">
            <h2 class="sc-form-h">快速连接</h2>
            <div class="sc-form-eyebrow">SSH CONNECTION</div>

            <div class="sc-wfield">
              <label for="scw-host">服务器地址</label>
              <input id="scw-host" class="sc-underline" placeholder="例如 192.168.1.10"
                     oninput="window.scClearSelection?.()"
                     onkeydown="if(event.key==='Enter')window.scConnectForm?.()">
            </div>

            <div class="sc-field-row">
              <div class="sc-wfield">
                <label for="scw-username">用户名</label>
                <input id="scw-username" class="sc-underline" value="root">
              </div>
              <div class="sc-wfield">
                <label for="scw-port">端口</label>
                <input id="scw-port" class="sc-underline" type="number" value="22" min="1" max="65535">
              </div>
            </div>

            <div class="sc-wfield">
              <label>认证方式</label>
              <div class="sc-seg">
                <button type="button" class="sc-seg-opt active" data-auth="password" onclick="window.scwSetAuthType?.('password')">密码</button>
                <button type="button" class="sc-seg-opt" data-auth="key" onclick="window.scwSetAuthType?.('key')">私钥</button>
              </div>
            </div>

            <div class="sc-wfield" id="scw-auth-password">
              <label for="scw-password">密码</label>
              <div class="sc-input-eye">
                <input id="scw-password" class="sc-underline" type="password" placeholder="请输入密码"
                       onkeydown="if(event.key==='Enter')window.scConnectForm?.()">
                <button type="button" class="sc-eye" tabindex="-1" onclick="window.scwTogglePassword?.(this)">
                  <span class="sc-eye-on">${EYE_OPEN}</span>
                  <span class="sc-eye-off">${EYE_OFF}</span>
                </button>
              </div>
            </div>

            <div id="scw-auth-key" style="display:none;">
              <div class="sc-wfield">
                <label for="scw-keypath">私钥文件</label>
                <div class="sc-file-row">
                  <input id="scw-keypath" class="sc-underline" placeholder="选择私钥文件" readonly>
                  <button type="button" class="sc-mini-btn" onclick="window.selectPrivateKeyFile?.('scw-keypath')">选择</button>
                </div>
              </div>
              <div class="sc-wfield">
                <label for="scw-keypass">密钥密码（可选）</label>
                <input id="scw-keypass" class="sc-underline" type="password" placeholder="如果私钥有密码">
              </div>
            </div>

            <label class="sc-remember">
              <input type="checkbox" id="scw-remember" checked>
              <span>记住此连接</span>
            </label>

            <button type="button" class="sc-connect-btn" onclick="window.scConnectForm?.()">
              <span class="sc-connect-label">连接服务器 ${icon(Right, '16')}</span>
              <kbd class="sc-kbd">Enter</kbd>
            </button>

            <input type="hidden" id="scw-auth-type" value="password">
            <input type="hidden" id="scw-selected-id" value="">
          </div>

          <div class="sc-right-foot">
            <span class="sc-version">LovelyRes v${APP_VERSION}</span>
            <button class="sc-settings-link" onclick="window.showSettingsOverlay?.()">
              ${icon(SettingTwo, '14')} 连接设置
            </button>
          </div>
        </section>
      </div>
    `;
  }

  private renderHistoryItem(server: any, active: boolean, ts?: number): string {
    const connected = server.status === 'connected';
    const timeLabel = ts ? this.fmtTime(ts) : (server.authType === 'key' ? '密钥' : '密码');
    const hasName = server.name && server.name !== `${server.username}@${server.host}`;
    const title = this.esc(hasName ? server.name : server.host);
    return `
      <div class="sc-hist-item ${active ? 'active' : ''}" data-server-id="${server.id}" onclick="window.scSelectServer?.('${server.id}')">
        <span class="sc-hist-dot ${connected ? 'connected' : ''}"></span>
        <span class="sc-hist-main">
          <span class="sc-hist-name">${title}</span>
          <span class="sc-hist-addr">${this.esc(server.username)}@${this.esc(server.host)}:${server.port}</span>
        </span>
        <span class="sc-hist-time">${timeLabel}</span>
        <button class="sc-hist-go" title="连接" onclick="event.stopPropagation();window.connectServer?.('${server.id}')">${icon(Right, '16')}</button>
      </div>`;
  }

  /** 管理记录浮层 (复用卡片列表 + 导入导出) */
  renderManageOverlay(): string {
    const cards = this.renderServerList();
    return `
      <div class="sc-manage-overlay" id="sc-manage-overlay" onclick="if(event.target===this)window.scCloseManage?.()">
        <div class="sc-manage-panel">
          <div class="sc-manage-head">
            <h3 class="sc-manage-title">连接管理</h3>
            <div class="sc-manage-tools">
              <button class="sc-mini-btn" onclick="window.scImportConfig?.()">导入</button>
              <button class="sc-mini-btn" onclick="window.scExportConfig?.()">导出</button>
              <button class="sc-mini-btn primary" onclick="window.showAddServerForm?.()">${icon(Plus, '13')} 新建</button>
              <button class="sc-manage-close" onclick="window.scCloseManage?.()" title="关闭">&times;</button>
            </div>
          </div>
          <div class="sc-manage-body">
            <input class="sc-manage-search" placeholder="搜索服务器..." oninput="window.scFilterServers?.(this.value)">
            <div class="sc-grid" id="sc-grid">${cards}</div>
          </div>
        </div>
      </div>`;
  }

  private renderCard(server: any): string {
    const isConn = server.status === 'connected';
    const cls = isConn ? 'connected' : '';
    const authLabel = server.authType === 'key' ? '密钥' : '密码';
    const authCls = server.authType === 'key' ? 'auth-key' : '';

    return `
      <div class="sc-card ${cls}" id="sc-card-${server.id}" data-server-id="${server.id}">
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
              <button class="sc-auth-option ${authType === 'password' ? 'active' : ''}" data-auth="password" onclick="window.scSetAuthType?.('password')">密码认证</button>
              <button class="sc-auth-option ${authType === 'key' ? 'active' : ''}" data-auth="key" onclick="window.scSetAuthType?.('key')">密钥认证</button>
            </div>
            <div id="sc-auth-password" style="${authType === 'key' ? 'display:none' : ''}">
              <div class="sc-field"><label>密码</label><input id="sc-password" type="password" placeholder="SSH 密码"></div>
            </div>
            <div id="sc-auth-key" style="${authType === 'password' ? 'display:none' : ''}">
              <div class="sc-field"><label>私钥文件</label>
                <div class="sc-file-row"><input id="sc-keypath" placeholder="选择私钥文件" value="${this.esc(d.keyPath || '')}" readonly><button class="sc-file-btn" onclick="window.selectPrivateKeyFile?.('sc-keypath')">选择</button></div>
              </div>
              <div class="sc-field"><label>密钥密码 (可选)</label><input id="sc-keypass" type="password" placeholder="如果私钥有密码"></div>
            </div>
            <div class="sc-field"><label>备注 (可选)</label><input id="sc-notes" placeholder="连接备注" value="${this.esc(d.notes || '')}"></div>
          </div>
          <div class="sc-form-footer">
            <button class="sc-form-btn" onclick="window.hideAddServerForm?.()">取消</button>
            <div style="display:flex;gap:8px;">
              <button class="sc-form-btn" id="sc-btn-test" onclick="window.testConnection?.()">测试连接</button>
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

  private getLastConnectedMap(): Record<string, number> {
    try {
      const raw = localStorage.getItem('sc-last-connected');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  }

  private fmtTime(ms: number): string {
    const d = new Date(ms);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const yest = new Date(now);
    yest.setDate(now.getDate() - 1);
    if (d.toDateString() === now.toDateString()) return `今天 ${hm}`;
    if (d.toDateString() === yest.toDateString()) return `昨天 ${hm}`;
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  }

  private esc(s: string): string {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}
