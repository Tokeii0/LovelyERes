// Log reading/analysis commands

use tauri::State;
use crate::AppState;
use crate::log_analysis;

/// 读取系统日志文件
#[tauri::command]
pub async fn read_system_log(
    log_path: String,
    page: Option<usize>,
    page_size: Option<usize>,
    filter: Option<String>,
    date_filter: Option<String>,
    state: State<'_, AppState>,
) -> Result<log_analysis::LogAnalysisResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();

    if !manager.is_connected() {
        return Err("没有活动的 SSH 连接".to_string());
    }

    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(100);

    // 生成读取日志的命令
    let command = log_analysis::generate_log_read_command(
        &log_path,
        page,
        page_size,
        filter.as_deref(),
        date_filter.as_deref()
    );

    // 执行命令获取日志
    let output = manager.execute_dashboard_command(&command)
        .map_err(|e| format!("读取日志失败: {}", e))?;

    // 解析日志内容
    let entries: Vec<log_analysis::LogEntry> = output.output
        .lines()
        .filter(|line| !line.trim().is_empty() && !line.contains("Log file not found") && !line.contains("No matching entries"))
        .map(|line| log_analysis::parse_log_line(line, log_analysis::HIGHLIGHT_KEYWORDS))
        .collect();

    let highlighted_count = entries.iter().filter(|e| e.highlighted).count();

    Ok(log_analysis::LogAnalysisResult {
        total_count: entries.len(),
        highlighted_count,
        entries,
        file_info: None,
    })
}

/// 读取 journalctl 日志
#[tauri::command]
pub async fn read_journalctl_log(
    page: Option<usize>,
    page_size: Option<usize>,
    unit: Option<String>,
    filter: Option<String>,
    since: Option<String>,
    until: Option<String>,
    state: State<'_, AppState>,
) -> Result<log_analysis::LogAnalysisResult, String> {
    let mut manager = state.ssh_manager.lock().unwrap();

    if !manager.is_connected() {
        return Err("没有活动的 SSH 连接".to_string());
    }

    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(100);

    // 生成 journalctl 命令
    let command = log_analysis::generate_journalctl_command(
        page,
        page_size,
        unit.as_deref(),
        filter.as_deref(),
        since.as_deref(),
        until.as_deref()
    );

    // 执行命令获取日志
    let output = manager.execute_dashboard_command(&command)
        .map_err(|e| format!("读取 journalctl 日志失败: {}", e))?;

    // 解析日志内容
    let entries: Vec<log_analysis::LogEntry> = output.output
        .lines()
        .filter(|line| !line.trim().is_empty() && !line.contains("journalctl not available"))
        .map(|line| log_analysis::parse_log_line(line, log_analysis::HIGHLIGHT_KEYWORDS))
        .collect();

    let highlighted_count = entries.iter().filter(|e| e.highlighted).count();

    Ok(log_analysis::LogAnalysisResult {
        total_count: entries.len(),
        highlighted_count,
        entries,
        file_info: None,
    })
}

/// 列出可用的日志文件
#[tauri::command]
pub async fn list_log_files(
    state: State<'_, AppState>,
) -> Result<Vec<log_analysis::LogFileInfo>, String> {
    let mut manager = state.ssh_manager.lock().unwrap();

    if !manager.is_connected() {
        return Err("没有活动的 SSH 连接".to_string());
    }

    // 生成列出日志文件的命令
    let command = log_analysis::generate_list_log_files_command();

    // 执行命令
    let output = manager.execute_dashboard_command(&command)
        .map_err(|e| format!("列出日志文件失败: {}", e))?;

    // 解析输出
    let mut log_files: Vec<log_analysis::LogFileInfo> = output.output
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 3 {
                let size = parts[0].parse::<u64>().unwrap_or(0);
                let path = parts[1].to_string();
                let name = path.split('/').last().unwrap_or(&path).to_string();
                let modified = parts[2].to_string();

                Some(log_analysis::LogFileInfo {
                    path,
                    name,
                    size,
                    modified,
                    readable: true,
                })
            } else {
                None
            }
        })
        .collect();

    // 添加常见日志文件（如果它们不在列表中）
    for (path, name) in log_analysis::COMMON_LOG_FILES {
        if !log_files.iter().any(|f| f.path == *path) {
            log_files.push(log_analysis::LogFileInfo {
                path: path.to_string(),
                name: name.to_string(),
                size: 0,
                modified: String::new(),
                readable: false,
            });
        }
    }

    Ok(log_files)
}

/// 获取日志文件信息
#[tauri::command]
pub async fn get_log_file_info(
    log_path: String,
    state: State<'_, AppState>,
) -> Result<log_analysis::LogFileInfo, String> {
    let mut manager = state.ssh_manager.lock().unwrap();

    if !manager.is_connected() {
        return Err("没有活动的 SSH 连接".to_string());
    }

    // 生成获取文件信息的命令
    let command = log_analysis::generate_log_file_info_command(&log_path);

    // 执行命令
    let output = manager.execute_dashboard_command(&command)
        .map_err(|e| format!("获取日志文件信息失败: {}", e))?;

    let name = log_path.split('/').last().unwrap_or(&log_path).to_string();

    // 解析输出
    if output.output.contains("readable:no") {
        return Ok(log_analysis::LogFileInfo {
            path: log_path,
            name,
            size: 0,
            modified: String::new(),
            readable: false,
        });
    }

    // 解析 stat 输出
    let mut size = 0u64;
    let mut modified = String::new();

    for part in output.output.split('|') {
        if part.starts_with("size:") {
            size = part[5..].parse().unwrap_or(0);
        } else if part.starts_with("modified:") {
            modified = part[9..].to_string();
        }
    }

    Ok(log_analysis::LogFileInfo {
        path: log_path,
        name,
        size,
        modified,
        readable: true,
    })
}
