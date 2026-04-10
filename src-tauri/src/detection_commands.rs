/**
 * 检测命令处理器模块
 * 将检测相关的 Tauri 命令从 lib.rs 中拆分出来
 */

use tauri::State;
use crate::AppState;
use crate::detection_manager;

// ==================== 基础安全检测 ====================

/// 端口安全扫描
#[tauri::command]
pub async fn detect_port_scan(state: State<'_, AppState>) -> Result<detection_manager::PortScanResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_port_scan(manager)
}

/// 用户权限审计
#[tauri::command]
pub async fn detect_user_audit(state: State<'_, AppState>) -> Result<detection_manager::UserAuditResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_user_audit(manager)
}

/// 后门检测
#[tauri::command]
pub async fn detect_backdoor(state: State<'_, AppState>) -> Result<detection_manager::BackdoorScanResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_backdoor(manager)
}

/// 进程分析
#[tauri::command]
pub async fn detect_process_analysis(state: State<'_, AppState>) -> Result<detection_manager::ProcessAnalysisResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_process_analysis(manager)
}

/// 文件权限检测
#[tauri::command]
pub async fn detect_file_permission(state: State<'_, AppState>) -> Result<detection_manager::FilePermissionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_file_permission(manager)
}

/// SSH 安全审计
#[tauri::command]
pub async fn detect_ssh_audit(state: State<'_, AppState>) -> Result<detection_manager::SSHAuditResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_ssh_audit(manager)
}

/// 日志分析（安全层面）
#[tauri::command]
pub async fn detect_log_analysis(state: State<'_, AppState>) -> Result<detection_manager::LogAnalysisResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_log_analysis(manager)
}

/// 防火墙检查
#[tauri::command]
pub async fn detect_firewall_check(state: State<'_, AppState>) -> Result<detection_manager::FirewallCheckResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_firewall_check(manager)
}

// ==================== 性能检测 ====================

/// CPU 测试
#[tauri::command]
pub async fn detect_cpu_test(state: State<'_, AppState>) -> Result<detection_manager::CpuTestResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_cpu_test(manager)
}

/// 内存测试
#[tauri::command]
pub async fn detect_memory_test(state: State<'_, AppState>) -> Result<detection_manager::MemoryTestResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_memory_test(manager)
}

/// 磁盘测试
#[tauri::command]
pub async fn detect_disk_test(state: State<'_, AppState>) -> Result<detection_manager::DiskTestResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_disk_test(manager)
}

/// 网络测试
#[tauri::command]
pub async fn detect_network_test(state: State<'_, AppState>) -> Result<detection_manager::NetworkTestResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_network_test(manager)
}

// ==================== 基线检测 ====================

/// 密码策略检查
#[tauri::command]
pub async fn detect_password_policy(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_password_policy(manager)
}

/// Sudo 配置审计
#[tauri::command]
pub async fn detect_sudo_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_sudo_config(manager)
}

/// PAM 配置检查
#[tauri::command]
pub async fn detect_pam_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_pam_config(manager)
}

/// 账号锁定策略检查
#[tauri::command]
pub async fn detect_account_lockout(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_account_lockout(manager)
}

/// SELinux/AppArmor 状态检查
#[tauri::command]
pub async fn detect_selinux_status(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_selinux_status(manager)
}

/// 内核参数检查
#[tauri::command]
pub async fn detect_kernel_params(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_kernel_params(manager)
}

/// 系统补丁状态检查
#[tauri::command]
pub async fn detect_system_updates(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_system_updates(manager)
}

/// 不必要服务检查
#[tauri::command]
pub async fn detect_unnecessary_services(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_unnecessary_services(manager)
}

/// 自启动服务审计
#[tauri::command]
pub async fn detect_auto_start_services(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_auto_start_services(manager)
}

/// 审计配置检查
#[tauri::command]
pub async fn detect_audit_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_audit_config(manager)
}

/// 历史命令审计
#[tauri::command]
pub async fn detect_history_audit(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_history_audit(manager)
}

/// NTP 配置检查
#[tauri::command]
pub async fn detect_ntp_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_ntp_config(manager)
}

/// DNS 配置检查
#[tauri::command]
pub async fn detect_dns_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_dns_config(manager)
}

// ==================== 竞赛级高级检测 ====================

/// Webshell 扫描
#[tauri::command]
pub async fn detect_webshell(state: State<'_, AppState>) -> Result<detection_manager::WebshellScanResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_webshell(manager)
}

/// Rootkit 检测
#[tauri::command]
pub async fn detect_rootkit(state: State<'_, AppState>) -> Result<detection_manager::RootkitScanResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_rootkit(manager)
}

/// 持久化机制扫描
#[tauri::command]
pub async fn detect_persistence(state: State<'_, AppState>) -> Result<detection_manager::PersistenceScanResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_persistence(manager)
}

/// 日志篡改检测
#[tauri::command]
pub async fn detect_log_tamper(state: State<'_, AppState>) -> Result<detection_manager::LogTamperResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_log_tamper(manager)
}

/// 网络后门检测
#[tauri::command]
pub async fn detect_network_backdoor(state: State<'_, AppState>) -> Result<detection_manager::NetworkBackdoorResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_network_backdoor(manager)
}

/// 增强用户审计
#[tauri::command]
pub async fn detect_enhanced_user(state: State<'_, AppState>) -> Result<detection_manager::EnhancedUserResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_enhanced_user(manager)
}

/// 隐藏计划任务检测
#[tauri::command]
pub async fn detect_hidden_cron(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_hidden_cron(manager)
}

/// SSH 密钥审计
#[tauri::command]
pub async fn detect_ssh_key_audit(state: State<'_, AppState>) -> Result<detection_manager::SSHKeyAuditResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_ssh_key_audit(manager)
}

/// 时间戳篡改检测
#[tauri::command]
pub async fn detect_timestomp(state: State<'_, AppState>) -> Result<detection_manager::TimestompResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_timestomp(manager)
}

/// 增强进程分析
#[tauri::command]
pub async fn detect_enhanced_process(state: State<'_, AppState>) -> Result<detection_manager::ProcessAnalysisResult, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_enhanced_process(manager)
}

/// bin/sbin 命令篡改检测
#[tauri::command]
pub async fn detect_bin_tamper(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_bin_tamper(manager)
}

/// 不可变文件属性检测
#[tauri::command]
pub async fn detect_immutable_files(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let manager = &state.ssh_manager;
    detection_manager::detect_immutable_files(manager)
}
