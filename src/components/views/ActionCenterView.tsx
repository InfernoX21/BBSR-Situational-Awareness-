import React from 'react';
import { CheckSquare, Clock, User, ShieldAlert, Cpu, ArrowRight, CheckCircle2, AlertOctagon } from 'lucide-react';
import { operationalStore, useOperationalStore } from '../../store/useOperationalStore';

export const ActionCenterView: React.FC = () => {
  const { actions, role } = useOperationalStore();

  const handleUpdateStatus = (id: string, status: any) => {
    operationalStore.updateActionStatus(id, status);
    operationalStore.addAuditLog(`Operator (${role})`, 'UPDATED_ACTION_STATUS', `Action ${id} status set to ${status}`, id);
  };

  return (
    <div className="h-full bg-zinc-950 text-zinc-100 flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-orange-400" />
          <div>
            <h2 className="text-sm font-bold font-mono text-zinc-100 tracking-wider">
              ACTION CENTER & OPERATIONAL TASK WORKFLOW
            </h2>
            <p className="text-xs text-zinc-400">
              Track approved recommendations from decision to external execution and resolution
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs font-mono rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
            TOTAL ACTIONS: {actions.length}
          </span>
        </div>
      </div>

      {/* Action Table */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg overflow-hidden flex-1 flex flex-col">
        <div className="p-3 bg-zinc-900 border-b border-zinc-800 text-xs font-mono text-zinc-400 grid grid-cols-12 gap-2 uppercase tracking-wider">
          <span className="col-span-2">ID / INCIDENT</span>
          <span className="col-span-3">ACTION TITLE</span>
          <span className="col-span-2">OPERATOR</span>
          <span className="col-span-2">TARGET GATEWAY</span>
          <span className="col-span-1 text-center">STATUS</span>
          <span className="col-span-2 text-right">LIFECYCLE CONTROLS</span>
        </div>

        <div className="divide-y divide-zinc-800/80 flex-1 overflow-y-auto">
          {actions.length === 0 ? (
            <div className="p-8 text-center text-xs font-mono text-zinc-500">
              No active operational tasks in queue.
            </div>
          ) : (
            actions.map((act) => (
              <div key={act.id} className="p-3 grid grid-cols-12 gap-2 items-center text-xs font-mono hover:bg-zinc-900/40 transition">
                <div className="col-span-2">
                  <span className="font-bold text-orange-400 block">{act.id}</span>
                  <span className="text-[10px] text-zinc-400">{act.incidentId}</span>
                </div>

                <div className="col-span-3">
                  <p className="font-semibold text-zinc-200">{act.title}</p>
                  <p className="text-[11px] text-zinc-400 font-sans mt-0.5">{act.reason}</p>
                </div>

                <div className="col-span-2 text-zinc-300">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-zinc-500" />
                    {act.operator}
                  </span>
                  <span className="text-[10px] text-zinc-500 block">{new Date(act.timestamp).toLocaleTimeString()}</span>
                </div>

                <div className="col-span-2 text-zinc-400 text-[11px]">
                  {act.executionTarget || 'Automated Dispatch'}
                </div>

                <div className="col-span-1 text-center">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                    act.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                    act.status === 'IN_PROGRESS' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30 animate-pulse' :
                    act.status === 'COMPLETED' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                    'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}>
                    {act.status}
                  </span>
                </div>

                <div className="col-span-2 flex items-center justify-end gap-1.5">
                  {act.status === 'APPROVED' && (
                    <button
                      onClick={() => handleUpdateStatus(act.id, 'IN_PROGRESS')}
                      className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-[10px] transition"
                    >
                      Start Execution
                    </button>
                  )}
                  {act.status === 'IN_PROGRESS' && (
                    <button
                      onClick={() => handleUpdateStatus(act.id, 'COMPLETED')}
                      className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded text-[10px] transition"
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
