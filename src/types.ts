export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type ConnectionStatus = 'CONNECTED' | 'SYNCING' | 'OFFLINE' | 'RETRYING' | 'AWAITING_FEED';

export interface DataProvenance {
  source: string;
  timestamp: string;
  provider: string;
  confidence: number;
  latencyMs: number;
  lastUpdated: string;
}

export interface ConnectionHealthInfo {
  status: ConnectionStatus;
  latencyMs: number;
  lastSync: string;
  provider: string;
  details?: string;
}

export type ConnectionHealthMap = Record<string, ConnectionHealthInfo>;

export interface FlightNode {
  id: string;
  callsign: string;
  lat: number;
  lng: number;
  altitudeMeters: number;
  speedKmh: number;
  heading: number;
  origin: string;
  destination: string;
  aircraftType: string;
  status: 'AIRBORNE' | 'APPROACHING' | 'LANDED';
  provenance: DataProvenance;
}

export type NavItem =
  | 'Dashboard'
  | 'AI Operations'
  | 'Live Map'
  | 'Intelligence Feed'
  | 'Incident Center'
  | 'Traffic Management'
  | 'Weather & Disaster'
  | 'Infrastructure'
  | 'Utilities'
  | 'Resource Tracker'
  | 'Drone Feed'
  | 'Analytics'
  | 'Reports'
  | 'Settings';

export interface Agency {
  id: string;
  name: string;
  shortName: string;
  status: 'ONLINE' | 'STANDBY' | 'BUSY' | 'OFFLINE';
  personnel: number;
  activeUnits: number;
  contact: string;
  icon: string;
}

export interface Incident {
  id: string;
  category: 'TRAFFIC' | 'FIRE' | 'FLOOD' | 'UTILITY' | 'SECURITY' | 'MEDICAL';
  title: string;
  priority: Severity;
  description: string;
  location: {
    name: string;
    lat: number;
    lng: number;
    address: string;
  };
  timestamp: string;
  agencyAssigned: string;
  aiConfidence: number;
  recommendedAction: string;
  status: 'ACTIVE' | 'DISPATCHED' | 'CONTAINED' | 'RESOLVED';
  affectedRoads?: string[];
  estimatedImpact?: string;
  unitsDispatched?: number;
  evidenceSources?: string[];
  reasoning?: string;
  provenance?: DataProvenance;
  connectionStatus?: ConnectionStatus;
}

export interface IntelligenceItem {
  id: string;
  publisherName: string;
  publisherLogo?: string;
  publishedTime: string;
  headline: string;
  summary: string;
  url: string;
  source: 'GOOGLE_NEWS' | 'GOVT_ADVISORY' | 'WEATHER_BULLETIN' | 'TRAFFIC_FEED';
  category: string;
  content?: string;
  highlights?: string[];
}

export interface ResourceUnit {
  id: string;
  name: string;
  type: 'Fire Engines' | 'Police Vehicles' | 'Ambulances' | 'Response Teams' | 'Drone Units';
  total: number;
  available: number;
  dispatched: number;
  maintenance: number;
}

export interface DroneUnit {
  id: string;
  callsign: string;
  battery: number;
  altMeters: number;
  speedKmh: number;
  lat: number;
  lng: number;
  targetArea: string;
  status: 'PATROLLING' | 'DISPATCHED' | 'HOVERING' | 'CHARGING';
  streamUrl?: string;
}

export interface LandmarkNode {
  id: string;
  name: string;
  type: 'HOSPITAL' | 'POLICE' | 'FIRE' | 'POWER' | 'WATER' | 'TELECOM' | 'AIRPORT' | 'STATION' | 'GOVT' | 'UNIVERSITY';
  lat: number;
  lng: number;
  status: 'OPERATIONAL' | 'ALERT' | 'MAINTENANCE';
  details: string;
}

export interface MapLayersState {
  traffic: boolean;
  incidents: boolean;
  weather: boolean;
  utilities: boolean;
  cameras: boolean;
  drones: boolean;
  hospitals: boolean;
  police: boolean;
  fire: boolean;
  buildings3D: boolean;
  satellite: boolean;
  infrastructure?: boolean;
  floodZones?: boolean;
  heatmaps?: boolean;
  basemapStyle?: BasemapStyle;
}

export type BasemapStyle = 'dark' | 'satellite' | 'street' | 'terrain' | 'hybrid' | 'night';

export type LayerId =
  | 'traffic'
  | 'incidents'
  | 'weather'
  | 'utilities'
  | 'cameras'
  | 'drones'
  | 'hospitals'
  | 'police'
  | 'fire'
  | 'buildings3D'
  | 'satellite';

export interface CameraNode {
  id: string;
  name: string;
  locationName: string;
  lat: number;
  lng: number;
  status: 'ONLINE' | 'ALERT' | 'OFFLINE';
  direction: string;
  fovAngle: number;
  model: string; // e.g., 'YOLOv9 + DeepSORT'
  detectedVehicles: number;
  detectedPedestrians: number;
  anomaliesDetected: number;
  lastUpdate: string;
  streamUrl?: string;
  thumbnailUrl?: string;
  clusterGroup?: string;
}

export interface HospitalNode {
  id: string;
  name: string;
  type: 'GOVERNMENT' | 'PRIVATE' | 'EMERGENCY_CENTER';
  lat: number;
  lng: number;
  address: string;
  totalBeds: number;
  availableBeds: number;
  availableICU: number;
  traumaLevel: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3';
  contact: string;
  status: 'OPERATIONAL' | 'FULL' | 'DIVERTING';
  nearestIncidentDistanceKm?: number;
  estimatedEtaMins?: number;
}

export interface PoliceNode {
  id: string;
  name: string;
  unitCallsign?: string;
  type: 'STATION' | 'PATROL_UNIT' | 'PCR_VAN' | 'INTERCEPTOR';
  lat: number;
  lng: number;
  sector: string;
  personnelCount: number;
  status: 'AVAILABLE' | 'DISPATCHED' | 'PATROLLING' | 'BUSY';
  contact: string;
  etaToIncidentMins?: number;
}

export interface FireNode {
  id: string;
  name: string;
  type: 'STATION' | 'WATER_TENDER' | 'HYDRANT_NODE';
  lat: number;
  lng: number;
  address: string;
  tendersAvailable: number;
  foamCapacityLiters: number;
  hydrantsCount: number;
  coverageRadiusKm: number;
  status: 'READY' | 'DEPLOYED' | 'MAINTENANCE';
  contact: string;
}

export interface UtilityNode {
  id: string;
  name: string;
  type: 'POWER_SUBSTATION' | 'WATER_PUMP' | 'GAS_PIPELINE' | 'STREET_LIGHT_GRID' | 'TELECOM_TOWER' | 'SMART_METER_HUB';
  lat: number;
  lng: number;
  gridZone: string;
  capacityMetric: string; // e.g. "132kV / 420 MW", "180 MLD"
  currentLoadPct: number;
  status: 'NORMAL' | 'WARNING' | 'CRITICAL_OUTAGE' | 'MAINTENANCE';
  outageRiskScore: number;
  aiAnomalyScore: number;
}

export interface LayerMetadata {
  id: LayerId;
  name: string;
  category: 'INFRASTRUCTURE' | 'EMERGENCY' | 'OPERATIONS' | 'BASEMAP' | 'ENVIRONMENT';
  icon: string;
  description: string;
  algorithms: string[];
  updateIntervalSec: number;
  entityCount: number;
  dataSizeKb: number;
  backendEndpoint: string;
  wsChannel: string;
}

export interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  visibility: number;
  windSpeed: number;
  windDirection: string;
  rainIntensity: number;
  floodRiskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  forecast: string;
  provenance?: DataProvenance;
  connectionStatus?: ConnectionStatus;
}

export interface LiveLog {
  id: string;
  timestamp: string;
  message: string;
  type: 'INFO' | 'WARN' | 'ALERT' | 'SUCCESS';
}

export interface TrafficCorridor {
  id: string;
  name: string;
  roadName: string;
  path: [number, number][];
  avgSpeedKmh: number;
  freeFlowSpeedKmh: number;
  congestionLevel: 'CLEAR' | 'SLOW' | 'JAMMED' | 'SEVERE';
  congestionScore: number;
  vehicleCount: number;
  trend: 'IMPROVING' | 'STABLE' | 'WORSENING';
  activeIncidentId?: string;
  updatedAt: string;
}

export interface TrafficSensor {
  id: string;
  name: string;
  lat: number;
  lng: number;
  speed: number;
  status: 'ONLINE' | 'ALERT' | 'OFFLINE';
  vehicleRatePerMin: number;
  corridorId: string;
}

export interface TrafficSummary {
  cityAvgSpeedKmh: number;
  cityFreeFlowAvgSpeedKmh: number;
  activeBottlenecks: number;
  totalVehiclesPerMin: number;
  congestionTrend: 'IMPROVING' | 'STABLE' | 'WORSENING';
  highestCongestionCorridor: string;
}

// OpenClaw Autonomous Operations Framework Types
export type OpenClawAgentId =
  | 'supervisor'
  | 'gis'
  | 'intelligence'
  | 'traffic'
  | 'disaster'
  | 'infrastructure'
  | 'reporting';

export interface OpenClawAgentStatus {
  id: OpenClawAgentId;
  name: string;
  role: string;
  status: 'IDLE' | 'BUSY' | 'WAITING' | 'COMPLETED' | 'ERROR';
  currentTask?: string;
  iconName: string;
}

export interface OpenClawToolSchema {
  name: string;
  category: 'GIS' | 'INCIDENT' | 'TRAFFIC' | 'WEATHER' | 'INTELLIGENCE' | 'INFRASTRUCTURE' | 'ANALYTICS' | 'RESOURCE' | 'NOTIFICATION';
  description: string;
  inputSchema: Record<string, any>;
  outputSchema: Record<string, any>;
  requiresPermission: boolean;
}

export interface OpenClawWorkflowStep {
  id: string;
  agentId: OpenClawAgentId;
  agentName: string;
  toolName: string;
  description: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'AWAITING_CONFIRMATION';
  params?: Record<string, any>;
  result?: any;
  durationMs?: number;
}

export interface OpenClawExecutionResult {
  executionId: string;
  userPrompt: string;
  timestamp: string;
  supervisorPlan: string[];
  steps: OpenClawWorkflowStep[];
  agentStatuses: Record<OpenClawAgentId, OpenClawAgentStatus['status']>;
  finalSummary: string;
  recommendations: string[];
  requiresConfirmation?: {
    action: string;
    details: string;
  };
  stateChanges?: {
    targetLocation?: { lat: number; lng: number; name: string };
    layersToEnable?: string[];
    selectedIncidentId?: string;
  };
}


