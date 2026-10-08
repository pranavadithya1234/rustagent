import time
import os
import psutil
import socketio
import subprocess
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

# Connect to the central WebSockets Server
sio = socketio.Client()

@sio.on('agent_command')
def on_command(data):
    print(f"⚡ [COMMAND RECEIVED] {data['action']} target: {data['target']}")
    if data['action'] == 'isolate':
        print("Executing active response: Killing malicious Python processes...")
        # In a real EDR we would block IPs or kill specific PIDs.
        # Here we kill the simulate_attack.py script processes safely.
        try:
            # Find and kill processes burning CPU (our cryptojacker sim)
            # and the attack simulator script itself
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = proc.info.get('cmdline', [])
                    if cmdline and 'simulate_attack.py' in ' '.join(cmdline):
                        print(f"Terminating attacker script PID {proc.info['pid']}")
                        proc.kill()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
            
            sio.emit('agent_alert', {
                'type': 'system_response',
                'message': 'Active Response Executed: Malicious processes terminated successfully.'
            })
        except Exception as e:
            print(f"Failed to execute response: {e}")
            
    elif data['action'] == 'patch':
        print("Executing active response: Cleaning up honeypot directory...")
        try:
            for filename in os.listdir(HONEYPOT_DIR):
                file_path = os.path.join(HONEYPOT_DIR, filename)
                try:
                    if os.path.isfile(file_path):
                        os.unlink(file_path)
                except Exception as e:
                    print(f"Failed to delete {file_path}: {e}")
            
            sio.emit('agent_alert', {
                'type': 'system_response',
                'message': 'Active Patch Executed: Honeypot directory cleaned and restored.'
            })
        except Exception as e:
            print(f"Failed to execute patch: {e}")

HONEYPOT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'honeypot')
os.makedirs(HONEYPOT_DIR, exist_ok=True)

class HoneypotEventHandler(FileSystemEventHandler):
    def on_modified(self, event):
        if not event.is_directory:
            print(f"[FILE INTEGRITY] Modified: {event.src_path}")
            sio.emit('agent_alert', {
                'type': 'file_integrity',
                'message': f'Unauthorized modification detected in honeypot: {os.path.basename(event.src_path)}'
            })
            
    def on_deleted(self, event):
        if not event.is_directory:
            print(f"[FILE INTEGRITY] Deleted: {event.src_path}")
            sio.emit('agent_alert', {
                'type': 'file_integrity',
                'message': f'Unauthorized deletion detected in honeypot: {os.path.basename(event.src_path)}'
            })

def monitor_system():
    observer = Observer()
    observer.schedule(HoneypotEventHandler(), HONEYPOT_DIR, recursive=False)
    observer.start()
    
    print(f"Monitoring honeypot directory: {HONEYPOT_DIR}")
    
    try:
        while True:
            # 1. Check CPU Usage
            cpu_usage = psutil.cpu_percent(interval=1)
            if cpu_usage > 80.0:
                print(f"[RESOURCE SPIKE] CPU Usage: {cpu_usage}%")
                sio.emit('agent_alert', {
                    'type': 'resource_spike',
                    'message': f'Massive CPU spike detected: {cpu_usage}% (Possible cryptojacking/DoS)'
                })
                
            # 2. Check Network Connections
            try:
                conns = len(psutil.net_connections(kind='inet'))
            except psutil.AccessDenied:
                # macOS restricts global net_connections. We'll simulate or skip if access denied.
                # Just use process connections if global fails
                conns = len(psutil.Process().connections())
                
            if conns > 200: # Threshold for simulation
                print(f"[NETWORK ALERT] High connection count: {conns}")
                sio.emit('agent_alert', {
                    'type': 'network_scan',
                    'message': f'Unusual number of active network connections: {conns} (Possible port scan)'
                })
                
            # Emit general telemetry
            sio.emit('agent_telemetry', {
                'cpu': cpu_usage,
                'connections': conns
            })
            
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == '__main__':
    print("Starting Endpoint Security Agent...")
    try:
        sio.connect('http://localhost:4000')
        print("Connected to Cyber Command Server.")
        monitor_system()
    except Exception as e:
        print(f"Connection failed: {e}")
