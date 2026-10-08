#!/bin/bash

echo "🚨 INITIATING AGENT ERADICATION..."

# 1. Unload the LaunchAgent to stop it from restarting
PLIST_PATH="$HOME/Library/LaunchAgents/com.immunoorg.agent.plist"
if [ -f "$PLIST_PATH" ]; then
    echo "-> Unloading persistence daemon..."
    launchctl unload -w "$PLIST_PATH" 2>/dev/null
    rm "$PLIST_PATH"
    echo "   ✅ Persistence removed."
else
    echo "   ℹ️ No persistence daemon found."
fi

# 2. Kill any running instances of the hidden agent
echo "-> Terminating active agent processes..."
pkill -f "agent_daemon" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "   ✅ Active processes terminated."
else
    echo "   ℹ️ No active processes found."
fi

# 3. Delete the hidden binaries and queue files
HIDDEN_DIR="$HOME/.immunoorg"
if [ -d "$HIDDEN_DIR" ]; then
    echo "-> Eradicating hidden files..."
    rm -rf "$HIDDEN_DIR"
    echo "   ✅ Files eradicated."
else
    echo "   ℹ️ No hidden files found."
fi

echo ""
echo "✅ IMMUNOORG AGENT COMPLETELY UNINSTALLED."
echo "Your Mac is clean."
