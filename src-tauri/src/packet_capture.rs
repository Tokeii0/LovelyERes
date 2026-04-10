use serde::{Deserialize, Serialize};

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

/// 从端口号推断应用层协议
fn infer_protocol_from_port(addr: &str) -> Option<&'static str> {
    // tcpdump 格式: 192.168.1.1.80 或 192.168.1.1.443
    if let Some(pos) = addr.rfind('.') {
        if let Ok(port) = addr[pos + 1..].parse::<u16>() {
            return match port {
                80 | 8080 | 8000 | 8888 => Some("HTTP"),
                443 | 8443 => Some("HTTPS"),
                53 => Some("DNS"),
                22 => Some("SSH"),
                21 => Some("FTP"),
                25 | 465 | 587 => Some("SMTP"),
                110 | 995 => Some("POP3"),
                143 | 993 => Some("IMAP"),
                3306 => Some("MySQL"),
                5432 => Some("PgSQL"),
                6379 => Some("Redis"),
                27017 => Some("MongoDB"),
                _ => None,
            };
        }
    }
    None
}

/// 从 info 字段提取 length
fn extract_length(info: &str) -> String {
    // 匹配 "length N" 或 "len N"
    for word_pair in info.split_whitespace().collect::<Vec<&str>>().windows(2) {
        if word_pair[0] == "length" || word_pair[0] == "len" {
            if let Some(num_str) = word_pair[1].strip_suffix(',').or(Some(word_pair[1])) {
                if num_str.parse::<u64>().is_ok() {
                    return num_str.to_string();
                }
            }
        }
    }
    String::new()
}

/// 解析 tcpdump 输出行（支持 -tttt -v 格式）
pub fn parse_tcpdump_line(line: &str, id: usize) -> PacketEntry {
    let parts: Vec<&str> = line.split_whitespace().collect();

    let mut entry = PacketEntry {
        id,
        timestamp: String::new(),
        protocol: "OTHER".to_string(),
        src: String::new(),
        dst: String::new(),
        length: String::new(),
        info: line.to_string(),
        raw: line.to_string(),
    };

    if parts.len() < 4 {
        return entry;
    }

    // 检测 -tttt 格式: "2024-01-15 19:43:01.123456 IP ..."
    // 或普通格式: "19:43:01.123456 IP ..."
    let (ts, offset) = if parts[0].contains('-') && parts.len() > 1 && parts[1].contains(':') {
        // -tttt 格式
        (format!("{} {}", parts[0], parts[1]), 2)
    } else {
        (parts[0].to_string(), 1)
    };
    entry.timestamp = ts;

    if parts.len() <= offset {
        return entry;
    }

    let proto_token = parts[offset];

    if proto_token == "IP" || proto_token == "IP6" {
        entry.protocol = proto_token.to_string();

        // 找 ">" 分隔 src > dst
        if let Some(arrow_idx) = parts[offset..].iter().position(|&x| x == ">") {
            let abs_arrow = offset + arrow_idx;

            // Source
            if abs_arrow > offset + 1 {
                entry.src = parts[offset + 1..abs_arrow].join(" ");
            }

            // Destination (去掉末尾冒号)
            if abs_arrow + 1 < parts.len() {
                entry.dst = parts[abs_arrow + 1].trim_end_matches(':').to_string();

                // Info
                let info_start = abs_arrow + 2;
                if info_start < parts.len() {
                    entry.info = parts[info_start..].join(" ");
                }
            }

            // 从端口推断应用层协议
            if let Some(app_proto) = infer_protocol_from_port(&entry.src)
                .or_else(|| infer_protocol_from_port(&entry.dst)) {
                entry.protocol = app_proto.to_string();
            }
        }
    } else if proto_token.starts_with("ARP") || proto_token == "ARP," {
        entry.protocol = "ARP".to_string();
        entry.info = parts[offset..].join(" ");
    } else {
        entry.protocol = proto_token.trim_end_matches(',').to_string();
        entry.info = parts[offset..].join(" ");
    }

    // 提取 length
    entry.length = extract_length(&entry.info);

    entry
}

/// 生成 tcpdump 命令（增强版: -tttt 完整时间戳, -v 获取 length）
pub fn generate_tcpdump_command(interface: &str, filter: Option<&str>, count: Option<u32>) -> String {
    let mut cmd = format!("tcpdump -nne -l -tttt -v -i {}", interface);

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
    "ip -o -4 addr show | awk '{print $2, $4}'".to_string()
}
