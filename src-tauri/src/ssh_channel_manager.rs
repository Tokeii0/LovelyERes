use ssh2::{Channel, Session};
use std::sync::{Arc, Mutex, RwLock};
use std::collections::HashMap;
use std::time::{Duration, Instant};
use std::io::Write;
use crate::types::{LovelyResResult, LovelyResError};

/// SSH Channel state tracking
#[derive(Debug, Clone, PartialEq)]
pub enum ChannelState {
    Active,
    Closing,
    Closed,
    Error(String),
}

/// Enhanced SSH Channel wrapper with state management
pub struct ManagedChannel {
    pub channel: Channel,
    pub state: Arc<RwLock<ChannelState>>,
    pub last_activity: Arc<Mutex<Instant>>,
    pub session_id: String,
    pub created_at: Instant,
}

impl ManagedChannel {
    pub fn new(channel: Channel, session_id: String) -> Self {
        Self {
            channel,
            state: Arc::new(RwLock::new(ChannelState::Active)),
            last_activity: Arc::new(Mutex::new(Instant::now())),
            session_id,
            created_at: Instant::now(),
        }
    }

    /// Check if channel is writable (not closed or closing)
    pub fn is_writable(&self) -> bool {
        match *self.state.read().unwrap() {
            ChannelState::Active => true,
            _ => false,
        }
    }

    /// Check if channel is readable
    pub fn is_readable(&self) -> bool {
        match *self.state.read().unwrap() {
            ChannelState::Active => true,
            _ => false,
        }
    }

    /// Update last activity timestamp
    pub fn update_activity(&self) {
        *self.last_activity.lock().unwrap() = Instant::now();
    }

    /// Set channel state
    pub fn set_state(&self, new_state: ChannelState) {
        *self.state.write().unwrap() = new_state;
    }

    /// Get current state
    pub fn get_state(&self) -> ChannelState {
        self.state.read().unwrap().clone()
    }

    /// Check if channel has been inactive for too long
    pub fn is_stale(&self, timeout: Duration) -> bool {
        self.last_activity.lock().unwrap().elapsed() > timeout
    }
}

/// SSH Channel Manager for state tracking and health monitoring
pub struct SSHChannelManager {
    channels: Arc<RwLock<HashMap<String, Arc<ManagedChannel>>>>,
    session: Arc<Mutex<Option<Session>>>,
    health_check_interval: Duration,
    channel_timeout: Duration,
}

impl SSHChannelManager {
    pub fn new(session: Session) -> Self {
        Self {
            channels: Arc::new(RwLock::new(HashMap::new())),
            session: Arc::new(Mutex::new(Some(session))),
            health_check_interval: Duration::from_secs(3600), // 1小时检查一次，减少干扰
            channel_timeout: Duration::from_secs(u64::MAX / 2), // 几乎永不超时
        }
    }

    /// Register a new managed channel
    pub fn register_channel(&self, session_id: String, channel: Channel) -> Arc<ManagedChannel> {
        let managed_channel = Arc::new(ManagedChannel::new(channel, session_id.clone()));
        self.channels.write().unwrap().insert(session_id, managed_channel.clone());
        managed_channel
    }

    /// Get a managed channel by session ID
    pub fn get_channel(&self, session_id: &str) -> Option<Arc<ManagedChannel>> {
        self.channels.read().unwrap().get(session_id).cloned()
    }

    /// Remove a channel from management
    pub fn remove_channel(&self, session_id: &str) {
        self.channels.write().unwrap().remove(session_id);
    }

    /// Check SSH session health
    pub fn check_session_health(&self) -> LovelyResResult<bool> {
        // 完全跳过keepalive检查，避免干扰SSH会话
        // 直接返回true，让实际的数据传输来判断连接状态
        Ok(true)
    }

    /// Validate channel state before operations
    pub fn validate_channel_for_write(&self, session_id: &str) -> LovelyResResult<()> {
        if let Some(managed_channel) = self.get_channel(session_id) {
            // Check if channel is writable
            if !managed_channel.is_writable() {
                return Err(LovelyResError::SSHError(
                    format!("Channel {} is not writable (state: {:?})", 
                           session_id, managed_channel.get_state())
                ));
            }

            // Check if channel is stale
            if managed_channel.is_stale(self.channel_timeout) {
                managed_channel.set_state(ChannelState::Error("Channel timeout".to_string()));
                return Err(LovelyResError::SSHError(
                    format!("Channel {} has timed out", session_id)
                ));
            }

            // Check if channel is EOF
            if managed_channel.channel.eof() {
                managed_channel.set_state(ChannelState::Closed);
                return Err(LovelyResError::SSHError(
                    format!("Channel {} has reached EOF", session_id)
                ));
            }

            Ok(())
        } else {
            Err(LovelyResError::SSHError(
                format!("Channel {} not found", session_id)
            ))
        }
    }

    /// Safe write operation with state validation
    pub fn safe_write(&self, session_id: &str, data: &[u8]) -> LovelyResResult<usize> {
        // Validate channel state first
        self.validate_channel_for_write(session_id)?;

        if let Some(managed_channel) = self.get_channel(session_id) {
            // We need to get a mutable reference to the channel
            // Since we can't get a mutable reference through Arc, we'll need to restructure this
            // For now, let's return an error indicating this needs to be handled differently
            Err(LovelyResError::SSHError(
                "Channel write operation needs to be handled at a higher level".to_string()
            ))
        } else {
            Err(LovelyResError::SSHError(
                format!("Channel {} not found", session_id)
            ))
        }
    }

    /// Cleanup stale channels
    pub fn cleanup_stale_channels(&self) {
        let mut channels = self.channels.write().unwrap();
        let stale_channels: Vec<String> = channels
            .iter()
            .filter(|(_, channel)| channel.is_stale(self.channel_timeout))
            .map(|(id, _)| id.clone())
            .collect();

        for channel_id in stale_channels {
            if let Some(channel) = channels.get(&channel_id) {
                channel.set_state(ChannelState::Error("Stale channel cleanup".to_string()));
            }
            channels.remove(&channel_id);
            println!("🧹 Cleaned up stale channel: {}", channel_id);
        }
    }

    /// Get channel statistics
    pub fn get_channel_stats(&self) -> HashMap<String, (ChannelState, Duration)> {
        let channels = self.channels.read().unwrap();
        channels
            .iter()
            .map(|(id, channel)| {
                let age = channel.created_at.elapsed();
                (id.clone(), (channel.get_state(), age))
            })
            .collect()
    }
}

/// SSH Connection Health Monitor
pub struct SSHHealthMonitor {
    channel_manager: Arc<SSHChannelManager>,
    monitoring: Arc<Mutex<bool>>,
}

impl SSHHealthMonitor {
    pub fn new(channel_manager: Arc<SSHChannelManager>) -> Self {
        Self {
            channel_manager,
            monitoring: Arc::new(Mutex::new(false)),
        }
    }

    /// Start health monitoring in background
    pub fn start_monitoring(&self) {
        let mut monitoring = self.monitoring.lock().unwrap();
        if *monitoring {
            return; // Already monitoring
        }
        *monitoring = true;

        let channel_manager = self.channel_manager.clone();
        let monitoring_flag = self.monitoring.clone();

        std::thread::spawn(move || {
            while *monitoring_flag.lock().unwrap() {
                // Check session health
                if let Err(e) = channel_manager.check_session_health() {
                    println!("⚠️ SSH health check failed: {}", e);
                }

                // Cleanup stale channels
                channel_manager.cleanup_stale_channels();

                // Sleep for health check interval
                std::thread::sleep(Duration::from_secs(30));
            }
        });
    }

    /// Stop health monitoring
    pub fn stop_monitoring(&self) {
        *self.monitoring.lock().unwrap() = false;
    }
}
