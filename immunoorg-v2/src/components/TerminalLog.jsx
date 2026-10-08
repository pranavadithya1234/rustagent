import React, { useEffect, useRef } from 'react';

export default function TerminalLog({ logs }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const getColor = (type) => {
    switch(type) {
      case 'danger': return 'var(--neon-crimson)';
      case 'warning': return 'var(--neon-amber)';
      case 'success': return 'var(--neon-green)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="glass-panel mono" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.2)', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5"></polyline><line x1="12" y1="19" x2="20" y2="19"></line></svg>
        <span style={{ fontSize: '12px', opacity: 0.8 }}>System Event Log</span>
      </div>
      
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {logs.map(log => (
          <div key={log.id} style={{ color: getColor(log.type) }}>
            <span style={{ opacity: 0.5, marginRight: '8px' }}>
              [{log.time.toLocaleTimeString([], { hour12: false })}]
            </span>
            {log.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
