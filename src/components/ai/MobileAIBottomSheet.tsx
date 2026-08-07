import React, { useState } from 'react';
import { Bot, X, Send, Sparkles, Mic, Volume2 } from 'lucide-react';
import { OpenClawOrchestrator } from '../../services/openclaw/OpenClawOrchestrator';

interface MobileAIBottomSheetProps {
  onExecutePrompt?: (prompt: string) => void;
}

export const MobileAIBottomSheet: React.FC<MobileAIBottomSheetProps> = ({ onExecutePrompt }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [chatLog, setChatLog] = useState<{ sender: 'USER' | 'OPENCLAW'; text: string; time: string }[]>([
    {
      sender: 'OPENCLAW',
      text: 'ARKA Autonomous C2 Assistant online. Ask for traffic, incident, or weather updates.',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSend = async () => {
    if (!promptInput.trim() || isProcessing) return;

    const userText = promptInput.trim();
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setChatLog((prev) => [...prev, { sender: 'USER', text: userText, time: timeStr }]);
    setPromptInput('');
    setIsProcessing(true);

    try {
      const orchestrator = OpenClawOrchestrator.getInstance();
      const res = await orchestrator.executeCommand(userText, {});

      setChatLog((prev) => [
        ...prev,
        {
          sender: 'OPENCLAW',
          text: res.executiveSummary || res.recommendation || 'Command processed successfully.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);

      if (onExecutePrompt) onExecutePrompt(userText);
    } catch (err) {
      setChatLog((prev) => [
        ...prev,
        {
          sender: 'OPENCLAW',
          text: 'Error processing command. Please try again.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const quickPrompts = [
    'Investigate fire near Jayadev Vihar',
    'Show live traffic congestion along NH-16',
    'Deploy nearest ambulance to Capital Hospital',
  ];

  return (
    <>
      {/* Floating Action Button (FAB) — Visible on Mobile (< md) */}
      <button
        onClick={() => setIsOpen(true)}
        aria-label="Open OpenClaw AI Assistant"
        className="md:hidden fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-[#06B6D4] text-black font-bold flex items-center justify-center shadow-[0_0_20px_#06B6D4] active:scale-95 transition-transform"
      >
        <Bot className="w-7 h-7" />
        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-400 border-2 border-black animate-ping" />
      </button>

      {/* Mobile Bottom Sheet Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden font-mono select-none">
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Bottom Sheet Modal Container */}
          <div className="relative w-full bg-[#090D16] border-t border-cyan-500/40 rounded-t-2xl max-h-[85vh] flex flex-col z-10 shadow-2xl p-4">
            {/* Sheet Handle & Header */}
            <div className="w-12 h-1 bg-white/20 rounded-full mx-auto mb-3" />
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-[#06B6D4]" />
                <span className="font-bold text-white text-sm uppercase tracking-wider">
                  OpenClaw Assistant
                </span>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center text-white/70 active:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Chat Messages Log */}
            <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1 text-xs max-h-60">
              {chatLog.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border ${
                    msg.sender === 'USER'
                      ? 'bg-blue-600/20 border-blue-500/40 text-white ml-6 text-right'
                      : 'bg-white/5 border-cyan-500/30 text-cyan-200 mr-6'
                  }`}
                >
                  <div className="text-[9px] text-white/40 mb-1">{msg.sender} • {msg.time}</div>
                  <p className="leading-relaxed">{msg.text}</p>
                </div>
              ))}
              {isProcessing && (
                <div className="p-2.5 rounded-lg bg-white/5 border border-cyan-500/30 text-cyan-400 text-xs flex items-center space-x-2 animate-pulse">
                  <Sparkles className="w-4 h-4" />
                  <span>Processing OpenClaw spatial query...</span>
                </div>
              )}
            </div>

            {/* Quick Suggested Prompts */}
            <div className="flex items-center space-x-2 overflow-x-auto pb-2 mb-2 no-scrollbar">
              {quickPrompts.map((qp, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setPromptInput(qp);
                  }}
                  className="px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-white/70 text-[10px] whitespace-nowrap active:bg-white/20"
                >
                  {qp}
                </button>
              ))}
            </div>

            {/* Input Bar with Min 48px Touch Target */}
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask OpenClaw AI..."
                className="flex-1 min-h-[48px] bg-black border border-cyan-500/40 text-white px-3 py-2 rounded-lg text-xs focus:outline-none focus:border-cyan-300"
              />
              <button
                onClick={handleSend}
                disabled={isProcessing}
                className="w-12 min-h-[48px] rounded-lg bg-[#06B6D4] text-black flex items-center justify-center font-bold active:scale-95 transition-all"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
