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
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_port_scan(&mut manager)
}

/// 用户权限审计
#[tauri::command]
pub async fn detect_user_audit(state: State<'_, AppState>) -> Result<detection_manager::UserAuditResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_user_audit(&mut manager)
}

/// 后门检测
#[tauri::command]
pub async fn detect_backdoor(state: State<'_, AppState>) -> Result<detection_manager::BackdoorScanResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_backdoor(&mut manager)
}

/// 进程分析
#[tauri::command]
pub async fn detect_process_analysis(state: State<'_, AppState>) -> Result<detection_manager::ProcessAnalysisResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_process_analysis(&mut manager)
}

/// 文件权限检测
#[tauri::command]
pub async fn detect_file_permission(state: State<'_, AppState>) -> Result<detection_manager::FilePermissionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_file_permission(&mut manager)
}

/// SSH 安全审计
#[tauri::command]
pub async fn detect_ssh_audit(state: State<'_, AppState>) -> Result<detection_manager::SSHAuditResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_ssh_audit(&mut manager)
}

/// 日志分析（安全层面）
#[tauri::command]
pub async fn detect_log_analysis(state: State<'_, AppState>) -> Result<detection_manager::LogAnalysisResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_log_analysis(&mut manager)
}

/// 防火墙检查
#[tauri::command]
pub async fn detect_firewall_check(state: State<'_, AppState>) -> Result<detection_manager::FirewallCheckResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_firewall_check(&mut manager)
}

// ==================== 性能检测 ====================

/// CPU 测试
#[tauri::command]
pub async fn detect_cpu_test(state: State<'_, AppState>) -> Result<detection_manager::CpuTestResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_cpu_test(&mut manager)
}

/// 内存测试
#[tauri::command]
pub async fn detect_memory_test(state: State<'_, AppState>) -> Result<detection_manager::MemoryTestResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_memory_test(&mut manager)
}

/// 磁盘测试
#[tauri::command]
pub async fn detect_disk_test(state: State<'_, AppState>) -> Result<detection_manager::DiskTestResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_disk_test(&mut manager)
}

/// 网络测试
#[tauri::command]
pub async fn detect_network_test(state: State<'_, AppState>) -> Result<detection_manager::NetworkTestResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_network_test(&mut manager)
}

// ==================== 基线检测 ====================

/// 密码策略检查
#[tauri::command]
pub async fn detect_password_policy(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_password_policy(&mut manager)
}

/// Sudo 配置审计
#[tauri::command]
pub async fn detect_sudo_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_sudo_config(&mut manager)
}

/// PAM 配置检查
#[tauri::command]
pub async fn detect_pam_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_pam_config(&mut manager)
}

/// 账号锁定策略检查
#[tauri::command]
pub async fn detect_account_lockout(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_account_lockout(&mut manager)
}

/// SELinux/AppArmor 状态检查
#[tauri::command]
pub async fn detect_selinux_status(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_selinux_status(&mut manager)
}

/// 内核参数检查
#[tauri::command]
pub async fn detect_kernel_params(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_kernel_params(&mut manager)
}

/// 系统补丁状态检查
#[tauri::command]
pub async fn detect_system_updates(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_system_updates(&mut manager)
}

/// 不必要服务检查
#[tauri::command]
pub async fn detect_unnecessary_services(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_unnecessary_services(&mut manager)
}

/// 自启动服务审计
#[tauri::command]
pub async fn detect_auto_start_services(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_auto_start_services(&mut manager)
}

/// 审计配置检查
#[tauri::command]
pub async fn detect_audit_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_audit_config(&mut manager)
}

/// 历史命令审计
#[tauri::command]
pub async fn detect_history_audit(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_history_audit(&mut manager)
}

/// NTP 配置检查
#[tauri::command]
pub async fn detect_ntp_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_ntp_config(&mut manager)
}

/// DNS 配置检查
#[tauri::command]
pub async fn detect_dns_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_dns_config(&mut manager)
}
