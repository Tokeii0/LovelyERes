/**
 * 检测模块
 * 包含所有独立的安全和性能检测方法
 */

import { invoke } from '@tauri-apps/api/core';
import type { DetectionResult, Finding } from './quickDetectionManager';

// 评分规则常量
const SCORING_RULES = {
  CRITICAL_DEDUCTION: 40,
  HIGH_DEDUCTION: 20,
  MEDIUM_DEDUCTION: 10,
  LOW_DEDUCTION: 5
};

export class DetectionModules {

  /**
   * 按 ID 执行单项检测 (公开方法，供 fixExecutor 验证用)
   */
  public async runSingleDetection(itemId: string): Promise<DetectionResult> {
    const map: Record<string, () => Promise<DetectionResult>> = {
      'port-scan': () => this.runPortScan(),
      'user-audit': () => this.runUserAudit(),
      'backdoor-scan': () => this.runBackdoorScan(),
      'process-analysis': () => this.runProcessAnalysis(),
      'file-permission': () => this.runFilePermissionCheck(),
      'ssh-audit': () => this.runSSHAudit(),
      'log-analysis': () => this.runLogAnalysis(),
      'firewall-check': () => this.runFirewallCheck(),
      'password-policy': () => this.runPasswordPolicyCheck(),
      'sudo-audit': () => this.runSudoAudit(),
      'pam-config': () => this.runPAMConfigCheck(),
      'account-lockout': () => this.runAccountLockoutCheck(),
      'selinux-status': () => this.runSELinuxStatusCheck(),
      'kernel-params': () => this.runKernelParamsCheck(),
      'system-updates': () => this.runSystemUpdatesCheck(),
      'unnecessary-services': () => this.runUnnecessaryServicesCheck(),
      'auto-start-services': () => this.runAutoStartServicesCheck(),
      'audit-config': () => this.runAuditConfigCheck(),
      'history-audit': () => this.runHistoryAudit(),
      'ntp-config': () => this.runNTPConfigCheck(),
      'dns-config': () => this.runDNSConfigCheck(),
      'webshell-scan': () => this.runWebshellScan(),
      'rootkit-scan': () => this.runRootkitScan(),
      'persistence-scan': () => this.runPersistenceScan(),
      'log-tamper': () => this.runLogTamperCheck(),
      'network-backdoor': () => this.runNetworkBackdoorScan(),
      'enhanced-user': () => this.runEnhancedUserAudit(),
      'hidden-cron': () => this.runHiddenCronCheck(),
      'ssh-key-audit': () => this.runSSHKeyAudit(),
      'timestomp-check': () => this.runTimestompCheck(),
      'enhanced-process': () => this.runEnhancedProcessAnalysis(),
      'bin-tamper': () => this.runBinTamperScan(),
      'immutable-files': () => this.runImmutableFilesScan(),
    };
    const fn = map[itemId];
    if (!fn) return this.createErrorResult(`未知检测项: ${itemId}`);
    const start = Date.now();
    const result = await fn();
    result.duration = Date.now() - start;
    result.timestamp = new Date();
    return result;
  }

  /**
   * 端口扫描
   */
  public async runPortScan(): Promise<DetectionResult> {
    try {
      const scanResult = await invoke('detect_port_scan') as any;

      const findings: Finding[] = [];
      let severity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'info';

      // 分析开放端口
      if (scanResult.open_ports) {
        scanResult.open_ports.forEach((port: any) => {
          if (this.isHighRiskPort(port.port)) {
            findings.push({
              title: `高危端口开放: ${port.port}`,
              description: `端口 ${port.port} (${port.service || '未知服务'}) 处于开放状态`,
              severity: 'high',
              recommendation: '检查该端口的服务配置，确认是否需要对外开放',
              details: port
            });
            severity = 'high';
          }
        });
      }

      return {
        passed: findings.length === 0,
        score: this.calculateScore(findings),
        severity,
        findings,
        duration: 0,
        timestamp: new Date(),
        rawOutput: scanResult
      };
    } catch (error) {
      console.error('端口扫描失败:', error);
      return this.createErrorResult('端口扫描失败');
    }
  }

  /**
   * 用户权限审计
   */
  public async runUserAudit(): Promise<DetectionResult> {
    try {
      const auditResult = await invoke('detect_user_audit') as any;

      const findings: Finding[] = [];
      let severity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'info';

      // 检查 root 用户
      if (auditResult.root_users && auditResult.root_users.length > 1) {
        findings.push({
          title: '存在多个 root 权限用户',
          description: `发现 ${auditResult.root_users.length} 个具有 root 权限的用户`,
          severity: 'medium',
          recommendation: '审核 root 权限用户列表，移除不必要的高权限账号',
          details: auditResult.root_users
        });
        severity = 'medium';
      }

      // 检查空密码账号
      if (auditResult.empty_password_users && auditResult.empty_password_users.length > 0) {
        const userList = auditResult.empty_password_users.slice(0, 5).join(', ');
        const more = auditResult.empty_password_users.length > 5 ? ` 等 ${auditResult.empty_password_users.length} 个账号` : '';
        findings.push({
          title: '存在空密码账号',
          description: `发现空密码账号: ${userList}${more}`,
          severity: 'critical',
          recommendation: '立即为这些账号设置强密码或禁用账号',
          details: auditResult.empty_password_users
        });
        severity = 'critical';
      }

      // 检查最近创建的用户
      if (auditResult.recent_users && auditResult.recent_users.length > 0) {
        const userList = auditResult.recent_users.slice(0, 3).map((u: any) => u.username || u).join(', ');
        const more = auditResult.recent_users.length > 3 ? ` 等 ${auditResult.recent_users.length} 个` : '';
        findings.push({
          title: '最近创建的用户',
          description: `最近 7 天内创建的新用户: ${userList}${more}`,
          severity: 'info',
          recommendation: '审核这些新用户是否为授权创建',
          details: auditResult.recent_users
        });
      }

      return {
        passed: findings.filter(f => f.severity === 'critical' || f.severity === 'high').length === 0,
        score: this.calculateScore(findings),
        severity,
        findings,
        duration: 0,
        timestamp: new Date(),
        rawOutput: auditResult
      };
    } catch (error) {
      console.error('用户审计失败:', error);
      return this.createErrorResult('用户审计失败');
    }
  }

  /**
   * 后门检测
   */
  public async runBackdoorScan(): Promise<DetectionResult> {
    try {
      const scanResult = await invoke('detect_backdoor') as any;

      const findings: Finding[] = [];
      let severity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'info';

      // 检查可疑的计划任务
      if (scanResult.suspicious_cron && scanResult.suspicious_cron.length > 0) {
        const cronList = scanResult.suspicious_cron.slice(0, 5).map((c: any) => {
          const cronStr = typeof c === 'string' ? c : JSON.stringify(c);
          return cronStr.substring(0, 200);
        }).join('\n');
        const more = scanResult.suspicious_cron.length > 5 ? `\n... 共 ${scanResult.suspicious_cron.length} 个` : '';
        findings.push({
          title: '发现可疑的计划任务',
          description: `可疑计划任务: ${cronList}${more}`,
          severity: 'high',
          recommendation: '审核这些计划任务，删除未授权的任务',
          details: scanResult.suspicious_cron
        });
        severity = 'high';
      }

      // 检查可疑的启动项
      if (scanResult.suspicious_autostart && scanResult.suspicious_autostart.length > 0) {
        const autostartList = scanResult.suspicious_autostart.slice(0, 3).map((s: any) => {
          const str = typeof s === 'string' ? s : (s.name || s.path || JSON.stringify(s));
          return str.split('/').pop() || str;
        }).join(', ');
        const more = scanResult.suspicious_autostart.length > 3 ? ` 等 ${scanResult.suspicious_autostart.length} 个` : '';
        findings.push({
          title: '发现可疑的启动项',
          description: `可疑自启动项: ${autostartList}${more}`,
          severity: 'medium',
          recommendation: '检查这些启动项的来源和用途',
          details: scanResult.suspicious_autostart
        });
        severity = severity === 'high' ? 'high' : 'medium';
      }

      // 检查 SSH authorized_keys
      if (scanResult.suspicious_ssh_keys && scanResult.suspicious_ssh_keys.length > 0) {
        const keyList = scanResult.suspicious_ssh_keys.slice(0, 5).map((k: any) => {
          const keyStr = typeof k === 'string' ? k : JSON.stringify(k);
          return keyStr.substring(0, 120);
        }).join('\n');
        const more = scanResult.suspicious_ssh_keys.length > 5 ? `\n... 共 ${scanResult.suspicious_ssh_keys.length} 个` : '';
        findings.push({
          title: '发现可疑的 SSH 公钥',
          description: `可疑 SSH 公钥: ${keyList}${more}`,
          severity: 'high',
          recommendation: '审核 authorized_keys 文件，移除未授权的公钥',
          details: scanResult.suspicious_ssh_keys
        });
        severity = 'high';
      }

      return {
        passed: findings.filter(f => f.severity === 'critical' || f.severity === 'high').length === 0,
        score: this.calculateScore(findings),
        severity,
        findings,
        duration: 0,
        timestamp: new Date(),
        rawOutput: scanResult
      };
    } catch (error) {
      console.error('后门检测失败:', error);
      return this.createErrorResult('后门检测失败');
    }
  }

  /**
   * 进程分析
   */
  public async runProcessAnalysis(): Promise<DetectionResult> {
    try {
      const analysisResult = await invoke('detect_process_analysis') as any;

      const findings: Finding[] = [];
      let severity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'info';

      // 检查可疑进程
      if (analysisResult.suspicious_processes && analysisResult.suspicious_processes.length > 0) {
        const processList = analysisResult.suspicious_processes.slice(0, 3).map((p: any) => {
          const name = p.name || p.command || p.cmd || JSON.stringify(p);
          return name.split(' ')[0].split('/').pop();
        }).join(', ');
        const more = analysisResult.suspicious_processes.length > 3 ? ` 等 ${analysisResult.suspicious_processes.length} 个` : '';
        findings.push({
          title: '发现可疑进程',
          description: `可疑进程: ${processList}${more}`,
          severity: 'high',
          recommendation: '调查这些进程的来源和用途',
          details: analysisResult.suspicious_processes
        });
        severity = 'high';
      }

      // 检查高资源占用进程
      if (analysisResult.high_resource_processes && analysisResult.high_resource_processes.length > 0) {
        findings.push({
          title: '高资源占用进程',
          description: `发现 ${analysisResult.high_resource_processes.length} 个高资源占用进程`,
          severity: 'medium',
          recommendation: '检查这些进程是否正常',
          details: analysisResult.high_resource_processes
        });
      }

      return {
        passed: findings.filter(f => f.severity === 'critical' || f.severity === 'high').length === 0,
        score: this.calculateScore(findings),
        severity,
        findings,
        duration: 0,
        timestamp: new Date(),
        rawOutput: analysisResult
      };
    } catch (error) {
      console.error('进程分析失败:', error);
      return this.createErrorResult('进程分析失败');
    }
  }

  /**
   * 文件权限检测
   */
  public async runFilePermissionCheck(): Promise<DetectionResult> {
    try {
      const checkResult = await invoke('detect_file_permission') as any;

      const findings: Finding[] = [];
      let severity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'info';

      // 检查 SUID 文件
      if (checkResult.suid_files && checkResult.suid_files.length > 0) {
        findings.push({
          title: 'SUID 文件检测',
          description: `发现 ${checkResult.suid_files.length} 个 SUID 文件`,
          severity: 'info',
          recommendation: '审核这些 SUID 文件是否为系统必需',
          details: checkResult.suid_files
        });
      }

      // 检查敏感文件权限
      if (checkResult.sensitive_file_issues && checkResult.sensitive_file_issues.length > 0) {
        findings.push({
          title: '敏感文件权限问题',
          description: `发现 ${checkResult.sensitive_file_issues.length} 个敏感文件权限配置不当`,
          severity: 'high',
          recommendation: '修正这些文件的权限设置',
          details: checkResult.sensitive_file_issues
        });
        severity = 'high';
      }

      return {
        passed: findings.filter(f => f.severity === 'critical' || f.severity === 'high').length === 0,
        score: this.calculateScore(findings),
        severity,
        findings,
        duration: 0,
        timestamp: new Date(),
        rawOutput: checkResult
      };
    } catch (error) {
      console.error('文件权限检测失败:', error);
      return this.createErrorResult('文件权限检测失败');
    }
  }

  /**
   * SSH 安全审计
   */
  public async runSSHAudit(): Promise<DetectionResult> {
    try {
      const auditResult = await invoke('detect_ssh_audit') as any;

      const findings: Finding[] = [];
      let severity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'info';

      // 检查 root 登录
      if (auditResult.permit_root_login) {
        findings.push({
          title: 'SSH 允许 root 登录',
          description: 'SSH 配置允许 root 用户直接登录',
          severity: 'high',
          recommendation: '建议禁用 root 直接登录，使用普通用户登录后 su 或 sudo',
          details: { config: 'PermitRootLogin yes' }
        });
        severity = 'high';
      }

      // 检查密码认证
      if (auditResult.password_authentication) {
        findings.push({
          title: 'SSH 允许密码认证',
          description: 'SSH 配置允许使用密码认证',
          severity: 'medium',
          recommendation: '建议使用密钥认证替代密码认证',
          details: { config: 'PasswordAuthentication yes' }
        });
        severity = severity === 'high' ? 'high' : 'medium';
      }

      // 检查默认端口
      if (auditResult.default_port) {
        findings.push({
          title: 'SSH 使用默认端口',
          description: 'SSH 服务使用默认的 22 端口',
          severity: 'low',
          recommendation: '建议修改 SSH 端口以减少自动化扫描攻击',
          details: { port: 22 }
        });
      }

      return {
        passed: findings.filter(f => f.severity === 'critical' || f.severity === 'high').length === 0,
        score: this.calculateScore(findings),
        severity,
        findings,
        duration: 0,
        timestamp: new Date(),
        rawOutput: auditResult
      };
    } catch (error) {
      console.error('SSH 审计失败:', error);
      return this.createErrorResult('SSH 审计失败');
    }
  }

  /**
   * 日志分析
   */
  public async runLogAnalysis(): Promise<DetectionResult> {
    try {
      const analysisResult = await invoke('detect_log_analysis') as any;

      const findings: Finding[] = [];
      let severity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'info';

      // 检查暴力破解
      if (analysisResult.brute_force_attempts && analysisResult.brute_force_attempts > 0) {
        findings.push({
          title: '检测到暴力破解尝试',
          description: `检测到 ${analysisResult.brute_force_attempts} 次暴力破解尝试`,
          severity: 'high',
          recommendation: '配置 fail2ban 或类似工具防止暴力破解',
          details: analysisResult.brute_force_details
        });
        severity = 'high';
      }

      // 检查异常登录
      if (analysisResult.abnormal_logins && analysisResult.abnormal_logins.length > 0) {
        findings.push({
          title: '发现异常登录记录',
          description: `发现 ${analysisResult.abnormal_logins.length} 条异常登录记录`,
          severity: 'medium',
          recommendation: '审核这些登录记录，确认是否为授权访问',
          details: analysisResult.abnormal_logins
        });
        severity = severity === 'high' ? 'high' : 'medium';
      }

      return {
        passed: findings.filter(f => f.severity === 'critical' || f.severity === 'high').length === 0,
        score: this.calculateScore(findings),
        severity,
        findings,
        duration: 0,
        timestamp: new Date(),
        rawOutput: analysisResult
      };
    } catch (error) {
      console.error('日志分析失败:', error);
      return this.createErrorResult('日志分析失败');
    }
  }

  /**
   * 防火墙检查
   */
  public async runFirewallCheck(): Promise<DetectionResult> {
    try {
      const checkResult = await invoke('detect_firewall_check') as any;

      const findings: Finding[] = [];
      let severity: 'critical' | 'high' | 'medium' | 'low' | 'info' = 'info';

      // 检查防火墙状态
      if (!checkResult.firewall_active) {
        findings.push({
          title: '防火墙未启用',
          description: '系统防火墙未启用或未运行',
          severity: 'high',
          recommendation: '启用并配置防火墙以保护系统',
          details: checkResult
        });
        severity = 'high';
      } else {
        // 检查高危规则
        if (checkResult.risky_rules && checkResult.risky_rules.length > 0) {
          findings.push({
            title: '存在高危防火墙规则',
            description: `发现 ${checkResult.risky_rules.length} 条高危防火墙规则`,
            severity: 'medium',
            recommendation: '审核这些规则，确保符合安全策略',
            details: checkResult.risky_rules
          });
          severity = 'medium';
        }
      }

      return {
        passed: findings.filter(f => f.severity === 'critical' || f.severity === 'high').length === 0,
        score: this.calculateScore(findings),
        severity,
        findings,
        duration: 0,
        timestamp: new Date(),
        rawOutput: checkResult
      };
    } catch (error) {
      console.error('防火墙检查失败:', error);
      return this.createErrorResult('防火墙检查失败');
    }
  }

  /**
   * CPU 测试
   */
  public async runCPUTest(): Promise<DetectionResult> {
    try {
      const testResult = await invoke('detect_cpu_test') as any;

      const findings: Finding[] = [];

      findings.push({
        title: 'CPU 性能测试',
        description: `CPU 核心数: ${testResult.cores}, 频率: ${testResult.frequency} MHz`,
        severity: 'info',
        details: testResult
      });

      return {
        passed: true,
        score: 100,
        severity: 'info',
        findings,
        duration: 0,
        timestamp: new Date(),
        rawOutput: testResult
      };
    } catch (error) {
      console.error('CPU 测试失败:', error);
      return this.createErrorResult('CPU 测试失败');
    }
  }

  /**
   * 内存测试
   */
  public async runMemoryTest(): Promise<DetectionResult> {
    try {
      const testResult = await invoke('detect_memory_test') as any;

      const findings: Finding[] = [];

      findings.push({
        title: '内存性能测试',
        description: `总内存: ${testResult.total} MB, 可用: ${testResult.available} MB`,
        severity: 'info',
        details: testResult
      });

      return {
        passed: true,
        score: 100,
        severity: 'info',
        findings,
        duration: 0,
        timestamp: new Date(),
        rawOutput: testResult
      };
    } catch (error) {
      console.error('内存测试失败:', error);
      return this.createErrorResult('内存测试失败');
    }
  }

  /**
   * 磁盘测试
   */
  public async runDiskTest(): Promise<DetectionResult> {
    try {
      const testResult = await invoke('detect_disk_test') as any;

      const findings: Finding[] = [];

      findings.push({
        title: '磁盘 I/O 测试',
        description: `读取速度: ${testResult.read_speed} MB/s, 写入速度: ${testResult.write_speed} MB/s`,
        severity: 'info',
        details: testResult
      });

      return {
        passed: true,
        score: 100,
        severity: 'info',
        findings,
        duration: 0,
        timestamp: new Date(),
        rawOutput: testResult
      };
    } catch (error) {
      console.error('磁盘测试失败:', error);
      return this.createErrorResult('磁盘测试失败');
    }
  }

  /**
   * 网络测试
   */
  public async runNetworkTest(): Promise<DetectionResult> {
    try {
      const testResult = await invoke('detect_network_test') as any;

      const findings: Finding[] = [];

      findings.push({
        title: '网络性能测试',
        description: `延迟: ${testResult.latency} ms, 带宽: ${testResult.bandwidth} Mbps`,
        severity: 'info',
        details: testResult
      });

      return {
        passed: true,
        score: 100,
        severity: 'info',
        findings,
        duration: 0,
        timestamp: new Date(),
        rawOutput: testResult
      };
    } catch (error) {
      console.error('网络测试失败:', error);
      return this.createErrorResult('网络测试失败');
    }
  }

  /**
   * 密码策略检查
   */
  public async runPasswordPolicyCheck(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_password_policy') as any;
      return this.processBasicDetectionResult(result, '密码策略');
    } catch (error) {
      console.error('密码策略检查失败:', error);
      return this.createErrorResult('密码策略检查失败');
    }
  }

  /**
   * Sudo 配置审计
   */
  public async runSudoAudit(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_sudo_config') as any;
      return this.processBasicDetectionResult(result, 'Sudo 配置');
    } catch (error) {
      console.error('Sudo 审计失败:', error);
      return this.createErrorResult('Sudo 审计失败');
    }
  }

  /**
   * PAM 配置检查
   */
  public async runPAMConfigCheck(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_pam_config') as any;
      return this.processBasicDetectionResult(result, 'PAM 配置');
    } catch (error) {
      console.error('PAM 配置检查失败:', error);
      return this.createErrorResult('PAM 配置检查失败');
    }
  }

  /**
   * 账号锁定策略检查
   */
  public async runAccountLockoutCheck(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_account_lockout') as any;
      return this.processBasicDetectionResult(result, '账号锁定策略');
    } catch (error) {
      console.error('账号锁定策略检查失败:', error);
      return this.createErrorResult('账号锁定策略检查失败');
    }
  }

  /**
   * SELinux/AppArmor 状态检查
   */
  public async runSELinuxStatusCheck(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_selinux_status') as any;
      return this.processBasicDetectionResult(result, 'SELinux/AppArmor');
    } catch (error) {
      console.error('SELinux 状态检查失败:', error);
      return this.createErrorResult('SELinux 状态检查失败');
    }
  }

  /**
   * 内核参数检查
   */
  public async runKernelParamsCheck(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_kernel_params') as any;
      return this.processBasicDetectionResult(result, '内核参数');
    } catch (error) {
      console.error('内核参数检查失败:', error);
      return this.createErrorResult('内核参数检查失败');
    }
  }

  /**
   * 系统补丁状态检查
   */
  public async runSystemUpdatesCheck(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_system_updates') as any;
      return this.processBasicDetectionResult(result, '系统补丁');
    } catch (error) {
      console.error('系统补丁检查失败:', error);
      return this.createErrorResult('系统补丁检查失败');
    }
  }

  /**
   * 不必要服务检查
   */
  public async runUnnecessaryServicesCheck(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_unnecessary_services') as any;
      return this.processBasicDetectionResult(result, '不必要服务');
    } catch (error) {
      console.error('不必要服务检查失败:', error);
      return this.createErrorResult('不必要服务检查失败');
    }
  }

  /**
   * 自启动服务审计
   */
  public async runAutoStartServicesCheck(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_auto_start_services') as any;
      return this.processBasicDetectionResult(result, '自启动服务');
    } catch (error) {
      console.error('自启动服务审计失败:', error);
      return this.createErrorResult('自启动服务审计失败');
    }
  }

  /**
   * 审计配置检查
   */
  public async runAuditConfigCheck(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_audit_config') as any;
      return this.processBasicDetectionResult(result, '审计配置');
    } catch (error) {
      console.error('审计配置检查失败:', error);
      return this.createErrorResult('审计配置检查失败');
    }
  }

  /**
   * 历史命令审计
   */
  public async runHistoryAudit(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_history_audit') as any;
      return this.processBasicDetectionResult(result, '历史命令');
    } catch (error) {
      console.error('历史命令审计失败:', error);
      return this.createErrorResult('历史命令审计失败');
    }
  }

  /**
   * NTP 配置检查
   */
  public async runNTPConfigCheck(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_ntp_config') as any;
      return this.processBasicDetectionResult(result, 'NTP 配置');
    } catch (error) {
      console.error('NTP 配置检查失败:', error);
      return this.createErrorResult('NTP 配置检查失败');
    }
  }

  /**
   * DNS 配置检查
   */
  public async runDNSConfigCheck(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_dns_config') as any;
      return this.processBasicDetectionResult(result, 'DNS 配置');
    } catch (error) {
      console.error('DNS 配置检查失败:', error);
      return this.createErrorResult('DNS 配置检查失败');
    }
  }

  /**
   * 处理基础检测结果的通用方法
   */
  public processBasicDetectionResult(result: any, name: string): DetectionResult {
    const findings: Finding[] = [];
    let score = 100;

    if (result.issues && result.issues.length > 0) {
      result.issues.forEach((issue: any) => {
        findings.push({
          title: issue.title || `${name}问题`,
          description: issue.description || issue.message || '发现配置问题',
          severity: issue.severity || 'medium',
          recommendation: issue.recommendation || `请检查${name}配置`,
          details: issue.details
        });

        // 根据严重程度扣分
        switch (issue.severity) {
          case 'critical':
            score -= SCORING_RULES.CRITICAL_DEDUCTION;
            break;
          case 'high':
            score -= SCORING_RULES.HIGH_DEDUCTION;
            break;
          case 'medium':
            score -= SCORING_RULES.MEDIUM_DEDUCTION;
            break;
          case 'low':
            score -= SCORING_RULES.LOW_DEDUCTION;
            break;
        }
      });
    }

    return {
      passed: findings.length === 0,
      score: Math.max(0, score),
      severity: findings.length > 0 ? findings[0].severity : 'info',
      findings,
      duration: 0,
      timestamp: new Date(),
      rawOutput: result
    };
  }

  /**
   * 工具方法：判断是否为高危端口
   */
  public isHighRiskPort(port: number): boolean {
    const highRiskPorts = [
      3306,  // MySQL
      5432,  // PostgreSQL
      6379,  // Redis
      27017, // MongoDB
      9200,  // Elasticsearch
      2375,  // Docker (未加密)
      2376,  // Docker (TLS)
      5984,  // CouchDB
      7001,  // Cassandra
      8086   // InfluxDB
    ];
    return highRiskPorts.includes(port);
  }

  /**
   * 工具方法：计算评分
   */
  public calculateScore(findings: Finding[]): number {
    if (findings.length === 0) return 100;

    // 按严重程度统计数量，使用递减扣分避免 3 个 critical 和 10 个得分相同
    const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    findings.forEach(f => {
      if (f.severity in counts) counts[f.severity]++;
    });

    let deduction = 0;
    for (const [severity, count] of Object.entries(counts)) {
      const base = severity === 'critical' ? SCORING_RULES.CRITICAL_DEDUCTION
        : severity === 'high' ? SCORING_RULES.HIGH_DEDUCTION
        : severity === 'medium' ? SCORING_RULES.MEDIUM_DEDUCTION
        : SCORING_RULES.LOW_DEDUCTION;
      // 每个额外同类发现的扣分递减（第1个扣满分，第2个扣60%，第3个扣36%...）
      for (let i = 0; i < count; i++) {
        deduction += base * Math.pow(0.6, i);
      }
    }

    return Math.max(0, Math.round(100 - deduction));
  }

  /**
   * 工具方法：创建错误结果
   */
  public createErrorResult(message: string): DetectionResult {
    return {
      passed: false,
      score: 0,
      severity: 'info',
      findings: [{
        title: '检测失败',
        description: message,
        severity: 'info'
      }],
      duration: 0,
      timestamp: new Date()
    };
  }

  // ==================== 竞赛级检测方法 ====================

  public async runWebshellScan(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_webshell') as any;
      const findings: Finding[] = (result.suspicious_files || []).map((f: any) => ({
        title: `发现可疑 Webshell: ${f.path}`,
        description: `匹配模式: ${f.matched_pattern}`,
        severity: 'critical' as const,
        recommendation: '立即检查该文件内容，确认是否为 Webshell，若是则删除并排查入侵路径',
        details: f,
      }));
      return {
        passed: findings.length === 0,
        score: this.calculateScore(findings),
        severity: findings.length > 0 ? 'critical' : 'info',
        findings,
        duration: 0,
        timestamp: new Date(),
        rawOutput: result,
      };
    } catch (error) {
      return this.createErrorResult('Webshell 扫描失败');
    }
  }

  public async runRootkitScan(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_rootkit') as any;
      const findings: Finding[] = [];
      (result.hidden_processes || []).forEach((p: string) => findings.push({
        title: '发现隐藏进程', description: p, severity: 'critical',
        recommendation: '隐藏进程极为危险，可能是 Rootkit，立即排查',
      }));
      (result.suspicious_modules || []).forEach((m: string) => findings.push({
        title: '可疑内核模块', description: m, severity: 'high',
        recommendation: '检查该模块是否为合法驱动，使用 modinfo 查看详情',
      }));
      (result.ld_preload_hooks || []).forEach((h: string) => findings.push({
        title: 'LD_PRELOAD Hook', description: h, severity: 'critical',
        recommendation: '清除 /etc/ld.so.preload 中的可疑条目',
      }));
      return {
        passed: findings.length === 0,
        score: this.calculateScore(findings),
        severity: findings.some(f => f.severity === 'critical') ? 'critical' : findings.length > 0 ? 'high' : 'info',
        findings, duration: 0, timestamp: new Date(), rawOutput: result,
      };
    } catch (error) {
      return this.createErrorResult('Rootkit 检测失败');
    }
  }

  public async runPersistenceScan(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_persistence') as any;
      const findings: Finding[] = [];
      (result.suspicious_cron || []).forEach((c: string) => findings.push({
        title: '可疑计划任务', description: c, severity: 'high',
        recommendation: '删除可疑 cron 条目',
      }));
      (result.bashrc_trojans || []).forEach((b: string) => findings.push({
        title: '.bashrc/.profile 木马', description: b, severity: 'critical',
        recommendation: '清除 Shell 配置文件中的恶意代码',
      }));
      (result.systemd_trojans || []).forEach((s: string) => findings.push({
        title: 'Systemd 后门', description: s, severity: 'critical',
        recommendation: '检查并移除可疑的 systemd unit 文件',
      }));
      (result.rc_local_entries || []).forEach((r: string) => findings.push({
        title: 'rc.local 持久化', description: r, severity: 'high',
        recommendation: '清理 rc.local 中的可疑命令',
      }));
      (result.at_jobs || []).forEach((a: string) => findings.push({
        title: 'at 计划任务', description: a, severity: 'medium',
        recommendation: '检查 at 队列中的任务',
      }));
      (result.ld_preload_files || []).forEach((l: string) => findings.push({
        title: 'LD_PRELOAD 持久化', description: l, severity: 'critical',
        recommendation: '清除 ld.so.preload 中的恶意条目',
      }));
      return {
        passed: findings.length === 0,
        score: this.calculateScore(findings),
        severity: findings.some(f => f.severity === 'critical') ? 'critical' : findings.length > 0 ? 'high' : 'info',
        findings, duration: 0, timestamp: new Date(), rawOutput: result,
      };
    } catch (error) {
      return this.createErrorResult('持久化扫描失败');
    }
  }

  public async runLogTamperCheck(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_log_tamper') as any;
      const findings: Finding[] = [];
      (result.truncated_logs || []).forEach((l: string) => findings.push({
        title: '日志被截断/清空', description: l, severity: 'high',
        recommendation: '日志被清空是入侵痕迹清除的典型特征，需要从备份或远程日志服务器恢复',
      }));
      (result.deleted_open_logs || []).forEach((l: string) => findings.push({
        title: '已删除但仍打开的日志', description: l, severity: 'high',
        recommendation: '使用 lsof 恢复已删除日志的内容',
      }));
      (result.timestamp_gaps || []).forEach((g: string) => findings.push({
        title: '日志时间戳异常', description: g, severity: 'medium',
        recommendation: '检查是否存在日志时间断裂或异常集中的登录',
      }));
      return {
        passed: findings.length === 0,
        score: this.calculateScore(findings),
        severity: findings.length > 0 ? 'high' : 'info',
        findings, duration: 0, timestamp: new Date(), rawOutput: result,
      };
    } catch (error) {
      return this.createErrorResult('日志篡改检测失败');
    }
  }

  public async runNetworkBackdoorScan(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_network_backdoor') as any;
      const findings: Finding[] = [];
      (result.suspicious_listeners || []).forEach((l: string) => findings.push({
        title: '可疑网络监听', description: l, severity: 'high',
        recommendation: '检查该监听端口对应的进程，确认是否合法',
      }));
      (result.c2_connections || []).forEach((c: string) => findings.push({
        title: '疑似 C2 连接', description: c, severity: 'critical',
        recommendation: '立即断开可疑连接并排查进程',
      }));
      (result.reverse_shell_indicators || []).forEach((r: string) => findings.push({
        title: '反弹 Shell 指示器', description: r, severity: 'critical',
        recommendation: '发现进程二进制已被删除或位于临时目录，高度怀疑为反弹 Shell',
      }));
      return {
        passed: findings.length === 0,
        score: this.calculateScore(findings),
        severity: findings.some(f => f.severity === 'critical') ? 'critical' : findings.length > 0 ? 'high' : 'info',
        findings, duration: 0, timestamp: new Date(), rawOutput: result,
      };
    } catch (error) {
      return this.createErrorResult('网络后门检测失败');
    }
  }

  public async runEnhancedUserAudit(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_enhanced_user') as any;
      const findings: Finding[] = [];
      (result.uid_conflicts || []).forEach((u: string) => findings.push({
        title: 'UID 冲突', description: u, severity: 'critical',
        recommendation: 'UID 冲突可能被用于权限提升，检查冲突账号',
      }));
      (result.shell_without_home || []).forEach((u: string) => findings.push({
        title: '有 Shell 权限但无 Home 目录', description: u, severity: 'medium',
        recommendation: '可能是后门账号，检查该用户的用途',
      }));
      (result.suspicious_history || []).forEach((h: string) => findings.push({
        title: '可疑历史命令', description: h, severity: 'high',
        recommendation: '分析该命令是否为攻击者操作',
      }));
      return {
        passed: findings.length === 0,
        score: this.calculateScore(findings),
        severity: findings.some(f => f.severity === 'critical') ? 'critical' : findings.length > 0 ? 'high' : 'info',
        findings, duration: 0, timestamp: new Date(), rawOutput: result,
      };
    } catch (error) {
      return this.createErrorResult('增强用户审计失败');
    }
  }

  public async runHiddenCronCheck(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_hidden_cron') as any;
      return this.processBasicDetectionResult(result, '隐藏计划任务');
    } catch (error) {
      return this.createErrorResult('隐藏计划任务检测失败');
    }
  }

  public async runSSHKeyAudit(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_ssh_key_audit') as any;
      const findings: Finding[] = [];
      (result.unauthorized_keys || []).forEach((k: string) => findings.push({
        title: 'SSH 授权密钥', description: k, severity: 'medium',
        recommendation: '核实每个 SSH 密钥的所有者和用途',
      }));
      (result.weak_keys || []).forEach((k: string) => findings.push({
        title: '弱 SSH 密钥', description: k, severity: 'high',
        recommendation: '替换 DSA 密钥为 Ed25519 或 RSA >= 4096',
      }));
      (result.config_issues || []).forEach((c: string) => findings.push({
        title: 'SSH 配置异常', description: c, severity: 'high',
        recommendation: '检查 sshd_config 中的异常配置',
      }));
      return {
        passed: findings.length === 0,
        score: this.calculateScore(findings),
        severity: findings.length > 0 ? 'high' : 'info',
        findings, duration: 0, timestamp: new Date(), rawOutput: result,
      };
    } catch (error) {
      return this.createErrorResult('SSH 密钥审计失败');
    }
  }

  public async runTimestompCheck(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_timestomp') as any;
      const findings: Finding[] = (result.suspicious_files || []).map((f: string) => ({
        title: '时间戳篡改嫌疑', description: f, severity: 'high' as const,
        recommendation: '文件的 mtime 和 ctime 差异过大，可能被 timestomp 篡改',
      }));
      return {
        passed: findings.length === 0,
        score: this.calculateScore(findings),
        severity: findings.length > 0 ? 'high' : 'info',
        findings, duration: 0, timestamp: new Date(), rawOutput: result,
      };
    } catch (error) {
      return this.createErrorResult('时间戳篡改检测失败');
    }
  }

  public async runEnhancedProcessAnalysis(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_enhanced_process') as any;
      const findings: Finding[] = [];
      (result.suspicious_processes || []).forEach((p: any) => findings.push({
        title: `可疑进程: ${p.name} (PID: ${p.pid})`,
        description: `用户: ${p.user}, CPU: ${p.cpu}%, 命令: ${p.command}`,
        severity: 'high',
        recommendation: '检查该进程是否合法，如不是则立即 kill',
        details: p,
      }));
      (result.high_resource_processes || []).forEach((p: any) => findings.push({
        title: `高资源占用: ${p.name} (PID: ${p.pid})`,
        description: `CPU: ${p.cpu}%, MEM: ${p.mem}%`,
        severity: 'medium',
        recommendation: '检查高资源占用是否正常，可能是挖矿程序',
        details: p,
      }));
      return {
        passed: findings.length === 0,
        score: this.calculateScore(findings),
        severity: findings.some(f => f.severity === 'high') ? 'high' : findings.length > 0 ? 'medium' : 'info',
        findings, duration: 0, timestamp: new Date(), rawOutput: result,
      };
    } catch (error) {
      return this.createErrorResult('增强进程分析失败');
    }
  }

  // ══════ bin/sbin 篡改检测 ══════

  public async runBinTamperScan(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_bin_tamper') as string[];
      const findings: Finding[] = (result || []).map((line: string) => {
        const [path] = line.split(':');
        return {
          title: `命令被篡改: ${path?.trim() || line}`,
          description: `该文件原应为 ELF 二进制，但当前为脚本/文本文件，可能被替换为恶意 wrapper`,
          severity: 'critical' as const,
          recommendation: `检查文件内容: cat ${path?.trim()}，对比原始 md5，用包管理器验证: rpm -Vf ${path?.trim()} 或 dpkg -V`,
        };
      });
      return {
        passed: findings.length === 0,
        score: this.calculateScore(findings),
        severity: findings.length > 0 ? 'critical' : 'info',
        findings, duration: 0, timestamp: new Date(), rawOutput: result,
      };
    } catch (error) {
      return this.createErrorResult('bin/sbin篡改检测失败');
    }
  }

  // ══════ 不可变文件属性检测 ══════

  public async runImmutableFilesScan(): Promise<DetectionResult> {
    try {
      const result = await invoke('detect_immutable_files') as string[];
      const findings: Finding[] = (result || []).map((line: string) => {
        const parts = line.trim().split(/\s+/);
        const attrs = parts[0] || '';
        const filePath = parts.slice(1).join(' ');
        const isImmutable = attrs.includes('i');
        return {
          title: `${isImmutable ? '不可变' : '仅追加'}文件: ${filePath}`,
          description: `属性: ${attrs} — ${isImmutable ? 'immutable(无法修改/删除/重命名)' : 'append-only(只能追加)'}`,
          severity: (filePath.includes('/tmp') || filePath.includes('/var/www') || filePath.includes('/usr/bin')) ? 'high' as const : 'medium' as const,
          recommendation: `移除不可变标志: chattr -i "${filePath}"  移除仅追加: chattr -a "${filePath}"`,
        };
      });
      return {
        passed: findings.length === 0,
        score: this.calculateScore(findings),
        severity: findings.some(f => f.severity === 'high') ? 'high' : findings.length > 0 ? 'medium' : 'info',
        findings, duration: 0, timestamp: new Date(), rawOutput: result,
      };
    } catch (error) {
      return this.createErrorResult('不可变文件检测失败');
    }
  }
}
