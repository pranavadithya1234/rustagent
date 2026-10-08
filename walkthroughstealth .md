# 🥷 Stealth Mode Active

The ImmunoOrg Rust Agent has been upgraded to utilize advanced evasion and persistence mechanisms, mimicking the behavior of legitimate enterprise EDR and advanced threat actors.

## What has changed?
The agent now implements a **self-installation routine**. When executed, it no longer runs visibly in the terminal. Instead, it:
1. Detects if it is running from the hidden directory (`~/.immunoorg`).
2. If not, it copies itself to `~/.immunoorg/agent_daemon`.
3. It creates a `com.immunoorg.agent.plist` file in your `~/Library/LaunchAgents` directory.
4. It commands macOS to silently launch the hidden daemon.
5. It instantly terminates the visible version of itself so the user thinks the program just closed or crashed.

## How to Test the Stealth Agent
I have compiled the final release binary and placed it on your Desktop.

1. Go to your Desktop and locate the `rust-agent-stealth` file.
2. Open a terminal and run it: `./rust-agent-stealth` (or simply double-click it if macOS allows execution without quarantine).
3. **Observe:** The terminal command will exit *instantly* with no logs or output.
4. **Verify:** Check your React Dashboard. You will see the agent successfully pop up as "ONLINE", silently transmitting telemetry from the background!
5. **Persistence:** If you restart your Mac, the agent will automatically start itself back up without you having to run anything.

## How to Remove the Agent (The Kill Switch)
Because the agent is now actively hiding and persisting, you cannot just delete the file from your Desktop.

I have created an eradication script in the project root. When you want to completely wipe the agent and stop the background monitoring, run:

```bash
cd /Users/pranavadithya/Desktop/ImmunoOrg-V2-Final/immunoorg-v2
./uninstall_agent.sh
```

This script will forcefully stop the background process, delete the hidden binary, and remove the startup configuration.
