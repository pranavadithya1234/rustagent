# Implementation Plan - The "Masquerading" Strategy

Implement the masquerading strategy for the security agent to hide it in plain sight by pretending to be a critical system component.

## Proposed Changes

### [rust-agent](file:///Users/pranavadithya/Desktop/ImmunoOrg-V2-Final/immunoorg-v2/rust-agent)

#### [MODIFY] [main.rs](file:///Users/pranavadithya/Desktop/ImmunoOrg-V2-Final/immunoorg-v2/rust-agent/src/main.rs)

1.  **Define OS-specific Stealth Identities**:
    *   Add constants or logic to determine the stealth binary name and display name/label based on the OS.
    *   **macOS**:
        *   Binary Name: `com.apple.sysmond.helper`
        *   Label: `com.apple.sysmond.helper`
        *   Stealth Directory: `~/Library/Application Support/com.apple.sysmond/` (or similar)
    *   **Windows**:
        *   Binary Name: `svchost_managed.exe`
        *   Display Name: `Windows Service Host Managed`
        *   Stealth Directory: `%APPDATA%\Microsoft\ServiceHost\` (or similar)

2.  **Update `ensure_stealth_persistence`**:
    *   Change `target_exe` calculation to use the OS-specific stealth binary name.
    *   Update the `.plist` generation (macOS) to use the new label and binary name.
    *   Update the Registry entry (Windows) to use the new display name and binary name.
    *   Ensure the stealth directory is created if it doesn't exist.

3.  **Update `get_stealth_dir`**:
    *   Modify `get_stealth_dir` to return a more "native-looking" path based on the OS.

## Verification Plan

### Automated Tests
- Build the Rust agent: `cargo build --release`
- Run the agent and verify it installs itself in the new stealth location with the fake name.
- Check persistence:
    - **macOS**: `launchctl list | grep sysmond` and check `~/Library/LaunchAgents/`
    - **Windows**: Check `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` for the fake entry.

### Manual Verification
- Verify the process name in Activity Monitor (macOS) or Task Manager (Windows).
- Verify the file path of the running process.
