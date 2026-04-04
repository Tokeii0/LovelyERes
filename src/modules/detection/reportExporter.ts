/**
 * 检测报告导出器
 * 支持导出 HTML 格式的安全检测报告
 */

import type { DetectionReport, DetectionItem, Finding } from './quickDetectionManager';

// ========== 严重度配色 ==========
const SEVERITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' },
  high:     { bg: '#fff7ed', text: '#9a3412', border: '#fdba74' },
  medium:   { bg: '#fefce8', text: '#854d0e', border: '#fde68a' },
  low:      { bg: '#f0fdf4', text: '#166534', border: '#86efac' },
  info:     { bg: '#eff6ff', text: '#1e40af', border: '#93c5fd' },
};

const SEVERITY_LABELS: Record<string, string> = {
  critical: '严重', high: '高', medium: '中', low: '低', info: '信息',
};

// ========== 评分等级 ==========
function getScoreGrade(score: number): { label: string; color: string; desc: string } {
  if (score >= 90) return { label: 'A', color: '#16a34a', desc: '安全状态优秀' };
  if (score >= 75) return { label: 'B', color: '#2563eb', desc: '安全状态良好' };
  if (score >= 60) return { label: 'C', color: '#d97706', desc: '存在安全隐患' };
  if (score >= 40) return { label: 'D', color: '#ea580c', desc: '安全风险较高' };
  return { label: 'F', color: '#dc2626', desc: '安全状态危险' };
}

// ========== 报告导出 ==========

export class ReportExporter {
  /**
   * 导出为 HTML 并触发下载
   */
  static exportAsHTML(report: DetectionReport): void {
    const html = this.buildHTML(report);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const timestamp = new Date(report.timestamp).toISOString().slice(0, 16).replace(/[T:]/g, '-');
    const filename = `LovelyRes-安全检测报告-${timestamp}.html`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 构建完整的 HTML 报告
   */
  private static buildHTML(report: DetectionReport): string {
    const grade = getScoreGrade(report.overallScore);
    const date = new Date(report.timestamp);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;

    const completedItems = report.items.filter(i => i.status === 'completed');
    const failedItems = report.items.filter(i => i.status === 'failed');
    const securityItems = completedItems.filter(i => i.category === 'security');
    const performanceItems = completedItems.filter(i => i.category === 'performance');

    const allFindings: (Finding & { source: string })[] = [];
    completedItems.forEach(item => {
      if (item.result?.findings) {
        item.result.findings.forEach(f => {
          allFindings.push({ ...f, source: item.name });
        });
      }
    });
    allFindings.sort((a, b) => {
      const order = ['critical', 'high', 'medium', 'low', 'info'];
      return order.indexOf(a.severity) - order.indexOf(b.severity);
    });

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>LovelyRes 安全检测报告 — ${dateStr}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans SC', sans-serif; background: #f8fafc; color: #1e293b; line-height: 1.6; }
  .container { max-width: 900px; margin: 0 auto; padding: 32px 24px; }

  /* Header */
  .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 16px; color: #fff; padding: 40px 32px; margin-bottom: 24px; }
  .header h1 { font-size: 28px; margin-bottom: 4px; }
  .header .subtitle { opacity: 0.85; font-size: 14px; }
  .meta { display: flex; gap: 24px; margin-top: 20px; font-size: 13px; flex-wrap: wrap; }
  .meta-item { background: rgba(255,255,255,0.15); padding: 6px 14px; border-radius: 8px; }

  /* Score */
  .score-section { display: flex; gap: 20px; margin-bottom: 24px; flex-wrap: wrap; }
  .score-card { background: #fff; border-radius: 12px; padding: 24px; flex: 1; min-width: 200px; border: 1px solid #e2e8f0; text-align: center; }
  .score-big { font-size: 56px; font-weight: 800; }
  .score-grade { display: inline-block; padding: 4px 14px; border-radius: 20px; font-size: 14px; font-weight: 600; color: #fff; margin-top: 8px; }
  .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; }
  .summary-item { text-align: center; padding: 12px 8px; border-radius: 8px; }
  .summary-count { font-size: 28px; font-weight: 700; }
  .summary-label { font-size: 12px; margin-top: 4px; }

  /* Sections */
  .section { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px; overflow: hidden; }
  .section-title { font-size: 16px; font-weight: 600; padding: 16px 20px; border-bottom: 1px solid #e2e8f0; background: #f8fafc; }

  /* Findings */
  .finding { padding: 16px 20px; border-bottom: 1px solid #f1f5f9; }
  .finding:last-child { border-bottom: none; }
  .finding-header { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
  .badge { display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; }
  .finding-title { font-weight: 600; font-size: 14px; }
  .finding-source { font-size: 12px; color: #64748b; margin-left: auto; }
  .finding-desc { font-size: 13px; color: #475569; }
  .finding-rec { font-size: 13px; color: #16a34a; margin-top: 6px; padding-left: 14px; border-left: 3px solid #86efac; }

  /* Items table */
  .items-table { width: 100%; border-collapse: collapse; }
  .items-table th { text-align: left; font-size: 12px; color: #64748b; padding: 10px 16px; border-bottom: 1px solid #e2e8f0; }
  .items-table td { padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  .status-pass { color: #16a34a; font-weight: 600; }
  .status-fail { color: #dc2626; font-weight: 600; }

  /* Footer */
  .footer { text-align: center; color: #94a3b8; font-size: 12px; padding: 24px 0; }

  @media print { body { background: #fff; } .container { padding: 0; } }
</style>
</head>
<body>
<div class="container">
  <!-- Header -->
  <div class="header">
    <h1>🛡️ LovelyRes 安全检测报告</h1>
    <div class="subtitle">Linux Emergency Response Tool — 自动化安全审计</div>
    <div class="meta">
      <span class="meta-item">📅 ${dateStr}</span>
      <span class="meta-item">🖥️ ${this.escapeHtml(report.server || '未知服务器')}</span>
      <span class="meta-item">⏱️ 耗时 ${(report.totalDuration / 1000).toFixed(1)}s</span>
      <span class="meta-item">📋 共 ${report.items.length} 项检测</span>
    </div>
  </div>

  <!-- Score -->
  <div class="score-section">
    <div class="score-card">
      <div class="score-big" style="color: ${grade.color}">${report.overallScore}</div>
      <div class="score-grade" style="background: ${grade.color}">${grade.label} — ${grade.desc}</div>
    </div>
    <div class="score-card">
      <div class="summary-grid">
        ${Object.entries(report.summary).map(([key, val]) => {
          const c = SEVERITY_COLORS[key];
          return `<div class="summary-item" style="background:${c.bg}">
            <div class="summary-count" style="color:${c.text}">${val}</div>
            <div class="summary-label" style="color:${c.text}">${SEVERITY_LABELS[key]}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>

  <!-- Findings -->
  ${allFindings.length > 0 ? `
  <div class="section">
    <div class="section-title">🔍 发现的问题（${allFindings.length} 项）</div>
    ${allFindings.map(f => {
      const c = SEVERITY_COLORS[f.severity];
      return `<div class="finding">
        <div class="finding-header">
          <span class="badge" style="background:${c.bg};color:${c.text};border:1px solid ${c.border}">${SEVERITY_LABELS[f.severity]}</span>
          <span class="finding-title">${this.escapeHtml(f.title)}</span>
          <span class="finding-source">${this.escapeHtml(f.source)}</span>
        </div>
        <div class="finding-desc">${this.escapeHtml(f.description)}</div>
        ${f.recommendation ? `<div class="finding-rec">💡 ${this.escapeHtml(f.recommendation)}</div>` : ''}
      </div>`;
    }).join('')}
  </div>` : ''}

  <!-- Detection Items -->
  <div class="section">
    <div class="section-title">📊 检测项目详情</div>
    ${securityItems.length > 0 ? `
    <table class="items-table">
      <thead><tr><th colspan="4" style="font-size:14px;font-weight:600;padding-top:14px">🔒 安全检测</th></tr>
      <tr><th>项目</th><th>状态</th><th>严重度</th><th>耗时</th></tr></thead>
      <tbody>
      ${securityItems.map(item => this.renderItemRow(item)).join('')}
      </tbody>
    </table>` : ''}
    ${performanceItems.length > 0 ? `
    <table class="items-table">
      <thead><tr><th colspan="4" style="font-size:14px;font-weight:600;padding-top:14px">⚡ 性能检测</th></tr>
      <tr><th>项目</th><th>状态</th><th>严重度</th><th>耗时</th></tr></thead>
      <tbody>
      ${performanceItems.map(item => this.renderItemRow(item)).join('')}
      </tbody>
    </table>` : ''}
    ${failedItems.length > 0 ? `
    <table class="items-table">
      <thead><tr><th colspan="4" style="font-size:14px;font-weight:600;padding-top:14px;color:#dc2626">❌ 检测失败</th></tr>
      <tr><th>项目</th><th>状态</th><th colspan="2">原因</th></tr></thead>
      <tbody>
      ${failedItems.map(item => `<tr>
        <td>${this.escapeHtml(item.name)}</td>
        <td class="status-fail">失败</td>
        <td colspan="2">${this.escapeHtml(item.description)}</td>
      </tr>`).join('')}
      </tbody>
    </table>` : ''}
  </div>

  <div class="footer">
    Generated by LovelyRes — Linux Emergency Response Tool<br>
    Report ID: ${this.escapeHtml(report.id)} | ${dateStr}
  </div>
</div>
</body>
</html>`;
  }

  /** 渲染检测项行 */
  private static renderItemRow(item: DetectionItem): string {
    const result = item.result;
    if (!result) return '';
    const c = SEVERITY_COLORS[result.severity] || SEVERITY_COLORS.info;
    return `<tr>
      <td>${this.escapeHtml(item.name)}</td>
      <td class="${result.passed ? 'status-pass' : 'status-fail'}">${result.passed ? '✅ 通过' : '⚠️ 异常'}</td>
      <td><span class="badge" style="background:${c.bg};color:${c.text};border:1px solid ${c.border}">${SEVERITY_LABELS[result.severity]}</span></td>
      <td>${(result.duration / 1000).toFixed(1)}s</td>
    </tr>`;
  }

  /** HTML 转义 */
  private static escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
