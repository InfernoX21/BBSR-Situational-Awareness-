import React, { useState } from 'react';
import { LiveLog } from '../types';
import { X, Terminal, Filter, Download, Trash2 } from 'lucide-react';

interface LogsModalProps {
  logs: LiveLog[];
  onClose: () => void;
  onClearLogs: () => void;
}

export const LogsModal: React.FC<LogsModalProps> = ({ logs, onClose, onClearLogs }) => {
  const [logFilter, setLogFilter] = useState<'ALL' | LiveLog['type']>('ALL');

  const filteredLogs = logs.filter((l) => (logFilter === 'ALL' ? true : l.type === logFilter));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between font-mono text-xs">
          <div className="flex items-center space-x-2 text-cyan-400 font-bold">
            <Terminal className="w-4 h-4" />
            <span>ARKA AUDIT LOG TRAIL ({logs.length} ENTRIES)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-3 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between font-mono text-xs">
          <div className="flex items-center space-x-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            {(['ALL', 'INFO', 'WARN', 'ALERT', 'SUCCESS'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setLogFilter(type)}
                className={`px-2 py-0.5 rounded text-[10px] ${
                  logFilter === type ? 'bg-slate-800 text-cyan-300 font-bold border border-slate-700' : 'text-slate-400'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <button
            onClick={onClearLogs}
            className="px-2.5 py-1 rounded bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-800/60 text-[10px] flex items-center space-x-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>CLEAR LOGS</span>
          </button>
        </div>

        {/* Log Entries List */}
        <div className="p-4 overflow-y-auto font-mono text-xs space-y-1.5 flex-1 max-h-[500px] bg-[#090b0e]">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-2 rounded bg-slate-950 border border-slate-900 flex items-start space-x-3 hover:border-slate-800"
            >
              <span className="text-slate-500 text-[10px] flex-shrink-0 mt-0.5">{log.timestamp}</span>
              <span
                className={`text-[10px] font-bold flex-shrink-0 ${
                  log.type === 'ALERT'
                    ? 'text-red-400'
                    : log.type === 'WARN'
                    ? 'text-amber-400'
                    : log.type === 'SUCCESS'
                    ? 'text-emerald-400'
                    : 'text-cyan-400'
                }`}
              >
                [{log.type}]
              </span>
              <span className="text-slate-200 leading-tight">{log.message}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
          >
            CLOSE AUDIT LOGS
          </button>
        </div>
      </div>
    </div>
  );
};
