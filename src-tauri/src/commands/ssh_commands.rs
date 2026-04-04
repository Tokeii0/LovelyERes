// SSH connect/disconnect/execute/terminal commands

use tauri::State;
use crate::AppState;
use crate::ssh_manager_russh;
use crate::types;
use crate::packet_capture;

// SSH 连接管理命令
#[tauri::command]
pub async fn load_ssh_connections(
    state: State<'_, AppState>,
) -> Result<Vec<types::SSHConnection>, String> {
    let manager = state.ssh_connection_manager.lock().unwrap();
    manager.load_connections().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_ssh_connections(
    connections: Vec<types::SSHConnection>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_connection_manager.lock().unwrap();
    manager
        .save_connections(&connections)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn encrypt_password(password: String, state: State<'_, AppState>) -> Result<String, String> {
    let manager = state.ssh_connection_manager.lock().unwrap();
    manager
        .encrypt_password(&password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn decrypt_password(
    encrypted_password: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let manager = state.ssh_connection_manager.lock().unwrap();
    manager
        .decrypt_password(&encrypted_password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_connect_direct(
    host: String,
    port: u16,
    username: String,
    password: Option<String>,
    auth_type: Option<String>,
    key_path: Option<String>,
    key_passphrase: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        println!("=== [Tauri] ssh_connect_direct 被调用 ===");
        println!("  Host: {}", host);
        println!("  Port: {}", port);
        println!("  Username: {}", username);
        println!("  Auth Type: {:?}", auth_type);
    }

    let auth = auth_type.as_deref().unwrap_or("password");
    let manager = state.ssh_manager.lock().unwrap();

    let result = match auth {
        "key" => {
            // 密钥认证：如果有 key_path，读取密钥内容传给 russh
            if let Some(kp) = &key_path {
                let key_content = std::fs::read_to_string(kp)
                    .map_err(|e| format!("读取密钥文件失败: {}", e))?;
                manager.connect(&host, port, &username, key_passphrase.as_deref(), Some(&key_content))
            } else {
                Err("密钥认证需要提供密钥路径".to_string())
            }
        }
        _ => {
            // 密码认证
            manager.connect(&host, port, &username, password.as_deref(), None)
        }
    };

    match &result {
        Ok(_) => println!("✅ [Tauri] SSH 连接成功"),
        Err(e) => println!("❌ [Tauri] SSH 连接失败: {}", e),
    }

    result.map(|_| format!("已连接到 {}@{}:{}", username, host, port))
}

/// 测试SSH连接（使用 russh）- 复用已有的 Tokio runtime 避免重复创建
#[tauri::command]
pub async fn ssh_test_connection(
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    password: Option<String>,
    key_path: Option<String>,
    key_passphrase: Option<String>,
    _certificate_path: Option<String>,
    state: State<'_, AppState>,
) -> Result<bool, String> {
    println!("🔍 [ssh_test_connection] 开始测试连接: {}@{}:{}", username, host, port);

    // 复用 AppState 的 manager，避免创建新的 Tokio runtime
    let manager = state.ssh_manager.lock().unwrap();

    let result = match auth_type.as_str() {
        "key" => {
            if let Some(kp) = &key_path {
                let key_content = std::fs::read_to_string(kp)
                    .map_err(|e| format!("读取密钥文件失败: {}", e))?;
                manager.connect(&host, port, &username, key_passphrase.as_deref(), Some(&key_content))
            } else {
                Err("密钥认证需要提供密钥路径".to_string())
            }
        }
        _ => {
            manager.connect(&host, port, &username, password.as_deref(), None)
        }
    };

    match result {
        Ok(session_id) => {
            // Disconnect the test session
            let _ = manager.disconnect_session(&session_id);
            println!("✅ [ssh_test_connection] 测试成功");
            Ok(true)
        }
        Err(e) => {
            println!("❌ [ssh_test_connection] 测试失败: {}", e);
            Err(e)
        }
    }
}

#[tauri::command]
pub async fn ssh_disconnect_direct(state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager.disconnect().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_packet_capture(
    interface: String,
    filter: Option<String>,
    count: Option<u32>,
    window: tauri::Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager.start_packet_capture(&interface, filter, count, window)
}

#[tauri::command]
pub async fn stop_packet_capture(state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager.stop_packet_capture()
}

#[tauri::command]
pub async fn get_network_interfaces(state: State<'_, AppState>) -> Result<String, String> {
    let manager = state.ssh_manager.lock().unwrap();
    let cmd = packet_capture::generate_list_interfaces_command();
    let output = manager.execute_command(&cmd)?;
    Ok(output.output)
}

#[tauri::command]
pub async fn ssh_execute_command_direct(
    command: String,
    username: Option<String>,
    state: State<'_, AppState>,
) -> Result<ssh_manager_russh::TerminalOutput, String> {
    let manager = state.ssh_manager.lock().unwrap();
    // 使用仪表盘专用 session 快速执行（右键菜单命令都是快速查询）
    let result = manager.execute_dashboard_command_as_user(&command, username.as_deref()).map_err(|e| e.to_string());

    result
}

#[tauri::command]
pub async fn ssh_execute_dashboard_command_direct(
    command: String,
    state: State<'_, AppState>,
) -> Result<ssh_manager_russh::TerminalOutput, String> {
    let manager = state.ssh_manager.lock().unwrap();
    let result = manager.execute_dashboard_command(&command).map_err(|e| e.to_string());

    result
}

/// 批量并行执行多条SSH命令（一次IPC调用，后端并行打开多个SSH channel）
#[tauri::command]
pub async fn ssh_execute_batch_commands(
    commands: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<ssh_manager_russh::BatchCommandResult>, String> {
    let manager = state.ssh_manager.lock().unwrap();
    let results = manager.execute_batch_commands(&commands)?;
    
    Ok(results.into_iter().enumerate().map(|(i, r)| {
        match r {
            Ok(output) => ssh_manager_russh::BatchCommandResult {
                command: commands.get(i).cloned().unwrap_or_default(),
                success: true,
                output: Some(output),
                error: None,
            },
            Err(e) => ssh_manager_russh::BatchCommandResult {
                command: commands.get(i).cloned().unwrap_or_default(),
                success: false,
                output: None,
                error: Some(e),
            }
        }
    }).collect())
}

#[tauri::command]
pub async fn ssh_execute_emergency_command_direct(
    command: String,
    username: Option<String>,
    state: State<'_, AppState>,
) -> Result<ssh_manager_russh::TerminalOutput, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    let result = if username.is_some() {
        manager.execute_dashboard_command_as_user(&command, username.as_deref()).map_err(|e| e.to_string())
    } else {
        manager.execute_dashboard_command(&command).map_err(|e| e.to_string())
    };

    result
}

/// 执行检测报告中AI生成的命令
#[tauri::command]
pub async fn execute_detection_command(
    command: String,
    state: State<'_, AppState>,
) -> Result<ssh_manager_russh::TerminalOutput, String> {
    println!("🤖 [AI命令执行] 开始执行: {}", command);

    let mut manager = state.ssh_manager.lock().unwrap();
    let result = manager.execute_dashboard_command(&command).map_err(|e| {
        println!("❌ [AI命令执行] 执行失败: {}", e);
        e.to_string()
    });

    match &result {
        Ok(output) => {
            println!("✅ [AI命令执行] 执行成功");
            println!("   输出长度: {} 字符", output.output.len());
            if let Some(exit_code) = output.exit_code {
                println!("   退出码: {}", exit_code);
            }
        },
        Err(e) => {
            println!("❌ [AI命令执行] 执行失败: {}", e);
        }
    }

    result
}

/// 测试SSH连接质量 - 对比交互式终端和直接命令执行
#[tauri::command]
pub async fn test_ssh_performance(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut manager = state.ssh_manager.lock().unwrap();

    let test_commands = vec![
        ("echo test", "基础响应测试"),
        ("pwd", "目录查询测试"),
        ("date", "系统时间测试"),
        ("whoami", "用户查询测试"),
    ];

    let mut results = Vec::new();
    results.push("=== 直接命令执行性能测试 ===".to_string());

    for (cmd, desc) in test_commands {
        let start = std::time::Instant::now();
        match manager.execute_command(cmd) {
            Ok(_) => {
                let duration = start.elapsed();
                results.push(format!("{}: {:?}", desc, duration));
                println!("[SSH性能-直接] {}: {:?}", desc, duration);
            }
            Err(e) => {
                results.push(format!("{}: 失败 - {}", desc, e));
            }
        }
    }

    results.push("\n=== 性能分析建议 ===".to_string());
    results.push("如果直接命令执行很快，但交互式终端很慢，问题可能在于:".to_string());
    results.push("1. Shell初始化配置(.bashrc, .profile)".to_string());
    results.push("2. 复杂的命令提示符(PS1)".to_string());
    results.push("3. PTY配置问题".to_string());
    results.push("4. 环境变量处理".to_string());

    Ok(results.join("\n"))
}

/// 检测Shell配置可能导致的性能问题
#[tauri::command]
pub async fn diagnose_shell_performance(
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut manager = state.ssh_manager.lock().unwrap();

    let mut results = Vec::new();
    results.push("=== Shell性能诊断 ===".to_string());

    // 检测shell类型
    let start = std::time::Instant::now();
    match manager.execute_command("echo $SHELL") {
        Ok(output) => {
            results.push(format!("Shell类型: {} (耗时: {:?})", output.output.trim(), start.elapsed()));
        }
        Err(e) => {
            results.push(format!("获取Shell类型失败: {}", e));
        }
    }

    // 检测.bashrc大小
    let start = std::time::Instant::now();
    match manager.execute_command("wc -l ~/.bashrc 2>/dev/null || echo 'no .bashrc'") {
        Ok(output) => {
            results.push(format!(".bashrc行数: {} (耗时: {:?})", output.output.trim(), start.elapsed()));
        }
        Err(e) => {
            results.push(format!("检测.bashrc失败: {}", e));
        }
    }

    // 检测PS1复杂度
    let start = std::time::Instant::now();
    match manager.execute_command("echo \"PS1长度: ${#PS1}\"") {
        Ok(output) => {
            results.push(format!("命令提示符: {} (耗时: {:?})", output.output.trim(), start.elapsed()));
        }
        Err(e) => {
            results.push(format!("检测PS1失败: {}", e));
        }
    }

    // 测试简单命令
    let start = std::time::Instant::now();
    match manager.execute_command("true") {
        Ok(_) => {
            results.push(format!("简单命令(true): 耗时 {:?}", start.elapsed()));
        }
        Err(e) => {
            results.push(format!("简单命令失败: {}", e));
        }
    }

    results.push("\n=== 建议 ===".to_string());
    results.push("如果简单命令很快，问题可能在交互式终端的Shell配置".to_string());
    results.push("尝试: export PS1='$ ' 来简化命令提示符".to_string());

    Ok(results.join("\n"))
}

/// 检测系统类型（后端实现，更高效）
#[tauri::command]
pub async fn detect_system_type(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    use serde_json::json;

    println!("🔍 [后端] 开始系统类型检测...");

    let mut manager = state.ssh_manager.lock().unwrap();

    if !manager.is_connected() {
        println!("❌ [后端] 没有活动的 SSH 连接");
        return Err("没有活动的 SSH 连接".to_string());
    }

    // 1. 读取 /etc/os-release
    println!("📄 [后端] 读取 os-release...");
    let os_release_cmd = "cat /etc/os-release 2>/dev/null || cat /etc/lsb-release 2>/dev/null || echo 'ID=generic'";
    let os_release_output = manager.execute_dashboard_command(os_release_cmd)
        .map_err(|e| {
            println!("❌ [后端] 读取 os-release 失败: {}", e);
            format!("读取 os-release 失败: {}", e)
        })?;

    println!("✅ [后端] os-release 读取成功");
    let os_release_content = os_release_output.output;

    // 2. 检测包管理器
    println!("📦 [后端] 检测包管理器...");
    let pkg_mgr_cmd = "which apt 2>/dev/null && echo 'apt' || which yum 2>/dev/null && echo 'yum' || which dnf 2>/dev/null && echo 'dnf' || which pacman 2>/dev/null && echo 'pacman' || which zypper 2>/dev/null && echo 'zypper' || which apk 2>/dev/null && echo 'apk' || echo 'unknown'";
    let pkg_mgr_output = manager.execute_dashboard_command(pkg_mgr_cmd)
        .map_err(|e| {
            println!("❌ [后端] 检测包管理器失败: {}", e);
            format!("检测包管理器失败: {}", e)
        })?;

    println!("✅ [后端] 包管理器检测成功");
    let package_manager = pkg_mgr_output.output.lines().last().unwrap_or("unknown").trim();

    // 3. 检测 init 系统
    println!("⚙️ [后端] 检测 init 系统...");
    let init_cmd = "ps -p 1 -o comm= 2>/dev/null";
    let init_output = manager.execute_dashboard_command(init_cmd)
        .map_err(|e| {
            println!("❌ [后端] 检测 init 系统失败: {}", e);
            format!("检测 init 系统失败: {}", e)
        })?;

    println!("✅ [后端] init 系统检测成功");

    let init_output_str = init_output.output.trim().to_lowercase();
    let init_system = if init_output_str.contains("systemd") {
        "systemd"
    } else if init_output_str.contains("init") {
        "sysvinit"
    } else if init_output_str.contains("upstart") {
        "upstart"
    } else if init_output_str.contains("openrc") {
        "openrc"
    } else {
        "unknown"
    };

    // 4. 解析 os-release 内容
    let mut id = "generic".to_string();
    let mut id_like = String::new();
    let mut name = "Linux".to_string();
    let mut version = String::new();
    let mut pretty_name = "Generic Linux".to_string();

    for line in os_release_content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("ID=") && !trimmed.starts_with("ID_LIKE=") {
            id = trimmed[3..].trim_matches(|c| c == '"' || c == '\'').to_lowercase();
        } else if trimmed.starts_with("ID_LIKE=") {
            id_like = trimmed[8..].trim_matches(|c| c == '"' || c == '\'').to_lowercase();
        } else if trimmed.starts_with("NAME=") {
            name = trimmed[5..].trim_matches(|c| c == '"' || c == '\'').to_string();
        } else if trimmed.starts_with("VERSION_ID=") {
            version = trimmed[11..].trim_matches(|c| c == '"' || c == '\'').to_string();
        } else if trimmed.starts_with("PRETTY_NAME=") {
            pretty_name = trimmed[12..].trim_matches(|c| c == '"' || c == '\'').to_string();
        }
    }

    // 5. 识别系统类型
    let combined = format!("{} {} {} {}", id, id_like, name, pretty_name).to_lowercase();

    let system_type = if id == "kylin" {
        "kylin"
    } else if id == "uos" || id == "uniontech" {
        "uos"
    } else if id == "deepin" {
        "deepin"
    } else if id == "openeuler" {
        "openeuler"
    } else if id == "anolis" {
        "anolis"
    } else if id == "ubuntu" {
        "ubuntu"
    } else if id == "debian" {
        "debian"
    } else if id == "centos" {
        "centos"
    } else if id == "rhel" {
        "rhel"
    } else if id == "fedora" {
        "fedora"
    } else if id == "arch" {
        "arch"
    } else if id == "opensuse" || id == "suse" {
        "opensuse"
    } else if id == "alpine" {
        "alpine"
    } else if !id_like.is_empty() {
        // 根据 ID_LIKE 判断
        if id_like.contains("ubuntu") {
            "ubuntu"
        } else if id_like.contains("debian") {
            "debian"
        } else if id_like.contains("rhel") || id_like.contains("fedora") {
            if combined.contains("centos") {
                "centos"
            } else if combined.contains("fedora") {
                "fedora"
            } else {
                "rhel"
            }
        } else if id_like.contains("arch") {
            "arch"
        } else if id_like.contains("suse") {
            "opensuse"
        } else {
            "generic"
        }
    } else {
        "generic"
    };

    println!("🔍 系统检测完成: type={}, name={}, version={}", system_type, name, version);

    Ok(json!({
        "type": system_type,
        "name": name,
        "version": version,
        "prettyName": pretty_name,
        "packageManager": package_manager,
        "initSystem": init_system
    }))
}

// SSH 终端管理命令

/// 创建 SSH 终端会话
#[tauri::command]
pub async fn ssh_create_terminal_session(
    window: tauri::Window,
    terminal_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // 获取终端创建锁，确保原子性
    let _creation_lock = state.ssh_terminal_creation_lock.lock().unwrap();

    let manager = state.ssh_manager.lock().unwrap();

    if !manager.is_connected() {
        return Err("没有活动的 SSH 连接".to_string());
    }

    match manager.create_terminal_session(window, &terminal_id, cols as u32, rows as u32) {
        Ok(_) => {
            println!("✅ 创建终端会话成功: {}", terminal_id);
            Ok(terminal_id)
        }
        Err(e) => {
            println!("❌ 创建终端会话失败: {}", e);
            Err(e.to_string())
        }
    }
}

/// 关闭 SSH 终端会话
#[tauri::command]
pub async fn ssh_close_terminal_session(
    terminal_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_manager.lock().unwrap();

    match manager.close_terminal_session(&terminal_id) {
        Ok(_) => {
            println!("✅ 关闭终端会话成功: {}", terminal_id);
            Ok(())
        }
        Err(e) => {
            println!("❌ 关闭终端会话失败: {}", e);
            Err(e.to_string())
        }
    }
}

/// 关闭所有 SSH 终端会话
#[tauri::command]
pub async fn ssh_close_all_terminal_sessions(
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let manager = state.ssh_manager.lock().unwrap();

    match manager.close_all_terminal_sessions() {
        Ok(_) => {
            println!("✅ 关闭所有终端会话成功");
            Ok(0) // Return 0 since we don't track count in russh impl
        }
        Err(e) => {
            println!("❌ 关闭所有终端会话失败: {}", e);
            Err(e.to_string())
        }
    }
}

/// 向 SSH 终端发送输入
#[tauri::command]
pub async fn ssh_send_input(
    terminal_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_manager.lock().unwrap();

    match manager.send_terminal_input(&terminal_id, data.as_bytes().to_vec()) {
        Ok(_) => Ok(()),
        Err(e) => {
            println!("❌ 发送终端输入失败: {}", e);
            Err(e.to_string())
        }
    }
}

/// 获取 SSH 终端自动补全建议
#[tauri::command]
pub async fn ssh_get_completion(
    input: String,
    #[allow(unused_variables)] cursor_position: usize,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let manager = state.ssh_manager.lock().unwrap();

    // 基本的命令补全逻辑
    let words: Vec<&str> = input.split_whitespace().collect();
    let mut completions = Vec::new();

    if words.is_empty() || (words.len() == 1 && !input.ends_with(' ')) {
        // 补全命令
        let common_commands = vec![
            "ls", "cd", "pwd", "cat", "grep", "find", "ps", "top", "htop",
            "df", "du", "free", "uname", "whoami", "id", "groups",
            "chmod", "chown", "cp", "mv", "rm", "mkdir", "rmdir",
            "tar", "gzip", "gunzip", "zip", "unzip",
            "vim", "nano", "less", "more", "head", "tail",
            "ssh", "scp", "rsync", "wget", "curl",
            "systemctl", "service", "crontab", "history",
            "awk", "sed", "sort", "uniq", "wc", "tr"
        ];

        let prefix = words.last().unwrap_or(&"");
        for cmd in common_commands {
            if cmd.starts_with(prefix) {
                completions.push(cmd.to_string());
            }
        }
    } else {
        // 尝试文件/目录补全
        let last_word = words.last().unwrap_or(&"");

        // 构建 ls 命令来获取文件列表
        let dir_path = if last_word.contains('/') {
            let path_parts: Vec<&str> = last_word.rsplitn(2, '/').collect();
            if path_parts.len() == 2 {
                path_parts[1]
            } else {
                "."
            }
        } else {
            "."
        };

        // 执行 ls 命令获取文件列表
        match manager.execute_command(&format!("ls -1a {}", dir_path)) {
            Ok(output) => {
                let files: Vec<&str> = output.output.lines().collect();
                let filename_prefix = if last_word.contains('/') {
                    last_word.split('/').last().unwrap_or("")
                } else {
                    last_word
                };

                for file in files {
                    if file.starts_with(filename_prefix) && file != "." && file != ".." {
                        let full_path = if last_word.contains('/') {
                            let dir_part = &last_word[..last_word.rfind('/').unwrap() + 1];
                            format!("{}{}", dir_part, file)
                        } else {
                            file.to_string()
                        };
                        completions.push(full_path);
                    }
                }
            }
            Err(_) => {
                // 如果无法获取文件列表，返回空补全
            }
        }
    }

    Ok(serde_json::json!({
        "completions": completions
    }))
}

#[tauri::command]
pub async fn get_bash_environment_info(
    state: State<'_, AppState>,
) -> Result<types::BashEnvironmentInfo, String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager
        .get_bash_environment_info()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_command_completion(
    input: String,
    state: State<'_, AppState>,
) -> Result<types::CommandCompletion, String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager
        .get_command_completion(&input)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn ssh_get_connection_status(
    state: State<'_, AppState>,
) -> Result<Option<ssh_manager_russh::SSHConnectionStatus>, String> {
    let manager = state.ssh_manager.lock().unwrap();
    let status = manager.get_connection_status();
    Ok(status)
}
