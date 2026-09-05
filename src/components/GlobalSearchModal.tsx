import React, { useState, useEffect } from 'react';
import { Search, MapPin, AlertTriangle, Car, Camera, Building2, X } from 'lucide-react';
import { arkaNav } from '../store/useArka';

interface SearchResult {
  id: string;
  title: string;
  category: 'ROAD' | 'INCIDENT' | 'CAMERA' | 'INFRASTRUCTURE' | 'LOCATION';
  subtitle: string;
  lat?: number;
  lng?: number;
  tab: any;
}

const SEARCH_INDEX: SearchResult[] = [
  { id: 'res-1', title: 'Khandagiri Square Intersection', category: 'LOCATION', subtitle: 'NH-16 Bypass, Bhubaneswar', lat: 20.2580, lng: 85.7865, tab: 'Live Map' },
  { id: 'res-2', title: 'Jayadev Vihar Overbridge', category: 'LOCATION', subtitle: 'Janpath Junction, Bhubaneswar', lat: 20.2961, lng: 85.8245, tab: 'Live Map' },
  { id: 'res-3', title: 'INCIDENT #ARKA-9021', category: 'INCIDENT', subtitle: 'Multi-vehicle collision & spill', lat: 20.2961, lng: 85.8245, tab: 'Incident Center' },
  { id: 'res-4', title: 'CCTV Cam #101 (Jayadev Vihar)', category: 'CAMERA', subtitle: 'Nandan Kanan Rd Junction', lat: 20.2965, lng: 85.8248, tab: 'Traffic Cameras' },
  { id: 'res-5', title: 'Capital Hospital Unit 6', category: 'INFRASTRUCTURE', subtitle: 'Emergency Referral Facility', lat: 20.2712, lng: 85.8288, tab: 'Infrastructure' },
  { id: 'res-6', title: 'NH-16 Jayadev - Khandagiri Corridor', category: 'ROAD', subtitle: 'High Volume Transit Route', lat: 20.2850, lng: 85.8050, tab: 'Traffic Management' },
  { id: 'res-7', title: '108 ALS Ambulance Squad 4', category: 'LOCATION', subtitle: 'Emergency Response Vehicle', lat: 20.2920, lng: 85.8210, tab: 'Resource Tracker' },
  { id: 'res-8', title: 'Vani Vihar Rotary', category: 'LOCATION', subtitle: 'Utkal University Gate, Janpath', lat: 20.2990, lng: 85.8390, tab: 'Live Map' }
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else setQuery('');
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const results = query.trim()
    ? SEARCH_INDEX.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.subtitle.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_INDEX.slice(0, 5);

  const getCategoryIcon = (cat: SearchResult['category']) => {
    switch (cat) {
      case 'INCIDENT': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'CAMERA': return <Camera className="w-4 h-4 text-purple-400" />;
      case 'ROAD': return <Car className="w-4 h-4 text-amber-400" />;
      case 'INFRASTRUCTURE': return <Building2 className="w-4 h-4 text-blue-400" />;
      default: return <MapPin className="w-4 h-4 text-orange-400" />;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-start justify-center pt-20 p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-2xl w-full text-zinc-100 shadow-2xl overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 border-b border-zinc-800 flex items-center gap-3 bg-zinc-900/60">
          <Search className="w-5 h-5 text-orange-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search roads, intersections, vehicles, incidents, cameras, cases, infrastructure... (e.g. 'Khandagiri')"
            className="w-full bg-transparent text-sm font-mono text-zinc-100 placeholder-zinc-500 focus:outline-none"
            autoFocus
          />
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 divide-y divide-zinc-900">
          {results.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-zinc-500">
              No matching city entity found for "{query}"
            </div>
          ) : (
            results.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  arkaNav.goTo(item.tab);
                  onClose();
                }}
                className="p-3 hover:bg-zinc-900/80 rounded transition cursor-pointer flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-900 rounded border border-zinc-800 group-hover:border-orange-500/40">
                    {getCategoryIcon(item.category)}
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-zinc-200 group-hover:text-orange-400 font-mono">
                      {item.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400">{item.subtitle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                    {item.category}
                  </span>
                  <span className="text-xs text-orange-400 font-mono opacity-0 group-hover:opacity-100 transition">
                    OPEN &rarr;
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-2.5 bg-zinc-900/40 border-t border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-500">
          <span>Tip: Press ESC to close</span>
          <span>ARKA Global City Index</span>
        </div>
      </div>
    </div>
  );
};
