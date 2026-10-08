import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';

const initialDepts = [
  { id: 'devops', name: 'DevOps', latency: 24, trust: 80 },
  { id: 'sec', name: 'Security', latency: 4, trust: 90 },
  { id: 'legal', name: 'Legal', latency: 72, trust: 40 },
  { id: 'hr', name: 'HR', latency: 48, trust: 60 },
];

export function useSimulationEngine() {
  const [gameState, setGameState] = useState('briefing');
  const [nodes, setNodes] = useState([]);
  const [departments, setDepartments] = useState(initialDepts);
  const [logs, setLogs] = useState([{ id: 1, text: 'Agent UI ready. Connect to backend.', type: 'info', time: new Date() }]);
  const [score, setScore] = useState(100);
  const [threatLevel, setThreatLevel] = useState(0);
  
  // Real-time telemetry
  const [telemetry, setTelemetry] = useState({ cpu: 0, connections: 0 });

  const addLog = useCallback((text, type = 'info') => {
    setLogs(prev => [...prev, { id: Date.now(), text, type, time: new Date() }]);
  }, []);

  useEffect(() => {
    if (gameState !== 'active') return;

    // Connect to WebSocket backend
    const socket = io('http://localhost:4040');

    socket.on('connect', () => {
      addLog('Connected to Cyber Command Server (Real-Time EDR Active)', 'success');
    });

    socket.on('state_update', (state) => {
      setTelemetry({ cpu: state.fleetCpuAverage, connections: state.networkConnections });
    });

    socket.on('agents_update', (agents) => {
      setNodes(prev => {
        const newNodes = [];
        
        agents.forEach(agent => {
          let idx = prev.findIndex(n => n.id === agent.id);
          // Match by hostname if ID changed, to preserve local state
          if (idx === -1 && agent.hostname && agent.hostname !== 'Unknown Device') {
            idx = prev.findIndex(n => n.hostname === agent.hostname);
          }
          
          if (idx === -1) {
            newNodes.push({
              id: agent.id,
              type: agent.os_name.toLowerCase().includes('windows') ? 'windows' : 'mac',
              name: agent.hostname,
              health: 100,
              infected: false,
              isolated: false,
              status: agent.status,
              cpu_usage: agent.cpu_usage || 0,
              memory_usage: agent.memory_usage || 0,
              os_name: agent.os_name,
              hostname: agent.hostname
            });
          } else {
            newNodes.push({
              ...prev[idx],
              id: agent.id, // Update to new ID
              status: agent.status,
              cpu_usage: agent.cpu_usage || 0,
              memory_usage: agent.memory_usage || 0,
              os_name: agent.os_name,
              hostname: agent.hostname
            });
          }
        });
        return newNodes;
      });
    });

    socket.on('new_alert', (alert) => {
      addLog(`[ALERT] ${alert.message}`, 'danger');
      setThreatLevel(lvl => Math.min(100, lvl + 20));
      setScore(s => s - 10); // Real attacks hurt score
      
      // Visually simulate nodes getting hit when attacks happen
      if (alert.type === 'file_integrity' || alert.type === 'resource_spike') {
        setNodes(prev => prev.map(n => {
          if (n.id === alert.agent_id) {
            return { ...n, infected: true, health: Math.max(0, n.health - 25) };
          }
          return n;
        }));
      }
    });

    return () => socket.disconnect();
  }, [gameState, addLog]);

  const startGame = useCallback(() => {
    setGameState('active');
    setNodes([]); // Nodes will be populated dynamically by connected agents
    setLogs([]);
    setScore(100);
    setThreatLevel(0);
    addLog('War Room activated. Awaiting telemetry from Endpoint Agent...', 'success');
  }, [addLog]);

  // Actions
  const isolateNode = (id) => {
    setNodes(prev => prev.map(n => {
      if (n.id === id) {
        addLog(`Tactical: Isolated ${n.name} from network. Transmitting kill signal...`, 'warning');
        
        // Connect temporarily to send command
        const socket = io('http://localhost:4040');
        socket.emit('dashboard_command', { action: 'isolate', target: n.type });
        setTimeout(() => socket.disconnect(), 1000);

        return { ...n, isolated: true, infected: false };
      }
      return n;
    }));
  };

  const patchNode = (id) => {
    setNodes(prev => prev.map(n => {
      if (n.id === id) {
        addLog(`Tactical: Patched and restored ${n.name}. Transmitting cleanup signal...`, 'success');
        
        // Connect temporarily to send command
        const socket = io('http://localhost:4040');
        socket.emit('dashboard_command', { action: 'patch', target: n.type });
        setTimeout(() => socket.disconnect(), 1000);

        return { ...n, isolated: false, health: 100 };
      }
      return n;
    }));
  };

  const restructureDept = (id) => {
    setDepartments(prev => prev.map(d => {
      if (d.id === id) {
        const newLatency = Math.max(2, Math.floor(d.latency * 0.5));
        addLog(`Strategic: Restructured ${d.name}. Latency reduced to ${newLatency}h.`, 'success');
        setScore(s => s + 20);
        return { ...d, latency: newLatency, trust: Math.max(100, d.trust + 10) };
      }
      return d;
    }));
  };

  return {
    gameState,
    nodes,
    departments,
    logs,
    score,
    threatLevel,
    telemetry,
    startGame,
    actions: { isolateNode, patchNode, restructureDept }
  };
}
