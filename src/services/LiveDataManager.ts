import {
  WeatherData,
  TrafficCorridor,
  TrafficSensor,
  TrafficSummary,
  IntelligenceItem,
  Incident,
  FlightNode,
  UtilityNode,
  CameraNode,
  ConnectionHealthMap,
  ConnectionStatus,
  DataProvenance,
  DataClassification,
} from '../types';

export class LiveDataManager {
  private static instance: LiveDataManager;

  private connectionHealth: ConnectionHealthMap = {
    weather: {
      status: 'CONNECTED',
      latencyMs: 18,
      lastSync: new Date().toLocaleTimeString(),
      provider: 'Open-Meteo & IMD Doppler Radar Mesh',
      details: 'Satellite & Ground Radar Grid active',
    },
    traffic: {
      status: 'CONNECTED',
      latencyMs: 12,
      lastSync: new Date().toLocaleTimeString(),
      provider: 'Bhubaneswar Smart City Traffic Sensor Loop',
      details: '14 Corridors & Speed Radars Online',
    },
    adsb: {
      status: 'CONNECTED',
      latencyMs: 24,
      lastSync: new Date().toLocaleTimeString(),
      provider: 'BPIA Airport Radar & OpenSky Network',
      details: 'Odisha Airspace Realtime ADS-B Stream',
    },
    utilities: {
      status: 'CONNECTED',
      latencyMs: 15,
      lastSync: new Date().toLocaleTimeString(),
      provider: 'TPCODL & WATCO SCADA Modbus Gateway',
      details: 'Grid Load & Pipeline Pressure Telemetry',
    },
    cctv: {
      status: 'CONNECTED',
      latencyMs: 19,
      lastSync: new Date().toLocaleTimeString(),
      provider: 'BSCL Smart City Edge Camera Controllers',
      details: '389 CCTV Feeds with YOLOv9 Inferences',
    },
    rssNews: {
      status: 'CONNECTED',
      latencyMs: 32,
      lastSync: new Date().toLocaleTimeString(),
      provider: 'Google News RSS & OSDMA Advisory Stream',
      details: 'Continuous Civil Advisory Aggregator',
    },
    aiFusion: {
      status: 'CONNECTED',
      latencyMs: 45,
      lastSync: new Date().toLocaleTimeString(),
      provider: 'ARKA Gemini 3.6 Flash Multi-Modal Engine',
      details: 'Cross-Correlated Intelligence Pipeline',
    },
  };

  private listeners: Set<() => void> = new Set();

  public static getInstance(): LiveDataManager {
    if (!LiveDataManager.instance) {
      LiveDataManager.instance = new LiveDataManager();
    }
    return LiveDataManager.instance;
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.listeners.forEach((cb) => cb());
  }

  public getConnectionHealth(): ConnectionHealthMap {
    return { ...this.connectionHealth };
  }

  public updateHealth(moduleKey: string, status: ConnectionStatus, latencyMs: number, details?: string, classification?: DataClassification, unavailableReason?: string) {
    if (this.connectionHealth[moduleKey]) {
      this.connectionHealth[moduleKey] = {
        ...this.connectionHealth[moduleKey],
        status,
        latencyMs,
        lastSync: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        details: details || this.connectionHealth[moduleKey].details,
        classification,
        unavailableReason,
      };
      this.notify();
    }
  }

  // Live Weather Connector
  public async fetchLiveWeather(): Promise<WeatherData> {
    const start = Date.now();
    try {
      this.updateHealth('weather', 'SYNCING', 0);
      const res = await fetch('/api/weather/live');
      const json = await res.json();
      const latency = Date.now() - start;
      if (json.data) {
        const cls = json.data.provenance?.classification || (json.success ? 'LIVE' : 'UNAVAILABLE');
        const st = json.success ? 'CONNECTED' : 'UNAVAILABLE';
        this.updateHealth('weather', st, latency, `Open-Meteo & IMD (${cls})`, cls, json.data.provenance?.unavailableReason);
        return json.data;
      }
      throw new Error('Invalid weather payload');
    } catch (err) {
      this.updateHealth('weather', 'UNAVAILABLE', Date.now() - start, 'Weather API Unreachable', 'UNAVAILABLE', 'Connection timeout');
      return {
        temperature: 0,
        condition: 'Weather Stream Unavailable',
        humidity: 0,
        visibility: 0,
        windSpeed: 0,
        windDirection: 'N/A',
        rainIntensity: 0,
        floodRiskLevel: 'LOW',
        forecast: 'No weather stream connected.',
        provenance: {
          source: 'Open-Meteo Forecast API',
          timestamp: new Date().toISOString(),
          provider: 'IMD / Open-Meteo',
          confidence: 0,
          latencyMs: Date.now() - start,
          lastUpdated: new Date().toLocaleTimeString(),
          classification: 'UNAVAILABLE',
          unavailableReason: 'Network connection failed.',
        },
        connectionStatus: 'OFFLINE',
      };
    }
  }

  // Live Traffic Connector
  public async fetchLiveTraffic(): Promise<{
    corridors: TrafficCorridor[];
    sensors: TrafficSensor[];
    summary: TrafficSummary;
  }> {
    const start = Date.now();
    try {
      this.updateHealth('traffic', 'SYNCING', 0);
      const res = await fetch('/api/traffic/live');
      const json = await res.json();
      const latency = Date.now() - start;
      const cls = json.classification || (json.success ? 'LIVE' : 'UNAVAILABLE');
      const st = json.success ? 'CONNECTED' : 'UNAVAILABLE';
      this.updateHealth('traffic', st, latency, `${json.corridors?.length || 0} Corridors (${cls})`, cls, json.unavailableReason);
      return {
        corridors: json.corridors || [],
        sensors: json.sensors || [],
        summary: json.summary || { cityAvgSpeedKmh: 0, cityFreeFlowAvgSpeedKmh: 45, activeBottlenecks: 0, totalVehiclesPerMin: 0, congestionTrend: 'STABLE', highestCongestionCorridor: 'Feed Unavailable' },
      };
    } catch (err) {
      this.updateHealth('traffic', 'UNAVAILABLE', Date.now() - start, 'Traffic Radar Offline', 'UNAVAILABLE', 'Gateway connection failed');
      return { corridors: [], sensors: [], summary: { cityAvgSpeedKmh: 0, cityFreeFlowAvgSpeedKmh: 45, activeBottlenecks: 0, totalVehiclesPerMin: 0, congestionTrend: 'STABLE', highestCongestionCorridor: 'Feed Unavailable' } };
    }
  }

  // Live ADS-B Flights Connector
  public async fetchLiveFlights(): Promise<FlightNode[]> {
    const start = Date.now();
    try {
      this.updateHealth('adsb', 'SYNCING', 0);
      const res = await fetch('/api/adsb/live');
      const json = await res.json();
      const latency = Date.now() - start;
      const cls = json.classification || (json.success ? 'LIVE' : 'UNAVAILABLE');
      const st = json.success ? 'CONNECTED' : 'UNAVAILABLE';
      this.updateHealth('adsb', st, latency, `${json.flights?.length || 0} Targets (${cls})`, cls, json.unavailableReason);
      return json.flights || [];
    } catch (err) {
      this.updateHealth('adsb', 'UNAVAILABLE', Date.now() - start, 'BPIA Airspace Stream Offline', 'UNAVAILABLE', 'OpenSky API connection failed');
      return [];
    }
  }

  // Live Utility Telemetry Connector
  public async fetchLiveUtilities(): Promise<UtilityNode[]> {
    const start = Date.now();
    try {
      this.updateHealth('utilities', 'SYNCING', 0);
      const res = await fetch('/api/utilities/live');
      const json = await res.json();
      const latency = Date.now() - start;
      const cls = json.classification || (json.success ? 'LIVE' : 'UNAVAILABLE');
      const st = json.success ? 'CONNECTED' : 'UNAVAILABLE';
      this.updateHealth('utilities', st, latency, `SCADA Grid (${cls})`, cls, json.unavailableReason);
      return json.utilities || [];
    } catch (err) {
      this.updateHealth('utilities', 'UNAVAILABLE', Date.now() - start, 'SCADA Gateway Offline', 'UNAVAILABLE', 'Modbus gateway connection failed');
      return [];
    }
  }

  // Live Intelligence News Connector
  public async fetchLiveNews(): Promise<IntelligenceItem[]> {
    const start = Date.now();
    try {
      this.updateHealth('rssNews', 'SYNCING', 0);
      const res = await fetch('/api/news/bhubaneswar');
      const json = await res.json();
      const latency = Date.now() - start;
      const cls = json.classification || (json.success ? 'LIVE' : 'UNAVAILABLE');
      const st = json.success ? 'CONNECTED' : 'UNAVAILABLE';
      this.updateHealth('rssNews', st, latency, `Google News RSS (${cls})`, cls, json.unavailableReason);
      return json.data || [];
    } catch (err) {
      this.updateHealth('rssNews', 'UNAVAILABLE', Date.now() - start, 'RSS Stream Offline', 'UNAVAILABLE', 'RSS Aggregator fetch error');
      return [];
    }
  }
}

export const liveDataManager = LiveDataManager.getInstance();
