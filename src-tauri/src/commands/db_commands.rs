/**
 * 数据库命令处理器模块
 * 通过 SSH 远程管理 MySQL/PostgreSQL/Redis/MongoDB 等数据库
 */

use tauri::State;
use crate::AppState;
use crate::db_manager;
use crate::db_manager::DbConnection;

// ==================== 数据库检测 ====================

/// 检测远程服务器上安装的数据库
#[tauri::command]
pub async fn db_detect(state: State<'_, AppState>) -> Result<Vec<db_manager::DatabaseInfo>, String> {
    let ssh = &state.ssh_manager;
    db_manager::detect_databases(ssh)
}

// ==================== SQL 执行 ====================

/// 执行 SQL 语句或数据库命令
#[tauri::command]
pub async fn db_execute_sql(
    state: State<'_, AppState>,
    db_type: String,
    host: String,
    port: u16,
    username: String,
    password: String,
    database: Option<String>,
    sql: String,
) -> Result<db_manager::SqlResult, String> {
    let ssh = &state.ssh_manager;
    let conn = DbConnection {
        db_type: db_type.clone(),
        host,
        port,
        username,
        password,
        database,
    };
    db_manager::execute_sql(ssh, &db_type, &conn, &sql)
}

// ==================== 列出数据库 ====================

/// 列出远程服务器上的数据库列表
#[tauri::command]
pub async fn db_list_databases(
    state: State<'_, AppState>,
    db_type: String,
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<Vec<String>, String> {
    let ssh = &state.ssh_manager;
    let conn = DbConnection {
        db_type: db_type.clone(),
        host,
        port,
        username,
        password,
        database: None,
    };
    db_manager::list_databases(ssh, &db_type, &conn)
}

// ==================== 列出表 ====================

/// 列出指定数据库中的表
#[tauri::command]
pub async fn db_list_tables(
    state: State<'_, AppState>,
    db_type: String,
    host: String,
    port: u16,
    username: String,
    password: String,
    database: String,
) -> Result<Vec<db_manager::TableInfo>, String> {
    let ssh = &state.ssh_manager;
    let conn = DbConnection {
        db_type: db_type.clone(),
        host,
        port,
        username,
        password,
        database: Some(database.clone()),
    };
    db_manager::list_tables(ssh, &db_type, &conn, &database)
}

// ==================== 列出列 ====================

/// 列出指定表的列信息
#[tauri::command]
pub async fn db_list_columns(
    state: State<'_, AppState>,
    db_type: String,
    host: String,
    port: u16,
    username: String,
    password: String,
    database: String,
    table: String,
) -> Result<Vec<db_manager::ColumnInfo>, String> {
    let ssh = &state.ssh_manager;
    let conn = DbConnection {
        db_type: db_type.clone(),
        host,
        port,
        username,
        password,
        database: Some(database.clone()),
    };
    db_manager::list_columns(ssh, &db_type, &conn, &database, &table)
}

// ==================== 列出用户 ====================

/// 列出数据库用户
#[tauri::command]
pub async fn db_list_users(
    state: State<'_, AppState>,
    db_type: String,
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<Vec<db_manager::DbUser>, String> {
    let ssh = &state.ssh_manager;
    let conn = DbConnection {
        db_type: db_type.clone(),
        host,
        port,
        username,
        password,
        database: None,
    };
    db_manager::list_users(ssh, &db_type, &conn)
}

// ==================== 服务控制 ====================

/// 数据库服务控制（启动/停止/重启/状态）
#[tauri::command]
pub async fn db_service_control(
    state: State<'_, AppState>,
    db_type: String,
    action: String,
) -> Result<String, String> {
    let ssh = &state.ssh_manager;
    db_manager::service_control(ssh, &db_type, &action)
}

// ==================== 数据库备份 ====================

/// 备份数据库到远程服务器 /tmp 目录
#[tauri::command]
pub async fn db_backup(
    state: State<'_, AppState>,
    db_type: String,
    host: String,
    port: u16,
    username: String,
    password: String,
    database: String,
) -> Result<String, String> {
    let ssh = &state.ssh_manager;
    let conn = DbConnection {
        db_type: db_type.clone(),
        host,
        port,
        username,
        password,
        database: Some(database.clone()),
    };
    db_manager::backup_database(ssh, &db_type, &conn, &database)
}

// ==================== 数据库统计 ====================

/// 获取数据库运行统计信息
#[tauri::command]
pub async fn db_get_stats(
    state: State<'_, AppState>,
    db_type: String,
    host: String,
    port: u16,
    username: String,
    password: String,
) -> Result<db_manager::DbStats, String> {
    let ssh = &state.ssh_manager;
    let conn = DbConnection {
        db_type: db_type.clone(),
        host,
        port,
        username,
        password,
        database: None,
    };
    db_manager::get_db_stats(ssh, &db_type, &conn)
}
