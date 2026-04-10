/**
 * Server Modal Renderer
 * Extracted from ModernUIRenderer - handles server management modal,
 * server list, add server form, and connection prompt rendering.
 */

import {
  CloseOne,
  Connection,
  Earth,
  FileText,
  FolderOpen,
  Key,
  LinkCloud,
  Lock,
  NetworkTree,
  Peoples,
  Plus,
  Refresh,
  SettingConfig,
  Shield,
  System,
  User,
} from '@icon-park/svg';

export class ServerModalRenderer {
  /**
   * Render the server management modal overlay.
   */
  renderServerModal(): string {
    return `
      <div id="server-modal" class="server-modal-overlay">
        <div class="server-modal-panel">
          <!-- Header -->
          <div class="server-modal-header">
            <div class="server-modal-header-left">
              <div class="server-modal-icon">
                ${LinkCloud({ theme: 'filled', size: '20', fill: 'currentColor' })}
              </div>
              <div>
                <h2 class="server-modal-title">服务器管理</h2>
                <span class="server-modal-subtitle" id="server-count-label">管理您的远程连接</span>
              </div>
            </div>
            <div class="server-modal-header-actions">
              <button class="server-modal-add-btn" onclick="window.showAddServerForm()">
                ${Plus({ theme: 'outline', size: '15', fill: 'currentColor' })}
                <span>新建连接</span>
              </button>
              <button class="server-modal-close" onclick="window.hideServerModal()">
                ${CloseOne({ theme: 'outline', size: '18', fill: 'currentColor' })}
              </button>
            </div>
          </div>

          <!-- Toolbar -->
          <div class="server-modal-toolbar">
            <div class="server-modal-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
              <input type="text" placeholder="搜索服务器名称、地址..." oninput="window.filterServerList(this.value)">
            </div>
            <button class="server-modal-refresh" onclick="window.refreshServerList()" title="刷新">
              ${Refresh({ theme: 'outline', size: '15', fill: 'currentColor' })}
            </button>
          </div>

          <!-- Server List -->
          <div class="server-modal-body">
            <div id="server-list-container" class="server-list-container">
              <div id="server-list" class="server-list-modern">
                ${this.renderServerList()}
              </div>
            </div>

            <div id="add-server-form" class="add-server-form" style="display: none; padding: var(--spacing-xl);">
              ${this.renderAddServerForm()}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render the server list, reading connections from the global sshManager.
   */
  renderServerList(): string {
    const sshManager = (window as any).app?.sshManager;
    const servers = sshManager ? sshManager.getConnections().map((conn: any) => ({
      id: conn.id,
      name: conn.name,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      authType: conn.authType,
      status: conn.isConnected ? 'connected' : 'disconnected',
      accounts: conn.accounts || [],
      accountCount: conn.accounts ? conn.accounts.length : 0
    })) : [];

    // Update count label
    setTimeout(() => {
      const label = document.getElementById('server-count-label');
      if (label) label.textContent = servers.length > 0 ? `${servers.length} 台服务器` : '管理您的远程连接';
    }, 0);

    if (servers.length === 0) {
      return `
        <div class="server-empty-state">
          <div class="server-empty-icon">
            ${LinkCloud({ theme: 'filled', size: '36', fill: 'currentColor' })}
          </div>
          <h3>暂无服务器</h3>
          <p>点击上方「新建连接」添加您的第一台服务器</p>
        </div>
      `;
    }

    return servers.map((server: any) => `
      <div class="server-row ${server.status === 'connected' ? 'connected' : ''}" data-server-id="${server.id}">
        <div class="server-row-indicator"></div>
        <div class="server-row-icon">
          ${server.status === 'connected'
            ? Connection({ theme: 'filled', size: '18', fill: 'currentColor' })
            : System({ theme: 'outline', size: '18', fill: 'currentColor' })}
        </div>
        <div class="server-row-info">
          <span class="server-row-name">${server.name}</span>
          <span class="server-row-addr">${server.username}@${server.host}:${server.port}</span>
        </div>
        <div class="server-row-tags">
          <span class="server-tag">${server.authType === 'password' ? '密码' : '密钥'}</span>
          ${server.accountCount > 0 ? `<span class="server-tag purple">${server.accountCount} 账户</span>` : ''}
        </div>
        <div class="server-row-actions">
          <button class="server-action-btn ${server.status === 'connected' ? 'danger' : 'primary'}"
                  onclick="window.${server.status === 'connected' ? 'disconnectServer' : 'connectServer'}('${server.id}')">
            ${server.status === 'connected' ? '断开' : '连接'}
          </button>
          <button class="server-action-icon" onclick="window.editServer('${server.id}')" title="编辑">
            ${SettingConfig({ theme: 'outline', size: '14', fill: 'currentColor' })}
          </button>
          <button class="server-action-icon danger" onclick="window.deleteServer('${server.id}')" title="删除">
            ${CloseOne({ theme: 'outline', size: '14', fill: 'currentColor' })}
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Render the add-server form.
   */
  renderAddServerForm(): string {
    return `
      <div class="form-container" style="
        background: var(--bg-secondary);
        border-radius: var(--border-radius-lg);
      ">
        <style>
        .auth-radio-label {
          flex: 1;
          cursor: pointer;
          text-align: center;
          padding: 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          color: var(--text-secondary);
          border: 1px solid transparent;
        }
        .auth-radio-input:checked + .auth-radio-label {
          background: var(--bg-primary);
          color: var(--primary-color);
          box-shadow: var(--shadow-sm);
          border-color: var(--border-color);
        }
        </style>
        <div class="form-header" style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: var(--spacing-xl);
          padding-bottom: var(--spacing-md);
          border-bottom: 1px dashed var(--border-color);
        ">
          <div>
            <h3 style="margin: 0; color: var(--text-primary); font-size: 18px; font-weight: 600;">
              添加新服务器
            </h3>
            <p style="margin: 4px 0 0; font-size: 12px; color: var(--text-secondary);">配置远程 Linux 服务器的连接信息</p>
          </div>
          <button class="cancel-add-btn" style="
            background: none;
            border: none;
            color: var(--text-secondary);
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 4px;
            padding: 6px 12px;
            border-radius: var(--border-radius);
            transition: all 0.2s;
          " onclick="window.hideAddServerForm()" onmouseover="this.style.background='var(--bg-tertiary)'; this.style.color='var(--text-primary)'" onmouseout="this.style.background='transparent'; this.style.color='var(--text-secondary)'">
            ${CloseOne({ theme: 'outline', size: '14', fill: 'currentColor' })} 取消
          </button>
        </div>

        <form id="add-server-form-element" class="server-form" onsubmit="event.preventDefault(); window.handleServerFormSubmit(event)">

          <!-- 基础信息 -->
          <div style="margin-bottom: var(--spacing-xl);">
            <h4 style="font-size: 12px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--spacing-md); font-weight: 600;">基础信息</h4>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-lg); margin-bottom: var(--spacing-md);">
                <div class="form-group">
                  <label style="display: block; font-size: 12px; font-weight: 500; color: var(--text-primary); margin-bottom: 6px;">服务器名称</label>
                  <div style="position: relative;">
                    <input type="text" name="name" placeholder="例如：生产服务器" style="
                      width: 100%;
                      padding: 10px 12px 10px 36px;
                      border: 1px solid var(--border-color);
                      border-radius: var(--border-radius);
                      background: var(--bg-primary);
                      color: var(--text-primary);
                      font-size: 13px;
                      transition: all 0.2s;
                    " required onfocus="this.style.borderColor='var(--primary-color)'; this.style.boxShadow='0 0 0 2px var(--primary-color-alpha-10)'" onblur="this.style.borderColor='var(--border-color)'; this.style.boxShadow='none'">
                    <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary);">
                        ${LinkCloud({ theme: 'outline', size: '14', fill: 'currentColor' })}
                    </div>
                  </div>
                </div>

                <div class="form-group">
                  <label style="display: block; font-size: 12px; font-weight: 500; color: var(--text-primary); margin-bottom: 6px;">主机地址 (IP/域名)</label>
                  <div style="position: relative;">
                    <input type="text" name="host" placeholder="192.168.1.100" style="
                      width: 100%;
                      padding: 10px 12px 10px 36px;
                      border: 1px solid var(--border-color);
                      border-radius: var(--border-radius);
                      background: var(--bg-primary);
                      color: var(--text-primary);
                      font-size: 13px;
                      transition: all 0.2s;
                    " required onfocus="this.style.borderColor='var(--primary-color)'; this.style.boxShadow='0 0 0 2px var(--primary-color-alpha-10)'" onblur="this.style.borderColor='var(--border-color)'; this.style.boxShadow='none'">
                     <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary);">
                        ${Earth({ theme: 'outline', size: '14', fill: 'currentColor' })}
                    </div>
                  </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 120px 1fr; gap: var(--spacing-lg);">
                <div class="form-group">
                  <label style="display: block; font-size: 12px; font-weight: 500; color: var(--text-primary); margin-bottom: 6px;">SSH 端口</label>
                  <div style="position: relative;">
                    <input type="number" name="port" value="22" style="
                      width: 100%;
                      padding: 10px 12px 10px 36px;
                      border: 1px solid var(--border-color);
                      border-radius: var(--border-radius);
                      background: var(--bg-primary);
                      color: var(--text-primary);
                      font-size: 13px;
                      transition: all 0.2s;
                    " required onfocus="this.style.borderColor='var(--primary-color)'; this.style.boxShadow='0 0 0 2px var(--primary-color-alpha-10)'" onblur="this.style.borderColor='var(--border-color)'; this.style.boxShadow='none'">
                    <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary);">
                        ${NetworkTree({ theme: 'outline', size: '14', fill: 'currentColor' })}
                    </div>
                  </div>
                </div>
                <div class="form-group">
                  <label style="display: block; font-size: 12px; font-weight: 500; color: var(--text-primary); margin-bottom: 6px;">用户名</label>
                  <div style="position: relative;">
                    <input type="text" name="username" placeholder="root" style="
                      width: 100%;
                      padding: 10px 12px 10px 36px;
                      border: 1px solid var(--border-color);
                      border-radius: var(--border-radius);
                      background: var(--bg-primary);
                      color: var(--text-primary);
                      font-size: 13px;
                      transition: all 0.2s;
                    " required onfocus="this.style.borderColor='var(--primary-color)'; this.style.boxShadow='0 0 0 2px var(--primary-color-alpha-10)'" onblur="this.style.borderColor='var(--border-color)'; this.style.boxShadow='none'">
                    <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary);">
                        ${User({ theme: 'outline', size: '14', fill: 'currentColor' })}
                    </div>
                  </div>
                </div>
            </div>
          </div>

          <!-- 认证信息 -->
          <div style="margin-bottom: var(--spacing-xl);">
            <h4 style="font-size: 12px; color: var(--text-tertiary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: var(--spacing-md); font-weight: 600;">认证方式</h4>

            <div class="form-group" style="margin-bottom: var(--spacing-md);">
                <div style="
                    display: flex;
                    background: var(--bg-tertiary);
                    padding: 4px;
                    border-radius: var(--border-radius);
                    border: 1px solid var(--border-color);
                    gap: 4px;
                ">
                    <input type="radio" id="auth-type-password" name="authType" value="password" checked class="auth-radio-input" style="display: none;" onchange="window.toggleAuthFields(this.value)">
                    <label for="auth-type-password" class="auth-radio-label">
                        ${Key({ theme: 'outline', size: '14', fill: 'currentColor' })} 密码认证
                    </label>

                    <input type="radio" id="auth-type-key" name="authType" value="key" class="auth-radio-input" style="display: none;" onchange="window.toggleAuthFields(this.value)">
                    <label for="auth-type-key" class="auth-radio-label">
                        ${Shield({ theme: 'outline', size: '14', fill: 'currentColor' })} SSH 密钥
                    </label>
                </div>
            </div>

            <div id="password-auth" class="auth-fields" style="animation: fadeIn 0.3s ease;">
              <div class="form-group">
                <label style="display: block; font-size: 12px; font-weight: 500; color: var(--text-primary); margin-bottom: 6px;">服务器密码</label>
                <div style="position: relative;">
                    <input type="password" name="password" placeholder="请输入服务器密码" style="
                      width: 100%;
                      padding: 10px 12px 10px 36px;
                      border: 1px solid var(--border-color);
                      border-radius: var(--border-radius);
                      background: var(--bg-primary);
                      color: var(--text-primary);
                      font-size: 13px;
                      transition: all 0.2s;
                    " onfocus="this.style.borderColor='var(--primary-color)'; this.style.boxShadow='0 0 0 2px var(--primary-color-alpha-10)'" onblur="this.style.borderColor='var(--border-color)'; this.style.boxShadow='none'">
                    <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary);">
                        ${Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
                    </div>
                </div>
              </div>
            </div>

            <div id="key-auth" class="auth-fields" style="display: none; animation: fadeIn 0.3s ease;">
              <div class="form-group" style="margin-bottom: var(--spacing-md);">
                <label style="display: block; font-size: 12px; font-weight: 500; color: var(--text-primary); margin-bottom: 6px;">私钥文件路径</label>
                <div style="display: flex; gap: 8px;">
                    <div style="position: relative; flex: 1;">
                        <input type="text" name="keyPath" placeholder="/Users/username/.ssh/id_rsa" style="
                          width: 100%;
                          padding: 10px 12px 10px 36px;
                          border: 1px solid var(--border-color);
                          border-radius: var(--border-radius);
                          background: var(--bg-primary);
                          color: var(--text-primary);
                          font-size: 13px;
                          transition: all 0.2s;
                        " onfocus="this.style.borderColor='var(--primary-color)'; this.style.boxShadow='0 0 0 2px var(--primary-color-alpha-10)'" onblur="this.style.borderColor='var(--border-color)'; this.style.boxShadow='none'">
                        <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary);">
                            ${FileText({ theme: 'outline', size: '14', fill: 'currentColor' })}
                        </div>
                    </div>
                    <button type="button" class="modern-btn secondary" style="padding: 0 12px;" onclick="window.selectPrivateKeyFile()" title="选择文件">
                        ${FolderOpen({ theme: 'outline', size: '16', fill: 'currentColor' })}
                    </button>
                </div>
              </div>
              <div class="form-group">
                <label style="display: block; font-size: 12px; font-weight: 500; color: var(--text-primary); margin-bottom: 6px;">密钥密码 (可选)</label>
                <div style="position: relative;">
                    <input type="password" name="keyPassphrase" placeholder="如果私钥设置了密码" style="
                      width: 100%;
                      padding: 10px 12px 10px 36px;
                      border: 1px solid var(--border-color);
                      border-radius: var(--border-radius);
                      background: var(--bg-primary);
                      color: var(--text-primary);
                      font-size: 13px;
                      transition: all 0.2s;
                    " onfocus="this.style.borderColor='var(--primary-color)'; this.style.boxShadow='0 0 0 2px var(--primary-color-alpha-10)'" onblur="this.style.borderColor='var(--border-color)'; this.style.boxShadow='none'">
                    <div style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-tertiary);">
                        ${Lock({ theme: 'outline', size: '14', fill: 'currentColor' })}
                    </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 多账号管理区域 -->
          <div class="form-group" style="
            margin-bottom: var(--spacing-md);
            margin-top: var(--spacing-lg);
            padding: var(--spacing-md);
            border: 1px dashed var(--border-color);
            border-radius: var(--border-radius);
            background: var(--bg-tertiary);
          ">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
              <div style="display: flex; align-items: center; gap: 8px;">
                  ${Peoples({ theme: 'filled', size: '16', fill: 'var(--primary-color)' })}
                  <label style="
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--text-primary);
                    margin: 0;
                  ">多账号管理</label>
              </div>
              <button type="button" class="add-account-btn modern-btn secondary" style="
                padding: 4px 10px;
                font-size: 11px;
                height: 24px;
              " onclick="window.addServerAccount()">
                ${Plus({ theme: 'outline', size: '12', fill: 'currentColor' })} 添加账号
              </button>
            </div>
            <div style="
              font-size: 11px;
              color: var(--text-secondary);
              margin-bottom: var(--spacing-md);
              line-height: 1.4;
            ">
              您可以为同一台服务器添加多个登录账号（例如 root、superuser 等），连接时可快速切换。
            </div>
            <div id="additional-accounts-list" style="
              display: flex;
              flex-direction: column;
              gap: var(--spacing-md);
            ">
              <!-- 额外账号列表将动态插入这里 -->
            </div>
          </div>

          <div class="form-actions" style="
            display: flex;
            gap: var(--spacing-md);
            justify-content: space-between;
            margin-top: var(--spacing-xl);
            padding-top: var(--spacing-lg);
            border-top: 1px solid var(--border-color);
          ">
            <button type="button" id="test-connection-btn" class="modern-btn secondary" style="
              padding: 10px 20px;
              font-size: 13px;
              justify-content: center;
            " onclick="window.testConnection()">
              测试连接
            </button>
            <div style="display: flex; gap: var(--spacing-md);">
              <button type="button" class="cancel-btn modern-btn secondary" style="
                padding: 10px 20px;
                font-size: 13px;
                width: 100px;
                justify-content: center;
              " onclick="window.hideAddServerForm()">
                取消
              </button>
              <button type="submit" class="save-btn modern-btn primary" style="
                padding: 10px 24px;
                font-size: 13px;
                width: 120px;
                justify-content: center;
                box-shadow: 0 4px 12px var(--primary-color-alpha-30);
              ">
                保存配置
              </button>
            </div>
          </div>
        </form>
      </div>
    `;
  }

  /**
   * Render the connection prompt (welcome/landing screen).
   */
  renderConnectionPrompt(): string {
    return `
      <div class="connection-prompt">
        <div class="connection-prompt-inner">
          <div class="connection-prompt-logo">
            <svg width="80" height="80" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="cp-s" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#f9a8d4"/><stop offset="1" stop-color="#c4b5fd"/></linearGradient>
                <linearGradient id="cp-h" x1=".36" y1="0" x2=".5" y2=".5"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
              </defs>
              <g transform="rotate(-15 64 62)">
                <path d="M64,16 L75.8,47.8 L109.2,48.8 L83.2,68.8 L93,101.2 L64,83.2 L35,101.2 L44.8,68.8 L18.8,48.8 L52.2,47.8 Z" fill="url(#cp-s)" stroke="url(#cp-s)" stroke-width="12" stroke-linejoin="round" paint-order="stroke fill"/>
                <path d="M64,16 L75.8,47.8 L109.2,48.8 L83.2,68.8 L93,101.2 L64,83.2 L35,101.2 L44.8,68.8 L18.8,48.8 L52.2,47.8 Z" fill="url(#cp-h)" stroke="url(#cp-h)" stroke-width="12" stroke-linejoin="round" paint-order="stroke fill"/>
              </g>
            </svg>
          </div>
          <p style="font-size: 17px; font-weight: 600; color: var(--text-primary); margin: 0 0 6px 0;">LovelyRes</p>
          <p style="font-size: 12px; color: var(--text-secondary); margin: 0 0 20px 0;">Linux Emergency Response Tool</p>
          <button class="modern-btn primary" onclick="window.showServerModal()" style="padding: 8px 24px; font-size: 13px;">
            ${Connection({ theme: 'outline', size: '16', fill: 'currentColor' })}
            <span>连接服务器</span>
          </button>
        </div>
      </div>
    `;
  }
}
