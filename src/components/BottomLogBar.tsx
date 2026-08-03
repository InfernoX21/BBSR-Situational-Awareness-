import React from 'react';
import { LiveLog } from '../types';
import { Terminal, Shield, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

interface BottomLogBarProps {
  logs: LiveLog[];
  onOpenLogsModal: () => void;
}

export const BottomLogBar: React.FC<BottomLogBarProps> = ({ logs, onOpenLogsModal }) => {
  const getTypeBadge = (type: LiveLog['type']) => {
    switch (type) {
      case 'ALERT':
        return <span className="text-[#EF4444] font-bold">[ALERT]</span>;
      case 'WARN':
        return <span className="text-[#F59E0B] font-bold">[WARN]</span>;
      case 'SUCCESS':
        return <span className="text-[#10B981] font-bold">[OK]</span>;
      default:
        return <span className="text-[#06B6D4] font-bold">[INFO]</span>;
    }
  };

  return (
    <div className="h-6 border-t border-white/10 bg-[#0A0A0A] flex items-center px-4 justify-between shrink-0 select-none font-mono text-[10px] overflow-hidden">
      {/* Left Icon & Ticker */}
      <div className="flex items-center space-x-3 flex-1 overflow-hidden">
        <div className="flex items-center space-x-1 text-[#06B6D4] font-bold uppercase tracking-widest shrink-0">
          <Terminal className="w-3 h-3" />
          <span>Stream</span>
        </div>

        <div className="h-3 w-[1px] bg-white/10 shrink-0" />

        {/* Log Ticker */}
        <div className="flex items-center space-x-4 overflow-x-auto whitespace-nowrap py-0.5 text-white/70">
          {logs.slice(0, 8).map((log) => (
            <div key={log.id} className="flex items-center space-x-1 shrink-0">
              <span className="text-white/30">{log.timestamp}</span>
              {getTypeBadge(log.type)}
              <span className="text-white/80">{log.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Action */}
      <button
        onClick={onOpenLogsModal}
        className="ml-3 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-[#06B6D4] transition-colors shrink-0 text-[9px] uppercase font-bold"
      >
        Full Audit ({logs.length})
      </button>
    </div>
  );
};
