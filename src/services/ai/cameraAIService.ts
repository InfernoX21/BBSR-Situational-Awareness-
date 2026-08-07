/**
 * cameraAIService.ts
 * ------------------
 * ARKA Frontend service layer for the Sadaksh PyTorch YOLOv8 + ByteTrack
 * Computer Vision Intelligence Engine.
 *
 * All data originates from the live Python inference microservice at port 8008.
 * No hardcoded or mock values — if the server is offline, methods return null / empty arrays.
 *
 * Endpoints consumed:
 *   GET  /health              — quick liveness check
 *   GET  /diagnostics         — full AI diagnostics panel
 *   GET  /statistics          — cumulative stats
 *   GET  /analytics/history   — trend data
 *   POST /analyze-frame       — per-frame inference
 */

// ─── Sadaksh Server Output Types ───────────────────────────────────────────

export type SadakshClass = 'person' | 'bicycle' | 'car' | 'motorcycle' | 'bus' | 'truck';

export type CongestionLevel = 'FREE_FLOW' | 'LOW' | 'MODERATE' | 'SEVERE' | 'OFFLINE';

export type EventType =
  | 'STOPPED_VEHICLE'
  | 'HIGH_CONGESTION'
  | 'PEDESTRIAN_CROWDING'
  | 'WRONG_WAY'
  | 'SUDDEN_SLOWDOWN'
  | 'ROAD_BLOCKAGE';

export type EventSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface SadakshDetection {
  track_id: number;
  class: SadakshClass;
  confidence: number;
  /** [x_pct, y_pct, w_pct, h_pct] — all in 0–100 % of frame */
  bbox: [number, number, number, number];
  /** [x1, y1, x2, y2] absolute pixels */
  bbox_pixels: [number, number, number, number];
  /** Historical center points [[x_pct, y_pct], ...] */
  trajectory: Array<[number, number]>;
  direction: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | 'STATIONARY' | 'UNKNOWN';
  speed_kmh: number;
  dwell_seconds: number;
}

export interface SadakshAnalytics {
  vehicleCount: number;
  pedestrianCount: number;
  totalTargets: number;
  classCounts: Record<string, number>;
  congestionLevel: CongestionLevel;
  density: 'CLEAR' | 'LOW' | 'MEDIUM' | 'HIGH';
  flowRate: number;
  entryCount: number;
  exitCount: number;
  activeTracks: number;
}

export interface SadakshEvent {
  type: EventType;
  severity: EventSeverity;
  track_id?: number;
  class?: string;
  camera?: string;
  message: string;
  timestamp?: string;
  dwell_seconds?: number;
  speed_kmh?: number;
  direction?: string;
  count?: number;
  stopped_count?: number;
  quadrant?: string;
}

export interface SadakshFrameResponse {
  status: 'READY' | 'OFFLINE' | 'ERROR';
  camera: string;
  fps: number;
  latency: number;
  detections: SadakshDetection[];
  analytics: SadakshAnalytics;
  events: SadakshEvent[];
  error?: string;
}

export interface SadakshDiagnostics {
  status: 'READY' | 'OFFLINE';
  model: {
    name: string;
    weights: string;
    weights_path: string;
    conf_threshold: number;
    tracker: string;
    trajectory_len: number;
    device: string;
    loaded: boolean;
  };
  hardware: {
    gpu_available: boolean;
    gpu_name: string;
    cpu_fallback: boolean;
  };
  performance: {
    avg_fps: number;
    fps_samples: number[];
    frames_processed: number;
    total_detections: number;
    uptime_seconds: number;
    error_count: number;
  };
  streams: {
    active: number;
    last_inference_ts: string | null;
  };
  logger: {
    type: string;
    path: string;
    active: boolean;
  };
  classes_supported: string[];
  events_supported: string[];
  timestamp: string;
}

export interface SadakshStatistics {
  status: 'READY' | 'OFFLINE';
  engine: string;
  model_weights: string;
  device: string;
  frames_processed: number;
  total_detections: number;
  class_totals: Record<string, number>;
  active_tracks: number;
  congestion_history: Array<{
    ts: string;
    level: CongestionLevel;
    vehicle_count: number;
    pedestrian_count: number;
    fps: number;
  }>;
  congestion_level_distribution: Record<string, number>;
  event_log: SadakshEvent[];
  uptime_seconds: number;
  last_inference_ts: string | null;
  timestamp: string;
}

export interface SadakshAnalyticsHistory {
  count: number;
  history: Array<{
    ts: string;
    fps: number;
    latency_ms: number;
    vehicle_count: number;
    pedestrian_count: number;
    total: number;
    class_counts: Record<string, number>;
    congestion_level: CongestionLevel;
    density: string;
    flow_rate: number;
    events_count: number;
  }>;
  timestamp: string;
}

// ─── Service Implementation ─────────────────────────────────────────────────

const DIRECT_BASE = 'http://127.0.0.1:8008';
const PROXY_BASE = '/api/camera-ai';

async function sadakshFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T | null> {
  // Try proxy first, fall back to direct localhost
  try {
    const res = await fetch(`${PROXY_BASE}${path}`, options);
    if (!res.ok) throw new Error(`Proxy HTTP ${res.status}`);
    return await res.json() as T;
  } catch {
    try {
      const res = await fetch(`${DIRECT_BASE}${path}`, options);
      if (!res.ok) throw new Error(`Direct HTTP ${res.status}`);
      return await res.json() as T;
    } catch {
      return null;
    }
  }
}

export class CameraAIService {
  private static instance: CameraAIService;

  private constructor() {}

  public static getInstance(): CameraAIService {
    if (!CameraAIService.instance) {
      CameraAIService.instance = new CameraAIService();
    }
    return CameraAIService.instance;
  }

  /** Quick health check — returns true if AI server is reachable and model loaded. */
  public async isOnline(): Promise<boolean> {
    const result = await sadakshFetch<{ status: string }>('/health');
    return result?.status === 'READY';
  }

  /** Full AI diagnostics panel data. */
  public async getDiagnostics(): Promise<SadakshDiagnostics | null> {
    return sadakshFetch<SadakshDiagnostics>('/diagnostics');
  }

  /** Cumulative detection statistics. */
  public async getStatistics(): Promise<SadakshStatistics | null> {
    return sadakshFetch<SadakshStatistics>('/statistics');
  }

  /** Last N frames of aggregated analytics for trend charts. */
  public async getAnalyticsHistory(limit = 30): Promise<SadakshAnalyticsHistory | null> {
    return sadakshFetch<SadakshAnalyticsHistory>(`/analytics/history?limit=${limit}`);
  }

  /**
   * Submit a base64-encoded JPEG frame for real-time inference.
   * Returns full detection, tracking, trajectory, analytics, and event output.
   */
  public async analyzeFrame(
    cameraId: string,
    base64Frame: string
  ): Promise<SadakshFrameResponse | null> {
    return sadakshFetch<SadakshFrameResponse>('/analyze-frame', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cameraId, frame: base64Frame }),
    });
  }

  /**
   * Return a display-friendly label for a congestion level.
   */
  public static congestionLabel(level: CongestionLevel): string {
    const map: Record<CongestionLevel, string> = {
      FREE_FLOW: 'Free Flow',
      LOW: 'Low Density',
      MODERATE: 'Moderate',
      SEVERE: 'Severe',
      OFFLINE: 'Offline',
    };
    return map[level] ?? level;
  }

  /**
   * Return a CSS color token for a congestion level.
   */
  public static congestionColor(level: CongestionLevel): string {
    const map: Record<CongestionLevel, string> = {
      FREE_FLOW: '#10B981',
      LOW: '#34D399',
      MODERATE: '#F59E0B',
      SEVERE: '#EF4444',
      OFFLINE: '#6B7280',
    };
    return map[level] ?? '#6B7280';
  }

  /**
   * Return a CSS color for a detection class.
   */
  public static classColor(cls: SadakshClass | string): string {
    const map: Record<string, string> = {
      person: '#10B981',
      bicycle: '#F59E0B',
      car: '#06B6D4',
      motorcycle: '#A855F7',
      bus: '#3B82F6',
      truck: '#F97316',
    };
    return map[cls] ?? '#9CA3AF';
  }

  /**
   * Return a CSS color for an event severity.
   */
  public static severityColor(severity: EventSeverity): string {
    const map: Record<EventSeverity, string> = {
      CRITICAL: '#EF4444',
      HIGH: '#F97316',
      MEDIUM: '#F59E0B',
      LOW: '#6B7280',
    };
    return map[severity] ?? '#6B7280';
  }
}
