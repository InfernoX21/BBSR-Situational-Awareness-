/**
 * SadakshDiagnosticsPanel.tsx
 * ----------------------------
 * AI Diagnostics panel for the Sadaksh PyTorch YOLOv8 + ByteTrack
 * Computer Vision Intelligence Engine.
 *
 * Shows: model status, hardware, performance, stream health, logger, class breakdown, recent events.
 * Polls /diagnostics and /statistics every 3 seconds from the live AI server.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { CameraAIService, SadakshDiagnostics, SadakshStatistics, SadakshEvent } from '../../services/ai/cameraAIService';
import {
  Activity,
  Cpu,
  Zap,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Timer,
  Layers,
  Database,
  Radio,
  TrendingUp,
} from 'lucide-react';

const ai = CameraAIService.getInstance();

interface Props {
  compact?: boolean;
}

const StatRow: React.FC<{ label: string; value: React.ReactNode; highlight?: boolean }> = ({
  label,
  value,
  highlight,
}) => (
  <div className="flex justify-between items-center py-0.5">
    <span className="text-white/40 text-[9px] uppercase tracking-wider">{label}</span>
    <span className={`font-bold font-mono text-[10px] ${highlight ? 'text-[#06B6D4]' : 'text-white'}`}>
      {value}
    </span>
  </div>
);

const SectionHeader: React.FC<{ icon: React.ReactNode; label: string; color?: string }> = ({
  icon,
  label,
  color = 'text-white/60',
}) => (
  <div className={`flex items-center space-x-1.5 text-[10px] font-bold uppercase tracking-wider ${color} border-b border-white/10 pb-1 mb-1.5`}>
    {icon}
    <span>{label}</span>
  </div>
);

const EventBadge: React.FC<{ event: SadakshEvent }> = ({ event }) => {
  const color = CameraAIService.severityColor(event.severity);
  return (
    <div
      className="p-1.5 rounded border text-[8px] font-mono leading-tight"
      style={{ borderColor: `${color}40`, backgroundColor: `${color}12`, color }}
    >
      <div className="font-bold">{event.type.replace(/_/g, ' ')}</div>
      <div className="text-white/50 mt-0.5 truncate">{event.message}</div>
    </div>
  );
};

export const SadakshDiagnosticsPanel: React.FC<Props> = ({ compact = false }) => {
  const [diagnostics, setDiagnostics] = useState<SadakshDiagnostics | null>(null);
  const [statistics, setStatistics] = useState<SadakshStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastPoll, setLastPoll] = useState<string>('');

  const poll = useCallback(async () => {
    const [diag, stats] = await Promise.all([
      ai.getDiagnostics(),
      ai.getStatistics(),
    ]);
    setDiagnostics(diag);
    setStatistics(stats);
    setLoading(false);
    setLastPoll(new Date().toLocaleTimeString());
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll]);

  const isOnline = diagnostics?.status === 'READY';

  const statusColor = isOnline ? '#10B981' : '#EF4444';
  const StatusIcon = isOnline ? CheckCircle2 : XCircle;

  if (loading) {
    return (
      <div className="p-4 rounded border border-white/10 bg-black/60 flex items-center justify-center space-x-2 text-white/40 text-xs animate-pulse">
        <Radio className="w-4 h-4" />
        <span>Connecting to Sadaksh AI Engine...</span>
      </div>
    );
  }

  const perf = diagnostics?.performance;
  const model = diagnostics?.model;
  const hw = diagnostics?.hardware;
  const classTotals: Record<string, number> = (statistics?.class_totals ?? {}) as Record<string, number>;
  const recentEvents: SadakshEvent[] = (statistics?.event_log ?? []).slice(-4).reverse();

  const maxClass = Math.max(...(Object.values(classTotals) as number[]), 1);

  return (
    <div className={`space-y-3 font-mono text-[10px] ${compact ? '' : ''}`}>
      {/* Header Status */}
      <div
        className="p-2.5 rounded border flex items-center justify-between"
        style={{ borderColor: `${statusColor}40`, backgroundColor: `${statusColor}10` }}
      >
        <div className="flex items-center space-x-2">
          <StatusIcon className="w-4 h-4" style={{ color: statusColor }} />
          <div>
            <div className="font-bold text-white text-[11px]">Sadaksh AI Engine</div>
            <div className="text-white/40 text-[8px]">
              {model?.name ?? 'YOLOv8n + ByteTrack'} · {model?.weights ?? 'yolov8n.pt'}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div
            className="font-bold text-[11px] px-2 py-0.5 rounded"
            style={{ color: statusColor, backgroundColor: `${statusColor}20` }}
          >
            {isOnline ? 'READY' : 'OFFLINE'}
          </div>
          <div className="text-white/30 text-[8px] mt-0.5">Updated: {lastPoll}</div>
        </div>
      </div>

      {/* Model Info */}
      <div className="space-y-1">
        <SectionHeader icon={<Layers className="w-3 h-3" />} label="Model Configuration" color="text-[#06B6D4]" />
        <div className="bg-black/40 rounded border border-white/5 p-2 space-y-0.5">
          <StatRow label="Tracker" value={model?.tracker ?? '—'} />
          <StatRow label="Weights" value={model?.weights ?? '—'} highlight />
          <StatRow label="Conf Threshold" value={model ? `${(model.conf_threshold * 100).toFixed(0)}%` : '—'} />
          <StatRow label="Trajectory Points" value={model?.trajectory_len ?? '—'} />
          <StatRow label="Device" value={model?.device?.toUpperCase() ?? '—'} highlight />
          <StatRow
            label="Classes"
            value={diagnostics?.classes_supported.join(', ') ?? '—'}
          />
        </div>
      </div>

      {/* Hardware */}
      <div className="space-y-1">
        <SectionHeader icon={<Cpu className="w-3 h-3" />} label="Hardware" color="text-amber-400" />
        <div className="bg-black/40 rounded border border-white/5 p-2 space-y-0.5">
          <StatRow
            label="GPU"
            value={
              hw?.gpu_available ? (
                <span className="text-[#10B981]">✓ {hw.gpu_name}</span>
              ) : (
                <span className="text-amber-400">CPU Fallback</span>
              )
            }
          />
          <StatRow label="CPU Mode" value={hw?.cpu_fallback ? 'Active' : 'Standby'} />
        </div>
      </div>

      {/* Performance */}
      <div className="space-y-1">
        <SectionHeader icon={<Zap className="w-3 h-3" />} label="Performance" color="text-[#10B981]" />
        <div className="bg-black/40 rounded border border-white/5 p-2 space-y-0.5">
          <StatRow label="Avg FPS" value={perf ? `${perf.avg_fps} fps` : '—'} highlight />
          <StatRow label="Frames Processed" value={perf?.frames_processed.toLocaleString() ?? '—'} />
          <StatRow label="Total Detections" value={perf?.total_detections.toLocaleString() ?? '—'} />
          <StatRow label="Active Tracks" value={statistics?.active_tracks ?? '—'} />
          <StatRow
            label="Uptime"
            value={perf ? `${Math.floor(perf.uptime_seconds / 60)}m ${Math.floor(perf.uptime_seconds % 60)}s` : '—'}
          />
          <StatRow
            label="Error Count"
            value={
              <span style={{ color: (perf?.error_count ?? 0) > 0 ? '#EF4444' : '#10B981' }}>
                {perf?.error_count ?? 0}
              </span>
            }
          />
        </div>

        {/* FPS mini-sparkline */}
        {perf && perf.fps_samples.length > 1 && (
          <div className="flex items-end space-x-0.5 h-6 px-2">
            {perf.fps_samples.slice(-20).map((v, i) => {
              const maxFps = Math.max(...perf.fps_samples, 1);
              const barH = Math.round((v / maxFps) * 24);
              return (
                <div
                  key={i}
                  className="flex-1 rounded-sm"
                  style={{
                    height: `${barH}px`,
                    backgroundColor: v > 20 ? '#10B981' : v > 10 ? '#F59E0B' : '#EF4444',
                    opacity: 0.7,
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* Streams & Logger */}
      <div className="space-y-1">
        <SectionHeader icon={<Radio className="w-3 h-3" />} label="Streams & Logger" color="text-purple-400" />
        <div className="bg-black/40 rounded border border-white/5 p-2 space-y-0.5">
          <StatRow label="Active Streams" value={diagnostics?.streams.active ?? 0} highlight />
          <StatRow
            label="Last Inference"
            value={
              diagnostics?.streams.last_inference_ts
                ? new Date(diagnostics.streams.last_inference_ts).toLocaleTimeString()
                : 'Never'
            }
          />
          <StatRow label="Logger Type" value={diagnostics?.logger.type ?? '—'} />
          <StatRow label="Log File" value={diagnostics?.logger.path ?? '—'} />
          <StatRow
            label="Logger Status"
            value={
              <span style={{ color: diagnostics?.logger.active ? '#10B981' : '#EF4444' }}>
                {diagnostics?.logger.active ? 'Active' : 'Stopped'}
              </span>
            }
          />
        </div>
      </div>

      {/* Class Detection Breakdown */}
      {Object.keys(classTotals).length > 0 && (
        <div className="space-y-1">
          <SectionHeader icon={<TrendingUp className="w-3 h-3" />} label="Class Detection Totals" color="text-[#06B6D4]" />
          <div className="bg-black/40 rounded border border-white/5 p-2 space-y-1.5">
            {Object.entries(classTotals)
              .sort(([, a], [, b]) => (b as number) - (a as number))
              .map(([cls, count]) => {
                const barW = Math.round(((count as number) / maxClass) * 100);
                const color = CameraAIService.classColor(cls);
                return (
                  <div key={cls}>
                    <div className="flex justify-between text-[8px] mb-0.5">
                      <span style={{ color }} className="font-bold uppercase">{cls}</span>
                      <span className="text-white/60">{count.toLocaleString()}</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${barW}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <div className="space-y-1">
          <SectionHeader icon={<AlertTriangle className="w-3 h-3" />} label="Recent AI Events" color="text-amber-400" />
          <div className="space-y-1">
            {recentEvents.map((ev, i) => (
              <EventBadge key={i} event={ev} />
            ))}
          </div>
        </div>
      )}

      {/* Events Supported */}
      {!compact && diagnostics?.events_supported && (
        <div className="space-y-1">
          <SectionHeader icon={<Activity className="w-3 h-3" />} label="Supported Events" color="text-white/40" />
          <div className="flex flex-wrap gap-1">
            {diagnostics.events_supported.map((ev) => (
              <span key={ev} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] text-white/50">
                {ev.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Database Logger */}
      {!compact && (
        <div className="p-2 rounded border border-white/5 bg-black/30 flex items-center space-x-2 text-white/30 text-[8px]">
          <Database className="w-3 h-3 shrink-0" />
          <span>
            CSV telemetry logging to <code className="text-white/50">detection_log.csv</code> · 
            PostgreSQL persistence via ARKA server · All inference metadata stored
          </span>
        </div>
      )}
    </div>
  );
};
