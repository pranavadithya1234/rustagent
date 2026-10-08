const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Database Setup
const dbPath = path.join(__dirname, 'telemetry.db');
const db = new Database(dbPath);

// Initialize DB Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT,
    timestamp TEXT,
    event_type TEXT,
    file_path TEXT,
    file_hash TEXT,
    cpu_usage REAL,
    memory_usage INTEGER,
    message TEXT,
    processes TEXT
  );
  
  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT,
    timestamp TEXT,
    severity TEXT,
    alert_type TEXT,
    description TEXT
  );
`);

// Prepared statements for DB inserts
const insertTelemetry = db.prepare(`
  INSERT INTO telemetry (agent_id, timestamp, event_type, file_path, file_hash, cpu_usage, memory_usage, message, processes)
  VALUES (@agent_id, @timestamp, @event_type, @file_path, @file_hash, @cpu_usage, @memory_usage, @message, @processes)
`);

const insertAlert = db.prepare(`
  INSERT INTO alerts (agent_id, timestamp, severity, alert_type, description)
  VALUES (@agent_id, @timestamp, @severity, @alert_type, @description)
`);

// Fleet Manager: Track active agents
const activeAgents = new Map();

// In-memory state for fast WebSocket broadcast
let systemState = {
  fleetCpuAverage: 0,
  networkConnections: 0,
  threats: []
};

// Helper to broadcast fleet state
function broadcastFleetState() {
  const agentsArray = Array.from(activeAgents.values());
  let totalCpu = 0;
  agentsArray.forEach(agent => totalCpu += (agent.cpu_usage || 0));
  
  systemState.fleetCpuAverage = agentsArray.length > 0 ? (totalCpu / agentsArray.length) : 0;
  
  console.log(`[FLEET] Broadcasting update for ${agentsArray.length} agents`);
  io.emit('state_update', systemState);
  io.emit('agents_update', agentsArray);
}

// ---------------------------------------------------------------------------
// 1. INGESTION API (Receives data from Rust Agent)
// ---------------------------------------------------------------------------
app.post('/api/telemetry', (req, res) => {
  const data = req.body;
  console.log(`[TELEMETRY] Received ${data.event_type} from ${data.agent_id}`);
  
  console.log(`[API] Received ${data.event_type} from Agent ${data.agent_id}`);
  
  // Store telemetry in Database
  insertTelemetry.run({
    agent_id: data.agent_id,
    timestamp: data.timestamp,
    event_type: data.event_type,
    file_path: data.file_path || null,
    file_hash: data.file_hash || null,
    cpu_usage: data.process_info ? data.process_info.cpu_usage : null,
    memory_usage: data.process_info ? data.process_info.memory_usage : null,
    message: data.message || '',
    processes: data.processes ? JSON.stringify(data.processes) : null
  });

  // Register or Update Agent in Fleet Manager
  let agent = activeAgents.get(data.agent_id);
  if (!agent) {
    // Deduplicate by hostname to prevent ghost endpoints
    for (const [id, a] of activeAgents.entries()) {
      if (a.hostname === (data.hostname || 'Unknown Device') && a.hostname !== 'Unknown Device') {
        activeAgents.delete(id);
      }
    }

    agent = {
      id: data.agent_id,
      hostname: data.hostname || 'Unknown Device',
      os_name: data.os_name || 'Unknown OS',
      status: 'ONLINE',
      cpu_usage: 0,
      memory_usage: 0
    };
    activeAgents.set(data.agent_id, agent);
  }

  agent.lastSeen = Date.now();
  
  // Update metrics if provided
  if (data.process_info) {
    agent.cpu_usage = data.process_info.cpu_usage;
    agent.memory_usage = data.process_info.memory_usage;
  } else if (data.processes) {
    // If it's a snapshot, we can calculate total CPU from the processes
    let totalCpu = 0;
    let totalMem = 0;
    data.processes.forEach(p => {
      totalCpu += (p.cpu || 0);
      totalMem += (p.mem || 0);
    });
    agent.cpu_usage = totalCpu;
    agent.memory_usage = totalMem;
  }

  broadcastFleetState();

  // Basic Rule Engine (Detection)
  if (data.event_type === 'HEARTBEAT' && data.process_info) {
      // SOAR Example: CPU > 90%
      if (data.process_info.cpu_usage > 90) {
          triggerAlert(data.agent_id, 'HIGH', 'resource_spike', `Abnormal CPU usage detected (>90%) on ${data.hostname}. Possible cryptominer.`);
      }
  }

  // File Event Detection
  if (data.event_type === 'FILE_CREATED' || data.event_type === 'FILE_MODIFIED') {
      triggerAlert(data.agent_id, 'CRITICAL', 'file_integrity', `Suspicious file activity at ${data.file_path}. Hash: ${data.file_hash}`);
  }

  res.status(200).json({ status: "success" });
});

// ---------------------------------------------------------------------------
// 1.1. AGENT REGISTRATION API (Required by Identity Upgrade)
// ---------------------------------------------------------------------------
app.post('/api/register', (req, res) => {
  const { agent_id, hostname, os_name } = req.body;
  
  console.log(`[API] Registering Agent: ${agent_id} (${hostname})`);
  
  // Deduplicate by hostname to prevent ghost endpoints
  for (const [id, agent] of activeAgents.entries()) {
    if (agent.hostname === hostname && hostname !== 'Unknown Device') {
      activeAgents.delete(id);
    }
  }

  activeAgents.set(agent_id, {
    id: agent_id,
    hostname: hostname || 'Unknown Device',
    os_name: os_name || 'Unknown OS',
    lastSeen: Date.now(),
    cpu_usage: 0,
    memory_usage: 0,
    status: 'ONLINE'
  });

  broadcastFleetState();

  // Return a mock token (the agent expects a string in "token" field)
  res.json({ token: "mock-jwt-token-for-reverted-backend" });
});

// ---------------------------------------------------------------------------
// 1.5. THREAT HUNTING API (Used by React Dashboard)
// ---------------------------------------------------------------------------
app.get('/api/alerts', (req, res) => {
  try {
    const alerts = db.prepare('SELECT * FROM alerts ORDER BY timestamp DESC LIMIT 100').all();
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 1.6. AGENT-SPECIFIC INSPECTION API
// ---------------------------------------------------------------------------

// Get latest processes for an agent
app.get('/api/agents/:id/processes', (req, res) => {
  const { id } = req.params;
  try {
    // In this simulation, we'll fetch from the telemetry table for that agent
    const row = db.prepare('SELECT processes FROM telemetry WHERE agent_id = ? AND processes IS NOT NULL ORDER BY timestamp DESC LIMIT 1').get(id);
    if (row) {
      res.json(JSON.parse(row.processes));
    } else {
      res.json([]);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get event history for an agent
app.get('/api/agents/:id/history', (req, res) => {
  const { id } = req.params;
  try {
    const telemetry = db.prepare('SELECT * FROM telemetry WHERE agent_id = ? ORDER BY timestamp DESC LIMIT 50').all(id);
    res.json(telemetry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// 1.7. AGENT COMMAND POLLING (Required by Rust Agent)
// ---------------------------------------------------------------------------

const commandQueue = new Map(); // agent_id -> [commands]

// Dashboard sends command to queue
app.post('/api/agents/:id/command', (req, res) => {
  const { id } = req.params;
  const { action, pid, process_name } = req.body;
  
  console.log(`[QUEUING] ${action.toUpperCase()} for Agent ${id}`);
  
  if (!commandQueue.has(id)) commandQueue.set(id, []);
  commandQueue.get(id).push({ action, pid, process_name });

  // Still broadcast for any websocket listeners (like UI debuggers)
  io.emit('agent_command', { target: id, action, pid, process_name });

  res.json({ status: "command_queued", target: id });
});

// Agent polls for commands
app.get('/api/commands', (req, res) => {
  const agent_id = req.query.agent_id || req.headers['x-agent-id'];
  if (!agent_id) return res.status(400).json({ error: "Missing agent_id" });

  const queue = commandQueue.get(agent_id);
  if (queue && queue.length > 0) {
    const command = queue.shift();
    console.log(`[POLLING] Agent ${agent_id} fetched command: ${command.action}`);
    res.json({ command });
  } else {
    res.json({ command: null });
  }
});

// Helper to trigger and broadcast alerts
function triggerAlert(agent_id, severity, type, description) {
    const timestamp = new Date().toISOString();
    
    // Save to Database
    insertAlert.run({
        agent_id: agent_id,
        timestamp: timestamp,
        severity: severity,
        alert_type: type,
        description: description
    });
    
    const threat = {
        id: Date.now(),
        type: type,
        message: description,
        time: timestamp,
        severity: severity
    };
    
    systemState.threats.push(threat);
    if(systemState.threats.length > 20) systemState.threats.shift();
    
    // Broadcast alert to React UI
    io.emit('new_alert', threat);
}

// ---------------------------------------------------------------------------
// 2. DASHBOARD WEBSOCKET SERVER
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  console.log('Dashboard Client connected:', socket.id);

  // Send current state to new clients
  socket.emit('state_update', systemState);
  socket.emit('agents_update', Array.from(activeAgents.values()));

  // When the React Dashboard sends a command (e.g., Isolate)
  socket.on('dashboard_command', (data) => {
    console.log(`[COMMAND] Received from UI: ${data.action} targeting ${data.target}`);
    // In a full implementation, we would send this down to the specific Rust agent via WebSocket or Polling
    io.emit('agent_command', data);
  });

  socket.on('disconnect', () => {
    console.log('Dashboard Client disconnected:', socket.id);
  });
});

const PORT = 4040;
server.listen(PORT, () => {
  console.log(`🚀 Secure Backend API & WebSocket Server running on port ${PORT}`);
});
