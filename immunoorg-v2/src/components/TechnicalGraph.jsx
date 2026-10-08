import React from 'react';
import { Monitor, Smartphone, Shield, ShieldAlert, Search, RefreshCw, Eye } from 'lucide-react';

export default function TechnicalGraph({ nodes, onIsolate, onPatch, onSelectNode }) {
  return (
    <div className="h-full flex flex-col p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <RefreshCw className="text-blue-400 w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-tight">Technical Network</h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Global Endpoint Mesh</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {nodes.map(node => (
            <div 
              key={node.id}
              className={`p-5 rounded-2xl border transition-all duration-300 group ${
                node.isolated 
                  ? 'bg-white/[0.02] border-white/5 opacity-60' 
                  : node.infected 
                  ? 'bg-red-500/5 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
                  : 'bg-white/5 border-white/10 hover:border-blue-500/30'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    node.isolated ? 'bg-white/5' : node.infected ? 'bg-red-500/20' : 'bg-blue-500/10'
                  }`}>
                    {node.type?.toLowerCase().includes('phone') ? (
                      <Smartphone size={20} className={node.infected ? 'text-red-400' : 'text-blue-400'} />
                    ) : (
                      <Monitor size={20} className={node.infected ? 'text-red-400' : 'text-blue-400'} />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white truncate max-w-[120px]">{node.name || node.hostname}</h4>
                    <span className="text-[10px] font-mono text-gray-500 uppercase">{node.type}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold ${node.health < 50 ? 'text-red-400' : 'text-emerald-400'}`}>
                    {node.health}%
                  </p>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Health</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-5">
                <div className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                  node.isolated 
                    ? 'bg-white/5 text-gray-400 border border-white/5' 
                    : node.infected 
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {node.isolated ? 'Isolated' : node.infected ? 'Compromised' : 'Secure'}
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    if (onSelectNode) onSelectNode(node);
                  }}
                  className="flex-1 py-2.5 rounded-xl btn-inspect text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Eye size={12} className="animate-pulse" />
                  Inspect
                </button>
                <button 
                  onClick={() => node.isolated ? onPatch(node.id) : onIsolate(node.id)}
                  disabled={!node.isolated && !node.infected && node.health === 100}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border cursor-pointer ${
                    node.isolated 
                      ? 'btn-restore' 
                      : 'btn-isolate'
                  } disabled:opacity-30 disabled:pointer-events-none`}
                >
                  {node.isolated ? <Shield size={12} /> : <ShieldAlert size={12} />}
                  {node.isolated ? 'Restore' : 'Isolate'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
