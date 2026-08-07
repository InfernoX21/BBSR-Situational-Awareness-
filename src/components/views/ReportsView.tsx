import React, { useState } from 'react';
import { Incident, WeatherData, TrafficSummary } from '../../types';
import {
  FileText,
  Download,
  Printer,
  Sparkles,
  CheckCircle,
  Calendar,
  Filter,
  FileCheck,
  Building2,
  AlertTriangle,
  Car,
} from 'lucide-react';

interface ReportsViewProps {
  incidents: Incident[];
  weather: WeatherData;
  trafficSummary?: TrafficSummary;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  incidents,
  weather,
  trafficSummary,
}) => {
  const [reportType, setReportType] = useState<'DAILY' | 'INCIDENT' | 'WEATHER' | 'TRAFFIC' | 'INFRASTRUCTURE'>('DAILY');
  const [timeframe, setTimeframe] = useState<'24H' | '7D' | '30D'>('24H');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [aiSummary, setAiSummary] = useState<string>(
    'OPERATIONAL EXECUTIVE BRIEFING:\nOver the past 24-hour shift cycle, ARKA OS processed 14 multi-modal intelligence feeds, 6 live arterial traffic corridors, and registered 6 emergency incidents across Bhubaneswar. Mean first-responder dispatch latency was maintained at 3.8 minutes. High priority incidents at Rasulgarh (NH-16 bridge collapse risk) and Jayadev Vihar (substation voltage drop) are under active containment with 92.8% situational confidence.'
  );

  const handleGenerateAISummary = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setAiSummary(
        `AI COMMAND REPORT (${reportType} - ${timeframe}):\nSynthesizing telemetry from 8 IoT radar nodes, IMD weather radar, and ${incidents.length} active emergency dispatches. Strategic recommendation: Maintain green-wave traffic signal loop on Janpath Commercial Corridor to relieve Rasulgarh bottleneck. Daya River water elevation remains stable at +0.4m with zero shelter evacuations required.`
      );
      setIsGenerating(false);
    }, 1200);
  };

  const handleDownload = (format: string) => {
    const text = `ARKA OS COMMAND REPORT - ${reportType} (${timeframe})\nGenerated: ${new Date().toLocaleString()}\n\n${aiSummary}\n\nACTIVE INCIDENTS:\n` +
      incidents.map((i) => `- [${i.priority}] #${i.id} ${i.title} (${i.status}) - ${i.location.name}`).join('\n');

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ARKA_COMMAND_REPORT_${reportType}_${timeframe}.txt`;
    a.click();
  };

  return (
    <div className="flex-1 h-full bg-[#050505] p-6 overflow-y-auto font-mono text-xs flex flex-col space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#06B6D4]">
            <FileText className="w-5 h-5 animate-pulse" />
            <h1 className="text-lg font-bold uppercase tracking-wider text-white">
              Operational Command Reports & Intelligence Summaries
            </h1>
          </div>
          <p className="text-white/40 text-[11px] mt-0.5">
            Automated PDF/CSV Export Engine & LLM Intelligence Document Synthesizer
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => handleDownload('TXT')}
            className="min-h-[44px] px-3.5 py-2.5 rounded bg-[#10B981]/20 border border-[#10B981]/40 hover:bg-[#10B981]/30 text-[#10B981] font-bold text-xs uppercase flex items-center space-x-2 transition-all cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Export Report File</span>
          </button>

          <button
            onClick={() => window.print()}
            className="min-h-[44px] px-3.5 py-2.5 rounded bg-white/10 border border-white/20 hover:bg-white/20 text-white font-bold text-xs uppercase flex items-center space-x-2 transition-all cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Configuration Bar */}
      <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Type Buttons */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-white/40 text-[9px] font-bold uppercase mr-1">Report Module:</span>
            {(['DAILY', 'INCIDENT', 'WEATHER', 'TRAFFIC', 'INFRASTRUCTURE'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setReportType(t)}
                className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${
                  reportType === t
                    ? 'bg-white/10 text-[#06B6D4] border border-[#06B6D4]/40'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Timeframe */}
          <div className="flex items-center space-x-2">
            <span className="text-white/40 text-[9px] font-bold uppercase">Timeframe:</span>
            {(['24H', '7D', '30D'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-2 py-1 rounded text-[10px] font-bold ${
                  timeframe === tf ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40' : 'text-white/40'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* AI Intelligence Briefing Document Box */}
      <div className="p-5 bg-[#0A0A0A] border border-white/10 rounded space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#06B6D4]" />
            <span className="font-bold text-white text-xs uppercase">
              LLM Synthesized Executive Briefing ({reportType} - {timeframe})
            </span>
          </div>

          <button
            onClick={handleGenerateAISummary}
            disabled={isGenerating}
            className="px-3 py-1 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/40 text-[#06B6D4] font-bold text-[10px] uppercase flex items-center space-x-1 hover:bg-[#06B6D4]/20 transition-all"
          >
            <Sparkles className={`w-3 h-3 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>{isGenerating ? 'Generating Summary...' : 'Re-Synthesize Summary'}</span>
          </button>
        </div>

        <div className="p-4 bg-black/60 border border-white/5 rounded text-white/90 text-xs leading-relaxed font-mono whitespace-pre-wrap">
          {aiSummary}
        </div>
      </div>

      {/* Incidents Data Table for Report */}
      <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-3">
        <div className="font-bold text-white text-xs uppercase border-b border-white/5 pb-2">
          Attached Telemetry Incidents & Dispatches ({incidents.length})
        </div>

        <div className="space-y-2">
          {incidents.map((inc) => (
            <div key={inc.id} className="p-2.5 bg-white/[0.02] border border-white/5 rounded flex justify-between items-center text-[10px]">
              <div>
                <span className="font-bold text-white">#{inc.id} - {inc.title}</span>
                <span className="text-white/40 text-[9px] ml-2">({inc.category} / {inc.location.name})</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="font-bold text-[#06B6D4]">{inc.agencyAssigned}</span>
                <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 font-bold">{inc.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
