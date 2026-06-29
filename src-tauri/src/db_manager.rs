//! Database Manager — 通过 SSH 远程管理数据库
//! 支持 MySQL/MariaDB, PostgreSQL, Redis, MongoDB, DM, KingBase, etc.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::ssh_manager_russh::SSHManagerRussh;

// ==================== Types ====================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseInfo {
    pub db_type: String,        // mysql, postgresql, redis, mongodb, dm, kingbase, etc.
    pub name: String,           // Display name
    pub version: String,        // Version string
    pub status: String,         // running, stopped, unknown
    pub port: u16,              // Default port
    pub data_dir: String,       // Data directory path
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbConnection {
    pub db_type: String,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub database: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SqlResult {
    pub columns: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub row_count: usize,
    pub affected_rows: Option<usize>,
    pub execution_time_ms: u64,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TableInfo {
    pub name: String,
    pub row_count: Option<u64>,
    pub size: Option<String>,
    pub engine: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ColumnInfo {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
    pub default_value: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbUser {
    pub username: String,
    pub host: String,
    pub privileges: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DbStats {
    pub uptime: String,
    pub connections: u64,
    pub active_connections: u64,
    pub db_size_total: String,
    pub slow_queries: u64,
    pub extra: HashMap<String, String>,
}

// ==================== Helpers ====================

/// Shell-escape a password for safe embedding in single-quoted strings.
/// Replaces `'` with `'\''` (end quote, escaped quote, start quote).
fn shell_escape(s: &str) -> String {
    s.replace('\'', "'\\''")
}

// ==================== detect_databases ====================

/// Detect installed databases on the remote server via SSH.
pub fn detect_databases(ssh: &SSHManagerRussh) -> Result<Vec<DatabaseInfo>, String> {
    let commands: Vec<String> = vec![
        // MySQL / MariaDB
        "systemctl is-active mysql mysqld mariadb 2>/dev/null | head -1".to_string(),
        "mysql --version 2>/dev/null || echo '__NOT_INSTALLED__'".to_string(),
        // PostgreSQL
        "systemctl is-active postgresql 2>/dev/null | head -1".to_string(),
        "psql --version 2>/dev/null || echo '__NOT_INSTALLED__'".to_string(),
        // Redis
        "systemctl is-active redis redis-server 2>/dev/null | head -1".to_string(),
        "redis-server --version 2>/dev/null || echo '__NOT_INSTALLED__'".to_string(),
        // MongoDB
        "systemctl is-active mongod mongodb 2>/dev/null | head -1".to_string(),
        "mongod --version 2>/dev/null | head -1 || echo '__NOT_INSTALLED__'".to_string(),
        // DM (达梦)
        "systemctl is-active DmServiceDMSERVER 2>/dev/null | head -1".to_string(),
        "/opt/dmdbms/bin/dm_svc_conf print_version 2>/dev/null || echo '__NOT_INSTALLED__'".to_string(),
        // KingBase
        "systemctl is-active kingbase 2>/dev/null | head -1".to_string(),
        "ksql --version 2>/dev/null || echo '__NOT_INSTALLED__'".to_string(),
    ];

    let results = ssh.execute_batch_commands(&commands)?;

    let mut databases: Vec<DatabaseInfo> = Vec::new();

    // Helper: extract output text from a batch result
    let get_output = |idx: usize| -> String {
        match results.get(idx) {
            Some(Ok(out)) => out.output.trim().to_string(),
            _ => String::new(),
        }
    };

    // ---------- MySQL / MariaDB ----------
    let mysql_status = get_output(0);
    let mysql_version = get_output(1);
    if !mysql_version.contains("__NOT_INSTALLED__") && !mysql_version.is_empty() {
        let status = if mysql_status.contains("active") { "running" } else { "stopped" };
        let name = if mysql_version.to_lowercase().contains("mariadb") { "MariaDB" } else { "MySQL" };
        databases.push(DatabaseInfo {
            db_type: "mysql".to_string(),
            name: name.to_string(),
            version: mysql_version,
            status: status.to_string(),
            port: 3306,
            data_dir: "/var/lib/mysql".to_string(),
        });
    }

    // ---------- PostgreSQL ----------
    let pg_status = get_output(2);
    let pg_version = get_output(3);
    if !pg_version.contains("__NOT_INSTALLED__") && !pg_version.is_empty() {
        let status = if pg_status.contains("active") { "running" } else { "stopped" };
        databases.push(DatabaseInfo {
            db_type: "postgresql".to_string(),
            name: "PostgreSQL".to_string(),
            version: pg_version,
            status: status.to_string(),
            port: 5432,
            data_dir: "/var/lib/postgresql".to_string(),
        });
    }

    // ---------- Redis ----------
    let redis_status = get_output(4);
    let redis_version = get_output(5);
    if !redis_version.contains("__NOT_INSTALLED__") && !redis_version.is_empty() {
        let status = if redis_status.contains("active") { "running" } else { "stopped" };
        databases.push(DatabaseInfo {
            db_type: "redis".to_string(),
            name: "Redis".to_string(),
            version: redis_version,
            status: status.to_string(),
            port: 6379,
            data_dir: "/var/lib/redis".to_string(),
        });
    }

    // ---------- MongoDB ----------
    let mongo_status = get_output(6);
    let mongo_version = get_output(7);
    if !mongo_version.contains("__NOT_INSTALLED__") && !mongo_version.is_empty() {
        let status = if mongo_status.contains("active") { "running" } else { "stopped" };
        databases.push(DatabaseInfo {
            db_type: "mongodb".to_string(),
            name: "MongoDB".to_string(),
            version: mongo_version,
            status: status.to_string(),
            port: 27017,
            data_dir: "/var/lib/mongodb".to_string(),
        });
    }

    // ---------- DM (达梦) ----------
    let dm_status = get_output(8);
    let dm_version = get_output(9);
    if !dm_version.contains("__NOT_INSTALLED__") && !dm_version.is_empty() {
        let status = if dm_status.contains("active") { "running" } else { "stopped" };
        databases.push(DatabaseInfo {
            db_type: "dm".to_string(),
            name: "DM (达梦)".to_string(),
            version: dm_version,
            status: status.to_string(),
            port: 5236,
            data_dir: "/opt/dmdbms/data".to_string(),
        });
    }

    // ---------- KingBase ----------
    let kb_status = get_output(10);
    let kb_version = get_output(11);
    if !kb_version.contains("__NOT_INSTALLED__") && !kb_version.is_empty() {
        let status = if kb_status.contains("active") { "running" } else { "stopped" };
        databases.push(DatabaseInfo {
            db_type: "kingbase".to_string(),
            name: "KingBase".to_string(),
            version: kb_version,
            status: status.to_string(),
            port: 54321,
            data_dir: "/opt/Kingbase/data".to_string(),
        });
    }

    Ok(databases)
}

// ==================== execute_sql ====================

/// Execute a SQL statement (or command) against the specified database type via its CLI.
pub fn execute_sql(
    ssh: &SSHManagerRussh,
    db_type: &str,
    conn: &DbConnection,
    sql: &str,
) -> Result<SqlResult, String> {
    let start = std::time::Instant::now();
    let escaped_pass = shell_escape(&conn.password);
    let escaped_sql = sql.replace('"', "\\\"");
    let db = conn.database.as_deref().unwrap_or("");

    let cmd = match db_type {
        "mysql" => {
            format!(
                "mysql -u{user} -p'{pass}' -h{host} -P{port} {db} -e \"{sql}\" --batch --raw 2>&1",
                user = conn.username,
                pass = escaped_pass,
                host = conn.host,
                port = conn.port,
                db = db,
                sql = escaped_sql,
            )
        }
        "postgresql" => {
            format!(
                "PGPASSWORD='{pass}' psql -U {user} -h {host} -p {port} -d {db} -t -A -F'|' -c \"{sql}\" 2>&1",
                pass = escaped_pass,
                user = conn.username,
                host = conn.host,
                port = conn.port,
                db = if db.is_empty() { "postgres" } else { db },
                sql = escaped_sql,
            )
        }
        "redis" => {
            // For Redis, the sql field is the raw command (e.g. "GET key")
            let auth = if conn.password.is_empty() {
                String::new()
            } else {
                format!("-a '{}'", escaped_pass)
            };
            format!(
                "redis-cli -h {host} -p {port} {auth} {cmd} 2>&1",
                host = conn.host,
                port = conn.port,
                auth = auth,
                cmd = sql,
            )
        }
        "mongodb" => {
            let auth = if conn.username.is_empty() {
                String::new()
            } else {
                format!("-u {user} -p '{pass}' --authenticationDatabase admin", user = conn.username, pass = escaped_pass)
            };
            let escaped_js = sql.replace('\'', "\\'");
            format!(
                "mongosh --host {host} --port {port} {auth} {db} --eval '{js}' --quiet 2>&1",
                host = conn.host,
                port = conn.port,
                auth = auth,
                db = if db.is_empty() { "admin" } else { db },
                js = escaped_js,
            )
        }
        _ => return Err(format!("不支持的数据库类型: {}", db_type)),
    };

    let output = ssh.execute_command(&cmd)?;
    let elapsed = start.elapsed().as_millis() as u64;
    let raw = output.output.trim().to_string();

    // Check for error indicators
    if raw.starts_with("ERROR") || raw.contains("error:") || raw.contains("FATAL:") {
        return Ok(SqlResult {
            columns: vec![],
            rows: vec![],
            row_count: 0,
            affected_rows: None,
            execution_time_ms: elapsed,
            error: Some(raw),
        });
    }

    // Parse output according to db_type
    let (columns, rows) = match db_type {
        "mysql" => parse_mysql_output(&raw),
        "postgresql" => parse_pg_output(&raw),
        "redis" => parse_redis_output(&raw),
        "mongodb" => parse_mongo_output(&raw),
        _ => (vec![], vec![]),
    };

    let row_count = rows.len();
    Ok(SqlResult {
        columns,
        rows,
        row_count,
        affected_rows: None,
        execution_time_ms: elapsed,
        error: None,
    })
}

// ==================== Output parsers ====================

/// Parse MySQL batch output (tab-separated, first line = headers).
fn parse_mysql_output(raw: &str) -> (Vec<String>, Vec<Vec<String>>) {
    let lines: Vec<&str> = raw.lines().collect();
    if lines.is_empty() {
        return (vec![], vec![]);
    }

    let columns: Vec<String> = lines[0].split('\t').map(|s| s.to_string()).collect();
    let rows: Vec<Vec<String>> = lines[1..]
        .iter()
        .filter(|l| !l.is_empty())
        .map(|line| line.split('\t').map(|s| s.to_string()).collect())
        .collect();

    (columns, rows)
}

/// Parse PostgreSQL output (pipe-separated, no header line with -t).
fn parse_pg_output(raw: &str) -> (Vec<String>, Vec<Vec<String>>) {
    let lines: Vec<&str> = raw.lines().filter(|l| !l.trim().is_empty()).collect();
    if lines.is_empty() {
        return (vec![], vec![]);
    }

    // -t omits headers; we return generic column names
    let first_cols: Vec<&str> = lines[0].split('|').collect();
    let columns: Vec<String> = (0..first_cols.len())
        .map(|i| format!("col{}", i))
        .collect();
    let rows: Vec<Vec<String>> = lines
        .iter()
        .map(|line| line.split('|').map(|s| s.trim().to_string()).collect())
        .collect();

    (columns, rows)
}

/// Parse Redis output (line-based).
fn parse_redis_output(raw: &str) -> (Vec<String>, Vec<Vec<String>>) {
    let columns = vec!["result".to_string()];
    let rows: Vec<Vec<String>> = raw
        .lines()
        .filter(|l| !l.is_empty())
        .map(|l| vec![l.to_string()])
        .collect();
    (columns, rows)
}

/// Parse MongoDB output (JSON or text lines).
fn parse_mongo_output(raw: &str) -> (Vec<String>, Vec<Vec<String>>) {
    let columns = vec!["result".to_string()];
    let rows: Vec<Vec<String>> = raw
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| vec![l.to_string()])
        .collect();
    (columns, rows)
}

// ==================== list_databases ====================

/// List databases on the remote server.
pub fn list_databases(
    ssh: &SSHManagerRussh,
    db_type: &str,
    conn: &DbConnection,
) -> Result<Vec<String>, String> {
    let sql = match db_type {
        "mysql" => "SHOW DATABASES".to_string(),
        "postgresql" => "SELECT datname FROM pg_database WHERE datistemplate = false".to_string(),
        "redis" => {
            // For Redis, get keyspace info
            let result = execute_sql(ssh, db_type, conn, "INFO keyspace")?;
            let mut dbs = Vec::new();
            for row in &result.rows {
                if let Some(val) = row.first() {
                    if val.starts_with("db") {
                        if let Some(name) = val.split(':').next() {
                            dbs.push(name.to_string());
                        }
                    }
                }
            }
            if dbs.is_empty() {
                dbs.push("db0".to_string());
            }
            return Ok(dbs);
        }
        "mongodb" => {
            let result = execute_sql(ssh, db_type, conn, "db.adminCommand({listDatabases:1}).databases.map(d=>d.name).join('\\n')")?;
            let mut dbs = Vec::new();
            for row in &result.rows {
                if let Some(val) = row.first() {
                    let trimmed = val.trim();
                    if !trimmed.is_empty() {
                        dbs.push(trimmed.to_string());
                    }
                }
            }
            return Ok(dbs);
        }
        _ => return Err(format!("不支持的数据库类型: {}", db_type)),
    };

    let result = execute_sql(ssh, db_type, conn, &sql)?;
    if let Some(ref err) = result.error {
        return Err(err.clone());
    }

    let dbs: Vec<String> = result
        .rows
        .iter()
        .filter_map(|row| row.first().map(|s| s.trim().to_string()))
        .filter(|s| !s.is_empty())
        .collect();

    Ok(dbs)
}

// ==================== list_tables ====================

/// List tables (or collections) in the given database.
pub fn list_tables(
    ssh: &SSHManagerRussh,
    db_type: &str,
    conn: &DbConnection,
    database: &str,
) -> Result<Vec<TableInfo>, String> {
    match db_type {
        "mysql" => {
            let sql = format!(
                "SELECT TABLE_NAME, TABLE_ROWS, CONCAT(ROUND(DATA_LENGTH/1024,2),' KB'), ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA='{}'",
                database.replace('\'', "\\'")
            );
            let result = execute_sql(ssh, db_type, conn, &sql)?;
            if let Some(ref err) = result.error {
                return Err(err.clone());
            }
            let tables = result
                .rows
                .iter()
                .map(|row| TableInfo {
                    name: row.get(0).cloned().unwrap_or_default(),
                    row_count: row.get(1).and_then(|s| s.parse::<u64>().ok()),
                    size: row.get(2).cloned(),
                    engine: row.get(3).cloned(),
                })
                .collect();
            Ok(tables)
        }
        "postgresql" => {
            let mut pg_conn = conn.clone();
            pg_conn.database = Some(database.to_string());
            let sql = "SELECT tablename FROM pg_tables WHERE schemaname='public'";
            let result = execute_sql(ssh, "postgresql", &pg_conn, sql)?;
            if let Some(ref err) = result.error {
                return Err(err.clone());
            }
            let tables = result
                .rows
                .iter()
                .map(|row| TableInfo {
                    name: row.get(0).cloned().unwrap_or_default(),
                    row_count: None,
                    size: None,
                    engine: None,
                })
                .collect();
            Ok(tables)
        }
        "mongodb" => {
            let mut mg_conn = conn.clone();
            mg_conn.database = Some(database.to_string());
            let result = execute_sql(ssh, "mongodb", &mg_conn, "db.getCollectionNames().join('\\n')")?;
            if let Some(ref err) = result.error {
                return Err(err.clone());
            }
            let tables = result
                .rows
                .iter()
                .filter_map(|row| row.first())
                .filter(|s| !s.trim().is_empty())
                .map(|name| TableInfo {
                    name: name.trim().to_string(),
                    row_count: None,
                    size: None,
                    engine: None,
                })
                .collect();
            Ok(tables)
        }
        "redis" => {
            // Redis doesn't have tables, return empty
            Ok(vec![])
        }
        _ => Err(format!("不支持的数据库类型: {}", db_type)),
    }
}

// ==================== list_columns ====================

/// List columns (schema) for a specific table.
pub fn list_columns(
    ssh: &SSHManagerRussh,
    db_type: &str,
    conn: &DbConnection,
    database: &str,
    table: &str,
) -> Result<Vec<ColumnInfo>, String> {
    match db_type {
        "mysql" => {
            let sql = format!("DESCRIBE {}.{}", database, table);
            let result = execute_sql(ssh, db_type, conn, &sql)?;
            if let Some(ref err) = result.error {
                return Err(err.clone());
            }
            // DESCRIBE output: Field, Type, Null, Key, Default, Extra
            let columns = result
                .rows
                .iter()
                .map(|row| ColumnInfo {
                    name: row.get(0).cloned().unwrap_or_default(),
                    data_type: row.get(1).cloned().unwrap_or_default(),
                    is_nullable: row.get(2).map(|s| s == "YES").unwrap_or(true),
                    is_primary_key: row.get(3).map(|s| s == "PRI").unwrap_or(false),
                    default_value: row.get(4).cloned().filter(|s| s != "NULL" && !s.is_empty()),
                })
                .collect();
            Ok(columns)
        }
        "postgresql" => {
            let mut pg_conn = conn.clone();
            pg_conn.database = Some(database.to_string());
            let sql = format!(
                "SELECT c.column_name, c.data_type, c.is_nullable, c.column_default, \
                 CASE WHEN tc.constraint_type = 'PRIMARY KEY' THEN 'YES' ELSE 'NO' END as is_pk \
                 FROM information_schema.columns c \
                 LEFT JOIN information_schema.key_column_usage kcu ON c.column_name = kcu.column_name AND c.table_name = kcu.table_name \
                 LEFT JOIN information_schema.table_constraints tc ON kcu.constraint_name = tc.constraint_name AND tc.constraint_type = 'PRIMARY KEY' \
                 WHERE c.table_name='{}'",
                table.replace('\'', "\\'")
            );
            let result = execute_sql(ssh, "postgresql", &pg_conn, &sql)?;
            if let Some(ref err) = result.error {
                return Err(err.clone());
            }
            let columns = result
                .rows
                .iter()
                .map(|row| ColumnInfo {
                    name: row.get(0).cloned().unwrap_or_default(),
                    data_type: row.get(1).cloned().unwrap_or_default(),
                    is_nullable: row.get(2).map(|s| s == "YES").unwrap_or(true),
                    default_value: row.get(3).cloned().filter(|s| !s.is_empty()),
                    is_primary_key: row.get(4).map(|s| s == "YES").unwrap_or(false),
                })
                .collect();
            Ok(columns)
        }
        _ => Err(format!("数据库类型 {} 不支持列查询", db_type)),
    }
}

// ==================== list_users ====================

/// List database users.
pub fn list_users(
    ssh: &SSHManagerRussh,
    db_type: &str,
    conn: &DbConnection,
) -> Result<Vec<DbUser>, String> {
    match db_type {
        "mysql" => {
            let sql = "SELECT user, host FROM mysql.user";
            let result = execute_sql(ssh, db_type, conn, sql)?;
            if let Some(ref err) = result.error {
                return Err(err.clone());
            }
            let users = result
                .rows
                .iter()
                .map(|row| DbUser {
                    username: row.get(0).cloned().unwrap_or_default(),
                    host: row.get(1).cloned().unwrap_or_default(),
                    privileges: vec![],
                })
                .collect();
            Ok(users)
        }
        "postgresql" => {
            let sql = "SELECT usename, CASE WHEN usesuper THEN 'SUPERUSER' ELSE 'USER' END FROM pg_user";
            let result = execute_sql(ssh, db_type, conn, sql)?;
            if let Some(ref err) = result.error {
                return Err(err.clone());
            }
            let users = result
                .rows
                .iter()
                .map(|row| DbUser {
                    username: row.get(0).cloned().unwrap_or_default(),
                    host: "%".to_string(),
                    privileges: row.get(1).map(|s| vec![s.clone()]).unwrap_or_default(),
                })
                .collect();
            Ok(users)
        }
        "redis" => {
            let result = execute_sql(ssh, db_type, conn, "ACL LIST")?;
            if let Some(ref err) = result.error {
                return Err(err.clone());
            }
            let users = result
                .rows
                .iter()
                .filter_map(|row| row.first())
                .map(|line| {
                    // ACL LIST output: "user <username> ..."
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    let username = parts.get(1).unwrap_or(&"default").to_string();
                    DbUser {
                        username,
                        host: "%".to_string(),
                        privileges: vec![line.clone()],
                    }
                })
                .collect();
            Ok(users)
        }
        "mongodb" => {
            let result = execute_sql(ssh, db_type, conn, "db.getUsers().users.forEach(u => print(u.user + '|' + (u.roles||[]).map(r=>r.role).join(',')))")?;
            if let Some(ref err) = result.error {
                return Err(err.clone());
            }
            let users = result
                .rows
                .iter()
                .filter_map(|row| row.first())
                .filter(|s| !s.trim().is_empty())
                .map(|line| {
                    let parts: Vec<&str> = line.split('|').collect();
                    DbUser {
                        username: parts.first().unwrap_or(&"").to_string(),
                        host: "%".to_string(),
                        privileges: parts
                            .get(1)
                            .map(|s| s.split(',').map(|r| r.trim().to_string()).collect())
                            .unwrap_or_default(),
                    }
                })
                .collect();
            Ok(users)
        }
        _ => Err(format!("不支持的数据库类型: {}", db_type)),
    }
}

// ==================== service_control ====================

/// Start / stop / restart / status a database service.
pub fn service_control(
    ssh: &SSHManagerRussh,
    db_type: &str,
    action: &str,
) -> Result<String, String> {
    if !["start", "stop", "restart", "status"].contains(&action) {
        return Err(format!("不支持的操作: {}，仅支持 start/stop/restart/status", action));
    }

    let cmd = match db_type {
        "mysql" => format!(
            "systemctl {action} mysql 2>/dev/null || systemctl {action} mysqld 2>/dev/null || systemctl {action} mariadb 2>/dev/null"
        ),
        "postgresql" => format!(
            "systemctl {action} postgresql 2>/dev/null"
        ),
        "redis" => format!(
            "systemctl {action} redis 2>/dev/null || systemctl {action} redis-server 2>/dev/null"
        ),
        "mongodb" => format!(
            "systemctl {action} mongod 2>/dev/null || systemctl {action} mongodb 2>/dev/null"
        ),
        "dm" => format!(
            "systemctl {action} DmServiceDMSERVER 2>/dev/null"
        ),
        "kingbase" => format!(
            "systemctl {action} kingbase 2>/dev/null"
        ),
        _ => return Err(format!("不支持的数据库类型: {}", db_type)),
    };

    let output = ssh.execute_command(&cmd)?;
    let result = output.output.trim().to_string();

    // For status action, also check with is-active
    if action == "status" {
        let status_cmd = match db_type {
            "mysql" => "systemctl is-active mysql mysqld mariadb 2>/dev/null | head -1",
            "postgresql" => "systemctl is-active postgresql 2>/dev/null",
            "redis" => "systemctl is-active redis redis-server 2>/dev/null | head -1",
            "mongodb" => "systemctl is-active mongod mongodb 2>/dev/null | head -1",
            "dm" => "systemctl is-active DmServiceDMSERVER 2>/dev/null",
            "kingbase" => "systemctl is-active kingbase 2>/dev/null",
            _ => "",
        };
        if !status_cmd.is_empty() {
            let status_output = ssh.execute_command(status_cmd)?;
            let active_status = status_output.output.trim().to_string();
            return Ok(format!("{}\n状态: {}", result, active_status));
        }
    }

    if result.is_empty() {
        Ok(format!("{}操作 {} 执行成功", db_type, action))
    } else {
        Ok(result)
    }
}

// ==================== backup_database ====================

/// Backup a database to /tmp on the remote server.
pub fn backup_database(
    ssh: &SSHManagerRussh,
    db_type: &str,
    conn: &DbConnection,
    database: &str,
) -> Result<String, String> {
    let escaped_pass = shell_escape(&conn.password);
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S").to_string();

    let cmd = match db_type {
        "mysql" => {
            format!(
                "mysqldump -u{user} -p'{pass}' -h{host} -P{port} {db} > /tmp/backup_{db}_{ts}.sql 2>&1 && echo 'OK:/tmp/backup_{db}_{ts}.sql'",
                user = conn.username,
                pass = escaped_pass,
                host = conn.host,
                port = conn.port,
                db = database,
                ts = timestamp,
            )
        }
        "postgresql" => {
            format!(
                "PGPASSWORD='{pass}' pg_dump -U {user} -h {host} -p {port} {db} > /tmp/backup_{db}_{ts}.sql 2>&1 && echo 'OK:/tmp/backup_{db}_{ts}.sql'",
                pass = escaped_pass,
                user = conn.username,
                host = conn.host,
                port = conn.port,
                db = database,
                ts = timestamp,
            )
        }
        "redis" => {
            let auth = if conn.password.is_empty() {
                String::new()
            } else {
                format!("-a '{}'", escaped_pass)
            };
            format!(
                "redis-cli -h {host} -p {port} {auth} BGSAVE 2>&1",
                host = conn.host,
                port = conn.port,
                auth = auth,
            )
        }
        "mongodb" => {
            let auth = if conn.username.is_empty() {
                String::new()
            } else {
                format!("-u {user} -p '{pass}' --authenticationDatabase admin", user = conn.username, pass = escaped_pass)
            };
            format!(
                "mongodump --host {host} --port {port} {auth} --db {db} --out /tmp/backup_{ts}/ 2>&1 && echo 'OK:/tmp/backup_{ts}/'",
                host = conn.host,
                port = conn.port,
                auth = auth,
                db = database,
                ts = timestamp,
            )
        }
        _ => return Err(format!("不支持的数据库类型: {}", db_type)),
    };

    let output = ssh.execute_command(&cmd)?;
    let raw = output.output.trim().to_string();

    if raw.contains("OK:") {
        Ok(raw)
    } else if raw.contains("Background saving started") {
        Ok(format!("Redis BGSAVE 已启动: {}", raw))
    } else if raw.contains("error") || raw.contains("ERROR") || raw.contains("FATAL") {
        Err(format!("备份失败: {}", raw))
    } else {
        Ok(raw)
    }
}

// ==================== get_db_stats ====================

/// Get runtime statistics for a database.
pub fn get_db_stats(
    ssh: &SSHManagerRussh,
    db_type: &str,
    conn: &DbConnection,
) -> Result<DbStats, String> {
    match db_type {
        "mysql" => {
            let commands = vec![
                format!(
                    "mysql -u{user} -p'{pass}' -h{host} -P{port} -e \"SHOW GLOBAL STATUS WHERE Variable_name IN ('Uptime','Threads_connected','Threads_running','Slow_queries','Connections')\" --batch --raw 2>&1",
                    user = conn.username,
                    pass = shell_escape(&conn.password),
                    host = conn.host,
                    port = conn.port,
                ),
                format!(
                    "mysql -u{user} -p'{pass}' -h{host} -P{port} -e \"SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS size_mb FROM information_schema.tables\" --batch --raw 2>&1",
                    user = conn.username,
                    pass = shell_escape(&conn.password),
                    host = conn.host,
                    port = conn.port,
                ),
            ];

            let results = ssh.execute_batch_commands(&commands)?;

            let mut extra = HashMap::new();
            let mut uptime = String::new();
            let mut connections: u64 = 0;
            let mut active_connections: u64 = 0;
            let mut slow_queries: u64 = 0;

            if let Some(Ok(out)) = results.get(0) {
                for line in out.output.lines().skip(1) {
                    let parts: Vec<&str> = line.split('\t').collect();
                    if parts.len() >= 2 {
                        let key = parts[0].trim();
                        let val = parts[1].trim();
                        match key {
                            "Uptime" => {
                                let secs: u64 = val.parse().unwrap_or(0);
                                let days = secs / 86400;
                                let hours = (secs % 86400) / 3600;
                                let mins = (secs % 3600) / 60;
                                uptime = format!("{}d {}h {}m", days, hours, mins);
                            }
                            "Connections" => connections = val.parse().unwrap_or(0),
                            "Threads_connected" => active_connections = val.parse().unwrap_or(0),
                            "Slow_queries" => slow_queries = val.parse().unwrap_or(0),
                            _ => { extra.insert(key.to_string(), val.to_string()); }
                        }
                    }
                }
            }

            let mut db_size_total = "unknown".to_string();
            if let Some(Ok(out)) = results.get(1) {
                for line in out.output.lines().skip(1) {
                    let trimmed = line.trim();
                    if !trimmed.is_empty() && trimmed != "NULL" {
                        db_size_total = format!("{} MB", trimmed);
                        break;
                    }
                }
            }

            Ok(DbStats {
                uptime,
                connections,
                active_connections,
                db_size_total,
                slow_queries,
                extra,
            })
        }
        "postgresql" => {
            let escaped_pass = shell_escape(&conn.password);
            let db = conn.database.as_deref().unwrap_or("postgres");
            let commands = vec![
                format!(
                    "PGPASSWORD='{pass}' psql -U {user} -h {host} -p {port} -d {db} -t -A -F'|' -c \"SELECT date_trunc('second', current_timestamp - pg_postmaster_start_time()) as uptime\" 2>&1",
                    pass = escaped_pass, user = conn.username, host = conn.host, port = conn.port, db = db,
                ),
                format!(
                    "PGPASSWORD='{pass}' psql -U {user} -h {host} -p {port} -d {db} -t -A -F'|' -c \"SELECT count(*) FROM pg_stat_activity\" 2>&1",
                    pass = escaped_pass, user = conn.username, host = conn.host, port = conn.port, db = db,
                ),
                format!(
                    "PGPASSWORD='{pass}' psql -U {user} -h {host} -p {port} -d {db} -t -A -F'|' -c \"SELECT count(*) FROM pg_stat_activity WHERE state='active'\" 2>&1",
                    pass = escaped_pass, user = conn.username, host = conn.host, port = conn.port, db = db,
                ),
                format!(
                    "PGPASSWORD='{pass}' psql -U {user} -h {host} -p {port} -d {db} -t -A -F'|' -c \"SELECT pg_size_pretty(sum(pg_database_size(datname))) FROM pg_database\" 2>&1",
                    pass = escaped_pass, user = conn.username, host = conn.host, port = conn.port, db = db,
                ),
            ];

            let results = ssh.execute_batch_commands(&commands)?;

            let get = |idx: usize| -> String {
                match results.get(idx) {
                    Some(Ok(out)) => out.output.trim().to_string(),
                    _ => String::new(),
                }
            };

            Ok(DbStats {
                uptime: get(0),
                connections: get(1).parse().unwrap_or(0),
                active_connections: get(2).parse().unwrap_or(0),
                db_size_total: get(3),
                slow_queries: 0,
                extra: HashMap::new(),
            })
        }
        "redis" => {
            let result = execute_sql(ssh, "redis", conn, "INFO")?;
            let raw = result.rows.iter().filter_map(|r| r.first()).cloned().collect::<Vec<String>>().join("\n");

            let mut extra = HashMap::new();
            let mut uptime = String::new();
            let mut connections: u64 = 0;
            let mut active_connections: u64 = 0;

            for line in raw.lines() {
                if let Some((key, val)) = line.split_once(':') {
                    let key = key.trim();
                    let val = val.trim();
                    match key {
                        "uptime_in_seconds" => {
                            let secs: u64 = val.parse().unwrap_or(0);
                            let days = secs / 86400;
                            let hours = (secs % 86400) / 3600;
                            uptime = format!("{}d {}h", days, hours);
                        }
                        "connected_clients" => {
                            connections = val.parse().unwrap_or(0);
                            active_connections = connections;
                        }
                        "used_memory_human" => { extra.insert("used_memory".to_string(), val.to_string()); }
                        _ => {}
                    }
                }
            }

            Ok(DbStats {
                uptime,
                connections,
                active_connections,
                db_size_total: extra.get("used_memory").cloned().unwrap_or_else(|| "unknown".to_string()),
                slow_queries: 0,
                extra,
            })
        }
        "mongodb" => {
            let result = execute_sql(
                ssh,
                "mongodb",
                conn,
                "var s=db.serverStatus(); print(JSON.stringify({uptime:s.uptime,current:s.connections.current,available:s.connections.available,totalCreated:s.connections.totalCreated}))",
            )?;

            let raw = result.rows.iter().filter_map(|r| r.first()).cloned().collect::<Vec<String>>().join("");
            // Try to parse JSON
            let mut uptime = String::new();
            let mut connections: u64 = 0;
            let mut active_connections: u64 = 0;

            // Simple JSON extraction (no serde_json dependency needed)
            for part in raw.trim_matches(|c| c == '{' || c == '}').split(',') {
                if let Some((key, val)) = part.split_once(':') {
                    let key = key.trim().trim_matches('"');
                    let val = val.trim().trim_matches('"');
                    match key {
                        "uptime" => {
                            let secs: u64 = val.parse().unwrap_or(0);
                            let days = secs / 86400;
                            let hours = (secs % 86400) / 3600;
                            uptime = format!("{}d {}h", days, hours);
                        }
                        "current" => active_connections = val.parse().unwrap_or(0),
                        "totalCreated" => connections = val.parse().unwrap_or(0),
                        _ => {}
                    }
                }
            }

            Ok(DbStats {
                uptime,
                connections,
                active_connections,
                db_size_total: "unknown".to_string(),
                slow_queries: 0,
                extra: HashMap::new(),
            })
        }
        _ => Err(format!("不支持的数据库类型: {}", db_type)),
    }
}
