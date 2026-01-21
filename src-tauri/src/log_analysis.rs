// 日志分析模块
// 用于读取和格式化Linux系统日志

use serde::{Deserialize, Serialize};

/// 日志条目
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    /// 时间戳
    pub timestamp: String,
    /// 日志级别
    pub level: String,
    /// 服务/进程名
    pub service: String,
    /// 日志内容
    pub message: String,
    /// 原始日志行
    pub raw: String,
    /// 是否高亮显示（匹配关键词）
    pub highlighted: bool,
}

/// 日志文件信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogFileInfo {
    /// 文件路径
    pub path: String,
    /// 文件名
    pub name: String,
    /// 文件大小（字节）
    pub size: u64,
    /// 最后修改时间
    pub modified: String,
    /// 是否可读
    pub readable: bool,
}

/// 日志分析结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogAnalysisResult {
    /// 日志条目列表
    pub entries: Vec<LogEntry>,
    /// 总条目数
    pub total_count: usize,
    /// 高亮条目数
    pub highlighted_count: usize,
    /// 日志文件信息
    pub file_info: Option<LogFileInfo>,
}

/// 常见的系统日志文件路径
pub const COMMON_LOG_FILES: &[(&str, &str)] = &[
    ("/var/log/auth.log", "认证日志"),
    ("/var/log/secure", "安全日志"),
    ("/var/log/syslog", "系统日志"),
    ("/var/log/messages", "系统消息"),
    ("/var/log/kern.log", "内核日志"),
    ("/var/log/cron", "计划任务日志"),
    ("/var/log/maillog", "邮件日志"),
    ("/var/log/boot.log", "启动日志"),
    ("/var/log/dmesg", "设备消息"),
    ("/var/log/audit/audit.log", "审计日志"),
];

/// 高亮关键词（用于检测可疑活动）
pub const HIGHLIGHT_KEYWORDS: &[&str] = &[
    "Failed password",
    "failed",
    "Failed",
    "FAILED",
    "Accepted",
    "accepted",
    "sudo",
    "SUDO",
    "authentication failure",
    "Invalid user",
    "invalid",
    "error",
    "Error",
    "ERROR",
    "warning",
    "Warning",
    "WARNING",
    "denied",
    "Denied",
    "DENIED",
    "unauthorized",
    "Unauthorized",
    "root",
    "ROOT",
    "attack",
    "Attack",
    "ATTACK",
    "intrusion",
    "Intrusion",
    "breach",
    "Breach",
];

/// 解析日志行
pub fn parse_log_line(line: &str, keywords: &[&str]) -> LogEntry {
    let highlighted = keywords.iter().any(|kw| line.contains(kw));
    
    // 尝试解析不同格式的日志
    // 格式1: syslog格式 - "Nov 22 19:43:01 hostname service[pid]: message"
    // 格式2: systemd格式 - "Nov 22 19:43:01 hostname systemd[1]: message"
    // 格式3: 简单格式 - "timestamp level message"
    
    let parts: Vec<&str> = line.splitn(2, |c: char| c == '[' || c == ':').collect();
    
    let (timestamp, service, message) = if parts.len() >= 2 {
        // 尝试提取时间戳（前3个字段通常是月 日 时间）
        let fields: Vec<&str> = line.split_whitespace().collect();
        let timestamp = if fields.len() >= 3 {
            format!("{} {} {}", fields.get(0).unwrap_or(&""), 
                    fields.get(1).unwrap_or(&""), 
                    fields.get(2).unwrap_or(&""))
        } else {
            String::new()
        };
        
        // 提取服务名（通常在时间戳和消息之间）
        let service = if fields.len() >= 5 {
            fields.get(4).unwrap_or(&"").trim_end_matches(':').to_string()
        } else {
            "unknown".to_string()
        };
        
        // 消息是剩余的部分
        let message = if let Some(pos) = line.find(':') {
            line[pos + 1..].trim().to_string()
        } else {
            line.to_string()
        };
        
        (timestamp, service, message)
    } else {
        (String::new(), "unknown".to_string(), line.to_string())
    };
    
    // 确定日志级别
    let level = if line.to_lowercase().contains("error") {
        "ERROR".to_string()
    } else if line.to_lowercase().contains("warn") {
        "WARN".to_string()
    } else if line.to_lowercase().contains("info") {
        "INFO".to_string()
    } else if line.to_lowercase().contains("debug") {
        "DEBUG".to_string()
    } else if line.to_lowercase().contains("fail") {
        "ERROR".to_string()
    } else {
        "INFO".to_string()
    };
    
    LogEntry {
        timestamp,
        level,
        service,
        message,
        raw: line.to_string(),
        highlighted,
    }
}

/// 生成获取日志的命令
/// 
/// 优化策略：
/// - 无过滤场景：使用 tail 从文件尾部读取，效率最高
/// - 有过滤场景：使用 tac（反向读取）+ grep 策略，避免读取整个文件
///   - tac 从文件尾部开始反向输出
///   - grep -m N 找到 N 个匹配后立即停止
///   - 对于用户通常只关心最新日志的场景，大幅减少 I/O
pub fn generate_log_read_command(log_path: &str, page: usize, page_size: usize, filter: Option<&str>, date_filter: Option<&str>) -> String {
    let total_lines = page * page_size;
    
    // 检查是否有过滤条件
    let has_filter = filter.map_or(false, |f| !f.trim().is_empty());
    let has_date_filter = date_filter.map_or(false, |d| !d.trim().is_empty());
    
    if !has_filter && !has_date_filter {
        // ========== 无过滤场景 ==========
        // 使用 tail 直接从文件尾部读取，这是最高效的方式
        // tail 输出顺序：旧 -> 新
        if page == 1 {
            format!("tail -n {} {} 2>/dev/null || echo 'Log file not found'", page_size, log_path)
        } else {
            format!("tail -n {} {} 2>/dev/null | head -n {} || echo 'Log file not found'", total_lines, log_path, page_size)
        }
    } else {
        // ========== 有过滤场景 ==========
        // 使用 tac 从文件尾部反向读取，配合 grep
        // 简化实现：直接使用 tac，不做复杂的回退检测
        
        // 构建 grep 过滤条件
        let mut grep_filters = Vec::new();
        if let Some(filter_text) = filter {
            let trimmed = filter_text.trim();
            if !trimmed.is_empty() {
                // 使用 -E 支持扩展正则，-i 忽略大小写
                grep_filters.push(format!("grep -iE '{}'", escape_grep_pattern(trimmed)));
            }
        }
        if let Some(date) = date_filter {
            let trimmed = date.trim();
            if !trimmed.is_empty() {
                grep_filters.push(format!("grep '{}'", escape_grep_pattern(trimmed)));
            }
        }
        
        let grep_chain = grep_filters.join(" | ");
        
        // 简化方案：直接使用 cat | grep | tail/head
        // 虽然效率不如 tac 方案，但语法简单可靠
        if page == 1 {
            format!(
                "cat {} 2>/dev/null | {} | tail -n {} || echo 'No matching entries'",
                log_path, grep_chain, page_size
            )
        } else {
            format!(
                "cat {} 2>/dev/null | {} | tail -n {} | head -n {} || echo 'No matching entries'",
                log_path, grep_chain, total_lines, page_size
            )
        }
    }
}

/// 转义 grep 模式中的特殊字符
fn escape_grep_pattern(pattern: &str) -> String {
    // 转义可能导致 shell 注入或 grep 语法错误的字符
    let mut escaped = String::with_capacity(pattern.len() * 2);
    for c in pattern.chars() {
        match c {
            '\'' => escaped.push_str("'\\''"),  // 单引号需要特殊处理
            '\\' | '$' | '`' | '"' | '!' => {
                escaped.push('\\');
                escaped.push(c);
            }
            _ => escaped.push(c),
        }
    }
    escaped
}

/// 生成获取journalctl日志的命令
pub fn generate_journalctl_command(page: usize, page_size: usize, unit: Option<&str>, filter: Option<&str>, since: Option<&str>, until: Option<&str>) -> String {
    // journalctl 默认是旧->新。使用 -r 可以反向（新->旧）。
    // 使用 -r 配合分页更方便。
    // journalctl -r -n (page * size) | tail -n size
    // 注意：journalctl -n 输出的是最后的 N 行。
    
    let mut cmd = String::from("journalctl --no-pager");
    
    if let Some(unit_name) = unit {
        if !unit_name.trim().is_empty() {
            cmd.push_str(&format!(" -u {}", unit_name));
        }
    }
    
    if let Some(s) = since {
        if !s.trim().is_empty() {
            cmd.push_str(&format!(" --since \"{}\"", s));
        }
    }
    
    if let Some(u) = until {
        if !u.trim().is_empty() {
            cmd.push_str(&format!(" --until \"{}\"", u));
        }
    }
    
    if let Some(filter_text) = filter {
        let trimmed = filter_text.trim();
        if !trimmed.is_empty() {
            cmd.push_str(&format!(" | grep -iE '{}'", escape_grep_pattern(trimmed)));
        }
    }
    
    // 分页逻辑
    let total_lines = page * page_size;
    
    // journalctl 本身没有方便的"跳过N行"的参数（除了cursor）。
    // 我们可以利用 tail/head 管道。
    // 假设我们要看最新的日志（倒序）。
    // 我们可以让 journalctl 输出所有（或足够多），然后用 tail 处理。
    // 或者使用 -n 参数。
    // page 1: journalctl -n 100
    // page 2: journalctl -n 200 | head -n 100 (取旧的部分)
    
    if page == 1 {
        cmd.push_str(&format!(" -n {}", page_size));
    } else {
        cmd.push_str(&format!(" -n {} | head -n {}", total_lines, page_size));
    }
    
    cmd.push_str(" 2>/dev/null || echo 'journalctl not available'");
    cmd
}

/// 生成获取日志文件列表的命令
pub fn generate_list_log_files_command() -> String {
    format!(
        r#"find /var/log -maxdepth 2 -type f \( -name "*.log" -o -name "messages" -o -name "secure" -o -name "syslog" -o -name "auth.log" \) -readable -exec stat -c "%s|%n|%Y" {{}} \; 2>/dev/null | head -50"#
    )
}

/// 生成获取日志文件信息的命令
pub fn generate_log_file_info_command(log_path: &str) -> String {
    format!(
        r#"stat -c "size:%s|modified:%y|readable:yes" {} 2>/dev/null || echo "readable:no""#,
        log_path
    )
}
