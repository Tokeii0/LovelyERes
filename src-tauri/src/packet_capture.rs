use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PacketEntry {
    pub id: usize,
    pub timestamp: String,
    pub protocol: String,
    pub src: String,
    pub dst: String,
    pub length: String,
    pub info: String,
    pub raw: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkInterface {
    pub name: String,
    pub index: u32,
    pub mac: Option<String>,
    pub ips: Vec<String>,
}

/// 解析 tcpdump 输出行
/// 预期格式: "timestamp protocol src > dst: info"
/// 示例: "19:43:01.123456 IP 192.168.1.2.1234 > 192.168.1.1.80: Flags [S], seq 12345..."
pub fn parse_tcpdump_line(line: &str, id: usize) -> PacketEntry {
    let parts: Vec<&str> = line.split_whitespace().collect();
    
    // 默认/失败情况
    let mut entry = PacketEntry {
        id,
        timestamp: String::new(),
        protocol: "UNKNOWN".to_string(),
        src: String::new(),
        dst: String::new(),
        length: String::new(),
        info: line.to_string(),
        raw: line.to_string(),
    };

    if parts.len() < 5 {
        return entry;
    }

    // 简单解析尝试
    // 1. Timestamp
    entry.timestamp = parts[0].to_string();

    // 2. Protocol (通常在 IP 后, tcpdump 输出格式不固定，这里做简单启发式)
    // "IP" 也是常见的协议标识
    if parts[1] == "IP" || parts[1] == "IP6" {
        entry.protocol = parts[1].to_string();
        
        // Src > Dst
        // 寻找 ">"
        if let Some(arrow_idx) = parts.iter().position(|&x| x == ">") {
            if arrow_idx > 2 {
                entry.src = parts[2..arrow_idx].join(" "); // 通常就是一个字段
            }
            if arrow_idx + 1 < parts.len() {
                // Dst 通常以 : 结尾
                let dst_part = parts[arrow_idx + 1];
                entry.dst = dst_part.trim_end_matches(':').to_string();
                
                // Info 是冒号后面的所有内容
                // 找到第一个冒号的位置，或者从 dst 后面的部分开始
                let info_start_idx = arrow_idx + 2;
                if info_start_idx < parts.len() {
                    entry.info = parts[info_start_idx..].join(" ");
                }
            }
        }
    } else {
        // 其他格式，如 ARP
        // "ARP, Request who-has ..."
        entry.protocol = parts[1].trim_end_matches(',').to_string();
        entry.info = parts[1..].join(" ");
    }

    entry
}

/// 生成 tcpdump 命令
pub fn generate_tcpdump_command(interface: &str, filter: Option<&str>, count: Option<u32>) -> String {
    let mut cmd = format!("tcpdump -nne -l -i {}", interface);
    
    if let Some(c) = count {
        cmd.push_str(&format!(" -c {}", c));
    }
    
    if let Some(f) = filter {
        if !f.trim().is_empty() {
            cmd.push_str(&format!(" \"{}\"", f));
        }
    }
    
    cmd
}

/// 生成获取网络接口的命令
pub fn generate_list_interfaces_command() -> String {
    // 使用 ip addr -o -4 获取精简信息
    "ip -o -4 addr show | awk '{print $2, $4}'".to_string()
}
