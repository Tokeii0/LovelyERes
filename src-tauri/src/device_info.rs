// 设备信息模块
// 用于获取设备的唯一标识符（UUID）

use serde::{Deserialize, Serialize};
use std::process::Command;

// Windows 平台需要导入 CommandExt 来隐藏控制台窗口
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub device_uuid: String,
    pub device_type: String,
    pub device_name: String,
}

/// 获取 Windows 设备 UUID
#[cfg(target_os = "windows")]
fn get_windows_uuid() -> Result<String, String> {
    // 使用 PowerShell 获取主板 UUID（推荐方式，兼容最新 Windows 版本）
    // CREATE_NO_WINDOW = 0x08000000 用于隐藏控制台窗口
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let output = Command::new("powershell")
        .args(&[
            "-NoProfile",
            "-Command",
            "(Get-CimInstance -ClassName Win32_ComputerSystemProduct).UUID"
        ])
        .creation_flags(CREATE_NO_WINDOW)  // 隐藏控制台窗口
        .output()
        .map_err(|e| format!("执行 PowerShell 命令失败: {}", e))?;

    if !output.status.success() {
        return Err("PowerShell 命令执行失败".to_string());
    }

    let uuid = String::from_utf8_lossy(&output.stdout).trim().to_string();

    if !uuid.is_empty() {
        return Ok(uuid);
    }

    Err("无法获取 Windows UUID".to_string())
}

/// 获取 macOS 设备 UUID
#[cfg(target_os = "macos")]
fn get_macos_uuid() -> Result<String, String> {
    // 使用 ioreg 获取硬件 UUID
    let output = Command::new("ioreg")
        .args(&["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .map_err(|e| format!("执行 ioreg 命令失败: {}", e))?;

    if !output.status.success() {
        return Err("ioreg 命令执行失败".to_string());
    }

    let output_str = String::from_utf8_lossy(&output.stdout);
    
    // 查找 IOPlatformUUID
    for line in output_str.lines() {
        if line.contains("IOPlatformUUID") {
            // 提取 UUID 值
            if let Some(uuid_part) = line.split('"').nth(3) {
                return Ok(uuid_part.to_string());
            }
        }
    }

    Err("无法获取 macOS UUID".to_string())
}

/// 获取 Linux 设备 UUID
#[cfg(target_os = "linux")]
fn get_linux_uuid() -> Result<String, String> {
    // 尝试从 /etc/machine-id 读取
    if let Ok(machine_id) = std::fs::read_to_string("/etc/machine-id") {
        return Ok(machine_id.trim().to_string());
    }

    // 尝试从 /var/lib/dbus/machine-id 读取
    if let Ok(machine_id) = std::fs::read_to_string("/var/lib/dbus/machine-id") {
        return Ok(machine_id.trim().to_string());
    }

    // 尝试使用 dmidecode 获取主板 UUID（需要 root 权限）
    let output = Command::new("dmidecode")
        .args(&["-s", "system-uuid"])
        .output()
        .map_err(|e| format!("执行 dmidecode 命令失败: {}", e))?;

    if output.status.success() {
        let uuid = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !uuid.is_empty() {
            return Ok(uuid);
        }
    }

    Err("无法获取 Linux UUID".to_string())
}

/// 获取设备类型
fn get_device_type() -> String {
    #[cfg(target_os = "windows")]
    return "windows".to_string();

    #[cfg(target_os = "macos")]
    return "macos".to_string();

    #[cfg(target_os = "linux")]
    return "linux".to_string();

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return "unknown".to_string();
}

/// 获取设备名称
fn get_device_name() -> String {
    #[cfg(target_os = "windows")]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        if let Ok(output) = Command::new("hostname")
            .creation_flags(CREATE_NO_WINDOW)  // 隐藏控制台窗口
            .output()
        {
            if output.status.success() {
                return String::from_utf8_lossy(&output.stdout).trim().to_string();
            }
        }
    }

    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = Command::new("scutil")
            .args(&["--get", "ComputerName"])
            .output()
        {
            if output.status.success() {
                return String::from_utf8_lossy(&output.stdout).trim().to_string();
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Ok(hostname) = std::fs::read_to_string("/etc/hostname") {
            return hostname.trim().to_string();
        }
        if let Ok(output) = Command::new("hostname").output() {
            if output.status.success() {
                return String::from_utf8_lossy(&output.stdout).trim().to_string();
            }
        }
    }

    "Unknown Device".to_string()
}

/// 获取设备信息
pub fn get_device_info() -> Result<DeviceInfo, String> {
    let device_uuid = {
        #[cfg(target_os = "windows")]
        {
            get_windows_uuid()?
        }

        #[cfg(target_os = "macos")]
        {
            get_macos_uuid()?
        }

        #[cfg(target_os = "linux")]
        {
            get_linux_uuid()?
        }

        #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
        {
            return Err("不支持的操作系统".to_string());
        }
    };

    Ok(DeviceInfo {
        device_uuid,
        device_type: get_device_type(),
        device_name: get_device_name(),
    })
}

/// Tauri 命令：获取设备信息
#[tauri::command]
pub async fn get_device_uuid() -> Result<DeviceInfo, String> {
    get_device_info()
}

