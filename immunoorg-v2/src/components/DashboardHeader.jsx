import React from 'react';
import { Activity, Shield, Layout, Settings } from 'lucide-react';

const DashboardHeader = ({ 
  activeEndpoints = 0, 
  totalCPU = 0, 
  threatLevel = 'NORMAL', 
  securityScore = 100 
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 shrink-0">
      <div className="glass-panel p-6 rounded-2xl flex items-center justify-between group hover:border-blue-500/50 transition-all cursor-pointer">
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">Active Endpoints</p>
          <h3 className="text-3xl font-bold text-white tracking-tight">{activeEndpoints}</h3>
        </div>
        <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
          <Activity className="text-blue-400 w-6 h-6" />
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl flex items-center justify-between group hover:border-purple-500/50 transition-all cursor-pointer">
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">Fleet CPU Avg</p>
          <h3 className="text-3xl font-bold text-white tracking-tight">{(totalCPU || 0).toFixed(1)}%</h3>
        </div>
        <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
          <Layout className="text-purple-400 w-6 h-6" />
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl flex items-center justify-between group hover:border-orange-500/50 transition-all cursor-pointer">
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">Threat Level</p>
          <h3 className="text-3xl font-bold text-orange-400 tracking-tight">{threatLevel}</h3>
        </div>
        <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
          <Shield className="text-orange-400 w-6 h-6" />
        </div>
      </div>

      <div className="glass-panel p-6 rounded-2xl flex items-center justify-between group hover:border-emerald-500/50 transition-all cursor-pointer">
        <div>
          <p className="text-gray-400 text-sm font-medium mb-1">Security Score</p>
          <h3 className="text-3xl font-bold text-emerald-400 tracking-tight">{securityScore}%</h3>
        </div>
        <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
          <Settings className="text-emerald-400 w-6 h-6" />
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
