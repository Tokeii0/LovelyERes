/**
 * Emergency Commands and Quick Detection Renderer
 * Extracted from ModernUIRenderer - handles rendering of emergency commands page,
 * quick detection page, and detection report modal.
 */

import type { AppState } from '../../core/app';
import { emergencyCategories } from '../../emergency/commands';
import { renderCatsColumn, renderChecksColumn, emptyDetail, renderFindingPanel } from '../../emergency/emergencyView';
import {
  // Quick Detection icons
  User,
  Lock,
  Shield,
  Analysis,
  FileText,
  Config,
  NetworkTree,
  System,
  Time,
  SettingConfig,
  Cpu,
  Memory,
  Speed,
  LinkCloud,
  Code,
  Key,
  Rocket,
  History
} from '@icon-park/svg';

export class EmergencyRenderer {
  constructor(_state: AppState) {}

  setState(_state: AppState): void {
    // State stored in modernUIRenderer; renderers access it via method params if needed
  }

  /**
   * Render the emergency commands page
   */
  renderEmergencyCommandsPage(): string {
    const activeCat = emergencyCategories[0]?.id || 'permissions';

    // Account options
    const sshManager = (window as any).app?.sshManager;
    const sshConnectionManager = (window as any).sshConnectionManager;
    const currentConnectionId = sshConnectionManager?.getCurrentConnectionId?.();
    let accountsOptions = '<option value="">默认账号</option>';
    if (currentConnectionId && sshManager) {
      const connection = sshManager.getConnection(currentConnectionId);
      if (connection?.accounts?.length) {
        connection.accounts.forEach((a: any) => {
          const label = a.description ? `${a.username} (${a.description})` : a.username;
          accountsOptions += `<option value="${a.username}">${label}</option>`;
        });
      }
    }

    return `
      <div class="emergency-page">
        <div class="em-toolbar">
          <button class="em-sys-btn" id="em-sys-btn" title="目标系统">
            <span class="em-sys-dot"></span>
            <span id="detected-system-info" class="em-sys-name">检测中...</span>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
          </button>
          <div class="em-search-wrapper">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
            <input type="text" class="em-search-input" placeholder="搜索命令、用途或标签..." oninput="window.emergencyPageManager?.handleSearch(this.value)">
            <kbd class="em-kbd">Ctrl K</kbd>
          </div>
          <div class="em-account-select-wrapper">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
            <span class="em-account-label">执行账户</span>
            <select id="emergency-account-select" class="em-account-select">${accountsOptions}</select>
          </div>
          <button class="em-toolbar-btn" onclick="window.commandHistoryModal?.show()">${History({ theme: 'outline', size: '14', fill: 'currentColor' })}<span>执行历史</span></button>
          <button class="em-toolbar-btn" onclick="window.emergencyShowFavorites && window.emergencyShowFavorites()"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.5 5.5 6 .5-4.5 4 1.4 6L12 16l-5.4 3 1.4-6L3.5 9l6-.5z"/></svg><span>我的收藏</span></button>
          <div class="em-busybox-toggle" id="em-busybox-toggle">
            <button class="em-busybox-pill" id="em-busybox-btn" onclick="window.__busyboxToggle?.()">
              <span id="em-busybox-indicator" class="em-busybox-dot off"></span>
              <span id="em-busybox-label">Busybox</span>
            </button>
          </div>
        </div>

        <div class="em-layout">
          <aside class="em-cats" id="em-cats">${renderCatsColumn(activeCat)}</aside>
          <aside class="em-checks" id="em-checks">${renderChecksColumn(activeCat, '')}</aside>
          <section class="em-detail" id="em-detail">${emptyDetail()}</section>
          <aside class="em-finding" id="em-finding">${renderFindingPanel(null)}</aside>
        </div>
      </div>
    `;
  }

  /**
   * 渲染快速检测页面
   */
  renderQuickDetectionPage(): string {
    const icon = (fn: any, size = '16', theme = 'outline') =>
      fn({ theme, size, fill: 'currentColor' });

    // 安全检测项目
    const securityChecks = [
      { id: 'port-scan', name: '端口安全扫描', description: '检测开放端口和高危服务', iconFunc: NetworkTree },
      { id: 'user-audit', name: '用户权限审计', description: '检查用户权限和空密码账号', iconFunc: User },
      { id: 'backdoor-scan', name: '后门检测', description: '扫描 Webshell 和计划任务', iconFunc: Code },
      { id: 'process-analysis', name: '可疑进程分析', description: '识别异常进程和网络连接', iconFunc: Config },
      { id: 'file-permission', name: '文件权限检测', description: '检查敏感文件和 SUID 文件', iconFunc: FileText },
      { id: 'ssh-audit', name: 'SSH 安全审计', description: '检查 SSH 配置安全性', iconFunc: Lock },
      { id: 'log-analysis', name: '日志安全分析', description: '分析异常登录和暴力破解', iconFunc: Analysis },
      { id: 'firewall-check', name: '防火墙状态检查', description: '检查防火墙规则配置', iconFunc: Shield },

      // 账号与认证安全
      { id: 'password-policy', name: '密码策略检查', description: '检查密码复杂度和过期策略', iconFunc: Key },
      { id: 'sudo-audit', name: 'Sudo 配置审计', description: '检查 sudo 权限配置安全性', iconFunc: Shield },
      { id: 'pam-config', name: 'PAM 配置检查', description: '检查 PAM 认证配置', iconFunc: Lock },
      { id: 'account-lockout', name: '账号锁定策略', description: '检查登录失败锁定机制', iconFunc: Lock },

      // 系统加固
      { id: 'selinux-status', name: 'SELinux/AppArmor', description: '检查强制访问控制状态', iconFunc: Shield },
      { id: 'kernel-params', name: '内核参数检查', description: '检查安全相关内核参数', iconFunc: System },
      { id: 'system-updates', name: '系统补丁状态', description: '检查系统更新和漏洞补丁', iconFunc: System },

      // 服务与进程
      { id: 'unnecessary-services', name: '不必要服务检查', description: '检测运行的不必要服务', iconFunc: SettingConfig },
      { id: 'auto-start-services', name: '自启动服务审计', description: '审计开机自启动服务', iconFunc: SettingConfig },

      // 审计与日志
      { id: 'audit-config', name: '审计配置检查', description: '检查系统审计(auditd)配置', iconFunc: Analysis },
      { id: 'history-audit', name: '历史命令审计', description: '检查可疑历史命令', iconFunc: FileText },

      // 网络与时间
      { id: 'ntp-config', name: '时间同步检查', description: '检查 NTP 时间同步配置', iconFunc: Time },
      { id: 'dns-config', name: 'DNS 配置检查', description: '检查 DNS 解析配置安全', iconFunc: LinkCloud }
    ];

    // 竞赛级检测项目
    const competitionChecks = [
      { id: 'webshell-scan', name: 'Webshell 扫描', description: '扫描 Web 目录中的 Webshell 文件', iconFunc: Code },
      { id: 'rootkit-scan', name: 'Rootkit 检测', description: '检测隐藏进程、内核模块、LD_PRELOAD', iconFunc: Shield },
      { id: 'persistence-scan', name: '持久化机制扫描', description: '全量扫描 cron/bashrc/systemd/rc.local', iconFunc: Config },
      { id: 'log-tamper', name: '日志篡改检测', description: '检测日志被清空、删除、篡改的证据', iconFunc: Analysis },
      { id: 'network-backdoor', name: '网络后门检测', description: '检测反弹 Shell、C2 连接、可疑监听', iconFunc: LinkCloud },
      { id: 'enhanced-user', name: '增强用户审计', description: 'UID 冲突、全用户历史命令、sudo 组异常', iconFunc: User },
      { id: 'hidden-cron', name: '隐藏计划任务', description: '深度扫描所有 cron 目录和 at 队列', iconFunc: Time },
      { id: 'ssh-key-audit', name: 'SSH 密钥审计', description: '审计所有 SSH 密钥和 sshd 配置', iconFunc: Key },
      { id: 'timestomp-check', name: '时间戳篡改检测', description: '检测 mtime 与 ctime 异常的文件', iconFunc: History },
      { id: 'enhanced-process', name: '增强进程分析', description: '扩大扫描范围，检测可疑二进制', iconFunc: Config },
      // K8s 安全检测
      { id: 'k8s-privileged-pod', name: 'K8s 特权容器', description: '检测以 privileged 模式运行的容器', iconFunc: Shield },
      { id: 'k8s-reverse-shell', name: 'K8s 反弹Shell', description: '检测 Pod/CronJob 中的反弹 Shell 命令', iconFunc: Shield },
      { id: 'k8s-rbac-audit', name: 'K8s RBAC 审计', description: '检测 cluster-admin 绑定和通配符权限', iconFunc: Shield },
      { id: 'k8s-container-escape', name: 'K8s 容器逃逸', description: '检测 hostPID/hostIPC/危险 Capabilities', iconFunc: Shield },
      { id: 'k8s-suspicious-cronjob', name: 'K8s 恶意CronJob', description: '检测可疑定时任务命令', iconFunc: Shield },
      { id: 'k8s-network-policy', name: 'K8s 网络策略', description: '检测缺少 NetworkPolicy 的命名空间', iconFunc: Shield },
      { id: 'k8s-sa-audit', name: 'K8s SA 审计', description: '检测高权限 ServiceAccount', iconFunc: Shield },
      { id: 'k8s-node-persistence', name: 'K8s 节点持久化', description: '检测节点上的可疑服务和 crontab', iconFunc: Shield },
    ];

    // 性能检测项目
    const performanceChecks = [
      { id: 'cpu-test', name: 'CPU 压力测试', description: '测试 CPU 性能和频率', iconFunc: Cpu },
      { id: 'memory-test', name: '内存性能测试', description: '测试内存读写速度', iconFunc: Memory },
      { id: 'disk-test', name: '磁盘 I/O 测试', description: '测试磁盘读写性能', iconFunc: System },
      { id: 'network-test', name: '网络性能测试', description: '测试带宽和延迟', iconFunc: Speed }
    ];

    const renderCheckItem = (check: any, category: string) => {
      const iconSVG = check.iconFunc ? check.iconFunc({ theme: 'filled', size: '18', fill: 'currentColor' }) : '';
      return `
        <div class="detection-item qd-detection-item selected" data-check-id="${check.id}" data-category="${category}"
             onclick="const cb=this.querySelector('input[type=checkbox]');cb.checked=!cb.checked;this.classList.toggle('selected',cb.checked);">
          <div class="qd-item-icon">${iconSVG}</div>
          <div class="qd-item-info">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <span class="qd-item-name">${check.name}</span>
              <input type="checkbox" id="check-${check.id}" checked
                style="width:14px;height:14px;accent-color:var(--primary-color);cursor:pointer;"
                onclick="event.stopPropagation();">
            </div>
            <div class="qd-item-desc">${check.description}</div>
            <div id="status-${check.id}" class="qd-item-status">
              <span style="width:5px;height:5px;background:var(--text-disabled);border-radius:50%;"></span>
              待检测
            </div>
          </div>
        </div>`;
    };

    const totalItems = securityChecks.length + competitionChecks.length + performanceChecks.length;

    return `
      <div class="qd-page">
        <!-- Header -->
        <div class="qd-header">
          <div class="qd-header-left">
            <div class="qd-header-icon">${icon(Shield, '22', 'filled')}</div>
            <div>
              <h2 class="qd-header-title">快速检测中心</h2>
              <div class="qd-header-subtitle">安全漏洞扫描 · 应急响应 · 竞赛模式</div>
            </div>
          </div>
          <div class="qd-header-right">
            <button class="modern-btn secondary" onclick="window.quickDetection?.startCompetitionScan()" title="竞赛模式: 全量扫描 ${totalItems} 项">
              <span class="qd-competition-badge">竞赛</span> 全量扫描
            </button>
            <button class="modern-btn primary" onclick="window.quickDetection?.startFullScan()">
              ${icon(Rocket, '16', 'filled')} 一键扫描
            </button>
            <button class="modern-btn secondary" onclick="window.quickDetection?.viewReport()">
              ${icon(Analysis, '16')} 报告
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="qd-tabs" id="qd-tabs-area">
          <button class="qd-tab-btn active" data-qd-tab="detection">
            ${icon(Shield, '16', 'filled')} 检测中心
          </button>
          <button class="qd-tab-btn" data-qd-tab="results">
            ${icon(Analysis, '16')} 检测结果
          </button>
          <button class="qd-tab-btn" data-qd-tab="compliance">
            ${icon(FileText, '16')} 合规检查
          </button>
          <button class="qd-tab-btn" data-qd-tab="fix-history">
            ${icon(History, '16')} 修复历史
          </button>
          <button class="qd-tab-btn" data-qd-tab="hardening">
            ${icon(Shield, '16')} 快速加固
          </button>
        </div>

        <!-- Content -->
        <div class="qd-content">
          <!-- Tab: 检测中心 -->
          <div id="qd-tab-detection" class="qd-tab-panel" style="padding: var(--spacing-md);">
            <!-- 进度面板 -->
            <div id="detection-progress-panel" class="qd-progress-panel">
              <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:12px;">
                <div>
                  <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">
                    <span class="pulse-dot" style="display:inline-block;width:8px;height:8px;background:var(--primary-color);border-radius:50%;margin-right:8px;"></span>
                    正在进行检测...
                  </div>
                  <div id="detection-current-task" style="color:var(--text-secondary);font-size:12px;">正在初始化...</div>
                </div>
                <div id="detection-score-display" style="font-size:28px;font-weight:700;color:var(--primary-color);font-family:monospace;">--</div>
              </div>
              <div class="qd-progress-bar-track">
                <div id="detection-progress-bar" class="qd-progress-bar-fill" style="width:0%"></div>
              </div>
              <div style="display:flex;justify-content:space-between;color:var(--text-secondary);font-size:11px;margin-top:4px;">
                <span id="detection-progress-text">0%</span>
                <span id="detection-items-count">0/0 项</span>
              </div>
            </div>

            <!-- 结果汇总 -->
            <div id="detection-summary-panel" class="qd-summary-panel">
              <div style="text-align:center;padding-right:24px;border-right:1px solid var(--border-color);">
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;">安全评分</div>
                <span id="final-score" style="font-size:42px;font-weight:700;color:var(--success-color);">--</span>
                <span style="font-size:14px;color:var(--text-secondary);">/100</span>
              </div>
              <div class="qd-severity-grid">
                <div class="qd-severity-card" style="border-left:3px solid var(--error-color);">
                  <div style="font-size:20px;font-weight:700;color:var(--error-color);" id="critical-count">0</div>
                  <div style="font-size:11px;color:var(--text-secondary);">严重</div>
                </div>
                <div class="qd-severity-card" style="border-left:3px solid var(--warning-color);">
                  <div style="font-size:20px;font-weight:700;color:var(--warning-color);" id="high-count">0</div>
                  <div style="font-size:11px;color:var(--text-secondary);">高危</div>
                </div>
                <div class="qd-severity-card" style="border-left:3px solid #eab308;">
                  <div style="font-size:20px;font-weight:700;color:#eab308;" id="medium-count">0</div>
                  <div style="font-size:11px;color:var(--text-secondary);">中危</div>
                </div>
                <div class="qd-severity-card" style="border-left:3px solid var(--info-color);">
                  <div style="font-size:20px;font-weight:700;color:var(--info-color);" id="low-count">0</div>
                  <div style="font-size:11px;color:var(--text-secondary);">低危</div>
                </div>
              </div>
            </div>

            <!-- 统计卡片 -->
            <div class="qd-stats">
              <div class="qd-stat-card">
                <div class="qd-stat-value">${totalItems}</div>
                <div class="qd-stat-title">检测项总计</div>
              </div>
              <div class="qd-stat-card">
                <div class="qd-stat-value" style="color:var(--success-color)">${securityChecks.length}</div>
                <div class="qd-stat-title">安全检测</div>
              </div>
              <div class="qd-stat-card">
                <div class="qd-stat-value" style="color:#a855f7">${competitionChecks.length}</div>
                <div class="qd-stat-title">竞赛检测</div>
              </div>
              <div class="qd-stat-card">
                <div class="qd-stat-value" style="color:var(--primary-color)">${performanceChecks.length}</div>
                <div class="qd-stat-title">性能检测</div>
              </div>
            </div>

            <!-- 安全检测 -->
            <div class="qd-category-section">
              <div class="qd-category-header">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div class="qd-category-icon security">${icon(Shield, '16', 'filled')}</div>
                  <span style="font-size:14px;font-weight:600;">安全检测</span>
                  <span style="font-size:11px;color:var(--text-secondary);">${securityChecks.length} 项</span>
                </div>
                <button class="modern-btn text-only" style="font-size:11px;" onclick="window.quickDetection?.toggleAllChecks('security')">全选/取消</button>
              </div>
              <div class="qd-items-grid">
                ${securityChecks.map(c => renderCheckItem(c, 'security')).join('')}
              </div>
            </div>

            <!-- 竞赛检测 -->
            <div class="qd-category-section">
              <div class="qd-category-header">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div class="qd-category-icon competition">${icon(Rocket, '16', 'filled')}</div>
                  <span style="font-size:14px;font-weight:600;">竞赛检测</span>
                  <span class="qd-competition-badge">NEW</span>
                  <span style="font-size:11px;color:var(--text-secondary);">${competitionChecks.length} 项</span>
                </div>
                <button class="modern-btn text-only" style="font-size:11px;" onclick="window.quickDetection?.toggleAllChecks('competition')">全选/取消</button>
              </div>
              <div class="qd-items-grid">
                ${competitionChecks.map(c => renderCheckItem(c, 'competition')).join('')}
              </div>
            </div>

            <!-- 性能检测 -->
            <div class="qd-category-section">
              <div class="qd-category-header">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div class="qd-category-icon performance">${icon(Speed, '16', 'filled')}</div>
                  <span style="font-size:14px;font-weight:600;">性能检测</span>
                  <span style="font-size:11px;color:var(--text-secondary);">${performanceChecks.length} 项</span>
                </div>
                <button class="modern-btn text-only" style="font-size:11px;" onclick="window.quickDetection?.toggleAllChecks('performance')">全选/取消</button>
              </div>
              <div class="qd-items-grid">
                ${performanceChecks.map(c => renderCheckItem(c, 'performance')).join('')}
              </div>
            </div>
          </div>

          <!-- Tab: 检测结果 (inline results with fix buttons) -->
          <div id="qd-tab-results" class="qd-tab-panel" style="display:none;padding:var(--spacing-md);">
            <div class="qd-results-toolbar">
              <div class="qd-filter-chips">
                <button class="qd-filter-chip active" data-qd-filter="all">全部</button>
                <button class="qd-filter-chip" data-qd-filter="critical">严重</button>
                <button class="qd-filter-chip" data-qd-filter="high">高危</button>
                <button class="qd-filter-chip" data-qd-filter="medium">中危</button>
                <button class="qd-filter-chip" data-qd-filter="low">低危</button>
              </div>
              <div style="flex:1"></div>
              <button class="qd-action-btn primary" data-qd-action="fix-all">一键全部修复</button>
            </div>
            <div id="qd-results-list" class="qd-results-list">
              <div style="text-align:center;padding:48px;color:var(--text-secondary);font-size:13px;">
                运行检测后，结果将在此显示，每个问题旁边会有一键修复按钮
              </div>
            </div>
          </div>

          <!-- Tab: 合规检查 -->
          <div id="qd-tab-compliance" class="qd-tab-panel" style="display:none;padding:var(--spacing-md);">
            <div id="qd-compliance-content">
              <div style="text-align:center;padding:48px;color:var(--text-secondary);font-size:13px;">
                运行检测后，合规检查结果将在此显示
              </div>
            </div>
          </div>

          <!-- Tab: 修复历史 -->
          <div id="qd-tab-fix-history" class="qd-tab-panel" style="display:none;padding:var(--spacing-md);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <span style="font-size:14px;font-weight:600;color:var(--text-primary);">修复历史</span>
              <div style="display:flex;gap:8px;">
                <button class="qd-action-btn" data-qd-action="export-fix-history">导出</button>
                <button class="qd-action-btn danger" data-qd-action="clear-fix-history">清空</button>
              </div>
            </div>
            <div id="qd-fix-history-list" class="qd-fix-history-list">
              <div style="text-align:center;padding:32px;color:var(--text-secondary);font-size:13px;">
                暂无修复记录
              </div>
            </div>
          </div>

          <!-- Tab: 快速加固 -->
          <div id="qd-tab-hardening" class="qd-tab-panel" style="display:none;padding:var(--spacing-md);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <span style="font-size:14px;font-weight:600;color:var(--text-primary);">比赛开局加固</span>
              <div style="display:flex;gap:8px;">
                <button class="qd-action-btn" data-qd-action="check-all-hardening">检查状态</button>
                <button class="qd-action-btn primary" data-qd-action="harden-all">一键全部加固</button>
              </div>
            </div>
            <div id="qd-hardening-list" class="qd-hardening-groups">
              <div style="text-align:center;padding:32px;color:var(--text-secondary);font-size:13px;">
                点击"检查状态"查看当前加固情况
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 渲染快速检测报告模态框
   */
  renderDetectionReportModal(): string {
    return `
      <div id="detection-report-modal" class="modal" style="display: none;">
        <div class="modal-overlay" onclick="window.quickDetection?.closeReportModal()"></div>
        <div class="modal-content" style="
          max-width: 1000px;
          max-height: 90vh;
          overflow-y: auto;
          background: var(--bg-primary);
          border-radius: var(--border-radius-lg);
          padding: var(--spacing-lg);
        ">
          <!-- 报告头部 -->
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: var(--spacing-lg);
            padding-bottom: var(--spacing-md);
            border-bottom: 1px solid var(--border-color);
          ">
            <div>
              <h2 style="margin: 0; font-size: 24px; color: var(--text-primary); font-weight: 600;">检测报告</h2>
              <p id="report-timestamp" style="margin: 4px 0 0 0; font-size: 14px; color: var(--text-secondary);"></p>
            </div>
            <button onclick="window.quickDetection?.closeReportModal()" style="
              background: transparent;
              border: none;
              font-size: 24px;
              color: var(--text-secondary);
              cursor: pointer;
              padding: 4px 8px;
            ">×</button>
          </div>

          <!-- 评分卡片 -->
          <div style="
            display: grid;
            grid-template-columns: 1fr 2fr;
            gap: var(--spacing-lg);
            margin-bottom: var(--spacing-lg);
          ">
            <!-- 总体评分 -->
            <div class="modern-card" style="
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius-lg);
              padding: var(--spacing-lg);
              text-align: center;
              background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%);
            ">
              <div style="font-size: 14px; color: var(--text-secondary); margin-bottom: 8px;">安全评分</div>
              <div style="display: flex; align-items: baseline; justify-content: center; gap: 4px;">
                <span id="report-overall-score" style="font-size: 64px; font-weight: 700; color: var(--primary-color);">--</span>
                <span style="font-size: 32px; color: var(--text-secondary);">/100</span>
              </div>
              <div id="report-score-label" style="
                margin-top: 8px;
                font-size: 16px;
                font-weight: 600;
                color: var(--primary-color);
              ">优秀</div>
            </div>

            <!-- 问题统计 -->
            <div class="modern-card" style="
              border: 1px solid var(--border-color);
              border-radius: var(--border-radius-lg);
              padding: var(--spacing-lg);
              background: var(--bg-primary);
            ">
              <div style="font-size: 16px; color: var(--text-primary); margin-bottom: var(--spacing-md); font-weight: 600;">问题统计</div>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--spacing-sm);">
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: var(--border-radius);">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--error-color);"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 12px; color: var(--text-secondary);">严重</div>
                    <div id="report-critical-count" style="font-size: 24px; font-weight: 600; color: var(--error-color);">0</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: var(--border-radius);">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--warning-color);"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 12px; color: var(--text-secondary);">高危</div>
                    <div id="report-high-count" style="font-size: 24px; font-weight: 600; color: var(--warning-color);">0</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: var(--border-radius);">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent-orange);"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 12px; color: var(--text-secondary);">中危</div>
                    <div id="report-medium-count" style="font-size: 24px; font-weight: 600; color: var(--accent-orange);">0</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: var(--border-radius);">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--info-color);"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 12px; color: var(--text-secondary);">低危</div>
                    <div id="report-low-count" style="font-size: 24px; font-weight: 600; color: var(--info-color);">0</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 检测项目详情 -->
          <div id="report-details-container" style="margin-bottom: var(--spacing-lg);">
            <!-- 将由 JavaScript 动态填充 -->
          </div>

          <!-- 底部操作按钮 -->
          <div style="
            display: flex;
            justify-content: flex-end;
            gap: var(--spacing-sm);
            padding-top: var(--spacing-md);
            border-top: 1px solid var(--border-color);
          ">
            <button class="modern-btn secondary" onclick="window.quickDetection?.exportReport()">
              导出报告
            </button>
            <button class="modern-btn primary" onclick="window.quickDetection?.closeReportModal()">
              关闭
            </button>
          </div>
        </div>
      </div>
    `;
  }
}
