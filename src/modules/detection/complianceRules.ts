/**
 * 合规检查框架
 * 基于等保 2.0 / CIS Benchmark 的合规检测模板
 */

// ========== 合规标准定义 ==========

export interface ComplianceRule {
  id: string;
  title: string;
  description: string;
  standard: 'cis' | 'mlps2'; // CIS Benchmark | 等保 2.0
  clause: string;             // 对应条款编号
  severity: 'critical' | 'high' | 'medium' | 'low';
  detectionItemId: string;    // 对应的检测项 ID（映射到 quickDetectionManager）
  category: string;
}

export interface ComplianceReport {
  standard: string;
  timestamp: Date;
  server: string;
  totalRules: number;
  passedRules: number;
  failedRules: number;
  compliancePercent: number;
  results: ComplianceRuleResult[];
}

export interface ComplianceRuleResult {
  rule: ComplianceRule;
  passed: boolean;
  details: string;
}

// ========== 等保 2.0 检查模板 ==========

export const MLPS2_RULES: ComplianceRule[] = [
  {
    id: 'mlps2-1', title: '身份鉴别 — 密码复杂度',
    description: '应对登录的用户进行身份标识和鉴别，身份标识具有唯一性',
    standard: 'mlps2', clause: '8.1.4.1 a)',
    severity: 'high', detectionItemId: 'pam_config', category: '身份鉴别',
  },
  {
    id: 'mlps2-2', title: '身份鉴别 — 登录失败锁定',
    description: '应具有登录失败处理功能，限制连续登录失败次数',
    standard: 'mlps2', clause: '8.1.4.1 b)',
    severity: 'high', detectionItemId: 'account_lockout', category: '身份鉴别',
  },
  {
    id: 'mlps2-3', title: '身份鉴别 — 密码策略',
    description: '口令应有复杂度要求并定期更换',
    standard: 'mlps2', clause: '8.1.4.1 c)',
    severity: 'medium', detectionItemId: 'password_policy', category: '身份鉴别',
  },
  {
    id: 'mlps2-4', title: '访问控制 — sudo 配置',
    description: '应根据管理用户的角色分配权限，实现管理用户的权限分离',
    standard: 'mlps2', clause: '8.1.4.2 a)',
    severity: 'high', detectionItemId: 'sudo_config', category: '访问控制',
  },
  {
    id: 'mlps2-5', title: '安全审计 — 审计配置',
    description: '应启用安全审计功能，对重要的用户行为和重要安全事件进行审计',
    standard: 'mlps2', clause: '8.1.4.3 a)',
    severity: 'high', detectionItemId: 'audit_config', category: '安全审计',
  },
  {
    id: 'mlps2-6', title: '入侵防范 — SSH 配置',
    description: '应关闭不需要的系统服务和高危端口',
    standard: 'mlps2', clause: '8.1.4.4 a)',
    severity: 'medium', detectionItemId: 'ssh_audit', category: '入侵防范',
  },
  {
    id: 'mlps2-7', title: '入侵防范 — 防火墙',
    description: '应通过设定终端接入方式和网络地址范围限制通信',
    standard: 'mlps2', clause: '8.1.4.4 b)',
    severity: 'medium', detectionItemId: 'firewall_check', category: '入侵防范',
  },
  {
    id: 'mlps2-8', title: '恶意代码防范 — 后门检测',
    description: '应安装防恶意代码软件或配置相应防护措施',
    standard: 'mlps2', clause: '8.1.4.5 a)',
    severity: 'critical', detectionItemId: 'backdoor_scan', category: '恶意代码防范',
  },
  {
    id: 'mlps2-9', title: '访问控制 — 文件权限',
    description: '应根据安全策略限制对文件的操作权限',
    standard: 'mlps2', clause: '8.1.4.2 c)',
    severity: 'medium', detectionItemId: 'file_permission', category: '访问控制',
  },
  {
    id: 'mlps2-10', title: '安全审计 — 日志分析',
    description: '审计记录应包括事件的日期和时间、用户、事件类型等',
    standard: 'mlps2', clause: '8.1.4.3 b)',
    severity: 'medium', detectionItemId: 'log_analysis', category: '安全审计',
  },
];

// ========== CIS Benchmark 检查模板 ==========

export const CIS_RULES: ComplianceRule[] = [
  {
    id: 'cis-1.1', title: 'Ensure SELinux or AppArmor is installed',
    description: 'Mandatory Access Control must be configured',
    standard: 'cis', clause: 'CIS 1.6.1',
    severity: 'medium', detectionItemId: 'selinux_status', category: 'Mandatory Access Control',
  },
  {
    id: 'cis-5.2.1', title: 'Ensure SSH Protocol is configured properly',
    description: 'SSH root login should be disabled, password auth reviewed',
    standard: 'cis', clause: 'CIS 5.2',
    severity: 'high', detectionItemId: 'ssh_audit', category: 'SSH Server Configuration',
  },
  {
    id: 'cis-5.3.1', title: 'Ensure password creation requirements are configured',
    description: 'Password quality must meet complexity requirements',
    standard: 'cis', clause: 'CIS 5.3.1',
    severity: 'high', detectionItemId: 'pam_config', category: 'PAM Configuration',
  },
  {
    id: 'cis-5.4.1', title: 'Ensure password expiration is configured',
    description: 'Password aging policies should be set',
    standard: 'cis', clause: 'CIS 5.4.1',
    severity: 'medium', detectionItemId: 'password_policy', category: 'User Accounts',
  },
  {
    id: 'cis-3.5', title: 'Ensure firewall is active',
    description: 'A host-based firewall must be enabled and configured',
    standard: 'cis', clause: 'CIS 3.5',
    severity: 'high', detectionItemId: 'firewall_check', category: 'Network Configuration',
  },
  {
    id: 'cis-4.1', title: 'Ensure auditing is enabled',
    description: 'The audit system must be operational',
    standard: 'cis', clause: 'CIS 4.1.1',
    severity: 'high', detectionItemId: 'audit_config', category: 'Logging and Auditing',
  },
  {
    id: 'cis-2.1', title: 'Ensure unnecessary services are disabled',
    description: 'Only required services should be running',
    standard: 'cis', clause: 'CIS 2.1',
    severity: 'medium', detectionItemId: 'unnecessary_services', category: 'Services',
  },
  {
    id: 'cis-1.4', title: 'Ensure sysctl kernel parameters are configured',
    description: 'Network-related kernel params for security',
    standard: 'cis', clause: 'CIS 3.1-3.3',
    severity: 'medium', detectionItemId: 'kernel_params', category: 'Kernel Parameters',
  },
];

/**
 * 获取合规标准的规则列表
 */
export function getComplianceRules(standard: 'cis' | 'mlps2'): ComplianceRule[] {
  return standard === 'cis' ? CIS_RULES : MLPS2_RULES;
}

/**
 * 生成合规检查概要（基于已有的检测结果映射得分）
 */
export function generateComplianceSummary(
  standard: 'cis' | 'mlps2',
  detectionResults: Map<string, boolean>
): { total: number; passed: number; failed: number; pending: number; percent: number } {
  const rules = getComplianceRules(standard);
  let passed = 0, failed = 0, pending = 0;

  for (const rule of rules) {
    const result = detectionResults.get(rule.detectionItemId);
    if (result === undefined) pending++;
    else if (result) passed++;
    else failed++;
  }

  return {
    total: rules.length,
    passed,
    failed,
    pending,
    percent: rules.length > 0 ? Math.round((passed / rules.length) * 100) : 0,
  };
}
