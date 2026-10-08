import React, { useState } from 'react';
import { XCircle, Filter, Activity, Cpu, Layers, AppWindow, ShieldAlert } from 'lucide-react';
import { processColors } from '../utils/processUtils';

const ProcessTable = ({ processes, searchTerm, onSearchChange, onKillProcess }) => {
  const [filter, setFilter] = useState('ALL');

  const filtered = processes.filter(p => {
    try {
      const name = (p.name || '').toLowerCase();
      const pid = String(p.pid ?? '');
      const matchesSearch = name.includes(searchTerm.toLowerCase()) || pid.includes(searchTerm);
      if (filter === 'ALL') return matchesSearch;
      if (filter === 'APPS') return matchesSearch && p.category === 'App';
      if (filter === 'SYSTEM') return matchesSearch && p.category === 'System';
      if (filter === 'CRITICAL') return matchesSearch && p.category === 'Critical';
      return matchesSearch;
    } catch {
      return false;
    }
  });

  const filterButtons = [
    { id: 'ALL', label: 'All Processes', icon: <Layers size={14} /> },
    { id: 'APPS', label: 'Applications', icon: <AppWindow size={14} /> },
    { id: 'SYSTEM', label: 'System', icon: <Cpu size={14} /> },
    { id: 'CRITICAL', label: 'Threats', icon: <ShieldAlert size={14} /> },
  ];

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Tactical Filter Bar */}
      <div className="flex items-center justify-between gap-4 shrink-0">
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/10">
          {filterButtons.map(btn => (
            <button
              key={btn.id}
              onClick={() => setFilter(btn.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
                filter === btn.id 
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {btn.icon}
              {btn.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
          <input
            type="text"
            placeholder="Search PID or Name..."
            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-blue-500/50 transition-all"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Process Grid/Table */}
      <div className="flex-1 overflow-hidden border border-white/10 rounded-2xl bg-black/20">
        <div className="h-full overflow-y-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-[#0d1117] z-10">
              <tr className="border-b border-white/10">
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">PID</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Process Identifier</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Classification</th>
                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Containment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((proc, idx) => (
                <tr key={`${proc.pid}-${idx}`} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-gray-500">{proc.pid}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">{proc.name}</span>
                      <span className="text-[10px] font-mono text-gray-600 truncate max-w-xs">{proc.path || 'System Binary'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter"
                      style={{
                        backgroundColor: processColors[proc.category] || "rgba(255,255,255,0.05)",
                        color: proc.category === "Critical" ? "#ff4444" : 
                               proc.category === "System" ? "#33b5e5" : 
                               proc.category === "Service" ? "#ffa500" : "#00c851",
                        border: `1px solid ${proc.category === 'Critical' ? 'rgba(255,68,68,0.2)' : 'rgba(255,255,255,0.1)'}`
                      }}
                    >
                      {proc.category}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => onKillProcess(proc.pid)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 font-bold text-[10px] uppercase"
                    >
                      <XCircle size={12} />
                      Terminate
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="4" className="py-20 text-center opacity-30">
                    <Activity size={40} className="mx-auto mb-4" />
                    <p className="text-sm font-bold">No processes match the active filter</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProcessTable;
