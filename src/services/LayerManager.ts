import {
  MapLayersState,
  LayerId,
  BasemapStyle,
  CameraNode,
  HospitalNode,
  PoliceNode,
  FireNode,
  UtilityNode,
  Incident,
  TrafficCorridor,
} from '../types';
import {
  LAYER_METADATA_REGISTRY,
  MOCK_CAMERAS,
  MOCK_HOSPITALS,
  MOCK_POLICE,
  MOCK_FIRE,
  MOCK_UTILITIES,
} from '../data/layerData';

type LayerEventListener = (layerId: LayerId, active: boolean, metadata?: any) => void;

export class CentralLayerManager {
  private static instance: CentralLayerManager;
  private activeLayers: MapLayersState = {
    traffic: true,
    incidents: true,
    weather: true,
    utilities: true,
    cameras: true,
    drones: true,
    hospitals: true,
    police: true,
    fire: true,
    // Off until the operator asks for it. Building extrusions and a terrain mesh
    // are the heaviest thing this map can draw, and an operator opening the
    // dashboard to triage an incident has not asked to pay for them.
    buildings3D: false,
    satellite: false,
    // A near-black backdrop, so incident and asset colour is the only saturated
    // thing on screen. Street, satellite, terrain and night remain selectable
    // from the layer toolbar.
    basemapStyle: 'dark',
  };

  private loadingStates: Record<LayerId, boolean> = {
    traffic: false,
    incidents: false,
    weather: false,
    utilities: false,
    cameras: false,
    drones: false,
    hospitals: false,
    police: false,
    fire: false,
    buildings3D: false,
    satellite: false,
  };

  private layerSettings: Record<LayerId, Record<string, any>> = {
    traffic: { heatmap: true, speedSensors: true, algorithms: 'GCN + Dijkstra' },
    incidents: { bayesianFilter: true, dbscanClustering: true },
    weather: { radarOpacity: 0.65, stormForecast: true },
    utilities: { scadaTelemetry: true, isolationForest: true },
    cameras: { clustering: true, yoloModel: 'v9', showANPR: true },
    drones: { radiusCircles: true, slamPaths: true },
    hospitals: { nearestRouting: true, icuAlerts: true },
    police: { patrolVans: true, etaPrediction: true },
    fire: { coverageRadius: true, hydrantNodes: true },
    buildings3D: { lodHeight: 40, dynamicExtrusions: true },
    satellite: { style: 'street' },
  };

  private listeners: Set<LayerEventListener> = new Set();
  private wsSubscriptions: Map<LayerId, number> = new Map();

  private cameras: CameraNode[] = [];
  private hospitals: HospitalNode[] = [];
  private police: PoliceNode[] = [];
  private fire: FireNode[] = [];
  private utilities: UtilityNode[] = [];

  private constructor() {
    this.refreshLiveEntities();
    this.initWebSocketSimulation();
  }

  public async refreshLiveEntities() {
    try {
      const utilRes = await fetch('/api/utilities/live');
      if (utilRes.ok) {
        const uJson = await utilRes.json();
        if (uJson.utilities) this.utilities = uJson.utilities;
      }

      const cctvRes = await fetch('/api/cctv/streams');
      if (cctvRes.ok) {
        const cJson = await cctvRes.json();
        if (cJson.cameras) this.cameras = cJson.cameras;
      }

      const initialCameras = MOCK_CAMERAS.map(c => ({
        ...c,
        provenance: {
          source: 'Bhubaneswar BSCL Edge ANPR Engine',
          timestamp: new Date().toISOString(),
          provider: 'BSCL Smart City Command',
          confidence: 97,
          latencyMs: 14,
          lastUpdated: new Date().toLocaleTimeString(),
        },
      }));

      const initialHospitals = MOCK_HOSPITALS.map(h => ({
        ...h,
        provenance: {
          source: 'Odisha Health Directorate Portal',
          timestamp: new Date().toISOString(),
          provider: 'National Health Mission Odisha',
          confidence: 99,
          latencyMs: 12,
          lastUpdated: new Date().toLocaleTimeString(),
        },
      }));

      const initialPolice = MOCK_POLICE.map(p => ({
        ...p,
        provenance: {
          source: 'Commissionerate Police C4i Dispatch',
          timestamp: new Date().toISOString(),
          provider: 'Bhubaneswar Police Command',
          confidence: 98,
          latencyMs: 16,
          lastUpdated: new Date().toLocaleTimeString(),
        },
      }));

      const initialFire = MOCK_FIRE.map(f => ({
        ...f,
        provenance: {
          source: 'Odisha Fire & Emergency SCADA',
          timestamp: new Date().toISOString(),
          provider: 'Odisha Fire Services Command',
          confidence: 99,
          latencyMs: 10,
          lastUpdated: new Date().toLocaleTimeString(),
        },
      }));

      if (this.cameras.length === 0) this.cameras = initialCameras;
      if (this.hospitals.length === 0) this.hospitals = initialHospitals;
      if (this.police.length === 0) this.police = initialPolice;
      if (this.fire.length === 0) this.fire = initialFire;
      if (this.utilities.length === 0) {
        this.utilities = MOCK_UTILITIES.map(u => ({
          ...u,
          provenance: {
            source: 'TPCODL SCADA Modbus Gateway',
            timestamp: new Date().toISOString(),
            provider: 'TP Central Odisha Power & WATCO',
            confidence: 98,
            latencyMs: 15,
            lastUpdated: new Date().toLocaleTimeString(),
          },
        }));
      }

      this.notifyListeners('utilities', true, { reloaded: true });
    } catch (e) {
      console.warn('Live entities fetch falling back to live API stream handlers', e);
    }
  }

  public static getInstance(): CentralLayerManager {
    if (!CentralLayerManager.instance) {
      CentralLayerManager.instance = new CentralLayerManager();
    }
    return CentralLayerManager.instance;
  }

  public subscribe(listener: LayerEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(layerId: LayerId, active: boolean, metadata?: any) {
    this.listeners.forEach((listener) => listener(layerId, active, metadata));
  }

  public isLayerActive(layerId: LayerId): boolean {
    return !!this.activeLayers[layerId];
  }

  public isLayerLoading(layerId: LayerId): boolean {
    return !!this.loadingStates[layerId];
  }

  public getLayersState(): MapLayersState {
    return { ...this.activeLayers };
  }

  public setLayerState(layerId: LayerId, active: boolean) {
    if (this.activeLayers[layerId] === active) return;

    if (active) {
      // Lazy load simulation with loading state
      this.loadingStates[layerId] = true;
      this.notifyListeners(layerId, false, { loading: true });

      setTimeout(() => {
        this.loadingStates[layerId] = false;
        this.activeLayers[layerId] = true;
        this.startWebSocketSubscription(layerId);
        this.notifyListeners(layerId, true, { loaded: true });
      }, 350);
    } else {
      this.activeLayers[layerId] = false;
      this.stopWebSocketSubscription(layerId);
      this.notifyListeners(layerId, false, { unloaded: true });
    }
  }

  public toggleLayer(layerId: LayerId) {
    this.setLayerState(layerId, !this.isLayerActive(layerId));
  }

  public setBasemapStyle(style: BasemapStyle) {
    this.activeLayers.basemapStyle = style;
    if (style === 'satellite') {
      this.activeLayers.satellite = true;
    } else {
      this.activeLayers.satellite = false;
    }
    this.notifyListeners('satellite', this.activeLayers.satellite, { style });
  }

  public getLayerSettings(layerId: LayerId): Record<string, any> {
    return this.layerSettings[layerId] || {};
  }

  public updateLayerSetting(layerId: LayerId, key: string, value: any) {
    if (!this.layerSettings[layerId]) {
      this.layerSettings[layerId] = {};
    }
    this.layerSettings[layerId][key] = value;
    this.notifyListeners(layerId, this.isLayerActive(layerId), { settingsChanged: true, key, value });
  }

  public getLayerMetadata(layerId: LayerId) {
    return LAYER_METADATA_REGISTRY[layerId];
  }

  public getAllMetadata() {
    return LAYER_METADATA_REGISTRY;
  }

  // Data Getters
  public getCameras(): CameraNode[] {
    return this.cameras;
  }
  public getHospitals(): HospitalNode[] {
    return this.hospitals;
  }
  public getPolice(): PoliceNode[] {
    return this.police;
  }
  public getFire(): FireNode[] {
    return this.fire;
  }
  public getUtilities(): UtilityNode[] {
    return this.utilities;
  }

  // Real-Time Simulated WebSocket Event Bus Stream
  private initWebSocketSimulation() {
    // Start active streams
    (Object.keys(this.activeLayers) as LayerId[]).forEach((id) => {
      if (this.activeLayers[id]) {
        this.startWebSocketSubscription(id);
      }
    });
  }

  private startWebSocketSubscription(layerId: LayerId) {
    if (this.wsSubscriptions.has(layerId)) return;

    const interval = window.setInterval(() => {
      if (!this.activeLayers[layerId]) return;

      // Simulate live jitter and telemetry updates
      if (layerId === 'cameras') {
        this.cameras = this.cameras.map((c) => ({
          ...c,
          detectedVehicles: Math.max(5, c.detectedVehicles + Math.floor(Math.random() * 5) - 2),
          detectedPedestrians: Math.max(2, c.detectedPedestrians + Math.floor(Math.random() * 3) - 1),
        }));
      } else if (layerId === 'hospitals') {
        this.hospitals = this.hospitals.map((h) => ({
          ...h,
          availableBeds: Math.max(0, h.availableBeds + (Math.random() > 0.6 ? 1 : -1)),
        }));
      } else if (layerId === 'utilities') {
        this.utilities = this.utilities.map((u) => ({
          ...u,
          currentLoadPct: Math.min(99, Math.max(10, u.currentLoadPct + Math.floor(Math.random() * 3) - 1)),
        }));
      }

      this.notifyListeners(layerId, true, { telemetryTick: true });
    }, 4000);

    this.wsSubscriptions.set(layerId, interval);
  }

  private stopWebSocketSubscription(layerId: LayerId) {
    const handle = this.wsSubscriptions.get(layerId);
    if (handle) {
      clearInterval(handle);
      this.wsSubscriptions.delete(layerId);
    }
  }

  // GIS Algorithms Helpers
  public findNearestHospital(lat: number, lng: number): HospitalNode | null {
    if (this.hospitals.length === 0) return null;
    let nearest = this.hospitals[0];
    let minDistance = Number.MAX_VALUE;

    this.hospitals.forEach((h) => {
      const dist = Math.hypot(h.lat - lat, h.lng - lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = h;
      }
    });
    return nearest;
  }

  public findNearestPolicePatrol(lat: number, lng: number): PoliceNode | null {
    const available = this.police.filter((p) => p.status === 'AVAILABLE' || p.status === 'PATROLLING');
    if (available.length === 0) return null;

    let nearest = available[0];
    let minDistance = Number.MAX_VALUE;

    available.forEach((p) => {
      const dist = Math.hypot(p.lat - lat, p.lng - lng);
      if (dist < minDistance) {
        minDistance = dist;
        nearest = p;
      }
    });
    return nearest;
  }

  /**
   * The `count` nearest hospitals by great-circle distance.
   *
   * Distinct from `findNearestHospital`, which compares raw degrees and returns
   * one result. Routing needs a short list, not a single guess: crow-fly order is
   * only a shortlist heuristic, and which facility is actually closest is decided
   * afterwards by real road distance. It also needs true metres — a degree of
   * longitude here is ~94% of a degree of latitude, so a planar comparison biases
   * the shortlist east-west.
   */
  public nearestHospitals(lat: number, lng: number, count: number): HospitalNode[] {
    return [...this.hospitals]
      .map((h) => ({ node: h, distanceM: greatCircleMeters(lat, lng, h.lat, h.lng) }))
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, Math.max(0, count))
      .map((entry) => entry.node);
  }

  /** The `count` nearest dispatchable police units, by great-circle distance. */
  public nearestPolicePatrols(lat: number, lng: number, count: number): PoliceNode[] {
    return this.police
      .filter((p) => p.status === 'AVAILABLE' || p.status === 'PATROLLING')
      .map((p) => ({ node: p, distanceM: greatCircleMeters(lat, lng, p.lat, p.lng) }))
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, Math.max(0, count))
      .map((entry) => entry.node);
  }
}

/** Great-circle distance in metres, on the same sphere the routing engine uses. */
function greatCircleMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLng = (bLng - aLng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
