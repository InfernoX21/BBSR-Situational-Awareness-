import React from 'react';
import { IntelligenceItem } from '../types';
import { X, ExternalLink, Globe, Sparkles, ListChecks, ArrowUpRight, ShieldCheck, Clock } from 'lucide-react';

interface NewsArticleModalProps {
  item: IntelligenceItem | null;
  onClose: () => void;
}

export const NewsArticleModal: React.FC<NewsArticleModalProps> = ({ item, onClose }) => {
  if (!item) return null;

  // Derive highlight bullets if not explicitly defined
  const getHighlights = (art: IntelligenceItem): string[] => {
    if (art.highlights && art.highlights.length > 0) {
      return art.highlights;
    }
    const fullText = art.content || art.summary || '';
    const sentences = fullText
      .split(/(?<=\.)\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 10);

    if (sentences.length >= 2) {
      return sentences;
    }

    return [
      `Official intelligence feed published by ${art.publisherName}.`,
      `Key subject: ${art.headline}`,
      `Category classification: ${art.category.replace('_', ' ')}.`,
      `Timestamp recorded: ${art.publishedTime} via ARKA Intelligence Network.`
    ];
  };

  const highlights = getHighlights(item);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#0A0D14] border border-cyan-500/30 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] text-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 border-b border-white/10 bg-[#06080F] flex items-center justify-between">
          <div className="flex items-center space-x-2 font-mono text-xs">
            <div className="p-1 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4]">
              <Globe className="w-4 h-4" />
            </div>
            <span className="text-[#06B6D4] font-bold text-sm tracking-wide">{item.publisherName}</span>
            <span className="text-white/40 flex items-center gap-1">
              <Clock className="w-3 h-3 text-amber-400/80" />
              {item.publishedTime}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          {/* Category Tag & Headline */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4] font-mono text-[10px] font-bold uppercase tracking-wider">
                {item.category.replace('_', ' ')}
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                VERIFIED FEED
              </span>
            </div>

            <h1 className="text-lg sm:text-xl font-bold text-white leading-snug">
              {item.headline}
            </h1>
          </div>

          {/* Section 1: Brief Summary */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-[#06B6D4] font-bold text-xs uppercase tracking-wider font-mono">
              <Sparkles className="w-4 h-4 text-[#06B6D4]" />
              <span>Brief News Summary</span>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/10 text-white/90 text-xs sm:text-sm leading-relaxed font-sans shadow-inner">
              {item.summary}
            </div>
          </div>

          {/* Section 2: Main Highlights (Bullet Points) */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2 text-emerald-400 font-bold text-xs uppercase tracking-wider font-mono">
              <ListChecks className="w-4 h-4 text-emerald-400" />
              <span>Main Key Highlights</span>
            </div>

            <div className="p-4 rounded-xl bg-[#060A12] border border-emerald-500/20">
              <ul className="space-y-2.5">
                {highlights.map((bullet, idx) => (
                  <li key={idx} className="flex items-start space-x-3 text-xs sm:text-sm text-white/80 leading-normal">
                    <span className="w-2 h-2 rounded-full bg-[#06B6D4] mt-1.5 shrink-0 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Section 3: Redirection / Source Card */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-[#06B6D4]/10 via-[#06B6D4]/5 to-transparent border border-[#06B6D4]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-white">Want complete context & live media update?</div>
              <div className="text-[11px] text-white/60 font-mono">
                Redirect to official source article published on {item.publisherName}
              </div>
            </div>

            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-lg bg-[#06B6D4] hover:bg-[#0891B2] text-black font-mono text-xs font-bold flex items-center space-x-1.5 transition-all shadow-lg shrink-0"
            >
              <span>Visit Source Article</span>
              <ArrowUpRight className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-[#06080F] flex items-center justify-between font-mono text-xs text-white/40">
          <span>SOURCE: {item.source}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-mono text-xs font-semibold transition-colors"
          >
            CLOSE WINDOW
          </button>
        </div>
      </div>
    </div>
  );
};
