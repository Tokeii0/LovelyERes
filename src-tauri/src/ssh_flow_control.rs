use ssh2::Channel;
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use std::io::{Write, ErrorKind};
use crate::types::{LovelyResResult, LovelyResError};

/// SSH Flow Control State
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FlowControlState {
    Normal,
    Throttled,
    Blocked,
    Draining,
}

/// Input buffer entry with metadata
#[derive(Debug, Clone)]
pub struct BufferedInput {
    pub data: Vec<u8>,
    pub timestamp: Instant,
    pub priority: InputPriority,
    pub retry_count: u32,
}

/// Input priority levels
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum InputPriority {
    Control = 0,    // Ctrl+C, Enter, etc.
    Navigation = 1, // Arrow keys, Home, End
    Normal = 2,     // Regular typing
    Bulk = 3,       // Paste operations
}

impl BufferedInput {
    pub fn new(data: Vec<u8>, priority: InputPriority) -> Self {
        Self {
            data,
            timestamp: Instant::now(),
            priority,
            retry_count: 0,
        }
    }

    pub fn is_stale(&self, timeout: Duration) -> bool {
        self.timestamp.elapsed() > timeout
    }

    pub fn increment_retry(&mut self) {
        self.retry_count += 1;
    }
}

/// Enhanced SSH Flow Control Manager
pub struct SSHFlowController {
    /// Input buffer with priority queue
    input_buffer: Arc<Mutex<VecDeque<BufferedInput>>>,
    
    /// Current flow control state
    flow_state: Arc<Mutex<FlowControlState>>,
    
    /// Window size tracking
    window_size: Arc<Mutex<u32>>,
    _initial_window_size: u32,
    
    /// Flow control metrics
    bytes_sent: Arc<Mutex<u64>>,
    bytes_acknowledged: Arc<Mutex<u64>>,
    
    /// Configuration
    max_buffer_size: usize,
    max_retry_count: u32,
    drain_timeout: Duration,
    _throttle_threshold: f32,
    
    /// Timing for adaptive backoff
    last_successful_write: Arc<Mutex<Instant>>,
    consecutive_failures: Arc<Mutex<u32>>,
}

impl SSHFlowController {
    pub fn new() -> Self {
        Self {
            input_buffer: Arc::new(Mutex::new(VecDeque::new())),
            flow_state: Arc::new(Mutex::new(FlowControlState::Normal)),
            window_size: Arc::new(Mutex::new(1024 * 1024)), // 1MB window size - 大幅增加
            _initial_window_size: 1024 * 1024,
            bytes_sent: Arc::new(Mutex::new(0)),
            bytes_acknowledged: Arc::new(Mutex::new(0)),
            max_buffer_size: 1024 * 1024, // 1MB buffer - 大幅增加
            max_retry_count: 100, // 增加重试次数
            drain_timeout: Duration::from_secs(3600), // 1小时超时
            _throttle_threshold: 0.99, // 几乎不限流
            last_successful_write: Arc::new(Mutex::new(Instant::now())),
            consecutive_failures: Arc::new(Mutex::new(0)),
        }
    }

    /// Queue input with priority
    pub fn queue_input(&self, data: Vec<u8>, priority: InputPriority) -> LovelyResResult<()> {
        let mut buffer = self.input_buffer.lock().unwrap();
        
        // Check buffer size limit
        if buffer.len() >= self.max_buffer_size {
            // Remove oldest low-priority items
            while buffer.len() >= self.max_buffer_size && !buffer.is_empty() {
                if let Some(front) = buffer.front() {
                    if front.priority >= InputPriority::Normal {
                        buffer.pop_front();
                    } else {
                        break;
                    }
                } else {
                    break;
                }
            }
            
            if buffer.len() >= self.max_buffer_size {
                return Err(LovelyResError::SSHError(
                    "Input buffer overflow - too much pending input".to_string()
                ));
            }
        }

        let input = BufferedInput::new(data, priority);
        
        // Insert based on priority (higher priority first)
        let mut insert_index = None;
        for (i, existing) in buffer.iter().enumerate() {
            if input.priority < existing.priority {
                insert_index = Some(i);
                break;
            }
        }

        if let Some(index) = insert_index {
            buffer.insert(index, input);
        } else {
            buffer.push_back(input);
        }

        Ok(())
    }

    /// Process buffered input with flow control
    pub fn process_input(&self, channel: &mut Channel) -> LovelyResResult<usize> {
        let mut total_written = 0;
        let mut buffer = self.input_buffer.lock().unwrap();
        
        // Check flow control state
        let flow_state = *self.flow_state.lock().unwrap();
        match flow_state {
            FlowControlState::Blocked => {
                // Don't process input when blocked
                return Ok(0);
            }
            FlowControlState::Draining => {
                // Only process high-priority input during draining
                buffer.retain(|input| input.priority <= InputPriority::Navigation);
            }
            _ => {}
        }

        let mut items_to_remove = Vec::new();
        
        for (index, input) in buffer.iter_mut().enumerate() {
            // Skip stale items
            if input.is_stale(self.drain_timeout) {
                items_to_remove.push(index);
                continue;
            }

            // Skip items that have exceeded retry count
            if input.retry_count >= self.max_retry_count {
                items_to_remove.push(index);
                continue;
            }

            // Check if we can write (window size check)
            if !self.can_write(input.data.len()) {
                self.set_flow_state(FlowControlState::Throttled);
                break;
            }

            // Attempt to write
            match self.write_with_flow_control(channel, &input.data) {
                Ok(bytes_written) => {
                    total_written += bytes_written;
                    items_to_remove.push(index);
                    
                    // Update success metrics
                    *self.last_successful_write.lock().unwrap() = Instant::now();
                    *self.consecutive_failures.lock().unwrap() = 0;
                    
                    // Update flow state to normal on success
                    if flow_state != FlowControlState::Normal {
                        self.set_flow_state(FlowControlState::Normal);
                    }
                }
                Err(e) => {
                    let error_msg = format!("{}", e);
                    
                    if error_msg.contains("draining incoming flow") {
                        // Server is draining - enter draining state
                        self.set_flow_state(FlowControlState::Draining);
                        input.increment_retry();
                        
                        // Implement exponential backoff
                        let backoff_ms = std::cmp::min(1000, 50 * (2_u64.pow(input.retry_count)));
                        std::thread::sleep(Duration::from_millis(backoff_ms));
                        
                        break; // Stop processing for now
                    } else if error_msg.contains("Would block") || error_msg.contains("EAGAIN") {
                        // Temporary blocking - throttle
                        self.set_flow_state(FlowControlState::Throttled);
                        input.increment_retry();
                        break;
                    } else if error_msg.contains("Broken pipe") || 
                              error_msg.contains("Connection reset") ||
                              error_msg.contains("sending on a closed channel") {
                        // Fatal error - remove all items
                        buffer.clear();
                        return Err(e);
                    } else {
                        // Other error - increment retry and continue
                        input.increment_retry();
                        *self.consecutive_failures.lock().unwrap() += 1;
                    }
                }
            }
        }

        // Remove processed items (in reverse order to maintain indices)
        for &index in items_to_remove.iter().rev() {
            buffer.remove(index);
        }

        Ok(total_written)
    }

    /// Write with flow control checks
    fn write_with_flow_control(&self, channel: &mut Channel, data: &[u8]) -> LovelyResResult<usize> {
        // Check window size before writing
        let available_window = self.get_available_window();
        if available_window == 0 {
            return Err(LovelyResError::SSHError(
                "SSH window full - flow control active".to_string()
            ));
        }

        let write_size = std::cmp::min(data.len(), available_window as usize);
        let chunk = &data[..write_size];

        match channel.write(chunk) {
            Ok(bytes_written) => {
                // Update bytes sent counter
                *self.bytes_sent.lock().unwrap() += bytes_written as u64;
                
                // Update window size (simplified - in real SSH, this would be updated by window adjust messages)
                let mut window = self.window_size.lock().unwrap();
                *window = window.saturating_sub(bytes_written as u32);
                
                Ok(bytes_written)
            }
            Err(e) => {
                match e.kind() {
                    ErrorKind::WouldBlock => {
                        Err(LovelyResError::SSHError("Would block".to_string()))
                    }
                    ErrorKind::BrokenPipe => {
                        Err(LovelyResError::SSHError("Broken pipe".to_string()))
                    }
                    _ => {
                        Err(LovelyResError::SSHError(format!("Write error: {}", e)))
                    }
                }
            }
        }
    }

    /// Check if we can write given the current window size
    fn can_write(&self, data_size: usize) -> bool {
        let available = self.get_available_window();
        available >= data_size as u32 && available > 0
    }

    /// Get available window size
    fn get_available_window(&self) -> u32 {
        let window = *self.window_size.lock().unwrap();
        let bytes_sent = *self.bytes_sent.lock().unwrap();
        let bytes_acked = *self.bytes_acknowledged.lock().unwrap();
        
        // Calculate effective window (simplified)
        let pending = bytes_sent.saturating_sub(bytes_acked) as u32;
        window.saturating_sub(pending)
    }

    /// Update window size (called when receiving window adjust messages)
    pub fn adjust_window(&self, additional_bytes: u32) {
        let mut window = self.window_size.lock().unwrap();
        *window = window.saturating_add(additional_bytes);
        
        // If window was blocked and now has space, update state
        if *window > 0 {
            let current_state = *self.flow_state.lock().unwrap();
            if current_state == FlowControlState::Blocked {
                self.set_flow_state(FlowControlState::Normal);
            }
        }
    }

    /// Set flow control state
    fn set_flow_state(&self, new_state: FlowControlState) {
        *self.flow_state.lock().unwrap() = new_state;
    }

    /// Get current flow control state
    pub fn get_flow_state(&self) -> FlowControlState {
        *self.flow_state.lock().unwrap()
    }

    /// Get buffer statistics
    pub fn get_buffer_stats(&self) -> (usize, usize, FlowControlState) {
        let buffer = self.input_buffer.lock().unwrap();
        let buffer_size = buffer.len();
        let high_priority_count = buffer.iter()
            .filter(|input| input.priority <= InputPriority::Navigation)
            .count();
        let flow_state = self.get_flow_state();
        
        (buffer_size, high_priority_count, flow_state)
    }

    /// Clear buffer (emergency cleanup)
    pub fn clear_buffer(&self) {
        self.input_buffer.lock().unwrap().clear();
        self.set_flow_state(FlowControlState::Normal);
    }

    /// Determine input priority based on data content
    pub fn classify_input_priority(data: &[u8]) -> InputPriority {
        if data.is_empty() {
            return InputPriority::Normal;
        }

        // Control characters (Ctrl+C, Enter, Backspace, Delete, Tab, etc.)
        if data.len() == 1 {
            match data[0] {
                0x03 | 0x04 | 0x1A => return InputPriority::Control, // Ctrl+C, Ctrl+D, Ctrl+Z
                0x0D | 0x0A => return InputPriority::Control,         // Enter
                0x7F | 0x08 => return InputPriority::Control,         // Backspace/Delete - 立即发送避免缓冲
                0x09 => return InputPriority::Control,                // Tab
                _ => {}
            }
        }

        // Escape sequences (arrow keys, function keys) - 提升为Control优先级以立即发送
        if data.starts_with(b"\x1b[") || data.starts_with(b"\x1bO") {
            return InputPriority::Control;
        }

        // Large data (paste operations)
        if data.len() > 100 {
            return InputPriority::Bulk;
        }

        InputPriority::Normal
    }
}
