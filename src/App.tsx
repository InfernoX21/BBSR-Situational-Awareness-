import React, { useState, useEffect } from 'react';
import {
  NavItem,
  Agency,
  Incident,
  IntelligenceItem,
  ResourceUnit,
  DroneUnit,
  LandmarkNode,
  MapLayersState,
  WeatherData,
  Severity,
  LiveLog,
  TrafficCorridor,
  TrafficSensor,
  TrafficSummary,
} from './types';
import { liveDataManager } from './services/LiveDataManager';
import {
  BHUBANESWAR_CENTER,
  AGENCIES,
  INITIAL_WEATHER,
  INITIAL_INCIDENTS,
  LANDMARKS,
  RESOURCE_UNITS,
  DRONE_UNITS,
  INITIAL_INTELLIGENCE,
  INITIAL_LOGS,
  INITIAL_TRAFFIC_CORRIDORS,
  INITIAL_TRAFFIC_SENSORS,
  INITIAL_TRAFFIC_SUMMARY,
} from './data/bhubaneswarData';
import { Sidebar } from './components/Sidebar';
import { TopStatusBar } from './components/TopStatusBar';
import { DigitalTwinMap } from './components/DigitalTwinMap';
import { IncidentPopup } from './components/IncidentPopup';
import { RightIntelligenceCenter } from './components/RightIntelligenceCenter';
import { BottomAnalytics } from './components/BottomAnalytics';
import { BottomLogBar } from './components/BottomLogBar';
import { IncidentDetailModal } from './components/IncidentDetailModal';
import { NewsArticleModal } from './components/NewsArticleModal';
import { DroneFeedModal } from './components/DroneFeedModal';
import { LogsModal } from './components/LogsModal';

import { IntelligenceFeedView } from './components/views/IntelligenceFeedView';
import { IncidentCenterView } from './components/views/IncidentCenterView';
import { TrafficManagementView } from './components/views/TrafficManagementView';
import { WeatherDisasterView } from './components/views/WeatherDisasterView';
import { InfrastructureView } from './components/views/InfrastructureView';
import { UtilitiesView } from './components/views/UtilitiesView';
import { ResourceTrackerView } from './components/views/ResourceTrackerView';
import { DroneFeedView } from './components/views/DroneFeedView';
import { AnalyticsView } from './components/views/AnalyticsView';
import { ReportsView } from './components/views/ReportsView';
import { SettingsView } from './components/views/SettingsView';

export default function App() {
  const [activeTab, setActiveTab] = useState<NavItem>('Dashboard');
  const [agencies, setAgencies] = useState<Agency[]>(AGENCIES);
  const [incidents, setIncidents] = useState<Incident[]>(INITIAL_INCIDENTS);
  const [intelligenceItems, setIntelligenceItems] = useState<IntelligenceItem[]>(INITIAL_INTELLIGENCE);
  const [weather, setWeather] = useState<WeatherData>(INITIAL_WEATHER);
  const [resources, setResources] = useState<ResourceUnit[]>(RESOURCE_UNITS);
  const [drones, setDrones] = useState<DroneUnit[]>(DRONE_UNITS);
  const [landmarks, setLandmarks] = useState<LandmarkNode[]>(LANDMARKS);
  const [logs, setLogs] = useState<LiveLog[]>(INITIAL_LOGS);
  const [threatLevel, setThreatLevel] = useState<Severity>('HIGH');

  // Traffic State
  const [trafficCorridors, setTrafficCorridors] = useState<TrafficCorridor[]>(INITIAL_TRAFFIC_CORRIDORS);
  const [trafficSensors, setTrafficSensors] = useState<TrafficSensor[]>(INITIAL_TRAFFIC_SENSORS);
  const [trafficSummary, setTrafficSummary] = useState<TrafficSummary>(INITIAL_TRAFFIC_SUMMARY);
  const [selectedCorridor, setSelectedCorridor] = useState<TrafficCorridor | null>(null);

  const [layersState, setLayersState] = useState<MapLayersState>({
    traffic: true,
    weather: true,
    incidents: true,
    utilities: true,
    infrastructure: true,
    cameras: true,
    drones: true,
    hospitals: true,
    schools: false,
    police: true,
    fire: true,
    telecom: false,
    power: true,
    water: true,
    floodZones: true,
    satellite: false,
    heatmaps: false,
    buildings3D: true,
  });

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailModalIncident, setDetailModalIncident] = useState<Incident | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<IntelligenceItem | null>(null);
  const [selectedDrone, setSelectedDrone] = useState<DroneUnit | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkNode | null>(null);

  const [isFusing, setIsFusing] = useState(false);
  const [fusedIncident, setFusedIncident] = useState<Incident | null>(INITIAL_INCIDENTS[0]);
  const [showLogsModal, setShowLogsModal] = useState(false);

  // Add a helper to prepend logs
  const addLog = (message: string, type: LiveLog['type'] = 'INFO') => {
    const newLog: LiveLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour12: false }),
      message,
      type,
    };
    setLogs((prev) => [newLog, ...prev]);
  };

  // Fetch Live Intelligence RSS & Weather on mount
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res = await fetch('/api/news/bhubaneswar');
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          setIntelligenceItems(json.data);
          addLog('Bhubaneswar Intelligence RSS feeds synchronized from live sources.', 'SUCCESS');
        }
      } catch (e) {
        console.warn('News API fetch failed, using fallback data');
      }
    };

    const fetchWeather = async () => {
      try {
        const res = await fetch('/api/weather/live');
        const json = await res.json();
        if (json.success && json.data) {
          setWeather(json.data);
        }
      } catch (e) {
        console.warn('Weather API fetch failed');
      }
    };

    const fetchTraffic = async () => {
      try {
        const res = await fetch('/api/traffic/live');
        const json = await res.json();
        if (json.success) {
          setTrafficCorridors(json.corridors);
          setTrafficSensors(json.sensors);
          setTrafficSummary(json.summary);
        }
      } catch (e) {
        console.warn('Traffic API fetch failed');
      }
    };

    fetchNews();
    fetchWeather();
    fetchTraffic();

    // 5-second interval for live traffic sensors & corridor telemetry update
    const trafficInterval = setInterval(fetchTraffic, 5000);

    // Periodic simulation ticker for telemetry updates
    const interval = setInterval(() => {
      setDrones((prevDrones) =>
        prevDrones.map((d) => ({
          ...d,
          battery: d.battery > 20 ? d.battery - 1 : 95,
          speedKmh: Math.floor(20 + Math.random() * 30),
        }))
      );
    }, 15000);

    return () => {
      clearInterval(interval);
      clearInterval(trafficInterval);
    };
  }, []);

  // AI Fusion Handler calling backend Gemini API
  const handleFuseIntelligence = async () => {
    setIsFusing(true);
    addLog('Initiated Gemini 3.6 Flash Multi-Modal Intelligence Fusion...', 'INFO');

    try {
      const res = await fetch('/api/gemini/fuse-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newsItems: intelligenceItems,
          weather,
          activeIncidents: incidents,
        }),
      });

      const json = await res.json();

      if (json.fusedIncident) {
        const newInc = json.fusedIncident as Incident;
        setFusedIncident(newInc);
        // Prepend fused incident if not already present
        setIncidents((prev) => [newInc, ...prev.filter((i) => i.id !== newInc.id)]);
        setSelectedIncident(newInc);
        addLog(`AI Fusion generated new incident #${newInc.id} (${newInc.priority}) with ${newInc.aiConfidence}% confidence.`, 'ALERT');
      }
    } catch (err) {
      addLog('AI Fusion engine error, fallback applied.', 'WARN');
    } finally {
      setIsFusing(false);
    }
  };

  const handleRefreshAll = () => {
    addLog('Refreshing all C2 sensors & intelligence feeds...', 'INFO');
    handleFuseIntelligence();
  };

  const handleUpdateIncidentStatus = (id: string, newStatus: Incident['status']) => {
    setIncidents((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: newStatus } : i))
    );
    if (selectedIncident && selectedIncident.id === id) {
      setSelectedIncident({ ...selectedIncident, status: newStatus });
    }
    if (detailModalIncident && detailModalIncident.id === id) {
      setDetailModalIncident({ ...detailModalIncident, status: newStatus });
    }
    addLog(`Incident #${id} status updated to ${newStatus}.`, 'SUCCESS');
  };

  return (
    <div className="w-screen h-screen bg-[#050505] flex flex-col overflow-hidden text-[#D1D5DB] font-sans">
      {/* LAYER 2: TOP STATUS BAR */}
      <TopStatusBar
        weather={weather}
        threatLevel={threatLevel}
        setThreatLevel={setThreatLevel}
        onFuseIntelligence={handleFuseIntelligence}
        isFusing={isFusing}
        onRefreshAll={handleRefreshAll}
      />

      {/* MAIN CONTAINER: SIDEBAR + DIGITAL TWIN + INTELLIGENCE CENTER */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LAYER 1: LEFT SIDEBAR (260px) */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          agencies={agencies}
          onAgencyClick={(agency) => {
            addLog(`Selected Agency: ${agency.name} (${agency.activeUnits} active field units).`, 'INFO');
          }}
        />

        {/* MAIN WORKSPACE AREA ACCORDING TO ACTIVE TAB */}
        {activeTab === 'Dashboard' || activeTab === 'Live Map' ? (
          <>
            {/* MAIN DIGITAL TWIN MAP */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
              <DigitalTwinMap
                incidents={incidents}
                landmarks={landmarks}
                drones={drones}
                layersState={layersState}
                setLayersState={setLayersState}
                weather={weather}
                trafficCorridors={trafficCorridors}
                trafficSensors={trafficSensors}
                trafficSummary={trafficSummary}
                activeTab={activeTab}
                onSelectIncident={(inc) => setSelectedIncident(inc)}
                selectedIncident={selectedIncident}
                onSelectLandmark={(lm) => {
                  setSelectedLandmark(lm);
                  addLog(`Landmark inspect: ${lm.name} (${lm.type}).`, 'INFO');
                }}
                onSelectDrone={(d) => setSelectedDrone(d)}
                onSelectCorridor={(corridor) => {
                  setSelectedCorridor(corridor);
                  addLog(`Traffic Corridor Telemetry: ${corridor.name} (${corridor.avgSpeedKmh} km/h - ${corridor.congestionLevel}).`, 'INFO');
                }}
                selectedCorridor={selectedCorridor}
              />

              {/* FLOATING INCIDENT POPUP */}
              <IncidentPopup
                incident={selectedIncident}
                onClose={() => setSelectedIncident(null)}
                onViewDetails={(inc) => setDetailModalIncident(inc)}
              />

              {/* BOTTOM ANALYTICS PANELS */}
              <BottomAnalytics
                incidents={incidents}
                resources={resources}
                weather={weather}
                trafficCorridors={trafficCorridors}
                trafficSummary={trafficSummary}
              />
            </div>

            {/* RIGHT INTELLIGENCE CENTER */}
            {activeTab === 'Dashboard' && (
              <RightIntelligenceCenter
                incidents={incidents}
                intelligenceItems={intelligenceItems}
                fusedIncident={fusedIncident}
                onFuseIntelligence={handleFuseIntelligence}
                isFusing={isFusing}
                onSelectIncident={(inc) => {
                  setSelectedIncident(inc);
                  addLog(`Selected incident #${inc.id} from Intelligence Center.`, 'INFO');
                }}
                onOpenArticle={(item) => setSelectedArticle(item)}
                onViewAllAlerts={() => setActiveTab('Incident Center')}
              />
            )}
          </>
        ) : activeTab === 'Intelligence Feed' ? (
          <IntelligenceFeedView
            intelligenceItems={intelligenceItems}
            onSelectArticle={(item) => setSelectedArticle(item)}
            onFuseIntelligence={handleFuseIntelligence}
            isFusing={isFusing}
          />
        ) : activeTab === 'Incident Center' ? (
          <IncidentCenterView
            incidents={incidents}
            onSelectIncident={(inc) => setSelectedIncident(inc)}
            onUpdateStatus={handleUpdateIncidentStatus}
            onJumpToMap={(inc) => {
              setSelectedIncident(inc);
              setActiveTab('Dashboard');
            }}
          />
        ) : activeTab === 'Traffic Management' ? (
          <TrafficManagementView
            corridors={trafficCorridors}
            sensors={trafficSensors}
            summary={trafficSummary}
            onSelectCorridor={(corridor) => setSelectedCorridor(corridor)}
            onJumpToMap={() => setActiveTab('Dashboard')}
          />
        ) : activeTab === 'Weather & Disaster' ? (
          <WeatherDisasterView
            weather={weather}
            onJumpToMap={() => setActiveTab('Dashboard')}
          />
        ) : activeTab === 'Infrastructure' ? (
          <InfrastructureView
            landmarks={landmarks}
            onSelectLandmark={(lm) => {
              setSelectedLandmark(lm);
              addLog(`Inspecting Landmark: ${lm.name}`, 'INFO');
            }}
            onJumpToMap={() => setActiveTab('Dashboard')}
          />
        ) : activeTab === 'Utilities' ? (
          <UtilitiesView onJumpToMap={() => setActiveTab('Dashboard')} />
        ) : activeTab === 'Resource Tracker' ? (
          <ResourceTrackerView
            resources={resources}
            incidents={incidents}
            onDispatchUnit={(uId, iId) => addLog(`Dispatched Unit ${uId} to Incident ${iId}`, 'SUCCESS')}
            onJumpToMap={() => setActiveTab('Dashboard')}
          />
        ) : activeTab === 'Drone Feed' ? (
          <DroneFeedView
            drones={drones}
            onSelectDrone={(d) => setSelectedDrone(d)}
            onJumpToMap={() => setActiveTab('Dashboard')}
          />
        ) : activeTab === 'Analytics' ? (
          <AnalyticsView
            incidents={incidents}
            trafficCorridors={trafficCorridors}
            weather={weather}
          />
        ) : activeTab === 'Reports' ? (
          <ReportsView
            incidents={incidents}
            weather={weather}
            trafficSummary={trafficSummary}
          />
        ) : activeTab === 'Settings' ? (
          <SettingsView
            layersState={layersState}
            setLayersState={setLayersState}
          />
        ) : null}
      </div>

      {/* LAYER 7: BOTTOM LIVE LOG BAR */}
      <BottomLogBar logs={logs} onOpenLogsModal={() => setShowLogsModal(true)} />

      {/* DEEP INSPECTION MODALS */}
      {detailModalIncident && (
        <IncidentDetailModal
          incident={detailModalIncident}
          onClose={() => setDetailModalIncident(null)}
          onUpdateStatus={handleUpdateIncidentStatus}
        />
      )}

      {selectedArticle && (
        <NewsArticleModal item={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}

      {selectedDrone && (
        <DroneFeedModal drone={selectedDrone} onClose={() => setSelectedDrone(null)} />
      )}

      {showLogsModal && (
        <LogsModal
          logs={logs}
          onClose={() => setShowLogsModal(false)}
          onClearLogs={() => setLogs([])}
        />
      )}
    </div>
  );
}
