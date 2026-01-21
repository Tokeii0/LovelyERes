use std::collections::HashMap;
use std::sync::{Arc, RwLock, OnceLock};
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};

/// SSH Debug Event Types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SSHDebugEvent {
    ConnectionEstablished { host: String, port: u16, duration_ms: u64 },
    ConnectionFailed { host: String, port: u16, error: String },
    ChannelCreated { session_id: String, channel_type: String },
    ChannelClosed { session_id: String, reason: String },
    InputSent { session_id: String, bytes: usize, priority: String },
    InputFailed { session_id: String, error: String, retry_count: u32 },
    FlowControlActivated { session_id: String, state: String },
    FlowControlDeactivated { session_id: String },
    WindowAdjusted { session_id: String, new_size: u32 },
    KeepAliveSuccess { session_id: String },
    KeepAliveFailed { session_id: String, error: String },
    ThreadCreated { thread_id: String, thread_type: String },
    ThreadStopped { thread_id: String, duration_ms: u64 },
    BufferOverflow { session_id: String, buffer_size: usize },
    RetryExhausted { session_id: String, max_retries: u32 },
}

/// SSH Performance Metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SSHMetrics {
    pub total_connections: u64,
    pub active_connections: u64,
    pub failed_connections: u64,
    pub total_input_bytes: u64,
    pub failed_input_bytes: u64,
    pub average_latency_ms: f64,
    pub flow_control_activations: u64,
    pub buffer_overflows: u64,
    pub retry_count: u64,
    pub keepalive_failures: u64,
}

impl Default for SSHMetrics {
    fn default() -> Self {
        Self {
            total_connections: 0,
            active_connections: 0,
            failed_connections: 0,
            total_input_bytes: 0,
            failed_input_bytes: 0,
            average_latency_ms: 0.0,
            flow_control_activations: 0,
            buffer_overflows: 0,
            retry_count: 0,
            keepalive_failures: 0,
        }
    }
}

/// SSH Debug and Monitoring System
pub struct SSHDebugger {
    events: Arc<RwLock<Vec<(Instant, SSHDebugEvent)>>>,
    metrics: Arc<RwLock<SSHMetrics>>,
    session_stats: Arc<RwLock<HashMap<String, SessionStats>>>,
    max_events: usize,
    debug_enabled: Arc<RwLock<bool>>,
}

#[derive(Debug, Clone)]
pub struct SessionStats {
    created_at: Instant,
    last_activity: Instant,
    input_bytes: u64,
    _output_bytes: u64,
    error_count: u32,
    flow_control_count: u32,
    retry_count: u32,
}

impl SSHDebugger {
    pub fn new() -> Self {
        Self {
            events: Arc::new(RwLock::new(Vec::new())),
            metrics: Arc::new(RwLock::new(SSHMetrics::default())),
            session_stats: Arc::new(RwLock::new(HashMap::new())),
            max_events: 1000, // Keep last 1000 events
            debug_enabled: Arc::new(RwLock::new(true)),
        }
    }

    /// Enable or disable debug logging
    pub fn set_debug_enabled(&self, enabled: bool) {
        *self.debug_enabled.write().unwrap() = enabled;
    }

    /// Log a debug event
    pub fn log_event(&self, event: SSHDebugEvent) {
        if !*self.debug_enabled.read().unwrap() {
            return;
        }

        let now = Instant::now();
        
        // Add event to history
        {
            let mut events = self.events.write().unwrap();
            events.push((now, event.clone()));
            
            // Keep only the last max_events
            if events.len() > self.max_events {
                events.remove(0);
            }
        }

        // Update metrics
        self.update_metrics(&event);
        
        // Update session stats
        self.update_session_stats(&event, now);

        // Print debug info
        println!("🐛 SSH Debug: {:?}", event);
    }

    /// Update metrics based on event
    fn update_metrics(&self, event: &SSHDebugEvent) {
        let mut metrics = self.metrics.write().unwrap();
        
        match event {
            SSHDebugEvent::ConnectionEstablished { .. } => {
                metrics.total_connections += 1;
                metrics.active_connections += 1;
            }
            SSHDebugEvent::ConnectionFailed { .. } => {
                metrics.failed_connections += 1;
            }
            SSHDebugEvent::InputSent { bytes, .. } => {
                metrics.total_input_bytes += *bytes as u64;
            }
            SSHDebugEvent::InputFailed { .. } => {
                metrics.retry_count += 1;
            }
            SSHDebugEvent::FlowControlActivated { .. } => {
                metrics.flow_control_activations += 1;
            }
            SSHDebugEvent::BufferOverflow { .. } => {
                metrics.buffer_overflows += 1;
            }
            SSHDebugEvent::KeepAliveFailed { .. } => {
                metrics.keepalive_failures += 1;
            }
            _ => {}
        }
    }

    /// Update session statistics
    fn update_session_stats(&self, event: &SSHDebugEvent, timestamp: Instant) {
        let mut session_stats = self.session_stats.write().unwrap();
        
        let session_id = match event {
            SSHDebugEvent::ChannelCreated { session_id, .. } |
            SSHDebugEvent::ChannelClosed { session_id, .. } |
            SSHDebugEvent::InputSent { session_id, .. } |
            SSHDebugEvent::InputFailed { session_id, .. } |
            SSHDebugEvent::FlowControlActivated { session_id, .. } |
            SSHDebugEvent::FlowControlDeactivated { session_id, .. } |
            SSHDebugEvent::WindowAdjusted { session_id, .. } |
            SSHDebugEvent::KeepAliveSuccess { session_id, .. } |
            SSHDebugEvent::KeepAliveFailed { session_id, .. } |
            SSHDebugEvent::BufferOverflow { session_id, .. } |
            SSHDebugEvent::RetryExhausted { session_id, .. } => session_id,
            _ => return,
        };

        let stats = session_stats.entry(session_id.clone()).or_insert_with(|| {
            SessionStats {
                created_at: timestamp,
                last_activity: timestamp,
                input_bytes: 0,
                _output_bytes: 0,
                error_count: 0,
                flow_control_count: 0,
                retry_count: 0,
            }
        });

        stats.last_activity = timestamp;

        match event {
            SSHDebugEvent::InputSent { bytes, .. } => {
                stats.input_bytes += *bytes as u64;
            }
            SSHDebugEvent::InputFailed { .. } => {
                stats.error_count += 1;
                stats.retry_count += 1;
            }
            SSHDebugEvent::FlowControlActivated { .. } => {
                stats.flow_control_count += 1;
            }
            _ => {}
        }
    }

    /// Get current metrics
    pub fn get_metrics(&self) -> SSHMetrics {
        self.metrics.read().unwrap().clone()
    }

    /// Get recent events
    pub fn get_recent_events(&self, limit: usize) -> Vec<(Instant, SSHDebugEvent)> {
        let events = self.events.read().unwrap();
        let start_index = if events.len() > limit {
            events.len() - limit
        } else {
            0
        };
        events[start_index..].to_vec()
    }

    /// Get session statistics
    pub fn get_session_stats(&self, session_id: &str) -> Option<SessionStats> {
        self.session_stats.read().unwrap().get(session_id).cloned()
    }

    /// Get all session statistics
    pub fn get_all_session_stats(&self) -> HashMap<String, SessionStats> {
        self.session_stats.read().unwrap().clone()
    }

    /// Generate debug report
    pub fn generate_debug_report(&self) -> String {
        let metrics = self.get_metrics();
        let recent_events = self.get_recent_events(10);
        let session_stats = self.get_all_session_stats();

        let mut report = String::new();
        report.push_str("=== SSH Debug Report ===\n\n");

        // Metrics
        report.push_str("📊 Metrics:\n");
        report.push_str(&format!("  Total Connections: {}\n", metrics.total_connections));
        report.push_str(&format!("  Active Connections: {}\n", metrics.active_connections));
        report.push_str(&format!("  Failed Connections: {}\n", metrics.failed_connections));
        report.push_str(&format!("  Total Input Bytes: {}\n", metrics.total_input_bytes));
        report.push_str(&format!("  Flow Control Activations: {}\n", metrics.flow_control_activations));
        report.push_str(&format!("  Buffer Overflows: {}\n", metrics.buffer_overflows));
        report.push_str(&format!("  Retry Count: {}\n", metrics.retry_count));
        report.push_str(&format!("  Keepalive Failures: {}\n", metrics.keepalive_failures));
        report.push_str("\n");

        // Recent Events
        report.push_str("📝 Recent Events:\n");
        for (timestamp, event) in recent_events.iter().rev() {
            let elapsed = timestamp.elapsed();
            report.push_str(&format!("  [{:.2}s ago] {:?}\n", elapsed.as_secs_f64(), event));
        }
        report.push_str("\n");

        // Session Stats
        report.push_str("📈 Session Statistics:\n");
        for (session_id, stats) in session_stats.iter() {
            let age = stats.created_at.elapsed();
            let last_activity = stats.last_activity.elapsed();
            report.push_str(&format!(
                "  Session {}: Age={:.1}s, LastActivity={:.1}s, Input={}B, Errors={}, FlowControl={}, Retries={}\n",
                session_id,
                age.as_secs_f64(),
                last_activity.as_secs_f64(),
                stats.input_bytes,
                stats.error_count,
                stats.flow_control_count,
                stats.retry_count,
            ));
        }

        report
    }

    /// Clear all debug data
    pub fn clear(&self) {
        self.events.write().unwrap().clear();
        self.session_stats.write().unwrap().clear();
        *self.metrics.write().unwrap() = SSHMetrics::default();
    }

    /// Check for potential issues and return warnings
    pub fn check_health(&self) -> Vec<String> {
        let mut warnings = Vec::new();
        let metrics = self.get_metrics();
        let session_stats = self.get_all_session_stats();

        // Check connection failure rate
        if metrics.total_connections > 0 {
            let failure_rate = metrics.failed_connections as f64 / metrics.total_connections as f64;
            if failure_rate > 0.2 {
                warnings.push(format!("High connection failure rate: {:.1}%", failure_rate * 100.0));
            }
        }

        // Check flow control activations
        if metrics.flow_control_activations > 10 {
            warnings.push("Frequent flow control activations detected".to_string());
        }

        // Check buffer overflows
        if metrics.buffer_overflows > 0 {
            warnings.push(format!("Buffer overflows detected: {}", metrics.buffer_overflows));
        }

        // Check stale sessions
        let _now = Instant::now();
        for (session_id, stats) in session_stats.iter() {
            if stats.last_activity.elapsed() > Duration::from_secs(300) { // 5 minutes
                warnings.push(format!("Session {} appears stale (no activity for {:.1}s)", 
                    session_id, stats.last_activity.elapsed().as_secs_f64()));
            }
        }

        warnings
    }
}

/// Global SSH debugger instance
static SSH_DEBUGGER: OnceLock<SSHDebugger> = OnceLock::new();

pub fn get_ssh_debugger() -> &'static SSHDebugger {
    SSH_DEBUGGER.get_or_init(|| SSHDebugger::new())
}

/// Convenience macros for logging
#[macro_export]
macro_rules! ssh_debug {
    ($event:expr) => {
        crate::ssh_debug::get_ssh_debugger().log_event($event);
    };
}

#[macro_export]
macro_rules! ssh_debug_connection_established {
    ($host:expr, $port:expr, $duration:expr) => {
        ssh_debug!(crate::ssh_debug::SSHDebugEvent::ConnectionEstablished {
            host: $host.to_string(),
            port: $port,
            duration_ms: $duration.as_millis() as u64,
        });
    };
}

#[macro_export]
macro_rules! ssh_debug_input_failed {
    ($session_id:expr, $error:expr, $retry_count:expr) => {
        ssh_debug!(crate::ssh_debug::SSHDebugEvent::InputFailed {
            session_id: $session_id.to_string(),
            error: $error.to_string(),
            retry_count: $retry_count,
        });
    };
}
