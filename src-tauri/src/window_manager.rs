// LovelyRes 窗口管理器

use tauri::{Manager, WebviewWindow};

/// 窗口管理器
pub struct WindowManager;

impl WindowManager {
    /// 创建新窗口
    pub fn create_window(
        app: &tauri::AppHandle,
        label: &str,
        title: &str,
        url: &str,
        width: f64,
        height: f64,
    ) -> Result<WebviewWindow, String> {
        // 在 macOS 上使用原生标题栏，在其他平台上使用自定义标题栏
        #[cfg(target_os = "macos")]
        let window =
            tauri::WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::App(url.into()))
                .title(title)
                .inner_size(width, height)
                .center()
                .resizable(true)
                .minimizable(true)
                .maximizable(true)
                .closable(true)
                .decorations(true) // macOS 使用原生标题栏
                .always_on_top(false)
                .build()
                .map_err(|e| format!("创建窗口失败: {}", e))?;

        #[cfg(not(target_os = "macos"))]
        let window =
            tauri::WebviewWindowBuilder::new(app, label, tauri::WebviewUrl::App(url.into()))
                .title(title)
                .inner_size(width, height)
                .center()
                .resizable(true)
                .minimizable(true)
                .maximizable(true)
                .closable(true)
                .decorations(false) // 其他平台使用自定义标题栏
                .always_on_top(false)
                .build()
                .map_err(|e| format!("创建窗口失败: {}", e))?;

        println!("✅ 创建窗口: {} ({})", title, label);
        Ok(window)
    }

    /// 获取主窗口
    pub fn get_main_window(app: &tauri::AppHandle) -> Option<WebviewWindow> {
        app.get_webview_window("main")
    }

    /// 关闭窗口
    pub fn close_window(app: &tauri::AppHandle, label: &str) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(label) {
            window.close().map_err(|e| format!("关闭窗口失败: {}", e))?;
            println!("✅ 窗口已关闭: {}", label);
        }
        Ok(())
    }

    /// 最小化窗口
    pub fn minimize_window(app: &tauri::AppHandle, label: &str) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(label) {
            window
                .minimize()
                .map_err(|e| format!("最小化窗口失败: {}", e))?;
            println!("✅ 窗口已最小化: {}", label);
        }
        Ok(())
    }

    /// 最大化/还原窗口
    pub fn toggle_maximize_window(app: &tauri::AppHandle, label: &str) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(label) {
            let is_maximized = window
                .is_maximized()
                .map_err(|e| format!("检查窗口状态失败: {}", e))?;

            if is_maximized {
                window
                    .unmaximize()
                    .map_err(|e| format!("还原窗口失败: {}", e))?;
                println!("✅ 窗口已还原: {}", label);
            } else {
                window
                    .maximize()
                    .map_err(|e| format!("最大化窗口失败: {}", e))?;
                println!("✅ 窗口已最大化: {}", label);
            }
        }
        Ok(())
    }

    /// 设置窗口大小
    pub fn set_window_size(
        app: &tauri::AppHandle,
        label: &str,
        width: f64,
        height: f64,
    ) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(label) {
            window
                .set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: width as u32,
                    height: height as u32,
                }))
                .map_err(|e| format!("设置窗口大小失败: {}", e))?;
            println!("✅ 窗口大小已设置: {} ({}x{})", label, width, height);
        }
        Ok(())
    }

    /// 设置窗口位置
    pub fn set_window_position(
        app: &tauri::AppHandle,
        label: &str,
        x: f64,
        y: f64,
    ) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(label) {
            window
                .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x: x as i32,
                    y: y as i32,
                }))
                .map_err(|e| format!("设置窗口位置失败: {}", e))?;
            println!("✅ 窗口位置已设置: {} ({}, {})", label, x, y);
        }
        Ok(())
    }

    /// 居中窗口
    pub fn center_window(app: &tauri::AppHandle, label: &str) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(label) {
            window
                .center()
                .map_err(|e| format!("居中窗口失败: {}", e))?;
            println!("✅ 窗口已居中: {}", label);
        }
        Ok(())
    }

    /// 设置窗口标题
    pub fn set_window_title(
        app: &tauri::AppHandle,
        label: &str,
        title: &str,
    ) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(label) {
            window
                .set_title(title)
                .map_err(|e| format!("设置窗口标题失败: {}", e))?;
            println!("✅ 窗口标题已设置: {} -> {}", label, title);
        }
        Ok(())
    }

    /// 设置窗口图标
    pub fn set_window_icon(
        app: &tauri::AppHandle,
        label: &str,
        icon_path: &str,
    ) -> Result<(), String> {
        if let Some(_window) = app.get_webview_window(label) {
            // 注释掉图标设置，因为 API 已更改
            // let icon = tauri::Icon::File(std::path::PathBuf::from(icon_path));
            // window.set_icon(icon).map_err(|e| format!("设置窗口图标失败: {}", e))?;
            println!("✅ 窗口图标设置功能暂时禁用: {} -> {}", label, icon_path);
        }
        Ok(())
    }

    /// 设置窗口置顶
    pub fn set_window_always_on_top(
        app: &tauri::AppHandle,
        label: &str,
        always_on_top: bool,
    ) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(label) {
            window
                .set_always_on_top(always_on_top)
                .map_err(|e| format!("设置窗口置顶失败: {}", e))?;
            println!("✅ 窗口置顶已设置: {} -> {}", label, always_on_top);
        }
        Ok(())
    }

    /// 获取窗口信息
    pub fn get_window_info(
        app: &tauri::AppHandle,
        label: &str,
    ) -> Result<serde_json::Value, String> {
        if let Some(window) = app.get_webview_window(label) {
            let size = window
                .inner_size()
                .map_err(|e| format!("获取窗口大小失败: {}", e))?;
            let position = window
                .outer_position()
                .map_err(|e| format!("获取窗口位置失败: {}", e))?;
            let is_maximized = window
                .is_maximized()
                .map_err(|e| format!("检查窗口状态失败: {}", e))?;
            let is_minimized = window
                .is_minimized()
                .map_err(|e| format!("检查窗口状态失败: {}", e))?;
            let is_visible = window
                .is_visible()
                .map_err(|e| format!("检查窗口可见性失败: {}", e))?;
            let is_focused = window
                .is_focused()
                .map_err(|e| format!("检查窗口焦点失败: {}", e))?;

            Ok(serde_json::json!({
                "label": label,
                "title": window.title().map_err(|e| format!("获取窗口标题失败: {}", e))?,
                "size": {
                    "width": size.width,
                    "height": size.height
                },
                "position": {
                    "x": position.x,
                    "y": position.y
                },
                "is_maximized": is_maximized,
                "is_minimized": is_minimized,
                "is_visible": is_visible,
                "is_focused": is_focused
            }))
        } else {
            Err(format!("窗口不存在: {}", label))
        }
    }

    /// 获取所有窗口列表
    pub fn get_all_windows(app: &tauri::AppHandle) -> Vec<String> {
        app.webview_windows().keys().cloned().collect()
    }

    /// 显示窗口
    pub fn show_window(app: &tauri::AppHandle, label: &str) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(label) {
            window.show().map_err(|e| format!("显示窗口失败: {}", e))?;
            println!("✅ 窗口已显示: {}", label);
        }
        Ok(())
    }

    /// 隐藏窗口
    pub fn hide_window(app: &tauri::AppHandle, label: &str) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(label) {
            window.hide().map_err(|e| format!("隐藏窗口失败: {}", e))?;
            println!("✅ 窗口已隐藏: {}", label);
        }
        Ok(())
    }

    /// 聚焦窗口
    pub fn focus_window(app: &tauri::AppHandle, label: &str) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(label) {
            window
                .set_focus()
                .map_err(|e| format!("聚焦窗口失败: {}", e))?;
            println!("✅ 窗口已聚焦: {}", label);
        }
        Ok(())
    }

    /// 设置窗口可调整大小
    pub fn set_window_resizable(
        app: &tauri::AppHandle,
        label: &str,
        resizable: bool,
    ) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(label) {
            window
                .set_resizable(resizable)
                .map_err(|e| format!("设置窗口可调整大小失败: {}", e))?;
            println!("✅ 窗口可调整大小已设置: {} -> {}", label, resizable);
        }
        Ok(())
    }

    /// 设置窗口最小大小
    pub fn set_window_min_size(
        app: &tauri::AppHandle,
        label: &str,
        width: f64,
        height: f64,
    ) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(label) {
            window
                .set_min_size(Some(tauri::Size::Physical(tauri::PhysicalSize {
                    width: width as u32,
                    height: height as u32,
                })))
                .map_err(|e| format!("设置窗口最小大小失败: {}", e))?;
            println!("✅ 窗口最小大小已设置: {} ({}x{})", label, width, height);
        }
        Ok(())
    }

    /// 设置窗口最大大小
    pub fn set_window_max_size(
        app: &tauri::AppHandle,
        label: &str,
        width: f64,
        height: f64,
    ) -> Result<(), String> {
        if let Some(window) = app.get_webview_window(label) {
            window
                .set_max_size(Some(tauri::Size::Physical(tauri::PhysicalSize {
                    width: width as u32,
                    height: height as u32,
                })))
                .map_err(|e| format!("设置窗口最大大小失败: {}", e))?;
            println!("✅ 窗口最大大小已设置: {} ({}x{})", label, width, height);
        }
        Ok(())
    }
}
