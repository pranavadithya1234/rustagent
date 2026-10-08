import React from "react";
import ReactDOM from "react-dom";
import {
  X,
  Shield,
  ShieldAlert,
  Activity,
  History,
  Terminal,
  Cpu,
  Database,
  Lock,
  Unlock,
  Monitor,
} from "lucide-react";
import ProcessTable from "./ProcessTable";

const AgentDetailModal = ({
  agent,
  onClose,
  isIsolated,
  onToggleIsolate,
  onKillProcess,
  processes,
  searchTerm,
  onSearchChange,
  activeTab,
  onTabChange,
  history = []
}) => {
  if (!agent) return null;

  const modalContent = (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 md:p-8">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onMouseDown={(e) => {
          // Only close if the mousedown originated directly on the backdrop,
          // not propagated from a child element click
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      />

      {/* Modal Container */}
      <div 
        className="relative w-full max-w-5xl h-[85vh] bg-[#0d1117] border border-white/10 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        
        {/* Header HUD */}
        <div className="p-6 border-b border-white/10 bg-white/[0.02] flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
          <div className="flex items-center gap-5">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              isIsolated ? 'bg-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-blue-500/10'
            }`}>
              <Monitor size={28} className={isIsolated ? 'text-red-400' : 'text-blue-400'} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-white tracking-tight">{agent.hostname || agent.name}</h2>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest ${
                  isIsolated ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  {isIsolated ? 'Isolated' : 'Online'}
                </span>
              </div>
              <p className="text-xs text-gray-500 font-mono mt-1">ID: {agent.id} • OS: {agent.os_name || agent.type}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex gap-8 px-6 py-2 bg-black/30 rounded-2xl border border-white/5">
              <div className="text-center">
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">CPU Load</p>
                <p className="text-lg font-mono font-bold text-white">{(agent.cpu_usage || 0).toFixed(1)}%</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-gray-500 font-bold uppercase mb-1">Memory</p>
                <p className="text-lg font-mono font-bold text-white">{Math.round((agent.memory_usage || 0) / (1024 * 1024))}MB</p>
              </div>
            </div>
            
            <button
              onClick={onToggleIsolate}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all ${
                isIsolated
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                  : "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
              }`}
            >
              {isIsolated ? <Unlock size={18} /> : <Lock size={18} />}
              {isIsolated ? "Restore Access" : "Isolate Device"}
            </button>
            
            <button
              onClick={onClose}
              className="p-3 rounded-xl bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-all"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex px-6 py-2 bg-black/20 border-b border-white/5 gap-2 shrink-0">
          {[
            { id: "Processes", icon: <Activity size={14} /> },
            { id: "History", icon: <History size={14} /> },
            { id: "Commands", icon: <Terminal size={14} /> },
            { id: "Hardware", icon: <Cpu size={14} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === tab.id
                  ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              {tab.icon}
              {tab.id.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden p-6">
          {activeTab === "Processes" && (
            <ProcessTable
              processes={processes}
              searchTerm={searchTerm}
              onSearchChange={onSearchChange}
              onKillProcess={onKillProcess}
            />
          )}

          {activeTab === "History" && (
            <div className="h-full flex flex-col">
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-4">
                <div className="space-y-4">
                  {history.map((event, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-start gap-4">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                        <Database size={16} className="text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-1">
                          <p className="text-sm font-bold text-white">{event.event_type || 'System Event'}</p>
                          <span className="text-[10px] font-mono text-gray-500">{new Date(event.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-xs text-gray-400">{event.message || event.description || 'No detailed logs available.'}</p>
                      </div>
                    </div>
                  ))}
                  {history.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-20 opacity-30">
                      <History size={48} className="mb-4" />
                      <p className="text-lg font-bold">No Event History Found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "Commands" && (
            <div className="h-full flex items-center justify-center">
              <div className="text-center opacity-40">
                <Terminal size={64} className="mx-auto mb-6" />
                <h3 className="text-xl font-bold mb-2">Remote Shell Access</h3>
                <p className="text-sm max-w-sm">Command line interface is restricted to authorized administrators only. Current session is in READ-ONLY mode.</p>
              </div>
            </div>
          )}

          {activeTab === "Hardware" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/5">
                <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-6">Device Specs</h4>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Hostname</span>
                    <span className="text-white font-mono">{agent.hostname}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Operating System</span>
                    <span className="text-white font-mono">{agent.os_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Architecture</span>
                    <span className="text-white font-mono">X86_64</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default AgentDetailModal;
