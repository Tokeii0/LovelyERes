// LovelyRes - Linux Emergency Response Tool
// Rust Backend Implementation

// 模块声明
pub mod crypto_keys;
pub mod detection_manager;
pub mod detection_commands;  // 检测命令处理器（从 lib.rs 拆分）
pub mod device_info;
pub mod docker_manager;
pub mod docker_commands;     // Docker 命令处理器（从 lib.rs 拆分）
pub mod file_analysis;
pub mod log_analysis;
pub mod packet_capture;
pub mod settings;
pub mod ssh_connection_manager;
pub mod ssh_manager_russh;  // 使用 russh 实现的 SSH 管理器
pub mod theme_manager;
pub mod types;
pub mod window_manager;
pub mod commands;

use std::sync::Mutex;
use tauri::Manager;

// 应用状态
pub struct AppState {
    pub settings: Mutex<settings::AppSettings>,
    pub ssh_connection_manager: Mutex<ssh_connection_manager::SSHConnectionManager>,
    pub ssh_manager: Mutex<ssh_manager_russh::SSHManagerRussh>,
    pub ssh_terminal_creation_lock: Mutex<()>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            settings: Mutex::new(settings::load_settings().unwrap_or_default()),
            ssh_connection_manager: Mutex::new(ssh_connection_manager::SSHConnectionManager::new().expect("Failed to initialize SSH Connection Manager")),
            ssh_manager: Mutex::new(ssh_manager_russh::SSHManagerRussh::new()),
            ssh_terminal_creation_lock: Mutex::new(()),
        })
        .invoke_handler(tauri::generate_handler![
            // Window/Theme/Settings/Misc (misc_commands)
            commands::misc_commands::minimize_window,
            commands::misc_commands::toggle_maximize,
            commands::misc_commands::close_window,
            commands::misc_commands::open_devtools,
            commands::misc_commands::get_theme_settings,
            commands::misc_commands::set_current_theme,
            commands::misc_commands::get_app_settings,
            commands::misc_commands::save_app_settings,
            commands::misc_commands::read_settings_file,
            commands::misc_commands::write_settings_file,
            commands::misc_commands::get_system_fonts,
            commands::misc_commands::get_rsa_public_key,
            // SSH commands
            commands::ssh_commands::load_ssh_connections,
            commands::ssh_commands::save_ssh_connections,
            commands::ssh_commands::encrypt_password,
            commands::ssh_commands::decrypt_password,
            commands::ssh_commands::ssh_connect_direct,
            commands::ssh_commands::ssh_test_connection,
            commands::ssh_commands::ssh_disconnect_direct,
            commands::ssh_commands::ssh_execute_command_direct,
            commands::ssh_commands::ssh_execute_dashboard_command_direct,
            commands::ssh_commands::ssh_execute_batch_commands,
            commands::ssh_commands::ssh_execute_emergency_command_direct,
            commands::ssh_commands::execute_detection_command,
            commands::ssh_commands::test_ssh_performance,
            commands::ssh_commands::diagnose_shell_performance,
            commands::ssh_commands::detect_system_type,
            commands::ssh_commands::start_packet_capture,
            commands::ssh_commands::stop_packet_capture,
            commands::ssh_commands::get_network_interfaces,
            commands::ssh_commands::ssh_create_terminal_session,
            commands::ssh_commands::ssh_close_terminal_session,
            commands::ssh_commands::ssh_close_all_terminal_sessions,
            commands::ssh_commands::ssh_send_input,
            commands::ssh_commands::ssh_get_completion,
            commands::ssh_commands::get_bash_environment_info,
            commands::ssh_commands::get_command_completion,
            commands::ssh_commands::ssh_get_connection_status,
            // SFTP commands
            commands::sftp_commands::sftp_list_files,
            commands::sftp_commands::sftp_read_file,
            commands::sftp_commands::sftp_write_file,
            commands::sftp_commands::sftp_upload,
            commands::sftp_commands::sftp_download,
            commands::sftp_commands::sftp_create_directory,
            commands::sftp_commands::sftp_rename,
            commands::sftp_commands::sftp_delete,
            commands::sftp_commands::sftp_compress,
            commands::sftp_commands::sftp_extract,
            commands::sftp_commands::sftp_chmod,
            commands::sftp_commands::sftp_get_file_details,
            commands::sftp_commands::save_temp_file,
            // File analysis (still in its own module)
            file_analysis::sftp_file_analysis,
            file_analysis::sftp_file_analysis_independent,
            // 快速检测命令（来自 detection_commands 模块）
            detection_commands::detect_port_scan,
            detection_commands::detect_user_audit,
            detection_commands::detect_backdoor,
            detection_commands::detect_process_analysis,
            detection_commands::detect_file_permission,
            detection_commands::detect_ssh_audit,
            detection_commands::detect_log_analysis,
            detection_commands::detect_firewall_check,
            detection_commands::detect_cpu_test,
            detection_commands::detect_memory_test,
            detection_commands::detect_disk_test,
            detection_commands::detect_network_test,
            // 基线检测命令（来自 detection_commands 模块）
            detection_commands::detect_password_policy,
            detection_commands::detect_sudo_config,
            detection_commands::detect_pam_config,
            detection_commands::detect_account_lockout,
            detection_commands::detect_selinux_status,
            detection_commands::detect_kernel_params,
            detection_commands::detect_system_updates,
            detection_commands::detect_unnecessary_services,
            detection_commands::detect_auto_start_services,
            detection_commands::detect_audit_config,
            detection_commands::detect_history_audit,
            detection_commands::detect_ntp_config,
            detection_commands::detect_dns_config,
            // Docker 命令（来自 docker_commands 模块）
            docker_commands::docker_list_containers,
            docker_commands::docker_container_action,
            docker_commands::docker_container_logs,
            docker_commands::docker_inspect_container,
            docker_commands::docker_read_container_file,
            docker_commands::docker_write_container_file,
            docker_commands::docker_copy,
            docker_commands::docker_exec_command,
            docker_commands::create_container_terminal_window,
            // 日志分析
            commands::log_commands::read_system_log,
            commands::log_commands::read_journalctl_log,
            commands::log_commands::list_log_files,
            commands::log_commands::get_log_file_info,
            // 设备信息
            device_info::get_device_uuid,
        ])
        .setup(|app| {
            // 应用初始化逻辑
            println!("🚀 LovelyRes 后端初始化完成");

            // 在 Windows 开发环境下，强制关闭主窗口的原生标题栏（decorations），避免 dev 下平台特定配置未生效
            #[cfg(target_os = "windows")]
            {
                if let Some(main) = app.get_webview_window("main") {
                    if let Err(e) = main.set_decorations(false) {
                        eprintln!("⚠️ 设置窗口装饰失败: {}", e);
                    } else {
                        println!("✅ Windows 下开发模式强制关闭标题栏");
                    }

                    // 强制设置窗口大小为配置文件中的值，避免被缓存的窗口状态覆盖
                    if let Err(e) = main.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                        width: 1200,
                        height: 800,
                    })) {
                        eprintln!("⚠️ 设置窗口大小失败: {}", e);
                    } else {
                        println!("✅ 窗口大小已强制设置为 1200x800");
                    }
                }
            }

            // 设置 app_handle 到 SSH 管理器

            println!("✅ LovelyRes 应用初始化完成");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
