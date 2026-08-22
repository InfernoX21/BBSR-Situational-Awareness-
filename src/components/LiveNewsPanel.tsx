import React, { useState } from 'react';
import { Video, Radio, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';

export interface NewsChannel {
  id: string;
  name: string;
  shortName: string;
  callsign: string;
  videoId: string;
  channelId: string;
  language: string;
  status: 'LIVE' | 'STANDBY' | 'OFFLINE';
  quality: string;
}

export const ODIA_NEWS_CHANNELS: NewsChannel[] = [
  {
    id: 'otv',
    name: 'OTV Odisha',
    shortName: 'OTV',
    callsign: 'OTV LIVE',
    videoId: 'cGZASpb4_9M',
    channelId: 'UC85oA2jOzeR81m0M67x0r6g',
    language: 'Odia',
    status: 'LIVE',
    quality: '1080p',
  },
  {
    id: 'kalinga',
    name: 'Kalinga TV',
    shortName: 'Kalinga',
    callsign: 'KALINGA LIVE',
    videoId: 'H__wXo3J9K4',
    channelId: 'UC45i_h9m9N5v1f-nUeO20aA',
    language: 'Odia',
    status: 'LIVE',
    quality: '1080p',
  },
  {
    id: 'news7',
    name: 'News7 Odisha',
    shortName: 'News7',
    callsign: 'NEWS7 LIVE',
    videoId: '1R_0-3GkFMo',
    channelId: 'UCxS_yJk0fK1tP1eA5lK7R6g',
    language: 'Odia',
    status: 'LIVE',
    quality: '1080p',
  },
  {
    id: 'kanak',
    name: 'Kanak News',
    shortName: 'Kanak',
    callsign: 'KANAK LIVE',
    videoId: 'QKar1sXiCDU',
    channelId: 'UCcT6I2pbg0iC-347t_RngDA',
    language: 'Odia',
    status: 'LIVE',
    quality: '1080p',
  },
];

interface LiveNewsPanelProps {
  className?: string;
}

export const LiveNewsPanel: React.FC<LiveNewsPanelProps> = ({ className = '' }) => {
  const [activeChannelId, setActiveChannelId] = useState<string>('otv');
  const [hasStreamError, setHasStreamError] = useState<boolean>(false);
  const [useChannelFallback, setUseChannelFallback] = useState<boolean>(false);

  const activeChannel = ODIA_NEWS_CHANNELS.find((c) => c.id === activeChannelId) || ODIA_NEWS_CHANNELS[0];

  const handleChannelSelect = (id: string) => {
    setActiveChannelId(id);
    setHasStreamError(false);
    setUseChannelFallback(false);
  };

  const getEmbedUrl = (channel: NewsChannel) => {
    if (useChannelFallback && channel.channelId) {
      return `https://www.youtube.com/embed/live_stream?channel=${channel.channelId}&autoplay=1&mute=1&controls=1&modestbranding=1&rel=0`;
    }
    return `https://www.youtube.com/embed/${channel.videoId}?autoplay=1&mute=1&controls=1&modestbranding=1&rel=0`;
  };

  return (
    <div className={`border border-white/10 bg-white/[0.02] rounded p-2 flex flex-col justify-between overflow-hidden ${className}`}>
      {/* Header & Channel Selector Bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-1 text-[9px] font-bold uppercase tracking-widest gap-1">
        <div className="flex items-center gap-1.5 truncate">
          <Radio className="w-3 h-3 text-[#EF4444] animate-pulse shrink-0" />
          <span className="text-white/80 font-bold truncate">LIVE ODIA NEWS</span>
        </div>

        {/* Compact Channel Selector Buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {ODIA_NEWS_CHANNELS.map((ch) => {
            const isActive = ch.id === activeChannelId;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => handleChannelSelect(ch.id)}
                className={`px-1.5 py-0.5 rounded text-[8px] font-mono transition-all uppercase ${
                  isActive
                    ? 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/50 font-bold shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white border border-transparent'
                }`}
                title={`Switch to ${ch.name}`}
              >
                {ch.shortName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Embedded Live Video Player Area */}
      <div className="relative w-full flex-1 rounded overflow-hidden bg-black border border-white/10 mt-1 flex flex-col justify-between">
        {!hasStreamError ? (
          <div className="relative w-full h-full bg-black overflow-hidden group">
            <iframe
              key={`${activeChannel.id}-${useChannelFallback}`}
              src={getEmbedUrl(activeChannel)}
              title={`${activeChannel.name} Official YouTube Live Stream`}
              className="w-full h-full border-0 pointer-events-auto"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              onError={() => setHasStreamError(true)}
            />

            {/* Tactical Live Badge Overlay */}
            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-red-600/90 text-white font-mono text-[8px] font-bold flex items-center gap-1 shadow pointer-events-none z-10">
              <span className="w-1 h-1 rounded-full bg-white animate-ping" />
              <span>{activeChannel.callsign}</span>
            </div>

            {/* Tactical Signal Status & Info Overlay */}
            <div className="absolute top-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[7px] text-[#10B981] font-mono border border-white/10 flex items-center gap-1 pointer-events-none z-10">
              <span className="w-1 h-1 rounded-full bg-[#10B981] animate-pulse" />
              <span>SIGNAL ACTIVE · {activeChannel.quality}</span>
            </div>
          </div>
        ) : (
          /* Offline / Error State Container */
          <div className="w-full h-full bg-black/90 p-3 flex flex-col items-center justify-center text-center space-y-1.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
            <div className="text-[10px] font-bold text-zinc-200 uppercase font-mono">
              {activeChannel.name} STREAM OFFLINE / AWAITING RE-BROADCAST
            </div>
            <p className="text-[8px] text-zinc-400 font-mono">
              Primary YouTube broadcast link unreachable. Try channel fallback mode.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setUseChannelFallback(!useChannelFallback)}
                className="px-2 py-1 rounded bg-[#06B6D4]/20 hover:bg-[#06B6D4]/30 text-[#06B6D4] border border-[#06B6D4]/40 text-[8px] font-mono flex items-center gap-1"
              >
                <RefreshCw className="w-2.5 h-2.5" />
                <span>LOAD CHANNEL LIVE FEED</span>
              </button>
              <a
                href={`https://www.youtube.com/watch?v=${activeChannel.videoId}`}
                target="_blank"
                rel="noreferrer"
                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 text-[8px] font-mono flex items-center gap-1"
              >
                <span>OPEN YOUTUBE</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>
        )}

        {/* Bottom Ticker Bar inside Video Panel */}
        <div className="px-2 py-1 bg-[#050505] text-[8px] font-mono text-white/70 flex justify-between items-center border-t border-white/10 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-[#06B6D4] truncate">{activeChannel.name}</span>
            <span className="text-white/30">|</span>
            <span className="text-white/50 truncate">Real-Time Odisha Intelligence Stream</span>
          </div>
          <a
            href={`https://www.youtube.com/watch?v=${activeChannel.videoId}`}
            target="_blank"
            rel="noreferrer"
            className="text-[#06B6D4] hover:underline font-semibold text-[7px] shrink-0 ml-1"
          >
            YOUTUBE ↗
          </a>
        </div>
      </div>
    </div>
  );
};
