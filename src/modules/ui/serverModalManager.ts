/**
 * 服务器连接管理器 — 重写
 * 卡片交互、分步表单、快速连接、导入导出
 */

import { sshConnectionManager } from '../remote/sshConnectionManager';
import { showConfirm } from './confirmDialog';
import { busyboxManager } from '../core/busyboxManager';

function getApp(): any { return (window as any).app; }

// ──── Busybox 模式选择 ────

async function promptBusyboxMode(): Promise<void> {
  const { status } = await busyboxManager.detect();
  if (status === 'enabled') return;

  const useBusybox = await showConfirm({
    title: '选择命令执行模式',
    message: status === 'installed'
      ? `检测到远端已有 busybox (${busyboxManager.getPath()})。\n\n启用 Busybox 可信模式？`
      : '是否启用 Busybox 可信命令执行模式？\n\n启用后需要选择本地 busybox 文件上传。',
    confirmText: status === 'installed' ? '启用 Busybox' : '上传并启用',
    cancelText: '使用默认模式',
  });
  if (!useBusybox) return;

  try {
    if (status === 'installed') {
      await busyboxManager.enable();
      window.showNotification?.('Busybox 可信模式已启用', 'success');
    } else {
      window.showNotification?.('请选择本地 busybox 文件...', 'info');
      await busyboxManager.uploadFromLocal();
      await busyboxManager.enable();
      window.showNotification?.('Busybox 上传并启用成功', 'success');
    }
  } catch (e: any) {
    if (!e?.message?.includes('未选择文件')) {
      window.showNotification?.(`Busybox 部署失败: ${e}`, 'warning');
    }
  }
}

// ──── 表单显示/隐藏 ────

function showServerModal(): void {
  // 新版: 服务器管理已嵌入主页面，不再弹 modal
  // 如果当前不在 system-info 页面，切换过去
  (window as any).switchPage?.('system-info');
}

function hideServerModal(): void {
  // 向后兼容，新版无需操作
  const old = document.getElementById('server-modal');
  if (old) old.remove();
}

function showAddServerForm(editData?: any): void {
  // 移除已有表单
  const existing = document.getElementById('sc-form-overlay');
  if (existing) existing.remove();

  const app = getApp();
  const renderer = app?.stateManager?.getUIRenderer?.()
    ?? (window as any).app?.getStateManager?.()?.getUIRenderer?.();
  if (!renderer) return;

  // 如果是编辑模式，加载连接数据
  let data = editData;
  if (typeof editData === 'string') {
    const sshMgr = app?.sshManager;
    if (sshMgr) {
      const conn = sshMgr.getConnection(editData);
      if (conn) data = conn;
    }
  }

  const html = renderer.renderStepForm?.(data) || '';
  if (!html) return;

  document.body.insertAdjacentHTML('beforeend', html);
}

function hideAddServerForm(): void {
  const overlay = document.getElementById('sc-form-overlay');
  if (overlay) overlay.remove();
  (window as any).editingServerId = null;
}

// (分步表单已简化为单页表单)

// ──── 认证方式切换 ────

function scSetAuthType(type: string): void {
  const hidden = document.getElementById('sc-auth-type') as HTMLInputElement;
  if (hidden) hidden.value = type;
  document.querySelectorAll('.sc-auth-option').forEach(btn => {
    btn.classList.toggle('active', btn.textContent?.includes(type === 'password' ? '密码' : '密钥') || false);
  });
  const pwBlock = document.getElementById('sc-auth-password');
  const keyBlock = document.getElementById('sc-auth-key');
  if (pwBlock) pwBlock.style.display = type === 'password' ? '' : 'none';
  if (keyBlock) keyBlock.style.display = type === 'key' ? '' : 'none';
}

// ──── 连接 ────

async function connectServer(serverId: string): Promise<void> {
  const app = getApp();
  const sshManager = app?.sshManager;
  const stateManager = app?.getStateManager?.();
  if (!sshManager) { window.showNotification?.('SSH管理器未初始化', 'error'); return; }

  const connection = sshManager.getConnection(serverId);
  if (!connection) return;

  // 卡片动画
  const card = document.getElementById(`sc-card-${serverId}`);
  if (card) card.classList.add('connecting');

  stateManager?.setLoading(true, '准备连接...');
  (window as any).refreshDashboard?.();

  try {
    let password = '';
    const authType = connection.authType || 'password';

    if (authType === 'password' && connection.encryptedPassword) {
      try {
        stateManager?.setLoadingStep?.('解密凭据...');
        password = await (window as any).__TAURI__.core.invoke('decrypt_password', { encryptedPassword: connection.encryptedPassword });
      } catch {
        window.showNotification?.('密码解密失败', 'error');
        if (card) card.classList.remove('connecting');
        return;
      }
    }

    stateManager?.setLoadingStep?.(`正在连接 ${connection.host}:${connection.port}...`);
    await sshConnectionManager.connect(connection.host, connection.port, connection.username, password, authType, connection.keyPath, connection.keyPassphrase);

    stateManager?.setLoadingStep?.('连接成功，正在初始化...');

    if (app?.getStateManager) {
      app.getStateManager().setConnected(true, connection.name, {
        name: connection.name, host: connection.host, port: connection.port, username: connection.username
      });
    }

    try {
      stateManager?.setLoadingStep?.('正在获取系统信息...');
      await sshManager.fetchSystemInfo();
    } catch { /* 非致命 */ }

    requestAnimationFrame(() => {
      (window as any).refreshServerList?.();
      (window as any).refreshSidebar?.();
      (window as any).refreshDashboard?.();
    });

    // 切换到系统概览并加载详细信息
    const currentPage = (window as any).app?.stateManager?.getState()?.currentPage;
    if (currentPage === 'system-info' || currentPage === 'dashboard') {
      (window as any).loadSystemDetailedInfo?.(true);
    } else {
      (window as any).switchPage?.('system-info');
      setTimeout(() => (window as any).loadSystemDetailedInfo?.(true), 200);
    }

    window.showNotification?.(`已连接到 ${connection.name}`, 'success');
    promptBusyboxMode();
  } catch (error) {
    if (card) card.classList.remove('connecting');
    let msg = '连接失败';
    if (error instanceof Error) msg = error.message;
    else if (typeof error === 'string') msg = error;
    window.showNotification?.(`连接失败: ${msg}`, 'error');
  } finally {
    stateManager?.setLoading(false);
    requestAnimationFrame(() => (window as any).refreshDashboard?.());
  }
}

async function disconnectServer(serverId: string): Promise<void> {
  const app = getApp();
  const sshManager = app?.sshManager;
  if (!sshManager) return;

  const conn = sshManager.getConnection(serverId);
  const confirmed = await showConfirm({
    title: '断开连接',
    message: `确定要断开与 "${conn?.name || serverId}" 的连接吗？`,
    confirmText: '断开', cancelText: '取消', dangerous: true,
  });
  if (!confirmed) return;

  try {
    await (window as any).__TAURI__?.core?.invoke('ssh_close_all_terminal_sessions').catch(() => {});
    const sshMgr = (window as any).sshConnectionManager;
    if (sshMgr?.disconnect) await sshMgr.disconnect();
    else await (window as any).__TAURI__?.core?.invoke('ssh_disconnect_direct').catch(() => {});

    if (app?.getStateManager) app.getStateManager().setConnected(false);
    window.showNotification?.('已断开连接', 'success');
  } catch (e) {
    window.showNotification?.(`断开失败: ${e}`, 'error');
  }

  requestAnimationFrame(() => {
    (window as any).refreshServerList?.();
    (window as any).refreshSidebar?.();
    (window as any).refreshDashboard?.();
  });
}

// ──── 保存 ────

async function saveServer(): Promise<void> {
  const name = (document.getElementById('sc-name') as HTMLInputElement)?.value?.trim() || '';
  const host = (document.getElementById('sc-host') as HTMLInputElement)?.value?.trim() || '';
  const port = parseInt((document.getElementById('sc-port') as HTMLInputElement)?.value || '22');
  const username = (document.getElementById('sc-username') as HTMLInputElement)?.value?.trim() || 'root';
  const authType = (document.getElementById('sc-auth-type') as HTMLInputElement)?.value || 'password';
  const password = (document.getElementById('sc-password') as HTMLInputElement)?.value || '';
  const keyPath = (document.getElementById('sc-keypath') as HTMLInputElement)?.value || '';
  const keyPassphrase = (document.getElementById('sc-keypass') as HTMLInputElement)?.value || '';
  const editingId = (document.getElementById('sc-editing-id') as HTMLInputElement)?.value || '';

  if (!host) { window.showNotification?.('请输入主机地址', 'warning'); return; }
  if (!username) { window.showNotification?.('请输入用户名', 'warning'); return; }
  if (authType === 'password' && !password && !editingId) { window.showNotification?.('请输入密码', 'warning'); return; }

  const serverData: any = {
    name: name || `${username}@${host}`,
    host, port, username, authType,
    password: authType === 'password' ? password : undefined,
    keyPath: authType === 'key' ? keyPath : undefined,
    keyPassphrase: authType === 'key' ? keyPassphrase : undefined,
  };

  try {
    const sshManager = getApp()?.sshManager;
    if (!sshManager) throw new Error('SSH管理器未初始化');

    if (editingId) {
      const update = { ...serverData };
      if (!update.password) delete update.password;
      await sshManager.updateConnection(editingId, update);
      window.showNotification?.('连接配置已更新', 'success');
    } else {
      await sshManager.addConnection(serverData);
      window.showNotification?.('连接已保存', 'success');
    }

    hideAddServerForm();
    (window as any).refreshServerList?.();
    (window as any).refreshDashboard?.();
  } catch (e) {
    window.showNotification?.(`保存失败: ${e}`, 'error');
  }
}

// ──── 编辑/删除 ────

function editServer(serverId: string): void {
  showAddServerForm(serverId);
}

async function deleteServer(serverId: string): Promise<void> {
  const confirmed = await showConfirm({ title: '删除服务器', message: '确定删除？', dangerous: true });
  if (!confirmed) return;
  const sshManager = getApp()?.sshManager;
  if (sshManager) {
    await sshManager.deleteConnection(serverId);
    (window as any).refreshServerList?.();
    (window as any).refreshDashboard?.();
  }
}

// ──── 快速连接 ────

async function scQuickConnect(): Promise<void> {
  const input = (document.getElementById('sc-quick-input') as HTMLInputElement)?.value?.trim();
  if (!input) { window.showNotification?.('请输入 user@host:port', 'warning'); return; }

  // 解析 user@host:port
  const match = input.match(/^(?:(\w+)@)?([^:]+)(?::(\d+))?$/);
  if (!match) { window.showNotification?.('格式错误，应为 user@host:port', 'warning'); return; }

  const username = match[1] || 'root';
  const host = match[2];
  const port = parseInt(match[3] || '22');

  // 弹出密码输入
  const { showPrompt } = await import('./confirmDialog');
  const password = await showPrompt({ title: '快速连接', message: `${username}@${host}:${port} 的密码:`, defaultValue: '' });
  if (password === null) return;

  const stateManager = getApp()?.getStateManager?.();
  stateManager?.setLoading(true, `正在连接 ${host}:${port}...`);
  (window as any).refreshDashboard?.();

  try {
    await sshConnectionManager.connect(host, port, username, password, 'password');
    if (getApp()?.getStateManager) {
      getApp().getStateManager().setConnected(true, `${username}@${host}`, { name: `${username}@${host}`, host, port, username });
    }
    try { await getApp()?.sshManager?.fetchSystemInfo(); } catch { /* ok */ }
    requestAnimationFrame(() => {
      (window as any).refreshSidebar?.();
      (window as any).refreshDashboard?.();
    });
    (window as any).switchPage?.('system-info');
    setTimeout(() => (window as any).loadSystemDetailedInfo?.(true), 200);
    window.showNotification?.(`已连接到 ${host}`, 'success');
    promptBusyboxMode();
  } catch (e) {
    window.showNotification?.(`连接失败: ${e}`, 'error');
  } finally {
    stateManager?.setLoading(false);
    requestAnimationFrame(() => (window as any).refreshDashboard?.());
  }
}

// ──── 搜索过滤 ────

function scFilterServers(query: string): void {
  const q = query.toLowerCase();
  document.querySelectorAll('.sc-card[data-server-id]').forEach(card => {
    const name = card.querySelector('.sc-card-name')?.textContent?.toLowerCase() || '';
    const addr = card.querySelector('.sc-card-addr')?.textContent?.toLowerCase() || '';
    (card as HTMLElement).style.display = (!q || name.includes(q) || addr.includes(q)) ? '' : 'none';
  });
}

// ──── 导入导出 ────

function scExportConfig(): void {
  const sshManager = getApp()?.sshManager;
  if (!sshManager) return;
  const conns = sshManager.getConnections().map((c: any) => ({
    name: c.name, host: c.host, port: c.port, username: c.username,
    authType: c.authType, accounts: c.accounts,
    // 不导出密码
  }));
  const json = JSON.stringify(conns, null, 2);
  navigator.clipboard.writeText(json).catch(() => {});
  window.showNotification?.(`已导出 ${conns.length} 个连接到剪贴板`, 'success');
}

async function scImportConfig(): Promise<void> {
  const { showPrompt } = await import('./confirmDialog');
  const json = await showPrompt({ title: '导入配置', message: '粘贴 JSON 配置:', defaultValue: '' });
  if (!json) return;
  try {
    const conns = JSON.parse(json);
    if (!Array.isArray(conns)) throw new Error('格式错误');
    const sshManager = getApp()?.sshManager;
    if (!sshManager) return;
    let count = 0;
    for (const c of conns) {
      if (c.host) { await sshManager.addConnection(c); count++; }
    }
    window.showNotification?.(`已导入 ${count} 个连接`, 'success');
    (window as any).refreshServerList?.();
    (window as any).refreshDashboard?.();
  } catch (e) {
    window.showNotification?.(`导入失败: ${e}`, 'error');
  }
}

// ──── 连接测试 ────

async function testConnection(): Promise<void> {
  const host = (document.getElementById('sc-host') as HTMLInputElement)?.value?.trim();
  const port = parseInt((document.getElementById('sc-port') as HTMLInputElement)?.value || '22');
  const username = (document.getElementById('sc-username') as HTMLInputElement)?.value?.trim() || 'root';
  const authType = (document.getElementById('sc-auth-type') as HTMLInputElement)?.value || 'password';
  const password = (document.getElementById('sc-password') as HTMLInputElement)?.value || '';
  const keyPath = (document.getElementById('sc-keypath') as HTMLInputElement)?.value || '';

  if (!host) { window.showNotification?.('请输入主机地址', 'warning'); return; }

  const testBtn = document.getElementById('sc-btn-test') as HTMLButtonElement;
  if (testBtn) { testBtn.disabled = true; testBtn.textContent = '测试中...'; }

  try {
    await (window as any).__TAURI__.core.invoke('ssh_test_connection', {
      host, port, username, password: authType === 'password' ? password : '',
      authType, keyPath: authType === 'key' ? keyPath : '',
    });
    window.showNotification?.('连接测试成功', 'success');
  } catch (e) {
    window.showNotification?.(`连接测试失败: ${e}`, 'error');
  } finally {
    if (testBtn) { testBtn.disabled = false; testBtn.textContent = '测试连接'; }
  }
}

// ──── 密钥文件选择 ────

async function selectPrivateKeyFile(): Promise<void> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({ title: '选择 SSH 私钥文件', multiple: false });
    if (typeof selected === 'string') {
      const input = document.getElementById('sc-keypath') as HTMLInputElement;
      if (input) input.value = selected;
    }
  } catch { window.showNotification?.('文件选择不可用', 'warning'); }
}

// ──── 服务器列表刷新 ────

function refreshServerList(): void {
  const grid = document.getElementById('sc-grid');
  const app = getApp();
  const renderer = app?.stateManager?.getUIRenderer?.() ?? (window as any).app?.getStateManager?.()?.getUIRenderer?.();
  if (grid && renderer?.renderServerList) {
    grid.innerHTML = renderer.renderServerList();
  }
}

// ──── 注册到 window ────

export function initServerModalManager(): void {
  (window as any).showServerModal = showServerModal;
  (window as any).hideServerModal = hideServerModal;
  (window as any).showAddServerForm = showAddServerForm;
  (window as any).hideAddServerForm = hideAddServerForm;
  (window as any).connectServer = connectServer;
  (window as any).disconnectServer = disconnectServer;
  (window as any).editServer = editServer;
  (window as any).deleteServer = deleteServer;
  (window as any).saveServer = saveServer;
  (window as any).testConnection = testConnection;
  (window as any).selectPrivateKeyFile = selectPrivateKeyFile;
  (window as any).refreshServerList = refreshServerList;
  (window as any).scQuickConnect = scQuickConnect;
  (window as any).scFilterServers = scFilterServers;
  (window as any).scImportConfig = scImportConfig;
  (window as any).scExportConfig = scExportConfig;
  (window as any).scSetAuthType = scSetAuthType;
  (window as any).handleServerFormSubmit = saveServer;
  (window as any).filterServerList = scFilterServers;
}
