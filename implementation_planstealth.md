# 🥷 Stealth Mode & Persistence Implementation Plan

The goal is to modify the Rust agent so that when it is executed, it hides itself, establishes persistence (survives reboots), and runs invisibly in the background. We must also provide a mechanism for the user to easily find and delete it.

## ⚠️ User Review Required

> [!WARNING]
> This upgrade implements actual persistence techniques used by malware and EDR systems. The agent will copy itself to a hidden location and edit macOS configuration files. This is safe, but you must know how to remove it.

## Proposed Changes

### 1. The Stealth Mechanics (macOS Focus)
Since you are on a Mac, we will implement macOS-specific stealth:
- **Relocation & Hiding:** When run, the agent will instantly copy itself to a hidden folder: `~/.immunoorg/agent_daemon`.
- **Persistence (`launchd`):** It will create a hidden property list file at `~/Library/LaunchAgents/com.immunoorg.agent.plist`. This tells macOS to silently launch the hidden agent in the background every time you log in.
- **Daemonization:** If the agent detects it's not running from the hidden location, it will perform the install steps (hiding and persistence), launch the hidden version, and then *immediately terminate the visible version*.

### 2. File: `rust-agent/src/main.rs`
#### [MODIFY] [main.rs](file:///Users/pranavadithya/Desktop/ImmunoOrg-V2-Final/immunoorg-v2/rust-agent/src/main.rs)
- Add a new function `setup_stealth_persistence()`.
- Check `env::current_exe()` to see if we are running from `~/.immunoorg/agent_daemon`.
- If NO: Copy ourselves to that location, create the `.plist` file, run the new hidden binary via `std::process::Command`, and exit `0`.
- If YES: Proceed with the normal EDR monitoring loops.

### 3. The Uninstaller (Kill Switch)
We need a simple script that you can run to instantly eradicate the agent.
#### [NEW] [uninstall_agent.sh](file:///Users/pranavadithya/Desktop/ImmunoOrg-V2-Final/immunoorg-v2/uninstall_agent.sh)
A bash script that:
1. Unloads the LaunchAgent: `launchctl unload ~/Library/LaunchAgents/com.immunoorg.agent.plist`
2. Kills the process: `pkill -f agent_daemon`
3. Deletes the hidden binaries: `rm -rf ~/.immunoorg`
4. Deletes the plist: `rm ~/Library/LaunchAgents/com.immunoorg.agent.plist`

## Verification Plan
1. Compile the agent using `cargo build --release`.
2. Move the `rust-agent` binary to your Desktop and double-click it.
3. Verify the terminal window closes immediately, but the agent appears online in the React Dashboard.
4. Run the `uninstall_agent.sh` script and verify the agent drops off the dashboard.
