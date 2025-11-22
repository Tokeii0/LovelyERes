// SSH客户端
// 负责实际的SSH连接和命令执行

use crate::types::{LovelyResError, LovelyResResult, SSHConnection};
use ssh2::Session;
use std::io::prelude::*;
use std::net::TcpStream;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// SSH客户端
pub struct SSHClient {
    session: Option<Arc<Mutex<Session>>>,
    connection_info: Option<SSHConnection>,
}

impl SSHClient {
    /// 创建新的SSH客户端
    pub fn new() -> Self {
        Self {
            session: None,
            connection_info: None,
        }
    }

    /// 连接到SSH服务器
    pub fn connect(
        &mut self,
        connection: &SSHConnection,
        password: Option<&str>,
    ) -> LovelyResResult<()> {
        println!(
            "🔗 正在连接到 {}@{}:{}",
            connection.username, connection.host, connection.port
        );

        // 建立TCP连接
        let tcp = TcpStream::connect_timeout(
            &format!("{}:{}", connection.host, connection.port)
                .parse()
                .map_err(|e| LovelyResError::NetworkError(format!("无效的地址格式: {}", e)))?,
            Duration::from_secs(10),
        )
        .map_err(|e| LovelyResError::NetworkError(format!("TCP连接失败: {}", e)))?;

        // 创建SSH会话
        let mut session = Session::new()
            .map_err(|e| LovelyResError::SSHError(format!("创建SSH会话失败: {}", e)))?;

        session.set_tcp_stream(tcp);
        session
            .handshake()
            .map_err(|e| LovelyResError::SSHError(format!("SSH握手失败: {}", e)))?;

        // 根据认证类型进行认证
        match connection.auth_type.as_str() {
            "password" => {
                let pwd = password
                    .ok_or_else(|| LovelyResError::AuthError("密码认证需要提供密码".to_string()))?;

                session
                    .userauth_password(&connection.username, pwd)
                    .map_err(|e| LovelyResError::AuthError(format!("密码认证失败: {}", e)))?;
            }
            "key" => {
                let key_path = connection.key_path.as_ref().ok_or_else(|| {
                    LovelyResError::AuthError("密钥认证需要提供密钥路径".to_string())
                })?;

                if !Path::new(key_path).exists() {
                    return Err(LovelyResError::AuthError(format!(
                        "SSH密钥文件不存在: {}",
                        key_path
                    )));
                }

                // 使用密钥认证
                if let Some(passphrase) = &connection.key_passphrase {
                    session
                        .userauth_pubkey_file(
                            &connection.username,
                            None,
                            Path::new(key_path),
                            Some(passphrase),
                        )
                        .map_err(|e| LovelyResError::AuthError(format!("密钥认证失败: {}", e)))?;
                } else {
                    session
                        .userauth_pubkey_file(&connection.username, None, Path::new(key_path), None)
                        .map_err(|e| LovelyResError::AuthError(format!("密钥认证失败: {}", e)))?;
                }
            }
            "certificate" => {
                return Err(LovelyResError::AuthError("证书认证暂未实现".to_string()));
            }
            _ => {
                return Err(LovelyResError::AuthError(format!(
                    "不支持的认证类型: {}",
                    connection.auth_type
                )));
            }
        }

        // 检查认证状态
        if !session.authenticated() {
            return Err(LovelyResError::AuthError("SSH认证失败".to_string()));
        }

        // 保存会话和连接信息
        self.session = Some(Arc::new(Mutex::new(session)));
        self.connection_info = Some(connection.clone());

        println!(
            "✅ SSH连接成功: {}@{}:{}",
            connection.username, connection.host, connection.port
        );
        Ok(())
    }

    /// 测试连接
    pub fn test_connection(
        connection: &SSHConnection,
        password: Option<&str>,
    ) -> LovelyResResult<bool> {
        let mut client = SSHClient::new();
        match client.connect(connection, password) {
            Ok(_) => {
                client.disconnect();
                Ok(true)
            }
            Err(_) => Ok(false),
        }
    }

    /// 执行命令
    pub fn execute_command(&self, command: &str) -> LovelyResResult<String> {
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| LovelyResError::SSHError("没有活动的SSH连接".to_string()))?;

        let session = session.lock().unwrap();

        // 创建通道
        let mut channel = session
            .channel_session()
            .map_err(|e| LovelyResError::SSHError(format!("创建SSH通道失败: {}", e)))?;

        // 执行命令
        channel
            .exec(command)
            .map_err(|e| LovelyResError::SSHError(format!("执行命令失败: {}", e)))?;

        // 读取输出
        let mut output = String::new();
        channel
            .read_to_string(&mut output)
            .map_err(|e| LovelyResError::SSHError(format!("读取命令输出失败: {}", e)))?;

        // 等待命令完成
        channel
            .wait_close()
            .map_err(|e| LovelyResError::SSHError(format!("等待命令完成失败: {}", e)))?;

        // 获取退出状态
        let exit_status = channel
            .exit_status()
            .map_err(|e| LovelyResError::SSHError(format!("获取退出状态失败: {}", e)))?;

        if exit_status != 0 {
            // 尝试读取错误输出
            let mut stderr = String::new();
            channel.stderr().read_to_string(&mut stderr).ok();

            if !stderr.is_empty() {
                return Err(LovelyResError::SSHError(format!(
                    "命令执行失败 (退出码: {}): {}",
                    exit_status, stderr
                )));
            } else {
                return Err(LovelyResError::SSHError(format!(
                    "命令执行失败 (退出码: {})",
                    exit_status
                )));
            }
        }

        println!("✅ 命令执行成功: {}", command);
        Ok(output)
    }

    /// 执行多个命令
    pub fn execute_commands(&self, commands: &[&str]) -> LovelyResResult<Vec<String>> {
        let mut results = Vec::new();

        for command in commands {
            let result = self.execute_command(command)?;
            results.push(result);
        }

        Ok(results)
    }

    /// 上传文件
    pub fn upload_file(&self, local_path: &str, remote_path: &str) -> LovelyResResult<()> {
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| LovelyResError::SSHError("没有活动的SSH连接".to_string()))?;

        let session = session.lock().unwrap();

        // 读取本地文件
        let local_content = std::fs::read(local_path)
            .map_err(|e| LovelyResError::FileError(format!("读取本地文件失败: {}", e)))?;

        // 创建SFTP会话
        let sftp = session
            .sftp()
            .map_err(|e| LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e)))?;

        // 创建远程文件
        let mut remote_file = sftp
            .create(Path::new(remote_path))
            .map_err(|e| LovelyResError::SSHError(format!("创建远程文件失败: {}", e)))?;

        // 写入文件内容
        remote_file
            .write_all(&local_content)
            .map_err(|e| LovelyResError::SSHError(format!("写入远程文件失败: {}", e)))?;

        println!("✅ 文件上传成功: {} -> {}", local_path, remote_path);
        Ok(())
    }

    /// 下载文件
    pub fn download_file(&self, remote_path: &str, local_path: &str) -> LovelyResResult<()> {
        let session = self
            .session
            .as_ref()
            .ok_or_else(|| LovelyResError::SSHError("没有活动的SSH连接".to_string()))?;

        let session = session.lock().unwrap();

        // 创建SFTP会话
        let sftp = session
            .sftp()
            .map_err(|e| LovelyResError::SSHError(format!("创建SFTP会话失败: {}", e)))?;

        // 打开远程文件
        let mut remote_file = sftp
            .open(Path::new(remote_path))
            .map_err(|e| LovelyResError::SSHError(format!("打开远程文件失败: {}", e)))?;

        // 读取文件内容
        let mut content = Vec::new();
        remote_file
            .read_to_end(&mut content)
            .map_err(|e| LovelyResError::SSHError(format!("读取远程文件失败: {}", e)))?;

        // 写入本地文件
        std::fs::write(local_path, content)
            .map_err(|e| LovelyResError::FileError(format!("写入本地文件失败: {}", e)))?;

        println!("✅ 文件下载成功: {} -> {}", remote_path, local_path);
        Ok(())
    }

    /// 检查是否已连接
    pub fn is_connected(&self) -> bool {
        if let Some(session) = &self.session {
            if let Ok(session) = session.lock() {
                return session.authenticated();
            }
        }
        false
    }

    /// 获取连接信息
    pub fn get_connection_info(&self) -> Option<&SSHConnection> {
        self.connection_info.as_ref()
    }

    /// 断开连接
    pub fn disconnect(&mut self) {
        if let Some(session) = &self.session {
            if let Ok(session) = session.lock() {
                let _ = session.disconnect(None, "Client disconnecting", None);
            }
        }

        self.session = None;
        self.connection_info = None;

        println!("✅ SSH连接已断开");
    }
}

impl Drop for SSHClient {
    fn drop(&mut self) {
        self.disconnect();
    }
}
