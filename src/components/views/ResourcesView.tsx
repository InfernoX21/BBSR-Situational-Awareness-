import React, { useState } from 'react';
import { ResourceUnit, Incident } from '../../types';
import {
  Radio,
  ShieldAlert,
  Flame,
  HeartPulse,
  Car,
  Search,
  CheckCircle,
  Clock,
  Navigation,
  Send,
  Fuel,
} from 'lucide-react';

interface ResourcesViewProps {
  resources: ResourceUnit[];
  incidents: Incident[];
  onDispatchUnit?: (unitId: string, incidentId: string) => void;
  onJumpToMap?: () => void;
}

interface UnitState {
  dispatched: boolean;
  incidentId: string;
}

export const ResourcesView: React.FC<ResourcesViewProps> = ({
  resources,
  incidents,
  onDispatchUnit,
  onJumpToMap,
}) => {
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [unitStates, setUnitStates] = useState<Record<string, UnitState>>({});

  // Fleet Roster Units (Static Roster - Telemetry Unlinked)
  const fleetUnits = [
    { id: 'PCR-01', name: 'Patia PCR Interceptor', type: 'Police Vehicles' },
    { id: 'PCR-04', name: 'Master Canteen PCR Patrol', type: 'Police Vehicles' },
    { id: 'FT-102', name: 'Rasulgarh Water Tender 1000L', type: 'Fire Engines' },
    { id: 'FT-108', name: 'Kalpana Square Ladder Truck', type: 'Fire Engines' },
    { id: 'AMB-05', name: 'Capital Hospital ALS Ambulance', type: 'Ambulances' },
    { id: 'AMB-12', name: 'AIIMS Emergency Transport', type: 'Ambulances' },
    { id: 'NDRF-BOAT-2', name: 'Daya River Inflatable Rescue Vessel', type: 'Response Teams' },
    { id: 'INSPECT-09', name: 'TPCODL High-Voltage Emergency Van', type: 'Response Teams' },
  ];

  const types = ['ALL', 'Police Vehicles', 'Fire Engines', 'Ambulances', 'Response Teams'];

  const filteredUnits = fleetUnits.filter((u) => {
    const matchesType = selectedType === 'ALL' || u.type === selectedType;
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getStatusBadge = (isDispatched: boolean) => {
    if (isDispatched) {
      return (
        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40">
          DISPATCHED (LOCAL)
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-950/40 text-amber-400 border border-amber-800/40">
        NO LIVE FEED
      </span>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'Fire Engines': return <Flame className="w-4 h-4 text-orange-400" />;
      case 'Ambulances': return <HeartPulse className="w-4 h-4 text-rose-400" />;
      case 'Response Teams': return <Radio className="w-4 h-4 text-emerald-400" />;
      default: return <Car className="w-4 h-4 text-cyan-400" />;
    }
  };

  const totalUnits = fleetUnits.length;
  const activeDispatches = Object.values(unitStates).filter((s: UnitState) => s.dispatched).length;
  const availableUnits = totalUnits - activeDispatches;

  return (
    <div className="flex-1 h-full bg-[#050505] p-6 overflow-y-auto font-mono text-xs flex flex-col space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#06B6D4]">
            <Radio className="w-5 h-5 animate-pulse" />
            <h1 className="text-lg font-bold uppercase tracking-wider text-white">
              Resources — Response Fleet &amp; Field Teams
            </h1>
            <span className="text-[10px] font-mono font-bold bg-amber-950/40 text-amber-400 border border-amber-800/40 px-2 py-0.5 rounded">
              NOT CONNECTED
            </span>
          </div>
          <p className="text-white/40 text-[11px] mt-0.5">
            Tactical Fleet Roster, Unit Dispatch Workflow & Map Navigation (Vehicle Telemetry Unlinked)
          </p>
        </div>

        {onJumpToMap && (
          <button
            onClick={onJumpToMap}
            className="px-3 py-1.5 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/40 hover:bg-[#06B6D4]/20 text-[#06B6D4] font-bold text-xs uppercase flex items-center space-x-2 transition-all"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>View Fleet on Live Map</span>
          </button>
        )}
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Total Field Assets</div>
          <div className="text-lg font-bold text-white mt-0.5">{totalUnits} Tactical Units</div>
          <div className="text-amber-400/80 text-[9px] mt-1">Telemetry: Not Connected</div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Ready / Available</div>
          <div className="text-lg font-bold text-[#10B981] mt-0.5">{availableUnits} Available</div>
          <div className="text-white/40 text-[9px] mt-1">Standby (Unassigned)</div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Active Dispatches</div>
          <div className="text-lg font-bold text-[#06B6D4] mt-0.5">{activeDispatches} Dispatched</div>
          <div className="text-white/40 text-[9px] mt-1">ETA Data Unavailable (No Routing Feed)</div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Telemetry & Fuel Sensor</div>
          <div className="text-lg font-bold text-amber-400/80 mt-0.5">Data Unavailable</div>
          <div className="text-white/40 text-[9px] mt-1">No IoT Telematics Feed</div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0A0A0A] p-3 rounded border border-white/10">
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all shrink-0 ${
                selectedType === t
                  ? 'bg-white/10 text-[#06B6D4] border border-[#06B6D4]/40'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-black border border-white/10 rounded px-3 py-1.5 w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-white/40 mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search callsign or unit..."
            className="bg-transparent text-xs text-white placeholder-white/30 focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Roster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
        {filteredUnits.map((unit) => {
          const unitState = unitStates[unit.id];
          const isDispatched = !!unitState?.dispatched;

          return (
            <div
              key={unit.id}
              className="p-4 bg-[#0A0A0A] border border-white/10 hover:border-white/20 rounded transition-all space-y-3"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(unit.type)}
                  <span className="font-bold text-white text-xs">{unit.id}</span>
                </div>
                {getStatusBadge(isDispatched)}
              </div>

              <div>
                <div className="font-bold text-[#06B6D4] text-xs">{unit.name}</div>
                <div className="text-white/40 text-[9px] uppercase mt-0.5">{unit.type}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px] p-2 bg-white/[0.02] rounded border border-white/5">
                <div>
                  <div className="text-white/40 flex items-center space-x-1">
                    <Fuel className="w-3 h-3 text-[#F59E0B]" />
                    <span>FUEL / BATT</span>
                  </div>
                  <div className="font-bold text-amber-400/80 mt-0.5">Data Unavailable</div>
                </div>

                <div>
                  <div className="text-white/40 flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-[#06B6D4]" />
                    <span>INCIDENT</span>
                  </div>
                  <div className={`font-bold mt-0.5 truncate ${isDispatched ? 'text-[#06B6D4]' : 'text-white/40'}`}>
                    {isDispatched ? (unitState?.incidentId || 'INC-ASSIGNED') : 'Unassigned'}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between pt-2 border-t border-white/5 text-[10px] text-white/40 gap-2">
                <span>GPS: Not Connected (Sector Standby)</span>
                <div className="flex items-center space-x-2">
                  {onJumpToMap && (
                    <button
                      onClick={onJumpToMap}
                      className="min-h-[44px] px-3 py-2 rounded bg-white/10 text-white font-bold uppercase hover:bg-white/20 transition-all flex items-center space-x-1 cursor-pointer active:scale-95"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>Map Jump</span>
                    </button>
                  )}
                  {!isDispatched && (
                    <button
                      onClick={() => {
                        const targetIncident = incidents.length > 0 ? incidents[0].id : 'INC-MANUAL-01';
                        setUnitStates((prev) => ({
                          ...prev,
                          [unit.id]: { dispatched: true, incidentId: targetIncident },
                        }));
                        if (onDispatchUnit) {
                          onDispatchUnit(unit.id, targetIncident);
                        }
                      }}
                      className="min-h-[44px] px-3 py-2 rounded bg-[#10B981]/20 text-[#10B981] font-bold uppercase hover:bg-[#10B981]/30 transition-all flex items-center space-x-1 cursor-pointer active:scale-95 border border-[#10B981]/40"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Dispatch</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

