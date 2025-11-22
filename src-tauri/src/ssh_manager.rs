// LovelyRes SSH管理器


use crate::types::{LovelyResError, LovelyResResult, SSHCommand, SSHConnection};
use crate::ssh_channel_manager::{SSHChannelManager, SSHHealthMonitor};
use serde::{Deserialize, Serialize};
use ssh2::Session;
use std::collections::HashMap;
use std::fs;
use std::io::prelude::*;
use tauri::Emitter; // for window.emit
use std::sync::Arc;

use std::path::PathBuf;

/// SSH会话信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SSHSession {
    pub id: String,
    pub connection_id: String,
    pub created: chrono::DateTime<chrono::Utc>,
    pub last_activity: chrono::DateTime<chrono::Utc>,
    pub is_active: bool,
}

/// SFTP文件信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SftpFileInfo {
    pub name: String,
    pub path: String,
    pub file_type: String, // "file", "directory", "symlink"
    pub size: u64,
    pub permissions: String,
    pub modified: Option<String>,
    pub owner: Option<String>,
    pub group: Option<String>,
}

/// SFTP文件详细信息
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SftpFileDetails {
    pub name: String,
    pub path: String,
    pub file_type: String,
    pub size: u64,
    pub permissions: String,
    pub owner: Option<String>,
    pub group: Option<String>,
    pub created: Option<String>,
    pub modified: Option<String>,
    pub accessed: Option<String>,
}

/// SSH终端输出
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalOutput {
    pub command: String,
    pub output: String,
    pub exit_code: Option<i32>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// SSH连接状态
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SSHConnectionStatus {
    pub connected: bool,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub last_activity: chrono::DateTime<chrono::Utc>,
}

/// SSH管理器

pub struct SSHManager {
    connections: Vec<SSHConnection>,
    commands: Vec<SSHCommand>,
    active_sessions: HashMap<String, SSHSession>,
    current_session: Option<Session>,
    // 为实现 wait_socket 预留 TCP 副本（try_clone得到的句柄）
    current_tcp: Option<std::net::TcpStream>,
    current_connection_status: Option<SSHConnectionStatus>,

    // 仪表盘专用 session（保持阻塞模式，用于快速执行）
    dashboard_session: Option<Session>,

    // 交互式终端：每个终端的输入发送器
    terminal_senders: HashMap<String, std::sync::mpsc::Sender<Vec<u8>>>,

    // 最近一次用于直连的连接参数（用于自动重连）
    last_connection_params: Option<(String, u16, String, String)>,

    // Enhanced channel management
    channel_manager: Option<Arc<SSHChannelManager>>,
    health_monitor: Option<Arc<SSHHealthMonitor>>,
}

impl SSHManager {
    /// 创建新的SSH管理器
    pub fn new() -> Self {
        Self {
            connections: Vec::new(),
            commands: Self::get_default_commands(),
            active_sessions: HashMap::new(),
            current_session: None,
            current_tcp: None,
            current_connection_status: None,
            dashboard_session: None,
            terminal_senders: HashMap::new(),

            last_connection_params: None,
            channel_manager: None,
            health_monitor: None,
        }
    }

    /// 建立SSH连接
    pub fn connect(
        &mut self,
        host: &str,
        port: u16,
        username: &str,
        password: &str,
    ) -> LovelyResResult<()> {
        use std::net::{TcpStream, ToSocketAddrs, SocketAddr};

        let connect_start = std::time::Instant::now();
        println!("[SSH] 开始建立SSH连接到 {}@{}:{}", username, host, port);

        // 建立TCP连接 - 使用改进的地址解析策略
        let tcp_start = std::time::Instant::now();
        
        // 先尝试解析地址
        let address = format!("{}:{}", host, port);
        println!("[SSH] 正在解析地址: {}", address);
        
        let addrs: Vec<SocketAddr> = match address.to_socket_addrs() {
            Ok(addrs) => addrs.collect(),
            Err(e) => {
                return Err(LovelyResError::ConnectionError(
                    format!("无法解析主机地址 '{}': {}. 请检查主机名是否正确。", host, e)
                ));
            }
        };

        if addrs.is_empty() {
            return Err(LovelyResError::ConnectionError(
                format!("无法解析主机地址 '{}': 没有找到有效的IP地址", host)
            ));
        }

        // 优先尝试 IPv4 地址，然后再尝试 IPv6
        let mut sorted_addrs = addrs.clone();
        sorted_addrs.sort_by_key(|addr| if addr.is_ipv4() { 0 } else { 1 });
        
        println!("[SSH] 解析到 {} 个地址: {:?}", sorted_addrs.len(), sorted_addrs);

        // 尝试连接所有解析到的地址
        let mut last_error = None;
        let mut tcp = None;
        
        for (i, addr) in sorted_addrs.iter().enumerate() {
            println!("[SSH] 尝试连接到地址 {} ({}/{}): {}", addr, i + 1, sorted_addrs.len(), addr);
            
            match TcpStream::connect_timeout(addr, std::time::Duration::from_secs(10)) {
                Ok(stream) => {
                    println!("[SSH] TCP连接成功: {} (耗时: {:?})", addr, tcp_start.elapsed());
                    tcp = Some(stream);
                    break;
                }
                Err(e) => {
                    println!("[SSH] 连接到 {} 失败: {}", addr, e);
                    last_error = Some(e);
                }
            }
        }

        let tcp = match tcp {
            Some(t) => t,
            None => {
                let error_msg = if let Some(e) = last_error {
                    format!("TCP连接失败: {}. 已尝试 {} 个地址。\n\n可能的原因:\n1. 服务器端口 {} 未开放或被防火墙拦截\n2. 主机地址不可达\n3. Windows防火墙拦截了本应用的网络访问\n\n解决建议:\n1. 确认服务器SSH服务正常运行 (ssh {}@{} -p {})\n2. 检查Windows防火墙是否允许本应用访问网络\n3. 尝试在防火墙中为本应用添加例外规则", 
                        e, sorted_addrs.len(), port, username, host, port)
                } else {
                    format!("TCP连接失败: 无法连接到任何地址")
                };
                return Err(LovelyResError::ConnectionError(error_msg));
            }
        };

        // 设置TCP_NODELAY以减少延迟
        let nodelay_start = std::time::Instant::now();
        let _ = tcp.set_nodelay(true);
        //println!("[PERF] TCP_NODELAY设置耗时: {:?}", nodelay_start.elapsed());

        // 为 wait_socket 预留一份 TCP 副本（不参与读写，仅用于未来就绪等待）
        let tcp_clone = tcp.try_clone().ok();

        // 创建SSH会话
        let session_start = std::time::Instant::now();
        let mut session = Session::new()
            .map_err(|e| LovelyResError::ConnectionError(format!("创建SSH会话失败: {}", e)))?;
        //println!("[PERF] SSH会话创建耗时: {:?}", session_start.elapsed());

        let stream_start = std::time::Instant::now();
        session.set_tcp_stream(tcp);
        //println!("[PERF] 设置TCP流耗时: {:?}", stream_start.elapsed());

        // 记录 TCP 副本
        self.current_tcp = tcp_clone;

        let handshake_start = std::time::Instant::now();
        session
            .handshake()
            .map_err(|e| LovelyResError::ConnectionError(format!("SSH握手失败: {}", e)))?;
        //println!("[PERF] SSH握手耗时: {:?}", handshake_start.elapsed());

        // 完全禁用 keepalive，避免干扰快速输入
        let keepalive_start = std::time::Instant::now();
        let _ = session.set_keepalive(false, 0);
        //println!("[PERF] Keepalive禁用耗时: {:?}", keepalive_start.elapsed());

        // 设置SSH会话超时时间为0（完全禁用超时）
        let timeout_start = std::time::Instant::now();
        session.set_timeout(0);
        //println!("[PERF] SSH超时禁用耗时: {:?}", timeout_start.elapsed());

        // 用户名密码认证
        let auth_start = std::time::Instant::now();
        session
            .userauth_password(username, password)
            .map_err(|e| LovelyResError::AuthenticationError(format!("SSH认证失败: {}", e)))?;
        //println!("[PERF] SSH认证耗时: {:?}", auth_start.elapsed());

        if !session.authenticated() {
            return Err(LovelyResError::AuthenticationError(
                "SSH认证失败".to_string(),
            ));
        }

        // 保存连接状态
        self.current_session = Some(session.clone());
        self.current_connection_status = Some(SSHConnectionStatus {
            connected: true,
            host: host.to_string(),
            port,
            username: username.to_string(),
            last_activity: chrono::Utc::now(),
        });
        // 记录最近直连参数用于自动重连
        self.last_connection_params = Some((host.to_string(), port, username.to_string(), password.to_string()));

        // 创建仪表盘专用 session（保持阻塞模式）
        self.create_dashboard_session(host, port, username, password)?;

        // Initialize enhanced channel management
        let channel_manager = Arc::new(SSHChannelManager::new(session));
        let health_monitor = Arc::new(SSHHealthMonitor::new(channel_manager.clone()));

        // Start health monitoring
        health_monitor.start_monitoring();

        self.channel_manager = Some(channel_manager);
        self.health_monitor = Some(health_monitor);

        //println!("[PERF] SSH连接建立完成，总耗时: {:?}", connect_start.elapsed());
        Ok(())
    }

    /// 断开SSH连接
    pub fn disconnect(&mut self) -> LovelyResResult<()> {
        // Stop health monitoring
        if let Some(health_monitor) = self.health_monitor.take() {
            health_monitor.stop_monitoring();
        }

        // Clear channel manager
        self.channel_manager = None;

        if let Some(session) = self.current_session.take() {
            let _ = session.disconnect(None, "User requested disconnect", None);
        }
        self.current_connection_status = None;
        Ok(())
    }

    /// 检查连接状态
    pub fn is_connected(&self) -> bool {
        self.current_connection_status
            .as_ref()
            .map_or(false, |status| status.connected)
    }

    /// 获取连接状态
    pub fn get_connection_status(&self) -> Option<&SSHConnectionStatus> {
        self.current_connection_status.as_ref()
    }


    /// 创建或重新创建仪表盘专用 session
    fn create_dashboard_session(
        &mut self,
        host: &str,
        port: u16,
        username: &str,
        password: &str,
    ) -> LovelyResResult<()> {
        use std::net::TcpStream;

        println!("📊 [仪表盘] 创建专用 session...");
        let dashboard_tcp = TcpStream::connect(format!("{}:{}", host, port))
            .map_err(|e| LovelyResError::ConnectionError(format!("仪表盘TCP连接失败: {}", e)))?;
        let _ = dashboard_tcp.set_nodelay(true);

        let mut dashboard_session = Session::new()
            .map_err(|e| LovelyResError::ConnectionError(format!("创建仪表盘SSH会话失败: {}", e)))?;
        dashboard_session.set_tcp_stream(dashboard_tcp);
        dashboard_session.handshake()
            .map_err(|e| LovelyResError::ConnectionError(format!("仪表盘SSH握手失败: {}", e)))?;
        let _ = dashboard_session.set_keepalive(false, 0);
        dashboard_session.set_timeout(0);
        dashboard_session.userauth_password(username, password)
            .map_err(|e| LovelyResError::AuthenticationError(format!("仪表盘SSH认证失败: {}", e)))?;

        // 确保仪表盘 session 是阻塞模式
        dashboard_session.set_blocking(true);
        self.dashboard_session = Some(dashboard_session);
        println!("✅ [仪表盘] 专用 session 创建完成，阻塞模式: true");

        Ok(())
    }

    /// 执行仪表盘命令（快速执行，使用专用 session）
    /// 仪表盘命令通常是快速的系统信息查询，应该尽可能快地返回结果
    /// 使用专用的仪表盘 session（保持阻塞模式），避免与终端 session 冲突
    pub fn execute_dashboard_command(&mut self, command: &str) -> LovelyResResult<TerminalOutput> {
        ///println!("📊 [仪表盘] 使用专用 session 快速执行: {}", command);
        self.execute_with_dashboard_session(command)
    }

    /// 以指定用户身份执行仪表盘命令
    /// 如果指定了username，则使用sudo -u切换用户执行
    pub fn execute_dashboard_command_as_user(&mut self, command: &str, username: Option<&str>) -> LovelyResResult<TerminalOutput> {
        let final_command = if let Some(user) = username {
            // 使用sudo -u切换用户执行命令
            // 使用su -c作为备选方案（如果sudo不可用）
            format!("if command -v sudo &>/dev/null; then sudo -u {} bash -c '{}'; else su - {} -c '{}'; fi",
                user,
                command.replace("'", "'\\''"),
                user,
                command.replace("'", "'\\''"))
        } else {
            command.to_string()
        };

        if username.is_some() {
            println!("👤 [权限切换] 以用户 '{}' 身份执行: {}", username.unwrap(), command);
        }

        self.execute_with_dashboard_session(&final_command)
    }

    /// 执行 Docker 命令（快速执行，使用专用 session）
    /// Docker 命令也使用仪表盘专用 session，保证快速执行
    pub fn execute_docker_command(&mut self, command: &str) -> LovelyResResult<TerminalOutput> {
        println!("🐳 [Docker] 使用专用 session 快速执行: {}", command);
        self.execute_with_dashboard_session(command)
    }

    /// 使用仪表盘专用 session 执行命令（内部方法）
    fn execute_with_dashboard_session(&mut self, command: &str) -> LovelyResResult<TerminalOutput> {
        // 使用仪表盘专用 session
        if let Some(dashboard_session) = self.dashboard_session.as_mut() {
            // 使用 bash 执行命令
            let shell_command = format!("bash -c '{}'", command.replace("'", "'\\''"));

            // 创建通道
            let mut channel = dashboard_session
                .channel_session()
                .map_err(|e| LovelyResError::SSHError(format!("创建通道失败: {}", e)))?;

            // 执行命令
            channel.exec(&shell_command)
                .map_err(|e| LovelyResError::SSHError(format!("执行命令失败: {}", e)))?;

            // 读取输出
            let mut output = String::new();
            channel.read_to_string(&mut output)
                .map_err(|e| LovelyResError::SSHError(format!("读取输出失败: {}", e)))?;

            // 等待关闭
            channel.wait_close()
                .map_err(|e| LovelyResError::SSHError(format!("等待关闭失败: {}", e)))?;

            let exit_code = channel.exit_status().ok();

            return Ok(TerminalOutput {
                command: command.to_string(),
                output,
                exit_code,
                timestamp: chrono::Utc::now(),
            });
        }

        // 如果没有仪表盘 session，返回错误
        Err(LovelyResError::SSHError("仪表盘 session 未初始化".to_string()))
    }

    /// 执行SSH命令（智能选择连接方式）
    /// 用于应急响应等需要独立连接的场景
    pub fn execute_command(&mut self, command: &str) -> LovelyResResult<TerminalOutput> {
        let has_terminal_sessions = !self.terminal_senders.is_empty();
        let has_independent_params = self.last_connection_params.is_some();

        // 检查 session 的阻塞状态
        let session_blocking = self.current_session.as_ref().map(|s| s.is_blocking()).unwrap_or(true);

        // 如果 session 是非阻塞的（通常是因为创建过终端会话），强制使用独立连接
        // 因为在非阻塞 session 上切换到阻塞模式会导致读取卡住
        if !session_blocking {
            println!("⚠️ Session 处于非阻塞模式，强制使用独立连接执行命令");

            if !has_independent_params {
                return Err(LovelyResError::SSHError(
                    "Session 处于非阻塞模式但没有独立连接参数，无法执行命令".to_string()
                ));
            }

            return self.execute_command_with_independent_connection(command);
        }

        // 如果有活跃终端会话，强制使用独立连接（避免阻塞状态冲突）
        if has_terminal_sessions {
            println!(
                "🔄 检测到活跃终端会话 ({}个)，强制使用独立连接执行命令",
                self.terminal_senders.len()
            );

            if !has_independent_params {
                return Err(LovelyResError::SSHError(
                    "有活跃终端会话但没有独立连接参数，无法执行命令".to_string()
                ));
            }

            return self.execute_command_with_independent_connection(command);
        }

        // 其他情况：优先使用独立连接执行
        if has_independent_params {
            println!("🔄 使用独立连接执行命令，保持主SSH会话空闲");

            match self.execute_command_with_independent_connection(command) {
                Ok(output) => return Ok(output),
                Err(e) => {
                    println!("⚠️ 独立连接执行失败: {}, 尝试使用主连接", e);
                    // 继续尝试使用主连接
                }
            }
        }

        // 独立连接不可用或执行失败时，使用主连接执行
        self.execute_command_with_main_connection(command)
    }

    /// 判断是否为仪表盘/系统信息查询命令
    /// 这些命令需要快速执行，应该直接使用主连接而不是创建独立连接
    fn is_dashboard_command(&self, command: &str) -> bool {
        // 常见的系统信息查询命令关键词
        let dashboard_keywords = [
            "hostname",
            "uptime",
            "/proc/loadavg",
            "/proc/meminfo",
            "/proc/cpuinfo",
            "df -h",
            "ps aux",
            "ps -p 1",  // 检测 init 系统
            "who",
            "ip addr",
            "ip route",
            "/etc/resolv.conf",
            "systemctl list",
            "getent passwd",
            "crontab -l",
            "netstat",
            "ss -",
            "nproc",
            "cat /etc/os-release",
            "cat /etc/lsb-release",
            "lsb_release",
            "which apt",  // 检测包管理器
            "which yum",
            "which dnf",
            "which pacman",
            "which zypper",
            "which apk",
            "free -",
            "vmstat",
            "iostat",
            "top -bn1",
        ];

        // 检查命令是否包含任何仪表盘关键词
        dashboard_keywords.iter().any(|keyword| command.contains(keyword))
    }

    /// 使用独立SSH连接执行命令（不影响主连接和终端会话）
    fn execute_command_with_independent_connection(&self, command: &str) -> LovelyResResult<TerminalOutput> {
        use std::io::prelude::*;
        use ssh2::Session;
        use std::net::TcpStream;

        // 获取存储的连接参数（包含密码）
        let (host, port, username, password) = self.last_connection_params.as_ref()
            .ok_or_else(|| LovelyResError::ConnectionError("没有存储的连接参数".to_string()))?;

        println!("🔗 创建独立SSH连接执行命令: {}", command);

        // 创建新的TCP连接
        let tcp = TcpStream::connect(format!("{}:{}", host, port))
            .map_err(|e| LovelyResError::ConnectionError(format!("TCP连接失败: {}", e)))?;

        // 创建新的SSH会话
        let mut session = Session::new()
            .map_err(|e| LovelyResError::SSHError(format!("创建SSH会话失败: {}", e)))?;

        session.set_tcp_stream(tcp);
        session.handshake()
            .map_err(|e| LovelyResError::SSHError(format!("SSH握手失败: {}", e)))?;

        // 认证
        session.userauth_password(username, password)
            .map_err(|e| LovelyResError::AuthenticationError(format!("认证失败: {}", e)))?;

        // 安全检查
        if !self.is_command_safe(command) {
            return Err(LovelyResError::SSHError(
                "命令包含潜在危险内容，执行被拒绝".to_string(),
            ));
        }

        // 执行命令（独立会话，可以安全使用阻塞模式）
        let escaped_command = self.escape_shell_command(command);
        let shell_command = format!("bash -lc {}", escaped_command);

        let mut channel = session.channel_session()
            .map_err(|e| LovelyResError::SSHError(format!("创建通道失败: {}", e)))?;

        println!("🐚 独立连接执行命令: {}", command);

        channel.exec(&shell_command)
            .map_err(|e| LovelyResError::SSHError(format!("执行命令失败: {}", e)))?;

        let mut output = String::new();
        let mut stderr = String::new();

        // 读取输出
        channel.read_to_string(&mut output)
            .map_err(|e| LovelyResError::SSHError(format!("读取输出失败: {}", e)))?;

        // 读取错误输出
        channel.stderr().read_to_string(&mut stderr)
            .map_err(|e| LovelyResError::SSHError(format!("读取错误输出失败: {}", e)))?;

        // 等待命令完成
        channel.wait_close()
            .map_err(|e| LovelyResError::SSHError(format!("等待命令完成失败: {}", e)))?;

        let exit_code = channel.exit_status()
            .map_err(|e| LovelyResError::SSHError(format!("获取退出状态失败: {}", e)))?;

        println!("✅ 独立连接命令执行完成，退出码: {}", exit_code);

        Ok(TerminalOutput {
            command: command.to_string(),
            output: if stderr.is_empty() { output } else { format!("{}\n{}", output, stderr) },
            exit_code: Some(exit_code),
            timestamp: chrono::Utc::now(),
        })
    }

    /// 使用主连接执行命令（仅在没有终端会话时使用）
    fn execute_command_with_main_connection(&mut self, command: &str) -> LovelyResResult<TerminalOutput> {
        // 首先尝试使用 bash -lc 执行命令
        let bash_result = self.try_execute_with_shell(command, "bash");

        match bash_result {
            Ok(output) => {
                println!("✅ 使用 bash 执行成功");
                Ok(output)
            }
            Err(e) => {
                // 如果 bash 失败，检查是否是因为 bash 不存在
                let error_msg = e.to_string().to_lowercase();
                let is_bash_not_found = error_msg.contains("bash: command not found")
                    || error_msg.contains("bash: not found")
                    || error_msg.contains("/bin/bash: no such file")
                    || error_msg.contains("bash: no such file")
                    || error_msg.contains("which: bash: not found")
                    || error_msg.contains("command not found: bash");

                if is_bash_not_found {
                    println!("⚠️ bash 不可用，回退到 sh");
                    // 回退到 sh -lc
                    match self.try_execute_with_shell(command, "sh") {
                        Ok(output) => {
                            println!("✅ 使用 sh 执行成功");
                            Ok(output)
                        }
                        Err(sh_error) => {
                            println!("❌ sh 也执行失败: {}", sh_error);
                            Err(sh_error)
                        }
                    }
                } else {
                    // 其他错误直接返回（可能是命令本身的错误，不是 shell 不存在）
                    println!("❌ bash 执行失败（非 shell 不存在）: {}", e);
                    Err(e)
                }
            }
        }
    }

    /// 使用指定的 shell 执行命令
    fn try_execute_with_shell(
        &mut self,
        command: &str,
        shell: &str,
    ) -> LovelyResResult<TerminalOutput> {
        use std::io::prelude::*;

        // 安全检查
        if !self.is_command_safe(command) {
            return Err(LovelyResError::SSHError(
                "命令包含潜在危险内容，执行被拒绝".to_string(),
            ));
        }

        // 安全转义命令内容（在获取session引用之前）
        let escaped_command = self.escape_shell_command(command);
        let shell_command = format!("{} -lc {}", shell, escaped_command);

        // 在创建通道前，确保会话存活；若断开则自动重连一次
        self.ensure_session_alive_and_reconnect_if_needed()?;

        let session = self
            .current_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("未建立SSH连接".to_string()))?;

        // 检查是否有活跃的终端会话
        let has_terminals = !self.terminal_senders.is_empty();

        // 如果有终端会话，记录警告但仍然允许使用主连接（作为后备方案）
        if has_terminals {
            println!("⚠️ 检测到活跃终端会话 ({}个)，但仍使用主连接执行命令（后备方案）", self.terminal_senders.len());
        }

        // 保存原始阻塞状态
        let original_blocking = session.is_blocking();
        println!("📍 [命令执行] 原始阻塞状态: {}, 有终端: {}", original_blocking, has_terminals);

        // 重要：不要临时切换阻塞模式！
        // 在非阻塞 session 上切换到阻塞模式会导致读取卡住
        // 如果 session 是非阻塞的，应该使用独立连接（在 execute_command 中已经处理）
        if !original_blocking {
            println!("⚠️ [命令执行] Session 是非阻塞模式，不应该使用主连接！");
            return Err(LovelyResError::SSHError(
                "Session 处于非阻塞模式，不能使用主连接执行命令".to_string()
            ));
        }

        // 创建通道
        println!("📍 [命令执行] 开始创建通道...");
        let mut channel = session
            .channel_session()
            .map_err(|e| {
                println!("❌ [命令执行] 创建通道失败: {}", e);
                LovelyResError::SSHError(format!("创建通道失败: {}", e))
            })?;
        println!("✅ [命令执行] 通道创建成功");

        // 设置通道窗口大小以提高性能
        if let Err(e) = channel.adjust_receive_window(65536, false) {
            return Err(LovelyResError::SSHError(format!("调整接收窗口失败: {}", e)));
        }

        println!("🐚 执行命令: {} (使用 {})", command, shell);

        if let Err(e) = channel.exec(&shell_command) {
            return Err(LovelyResError::SSHError(format!("执行命令失败: {}", e)));
        }

        println!("📍 [命令执行] 命令已发送，开始读取输出...");

        let mut output = String::new();
        let mut stderr = String::new();

        // 读取标准输出
        println!("📍 [命令执行] 读取标准输出...");
        let read_result = channel.read_to_string(&mut output);
        if let Err(e) = read_result {
            return Err(LovelyResError::SSHError(format!("读取输出失败: {}", e)));
        }

        // 读取标准错误
        let stderr_result = channel.stderr().read_to_string(&mut stderr);
        if let Err(e) = stderr_result {
            return Err(LovelyResError::SSHError(format!("读取错误输出失败: {}", e)));
        }

        let wait_result = channel.wait_close();
        if let Err(e) = wait_result {
            return Err(LovelyResError::SSHError(format!("等待关闭失败: {}", e)));
        }

        let exit_code = channel.exit_status().ok();

        // 如果有错误输出且命令失败，将错误信息包含在输出中
        let final_output = if !stderr.is_empty() && exit_code.unwrap_or(0) != 0 {
            if output.is_empty() {
                stderr
            } else {
                format!("{}\n{}", output, stderr)
            }
        } else {
            output
        };

        Ok(TerminalOutput {
            command: command.to_string(),
            output: final_output,
            exit_code,
            timestamp: chrono::Utc::now(),
        })
    }

    /// 安全转义 shell 命令
    fn escape_shell_command(&self, command: &str) -> String {
        // 如果命令为空，返回空字符串
        if command.is_empty() {
            return "''".to_string();
        }

        // 检查命令是否只包含安全字符（字母、数字、常见符号）
        let safe_chars = command
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || " .-_/=:@".contains(c) || c == '\t' || c == '\n');

        if safe_chars && !command.contains("'") {
            // 如果命令只包含安全字符且没有单引号，可以直接使用单引号包围
            format!("'{}'", command)
        } else {
            // 对于包含特殊字符的命令，使用更安全的转义方法
            // 将单引号替换为 '"'"'，这样可以安全地在单引号字符串中包含单引号
            let escaped = command.replace("'", r#"'"'"'"#);
            format!("'{}'", escaped)
        }
    }

    /// 检查命令是否可能包含恶意内容
    /// 注意：大部分安全限制已移除，仅保留最极端的危险模式检测
    fn is_command_safe(&self, command: &str) -> bool {
        // 仅检查极端危险的模式
        let very_dangerous_patterns = [
            ":(){ :|:& };:", // fork bomb
        ];

        let command_lower = command.to_lowercase();

        // 检查极端危险模式
        for pattern in &very_dangerous_patterns {
            if command_lower.contains(pattern) {
                println!("⚠️ 检测到极度危险命令模式: {}", pattern);
                return false;
            }
        }

        // 检查命令长度（防止过长的命令，提高限制到256KB）
        if command.len() > 262144 {
            println!("⚠️ 命令过长（超过256KB），可能存在风险");
            return false;
        }

        true
    }

    /// 获取 Bash 环境信息
    pub fn get_bash_environment_info(
        &mut self,
    ) -> LovelyResResult<crate::types::BashEnvironmentInfo> {
        // 获取各种环境信息
        let bash_version_result = self.try_execute_with_shell("echo $BASH_VERSION", "bash");
        let shell_type = if bash_version_result.is_ok() {
            "bash"
        } else {
            "sh"
        };

        let bash_version = bash_version_result
            .map(|output| output.output.trim().to_string())
            .unwrap_or_else(|_| "sh (bash not available)".to_string());

        let ps1_output = self.try_execute_with_shell("echo \"$PS1\"", shell_type)?;
        let pwd_output = self.try_execute_with_shell("pwd", shell_type)?;
        let home_output = self.try_execute_with_shell("echo \"$HOME\"", shell_type)?;
        let user_output = self.try_execute_with_shell("whoami", shell_type)?;
        let hostname_output = self.try_execute_with_shell("hostname", shell_type)?;
        let path_output = self.try_execute_with_shell("echo \"$PATH\"", shell_type)?;

        Ok(crate::types::BashEnvironmentInfo {
            bash_version,
            shell_type: shell_type.to_string(),
            ps1: ps1_output.output.trim().to_string(),
            pwd: pwd_output.output.trim().to_string(),
            home: home_output.output.trim().to_string(),
            user: user_output.output.trim().to_string(),
            hostname: hostname_output.output.trim().to_string(),
            path: path_output.output.trim().to_string(),
        })
    }

    /// 获取命令补全建议
    pub fn get_command_completion(
        &mut self,
        input: &str,
    ) -> LovelyResResult<crate::types::CommandCompletion> {
        // 解析输入，获取需要补全的部分
        let parts: Vec<&str> = input.split_whitespace().collect();
        let (prefix, completion_type) = if parts.is_empty() {
            ("", "command")
        } else if input.ends_with(' ') {
            ("", "file")
        } else {
            let last_part = parts.last().unwrap();
            if parts.len() == 1 {
                (*last_part, "command")
            } else {
                (*last_part, "file")
            }
        };

        // 使用 compgen 获取补全建议


        let compgen_cmd = match completion_type {
            "command" => format!("compgen -c '{}'", prefix),
            _ => format!("compgen -f '{}'", prefix),
        };

        let result = self
            .try_execute_with_shell(&compgen_cmd, "bash")
            .or_else(|_| self.try_execute_with_shell(&compgen_cmd, "sh"))?;

        let completions: Vec<String> = result
            .output
            .lines()
            .map(|line| line.trim().to_string())
            .filter(|line| !line.is_empty())
            .collect();

        Ok(crate::types::CommandCompletion {
            completions,
            prefix: prefix.to_string(),
        })
    }

    /// 获取SFTP文件列表（使用仪表盘专用 session）
    pub fn list_sftp_files(&mut self, path: &str) -> LovelyResResult<Vec<SftpFileInfo>> {
        println!("📁 [SFTP] 使用专用 session 列出文件: {}", path);
        self.list_sftp_files_with_dashboard_session(path)
    }


    /// 使用仪表盘专用 session 执行SFTP文件列表操作
    fn list_sftp_files_with_dashboard_session(&mut self, path: &str) -> LovelyResResult<Vec<SftpFileInfo>> {
        // 检查 dashboard_session 是否存在且健康
        let session_healthy = if let Some(session) = self.dashboard_session.as_ref() {
            session.authenticated()
        } else {
            false
        };

        // 如果 session 不健康，尝试重新创建
        if !session_healthy {
            println!("⚠️ [SFTP] Dashboard session 不健康，尝试重新创建...");
            if let Some((host, port, username, password)) = self.last_connection_params.clone() {
                let _ = self.create_dashboard_session(&host, port, &username, &password);
            } else {
                return Err(LovelyResError::ConnectionError("无法重新创建 dashboard session：缺少连接参数".to_string()));
            }
        }

        let session = self
            .dashboard_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("仪表盘 session 未初始化".to_string()))?;

        let sftp = session
            .sftp()
            .map_err(|e| LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e)))?;

        // 读取目录内容
        let mut files = Vec::new();
        let entries = sftp
            .readdir(std::path::Path::new(path))
            .map_err(|e| LovelyResError::SSHError(format!("读取目录失败: {}", e)))?;

        for (file_path, stat) in entries {
            let name = file_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();

            let file_type = if stat.is_dir() {
                "directory"
            } else if stat.is_file() {
                "file"
            } else {
                "symlink"
            }
            .to_string();

            let permissions = format!("{:o}", stat.perm.unwrap_or(0o644));
            let size = stat.size.unwrap_or(0);

            // 统一路径格式为正斜杠（POSIX风格）
            let normalized_path = file_path.to_string_lossy().to_string().replace('\\', "/");

            files.push(SftpFileInfo {
                name,
                path: normalized_path,
                file_type,
                size,
                permissions,
                modified: stat.mtime.map(|t| {
                    chrono::DateTime::from_timestamp(t as i64, 0)
                        .unwrap_or_default()
                        .format("%Y-%m-%d %H:%M:%S")
                        .to_string()
                }),
                owner: None, // SSH2库不直接提供所有者信息
                group: None, // SSH2库不直接提供组信息
            });
        }

        Ok(files)
    }

    /// 使用独立SSH连接执行SFTP文件列表操作
    fn list_sftp_files_with_independent_connection(&self, path: &str) -> LovelyResResult<Vec<SftpFileInfo>> {
        let path = path.to_string(); // 克隆path以便在闭包中使用
        self.with_independent_sftp(|sftp| {
            self.read_sftp_directory(sftp, &path)
        })
    }

    /// 使用主连接执行SFTP文件列表操作（仅在没有终端会话时使用）
    fn list_sftp_files_with_main_connection(&mut self, path: &str) -> LovelyResResult<Vec<SftpFileInfo>> {
        // 确保SSH会话存活，如果断开则自动重连
        if let Err(_) = self.ensure_session_alive_and_reconnect_if_needed() {
            return Err(LovelyResError::ConnectionError("SSH会话不可用且重连失败".to_string()));
        }

        // 检查是否有活跃的终端会话
        let has_terminals = !self.terminal_senders.is_empty();

        // 只有在没有终端会话时才设置阻塞模式
        if has_terminals {
            // 有终端会话时，不应该使用主连接执行SFTP操作
            return Err(LovelyResError::SSHError(
                "检测到活跃终端会话，应使用独立连接执行SFTP操作".to_string()
            ));
        }

        let session = self
            .current_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("未建立SSH连接".to_string()))?;

        session.set_blocking(true);

        let sftp = session
            .sftp()
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e))
            })?;

        // 读取目录内容
        let mut files = Vec::new();
        let entries = sftp
            .readdir(std::path::Path::new(path))
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("读取目录失败: {}", e))
            })?;

        for (file_path, stat) in entries {
            let name = file_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();

            let file_type = if stat.is_dir() {
                "directory"
            } else if stat.is_file() {
                "file"
            } else {
                "symlink"
            }
            .to_string();

            let permissions = format!("{:o}", stat.perm.unwrap_or(0o644));
            let size = stat.size.unwrap_or(0);

            // 统一路径格式为正斜杠（POSIX风格）
            let normalized_path = file_path.to_string_lossy().to_string().replace('\\', "/");

            files.push(SftpFileInfo {
                name,
                path: normalized_path,
                file_type,
                size,
                permissions,
                modified: stat.mtime.map(|t| {
                    chrono::DateTime::from_timestamp(t as i64, 0)
                        .unwrap_or_default()
                        .format("%Y-%m-%d %H:%M:%S")
                        .to_string()
                }),
                owner: None, // SSH2库不直接提供所有者信息
                group: None, // SSH2库不直接提供组信息
            });
        }

        // 恢复非阻塞模式
        let _ = session.set_blocking(false);

        Ok(files)
    }

    /// 读取SFTP目录内容（共用逻辑）
    fn read_sftp_directory(&self, sftp: &ssh2::Sftp, path: &str) -> LovelyResResult<Vec<SftpFileInfo>> {

        let mut files = Vec::new();

        let entries = sftp
            .readdir(std::path::Path::new(path))
            .map_err(|e| LovelyResError::SSHError(format!("读取目录失败: {}", e)))?;

        for (file_path, stat) in entries {
            let name = file_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();

            let file_type = if stat.is_dir() {
                "directory"
            } else if stat.is_file() {
                "file"
            } else {
                "symlink"
            }
            .to_string();

            let permissions = format!("{:o}", stat.perm.unwrap_or(0o644));
            let size = stat.size.unwrap_or(0);

            // 统一路径格式为正斜杠（POSIX风格）
            let normalized_path = file_path.to_string_lossy().to_string().replace('\\', "/");

            files.push(SftpFileInfo {
                name,
                path: normalized_path,
                file_type,
                size,
                permissions,
                modified: stat.mtime.map(|t| {
                    chrono::DateTime::from_timestamp(t as i64, 0)
                        .unwrap_or_default()
                        .format("%Y-%m-%d %H:%M:%S")
                        .to_string()
                }),
                owner: None, // SSH2库不直接提供所有者信息
                group: None, // SSH2库不直接提供组信息
            });
        }

        Ok(files)
    }

    /// 创建独立的SFTP连接并执行操作
    fn with_independent_sftp<T, F>(&self, operation: F) -> LovelyResResult<T>
    where
        F: FnOnce(&ssh2::Sftp) -> LovelyResResult<T>,
    {
        use ssh2::Session;
        use std::net::TcpStream;

        // 获取存储的连接参数
        let (host, port, username, password) = self.last_connection_params.as_ref()
            .ok_or_else(|| LovelyResError::ConnectionError("没有存储的连接参数".to_string()))?;

        println!("🔗 创建独立SSH连接执行SFTP操作");

        // 创建新的TCP连接
        let tcp = TcpStream::connect(format!("{}:{}", host, port))
            .map_err(|e| LovelyResError::ConnectionError(format!("TCP连接失败: {}", e)))?;

        // 创建新的SSH会话
        let mut session = Session::new()
            .map_err(|e| LovelyResError::SSHError(format!("创建SSH会话失败: {}", e)))?;

        session.set_tcp_stream(tcp);
        session.handshake()
            .map_err(|e| LovelyResError::SSHError(format!("SSH握手失败: {}", e)))?;

        // 认证
        session.userauth_password(username, password)
            .map_err(|e| LovelyResError::AuthenticationError(format!("认证失败: {}", e)))?;

        // 创建SFTP会话（独立连接，可以安全使用阻塞模式）
        let sftp = session
            .sftp()
            .map_err(|e| LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e)))?;

        // 执行操作
        operation(&sftp)
    }

    /// 确保当前会话存活，若已断开则尝试自动重连（基于最近一次直连参数）
    fn ensure_session_alive_and_reconnect_if_needed(&mut self) -> LovelyResResult<()> {
        // 无会话则直接报错
        if self.current_session.is_none() {
            return Err(LovelyResError::ConnectionError("未建立SSH连接".to_string()));
        }

        // 完全跳过 keepalive 探测，避免干扰SSH会话
        // 直接认为连接正常，让实际的数据传输来判断连接状态
        if let Some(ref mut status) = self.current_connection_status {
            status.connected = true;
            status.last_activity = chrono::Utc::now();
        }
        return Ok(());
    }

    /// 读取SFTP文件内容（限制大小，用于快速查看/编辑，使用仪表盘专用 session）
    pub fn read_sftp_file(
        &mut self,
        path: &str,
        max_bytes: Option<usize>,
    ) -> LovelyResResult<String> {
        println!("📁 [SFTP] 使用专用 session 读取文件: {}", path);

        let session = self
            .dashboard_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("仪表盘 session 未初始化".to_string()))?;

        let sftp = session
            .sftp()
            .map_err(|e| LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e)))?;

        self.read_sftp_file_content(&sftp, path, max_bytes)
    }

    /// 使用主连接读取SFTP文件（仅在没有终端会话时使用）
    fn read_sftp_file_with_main_connection(
        &mut self,
        path: &str,
        max_bytes: Option<usize>,
    ) -> LovelyResResult<String> {
        // 确保SSH会话存活，如果断开则自动重连
        if let Err(_) = self.ensure_session_alive_and_reconnect_if_needed() {
            return Err(LovelyResError::ConnectionError("SSH会话不可用且重连失败".to_string()));
        }

        // 检查是否有活跃的终端会话
        let has_terminals = !self.terminal_senders.is_empty();
        if has_terminals {
            return Err(LovelyResError::SSHError(
                "检测到活跃终端会话，应使用独立连接执行SFTP操作".to_string()
            ));
        }

        let session = self
            .current_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("未建立SSH连接".to_string()))?;

        // SFTP操作需要阻塞模式
        session.set_blocking(true);

        let sftp = session
            .sftp()
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e))
            })?;

        // 直接在这里实现读取逻辑，避免借用冲突
        use std::io::Read;

        // 检查文件状态
        let stat = sftp
            .stat(std::path::Path::new(path))
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("获取文件状态失败: {}", e))
            })?;

        if stat.is_dir() {
            let _ = session.set_blocking(false);
            return Err(LovelyResError::InvalidInput("不能读取目录".to_string()));
        }

        let file_size = stat.size.unwrap_or(0) as usize;
        let max_size = max_bytes.unwrap_or(1024 * 1024); // 默认最大1MB

        if file_size > max_size {
            let _ = session.set_blocking(false);
            return Err(LovelyResError::InvalidInput(format!(
                "文件过大 ({} bytes)，超过限制 ({} bytes)",
                file_size, max_size
            )));
        }

        // 读取文件内容
        let mut file = sftp
            .open(std::path::Path::new(path))
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("打开文件失败: {}", e))
            })?;

        let mut contents = Vec::new();
        file.read_to_end(&mut contents)
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("读取文件失败: {}", e))
            })?;

        // 恢复非阻塞模式
        let _ = session.set_blocking(false);

        // 尝试转换为UTF-8字符串
        String::from_utf8(contents)
            .map_err(|_| LovelyResError::InvalidInput("文件不是有效的UTF-8文本".to_string()))
    }

    /// 读取SFTP文件内容的共用逻辑
    fn read_sftp_file_content(
        &self,
        sftp: &ssh2::Sftp,
        path: &str,
        max_bytes: Option<usize>,
    ) -> LovelyResResult<String> {
        use std::io::Read;

        // 检查文件状态
        let stat = sftp
            .stat(std::path::Path::new(path))
            .map_err(|e| LovelyResError::SSHError(format!("获取文件状态失败: {}", e)))?;

        if stat.is_dir() {
            return Err(LovelyResError::InvalidInput("不能读取目录".to_string()));
        }

        let file_size = stat.size.unwrap_or(0) as usize;
        let max_size = max_bytes.unwrap_or(1024 * 1024); // 默认最大1MB

        if file_size > max_size {
            return Err(LovelyResError::InvalidInput(format!(
                "文件过大 ({} bytes)，超过限制 ({} bytes)",
                file_size, max_size
            )));
        }

        // 读取文件内容
        let mut file = sftp
            .open(std::path::Path::new(path))
            .map_err(|e| LovelyResError::SSHError(format!("打开文件失败: {}", e)))?;

        let mut contents = Vec::new();
        file.read_to_end(&mut contents)
            .map_err(|e| LovelyResError::SSHError(format!("读取文件失败: {}", e)))?;

        // 尝试转换为UTF-8字符串
        String::from_utf8(contents)
            .map_err(|_| LovelyResError::InvalidInput("文件不是有效的UTF-8文本".to_string()))
    }

    /// 修改SFTP文件/目录权限（使用仪表盘专用 session）
    pub fn chmod_sftp(&mut self, path: &str, mode: u32) -> LovelyResResult<()> {
        println!("📁 [SFTP] 使用专用 session 修改权限: {} -> {:o}", path, mode);

        let session = self
            .dashboard_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("仪表盘 session 未初始化".to_string()))?;

        let sftp = session
            .sftp()
            .map_err(|e| LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e)))?;

        self.chmod_sftp_content(&sftp, path, mode)
    }

    /// 使用主连接修改权限
    fn chmod_sftp_with_main_connection(&mut self, path: &str, mode: u32) -> LovelyResResult<()> {
        // 确保SSH会话存活，如果断开则自动重连
        if let Err(_) = self.ensure_session_alive_and_reconnect_if_needed() {
            return Err(LovelyResError::ConnectionError("SSH会话不可用且重连失败".to_string()));
        }

        let session = self
            .current_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("未建立SSH连接".to_string()))?;

        // SFTP操作需要阻塞模式
        session.set_blocking(true);

        let sftp = session
            .sftp()
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e))
            })?;

        // 设置权限
        let result = sftp.setstat(
            std::path::Path::new(path),
            ssh2::FileStat {
                size: None,
                uid: None,
                gid: None,
                perm: Some(mode),
                atime: None,
                mtime: None,
            },
        )
        .map_err(|e| LovelyResError::SSHError(format!("修改权限失败: {}", e)));

        // 恢复非阻塞模式
        let _ = session.set_blocking(false);

        result.map(|_| ())
    }

    /// 修改权限内容（共用逻辑）
    fn chmod_sftp_content(&self, sftp: &ssh2::Sftp, path: &str, mode: u32) -> LovelyResResult<()> {
        // 设置权限
        sftp.setstat(
            std::path::Path::new(path),
            ssh2::FileStat {
                size: None,
                uid: None,
                gid: None,
                perm: Some(mode),
                atime: None,
                mtime: None,
            },
        )
        .map_err(|e| LovelyResError::SSHError(format!("修改权限失败: {}", e)))?;

        Ok(())
    }
    /// 写入SFTP文件内容（使用仪表盘专用 session）
    pub fn write_sftp_file(&mut self, path: &str, content: &str) -> LovelyResResult<()> {
        println!("📁 [SFTP] 使用专用 session 写入文件: {}", path);

        let session = self
            .dashboard_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("仪表盘 session 未初始化".to_string()))?;

        let sftp = session
            .sftp()
            .map_err(|e| LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e)))?;

        self.write_sftp_file_content(&sftp, path, content)
    }

    /// 使用主连接写入SFTP文件
    fn write_sftp_file_with_main_connection(&mut self, path: &str, content: &str) -> LovelyResResult<()> {
        use std::io::Write;

        // 确保SSH会话存活，如果断开则自动重连
        if let Err(_) = self.ensure_session_alive_and_reconnect_if_needed() {
            return Err(LovelyResError::ConnectionError("SSH会话不可用且重连失败".to_string()));
        }

        let session = self
            .current_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("未建立SSH连接".to_string()))?;

        // SFTP操作需要阻塞模式
        session.set_blocking(true);

        let sftp = session
            .sftp()
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e))
            })?;

        // 创建或打开文件进行写入
        let mut file = sftp
            .create(std::path::Path::new(path))
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("创建/打开文件失败: {}", e))
            })?;

        // 写入内容
        file.write_all(content.as_bytes())
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("写入文件失败: {}", e))
            })?;

        // 确保数据写入磁盘
        file.flush()
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("刷新文件缓冲区失败: {}", e))
            })?;

        // 恢复非阻塞模式
        let _ = session.set_blocking(false);

        Ok(())
    }

    /// 写入SFTP文件内容（共用逻辑）
    fn write_sftp_file_content(&self, sftp: &ssh2::Sftp, path: &str, content: &str) -> LovelyResResult<()> {
        use std::io::Write;

        // 创建或打开文件进行写入
        let mut file = sftp
            .create(std::path::Path::new(path))
            .map_err(|e| LovelyResError::SSHError(format!("创建/打开文件失败: {}", e)))?;

        // 写入内容
        file.write_all(content.as_bytes())
            .map_err(|e| LovelyResError::SSHError(format!("写入文件失败: {}", e)))?;

        // 确保数据写入磁盘
        file.flush()
            .map_err(|e| LovelyResError::SSHError(format!("刷新文件缓冲区失败: {}", e)))?;

        Ok(())
    }
    /// 压缩文件或文件夹
    pub fn compress_file(
        &mut self,
        source_path: &str,
        target_path: &str,
        format: &str,
    ) -> LovelyResResult<()> {
        let session = self
            .current_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("未建立SSH连接".to_string()))?;

        // 解析路径
        let source_path_obj = std::path::Path::new(source_path);
        let parent_dir = source_path_obj
            .parent()
            .unwrap_or(std::path::Path::new("/"));
        let file_name = source_path_obj
            .file_name()
            .ok_or_else(|| LovelyResError::SSHError("无法获取文件名".to_string()))?
            .to_string_lossy();

        // 根据格式选择压缩命令
        let command = match format {
            "tar.gz" => format!(
                "cd '{}' && tar -czf '{}' '{}'",
                parent_dir.display(),
                target_path,
                file_name
            ),
            "zip" => format!(
                "cd '{}' && zip -r '{}' '{}'",
                parent_dir.display(),
                target_path,
                file_name
            ),
            "tar" => format!(
                "cd '{}' && tar -cf '{}' '{}'",
                parent_dir.display(),
                target_path,
                file_name
            ),
            _ => {
                return Err(LovelyResError::SSHError(format!(
                    "不支持的压缩格式: {}",
                    format
                )))
            }
        };

        println!("执行压缩命令: {}", command);

        // 执行压缩命令
        let mut channel = session
            .channel_session()
            .map_err(|e| LovelyResError::SSHError(format!("创建SSH通道失败: {}", e)))?;

        channel
            .exec(&command)
            .map_err(|e| LovelyResError::SSHError(format!("执行压缩命令失败: {}", e)))?;

        // 读取命令输出和错误输出
        let mut stdout = String::new();
        let mut stderr = String::new();

        channel
            .read_to_string(&mut stdout)
            .map_err(|e| LovelyResError::SSHError(format!("读取命令输出失败: {}", e)))?;

        channel
            .stderr()
            .read_to_string(&mut stderr)
            .map_err(|e| LovelyResError::SSHError(format!("读取命令错误输出失败: {}", e)))?;

        // 等待命令完成
        channel
            .wait_close()
            .map_err(|e| LovelyResError::SSHError(format!("等待命令完成失败: {}", e)))?;

        let exit_status = channel
            .exit_status()
            .map_err(|e| LovelyResError::SSHError(format!("获取命令退出状态失败: {}", e)))?;

        if exit_status != 0 {
            let error_msg = if !stderr.is_empty() {
                format!(
                    "压缩命令执行失败，退出码: {}, 错误: {}",
                    exit_status,
                    stderr.trim()
                )
            } else {
                format!(
                    "压缩命令执行失败，退出码: {}, 输出: {}",
                    exit_status,
                    stdout.trim()
                )
            };
            return Err(LovelyResError::SSHError(error_msg));
        }

        Ok(())
    }
    /// 解压文件
    pub fn extract_file(
        &mut self,
        archive_path: &str,
        target_dir: &str,
        overwrite: bool,
    ) -> LovelyResResult<()> {
        let session = self
            .current_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("未建立SSH连接".to_string()))?;

        // 检测文件格式并选择解压命令
        let command = if archive_path.ends_with(".tar.gz") || archive_path.ends_with(".tgz") {
            if overwrite {
                format!(
                    "mkdir -p '{}' && cd '{}' && tar -xzf '{}'",
                    target_dir, target_dir, archive_path
                )
            } else {
                format!(
                    "mkdir -p '{}' && cd '{}' && tar -xzf '{}' --keep-old-files",
                    target_dir, target_dir, archive_path
                )
            }
        } else if archive_path.ends_with(".tar.bz2") || archive_path.ends_with(".tbz2") {
            if overwrite {
                format!(
                    "mkdir -p '{}' && cd '{}' && tar -xjf '{}'",
                    target_dir, target_dir, archive_path
                )
            } else {
                format!(
                    "mkdir -p '{}' && cd '{}' && tar -xjf '{}' --keep-old-files",
                    target_dir, target_dir, archive_path
                )
            }
        } else if archive_path.ends_with(".tar") {
            if overwrite {
                format!(
                    "mkdir -p '{}' && cd '{}' && tar -xf '{}'",
                    target_dir, target_dir, archive_path
                )
            } else {
                format!(
                    "mkdir -p '{}' && cd '{}' && tar -xf '{}' --keep-old-files",
                    target_dir, target_dir, archive_path
                )
            }
        } else if archive_path.ends_with(".zip") {
            if overwrite {
                format!(
                    "mkdir -p '{}' && cd '{}' && unzip -o '{}'",
                    target_dir, target_dir, archive_path
                )
            } else {
                format!(
                    "mkdir -p '{}' && cd '{}' && unzip -n '{}'",
                    target_dir, target_dir, archive_path
                )
            }
        } else {
            return Err(LovelyResError::SSHError("不支持的压缩文件格式".to_string()));
        };

        // 执行解压命令
        let mut channel = session
            .channel_session()
            .map_err(|e| LovelyResError::SSHError(format!("创建SSH通道失败: {}", e)))?;

        channel
            .exec(&command)
            .map_err(|e| LovelyResError::SSHError(format!("执行解压命令失败: {}", e)))?;

        // 读取命令输出和错误输出
        let mut stdout = String::new();
        let mut stderr = String::new();

        channel
            .read_to_string(&mut stdout)
            .map_err(|e| LovelyResError::SSHError(format!("读取命令输出失败: {}", e)))?;

        channel
            .stderr()
            .read_to_string(&mut stderr)
            .map_err(|e| LovelyResError::SSHError(format!("读取命令错误输出失败: {}", e)))?;

        // 等待命令完成
        channel
            .wait_close()
            .map_err(|e| LovelyResError::SSHError(format!("等待命令完成失败: {}", e)))?;

        let exit_status = channel
            .exit_status()
            .map_err(|e| LovelyResError::SSHError(format!("获取命令退出状态失败: {}", e)))?;

        if exit_status != 0 {
            let error_msg = if !stderr.is_empty() {
                format!(
                    "解压命令执行失败，退出码: {}, 错误: {}",
                    exit_status,
                    stderr.trim()
                )
            } else {
                format!(
                    "解压命令执行失败，退出码: {}, 输出: {}",
                    exit_status,
                    stdout.trim()
                )
            };
            return Err(LovelyResError::SSHError(error_msg));
        }

        Ok(())
    }

    /// 获取文件详细信息
    pub fn get_file_details(&mut self, path: &str) -> LovelyResResult<SftpFileDetails> {
        // 确保SSH会话存活，如果断开则自动重连
        if let Err(_) = self.ensure_session_alive_and_reconnect_if_needed() {
            return Err(LovelyResError::ConnectionError("SSH会话不可用且重连失败".to_string()));
        }

        let session = self
            .current_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("未建立SSH连接".to_string()))?;

        // SFTP操作需要阻塞模式
        session.set_blocking(true);

        let sftp = session
            .sftp()
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e))
            })?;

        // 获取文件状态信息
        let stat = sftp
            .stat(std::path::Path::new(path))
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("获取文件状态失败: {}", e))
            })?;

        // 获取文件名
        let name = std::path::Path::new(path)
            .file_name()
            .unwrap_or_else(|| std::ffi::OsStr::new(""))
            .to_string_lossy()
            .to_string();

        // 确定文件类型
        let file_type = if stat.is_dir() {
            "directory"
        } else if stat.is_file() {
            "file"
        } else {
            "symlink"
        }
        .to_string();

        let permissions = format!("{:o}", stat.perm.unwrap_or(0o644));
        let size = stat.size.unwrap_or(0);

        // 格式化时间戳
        let format_time = |timestamp: Option<u64>| -> Option<String> {
            timestamp.map(|ts| {
                chrono::DateTime::from_timestamp(ts as i64, 0)
                    .unwrap_or_else(|| chrono::Utc::now())
                    .to_rfc3339()
            })
        };

        let modified = format_time(stat.mtime);
        let accessed = format_time(stat.atime);

        // 对于创建时间，大多数Unix系统不支持，使用修改时间作为替代
        let created = modified.clone();

        // 恢复非阻塞模式（在调用 get_file_ownership 之前）
        let _ = session.set_blocking(false);

        // 尝试获取所有者和组信息（通过执行ls -l命令）
        let (owner, group) = self.get_file_ownership(path).unwrap_or((None, None));

        Ok(SftpFileDetails {
            name,
            path: path.to_string(),
            file_type,
            size,
            permissions,
            owner,
            group,
            created,
            modified,
            accessed,
        })
    }

    /// 获取文件所有者和组信息
    fn get_file_ownership(
        &mut self,
        path: &str,
    ) -> LovelyResResult<(Option<String>, Option<String>)> {
        let session = self
            .current_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("未建立SSH连接".to_string()))?;

        // 使用ls -l命令获取详细信息
        let command = format!("ls -ld '{}'", path);

        let mut channel = session
            .channel_session()
            .map_err(|e| LovelyResError::SSHError(format!("创建SSH通道失败: {}", e)))?;

        channel
            .exec(&command)
            .map_err(|e| LovelyResError::SSHError(format!("执行ls命令失败: {}", e)))?;

        let mut output = String::new();
        channel
            .read_to_string(&mut output)
            .map_err(|e| LovelyResError::SSHError(format!("读取命令输出失败: {}", e)))?;

        channel
            .wait_close()
            .map_err(|e| LovelyResError::SSHError(format!("等待命令完成失败: {}", e)))?;

        // 解析ls -l输出
        // 格式: -rw-r--r-- 1 user group size date time filename
        let parts: Vec<&str> = output.trim().split_whitespace().collect();
        if parts.len() >= 4 {
            let owner = Some(parts[2].to_string());
            let group = Some(parts[3].to_string());
            Ok((owner, group))
        } else {
            Ok((None, None))
        }
    }

    /// 上传文件到远程服务器（使用仪表盘专用 session）
    pub fn upload_file(&mut self, local_path: &str, remote_path: &str) -> LovelyResResult<()> {
        println!("📁 [SFTP] 使用专用 session 上传文件: {} -> {}", local_path, remote_path);

        let session = self
            .dashboard_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("仪表盘 session 未初始化".to_string()))?;

        let sftp = session
            .sftp()
            .map_err(|e| LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e)))?;

        self.upload_file_content(&sftp, local_path, remote_path)
    }

    /// 使用主连接上传文件
    fn upload_file_with_main_connection(&mut self, local_path: &str, remote_path: &str) -> LovelyResResult<()> {
        use std::io::Write;

        // 确保SSH会话存活，如果断开则自动重连
        if let Err(_) = self.ensure_session_alive_and_reconnect_if_needed() {
            return Err(LovelyResError::ConnectionError("SSH会话不可用且重连失败".to_string()));
        }

        let session = self
            .current_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("未建立SSH连接".to_string()))?;

        // SFTP操作需要阻塞模式
        session.set_blocking(true);

        let sftp = session
            .sftp()
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e))
            })?;

        // 读取本地文件
        let local_file_data = std::fs::read(local_path)
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("读取本地文件失败: {}", e))
            })?;

        // 创建远程文件
        let mut remote_file = sftp
            .create(std::path::Path::new(remote_path))
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("创建远程文件失败: {}", e))
            })?;

        // 写入数据
        remote_file
            .write_all(&local_file_data)
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("写入远程文件失败: {}", e))
            })?;

        // 确保数据写入磁盘
        remote_file
            .flush()
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("刷新远程文件缓冲区失败: {}", e))
            })?;

        // 恢复非阻塞模式
        let _ = session.set_blocking(false);

        println!("文件上传成功: {} -> {}", local_path, remote_path);
        Ok(())
    }

    /// 上传文件内容（共用逻辑）
    fn upload_file_content(&self, sftp: &ssh2::Sftp, local_path: &str, remote_path: &str) -> LovelyResResult<()> {
        use std::io::Write;

        // 读取本地文件
        let local_file_data = std::fs::read(local_path)
            .map_err(|e| LovelyResError::SSHError(format!("读取本地文件失败: {}", e)))?;

        // 创建远程文件
        let mut remote_file = sftp
            .create(std::path::Path::new(remote_path))
            .map_err(|e| LovelyResError::SSHError(format!("创建远程文件失败: {}", e)))?;

        // 写入数据
        remote_file
            .write_all(&local_file_data)
            .map_err(|e| LovelyResError::SSHError(format!("写入远程文件失败: {}", e)))?;

        // 确保数据写入磁盘
        remote_file
            .flush()
            .map_err(|e| LovelyResError::SSHError(format!("刷新远程文件缓冲区失败: {}", e)))?;

        println!("文件上传成功: {} -> {}", local_path, remote_path);
        Ok(())
    }
    /// 从远程服务器下载文件（使用仪表盘专用 session）
    pub fn download_file(&mut self, remote_path: &str, local_path: &str) -> LovelyResResult<()> {
        println!("📁 [SFTP] 使用专用 session 下载文件: {} -> {}", remote_path, local_path);

        let session = self
            .dashboard_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("仪表盘 session 未初始化".to_string()))?;

        let sftp = session
            .sftp()
            .map_err(|e| LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e)))?;

        self.download_file_content(&sftp, remote_path, local_path)
    }

    /// 使用主连接下载文件
    fn download_file_with_main_connection(&mut self, remote_path: &str, local_path: &str) -> LovelyResResult<()> {
        use std::io::Read;

        // 确保SSH会话存活，如果断开则自动重连
        if let Err(_) = self.ensure_session_alive_and_reconnect_if_needed() {
            return Err(LovelyResError::ConnectionError("SSH会话不可用且重连失败".to_string()));
        }

        let session = self
            .current_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("未建立SSH连接".to_string()))?;

        // SFTP操作需要阻塞模式
        session.set_blocking(true);

        let sftp = session
            .sftp()
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e))
            })?;

        // 打开远程文件
        let mut remote_file = sftp
            .open(std::path::Path::new(remote_path))
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("打开远程文件失败: {}", e))
            })?;

        // 读取远程文件数据
        let mut buffer = Vec::new();
        remote_file
            .read_to_end(&mut buffer)
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("读取远程文件失败: {}", e))
            })?;

        // 写入本地文件
        std::fs::write(local_path, &buffer)
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("写入本地文件失败: {}", e))
            })?;

        // 恢复非阻塞模式
        let _ = session.set_blocking(false);

        println!("文件下载成功: {} -> {}", remote_path, local_path);
        Ok(())
    }

    /// 下载文件内容（共用逻辑）
    fn download_file_content(&self, sftp: &ssh2::Sftp, remote_path: &str, local_path: &str) -> LovelyResResult<()> {
        use std::io::Read;

        // 打开远程文件
        let mut remote_file = sftp
            .open(std::path::Path::new(remote_path))
            .map_err(|e| LovelyResError::SSHError(format!("打开远程文件失败: {}", e)))?;

        // 读取远程文件数据
        let mut buffer = Vec::new();
        remote_file
            .read_to_end(&mut buffer)
            .map_err(|e| LovelyResError::SSHError(format!("读取远程文件失败: {}", e)))?;

        // 写入本地文件
        std::fs::write(local_path, &buffer)
            .map_err(|e| LovelyResError::SSHError(format!("写入本地文件失败: {}", e)))?;

        println!("文件下载成功: {} -> {}", remote_path, local_path);
        Ok(())
    }
    /// 创建远程文件夹
    pub fn create_directory(&mut self, remote_path: &str) -> LovelyResResult<()> {
        // 如果有活跃的终端会话，使用独立连接执行SFTP操作
        if !self.terminal_senders.is_empty() {
            println!("🔄 检测到活跃终端会话，使用独立连接执行SFTP创建目录操作");
            let remote_path = remote_path.to_string();
            return self.with_independent_sftp(|sftp| {
                self.create_directory_content(sftp, &remote_path)
            });
        }

        // 没有终端会话时，可以安全地使用主连接
        self.create_directory_with_main_connection(remote_path)
    }

    /// 使用主连接创建目录
    fn create_directory_with_main_connection(&mut self, remote_path: &str) -> LovelyResResult<()> {
        // 确保SSH会话存活，如果断开则自动重连
        if let Err(_) = self.ensure_session_alive_and_reconnect_if_needed() {
            return Err(LovelyResError::ConnectionError("SSH会话不可用且重连失败".to_string()));
        }

        let session = self
            .current_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("未建立SSH连接".to_string()))?;

        // SFTP操作需要阻塞模式
        session.set_blocking(true);

        let sftp = session
            .sftp()
            .map_err(|e| {
                let _ = session.set_blocking(false);
                LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e))
            })?;

        // 创建目录，权限设置为755
        let result = sftp.mkdir(std::path::Path::new(remote_path), 0o755)
            .map_err(|e| LovelyResError::SSHError(format!("创建目录失败: {}", e)));

        // 恢复非阻塞模式
        let _ = session.set_blocking(false);

        if result.is_ok() {
            println!("目录创建成功: {}", remote_path);
        }

        result
    }

    /// 创建目录内容（共用逻辑）
    fn create_directory_content(&self, sftp: &ssh2::Sftp, remote_path: &str) -> LovelyResResult<()> {
        // 创建目录，权限设置为755
        sftp.mkdir(std::path::Path::new(remote_path), 0o755)
            .map_err(|e| LovelyResError::SSHError(format!("创建目录失败: {}", e)))?;

        println!("目录创建成功: {}", remote_path);
        Ok(())
    }

    /// 获取默认的应急响应命令
    fn get_default_commands() -> Vec<SSHCommand> {
        vec![
            SSHCommand {
                id: uuid::Uuid::new_v4().to_string(),
                name: "系统信息".to_string(),
                command: "uname -a && cat /etc/os-release".to_string(),
                description: "获取系统基本信息".to_string(),
                category: "系统信息".to_string(),
                favorite: true,
            },
            SSHCommand {
                id: uuid::Uuid::new_v4().to_string(),
                name: "系统运行时间".to_string(),
                command: "uptime && who".to_string(),
                description: "查看系统运行时间和当前用户".to_string(),
                category: "系统信息".to_string(),
                favorite: false,
            },
            SSHCommand {
                id: uuid::Uuid::new_v4().to_string(),
                name: "进程列表".to_string(),
                command: "ps aux --sort=-%cpu".to_string(),
                description: "显示CPU使用率排序的所有进程".to_string(),
                category: "进程监控".to_string(),
                favorite: true,
            },
            SSHCommand {
                id: uuid::Uuid::new_v4().to_string(),
                name: "网络连接".to_string(),
                command: "netstat -tulpn".to_string(),
                description: "显示所有网络连接".to_string(),
                category: "网络分析".to_string(),
                favorite: true,
            },
            SSHCommand {
                id: uuid::Uuid::new_v4().to_string(),
                name: "认证日志".to_string(),
                command: "cat /var/log/auth.log".to_string(),
                description: "查看完整的认证日志".to_string(),
                category: "日志分析".to_string(),
                favorite: true,
            },
            SSHCommand {
                id: uuid::Uuid::new_v4().to_string(),
                name: "磁盘使用".to_string(),
                command: "df -h && du -sh /var/log/* | sort -hr".to_string(),
                description: "查看磁盘使用情况和日志目录大小".to_string(),
                category: "文件系统".to_string(),
                favorite: true,
            },
        ]
    }

    /// 初始化SSH管理器
    pub async fn initialize(&mut self) -> LovelyResResult<()> {
        self.load_connections().await?;
        self.load_commands().await?;
        println!("✅ SSH管理器初始化完成");
        Ok(())
    }

    /// 加载连接配置
    async fn load_connections(&mut self) -> LovelyResResult<()> {
        let config_path = self.get_connections_config_path()?;

        if config_path.exists() {
            let content = fs::read_to_string(&config_path)
                .map_err(|e| LovelyResError::FileError(format!("读取连接配置失败: {}", e)))?;

            self.connections = serde_json::from_str(&content)
                .map_err(|e| LovelyResError::ConfigError(format!("解析连接配置失败: {}", e)))?;

            println!("✅ 加载了 {} 个SSH连接配置", self.connections.len());
        }

        Ok(())
    }

    /// 保存连接配置
    async fn save_connections(&self) -> LovelyResResult<()> {
        let config_path = self.get_connections_config_path()?;

        let content = serde_json::to_string_pretty(&self.connections)
            .map_err(|e| LovelyResError::ConfigError(format!("序列化连接配置失败: {}", e)))?;

        fs::write(&config_path, content)
            .map_err(|e| LovelyResError::FileError(format!("保存连接配置失败: {}", e)))?;

        println!("✅ 保存了 {} 个SSH连接配置", self.connections.len());
        Ok(())
    }

    /// 加载命令配置
    async fn load_commands(&mut self) -> LovelyResResult<()> {
        let config_path = self.get_commands_config_path()?;

        if config_path.exists() {
            let content = fs::read_to_string(&config_path)
                .map_err(|e| LovelyResError::FileError(format!("读取命令配置失败: {}", e)))?;

            let saved_commands: Vec<SSHCommand> = serde_json::from_str(&content)
                .map_err(|e| LovelyResError::ConfigError(format!("解析命令配置失败: {}", e)))?;

            // 合并默认命令和保存的命令
            for saved_cmd in saved_commands {
                if !self.commands.iter().any(|cmd| cmd.id == saved_cmd.id) {
                    self.commands.push(saved_cmd);
                }
            }

            println!("✅ 加载了 {} 个SSH命令", self.commands.len());
        }

        Ok(())
    }

    /// 保存命令配置
    async fn save_commands(&self) -> LovelyResResult<()> {
        let config_path = self.get_commands_config_path()?;

        let content = serde_json::to_string_pretty(&self.commands)
            .map_err(|e| LovelyResError::ConfigError(format!("序列化命令配置失败: {}", e)))?;

        fs::write(&config_path, content)
            .map_err(|e| LovelyResError::FileError(format!("保存命令配置失败: {}", e)))?;

        println!("✅ 保存了 {} 个SSH命令", self.commands.len());
        Ok(())
    }

    /// 获取连接配置文件路径
    fn get_connections_config_path(&self) -> LovelyResResult<PathBuf> {
        let app_data_dir = dirs::data_dir()
            .ok_or(LovelyResError::ConfigError(
                "无法获取应用数据目录".to_string(),
            ))?
            .join("lovelyres");

        if !app_data_dir.exists() {
            fs::create_dir_all(&app_data_dir)
                .map_err(|e| LovelyResError::FileError(format!("创建应用数据目录失败: {}", e)))?;
        }

        Ok(app_data_dir.join("ssh_connections.json"))
    }

    /// 获取命令配置文件路径
    fn get_commands_config_path(&self) -> LovelyResResult<PathBuf> {
        let app_data_dir = dirs::data_dir()
            .ok_or(LovelyResError::ConfigError(
                "无法获取应用数据目录".to_string(),
            ))?
            .join("lovelyres");

        if !app_data_dir.exists() {
            fs::create_dir_all(&app_data_dir)
                .map_err(|e| LovelyResError::FileError(format!("创建应用数据目录失败: {}", e)))?;
        }

        Ok(app_data_dir.join("ssh_commands.json"))
    }

    /// 添加SSH连接
    pub async fn add_connection(
        &mut self,
        mut connection: SSHConnection,
    ) -> LovelyResResult<String> {
        connection.id = uuid::Uuid::new_v4().to_string();
        let connection_id = connection.id.clone();

        self.connections.push(connection);
        self.save_connections().await?;

        println!("✅ 添加SSH连接: {}", connection_id);
        Ok(connection_id)
    }

    /// 删除SSH连接
    pub async fn remove_connection(&mut self, connection_id: &str) -> LovelyResResult<()> {
        let initial_len = self.connections.len();
        self.connections.retain(|conn| conn.id != connection_id);

        if self.connections.len() < initial_len {
            self.save_connections().await?;
            println!("✅ 删除SSH连接: {}", connection_id);
            Ok(())
        } else {
            Err(LovelyResError::ConfigError(format!(
                "连接不存在: {}",
                connection_id
            )))
        }
    }

    /// 获取所有连接
    pub fn get_connections(&self) -> Vec<SSHConnection> {
        self.connections.clone()
    }

    /// 获取连接详情
    pub fn get_connection(&self, connection_id: &str) -> Option<SSHConnection> {
        self.connections
            .iter()
            .find(|conn| conn.id == connection_id)
            .cloned()
    }

    /// 测试SSH连接（占位符实现）
    pub async fn test_connection(&self, connection_id: &str) -> LovelyResResult<bool> {
        let _connection = self
            .get_connection(connection_id)
            .ok_or_else(|| LovelyResError::ConfigError(format!("连接不存在: {}", connection_id)))?;

        // 这里应该实现实际的SSH连接测试
        println!("🔍 测试SSH连接: {}", connection_id);

        // 模拟连接测试
        tokio::time::sleep(tokio::time::Duration::from_millis(1000)).await;

        // 随机返回成功或失败（实际实现中应该进行真实的连接测试）
        Ok(true)
    }

    /// 建立SSH连接（占位符实现）
    pub async fn connect_by_id(&mut self, connection_id: &str) -> LovelyResResult<String> {
        let connection = self
            .connections
            .iter_mut()
            .find(|conn| conn.id == connection_id)
            .ok_or_else(|| LovelyResError::ConfigError(format!("连接不存在: {}", connection_id)))?;

        // 这里应该实现实际的SSH连接逻辑
        println!(
            "🔗 建立SSH连接: {}@{}:{}",
            connection.username, connection.host, connection.port
        );

        // 模拟连接过程
        tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;

        // 更新连接状态
        connection.is_connected = true;
        connection.last_connected = Some(chrono::Utc::now());

        // 创建会话
        let session_id = uuid::Uuid::new_v4().to_string();
        let session = SSHSession {
            id: session_id.clone(),
            connection_id: connection_id.to_string(),
            created: chrono::Utc::now(),
            last_activity: chrono::Utc::now(),
            is_active: true,
        };

        self.active_sessions.insert(session_id.clone(), session);
        self.save_connections().await?;

        println!("✅ SSH连接已建立，会话ID: {}", session_id);
        Ok(session_id)
    }

    /// 断开SSH连接
    pub async fn disconnect_by_id(&mut self, connection_id: &str) -> LovelyResResult<()> {
        // 更新连接状态
        if let Some(connection) = self
            .connections
            .iter_mut()
            .find(|conn| conn.id == connection_id)
        {
            connection.is_connected = false;
        }

        // 关闭相关会话
        self.active_sessions
            .retain(|_, session| session.connection_id != connection_id);

        self.save_connections().await?;

        println!("✅ SSH连接已断开: {}", connection_id);
        Ok(())
    }

    /// 执行SSH命令（占位符实现）
    pub async fn execute_command_by_session(
        &mut self,
        session_id: &str,
        command: &str,
    ) -> LovelyResResult<String> {
        let session = self
            .active_sessions
            .get_mut(session_id)
            .ok_or_else(|| LovelyResError::SSHError(format!("会话不存在: {}", session_id)))?;

        if !session.is_active {
            return Err(LovelyResError::SSHError("会话未激活".to_string()));
        }

        // 这里应该实现实际的SSH命令执行
        println!("⚡ 执行SSH命令: {}", command);

        // 模拟命令执行
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        // 更新会话活动时间
        session.last_activity = chrono::Utc::now();

        // 返回模拟结果
        Ok(format!("模拟命令输出:\n$ {}\n执行完成", command))
    }

    /// 获取所有命令
    pub fn get_commands(&self) -> Vec<SSHCommand> {
        self.commands.clone()
    }

    /// 按分类获取命令
    pub fn get_commands_by_category(&self) -> HashMap<String, Vec<SSHCommand>> {
        let mut categories = HashMap::new();

        for command in &self.commands {
            categories
                .entry(command.category.clone())
                .or_insert_with(Vec::new)
                .push(command.clone());
        }

        categories
    }

    /// 获取收藏命令
    pub fn get_favorite_commands(&self) -> Vec<SSHCommand> {
        self.commands
            .iter()
            .filter(|cmd| cmd.favorite)
            .cloned()
            .collect()
    }

    /// 添加自定义命令
    pub async fn add_command(&mut self, mut command: SSHCommand) -> LovelyResResult<String> {
        command.id = uuid::Uuid::new_v4().to_string();
        let command_id = command.id.clone();

        self.commands.push(command);
        self.save_commands().await?;

        println!("✅ 添加SSH命令: {}", command_id);
        Ok(command_id)
    }

    /// 删除命令
    pub async fn remove_command(&mut self, command_id: &str) -> LovelyResResult<()> {
        let initial_len = self.commands.len();
        self.commands.retain(|cmd| cmd.id != command_id);

        if self.commands.len() < initial_len {
            self.save_commands().await?;
            println!("✅ 删除SSH命令: {}", command_id);
            Ok(())
        } else {
            Err(LovelyResError::ConfigError(format!(
                "命令不存在: {}",
                command_id
            )))
        }
    }

    /// 切换命令收藏状态
    pub async fn toggle_command_favorite(&mut self, command_id: &str) -> LovelyResResult<bool> {
        let mut favorite_status = false;
        let mut found = false;

        if let Some(command) = self.commands.iter_mut().find(|cmd| cmd.id == command_id) {
            command.favorite = !command.favorite;
            favorite_status = command.favorite;
            found = true;
        }

        if found {
            self.save_commands().await?;
            println!("✅ 切换命令收藏状态: {} -> {}", command_id, favorite_status);
            Ok(favorite_status)
        } else {
            Err(LovelyResError::ConfigError(format!(
                "命令不存在: {}",
                command_id
            )))
        }
    }

    /// 获取活动会话
    pub fn get_active_sessions(&self) -> Vec<SSHSession> {
        self.active_sessions.values().cloned().collect()
    }

    /// 获取会话详情
    pub fn get_session(&self, session_id: &str) -> Option<SSHSession> {
        self.active_sessions.get(session_id).cloned()
    }

    /// 关闭会话
    pub fn close_session(&mut self, session_id: &str) -> LovelyResResult<()> {
        if self.active_sessions.remove(session_id).is_some() {
            println!("✅ 会话已关闭: {}", session_id);
            Ok(())
        } else {
            Err(LovelyResError::SSHError(format!(
                "会话不存在: {}",
                session_id
            )))
        }
    }

    // 终端会话管理方法

    /// 创建终端会话（PTY交互式）
    pub fn create_terminal_session(
        &mut self,
        window: tauri::Window,
        terminal_id: &str,
        cols: u16,
        rows: u16,
    ) -> LovelyResResult<String> {
        use std::io::{Read, Write};
        use std::sync::mpsc;
        use std::thread;

        if !self.is_connected() {
            return Err(LovelyResError::ConnectionError("没有活动的SSH连接".to_string()));
        }

        // 尝试确保会话存活，如果断开则自动重连
        if let Err(_) = self.ensure_session_alive_and_reconnect_if_needed() {
            return Err(LovelyResError::ConnectionError("SSH会话不可用且重连失败".to_string()));
        }

        let session = self
            .current_session
            .as_mut()
            .ok_or_else(|| LovelyResError::ConnectionError("未建立SSH连接".to_string()))?;

        // 保存原始阻塞状态，创建终端后恢复
        let original_blocking = session.is_blocking();
        println!("🔧 创建终端会话前，session 阻塞状态: {}", original_blocking);

        // 在非阻塞模式下创建通道，需要循环重试处理WouldBlock
        // 参考docs/ssh.md中的非阻塞模式处理方法

        // 确保 session 处于非阻塞模式（终端需要非阻塞模式）
        session.set_blocking(false);

        // 创建通道 - 循环重试直到成功或真正失败
        let mut channel = loop {
            match session.channel_session() {
                Ok(ch) => break ch,
                Err(ref e) if e.code() == ssh2::ErrorCode::Session(-37) => {
                    // WouldBlock，等待一小段时间后重试
                    std::thread::sleep(std::time::Duration::from_millis(10));
                    continue;
                }
                Err(e) => {
                    return Err(LovelyResError::SSHError(format!("创建通道失败: {}", e)));
                }
            }
        };

        // 请求xterm PTY - 循环重试
        loop {
            match channel.request_pty("xterm", None, Some((cols as u32, rows as u32, 0, 0))) {
                Ok(_) => break,
                Err(ref e) if e.code() == ssh2::ErrorCode::Session(-37) => {
                    std::thread::sleep(std::time::Duration::from_millis(10));
                    continue;
                }
                Err(e) => {
                    return Err(LovelyResError::SSHError(format!("请求PTY失败: {}", e)));
                }
            }
        }

        // 启动Shell - 循环重试
        loop {
            match channel.shell() {
                Ok(_) => break,
                Err(ref e) if e.code() == ssh2::ErrorCode::Session(-37) => {
                    std::thread::sleep(std::time::Duration::from_millis(10));
                    continue;
                }
                Err(e) => {
                    return Err(LovelyResError::SSHError(format!("启动Shell失败: {}", e)));
                }
            }
        }

        // 克隆一份 Session 供读写循环使用（用于方向判定/自适应等待）
        let session_for_loop = session.clone();

        // 不要恢复阻塞状态！保持非阻塞模式，直到所有终端会话都关闭
        // session.set_blocking(original_blocking);  // 删除这行
        println!("✅ 终端会话创建完成，session 保持非阻塞模式: {}", session.is_blocking());

        let session_id = format!("terminal_{}", terminal_id);

        // 记录元数据
        let record = SSHSession {
            id: session_id.clone(),
            connection_id: "current".to_string(),
            created: chrono::Utc::now(),
            last_activity: chrono::Utc::now(),
            is_active: true,
        };
        self.active_sessions.insert(session_id.clone(), record);

        // 创建输入通道（前端 -> 后台 -> 远端）
        let (tx, rx) = mpsc::channel::<Vec<u8>>();
        self.terminal_senders.insert(session_id.clone(), tx);

        // 在后台线程中持续转发远端输出 -> 前端事件，总线名: ssh_terminal_data
        let event_terminal_id = terminal_id.to_string();
        thread::spawn(move || {
            let _session = session_for_loop;

            let mut ch = channel; // 拿到独占的通道用于读写
            let mut buf = [0u8; 8192];
            let mut error_count = 0;
            let max_errors = 50; // 进一步放宽最大连续错误次数，特别是对超时错误
            let mut last_error_time = std::time::Instant::now();

            // 非阻塞写入函数 - 分块写入并处理WouldBlock
            let write_all_nonblocking = |channel: &mut ssh2::Channel, data: &[u8]| -> std::io::Result<()> {
                let mut offset = 0;
                let mut retry_count = 0;
                const MAX_RETRIES: usize = 100;

                while offset < data.len() {
                    match channel.write(&data[offset..]) {
                        Ok(n) if n > 0 => {
                            offset += n;
                            retry_count = 0; // 重置重试计数
                        }
                        Ok(_) => {
                            // 写入0字节，等待一下
                            std::thread::sleep(std::time::Duration::from_millis(1));
                            retry_count += 1;
                            if retry_count > MAX_RETRIES {
                                return Err(std::io::Error::new(
                                    std::io::ErrorKind::TimedOut,
                                    "写入超时"
                                ));
                            }
                        }
                        Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            // 等待socket可写
                            std::thread::sleep(std::time::Duration::from_millis(1));
                            retry_count += 1;
                            if retry_count > MAX_RETRIES {
                                return Err(std::io::Error::new(
                                    std::io::ErrorKind::TimedOut,
                                    "写入超时"
                                ));
                            }
                            continue;
                        }
                        Err(e) => return Err(e),
                    }
                }

                // 刷新缓冲区
                loop {
                    match channel.flush() {
                        Ok(_) => break,
                        Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                            std::thread::sleep(std::time::Duration::from_millis(1));
                            continue;
                        }
                        Err(e) => return Err(e),
                    }
                }

                Ok(())
            };

            // Drain远端输出的函数 - 在写入前调用，确保接收缓冲区不会满
            let drain_output = |channel: &mut ssh2::Channel, buf: &mut [u8], window: &tauri::Window, terminal_id: &str| {
                loop {
                    match channel.read(buf) {
                        Ok(n) if n > 0 => {
                            // 将读取的数据发送到前端
                            let chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                            let _ = window.emit(
                                "ssh_terminal_data",
                                serde_json::json!({"terminalId": terminal_id, "data": chunk}),
                            );
                        }
                        Ok(_) => break, // 读取0字节，没有更多数据
                        Err(ref e) if e.kind() == std::io::ErrorKind::WouldBlock => break, // 没有数据可读
                        Err(_) => break, // 其他错误，停止读取
                    }
                }
            };

            // 输入缓冲队列
            let mut input_queue: Vec<Vec<u8>> = Vec::new();

            loop {
                // 1. 先drain远端输出 - 确保接收缓冲区不会满
                drain_output(&mut ch, &mut buf, &window, &event_terminal_id);

                // 2. 收集待发送的输入（限制数量避免积压）
                for _ in 0..10 {
                    if let Ok(bytes) = rx.try_recv() {
                        input_queue.push(bytes);
                    } else {
                        break;
                    }
                }

                // 3. 处理输入队列 - 小批量发送
                if !input_queue.is_empty() {
                    // 每次最多发送1KB数据，避免一次发送太多
                    let mut to_send = Vec::new();
                    let mut remaining = Vec::new();
                    let mut size = 0;

                    for data in input_queue.drain(..) {
                        if size + data.len() <= 1024 {
                            to_send.extend_from_slice(&data);
                            size += data.len();
                        } else {
                            remaining.push(data);
                        }
                    }
                    input_queue = remaining;

                    // 写入前先drain远端输出 - 关键！
                    if !to_send.is_empty() {
                        drain_output(&mut ch, &mut buf, &window, &event_terminal_id);

                        // 使用非阻塞写入
                        if let Err(e) = write_all_nonblocking(&mut ch, &to_send) {
                            let msg = format!("{}", e);
                            if msg.contains("Broken pipe") || msg.contains("Connection reset") {
                                println!("⚠️ SSH终端连接断开: {}", msg);
                                let _ = window.emit(
                                    "ssh_terminal_error",
                                    serde_json::json!({"terminalId": event_terminal_id, "error": format!("连接断开: {}", msg)}),
                                );
                                break;
                            } else if msg.contains("draining incoming flow") {
                                // 这个错误表示需要先读取远端数据
                                println!("⚠️ 需要先读取远端数据，将数据放回队列");
                                input_queue.insert(0, to_send);
                                // 不等待，立即继续循环去读取
                            } else {
                                println!("⚠️ SSH终端写入失败: {}", msg);
                                // 写入失败，将数据放回队列头部
                                input_queue.insert(0, to_send);
                                // 短暂等待
                                std::thread::sleep(std::time::Duration::from_millis(1));
                            }
                        } else {
                            // 写入成功后再次drain，确保及时读取回显
                            drain_output(&mut ch, &mut buf, &window, &event_terminal_id);
                        }
                    }
                }

                // 4. 短暂休眠避免CPU占用
                if input_queue.is_empty() {
                    std::thread::sleep(std::time::Duration::from_millis(1));
                }
            }
        });

        Ok(terminal_id.to_string())
    }

    /// 向终端会话发送输入
    pub fn send_terminal_input(&self, terminal_id: &str, data: Vec<u8>) -> LovelyResResult<()> {
        let session_id = format!("terminal_{}", terminal_id);
        if let Some(tx) = self.terminal_senders.get(&session_id) {
            tx.send(data).map_err(|e| {
                LovelyResError::SSHError(format!("发送终端输入失败: {}", e))
            })?;
            Ok(())
        } else {
            Err(LovelyResError::SSHError(format!(
                "终端会话不存在: {}",
                terminal_id
            )))
        }
    }

    /// 关闭终端会话
    pub fn close_terminal_session(&mut self, terminal_id: &str) -> LovelyResResult<()> {
        let session_id = format!("terminal_{}", terminal_id);

        println!("🔄 正在关闭终端会话: {}, 当前活跃终端数: {}", terminal_id, self.terminal_senders.len());

        // 移除发送器（这会导致后台线程退出）
        let sender_removed = self.terminal_senders.remove(&session_id).is_some();
        println!("📤 发送器移除结果: {}, 剩余活跃终端数: {}", sender_removed, self.terminal_senders.len());

        // 移除会话记录
        if let Some(_record) = self.active_sessions.remove(&session_id) {
            println!("✅ 终端会话已关闭: {}, 剩余活跃终端数: {}", terminal_id, self.terminal_senders.len());

            // 尝试关闭通道（可能已经关闭）
            // 注意：channel已经被move到后台线程，这里无法访问
            // 后台线程会在发送器被drop时自动退出

            Ok(())
        } else {
            println!("⚠️ 终端会话不存在: {}, 但发送器已移除: {}", terminal_id, sender_removed);
            // 即使会话记录不存在，只要发送器被移除了，也算成功
            if sender_removed {
                Ok(())
            } else {
                Err(LovelyResError::SSHError(format!(
                    "终端会话不存在: {}",
                    terminal_id
                )))
            }
        }
    }

    /// 关闭所有终端会话
    pub fn close_all_terminal_sessions(&mut self) -> LovelyResResult<usize> {
        println!("🔄 正在关闭所有终端会话，当前活跃终端数: {}", self.terminal_senders.len());

        // 获取所有终端ID
        let terminal_ids: Vec<String> = self.terminal_senders
            .keys()
            .filter_map(|k| k.strip_prefix("terminal_").map(|s| s.to_string()))
            .collect();

        let count = terminal_ids.len();

        // 关闭所有终端
        for terminal_id in terminal_ids {
            match self.close_terminal_session(&terminal_id) {
                Ok(_) => {
                    println!("✅ 已关闭终端会话: {}", terminal_id);
                }
                Err(e) => {
                    println!("⚠️ 关闭终端会话失败: {}, 错误: {}", terminal_id, e);
                }
            }
        }

        println!("✅ 已清理所有终端会话，共 {} 个，剩余活跃终端数: {}", count, self.terminal_senders.len());

        // 测试：不恢复阻塞模式，看看仪表盘性能如何
        // 如果所有终端都已关闭，恢复 session 为阻塞模式
        // if self.terminal_senders.is_empty() {
        //     if let Some(session) = self.current_session.as_mut() {
        //         let current_blocking = session.is_blocking();
        //         if !current_blocking {
        //             println!("🔄 所有终端已关闭，恢复 session 为阻塞模式");
        //             session.set_blocking(true);
        //             println!("✅ Session 阻塞模式已恢复: {}", session.is_blocking());
        //         }
        //     }
        // }

        Ok(count)
    }

    /// 调整终端尺寸
    pub fn resize_terminal(&self, terminal_id: &str, _cols: u32, _rows: u32) -> LovelyResResult<()> {
        let session_id = format!("terminal_{}", terminal_id);
        if let Some(_record) = self.active_sessions.get(&session_id) {
            // 注意：channel已经被move到后台线程，这里无法访问
            // 如果需要支持resize，需要通过消息传递机制
            println!("⚠️ 终端resize功能暂未实现: {}", terminal_id);
            Ok(())
        } else {
            Err(LovelyResError::SSHError(format!(
                "终端会话不存在: {}",
                terminal_id
            )))
        }
    }

    /// 获取所有活动的终端会话ID
    pub fn get_active_terminal_sessions(&self) -> Vec<String> {
        self.active_sessions
            .iter()
            .map(|(key, _)| key.clone())
            .collect()
    }

    /// 检查终端会话是否存在
    pub fn has_terminal_session(&self, terminal_id: &str) -> bool {
        let session_id = format!("terminal_{}", terminal_id);
        self.active_sessions.contains_key(&session_id)
    }

    // ==================== 私有辅助方法 ====================

    /// 生成唯一的会话ID
    fn generate_session_id() -> String {
        use std::time::{SystemTime, UNIX_EPOCH};
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();
        format!("session_{}", timestamp)
    }


}
