/**
 * 系统信息标签管理器
 * 管理系统信息页面的标签切换、数据加载和仪表盘自动刷新
 */

import { sshConnectionManager } from '../remote/sshConnectionManager';


function switchSystemInfoTab(tabId: string): void {
  console.log('🔄 切换系统信息标签页:', tabId);

  // 更新标签按钮状态
  document.querySelectorAll('.tab-btn').forEach(btn => {
    const htmlBtn = btn as HTMLElement;
    htmlBtn.classList.remove('active');
    const btnTabId = htmlBtn.getAttribute('data-tab');
    if (btnTabId === tabId) {
      htmlBtn.classList.add('active');
      htmlBtn.style.color = 'var(--primary-color)';
      htmlBtn.style.borderBottom = '2px solid var(--primary-color)';
    } else {
      htmlBtn.style.color = 'var(--text-secondary)';
      htmlBtn.style.borderBottom = '2px solid transparent';
    }
  });

  // 更新标签页内容
  const contentContainer = document.getElementById('system-info-content');
  if (contentContainer) {
    const renderer = (window as any).app?.modernUIRenderer;
    if (renderer) {
      const currentContent = contentContainer.innerHTML;
      const expectedContent = renderer.renderSystemInfoTab(tabId);
      if (!currentContent || !currentContent.includes(`id="${tabId}-table-body"`)) {
        contentContainer.innerHTML = expectedContent;
      }

      const cache = (window as any).systemInfoCache;
      if (cache.detailedInfo) {
        (window as any).loadSystemInfoTabData(tabId, cache.detailedInfo);
      } else {
        (window as any).loadSystemDetailedInfo();
      }
    }
  }
}

async function loadSystemDetailedInfo(forceRefresh = false): Promise<any> {
  try {
    const isConnected = sshConnectionManager.isConnected();
    if (!isConnected) {
      console.log('❌ SSH未连接，无法获取系统详细信息');
      return null;
    }

    const cache = (window as any).systemInfoCache;
    const cacheValid = cache.detailedInfo &&
      cache.lastUpdate &&
      (Date.now() - cache.lastUpdate) < 5 * 60 * 1000;

    if (!forceRefresh && cacheValid && !cache.isLoading) {
      console.log('📋 使用缓存的系统详细信息');
      const activeTab = document.querySelector('.tab-btn.active');
      if (activeTab) {
        const tabId = activeTab.getAttribute('data-tab') || 'processes';
        (window as any).loadSystemInfoTabData(tabId, cache.detailedInfo);
      }
      const app = (window as any).app;
      if (app && app.modernUIRenderer && typeof app.modernUIRenderer.updateSystemInfoTabs === 'function') {
        app.modernUIRenderer.updateSystemInfoTabs(cache.detailedInfo);
      }
      return cache.detailedInfo;
    }

    if (cache.isLoading && !forceRefresh) {
      console.log('⏳ 系统详细信息正在加载中...');
      return;
    }

    if (forceRefresh) {
      cache.isLoading = false;
    }

    console.log('🔍 开始加载系统详细信息...');
    cache.isLoading = true;

    const app = (window as any).app;
    if (app && app.systemInfoManager) {
      const detailedInfo = await app.systemInfoManager.getDetailedSystemInfo();
      console.log('✅ 系统详细信息加载完成:', detailedInfo);

      cache.detailedInfo = detailedInfo;
      cache.lastUpdate = Date.now();
      cache.isLoading = false;

      // 更新"上次更新"时间戳
      const tsEl = document.getElementById('system-info-last-update');
      if (tsEl) {
        const now = new Date();
        tsEl.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} 更新`;
      }

      // 更新当前活动的 tab
      const activeTab = document.querySelector('.tab-btn.active');
      if (activeTab) {
        const tabId = activeTab.getAttribute('data-tab') || 'processes';
        (window as any).loadSystemInfoTabData(tabId, detailedInfo);
      }
      if (app.modernUIRenderer && typeof app.modernUIRenderer.updateSystemInfoTabs === 'function') {
        app.modernUIRenderer.updateSystemInfoTabs(detailedInfo);
      }

      return detailedInfo;
    }
  } catch (error) {
    console.error('❌ 加载系统详细信息失败:', error);
    const cache = (window as any).systemInfoCache;
    cache.isLoading = false;
  }
}

function loadSystemInfoTabData(tabId: string, detailedInfo?: any): void {
  if (!detailedInfo) {
    console.log('⏳ 等待详细信息加载...');
    return;
  }

  console.log('📊 更新标签页数据:', tabId);

  const updateMap: Record<string, string> = {
    processes: 'updateProcessesTable',
    network: 'updateNetworkTable',
    services: 'updateServicesTable',
    users: 'updateUsersTable',
    autostart: 'updateAutostartTable',
    cron: 'updateCronTable',
    firewall: 'updateFirewallTable',
    sshkeys: 'updateSSHKeysTable',
    loginhistory: 'updateLoginHistoryTable',
    suidfiles: 'updateSUIDFilesTable',
    envvars: 'updateEnvVariablesTable',
    shellconfigs: 'updateShellConfigsTable',
    packages: 'updateInstalledPackagesTable',
    sudoers: 'updateSudoersTable',
    timers: 'updateSystemdTimersTable',
    kernelmodules: 'updateKernelModulesTable',
    recentfiles: 'updateRecentFilesTable'
  };

  const dataKeyMap: Record<string, string> = {
    processes: 'processes',
    network: 'networkDetails',
    services: 'services',
    users: 'users',
    autostart: 'autostart',
    cron: 'cronJobs',
    firewall: 'firewallRules',
    sshkeys: 'sshKeys',
    loginhistory: 'loginHistory',
    suidfiles: 'suidFiles',
    envvars: 'envVariables',
    shellconfigs: 'shellConfigs',
    packages: 'installedPackages',
    sudoers: 'sudoersConfig',
    timers: 'systemdTimers',
    kernelmodules: 'kernelModules',
    recentfiles: 'recentFiles'
  };

  const funcName = updateMap[tabId];
  const dataKey = dataKeyMap[tabId];
  if (funcName && typeof (window as any)[funcName] === 'function') {
    (window as any)[funcName](detailedInfo[dataKey] || []);
  }
}

async function refreshAllSystemInfo(): Promise<void> {
  console.log('🔄 开始刷新所有系统信息...');

  try {
    const content = document.getElementById('system-info-content');
    if (content) {
      content.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 40px; color: var(--text-secondary);">
          <div style="text-align: center;">
            <div style="font-size: 24px; margin-bottom: 10px;">⏳</div>
            <div>正在刷新系统信息...</div>
          </div>
        </div>
      `;
    }

    const app = (window as any).app;
    if (!app || !app.systemInfoManager) {
      console.error('❌ 应用实例或系统信息管理器未找到');
      if (content) {
        content.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: center; padding: 40px; color: var(--text-error);">
            <div style="text-align: center;">
              <div style="font-size: 24px; margin-bottom: 10px;">❌</div>
              <div>应用实例未找到，请刷新页面重试</div>
            </div>
          </div>
        `;
      }
      return;
    }

    app.systemInfoManager.clearCache();
    const detailedInfo = await app.systemInfoManager.getDetailedSystemInfo();
    console.log('✅ 系统信息刷新完成');

    const state = app.stateManager.getState();
    if (state.serverInfo) {
      state.serverInfo.detailedInfo = detailedInfo;
      app.stateManager.setState(state);
    }

    if (app.modernUIRenderer && typeof app.modernUIRenderer.updateSystemInfoTabs === 'function') {
      app.modernUIRenderer.updateSystemInfoTabs(detailedInfo);
    }

    const activeTab = document.querySelector('.tab-btn.active');
    const currentTabId = activeTab ? activeTab.getAttribute('data-tab') : 'processes';

    if (currentTabId) {
      loadSystemInfoTabData(currentTabId, detailedInfo);
    }

    (window as any).showNotification && (window as any).showNotification('系统信息已刷新', 'success');
  } catch (error) {
    console.error('❌ 刷新系统信息失败:', error);
    const content = document.getElementById('system-info-content');
    if (content) {
      content.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; padding: 40px; color: var(--text-error);">
          <div style="text-align: center;">
            <div style="font-size: 24px; margin-bottom: 10px;">❌</div>
            <div>刷新失败: ${error}</div>
            <button onclick="window.refreshAllSystemInfo()" style="
              margin-top: 10px;
              padding: 8px 16px;
              background: var(--bg-primary);
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius);
              cursor: pointer;
              font-size: 14px;
            ">重试</button>
          </div>
        </div>
      `;
    }
  }
}

/**
 * 初始化系统信息标签管理器
 */
export function initSystemInfoTabManager(): void {
  // 系统信息数据缓存
  (window as any).systemInfoCache = {
    detailedInfo: null,
    lastUpdate: null,
    isLoading: false
  };

  (window as any).switchSystemInfoTab = switchSystemInfoTab;
  (window as any).loadSystemDetailedInfo = loadSystemDetailedInfo;
  (window as any).loadSystemInfoTabData = loadSystemInfoTabData;
  (window as any).refreshAllSystemInfo = refreshAllSystemInfo;
}
