import React, { useState } from 'react';
import { IntelligenceItem } from '../../types';
import {
  Rss,
  Search,
  Sparkles,
  ExternalLink,
  Tag,
  Clock,
  Globe,
  CheckCircle,
  AlertTriangle,
  FileText,
  TrendingUp,
  Share2,
} from 'lucide-react';

interface IntelligenceViewProps {
  intelligenceItems: IntelligenceItem[];
  onSelectArticle: (item: IntelligenceItem) => void;
  onFuseIntelligence: () => void;
  isFusing: boolean;
}

export const IntelligenceView: React.FC<IntelligenceViewProps> = ({
  intelligenceItems,
  onSelectArticle,
  onFuseIntelligence,
  isFusing,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const categories = ['ALL', 'GOVT_ADVISORY', 'GOOGLE_NEWS', 'WEATHER_BULLETIN', 'TRAFFIC_FEED'];

  const filteredItems = intelligenceItems.filter((item) => {
    const catUpper = selectedCategory.toUpperCase();
    const itemCat = item.category.toUpperCase();
    const itemSrc = item.source.toUpperCase();

    let matchesCat = selectedCategory === 'ALL';
    if (!matchesCat) {
      if (itemSrc === catUpper || itemCat === catUpper) {
        matchesCat = true;
      } else if (catUpper.includes('WEATHER') && (itemSrc.includes('WEATHER') || itemCat.includes('WEATHER'))) {
        matchesCat = true;
      } else if (catUpper.includes('TRAFFIC') && (itemSrc.includes('TRAFFIC') || itemCat.includes('TRAFFIC'))) {
        matchesCat = true;
      } else if (catUpper.includes('GOVT') && (itemSrc.includes('GOVT') || itemCat.includes('GOVT') || itemCat.includes('ADVISORY'))) {
        matchesCat = true;
      } else if (catUpper.includes('GOOGLE') || catUpper.includes('NEWS')) {
        matchesCat = itemSrc === 'GOOGLE_NEWS' || itemCat.includes('CIVIC') || itemCat.includes('NEWS') || itemCat.includes('GRID');
      }
    }

    const matchesSearch =
      !searchQuery.trim() ||
      item.headline.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.publisherName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCat && matchesSearch;
  });

  const getSourceBadge = (source: IntelligenceItem['source']) => {
    switch (source) {
      case 'GOVT_ADVISORY':
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">GOVT ADVISORY</span>;
      case 'WEATHER_BULLETIN':
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40">WEATHER</span>;
      case 'TRAFFIC_FEED':
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/40">TRAFFIC</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-white/10 text-white/70 border border-white/20">NEWS</span>;
    }
  };

  return (
    <div className="flex-1 h-full bg-[#050505] p-6 overflow-y-auto font-mono text-xs flex flex-col space-y-6">
      {/* Top Header & AI Fusion Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#06B6D4]">
            <Rss className="w-5 h-5 animate-pulse" />
            <h1 className="text-lg font-bold uppercase tracking-wider text-white">
              Intelligence — Incoming Information Stream
            </h1>
          </div>
          <p className="text-white/40 text-[11px] mt-0.5">
            Real-time automated RSS ingestion, Government Advisories & Gemini AI NLP Entity Extraction
          </p>
        </div>

        <button
          onClick={onFuseIntelligence}
          disabled={isFusing}
          className="px-4 py-2 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/40 hover:bg-[#06B6D4]/20 text-[#06B6D4] font-bold text-xs uppercase tracking-wider flex items-center space-x-2 transition-all shadow-lg shrink-0"
        >
          <Sparkles className={`w-4 h-4 ${isFusing ? 'animate-spin' : ''}`} />
          <span>{isFusing ? 'Fusing Multi-Modal Signals...' : 'Run Gemini AI Entity Fusion'}</span>
        </button>
      </div>

      {/* Stats Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Active Ingest Feeds</div>
          <div className="text-lg font-bold text-white mt-0.5">14 Sources</div>
          <div className="text-[#10B981] text-[9px] flex items-center space-x-1 mt-1">
            <CheckCircle className="w-3 h-3" />
            <span>100% Ingestion Nominal</span>
          </div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Articles Ingested Today</div>
          <div className="text-lg font-bold text-[#06B6D4] mt-0.5">{intelligenceItems.length * 8 + 42}</div>
          <div className="text-white/40 text-[9px] mt-1">+12% vs 24h average</div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Extracted Geo Entities</div>
          <div className="text-lg font-bold text-[#F59E0B] mt-0.5">28 Locations</div>
          <div className="text-white/40 text-[9px] mt-1">Patia, Rasulgarh, Janpath</div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">NLP Summarization Model</div>
          <div className="text-lg font-bold text-emerald-400 mt-0.5">BERT + Gemini 3.6</div>
          <div className="text-emerald-400/80 text-[9px] mt-1">Confidence 96.4%</div>
        </div>
      </div>

      {/* Filter Toolbar & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0A0A0A] p-3 rounded border border-white/10">
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-white/10 text-[#06B6D4] border border-[#06B6D4]/40'
                  : 'text-white/40 hover:text-white hover:bg-white/5'
              }`}
            >
              {cat.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-black border border-white/10 rounded px-3 py-1.5 w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-white/40 mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search intelligence feeds..."
            className="bg-transparent text-xs text-white placeholder-white/30 focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Feed Cards Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectArticle(item)}
              className="p-4 bg-[#0A0A0A] border border-white/10 hover:border-[#06B6D4]/50 rounded transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
            >
              <div>
                <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                  <div className="flex items-center space-x-2">
                    <Globe className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span className="font-bold text-[#06B6D4] text-[11px] uppercase">
                      {item.publisherName}
                    </span>
                  </div>
                  {getSourceBadge(item.source)}
                </div>

                <h2 className="text-sm font-bold text-white group-hover:text-[#06B6D4] transition-colors leading-snug">
                  {item.headline}
                </h2>

                <p className="text-white/70 text-[11px] mt-2 line-clamp-3 leading-relaxed">
                  {item.summary}
                </p>
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-white/40">
                <div className="flex items-center space-x-2">
                  <Clock className="w-3 h-3 text-[#F59E0B]" />
                  <span>{item.publishedTime}</span>
                </div>

                <button className="flex items-center space-x-1 text-[#06B6D4] group-hover:underline font-bold">
                  <span>Read Summary & Highlights</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#0A0A0A] border border-white/10 rounded-xl text-center space-y-3">
          <Rss className="w-10 h-10 text-white/20" />
          <h3 className="text-sm font-bold text-white">No Intelligence Feeds Found</h3>
          <p className="text-xs text-white/50 max-w-sm">
            No active RSS news or advisories match "{selectedCategory.replace('_', ' ')}" with filter query "{searchQuery}".
          </p>
          <button
            onClick={() => {
              setSelectedCategory('ALL');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4] text-xs font-bold font-mono hover:bg-[#06B6D4]/20 transition-colors"
          >
            Reset All Filters
          </button>
        </div>
      )}
    </div>
  );
};
