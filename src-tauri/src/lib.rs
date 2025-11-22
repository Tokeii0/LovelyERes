// LovelyRes - Linux Emergency Response Tool
// Rust Backend Implementation

// 模块声明
pub mod crypto_keys;
pub mod detection_manager;
pub mod device_info;
pub mod docker_manager;
pub mod file_analysis;

pub mod settings;
pub mod ssh_channel_manager;
pub mod ssh_client;
pub mod ssh_connection_manager;
pub mod ssh_debug;
pub mod ssh_flow_control;
pub mod ssh_manager;
pub mod ssh_thread_manager;
pub mod theme_manager;
pub mod types;
pub mod window_manager;


use std::sync::Mutex;
use tauri::{Manager, State};

use tauri::Emitter;
use crate::settings::get_app_data_dir;

// 应用状态
pub struct AppState {
    pub settings: Mutex<settings::AppSettings>,
    pub ssh_connection_manager: Mutex<ssh_connection_manager::SSHConnectionManager>,
    pub ssh_client: Mutex<ssh_client::SSHClient>,
    pub ssh_manager: Mutex<ssh_manager::SSHManager>,
    pub ssh_terminal_creation_lock: Mutex<()>,
}

// 窗口控制命令
#[tauri::command]
async fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
async fn toggle_maximize(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().map_err(|e| e.to_string())? {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
async fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

// 主题管理命令
#[tauri::command]
async fn get_theme_settings(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let settings = state.settings.lock().unwrap();
    Ok(serde_json::json!({
        "current_theme": settings.theme
    }))
}

#[tauri::command]
async fn set_current_theme(app: tauri::AppHandle, theme: String, state: State<'_, AppState>) -> Result<(), String> {
    let mut settings = state.settings.lock().unwrap();
    settings.theme = theme.clone();

    // 保存设置
    settings::save_settings(&*settings)?;

    // 向所有窗口广播主题变更事件
    if let Err(e) = app.emit("theme-changed", theme.clone()) {
        eprintln!("发送主题变更事件失败: {}", e);
    }

    println!("🎨 主题模式已更新为: {}", theme);
    Ok(())
}

// 设置管理命令
#[tauri::command]
async fn get_app_settings(state: State<'_, AppState>) -> Result<settings::AppSettings, String> {
    let settings = state.settings.lock().unwrap();
    Ok(settings.clone())
}

#[tauri::command]
async fn save_app_settings(
    new_settings: settings::AppSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut settings = state.settings.lock().unwrap();
    *settings = new_settings.clone();

    // 保存到文件
    settings::save_settings(&new_settings)?;

    println!("⚙️ 应用设置已保存");
    Ok(())
}

/// 读取设置文件
#[tauri::command]
async fn read_settings_file() -> Result<String, String> {
    use std::fs;

    // 获取应用数据目录
    let mut settings_path = get_app_data_dir()?;
    settings_path.push("settings.json");

    println!("🔍 SSH终端读取设置文件路径: {:?}", settings_path);

    if settings_path.exists() {
        let content = fs::read_to_string(&settings_path)
            .map_err(|e| format!("读取设置文件失败: {}", e))?;
        println!("📄 设置文件内容长度: {} 字符", content.len());
        Ok(content)
    } else {
        println!("⚠️ 设置文件不存在: {:?}", settings_path);
        // 如果文件不存在，返回空字符串
        Ok(String::new())
    }
}

/// 写入设置文件
#[tauri::command]
async fn write_settings_file(content: String) -> Result<(), String> {
    use std::fs;

    // 获取应用数据目录
    let mut settings_path = get_app_data_dir()?;
    settings_path.push("settings.json");

    fs::write(&settings_path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))
}

// 加密相关命令

/// 获取 RSA 公钥
///
/// 返回硬编码的 RSA 公钥（PEM 格式）
/// 公钥在编译时已混淆，运行时解混淆
#[tauri::command]
async fn get_rsa_public_key() -> Result<String, String> {
    Ok(crypto_keys::get_rsa_public_key())
}

/// 获取系统字体列表
#[tauri::command]
async fn get_system_fonts() -> Result<Vec<String>, String> {

    #[cfg(target_os = "windows")]
    {
        // 方法1: 使用WinAPI EnumFontFamilies (最可靠)
        match get_fonts_from_winapi() {
            Ok(fonts) => {
                if fonts.len() > 10 {
                    return Ok(fonts);
                }
            }
            Err(_) => {
                // WinAPI方法失败，尝试其他方法
            }
        }

        // 方法2: 尝试从注册表获取字体
        match get_fonts_from_registry() {
            Ok(fonts) => {
                if fonts.len() > 10 {
                    return Ok(fonts);
                }
            }
            Err(_) => {}
        }

        // 方法3: 尝试遍历字体文件夹
        match get_fonts_from_directory() {
            Ok(fonts) => {
                if fonts.len() > 10 {
                    return Ok(fonts);
                }
            }
            Err(_) => {}
        }

        // 方法4: 所有方法都失败，使用默认字体列表
        Ok(get_default_fonts())
    }

    #[cfg(not(target_os = "windows"))]
    {
        // 非Windows系统，返回默认字体列表
        Ok(get_default_fonts())
    }
}

/// 使用WinAPI EnumFontFamilies获取字体列表
#[cfg(target_os = "windows")]
fn get_fonts_from_winapi() -> Result<Vec<String>, String> {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use std::ptr;
    use std::sync::Mutex;
    use winapi::um::wingdi::{EnumFontFamiliesW, LOGFONTW};
    use winapi::um::winuser::{GetDC, ReleaseDC};
    use winapi::shared::windef::{HDC, HWND};
    use winapi::shared::minwindef::LPARAM;



    // 用于存储字体名称的全局变量
    static FONT_NAMES: Mutex<Vec<String>> = Mutex::new(Vec::new());

    // 回调函数，用于接收枚举的字体信息
    unsafe extern "system" fn enum_font_proc(
        lplf: *const LOGFONTW,
        _lptm: *const winapi::um::wingdi::TEXTMETRICW,
        _font_type: u32,
        _lparam: LPARAM,
    ) -> i32 {
        if lplf.is_null() {
            return 1; // 继续枚举
        }

        // 从LOGFONT结构中提取字体名称
        let logfont = &*lplf;
        let font_name_slice = &logfont.lfFaceName;

        // 找到字符串的结尾（null terminator）
        let mut len = 0;
        for &ch in font_name_slice.iter() {
            if ch == 0 {
                break;
            }
            len += 1;
        }

        if len > 0 {
            // 将UTF-16转换为String
            let font_name_utf16 = &font_name_slice[..len];
            let font_name = OsString::from_wide(font_name_utf16)
                .to_string_lossy()
                .to_string();

            // 添加到字体列表
            if let Ok(mut fonts) = FONT_NAMES.lock() {
                if !font_name.is_empty() && !fonts.contains(&font_name) {
                    fonts.push(font_name);
                }
            }
        }

        1 // 继续枚举
    }

    unsafe {
        // 获取桌面设备上下文
        let hdc: HDC = GetDC(ptr::null_mut() as HWND);
        if hdc.is_null() {
            return Err("无法获取设备上下文".to_string());
        }

        // 清空字体列表
        if let Ok(mut fonts) = FONT_NAMES.lock() {
            fonts.clear();
        }

        // 枚举所有字体族
        let result = EnumFontFamiliesW(
            hdc,
            ptr::null(),
            Some(enum_font_proc),
            0,
        );

        // 释放设备上下文
        ReleaseDC(ptr::null_mut() as HWND, hdc);

        if result == 0 {
            return Err("EnumFontFamiliesW调用失败".to_string());
        }

        // 获取结果
        let mut fonts = if let Ok(fonts) = FONT_NAMES.lock() {
            fonts.clone()
        } else {
            return Err("无法获取字体列表".to_string());
        };

        // 添加系统默认选项并排序
        fonts.insert(0, "系统默认".to_string());
        fonts.sort();
        fonts.dedup();


        Ok(fonts)
    }
}

#[cfg(not(target_os = "windows"))]
fn get_fonts_from_winapi() -> Result<Vec<String>, String> {
    Err("非Windows系统不支持WinAPI方法".to_string())
}

/// 从Windows注册表获取字体列表
#[cfg(target_os = "windows")]
fn get_fonts_from_registry() -> Result<Vec<String>, String> {
    use std::process::Command;



    // 使用reg命令查询字体注册表
    let output = Command::new("reg")
        .args(&[
            "query",
            "HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
            "/v",
            "*"
        ])
        .output()
        .map_err(|e| format!("执行reg命令失败: {}", e))?;

    if output.status.success() {
        let registry_str = String::from_utf8_lossy(&output.stdout);
        let mut fonts = Vec::new();

        // 添加系统默认选项
        fonts.push("系统默认".to_string());

        // 解析注册表输出，提取字体名称
        for line in registry_str.lines() {
            if line.contains("REG_SZ") && !line.trim().is_empty() {
                // 注册表行格式: "    字体名称 (TrueType)    REG_SZ    字体文件名"
                let parts: Vec<&str> = line.split("REG_SZ").collect();
                if parts.len() >= 1 {
                    let font_entry = parts[0].trim();
                    if !font_entry.is_empty() {
                        // 清理字体名称
                        let font_name = font_entry
                            .replace(" (TrueType)", "")
                            .replace(" (OpenType)", "")
                            .replace(" Bold", "")
                            .replace(" Italic", "")
                            .replace(" Regular", "")
                            .replace(" Light", "")
                            .replace(" Medium", "")
                            .trim()
                            .to_string();

                        if !font_name.is_empty() && !fonts.contains(&font_name) && font_name.len() > 1 {
                            fonts.push(font_name);
                        }
                    }
                }
            }
        }

        fonts.sort();
        fonts.dedup();


        Ok(fonts)
    } else {
        let error_str = String::from_utf8_lossy(&output.stderr);
        Err(format!("注册表查询失败: {}", error_str))
    }
}

#[cfg(not(target_os = "windows"))]
fn get_fonts_from_registry() -> Result<Vec<String>, String> {
    Err("非Windows系统不支持注册表方法".to_string())
}

/// 从字体目录获取字体列表
#[cfg(target_os = "windows")]
fn get_fonts_from_directory() -> Result<Vec<String>, String> {
    use std::fs;
    use std::path::Path;



    let font_dirs = vec![
        "C:\\Windows\\Fonts",
        "C:\\Windows\\System32\\Fonts",
    ];

    let mut fonts = Vec::new();
    fonts.push("系统默认".to_string());

    for font_dir in font_dirs {
        let path = Path::new(font_dir);
        if path.exists() && path.is_dir() {
            match fs::read_dir(path) {
                Ok(entries) => {
                    for entry in entries {
                        if let Ok(entry) = entry {
                            let file_name = entry.file_name();
                            let file_name_str = file_name.to_string_lossy();

                            // 只处理字体文件
                            if file_name_str.ends_with(".ttf") ||
                               file_name_str.ends_with(".otf") ||
                               file_name_str.ends_with(".ttc") {

                                // 从文件名提取字体名称
                                let font_name = file_name_str
                                    .replace(".ttf", "")
                                    .replace(".otf", "")
                                    .replace(".ttc", "")
                                    .replace("_", " ")
                                    .replace("-", " ");

                                if !font_name.is_empty() && !fonts.contains(&font_name) {
                                    fonts.push(font_name);
                                }
                            }
                        }
                    }
                }
                Err(_) => {}
            }
        }
    }

    fonts.sort();
    fonts.dedup();


    Ok(fonts)
}

#[cfg(not(target_os = "windows"))]
fn get_fonts_from_directory() -> Result<Vec<String>, String> {
    Err("非Windows系统不支持字体目录方法".to_string())
}

/// 获取默认字体列表（作为后备方案）
fn get_default_fonts() -> Vec<String> {
    vec![
        // 系统默认
        "系统默认".to_string(),

        // Windows 中文字体
        "Microsoft YaHei".to_string(),
        "Microsoft YaHei UI".to_string(),
        "微软雅黑".to_string(),
        "SimSun".to_string(),
        "宋体".to_string(),
        "SimHei".to_string(),
        "黑体".to_string(),
        "KaiTi".to_string(),
        "楷体".to_string(),
        "FangSong".to_string(),
        "仿宋".to_string(),
        "Microsoft JhengHei".to_string(),
        "微软正黑体".to_string(),
        "DengXian".to_string(),
        "等线".to_string(),
        "YouYuan".to_string(),
        "幼圆".to_string(),
        "LiSu".to_string(),
        "隶书".to_string(),
        "STXihei".to_string(),
        "华文细黑".to_string(),
        "STKaiti".to_string(),
        "华文楷体".to_string(),
        "STSong".to_string(),
        "华文宋体".to_string(),
        "STFangsong".to_string(),
        "华文仿宋".to_string(),

        // macOS 中文字体
        "PingFang SC".to_string(),
        "苹方".to_string(),
        "Hiragino Sans GB".to_string(),
        "冬青黑体简体中文".to_string(),

        // 开源中文字体
        "Noto Sans CJK SC".to_string(),
        "思源黑体".to_string(),
        "Source Han Sans SC".to_string(),
        "Noto Serif CJK SC".to_string(),
        "思源宋体".to_string(),
        "Source Han Serif SC".to_string(),

        // Windows 英文字体
        "Arial".to_string(),
        "Times New Roman".to_string(),
        "Calibri".to_string(),
        "Segoe UI".to_string(),
        "Tahoma".to_string(),
        "Verdana".to_string(),
        "Georgia".to_string(),
        "Trebuchet MS".to_string(),
        "Comic Sans MS".to_string(),
        "Impact".to_string(),
        "Lucida Console".to_string(),
        "Palatino Linotype".to_string(),

        // 等宽字体
        "Consolas".to_string(),
        "Courier New".to_string(),
        "JetBrains Mono".to_string(),
        "Fira Code".to_string(),
        "Source Code Pro".to_string(),
        "Monaco".to_string(),
        "Menlo".to_string(),
        "Inconsolata".to_string(),
        "Roboto Mono".to_string(),
        "Ubuntu Mono".to_string(),

        // 设计字体
        "Helvetica".to_string(),
        "Helvetica Neue".to_string(),
        "San Francisco".to_string(),
        "Roboto".to_string(),
        "Open Sans".to_string(),
        "Lato".to_string(),
        "Montserrat".to_string(),
        "Poppins".to_string(),
    ]
}

// SSH 连接管理命令
#[tauri::command]
async fn load_ssh_connections(
    state: State<'_, AppState>,
) -> Result<Vec<types::SSHConnection>, String> {
    let manager = state.ssh_connection_manager.lock().unwrap();
    manager.load_connections().map_err(|e| e.to_string())
}

#[tauri::command]
async fn save_ssh_connections(
    connections: Vec<types::SSHConnection>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_connection_manager.lock().unwrap();
    manager
        .save_connections(&connections)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn encrypt_password(password: String, state: State<'_, AppState>) -> Result<String, String> {
    let manager = state.ssh_connection_manager.lock().unwrap();
    manager
        .encrypt_password(&password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn decrypt_password(
    encrypted_password: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let manager = state.ssh_connection_manager.lock().unwrap();
    manager
        .decrypt_password(&encrypted_password)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_connect_with_auth(
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    password: Option<String>,
    key_path: Option<String>,
    key_passphrase: Option<String>,
    certificate_path: Option<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let account = types::SSHAccountCredential {
        username: username.clone(),
        auth_type: auth_type.clone(),
        encrypted_password: None,
        key_path: key_path.clone(),
        key_passphrase: key_passphrase.clone(),
        certificate_path: certificate_path.clone(),
        is_default: true,
        description: None,
    };

    let connection = types::SSHConnection {
        id: uuid::Uuid::new_v4().to_string(),
        name: format!("{}@{}", username, host),
        host: host.clone(),
        port,
        username: username.clone(),
        auth_type,
        encrypted_password: None,
        key_path,
        key_passphrase,
        certificate_path,
        accounts: vec![account],
        active_account: Some(username.clone()),
        is_connected: false,
        last_connected: None,
        tags: None,
    };

    let mut client = state.ssh_client.lock().unwrap();
    client
        .connect(&connection, password.as_deref())
        .map_err(|e| e.to_string())?;

    Ok(format!("已连接到 {}@{}:{}", username, host, port))
}

#[tauri::command]
async fn ssh_test_connection(
    host: String,
    port: u16,
    username: String,
    auth_type: String,
    password: Option<String>,
    key_path: Option<String>,
    key_passphrase: Option<String>,
    certificate_path: Option<String>,
) -> Result<bool, String> {
    println!("🔍 [ssh_test_connection] 开始测试连接:");
    println!("  Host: {}", host);
    println!("  Port: {}", port);
    println!("  Username: {}", username);
    println!("  Auth Type: {}", auth_type);
    
    let account = types::SSHAccountCredential {
        username: username.clone(),
        auth_type: auth_type.clone(),
        encrypted_password: None,
        key_path: key_path.clone(),
        key_passphrase: key_passphrase.clone(),
        certificate_path: certificate_path.clone(),
        is_default: true,
        description: None,
    };

    let connection = types::SSHConnection {
        id: uuid::Uuid::new_v4().to_string(),
        name: format!("{}@{}", username, host),
        host,
        port,
        username: username.clone(),
        auth_type: auth_type.clone(),
        encrypted_password: None,
        key_path: key_path.clone(),
        key_passphrase: key_passphrase.clone(),
        certificate_path: certificate_path.clone(),
        accounts: vec![account],
        active_account: Some(username),
        is_connected: false,
        last_connected: None,
        tags: None,
    };

    match ssh_client::SSHClient::test_connection(&connection, password.as_deref()) {
        Ok(success) => {
            println!("✅ [ssh_test_connection] 测试结果: {}", success);
            Ok(success)
        }
        Err(e) => {
            println!("❌ [ssh_test_connection] 测试失败: {}", e);
            Err(e.to_string())
        }
    }
}

#[tauri::command]
async fn ssh_execute_command(
    command: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let client = state.ssh_client.lock().unwrap();
    client.execute_command(&command).map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_disconnect(state: State<'_, AppState>) -> Result<(), String> {
    let mut client = state.ssh_client.lock().unwrap();
    client.disconnect();
    Ok(())
}

// 新的SSH/SFTP命令
#[tauri::command]
async fn ssh_connect_direct(
    host: String,
    port: u16,
    username: String,
    password: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    println!("=== [Tauri] ssh_connect_direct 被调用 ===");
    println!("  Host: {}", host);
    println!("  Port: {}", port);
    println!("  Username: {}", username);
    println!("  Password Length: {}", password.len());
    println!("  Password (masked): {}***", if password.len() > 3 { &password[..3] } else { "" });
    
    let mut manager = state.ssh_manager.lock().unwrap();
    let result = manager.connect(&host, port, &username, &password);
    
    match &result {
        Ok(_) => println!("✅ [Tauri] SSH 连接成功"),
        Err(e) => println!("❌ [Tauri] SSH 连接失败: {}", e),
    }
    
    result.map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_disconnect_direct(state: State<'_, AppState>) -> Result<(), String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    manager.disconnect().map_err(|e| e.to_string())
}

#[tauri::command]
async fn ssh_execute_command_direct(
    command: String,
    username: Option<String>,
    state: State<'_, AppState>,
) -> Result<ssh_manager::TerminalOutput, String> {
    let start_time = std::time::Instant::now();
    //println!("[PERF] 右键菜单命令执行开始: \"{}\" 时间: {:?}", command, start_time);

    let mut manager = state.ssh_manager.lock().unwrap();
    // 使用仪表盘专用 session 快速执行（右键菜单命令都是快速查询）
    let result = manager.execute_dashboard_command_as_user(&command, username.as_deref()).map_err(|e| e.to_string());

    //println!("[PERF] 右键菜单命令执行完成: \"{}\" 总耗时: {:?}", command, start_time.elapsed());
    result
}

#[tauri::command]
async fn ssh_execute_dashboard_command_direct(
    command: String,
    state: State<'_, AppState>,
) -> Result<ssh_manager::TerminalOutput, String> {
    let start_time = std::time::Instant::now();
    //println!("[PERF] 仪表盘命令执行开始: \"{}\" 时间: {:?}", command, start_time);

    let mut manager = state.ssh_manager.lock().unwrap();
    let result = manager.execute_dashboard_command(&command).map_err(|e| e.to_string());

    //println!("[PERF] 仪表盘命令执行完成: \"{}\" 总耗时: {:?}", command, start_time.elapsed());
    result
}

#[tauri::command]
async fn ssh_execute_emergency_command_direct(
    command: String,
    username: Option<String>,
    state: State<'_, AppState>,
) -> Result<ssh_manager::TerminalOutput, String> {
    let _start_time = std::time::Instant::now();
    //println!("[PERF] 应急响应命令执行开始: \"{}\" 账号: {:?} 时间: {:?}", command, username, _start_time);

    let mut manager = state.ssh_manager.lock().unwrap();
    let result = if username.is_some() {
        manager.execute_dashboard_command_as_user(&command, username.as_deref()).map_err(|e| e.to_string())
    } else {
        manager.execute_dashboard_command(&command).map_err(|e| e.to_string())
    };

    //println!("[PERF] 应急响应命令执行完成: \"{}\" 总耗时: {:?}", command, _start_time.elapsed());
    result
}

/// 执行检测报告中AI生成的命令
#[tauri::command]
async fn execute_detection_command(
    command: String,
    state: State<'_, AppState>,
) -> Result<ssh_manager::TerminalOutput, String> {
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
async fn test_ssh_performance(
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
async fn diagnose_shell_performance(
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
async fn detect_system_type(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
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

// 快速检测命令

/// 端口安全扫描
#[tauri::command]
async fn detect_port_scan(state: State<'_, AppState>) -> Result<detection_manager::PortScanResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_port_scan(&mut manager)
}

/// 用户权限审计
#[tauri::command]
async fn detect_user_audit(state: State<'_, AppState>) -> Result<detection_manager::UserAuditResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_user_audit(&mut manager)
}

/// 后门检测
#[tauri::command]
async fn detect_backdoor(state: State<'_, AppState>) -> Result<detection_manager::BackdoorScanResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_backdoor(&mut manager)
}

/// 进程分析
#[tauri::command]
async fn detect_process_analysis(state: State<'_, AppState>) -> Result<detection_manager::ProcessAnalysisResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_process_analysis(&mut manager)
}

/// 文件权限检测
#[tauri::command]
async fn detect_file_permission(state: State<'_, AppState>) -> Result<detection_manager::FilePermissionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_file_permission(&mut manager)
}

/// SSH 安全审计
#[tauri::command]
async fn detect_ssh_audit(state: State<'_, AppState>) -> Result<detection_manager::SSHAuditResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_ssh_audit(&mut manager)
}

/// 日志分析
#[tauri::command]
async fn detect_log_analysis(state: State<'_, AppState>) -> Result<detection_manager::LogAnalysisResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_log_analysis(&mut manager)
}

/// 防火墙检查
#[tauri::command]
async fn detect_firewall_check(state: State<'_, AppState>) -> Result<detection_manager::FirewallCheckResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_firewall_check(&mut manager)
}

/// CPU 测试
#[tauri::command]
async fn detect_cpu_test(state: State<'_, AppState>) -> Result<detection_manager::CpuTestResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_cpu_test(&mut manager)
}

/// 内存测试
#[tauri::command]
async fn detect_memory_test(state: State<'_, AppState>) -> Result<detection_manager::MemoryTestResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_memory_test(&mut manager)
}

/// 磁盘测试
#[tauri::command]
async fn detect_disk_test(state: State<'_, AppState>) -> Result<detection_manager::DiskTestResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_disk_test(&mut manager)
}

/// 网络测试
#[tauri::command]
async fn detect_network_test(state: State<'_, AppState>) -> Result<detection_manager::NetworkTestResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_network_test(&mut manager)
}

// 新增基线检测命令

/// 密码策略检查
#[tauri::command]
async fn detect_password_policy(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_password_policy(&mut manager)
}

/// Sudo 配置审计
#[tauri::command]
async fn detect_sudo_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_sudo_config(&mut manager)
}

/// PAM 配置检查
#[tauri::command]
async fn detect_pam_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_pam_config(&mut manager)
}

/// 账号锁定策略检查
#[tauri::command]
async fn detect_account_lockout(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_account_lockout(&mut manager)
}

/// SELinux/AppArmor 状态检查
#[tauri::command]
async fn detect_selinux_status(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_selinux_status(&mut manager)
}

/// 内核参数检查
#[tauri::command]
async fn detect_kernel_params(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_kernel_params(&mut manager)
}

/// 系统补丁状态检查
#[tauri::command]
async fn detect_system_updates(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_system_updates(&mut manager)
}

/// 不必要服务检查
#[tauri::command]
async fn detect_unnecessary_services(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_unnecessary_services(&mut manager)
}

/// 自启动服务审计
#[tauri::command]
async fn detect_auto_start_services(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_auto_start_services(&mut manager)
}

/// 审计配置检查
#[tauri::command]
async fn detect_audit_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_audit_config(&mut manager)
}

/// 历史命令审计
#[tauri::command]
async fn detect_history_audit(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_history_audit(&mut manager)
}

/// NTP 配置检查
#[tauri::command]
async fn detect_ntp_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_ntp_config(&mut manager)
}

/// DNS 配置检查
#[tauri::command]
async fn detect_dns_config(state: State<'_, AppState>) -> Result<detection_manager::GenericDetectionResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    detection_manager::detect_dns_config(&mut manager)
}

// SSH 终端管理命令

/// 创建 SSH 终端会话
#[tauri::command]
async fn ssh_create_terminal_session(
    window: tauri::Window,
    terminal_id: String,
    cols: u16,
    rows: u16,
    state: State<'_, AppState>,
) -> Result<String, String> {
    // 获取终端创建锁，确保原子性
    let _creation_lock = state.ssh_terminal_creation_lock.lock().unwrap();

    let mut manager = state.ssh_manager.lock().unwrap();

    if !manager.is_connected() {
        return Err("没有活动的 SSH 连接".to_string());
    }

    match manager.create_terminal_session(window, &terminal_id, cols, rows) {
        Ok(session_id) => {
            println!("✅ 创建终端会话成功: {}", session_id);
            Ok(session_id)
        }
        Err(e) => {
            println!("❌ 创建终端会话失败: {}", e);
            Err(e.to_string())
        }
    }
}

/// 关闭 SSH 终端会话
#[tauri::command]
async fn ssh_close_terminal_session(
    terminal_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut manager = state.ssh_manager.lock().unwrap();

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
async fn ssh_close_all_terminal_sessions(
    state: State<'_, AppState>,
) -> Result<usize, String> {
    let mut manager = state.ssh_manager.lock().unwrap();

    match manager.close_all_terminal_sessions() {
        Ok(count) => {
            println!("✅ 关闭所有终端会话成功，共 {} 个", count);
            Ok(count)
        }
        Err(e) => {
            println!("❌ 关闭所有终端会话失败: {}", e);
            Err(e.to_string())
        }
    }
}

/// 向 SSH 终端发送输入
#[tauri::command]
async fn ssh_send_input(
    terminal_id: String,
    data: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut manager = state.ssh_manager.lock().unwrap();

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
async fn ssh_get_completion(
    input: String,
    #[allow(unused_variables)] cursor_position: usize,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let mut manager = state.ssh_manager.lock().unwrap();

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
async fn sftp_list_files(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<ssh_manager::SftpFileInfo>, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    manager.list_sftp_files(&path).map_err(|e| e.to_string())
}
#[tauri::command]
async fn sftp_read_file(
    path: String,
    max_bytes: Option<usize>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    manager
        .read_sftp_file(&path, max_bytes)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn sftp_chmod(path: String, mode: u32, state: State<'_, AppState>) -> Result<(), String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    manager.chmod_sftp(&path, mode).map_err(|e| e.to_string())
}

#[tauri::command]
async fn sftp_get_file_details(
    path: String,
    state: State<'_, AppState>,
) -> Result<ssh_manager::SftpFileDetails, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    manager.get_file_details(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_bash_environment_info(
    state: State<'_, AppState>,
) -> Result<types::BashEnvironmentInfo, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    manager
        .get_bash_environment_info()
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_command_completion(
    input: String,
    state: State<'_, AppState>,
) -> Result<types::CommandCompletion, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    manager
        .get_command_completion(&input)
        .map_err(|e| e.to_string())
}
#[tauri::command]
async fn sftp_write_file(
    path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    manager
        .write_sftp_file(&path, &content)
        .map_err(|e| e.to_string())
}
#[tauri::command]
async fn sftp_compress(
    source_path: String,
    target_path: String,
    format: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    manager
        .compress_file(&source_path, &target_path, &format)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn sftp_extract(
    archive_path: String,
    target_dir: String,
    overwrite: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    manager
        .extract_file(&archive_path, &target_dir, overwrite)
        .map_err(|e| e.to_string())
}
#[tauri::command]
async fn sftp_upload(
    local_path: String,
    remote_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    manager
        .upload_file(&local_path, &remote_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn sftp_download(
    remote_path: String,
    local_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    manager
        .download_file(&remote_path, &local_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
async fn sftp_create_directory(
    remote_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    manager
        .create_directory(&remote_path)
        .map_err(|e| e.to_string())
}
#[tauri::command]
async fn save_temp_file(file_name: String, data: Vec<u8>) -> Result<String, String> {
    use std::io::Write;

    // 创建临时目录
    let temp_dir = std::env::temp_dir();
    let temp_file_path = temp_dir.join(&file_name);

    // 写入文件数据
    let mut file =
        std::fs::File::create(&temp_file_path).map_err(|e| format!("创建临时文件失败: {}", e))?;

    file.write_all(&data)
        .map_err(|e| format!("写入临时文件失败: {}", e))?;

    // 返回临时文件路径
    Ok(temp_file_path.to_string_lossy().to_string())
}

#[tauri::command]
async fn ssh_get_connection_status(
    state: State<'_, AppState>,
) -> Result<Option<ssh_manager::SSHConnectionStatus>, String> {
    let manager = state.ssh_manager.lock().unwrap();
    let status = manager.get_connection_status().cloned();
    println!("🔍 前端请求SSH连接状态: {:?}", status);
    Ok(status)
}

#[tauri::command]
async fn docker_list_containers(
    state: State<'_, AppState>,
) -> Result<Vec<types::DockerContainerSummary>, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    manager.list_containers(&mut *ssh).map_err(Into::into)
}

#[tauri::command]
async fn docker_container_action(
    container_id: String,
    action: String,
    state: State<'_, AppState>,
) -> Result<types::DockerActionResult, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    manager
        .perform_action(&mut *ssh, &container_id, &action)
        .map_err(Into::into)
}

#[tauri::command]
async fn docker_container_logs(
    container_id: String,
    options: Option<types::DockerLogsOptions>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    manager
        .get_logs(&mut *ssh, &container_id, options)
        .map_err(Into::into)
}

#[tauri::command]
async fn docker_inspect_container(
    container_id: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    manager
        .inspect(&mut *ssh, &container_id)
        .map_err(Into::into)
}

#[tauri::command]
async fn docker_read_container_file(
    container_id: String,
    path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    manager
        .read_file(&mut *ssh, &container_id, &path)
        .map_err(Into::into)
}

#[tauri::command]
async fn docker_exec_command(
    container_id: String,
    command: String,
    shell: Option<String>,
    state: State<'_, AppState>,
) -> Result<ssh_manager::TerminalOutput, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    let shell = shell.unwrap_or_else(|| "sh".to_string());
    manager
        .exec_command(&mut *ssh, &container_id, &command, &shell)
        .map_err(Into::into)
}

#[tauri::command]
async fn create_container_terminal_window(
    app: tauri::AppHandle,
    container_name: String,
    container_id: String,
) -> Result<String, String> {
    let window_label = format!("container-terminal-{}", container_id);
    let window_title = format!("容器终端 - {}", container_name);

    // 检查窗口是否已存在
    if let Some(existing_window) = app.get_webview_window(&window_label) {
        // 如果窗口已存在，聚焦它
        existing_window.set_focus().map_err(|e| format!("聚焦窗口失败: {}", e))?;
        return Ok(window_label);
    }

    // 创建新窗口
    let window = window_manager::WindowManager::create_window(
        &app,
        &window_label,
        &window_title,
        "/container-terminal.html",
        900.0,
        600.0,
    ).map_err(|e| format!("创建容器终端窗口失败: {}", e))?;

    // 设置窗口数据
    window.eval(&format!(
        "window.containerInfo = {{ name: '{}', id: '{}' }};",
        container_name.replace("'", "\\'"),
        container_id.replace("'", "\\'")
    )).map_err(|e| format!("设置窗口数据失败: {}", e))?;

    Ok(window_label)
}

#[tauri::command]
async fn docker_write_container_file(
    container_id: String,
    path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<types::DockerActionResult, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    manager
        .write_file(&mut *ssh, &container_id, &path, &content)
        .map_err(Into::into)
}

#[tauri::command]
async fn docker_copy(
    container_id: String,
    request: types::DockerCopyRequest,
    state: State<'_, AppState>,
) -> Result<types::DockerActionResult, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    manager
        .copy(&mut *ssh, &container_id, &request)
        .map_err(Into::into)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 初始化应用状态
    let app_settings = settings::load_settings().unwrap_or_default();
    let ssh_connection_manager =
        ssh_connection_manager::SSHConnectionManager::new().expect("初始化SSH连接管理器失败");
    let ssh_client = ssh_client::SSHClient::new();
    let ssh_manager = ssh_manager::SSHManager::new();

    let app_state = AppState {
        settings: Mutex::new(app_settings),
        ssh_connection_manager: Mutex::new(ssh_connection_manager),
        ssh_client: Mutex::new(ssh_client),
        ssh_manager: Mutex::new(ssh_manager),
        ssh_terminal_creation_lock: Mutex::new(()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // 窗口控制
            minimize_window,
            toggle_maximize,
            close_window,
            // 主题管理
            get_theme_settings,
            set_current_theme,
            // 设置管理
            get_app_settings,
            save_app_settings,
            // SSH管理
            load_ssh_connections,
            save_ssh_connections,
            encrypt_password,
            decrypt_password,
            ssh_connect_with_auth,
            ssh_test_connection,
            ssh_execute_command,
            ssh_disconnect,
            // 新的SSH/SFTP命令
            ssh_connect_direct,
            ssh_disconnect_direct,
            ssh_execute_command_direct,
            ssh_execute_dashboard_command_direct,
            ssh_execute_emergency_command_direct,
            execute_detection_command,
            sftp_list_files,
            sftp_read_file,
            sftp_write_file,
            sftp_upload,
            sftp_download,
            sftp_create_directory,
            save_temp_file,
            sftp_compress,
            sftp_extract,
            sftp_chmod,
            sftp_get_file_details,
            file_analysis::sftp_file_analysis,
            file_analysis::sftp_file_analysis_independent,
            get_bash_environment_info,
            get_command_completion,
            ssh_get_connection_status,
            test_ssh_performance,
            diagnose_shell_performance,
            detect_system_type,
            // 快速检测命令
            detect_port_scan,
            detect_user_audit,
            detect_backdoor,
            detect_process_analysis,
            detect_file_permission,
            detect_ssh_audit,
            detect_log_analysis,
            detect_firewall_check,
            detect_cpu_test,
            detect_memory_test,
            detect_disk_test,
            detect_network_test,
            // 新增基线检测命令
            detect_password_policy,
            detect_sudo_config,
            detect_pam_config,
            detect_account_lockout,
            detect_selinux_status,
            detect_kernel_params,
            detect_system_updates,
            detect_unnecessary_services,
            detect_auto_start_services,
            detect_audit_config,
            detect_history_audit,
            detect_ntp_config,
            detect_dns_config,
            // SSH 终端管理
            ssh_create_terminal_session,
            ssh_close_terminal_session,
            ssh_close_all_terminal_sessions,
            ssh_send_input,
            ssh_get_completion,
            // Docker
            docker_list_containers,
            docker_container_action,
            docker_container_logs,
            docker_inspect_container,
            docker_read_container_file,
            docker_write_container_file,
            docker_copy,
            docker_exec_command,
            create_container_terminal_window,
            // 设置管理
            read_settings_file,
            write_settings_file,
            get_system_fonts,
            // 加密相关
            get_rsa_public_key,
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


