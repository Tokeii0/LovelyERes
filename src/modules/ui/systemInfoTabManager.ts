/**
 * 系统信息标签管理器
 * 管理系统信息页面的标签切换、数据加载和仪表盘自动刷新
 * 支持渐进式加载 - 每个数据类别完成后立即更新UI
 */

import { sshConnectionManager } from '../remote/sshConnectionManager';

// tabId → detailedInfo 属性名映射（模块级常量）
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

// detailedInfo 属性名 → tabId 反向映射
const keyToTabMap: Record<string, string> = {};
for (const [tabId, key] of Object.entries(dataKeyMap)) {
  keyToTabMap[key] = tabId;
}

// tabId → 更新函数名映射
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

/**
 * 在表格中显示加载状态
 */
function showTableLoadingState(tabId: string): void {
  const tbody = document.getElementById(`${tabId}-table-body`);
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 40px; color: var(--text-secondary);">
      <div style="display: flex; align-items: center; justify-content: center; gap: 10px;">
        <div class="progressive-loading-spinner"></div>
        <span>正在加载数据...</span>
      </div>
    </td></tr>`;
  }
}

/**
 * 获取当前活跃标签页的tabId
 */
function getActiveTabId(): string | null {
  const activeTab = document.querySelector('.tab-btn.active');
  return activeTab ? activeTab.getAttribute('data-tab') : null;
}

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
      const dataKey = dataKeyMap[tabId];

      // 检查此标签页的数据是否已加载
      if (cache.detailedInfo && cache.detailedInfo[dataKey] &&
          Array.isArray(cache.detailedInfo[dataKey]) && cache.detailedInfo[dataKey].length > 0) {
        // 数据已就绪，立即渲染
        loadSystemInfoTabData(tabId, cache.detailedInfo);
      } else if (cache.isLoading) {
        // 正在渐进式加载中，显示加载状态
        showTableLoadingState(tabId);
      } else {
        // 无数据且未加载，触发加载
        showTableLoadingState(tabId);
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
      const activeTabId = getActiveTabId() || 'processes';
      loadSystemInfoTabData(activeTabId, cache.detailedInfo);
      const app = (window as any).app;
      if (app?.modernUIRenderer?.updateSystemInfoTabs) {
        app.modernUIRenderer.updateSystemInfoTabs(cache.detailedInfo);
      }
      return cache.detailedInfo;
    }

    if (cache.isLoading && !forceRefresh) {
      console.log('⏳ 系统详细信息正在渐进式加载中...');
      return;
    }

    console.log('🔍 开始渐进式加载系统详细信息...');
    cache.isLoading = true;
    cache.detailedInfo = cache.detailedInfo || {};
    const loadedCount = { value: 0 };
    const totalTasks = Object.keys(dataKeyMap).length;

    // 显示当前标签页的加载状态
    const currentTabId = getActiveTabId();
    if (currentTabId) {
      showTableLoadingState(currentTabId);
    }

    // 更新加载进度指示
    function updateLoadingProgress(): void {
      const progressEl = document.getElementById('system-info-loading-progress');
      if (progressEl) {
        progressEl.textContent = `${loadedCount.value}/${totalTasks}`;
      }
    }

    const app = (window as any).app;
    if (app?.systemInfoManager) {
      if (forceRefresh) {
        app.systemInfoManager.clearCache();
      }

      const detailedInfo = await app.systemInfoManager.fetchDetailedInfoProgressive(
        (key: string, data: any[]) => {
          // 渐进式回调：每个数据类别完成后立即更新UI
          cache.detailedInfo[key] = data;
          loadedCount.value++;

          console.log(`📦 ${key} 加载完成 (${loadedCount.value}/${totalTasks})`);
          updateLoadingProgress();

          // 更新所有标签页的计数徽章
          if (app.modernUIRenderer?.updateSystemInfoTabs) {
            app.modernUIRenderer.updateSystemInfoTabs(cache.detailedInfo);
          }

          // 如果此数据对应当前活跃标签页，立即渲染表格
          const activeTabId = getActiveTabId();
          if (activeTabId) {
            const activeDataKey = dataKeyMap[activeTabId];
            if (activeDataKey === key) {
              loadSystemInfoTabData(activeTabId, cache.detailedInfo);
            }
          }
        }
      );

      cache.detailedInfo = detailedInfo;
      cache.lastUpdate = Date.now();
      cache.isLoading = false;

      // 更新"上次更新"时间戳
      const tsEl = document.getElementById('system-info-last-update');
      if (tsEl) {
        const now = new Date();
        tsEl.textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} 更新`;
      }

      // 确保当前标签页显示最终数据
      const activeTabId = getActiveTabId();
      if (activeTabId) {
        loadSystemInfoTabData(activeTabId, detailedInfo);
      }

      console.log('✅ 所有系统详细信息渐进式加载完成');
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

  const funcName = updateMap[tabId];
  const dataKey = dataKeyMap[tabId];
  if (funcName && typeof (window as any)[funcName] === 'function') {
    (window as any)[funcName](detailedInfo[dataKey] || []);
  }
}

async function refreshAllSystemInfo(): Promise<void> {
  console.log('🔄 开始刷新所有系统信息...');

  try {
    const app = (window as any).app;
    if (!app || !app.systemInfoManager) {
      console.error('❌ 应用实例或系统信息管理器未找到');
      const content = document.getElementById('system-info-content');
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

    // 清除缓存，开始渐进式刷新
    app.systemInfoManager.clearCache();
    const cache = (window as any).systemInfoCache;
    cache.detailedInfo = null;
    cache.lastUpdate = null;

    // 显示当前标签页的加载状态（不替换整个容器）
    const currentTabId = getActiveTabId();
    if (currentTabId) {
      showTableLoadingState(currentTabId);
    }

    // 使用渐进式加载
    const detailedInfo = await loadSystemDetailedInfo(true);

    // 更新应用状态
    const state = app.stateManager.getState();
    if (state.serverInfo) {
      state.serverInfo.detailedInfo = detailedInfo;
      app.stateManager.setState(state);
    }

    (window as any).showNotification?.('系统信息已刷新', 'success');
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
 * 注入渐进式加载的CSS样式
 */
function injectLoadingStyles(): void {
  if (document.querySelector('#progressive-loading-styles')) return;
  const style = document.createElement('style');
  style.id = 'progressive-loading-styles';
  style.textContent = `
    @keyframes progressive-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .progressive-loading-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--border-color, #e0e0e0);
      border-top-color: var(--primary-color, #1890ff);
      border-radius: 50%;
      animation: progressive-spin 0.8s linear infinite;
    }
    .tab-btn .tab-loading-dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--primary-color, #1890ff);
      animation: progressive-spin 1s linear infinite;
      margin-left: 4px;
    }
  `;
  document.head.appendChild(style);
}

/**
 * 初始化系统信息标签管理器
 */
export function initSystemInfoTabManager(): void {
  // 注入加载动画样式
  injectLoadingStyles();

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
