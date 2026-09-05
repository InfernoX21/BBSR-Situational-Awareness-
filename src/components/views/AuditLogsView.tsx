import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, User, Clock, Search } from 'lucide-react';
import type { AuditLog } from '../../types';
import { useOperationalStore } from '../../store/useOperationalStore';

export const AuditLogsView: React.FC = () => {
  const { auditLogs } = useOperationalStore();
  const [logs, setLogs] = useState<AuditLog[]>(auditLogs);

  useEffect(() => {
    fetch('/api/audit-logs')
      .then((res) => res.json())
      .then((data) => {
        if (data.auditLogs) setLogs(data.auditLogs);
      })
      .catch(() => {});
  }, [auditLogs]);

  return (
    <div className="h-full bg-zinc-950 text-zinc-100 flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-orange-400" />
          <div>
            <h2 className="text-sm font-bold font-mono text-zinc-100 tracking-wider">
              SECURITY AUDIT LOGS & ACTION TRAIL
            </h2>
            <p className="text-xs text-zinc-400">
              Immutable audit log recording WHO &rarr; DID WHAT &rarr; WHEN &rarr; TO WHICH ENTITY &rarr; WHY
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 text-xs font-mono rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          SECURE AUDIT STREAM
        </span>
      </div>

      {/* Audit Table */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg overflow-hidden flex-1 flex flex-col font-mono text-xs">
        <div className="p-3 bg-zinc-900 border-b border-zinc-800 text-zinc-400 grid grid-cols-12 gap-2 uppercase tracking-wider">
          <span className="col-span-2">TIMESTAMP</span>
          <span className="col-span-3">OPERATOR / SYSTEM (WHO)</span>
          <span className="col-span-3">ACTION (DID WHAT)</span>
          <span className="col-span-2">TARGET ENTITY</span>
          <span className="col-span-2 text-right">RATIONALE / WHY</span>
        </div>

        <div className="divide-y divide-zinc-800/80 flex-1 overflow-y-auto">
          {logs.map((log) => (
            <div key={log.id} className="p-3 grid grid-cols-12 gap-2 items-center hover:bg-zinc-900/40 transition">
              <span className="col-span-2 text-zinc-500">{new Date(log.when).toLocaleTimeString()}</span>
              <span className="col-span-3 text-zinc-200 font-bold flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-orange-400" />
                {log.who}
              </span>
              <span className="col-span-3 text-orange-400 font-bold">{log.didWhat}</span>
              <span className="col-span-2 text-zinc-400">{log.targetEntityId || 'N/A'}</span>
              <span className="col-span-2 text-right text-zinc-300 text-[11px]">{log.reason}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
