/**
 * 服务器管理模态框管理器
 * 管理服务器 CRUD、SSH 连接/断开、连接测试、多账号管理
 */

import { sshConnectionManager } from '../remote/sshConnectionManager';
import { showConfirm } from './confirmDialog';
import { busyboxManager } from '../core/busyboxManager';

function getApp(): any {
  return (window as any).app;
}

/**
 * 连接成功后弹窗：选择命令执行模式
 * - 默认模式: 使用系统原生命令
 * - Busybox 模式: 上传本地 busybox 静态二进制，所有命令通过 busybox sh 执行
 */
async function promptBusyboxMode(): Promise<void> {
  // 先检测远端是否已有 busybox
  const { status } = await busyboxManager.detect();

  if (status === 'enabled') return; // 已启用，不再提示

  const useBusybox = await showConfirm({
    title: '选择命令执行模式',
    message: status === 'installed'
      ? `检测到远端已有 busybox (${busyboxManager.getPath()})。\n\n启用 Busybox 可信模式？所有命令将通过 busybox sh 执行，不受系统命令篡改和 LD_PRELOAD 劫持影响。`
      : '是否启用 Busybox 可信命令执行模式？\n\n启用后需要选择本地 busybox 静态二进制文件上传到远端服务器。所有命令将通过 busybox sh 执行，不受系统命令篡改和 LD_PRELOAD 劫持影响。\n\n如果不需要可信执行环境（如日常运维），选择"取消"使用默认模式。',
    confirmText: status === 'installed' ? '启用 Busybox' : '上传并启用 Busybox',
    cancelText: '使用默认模式',
  });

  if (!useBusybox) return;

  try {
    if (status === 'installed') {
      // 远端已有，直接启用
      await busyboxManager.enable();
      window.showNotification?.('Busybox 可信模式已启用', 'success');
    } else {
      // 需要从本地上传
      window.showNotification?.('请选择本地 busybox 文件...', 'info');
      await busyboxManager.uploadFromLocal();
      await busyboxManager.enable();
      window.showNotification?.('Busybox 上传并启用成功', 'success');
    }
  } catch (e: any) {
    if (e?.message?.includes('未选择文件')) {
      window.showNotification?.('已取消，使用默认模式', 'info');
    } else {
      console.warn('busybox 部署失败:', e);
      window.showNotification?.(`Busybox 部署失败: ${e}，将使用默认模式`, 'warning');
    }
  }
}

function showServerModal(): void {
  const existingModal = document.getElementById('server-modal');
  if (existingModal) existingModal.remove();

  const app = getApp();
  const modalHTML = app?.stateManager?.getUIRenderer()?.renderServerModal?.()
    ?? (window as any).app?.getStateManager?.()?.getUIRenderer?.()?.renderServerModal?.();
  if (!modalHTML) return;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const modal = document.getElementById('server-modal');
  if (modal) {
    modal.style.display = 'flex';
    modal.offsetHeight; // force reflow
    modal.style.opacity = '1';
    const content = modal.querySelector('.server-modal-panel, .modal-content') as HTMLElement;
    if (content) content.style.transform = 'scale(1)';
  }
}

function hideServerModal(): void {
  const modal = document.getElementById('server-modal');
  if (modal) {
    modal.style.opacity = '0';
    const content = modal.querySelector('.server-modal-panel, .modal-content') as HTMLElement;
    if (content) content.style.transform = 'scale(0.98)';
    setTimeout(() => { if (modal?.parentNode) modal.parentNode.removeChild(modal); }, 200);
  }
}

function showAddServerForm(): void {
  const serverList = document.getElementById('server-list');
  const addForm = document.getElementById('add-server-form');
  if (!serverList || !addForm) return;

  if (!(window as any).editingServerId) {
    const formTitle = document.querySelector('#add-server-form h3');
    if (formTitle) formTitle.textContent = '添加新服务器';
    const submitButton = document.querySelector('#add-server-form button[type="submit"]');
    if (submitButton) submitButton.textContent = '保存服务器';
    const form = document.getElementById('add-server-form-element') as HTMLFormElement;
    if (form) form.reset();
  }

  serverList.style.display = 'none';
  addForm.style.display = 'block';
}

function hideAddServerForm(): void {
  const serverList = document.getElementById('server-list');
  const addForm = document.getElementById('add-server-form');
  if (serverList && addForm) {
    (window as any).editingServerId = null;
    serverList.style.display = 'block';
    addForm.style.display = 'none';
  }
}

function createAccountItemHtml(accountId: string, index: number, account?: any): string {
  const username = account?.username || '';
  const description = account?.description || '';
  const authType = account?.authType || 'password';
  const keyPath = account?.keyPath || '';
  const isDefault = account?.isDefault || false;
  const passwordPlaceholder = account ? '留空则保持不变' : '请输入密码';

  return `
    <div class="account-item" id="${accountId}" style="
      padding: var(--spacing-md);
      background: var(--bg-tertiary);
      border-radius: var(--border-radius);
      border: 1px solid var(--border-color);
      ${account ? 'margin-bottom: var(--spacing-sm);' : ''}
    ">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--spacing-sm);">
        <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">账号 #${index}</span>
        <button type="button" onclick="window.removeServerAccount('${accountId}')" style="
          background: none; border: none; color: var(--text-secondary);
          cursor: pointer; font-size: 16px; padding: 0 4px;
        " title="删除账号">×</button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm); margin-bottom: var(--spacing-sm);">
        <div>
          <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">用户名</label>
          <input type="text" class="extra-account-username" value="${username}" placeholder="例如: superuser" style="
            width: 100%; padding: 6px 8px; border: 1px solid var(--border-color);
            border-radius: var(--border-radius-sm); background: var(--bg-secondary);
            color: var(--text-primary); font-size: 11px;
          " required>
        </div>
        <div>
          <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">描述（可选）</label>
          <input type="text" class="extra-account-description" value="${description}" placeholder="例如: 数据库管理员" style="
            width: 100%; padding: 6px 8px; border: 1px solid var(--border-color);
            border-radius: var(--border-radius-sm); background: var(--bg-secondary);
            color: var(--text-primary); font-size: 11px;
          ">
        </div>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-sm);">
        <div>
          <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">认证方式</label>
          <select class="extra-account-authType" style="
            width: 100%; padding: 6px 8px; border: 1px solid var(--border-color);
            border-radius: var(--border-radius-sm); background: var(--bg-secondary);
            color: var(--text-primary); font-size: 11px;
          " onchange="window.toggleExtraAccountAuthFields('${accountId}', this.value)">
            <option value="password" ${authType === 'password' ? 'selected' : ''}>密码认证</option>
            <option value="key" ${authType === 'key' ? 'selected' : ''}>SSH密钥</option>
          </select>
        </div>
        <div class="extra-account-password-field" style="display: ${authType === 'password' ? 'block' : 'none'};">
          <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">密码</label>
          <input type="password" class="extra-account-password" placeholder="${passwordPlaceholder}" style="
            width: 100%; padding: 6px 8px; border: 1px solid var(--border-color);
            border-radius: var(--border-radius-sm); background: var(--bg-secondary);
            color: var(--text-primary); font-size: 11px;
          ">
        </div>
        <div class="extra-account-key-field" style="display: ${authType === 'key' ? 'block' : 'none'};">
          <label style="display: block; font-size: 11px; color: var(--text-secondary); margin-bottom: 2px;">私钥路径</label>
          <input type="text" class="extra-account-keyPath" value="${keyPath}" placeholder="/path/to/key" style="
            width: 100%; padding: 6px 8px; border: 1px solid var(--border-color);
            border-radius: var(--border-radius-sm); background: var(--bg-secondary);
            color: var(--text-primary); font-size: 11px;
          ">
        </div>
      </div>
      <div style="margin-top: var(--spacing-xs);">
        <label style="display: flex; align-items: center; font-size: 11px; color: var(--text-secondary); cursor: pointer;">
          <input type="checkbox" class="extra-account-isDefault" ${isDefault ? 'checked' : ''} style="margin-right: 4px;">
          设为默认账号
        </label>
      </div>
    </div>
  `;
}

async function connectServer(serverId: string): Promise<void> {
  try {
    console.log('🔗 连接服务器:', serverId);
    hideServerModal();
    (window as any).hideConnectionDropdown();

    const connectionCard = document.querySelector('.connection-card');
    if (connectionCard) connectionCard.classList.add('connecting');

    const sshManager = getApp()?.sshManager;
    const stateManager = (window as any).app?.getStateManager?.();
    if (!sshManager) {
      (window as any).showNotification?.('SSH管理器未初始化', 'error');
      return;
    }

    const connection = sshManager.getConnection(serverId);
    if (!connection) return;

    stateManager?.setLoading(true, '准备连接...');
    (window as any).refreshDashboard?.();

    try {
      let password = '';
      const authType = connection.authType || 'password';

      if (authType === 'password' && connection.encryptedPassword) {
        try {
          stateManager?.setLoadingStep?.('解密凭据...');
          password = await (window as any).__TAURI__.core.invoke('decrypt_password', {
            encryptedPassword: connection.encryptedPassword
          });
        } catch (error) {
          console.error('❌ 解密密码失败:', error);
          (window as any).showNotification?.('密码解密失败，请检查连接配置', 'error');
          if (connectionCard) connectionCard.classList.remove('connecting');
          return;
        }
      }

      stateManager?.setLoadingStep?.(`正在连接 ${connection.host}:${connection.port}...`);
      (window as any).refreshDashboard?.();
      await sshConnectionManager.connect(
        connection.host,
        connection.port,
        connection.username,
        password,
        authType,
        connection.keyPath,
        connection.keyPassphrase
      );

      stateManager?.setLoadingStep?.('连接成功，正在初始化...');
      (window as any).refreshDashboard?.();

      if ((window as any).app?.getStateManager) {
        (window as any).app.getStateManager().setConnected(true, connection.name, {
          name: connection.name, host: connection.host, port: connection.port, username: connection.username
        });
      }

      try {
        stateManager?.setLoadingStep?.('正在获取系统信息...');
        (window as any).refreshDashboard?.();
        await sshManager.fetchSystemInfo();
      } catch (error) {
        console.warn('⚠️ 获取系统信息失败，但SSH连接成功:', error);
      }

      // 批量刷新 UI，合并到单个 rAF 避免多次全量渲染造成卡顿
      requestAnimationFrame(() => {
        (window as any).refreshServerList?.();
        (window as any).refreshSidebar?.();
        (window as any).refreshDashboard?.();
      });

      const currentPage = (window as any).app?.stateManager?.getState()?.currentPage;
      if (currentPage === 'dashboard' || currentPage === 'system-info') {
        (window as any).loadSystemDetailedInfo(true);
      }

      (window as any).showNotification?.(`已成功连接到 ${connection.name}`, 'success');

      // 连接成功后询问是否启用 busybox 可信模式
      promptBusyboxMode();
    } finally {
      stateManager?.setLoading(false);
      requestAnimationFrame(() => (window as any).refreshDashboard?.());
    }
  } catch (error) {
    console.error('❌ 连接服务器失败:', error);
    const connectionCard = document.querySelector('.connection-card');
    if (connectionCard) connectionCard.classList.remove('connecting');

    let errorMessage = '连接失败';
    if (error instanceof Error) errorMessage = error.message;
    else if (typeof error === 'string') errorMessage = error;

    if (errorMessage.includes('Authentication failed') || errorMessage.includes('认证失败')) {
      (window as any).showNotification?.('SSH认证失败：用户名或密码错误', 'error');
    } else if (errorMessage.includes('Connection refused') || errorMessage.includes('连接被拒绝')) {
      (window as any).showNotification?.('连接被拒绝：请检查服务器地址和端口', 'error');
    } else if (errorMessage.includes('timeout') || errorMessage.includes('超时')) {
      (window as any).showNotification?.('连接超时：请检查网络连接', 'error');
    } else {
      (window as any).showNotification?.(`连接失败：${errorMessage}`, 'error');
    }

    const stateManager = (window as any).app?.getStateManager?.();
    stateManager?.setLoading(false);
    (window as any).refreshDashboard?.();
  }
}

async function saveServer(formData: FormData): Promise<void> {
  try {
    const editingServerId = (window as any).editingServerId;
    const isEditing = !!editingServerId;

    const serverData: any = {
      name: formData.get('name') as string,
      host: formData.get('host') as string,
      port: parseInt(formData.get('port') as string) || 22,
      username: formData.get('username') as string,
      authType: formData.get('authType') as string,
      password: formData.get('password') as string,
      keyPath: formData.get('keyPath') as string,
      keyPassphrase: formData.get('keyPassphrase') as string,
      accounts: [] as any[]
    };

    // 主账号
    serverData.accounts.push({
      username: serverData.username,
      authType: serverData.authType,
      password: serverData.authType === 'password' ? serverData.password : undefined,
      keyPath: serverData.authType === 'key' ? serverData.keyPath : undefined,
      keyPassphrase: serverData.keyPassphrase || undefined,
      isDefault: true,
      description: '主账号'
    });

    // 额外账号
    const additionalAccountsList = document.getElementById('additional-accounts-list');
    if (additionalAccountsList) {
      additionalAccountsList.querySelectorAll('.account-item').forEach((accountEl) => {
        const username = (accountEl.querySelector('.extra-account-username') as HTMLInputElement)?.value;
        const description = (accountEl.querySelector('.extra-account-description') as HTMLInputElement)?.value;
        const authType = (accountEl.querySelector('.extra-account-authType') as HTMLSelectElement)?.value;
        const password = (accountEl.querySelector('.extra-account-password') as HTMLInputElement)?.value;
        const keyPath = (accountEl.querySelector('.extra-account-keyPath') as HTMLInputElement)?.value;
        const isDefault = (accountEl.querySelector('.extra-account-isDefault') as HTMLInputElement)?.checked;

        if (username) {
          serverData.accounts.push({
            username, authType,
            password: authType === 'password' ? password : undefined,
            keyPath: authType === 'key' ? keyPath : undefined,
            isDefault: isDefault || false,
            description: description || undefined
          });
        }
      });
    }

    if (!serverData.name || !serverData.host || !serverData.username) {
      (window as any).showNotification?.('请填写所有必填字段', 'warning');
      return;
    }

    if (serverData.authType === 'password' && !serverData.password && !isEditing) {
      (window as any).showNotification?.('密码认证方式需要提供密码', 'warning');
      return;
    }

    const sshManager = getApp()?.sshManager;
    if (sshManager) {
      if (isEditing) {
        const updateData = { ...serverData };
        if (!updateData.password) delete updateData.password;
        await sshManager.updateConnection(editingServerId, updateData);
        (window as any).showNotification?.('服务器配置更新成功', 'success');
      } else {
        await sshManager.addConnection(serverData);
        (window as any).showNotification?.('服务器配置保存成功', 'success');
      }
      (window as any).editingServerId = null;
      hideAddServerForm();
      (window as any).refreshServerList();
    } else {
      throw new Error('SSH管理器未初始化');
    }
  } catch (error) {
    let errorMessage = '保存失败';
    if (error instanceof Error) errorMessage = error.message;
    else if (typeof error === 'string') errorMessage = error;
    (window as any).showNotification?.(`保存服务器配置失败：${errorMessage}`, 'error');
  }
}

/**
 * 初始化服务器管理模态框
 */
export function initServerModalManager(): void {
  (window as any).additionalAccounts = [];
  (window as any).editingServerId = null;

  (window as any).showServerModal = showServerModal;
  (window as any).hideServerModal = hideServerModal;
  (window as any).showAddServerForm = showAddServerForm;
  (window as any).hideAddServerForm = hideAddServerForm;

  (window as any).toggleAuthFields = (authType: string) => {
    const passwordAuth = document.getElementById('password-auth');
    const keyAuth = document.getElementById('key-auth');
    if (passwordAuth && keyAuth) {
      passwordAuth.style.display = authType === 'password' ? 'block' : 'none';
      keyAuth.style.display = authType === 'key' ? 'block' : 'none';
    }
  };

  (window as any).addServerAccount = () => {
    const accountsList = document.getElementById('additional-accounts-list');
    if (!accountsList) return;
    const accountId = `account-${Date.now()}`;
    const index = (window as any).additionalAccounts.length + 2;
    accountsList.insertAdjacentHTML('beforeend', createAccountItemHtml(accountId, index));
    (window as any).additionalAccounts.push(accountId);
  };

  (window as any).removeServerAccount = (accountId: string) => {
    const accountEl = document.getElementById(accountId);
    if (accountEl) {
      accountEl.remove();
      (window as any).additionalAccounts = (window as any).additionalAccounts.filter((id: string) => id !== accountId);
    }
  };

  (window as any).toggleExtraAccountAuthFields = (accountId: string, authType: string) => {
    const accountEl = document.getElementById(accountId);
    if (!accountEl) return;
    const passwordField = accountEl.querySelector('.extra-account-password-field') as HTMLElement;
    const keyField = accountEl.querySelector('.extra-account-key-field') as HTMLElement;
    if (passwordField && keyField) {
      passwordField.style.display = authType === 'password' ? 'block' : 'none';
      keyField.style.display = authType === 'key' ? 'block' : 'none';
    }
  };

  (window as any).handleServerFormSubmit = async (event: Event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    await saveServer(new FormData(form));
  };

  (window as any).saveServer = saveServer;
  (window as any).connectServer = connectServer;

  (window as any).handleDisconnect = async () => {
    try {
      const sshManager = getApp()?.sshManager;
      if (sshManager) {
        const connections = sshManager.getConnections();
        const connectedServer = connections.find((c: any) => c.isConnected);
        if (connectedServer) {
          await (window as any).disconnectServer(connectedServer.id);
        }
      }
    } catch (error) {
      console.error('❌ 断开连接失败:', error);
    }
  };

  (window as any).disconnectServer = async (serverId: string) => {
    try {
      const sshManager = getApp()?.sshManager;
      if (sshManager) {
        await sshManager.disconnect(serverId);
        (window as any).refreshServerList();
        (window as any).refreshSidebar();
        (window as any).refreshDashboard();
        (window as any).showNotification('服务器已断开连接', 'info');
      }
    } catch (error) {
      console.error('❌ 断开服务器失败:', error);
      (window as any).showNotification(`断开连接失败: ${error}`, 'error');
    }
  };

  (window as any).testConnection = async () => {
    const form = document.getElementById('add-server-form-element') as HTMLFormElement;
    if (!form) return;

    const formData = new FormData(form);
    const host = formData.get('host') as string;
    const port = parseInt(formData.get('port') as string);
    const username = formData.get('username') as string;
    const authType = formData.get('authType') as string;
    const password = formData.get('password') as string;
    const keyPath = formData.get('keyPath') as string;
    const keyPassphrase = formData.get('keyPassphrase') as string;

    if (!host || !username) {
      (window as any).showNotification('请填写主机地址和用户名', 'warning');
      return;
    }

    const testBtn = document.getElementById('test-connection-btn');
    const originalText = testBtn ? testBtn.innerHTML : '测试连接';
    if (testBtn) {
      testBtn.innerHTML = '连接中...';
      (testBtn as HTMLButtonElement).disabled = true;
    }

    try {
      const result = await (window as any).__TAURI__.core.invoke('ssh_test_connection', {
        host, port, username, authType,
        password: password || null,
        keyPath: keyPath || null,
        keyPassphrase: keyPassphrase || null,
        certificatePath: null
      });

      if (result) {
        (window as any).showNotification('✅ 连接测试成功', 'success');
      } else {
        (window as any).showNotification('❌ 连接测试失败', 'error');
      }
    } catch (error) {
      (window as any).showNotification(`连接测试失败: ${error}`, 'error');
    } finally {
      if (testBtn) {
        testBtn.innerHTML = originalText;
        (testBtn as HTMLButtonElement).disabled = false;
      }
    }
  };

  (window as any).selectPrivateKeyFile = async () => {
    try {
      if (!(window as any).__TAURI__?.dialog) {
        (window as any).showNotification('文件选择功能不可用', 'error');
        return;
      }
      const selected = await (window as any).__TAURI__.dialog.open({
        multiple: false,
        filters: [{ name: 'SSH Key', extensions: ['pem', 'ppk', 'key', 'id_rsa', 'id_ed25519'] }]
      });
      if (selected) {
        const input = document.querySelector('input[name="keyPath"]') as HTMLInputElement;
        if (input) input.value = selected as string;
      }
    } catch (error) {
      (window as any).showNotification('选择文件失败: ' + error, 'error');
    }
  };

  (window as any).editServer = (serverId: string) => {
    try {
      const sshManager = getApp()?.sshManager;
      if (!sshManager) return;
      const connection = sshManager.getConnection(serverId);
      if (!connection) return;

      (window as any).editingServerId = serverId;
      const form = document.getElementById('add-server-form-element') as HTMLFormElement;
      if (form) {
        (form.elements.namedItem('name') as HTMLInputElement).value = connection.name;
        (form.elements.namedItem('host') as HTMLInputElement).value = connection.host;
        (form.elements.namedItem('port') as HTMLInputElement).value = connection.port.toString();
        (form.elements.namedItem('username') as HTMLInputElement).value = connection.username;
        (form.elements.namedItem('authType') as HTMLSelectElement).value = connection.authType;

        const additionalAccountsList = document.getElementById('additional-accounts-list');
        if (additionalAccountsList) {
          additionalAccountsList.innerHTML = '';
          (window as any).additionalAccounts = [];
        }

        if (connection.accounts && connection.accounts.length > 0) {
          connection.accounts.forEach((account: any, index: number) => {
            if (account.isDefault) return;
            if (additionalAccountsList) {
              const accountId = `account-${Date.now()}-${index}`;
              additionalAccountsList.insertAdjacentHTML('beforeend', createAccountItemHtml(accountId, index + 1, account));
              (window as any).additionalAccounts.push(accountId);
            }
          });
        }

        const formTitle = document.querySelector('#add-server-form h3');
        if (formTitle) formTitle.textContent = '编辑服务器';
        const submitButton = document.querySelector('#add-server-form button[type="submit"]');
        if (submitButton) submitButton.textContent = '更新服务器';
        showAddServerForm();
      }
    } catch (error) {
      console.error('❌ 编辑服务器失败:', error);
    }
  };

  (window as any).deleteServer = async (serverId: string) => {
    try {
      const userConfirmed = await showConfirm({ title: '删除服务器', message: '确定要删除这个服务器配置吗？', dangerous: true });
      if (userConfirmed) {
        const sshManager = getApp()?.sshManager;
        if (sshManager) {
          await sshManager.deleteConnection(serverId);
          (window as any).refreshServerList();
        }
      }
    } catch (error) {
      console.error('❌ 删除服务器失败:', error);
    }
  };

  (window as any).refreshServerList = async () => {
    try {
      const app = getApp();
      const renderer = app?.stateManager?.getUIRenderer?.()
        ?? (window as any).app?.getStateManager?.()?.getUIRenderer?.();
      if (!renderer) return;

      // 仅更新服务器列表内容，不替换整个 modal（outerHTML 会销毁表单和事件监听）
      const serverListEl = document.getElementById('server-list');
      if (serverListEl && renderer.renderServerList) {
        serverListEl.innerHTML = renderer.renderServerList();
      }

      // 同时更新侧边栏连接卡片
      (window as any).refreshSidebar?.();
    } catch (error) {
      console.error('刷新服务器列表失败:', error);
    }
  };

  // 点击模态框背景关闭
  document.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('modal-overlay')) {
      hideServerModal();
    }
  });
}
