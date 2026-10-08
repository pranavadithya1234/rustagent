#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use chrono::Utc;
use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Read, Write};
use std::path::Path;
use std::sync::mpsc::channel;
use std::sync::Arc;
use std::time::Duration;
use sysinfo::System;
use tokio::sync::Mutex;
use tokio::time::sleep;

const TELEMETRY_FLUSH_INTERVAL_MS: u64 = 1000;
const PROCESS_SCAN_INTERVAL_MS: u64 = 2000;
const COMMAND_POLL_INTERVAL_MS: u64 = 500;
const HEARTBEAT_INTERVAL_SECS: u64 = 30;

#[derive(Clone)]
struct ProcessSnapshot {
    name: String,
    path: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct TelemetryPayload {
    agent_id: String,
    hostname: Option<String>,
    os_name: Option<String>,
    timestamp: String,
    event_type: String,
    file_path: Option<String>,
    file_hash: Option<String>,
    process_info: Option<ProcessInfo>,
    message: String,
    parent_process: Option<String>,
    pid: Option<u32>,
    processes: Option<Vec<DetailedProcess>>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct DetailedProcess {
    pid: u32,
    name: String,
    path: Option<String>,
    cpu: f32,
    mem: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ProcessInfo {
    total_processes: usize,
    cpu_usage: f32,
    memory_usage: u64,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct QueuedEvent {
    payload: TelemetryPayload,
    retries: u8,
}

#[derive(Deserialize, Debug)]
struct RegisterResponse {
    token: String,
}

#[derive(Deserialize, Debug)]
struct CommandResponse {
    #[serde(rename = "status")]
    _status: String,
    command: Option<AgentCommand>,
}

#[derive(Deserialize, Debug)]
struct AgentCommand {
    action: String,
    pid: Option<String>,
    process_name: Option<String>,
    process_path: Option<String>,
}

const QUEUE_FILE_NAME: &str = "agent_queue.jsonl";

#[cfg(target_os = "macos")]
const AGENT_BINARY_NAME: &str = "immunoorg_agent";
#[cfg(target_os = "macos")]
const AGENT_LABEL: &str = "com.immunoorg.agent";

#[cfg(windows)]
const AGENT_BINARY_NAME: &str = "immunoorg_agent.exe";
#[cfg(windows)]
const AGENT_LABEL: &str = "ImmunoOrg Security Agent";

#[cfg(not(any(target_os = "macos", windows)))]
const AGENT_BINARY_NAME: &str = "immunoorg_agent";
#[cfg(not(any(target_os = "macos", windows)))]
const AGENT_LABEL: &str = "com.immunoorg.agent";

fn get_agent_dir() -> std::path::PathBuf {
    dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from(".")).join(".immunoorg")
}

fn ensure_transparent_persistence() -> Result<(), Box<dyn std::error::Error>> {
    let agent_dir = get_agent_dir();
    if !agent_dir.exists() {
        fs::create_dir_all(&agent_dir)?;
    }

    let current_exe = std::env::current_exe()?;
    let target_exe = agent_dir.join(AGENT_BINARY_NAME);

    // If we are NOT running from the persistent directory, install and relaunch
    if current_exe != target_exe {
        println!("🛡️ Installing ImmunoOrg Agent to background service...");
        
        // 1. Copy to legitimate identity
        fs::copy(&current_exe, &target_exe)?;

        // 2. Platform-Specific Persistence
        #[cfg(target_os = "macos")]
        {
            let log_path = agent_dir.join("agent.log");
            let plist_content = format!(
                r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{}</string>
    <key>ProgramArguments</key>
    <array>
        <string>{}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>{}</string>
    <key>StandardErrorPath</key>
    <string>{}</string>
</dict>
</plist>"#,
                AGENT_LABEL,
                target_exe.to_string_lossy(),
                log_path.to_string_lossy(),
                log_path.to_string_lossy()
            );

            let launch_agents_dir = dirs::home_dir().ok_or("Home dir not found")?.join("Library/LaunchAgents");
            if !launch_agents_dir.exists() {
                fs::create_dir_all(&launch_agents_dir)?;
            }
            let plist_name = format!("{}.plist", AGENT_LABEL);
            let plist_path = launch_agents_dir.join(plist_name);
            fs::write(&plist_path, plist_content)?;

            // Load the agent immediately
            let _ = std::process::Command::new("launchctl")
                .arg("unload")
                .arg(&plist_path)
                .output(); // Try to unload first if exists
            
            let _ = std::process::Command::new("launchctl")
                .arg("load")
                .arg(&plist_path)
                .output();
        }

        #[cfg(windows)]
        {
            use winreg::enums::*;
            use winreg::RegKey;

            let hkcu = RegKey::predef(HKEY_CURRENT_USER);
            let path = r"Software\Microsoft\Windows\CurrentVersion\Run";
            let (key, _) = hkcu.create_subkey(path)?;
            key.set_value(AGENT_LABEL, &target_exe.to_string_lossy().as_ref())?;
        }

        // 3. Relaunch from persistent location
        std::process::Command::new(&target_exe)
            .spawn()?;

        println!("✅ Agent installed and running in background mode as {}.", AGENT_BINARY_NAME);
        std::process::exit(0);
    }

    Ok(())
}

fn calculate_hash(path: &Path) -> Result<String, std::io::Error> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0; 1024];
    loop {
        let n = file.read(&mut buffer)?;
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }
    Ok(hasher.finalize().iter().map(|b| format!("{:02x}", b)).collect())
}

fn app_bundle_root(path: &str) -> Option<String> {
    if let Some(idx) = path.find(".app/") {
        return Some(path[..idx + 4].to_string());
    }
    if path.ends_with(".app") {
        return Some(path.to_string());
    }
    None
}

fn add_descendant_pids(sys: &System, targets: &mut HashSet<u32>) {
    loop {
        let mut changed = false;

        for (pid, process) in sys.processes() {
            if let Some(parent) = process.parent() {
                if targets.contains(&parent.as_u32()) && targets.insert(pid.as_u32()) {
                    changed = true;
                }
            }
        }

        if !changed {
            break;
        }
    }
}

fn kill_pid(sys: &mut System, pid: u32) -> Result<(), String> {
    let s_pid = sysinfo::Pid::from_u32(pid);
    
    // Check if process exists in our current snapshot
    if let Some(process) = sys.process(s_pid) {
        if process.kill() {
            println!("🚀 Successfully killed PID {}", pid);
            return Ok(());
        }
    }
    
    // If not found or kill failed, try one targeted refresh
    sys.refresh_processes(sysinfo::ProcessesToUpdate::Some(&[s_pid]), true);
    if let Some(process) = sys.process(s_pid) {
        if process.kill() {
            println!("🚀 Successfully killed PID {} after refresh", pid);
            return Ok(());
        }
    }

    // On Windows, if native kill fails, it might be already gone
    #[cfg(windows)]
    {
        // One final check - if it's gone from the system entirely
        if sys.process(s_pid).is_none() {
             return Ok(());
        }
    }

    Err("Process not found or permission denied".to_string())
}

fn terminate_process_group(pid: &str, process_path: Option<&String>, process_name: Option<&String>) -> String {
    let requested_pid = match pid.parse::<u32>() {
        Ok(parsed) => parsed,
        Err(_) => return format!("Failed to kill process {}: invalid PID", pid),
    };

    let mut sys = System::new_all();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);

    let mut targets = HashSet::new();
    targets.insert(requested_pid);
    add_descendant_pids(&sys, &mut targets);

    let bundle_root = process_path
        .and_then(|path| app_bundle_root(path))
        .or_else(|| {
            sys.processes()
                .iter()
                .find(|(proc_pid, _)| proc_pid.as_u32() == requested_pid)
                .and_then(|(_, process)| process.exe())
                .and_then(|path| app_bundle_root(&path.to_string_lossy()))
        });

    if let Some(root) = &bundle_root {
        for (proc_pid, process) in sys.processes() {
            if let Some(exe) = process.exe() {
                if exe.to_string_lossy().starts_with(root) {
                    targets.insert(proc_pid.as_u32());
                }
            }
        }
    }

    let current_pid = std::process::id();
    targets.remove(&current_pid);

    let mut target_list: Vec<u32> = targets.into_iter().collect();
    target_list.sort_unstable_by(|a, b| b.cmp(a));

    let mut killed = Vec::new();
    let mut failed = Vec::new();

    for target_pid in target_list {
        match kill_pid(&mut sys, target_pid) {
            Ok(()) => killed.push(target_pid),
            Err(err) => failed.push(format!("{} ({})", target_pid, err)),
        }
    }

    let label = bundle_root
        .or_else(|| process_name.cloned())
        .unwrap_or_else(|| "selected process group".to_string());

    if killed.is_empty() {
        return format!("Failed to kill process {}: {}", requested_pid, failed.join("; "));
    }

    if failed.is_empty() {
        return format!(
            "Successfully killed process {} and related processes: terminated {} process(es) for {}",
            requested_pid,
            killed.len(),
            label
        );
    }

    format!(
        "Successfully killed process {} and related processes: terminated {} process(es) for {}; failed: {}",
        requested_pid,
        killed.len(),
        label,
        failed.join("; ")
    )
}

async fn register_agent(client: &Client, base_url: &str, agent_id: &str, hostname: Option<String>, os_name: Option<String>) -> Result<String, String> {
    let url = format!("{}/api/register", base_url);
    let body = serde_json::json!({
        "agent_id": agent_id,
        "hostname": hostname,
        "os_name": os_name
    });

    match client.post(&url).json(&body).send().await {
        Ok(res) if res.status().is_success() => {
            if let Ok(parsed) = res.json::<RegisterResponse>().await {
                return Ok(parsed.token);
            }
        }
        Ok(res) => return Err(format!("Server returned: {}", res.status())),
        Err(e) => return Err(e.to_string()),
    }
    Err("Unknown registration error".into())
}

// Global queue manager
struct QueueManager {
    queue: Vec<QueuedEvent>,
}

impl QueueManager {
    fn new() -> Self {
        let mut q = Self { queue: Vec::new() };
        q.load();
        q
    }

    fn push(&mut self, payload: TelemetryPayload) {
        self.queue.push(QueuedEvent { payload, retries: 0 });
        // Removed self.save() from push to prevent CPU spikes and mutex blocking.
        // The sender task will handle persistence if needed.
    }

    fn load(&mut self) {
        let queue_file = get_agent_dir().join(QUEUE_FILE_NAME);
        if let Ok(file) = File::open(queue_file) {
            let reader = BufReader::new(file);
            for line in reader.lines().flatten() {
                if let Ok(event) = serde_json::from_str::<QueuedEvent>(&line) {
                    self.queue.push(event);
                }
            }
        }
    }

    fn save(&self) {
        let queue_file = get_agent_dir().join(QUEUE_FILE_NAME);
        if let Ok(mut file) = OpenOptions::new().create(true).write(true).truncate(true).open(queue_file) {
            for event in &self.queue {
                if let Ok(json) = serde_json::to_string(event) {
                    let _ = writeln!(file, "{}", json);
                }
            }
        }
    }
}

// Background persistence
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // 0. Transparent Persistence Check
    if let Err(e) = ensure_transparent_persistence() {
        eprintln!("⚠️ Background initialization failed: {}", e);
    }

    let hostname_str = System::host_name().unwrap_or_else(|| "Unknown-Host".to_string());
    let agent_id = format!("agent-{}", hostname_str.to_lowercase().split('.').next().unwrap_or("unknown"));
    println!("🛡️ Starting Rust Security Agent [ID: {}]", agent_id);

    let client = Client::new();
    let hostname = Some(hostname_str);
    let os_name = System::name();
    let base_url = std::env::var("BACKEND_URL").unwrap_or_else(|_| "http://localhost:4040".to_string());

    // 1. Identity Upgrade: Registration
    println!("🔄 Registering agent with backend...");
    let token = loop {
        match register_agent(&client, &base_url, &agent_id, hostname.clone(), os_name.clone()).await {
            Ok(t) => {
                println!("✅ Registered! Received JWT token.");
                break t;
            }
            Err(e) => {
                println!("⚠️ Registration failed: {}. Retrying in 5s...", e);
                sleep(Duration::from_secs(5)).await;
            }
        }
    };
    
    let token = Arc::new(token);
    let queue_manager = Arc::new(Mutex::new(QueueManager::new()));
    let is_isolated = Arc::new(Mutex::new(false));
    
    // Isolation Enforcement Task
    let is_isolated_enforce = is_isolated.clone();
    tokio::spawn(async move {
        loop {
            let isolated = {
                let lock = is_isolated_enforce.lock().await;
                *lock
            };

            if isolated {
                #[cfg(target_os = "macos")]
                {
                    // Show blocking popup
                    let _ = std::process::Command::new("osascript")
                        .arg("-e")
                        .arg(r#"display dialog "CRITICAL SECURITY BREACH DETECTED\n\nThis endpoint has been isolated by Cyber Command.\nAll network access and user interaction have been suspended.\n\nPlease contact IT Security immediately." with title "Security Isolation" with icon stop buttons {"System Locked"} default button "System Locked""#)
                        .spawn();
                    
                    // Suspend session (locks screen)
                    let _ = std::process::Command::new("/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession")
                        .arg("-suspend")
                        .output();
                }

                #[cfg(windows)]
                {
                    // Show popup
                    let _ = std::process::Command::new("msg")
                        .arg("*")
                        .arg("CRITICAL SECURITY BREACH DETECTED. This endpoint has been isolated by Cyber Command. Please contact IT.")
                        .spawn();

                    // Lock workstation
                    let _ = std::process::Command::new("rundll32.exe")
                        .arg("user32.dll,LockWorkStation")
                        .output();
                }
            }
            sleep(Duration::from_secs(10)).await;
        }
    });

    // Sender task that flushes queue
    let qm_clone = queue_manager.clone();
    let client_clone = client.clone();
    let token_clone = token.clone();
    let base_url_clone = base_url.clone();
    tokio::spawn(async move {
        let url = format!("{}/api/telemetry", base_url_clone);
        loop {
            sleep(Duration::from_millis(TELEMETRY_FLUSH_INTERVAL_MS)).await;
            let mut qm = qm_clone.lock().await;
            if qm.queue.is_empty() { continue; }
            
            let mut remaining = Vec::new();
            let mut changed = false;
            
            for mut event in qm.queue.drain(..) {
                match client_clone.post(&url)
                    .header("Authorization", format!("Bearer {}", token_clone))
                    .json(&event.payload)
                    .send().await {
                    Ok(res) if res.status().is_success() => {
                        changed = true; // Sent successfully, don't put back in remaining
                        println!("📤 Successfully sent queued event: {}", event.payload.event_type);
                    }
                    _ => {
                        event.retries += 1;
                        if event.retries <= 5 {
                            remaining.push(event); // keep it
                        } else {
                            println!("❌ Dropped event after 5 retries: {}", event.payload.event_type);
                            changed = true; // Dropped, so state changed
                        }
                    }
                }
            }
            
            qm.queue = remaining;
            if changed { qm.save(); }
        }
    });

    // Helper closure to enqueue telemetry
    let qm_for_helper = queue_manager.clone();
    let enqueue = move |payload: TelemetryPayload| {
        let qm = qm_for_helper.clone();
        tokio::spawn(async move {
            qm.lock().await.push(payload);
        });
    };

    // Self-integrity check
    let self_hash = std::env::current_exe().ok().and_then(|path| calculate_hash(&path).ok());
    if let Some(ref hash) = self_hash {
        println!("🔒 Agent Self-Integrity Hash: {}", hash);
    }

    // Startup heartbeat
    enqueue(TelemetryPayload {
        agent_id: agent_id.clone(),
        hostname: hostname.clone(),
        os_name: os_name.clone(),
        timestamp: Utc::now().to_rfc3339(),
        event_type: "AGENT_START".to_string(),
        file_path: std::env::current_exe().ok().map(|p| p.to_string_lossy().into_owned()),
        file_hash: self_hash,
        process_info: None,
        parent_process: None,
        message: "Agent started".to_string(),
        pid: None,
        processes: None,
    });

    // Full Process Snapshot task (Activity Monitor style)
    let agent_id_snap = agent_id.clone();
    let hostname_snap = hostname.clone();
    let os_name_snap = os_name.clone();
    let enqueue_snap = enqueue.clone();
    tokio::spawn(async move {
        let mut sys = System::new_all();
        loop {
            // Refresh process list and specific metrics
            sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
            
            let detailed_procs: Vec<DetailedProcess> = sys.processes()
                .iter()
                .map(|(pid, proc)| {
                    DetailedProcess {
                        pid: pid.as_u32(),
                        name: proc.name().to_string_lossy().into_owned(),
                        path: proc.exe().map(|p| p.to_string_lossy().into_owned()),
                        cpu: proc.cpu_usage(),
                        mem: proc.memory(),
                    }
                })
                .collect();

            enqueue_snap(TelemetryPayload {
                agent_id: agent_id_snap.clone(),
                hostname: hostname_snap.clone(),
                os_name: os_name_snap.clone(),
                timestamp: Utc::now().to_rfc3339(),
                event_type: "PROCESS_SNAPSHOT".to_string(),
                file_path: None,
                file_hash: None,
                process_info: None,
                parent_process: None,
                message: format!("Snapshot of {} processes", detailed_procs.len()),
                pid: None,
                processes: Some(detailed_procs),
            });

            sleep(Duration::from_secs(10)).await;
        }
    });

    // Process polling task
    let agent_id_proc = agent_id.clone();
    let hostname_proc = hostname.clone();
    let os_name_proc = os_name.clone();
    let enqueue_proc = enqueue.clone();
    tokio::spawn(async move {
        let mut sys = System::new_all();
        let mut known_processes: HashMap<u32, ProcessSnapshot> = HashMap::new();
        sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
        for (pid, process) in sys.processes() {
            let pid_u32 = pid.as_u32();
            let snapshot = ProcessSnapshot {
                name: process.name().to_string_lossy().into_owned(),
                path: process.exe().map(|p| p.to_string_lossy().into_owned()),
            };
            let parent_name = process.parent()
                .and_then(|ppid| sys.process(ppid))
                .map(|p| p.name().to_string_lossy().into_owned());

            enqueue_proc(TelemetryPayload {
                agent_id: agent_id_proc.clone(),
                hostname: hostname_proc.clone(),
                os_name: os_name_proc.clone(),
                timestamp: Utc::now().to_rfc3339(),
                event_type: "PROCESS_STARTED".to_string(),
                file_path: snapshot.path.clone(),
                file_hash: None,
                process_info: None,
                message: snapshot.name.clone(),
                parent_process: parent_name,
                pid: Some(pid_u32),
                processes: None,
            });

            known_processes.insert(pid_u32, snapshot);
        }

        loop {
            sleep(Duration::from_millis(PROCESS_SCAN_INTERVAL_MS)).await;
            sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
            let mut current_processes: HashMap<u32, ProcessSnapshot> = HashMap::new();

            for (pid, process) in sys.processes() {
                let pid_u32 = pid.as_u32();
                let snapshot = ProcessSnapshot {
                    name: process.name().to_string_lossy().into_owned(),
                    path: process.exe().map(|p| p.to_string_lossy().into_owned()),
                };

                if !known_processes.contains_key(&pid_u32) {
                    let parent_name = process.parent()
                        .and_then(|ppid| sys.process(ppid))
                        .map(|p| p.name().to_string_lossy().into_owned());

                    enqueue_proc(TelemetryPayload {
                        agent_id: agent_id_proc.clone(),
                        hostname: hostname_proc.clone(),
                        os_name: os_name_proc.clone(),
                        timestamp: Utc::now().to_rfc3339(),
                        event_type: "PROCESS_STARTED".to_string(),
                        file_path: snapshot.path.clone(),
                        file_hash: None,
                        process_info: None,
                        message: snapshot.name.clone(),
                        parent_process: parent_name,
                        pid: Some(pid_u32),
                        processes: None,
                    });
                }

                current_processes.insert(pid_u32, snapshot);
            }

            for (ended_pid, ended_process) in known_processes.iter() {
                if !current_processes.contains_key(ended_pid) {
                    enqueue_proc(TelemetryPayload {
                        agent_id: agent_id_proc.clone(),
                        hostname: hostname_proc.clone(),
                        os_name: os_name_proc.clone(),
                        timestamp: Utc::now().to_rfc3339(),
                        event_type: "PROCESS_ENDED".to_string(),
                        file_path: ended_process.path.clone(),
                        file_hash: None,
                        process_info: None,
                        message: ended_process.name.clone(),
                        parent_process: None,
                        pid: Some(*ended_pid),
                        processes: None,
                    });
                }
            }

            known_processes = current_processes;
        }
    });

    // Heartbeat task
    let agent_id_hb = agent_id.clone();
    let hostname_hb = hostname.clone();
    let os_name_hb = os_name.clone();
    let enqueue_hb = enqueue.clone();
    tokio::spawn(async move {
        let mut sys = System::new_all();
        loop {
            sleep(Duration::from_secs(HEARTBEAT_INTERVAL_SECS)).await;
            sys.refresh_all();
            enqueue_hb(TelemetryPayload {
                agent_id: agent_id_hb.clone(),
                hostname: hostname_hb.clone(),
                os_name: os_name_hb.clone(),
                timestamp: Utc::now().to_rfc3339(),
                event_type: "HEARTBEAT".to_string(),
                file_path: None,
                file_hash: None,
                process_info: Some(ProcessInfo {
                    total_processes: sys.processes().len(),
                    cpu_usage: sys.global_cpu_usage(),
                    memory_usage: sys.used_memory(),
                }),
                parent_process: None,
                message: "Heartbeat".to_string(),
                pid: None,
                processes: None,
            });
        }
    });

    // Command Polling Task
    let client_cmd = client.clone();
    let token_cmd = token.clone();
    let base_url_cmd = base_url.clone();
    let enqueue_cmd = enqueue.clone();
    let agent_id_cmd = agent_id.clone();
    let hostname_cmd = hostname.clone();
    let os_name_cmd = os_name.clone();
    let is_isolated_cmd = is_isolated.clone();

    tokio::spawn(async move {
        let url = format!("{}/api/commands", base_url_cmd);
        loop {
            sleep(Duration::from_millis(COMMAND_POLL_INTERVAL_MS)).await;
            
            match client_cmd.get(&url)
                .header("Authorization", format!("Bearer {}", token_cmd))
                .header("x-agent-id", agent_id_cmd.clone())
                .send().await {
                Ok(res) if res.status().is_success() => {
                    if let Ok(parsed) = res.json::<CommandResponse>().await {
                        if let Some(cmd) = parsed.command {
                            println!("⚡ Received Command from Dashboard: {:?}", cmd.action);
                            
                            let msg: String;

                            if cmd.action == "kill" {
                                if let Some(pid) = cmd.pid {
                                    println!("🔫 Terminating process group for PID {}", pid);
                                    msg = terminate_process_group(&pid, cmd.process_path.as_ref(), cmd.process_name.as_ref());
                                    if msg.starts_with("Successfully") {
                                        println!("✅ {}", msg);
                                    } else {
                                        println!("❌ {}", msg);
                                    }
                                } else {
                                    msg = "Kill command received without PID".to_string();
                                }
                            } else if cmd.action == "isolate" {
                                println!("🧱 Isolating Agent... (System Lockdown)");
                                {
                                    let mut lock = is_isolated_cmd.lock().await;
                                    *lock = true;
                                }
                                msg = "Agent Isolated Successfully (Lockdown Active)".to_string();
                            } else if cmd.action == "unisolate" {
                                println!("🔓 Restoring Agent Access...");
                                {
                                    let mut lock = is_isolated_cmd.lock().await;
                                    *lock = false;
                                }
                                msg = "Agent Access Restored Successfully".to_string();
                            } else if cmd.action == "attack_simulation" {
                                println!("🔥 Initiating Ransomware Simulation...");
                                msg = "Simulated Ransomware attack initiated".to_string();
                                
                                tokio::spawn(async move {
                                    let honeypot_dir = Path::new("../honeypot");
                                    if !honeypot_dir.exists() {
                                        let _ = fs::create_dir_all(honeypot_dir);
                                    }
                                    
                                    for i in 0..5 {
                                        let file_path = honeypot_dir.join(format!("simulated_ransomware_data_{}.txt", i));
                                        if let Ok(mut file) = File::create(&file_path) {
                                            let _ = file.write_all(b"YOUR FILES HAVE BEEN ENCRYPTED BY IMMUNOORG SIMULATOR!");
                                        }
                                        sleep(Duration::from_millis(500)).await;
                                    }
                                    println!("✅ Simulation Complete.");
                                });

                            } else {
                                msg = format!("Unknown action: {}", cmd.action);
                            }

                            // Send telemetry about the command execution
                            enqueue_cmd(TelemetryPayload {
                                agent_id: agent_id_cmd.clone(),
                                hostname: hostname_cmd.clone(),
                                os_name: os_name_cmd.clone(),
                                timestamp: Utc::now().to_rfc3339(),
                                event_type: "COMMAND_EXECUTED".to_string(),
                                file_path: None,
                                file_hash: None,
                                process_info: None,
                                parent_process: None,
                                message: msg,
                                pid: None,
                                processes: None,
                            });
                        }
                    }
                }
                _ => {}
            }
        }
    });

    // Multi-Path File Monitoring
    let mut watch_paths = vec![
        Path::new("../honeypot").to_path_buf(),
    ];

    // Add OS-specific critical paths
    if let Some(home) = dirs::home_dir() {
        watch_paths.push(home.join("Downloads"));
        watch_paths.push(home.join("Desktop"));
        watch_paths.push(home.join("Documents"));
    }
    
    // Add system-wide paths (may require sudo for some, but notify handles it gracefully)
    #[cfg(unix)]
    {
        watch_paths.push(Path::new("/tmp").to_path_buf());
        watch_paths.push(Path::new("/etc").to_path_buf());
    }

    let (tx, rx) = channel();
    let mut watcher = RecommendedWatcher::new(tx, Config::default())?;

    for path in &watch_paths {
        if path.exists() {
            match watcher.watch(path, RecursiveMode::Recursive) {
                Ok(_) => println!("👀 Monitoring directory: {:?}", path.canonicalize().unwrap_or(path.to_path_buf())),
                Err(e) => println!("⚠️ Failed to watch {:?}: {}", path, e),
            }
        }
    }

    let exclude_patterns = [
        "node_modules",
        ".git",
        "library/caches",
        ".ds_store",
        "target/debug",
        "target/release",
        "agent_queue.jsonl",
        ".cargo",
        ".db-journal",
        ".log",
        ".err",
        "jetski_recording",
        "ImmunoOrg-V2", // Exclude the project itself to prevent infinite recursive logging loops
        "RTRP",          // User research project whitelist
    ];

    loop {
        if let Ok(Ok(event)) = rx.recv() {
            let Event { kind, paths, .. } = event;
            let event_type_str = match kind {
                EventKind::Create(_) => "FILE_CREATED",
                EventKind::Modify(_) => "FILE_MODIFIED",
                EventKind::Remove(_) => "FILE_DELETED",
                _ => continue,
            };

            for path in paths {
                // Noise Filtering
                let path_str = path.to_string_lossy();
                if exclude_patterns.iter().any(|&pat| path_str.contains(pat)) {
                    continue;
                }

                // Ignore directory modifications to prevent noise on watched root paths
                if !path.is_file() && event_type_str != "FILE_DELETED" {
                    continue;
                }

                let mut hash = None;
                if kind != EventKind::Remove(notify::event::RemoveKind::Any) && path.is_file() {
                    // Small delay to ensure file is closed if it was just created/modified
                    std::thread::sleep(Duration::from_millis(100));
                    hash = calculate_hash(&path).ok();
                }

                println!("🚨 DETECTED: {} on {:?}", event_type_str, path);
                enqueue(TelemetryPayload {
                    agent_id: agent_id.clone(),
                    hostname: hostname.clone(),
                    os_name: os_name.clone(),
                    timestamp: Utc::now().to_rfc3339(),
                    event_type: event_type_str.to_string(),
                    file_path: Some(path.to_string_lossy().into_owned()),
                    file_hash: hash,
                    process_info: None,
                    parent_process: None,
                    message: format!("{:?}", kind),
                    pid: None,
                    processes: None,
                });
            }
        }
    }
}
