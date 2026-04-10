// SSH Manager using russh library
// This implementation uses a dedicated background thread with its own Tokio runtime
// to avoid nested runtime issues when called from Tauri's async context

use std::collections::HashMap;
use std::sync::{mpsc, Arc, Mutex};
use std::thread;
use serde::{Deserialize, Serialize};
use russh::client::{Config, Handle, Handler};
use russh::keys::{PublicKey, PrivateKeyWithHashAlg};
use russh::{ChannelMsg, Disconnect};
use russh_sftp::client::SftpSession;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

// ================== Types ==================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutput {
    pub command: String,
    pub output: String,
    pub exit_code: Option<i32>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchCommandResult {
    pub command: String,
    pub success: bool,
    pub output: Option<TerminalOutput>,
    pub error: Option<String>,
}

impl TerminalOutput {
    pub fn new(command: &str, output: &str, exit_code: Option<i32>) -> Self {
        Self {
            command: command.to_string(),
            output: output.to_string(),
            exit_code,
            timestamp: chrono::Utc::now(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SftpFileInfo {
    pub name: String,
    pub path: String,
    pub file_type: String,  // "directory", "file", "symlink", "other"
    pub is_dir: bool,       // 保留向后兼容
    pub size: u64,
    pub modified: Option<String>,
    pub permissions: Option<String>,
    pub owner: Option<String>,
    pub group: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHConnectionStatus {
    pub connected: bool,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub last_activity: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectionInfo {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth_method: String,
}

// ================== SSH Client Handler ==================

struct ClientHandler {
    host_key_accepted: bool,
}

impl ClientHandler {
    fn new() -> Self {
        Self {
            host_key_accepted: false,
        }
    }
}

impl Handler for ClientHandler {
    type Error = russh::Error;

    async fn check_server_key(&mut self, _server_public_key: &PublicKey) -> Result<bool, Self::Error> {
        // Accept all host keys (similar to StrictHostKeyChecking=no)
        self.host_key_accepted = true;
        Ok(true)
    }
}

// ================== Worker Thread Messages ==================

enum WorkerCommand {
    Connect {
        host: String,
        port: u16,
        username: String,
        password: Option<String>,
        private_key: Option<String>,
        response_tx: mpsc::Sender<Result<String, String>>,
    },
    ExecuteCommand {
        session_id: String,
        command: String,
        response_tx: mpsc::Sender<Result<TerminalOutput, String>>,
    },
    ListSftpFiles {
        session_id: String,
        path: String,
        response_tx: mpsc::Sender<Result<Vec<SftpFileInfo>, String>>,
    },
    ReadSftpFile {
        session_id: String,
        path: String,
        response_tx: mpsc::Sender<Result<Vec<u8>, String>>,
    },
    WriteSftpFile {
        session_id: String,
        path: String,
        content: Vec<u8>,
        response_tx: mpsc::Sender<Result<(), String>>,
    },
    DeleteSftpFile {
        session_id: String,
        path: String,
        response_tx: mpsc::Sender<Result<(), String>>,
    },
    CreateSftpDirectory {
        session_id: String,
        path: String,
        response_tx: mpsc::Sender<Result<(), String>>,
    },
    RenameSftpFile {
        session_id: String,
        old_path: String,
        new_path: String,
        response_tx: mpsc::Sender<Result<(), String>>,
    },
    Disconnect {
        session_id: String,
        response_tx: mpsc::Sender<Result<(), String>>,
    },
    DisconnectAll {
        response_tx: mpsc::Sender<Result<(), String>>,
    },
    GetConnectionInfo {
        session_id: String,
        response_tx: mpsc::Sender<Option<ConnectionInfo>>,
    },
    IsConnected {
        session_id: String,
        response_tx: mpsc::Sender<bool>,
    },
    ListSessions {
        response_tx: mpsc::Sender<Vec<String>>,
    },
    // Terminal session commands
    CreateTerminalSession {
        session_id: String,
        terminal_id: String,
        cols: u32,
        rows: u32,
        window: tauri::Window,
        response_tx: mpsc::Sender<Result<(), String>>,
    },
    CloseTerminalSession {
        terminal_id: String,
        response_tx: mpsc::Sender<Result<(), String>>,
    },
    CloseAllTerminalSessions {
        response_tx: mpsc::Sender<Result<(), String>>,
    },
    SendTerminalInput {
        terminal_id: String,
        data: Vec<u8>,
        response_tx: mpsc::Sender<Result<(), String>>,
    },
    ResizeTerminal {
        terminal_id: String,
        cols: u32,
        rows: u32,
        response_tx: mpsc::Sender<Result<(), String>>,
    },
    // Packet Capture commands
    StartPacketCapture {
        session_id: String,
        interface: String,
        filter: Option<String>,
        count: Option<u32>,
        window: tauri::Window,
        response_tx: mpsc::Sender<Result<(), String>>,
    },
    StopPacketCapture {
        session_id: String,
        response_tx: mpsc::Sender<Result<(), String>>,
    },
    ExecuteBatch {
        session_id: String,
        commands: Vec<String>,
        response_tx: mpsc::Sender<Result<Vec<Result<TerminalOutput, String>>, String>>,
    },
    Shutdown,
}

// ================== Session Data ==================

struct SessionData {
    handle: Arc<Handle<ClientHandler>>,
    info: ConnectionInfo,
    // Store active packet capture channel to allow stopping it
    packet_capture_channel: Option<tokio::sync::oneshot::Sender<()>>,
}

// ================== Terminal Session Data ==================

use russh::client::Msg;
use tauri::Emitter;

struct TerminalSession {
    channel: russh::Channel<Msg>,
    session_id: String,
    window: tauri::Window,
}

// ================== Async Helper Functions ==================

async fn connect_async(
    host: &str,
    port: u16,
    username: &str,
    password: Option<&str>,
    private_key: Option<&str>,
) -> Result<Handle<ClientHandler>, String> {
    // Configure SSH client with optimized settings
    let config = Config {
        inactivity_timeout: Some(std::time::Duration::from_secs(300)),
        keepalive_interval: Some(std::time::Duration::from_secs(30)),
        keepalive_max: 3,
        ..Default::default()
    };
    
    // Async DNS resolution with timeout
    let addr_str = format!("{}:{}", host, port);
    let addr = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio::net::lookup_host(&addr_str)
    )
    .await
    .map_err(|_| format!("DNS resolution timed out for host: {}", host))?
    .map_err(|e| format!("Failed to resolve host: {}", e))?
    .next()
    .ok_or_else(|| format!("No addresses found for host: {}", host))?;
    
    // Connect to server with timeout
    let handler = ClientHandler::new();
    let mut handle = tokio::time::timeout(
        std::time::Duration::from_secs(15),
        russh::client::connect(Arc::new(config), addr, handler)
    )
    .await
    .map_err(|_| format!("SSH connection timed out (15s) to {}:{}", host, port))?
    .map_err(|e| {
        let err_str = e.to_string();
        if err_str.contains("10061") || err_str.contains("Connection refused") {
            format!("连接被拒绝 ({}:{})：目标端口未开放或 SSH 服务未运行。请检查：\n1. 端口号是否正确\n2. SSH 服务是否启动\n3. 防火墙是否放行", host, port)
        } else if err_str.contains("10060") || err_str.contains("timed out") {
            format!("连接超时 ({}:{})：无法到达目标主机。请检查：\n1. IP 地址是否正确\n2. 网络是否可达\n3. 防火墙是否阻止", host, port)
        } else if err_str.contains("10065") || err_str.contains("No route") {
            format!("无法路由到主机 ({}:{})：网络不可达", host, port)
        } else {
            format!("连接失败 ({}:{}): {}", host, port, err_str)
        }
    })?;
    
    // Authenticate with timeout
    let auth_result = if let Some(key_str) = private_key {
        // Try key authentication
        let key_pair = if key_str.contains("OPENSSH PRIVATE KEY") || key_str.contains("RSA PRIVATE KEY") || key_str.contains("-----BEGIN") {
            russh_keys::decode_secret_key(key_str, None)
                .map_err(|e| format!("Failed to decode private key: {}", e))?
        } else {
            // Assume it's a file path
            russh_keys::load_secret_key(key_str, None)
                .map_err(|e| format!("Failed to load private key: {}", e))?
        };
        
        // Convert russh_keys::PrivateKey to russh::keys::PrivateKey
        let key_bytes = key_pair.to_openssh(russh_keys::ssh_key::LineEnding::LF)
            .map_err(|e| format!("Failed to encode key: {}", e))?;
        let russh_key = russh::keys::decode_secret_key(&key_bytes, None)
            .map_err(|e| format!("Failed to decode key for russh: {}", e))?;
        
        // Wrap key with hash algorithm for authentication
        let key_with_hash = PrivateKeyWithHashAlg::new(Arc::new(russh_key), None);
        
        tokio::time::timeout(
            std::time::Duration::from_secs(10),
            handle.authenticate_publickey(username, key_with_hash)
        )
        .await
        .map_err(|_| "Key authentication timed out (10s)".to_string())?
        .map_err(|e| format!("Key authentication failed: {}", e))?
    } else if let Some(pwd) = password {
        // Password authentication
        tokio::time::timeout(
            std::time::Duration::from_secs(10),
            handle.authenticate_password(username, pwd)
        )
        .await
        .map_err(|_| "Password authentication timed out (10s)".to_string())?
        .map_err(|e| format!("Password authentication failed: {}", e))?
    } else {
        return Err("No authentication method provided".to_string());
    };
    
    // Check authentication result
    if !auth_result.success() {
        return Err("Authentication failed".to_string());
    }
    
    Ok(handle)
}

async fn execute_command_async(
    handle: &Handle<ClientHandler>,
    command: &str,
) -> Result<TerminalOutput, String> {
    // Open a session channel
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {}", e))?;
    
    // Execute command
    channel
        .exec(true, command)
        .await
        .map_err(|e| format!("Failed to execute command: {}", e))?;
    
    // Read output
    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    let mut exit_code: Option<i32> = None;
    
    let mut channel = channel;
    loop {
        match channel.wait().await {
            Some(ChannelMsg::Data { data }) => {
                stdout.extend_from_slice(&data);
            }
            Some(ChannelMsg::ExtendedData { data, ext }) => {
                if ext == 1 {
                    // stderr
                    stderr.extend_from_slice(&data);
                }
            }
            Some(ChannelMsg::ExitStatus { exit_status }) => {
                exit_code = Some(exit_status as i32);
            }
            Some(ChannelMsg::Eof) | None => {
                break;
            }
            _ => {}
        }
    }
    
    // Combine stdout and stderr, with stderr appended if not empty
    let mut output = String::from_utf8_lossy(&stdout).to_string();
    if !stderr.is_empty() {
        if !output.is_empty() && !output.ends_with('\n') {
            output.push('\n');
        }
        output.push_str(&String::from_utf8_lossy(&stderr));
    }
    
    Ok(TerminalOutput::new(command, &output, exit_code))
}

async fn list_sftp_files_async(
    handle: &Handle<ClientHandler>,
    path: &str,
) -> Result<Vec<SftpFileInfo>, String> {
    // Open SFTP subsystem
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {}", e))?;
    
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| format!("Failed to request SFTP subsystem: {}", e))?;
    
    let sftp = SftpSession::new(channel.into_stream())
        .await
        .map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    
    // Read directory
    let dir = sftp
        .read_dir(path)
        .await
        .map_err(|e| format!("Failed to read directory: {}", e))?;
    
    let mut files = Vec::new();
    for entry in dir {
        let file_name = entry.file_name();
        let file_path = if path.ends_with('/') {
            format!("{}{}", path, file_name)
        } else {
            format!("{}/{}", path, file_name)
        };
        
        let attrs = entry.metadata();
        // 根据 permissions 字段判断文件类型
        // Unix 文件类型掩码: 0o170000
        // S_IFDIR  = 0o040000 (目录)
        // S_IFREG  = 0o100000 (普通文件)
        // S_IFLNK  = 0o120000 (符号链接)
        let (file_type, is_dir) = if let Some(perms) = attrs.permissions {
            let file_type_bits = perms & 0o170000;
            match file_type_bits {
                0o040000 => ("directory".to_string(), true),   // S_IFDIR
                0o120000 => ("symlink".to_string(), false),    // S_IFLNK
                0o100000 => ("file".to_string(), false),       // S_IFREG
                _ => ("other".to_string(), false),
            }
        } else {
            // 如果没有 permissions，使用 file_type() 方法
            let ft = entry.file_type();
            if ft.is_dir() {
                ("directory".to_string(), true)
            } else if ft.is_symlink() {
                ("symlink".to_string(), false)
            } else {
                ("file".to_string(), false)
            }
        };
        let size = attrs.size.unwrap_or(0);
        
        let modified = attrs.mtime.map(|t| {
            chrono::DateTime::from_timestamp(t as i64, 0)
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string())
                .unwrap_or_default()
        });
        
        let permissions = attrs.permissions.map(|p| format!("{:o}", p));
        
        // Extract owner/group: prefer string names (SFTP v4+), fall back to uid/gid
        let owner = attrs.user.clone()
            .or_else(|| attrs.uid.map(|u| u.to_string()));
        let group = attrs.group.clone()
            .or_else(|| attrs.gid.map(|g| g.to_string()));
        
        files.push(SftpFileInfo {
            name: file_name,
            path: file_path,
            file_type,
            is_dir,
            size,
            modified,
            permissions,
            owner,
            group,
        });
    }
    
    Ok(files)
}

async fn read_sftp_file_async(
    handle: &Handle<ClientHandler>,
    path: &str,
) -> Result<Vec<u8>, String> {
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {}", e))?;
    
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| format!("Failed to request SFTP subsystem: {}", e))?;
    
    let sftp = SftpSession::new(channel.into_stream())
        .await
        .map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    
    let mut file = sftp
        .open(path)
        .await
        .map_err(|e| format!("Failed to open file: {}", e))?;
    
    let mut content = Vec::new();
    file.read_to_end(&mut content)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;
    
    Ok(content)
}

async fn write_sftp_file_async(
    handle: &Handle<ClientHandler>,
    path: &str,
    content: &[u8],
) -> Result<(), String> {
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {}", e))?;
    
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| format!("Failed to request SFTP subsystem: {}", e))?;
    
    let sftp = SftpSession::new(channel.into_stream())
        .await
        .map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    
    let mut file = sftp
        .create(path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    file.write_all(content)
        .await
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}

async fn delete_sftp_file_async(
    handle: &Handle<ClientHandler>,
    path: &str,
) -> Result<(), String> {
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {}", e))?;
    
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| format!("Failed to request SFTP subsystem: {}", e))?;
    
    let sftp = SftpSession::new(channel.into_stream())
        .await
        .map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    
    sftp.remove_file(path)
        .await
        .map_err(|e| format!("Failed to delete file: {}", e))?;
    
    Ok(())
}

async fn create_sftp_directory_async(
    handle: &Handle<ClientHandler>,
    path: &str,
) -> Result<(), String> {
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {}", e))?;
    
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| format!("Failed to request SFTP subsystem: {}", e))?;
    
    let sftp = SftpSession::new(channel.into_stream())
        .await
        .map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    
    sftp.create_dir(path)
        .await
        .map_err(|e| format!("Failed to create directory: {}", e))?;
    
    Ok(())
}

async fn rename_sftp_file_async(
    handle: &Handle<ClientHandler>,
    old_path: &str,
    new_path: &str,
) -> Result<(), String> {
    let channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {}", e))?;
    
    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|e| format!("Failed to request SFTP subsystem: {}", e))?;
    
    let sftp = SftpSession::new(channel.into_stream())
        .await
        .map_err(|e| format!("Failed to create SFTP session: {}", e))?;
    
    sftp.rename(old_path, new_path)
        .await
        .map_err(|e| format!("Failed to rename file: {}", e))?;
    
    Ok(())
}

// ================== Worker Thread ==================

fn run_worker(rx: mpsc::Receiver<WorkerCommand>) {
    // Create a new Tokio runtime in this dedicated thread
    let rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .expect("Failed to create Tokio runtime for SSH worker");
    
    rt.block_on(async {
        let mut sessions: HashMap<String, SessionData> = HashMap::new();
        let terminal_sessions: Arc<tokio::sync::Mutex<HashMap<String, TerminalSession>>> = 
            Arc::new(tokio::sync::Mutex::new(HashMap::new()));
        
        loop {
            // Check for commands (non-blocking with a small timeout to allow checking)
            let cmd = match rx.recv() {
                Ok(cmd) => cmd,
                Err(_) => break, // Channel closed
            };
            
            match cmd {
                WorkerCommand::Connect { host, port, username, password, private_key, response_tx } => {
                    let result = connect_async(&host, port, &username, password.as_deref(), private_key.as_deref()).await;
                    match result {
                        Ok(handle) => {
                            let session_id = format!("{}@{}:{}", username, host, port);
                            let info = ConnectionInfo {
                                host: host.clone(),
                                port,
                                username: username.clone(),
                                auth_method: if private_key.is_some() { "key".to_string() } else { "password".to_string() },
                            };
                            sessions.insert(session_id.clone(), SessionData { handle: Arc::new(handle), info, packet_capture_channel: None });
                            let _ = response_tx.send(Ok(session_id));
                        }
                        Err(e) => {
                            let _ = response_tx.send(Err(e));
                        }
                    }
                }
                
                WorkerCommand::ExecuteCommand { session_id, command, response_tx } => {
                    if let Some(session) = sessions.get(&session_id) {
                        let handle = Arc::clone(&session.handle);
                        tokio::spawn(async move {
                            let result = execute_command_async(&handle, &command).await;
                            let _ = response_tx.send(result);
                        });
                    } else {
                        let _ = response_tx.send(Err(format!("Session not found: {}", session_id)));
                    }
                }
                
                WorkerCommand::ListSftpFiles { session_id, path, response_tx } => {
                    if let Some(session) = sessions.get(&session_id) {
                        let handle = Arc::clone(&session.handle);
                        tokio::spawn(async move {
                            let result = list_sftp_files_async(&handle, &path).await;
                            let _ = response_tx.send(result);
                        });
                    } else {
                        let _ = response_tx.send(Err(format!("Session not found: {}", session_id)));
                    }
                }

                WorkerCommand::ReadSftpFile { session_id, path, response_tx } => {
                    if let Some(session) = sessions.get(&session_id) {
                        let handle = Arc::clone(&session.handle);
                        tokio::spawn(async move {
                            let result = read_sftp_file_async(&handle, &path).await;
                            let _ = response_tx.send(result);
                        });
                    } else {
                        let _ = response_tx.send(Err(format!("Session not found: {}", session_id)));
                    }
                }
                
                WorkerCommand::WriteSftpFile { session_id, path, content, response_tx } => {
                    if let Some(session) = sessions.get(&session_id) {
                        let handle = Arc::clone(&session.handle);
                        tokio::spawn(async move {
                            let result = write_sftp_file_async(&handle, &path, &content).await;
                            let _ = response_tx.send(result);
                        });
                    } else {
                        let _ = response_tx.send(Err(format!("Session not found: {}", session_id)));
                    }
                }

                WorkerCommand::DeleteSftpFile { session_id, path, response_tx } => {
                    if let Some(session) = sessions.get(&session_id) {
                        let handle = Arc::clone(&session.handle);
                        tokio::spawn(async move {
                            let result = delete_sftp_file_async(&handle, &path).await;
                            let _ = response_tx.send(result);
                        });
                    } else {
                        let _ = response_tx.send(Err(format!("Session not found: {}", session_id)));
                    }
                }

                WorkerCommand::CreateSftpDirectory { session_id, path, response_tx } => {
                    if let Some(session) = sessions.get(&session_id) {
                        let handle = Arc::clone(&session.handle);
                        tokio::spawn(async move {
                            let result = create_sftp_directory_async(&handle, &path).await;
                            let _ = response_tx.send(result);
                        });
                    } else {
                        let _ = response_tx.send(Err(format!("Session not found: {}", session_id)));
                    }
                }

                WorkerCommand::RenameSftpFile { session_id, old_path, new_path, response_tx } => {
                    if let Some(session) = sessions.get(&session_id) {
                        let handle = Arc::clone(&session.handle);
                        tokio::spawn(async move {
                            let result = rename_sftp_file_async(&handle, &old_path, &new_path).await;
                            let _ = response_tx.send(result);
                        });
                    } else {
                        let _ = response_tx.send(Err(format!("Session not found: {}", session_id)));
                    }
                }
                
                WorkerCommand::Disconnect { session_id, response_tx } => {
                    let result = if let Some(mut session) = sessions.remove(&session_id) {
                        let _ = session.handle.disconnect(Disconnect::ByApplication, "User disconnected", "en").await;
                        Ok(())
                    } else {
                        Err(format!("Session not found: {}", session_id))
                    };
                    let _ = response_tx.send(result);
                }
                
                WorkerCommand::DisconnectAll { response_tx } => {
                    for (_, mut session) in sessions.drain() {
                        let _ = session.handle.disconnect(Disconnect::ByApplication, "User disconnected", "en").await;
                    }
                    let _ = response_tx.send(Ok(()));
                }
                
                WorkerCommand::GetConnectionInfo { session_id, response_tx } => {
                    let info = sessions.get(&session_id).map(|s| s.info.clone());
                    let _ = response_tx.send(info);
                }
                
                WorkerCommand::IsConnected { session_id, response_tx } => {
                    let connected = sessions.contains_key(&session_id);
                    let _ = response_tx.send(connected);
                }
                
                WorkerCommand::ListSessions { response_tx } => {
                    let session_ids: Vec<String> = sessions.keys().cloned().collect();
                    let _ = response_tx.send(session_ids);
                }
                
                // Terminal session commands
                WorkerCommand::CreateTerminalSession { session_id, terminal_id, cols, rows, window, response_tx } => {
                    let result = if let Some(session) = sessions.get(&session_id) {
                        // Open a channel for the terminal
                        match session.handle.channel_open_session().await {
                            Ok(channel) => {
                                // Request PTY
                                let pty_result = channel.request_pty(
                                    true,
                                    "xterm-256color",
                                    cols,
                                    rows,
                                    0, // pixel width
                                    0, // pixel height
                                    &[], // modes
                                ).await;
                                
                                if let Err(e) = pty_result {
                                    let _ = response_tx.send(Err(format!("Failed to request PTY: {}", e)));
                                    continue;
                                }
                                
                                // Request shell
                                if let Err(e) = channel.request_shell(true).await {
                                    let _ = response_tx.send(Err(format!("Failed to request shell: {}", e)));
                                    continue;
                                }
                                
                                // Create terminal session
                                let terminal_session = TerminalSession {
                                    channel,
                                    session_id: session_id.clone(),
                                    window: window.clone(),
                                };
                                
                                // Store it
                                let terminal_id_clone = terminal_id.clone();
                                let mut terminals = terminal_sessions.lock().await;
                                terminals.insert(terminal_id.clone(), terminal_session);
                                drop(terminals);
                                
                                // Spawn a task to read output from the channel and emit to window
                                let terminal_sessions_clone = terminal_sessions.clone();
                                let window_clone = window.clone();
                                
                                tokio::spawn(async move {
                                    loop {
                                        let mut terminals = terminal_sessions_clone.lock().await;
                                        if let Some(term) = terminals.get_mut(&terminal_id_clone) {
                                            // Try to receive data from the channel
                                            match tokio::time::timeout(
                                                std::time::Duration::from_millis(50),
                                                term.channel.wait()
                                            ).await {
                                                Ok(Some(msg)) => {
                                                    match msg {
                                                        ChannelMsg::Data { data } => {
                                                            // Send data to frontend using the same format as ssh_manager.rs
                                                            let output = String::from_utf8_lossy(&data).to_string();
                                                            let _ = window_clone.emit(
                                                                "ssh_terminal_data",
                                                                serde_json::json!({"terminalId": terminal_id_clone, "data": output}),
                                                            );
                                                        }
                                                        ChannelMsg::ExtendedData { data, ext } => {
                                                            // stderr (ext == 1)
                                                            if ext == 1 {
                                                                let output = String::from_utf8_lossy(&data).to_string();
                                                                let _ = window_clone.emit(
                                                                    "ssh_terminal_data",
                                                                    serde_json::json!({"terminalId": terminal_id_clone, "data": output}),
                                                                );
                                                            }
                                                        }
                                                        ChannelMsg::ExitStatus { exit_status: _ } => {
                                                            let _ = window_clone.emit(
                                                                "ssh_terminal_closed",
                                                                serde_json::json!({"terminalId": terminal_id_clone}),
                                                            );
                                                            break;
                                                        }
                                                        ChannelMsg::Eof => {
                                                            let _ = window_clone.emit(
                                                                "ssh_terminal_closed",
                                                                serde_json::json!({"terminalId": terminal_id_clone}),
                                                            );
                                                            break;
                                                        }
                                                        ChannelMsg::Close => {
                                                            break;
                                                        }
                                                        _ => {}
                                                    }
                                                }
                                                Ok(None) => {
                                                    // Channel closed
                                                    break;
                                                }
                                                Err(_) => {
                                                    // Timeout - continue
                                                }
                                            }
                                        } else {
                                            // Terminal removed
                                            break;
                                        }
                                        drop(terminals);
                                        // Small yield to prevent busy loop
                                        tokio::task::yield_now().await;
                                    }
                                    
                                    // Clean up terminal session when done
                                    let mut terminals = terminal_sessions_clone.lock().await;
                                    terminals.remove(&terminal_id_clone);
                                });
                                
                                Ok(())
                            }
                            Err(e) => Err(format!("Failed to open channel: {}", e)),
                        }
                    } else {
                        Err(format!("Session not found: {}", session_id))
                    };
                    let _ = response_tx.send(result);
                }
                
                WorkerCommand::SendTerminalInput { terminal_id, data, response_tx } => {
                    let mut terminals = terminal_sessions.lock().await;
                    let result = if let Some(term) = terminals.get_mut(&terminal_id) {
                        term.channel.data(&data[..]).await
                            .map_err(|e| format!("Failed to send data: {}", e))
                    } else {
                        Err(format!("Terminal session not found: {}", terminal_id))
                    };
                    drop(terminals);
                    let _ = response_tx.send(result);
                }
                
                WorkerCommand::CloseTerminalSession { terminal_id, response_tx } => {
                    let mut terminals = terminal_sessions.lock().await;
                    let result = if let Some(mut term) = terminals.remove(&terminal_id) {
                        let _ = term.channel.eof().await;
                        let _ = term.channel.close().await;
                        Ok(())
                    } else {
                        Ok(()) // Already closed
                    };
                    drop(terminals);
                    let _ = response_tx.send(result);
                }
                
                WorkerCommand::CloseAllTerminalSessions { response_tx } => {
                    let mut terminals = terminal_sessions.lock().await;
                    for (_, mut term) in terminals.drain() {
                        let _ = term.channel.eof().await;
                        let _ = term.channel.close().await;
                    }
                    drop(terminals);
                    let _ = response_tx.send(Ok(()));
                }
                
                WorkerCommand::ResizeTerminal { terminal_id, cols, rows, response_tx } => {
                    let terminals = terminal_sessions.lock().await;
                    let result = if let Some(term) = terminals.get(&terminal_id) {
                        term.channel.window_change(cols, rows, 0, 0).await
                            .map_err(|e| format!("Failed to resize terminal: {}", e))
                    } else {
                        Err(format!("Terminal session not found: {}", terminal_id))
                    };
                    drop(terminals);
                    let _ = response_tx.send(result);
                }

                WorkerCommand::StartPacketCapture { session_id, interface, filter, count, window, response_tx } => {
                    let result = if let Some(session) = sessions.get_mut(&session_id) {
                        // Stop existing capture if any
                        if let Some(tx) = session.packet_capture_channel.take() {
                            let _ = tx.send(());
                        }

                        // Create new cancellation channel
                        let (cancel_tx, cancel_rx) = tokio::sync::oneshot::channel();
                        session.packet_capture_channel = Some(cancel_tx);

                        // Generate command
                        let cmd = crate::packet_capture::generate_tcpdump_command(&interface, filter.as_deref(), count);
                        let window_clone = window.clone();

                        // Open the channel BEFORE spawning the task (can't clone Handle)
                        match session.handle.channel_open_session().await {
                            Ok(mut channel) => {
                                // Execute the capture command
                                let cmd_bytes: Vec<u8> = cmd.as_bytes().to_vec();
                                if let Err(e) = channel.exec(true, cmd_bytes.as_slice()).await {
                                    let _ = window_clone.emit("packet_capture_error", format!("Failed to execute command: {}", e));
                                } else {
                                    // Spawn capture task to read output
                                    tokio::spawn(async move {
                                        let mut cancel_rx = cancel_rx;
                                        let mut buffer = Vec::new();
                                        let mut packet_id = 0;

                                        loop {
                                            tokio::select! {
                                                _ = &mut cancel_rx => {
                                                    // Cancelled
                                                    let _ = channel.close().await;
                                                    break;
                                                }
                                                msg = channel.wait() => {
                                                    match msg {
                                                        Some(ChannelMsg::Data { data }) => {
                                                            buffer.extend_from_slice(&data);
                                                            
                                                            // Process lines
                                                            while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
                                                                let line_bytes = buffer.drain(..=pos).collect::<Vec<u8>>();
                                                                let line = String::from_utf8_lossy(&line_bytes);
                                                                let trimmed_line = line.trim();
                                                                
                                                                if !trimmed_line.is_empty() {
                                                                    packet_id += 1;
                                                                    let packet = crate::packet_capture::parse_tcpdump_line(trimmed_line, packet_id);
                                                                    let _ = window_clone.emit("packet_capture_data", packet);
                                                                }
                                                            }
                                                        }
                                                        Some(ChannelMsg::ExtendedData { data, .. }) => {
                                                            let info = String::from_utf8_lossy(&data);
                                                            let _ = window_clone.emit("packet_capture_info", info.to_string());
                                                        }
                                                        Some(ChannelMsg::ExitStatus { .. }) | Some(ChannelMsg::Eof) | Some(ChannelMsg::Close) | None => {
                                                            break;
                                                        }
                                                        _ => {}
                                                    }
                                                }
                                            }
                                        }
                                        
                                        let _ = window_clone.emit("packet_capture_stopped", ());
                                    });
                                }
                            }
                            Err(e) => {
                                let _ = window_clone.emit("packet_capture_error", format!("Failed to open channel: {}", e));
                            }
                        }

                        Ok(())
                    } else {
                        Err(format!("Session not found: {}", session_id))
                    };
                    let _ = response_tx.send(result);
                }

                WorkerCommand::StopPacketCapture { session_id, response_tx } => {
                    let result = if let Some(session) = sessions.get_mut(&session_id) {
                        if let Some(tx) = session.packet_capture_channel.take() {
                            let _ = tx.send(());
                            Ok(())
                        } else {
                            Ok(()) // Already stopped
                        }
                    } else {
                        Err(format!("Session not found: {}", session_id))
                    };
                    let _ = response_tx.send(result);
                }
                
                WorkerCommand::ExecuteBatch { session_id, commands, response_tx } => {
                    if let Some(session) = sessions.get(&session_id) {
                        let handle = Arc::clone(&session.handle);
                        tokio::spawn(async move {
                            // Execute all commands in parallel using separate SSH channels
                            let mut futures = Vec::with_capacity(commands.len());
                            for cmd in &commands {
                                futures.push(execute_command_async(&handle, cmd));
                            }
                            let results = futures::future::join_all(futures).await;
                            let _ = response_tx.send(Ok(results));
                        });
                    } else {
                        let _ = response_tx.send(Err(format!("Session not found: {}", session_id)));
                    }
                }
                
                WorkerCommand::Shutdown => {
                    // Disconnect all sessions before shutdown
                    for (_, mut session) in sessions.drain() {
                        let _ = session.handle.disconnect(Disconnect::ByApplication, "Shutdown", "en").await;
                    }
                    break;
                }
            }
        }
    });
}

// ================== Main SSHManager Struct ==================

pub struct SSHManagerRussh {
    /// Wrapped in Mutex to make SSHManagerRussh Sync-safe.
    /// The Mutex is only held for the duration of send() (microseconds),
    /// NOT for the entire command execution, enabling true concurrency.
    worker_tx: Mutex<mpsc::Sender<WorkerCommand>>,
    _worker_handle: Mutex<thread::JoinHandle<()>>,
    // Track current active session for backward compatibility
    current_session: Arc<Mutex<Option<String>>>,
    /// busybox 路径 (None = 未启用, Some = 已启用，存储远端路径如 /tmp/busybox)
    busybox_path: Mutex<Option<String>>,
}

impl SSHManagerRussh {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel();
        let handle = thread::spawn(move || run_worker(rx));

        Self {
            worker_tx: Mutex::new(tx),
            _worker_handle: Mutex::new(handle),
            current_session: Arc::new(Mutex::new(None)),
            busybox_path: Mutex::new(None),
        }
    }

    /// Send a command to the worker thread. The Mutex is only held for send().
    fn send_to_worker(&self, cmd: WorkerCommand) -> Result<(), String> {
        self.worker_tx
            .lock()
            .map_err(|_| "Failed to acquire worker lock".to_string())?
            .send(cmd)
            .map_err(|_| "Worker thread has shut down".to_string())
    }
    
    fn get_current_session(&self) -> Result<String, String> {
        self.current_session
            .lock()
            .map_err(|_| "Failed to lock session".to_string())?
            .clone()
            .ok_or_else(|| "No active session. Please connect first.".to_string())
    }
    
    fn set_current_session(&self, session_id: Option<String>) {
        if let Ok(mut guard) = self.current_session.lock() {
            *guard = session_id;
        }
    }
    
    // ================== Connection Methods ==================
    
    /// Connect to SSH server (backward compatible - sets as current session)
    pub fn connect(
        &self,
        host: &str,
        port: u16,
        username: &str,
        password: Option<&str>,
        private_key: Option<&str>,
    ) -> Result<String, String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::Connect {
                host: host.to_string(),
                port,
                username: username.to_string(),
                password: password.map(|s| s.to_string()),
                private_key: private_key.map(|s| s.to_string()),
                response_tx,
            })
?;
        
        let result = response_rx
            .recv_timeout(std::time::Duration::from_secs(30))
            .map_err(|_| "连接超时：服务器在 30 秒内未响应".to_string())??;

        // Set as current session
        self.set_current_session(Some(result.clone()));
        
        Ok(result)
    }
    
    /// Execute command on current session (backward compatible)
    /// 如果启用了 busybox 模式，自动用 busybox sh -c 包裹命令
    pub fn execute_command(&self, command: &str) -> Result<TerminalOutput, String> {
        let session_id = self.get_current_session()?;
        let final_command = self.wrap_with_busybox(command);
        self.execute_command_on_session(&session_id, &final_command)
    }

    /// 如果 busybox 已启用，用 busybox sh -c 执行命令
    /// busybox sh 是静态链接的，不受 LD_PRELOAD 和被篡改的系统命令影响
    fn wrap_with_busybox(&self, command: &str) -> String {
        if let Ok(guard) = self.busybox_path.lock() {
            if let Some(ref bb) = *guard {
                // 用 busybox sh -c 执行，确保 PATH 优先使用 busybox 自带命令
                // 设置 PATH 让 busybox 内置命令优先于系统命令
                return format!(
                    "export BUSYBOX='{}'; {} sh -c '{}'",
                    bb,
                    bb,
                    command.replace('\'', "'\\''")
                );
            }
        }
        command.to_string()
    }

    // ── busybox 管理 ──

    /// 设置 busybox 路径（启用 busybox 模式）
    pub fn set_busybox_path(&self, path: Option<String>) {
        if let Ok(mut guard) = self.busybox_path.lock() {
            *guard = path;
        }
    }

    /// 获取当前 busybox 路径
    pub fn get_busybox_path(&self) -> Option<String> {
        self.busybox_path.lock().ok().and_then(|g| g.clone())
    }
    
    /// Execute command on specific session
    pub fn execute_command_on_session(&self, session_id: &str, command: &str) -> Result<TerminalOutput, String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::ExecuteCommand {
                session_id: session_id.to_string(),
                command: command.to_string(),
                response_tx,
            })
?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(60))
            .map_err(|_| "命令执行超时（60 秒）".to_string())?
    }

    /// Execute multiple commands in parallel on the current session
    pub fn execute_batch_commands(&self, commands: &[String]) -> Result<Vec<Result<TerminalOutput, String>>, String> {
        let session_id = self.get_current_session()?;
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::ExecuteBatch {
                session_id,
                commands: commands.to_vec(),
                response_tx,
            })
?;
        
        // Longer timeout for batch: 60s base + 5s per command
        let timeout_secs = 60 + (commands.len() as u64 * 5);
        response_rx
            .recv_timeout(std::time::Duration::from_secs(timeout_secs))
            .map_err(|_| format!("批量命令执行超时（{} 秒）", timeout_secs))?
    }

    // ================== SFTP Methods ==================
    
    /// List files in directory on current session
    pub fn list_sftp_files(&self, path: &str) -> Result<Vec<SftpFileInfo>, String> {
        let session_id = self.get_current_session()?;
        self.list_sftp_files_on_session(&session_id, path)
    }
    
    /// List files in directory on specific session
    pub fn list_sftp_files_on_session(&self, session_id: &str, path: &str) -> Result<Vec<SftpFileInfo>, String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::ListSftpFiles {
                session_id: session_id.to_string(),
                path: path.to_string(),
                response_tx,
            })
?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(120))
            .map_err(|_| "操作超时（120 秒）".to_string())?
    }
    
    /// Read file contents on current session
    pub fn read_sftp_file(&self, path: &str) -> Result<Vec<u8>, String> {
        let session_id = self.get_current_session()?;
        self.read_sftp_file_on_session(&session_id, path)
    }
    
    /// Read file contents on specific session
    pub fn read_sftp_file_on_session(&self, session_id: &str, path: &str) -> Result<Vec<u8>, String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::ReadSftpFile {
                session_id: session_id.to_string(),
                path: path.to_string(),
                response_tx,
            })
?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(120))
            .map_err(|_| "操作超时（120 秒）".to_string())?
    }
    
    /// Write file on current session
    pub fn write_sftp_file(&self, path: &str, content: &[u8]) -> Result<(), String> {
        let session_id = self.get_current_session()?;
        self.write_sftp_file_on_session(&session_id, path, content)
    }
    
    /// Write file on specific session
    pub fn write_sftp_file_on_session(&self, session_id: &str, path: &str, content: &[u8]) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::WriteSftpFile {
                session_id: session_id.to_string(),
                path: path.to_string(),
                content: content.to_vec(),
                response_tx,
            })
?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(120))
            .map_err(|_| "操作超时（120 秒）".to_string())?
    }
    
    /// Delete file on current session
    pub fn delete_sftp_file(&self, path: &str) -> Result<(), String> {
        let session_id = self.get_current_session()?;
        self.delete_sftp_file_on_session(&session_id, path)
    }
    
    /// Delete file on specific session
    pub fn delete_sftp_file_on_session(&self, session_id: &str, path: &str) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::DeleteSftpFile {
                session_id: session_id.to_string(),
                path: path.to_string(),
                response_tx,
            })
?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(120))
            .map_err(|_| "操作超时（120 秒）".to_string())?
    }
    
    /// Create directory on current session
    pub fn create_sftp_directory(&self, path: &str) -> Result<(), String> {
        let session_id = self.get_current_session()?;
        self.create_sftp_directory_on_session(&session_id, path)
    }
    
    /// Create directory on specific session
    pub fn create_sftp_directory_on_session(&self, session_id: &str, path: &str) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::CreateSftpDirectory {
                session_id: session_id.to_string(),
                path: path.to_string(),
                response_tx,
            })
?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(120))
            .map_err(|_| "操作超时（120 秒）".to_string())?
    }
    
    /// Rename file on current session
    pub fn rename_sftp_file(&self, old_path: &str, new_path: &str) -> Result<(), String> {
        let session_id = self.get_current_session()?;
        self.rename_sftp_file_on_session(&session_id, old_path, new_path)
    }
    
    /// Rename file on specific session
    pub fn rename_sftp_file_on_session(&self, session_id: &str, old_path: &str, new_path: &str) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::RenameSftpFile {
                session_id: session_id.to_string(),
                old_path: old_path.to_string(),
                new_path: new_path.to_string(),
                response_tx,
            })
?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(120))
            .map_err(|_| "操作超时（120 秒）".to_string())?
    }
    
    // ================== Session Management ==================
    
    /// Disconnect current session (backward compatible)
    pub fn disconnect(&self) -> Result<(), String> {
        if let Some(session_id) = self.current_session.lock().ok().and_then(|g| g.clone()) {
            self.disconnect_session(&session_id)?;
            self.set_current_session(None);
        }
        Ok(())
    }
    
    /// Disconnect specific session
    pub fn disconnect_session(&self, session_id: &str) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::Disconnect {
                session_id: session_id.to_string(),
                response_tx,
            })
?;
        
        let result = response_rx
            .recv_timeout(std::time::Duration::from_secs(120))
            .map_err(|_| "操作超时（120 秒）".to_string())?;
        
        // If disconnecting current session, clear it
        if let Ok(guard) = self.current_session.lock() {
            if guard.as_ref() == Some(&session_id.to_string()) {
                drop(guard);
                self.set_current_session(None);
            }
        }
        
        result
    }
    
    /// Disconnect all sessions
    pub fn disconnect_all(&self) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::DisconnectAll {
                response_tx,
            })
?;
        
        self.set_current_session(None);
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(120))
            .map_err(|_| "操作超时（120 秒）".to_string())?
    }
    
    /// Check if current session is connected (backward compatible)
    pub fn is_connected(&self) -> bool {
        if let Some(session_id) = self.current_session.lock().ok().and_then(|g| g.clone()) {
            self.is_session_connected(&session_id)
        } else {
            false
        }
    }
    
    /// Check if specific session is connected
    pub fn is_session_connected(&self, session_id: &str) -> bool {
        let (response_tx, response_rx) = mpsc::channel();
        
        if self.send_to_worker(WorkerCommand::IsConnected {
                session_id: session_id.to_string(),
                response_tx,
            }).is_err()
        {
            return false;
        }
        
        response_rx.recv_timeout(std::time::Duration::from_secs(10)).unwrap_or(false)
    }

    /// Get connection info for current session
    pub fn get_connection_info(&self) -> Option<ConnectionInfo> {
        let session_id = self.current_session.lock().ok()?.clone()?;
        self.get_session_connection_info(&session_id)
    }
    
    /// Get connection info for specific session
    pub fn get_session_connection_info(&self, session_id: &str) -> Option<ConnectionInfo> {
        let (response_tx, response_rx) = mpsc::channel();
        
        if self.send_to_worker(WorkerCommand::GetConnectionInfo {
                session_id: session_id.to_string(),
                response_tx,
            }).is_err()
        {
            return None;
        }
        
        response_rx.recv_timeout(std::time::Duration::from_secs(10)).ok().flatten()
    }

    /// List all active sessions
    pub fn list_sessions(&self) -> Vec<String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        if self.send_to_worker(WorkerCommand::ListSessions {
                response_tx,
            }).is_err()
        {
            return Vec::new();
        }
        
        response_rx.recv_timeout(std::time::Duration::from_secs(10)).unwrap_or_default()
    }
    
    /// Get current session ID
    pub fn get_current_session_id(&self) -> Option<String> {
        self.current_session.lock().ok()?.clone()
    }
    
    /// Set current session by ID
    pub fn set_current_session_id(&self, session_id: &str) -> Result<(), String> {
        if self.is_session_connected(session_id) {
            self.set_current_session(Some(session_id.to_string()));
            Ok(())
        } else {
            Err(format!("Session not found: {}", session_id))
        }
    }
    
    // ================== Dashboard Command Methods (backward compatibility) ==================
    
    /// Execute dashboard command (same as execute_command, for backward compatibility)
    pub fn execute_dashboard_command(&self, command: &str) -> Result<TerminalOutput, String> {
        self.execute_command(command)
    }
    
    /// Execute dashboard command as specific user
    pub fn execute_dashboard_command_as_user(&self, command: &str, username: Option<&str>) -> Result<TerminalOutput, String> {
        let final_command = if let Some(user) = username {
            // Use sudo -u to switch user for command execution
            // Use su -c as fallback if sudo is not available
            format!(
                "if command -v sudo &>/dev/null; then sudo -u {} bash -c '{}'; else su - {} -c '{}'; fi",
                user,
                command.replace("'", "'\\''"),
                user,
                command.replace("'", "'\\''")
            )
        } else {
            command.to_string()
        };
        
        self.execute_command(&final_command)
    }
    
    /// Get connection status (backward compatibility)
    pub fn get_connection_status(&self) -> Option<SSHConnectionStatus> {
        if let Some(info) = self.get_connection_info() {
            Some(SSHConnectionStatus {
                connected: true,
                host: info.host,
                port: info.port,
                username: info.username,
                last_activity: chrono::Utc::now(),
            })
        } else {
            None
        }
    }
    
    /// Get file details via SFTP
    pub fn get_file_details(&self, path: &str) -> Result<SftpFileDetails, String> {
        // Execute stat command to get file details
        let stat_cmd = format!(
            "stat -c '%n|%F|%s|%a|%U|%G|%W|%Y|%X' '{}' 2>/dev/null || ls -la '{}'",
            path.replace("'", "'\\''"),
            path.replace("'", "'\\''")
        );
        
        let output = self.execute_command(&stat_cmd)?;
        let output_str = output.output.trim();
        
        // Try to parse stat output
        let parts: Vec<&str> = output_str.split('|').collect();
        if parts.len() >= 9 {
            let name = std::path::Path::new(parts[0])
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| parts[0].to_string());
            
            let file_type = match parts[1] {
                "regular file" => "file",
                "regular empty file" => "file",
                "directory" => "directory",
                "symbolic link" => "symlink",
                "block special file" => "block",
                "character special file" => "char",
                "socket" => "socket",
                "FIFO" => "fifo",
                _ => "unknown",
            };
            
            let size: u64 = parts[2].parse().unwrap_or(0);
            let permissions = parts[3].to_string();
            let owner = Some(parts[4].to_string());
            let group = Some(parts[5].to_string());
            
            let created = parts[6].parse::<i64>().ok()
                .filter(|&t| t > 0)
                .and_then(|t| chrono::DateTime::from_timestamp(t, 0))
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string());
            
            let modified = parts[7].parse::<i64>().ok()
                .and_then(|t| chrono::DateTime::from_timestamp(t, 0))
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string());
            
            let accessed = parts[8].parse::<i64>().ok()
                .and_then(|t| chrono::DateTime::from_timestamp(t, 0))
                .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string());
            
            Ok(SftpFileDetails {
                name,
                path: path.to_string(),
                file_type: file_type.to_string(),
                size,
                permissions,
                owner,
                group,
                created,
                modified,
                accessed,
            })
        } else {
            // Fallback: parse ls -la output
            let name = std::path::Path::new(path)
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| path.to_string());
            
            Ok(SftpFileDetails {
                name,
                path: path.to_string(),
                file_type: "unknown".to_string(),
                size: 0,
                permissions: "unknown".to_string(),
                owner: None,
                group: None,
                created: None,
                modified: None,
                accessed: None,
            })
        }
    }
    
    // ================== Additional Methods for Backward Compatibility ==================
    
    /// Create interactive terminal session
    pub fn create_terminal_session(
        &self,
        window: tauri::Window,
        terminal_id: &str,
        cols: u32,
        rows: u32,
    ) -> Result<(), String> {
        let session_id = self.get_current_session()?;
        
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::CreateTerminalSession {
                session_id,
                terminal_id: terminal_id.to_string(),
                cols,
                rows,
                window,
                response_tx,
            })
?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(30))
            .map_err(|_| "Timeout waiting for terminal session creation".to_string())?
    }
    
    /// Close terminal session
    pub fn close_terminal_session(&self, terminal_id: &str) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::CloseTerminalSession {
                terminal_id: terminal_id.to_string(),
                response_tx,
            })
?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(10))
            .map_err(|_| "Timeout waiting for terminal close".to_string())?
    }
    
    /// Close all terminal sessions
    pub fn close_all_terminal_sessions(&self) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::CloseAllTerminalSessions { response_tx })
?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(10))
            .map_err(|_| "Timeout waiting for close all terminals".to_string())?
    }
    
    /// Send input to terminal
    pub fn send_terminal_input(&self, terminal_id: &str, data: Vec<u8>) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::SendTerminalInput {
                terminal_id: terminal_id.to_string(),
                data,
                response_tx,
            })
?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(5))
            .map_err(|_| "Timeout waiting for terminal input send".to_string())?
    }
    
    /// Resize terminal
    pub fn resize_terminal(&self, terminal_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::ResizeTerminal {
                terminal_id: terminal_id.to_string(),
                cols,
                rows,
                response_tx,
            })
?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(5))
            .map_err(|_| "Timeout waiting for terminal resize".to_string())?
    }
    
    /// Change file permissions
    pub fn chmod_sftp(&self, path: &str, mode: u32) -> Result<(), String> {
        let cmd = format!("chmod {:o} '{}'", mode, path.replace("'", "'\\''"));
        self.execute_command(&cmd)?;
        Ok(())
    }

    // ================== Packet Capture Methods ==================

    pub fn start_packet_capture(
        &self,
        interface: &str,
        filter: Option<String>,
        count: Option<u32>,
        window: tauri::Window,
    ) -> Result<(), String> {
        let session_id = self.get_current_session()?;
        
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::StartPacketCapture {
                session_id,
                interface: interface.to_string(),
                filter,
                count,
                window,
                response_tx,
            })
?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(5))
            .map_err(|_| "Timeout waiting for packet capture start".to_string())?
    }

    pub fn stop_packet_capture(&self) -> Result<(), String> {
        let session_id = self.get_current_session()?;
        
        let (response_tx, response_rx) = mpsc::channel();
        
        self.send_to_worker(WorkerCommand::StopPacketCapture {
                session_id,
                response_tx,
            })
?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(5))
            .map_err(|_| "Timeout waiting for packet capture stop".to_string())?
    }
    
    /// Get bash environment info
    pub fn get_bash_environment_info(&self) -> Result<crate::types::BashEnvironmentInfo, String> {
        let cmd = r#"echo "BASH_VERSION=$BASH_VERSION"
echo "SHELL=$SHELL"
echo "PS1=$PS1"
echo "PWD=$PWD"
echo "HOME=$HOME"
echo "USER=$USER"
echo "HOSTNAME=$(hostname)"
echo "PATH=$PATH""#;
        
        let output = self.execute_command(cmd)?;
        
        let mut bash_version = String::new();
        let mut shell_type = String::new();
        let mut ps1 = String::new();
        let mut pwd = String::new();
        let mut home = String::new();
        let mut user = String::new();
        let mut hostname = String::new();
        let mut path = String::new();
        
        for line in output.output.lines() {
            if let Some(val) = line.strip_prefix("BASH_VERSION=") {
                bash_version = val.to_string();
            } else if let Some(val) = line.strip_prefix("SHELL=") {
                shell_type = if val.contains("bash") { "bash".to_string() } else { "sh".to_string() };
            } else if let Some(val) = line.strip_prefix("PS1=") {
                ps1 = val.to_string();
            } else if let Some(val) = line.strip_prefix("PWD=") {
                pwd = val.to_string();
            } else if let Some(val) = line.strip_prefix("HOME=") {
                home = val.to_string();
            } else if let Some(val) = line.strip_prefix("USER=") {
                user = val.to_string();
            } else if let Some(val) = line.strip_prefix("HOSTNAME=") {
                hostname = val.to_string();
            } else if let Some(val) = line.strip_prefix("PATH=") {
                path = val.to_string();
            }
        }
        
        Ok(crate::types::BashEnvironmentInfo {
            bash_version,
            shell_type,
            ps1,
            pwd,
            home,
            user,
            hostname,
            path,
        })
    }
    
    /// Get command completion suggestions
    pub fn get_command_completion(&self, input: &str) -> Result<crate::types::CommandCompletion, String> {
        // Simple completion using compgen
        let cmd = format!(
            "compgen -c '{}' 2>/dev/null | head -20",
            input.replace("'", "'\\''")
        );
        let output = self.execute_command(&cmd)?;
        let completions: Vec<String> = output
            .output
            .lines()
            .map(|s| s.to_string())
            .collect();
        
        Ok(crate::types::CommandCompletion {
            completions,
            prefix: input.to_string(),
        })
    }
    
    /// Compress file
    pub fn compress_file(&self, source_path: &str, target_path: &str, format: &str) -> Result<(), String> {
        let cmd = match format.to_lowercase().as_str() {
            "zip" => format!(
                "zip -r '{}' '{}'",
                target_path.replace("'", "'\\''"),
                source_path.replace("'", "'\\''")
            ),
            "tar.gz" | "tgz" => format!(
                "tar -czf '{}' '{}'",
                target_path.replace("'", "'\\''"),
                source_path.replace("'", "'\\''")
            ),
            "tar.bz2" => format!(
                "tar -cjf '{}' '{}'",
                target_path.replace("'", "'\\''"),
                source_path.replace("'", "'\\''")
            ),
            "tar" => format!(
                "tar -cf '{}' '{}'",
                target_path.replace("'", "'\\''"),
                source_path.replace("'", "'\\''")
            ),
            _ => return Err(format!("Unsupported compression format: {}", format)),
        };
        
        let output = self.execute_command(&cmd)?;
        if output.exit_code.unwrap_or(0) != 0 {
            return Err(format!("Compression failed: {}", output.output));
        }
        Ok(())
    }
    
    /// Extract file
    pub fn extract_file(&self, source_path: &str, target_dir: &str) -> Result<(), String> {
        // Detect format and extract
        let cmd = if source_path.ends_with(".zip") {
            format!(
                "unzip -o '{}' -d '{}'",
                source_path.replace("'", "'\\''"),
                target_dir.replace("'", "'\\''")
            )
        } else if source_path.ends_with(".tar.gz") || source_path.ends_with(".tgz") {
            format!(
                "tar -xzf '{}' -C '{}'",
                source_path.replace("'", "'\\''"),
                target_dir.replace("'", "'\\''")
            )
        } else if source_path.ends_with(".tar.bz2") {
            format!(
                "tar -xjf '{}' -C '{}'",
                source_path.replace("'", "'\\''"),
                target_dir.replace("'", "'\\''")
            )
        } else if source_path.ends_with(".tar") {
            format!(
                "tar -xf '{}' -C '{}'",
                source_path.replace("'", "'\\''"),
                target_dir.replace("'", "'\\''")
            )
        } else {
            return Err(format!("Unknown archive format: {}", source_path));
        };
        
        let output = self.execute_command(&cmd)?;
        if output.exit_code.unwrap_or(0) != 0 {
            return Err(format!("Extraction failed: {}", output.output));
        }
        Ok(())
    }
    
    /// Upload file from local to remote
    pub fn upload_file(&self, local_path: &str, remote_path: &str) -> Result<(), String> {
        // Read local file
        let content = std::fs::read(local_path)
            .map_err(|e| format!("Failed to read local file: {}", e))?;
        
        // Write to remote via SFTP
        self.write_sftp_file(remote_path, &content)
    }
    
    /// Download file from remote to local
    pub fn download_file(&self, remote_path: &str, local_path: &str) -> Result<(), String> {
        // Read from remote via SFTP
        let content = self.read_sftp_file(remote_path)?;
        
        // Write to local file
        std::fs::write(local_path, &content)
            .map_err(|e| format!("Failed to write local file: {}", e))?;
        
        Ok(())
    }
    
    /// Create directory (alias for create_sftp_directory for backward compatibility)
    pub fn create_directory(&self, path: &str) -> Result<(), String> {
        self.create_sftp_directory(path)
    }
}

impl Default for SSHManagerRussh {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for SSHManagerRussh {
    fn drop(&mut self) {
        // Send shutdown command to worker thread
        let _ = self.send_to_worker(WorkerCommand::Shutdown);
    }
}
