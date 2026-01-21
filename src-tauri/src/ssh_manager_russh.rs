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
use std::net::ToSocketAddrs;

// ================== Types ==================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalOutput {
    pub command: String,
    pub output: String,
    pub exit_code: Option<i32>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
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
        use_sudo: bool,  // 是否使用sudo执行命令
        sudo_password: Option<String>, // sudo密码
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
    DeleteSftpDirectory {
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
    UpdateSudoPassword {
        session_id: String,
        password: Option<String>,
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
    Shutdown,
}

// ================== Session Data ==================

struct SessionData {
    handle: Handle<ClientHandler>,
    info: ConnectionInfo,
    use_sudo: bool,  // 是否使用sudo执行命令
    sudo_password: Option<String>, // sudo密码
    login_password: Option<String>, // 登录密码 (用于sudo回退)
}

// ================== Terminal Session Data ==================

use russh::client::Msg;
use tauri::Emitter;

struct TerminalSession {
    channel: russh::Channel<Msg>,
    _session_id: String,
    _window: tauri::Window,
}

// ================== Async Helper Functions ==================

async fn connect_async(
    host: &str,
    port: u16,
    username: &str,
    password: Option<&str>,
    private_key: Option<&str>,
) -> Result<Handle<ClientHandler>, String> {
    // Configure SSH client
    let config = Config {
        inactivity_timeout: Some(std::time::Duration::from_secs(300)),
        keepalive_interval: Some(std::time::Duration::from_secs(30)),
        keepalive_max: 3,
        ..Default::default()
    };
    
    // Resolve hostname
    let addr = format!("{}:{}", host, port)
        .to_socket_addrs()
        .map_err(|e| format!("Failed to resolve host: {}", e))?
        .next()
        .ok_or_else(|| format!("No addresses found for host: {}", host))?;
    
    // Connect to server
    let handler = ClientHandler::new();
    let mut handle = russh::client::connect(Arc::new(config), addr, handler)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;
    
    // Authenticate
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
        // They should be the same type, but we need to use the one from russh
        let key_bytes = key_pair.to_openssh(russh_keys::ssh_key::LineEnding::LF)
            .map_err(|e| format!("Failed to encode key: {}", e))?;
        let russh_key = russh::keys::decode_secret_key(&key_bytes, None)
            .map_err(|e| format!("Failed to decode key for russh: {}", e))?;
        
        // Wrap key with hash algorithm for authentication
        let key_with_hash = PrivateKeyWithHashAlg::new(Arc::new(russh_key), None);
        
        handle
            .authenticate_publickey(username, key_with_hash)
            .await
            .map_err(|e| format!("Key authentication failed: {}", e))?
    } else if let Some(pwd) = password {
        // Password authentication
        handle
            .authenticate_password(username, pwd)
            .await
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

async fn execute_sudo_command_async(
    handle: &Handle<ClientHandler>,
    command: &str,
    sudo_password: &str,
) -> Result<TerminalOutput, String> {
    // Open a session channel
    let mut channel = handle
        .channel_open_session()
        .await
        .map_err(|e| format!("Failed to open channel: {}", e))?;
    
    // Execute command with sudo -S (read password from stdin)
    let sudo_cmd = format!("sudo -S {}", command);
    channel
        .exec(true, sudo_cmd)
        .await
        .map_err(|e| format!("Failed to execute command: {}", e))?;
    
    // Write password to stdin
    // sudo -S reads password from stdin. We append newline just in case.
    // Note: We don't send EOF immediately because the command itself might produce output 
    // and we want to keep the channel open until the process exits.
    let mut pwd_input = sudo_password.to_string();
    if !pwd_input.ends_with('\n') {
        pwd_input.push('\n');
    }
    
    channel.data(pwd_input.as_bytes()).await
        .map_err(|e| format!("Failed to write password to stdin: {}", e))?;
    
    // Read output
    let mut stdout = Vec::new();
    let mut stderr = Vec::new();
    let mut exit_code: Option<i32> = None;
    
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
    
    // Combine stdout and stderr
    // Note: sudo might output the password prompt to stderr (e.g. "[sudo] password for user:")
    // We might want to filter that out if possible, but it's tricky since it varies.
    
    let stderr_str = String::from_utf8_lossy(&stderr).to_string();
    
    // Check for common sudo password errors
    if stderr_str.contains("Sorry, try again") || 
       stderr_str.contains("incorrect password") ||
       stderr_str.contains("sudo: 3 incorrect password attempts") {
        return Err("Sudo密码错误，请检查配置".to_string());
    }

    let mut output = String::from_utf8_lossy(&stdout).to_string();

    // Try to remove the password prompt from output/stderr if present
    // It usually appears on stderr, but we are appending stderr to output
    let prompt_markers = ["[sudo] password for", "Password:"];
    
    let clean_stderr = stderr_str.lines()
        .filter(|line| !prompt_markers.iter().any(|m| line.contains(m)))
        .collect::<Vec<&str>>()
        .join("\n");

    if !clean_stderr.is_empty() {
        if !output.is_empty() && !output.ends_with('\n') {
            output.push('\n');
        }
        output.push_str(&clean_stderr);
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
        
        files.push(SftpFileInfo {
            name: file_name,
            path: file_path,
            file_type,
            is_dir,
            size,
            modified,
            permissions,
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

async fn delete_sftp_directory_async(
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
    
    sftp.remove_dir(path)
        .await
        .map_err(|e| format!("Failed to delete directory: {}", e))?;
    
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
                WorkerCommand::Connect { host, port, username, password, private_key, use_sudo, sudo_password, response_tx } => {
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
                            sessions.insert(session_id.clone(), SessionData { 
                                handle, 
                                info, 
                                use_sudo, 
                                sudo_password,
                                login_password: password
                            });
                            let _ = response_tx.send(Ok(session_id));
                        }
                        Err(e) => {
                            let _ = response_tx.send(Err(e));
                        }
                    }
                }
                
                WorkerCommand::ExecuteCommand { session_id, command, response_tx } => {
                    let result = if let Some(session) = sessions.get(&session_id) {
                        // 根据use_sudo配置决定执行方式
                        if session.use_sudo {
                            // 优先使用专用 sudo 密码，如果没有则回退到登录密码
                            let effective_pwd = session.sudo_password.as_ref().or(session.login_password.as_ref());
                            
                            if let Some(pwd) = effective_pwd {
                                // 始终使用 -S 模式以避免 "terminal required" 错误
                                execute_sudo_command_async(&session.handle, &command, pwd).await
                            } else {
                                // 实在没密码，才尝试直接 sudo (通常会失败，除非是 NOPASSWD)
                                let final_command = format!("sudo {}", command);
                                execute_command_async(&session.handle, &final_command).await
                            }
                        } else {
                            // 普通执行
                            execute_command_async(&session.handle, &command).await
                        }
                    } else {
                        Err(format!("Session not found: {}", session_id))
                    };
                    let _ = response_tx.send(result);
                }
                
                WorkerCommand::ListSftpFiles { session_id, path, response_tx } => {
                    let result = if let Some(session) = sessions.get(&session_id) {
                        list_sftp_files_async(&session.handle, &path).await
                    } else {
                        Err(format!("Session not found: {}", session_id))
                    };
                    let _ = response_tx.send(result);
                }
                
                WorkerCommand::ReadSftpFile { session_id, path, response_tx } => {
                    let result = if let Some(session) = sessions.get(&session_id) {
                        read_sftp_file_async(&session.handle, &path).await
                    } else {
                        Err(format!("Session not found: {}", session_id))
                    };
                    let _ = response_tx.send(result);
                }
                
                WorkerCommand::WriteSftpFile { session_id, path, content, response_tx } => {
                    let result = if let Some(session) = sessions.get(&session_id) {
                        write_sftp_file_async(&session.handle, &path, &content).await
                    } else {
                        Err(format!("Session not found: {}", session_id))
                    };
                    let _ = response_tx.send(result);
                }
                
                WorkerCommand::DeleteSftpFile { session_id, path, response_tx } => {
                    let result = if let Some(session) = sessions.get(&session_id) {
                        delete_sftp_file_async(&session.handle, &path).await
                    } else {
                        Err(format!("Session not found: {}", session_id))
                    };
                    let _ = response_tx.send(result);
                }
                
                WorkerCommand::CreateSftpDirectory { session_id, path, response_tx } => {
                    let result = if let Some(session) = sessions.get(&session_id) {
                        create_sftp_directory_async(&session.handle, &path).await
                    } else {
                        Err(format!("Session not found: {}", session_id))
                    };
                    let _ = response_tx.send(result);
                }
                
                WorkerCommand::DeleteSftpDirectory { session_id, path, response_tx } => {
                    let result = if let Some(session) = sessions.get(&session_id) {
                        delete_sftp_directory_async(&session.handle, &path).await
                    } else {
                        Err(format!("Session not found: {}", session_id))
                    };
                    let _ = response_tx.send(result);
                }
                
                WorkerCommand::RenameSftpFile { session_id, old_path, new_path, response_tx } => {
                    let result = if let Some(session) = sessions.get(&session_id) {
                        rename_sftp_file_async(&session.handle, &old_path, &new_path).await
                    } else {
                        Err(format!("Session not found: {}", session_id))
                    };
                    let _ = response_tx.send(result);
                }

                WorkerCommand::UpdateSudoPassword { session_id, password, response_tx } => {
                    let result = if let Some(session) = sessions.get_mut(&session_id) {
                        session.sudo_password = password;
                        Ok(())
                    } else {
                        Err(format!("Session not found: {}", session_id))
                    };
                    let _ = response_tx.send(result);
                }
                
                WorkerCommand::Disconnect { session_id, response_tx } => {
                    let result = if let Some(session) = sessions.remove(&session_id) {
                        let _ = session.handle.disconnect(Disconnect::ByApplication, "User disconnected", "en").await;
                        Ok(())
                    } else {
                        Err(format!("Session not found: {}", session_id))
                    };
                    let _ = response_tx.send(result);
                }
                
                WorkerCommand::DisconnectAll { response_tx } => {
                    for (_, session) in sessions.drain() {
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
                                let term_session = TerminalSession {
                                    channel,
                                    _session_id: session_id.clone(),
                                    _window: window.clone(),
                                };
                                
                                // Store it
                                let terminal_id_clone = terminal_id.clone();
                                let mut terminals = terminal_sessions.lock().await;
                                terminals.insert(terminal_id.clone(), term_session);
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
                    let result = if let Some(term) = terminals.remove(&terminal_id) {
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
                    for (_, term) in terminals.drain() {
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
                
                WorkerCommand::Shutdown => {
                    // Disconnect all sessions before shutdown
                    for (_, session) in sessions.drain() {
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
    worker_tx: mpsc::Sender<WorkerCommand>,
    _worker_handle: thread::JoinHandle<()>,
    // Track current active session for backward compatibility
    current_session: Arc<Mutex<Option<String>>>,
}

impl SSHManagerRussh {
    pub fn new() -> Self {
        let (tx, rx) = mpsc::channel();
        let handle = thread::spawn(move || run_worker(rx));
        
        Self {
            worker_tx: tx,
            _worker_handle: handle,
            current_session: Arc::new(Mutex::new(None)),
        }
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
        self.connect_with_sudo(host, port, username, password, private_key, false, None)
    }
    
    /// Connect to SSH server with sudo option
    pub fn connect_with_sudo(
        &self,
        host: &str,
        port: u16,
        username: &str,
        password: Option<&str>,
        private_key: Option<&str>,
        use_sudo: bool,
        sudo_password: Option<&str>,
    ) -> Result<String, String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.worker_tx
            .send(WorkerCommand::Connect {
                host: host.to_string(),
                port,
                username: username.to_string(),
                password: password.map(|s| s.to_string()),
                private_key: private_key.map(|s| s.to_string()),
                use_sudo,
                sudo_password: sudo_password.map(|s| s.to_string()),
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
            
        let result = response_rx.recv().map_err(|_| "Worker thread panic or disconnected".to_string())??;
        
        // Set as current session
        self.set_current_session(Some(result.clone()));
        
        Ok(result)
    }
    
    /// Execute command on current session (backward compatible)
    pub fn execute_command(&self, command: &str) -> Result<TerminalOutput, String> {
        let session_id = self.get_current_session()?;
        self.execute_command_on_session(&session_id, command)
    }
    
    /// Execute command on specific session
    pub fn execute_command_on_session(&self, session_id: &str, command: &str) -> Result<TerminalOutput, String> {
        let (tx, rx) = mpsc::channel();
        
        self.worker_tx
            .send(WorkerCommand::ExecuteCommand {
                session_id: session_id.to_string(),
                command: command.to_string(),
                response_tx: tx,
            })
            .map_err(|e| format!("Failed to send command: {}", e))?;
        
        rx.recv()
            .map_err(|e| format!("Failed to receive response: {}", e))?
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
        
        self.worker_tx
            .send(WorkerCommand::ListSftpFiles {
                session_id: session_id.to_string(),
                path: path.to_string(),
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
        
        response_rx
            .recv()
            .map_err(|_| "Failed to receive response from worker".to_string())?
    }
    
    /// Read file contents on current session
    pub fn read_sftp_file(&self, path: &str) -> Result<Vec<u8>, String> {
        let session_id = self.get_current_session()?;
        self.read_sftp_file_on_session(&session_id, path)
    }
    
    /// Read file contents on specific session
    pub fn read_sftp_file_on_session(&self, session_id: &str, path: &str) -> Result<Vec<u8>, String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.worker_tx
            .send(WorkerCommand::ReadSftpFile {
                session_id: session_id.to_string(),
                path: path.to_string(),
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
        
        response_rx
            .recv()
            .map_err(|_| "Failed to receive response from worker".to_string())?
    }
    
    /// Write file on current session
    pub fn write_sftp_file(&self, path: &str, content: &[u8]) -> Result<(), String> {
        let session_id = self.get_current_session()?;
        self.write_sftp_file_on_session(&session_id, path, content)
    }
    
    /// Write file on specific session
    pub fn write_sftp_file_on_session(&self, session_id: &str, path: &str, content: &[u8]) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.worker_tx
            .send(WorkerCommand::WriteSftpFile {
                session_id: session_id.to_string(),
                path: path.to_string(),
                content: content.to_vec(),
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
        
        response_rx
            .recv()
            .map_err(|_| "Failed to receive response from worker".to_string())?
    }
    
    /// Delete file on current session
    pub fn delete_sftp_file(&self, path: &str) -> Result<(), String> {
        let session_id = self.get_current_session()?;
        self.delete_sftp_file_on_session(&session_id, path)
    }
    
    /// Delete file on specific session
    pub fn delete_sftp_file_on_session(&self, session_id: &str, path: &str) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.worker_tx
            .send(WorkerCommand::DeleteSftpFile {
                session_id: session_id.to_string(),
                path: path.to_string(),
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
        
        response_rx
            .recv()
            .map_err(|_| "Failed to receive response from worker".to_string())?
    }
    
    /// Create directory on current session
    pub fn create_sftp_directory(&self, path: &str) -> Result<(), String> {
        let session_id = self.get_current_session()?;
        self.create_sftp_directory_on_session(&session_id, path)
    }
    
    /// Create directory on specific session
    pub fn create_sftp_directory_on_session(&self, session_id: &str, path: &str) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.worker_tx
            .send(WorkerCommand::CreateSftpDirectory {
                session_id: session_id.to_string(),
                path: path.to_string(),
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
        
        response_rx
            .recv()
            .map_err(|_| "Failed to receive response from worker".to_string())?
    }
    
    /// Delete directory on current session
    pub fn delete_sftp_directory(&self, path: &str) -> Result<(), String> {
        let session_id = self.get_current_session()?;
        self.delete_sftp_directory_on_session(&session_id, path)
    }
    
    /// Delete directory on specific session
    pub fn delete_sftp_directory_on_session(&self, session_id: &str, path: &str) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.worker_tx
            .send(WorkerCommand::DeleteSftpDirectory {
                session_id: session_id.to_string(),
                path: path.to_string(),
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
        
        response_rx
            .recv()
            .map_err(|_| "Failed to receive response from worker".to_string())?
    }
    
    /// Rename file on current session
    pub fn rename_sftp_file(&self, old_path: &str, new_path: &str) -> Result<(), String> {
        let session_id = self.get_current_session()?;
        self.rename_sftp_file_on_session(&session_id, old_path, new_path)
    }
    
    /// Rename file on specific session
    pub fn rename_sftp_file_on_session(&self, session_id: &str, old_path: &str, new_path: &str) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.worker_tx
            .send(WorkerCommand::RenameSftpFile {
                session_id: session_id.to_string(),
                old_path: old_path.to_string(),
                new_path: new_path.to_string(),
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
        
        response_rx
            .recv()
            .map_err(|_| "Failed to receive response from worker".to_string())?
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
        
        self.worker_tx
            .send(WorkerCommand::Disconnect {
                session_id: session_id.to_string(),
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
        
        let result = response_rx
            .recv()
            .map_err(|_| "Failed to receive response from worker".to_string())?;
        
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
        
        self.worker_tx
            .send(WorkerCommand::DisconnectAll {
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
        
        self.set_current_session(None);
        
        response_rx
            .recv()
            .map_err(|_| "Failed to receive response from worker".to_string())?
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
        
        if self.worker_tx
            .send(WorkerCommand::IsConnected {
                session_id: session_id.to_string(),
                response_tx,
            })
            .is_err()
        {
            return false;
        }
        
        response_rx.recv().unwrap_or(false)
    }
    
    /// Get connection info for current session
    pub fn get_connection_info(&self) -> Option<ConnectionInfo> {
        let session_id = self.current_session.lock().ok()?.clone()?;
        self.get_session_connection_info(&session_id)
    }
    
    /// Get connection info for specific session
    pub fn get_session_connection_info(&self, session_id: &str) -> Option<ConnectionInfo> {
        let (response_tx, response_rx) = mpsc::channel();
        
        if self.worker_tx
            .send(WorkerCommand::GetConnectionInfo {
                session_id: session_id.to_string(),
                response_tx,
            })
            .is_err()
        {
            return None;
        }
        
        response_rx.recv().ok().flatten()
    }
    
    /// List all active sessions
    pub fn list_sessions(&self) -> Vec<String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        if self.worker_tx
            .send(WorkerCommand::ListSessions {
                response_tx,
            })
            .is_err()
        {
            return Vec::new();
        }
        
        response_rx.recv().unwrap_or_default()
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

    /// Update sudo password for a session
    pub fn update_session_sudo_password(&self, session_id: &str, password: Option<String>) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.worker_tx
            .send(WorkerCommand::UpdateSudoPassword {
                session_id: session_id.to_string(),
                password,
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
            
        response_rx.recv().map_err(|_| "Worker thread panic or disconnected".to_string())??;
        
        Ok(())
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
        
        self.worker_tx
            .send(WorkerCommand::CreateTerminalSession {
                session_id,
                terminal_id: terminal_id.to_string(),
                cols,
                rows,
                window,
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(30))
            .map_err(|_| "Timeout waiting for terminal session creation".to_string())?
    }
    
    /// Close terminal session
    pub fn close_terminal_session(&self, terminal_id: &str) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.worker_tx
            .send(WorkerCommand::CloseTerminalSession {
                terminal_id: terminal_id.to_string(),
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(10))
            .map_err(|_| "Timeout waiting for terminal close".to_string())?
    }
    
    /// Close all terminal sessions
    pub fn close_all_terminal_sessions(&self) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.worker_tx
            .send(WorkerCommand::CloseAllTerminalSessions { response_tx })
            .map_err(|_| "Worker thread has shut down".to_string())?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(10))
            .map_err(|_| "Timeout waiting for close all terminals".to_string())?
    }
    
    /// Send input to terminal
    pub fn send_terminal_input(&self, terminal_id: &str, data: Vec<u8>) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.worker_tx
            .send(WorkerCommand::SendTerminalInput {
                terminal_id: terminal_id.to_string(),
                data,
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
        
        response_rx
            .recv_timeout(std::time::Duration::from_secs(5))
            .map_err(|_| "Timeout waiting for terminal input send".to_string())?
    }
    
    /// Resize terminal
    pub fn resize_terminal(&self, terminal_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        let (response_tx, response_rx) = mpsc::channel();
        
        self.worker_tx
            .send(WorkerCommand::ResizeTerminal {
                terminal_id: terminal_id.to_string(),
                cols,
                rows,
                response_tx,
            })
            .map_err(|_| "Worker thread has shut down".to_string())?;
        
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
        let _ = self.worker_tx.send(WorkerCommand::Shutdown);
    }
}
