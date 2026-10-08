import requests
import time
import json

BASE_URL = "http://localhost:4040/api"
AGENT_ID = "agent-pranavs-macbook-pro" # Change if needed

def send_telemetry(data):
    try:
        response = requests.post(f"{BASE_URL}/telemetry", json=data)
        print(f"Sent {data['event_type']}: {response.status_code}")
    except Exception as e:
        print(f"Error: {e}")

# 1. Start a suspicious process
send_telemetry({
    "agent_id": AGENT_ID,
    "event_type": "PROCESS_STARTED",
    "message": "nc",
    "file_path": "/usr/bin/nc",
    "pid": 12345
})

time.sleep(1)

# 2. Modify a critical file
send_telemetry({
    "agent_id": AGENT_ID,
    "event_type": "FILE_MODIFIED",
    "file_path": "/etc/hosts",
    "file_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
})
