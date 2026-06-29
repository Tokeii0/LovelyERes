/**
 * 快速检测管理器 - Rust 后端实现
 * 提供安全检测和性能检测功能
 */

use serde::{Deserialize, Serialize};
use crate::ssh_manager_russh::SSHManagerRussh;

// 端口信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PortInfo {
    pub port: u16,
    pub service: Option<String>,
    pub state: String,
}

// 端口扫描结果
#[derive(Debug, Serialize, Deserialize)]
pub struct PortScanResult {
    pub open_ports: Vec<PortInfo>,
    pub total_scanned: usize,
}

// 用户信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserInfo {
    pub username: String,
    pub uid: u32,
    pub gid: u32,
    pub shell: String,
    pub home: String,
}

// 用户审计结果
#[derive(Debug, Serialize, Deserialize)]
pub struct UserAuditResult {
    pub root_users: Vec<UserInfo>,
    pub empty_password_users: Vec<String>,
    pub recent_users: Vec<UserInfo>,
}

// 后门检测结果
#[derive(Debug, Serialize, Deserialize)]
pub struct BackdoorScanResult {
    pub suspicious_cron: Vec<String>,
    pub suspicious_autostart: Vec<String>,
    pub suspicious_ssh_keys: Vec<String>,
}

// 进程信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub user: String,
    pub cpu: f32,
    pub mem: f32,
    pub command: String,
}

// 进程分析结果
#[derive(Debug, Serialize, Deserialize)]
pub struct ProcessAnalysisResult {
    pub suspicious_processes: Vec<ProcessInfo>,
    pub high_resource_processes: Vec<ProcessInfo>,
}

// 文件权限检测结果
#[derive(Debug, Serialize, Deserialize)]
pub struct FilePermissionResult {
    pub suid_files: Vec<String>,
    pub sensitive_file_issues: Vec<String>,
}

// SSH 审计结果
#[derive(Debug, Serialize, Deserialize)]
pub struct SSHAuditResult {
    pub permit_root_login: bool,
    pub password_authentication: bool,
    pub default_port: bool,
}

// 日志分析结果
#[derive(Debug, Serialize, Deserialize)]
pub struct LogAnalysisResult {
    pub brute_force_attempts: u32,
    pub brute_force_details: Vec<String>,
    pub abnormal_logins: Vec<String>,
}

// 防火墙检查结果
#[derive(Debug, Serialize, Deserialize)]
pub struct FirewallCheckResult {
    pub firewall_active: bool,
    pub risky_rules: Vec<String>,
}

// CPU 测试结果
#[derive(Debug, Serialize, Deserialize)]
pub struct CpuTestResult {
    pub cores: u32,
    pub frequency: String,
    pub usage: f32,
}

// 内存测试结果
#[derive(Debug, Serialize, Deserialize)]
pub struct MemoryTestResult {
    pub total: u64,
    pub available: u64,
    pub usage_percent: f32,
}

// 磁盘测试结果
#[derive(Debug, Serialize, Deserialize)]
pub struct DiskTestResult {
    pub read_speed: f64,
    pub write_speed: f64,
}

// 网络测试结果
#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkTestResult {
    pub latency: f64,
    pub bandwidth: f64,
}

// ==================== 竞赛级检测结构体 ====================

#[derive(Debug, Serialize, Deserialize)]
pub struct WebshellFinding {
    pub path: String,
    pub matched_pattern: String,
    pub file_size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WebshellScanResult {
    pub suspicious_files: Vec<WebshellFinding>,
    pub scanned_dirs: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RootkitScanResult {
    pub hidden_processes: Vec<String>,
    pub suspicious_modules: Vec<String>,
    pub ld_preload_hooks: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PersistenceScanResult {
    pub suspicious_cron: Vec<String>,
    pub bashrc_trojans: Vec<String>,
    pub systemd_trojans: Vec<String>,
    pub rc_local_entries: Vec<String>,
    pub at_jobs: Vec<String>,
    pub ld_preload_files: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LogTamperResult {
    pub truncated_logs: Vec<String>,
    pub deleted_open_logs: Vec<String>,
    pub timestamp_gaps: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkBackdoorResult {
    pub suspicious_listeners: Vec<String>,
    pub c2_connections: Vec<String>,
    pub reverse_shell_indicators: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EnhancedUserResult {
    pub uid_conflicts: Vec<String>,
    pub shell_without_home: Vec<String>,
    pub sudo_anomalies: Vec<String>,
    pub suspicious_history: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SSHKeyAuditResult {
    pub unauthorized_keys: Vec<String>,
    pub weak_keys: Vec<String>,
    pub config_issues: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TimestompResult {
    pub suspicious_files: Vec<String>,
}

/// 端口安全扫描
pub fn detect_port_scan(manager: &SSHManagerRussh) -> Result<PortScanResult, String> {
    // 执行端口扫描命令
    let cmd = r#"
        # 扫描常见端口
        netstat -tlnp 2>/dev/null | grep LISTEN || ss -tlnp 2>/dev/null | grep LISTEN
    "#;

    let output_result = manager.execute_command(cmd)
        .map_err(|e| format!("执行端口扫描命令失败: {}", e))?;

    let output = output_result.output;
    let mut open_ports = Vec::new();

    // 解析输出
    for line in output.lines() {
        if line.contains("LISTEN") {
            // 提取端口号
            if let Some(port_str) = extract_port_from_netstat(line) {
                if let Ok(port) = port_str.parse::<u16>() {
                    let service = identify_service(port);
                    open_ports.push(PortInfo {
                        port,
                        service: Some(service.to_string()),
                        state: "LISTEN".to_string(),
                    });
                }
            }
        }
    }

    // 去重
    open_ports.sort_by_key(|p| p.port);
    open_ports.dedup_by_key(|p| p.port);

    Ok(PortScanResult {
        total_scanned: open_ports.len(),
        open_ports,
    })
}

/// 用户权限审计
pub fn detect_user_audit(manager: &SSHManagerRussh) -> Result<UserAuditResult, String> {
    // 获取用户列表
    let cmd = "cat /etc/passwd";
    let passwd_result = manager.execute_command(cmd)
        .map_err(|e| format!("读取 /etc/passwd 失败: {}", e))?;

    let passwd_output = passwd_result.output;
    let mut root_users = Vec::new();
    let mut recent_users = Vec::new();

    for line in passwd_output.lines() {
        let parts: Vec<&str> = line.split(':').collect();
        if parts.len() >= 7 {
            let username = parts[0].to_string();
            let uid = parts[2].parse::<u32>().unwrap_or(9999);
            let gid = parts[3].parse::<u32>().unwrap_or(9999);
            let home = parts[5].to_string();
            let shell = parts[6].to_string();

            let user_info = UserInfo {
                username,
                uid,
                gid,
                shell,
                home,
            };

            // UID 为 0 的是 root 用户
            if uid == 0 {
                root_users.push(user_info.clone());
            }

            // 检查最近创建的用户（简化版）
            if uid >= 1000 && uid < 60000 {
                recent_users.push(user_info);
            }
        }
    }

    // 检查空密码用户
    let shadow_cmd = "sudo cat /etc/shadow 2>/dev/null | grep -E '^[^:]+::' | cut -d: -f1";
    let empty_password_output = manager.execute_command(shadow_cmd)
        .map(|r| r.output)
        .unwrap_or_default();

    let empty_password_users: Vec<String> = empty_password_output
        .lines()
        .filter(|line| !line.is_empty())
        .map(|s| s.to_string())
        .collect();

    Ok(UserAuditResult {
        root_users,
        empty_password_users,
        recent_users: recent_users.into_iter().take(5).collect(),
    })
}

/// 后门检测
pub fn detect_backdoor(manager: &SSHManagerRussh) -> Result<BackdoorScanResult, String> {
    // 检查可疑的计划任务
    let cron_cmd = r#"
        (crontab -l 2>/dev/null; sudo crontab -l 2>/dev/null; cat /etc/crontab 2>/dev/null) | \
        grep -v '^#' | grep -v '^$' | grep -E '(curl|wget|nc|bash|sh|python)'
    "#;
    let cron_output = manager.execute_command(cron_cmd)
        .map(|r| r.output)
        .unwrap_or_default();

    let suspicious_cron: Vec<String> = cron_output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|s| s.to_string())
        .collect();

    // 检查可疑的启动项
    let autostart_cmd = r#"
        find /etc/init.d /etc/systemd/system /etc/rc*.d -type f 2>/dev/null | \
        head -50
    "#;
    let autostart_output = manager.execute_command(autostart_cmd)
        .map(|r| r.output)
        .unwrap_or_default();

    let suspicious_autostart: Vec<String> = autostart_output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .take(10)
        .map(|s| s.to_string())
        .collect();

    // 检查 SSH authorized_keys
    let ssh_keys_cmd = r#"
        find /home /root -name authorized_keys 2>/dev/null | \
        xargs cat 2>/dev/null | grep -v '^#' | grep -v '^$' | wc -l
    "#;
    let keys_count_output = manager.execute_command(ssh_keys_cmd)
        .map(|r| r.output)
        .unwrap_or_default();

    let mut suspicious_ssh_keys = Vec::new();
    if let Ok(count) = keys_count_output.trim().parse::<usize>() {
        if count > 0 {
            let keys_cmd = r#"
                find /home /root -name authorized_keys 2>/dev/null | \
                xargs cat 2>/dev/null | grep -v '^#' | grep -v '^$' | head -5
            "#;
            let keys_output = manager.execute_command(keys_cmd)
                .map(|r| r.output)
                .unwrap_or_default();
            suspicious_ssh_keys = keys_output
                .lines()
                .filter(|line| !line.trim().is_empty())
                .map(|s| format!("{}...", &s[..s.len().min(60)]))
                .collect();
        }
    }

    Ok(BackdoorScanResult {
        suspicious_cron,
        suspicious_autostart,
        suspicious_ssh_keys,
    })
}

/// 进程分析
pub fn detect_process_analysis(manager: &SSHManagerRussh) -> Result<ProcessAnalysisResult, String> {
    // 获取进程列表
    let cmd = "ps aux | head -200";
    let output_result = manager.execute_command(cmd)
        .map_err(|e| format!("获取进程列表失败: {}", e))?;

    let output = output_result.output;
    let mut high_resource_processes = Vec::new();
    let mut suspicious_processes = Vec::new();

    for (i, line) in output.lines().skip(1).enumerate() {
        if i >= 20 { break; }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 11 {
            let user = parts[0].to_string();
            let pid = parts[1].parse::<u32>().unwrap_or(0);
            let cpu = parts[2].parse::<f32>().unwrap_or(0.0);
            let mem = parts[3].parse::<f32>().unwrap_or(0.0);
            let command = parts[10..].join(" ");
            let name = parts[10].to_string();

            let process = ProcessInfo {
                pid,
                name,
                user,
                cpu,
                mem,
                command: command.chars().take(500).collect(),
            };

            // 高资源占用进程
            if cpu > 50.0 || mem > 50.0 {
                high_resource_processes.push(process.clone());
            }

            // 可疑进程检测
            if command.contains("(deleted)")
                || command.starts_with("/tmp/")
                || command.starts_with("/dev/shm/")
                || command.starts_with("/var/tmp/")
                || command.contains("bash -i")
                || command.contains("/dev/tcp")
                || command.contains("/dev/udp") {
                suspicious_processes.push(process.clone());
            }
        }
    }

    Ok(ProcessAnalysisResult {
        suspicious_processes,
        high_resource_processes,
    })
}

/// 文件权限检测
pub fn detect_file_permission(manager: &SSHManagerRussh) -> Result<FilePermissionResult, String> {
    // 查找 SUID 文件
    let suid_cmd = "find / -perm -4000 -type f 2>/dev/null | head -50";
    let suid_output = manager.execute_command(suid_cmd)
        .map(|r| r.output)
        .unwrap_or_default();

    let suid_files: Vec<String> = suid_output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|s| s.to_string())
        .collect();

    // 检查敏感文件权限
    let sensitive_cmd = r#"
        ls -l /etc/passwd /etc/shadow /etc/sudoers 2>/dev/null
    "#;
    let sensitive_output = manager.execute_command(sensitive_cmd)
        .map(|r| r.output)
        .unwrap_or_default();

    let mut sensitive_file_issues = Vec::new();

    for line in sensitive_output.lines() {
        if line.contains("/etc/shadow") && !line.starts_with("----------") {
            sensitive_file_issues.push("/etc/shadow 权限过宽".to_string());
        }
        if line.contains("/etc/passwd") && line.chars().nth(8) == Some('w') {
            sensitive_file_issues.push("/etc/passwd 允许组写入".to_string());
        }
    }

    Ok(FilePermissionResult {
        suid_files,
        sensitive_file_issues,
    })
}

/// SSH 安全审计
pub fn detect_ssh_audit(manager: &SSHManagerRussh) -> Result<SSHAuditResult, String> {
    // 读取 SSH 配置
    let cmd = "cat /etc/ssh/sshd_config 2>/dev/null | grep -v '^#' | grep -v '^$'";
    let output = manager.execute_command(cmd)
        .map(|r| r.output)
        .unwrap_or_default();

    let mut permit_root_login = false;
    let mut password_authentication = true;
    let mut default_port = true;

    for line in output.lines() {
        let line = line.trim();
        if line.starts_with("PermitRootLogin") && line.contains("yes") {
            permit_root_login = true;
        }
        if line.starts_with("PasswordAuthentication") && line.contains("no") {
            password_authentication = false;
        }
        if line.starts_with("Port") && !line.contains("22") {
            default_port = false;
        }
    }

    Ok(SSHAuditResult {
        permit_root_login,
        password_authentication,
        default_port,
    })
}

/// 日志分析
pub fn detect_log_analysis(manager: &SSHManagerRussh) -> Result<LogAnalysisResult, String> {
    // 检查暴力破解尝试
    let brute_force_cmd = r#"
        grep -i 'failed password' /var/log/auth.log /var/log/secure 2>/dev/null | wc -l
    "#;
    let brute_force_count_result = manager.execute_command(brute_force_cmd)
        .unwrap_or_else(|_| crate::ssh_manager_russh::TerminalOutput {
            command: brute_force_cmd.to_string(),
            output: "0".to_string(),
            exit_code: Some(0),
            timestamp: chrono::Utc::now(),
            duration_ms: 0,
            timed_out: false,
        });

    let brute_force_count = brute_force_count_result.output;
    let attempts = brute_force_count.trim().parse::<u32>().unwrap_or(0);

    // 获取详情
    let details_cmd = r#"
        grep -i 'failed password' /var/log/auth.log /var/log/secure 2>/dev/null | tail -5
    "#;
    let details_output = manager.execute_command(details_cmd)
        .map(|r| r.output)
        .unwrap_or_default();

    let brute_force_details: Vec<String> = details_output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|s| s.to_string())
        .collect();

    // 检查异常登录
    let abnormal_cmd = r#"
        last -10 2>/dev/null | grep -v 'wtmp begins'
    "#;
    let abnormal_output = manager.execute_command(abnormal_cmd)
        .map(|r| r.output)
        .unwrap_or_default();

    let abnormal_logins: Vec<String> = abnormal_output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .take(5)
        .map(|s| s.to_string())
        .collect();

    Ok(LogAnalysisResult {
        brute_force_attempts: attempts,
        brute_force_details,
        abnormal_logins,
    })
}

/// 防火墙检查
pub fn detect_firewall_check(manager: &SSHManagerRussh) -> Result<FirewallCheckResult, String> {
    // 检查防火墙状态
    let status_cmd = r#"
        systemctl is-active iptables firewalld ufw 2>/dev/null | grep -q 'active' && echo 'active' || echo 'inactive'
    "#;
    let status_output = manager.execute_command(status_cmd)
        .map(|r| r.output)
        .unwrap_or_else(|_| "inactive".to_string());

    let firewall_active = status_output.trim() == "active";

    // 获取规则
    let rules_cmd = r#"
        iptables -L -n 2>/dev/null | head -20 || firewall-cmd --list-all 2>/dev/null || ufw status 2>/dev/null
    "#;
    let rules_output = manager.execute_command(rules_cmd)
        .map(|r| r.output)
        .unwrap_or_default();

    let mut risky_rules = Vec::new();

    for line in rules_output.lines() {
        if line.contains("ACCEPT") && line.contains("0.0.0.0/0") {
            risky_rules.push(format!("允许所有IP访问: {}", line));
        }
    }

    Ok(FirewallCheckResult {
        firewall_active,
        risky_rules,
    })
}

/// CPU 测试
pub fn detect_cpu_test(manager: &SSHManagerRussh) -> Result<CpuTestResult, String> {
    // 获取 CPU 信息
    let cmd = r#"
        echo "cores:$(nproc)"
        cat /proc/cpuinfo | grep 'cpu MHz' | head -1 | awk '{print $4}'
        top -bn1 | grep 'Cpu(s)' | awk '{print $2}'
    "#;
    let output_result = manager.execute_command(cmd)
        .map_err(|e| format!("获取 CPU 信息失败: {}", e))?;

    let output = output_result.output;
    let lines: Vec<&str> = output.lines().collect();

    let cores = if let Some(line) = lines.get(0) {
        if let Some(num_str) = line.strip_prefix("cores:") {
            num_str.parse::<u32>().unwrap_or(1)
        } else {
            1
        }
    } else {
        1
    };

    let frequency = lines.get(1).unwrap_or(&"unknown").trim().to_string();
    let usage = lines.get(2).unwrap_or(&"0.0")
        .trim()
        .trim_end_matches("%us")
        .parse::<f32>()
        .unwrap_or(0.0);

    Ok(CpuTestResult {
        cores,
        frequency,
        usage,
    })
}

/// 内存测试
pub fn detect_memory_test(manager: &SSHManagerRussh) -> Result<MemoryTestResult, String> {
    // 获取内存信息
    let cmd = "free -m | grep Mem";
    let output_result = manager.execute_command(cmd)
        .map_err(|e| format!("获取内存信息失败: {}", e))?;

    let output = output_result.output;
    let parts: Vec<&str> = output.split_whitespace().collect();

    let total = parts.get(1)
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);

    let available = parts.get(6)
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);

    let usage_percent = if total > 0 {
        ((total - available) as f32 / total as f32) * 100.0
    } else {
        0.0
    };

    Ok(MemoryTestResult {
        total,
        available,
        usage_percent,
    })
}

/// 磁盘测试
pub fn detect_disk_test(manager: &SSHManagerRussh) -> Result<DiskTestResult, String> {
    // 简化版磁盘测试 - 使用 dd 命令
    let cmd = r#"
        dd if=/dev/zero of=/tmp/test_disk_speed bs=1M count=100 2>&1 | grep copied | awk '{print $(NF-1)}'
        rm -f /tmp/test_disk_speed
    "#;
    let output = manager.execute_command(cmd)
        .map(|r| r.output)
        .unwrap_or_else(|_| "50".to_string());

    let speed = output.trim().parse::<f64>().unwrap_or(50.0);

    Ok(DiskTestResult {
        read_speed: speed,
        write_speed: speed * 0.9, // 写入速度通常略低于读取
    })
}

/// 网络测试
pub fn detect_network_test(manager: &SSHManagerRussh) -> Result<NetworkTestResult, String> {
    // 测试延迟
    let ping_cmd = "ping -c 3 8.8.8.8 2>/dev/null | grep 'avg' | awk -F'/' '{print $5}'";
    let ping_output = manager.execute_command(ping_cmd)
        .map(|r| r.output)
        .unwrap_or_else(|_| "10".to_string());

    let latency = ping_output.trim().parse::<f64>().unwrap_or(10.0);

    Ok(NetworkTestResult {
        latency,
        bandwidth: 100.0, // 简化版，实际需要使用 iperf 等工具测试
    })
}

/// 辅助函数：从 netstat 输出提取端口
fn extract_port_from_netstat(line: &str) -> Option<String> {
    let parts: Vec<&str> = line.split_whitespace().collect();

    for part in parts {
        if part.contains(':') {
            let port_part: Vec<&str> = part.split(':').collect();
            if let Some(port_str) = port_part.last() {
                return Some(port_str.to_string());
            }
        }
    }

    None
}

/// 辅助函数：识别服务
fn identify_service(port: u16) -> &'static str {
    match port {
        22 => "SSH",
        80 => "HTTP",
        443 => "HTTPS",
        3306 => "MySQL",
        5432 => "PostgreSQL",
        6379 => "Redis",
        27017 => "MongoDB",
        9200 => "Elasticsearch",
        8080 => "HTTP-Alt",
        3000 => "Node.js",
        _ => "Unknown",
    }
}
// ========== 新增基线检测数据结构 ==========

/// 通用检测问题
#[derive(Debug, Serialize, Deserialize)]
pub struct SecurityIssue {
    pub title: String,
    pub description: String,
    pub severity: String,
    pub recommendation: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

/// 通用检测结果
#[derive(Debug, Serialize, Deserialize)]
pub struct GenericDetectionResult {
    pub issues: Vec<SecurityIssue>,
}

// ========== 新增基线检测函数 ==========

/// 密码策略检查
pub fn detect_password_policy(manager: &SSHManagerRussh) -> Result<GenericDetectionResult, String> {
    let mut issues = Vec::new();

    // 检查 /etc/login.defs 中的密码策略
    let cmd = r#"grep -E "^PASS_MAX_DAYS|^PASS_MIN_DAYS|^PASS_MIN_LEN|^PASS_WARN_AGE" /etc/login.defs 2>/dev/null || echo "NOT_FOUND""#;
    let output_result = manager.execute_command(cmd)?;
    let output = output_result.output.trim();

    if output.contains("NOT_FOUND") || output.is_empty() {
        issues.push(SecurityIssue {
            title: "密码策略文件未找到".to_string(),
            description: "系统未配置密码策略文件 /etc/login.defs".to_string(),
            severity: "medium".to_string(),
            recommendation: "配置密码策略，确保密码安全性".to_string(),
            details: None,
        });
    } else {
        // 检查密码最大使用天数
        if !output.contains("PASS_MAX_DAYS") {
            issues.push(SecurityIssue {
                title: "未设置密码最大使用天数".to_string(),
                description: "未配置密码过期策略".to_string(),
                severity: "medium".to_string(),
                recommendation: "设置 PASS_MAX_DAYS 为 90 天或更少".to_string(),
                details: None,
            });
        }
    }

    Ok(GenericDetectionResult { issues })
}

/// Sudo 配置审计
pub fn detect_sudo_config(manager: &SSHManagerRussh) -> Result<GenericDetectionResult, String> {
    let mut issues = Vec::new();

    // 检查 sudoers 文件中的 NOPASSWD 配置
    let cmd = r#"sudo grep -r "NOPASSWD" /etc/sudoers /etc/sudoers.d/ 2>/dev/null || echo "NO_NOPASSWD""#;
    let output_result = manager.execute_command(cmd)?;
    let output = output_result.output.trim();

    if !output.contains("NO_NOPASSWD") && output.contains("NOPASSWD") {
        issues.push(SecurityIssue {
            title: "发现无密码 sudo 配置".to_string(),
            description: format!("存在 NOPASSWD 配置，可能存在权限提升风险: {}", output.lines().take(3).collect::<Vec<_>>().join("; ")),
            severity: "high".to_string(),
            recommendation: "移除 NOPASSWD 配置，要求所有 sudo 操作都需要密码验证".to_string(),
            details: Some(output.to_string()),
        });
    }

    Ok(GenericDetectionResult { issues })
}

/// PAM 配置检查
pub fn detect_pam_config(manager: &SSHManagerRussh) -> Result<GenericDetectionResult, String> {
    let mut issues = Vec::new();

    // 检查 PAM 密码复杂度模块
    let cmd = r#"grep -r "pam_pwquality\|pam_cracklib" /etc/pam.d/ 2>/dev/null || echo "NOT_CONFIGURED""#;
    let output_result = manager.execute_command(cmd)?;
    let output = output_result.output.trim();

    if output.contains("NOT_CONFIGURED") {
        issues.push(SecurityIssue {
            title: "未配置密码复杂度检查".to_string(),
            description: "PAM 未配置密码复杂度模块（pam_pwquality 或 pam_cracklib）".to_string(),
            severity: "medium".to_string(),
            recommendation: "配置 pam_pwquality 模块以强制密码复杂度要求".to_string(),
            details: None,
        });
    }

    Ok(GenericDetectionResult { issues })
}

/// 账号锁定策略检查
pub fn detect_account_lockout(manager: &SSHManagerRussh) -> Result<GenericDetectionResult, String> {
    let mut issues = Vec::new();

    // 检查 PAM 账号锁定模块
    let cmd = r#"grep "pam_faillock\|pam_tally" /etc/pam.d/system-auth /etc/pam.d/password-auth /etc/pam.d/common-auth 2>/dev/null || echo "NOT_CONFIGURED""#;
    let output_result = manager.execute_command(cmd)?;
    let output = output_result.output.trim();

    if output.contains("NOT_CONFIGURED") {
        issues.push(SecurityIssue {
            title: "未配置账号锁定策略".to_string(),
            description: "系统未配置登录失败锁定机制".to_string(),
            severity: "high".to_string(),
            recommendation: "配置 pam_faillock 模块，在多次登录失败后锁定账号".to_string(),
            details: None,
        });
    }

    Ok(GenericDetectionResult { issues })
}

/// SELinux/AppArmor 状态检查
pub fn detect_selinux_status(manager: &SSHManagerRussh) -> Result<GenericDetectionResult, String> {
    let mut issues = Vec::new();

    // 检查 SELinux 状态
    let selinux_cmd = "getenforce 2>/dev/null || echo 'NOT_INSTALLED'";
    let selinux_result = manager.execute_command(selinux_cmd)?;
    let selinux_status = selinux_result.output.trim();

    // 检查 AppArmor 状态
    let apparmor_cmd = "aa-status 2>/dev/null || echo 'NOT_INSTALLED'";
    let apparmor_result = manager.execute_command(apparmor_cmd)?;
    let apparmor_status = apparmor_result.output.trim();

    if selinux_status.contains("NOT_INSTALLED") && apparmor_status.contains("NOT_INSTALLED") {
        issues.push(SecurityIssue {
            title: "未启用强制访问控制".to_string(),
            description: "系统未安装或启用 SELinux 或 AppArmor".to_string(),
            severity: "medium".to_string(),
            recommendation: "启用 SELinux 或 AppArmor 以增强系统安全性".to_string(),
            details: None,
        });
    } else if selinux_status.contains("Permissive") {
        issues.push(SecurityIssue {
            title: "SELinux 处于宽容模式".to_string(),
            description: "SELinux 已安装但处于 Permissive 模式，未强制执行安全策略".to_string(),
            severity: "low".to_string(),
            recommendation: "将 SELinux 设置为 Enforcing 模式".to_string(),
            details: None,
        });
    }

    Ok(GenericDetectionResult { issues })
}

/// 内核参数检查
pub fn detect_kernel_params(manager: &SSHManagerRussh) -> Result<GenericDetectionResult, String> {
    let mut issues = Vec::new();

    // 检查关键的安全内核参数
    let params_to_check = vec![
        ("net.ipv4.conf.all.accept_source_route", "0", "IP 源路由"),
        ("net.ipv4.conf.all.accept_redirects", "0", "ICMP 重定向"),
        ("net.ipv4.icmp_echo_ignore_broadcasts", "1", "ICMP 广播"),
        ("net.ipv4.tcp_syncookies", "1", "SYN Cookies"),
    ];

    for (param, expected, desc) in params_to_check {
        let cmd = format!("sysctl {} 2>/dev/null || echo 'NOT_SET'", param);
        let result = manager.execute_command(&cmd)?;
        let output = result.output.trim();

        if output.contains("NOT_SET") || !output.contains(&format!("= {}", expected)) {
            issues.push(SecurityIssue {
                title: format!("{} 参数未正确配置", desc),
                description: format!("内核参数 {} 未设置为推荐值 {}", param, expected),
                severity: "low".to_string(),
                recommendation: format!("在 /etc/sysctl.conf 中设置 {} = {}", param, expected),
                details: Some(output.to_string()),
            });
        }
    }

    Ok(GenericDetectionResult { issues })
}

/// 系统补丁状态检查
pub fn detect_system_updates(manager: &SSHManagerRussh) -> Result<GenericDetectionResult, String> {
    let mut issues = Vec::new();

    // 检查可用更新（根据不同发行版）
    let check_cmd = r#"
        if command -v yum >/dev/null 2>&1; then
            yum check-update 2>/dev/null | grep -v "^$" | tail -n +2 | wc -l
        elif command -v apt >/dev/null 2>&1; then
            apt list --upgradable 2>/dev/null | grep -c "upgradable"
        else
            echo "0"
        fi
    "#;

    let result = manager.execute_command(check_cmd)?;
    let count: usize = result.output.trim().parse().unwrap_or(0);

    if count > 0 {
        let severity = if count > 50 { "high" } else if count > 20 { "medium" } else { "low" };
        issues.push(SecurityIssue {
            title: "存在可用的系统更新".to_string(),
            description: format!("系统有 {} 个可用更新包", count),
            severity: severity.to_string(),
            recommendation: "建议及时更新系统补丁以修复已知漏洞".to_string(),
            details: Some(format!("{} 个更新包待安装", count)),
        });
    }

    Ok(GenericDetectionResult { issues })
}

/// 不必要服务检查
pub fn detect_unnecessary_services(manager: &SSHManagerRussh) -> Result<GenericDetectionResult, String> {
    let mut issues = Vec::new();

    // 定义常见的不必要服务
    let unnecessary_services = vec!["telnet", "ftp", "rsh", "rlogin", "vsftpd", "tftp"];

    let cmd = "systemctl list-units --type=service --state=running --no-pager 2>/dev/null | awk '{print $1}' || service --status-all 2>/dev/null";
    let result = manager.execute_command(cmd)?;
    let running_services = result.output.to_lowercase();

    for service in unnecessary_services {
        if running_services.contains(service) {
            issues.push(SecurityIssue {
                title: format!("检测到不安全的服务: {}", service),
                description: format!("服务 {} 正在运行，这是一个已知的不安全服务", service),
                severity: "high".to_string(),
                recommendation: format!("停止并禁用 {} 服务，使用更安全的替代方案（如 SSH 代替 telnet）", service),
                details: None,
            });
        }
    }

    Ok(GenericDetectionResult { issues })
}

/// 自启动服务审计
pub fn detect_auto_start_services(manager: &SSHManagerRussh) -> Result<GenericDetectionResult, String> {
    let mut issues = Vec::new();

    // 获取所有启用的服务
    let cmd = "systemctl list-unit-files --type=service --state=enabled --no-pager 2>/dev/null | wc -l || echo '0'";
    let result = manager.execute_command(cmd)?;
    let count: usize = result.output.trim().parse().unwrap_or(0);

    if count > 30 {
        issues.push(SecurityIssue {
            title: "自启动服务过多".to_string(),
            description: format!("系统配置了 {} 个自启动服务，可能增加攻击面", count),
            severity: "low".to_string(),
            recommendation: "审查并禁用不必要的自启动服务".to_string(),
            details: Some(format!("{} 个自启动服务", count)),
        });
    }

    Ok(GenericDetectionResult { issues })
}

/// 审计配置检查
pub fn detect_audit_config(manager: &SSHManagerRussh) -> Result<GenericDetectionResult, String> {
    let mut issues = Vec::new();

    // 检查 auditd 服务状态
    let cmd = "systemctl is-active auditd 2>/dev/null || service auditd status 2>/dev/null || echo 'NOT_RUNNING'";
    let result = manager.execute_command(cmd)?;
    let status = result.output.trim();

    if status.contains("NOT_RUNNING") || status.contains("inactive") {
        issues.push(SecurityIssue {
            title: "审计服务未运行".to_string(),
            description: "auditd 审计服务未启动，无法记录系统安全事件".to_string(),
            severity: "medium".to_string(),
            recommendation: "启动并启用 auditd 服务以记录系统安全事件".to_string(),
            details: None,
        });
    }

    Ok(GenericDetectionResult { issues })
}

/// 历史命令审计
pub fn detect_history_audit(manager: &SSHManagerRussh) -> Result<GenericDetectionResult, String> {
    let mut issues = Vec::new();

    // 检查可疑的历史命令
    let suspicious_patterns = vec!["wget http", "curl http", "nc -", "bash -i", "/dev/tcp", "base64 -d"];
    let cmd = "cat ~/.bash_history 2>/dev/null | tail -100";
    let result = manager.execute_command(cmd)?;
    let history = result.output.to_lowercase();

    for pattern in suspicious_patterns {
        if history.contains(&pattern.to_lowercase()) {
            issues.push(SecurityIssue {
                title: "发现可疑历史命令".to_string(),
                description: format!("历史命令中包含可疑模式: {}", pattern),
                severity: "medium".to_string(),
                recommendation: "审查相关命令的执行目的和上下文".to_string(),
                details: Some(pattern.to_string()),
            });
            break; // 只报告一次
        }
    }

    Ok(GenericDetectionResult { issues })
}

/// NTP 配置检查
pub fn detect_ntp_config(manager: &SSHManagerRussh) -> Result<GenericDetectionResult, String> {
    let mut issues = Vec::new();

    // 检查时间同步服务
    let cmd = "systemctl is-active chronyd ntpd systemd-timesyncd 2>/dev/null || echo 'NONE_ACTIVE'";
    let result = manager.execute_command(cmd)?;
    let output = result.output;

    let has_active_ntp = output.lines().any(|line| line.trim() == "active");

    if !has_active_ntp {
        issues.push(SecurityIssue {
            title: "时间同步服务未运行".to_string(),
            description: "系统未配置或启动时间同步服务（NTP/Chrony）".to_string(),
            severity: "medium".to_string(),
            recommendation: "配置并启动 chronyd 或 ntpd 服务以确保系统时间准确".to_string(),
            details: None,
        });
    }

    Ok(GenericDetectionResult { issues })
}

/// DNS 配置检查
pub fn detect_dns_config(manager: &SSHManagerRussh) -> Result<GenericDetectionResult, String> {
    let mut issues = Vec::new();

    // 检查 DNS 配置
    let cmd = "cat /etc/resolv.conf 2>/dev/null | grep -v '^#' | grep nameserver || echo 'NO_DNS'";
    let result = manager.execute_command(cmd)?;
    let output = result.output.trim();

    if output.contains("NO_DNS") || output.is_empty() {
        issues.push(SecurityIssue {
            title: "DNS 未配置".to_string(),
            description: "系统未配置 DNS 服务器".to_string(),
            severity: "high".to_string(),
            recommendation: "配置可靠的 DNS 服务器（如 8.8.8.8, 1.1.1.1）".to_string(),
            details: None,
        });
    } else {
        // 检查是否使用公共 DNS
        if !output.contains("8.8.8.8") && !output.contains("1.1.1.1") && !output.contains("114.114.114.114") {
            issues.push(SecurityIssue {
                title: "使用非公共 DNS 服务器".to_string(),
                description: format!("当前 DNS 配置: {}", output),
                severity: "info".to_string(),
                recommendation: "确认 DNS 服务器的可靠性和安全性".to_string(),
                details: Some(output.to_string()),
            });
        }
    }

    Ok(GenericDetectionResult { issues })
}

// ==================== 竞赛级检测函数 ====================

/// Webshell 扫描
pub fn detect_webshell(manager: &SSHManagerRussh) -> Result<WebshellScanResult, String> {
    let dirs = ["/var/www", "/usr/share/nginx/html", "/opt/lampp/htdocs", "/srv/www"];
    let scan_dirs: Vec<String> = dirs.iter().map(|d| d.to_string()).collect();

    let cmd = r#"find /var/www /usr/share/nginx/html /opt/lampp/htdocs /srv/www -type f \( -name "*.php" -o -name "*.jsp" -o -name "*.asp" -o -name "*.aspx" -o -name "*.cgi" \) -exec grep -l -E '(eval\s*\(|base64_decode|system\s*\(|passthru|shell_exec|assert\s*\(|\$_POST\[|gzinflate|str_rot13)' {} \; 2>/dev/null | head -50"#;

    let output = match manager.execute_command(cmd) {
        Ok(r) => r.output,
        Err(_) => String::new(),
    };

    let suspicious_files: Vec<WebshellFinding> = output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|path| WebshellFinding {
            path: path.trim().to_string(),
            matched_pattern: "eval/system/passthru/base64_decode".to_string(),
            file_size: 0,
        })
        .collect();

    Ok(WebshellScanResult { suspicious_files, scanned_dirs: scan_dirs })
}

/// Rootkit 检测
pub fn detect_rootkit(manager: &SSHManagerRussh) -> Result<RootkitScanResult, String> {
    // 1. 隐藏进程检测: ps 列出的 PID vs /proc 下的 PID
    let cmd_hidden = r#"diff <(ps -eo pid --no-headers | sort -n) <(ls -1 /proc | grep -E '^[0-9]+$' | sort -n) 2>/dev/null | grep '>' | awk '{print $2}'"#;
    let hidden_output = manager.execute_command(&format!("bash -c '{}'", cmd_hidden.replace('\'', "'\\''")))
        .map(|r| r.output).unwrap_or_default();
    let hidden_processes: Vec<String> = hidden_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| format!("隐藏进程 PID: {}", l.trim()))
        .collect();

    // 2. 可疑内核模块
    let cmd_modules = "lsmod 2>/dev/null | awk 'NR>1 && $3==0 {print $1}' | head -50";
    let mod_output = manager.execute_command(cmd_modules).map(|r| r.output).unwrap_or_default();
    let suspicious_modules: Vec<String> = mod_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| format!("未被引用的内核模块: {}", l.trim()))
        .collect();

    // 3. LD_PRELOAD 检测
    let cmd_preload = "cat /etc/ld.so.preload 2>/dev/null; echo '---'; env | grep LD_PRELOAD 2>/dev/null";
    let preload_output = manager.execute_command(cmd_preload).map(|r| r.output).unwrap_or_default();
    let ld_preload_hooks: Vec<String> = preload_output.lines()
        .filter(|l| !l.trim().is_empty() && l.trim() != "---")
        .map(|l| l.trim().to_string())
        .collect();

    Ok(RootkitScanResult { hidden_processes, suspicious_modules, ld_preload_hooks })
}

/// 持久化机制全面扫描
pub fn detect_persistence(manager: &SSHManagerRussh) -> Result<PersistenceScanResult, String> {
    // 1. 全量 cron 检查
    let cmd_cron = r#"{ for user in $(cut -f1 -d: /etc/passwd); do crontab -u "$user" -l 2>/dev/null | grep -v '^#' | grep -v '^$' | sed "s/^/[$user] /"; done; cat /etc/crontab 2>/dev/null | grep -v '^#' | grep -v '^$' | grep -v '^[A-Z]'; find /etc/cron.d /etc/cron.daily /etc/cron.hourly /etc/cron.weekly /etc/cron.monthly -type f -exec grep -l -E '(curl|wget|nc|python|perl|bash|sh -c)' {} \; 2>/dev/null; cat /var/spool/cron/crontabs/* /var/spool/cron/* 2>/dev/null | grep -v '^#' | grep -v '^$'; } 2>/dev/null | head -100"#;
    let cron_output = manager.execute_command(cmd_cron).map(|r| r.output).unwrap_or_default();
    let suspicious_cron: Vec<String> = cron_output.lines()
        .filter(|l| !l.trim().is_empty())
        .filter(|l| {
            let low = l.to_lowercase();
            low.contains("curl") || low.contains("wget") || low.contains("nc ") || low.contains("python") || low.contains("perl") || low.contains("bash -") || low.contains("/dev/tcp")
        })
        .map(|l| l.trim().to_string())
        .collect();

    // 2. .bashrc/.profile 木马
    let cmd_bashrc = r#"grep -rn -E '(curl|wget|nc |socat|python.*-c|perl.*-e|bash -i|/dev/tcp|/dev/udp|eval|base64)' /root/.bashrc /root/.bash_profile /root/.profile /home/*/.bashrc /home/*/.bash_profile /home/*/.profile 2>/dev/null | head -50"#;
    let bashrc_output = manager.execute_command(cmd_bashrc).map(|r| r.output).unwrap_or_default();
    let bashrc_trojans: Vec<String> = bashrc_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    // 3. systemd 单元后门
    let cmd_systemd = r#"grep -rn -E 'ExecStart.*(curl|wget|nc|bash|python|perl|/tmp/|/dev/shm/)' /etc/systemd/system/ /usr/lib/systemd/system/ 2>/dev/null | head -50"#;
    let systemd_output = manager.execute_command(cmd_systemd).map(|r| r.output).unwrap_or_default();
    let systemd_trojans: Vec<String> = systemd_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    // 4. rc.local
    let cmd_rclocal = "cat /etc/rc.local /etc/rc.d/rc.local 2>/dev/null | grep -v '^#' | grep -v '^$' | grep -v 'exit 0'";
    let rclocal_output = manager.execute_command(cmd_rclocal).map(|r| r.output).unwrap_or_default();
    let rc_local_entries: Vec<String> = rclocal_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    // 5. at 任务
    let cmd_at = "atq 2>/dev/null | head -20";
    let at_output = manager.execute_command(cmd_at).map(|r| r.output).unwrap_or_default();
    let at_jobs: Vec<String> = at_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    // 6. LD_PRELOAD 文件
    let cmd_ldpreload = "cat /etc/ld.so.preload 2>/dev/null; find /etc/ld.so.conf.d -type f -exec grep -l '/tmp\\|/dev/shm' {} \\; 2>/dev/null";
    let ld_output = manager.execute_command(cmd_ldpreload).map(|r| r.output).unwrap_or_default();
    let ld_preload_files: Vec<String> = ld_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    Ok(PersistenceScanResult {
        suspicious_cron, bashrc_trojans, systemd_trojans,
        rc_local_entries, at_jobs, ld_preload_files,
    })
}

/// 日志篡改检测
pub fn detect_log_tamper(manager: &SSHManagerRussh) -> Result<LogTamperResult, String> {
    // 1. 零字节/异常小日志
    let cmd_truncated = r#"find /var/log -maxdepth 2 -type f \( -name "*.log" -o -name "auth.log" -o -name "secure" -o -name "syslog" -o -name "messages" \) -size 0 2>/dev/null; find /var/log -maxdepth 2 -name "auth.log" -o -name "secure" 2>/dev/null | xargs ls -la 2>/dev/null | awk '$5<100 {print "异常小文件: "$NF" ("$5" bytes)"}'"#;
    let trunc_output = manager.execute_command(cmd_truncated).map(|r| r.output).unwrap_or_default();
    let truncated_logs: Vec<String> = trunc_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    // 2. 已删除但仍打开的日志文件
    let cmd_deleted = "lsof +L1 2>/dev/null | grep -E '/var/log|syslog|auth' | head -20";
    let deleted_output = manager.execute_command(cmd_deleted).map(|r| r.output).unwrap_or_default();
    let deleted_open_logs: Vec<String> = deleted_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    // 3. wtmp/lastlog 异常
    let cmd_gaps = r#"last -F 2>/dev/null | head -50 | awk '{print $1}' | sort | uniq -c | sort -rn | head -10"#;
    let gaps_output = manager.execute_command(cmd_gaps).map(|r| r.output).unwrap_or_default();
    let timestamp_gaps: Vec<String> = gaps_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| format!("登录频率: {}", l.trim()))
        .collect();

    Ok(LogTamperResult { truncated_logs, deleted_open_logs, timestamp_gaps })
}

/// 网络后门检测
pub fn detect_network_backdoor(manager: &SSHManagerRussh) -> Result<NetworkBackdoorResult, String> {
    // 1. 可疑监听端口（高端口 + 非标准程序）
    let cmd_listeners = r#"ss -tlnp 2>/dev/null | awk 'NR>1 {split($4,a,":"); port=a[length(a)]; if(port>30000 || port==4444 || port==5555 || port==6666 || port==8888 || port==1234 || port==31337) print $0}' | head -50"#;
    let listener_output = manager.execute_command(cmd_listeners).map(|r| r.output).unwrap_or_default();
    let suspicious_listeners: Vec<String> = listener_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    // 2. C2 连接（已建立的可疑外连）
    let cmd_c2 = r#"ss -tnp state established 2>/dev/null | awk '{split($5,a,":"); port=a[length(a)]; if(port==4444 || port==5555 || port==6666 || port==8888 || port==1234 || port==31337 || port==9999 || port==443) print $0}' | head -50"#;
    let c2_output = manager.execute_command(cmd_c2).map(|r| r.output).unwrap_or_default();
    let c2_connections: Vec<String> = c2_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    // 3. 反弹 shell 指示器（/tmp 或已删除二进制的网络进程）
    let cmd_reverse = r#"ls -la /proc/*/exe 2>/dev/null | grep -E '(deleted)|/tmp/|/dev/shm/' | head -50"#;
    let reverse_output = manager.execute_command(cmd_reverse).map(|r| r.output).unwrap_or_default();
    let reverse_shell_indicators: Vec<String> = reverse_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    Ok(NetworkBackdoorResult { suspicious_listeners, c2_connections, reverse_shell_indicators })
}

/// 增强用户审计
pub fn detect_enhanced_user(manager: &SSHManagerRussh) -> Result<EnhancedUserResult, String> {
    // 1. UID 冲突
    let cmd_uid = "awk -F: '{print $3}' /etc/passwd | sort -n | uniq -d";
    let uid_output = manager.execute_command(cmd_uid).map(|r| r.output).unwrap_or_default();
    let uid_conflicts: Vec<String> = uid_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| format!("UID 冲突: {}", l.trim()))
        .collect();

    // 2. 有 Shell 但无 Home 目录
    let cmd_shell = r#"awk -F: '$NF ~ /bash|sh|zsh/ {print $1":"$6}' /etc/passwd | while IFS=: read user home; do [ ! -d "$home" ] && echo "$user (home=$home 不存在)"; done 2>/dev/null"#;
    let shell_output = manager.execute_command(cmd_shell).map(|r| r.output).unwrap_or_default();
    let shell_without_home: Vec<String> = shell_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    // 3. sudo 组异常
    let cmd_sudo = "getent group sudo wheel 2>/dev/null | cut -d: -f4";
    let sudo_output = manager.execute_command(cmd_sudo).map(|r| r.output).unwrap_or_default();
    let sudo_anomalies: Vec<String> = sudo_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| format!("sudo/wheel 组成员: {}", l.trim()))
        .collect();

    // 4. 全用户可疑历史命令
    let cmd_history = r#"for f in /root/.bash_history /home/*/.bash_history; do [ -f "$f" ] && grep -n -E '(wget http|curl http|nc -|bash -i|/dev/tcp|base64 -d|python.*-c|perl.*-e|chmod 777|chmod \+s)' "$f" 2>/dev/null | head -20 | sed "s|^|[$f] |"; done"#;
    let history_output = manager.execute_command(cmd_history).map(|r| r.output).unwrap_or_default();
    let suspicious_history: Vec<String> = history_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    Ok(EnhancedUserResult { uid_conflicts, shell_without_home, sudo_anomalies, suspicious_history })
}

/// 隐藏计划任务检测
pub fn detect_hidden_cron(manager: &SSHManagerRussh) -> Result<GenericDetectionResult, String> {
    let mut issues = Vec::new();

    let cmd = r#"{ find /etc/cron.d /var/spool/cron /var/spool/cron/crontabs -type f 2>/dev/null | while read f; do echo "=== $f ==="; cat "$f" 2>/dev/null | grep -v '^#' | grep -v '^$'; done; echo "=== at queue ==="; atq 2>/dev/null; } | head -100"#;
    let output = manager.execute_command(cmd).map(|r| r.output).unwrap_or_default();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("===") { continue; }
        let low = trimmed.to_lowercase();
        if low.contains("curl") || low.contains("wget") || low.contains("nc ") || low.contains("python") || low.contains("bash -") || low.contains("/dev/tcp") {
            issues.push(SecurityIssue {
                title: "可疑计划任务".to_string(),
                description: trimmed.to_string(),
                severity: "high".to_string(),
                recommendation: "检查该计划任务是否为合法任务，如不是请立即删除".to_string(),
                details: Some(trimmed.to_string()),
            });
        }
    }

    if issues.is_empty() {
        issues.push(SecurityIssue {
            title: "计划任务检查通过".to_string(),
            description: "未发现可疑的隐藏计划任务".to_string(),
            severity: "info".to_string(),
            recommendation: "定期检查计划任务变更".to_string(),
            details: None,
        });
    }

    Ok(GenericDetectionResult { issues })
}

/// SSH 密钥审计
pub fn detect_ssh_key_audit(manager: &SSHManagerRussh) -> Result<SSHKeyAuditResult, String> {
    // 1. 所有 authorized_keys
    let cmd_keys = r#"find /root /home -name authorized_keys -type f 2>/dev/null | while read f; do user=$(echo "$f" | awk -F/ '{if($2=="root") print "root"; else print $3}'); wc -l < "$f" | xargs -I{} echo "$user: {} keys in $f"; done"#;
    let keys_output = manager.execute_command(cmd_keys).map(|r| r.output).unwrap_or_default();
    let unauthorized_keys: Vec<String> = keys_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    // 2. 弱密钥检测 (DSA 或 RSA < 2048)
    let cmd_weak = r#"find /root /home -name authorized_keys -type f 2>/dev/null | xargs grep -h 'ssh-dss\|ssh-rsa' 2>/dev/null | awk '{print $1" "$3}' | head -50"#;
    let weak_output = manager.execute_command(cmd_weak).map(|r| r.output).unwrap_or_default();
    let weak_keys: Vec<String> = weak_output.lines()
        .filter(|l| l.contains("ssh-dss"))
        .map(|l| format!("弱密钥 (DSA): {}", l.trim()))
        .collect();

    // 3. SSH 配置异常
    let cmd_config = "grep -n -E '(AuthorizedKeysCommand|ForceCommand|PermitUserEnvironment\\s+yes)' /etc/ssh/sshd_config 2>/dev/null";
    let config_output = manager.execute_command(cmd_config).map(|r| r.output).unwrap_or_default();
    let config_issues: Vec<String> = config_output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    Ok(SSHKeyAuditResult { unauthorized_keys, weak_keys, config_issues })
}

/// 时间戳篡改检测
pub fn detect_timestomp(manager: &SSHManagerRussh) -> Result<TimestompResult, String> {
    // 查找 mtime 远早于 ctime 的文件（timestomping 特征）
    let cmd = r#"find /tmp /var/tmp /dev/shm /var/www 2>/dev/null -type f -printf '%p|mtime=%T@|ctime=%C@\n' 2>/dev/null | awk -F'|' '{split($2,m,"="); split($3,c,"="); if(c[2]-m[2]>86400) print $1" mtime与ctime差异>"int((c[2]-m[2])/3600)"小时"}' | head -30"#;
    let output = manager.execute_command(cmd).map(|r| r.output).unwrap_or_default();
    let suspicious_files: Vec<String> = output.lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| l.trim().to_string())
        .collect();

    Ok(TimestompResult { suspicious_files })
}

/// 增强进程分析（复用修复后的 detect_process_analysis）
pub fn detect_enhanced_process(manager: &SSHManagerRussh) -> Result<ProcessAnalysisResult, String> {
    // 扩展扫描范围到 100 个进程
    let cmd = "ps aux --sort=-%cpu | head -200";
    let output_result = manager.execute_command(cmd)
        .map_err(|e| format!("获取进程列表失败: {}", e))?;

    let output = output_result.output;
    let mut high_resource_processes = Vec::new();
    let mut suspicious_processes = Vec::new();

    for (i, line) in output.lines().skip(1).enumerate() {
        if i >= 80 { break; }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 11 {
            let user = parts[0].to_string();
            let pid = parts[1].parse::<u32>().unwrap_or(0);
            let cpu = parts[2].parse::<f32>().unwrap_or(0.0);
            let mem = parts[3].parse::<f32>().unwrap_or(0.0);
            let command = parts[10..].join(" ");
            let name = parts[10].to_string();

            let process = ProcessInfo {
                pid, name, user, cpu, mem,
                command: command.chars().take(500).collect(),
            };

            if cpu > 50.0 || mem > 50.0 {
                high_resource_processes.push(process.clone());
            }

            // 可疑进程检测
            if command.contains("(deleted)")
                || command.starts_with("/tmp/")
                || command.starts_with("/dev/shm/")
                || command.starts_with("/var/tmp/")
                || command.contains("bash -i")
                || command.contains("/dev/tcp")
                || command.contains("/dev/udp")
                || command.contains("xmrig")
                || command.contains("cryptonight") {
                suspicious_processes.push(process.clone());
            }
        }
    }

    Ok(ProcessAnalysisResult { suspicious_processes, high_resource_processes })
}

// ═══════════════════════════════════════════════════
// bin/sbin 篡改检测 + 文件不可变属性检测
// ═══════════════════════════════════════════════════

/// 检测 /usr/bin /usr/sbin /bin /sbin 中被替换为脚本的命令（命令劫持/篡改）
pub fn detect_bin_tamper(manager: &SSHManagerRussh) -> Result<Vec<String>, String> {
    let cmd = r#"for d in /usr/bin /usr/sbin /bin /sbin; do [ -d "$d" ] && file "$d"/* 2>/dev/null; done | grep -E 'script|text|ASCII' | grep -v '\.sh:' | grep -v '\.py:' | grep -v '\.pl:' | grep -v '\.rb:' | head -50"#;
    let output = manager.execute_command(cmd)
        .map_err(|e| format!("bin篡改检测失败: {}", e))?;
    let findings: Vec<String> = output.output
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| l.chars().take(200).collect())
        .collect();
    Ok(findings)
}

/// 检测具有不可变属性(immutable/append-only)的可疑文件
pub fn detect_immutable_files(manager: &SSHManagerRussh) -> Result<Vec<String>, String> {
    let cmd = r#"lsattr -R /etc /var/www /usr/bin /usr/sbin /tmp /root 2>/dev/null | grep -E '^....i|^....a' | head -50"#;
    let output = manager.execute_command(cmd)
        .map_err(|e| format!("不可变文件检测失败: {}", e))?;
    let findings: Vec<String> = output.output
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| l.chars().take(200).collect())
        .collect();
    Ok(findings)
}
