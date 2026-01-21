use crate::ssh_manager_russh::{SSHManagerRussh, TerminalOutput};
use crate::types::{
    DockerActionResult,
    DockerContainerSummary,
    DockerCopyDirection,
    DockerCopyRequest,
    DockerLogsOptions,
    DockerMountInfo,
    DockerNetworkAttachment,
    DockerPortMapping,
    DockerQuickCheck,
    LovelyResError,
    LovelyResResult,
};
use serde::Deserialize;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

/// Docker 管理器，封装通过 SSH 执行的 Docker 操作
pub struct DockerManager;

impl DockerManager {
    pub fn new() -> Self {
        Self
    }

    /// 获取容器列表并汇总统计信息
    pub fn list_containers(
        &self,
        ssh: &mut SSHManagerRussh,
    ) -> LovelyResResult<Vec<DockerContainerSummary>> {
        if !ssh.is_connected() {
            return Err(LovelyResError::ConnectionError(
                "未建立 SSH 连接".to_string(),
            ));
        }

        let ps_output = ensure_success(
            run_command(ssh, "docker ps -a --format '{{json .}}'")?,
            "获取 Docker 容器列表失败",
        )?;

        let mut rows = Vec::new();
        for line in ps_output.output.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            match serde_json::from_str::<DockerPsRow>(trimmed) {
                Ok(row) => rows.push(row),
                Err(err) => {
                    println!("?? 解析 docker ps 输出失败: {} => {}", trimmed, err);
                }
            }
        }

        if rows.is_empty() {
            return Ok(Vec::new());
        }

        let stats_map = self.fetch_stats_map(ssh)?;
        let inspect_map = self.fetch_inspect_map(ssh, &rows)?;

        let mut summaries = Vec::with_capacity(rows.len());
        for row in &rows {
            if let Some(inspect) = self.lookup_inspect(&inspect_map, row) {
                let stats = self.lookup_stats(&stats_map, row, inspect);
                let summary = build_summary(row, inspect, stats);
                summaries.push(summary);
            } else {
                println!(
                    "?? 未找到容器 {} 的 inspect 结果，跳过该条目",
                    row.primary_ref()
                );
            }
        }

        Ok(summaries)
    }

    /// 对容器执行 start/stop 等操作
    pub fn perform_action(
        &self,
        ssh: &mut SSHManagerRussh,
        container_ref: &str,
        action: &str,
    ) -> LovelyResResult<DockerActionResult> {
        const ALLOWED: [&str; 6] = ["start", "stop", "restart", "kill", "pause", "unpause"];
        let action = action.trim();
        if !ALLOWED.contains(&action) {
            return Err(LovelyResError::InvalidInput(format!(
                "不支持的容器操作: {}",
                action
            )));
        }

        let command = format!(
            "docker {} {}",
            action,
            shell_quote(container_ref)
        );
        ensure_success(
            run_command(ssh, &command)?,
            &format!("执行 {} 操作失败", action),
        )?;

        let inspect = self.fetch_inspect(ssh, container_ref)?;
        let state = normalize_string(inspect.state.status.as_deref()).unwrap_or_else(|| "unknown".to_string());

        Ok(DockerActionResult {
            success: true,
            message: format!("容器 {} 已执行 {}", container_ref, action),
            updated_state: Some(state.clone()),
            updated_status: Some(state),
        })
    }

    /// 获取容器日志
    pub fn get_logs(
        &self,
        ssh: &mut SSHManagerRussh,
        container_ref: &str,
        options: Option<DockerLogsOptions>,
    ) -> LovelyResResult<String> {
        let opts = options.unwrap_or_default();
        let mut parts = vec!["docker".to_string(), "logs".to_string()];

        if let Some(tail) = opts.tail {
            parts.push(format!("--tail {}", tail));
        }
        if let Some(since) = opts.since.as_ref().and_then(|s| normalize_string(Some(s))) {
            parts.push(format!("--since {}", shell_quote(&since)));
        }
        if opts.timestamps {
            parts.push("--timestamps".to_string());
        }
        parts.push(shell_quote(container_ref));

        let mut command = parts.join(" ");
        match (opts.stdout, opts.stderr) {
            (true, false) => command.push_str(" 2>/dev/null"),
            (false, true) => command.push_str(" 1>/dev/null"),
            (false, false) => command.push_str(" >/dev/null 2>&1"),
            _ => {}
        }

        let output = ensure_success(
            run_command(ssh, &command)?,
            "获取容器日志失败",
        )?;

        Ok(output.output)
    }

    /// 获取容器 inspect 原始数据
    pub fn inspect(
        &self,
        ssh: &mut SSHManagerRussh,
        container_ref: &str,
    ) -> LovelyResResult<Value> {
        self.fetch_inspect_raw(ssh, container_ref)
    }

    /// 读取容器内文件
    pub fn read_file(
        &self,
        ssh: &mut SSHManagerRussh,
        container_ref: &str,
        path: &str,
    ) -> LovelyResResult<String> {
        let inner = format!("cat {}", shell_quote(path));
        let command = format!(
            "docker exec {} sh -c {}",
            shell_quote(container_ref),
            shell_quote(&inner)
        );
        let output = ensure_success(
            run_command(ssh, &command)?,
            &format!("读取容器文件 {} 失败", path),
        )?;
        Ok(output.output)
    }

    /// 在容器内执行命令
    pub fn exec_command(
        &self,
        ssh: &mut SSHManagerRussh,
        container_ref: &str,
        command: &str,
        shell: &str,
    ) -> LovelyResResult<TerminalOutput> {
        // 安全检查：确保容器引用和命令不包含危险字符
        if container_ref.is_empty() || command.is_empty() {
            return Err(LovelyResError::InvalidInput(
                "容器引用和命令不能为空".to_string(),
            ));
        }

        // 规范化 shell（仅允许 bash/sh/zsh），默认 sh
        let shell = match shell.to_lowercase().as_str() {
            "bash" => "bash",
            "zsh" => "zsh",
            _ => "sh",
        };

        // 构建 docker exec 命令（非交互TTY环境，去掉 -t）
        let docker_command = format!(
            "docker exec -i {} {} -c {}",
            shell_quote(container_ref),
            shell,
            shell_quote(command)
        );

        // 执行命令
        run_command(ssh, &docker_command)
    }

    /// 写入容器内文件
    pub fn write_file(
        &self,
        ssh: &mut SSHManagerRussh,
        container_ref: &str,
        path: &str,
        content: &str,
    ) -> LovelyResResult<DockerActionResult> {
        if path.trim().is_empty() {
            return Err(LovelyResError::InvalidInput("文件路径不能为空".to_string()));
        }

        let temp_path = generate_temp_path();
        ssh.write_sftp_file(&temp_path, content.as_bytes())
            .map_err(|e| LovelyResError::SSHError(e))?;

        if let Some(parent) = derive_parent_path(path) {
            let mkdir_inner = format!("mkdir -p {}", shell_quote(&parent));
            let mkdir_command = format!(
                "docker exec {} sh -c {}",
                shell_quote(container_ref),
                shell_quote(&mkdir_inner)
            );
            ensure_success(
                run_command(ssh, &mkdir_command)?,
                "创建容器目录失败",
            )?;
        }

        let copy_command = format!(
            "docker cp {} {}",
            shell_quote(&temp_path),
            shell_quote(&format!("{}:{}", container_ref, path))
        );
        let copy_result = run_command(ssh, &copy_command)?;

        let cleanup_command = format!("rm -f {}", shell_quote(&temp_path));
        let _ = run_command(ssh, &cleanup_command);

        ensure_success(copy_result, &format!("写入容器文件 {} 失败", path))?;

        Ok(DockerActionResult {
            success: true,
            message: format!("容器文件 {} 已保存", path),
            updated_state: None,
            updated_status: None,
        })
    }

    /// 执行宿主机与容器之间的文件复制
    pub fn copy(
        &self,
        ssh: &mut SSHManagerRussh,
        container_ref: &str,
        request: &DockerCopyRequest,
    ) -> LovelyResResult<DockerActionResult> {
        let source = request.source.trim();
        let target = request.target.trim();
        if source.is_empty() || target.is_empty() {
            return Err(LovelyResError::InvalidInput(
                "源路径和目标路径不能为空".to_string(),
            ));
        }

        let command = match request.direction {
            DockerCopyDirection::ContainerToHost => {
                format!(
                    "docker cp {} {}",
                    shell_quote(&format!("{}:{}", container_ref, source)),
                    shell_quote(target)
                )
            }
            DockerCopyDirection::HostToContainer => {
                if let Some(parent) = derive_parent_path(target) {
                    let mkdir_inner = format!("mkdir -p {}", shell_quote(&parent));
                    let mkdir_command = format!(
                        "docker exec {} sh -c {}",
                        shell_quote(container_ref),
                        shell_quote(&mkdir_inner)
                    );
                    ensure_success(
                        run_command(ssh, &mkdir_command)?,
                        "创建容器目录失败",
                    )?;
                }
                format!(
                    "docker cp {} {}",
                    shell_quote(source),
                    shell_quote(&format!("{}:{}", container_ref, target))
                )
            }
            DockerCopyDirection::InContainer => {
                let inner = format!(
                    "cp -a {} {}",
                    shell_quote(source),
                    shell_quote(target)
                );
                format!(
                    "docker exec {} sh -c {}",
                    shell_quote(container_ref),
                    shell_quote(&inner)
                )
            }
        };

        ensure_success(
            run_command(ssh, &command)?,
            "执行容器文件复制失败",
        )?;

        Ok(DockerActionResult {
            success: true,
            message: "Docker 文件复制任务已完成".to_string(),
            updated_state: None,
            updated_status: None,
        })
    }

    fn fetch_stats_map(
        &self,
        ssh: &mut SSHManagerRussh,
    ) -> LovelyResResult<HashMap<String, StatsSnapshot>> {
        let result = run_command(ssh, "docker stats --no-stream --format '{{json .}}'")?;
        if !is_success(&result) {
            println!("?? docker stats 执行失败: {}", result.output.trim());
            return Ok(HashMap::new());
        }

        let mut map = HashMap::new();
        for line in result.output.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            match serde_json::from_str::<DockerStatsRow>(trimmed) {
                Ok(row) => {
                    let snapshot = StatsSnapshot {
                        cpu_percent: parse_percent(row.cpu_perc.as_deref()),
                        memory_usage: normalize_string(row.mem_usage.as_deref()),
                        memory_percent: parse_percent(row.mem_perc.as_deref()),
                        net_io: normalize_string(row.net_io.as_deref()),
                        block_io: normalize_string(row.block_io.as_deref()),
                        pids: row
                            .pids
                            .as_deref()
                            .and_then(|value| value.trim().parse::<u32>().ok()),
                    };

                    if let Some(id) = normalize_string(row.id.as_deref()) {
                        map.insert(id, snapshot.clone());
                    }
                    if let Some(name) = normalize_string(row.name.as_deref()) {
                        map.insert(name.clone(), snapshot.clone());
                    }
                }
                Err(err) => {
                    println!("?? 解析 docker stats 输出失败: {} => {}", trimmed, err);
                }
            }
        }

        Ok(map)
    }

    fn fetch_inspect_map(
        &self,
        ssh: &mut SSHManagerRussh,
        rows: &[DockerPsRow],
    ) -> LovelyResResult<HashMap<String, DockerInspect>> {
        let mut refs = HashSet::new();
        for row in rows {
            refs.insert(row.primary_ref());
        }
        if refs.is_empty() {
            return Ok(HashMap::new());
        }

        let joined = refs
            .iter()
            .map(|item| shell_quote(item))
            .collect::<Vec<_>>()
            .join(" ");
        let command = format!(
            "docker inspect --type container --format '{{{{json .}}}}' {}",
            joined
        );
        let result = ensure_success(
            run_command(ssh, &command)?,
            "获取容器详情失败",
        )?;

        let mut map = HashMap::new();
        for line in result.output.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            match serde_json::from_str::<DockerInspect>(trimmed) {
                Ok(inspect) => {
                    let mut keys = Vec::new();
                    keys.push(inspect.id.clone());
                    keys.push(short_id(&inspect.id));
                    keys.push(inspect.name.clone());
                    keys.push(sanitize_name(&inspect.name));

                    if let Some(settings) = inspect.network_settings.as_ref() {
                        if let Some(networks) = settings.networks.as_ref() {
                            for name in networks.keys() {
                                keys.push(name.clone());
                            }
                        }
                    }

                    for key in keys {
                        map.insert(key, inspect.clone());
                    }
                }
                Err(err) => {
                    println!("?? 解析 docker inspect 输出失败: {} => {}", trimmed, err);
                }
            }
        }

        Ok(map)
    }

    fn lookup_inspect<'a>(
        &self,
        inspect_map: &'a HashMap<String, DockerInspect>,
        row: &DockerPsRow,
    ) -> Option<&'a DockerInspect> {
        let mut candidates = Vec::new();
        candidates.push(row.primary_ref());
        candidates.push(row.id.clone());
        if let Some(names) = row.names.as_ref() {
            for name in names.split(',') {
                let trimmed = name.trim();
                if !trimmed.is_empty() {
                    candidates.push(trimmed.to_string());
                }
            }
        }

        for candidate in candidates {
            if let Some(inspect) = inspect_map.get(&candidate) {
                return Some(inspect);
            }
        }
        None
    }

    fn lookup_stats(
        &self,
        stats_map: &HashMap<String, StatsSnapshot>,
        row: &DockerPsRow,
        inspect: &DockerInspect,
    ) -> Option<StatsSnapshot> {
        let mut candidates = Vec::new();
        candidates.push(row.id.clone());
        candidates.push(row.primary_ref());
        candidates.push(short_id(&inspect.id));
        candidates.push(inspect.id.clone());
        candidates.push(sanitize_name(&inspect.name));

        if let Some(names) = row.names.as_ref() {
            for name in names.split(',') {
                let trimmed = name.trim();
                if !trimmed.is_empty() {
                    candidates.push(trimmed.to_string());
                }
            }
        }

        for candidate in candidates {
            if let Some(stats) = stats_map.get(&candidate) {
                return Some(stats.clone());
            }
        }
        None
    }

    fn fetch_inspect(
        &self,
        ssh: &mut SSHManagerRussh,
        container_ref: &str,
    ) -> LovelyResResult<DockerInspect> {
        let value = self.fetch_inspect_raw(ssh, container_ref)?;
        serde_json::from_value::<DockerInspect>(value).map_err(|err| {
            LovelyResError::DockerError(format!(
                "解析 Docker inspect 输出失败: {}",
                err
            ))
        })
    }

    fn fetch_inspect_raw(
        &self,
        ssh: &mut SSHManagerRussh,
        container_ref: &str,
    ) -> LovelyResResult<Value> {
        let command = format!(
            "docker inspect --type container --format '{{{{json .}}}}' {}",
            shell_quote(container_ref)
        );
        let result = ensure_success(
            run_command(ssh, &command)?,
            "获取容器详情失败",
        )?;

        let payload = result.output.trim();
        if payload.is_empty() {
            return Err(LovelyResError::DockerError(
                "未获取到容器 inspect 数据".to_string(),
            ));
        }

        serde_json::from_str::<Value>(payload).map_err(|err| {
            LovelyResError::DockerError(format!(
                "解析 Docker inspect 输出失败: {}",
                err
            ))
        })
    }
}

#[derive(Debug, Clone, Default)]
struct StatsSnapshot {
    cpu_percent: Option<f64>,
    memory_usage: Option<String>,
    memory_percent: Option<f64>,
    net_io: Option<String>,
    block_io: Option<String>,
    pids: Option<u32>,
}

#[derive(Debug, Deserialize, Clone)]
struct DockerPsRow {
    #[serde(rename = "ID")]
    id: String,
    #[serde(rename = "Names")]
    names: Option<String>,
    #[serde(rename = "Command")]
    command: Option<String>,
    #[serde(rename = "RunningFor")]
    running_for: Option<String>,
    #[serde(rename = "Status")]
    status: Option<String>,
}

impl DockerPsRow {
    fn primary_ref(&self) -> String {
        if let Some(names) = self.names.as_ref() {
            if let Some(first) = names.split(',').next() {
                let trimmed = first.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }
        }
        self.id.clone()
    }
}

#[derive(Debug, Deserialize, Clone)]
struct DockerStatsRow {
    #[serde(rename = "ID")]
    id: Option<String>,
    #[serde(rename = "Name")]
    name: Option<String>,
    #[serde(rename = "CPUPerc")]
    cpu_perc: Option<String>,
    #[serde(rename = "MemUsage")]
    mem_usage: Option<String>,
    #[serde(rename = "MemPerc")]
    mem_perc: Option<String>,
    #[serde(rename = "NetIO")]
    net_io: Option<String>,
    #[serde(rename = "BlockIO")]
    block_io: Option<String>,
    #[serde(rename = "PIDs")]
    pids: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
struct DockerInspect {
    #[serde(rename = "Id")]
    id: String,
    #[serde(rename = "Name")]
    name: String,
    #[serde(rename = "Created")]
    created: String,
    #[serde(rename = "Config")]
    config: DockerInspectConfig,
    #[serde(rename = "State")]
    state: DockerInspectState,
    #[serde(rename = "HostConfig")]
    host_config: DockerInspectHostConfig,
    #[serde(rename = "NetworkSettings")]
    network_settings: Option<DockerInspectNetworkSettings>,
    #[serde(rename = "Mounts")]
    mounts: Vec<DockerInspectMount>,
}

#[derive(Debug, Deserialize, Clone)]
struct DockerInspectConfig {
    #[serde(rename = "Image")]
    image: String,
    #[serde(rename = "Cmd")]
    cmd: Option<Vec<String>>,
}

#[derive(Debug, Deserialize, Clone)]
struct DockerInspectState {
    #[serde(rename = "Status")]
    status: Option<String>,
    #[serde(rename = "Health")]
    health: Option<DockerInspectHealth>,
}

#[derive(Debug, Deserialize, Clone)]
struct DockerInspectHealth {
    #[serde(rename = "Status")]
    status: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
struct DockerInspectHostConfig {
    #[serde(rename = "Privileged")]
    privileged: Option<bool>,
    #[serde(rename = "NetworkMode")]
    network_mode: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
struct DockerInspectNetworkSettings {
    #[serde(rename = "NetworkMode")]
    network_mode: Option<String>,
    #[serde(rename = "Networks")]
    networks: Option<HashMap<String, DockerInspectNetwork>>, 
    #[serde(rename = "Ports")]
    ports: Option<HashMap<String, Option<Vec<DockerPortBinding>>>>,
}

#[derive(Debug, Deserialize, Clone)]
struct DockerInspectNetwork {
    #[serde(rename = "NetworkID")]
    network_id: Option<String>,
    #[serde(rename = "EndpointID")]
    endpoint_id: Option<String>,
    #[serde(rename = "MacAddress")]
    mac_address: Option<String>,
    #[serde(rename = "IPAddress")]
    ipv4_address: Option<String>,
    #[serde(rename = "GlobalIPv6Address")]
    ipv6_address: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
struct DockerPortBinding {
    #[serde(rename = "HostIp")]
    host_ip: Option<String>,
    #[serde(rename = "HostPort")]
    host_port: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
struct DockerInspectMount {
    #[serde(rename = "Type")]
    mount_type: Option<String>,
    #[serde(rename = "Source")]
    source: Option<String>,
    #[serde(rename = "Destination")]
    destination: Option<String>,
    #[serde(rename = "Mode")]
    mode: Option<String>,
    #[serde(rename = "RW")]
    rw: Option<bool>,
}

fn build_summary(
    row: &DockerPsRow,
    inspect: &DockerInspect,
    stats: Option<StatsSnapshot>,
) -> DockerContainerSummary {
    let name = sanitize_name(&inspect.name);
    let state = normalize_string(inspect.state.status.as_deref()).unwrap_or_else(|| "unknown".to_string());
    let status = normalize_string(row.status.as_deref()).unwrap_or_else(|| state.clone());

    let command = if let Some(cmd) = inspect.config.cmd.as_ref() {
        if !cmd.is_empty() {
            Some(cmd.join(" "))
        } else {
            None
        }
    } else {
        normalize_command(row.command.as_deref())
    };

    let created_at = to_iso_string(&inspect.created);
    let ports = extract_ports(inspect);
    let networks = extract_networks(inspect);
    let mounts = extract_mounts(inspect);

    let (cpu_percent, memory_usage, memory_percent, net_io, block_io, pids) = match stats {
        Some(snapshot) => (
            snapshot.cpu_percent,
            snapshot.memory_usage,
            snapshot.memory_percent,
            snapshot.net_io,
            snapshot.block_io,
            snapshot.pids,
        ),
        None => (None, None, None, None, None, None),
    };

    let quick_checks = DockerQuickCheck {
        network_attached: !networks.is_empty(),
        privileged: inspect.host_config.privileged.unwrap_or(false),
        health: inspect
            .state
            .health
            .as_ref()
            .and_then(|h| normalize_string(h.status.as_deref())),
    };

    let network_mode = inspect
        .host_config
        .network_mode
        .as_ref()
        .and_then(|s| normalize_string(Some(s)))
        .or_else(|| {
            inspect
                .network_settings
                .as_ref()
                .and_then(|settings| settings.network_mode.as_ref())
                .and_then(|s| normalize_string(Some(s)))
        });

    DockerContainerSummary {
        id: inspect.id.clone(),
        short_id: short_id(&inspect.id),
        name,
        image: inspect.config.image.clone(),
        state,
        status,
        created_at,
        uptime: normalize_string(row.running_for.as_deref()),
        command,
        ports,
        cpu_percent,
        memory_usage,
        memory_percent,
        net_io,
        block_io,
        pids,
        network_mode,
        networks,
        mounts,
        quick_checks,
    }
}

fn extract_ports(inspect: &DockerInspect) -> Vec<DockerPortMapping> {
    let mut mappings = Vec::new();
    let settings = match inspect.network_settings.as_ref() {
        Some(value) => value,
        None => return mappings,
    };

    if let Some(port_map) = settings.ports.as_ref() {
        for (container_port, bindings_opt) in port_map {
            let (private_port, protocol) = split_port(container_port);
            match bindings_opt {
                Some(bindings) if !bindings.is_empty() => {
                    for binding in bindings {
                        mappings.push(DockerPortMapping {
                            ip: normalize_string(binding.host_ip.as_deref()),
                            private_port: private_port.clone(),
                            public_port: normalize_string(binding.host_port.as_deref()),
                            protocol: protocol.clone(),
                        });
                    }
                }
                _ => {
                    mappings.push(DockerPortMapping {
                        ip: None,
                        private_port: private_port.clone(),
                        public_port: None,
                        protocol: protocol.clone(),
                    });
                }
            }
        }
    }

    mappings
}

fn extract_networks(inspect: &DockerInspect) -> Vec<DockerNetworkAttachment> {
    let mut networks = Vec::new();
    let settings = match inspect.network_settings.as_ref() {
        Some(value) => value,
        None => return networks,
    };

    if let Some(items) = settings.networks.as_ref() {
        for (name, details) in items {
            networks.push(DockerNetworkAttachment {
                name: name.clone(),
                network_id: normalize_string(details.network_id.as_deref()),
                endpoint_id: normalize_string(details.endpoint_id.as_deref()),
                mac_address: normalize_string(details.mac_address.as_deref()),
                ipv4_address: normalize_string(details.ipv4_address.as_deref()),
                ipv6_address: normalize_string(details.ipv6_address.as_deref()),
            });
        }
    }

    networks
}

fn extract_mounts(inspect: &DockerInspect) -> Vec<DockerMountInfo> {
    inspect
        .mounts
        .iter()
        .map(|mount| DockerMountInfo {
            mount_type: normalize_string(mount.mount_type.as_deref()).unwrap_or_else(|| "volume".to_string()),
            source: normalize_string(mount.source.as_deref()),
            destination: normalize_string(mount.destination.as_deref()).unwrap_or_else(|| "".to_string()),
            mode: normalize_string(mount.mode.as_deref()),
            rw: mount.rw.unwrap_or(false),
        })
        .collect()
}

fn run_command(ssh: &mut SSHManagerRussh, command: &str) -> LovelyResResult<TerminalOutput> {
    // 使用命令执行
    ssh.execute_command(command)
        .map_err(|e| LovelyResError::SSHError(e))
}

fn ensure_success(
    result: TerminalOutput,
    fallback_message: &str,
) -> LovelyResResult<TerminalOutput> {
    if is_success(&result) {
        Ok(result)
    } else {
        let message = result.output.trim();
        if message.is_empty() {
            Err(LovelyResError::DockerError(fallback_message.to_string()))
        } else {
            Err(LovelyResError::DockerError(message.to_string()))
        }
    }
}

fn is_success(result: &TerminalOutput) -> bool {
    result.exit_code.unwrap_or(0) == 0
}

fn normalize_string(value: Option<&str>) -> Option<String> {
    value
        .map(|v| v.trim())
        .filter(|v| !v.is_empty())
        .map(|v| v.to_string())
}

fn normalize_command(value: Option<&str>) -> Option<String> {
    normalize_string(value).map(|mut command| {
        if command.starts_with('"') && command.ends_with('"') && command.len() >= 2 {
            command = command[1..command.len() - 1].to_string();
        }
        command
    })
}

fn parse_percent(value: Option<&str>) -> Option<f64> {
    value
        .map(|v| v.trim().trim_end_matches('%').replace(',', "."))
        .and_then(|v| v.parse::<f64>().ok())
}

fn short_id(value: &str) -> String {
    value.chars().take(12).collect()
}

fn to_iso_string(value: &str) -> String {
    match chrono::DateTime::parse_from_rfc3339(value) {
        Ok(dt) => dt.to_rfc3339(),
        Err(_) => value.to_string(),
    }
}

fn shell_quote(value: &str) -> String {
    if value.is_empty() {
        return "''".to_string();
    }
    format!("'{}'", value.replace("'", "'\\''"))
}

fn sanitize_name(name: &str) -> String {
    name.trim_start_matches('/').to_string()
}

fn split_port(value: &str) -> (String, String) {
    let mut parts = value.split('/');
    let private = parts.next().unwrap_or("").to_string();
    let protocol = parts.next().unwrap_or("").to_string();
    (private, protocol)
}

fn derive_parent_path(path: &str) -> Option<String> {
    let normalized = path.replace('\\', "/");
    let mut segments: Vec<&str> = normalized.split('/').collect();
    if segments.len() <= 1 {
        return None;
    }
    segments.pop();
    let parent = segments.join("/");
    if parent.is_empty() { None } else { Some(parent) }
}

fn generate_temp_path() -> String {
    format!("/tmp/lovelyres_{}.tmp", Uuid::new_v4())
}
