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
        const cronList = scanResult.suspicious_cron.slice(0, 2).map((c: any) => {
          const cronStr = typeof c === 'string' ? c : JSON.stringify(c);
          return cronStr.substring(0, 60);
        }).join('; ');
        const more = scanResult.suspicious_cron.length > 2 ? ` 等 ${scanResult.suspicious_cron.length} 个` : '';
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
        const keyList = scanResult.suspicious_ssh_keys.slice(0, 2).map((k: any) => {
          const keyStr = typeof k === 'string' ? k : JSON.stringify(k);
          return keyStr.substring(0, 40) + '...';
        }).join('; ');
        const more = scanResult.suspicious_ssh_keys.length > 2 ? ` 等 ${scanResult.suspicious_ssh_keys.length} 个` : '';
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

    let deduction = 0;
    findings.forEach(finding => {
      switch (finding.severity) {
        case 'critical':
          deduction += SCORING_RULES.CRITICAL_DEDUCTION;
          break;
        case 'high':
          deduction += SCORING_RULES.HIGH_DEDUCTION;
          break;
        case 'medium':
          deduction += SCORING_RULES.MEDIUM_DEDUCTION;
          break;
        case 'low':
          deduction += SCORING_RULES.LOW_DEDUCTION;
          break;
        case 'info':
          deduction += 0;
          break;
      }
    });

    return Math.max(0, 100 - deduction);
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
}
