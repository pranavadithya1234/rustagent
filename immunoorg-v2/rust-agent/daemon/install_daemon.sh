#!/bin/bash
set -e

# Build the release agent
echo "Building Rust Agent..."
cargo build --release

# Copy the binary to a system location
echo "Deploying binary to /usr/local/bin/"
sudo cp ../target/release/rust-agent /usr/local/bin/rust-agent
sudo chmod +x /usr/local/bin/rust-agent

# Create log files
echo "Setting up logs..."
sudo touch /var/log/immunoorg-agent.log
sudo touch /var/log/immunoorg-agent.err
sudo chmod 666 /var/log/immunoorg-agent.log
sudo chmod 666 /var/log/immunoorg-agent.err

# Load the daemon
echo "Installing launchd plist..."
sudo cp com.immunoorg.agent.plist /Library/LaunchDaemons/
sudo launchctl load -w /Library/LaunchDaemons/com.immunoorg.agent.plist

echo "✅ Agent successfully installed and running as a daemon."
echo "Check logs: tail -f /var/log/immunoorg-agent.log"
