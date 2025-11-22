/**
 * 文件安全分析模块
 * 提供文件哈希、签名、权限、时间戳等分析功能
 * 通过 SSH 在远程服务器上执行分析命令
 */

use crate::ssh_manager::SSHManager;
use tauri::State;
use crate::AppState;

/// 执行文件安全分析（使用独立 session，不阻塞）
/// 注意：这个版本暂时使用共享 session，但通过异步执行避免阻塞
/// 未来可以扩展为使用独立连接
#[tauri::command]
pub async fn sftp_file_analysis_independent(
    action: String,
    file_path: String,
    state: State<'_, AppState>
) -> Result<serde_json::Value, String> {
    // 执行分析（使用共享 session）
    let result = {
        let mut ssh_manager = state.ssh_manager.lock().unwrap();
        execute_analysis_action(&mut ssh_manager, &action, &file_path)?
    };

    // 返回结果，包含命令信息和时间戳
    Ok(serde_json::json!({
        "action": action,
        "file_path": file_path,
        "result": result,
        "timestamp": chrono::Utc::now().format("%H:%M:%S").to_string()
    }))
}

/// 执行文件安全分析
#[tauri::command]
pub async fn sftp_file_analysis(
    action: String,
    file_path: String,
    state: State<'_, AppState>
) -> Result<String, String> {
    // 在 async 函数中，我们需要避免持有 MutexGuard 跨越 await 点
    // 所以我们在这里同步执行所有操作
    let result = {
        let mut ssh_manager = state.ssh_manager.lock().unwrap();

        match action.as_str() {
            // 基础信息模块
            "hash" => calculate_file_hash(&mut ssh_manager, &file_path),
            "signature" => analyze_file_signature(&mut ssh_manager, &file_path),
            "permissions" => analyze_file_permissions(&mut ssh_manager, &file_path),
            "timestamps" => analyze_file_timestamps(&mut ssh_manager, &file_path),
            "inode" => analyze_inode_info(&mut ssh_manager, &file_path),
            "mime-type" => analyze_mime_type(&mut ssh_manager, &file_path),
            "file-size" => analyze_file_size(&mut ssh_manager, &file_path),

            // 内容分析模块
            "strings" => extract_file_strings(&mut ssh_manager, &file_path),
            "hex-dump" => analyze_hex_dump(&mut ssh_manager, &file_path),
            "line-count" => count_file_lines(&mut ssh_manager, &file_path),
            "archive-list" => list_archive_contents(&mut ssh_manager, &file_path),
            "elf-header" => analyze_elf_header(&mut ssh_manager, &file_path),

            // 系统关联模块
            "processes" => find_related_processes(&mut ssh_manager, &file_path),
            "package-owner" => find_package_owner(&mut ssh_manager, &file_path),
            "hard-links" => find_hard_links(&mut ssh_manager, &file_path),
            "process-maps" => find_process_maps(&mut ssh_manager, &file_path),

            // 元数据与签名模块
            "xattr" => analyze_extended_attributes(&mut ssh_manager, &file_path),
            "capabilities" => analyze_file_capabilities(&mut ssh_manager, &file_path),
            "selinux-context" => analyze_selinux_context(&mut ssh_manager, &file_path),

            // 文件关系分析模块
            "dynamic-deps" => analyze_dynamic_dependencies(&mut ssh_manager, &file_path),
            "config-references" => find_config_references(&mut ssh_manager, &file_path),
            "symlink-analysis" => analyze_symlinks(&mut ssh_manager, &file_path),

            // 可疑检测模块
            "suspicious-path" => detect_suspicious_path(&mut ssh_manager, &file_path),
            "hidden-file" => detect_hidden_file(&mut ssh_manager, &file_path),
            "suid-sgid" => detect_suid_sgid(&mut ssh_manager, &file_path),
            "webshell" => detect_webshell(&mut ssh_manager, &file_path),
            "backdoor" => detect_backdoor(&mut ssh_manager, &file_path),
            "crypto-mining" => detect_crypto_mining(&mut ssh_manager, &file_path),
            "reverse-shell" => detect_reverse_shell(&mut ssh_manager, &file_path),

            _ => Err(format!("未知的分析动作: {}", action)),
        }
    }; // MutexGuard 在这里被释放

    result
}

/// 执行 SSH 命令的辅助函数
fn execute_ssh_command(ssh_manager: &mut SSHManager, command: &str) -> Result<String, String> {
    ssh_manager
        .execute_command(command)
        .map(|output| output.output.trim().to_string())
        .map_err(|e| format!("执行命令失败: {}", e))
}

/// 计算文件哈希值（MD5, SHA1, SHA256）
fn calculate_file_hash(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let mut result = String::new();
    let escaped_path = file_path.replace("'", "'\\''");

    // MD5
    let md5_cmd = format!("md5sum '{}'", escaped_path);
    if let Ok(output) = execute_ssh_command(ssh_manager, &md5_cmd) {
        if let Some(hash) = output.split_whitespace().next() {
            result.push_str(&format!("MD5:    {}\n", hash));
        }
    }

    // SHA1
    let sha1_cmd = format!("sha1sum '{}'", escaped_path);
    if let Ok(output) = execute_ssh_command(ssh_manager, &sha1_cmd) {
        if let Some(hash) = output.split_whitespace().next() {
            result.push_str(&format!("SHA1:   {}\n", hash));
        }
    }

    // SHA256
    let sha256_cmd = format!("sha256sum '{}'", escaped_path);
    if let Ok(output) = execute_ssh_command(ssh_manager, &sha256_cmd) {
        if let Some(hash) = output.split_whitespace().next() {
            result.push_str(&format!("SHA256: {}\n", hash));
        }
    }

    if result.is_empty() {
        Err("无法计算文件哈希值".to_string())
    } else {
        Ok(result)
    }
}


/// 分析文件签名（文件类型）
fn analyze_file_signature(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!("file -b '{}'", escaped_path);
    execute_ssh_command(ssh_manager, &cmd)
}

/// 分析文件权限
fn analyze_file_permissions(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!(
        "stat -c '权限: %a (%A)\n所有者: %U (UID: %u)\n所属组: %G (GID: %g)\n文件类型: %F' '{}'",
        escaped_path
    );
    execute_ssh_command(ssh_manager, &cmd)
}

/// 分析文件时间戳
fn analyze_file_timestamps(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!(
        "stat -c '访问时间: %x\n修改时间: %y\n状态改变时间: %z' '{}'",
        escaped_path
    );
    execute_ssh_command(ssh_manager, &cmd)
}

/// 提取文件中的可打印字符串
fn extract_file_strings(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!("strings -n 8 '{}' | head -n 100", escaped_path);
    let output = execute_ssh_command(ssh_manager, &cmd)?;

    let line_count = output.lines().count();
    Ok(format!("提取到字符串（显示前100个）:\n\n{}\n\n共 {} 行", output, line_count))
}

/// 查找使用该文件的进程
fn find_related_processes(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!("lsof '{}'", escaped_path);

    match execute_ssh_command(ssh_manager, &cmd) {
        Ok(output) => {
            if output.is_empty() {
                Ok("没有进程正在使用此文件".to_string())
            } else {
                Ok(output)
            }
        }
        Err(_) => Ok("没有进程正在使用此文件（或 lsof 命令不可用）".to_string())
    }
}

/// 检测可疑路径
fn detect_suspicious_path(_ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let suspicious_paths = vec![
        "/tmp", "/dev/shm", "/var/tmp",
        "/var/spool/cron", "/etc/cron",
        "/root/.ssh", "/home/*/.ssh"
    ];

    let mut result = String::from("路径分析:\n\n");
    result.push_str(&format!("文件路径: {}\n\n", file_path));

    let is_suspicious = suspicious_paths.iter().any(|p| file_path.starts_with(p));

    if is_suspicious {
        result.push_str("⚠️ 警告: 文件位于可疑路径！\n\n");
        result.push_str("可疑原因:\n");
        for path in &suspicious_paths {
            if file_path.starts_with(path) {
                result.push_str(&format!("- 位于 {} 目录（常见的临时文件或敏感配置目录）\n", path));
            }
        }
    } else {
        result.push_str("✓ 文件路径看起来正常\n");
    }

    Ok(result)
}

/// 检测隐藏文件
fn detect_hidden_file(_ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let file_name = file_path.rsplit('/').next().unwrap_or(file_path);

    let mut result = String::from("隐藏文件检测:\n\n");
    result.push_str(&format!("文件名: {}\n\n", file_name));

    if file_name.starts_with('.') {
        result.push_str("⚠️ 这是一个隐藏文件（以 . 开头）\n\n");
        result.push_str("隐藏文件可能被用于:\n");
        result.push_str("- 隐藏恶意软件\n");
        result.push_str("- 存储配置文件\n");
        result.push_str("- 隐藏后门程序\n");
    } else {
        result.push_str("✓ 这不是隐藏文件\n");
    }

    Ok(result)
}

/// 检测 SUID/SGID 权限
fn detect_suid_sgid(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!("stat -c '%a %A' '{}'", escaped_path);
    let output = execute_ssh_command(ssh_manager, &cmd)?;

    let mut result = String::from("SUID/SGID 检测:\n\n");
    result.push_str(&format!("权限信息: {}\n\n", output));

    if output.contains('s') || output.contains('S') {
        result.push_str("⚠️ 警告: 检测到 SUID 或 SGID 权限！\n\n");
        result.push_str("风险说明:\n");
        result.push_str("- SUID/SGID 文件以文件所有者权限执行\n");
        result.push_str("- 可能被用于权限提升攻击\n");
        result.push_str("- 需要仔细审查此文件的来源和用途\n");
    } else {
        result.push_str("✓ 未检测到 SUID/SGID 权限\n");
    }

    Ok(result)
}

/// 检测 Webshell 特征
fn detect_webshell(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");

    // Webshell 常见特征关键词
    let patterns = vec![
        "eval", "base64_decode", "gzinflate", "str_rot13",
        "assert", "system", "exec", "shell_exec", "passthru",
        "phpinfo", "move_uploaded_file", "\\$_POST", "\\$_GET",
        "<?php", "<?=", "<%", "asp:", "Response.Write"
    ];

    let pattern_str = patterns.join("|");
    let cmd = format!("grep -i -E '{}' '{}' | head -n 20", pattern_str, escaped_path);

    let mut result = String::from("Webshell 检测:\n\n");

    match execute_ssh_command(ssh_manager, &cmd) {
        Ok(output) => {
            if !output.is_empty() {
                result.push_str("⚠️ 警告: 检测到可疑的 Webshell 特征！\n\n");
                result.push_str("匹配的内容:\n");
                result.push_str(&output);
            } else {
                result.push_str("✓ 未检测到明显的 Webshell 特征\n");
            }
        }
        Err(_) => {
            result.push_str("✓ 未检测到明显的 Webshell 特征\n");
        }
    }

    Ok(result)
}

/// 检测后门特征
fn detect_backdoor(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");

    let patterns = vec![
        "nc -", "netcat", "/bin/bash", "/bin/sh",
        "socket", "connect", "bind", "listen",
        "reverse", "shell", "backdoor"
    ];

    let pattern_str = patterns.join("|");
    let cmd = format!("grep -i -E '{}' '{}' | head -n 20", pattern_str, escaped_path);

    let mut result = String::from("后门检测:\n\n");

    match execute_ssh_command(ssh_manager, &cmd) {
        Ok(output) => {
            if !output.is_empty() {
                result.push_str("⚠️ 警告: 检测到可疑的后门特征！\n\n");
                result.push_str("匹配的内容:\n");
                result.push_str(&output);
            } else {
                result.push_str("✓ 未检测到明显的后门特征\n");
            }
        }
        Err(_) => {
            result.push_str("✓ 未检测到明显的后门特征\n");
        }
    }

    Ok(result)
}

/// 检测挖矿程序特征
fn detect_crypto_mining(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");

    let patterns = vec![
        "stratum", "xmrig", "minerd", "cpuminer",
        "pool", "mining", "hashrate", "difficulty",
        "monero", "bitcoin", "ethereum"
    ];

    let pattern_str = patterns.join("|");
    let cmd = format!("grep -i -E '{}' '{}' | head -n 20", pattern_str, escaped_path);

    let mut result = String::from("挖矿程序检测:\n\n");

    match execute_ssh_command(ssh_manager, &cmd) {
        Ok(output) => {
            if !output.is_empty() {
                result.push_str("⚠️ 警告: 检测到可疑的挖矿程序特征！\n\n");
                result.push_str("匹配的内容:\n");
                result.push_str(&output);
            } else {
                result.push_str("✓ 未检测到明显的挖矿程序特征\n");
            }
        }
        Err(_) => {
            result.push_str("✓ 未检测到明显的挖矿程序特征\n");
        }
    }

    Ok(result)
}

/// 检测反弹 Shell 特征
fn detect_reverse_shell(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");

    let patterns = vec![
        "bash -i", "sh -i", "/dev/tcp", "/dev/udp",
        "nc -e", "ncat -e", "socat", "telnet",
        "python.*socket", "perl.*socket", "ruby.*socket"
    ];

    let pattern_str = patterns.join("|");
    let cmd = format!("grep -i -E '{}' '{}' | head -n 20", pattern_str, escaped_path);

    let mut result = String::from("反弹 Shell 检测:\n\n");

    match execute_ssh_command(ssh_manager, &cmd) {
        Ok(output) => {
            if !output.is_empty() {
                result.push_str("⚠️ 警告: 检测到可疑的反弹 Shell 特征！\n\n");
                result.push_str("匹配的内容:\n");
                result.push_str(&output);
            } else {
                result.push_str("✓ 未检测到明显的反弹 Shell 特征\n");
            }
        }
        Err(_) => {
            result.push_str("✓ 未检测到明显的反弹 Shell 特征\n");
        }
    }

    Ok(result)
}

// ==================== 基础信息模块 ====================

/// 分析 inode 信息
fn analyze_inode_info(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!(
        "stat -c 'Inode: %i\n硬链接数: %h\n设备号: %d\n文件大小: %s 字节\n块大小: %B\n块数: %b' '{}'",
        escaped_path
    );
    execute_ssh_command(ssh_manager, &cmd)
}

/// 分析 MIME 类型
fn analyze_mime_type(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!("file --mime-type -b '{}'", escaped_path);
    let mime_type = execute_ssh_command(ssh_manager, &cmd)?;

    let cmd2 = format!("file --mime-encoding -b '{}'", escaped_path);
    let encoding = execute_ssh_command(ssh_manager, &cmd2)?;

    Ok(format!("MIME 类型: {}\n编码: {}", mime_type, encoding))
}

/// 分析文件大小（详细）
fn analyze_file_size(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!(
        "stat -c '文件大小: %s 字节\n人类可读: %s\n块大小: %B 字节\n分配块数: %b\n实际占用: %b * %B = %b*%B 字节' '{}' | head -1",
        escaped_path
    );
    let size_info = execute_ssh_command(ssh_manager, &cmd)?;

    let cmd2 = format!("ls -lh '{}' | awk '{{print $5}}'", escaped_path);
    let human_size = execute_ssh_command(ssh_manager, &cmd2)?;

    Ok(format!("{}\n人类可读大小: {}", size_info, human_size))
}

// ==================== 内容分析模块 ====================

/// HEX 十六进制查看
fn analyze_hex_dump(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!("xxd -l 512 '{}'", escaped_path);
    let output = execute_ssh_command(ssh_manager, &cmd)?;
    Ok(format!("文件前 512 字节的十六进制内容:\n\n{}", output))
}

/// 统计文件行数
fn count_file_lines(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!("wc -l '{}' | awk '{{print $1}}'", escaped_path);
    let lines = execute_ssh_command(ssh_manager, &cmd)?;

    let cmd2 = format!("wc -w '{}' | awk '{{print $1}}'", escaped_path);
    let words = execute_ssh_command(ssh_manager, &cmd2)?;

    let cmd3 = format!("wc -c '{}' | awk '{{print $1}}'", escaped_path);
    let bytes = execute_ssh_command(ssh_manager, &cmd3)?;

    Ok(format!("行数: {}\n单词数: {}\n字节数: {}", lines, words, bytes))
}

/// 列出压缩文件内容
fn list_archive_contents(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");

    // 检测文件类型
    let file_type_cmd = format!("file -b '{}'", escaped_path);
    let file_type = execute_ssh_command(ssh_manager, &file_type_cmd)?;

    let cmd = if file_type.contains("gzip") || file_path.ends_with(".tar.gz") || file_path.ends_with(".tgz") {
        format!("tar -tzf '{}'", escaped_path)
    } else if file_type.contains("bzip2") || file_path.ends_with(".tar.bz2") {
        format!("tar -tjf '{}'", escaped_path)
    } else if file_type.contains("XZ") || file_path.ends_with(".tar.xz") {
        format!("tar -tJf '{}'", escaped_path)
    } else if file_type.contains("Zip") || file_path.ends_with(".zip") {
        format!("unzip -l '{}'", escaped_path)
    } else if file_type.contains("7-zip") || file_path.ends_with(".7z") {
        format!("7z l '{}'", escaped_path)
    } else {
        return Ok(format!("文件类型: {}\n\n不是支持的压缩文件格式", file_type));
    };

    match execute_ssh_command(ssh_manager, &cmd) {
        Ok(output) => Ok(format!("文件类型: {}\n\n压缩文件内容:\n{}", file_type, output)),
        Err(e) => Ok(format!("文件类型: {}\n\n无法列出内容: {}", file_type, e))
    }
}

/// 分析 ELF 文件头
fn analyze_elf_header(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");

    // 先检查是否是 ELF 文件
    let file_type_cmd = format!("file -b '{}'", escaped_path);
    let file_type = execute_ssh_command(ssh_manager, &file_type_cmd)?;

    if !file_type.contains("ELF") {
        return Ok(format!("文件类型: {}\n\n不是 ELF 可执行文件", file_type));
    }

    let cmd = format!("readelf -h '{}'", escaped_path);
    match execute_ssh_command(ssh_manager, &cmd) {
        Ok(output) => Ok(format!("ELF 文件头信息:\n\n{}", output)),
        Err(_) => {
            // 如果 readelf 不可用，尝试使用 objdump
            let cmd2 = format!("objdump -f '{}'", escaped_path);
            match execute_ssh_command(ssh_manager, &cmd2) {
                Ok(output) => Ok(format!("ELF 文件信息（objdump）:\n\n{}", output)),
                Err(e) => Err(format!("无法分析 ELF 文件: {}", e))
            }
        }
    }
}

// ==================== 系统关联模块 ====================

/// 查找文件所属的包
fn find_package_owner(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");

    // 尝试 RPM 系统（CentOS, RHEL, Fedora）
    let rpm_cmd = format!("rpm -qf '{}'", escaped_path);
    if let Ok(output) = execute_ssh_command(ssh_manager, &rpm_cmd) {
        if !output.contains("not owned") && !output.is_empty() {
            return Ok(format!("所属包（RPM）:\n{}", output));
        }
    }

    // 尝试 DEB 系统（Debian, Ubuntu）
    let dpkg_cmd = format!("dpkg -S '{}'", escaped_path);
    if let Ok(output) = execute_ssh_command(ssh_manager, &dpkg_cmd) {
        if !output.contains("no path found") && !output.is_empty() {
            return Ok(format!("所属包（DEB）:\n{}", output));
        }
    }

    Ok("文件不属于任何已安装的包（可能是用户自行安装或恶意文件）".to_string())
}

/// 查找硬链接
fn find_hard_links(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");

    // 获取 inode
    let inode_cmd = format!("stat -c '%i' '{}'", escaped_path);
    let inode = execute_ssh_command(ssh_manager, &inode_cmd)?;

    // 查找相同 inode 的文件
    let find_cmd = format!("find / -inum {} 2>/dev/null | head -n 20", inode.trim());
    let output = execute_ssh_command(ssh_manager, &find_cmd)?;

    if output.lines().count() > 1 {
        Ok(format!("Inode: {}\n\n找到以下硬链接:\n{}", inode, output))
    } else {
        Ok(format!("Inode: {}\n\n没有找到其他硬链接", inode))
    }
}

/// 查找进程内存映射
fn find_process_maps(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!("grep -l '{}' /proc/*/maps 2>/dev/null | head -n 10", escaped_path);

    match execute_ssh_command(ssh_manager, &cmd) {
        Ok(output) => {
            if output.is_empty() {
                Ok("没有进程在内存中映射此文件".to_string())
            } else {
                let mut result = String::from("以下进程在内存中映射了此文件:\n\n");
                for line in output.lines() {
                    if let Some(pid) = line.split('/').nth(2) {
                        let cmdline_cmd = format!("cat /proc/{}/cmdline 2>/dev/null | tr '\\0' ' '", pid);
                        if let Ok(cmdline) = execute_ssh_command(ssh_manager, &cmdline_cmd) {
                            result.push_str(&format!("PID {}: {}\n", pid, cmdline));
                        }
                    }
                }
                Ok(result)
            }
        }
        Err(_) => Ok("无法查询进程内存映射".to_string())
    }
}

// ==================== 元数据与签名模块 ====================

/// 分析扩展属性
fn analyze_extended_attributes(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!("getfattr -d '{}'", escaped_path);

    match execute_ssh_command(ssh_manager, &cmd) {
        Ok(output) => {
            if output.is_empty() || output.contains("No such file") {
                Ok("文件没有扩展属性".to_string())
            } else {
                Ok(format!("扩展属性:\n\n{}", output))
            }
        }
        Err(_) => Ok("无法读取扩展属性（getfattr 命令不可用）".to_string())
    }
}

/// 分析文件能力
fn analyze_file_capabilities(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!("getcap '{}'", escaped_path);

    match execute_ssh_command(ssh_manager, &cmd) {
        Ok(output) => {
            if output.is_empty() || output.contains("=") == false {
                Ok("文件没有特殊能力（capabilities）".to_string())
            } else {
                Ok(format!("⚠️ 文件具有特殊能力:\n\n{}\n\n这可能允许文件执行特权操作", output))
            }
        }
        Err(_) => Ok("无法读取文件能力（getcap 命令不可用）".to_string())
    }
}

/// 分析 SELinux 上下文
fn analyze_selinux_context(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");
    let cmd = format!("ls -Z '{}'", escaped_path);

    match execute_ssh_command(ssh_manager, &cmd) {
        Ok(output) => {
            if output.contains("?") || output.is_empty() {
                Ok("SELinux 未启用或文件没有安全上下文".to_string())
            } else {
                Ok(format!("SELinux 安全上下文:\n\n{}", output))
            }
        }
        Err(_) => Ok("无法读取 SELinux 上下文".to_string())
    }
}

// ==================== 文件关系分析模块 ====================

/// 分析动态依赖
fn analyze_dynamic_dependencies(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");

    // 先检查是否是 ELF 文件
    let file_type_cmd = format!("file -b '{}'", escaped_path);
    let file_type = execute_ssh_command(ssh_manager, &file_type_cmd)?;

    if !file_type.contains("ELF") {
        return Ok(format!("文件类型: {}\n\n不是 ELF 可执行文件，无法分析动态依赖", file_type));
    }

    let cmd = format!("ldd '{}'", escaped_path);
    match execute_ssh_command(ssh_manager, &cmd) {
        Ok(output) => Ok(format!("动态库依赖:\n\n{}", output)),
        Err(_) => {
            // 尝试使用 readelf
            let cmd2 = format!("readelf -d '{}' | grep NEEDED", escaped_path);
            match execute_ssh_command(ssh_manager, &cmd2) {
                Ok(output) => Ok(format!("动态库依赖（readelf）:\n\n{}", output)),
                Err(e) => Err(format!("无法分析动态依赖: {}", e))
            }
        }
    }
}

/// 查找配置文件引用
fn find_config_references(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let file_name = file_path.rsplit('/').next().unwrap_or(file_path);
    let escaped_name = file_name.replace("'", "'\\''");

    let cmd = format!("grep -r '{}' /etc 2>/dev/null | head -n 20", escaped_name);

    match execute_ssh_command(ssh_manager, &cmd) {
        Ok(output) => {
            if output.is_empty() {
                Ok(format!("在 /etc 目录下没有找到引用 '{}' 的配置文件", file_name))
            } else {
                Ok(format!("在 /etc 目录下找到以下引用:\n\n{}", output))
            }
        }
        Err(_) => Ok("无法搜索配置文件引用".to_string())
    }
}

/// 分析符号链接
fn analyze_symlinks(ssh_manager: &mut SSHManager, file_path: &str) -> Result<String, String> {
    let escaped_path = file_path.replace("'", "'\\''");

    // 检查文件本身是否是符号链接
    let cmd = format!("ls -l '{}'", escaped_path);
    let ls_output = execute_ssh_command(ssh_manager, &cmd)?;

    let mut result = String::new();

    if ls_output.starts_with('l') {
        // 是符号链接
        let readlink_cmd = format!("readlink -f '{}'", escaped_path);
        let target = execute_ssh_command(ssh_manager, &readlink_cmd)?;
        result.push_str(&format!("文件是符号链接\n\n链接信息:\n{}\n\n实际目标: {}\n\n", ls_output, target));
    } else {
        result.push_str("文件不是符号链接\n\n");
    }

    // 查找指向此文件的符号链接
    let find_cmd = format!("find / -type l -ls 2>/dev/null | grep '{}' | head -n 10", file_path);
    match execute_ssh_command(ssh_manager, &find_cmd) {
        Ok(output) => {
            if !output.is_empty() {
                result.push_str("找到以下指向此文件的符号链接:\n\n");
                result.push_str(&output);
            } else {
                result.push_str("没有找到指向此文件的符号链接");
            }
        }
        Err(_) => {
            result.push_str("无法搜索符号链接");
        }
    }

    Ok(result)
}

/// 执行分析动作的统一入口
fn execute_analysis_action(ssh_manager: &mut SSHManager, action: &str, file_path: &str) -> Result<String, String> {
    match action {
        // 基础信息模块
        "hash" => calculate_file_hash(ssh_manager, file_path),
        "signature" => analyze_file_signature(ssh_manager, file_path),
        "permissions" => analyze_file_permissions(ssh_manager, file_path),
        "timestamps" => analyze_file_timestamps(ssh_manager, file_path),
        "inode" => analyze_inode_info(ssh_manager, file_path),
        "mime-type" => analyze_mime_type(ssh_manager, file_path),
        "file-size" => analyze_file_size(ssh_manager, file_path),

        // 内容分析模块
        "strings" => extract_file_strings(ssh_manager, file_path),
        "hex-dump" => analyze_hex_dump(ssh_manager, file_path),
        "line-count" => count_file_lines(ssh_manager, file_path),
        "archive-list" => list_archive_contents(ssh_manager, file_path),
        "elf-header" => analyze_elf_header(ssh_manager, file_path),

        // 系统关联模块
        "processes" => find_related_processes(ssh_manager, file_path),
        "package-owner" => find_package_owner(ssh_manager, file_path),
        "hard-links" => find_hard_links(ssh_manager, file_path),
        "process-maps" => find_process_maps(ssh_manager, file_path),

        // 元数据与签名模块
        "xattr" => analyze_extended_attributes(ssh_manager, file_path),
        "capabilities" => analyze_file_capabilities(ssh_manager, file_path),
        "selinux-context" => analyze_selinux_context(ssh_manager, file_path),

        // 文件关系分析模块
        "dynamic-deps" => analyze_dynamic_dependencies(ssh_manager, file_path),
        "config-references" => find_config_references(ssh_manager, file_path),
        "symlink-analysis" => analyze_symlinks(ssh_manager, file_path),

        // 可疑检测模块
        "suspicious-path" => detect_suspicious_path(ssh_manager, file_path),
        "hidden-file" => detect_hidden_file(ssh_manager, file_path),
        "suid-sgid" => detect_suid_sgid(ssh_manager, file_path),
        "webshell" => detect_webshell(ssh_manager, file_path),
        "backdoor" => detect_backdoor(ssh_manager, file_path),
        "crypto-mining" => detect_crypto_mining(ssh_manager, file_path),
        "reverse-shell" => detect_reverse_shell(ssh_manager, file_path),

        _ => Err(format!("未知的分析动作: {}", action)),
    }
}

