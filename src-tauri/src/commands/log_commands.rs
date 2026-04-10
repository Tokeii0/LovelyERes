// Log reading/analysis commands — 应急响应增强版

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
    with_analysis: Option<bool>,
    state: State<'_, AppState>,
) -> Result<log_analysis::LogAnalysisResult, String> {
    let manager = &state.ssh_manager;
    if !manager.is_connected() {
        return Err("没有活动的 SSH 连接".to_string());
    }

    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(100);

    let command = log_analysis::generate_log_read_command(
        &log_path, page, page_size,
        filter.as_deref(), date_filter.as_deref()
    );

    let output = manager.execute_dashboard_command(&command)
        .map_err(|e| format!("读取日志失败: {}", e))?;

    let entries: Vec<log_analysis::LogEntry> = output.output
        .lines()
        .filter(|line| !line.trim().is_empty() && !line.contains("Log file not found") && !line.contains("No matching entries"))
        .map(|line| log_analysis::parse_log_line(line, log_analysis::HIGHLIGHT_KEYWORDS))
        .collect();

    let highlighted_count = entries.iter().filter(|e| e.highlighted).count();

    // 威胁分析（如果请求）
    let threat_summary = if with_analysis.unwrap_or(false) {
        // 读取更多行用于分析
        let analysis_cmd = log_analysis::generate_threat_analysis_command(&log_path);
        if let Ok(analysis_output) = manager.execute_dashboard_command(&analysis_cmd) {
            let analysis_entries: Vec<log_analysis::LogEntry> = analysis_output.output
                .lines()
                .filter(|line| !line.trim().is_empty())
                .map(|line| log_analysis::parse_log_line(line, log_analysis::HIGHLIGHT_KEYWORDS))
                .collect();
            Some(log_analysis::analyze_threats(&analysis_entries))
        } else {
            Some(log_analysis::analyze_threats(&entries))
        }
    } else {
        None
    };

    Ok(log_analysis::LogAnalysisResult {
        total_count: entries.len(),
        highlighted_count,
        entries,
        file_info: None,
        threat_summary,
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
    with_analysis: Option<bool>,
    state: State<'_, AppState>,
) -> Result<log_analysis::LogAnalysisResult, String> {
    let manager = &state.ssh_manager;
    if !manager.is_connected() {
        return Err("没有活动的 SSH 连接".to_string());
    }

    let page = page.unwrap_or(1);
    let page_size = page_size.unwrap_or(100);

    let command = log_analysis::generate_journalctl_command(
        page, page_size,
        unit.as_deref(), filter.as_deref(),
        since.as_deref(), until.as_deref()
    );

    let output = manager.execute_dashboard_command(&command)
        .map_err(|e| format!("读取 journalctl 日志失败: {}", e))?;

    let entries: Vec<log_analysis::LogEntry> = output.output
        .lines()
        .filter(|line| !line.trim().is_empty() && !line.contains("journalctl not available"))
        .map(|line| log_analysis::parse_log_line(line, log_analysis::HIGHLIGHT_KEYWORDS))
        .collect();

    let highlighted_count = entries.iter().filter(|e| e.highlighted).count();

    let threat_summary = if with_analysis.unwrap_or(false) {
        Some(log_analysis::analyze_threats(&entries))
    } else {
        None
    };

    Ok(log_analysis::LogAnalysisResult {
        total_count: entries.len(),
        highlighted_count,
        entries,
        file_info: None,
        threat_summary,
    })
}

/// 多日志源关联分析
#[tauri::command]
pub async fn analyze_multi_log(
    log_paths: Vec<String>,
    line_limit: Option<usize>,
    state: State<'_, AppState>,
) -> Result<log_analysis::MultiLogResult, String> {
    let manager = &state.ssh_manager;
    if !manager.is_connected() {
        return Err("没有活动的 SSH 连接".to_string());
    }

    let limit = line_limit.unwrap_or(500);
    let commands = log_analysis::generate_multi_log_command(&log_paths, limit);

    let mut all_entries: Vec<log_analysis::LogEntry> = Vec::new();
    let mut sources: Vec<String> = Vec::new();

    // 用 batch 命令并行读取
    let batch_results = manager.execute_batch_commands(
        &commands.iter().map(|s| s.to_string()).collect::<Vec<_>>()
    ).map_err(|e| format!("关联分析失败: {}", e))?;

    for (i, result) in batch_results.iter().enumerate() {
        let source = log_paths.get(i).cloned().unwrap_or_default();
        sources.push(source.clone());

        if let Ok(output) = result {
            let entries: Vec<log_analysis::LogEntry> = output.output
                .lines()
                .filter(|line| !line.trim().is_empty())
                .map(|line| {
                    let mut entry = log_analysis::parse_log_line(line, log_analysis::HIGHLIGHT_KEYWORDS);
                    entry.source = Some(source.clone());
                    entry
                })
                .collect();
            all_entries.extend(entries);
        }
    }

    // 按时间戳排序（尽力而为 — 不同格式的时间戳可能无法精确排序）
    all_entries.sort_by(|a, b| a.timestamp.cmp(&b.timestamp));

    let threat_summary = Some(log_analysis::analyze_threats(&all_entries));
    let total_count = all_entries.len();

    Ok(log_analysis::MultiLogResult {
        entries: all_entries,
        total_count,
        sources,
        threat_summary,
    })
}

/// IOC 批量搜索
#[tauri::command]
pub async fn search_ioc_in_logs(
    indicators: Vec<String>,
    log_paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<log_analysis::IocSearchResult, String> {
    let manager = &state.ssh_manager;
    if !manager.is_connected() {
        return Err("没有活动的 SSH 连接".to_string());
    }

    let mut results: Vec<log_analysis::IocMatch> = Vec::new();
    let mut total_matches = 0usize;

    // 为每个 indicator x log_path 生成一条命令，用 batch 并行执行
    let mut commands: Vec<String> = Vec::new();
    let mut lookup: Vec<(String, String)> = Vec::new(); // (indicator, log_path)

    for indicator in &indicators {
        let clean = indicator.trim();
        if clean.is_empty() { continue; }
        for log_path in &log_paths {
            commands.push(log_analysis::generate_ioc_search_command(clean, log_path));
            lookup.push((clean.to_string(), log_path.clone()));
        }
    }

    if commands.is_empty() {
        return Ok(log_analysis::IocSearchResult { results, total_matches: 0 });
    }

    let batch_results = manager.execute_batch_commands(&commands)
        .map_err(|e| format!("IOC 搜索失败: {}", e))?;

    for (i, result) in batch_results.iter().enumerate() {
        if let Some((indicator, log_path)) = lookup.get(i) {
            if let Ok(output) = result {
                let lines: Vec<&str> = output.output.lines().collect();
                // 第一行是 grep -c 的结果（数字），后面是 grep -m 3 的匹配行
                let count = lines.first()
                    .and_then(|l| l.trim().parse::<usize>().ok())
                    .unwrap_or(0);

                if count > 0 {
                    let sample_lines: Vec<String> = lines.iter()
                        .skip(1)
                        .filter(|l| !l.trim().is_empty())
                        .take(3)
                        .map(|l| l.to_string())
                        .collect();

                    total_matches += count;
                    results.push(log_analysis::IocMatch {
                        indicator: indicator.clone(),
                        log_file: log_path.clone(),
                        count,
                        sample_lines,
                    });
                }
            }
        }
    }

    // 按匹配数降序
    results.sort_by(|a, b| b.count.cmp(&a.count));

    Ok(log_analysis::IocSearchResult { results, total_matches })
}

/// 列出可用的日志文件
#[tauri::command]
pub async fn list_log_files(
    state: State<'_, AppState>,
) -> Result<Vec<log_analysis::LogFileInfo>, String> {
    let manager = &state.ssh_manager;
    if !manager.is_connected() {
        return Err("没有活动的 SSH 连接".to_string());
    }

    let command = log_analysis::generate_list_log_files_command();
    let output = manager.execute_dashboard_command(&command)
        .map_err(|e| format!("列出日志文件失败: {}", e))?;

    let mut log_files: Vec<log_analysis::LogFileInfo> = output.output
        .lines()
        .filter_map(|line| {
            let parts: Vec<&str> = line.split('|').collect();
            if parts.len() >= 3 {
                let size = parts[0].parse::<u64>().unwrap_or(0);
                let path = parts[1].to_string();
                let name = path.split('/').last().unwrap_or(&path).to_string();
                let modified = parts[2].to_string();
                Some(log_analysis::LogFileInfo { path, name, size, modified, readable: true })
            } else {
                None
            }
        })
        .collect();

    for (path, name) in log_analysis::COMMON_LOG_FILES {
        if !log_files.iter().any(|f| f.path == *path) {
            log_files.push(log_analysis::LogFileInfo {
                path: path.to_string(),
                name: name.to_string(),
                size: 0, modified: String::new(), readable: false,
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
    let manager = &state.ssh_manager;
    if !manager.is_connected() {
        return Err("没有活动的 SSH 连接".to_string());
    }

    let command = log_analysis::generate_log_file_info_command(&log_path);
    let output = manager.execute_dashboard_command(&command)
        .map_err(|e| format!("获取日志文件信息失败: {}", e))?;

    let name = log_path.split('/').last().unwrap_or(&log_path).to_string();

    if output.output.contains("readable:no") {
        return Ok(log_analysis::LogFileInfo {
            path: log_path, name, size: 0, modified: String::new(), readable: false,
        });
    }

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
        path: log_path, name, size, modified, readable: true,
    })
}
