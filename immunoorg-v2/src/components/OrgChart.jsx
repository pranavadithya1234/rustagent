import React from 'react';

export default function OrgChart({ departments, onRestructure }) {
  return (
    <div className="glass-panel" style={{ padding: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <h3 style={{ marginBottom: '16px', color: 'var(--neon-amber)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        Organizational Structure
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto' }}>
        {departments.map(dept => (
          <div 
            key={dept.id}
            style={{
              padding: '12px',
              borderRadius: '8px',
              border: `1px solid rgba(255, 184, 0, ${dept.latency > 24 ? '0.5' : '0.1'})`,
              background: 'rgba(255, 184, 0, 0.05)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div>
              <div style={{ fontWeight: 500 }}>{dept.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Approval Latency: <span style={{ color: dept.latency > 24 ? 'var(--neon-crimson)' : 'var(--neon-amber)' }}>{dept.latency}h</span>
              </div>
            </div>
            
            <button 
              className="btn" 
              style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--neon-amber)', color: 'var(--neon-amber)' }}
              onClick={() => onRestructure(dept.id)}
              disabled={dept.latency <= 2}
            >
              Restructure
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
