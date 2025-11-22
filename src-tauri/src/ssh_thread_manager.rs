use std::sync::{Arc, Mutex, RwLock, Condvar};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::collections::HashMap;
use std::thread::{self, JoinHandle};
use std::time::{Duration, Instant};

use crate::types::{LovelyResResult, LovelyResError};

/// Thread-safe terminal session state
#[derive(Debug, Clone)]
pub enum TerminalThreadState {
    Starting,
    Running,
    Stopping,
    Stopped,
    Error(String),
}

/// Terminal thread handle with lifecycle management
pub struct TerminalThread {
    pub thread_id: String,
    pub handle: Option<JoinHandle<()>>,
    pub state: Arc<RwLock<TerminalThreadState>>,
    pub shutdown_signal: Arc<AtomicBool>,
    pub created_at: Instant,
    pub last_activity: Arc<Mutex<Instant>>,
}

impl TerminalThread {
    pub fn new(thread_id: String) -> Self {
        Self {
            thread_id,
            handle: None,
            state: Arc::new(RwLock::new(TerminalThreadState::Starting)),
            shutdown_signal: Arc::new(AtomicBool::new(false)),
            created_at: Instant::now(),
            last_activity: Arc::new(Mutex::new(Instant::now())),
        }
    }

    pub fn set_handle(&mut self, handle: JoinHandle<()>) {
        self.handle = Some(handle);
    }

    pub fn signal_shutdown(&self) {
        self.shutdown_signal.store(true, Ordering::Relaxed);
    }

    pub fn is_shutdown_requested(&self) -> bool {
        self.shutdown_signal.load(Ordering::Relaxed)
    }

    pub fn set_state(&self, new_state: TerminalThreadState) {
        *self.state.write().unwrap() = new_state;
    }

    pub fn get_state(&self) -> TerminalThreadState {
        self.state.read().unwrap().clone()
    }

    pub fn update_activity(&self) {
        *self.last_activity.lock().unwrap() = Instant::now();
    }

    pub fn is_stale(&self, timeout: Duration) -> bool {
        self.last_activity.lock().unwrap().elapsed() > timeout
    }
}

/// Thread-safe SSH connection pool
pub struct SSHConnectionPool {
    connections: Arc<RwLock<HashMap<String, Arc<Mutex<ssh2::Session>>>>>,
    connection_counter: AtomicU64,
    max_connections: usize,
}

impl SSHConnectionPool {
    pub fn new(max_connections: usize) -> Self {
        Self {
            connections: Arc::new(RwLock::new(HashMap::new())),
            connection_counter: AtomicU64::new(0),
            max_connections,
        }
    }

    pub fn add_connection(&self, session: ssh2::Session) -> LovelyResResult<String> {
        let mut connections = self.connections.write().unwrap();
        
        if connections.len() >= self.max_connections {
            return Err(LovelyResError::SSHError(
                "Maximum connection pool size reached".to_string()
            ));
        }

        let connection_id = format!("conn_{}", 
            self.connection_counter.fetch_add(1, Ordering::Relaxed));
        
        connections.insert(connection_id.clone(), Arc::new(Mutex::new(session)));
        Ok(connection_id)
    }

    pub fn get_connection(&self, connection_id: &str) -> Option<Arc<Mutex<ssh2::Session>>> {
        self.connections.read().unwrap().get(connection_id).cloned()
    }

    pub fn remove_connection(&self, connection_id: &str) -> bool {
        self.connections.write().unwrap().remove(connection_id).is_some()
    }

    pub fn get_connection_count(&self) -> usize {
        self.connections.read().unwrap().len()
    }
}

/// Thread-safe terminal thread manager
pub struct SSHThreadManager {
    threads: Arc<RwLock<HashMap<String, Arc<Mutex<TerminalThread>>>>>,
    connection_pool: Arc<SSHConnectionPool>,
    shutdown_all: Arc<AtomicBool>,
    cleanup_interval: Duration,
    thread_timeout: Duration,
    
    // Synchronization primitives
    cleanup_condvar: Arc<(Mutex<bool>, Condvar)>,
    cleanup_thread: Option<JoinHandle<()>>,
}

impl SSHThreadManager {
    pub fn new() -> Self {
        let manager = Self {
            threads: Arc::new(RwLock::new(HashMap::new())),
            connection_pool: Arc::new(SSHConnectionPool::new(50)), // Max 50 connections
            shutdown_all: Arc::new(AtomicBool::new(false)),
            cleanup_interval: Duration::from_secs(30),
            thread_timeout: Duration::from_secs(300), // 5 minutes
            cleanup_condvar: Arc::new((Mutex::new(false), Condvar::new())),
            cleanup_thread: None,
        };

        manager
    }

    /// Start the cleanup thread
    pub fn start_cleanup_thread(&mut self) {
        if self.cleanup_thread.is_some() {
            return; // Already started
        }

        let threads = self.threads.clone();
        let shutdown_all = self.shutdown_all.clone();
        let cleanup_interval = self.cleanup_interval;
        let thread_timeout = self.thread_timeout;
        let cleanup_condvar = self.cleanup_condvar.clone();

        let handle = thread::spawn(move || {
            while !shutdown_all.load(Ordering::Relaxed) {
                // Wait for cleanup interval or shutdown signal
                let (lock, cvar) = &*cleanup_condvar;
                let _guard = cvar.wait_timeout(
                    lock.lock().unwrap(),
                    cleanup_interval
                ).unwrap();

                if shutdown_all.load(Ordering::Relaxed) {
                    break;
                }

                // Cleanup stale threads
                Self::cleanup_stale_threads(&threads, thread_timeout);
            }
        });

        self.cleanup_thread = Some(handle);
    }

    /// Create and start a new terminal thread
    pub fn create_terminal_thread<F>(&self, terminal_id: String, thread_fn: F) -> LovelyResResult<()>
    where
        F: FnOnce(Arc<AtomicBool>) + Send + 'static,
    {
        let mut terminal_thread = TerminalThread::new(terminal_id.clone());
        let shutdown_signal = terminal_thread.shutdown_signal.clone();
        let state = terminal_thread.state.clone();

        // Create the thread
        let handle = thread::Builder::new()
            .name(format!("ssh-terminal-{}", terminal_id))
            .spawn(move || {
                // Set state to running
                *state.write().unwrap() = TerminalThreadState::Running;
                
                // Execute the thread function
                thread_fn(shutdown_signal);
                
                // Set state to stopped
                *state.write().unwrap() = TerminalThreadState::Stopped;
            })
            .map_err(|e| LovelyResError::SSHError(
                format!("Failed to create terminal thread: {}", e)
            ))?;

        terminal_thread.set_handle(handle);

        // Store the thread
        self.threads.write().unwrap().insert(
            terminal_id,
            Arc::new(Mutex::new(terminal_thread))
        );

        Ok(())
    }

    /// Get terminal thread by ID
    pub fn get_terminal_thread(&self, terminal_id: &str) -> Option<Arc<Mutex<TerminalThread>>> {
        self.threads.read().unwrap().get(terminal_id).cloned()
    }

    /// Stop a specific terminal thread
    pub fn stop_terminal_thread(&self, terminal_id: &str) -> LovelyResResult<()> {
        if let Some(thread_arc) = self.get_terminal_thread(terminal_id) {
            let mut terminal_thread = thread_arc.lock().unwrap();
            
            // Signal shutdown
            terminal_thread.signal_shutdown();
            terminal_thread.set_state(TerminalThreadState::Stopping);
            
            // Wait for thread to finish (with timeout)
            if let Some(handle) = terminal_thread.handle.take() {
                drop(terminal_thread); // Release lock before joining
                
                // Join with timeout
                let join_result = thread::spawn(move || {
                    handle.join()
                }).join();

                match join_result {
                    Ok(Ok(())) => {
                        println!("✅ Terminal thread {} stopped successfully", terminal_id);
                    }
                    Ok(Err(_)) => {
                        println!("⚠️ Terminal thread {} panicked during shutdown", terminal_id);
                    }
                    Err(_) => {
                        println!("⚠️ Failed to join terminal thread {}", terminal_id);
                    }
                }
            }

            // Remove from active threads
            self.threads.write().unwrap().remove(terminal_id);
            Ok(())
        } else {
            Err(LovelyResError::SSHError(
                format!("Terminal thread {} not found", terminal_id)
            ))
        }
    }

    /// Stop all terminal threads
    pub fn stop_all_threads(&self) {
        println!("🛑 Stopping all SSH terminal threads...");
        
        // Signal global shutdown
        self.shutdown_all.store(true, Ordering::Relaxed);
        
        // Signal shutdown to all threads
        let thread_ids: Vec<String> = {
            let threads = self.threads.read().unwrap();
            threads.keys().cloned().collect()
        };

        for thread_id in thread_ids {
            if let Err(e) = self.stop_terminal_thread(&thread_id) {
                println!("⚠️ Error stopping thread {}: {}", thread_id, e);
            }
        }

        // Wake up cleanup thread
        let (lock, cvar) = &*self.cleanup_condvar;
        *lock.lock().unwrap() = true;
        cvar.notify_one();

        println!("✅ All SSH terminal threads stopped");
    }

    /// Cleanup stale threads (internal)
    fn cleanup_stale_threads(
        threads: &Arc<RwLock<HashMap<String, Arc<Mutex<TerminalThread>>>>>,
        timeout: Duration
    ) {
        let mut stale_threads = Vec::new();
        
        // Identify stale threads
        {
            let threads_guard = threads.read().unwrap();
            for (thread_id, thread_arc) in threads_guard.iter() {
                if let Ok(terminal_thread) = thread_arc.try_lock() {
                    if terminal_thread.is_stale(timeout) {
                        stale_threads.push(thread_id.clone());
                    }
                }
            }
        }

        // Remove stale threads
        if !stale_threads.is_empty() {
            let mut threads_guard = threads.write().unwrap();
            for thread_id in stale_threads {
                if let Some(thread_arc) = threads_guard.remove(&thread_id) {
                    if let Ok(mut terminal_thread) = thread_arc.try_lock() {
                        terminal_thread.signal_shutdown();
                        terminal_thread.set_state(TerminalThreadState::Stopped);
                    }
                    println!("🧹 Cleaned up stale terminal thread: {}", thread_id);
                }
            }
        }
    }

    /// Get thread statistics
    pub fn get_thread_stats(&self) -> HashMap<String, (TerminalThreadState, Duration)> {
        let threads = self.threads.read().unwrap();
        threads
            .iter()
            .filter_map(|(id, thread_arc)| {
                thread_arc.try_lock().ok().map(|thread| {
                    let state = thread.get_state();
                    let age = thread.created_at.elapsed();
                    (id.clone(), (state, age))
                })
            })
            .collect()
    }

    /// Check if a terminal thread is healthy
    pub fn is_thread_healthy(&self, terminal_id: &str) -> bool {
        if let Some(thread_arc) = self.get_terminal_thread(terminal_id) {
            if let Ok(terminal_thread) = thread_arc.try_lock() {
                match terminal_thread.get_state() {
                    TerminalThreadState::Running => !terminal_thread.is_stale(self.thread_timeout),
                    _ => false,
                }
            } else {
                false
            }
        } else {
            false
        }
    }

    /// Add connection to pool
    pub fn add_connection(&self, session: ssh2::Session) -> LovelyResResult<String> {
        self.connection_pool.add_connection(session)
    }

    /// Get connection from pool
    pub fn get_connection(&self, connection_id: &str) -> Option<Arc<Mutex<ssh2::Session>>> {
        self.connection_pool.get_connection(connection_id)
    }

    /// Remove connection from pool
    pub fn remove_connection(&self, connection_id: &str) -> bool {
        self.connection_pool.remove_connection(connection_id)
    }
}

impl Drop for SSHThreadManager {
    fn drop(&mut self) {
        self.stop_all_threads();
        
        // Wait for cleanup thread to finish
        if let Some(handle) = self.cleanup_thread.take() {
            let _ = handle.join();
        }
    }
}
