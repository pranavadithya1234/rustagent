import React, { useState, useEffect, useCallback, useRef } from 'react';
import TechnicalGraph from './TechnicalGraph';
import TerminalLog from './TerminalLog';
import ThreatHunting from './ThreatHunting';
import DashboardHeader from './DashboardHeader';
import AgentDetailModal from './AgentDetailModal';
import { getProcessRows } from '../utils/processUtils';
import { ShieldAlert } from 'lucide-react';

export default function WarRoomDashboard({ engine }) {
  const [activeTab, setActiveTab] = useState('live');
  const { 
    gameState, nodes, departments, logs, score, threatLevel, tick, actions, telemetry 
  } = engine;

  // Local state for fetched agent details
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const selectedAgent = nodes.find(n => n.id === selectedAgentId) || null;
  const selectedAgentRef = useRef(null);
  const [agentProcesses, setAgentProcesses] = useState([]);
  const [agentHistory, setAgentHistory] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalTab, setModalTab] = useState('Processes');
  const [notification, setNotification] = useState(null);
  const [modalKey, setModalKey] = useState(0);

  // Stable callback for opening the modal — prevents re-render-induced closures
  const handleSelectAgent = useCallback((agent) => {
    selectedAgentRef.current = agent;
    setSelectedAgentId(agent.id);
    setModalKey(prev => prev + 1);
    setAgentProcesses([]);
    setAgentHistory([]);
    setSearchTerm('');
    setModalTab('Processes');
  }, []);

  const handleCloseModal = useCallback(() => {
    selectedAgentRef.current = null;
    setSelectedAgentId(null);
    setAgentProcesses([]);
    setAgentHistory([]);
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  // Fetch agent details when selected — uses ref to avoid re-triggering on re-renders
  useEffect(() => {
    if (!selectedAgentId) return;

    const agentId = selectedAgentId;
    let cancelled = false;

    const fetchDetails = async () => {
      // Double-check the modal is still open for this agent
      if (!selectedAgentRef.current || selectedAgentRef.current.id !== agentId) return;
      try {
        const [procRes, histRes] = await Promise.all([
          fetch(`http://localhost:4040/api/agents/${agentId}/processes`),
          fetch(`http://localhost:4040/api/agents/${agentId}/history`)
        ]);
        if (cancelled) return;
        const processes = await procRes.json();
        const history = await histRes.json();
        if (cancelled) return;
        setAgentProcesses(Array.isArray(processes) ? processes : []);
        setAgentHistory(Array.isArray(history) ? history : []);
      } catch (err) {
        console.error("Failed to fetch agent details:", err);
        // Don't close modal on fetch errors — just keep old data
      }
    };

    fetchDetails();
    const interval = setInterval(fetchDetails, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [selectedAgentId]);

  const handleKillProcess = async (pid) => {
    if (!selectedAgent) return;
    try {
      await fetch(`http://localhost:4040/api/agents/${selectedAgent.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'kill', pid: pid.toString() })
      });
      // Optimistic update
      setAgentProcesses(prev => prev.filter(p => p.pid !== pid));
      setNotification({ type: 'success', message: `Kill command sent for PID ${pid}` });
    } catch (err) {
      console.error("Kill command failed:", err);
      setNotification({ type: 'danger', message: `Failed to send kill command: ${err.message}` });
    }
  };

  const handleToggleIsolate = async () => {
    if (!selectedAgent) return;
    const action = selectedAgent.isolated ? 'unisolate' : 'isolate';
    try {
      await fetch(`http://localhost:4040/api/agents/${selectedAgent.id}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      // We rely on the simulation engine to update the 'nodes' list, 
      // but we can update local state too
      actions.isolateNode(selectedAgent.id);
      setNotification({ type: 'warning', message: `Isolation command queued for ${selectedAgent.hostname}` });
    } catch (err) {
      console.error("Isolation command failed:", err);
      setNotification({ type: 'danger', message: `Isolation failed: ${err.message}` });
    }
  };

  const filteredProcesses = getProcessRows(agentProcesses).filter(p => {
    try {
      const name = (p.name || '').toLowerCase();
      const pid = String(p.pid ?? '');
      const term = (searchTerm || '').toLowerCase();
      return name.includes(term) || pid.includes(searchTerm);
    } catch {
      return false;
    }
  });

  return (
    <div style={{ height: '100vh', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Top Bar HUD */}
      <DashboardHeader 
        activeEndpoints={nodes.length}
        totalCPU={telemetry?.cpu || 0}
        threatLevel={threatLevel > 50 ? 'CRITICAL' : threatLevel > 20 ? 'ELEVATED' : 'NORMAL'}
        securityScore={score}
      />

      <div className="flex items-center gap-4 mb-4">
        <h2 className="text-xl font-bold text-white uppercase tracking-widest">Cyber Command</h2>
        <div className="flex gap-2">
          <button 
            className={`btn ${activeTab === 'live' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('live')}
          >Live View</button>
          <button 
            className={`btn ${activeTab === 'hunting' ? 'btn-primary' : ''}`}
            onClick={() => setActiveTab('hunting')}
          >Threat Hunting</button>
        </div>
      </div>

      {activeTab === 'live' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gridTemplateRows: '2fr 1fr', gap: '20px', flex: 1, minHeight: 0 }}>
          
          {/* Top: Technical Network */}
          <div style={{ gridColumn: '1 / 2', gridRow: '1 / 2', minHeight: 0 }}>
            <TechnicalGraph 
              nodes={nodes} 
              onIsolate={actions.isolateNode} 
              onPatch={actions.patchNode} 
              onSelectNode={handleSelectAgent}
            />
          </div>

          {/* Bottom: Terminal Log */}
          <div style={{ gridColumn: '1 / 2', gridRow: '2 / 3', minHeight: 0 }}>
            <TerminalLog logs={logs} />
          </div>

        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }} className="glass-panel p-8 rounded-3xl overflow-y-auto">
          <ThreatHunting />
        </div>
      )}

      {/* Floating Tactical Notifications */}
      {notification && (
        <div 
          className={`fixed bottom-8 right-8 z-[250] p-5 rounded-2xl border shadow-2xl animate-in zoom-in-95 flex items-center gap-4 ${
            notification.type === 'danger' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
            notification.type === 'warning' ? 'bg-orange-500/10 border-orange-500/20 text-orange-400' :
            'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
          }`}
          style={{ minWidth: '300px', backdropFilter: 'blur(10px)' }}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            notification.type === 'danger' ? 'bg-red-500/20' :
            notification.type === 'warning' ? 'bg-orange-500/20' :
            'bg-emerald-500/20'
          }`}>
            <ShieldAlert size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Tactical Alert</p>
            <p className="text-sm font-bold text-white">{notification.message}</p>
          </div>
        </div>
      )}

      {/* Agent Detail Inspector Modal */}
      {selectedAgent && (
        <AgentDetailModal
          key={modalKey}
          agent={selectedAgent}
          onClose={handleCloseModal}
          isIsolated={selectedAgent.isolated}
          onToggleIsolate={handleToggleIsolate}
          onKillProcess={handleKillProcess}
          processes={filteredProcesses}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          activeTab={modalTab}
          onTabChange={setModalTab}
          history={agentHistory}
        />
      )}

      {/* Game Over Overlay */}
      {gameState === 'ended' && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
          <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', maxWidth: '500px' }}>
            <h1 style={{ color: 'var(--neon-crimson)', marginBottom: '16px' }}>NETWORK COMPROMISED</h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '32px' }}>
              The adversary successfully infected or forced isolation of all critical infrastructure nodes.
            </p>
            <div style={{ fontSize: '24px', marginBottom: '32px' }}>Final Score: {score}</div>
            <button className="btn btn-primary" onClick={engine.startGame}>
              REBOOT SIMULATION
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
