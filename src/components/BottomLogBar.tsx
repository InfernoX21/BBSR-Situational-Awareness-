import React from 'react';
import { LiveLog } from '../types';
import { Terminal } from 'lucide-react';

interface BottomLogBarProps {
  logs: LiveLog[];
  onOpenLogsModal: () => void;
}

export const BottomLogBar: React.FC<BottomLogBarProps> = ({ logs, onOpenLogsModal }) => {
  const getTypeBadge = (type: LiveLog['type']) => {
    switch (type) {
      case 'ALERT':
        return <span className="text-[#EF4444] font-bold">[CRITICAL]</span>;
      case 'WARN':
        return <span className="text-[#F59E0B] font-bold">[WARN]</span>;
      case 'SUCCESS':
        return <span className="text-[#10B981] font-bold">[OK]</span>;
      default:
        return <span className="text-[#06B6D4] font-bold">[INFO]</span>;
    }
  };

  const getMessageColor = (type: LiveLog['type']) => {
    switch (type) {
      case 'ALERT':
        return 'text-[#EF4444] font-medium';
      case 'WARN':
        return 'text-[#F59E0B] font-medium';
      case 'SUCCESS':
        return 'text-[#10B981] font-medium';
      default:
        return 'text-[#06B6D4] font-medium';
    }
  };

  const renderLogItems = (logList: LiveLog[], keyPrefix: string) =>
    logList.map((log, idx) => (
      <span key={`${keyPrefix}-${log.id}-${idx}`} className="inline-flex items-center gap-1.5 shrink-0 whitespace-nowrap">
        <span className="text-white/40 font-mono text-[10px]">{log.timestamp}</span>
        {getTypeBadge(log.type)}
        <span className={`text-[10px] ${getMessageColor(log.type)}`}>{log.message}</span>
        <span className="text-white/25 mx-3 select-none">•</span>
      </span>
    ));

  return (
    <div className="h-6 border-t border-white/10 bg-[#0A0A0A] flex items-center px-2 sm:px-3 justify-between shrink-0 select-none font-mono text-[10px] overflow-hidden group z-20 min-w-0">
      {/* Left Header Tag */}
      <div className="flex items-center gap-1.5 text-[#06B6D4] font-bold uppercase tracking-wider shrink-0 mr-2 z-10 bg-[#0A0A0A] pr-1">
        <Terminal className="w-3.5 h-3.5 text-[#06B6D4]" aria-hidden="true" />
        <span className="text-[11px] font-bold tracking-widest">&gt;_ STREAM</span>
        <span className="text-white/20 ml-1 font-normal">|</span>
      </div>

      {/* Ticker Stream Container */}
      <div className="flex-1 overflow-hidden relative h-full flex items-center">
        <div className="animate-ticker group-hover:[animation-play-state:paused] hover:[animation-play-state:paused] py-0.5">
          <div className="flex items-center shrink-0">
            {renderLogItems(logs, 'copy1')}
          </div>
          <div className="flex items-center shrink-0" aria-hidden="true">
            {renderLogItems(logs, 'copy2')}
          </div>
        </div>
      </div>

      {/* Right Action Button */}
      <button
        onClick={onOpenLogsModal}
        className="ml-3 px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 border border-white/10 text-white/60 hover:text-[#06B6D4] transition-colors shrink-0 text-[9px] uppercase font-bold tracking-wider cursor-pointer z-10 bg-[#0A0A0A] pl-2"
        title="Open complete log audit trail"
      >
        FULL AUDIT ({logs.length})
      </button>
    </div>
  );
};

