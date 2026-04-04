/**
 * Docker 命令处理器模块
 * 将 Docker 相关的 Tauri 命令从 lib.rs 中拆分出来
 */

use tauri::State;
use tauri::Manager;
use crate::AppState;
use crate::docker_manager;
use crate::types;
use crate::ssh_manager_russh;
use crate::window_manager;

/// 列出 Docker 容器
#[tauri::command]
pub async fn docker_list_containers(
    state: State<'_, AppState>,
) -> Result<Vec<types::DockerContainerSummary>, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    manager.list_containers(&mut *ssh).map_err(Into::into)
}

/// 容器操作（start/stop/restart/remove 等）
#[tauri::command]
pub async fn docker_container_action(
    container_id: String,
    action: String,
    state: State<'_, AppState>,
) -> Result<types::DockerActionResult, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    manager
        .perform_action(&mut *ssh, &container_id, &action)
        .map_err(Into::into)
}

/// 获取容器日志
#[tauri::command]
pub async fn docker_container_logs(
    container_id: String,
    options: Option<types::DockerLogsOptions>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    manager
        .get_logs(&mut *ssh, &container_id, options)
        .map_err(Into::into)
}

/// 检查容器详情
#[tauri::command]
pub async fn docker_inspect_container(
    container_id: String,
    state: State<'_, AppState>,
) -> Result<serde_json::Value, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    manager
        .inspect(&mut *ssh, &container_id)
        .map_err(Into::into)
}

/// 读取容器内文件
#[tauri::command]
pub async fn docker_read_container_file(
    container_id: String,
    path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    manager
        .read_file(&mut *ssh, &container_id, &path)
        .map_err(Into::into)
}

/// 写入容器内文件
#[tauri::command]
pub async fn docker_write_container_file(
    container_id: String,
    path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<types::DockerActionResult, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    manager
        .write_file(&mut *ssh, &container_id, &path, &content)
        .map_err(Into::into)
}

/// 容器文件复制
#[tauri::command]
pub async fn docker_copy(
    container_id: String,
    request: types::DockerCopyRequest,
    state: State<'_, AppState>,
) -> Result<types::DockerActionResult, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    manager
        .copy(&mut *ssh, &container_id, &request)
        .map_err(Into::into)
}

/// 容器内执行命令
#[tauri::command]
pub async fn docker_exec_command(
    container_id: String,
    command: String,
    shell: Option<String>,
    state: State<'_, AppState>,
) -> Result<ssh_manager_russh::TerminalOutput, String> {
    let mut ssh = state.ssh_manager.lock().unwrap();
    let manager = docker_manager::DockerManager::new();
    let shell = shell.unwrap_or_else(|| "sh".to_string());
    manager
        .exec_command(&mut *ssh, &container_id, &command, &shell)
        .map_err(Into::into)
}

/// 创建容器终端窗口
#[tauri::command]
pub async fn create_container_terminal_window(
    app: tauri::AppHandle,
    container_name: String,
    container_id: String,
) -> Result<String, String> {
    let window_label = format!("container-terminal-{}", container_id);
    let window_title = format!("容器终端 - {}", container_name);

    // 检查窗口是否已存在
    if let Some(existing_window) = app.get_webview_window(&window_label) {
        let _ = existing_window.set_focus().map_err(|e| format!("聚焦窗口失败: {}", e));
        return Ok(window_label);
    }

    // 创建新窗口
    let window = window_manager::WindowManager::create_window(
        &app,
        &window_label,
        &window_title,
        "/container-terminal.html",
        900.0,
        600.0,
    ).map_err(|e| format!("创建容器终端窗口失败: {}", e))?;

    // 设置窗口数据
    window.eval(&format!(
        "window.containerInfo = {{ name: '{}', id: '{}' }};",
        container_name.replace("'", "\\'"),
        container_id.replace("'", "\\'")
    )).map_err(|e| format!("设置窗口数据失败: {}", e))?;

    Ok(window_label)
}
