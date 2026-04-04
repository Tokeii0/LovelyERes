/**
 * 快速检测管理器
 * 负责执行安全和性能检测，管理检测状态和历史记录
 * 委托具体实现给 DetectionModules、DetectionReportRenderer 和 DetectionAIManager
 */

import { ReportExporter } from './reportExporter';
import { DetectionModules } from './detectionModules';
import { DetectionReportRenderer } from './detectionReportRenderer';
import { DetectionAIManager } from './detectionAIManager';

// 评分规则常量
const SCORING_RULES = {
  CRITICAL_DEDUCTION: 40,
  HIGH_DEDUCTION: 20,
  MEDIUM_DEDUCTION: 10,
  LOW_DEDUCTION: 5
};

// 检测项目类型
export interface DetectionItem {
  id: string;
  name: string;
  description: string;
  category: 'security' | 'performance';
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: DetectionResult;
}

// 检测结果
export interface DetectionResult {
  passed: boolean;
  score: number; // 0-100
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  findings: Finding[];
  duration: number; // 执行时间（毫秒）
  timestamp: Date;
  rawOutput?: any; // 原始命令返回结果
}

// 检测发现
export interface Finding {
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  recommendation?: string;
  details?: any;
}

// 检测报告
export interface DetectionReport {
  id: string;
  timestamp: Date;
  server: string;
  overallScore: number;
  totalDuration: number;
  items: DetectionItem[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

export class QuickDetectionManager {
  private currentReport: DetectionReport | null = null;
  private detectionHistory: DetectionReport[] = [];
  private isRunning: boolean = false;
  private progressCallback?: (progress: number, current: string) => void;

  private detectionModules: DetectionModules;
  private reportRenderer: DetectionReportRenderer;
  private aiManager: DetectionAIManager;

  constructor() {
    this.detectionModules = new DetectionModules();
    this.reportRenderer = new DetectionReportRenderer();
    this.aiManager = new DetectionAIManager();
    this.loadHistory();
  }

  /**
   * 开始全面扫描
   */
  async startFullScan(selectedIds?: string[]): Promise<DetectionReport> {
    if (this.isRunning) {
      throw new Error('检测已在进行中');
    }

    this.isRunning = true;
    this.showProgressPanel();

    // 获取选中的检测项
    const itemsToRun = selectedIds || this.getAllCheckIds();
    const totalItems = itemsToRun.length;
    let completedItems = 0;

    // 初始化报告
    this.currentReport = {
      id: this.generateReportId(),
      timestamp: new Date(),
      server: this.getCurrentServerInfo(),
      overallScore: 0,
      totalDuration: 0,
      items: [],
      summary: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0
      }
    };

    const startTime = Date.now();

    try {
      // 逐个执行检测
      for (const itemId of itemsToRun) {
        this.updateProgress(
          (completedItems / totalItems) * 100,
          `正在执行: ${this.getCheckName(itemId)}`
        );

        this.updateCheckStatus(itemId, 'running');

        try {
          const result = await this.executeDetection(itemId);
          this.updateCheckStatus(itemId, 'completed', result);

          // 添加到报告
          this.currentReport.items.push({
            id: itemId,
            name: this.getCheckName(itemId),
            description: this.getCheckDescription(itemId),
            category: this.getCheckCategory(itemId),
            status: 'completed',
            result
          });

          // 更新摘要
          if (result.findings.length > 0) {
            result.findings.forEach(finding => {
              this.currentReport!.summary[finding.severity]++;
            });
          }
        } catch (error) {
          console.error(`检测失败: ${itemId}`, error);
          this.updateCheckStatus(itemId, 'failed');

          this.currentReport.items.push({
            id: itemId,
            name: this.getCheckName(itemId),
            description: this.getCheckDescription(itemId),
            category: this.getCheckCategory(itemId),
            status: 'failed'
          });
        }

        completedItems++;
        this.updateProgress((completedItems / totalItems) * 100, '');
      }

      // 计算总体评分
      this.currentReport.totalDuration = Date.now() - startTime;
      this.currentReport.overallScore = this.calculateOverallScore(this.currentReport);

      // 显示结果
      this.showSummaryPanel(this.currentReport);

      // 保存到历史
      this.saveToHistory(this.currentReport);

      return this.currentReport;
    } finally {
      this.isRunning = false;
      this.hideProgressPanel();
    }
  }

  /**
   * 执行单个检测
   */
  private async executeDetection(itemId: string): Promise<DetectionResult> {
    const startTime = Date.now();
    let result: DetectionResult;

    switch (itemId) {
      case 'port-scan':
        result = await this.runPortScan();
        break;
      case 'user-audit':
        result = await this.runUserAudit();
        break;
      case 'backdoor-scan':
        result = await this.runBackdoorScan();
        break;
      case 'process-analysis':
        result = await this.runProcessAnalysis();
        break;
      case 'file-permission':
        result = await this.runFilePermissionCheck();
        break;
      case 'ssh-audit':
        result = await this.runSSHAudit();
        break;
      case 'log-analysis':
        result = await this.runLogAnalysis();
        break;
      case 'firewall-check':
        result = await this.runFirewallCheck();
        break;

      // 账号与认证安全
      case 'password-policy':
        result = await this.runPasswordPolicyCheck();
        break;
      case 'sudo-audit':
        result = await this.runSudoAudit();
        break;
      case 'pam-config':
        result = await this.runPAMConfigCheck();
        break;
      case 'account-lockout':
        result = await this.runAccountLockoutCheck();
        break;

      // 系统加固
      case 'selinux-status':
        result = await this.runSELinuxStatusCheck();
        break;
      case 'kernel-params':
        result = await this.runKernelParamsCheck();
        break;
      case 'system-updates':
        result = await this.runSystemUpdatesCheck();
        break;

      // 服务与进程
      case 'unnecessary-services':
        result = await this.runUnnecessaryServicesCheck();
        break;
      case 'auto-start-services':
        result = await this.runAutoStartServicesCheck();
        break;

      // 审计与日志
      case 'audit-config':
        result = await this.runAuditConfigCheck();
        break;
      case 'history-audit':
        result = await this.runHistoryAudit();
        break;

      // 网络与时间
      case 'ntp-config':
        result = await this.runNTPConfigCheck();
        break;
      case 'dns-config':
        result = await this.runDNSConfigCheck();
        break;

      // 性能检测
      case 'cpu-test':
        result = await this.runCPUTest();
        break;
      case 'memory-test':
        result = await this.runMemoryTest();
        break;
      case 'disk-test':
        result = await this.runDiskTest();
        break;
      case 'network-test':
        result = await this.runNetworkTest();
        break;
      default:
        throw new Error(`未知的检测项: ${itemId}`);
    }

    result.duration = Date.now() - startTime;
    result.timestamp = new Date();

    return result;
  }

  // ========== Detection Module 委托方法 ==========

  private async runPortScan(): Promise<DetectionResult> {
    return this.detectionModules.runPortScan();
  }

  private async runUserAudit(): Promise<DetectionResult> {
    return this.detectionModules.runUserAudit();
  }

  private async runBackdoorScan(): Promise<DetectionResult> {
    return this.detectionModules.runBackdoorScan();
  }

  private async runProcessAnalysis(): Promise<DetectionResult> {
    return this.detectionModules.runProcessAnalysis();
  }

  private async runFilePermissionCheck(): Promise<DetectionResult> {
    return this.detectionModules.runFilePermissionCheck();
  }

  private async runSSHAudit(): Promise<DetectionResult> {
    return this.detectionModules.runSSHAudit();
  }

  private async runLogAnalysis(): Promise<DetectionResult> {
    return this.detectionModules.runLogAnalysis();
  }

  private async runFirewallCheck(): Promise<DetectionResult> {
    return this.detectionModules.runFirewallCheck();
  }

  private async runCPUTest(): Promise<DetectionResult> {
    return this.detectionModules.runCPUTest();
  }

  private async runMemoryTest(): Promise<DetectionResult> {
    return this.detectionModules.runMemoryTest();
  }

  private async runDiskTest(): Promise<DetectionResult> {
    return this.detectionModules.runDiskTest();
  }

  private async runNetworkTest(): Promise<DetectionResult> {
    return this.detectionModules.runNetworkTest();
  }

  private async runPasswordPolicyCheck(): Promise<DetectionResult> {
    return this.detectionModules.runPasswordPolicyCheck();
  }

  private async runSudoAudit(): Promise<DetectionResult> {
    return this.detectionModules.runSudoAudit();
  }

  private async runPAMConfigCheck(): Promise<DetectionResult> {
    return this.detectionModules.runPAMConfigCheck();
  }

  private async runAccountLockoutCheck(): Promise<DetectionResult> {
    return this.detectionModules.runAccountLockoutCheck();
  }

  private async runSELinuxStatusCheck(): Promise<DetectionResult> {
    return this.detectionModules.runSELinuxStatusCheck();
  }

  private async runKernelParamsCheck(): Promise<DetectionResult> {
    return this.detectionModules.runKernelParamsCheck();
  }

  private async runSystemUpdatesCheck(): Promise<DetectionResult> {
    return this.detectionModules.runSystemUpdatesCheck();
  }

  private async runUnnecessaryServicesCheck(): Promise<DetectionResult> {
    return this.detectionModules.runUnnecessaryServicesCheck();
  }

  private async runAutoStartServicesCheck(): Promise<DetectionResult> {
    return this.detectionModules.runAutoStartServicesCheck();
  }

  private async runAuditConfigCheck(): Promise<DetectionResult> {
    return this.detectionModules.runAuditConfigCheck();
  }

  private async runHistoryAudit(): Promise<DetectionResult> {
    return this.detectionModules.runHistoryAudit();
  }

  private async runNTPConfigCheck(): Promise<DetectionResult> {
    return this.detectionModules.runNTPConfigCheck();
  }

  private async runDNSConfigCheck(): Promise<DetectionResult> {
    return this.detectionModules.runDNSConfigCheck();
  }

  private processBasicDetectionResult(result: any, name: string): DetectionResult {
    return this.detectionModules.processBasicDetectionResult(result, name);
  }

  private isHighRiskPort(port: number): boolean {
    return this.detectionModules.isHighRiskPort(port);
  }

  private createErrorResult(message: string): DetectionResult {
    return this.detectionModules.createErrorResult(message);
  }

  // ========== Report Renderer 委托方法 ==========

  private updateProgress(progress: number, currentTask: string): void {
    this.reportRenderer.setProgressCallback(this.progressCallback);
    this.reportRenderer.updateProgress(progress, currentTask);
  }

  private updateCheckStatus(checkId: string, status: string, result?: DetectionResult): void {
    this.reportRenderer.updateCheckStatus(checkId, status, result);
  }

  private showProgressPanel(): void {
    this.reportRenderer.showProgressPanel();
  }

  private hideProgressPanel(): void {
    this.reportRenderer.hideProgressPanel();
  }

  private showSummaryPanel(report: DetectionReport): void {
    this.reportRenderer.showSummaryPanel(report);
  }

  private getSeverityColor(severity: string, opacity: number): string {
    return this.reportRenderer.getSeverityColor(severity, opacity);
  }

  private getScoreColor(score: number): string {
    return this.reportRenderer.getScoreColor(score);
  }

  viewReport(): void {
    this.reportRenderer.setCurrentReport(this.currentReport);
    this.reportRenderer.viewReport();
  }

  private ensureReportModalExists(): void {
    this.reportRenderer.ensureReportModalExists();
  }

  private renderReportModal(): string {
    return this.reportRenderer.renderReportModal();
  }

  private fillReportData(report: DetectionReport): void {
    this.reportRenderer.fillReportData(report);
  }

  private renderReportDetails(report: DetectionReport): void {
    this.reportRenderer.renderReportDetails(report);
  }

  private renderReportCategory(title: string, items: DetectionItem[]): string {
    return this.reportRenderer.renderReportCategory(title, items);
  }

  private renderReportItem(item: DetectionItem): string {
    return this.reportRenderer.renderReportItem(item);
  }

  private getScoreLabel(score: number): string {
    return this.reportRenderer.getScoreLabel(score);
  }

  private getSeverityLabel(severity: string): string {
    return this.reportRenderer.getSeverityLabel(severity);
  }

  closeReportModal(): void {
    this.reportRenderer.closeReportModal();
  }

  showRawOutput(itemId: string): void {
    this.reportRenderer.setCurrentReport(this.currentReport);
    this.reportRenderer.showRawOutput(itemId);
  }

  private syntaxHighlight(json: string): string {
    return this.reportRenderer.syntaxHighlight(json);
  }

  // ========== AI Manager 委托方法 ==========

  async generateAISolutionStream(title: string, description: string, severity: string, containerId: string): Promise<void> {
    this.aiManager.currentReport = this.currentReport;
    return this.aiManager.generateAISolutionStream(title, description, severity, containerId);
  }

  private renderStreamContent(element: HTMLElement, text: string): void {
    this.aiManager.renderStreamContent(element, text);
  }

  private showConfirm(options: {
    title: string;
    message: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    dangerous?: boolean;
  }): Promise<boolean> {
    return this.aiManager.showConfirm(options);
  }

  private async showConfirmDialog(command: string): Promise<boolean> {
    return this.aiManager.showConfirmDialog(command);
  }

  private async executeCommand(command: string): Promise<void> {
    return this.aiManager.executeCommand(command);
  }

  private escapeHtml(text: string): string {
    return this.aiManager.escapeHtml(text);
  }

  async generateAISolution(title: string, description: string, severity: string = 'medium'): Promise<void> {
    this.aiManager.currentReport = this.currentReport;
    return this.aiManager.generateAISolution(title, description, severity);
  }

  private showLoadingModal(message: string): HTMLElement {
    return this.aiManager.showLoadingModal(message);
  }

  private closeLoadingModal(modal: HTMLElement): void {
    this.aiManager.closeLoadingModal(modal);
  }

  private showSolutionModal(title: string, description: string, solution: any): void {
    this.aiManager.showSolutionModal(title, description, solution);
  }

  // ========== 评分计算（保留在本类中） ==========

  /**
   * 工具方法：计算总体评分
   */
  private calculateOverallScore(report: DetectionReport): number {
    if (report.items.length === 0) return 0;

    // 检查是否有严重问题
    const hasCriticalIssues = report.items.some(item =>
      item.result?.findings.some(f => f.severity === 'critical')
    );

    const totalScore = report.items.reduce((sum, item) => {
      return sum + (item.result?.score || 0);
    }, 0);

    let overallScore = Math.round(totalScore / report.items.length);

    // 如果有严重问题，总分不能超过 60 分
    if (hasCriticalIssues && overallScore > 60) {
      overallScore = 60;
    }

    return overallScore;
  }

  // ========== 历史记录方法（保留在本类中） ==========

  /**
   * 历史记录：保存到历史
   */
  private saveToHistory(report: DetectionReport): void {
    this.detectionHistory.unshift(report);

    // 只保留最近 10 条记录
    if (this.detectionHistory.length > 10) {
      this.detectionHistory = this.detectionHistory.slice(0, 10);
    }

    // 保存到 localStorage
    try {
      localStorage.setItem('detection-history', JSON.stringify(this.detectionHistory));
    } catch (error) {
      console.error('保存历史记录失败:', error);
    }

    // 更新 UI
    this.updateHistoryList();
  }

  /**
   * 历史记录：加载历史
   */
  private loadHistory(): void {
    try {
      const historyStr = localStorage.getItem('detection-history');
      if (historyStr) {
        this.detectionHistory = JSON.parse(historyStr);
      }
    } catch (error) {
      console.error('加载历史记录失败:', error);
      this.detectionHistory = [];
    }
  }

  /**
   * 历史记录：更新历史列表UI
   */
  private updateHistoryList(): void {
    const listEl = document.getElementById('detection-history-list');
    if (!listEl) return;

    if (this.detectionHistory.length === 0) {
      listEl.innerHTML = `
        <div style="text-align: center; padding: var(--spacing-lg); color: var(--text-secondary);">
          暂无检测历史
        </div>
      `;
      return;
    }

    listEl.innerHTML = this.detectionHistory.map(report => `
      <div class="history-item" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        background: var(--bg-primary);
        cursor: pointer;
        transition: all 0.2s ease;
      " onmouseover="this.style.background='var(--bg-secondary)';"
         onmouseout="this.style.background='var(--bg-primary)';"
         onclick="window.quickDetection?.viewHistoryReport('${report.id}')">
        <div>
          <div style="font-weight: 500; color: var(--text-primary); font-size: 14px;">
            ${new Date(report.timestamp).toLocaleString('zh-CN')}
          </div>
          <div style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">
            ${report.server} · ${report.items.length} 项检测 · ${(report.totalDuration / 1000).toFixed(1)}s
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 24px; font-weight: 600; color: ${this.getScoreColor(report.overallScore)};">
            ${report.overallScore}
          </div>
          <div style="font-size: 11px; color: var(--text-secondary);">
            ${report.summary.critical + report.summary.high} 个问题
          </div>
        </div>
      </div>
    `).join('');
  }

  /**
   * 历史记录：清空历史
   */
  async clearHistory(): Promise<void> {
    const confirmed = await this.showConfirm({
      title: '确认清空历史',
      message: '确定要清空所有检测历史吗？',
      description: '此操作不可撤销',
      confirmText: '清空',
      cancelText: '取消',
      dangerous: true
    });

    if (confirmed) {
      this.detectionHistory = [];
      localStorage.removeItem('detection-history');
      this.updateHistoryList();
    }
  }

  /**
   * 历史记录：查看历史报告
   */
  viewHistoryReport(reportId: string): void {
    const report = this.detectionHistory.find(r => r.id === reportId);
    if (report) {
      this.currentReport = report;
      this.viewReport();
    }
  }

  /**
   * 导出报告（HTML 格式）
   */
  exportReport(): void {
    if (!this.currentReport) {
      alert('暂无可导出的报告');
      return;
    }

    try {
      ReportExporter.exportAsHTML(this.currentReport);
    } catch (e) {
      console.error('❌ 导出报告失败:', e);
      alert('导出报告失败，请重试');
    }
  }

  /**
   * UI 方法：全选/取消检测项
   */
  toggleAllChecks(category: 'security' | 'performance'): void {
    const checkboxes = document.querySelectorAll(`.detection-item[data-category="${category}"] input[type="checkbox"]`);
    if (checkboxes.length === 0) return;

    const firstCheckbox = checkboxes[0] as HTMLInputElement;
    const newState = !firstCheckbox.checked;

    checkboxes.forEach(cb => {
      const checkbox = cb as HTMLInputElement;
      checkbox.checked = newState;

      // 更新父元素的视觉样式
      const item = checkbox.closest('.detection-item') as HTMLElement;
      if (item) {
        if (newState) {
          item.classList.add('selected');
          item.style.borderColor = 'var(--primary-color)';
          item.style.background = 'var(--bg-primary)';
          item.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.05)';
        } else {
          item.classList.remove('selected');
          item.style.borderColor = 'var(--border-color)';
          item.style.background = 'var(--bg-secondary)';
          item.style.boxShadow = 'none';
        }
      }
    });
  }

  // ========== 工具方法（保留在本类中） ==========

  /**
   * 工具方法：获取选中的检测项 ID
   */
  private getAllCheckIds(): string[] {
    const checkboxes = document.querySelectorAll('.detection-item input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => {
      const parent = cb.closest('.detection-item');
      return parent?.getAttribute('data-check-id') || '';
    }).filter(id => id !== '');
  }

  /**
   * 工具方法：获取检测项名称
   */
  private getCheckName(id: string): string {
    const names: Record<string, string> = {
      'port-scan': '端口安全扫描',
      'user-audit': '用户权限审计',
      'backdoor-scan': '后门检测',
      'process-analysis': '可疑进程分析',
      'file-permission': '文件权限检测',
      'ssh-audit': 'SSH 安全审计',
      'log-analysis': '日志安全分析',
      'firewall-check': '防火墙状态检查',
      'cpu-test': 'CPU 压力测试',
      'memory-test': '内存性能测试',
      'disk-test': '磁盘 I/O 测试',
      'network-test': '网络性能测试'
    };
    return names[id] || id;
  }

  /**
   * 工具方法：获取检测项描述
   */
  private getCheckDescription(id: string): string {
    const descriptions: Record<string, string> = {
      'port-scan': '检测开放端口和高危服务',
      'user-audit': '检查用户权限和空密码账号',
      'backdoor-scan': '扫描 Webshell 和计划任务',
      'process-analysis': '识别异常进程和网络连接',
      'file-permission': '检查敏感文件和 SUID 文件',
      'ssh-audit': '检查 SSH 配置安全性',
      'log-analysis': '分析异常登录和暴力破解',
      'firewall-check': '检查防火墙规则配置',
      'cpu-test': '测试 CPU 性能和频率',
      'memory-test': '测试内存读写速度',
      'disk-test': '测试磁盘读写性能',
      'network-test': '测试带宽和延迟'
    };
    return descriptions[id] || '';
  }

  /**
   * 工具方法：获取检测项分类
   */
  private getCheckCategory(id: string): 'security' | 'performance' {
    const performanceChecks = ['cpu-test', 'memory-test', 'disk-test', 'network-test'];
    return performanceChecks.includes(id) ? 'performance' : 'security';
  }

  /**
   * 工具方法：生成报告 ID
   */
  private generateReportId(): string {
    return `report-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 工具方法：获取当前服务器信息
   */
  private getCurrentServerInfo(): string {
    const sshConnectionManager = (window as any).sshConnectionManager;
    const connectionStatus = sshConnectionManager?.getConnectionStatus?.();

    if (connectionStatus && connectionStatus.connected) {
      return `${connectionStatus.username}@${connectionStatus.host}:${connectionStatus.port}`;
    }

    return '未知服务器';
  }

  /**
   * 设置进度回调
   */
  setProgressCallback(callback: (progress: number, current: string) => void): void {
    this.progressCallback = callback;
  }
}

// 创建全局实例
export const quickDetectionManager = new QuickDetectionManager();
