import React from 'react';
import { Incident } from '../types';
import {
  X,
  AlertTriangle,
  MapPin,
  Clock,
  Shield,
  Sparkles,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  Flame,
  Car,
  CloudRain,
  Zap,
} from 'lucide-react';

interface IncidentPopupProps {
  incident: Incident | null;
  onClose: () => void;
  onViewDetails: (incident: Incident) => void;
}

export const IncidentPopup: React.FC<IncidentPopupProps> = ({
  incident,
  onClose,
  onViewDetails,
}) => {
  if (!incident) return null;

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/40 font-bold';
      case 'HIGH':
        return 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40 font-bold';
      case 'MEDIUM':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 font-bold';
      default:
        return 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40 font-bold';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'FIRE':
        return <Flame className="w-4 h-4 text-[#F59E0B]" />;
      case 'FLOOD':
        return <CloudRain className="w-4 h-4 text-[#06B6D4]" />;
      case 'TRAFFIC':
        return <Car className="w-4 h-4 text-indigo-400" />;
      case 'UTILITY':
        return <Zap className="w-4 h-4 text-yellow-400" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-[#EF4444]" />;
    }
  };

  return (
    <div className="absolute top-20 left-12 z-20 w-96 bg-[#0A0A0A]/95 backdrop-blur-xl border border-white/10 rounded overflow-hidden select-none shadow-2xl font-mono text-xs">
      {/* Header */}
      <div className="p-3 border-b border-white/10 bg-[#050505] flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {getCategoryIcon(incident.category)}
          <div>
            <span className="text-[11px] text-[#06B6D4] font-bold">
              {incident.id}
            </span>
            <span className="ml-2 text-[10px] text-white/40 uppercase">
              [{incident.category}]
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border ${getPriorityBadge(
              incident.priority
            )}`}
          >
            {incident.priority}
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body Content */}
      <div className="p-3 space-y-2.5">
        <h3 className="font-bold text-white text-xs leading-tight">{incident.title}</h3>

        <p className="text-white/70 text-[11px] leading-relaxed">{incident.description}</p>

        <div className="space-y-1 pt-1 text-[10px] text-white/60">
          <div className="flex items-start space-x-2">
            <MapPin className="w-3.5 h-3.5 text-[#06B6D4] shrink-0 mt-0.5" />
            <span className="text-white/80">{incident.location.address || incident.location.name}</span>
          </div>

          <div className="flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
            <span>REPORTED: {incident.timestamp}</span>
          </div>

          <div className="flex items-center space-x-2">
            <Shield className="w-3.5 h-3.5 text-[#10B981] shrink-0" />
            <span>AGENCY: {incident.agencyAssigned}</span>
          </div>
        </div>

        {/* AI Action */}
        <div className="p-2 rounded border border-[#06B6D4]/30 bg-[#06B6D4]/5 space-y-1">
          <div className="flex items-center justify-between text-[9px]">
            <span className="text-[#06B6D4] font-bold flex items-center space-x-1 uppercase">
              <Sparkles className="w-3 h-3" />
              <span>AI Confidence</span>
            </span>
            <span className="text-[#10B981] font-bold">{incident.aiConfidence}%</span>
          </div>
          <p className="text-[10px] text-white/80 leading-tight">
            <strong className="text-[#06B6D4]">Action: </strong>
            {incident.recommendedAction}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-white/10 bg-[#050505] flex items-center justify-between">
        <div className="text-[10px] text-white/40 flex items-center space-x-1 uppercase">
          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
          <span>STATUS: {incident.status}</span>
        </div>
        <button
          onClick={() => onViewDetails(incident)}
          className="px-2.5 py-1 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/40 text-[#06B6D4] hover:bg-[#06B6D4]/20 text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1 transition-all"
        >
          <span>View Details</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
