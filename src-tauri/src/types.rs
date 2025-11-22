// LovelyRes 类型定义

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;

/// 应用数据目录配置
#[derive(Debug, Clone)]
pub struct AppDataPaths {
    pub app_data_dir: PathBuf,
    pub ssh_connections_file: PathBuf,
    pub ssh_commands_file: PathBuf,
    pub docker_configs_file: PathBuf,
    pub logs_dir: PathBuf,
    pub temp_dir: PathBuf,
    pub backups_dir: PathBuf,
}

impl AppDataPaths {
    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let app_data_dir = dirs::data_dir()
            .ok_or("无法获取应用数据目录")?
            .join("LovelyRes");

        // 确保目录存在
        std::fs::create_dir_all(&app_data_dir)?;
        std::fs::create_dir_all(app_data_dir.join("logs"))?;
        std::fs::create_dir_all(app_data_dir.join("temp"))?;
        std::fs::create_dir_all(app_data_dir.join("backups"))?;

        Ok(Self {
            ssh_connections_file: app_data_dir.join("ssh_connections.json"),
            ssh_commands_file: app_data_dir.join("ssh_commands.json"),
            docker_configs_file: app_data_dir.join("docker_configs.json"),
            logs_dir: app_data_dir.join("logs"),
            temp_dir: app_data_dir.join("temp"),
            backups_dir: app_data_dir.join("backups"),
            app_data_dir,
        })
    }
}

/// SSH账号凭证
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SSHAccountCredential {
    pub username: String,
    pub auth_type: String,                  // "password", "key", "certificate"
    pub encrypted_password: Option<String>, // AES加密的密码
    pub key_path: Option<String>,
    pub key_passphrase: Option<String>,     // SSH密钥的密码短语
    pub certificate_path: Option<String>,
    pub is_default: bool,                   // 是否为默认账号
    pub description: Option<String>,        // 账号描述（如：超级管理员、数据库管理员等）
}

/// SSH连接配置
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SSHConnection {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    // 保留单账号字段用于向后兼容，将在未来版本废弃
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub auth_type: String,                  // "password", "key", "certificate"
    pub encrypted_password: Option<String>, // AES加密的密码
    pub key_path: Option<String>,
    pub key_passphrase: Option<String>,     // SSH密钥的密码短语
    pub certificate_path: Option<String>,
    // 新增多账号支持
    #[serde(default)]
    pub accounts: Vec<SSHAccountCredential>, // 多账号列表
    pub active_account: Option<String>,      // 当前活动的账号用户名
    // 其他字段
    pub is_connected: bool,
    pub last_connected: Option<chrono::DateTime<chrono::Utc>>,
    pub tags: Option<Vec<String>>,          // 连接标签
}

/// SSH命令配置
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SSHCommand {
    pub id: String,
    pub name: String,
    pub command: String,
    pub description: String,
    pub category: String,
    pub favorite: bool,
}

/// Docker容器概要信息
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DockerContainerSummary {
    pub id: String,
    pub short_id: String,
    pub name: String,
    pub image: String,
    pub state: String,
    pub status: String,
    pub created_at: String,
    pub uptime: Option<String>,
    pub command: Option<String>,
    pub ports: Vec<DockerPortMapping>,
    pub cpu_percent: Option<f64>,
    pub memory_usage: Option<String>,
    pub memory_percent: Option<f64>,
    pub net_io: Option<String>,
    pub block_io: Option<String>,
    pub pids: Option<u32>,
    pub network_mode: Option<String>,
    pub networks: Vec<DockerNetworkAttachment>,
    pub mounts: Vec<DockerMountInfo>,
    pub quick_checks: DockerQuickCheck,
}

/// Docker端口映射
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DockerPortMapping {
    pub ip: Option<String>,
    pub private_port: String,
    pub public_port: Option<String>,
    pub protocol: String,
}

/// Docker网络连接信息
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DockerNetworkAttachment {
    pub name: String,
    pub network_id: Option<String>,
    pub endpoint_id: Option<String>,
    pub mac_address: Option<String>,
    pub ipv4_address: Option<String>,
    pub ipv6_address: Option<String>,
}

/// Docker挂载点信息
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DockerMountInfo {
    pub mount_type: String,
    pub source: Option<String>,
    pub destination: String,
    pub mode: Option<String>,
    pub rw: bool,
}

/// Docker快速检测结果
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DockerQuickCheck {
    pub network_attached: bool,
    pub privileged: bool,
    pub health: Option<String>,
}

/// Docker操作结果
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DockerActionResult {
    pub success: bool,
    pub message: String,
    pub updated_state: Option<String>,
    pub updated_status: Option<String>,
}

/// Docker日志查询参数
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
pub struct DockerLogsOptions {
    pub tail: Option<u32>,
    pub since: Option<String>,
    pub timestamps: bool,
    pub stdout: bool,
    pub stderr: bool,
}

impl Default for DockerLogsOptions {
    fn default() -> Self {
        Self {
            tail: Some(500),
            since: None,
            timestamps: false,
            stdout: true,
            stderr: true,
        }
    }
}

/// Docker文件复制方向
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "kebab-case")]
pub enum DockerCopyDirection {
    ContainerToHost,
    HostToContainer,
    InContainer,
}

/// Docker文件复制请求
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DockerCopyRequest {
    pub direction: DockerCopyDirection,
    pub source: String,
    pub target: String,
}

/// Docker镜像信息
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DockerImage {
    pub id: String,
    pub repository: String,
    pub tag: String,
    pub size: String,
    pub created: chrono::DateTime<chrono::Utc>,
}

/// Docker统计信息
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DockerStats {
    pub container_id: String,
    pub cpu_percent: Option<f64>,
    pub memory_usage: Option<String>,
    pub memory_percent: Option<f64>,
    pub network_io: Option<String>,
    pub block_io: Option<String>,
    pub pids: Option<u32>,
}

/// 应用通知
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppNotification {
    pub id: String,
    pub title: String,
    pub message: String,
    pub notification_type: String, // "info", "success", "warning", "error"
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub read: bool,
}

/// 终端会话
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TerminalSession {
    pub id: String,
    pub name: String,
    pub connection_id: String,
    pub created: chrono::DateTime<chrono::Utc>,
    pub last_activity: chrono::DateTime<chrono::Utc>,
    pub is_active: bool,
}

/// 文件传输任务
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FileTransferTask {
    pub id: String,
    pub source_path: String,
    pub destination_path: String,
    pub transfer_type: String, // "upload", "download"
    pub status: String,        // "pending", "in_progress", "completed", "failed"
    pub progress: f64,         // 0.0 to 100.0
    pub file_size: u64,
    pub transferred_size: u64,
    pub created: chrono::DateTime<chrono::Utc>,
    pub completed: Option<chrono::DateTime<chrono::Utc>>,
    pub error_message: Option<String>,
}

/// 系统监控数据
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SystemMonitorData {
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub cpu_usage: f64,
    pub memory_usage: f64,
    pub disk_usage: f64,
    pub network_in: u64,
    pub network_out: u64,
    pub load_average: Vec<f64>,
    pub process_count: u32,
}

/// 日志条目
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogEntry {
    pub id: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub level: String, // "debug", "info", "warn", "error"
    pub source: String,
    pub message: String,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// API响应包装器
#[derive(Debug, Serialize, Deserialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
            timestamp: chrono::Utc::now(),
        }
    }

    pub fn error(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
            timestamp: chrono::Utc::now(),
        }
    }
}

/// 分页参数
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PaginationParams {
    pub page: u32,
    pub page_size: u32,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>, // "asc", "desc"
}

/// 分页响应
#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub items: Vec<T>,
    pub total: u64,
    pub page: u32,
    pub page_size: u32,
    pub total_pages: u32,
}

impl<T> PaginatedResponse<T> {
    pub fn new(items: Vec<T>, total: u64, page: u32, page_size: u32) -> Self {
        let total_pages = ((total as f64) / (page_size as f64)).ceil() as u32;
        Self {
            items,
            total,
            page,
            page_size,
            total_pages,
        }
    }
}

/// 搜索过滤器
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SearchFilter {
    pub query: Option<String>,
    pub category: Option<String>,
    pub status: Option<String>,
    pub date_from: Option<chrono::DateTime<chrono::Utc>>,
    pub date_to: Option<chrono::DateTime<chrono::Utc>>,
    pub tags: Option<Vec<String>>,
}

/// 应用事件
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppEvent {
    pub id: String,
    pub event_type: String,
    pub source: String,
    pub data: serde_json::Value,
    pub timestamp: chrono::DateTime<chrono::Utc>,
}

/// 错误类型
#[derive(Debug, thiserror::Error)]
pub enum LovelyResError {
    #[error("SSH连接错误: {0}")]
    SSHError(String),

    #[error("Docker操作错误: {0}")]
    DockerError(String),

    #[error("文件操作错误: {0}")]
    FileError(String),

    #[error("配置错误: {0}")]
    ConfigError(String),

    #[error("网络错误: {0}")]
    NetworkError(String),

    #[error("认证错误: {0}")]
    AuthError(String),

    #[error("连接错误: {0}")]
    ConnectionError(String),

    #[error("身份验证错误: {0}")]
    AuthenticationError(String),

    #[error("权限错误: {0}")]
    PermissionError(String),

    #[error("资源未找到: {0}")]
    NotFound(String),

    #[error("输入错误: {0}")]
    InvalidInput(String),
    #[error("未知错误: {0}")]
    Unknown(String),
}

impl From<LovelyResError> for String {
    fn from(error: LovelyResError) -> Self {
        error.to_string()
    }
}

/// 结果类型别名
pub type LovelyResResult<T> = Result<T, LovelyResError>;

/// 默认实现
impl Default for SSHConnection {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: "新连接".to_string(),
            host: "localhost".to_string(),
            port: 22,
            username: "root".to_string(),
            auth_type: "password".to_string(),
            encrypted_password: None,
            key_path: None,
            key_passphrase: None,
            certificate_path: None,
            accounts: Vec::new(),
            active_account: None,
            is_connected: false,
            last_connected: None,
            tags: None,
        }
    }
}

impl SSHConnection {
    /// 从旧的单账号数据迁移到多账号模式
    /// 如果accounts为空但username不为空，则自动迁移
    pub fn migrate_legacy_account(&mut self) {
        if self.accounts.is_empty() && !self.username.is_empty() {
            let account = SSHAccountCredential {
                username: self.username.clone(),
                auth_type: self.auth_type.clone(),
                encrypted_password: self.encrypted_password.clone(),
                key_path: self.key_path.clone(),
                key_passphrase: self.key_passphrase.clone(),
                certificate_path: self.certificate_path.clone(),
                is_default: true,
                description: Some("默认账号（从旧数据迁移）".to_string()),
            };
            self.accounts.push(account);
            self.active_account = Some(self.username.clone());
        }
    }

    /// 获取默认账号
    pub fn get_default_account(&self) -> Option<&SSHAccountCredential> {
        self.accounts.iter().find(|a| a.is_default)
    }

    /// 获取当前活动账号
    pub fn get_active_account(&self) -> Option<&SSHAccountCredential> {
        if let Some(username) = &self.active_account {
            self.accounts.iter().find(|a| &a.username == username)
        } else {
            self.get_default_account()
        }
    }

    /// 设置活动账号
    pub fn set_active_account(&mut self, username: &str) -> bool {
        if self.accounts.iter().any(|a| a.username == username) {
            self.active_account = Some(username.to_string());
            true
        } else {
            false
        }
    }
}

impl Default for SSHCommand {
    fn default() -> Self {
        Self {
            id: uuid::Uuid::new_v4().to_string(),
            name: "新命令".to_string(),
            command: "echo 'Hello World'".to_string(),
            description: "示例命令".to_string(),
            category: "其他".to_string(),
            favorite: false,
        }
    }
}

impl Default for PaginationParams {
    fn default() -> Self {
        Self {
            page: 1,
            page_size: 20,
            sort_by: None,
            sort_order: Some("asc".to_string()),
        }
    }
}

impl Default for SearchFilter {
    fn default() -> Self {
        Self {
            query: None,
            category: None,
            status: None,
            date_from: None,
            date_to: None,
            tags: None,
        }
    }
}

/// Bash 环境信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BashEnvironmentInfo {
    pub bash_version: String,
    pub shell_type: String, // "bash" or "sh"
    pub ps1: String,        // Primary prompt
    pub pwd: String,        // Current working directory
    pub home: String,       // Home directory
    pub user: String,       // Current user
    pub hostname: String,   // Hostname
    pub path: String,       // PATH environment variable
}

/// 命令补全建议
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandCompletion {
    pub completions: Vec<String>,
    pub prefix: String,
}


