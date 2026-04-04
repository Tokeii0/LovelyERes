// All SFTP operations (list, read, write, upload, download, compress, extract, chmod, get_file_details)

use tauri::State;
use crate::AppState;
use crate::ssh_manager_russh;

#[tauri::command]
pub async fn sftp_list_files(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<ssh_manager_russh::SftpFileInfo>, String> {
    let mut manager = state.ssh_manager.lock().unwrap();
    manager.list_sftp_files(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sftp_read_file(
    path: String,
    max_bytes: Option<usize>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let manager = state.ssh_manager.lock().unwrap();
    let content = manager
        .read_sftp_file(&path)
        .map_err(|e| e.to_string())?;

    // Apply max_bytes limit if specified
    let limited_content = if let Some(max) = max_bytes {
        if content.len() > max {
            content[..max].to_vec()
        } else {
            content
        }
    } else {
        content
    };

    String::from_utf8(limited_content)
        .map_err(|e| format!("Failed to decode file as UTF-8: {}", e))
}

#[tauri::command]
pub async fn sftp_chmod(path: String, mode: u32, state: State<'_, AppState>) -> Result<(), String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager.chmod_sftp(&path, mode).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sftp_get_file_details(
    path: String,
    state: State<'_, AppState>,
) -> Result<ssh_manager_russh::SftpFileDetails, String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager.get_file_details(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sftp_write_file(
    path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager
        .write_sftp_file(&path, content.as_bytes())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sftp_compress(
    source_path: String,
    target_path: String,
    format: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager
        .compress_file(&source_path, &target_path, &format)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sftp_extract(
    archive_path: String,
    target_dir: String,
    _overwrite: bool,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager
        .extract_file(&archive_path, &target_dir)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sftp_upload(
    local_path: String,
    remote_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager
        .upload_file(&local_path, &remote_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sftp_download(
    remote_path: String,
    local_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager
        .download_file(&remote_path, &local_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sftp_create_directory(
    remote_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager
        .create_directory(&remote_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sftp_rename(
    old_path: String,
    new_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager
        .rename_sftp_file(&old_path, &new_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn sftp_delete(
    path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.ssh_manager.lock().unwrap();
    manager
        .delete_sftp_file(&path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_temp_file(file_name: String, data: Vec<u8>) -> Result<String, String> {
    use std::io::Write;

    // 创建临时目录
    let temp_dir = std::env::temp_dir();
    let temp_file_path = temp_dir.join(&file_name);

    // 写入文件数据
    let mut file =
        std::fs::File::create(&temp_file_path).map_err(|e| format!("创建临时文件失败: {}", e))?;

    file.write_all(&data)
        .map_err(|e| format!("写入临时文件失败: {}", e))?;

    // 返回临时文件路径
    Ok(temp_file_path.to_string_lossy().to_string())
}
