import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollText, WifiOff } from 'lucide-react';
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
import { AppShell, ShellTicker } from './shell/AppShell';
import type { NavCounts } from './shell/NavRail';
import { Button, NotificationProvider } from './ui';
import { MobileAIBottomSheet } from './components/ai/MobileAIBottomSheet';
import { offlineManager } from './services/offline/OfflineManager';
import { DigitalTwinMap } from './components/DigitalTwinMap';
import { IncidentPopup } from './components/IncidentPopup';
import { RightIntelligenceCenter } from './components/RightIntelligenceCenter';
import { BottomAnalytics } from './components/BottomAnalytics';
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
import { AIOperationsView } from './components/views/AIOperationsView';
import { TrafficCamerasView } from './components/views/TrafficCamerasView';

/** Log severity mapped onto the ticker's tones. */
const LOG_TONE: Record<LiveLog['type'], 'critical' | 'warning' | 'success' | 'neutral'> = {
  ALERT: 'critical',
  WARN: 'warning',
  SUCCESS: 'success',
  INFO: 'neutral',
};

/**
 * Modules whose page component owns its own scrolling.
 *
 * A page built on `ui/surfaces`' `Page` is a flex column with its own scroll
 * container and a sticky `PageHeader`; nesting it inside a second scroller would
 * give it two scrollbars and unstick the header. Modules not listed here are the
 * ones still on the old markup, which expects the shell to scroll for them. The
 * set shrinks as views migrate, and this constant disappears with the last one.
 */
const PAGE_OWNS_SCROLL = new Set<NavItem>(['Drone Feed', 'Infrastructure', 'Reports']);

export default function App() {
  const [activeTab, setActiveTab] = useState<NavItem>('Dashboard');
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  useEffect(() => {
    const unsub = offlineManager.subscribe((online) => setIsOffline(!online));
    return () => unsub();
  }, []);

  const [agencies] = useState<Agency[]>(AGENCIES);
  const [incidents, setIncidents] = useState<Incident[]>(INITIAL_INCIDENTS);
  const [intelligenceItems, setIntelligenceItems] = useState<IntelligenceItem[]>(INITIAL_INTELLIGENCE);
  const [weather, setWeather] = useState<WeatherData>(INITIAL_WEATHER);
  const [resources] = useState<ResourceUnit[]>(RESOURCE_UNITS);
  const [drones, setDrones] = useState<DroneUnit[]>(DRONE_UNITS);
  const [landmarks] = useState<LandmarkNode[]>(LANDMARKS);
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
    // Heavy assets stay off until requested. `CentralLayerManager` holds the same
    // defaults; the two must agree or the toolbar's first event flips the map.
    satellite: false,
    heatmaps: false,
    buildings3D: false,
    basemapStyle: 'dark',
  });

  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailModalIncident, setDetailModalIncident] = useState<Incident | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<IntelligenceItem | null>(null);
  const [selectedDrone, setSelectedDrone] = useState<DroneUnit | null>(null);
  const [selectedLandmark, setSelectedLandmark] = useState<LandmarkNode | null>(null);

  const [isFusing, setIsFusing] = useState(false);
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

  // Real-Time Live Weather Fetcher
  const fetchLiveWeather = useCallback(async () => {
    const startTime = Date.now();
    let fetchedData: WeatherData | null = null;

    try {
      const res = await fetch('/api/weather/live');
      const json = await res.json();
      if (json.success && json.data) {
        fetchedData = json.data;
      }
    } catch (e) {
      // Fallback to direct client-side fetch from Open-Meteo API
    }

    if (!fetchedData) {
      try {
        const url = 'https://api.open-meteo.com/v1/forecast?latitude=20.2961&longitude=85.8245&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,precipitation,surface_pressure';
        const res = await fetch(url);
        const data = await res.json();
        const curr = data.current || {};
        const latency = Date.now() - startTime;
        const timeStr = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

        const code = curr.weather_code ?? 0;
        let condition = 'Partly Cloudy';
        if (code === 0) condition = 'Clear Sky';
        else if (code >= 1 && code <= 3) condition = 'Partly Cloudy';
        else if (code >= 45 && code <= 48) condition = 'Fog & Mist';
        else if (code >= 51 && code <= 65) condition = 'Moderate Rain';
        else if (code >= 80 && code <= 82) condition = 'Rain Showers';
        else if (code >= 95) condition = 'Scattered Thunderstorms';

        if ((curr.precipitation ?? 0) > 0) {
          condition = (curr.precipitation ?? 0) > 10 ? 'Heavy Rain / Thunderstorm' : 'Light Rain Showers';
        }

        fetchedData = {
          temperature: Number((curr.temperature_2m ?? 31.8).toFixed(1)),
          humidity: Math.round(curr.relative_humidity_2m ?? 79),
          windSpeed: Number((curr.wind_speed_10m ?? 14.2).toFixed(1)),
          windDirection: 'SW',
          rainIntensity: Number((curr.precipitation ?? 0).toFixed(1)),
          condition,
          visibility: 8.5,
          floodRiskLevel: (curr.precipitation ?? 0) > 10 ? 'HIGH' : (curr.precipitation ?? 0) > 2 ? 'MODERATE' : 'LOW',
          forecast: 'Continuous satellite radar monitoring active for Khordha District.',
          provenance: {
            source: 'Open-Meteo & IMD radar',
            timestamp: new Date().toISOString(),
            provider: 'IMD Bhubaneswar',
            // No confidence: Open-Meteo publishes a model reading, not a score.
            latencyMs: latency,
            lastUpdated: timeStr,
            classification: 'LIVE',
          },
          connectionStatus: 'CONNECTED',
        };
      } catch (err) {
        console.warn('Weather fetch fallback error:', err);
      }
    }

    if (fetchedData) {
      // Passed through exactly as received. The previous build jittered the
      // temperature and humidity by ±0.1 and overwrote latency with a random
      // 14–22 ms so the readout always looked alive; both invented data.
      setWeather(fetchedData);
      liveDataManager.updateHealth(
        'weather',
        'CONNECTED',
        fetchedData.provenance?.latencyMs ?? Date.now() - startTime,
        'Open-Meteo & IMD Doppler Radar Mesh active',
        'LIVE',
      );
    }
  }, []);

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
    fetchLiveWeather();
    fetchTraffic();

    // Real-time intervals
    const weatherInterval = setInterval(fetchLiveWeather, 6000);
    const trafficInterval = setInterval(fetchTraffic, 5000);

    // Periodic simulation ticker for drone telemetry updates
    const interval = setInterval(() => {
      setDrones((prevDrones) =>
        prevDrones.map((d) => ({
          ...d,
          battery: d.battery > 20 ? d.battery - 1 : 95,
          speedKmh: Math.floor(20 + Math.random() * 30),
        }))
      );
    }, 15000);

    // Removed: a seven-entry pool of pre-written headlines was pushed into the
    // intelligence feed every twelve seconds, each stamped "Just now" and
    // attributed to BMC, OSDMA, TPCODL and WatCo. Nothing produced them. The
    // feed now shows only what /api/news/bhubaneswar returns.

    return () => {
      clearInterval(interval);
      clearInterval(weatherInterval);
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

    // Persist to server store asynchronously
    fetch(`/api/incidents/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).catch((err) => console.warn('Failed to persist incident status to server:', err));

    const targetInc = incidents.find((i) => i.id === id);
    const titleStr = targetInc ? `"${targetInc.title}"` : `#${id}`;

    if (newStatus === 'RESOLVED') {
      addLog(`[RESOLVED] Incident #${id} ${titleStr} marked as RESOLVED. Containment operations completed.`, 'SUCCESS');
    } else if (newStatus === 'CONTAINED') {
      addLog(`[CONTAINED] Incident #${id} ${titleStr} marked as CONTAINED. Perimeter secured.`, 'SUCCESS');
    } else if (newStatus === 'DISPATCHED') {
      addLog(`[DISPATCHED] Emergency field unit dispatched to Incident #${id} ${titleStr}.`, 'ALERT');
    } else {
      addLog(`Incident #${id} ${titleStr} status updated to ${newStatus}.`, 'INFO');
    }
  };

  /**
   * Unresolved work per module, for the rail.
   *
   * Only counts ARKA can actually establish. There is deliberately no badge on
   * Intelligence Feed or Drone Feed: a headline count is not a task list, and a
   * number there would read as work waiting on the operator.
   */
  const navCounts = useMemo<NavCounts>(
    () => ({
      'Incident Center': incidents.filter((i) => i.status !== 'RESOLVED').length,
    }),
    [incidents],
  );

  const tickerItems = useMemo(
    () =>
      logs.slice(0, 14).map((log) => ({
        id: log.id,
        label: `${log.timestamp}  ${log.message}`,
        tone: LOG_TONE[log.type],
      })),
    [logs],
  );

  const isMapModule = activeTab === 'Dashboard' || activeTab === 'Live Map';

  return (
    <NotificationProvider>
      <AppShell
        active={activeTab}
        onNavigate={setActiveTab}
        counts={navCounts}
        alertLevel={threatLevel}
        onAlertLevelChange={setThreatLevel}
        banner={
          isOffline ? (
            <div
              role="status"
              className="shrink-0 bg-warning-soft border-b border-warning-border text-warning px-3 py-1.5 text-[11.5px] font-medium flex items-center justify-center gap-2"
            >
              <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>
                Network offline — ARKA is running on cached data with a local draft queue. Values shown may be stale.
              </span>
            </div>
          ) : null
        }
        ticker={
          <ShellTicker
            items={tickerItems}
            right={
              <Button
                variant="quiet"
                size="xs"
                icon={<ScrollText size={11} />}
                onClick={() => setShowLogsModal(true)}
              >
                Event log
              </Button>
            }
          />
        }
      >
        {isMapModule ? (
          <div className="flex-1 flex min-w-0 min-h-0">
            {/* MAIN DIGITAL TWIN MAP */}
            <div className="flex-1 flex flex-col relative overflow-hidden min-w-0 min-h-0">
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
                resources={resources}
                onSelectIncident={(inc) => {
                  setSelectedIncident(inc);
                  addLog(`Selected incident #${inc.id} from Intelligence Center.`, 'INFO');
                }}
                onOpenArticle={(item) => setSelectedArticle(item)}
                onViewAllAlerts={() => setActiveTab('Incident Center')}
              />
            )}
          </div>
        ) : (
          <div
            className={
              PAGE_OWNS_SCROLL.has(activeTab)
                ? 'flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden'
                : 'flex-1 min-w-0 min-h-0 overflow-y-auto ark-scroll'
            }
          >
            {activeTab === 'AI Operations' ? (
              <AIOperationsView
                incidents={incidents}
                landmarks={landmarks}
                drones={drones}
                weather={weather}
                trafficCorridors={trafficCorridors}
                intelligenceItems={intelligenceItems}
                onApplyStateChanges={(changes) => {
                  if (changes?.targetLocation) {
                    setSelectedIncident({
                      id: `TARGET-OPENCLAW-${Date.now()}`,
                      title: changes.targetLocation.name,
                      category: 'FLOOD',
                      priority: 'CRITICAL',
                      status: 'ACTIVE',
                      description: `Target location selected by OpenClaw Autonomous Operations: ${changes.targetLocation.name}`,
                      location: {
                        name: changes.targetLocation.name,
                        lat: changes.targetLocation.lat,
                        lng: changes.targetLocation.lng,
                        address: `${changes.targetLocation.name}, Bhubaneswar`,
                      },
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                      agencyAssigned: 'OpenClaw Autonomous Task Force',
                      aiConfidence: 98,
                      recommendedAction: 'Execute multi-agent response protocol.',
                      affectedRoads: ['Central Corridor'],
                      estimatedImpact: 'High Priority Target',
                    });
                  }
                  if (changes?.layersToEnable) {
                    setLayersState((prev) => {
                      const next = { ...prev };
                      changes.layersToEnable?.forEach((lId) => {
                        if (lId in next) (next as any)[lId] = true;
                      });
                      return next;
                    });
                  }
                  addLog(`OpenClaw Autonomous Operations executed multi-agent task workflow.`, 'SUCCESS');
                }}
                onJumpToMap={() => setActiveTab('Live Map')}
              />
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
                  setActiveTab('Live Map');
                }}
              />
            ) : activeTab === 'Traffic Management' ? (
              <TrafficManagementView
                corridors={trafficCorridors}
                sensors={trafficSensors}
                summary={trafficSummary}
                onSelectCorridor={(corridor) => setSelectedCorridor(corridor)}
                onJumpToMap={() => setActiveTab('Live Map')}
              />
            ) : activeTab === 'Traffic Cameras' ? (
              <TrafficCamerasView
                incidents={incidents}
                landmarks={landmarks}
                onSelectCameraOnMap={(cam) => {
                  setSelectedLandmark({
                    id: cam.id,
                    name: cam.name,
                    type: 'CAMERA' as any,
                    lat: cam.lat,
                    lng: cam.lng,
                    status: cam.status === 'ONLINE' ? 'OPERATIONAL' : 'ALERT',
                    details: `Traffic CCTV Feed: ${cam.name} (${cam.resolution}, ${cam.fps} FPS, Direction: ${cam.directionDeg}°).`,
                  });
                  addLog(`CCTV Feed Selected: ${cam.name} (${cam.junction}).`, 'INFO');
                }}
                onJumpToMap={() => setActiveTab('Live Map')}
              />
            ) : activeTab === 'Weather & Disaster' ? (
              <WeatherDisasterView weather={weather} onJumpToMap={() => setActiveTab('Live Map')} />
            ) : activeTab === 'Infrastructure' ? (
              <InfrastructureView
                landmarks={landmarks}
                onSelectLandmark={(lm) => {
                  setSelectedLandmark(lm);
                  addLog(`Inspecting Landmark: ${lm.name}`, 'INFO');
                }}
                onJumpToMap={() => setActiveTab('Live Map')}
              />
            ) : activeTab === 'Utilities' ? (
              <UtilitiesView onJumpToMap={() => setActiveTab('Live Map')} />
            ) : activeTab === 'Resource Tracker' ? (
              <ResourceTrackerView
                resources={resources}
                incidents={incidents}
                onDispatchUnit={(uId, iId) => addLog(`Dispatched Unit ${uId} to Incident ${iId}`, 'SUCCESS')}
                onJumpToMap={() => setActiveTab('Live Map')}
              />
            ) : activeTab === 'Drone Feed' ? (
              <DroneFeedView
                drones={drones}
                onSelectDrone={(d) => setSelectedDrone(d)}
                onJumpToMap={() => setActiveTab('Live Map')}
              />
            ) : activeTab === 'Analytics' ? (
              <AnalyticsView incidents={incidents} trafficCorridors={trafficCorridors} weather={weather} />
            ) : activeTab === 'Reports' ? (
              <ReportsView
                incidents={incidents}
                weather={weather}
                trafficSummary={trafficSummary}
                landmarks={landmarks}
              />
            ) : activeTab === 'Settings' ? (
              <SettingsView layersState={layersState} setLayersState={setLayersState} />
            ) : null}
          </div>
        )}

        {/* Mobile Floating OpenClaw AI Assistant (FAB & Bottom Sheet) */}
        <MobileAIBottomSheet />

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

        {selectedDrone && <DroneFeedModal drone={selectedDrone} onClose={() => setSelectedDrone(null)} />}

        {showLogsModal && (
          <LogsModal logs={logs} onClose={() => setShowLogsModal(false)} onClearLogs={() => setLogs([])} />
        )}
      </AppShell>
    </NotificationProvider>
  );
}
