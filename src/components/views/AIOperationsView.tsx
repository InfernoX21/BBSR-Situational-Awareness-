import React, { useState, useEffect } from 'react';
import {
  OpenClawExecutionResult,
  OpenClawAgentStatus,
  Incident,
  LandmarkNode,
  DroneUnit,
  MapLayersState,
  WeatherData,
  TrafficCorridor,
} from '../../types';
import { OpenClawOrchestrator } from '../../services/openclaw/OpenClawOrchestrator';
import { OpenClawToolRegistry } from '../../services/openclaw/OpenClawToolRegistry';
import {
  Bot,
  Terminal,
  Play,
  CheckCircle2,
  Clock,
  Sparkles,
  Shield,
  Globe,
  Radio,
  Car,
  CloudRain,
  Building2,
  BarChart2,
  ArrowRight,
  Send,
  AlertTriangle,
  RotateCcw,
  Zap,
  Navigation,
  FileText,
  Sliders,
  Check,
} from 'lucide-react';

interface AIOperationsViewProps {
  incidents: Incident[];
  landmarks: LandmarkNode[];
  drones: DroneUnit[];
  weather: WeatherData;
  trafficCorridors: TrafficCorridor[];
  intelligenceItems: any[];
  onApplyStateChanges?: (changes: OpenClawExecutionResult['stateChanges']) => void;
  onJumpToMap?: () => void;
}

export const AIOperationsView: React.FC<AIOperationsViewProps> = ({
  incidents,
  landmarks,
  drones,
  weather,
  trafficCorridors,
  intelligenceItems,
  onApplyStateChanges,
  onJumpToMap,
}) => {
  const orchestrator = OpenClawOrchestrator.getInstance();
  const toolRegistry = OpenClawToolRegistry.getInstance();

  const [prompt, setPrompt] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeResult, setActiveResult] = useState<OpenClawExecutionResult | null>(null);
  const [agents, setAgents] = useState<OpenClawAgentStatus[]>(orchestrator.getAgents());
  const [executionHistory, setExecutionHistory] = useState<OpenClawExecutionResult[]>([]);

  const samplePrompts = [
    'Investigate fire near Patia',
    'Show all incidents within 5 km of AIIMS',
    'Prepare dashboard for cyclone monitoring',
    'Highlight hospitals affected by outages',
    'Generate operational summary report',
  ];

  const handleExecute = async (commandText: string) => {
    if (!commandText.trim()) return;
    setIsExecuting(true);
    setPrompt(commandText);

    try {
      const context = {
        incidents,
        landmarks,
        resources: [],
        drones,
        weather,
        trafficCorridors,
        trafficSensors: [],
        intelligenceItems,
      };

      const result = await orchestrator.executeCommand(commandText, context);
      setActiveResult(result);
      setExecutionHistory((prev) => [result, ...prev]);
      setAgents(orchestrator.getAgents());

      // If execution updated map state or target location, trigger ARKA callback
      if (result.stateChanges && onApplyStateChanges) {
        onApplyStateChanges(result.stateChanges);
      }
    } catch (err) {
      console.error('OpenClaw execution error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const getAgentIcon = (id: string) => {
    switch (id) {
      case 'supervisor': return <Shield className="w-4 h-4 text-cyan-400" />;
      case 'gis': return <Globe className="w-4 h-4 text-emerald-400" />;
      case 'intelligence': return <Radio className="w-4 h-4 text-purple-400" />;
      case 'traffic': return <Car className="w-4 h-4 text-amber-400" />;
      case 'disaster': return <CloudRain className="w-4 h-4 text-blue-400" />;
      case 'infrastructure': return <Building2 className="w-4 h-4 text-rose-400" />;
      default: return <BarChart2 className="w-4 h-4 text-yellow-400" />;
    }
  };

  return (
    <div className="flex-1 h-full bg-[#050505] p-6 overflow-y-auto font-mono text-xs flex flex-col space-y-6">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/40 text-[#06B6D4]">
              <Bot className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg font-bold uppercase tracking-wider text-white">
                  OpenClaw Autonomous AI Operations Engine
                </h1>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
                  v2026.7.1-2 ONLINE
                </span>
              </div>
              <p className="text-white/40 text-[11px] mt-0.5">
                Model Context Protocol (MCP) Multi-Agent Command & Autonomous Task Execution Framework
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3 text-[10px]">
          <div className="px-3 py-1.5 rounded bg-white/[0.03] border border-white/10 text-white/70">
            REGISTERED MCP TOOLS: <strong className="text-[#06B6D4]">20 Tools</strong>
          </div>
          <div className="px-3 py-1.5 rounded bg-white/[0.03] border border-white/10 text-white/70">
            AGENTS: <strong className="text-[#10B981]">7 Domain Agents</strong>
          </div>
        </div>
      </div>

      {/* Multi-Agent Roster Grid */}
      <div className="space-y-2">
        <div className="text-white/40 text-[10px] font-bold uppercase tracking-wider flex items-center space-x-2">
          <Terminal className="w-3.5 h-3.5 text-[#06B6D4]" />
          <span>Active OpenClaw Multi-Agent Roster</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className={`p-2.5 rounded border transition-all ${
                agent.status === 'BUSY'
                  ? 'bg-[#06B6D4]/10 border-[#06B6D4] shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                  : agent.status === 'COMPLETED'
                  ? 'bg-[#10B981]/10 border-[#10B981]/60'
                  : 'bg-white/[0.02] border-white/10'
              }`}
            >
              <div className="flex items-center justify-between">
                {getAgentIcon(agent.id)}
                <span
                  className={`w-2 h-2 rounded-full ${
                    agent.status === 'BUSY'
                      ? 'bg-[#06B6D4] animate-ping'
                      : agent.status === 'COMPLETED'
                      ? 'bg-[#10B981]'
                      : 'bg-white/20'
                  }`}
                />
              </div>

              <div className="mt-2 font-bold text-white text-[11px] truncate">{agent.name}</div>
              <div className="text-white/40 text-[9px] truncate mt-0.5">{agent.role}</div>

              <div className="mt-2 flex items-center justify-between text-[9px]">
                <span
                  className={`font-bold ${
                    agent.status === 'BUSY'
                      ? 'text-[#06B6D4]'
                      : agent.status === 'COMPLETED'
                      ? 'text-[#10B981]'
                      : 'text-white/30'
                  }`}
                >
                  {agent.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Natural Language Command Bar */}
      <div className="p-4 bg-[#0A0A0A] border border-white/15 rounded-lg space-y-3 shadow-xl">
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-white/60 font-bold uppercase tracking-wider flex items-center space-x-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>Enter Operational Command</span>
          </span>
          <span className="text-white/40">MCP Agent Command Interface</span>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleExecute(prompt);
          }}
          className="flex items-center space-x-2"
        >
          <div className="flex-1 flex items-center bg-black border border-white/20 focus-within:border-[#06B6D4] rounded px-3 py-2 transition-all">
            <Terminal className="w-4 h-4 text-[#06B6D4] mr-2 shrink-0" />
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Investigate fire near Patia..."
              className="bg-transparent text-xs text-white placeholder-white/30 focus:outline-none w-full font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={isExecuting || !prompt.trim()}
            className="px-4 py-2 rounded bg-[#06B6D4] hover:bg-cyan-500 disabled:opacity-50 text-black font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 transition-all cursor-pointer shrink-0"
          >
            {isExecuting ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                <span>Executing...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Execute</span>
              </>
            )}
          </button>
        </form>

        {/* Suggested Quick Prompts */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-white/40 text-[9px] uppercase font-bold mr-1">Suggested Workflows:</span>
          {samplePrompts.map((p) => (
            <button
              key={p}
              onClick={() => handleExecute(p)}
              className="px-2.5 py-1 rounded bg-white/5 border border-white/10 hover:border-[#06B6D4]/50 hover:text-[#06B6D4] text-white/70 text-[10px] transition-all cursor-pointer"
            >
              ⚡ {p}
            </button>
          ))}
        </div>
      </div>

      {/* Active Workflow Execution Results */}
      {activeResult && (
        <div className="space-y-4">
          {/* Workflow Header & Supervisor Plan */}
          <div className="p-4 bg-[#0A0A0A] border border-[#06B6D4]/40 rounded-lg space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/10 pb-3 gap-2">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                <span className="font-bold text-white text-sm">
                  Autonomous Execution Completed: "{activeResult.userPrompt}"
                </span>
              </div>
              <span className="text-white/40 text-[10px] font-mono">
                EXECUTION ID: {activeResult.executionId}
              </span>
            </div>

            {/* Supervisor Plan Breakdown */}
            <div className="space-y-1.5">
              <div className="text-white/50 text-[10px] uppercase font-bold">Supervisor Orchestration Plan:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
                {activeResult.supervisorPlan.map((planItem, idx) => (
                  <div key={idx} className="p-2 bg-white/[0.02] border border-white/5 rounded text-white/80">
                    {planItem}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Workflow Execution Timeline */}
          <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded-lg space-y-3">
            <div className="text-white/60 font-bold text-xs uppercase tracking-wider flex items-center space-x-2">
              <Clock className="w-4 h-4 text-[#F59E0B]" />
              <span>MCP Tool Execution Timeline ({activeResult.steps.length} Steps)</span>
            </div>

            <div className="space-y-2">
              {activeResult.steps.map((step, idx) => (
                <div
                  key={step.id}
                  className="p-3 bg-black border border-white/10 rounded flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 rounded-full bg-white/5 border border-white/20 text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-white text-xs">{step.description}</span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]/30">
                          {step.toolName}
                        </span>
                      </div>
                      <div className="text-white/40 text-[10px] mt-0.5">
                        AGENT: <strong className="text-white/70">{step.agentName}</strong> | DURATION: {step.durationMs}ms
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#10B981]/20 text-[#10B981]">
                      STATUS: {step.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Reasoning Summary & Action Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Operational Summary */}
            <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded-lg space-y-2">
              <div className="text-white/60 font-bold text-xs uppercase tracking-wider flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-[#06B6D4]" />
                <span>Executive Operational Summary</span>
              </div>
              <p className="text-white/80 text-xs leading-relaxed p-3 bg-black rounded border border-white/5">
                {activeResult.finalSummary}
              </p>
            </div>

            {/* Action Recommendations */}
            <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded-lg space-y-2">
              <div className="text-white/60 font-bold text-xs uppercase tracking-wider flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-[#F59E0B]" />
                <span>Autonomous Action Recommendations</span>
              </div>
              <div className="space-y-1.5">
                {activeResult.recommendations.map((rec, idx) => (
                  <div key={idx} className="p-2 bg-[#F59E0B]/5 border border-[#F59E0B]/20 rounded text-[11px] text-[#F59E0B] flex items-center space-x-2">
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Jump to Map Button */}
          {onJumpToMap && (
            <div className="flex justify-end">
              <button
                onClick={onJumpToMap}
                className="px-4 py-2 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/40 hover:bg-[#06B6D4]/20 text-[#06B6D4] font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer"
              >
                <Navigation className="w-4 h-4" />
                <span>Jump to Digital Twin Camera Target</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Historical Executions Log */}
      {executionHistory.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-white/10">
          <div className="text-white/40 text-[10px] font-bold uppercase tracking-wider">
            Execution History Log ({executionHistory.length} Sessions)
          </div>

          <div className="space-y-2">
            {executionHistory.map((hist) => (
              <div
                key={hist.executionId}
                onClick={() => setActiveResult(hist)}
                className="p-3 bg-[#0A0A0A] border border-white/10 hover:border-[#06B6D4]/40 rounded flex items-center justify-between cursor-pointer transition-all"
              >
                <div className="flex items-center space-x-3">
                  <Terminal className="w-4 h-4 text-[#06B6D4]" />
                  <div>
                    <div className="font-bold text-white text-xs">{hist.userPrompt}</div>
                    <div className="text-white/40 text-[10px]">{hist.timestamp} | {hist.steps.length} Steps Executed</div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#10B981]/20 text-[#10B981]">
                    COMPLETED
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-white/40" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
