import React from 'react';
import { useSimulationEngine } from './hooks/useSimulationEngine';
import WarRoomDashboard from './components/WarRoomDashboard';

function App() {
  const engine = useSimulationEngine();

  if (engine.gameState === 'briefing') {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass-panel" style={{ maxWidth: '600px', padding: '40px', textAlign: 'center' }}>
          <h1 style={{ color: 'var(--neon-cyan)', marginBottom: '16px', fontSize: '32px' }}>
            IMMUNO<span style={{ color: 'var(--text-primary)' }}>ORG</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '32px', fontSize: '18px' }}>
            The Autonomous, Self-Healing Enterprise
          </p>
          
          <div style={{ textAlign: 'left', marginBottom: '40px', background: 'rgba(0,0,0,0.3)', padding: '20px', borderRadius: '8px' }}>
            <h3 style={{ marginBottom: '12px', color: 'var(--neon-amber)' }}>MISSION BRIEFING</h3>
            <p style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              You are the Chief Information Security Officer (CISO). A live cyber-attack is currently penetrating our outer defenses.
            </p>
            <ul style={{ fontSize: '14px', color: 'var(--text-secondary)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <li><strong>Tactical:</strong> Isolate infected nodes before they die. Patch them when safe.</li>
              <li><strong>Strategic:</strong> Bureaucracy is killing us. Restructure departments to lower approval latency.</li>
              <li><strong>Objective:</strong> Keep the network alive. Do not let all nodes fall.</li>
            </ul>
          </div>

          <button 
            className="btn btn-primary" 
            style={{ fontSize: '18px', padding: '12px 32px' }}
            onClick={engine.startGame}
          >
            LAUNCH WAR ROOM
          </button>
        </div>
      </div>
    );
  }

  return <WarRoomDashboard engine={engine} />;
}

export default App;
