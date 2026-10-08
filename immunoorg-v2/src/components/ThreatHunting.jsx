import React, { useState, useEffect } from 'react';

export default function ThreatHunting() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:4040/api/alerts');
      const data = await res.json();
      setAlerts(data);
    } catch (err) {
      console.error("Error fetching alerts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // Refresh every 10 seconds
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="glass-panel" style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, color: 'var(--neon-cyan)' }}>THREAT HUNTING (HISTORICAL ALERTS)</h3>
        <button className="btn" onClick={fetchAlerts} style={{ padding: '8px 16px', fontSize: '12px' }}>
          REFRESH LOGS
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-secondary)' }}>Loading alerts from database...</div>
      ) : alerts.length === 0 ? (
        <div style={{ color: 'var(--text-secondary)' }}>No historical threats detected.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', textAlign: 'left', color: 'var(--text-secondary)' }}>
              <th style={{ padding: '12px 8px' }}>TIMESTAMP</th>
              <th style={{ padding: '12px 8px' }}>AGENT ID</th>
              <th style={{ padding: '12px 8px' }}>SEVERITY</th>
              <th style={{ padding: '12px 8px' }}>TYPE</th>
              <th style={{ padding: '12px 8px' }}>DESCRIPTION</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map(alert => (
              <tr key={alert.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>
                  {new Date(alert.timestamp).toLocaleString()}
                </td>
                <td style={{ padding: '12px 8px', fontFamily: 'monospace' }}>
                  {alert.agent_id.substring(0, 8)}...
                </td>
                <td style={{ 
                  padding: '12px 8px', 
                  color: alert.severity === 'CRITICAL' ? 'var(--neon-crimson)' : 
                         alert.severity === 'HIGH' ? 'var(--neon-amber)' : 'var(--neon-cyan)',
                  fontWeight: 'bold'
                }}>
                  {alert.severity}
                </td>
                <td style={{ padding: '12px 8px', color: 'var(--text-primary)' }}>{alert.alert_type}</td>
                <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{alert.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
