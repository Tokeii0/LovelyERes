/**
 * 检测报告渲染器
 * 负责检测报告的UI渲染和显示，从 QuickDetectionManager 中提取
 */

import {
  CheckOne,
  CloseOne,
  Time,
  Tips,
  Robot,
  Code
} from '@icon-park/svg';

import type { DetectionItem, DetectionResult, DetectionReport, Finding } from './quickDetectionManager';

/**
 * 检测报告渲染器类
 * 处理报告模态框、进度面板、汇总面板等UI渲染
 */
export class DetectionReportRenderer {
  private currentReport: DetectionReport | null = null;
  private progressCallback?: (progress: number, current: string) => void;

  /**
   * 设置当前报告引用
   */
  setCurrentReport(report: DetectionReport | null): void {
    this.currentReport = report;
  }

  /**
   * 获取当前报告
   */
  getCurrentReport(): DetectionReport | null {
    return this.currentReport;
  }

  /**
   * 设置进度回调
   */
  setProgressCallback(callback?: (progress: number, current: string) => void): void {
    this.progressCallback = callback;
  }

  // ========== 进度面板方法 ==========

  /**
   * UI 方法：更新进度
   */
  updateProgress(progress: number, currentTask: string): void {
    const progressBar = document.getElementById('detection-progress-bar');
    const progressText = document.getElementById('detection-progress-text');
    const currentTaskEl = document.getElementById('detection-current-task');

    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
    if (progressText) {
      progressText.textContent = `${Math.round(progress)}%`;
    }
    if (currentTaskEl && currentTask) {
      currentTaskEl.textContent = currentTask;
    }

    if (this.progressCallback) {
      this.progressCallback(progress, currentTask);
    }
  }

  /**
   * UI 方法：更新检测项状态
   */
  updateCheckStatus(checkId: string, status: string, result?: DetectionResult): void {
    const statusEl = document.getElementById(`status-${checkId}`);
    if (!statusEl) return;

    switch (status) {
      case 'running':
        statusEl.textContent = '检测中...';
        statusEl.style.background = 'rgba(59, 130, 246, 0.2)';
        statusEl.style.color = '#3b82f6';
        break;
      case 'completed':
        if (result) {
          const icon = result.passed ? CheckOne({ theme: 'outline', size: '14', fill: '#22c55e' }) : CloseOne({ theme: 'outline', size: '14', fill: '#ef4444' });
          statusEl.innerHTML = `${icon} <span>${result.score}分</span>`;
          statusEl.style.background = this.getSeverityColor(result.severity, 0.2);
          statusEl.style.color = this.getSeverityColor(result.severity, 1);
        }
        break;
      case 'failed':
        statusEl.textContent = '失败';
        statusEl.style.background = 'rgba(239, 68, 68, 0.2)';
        statusEl.style.color = '#ef4444';
        break;
      default:
        statusEl.textContent = '待检测';
        statusEl.style.background = 'var(--bg-secondary)';
        statusEl.style.color = 'var(--text-secondary)';
    }
  }

  /**
   * UI 方法：显示进度面板
   */
  showProgressPanel(): void {
    const panel = document.getElementById('detection-progress-panel');
    if (panel) {
      panel.style.display = 'block';
    }
  }

  /**
   * UI 方法：隐藏进度面板
   */
  hideProgressPanel(): void {
    const panel = document.getElementById('detection-progress-panel');
    if (panel) {
      panel.style.display = 'none';
    }
  }

  // ========== 汇总面板方法 ==========

  /**
   * UI 方法：显示汇总面板
   */
  showSummaryPanel(report: DetectionReport): void {
    const panel = document.getElementById('detection-summary-panel');
    if (!panel) return;

    panel.style.display = 'block';

    // 更新评分
    const scoreEl = document.getElementById('final-score');
    if (scoreEl) {
      scoreEl.textContent = report.overallScore.toString();
      scoreEl.style.color = this.getScoreColor(report.overallScore);
    }

    // 更新问题统计
    const criticalEl = document.getElementById('critical-count');
    const highEl = document.getElementById('high-count');
    const mediumEl = document.getElementById('medium-count');
    const lowEl = document.getElementById('low-count');

    if (criticalEl) criticalEl.textContent = report.summary.critical.toString();
    if (highEl) highEl.textContent = report.summary.high.toString();
    if (mediumEl) mediumEl.textContent = report.summary.medium.toString();
    if (lowEl) lowEl.textContent = report.summary.low.toString();
  }

  // ========== 颜色/标签工具方法 ==========

  /**
   * 工具方法：获取严重级别颜色
   */
  getSeverityColor(severity: string, opacity: number): string {
    const colors: Record<string, string> = {
      critical: '#ef4444',
      high: '#f59e0b',
      medium: '#eab308',
      low: '#3b82f6',
      info: '#22c55e'
    };
    const color = colors[severity] || colors.info;

    if (opacity < 1) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }

    return color;
  }

  /**
   * 工具方法：获取评分颜色
   */
  getScoreColor(score: number): string {
    if (score >= 90) return '#22c55e'; // 绿色
    if (score >= 70) return '#eab308'; // 黄色
    if (score >= 50) return '#f59e0b'; // 橙色
    return '#ef4444'; // 红色
  }

  /**
   * 获取评分标签
   */
  getScoreLabel(score: number): string {
    if (score >= 90) return '优秀';
    if (score >= 70) return '良好';
    if (score >= 50) return '一般';
    return '需改进';
  }

  /**
   * 获取严重级别标签
   */
  getSeverityLabel(severity: string): string {
    const labels: Record<string, string> = {
      critical: '严重',
      high: '高危',
      medium: '中危',
      low: '低危',
      info: '信息'
    };
    return labels[severity] || severity;
  }

  // ========== 报告模态框方法 ==========

  /**
   * 查看报告
   */
  viewReport(): void {
    if (!this.currentReport) {
      alert('暂无检测报告');
      return;
    }

    // 确保模态框存在
    this.ensureReportModalExists();

    // 填充报告数据
    this.fillReportData(this.currentReport);

    // 显示模态框
    const modal = document.getElementById('detection-report-modal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  /**
   * 确保报告模态框存在
   */
  ensureReportModalExists(): void {
    if (document.getElementById('detection-report-modal')) {
      return;
    }

    // 创建模态框 HTML
    const modalHTML = this.renderReportModal();
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHTML;
    document.body.appendChild(tempDiv.firstElementChild!);
  }

  /**
   * 渲染报告模态框 HTML
   */
  renderReportModal(): string {
    return `
      <div id="detection-report-modal" class="modal" style="
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10000;
        align-items: center;
        justify-content: center;
      ">
        <div class="modal-overlay" onclick="window.quickDetection?.closeReportModal()" style="
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
        "></div>
        <div class="modal-content" style="
          position: relative;
          max-width: 1000px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          background: var(--bg-primary);
          border-radius: var(--border-radius-lg);
          padding: var(--spacing-lg);
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
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
              <h2 style="margin: 0; font-size: 24px; color: var(--text-primary); font-weight: 600;">🔍 检测报告</h2>
              <p id="report-timestamp" style="margin: 4px 0 0 0; font-size: 14px; color: var(--text-secondary);"></p>
            </div>
            <button onclick="window.quickDetection?.closeReportModal()" style="
              background: transparent;
              border: none;
              font-size: 32px;
              color: var(--text-secondary);
              cursor: pointer;
              padding: 0;
              line-height: 1;
              width: 32px;
              height: 32px;
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
                  <div style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444;"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 12px; color: var(--text-secondary);">严重</div>
                    <div id="report-critical-count" style="font-size: 24px; font-weight: 600; color: #ef4444;">0</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: var(--border-radius);">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background: #f59e0b;"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 12px; color: var(--text-secondary);">高危</div>
                    <div id="report-high-count" style="font-size: 24px; font-weight: 600; color: #f59e0b;">0</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: var(--border-radius);">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background: #eab308;"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 12px; color: var(--text-secondary);">中危</div>
                    <div id="report-medium-count" style="font-size: 24px; font-weight: 600; color: #eab308;">0</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--bg-secondary); border-radius: var(--border-radius);">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background: #3b82f6;"></div>
                  <div style="flex: 1;">
                    <div style="font-size: 12px; color: var(--text-secondary);">低危</div>
                    <div id="report-low-count" style="font-size: 24px; font-weight: 600; color: #3b82f6;">0</div>
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
              📄 导出报告
            </button>
            <button class="modern-btn primary" onclick="window.quickDetection?.closeReportModal()">
              关闭
            </button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 填充报告数据
   */
  fillReportData(report: DetectionReport): void {
    // 更新时间戳
    const timestampEl = document.getElementById('report-timestamp');
    if (timestampEl) {
      timestampEl.textContent = `${report.server} · ${new Date(report.timestamp).toLocaleString('zh-CN')} · 耗时 ${(report.totalDuration / 1000).toFixed(1)}s`;
    }

    // 更新评分
    const scoreEl = document.getElementById('report-overall-score');
    const labelEl = document.getElementById('report-score-label');
    if (scoreEl) {
      scoreEl.textContent = report.overallScore.toString();
      scoreEl.style.color = this.getScoreColor(report.overallScore);
    }
    if (labelEl) {
      labelEl.textContent = this.getScoreLabel(report.overallScore);
      labelEl.style.color = this.getScoreColor(report.overallScore);
    }

    // 更新问题统计
    const criticalEl = document.getElementById('report-critical-count');
    const highEl = document.getElementById('report-high-count');
    const mediumEl = document.getElementById('report-medium-count');
    const lowEl = document.getElementById('report-low-count');

    if (criticalEl) criticalEl.textContent = report.summary.critical.toString();
    if (highEl) highEl.textContent = report.summary.high.toString();
    if (mediumEl) mediumEl.textContent = report.summary.medium.toString();
    if (lowEl) lowEl.textContent = report.summary.low.toString();

    // 渲染详细结果
    this.renderReportDetails(report);
  }

  /**
   * 渲染报告详细结果
   */
  renderReportDetails(report: DetectionReport): void {
    const container = document.getElementById('report-details-container');
    if (!container) return;

    let html = '<div style="display: flex; flex-direction: column; gap: var(--spacing-md);">';

    // 按类别分组
    const securityItems = report.items.filter(item => item.category === 'security');
    const performanceItems = report.items.filter(item => item.category === 'performance');

    if (securityItems.length > 0) {
      html += this.renderReportCategory('🔒 安全检测结果', securityItems);
    }

    if (performanceItems.length > 0) {
      html += this.renderReportCategory('⚡ 性能检测结果', performanceItems);
    }

    html += '</div>';
    container.innerHTML = html;
  }

  /**
   * 渲染报告类别
   */
  renderReportCategory(title: string, items: DetectionItem[]): string {
    let html = `
      <div class="modern-card" style="
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius-lg);
        padding: var(--spacing-md);
        background: var(--bg-primary);
      ">
        <h3 style="margin: 0 0 var(--spacing-md) 0; font-size: 18px; color: var(--text-primary); font-weight: 600;">${title}</h3>
        <div style="display: flex; flex-direction: column; gap: var(--spacing-sm);">
    `;

    items.forEach(item => {
      html += this.renderReportItem(item);
    });

    html += `
        </div>
      </div>
    `;

    return html;
  }

  /**
   * 渲染单个报告项
   */
  renderReportItem(item: DetectionItem): string {
    const statusColor = item.status === 'completed' ? '#22c55e' : item.status === 'failed' ? '#ef4444' : '#3b82f6';
    const statusIcon = item.status === 'completed'
      ? CheckOne({ theme: 'outline', size: '16', fill: statusColor })
      : item.status === 'failed'
        ? CloseOne({ theme: 'outline', size: '16', fill: statusColor })
        : Time({ theme: 'outline', size: '16', fill: statusColor });

    let html = `
      <div style="
        border: 1px solid var(--border-color);
        border-radius: var(--border-radius);
        padding: var(--spacing-sm);
        background: var(--bg-secondary);
      ">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: ${statusColor}; font-size: 16px;">${statusIcon}</span>
            <span style="font-weight: 500; color: var(--text-primary);">${item.name}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${item.result?.rawOutput ? `
              <button
                class="modern-btn secondary"
                style="font-size: 12px; padding: 4px 8px; height: 24px;"
                onclick="window.quickDetection?.showRawOutput('${item.id}')"
                title="查看原始结果"
              >
                ${Code({ theme: 'outline', size: '14', fill: 'currentColor' })}
                <span style="margin-left: 4px;">详情</span>
              </button>
            ` : ''}
            <span style="font-size: 14px; font-weight: 600; color: ${statusColor};">
              ${item.result ? `${item.result.score}分` : '未完成'}
            </span>
          </div>
        </div>
    `;

    if (item.result && item.result.findings.length > 0) {
      html += `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-color);">`;

      item.result.findings.forEach((finding, findingIndex) => {
        const severityColor = this.getSeverityColor(finding.severity, 1);
        const severityBg = this.getSeverityColor(finding.severity, 0.1);

        // 生成唯一的容器ID，使用item.id + 索引
        const uniqueContainerId = `ai-solution-${item.id}-${findingIndex}`;

        html += `
          <div style="
            margin-bottom: 8px;
            padding: 12px;
            border-radius: var(--border-radius);
            background: ${severityBg};
            border-left: 3px solid ${severityColor};
          ">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
              <span style="font-weight: 500; color: var(--text-primary); font-size: 14px;">${finding.title}</span>
              <span style="
                font-size: 11px;
                padding: 2px 8px;
                border-radius: 4px;
                background: ${severityColor};
                color: white;
                font-weight: 500;
              ">${this.getSeverityLabel(finding.severity)}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 4px;">
              ${finding.description}
            </div>
            ${finding.recommendation ? `
              <div style="
                margin-top: 8px;
                padding: 8px;
                background: var(--bg-primary);
                border-radius: 4px;
                font-size: 12px;
              ">
                <div style="font-weight: 500; color: var(--text-primary); margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                  ${Tips({ theme: 'outline', size: '14', fill: 'var(--text-primary)' })}
                  <span>建议：</span>
                </div>
                <div style="color: var(--text-secondary);">${finding.recommendation}</div>
                <!-- AI解决方案容器包装器，使用相对定位 -->
                <div id="${uniqueContainerId}-wrapper" style="position: relative; margin-top: 8px;">
                  <div id="${uniqueContainerId}"></div>
                </div>
                <button
                  id="${uniqueContainerId}-btn"
                  class="modern-btn secondary"
                  style="margin-top: 8px; font-size: 11px; padding: 4px 12px; display: inline-flex; align-items: center; gap: 4px;"
                  onclick="window.quickDetection?.generateAISolutionStream('${finding.title.replace(/'/g, "\\'")}', '${finding.description.replace(/'/g, "\\'")}', '${finding.severity}', '${uniqueContainerId}')">
                  ${Robot({ theme: 'outline', size: '12', fill: 'currentColor' })}
                  <span>AI 生成解决方案</span>
                </button>
              </div>
            ` : ''}
          </div>
        `;
      });

      html += `</div>`;
    } else if (item.result && item.result.findings.length === 0) {
      html += `
        <div style="
          margin-top: 8px;
          padding: 12px;
          background: rgba(34, 197, 94, 0.1);
          border-radius: var(--border-radius);
          border-left: 3px solid #22c55e;
        ">
          <span style="color: #22c55e; font-size: 14px; display: inline-flex; align-items: center; gap: 4px;">
            ${CheckOne({ theme: 'outline', size: '14', fill: '#22c55e' })}
            <span>未发现问题</span>
          </span>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  }

  /**
   * 关闭报告模态框
   */
  closeReportModal(): void {
    const modal = document.getElementById('detection-report-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * UI 方法：显示原始输出
   */
  showRawOutput(itemId: string): void {
    if (!this.currentReport) return;

    const item = this.currentReport.items.find(i => i.id === itemId);
    if (!item || !item.result || !item.result.rawOutput) return;

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10002;
      padding: 20px;
      animation: fadeIn 0.2s ease-out;
    `;

    const jsonStr = JSON.stringify(item.result.rawOutput, null, 2);

    modal.innerHTML = `
      <div style="
        background: var(--bg-primary);
        border-radius: 12px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        max-width: 800px;
        width: 100%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        animation: slideUp 0.3s ease-out;
      ">
        <div style="
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="display: flex; align-items: center; gap: 8px;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--text-primary);">${item.name} - 原始结果</h3>
          </div>
          <button class="raw-output-close-btn" style="
            background: none;
            border: none;
            color: var(--text-secondary);
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">×</button>
        </div>
        <div style="padding: 0; overflow: hidden; flex: 1; position: relative;">
          <pre style="
            margin: 0;
            padding: 20px;
            overflow: auto;
            height: 100%;
            font-family: var(--font-mono, monospace);
            font-size: 12px;
            color: var(--text-primary);
            background: var(--bg-secondary);
            tab-size: 2;
          ">${this.syntaxHighlight(jsonStr)}</pre>
          <button class="copy-btn" style="
            position: absolute;
            top: 10px;
            right: 10px;
            background: var(--bg-primary);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 11px;
            cursor: pointer;
            color: var(--text-secondary);
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          ">复制 JSON</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // 绑定事件
    const closeBtn = modal.querySelector('.raw-output-close-btn');
    const copyBtn = modal.querySelector('.copy-btn');

    const cleanup = (e?: Event) => {
      if (e) e.stopPropagation(); // 阻止事件冒泡，防止触发全局关闭
      modal.style.opacity = '0';
      setTimeout(() => {
        if (document.body.contains(modal)) {
          document.body.removeChild(modal);
        }
      }, 200);
    };

    closeBtn?.addEventListener('click', cleanup);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) cleanup();
    });

    copyBtn?.addEventListener('click', () => {
      navigator.clipboard.writeText(jsonStr).then(() => {
        const originalText = copyBtn.textContent;
        copyBtn.textContent = '已复制!';
        setTimeout(() => {
          copyBtn.textContent = originalText;
        }, 2000);
      });
    });
  }

  // ========== 工具方法 ==========

  /**
   * 工具方法：JSON 语法高亮
   */
  syntaxHighlight(json: string): string {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'number';
      let style = 'color: #f59e0b;'; // number - orange

      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'key';
          style = 'color: #3b82f6;'; // key - blue
        } else {
          cls = 'string';
          style = 'color: #10b981;'; // string - green
        }
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
        style = 'color: #ef4444;'; // boolean - red
      } else if (/null/.test(match)) {
        cls = 'null';
        style = 'color: #6b7280;'; // null - gray
      }
      return `<span class="${cls}" style="${style}">${match}</span>`;
    });
  }
}
