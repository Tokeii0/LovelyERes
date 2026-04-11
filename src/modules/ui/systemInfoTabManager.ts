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
  recentfiles: 'recentFiles',
  docker: 'dockerContainers',
  kubernetes: 'kubernetesPods',
  webapps: 'webApps',
  openports: 'openPorts',
  established: 'established',
  autoruns: 'autoruns',
  rootcheck: 'rootcheck',
  sensitive: 'sensitiveFiles'
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
  recentfiles: 'updateRecentFilesTable',
  docker: 'updateDockerTable',
  kubernetes: 'updateKubernetesTable',
  webapps: 'updateGenericTable_webapps',
  openports: 'updateGenericTable_openports',
  established: 'updateGenericTable_established',
  autoruns: 'updateGenericTable_autoruns',
  rootcheck: 'updateGenericTable_rootcheck',
  sensitive: 'updateGenericTable_sensitive'
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

      // 特殊 Tab: 独立获取数据（不走渐进式加载）
      const extraTabs = ['docker', 'kubernetes', 'webapps', 'openports', 'established', 'autoruns', 'rootcheck', 'sensitive'];
      if (extraTabs.includes(tabId)) {
        showTableLoadingState(tabId);
        fetchExtraTabData(tabId).then(data => {
          if (!cache.detailedInfo) cache.detailedInfo = {};
          cache.detailedInfo[dataKey] = data;
          loadSystemInfoTabData(tabId, cache.detailedInfo);
        }).catch(() => {
          const tbody = document.getElementById(`${tabId}-table-body`);
          if (tbody) tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text-secondary);">获取数据失败或服务未运行</td></tr>';
        });
      } else
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
 * Docker/K8s 数据获取 (通过 SSH 直接获取)
 */
async function fetchExtraTabData(tabId: string): Promise<any[]> {
  const { invoke } = await import('@tauri-apps/api/core');
  const exec = async (cmd: string) => {
    const r = await invoke('ssh_execute_command_direct', { command: cmd }) as any;
    return r?.output || '';
  };

  if (tabId === 'docker') {
    const out = await exec("docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}' 2>/dev/null | head -50");
    return out.split('\n').filter(Boolean).map((line: string) => {
      const [id, name, image, status, ports, created] = line.split('|');
      return {
        id: id?.substring(0, 12) || '', name: name || '', image: image || '',
        status: status || '', ports: ports || '', created: created || '',
      };
    });
  }

  if (tabId === 'kubernetes') {
    const out = await exec("kubectl get pods -A --no-headers 2>/dev/null | head -50 || echo ''");
    return out.split('\n').filter(Boolean).map((line: string) => {
      const parts = line.trim().split(/\s+/);
      return {
        namespace: parts[0] || '', name: parts[1] || '', ready: parts[2] || '',
        status: parts[3] || '', restarts: parts[4] || '', age: parts[5] || '',
      };
    });
  }

  if (tabId === 'webapps') {
    // 检测 Nginx/Apache/Tomcat/PHP-FPM 站点
    const out = await exec(`echo "=== Nginx ===" && (nginx -T 2>/dev/null | grep -E 'server_name|listen|root' | head -20 || echo "未安装") && echo "=== Apache ===" && (apachectl -S 2>/dev/null | head -15 || httpd -S 2>/dev/null | head -15 || echo "未安装") && echo "=== Tomcat ===" && (ls /opt/tomcat*/webapps/ /var/lib/tomcat*/webapps/ 2>/dev/null | head -10 || echo "未安装") && echo "=== PHP-FPM ===" && (php-fpm -t 2>/dev/null | head -3 || echo "未安装")`);
    return out.split('\n').filter(Boolean).map((line: string) => {
      const isHeader = line.startsWith('===');
      return { type: isHeader ? '' : 'config', path: line, status: '', config: '', user: '' };
    });
  }

  if (tabId === 'openports') {
    // 所有监听端口 + 进程
    const out = await exec("ss -tlnp 2>/dev/null | tail -n +2 | head -50 || netstat -tlnp 2>/dev/null | tail -n +2 | head -50");
    return out.split('\n').filter(Boolean).map((line: string) => {
      const parts = line.trim().split(/\s+/);
      const local = parts[3] || '';
      const [addr, port] = local.includes(':') ? [local.substring(0, local.lastIndexOf(':')), local.substring(local.lastIndexOf(':') + 1)] : ['', local];
      const proc = parts[5] || parts[6] || '';
      const pidMatch = proc.match(/pid=(\d+)/);
      const nameMatch = proc.match(/\("([^"]+)"/);
      return { proto: parts[0] || 'tcp', addr, port, pid: pidMatch?.[1] || '', process: nameMatch?.[1] || proc, user: '' };
    });
  }

  if (tabId === 'established') {
    // 外连排查: ESTABLISHED 连接
    const out = await exec("ss -tnp state established 2>/dev/null | tail -n +2 | head -50 || netstat -tnp 2>/dev/null | grep ESTABLISHED | head -50");
    return out.split('\n').filter(Boolean).map((line: string) => {
      const parts = line.trim().split(/\s+/);
      const local = parts[3] || '';
      const remote = parts[4] || '';
      const remotePort = remote.includes(':') ? remote.substring(remote.lastIndexOf(':') + 1) : '';
      const remoteAddr = remote.includes(':') ? remote.substring(0, remote.lastIndexOf(':')) : remote;
      const proc = parts[5] || parts[6] || '';
      const pidMatch = proc.match(/pid=(\d+)/);
      const nameMatch = proc.match(/\("([^"]+)"/);
      return { local, remote: remoteAddr, remotePort, pid: pidMatch?.[1] || '', process: nameMatch?.[1] || proc, user: '' };
    });
  }

  if (tabId === 'autoruns') {
    // 启动项汇总: systemd enabled + cron + rc.local + init.d + bashrc
    const out = await exec(`echo "=SYSTEMD=" && systemctl list-unit-files --type=service --state=enabled --no-pager 2>/dev/null | grep enabled | head -20 && echo "=CRON=" && for u in $(cut -d: -f1 /etc/passwd | head -20); do c=$(crontab -l -u $u 2>/dev/null | grep -v '^#' | grep -v '^$'); [ -n "$c" ] && echo "$u: $c"; done | head -15 && echo "=RCLOCAL=" && cat /etc/rc.local 2>/dev/null | grep -v '^#' | grep -v '^$' | head -5 && echo "=INITD=" && ls /etc/init.d/ 2>/dev/null | head -10`);
    const items: any[] = [];
    let currentType = '';
    out.split('\n').filter(Boolean).forEach((line: string) => {
      if (line.startsWith('=')) { currentType = line.replace(/=/g, ''); return; }
      const typeMap: Record<string, string> = { SYSTEMD: 'systemd', CRON: 'crontab', RCLOCAL: 'rc.local', INITD: 'init.d' };
      items.push({ type: typeMap[currentType] || currentType, name: line.split(/\s+/)[0] || line, status: 'enabled', path: line, user: '' });
    });
    return items;
  }

  if (tabId === 'rootcheck') {
    // Rootkit 快速检查
    const out = await exec(`echo "CHECK|LD_PRELOAD|" && (cat /etc/ld.so.preload 2>/dev/null | head -3 || echo "CHECK|LD_PRELOAD|clean") && echo "CHECK|SUID异常|" && find /usr/bin /usr/sbin /bin /sbin -perm -4000 -type f 2>/dev/null | xargs file 2>/dev/null | grep -E "script|text" | head -5 && echo "CHECK|隐藏进程|" && (ps aux | wc -l; ls /proc/ | grep -E '^[0-9]+$' | wc -l) && echo "CHECK|内核模块|" && lsmod 2>/dev/null | grep -v -E '^Module|^ip|^nf|^x_|^xt_|^br_|^overlay|^veth' | head -10 && echo "CHECK|PAM后门|" && find /lib/security /lib64/security -name '*.so' -mmin -10080 2>/dev/null | head -5 && echo "CHECK|SSH后门|" && (strings /usr/sbin/sshd 2>/dev/null | grep -ic 'backdoor\\|secret\\|hack' || echo "0")`);
    const items: any[] = [];
    let check = '';
    out.split('\n').filter(Boolean).forEach((line: string) => {
      if (line.startsWith('CHECK|')) { const p = line.split('|'); check = p[1] || ''; if (p[2]) items.push({ check, result: p[2], detail: '' }); return; }
      items.push({ check, result: line.includes('clean') || line.trim() === '0' ? 'clean' : 'suspicious', detail: line });
    });
    return items;
  }

  if (tabId === 'sensitive') {
    // 敏感文件: SSH密钥/密码文件/配置文件/数据库凭据
    const out = await exec(`find / -maxdepth 4 \\( -name "*.pem" -o -name "*.key" -o -name "id_rsa*" -o -name "id_ed25519*" -o -name ".env" -o -name "wp-config.php" -o -name "config.php" -o -name "database.yml" -o -name ".git-credentials" -o -name ".netrc" -o -name ".pgpass" -o -name ".my.cnf" -o -name "shadow" -o -name "gshadow" \\) -type f 2>/dev/null | head -30 | while read f; do echo "$f|$(stat -c '%a|%U|%Y' "$f" 2>/dev/null)"; done`);
    return out.split('\n').filter(Boolean).map((line: string) => {
      const [path, perms, owner, mtime] = line.split('|');
      const ext = (path || '').split('.').pop() || '';
      const typeMap: Record<string, string> = { pem: 'SSL证书', key: '私钥', env: '环境变量', php: 'PHP配置', yml: 'DB配置' };
      const ts = mtime ? new Date(parseInt(mtime) * 1000).toLocaleString() : '';
      return { path: path || line, type: typeMap[ext] || '敏感文件', perms: perms || '', owner: owner || '', modified: ts };
    });
  }

  return [];
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
