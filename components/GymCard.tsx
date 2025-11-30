import React from 'react';
import { GymData } from '../types';

interface GymCardProps {
  gym: GymData;
  onClick: () => void;
}

export const GymCard: React.FC<GymCardProps> = ({ gym, onClick }) => {
  const visitors = gym.current?.visitors || 0;
  const max = gym.current?.maxCapacity || 100;
  const percentage = Math.min(100, Math.round((visitors / max) * 100));
  
  // Color coding based on load
  let statusColor = "bg-blue-500";
  if (percentage > 80) statusColor = "bg-red-500";
  else if (percentage > 50) statusColor = "bg-yellow-500";
  else statusColor = "bg-emerald-500";

  return (
    <div 
      onClick={onClick}
      className="bg-slate-900 border border-slate-800 rounded-xl p-6 cursor-pointer hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-900/20 transition-all duration-300 group"
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white group-hover:text-blue-400 transition-colors">
            {gym.config.name}
          </h3>
          <p className="text-slate-400 text-xs mt-1">
             Last updated: {new Date(gym.lastUpdated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
          </p>
        </div>
        <div className={`w-3 h-3 rounded-full ${statusColor} animate-pulse`} />
      </div>

      <div className="flex items-end gap-2 mb-2">
        <span className="text-4xl font-bold text-white">{percentage}%</span>
        <span className="text-slate-400 mb-1 text-sm">utilization</span>
      </div>

      <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
        <div 
          className={`h-full ${statusColor} transition-all duration-1000 ease-out`} 
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="flex justify-between mt-4 text-sm text-slate-400">
        <span>{visitors} Active</span>
        <span>{max} Capacity</span>
      </div>
    </div>
  );
};