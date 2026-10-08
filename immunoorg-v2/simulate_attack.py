import time
import os
import multiprocessing
import socket
import threading

HONEYPOT_DIR = os.path.join(os.path.dirname(__file__), 'honeypot')

def simulate_file_tampering():
    print("🔥 [HACKER] Modifying files in honeypot directory...")
    for i in range(5):
        filepath = os.path.join(HONEYPOT_DIR, f'stolen_data_{i}.txt')
        with open(filepath, 'w') as f:
            f.write("You have been compromised!")
        time.sleep(0.5)

def burn_cpu():
    while True:
        pass

def simulate_cpu_spike():
    print("🔥 [HACKER] Launching cryptojacker (consuming CPU)...")
    # Start a few processes to spike CPU usage
    procs = []
    for _ in range(multiprocessing.cpu_count()):
        p = multiprocessing.Process(target=burn_cpu)
        p.start()
        procs.append(p)
    time.sleep(5) # Burn for 5 seconds
    for p in procs:
        p.terminate()

def simulate_network_scan():
    print("🔥 [HACKER] Launching rapid network port scan...")
    sockets = []
    # Open 250 sockets to trigger the >200 threshold
    for i in range(250):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            # Connecting to a public DNS server just to keep socket open
            s.setblocking(False)
            s.connect_ex(('8.8.8.8', 53))
            sockets.append(s)
        except Exception:
            pass
    time.sleep(3)
    for s in sockets:
        s.close()

if __name__ == '__main__':
    print("==================================")
    print("   CYBER ATTACK SIMULATOR 9000    ")
    print("==================================")
    print("Targeting Endpoint Agent...")
    time.sleep(2)
    
    simulate_file_tampering()
    time.sleep(2)
    
    simulate_network_scan()
    time.sleep(2)
    
    # Simulate CPU Spike last because it hangs the system
    simulate_cpu_spike()
    
    print("✅ Attack sequence complete.")
