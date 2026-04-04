// Window management, theme, settings, device info, fonts, etc.

use tauri::State;
use crate::AppState;
use crate::settings;
use crate::crypto_keys;

// 窗口控制命令
#[tauri::command]
pub async fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn toggle_maximize(window: tauri::Window) -> Result<(), String> {
    if window.is_maximized().map_err(|e| e.to_string())? {
        window.unmaximize().map_err(|e| e.to_string())
    } else {
        window.maximize().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_devtools(app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;

    // 获取主窗口
    if let Some(window) = app.get_webview_window("main") {
        #[cfg(debug_assertions)]
        {
            window.open_devtools();
            println!("🐛 开发者工具已打开 (开发模式)");
            Ok(())
        }
        #[cfg(not(debug_assertions))]
        {
            // 生产环境禁止打开开发者工具
            let _ = window;
            Err("生产环境不支持此操作".to_string())
        }
    } else {
        Err("无法找到主窗口".to_string())
    }
}

// 主题管理命令
#[tauri::command]
pub async fn get_theme_settings(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let settings = state.settings.lock().map_err(|_| "获取设置锁失败".to_string())?;
    Ok(serde_json::json!({
        "current_theme": settings.theme
    }))
}

#[tauri::command]
pub async fn set_current_theme(app: tauri::AppHandle, theme: String, state: State<'_, AppState>) -> Result<(), String> {
    use tauri::Emitter;

    let mut settings = state.settings.lock().map_err(|_| "获取设置锁失败".to_string())?;
    settings.theme = theme.clone();

    // 保存设置
    settings::save_settings(&*settings)?;

    // 向所有窗口广播主题变更事件
    if let Err(e) = app.emit("theme-changed", theme.clone()) {
        eprintln!("发送主题变更事件失败: {}", e);
    }

    #[cfg(debug_assertions)]
    println!("🎨 主题模式已更新为: {}", theme);
    Ok(())
}

// 设置管理命令
#[tauri::command]
pub async fn get_app_settings(state: State<'_, AppState>) -> Result<settings::AppSettings, String> {
    let settings = state.settings.lock().map_err(|_| "获取设置锁失败".to_string())?;
    Ok(settings.clone())
}

#[tauri::command]
pub async fn save_app_settings(
    new_settings: settings::AppSettings,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut settings = state.settings.lock().map_err(|_| "获取设置锁失败".to_string())?;
    *settings = new_settings.clone();

    // 保存到文件
    settings::save_settings(&new_settings)?;

    println!("⚙️ 应用设置已保存");
    Ok(())
}

/// 读取设置文件
#[tauri::command]
pub async fn read_settings_file() -> Result<String, String> {
    use std::fs;

    // 获取应用数据目录
    let mut settings_path = settings::get_app_data_dir()?;
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
pub async fn write_settings_file(content: String) -> Result<(), String> {
    use std::fs;

    // 获取应用数据目录
    let mut settings_path = settings::get_app_data_dir()?;
    settings_path.push("settings.json");

    fs::write(&settings_path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))
}

// 加密相关命令

/// 获取 RSA 公钥
#[tauri::command]
pub async fn get_rsa_public_key() -> Result<String, String> {
    Ok(crypto_keys::get_rsa_public_key())
}

/// 获取系统字体列表
#[tauri::command]
pub async fn get_system_fonts() -> Result<Vec<String>, String> {

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
