/**
 * Operator settings: the preferences that shape how ARKA behaves on this
 * workstation.
 *
 * Persisted to `localStorage`, because these are per-console choices — which
 * layers this wall display opens with, how fast it polls, whether it rotates
 * through modules unattended. There is no user account system to hang them off,
 * and pretending they sync across operators would be a lie.
 *
 * Two rules the loader enforces:
 *
 * 1. **Stored values are untrusted input.** Anything read back is checked against
 *    the allowed set and falls back to the default if it does not match. A
 *    hand-edited or half-migrated key must not be able to crash a render.
 *
 * 2. **A setting may not manufacture capability.** `dataMode: 'demo'` cannot make
 *    demo data appear where the environment forbids it — the environment decides
 *    what is available, this decides only what the operator prefers among what is
 *    actually on offer. See `demoMode.ts`.
 */

import type { BasemapStyle, MapLayersState, NavItem } from '../types';
import { NAV_ITEMS } from '../components/navConfig';
import type { EventTone } from './events';

/** Interface density. Not a theme switch — ARKA has one visual identity. */
export type UiDensity = 'comfortable' | 'compact';

export interface AppearanceSettings {
  density: UiDensity;
  /** Suppresses non-essential animation, including the ticker scroll. */
  reduceMotion: boolean;
  /** Whether the bottom event ticker is shown at all. */
  showTicker: boolean;
  /** Show the data-state badge on every panel, not just on hover. */
  alwaysShowProvenance: boolean;
}

export interface MapSettings {
  basemap: BasemapStyle;
  /** Zoom the map opens at. */
  defaultZoom: number;
  /** Where the map opens. Defaults to the Bhubaneswar city centre already in use. */
  defaultCenter: { lat: number; lng: number };
  /** Fit the viewport to active incidents on load instead of using defaultCenter. */
  fitToIncidentsOnLoad: boolean;
  /** Keep the map centred on the focused entity as it moves. */
  followFocusedEntity: boolean;
}

export interface NotificationSettings {
  /** Lowest tone that raises a notification. 'low' means everything. */
  minimumTone: EventTone;
  criticalIncidents: boolean;
  weatherWarnings: boolean;
  infrastructureFailures: boolean;
  dailyBriefing: boolean;
  /** Audible alert for critical events. Off by default; a shared room decides this. */
  sound: boolean;
}

export interface AutoRotateSettings {
  enabled: boolean;
  intervalSeconds: number;
  /** Modules to cycle through, in order. */
  tabs: NavItem[];
}

export interface RefreshSettings {
  /**
   * Override for every feed's polling cadence, in seconds. Null keeps each
   * feed's own cadence, which is matched to how often its source actually
   * publishes — overriding it downwards does not make the source fresher.
   */
  cadenceSeconds: number | null;
  /** Stop polling while the tab is hidden. */
  pauseWhenHidden: boolean;
}

export type DataMode = 'live' | 'demo';

export interface IntegrationSettings {
  /** Route notifications to the Telegram companion bot. */
  telegram: boolean;
  /** Include the city GIS base layers from the configured provider. */
  cityGis: boolean;
}

export interface ArkaSettings {
  appearance: AppearanceSettings;
  map: MapSettings;
  /** Layer visibility the map opens with. */
  layers: MapLayersState;
  notifications: NotificationSettings;
  autoRotate: AutoRotateSettings;
  refresh: RefreshSettings;
  /** Preferred data mode. Constrained by what the environment permits. */
  dataMode: DataMode;
  integrations: IntegrationSettings;
}

/**
 * Defaults.
 *
 * The layer set and map centre reproduce exactly what `App.tsx` opened with
 * before settings existed, so introducing this file changes nothing an operator
 * would notice until they change something themselves.
 */
export const DEFAULT_SETTINGS: ArkaSettings = {
  appearance: {
    density: 'comfortable',
    reduceMotion: false,
    showTicker: true,
    alwaysShowProvenance: false,
  },
  map: {
    basemap: 'dark',
    defaultZoom: 12,
    defaultCenter: { lat: 20.2961, lng: 85.8245 },
    fitToIncidentsOnLoad: false,
    followFocusedEntity: false,
  },
  layers: {
    traffic: true,
    weather: true,
    incidents: true,
    utilities: true,
    infrastructure: true,
    cameras: true,
    drones: true,
    hospitals: true,
    police: true,
    fire: true,
    floodZones: true,
    satellite: false,
    heatmaps: false,
    buildings3D: true,
  },
  notifications: {
    minimumTone: 'high',
    criticalIncidents: true,
    weatherWarnings: true,
    infrastructureFailures: true,
    dailyBriefing: false,
    sound: false,
  },
  autoRotate: {
    enabled: false,
    intervalSeconds: 45,
    tabs: ['Command Center', 'Live City', 'Active Situations', 'Mobility'],
  },
  refresh: {
    cadenceSeconds: null,
    pauseWhenHidden: true,
  },
  dataMode: 'live',
  integrations: {
    telegram: false,
    cityGis: true,
  },
};

const STORAGE_KEY = 'arka.settings.v1';

// --- Validation --------------------------------------------------------------

const DENSITIES: UiDensity[] = ['comfortable', 'compact'];
const BASEMAPS: BasemapStyle[] = ['dark', 'satellite', 'street', 'terrain', 'hybrid', 'night'];
const TONES: EventTone[] = ['critical', 'high', 'medium', 'low', 'resolved'];
const DATA_MODES: DataMode[] = ['live', 'demo'];

/** Zoom range Leaflet is configured for. Outside this the map renders blank. */
const ZOOM_RANGE = { min: 4, max: 19 };

/**
 * Cadence bounds. The floor exists because polling a source faster than it
 * publishes only manufactures load; the ceiling keeps a wall display from
 * silently sitting on hour-old data.
 */
const CADENCE_RANGE = { min: 10, max: 900 };
const ROTATE_RANGE = { min: 10, max: 600 };

function pickEnum<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === 'string' && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function pickBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function pickNumber(value: unknown, range: { min: number; max: number }, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(range.max, Math.max(range.min, value));
}

/** Latitude/longitude sanity. A stored NaN centre would break every fly-to. */
function pickCoords(value: unknown, fallback: { lat: number; lng: number }): { lat: number; lng: number } {
  if (!value || typeof value !== 'object') return fallback;
  const candidate = value as { lat?: unknown; lng?: unknown };
  const lat = typeof candidate.lat === 'number' && Math.abs(candidate.lat) <= 90 ? candidate.lat : null;
  const lng = typeof candidate.lng === 'number' && Math.abs(candidate.lng) <= 180 ? candidate.lng : null;
  return lat == null || lng == null ? fallback : { lat, lng };
}

/**
 * Rebuilds the layer set from stored JSON.
 *
 * Every key is listed explicitly rather than looped, for two reasons: unknown
 * keys from an older build are dropped instead of being carried forward into
 * every future save, and adding a layer to `MapLayersState` becomes a compile
 * error here — which forces a decision about whether it should default on.
 */
function pickLayers(value: unknown): MapLayersState {
  const d = DEFAULT_SETTINGS.layers;
  const s = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;

  const layers: MapLayersState = {
    traffic: pickBool(s.traffic, d.traffic),
    incidents: pickBool(s.incidents, d.incidents),
    weather: pickBool(s.weather, d.weather),
    utilities: pickBool(s.utilities, d.utilities),
    cameras: pickBool(s.cameras, d.cameras),
    drones: pickBool(s.drones, d.drones),
    hospitals: pickBool(s.hospitals, d.hospitals),
    police: pickBool(s.police, d.police),
    fire: pickBool(s.fire, d.fire),
    buildings3D: pickBool(s.buildings3D, d.buildings3D),
    satellite: pickBool(s.satellite, d.satellite),
    infrastructure: pickBool(s.infrastructure, d.infrastructure ?? false),
    floodZones: pickBool(s.floodZones, d.floodZones ?? false),
    heatmaps: pickBool(s.heatmaps, d.heatmaps ?? false),
  };

  if (typeof s.basemapStyle === 'string') {
    layers.basemapStyle = pickEnum(s.basemapStyle, BASEMAPS, DEFAULT_SETTINGS.map.basemap);
  }
  return layers;
}

function pickTabs(value: unknown, fallback: NavItem[]): NavItem[] {
  if (!Array.isArray(value)) return [...fallback];
  // `NAV_ITEMS` holds entries, not labels. Comparing an entry to a string was
  // always false, so every stored rotation silently fell back to the default.
  const valid = value.filter((item): item is NavItem => NAV_ITEMS.some((nav) => nav.label === item));
  // An empty rotation would leave the display frozen on whatever was last shown,
  // which looks identical to a crash. Fall back rather than allow it.
  return valid.length > 0 ? valid : [...fallback];
}

/** Reconstructs a full settings object from arbitrary stored JSON. */
export function coerceSettings(raw: unknown): ArkaSettings {
  const d = DEFAULT_SETTINGS;
  if (!raw || typeof raw !== 'object') return d;
  const stored = raw as Record<string, any>;

  const appearance = stored.appearance ?? {};
  const map = stored.map ?? {};
  const notifications = stored.notifications ?? {};
  const autoRotate = stored.autoRotate ?? {};
  const refresh = stored.refresh ?? {};
  const integrations = stored.integrations ?? {};

  return {
    appearance: {
      density: pickEnum(appearance.density, DENSITIES, d.appearance.density),
      reduceMotion: pickBool(appearance.reduceMotion, d.appearance.reduceMotion),
      showTicker: pickBool(appearance.showTicker, d.appearance.showTicker),
      alwaysShowProvenance: pickBool(appearance.alwaysShowProvenance, d.appearance.alwaysShowProvenance),
    },
    map: {
      basemap: pickEnum(map.basemap, BASEMAPS, d.map.basemap),
      defaultZoom: pickNumber(map.defaultZoom, ZOOM_RANGE, d.map.defaultZoom),
      defaultCenter: pickCoords(map.defaultCenter, d.map.defaultCenter),
      fitToIncidentsOnLoad: pickBool(map.fitToIncidentsOnLoad, d.map.fitToIncidentsOnLoad),
      followFocusedEntity: pickBool(map.followFocusedEntity, d.map.followFocusedEntity),
    },
    layers: pickLayers(stored.layers),
    notifications: {
      minimumTone: pickEnum(notifications.minimumTone, TONES, d.notifications.minimumTone),
      criticalIncidents: pickBool(notifications.criticalIncidents, d.notifications.criticalIncidents),
      weatherWarnings: pickBool(notifications.weatherWarnings, d.notifications.weatherWarnings),
      infrastructureFailures: pickBool(
        notifications.infrastructureFailures,
        d.notifications.infrastructureFailures
      ),
      dailyBriefing: pickBool(notifications.dailyBriefing, d.notifications.dailyBriefing),
      sound: pickBool(notifications.sound, d.notifications.sound),
    },
    autoRotate: {
      enabled: pickBool(autoRotate.enabled, d.autoRotate.enabled),
      intervalSeconds: pickNumber(autoRotate.intervalSeconds, ROTATE_RANGE, d.autoRotate.intervalSeconds),
      tabs: pickTabs(autoRotate.tabs, d.autoRotate.tabs),
    },
    refresh: {
      cadenceSeconds:
        refresh.cadenceSeconds == null
          ? null
          : pickNumber(refresh.cadenceSeconds, CADENCE_RANGE, d.refresh.cadenceSeconds ?? 60),
      pauseWhenHidden: pickBool(refresh.pauseWhenHidden, d.refresh.pauseWhenHidden),
    },
    dataMode: pickEnum(stored.dataMode, DATA_MODES, d.dataMode),
    integrations: {
      telegram: pickBool(integrations.telegram, d.integrations.telegram),
      cityGis: pickBool(integrations.cityGis, d.integrations.cityGis),
    },
  };
}

// --- Persistence -------------------------------------------------------------

export function loadSettings(): ArkaSettings {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return coerceSettings(JSON.parse(raw));
  } catch {
    // Private browsing, a disabled storage quota or corrupt JSON. Defaults are a
    // correct answer here; failing to open the dashboard is not.
    return DEFAULT_SETTINGS;
  }
}

/** Returns false when storage rejected the write, so the UI can say so. */
export function persistSettings(settings: ArkaSettings): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function clearStoredSettings(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * A patch over the settings tree: any group may be supplied partially.
 *
 * One level of partiality is deliberate — deeper merging would make it possible
 * to write a group that is missing required fields, which is exactly what the
 * coercion above exists to prevent.
 */
export type SettingsPatch = {
  [K in keyof ArkaSettings]?: ArkaSettings[K] extends object
    ? Partial<ArkaSettings[K]>
    : ArkaSettings[K];
};

export function mergeSettings(current: ArkaSettings, patch: SettingsPatch): ArkaSettings {
  return {
    appearance: { ...current.appearance, ...patch.appearance },
    map: { ...current.map, ...patch.map },
    layers: { ...current.layers, ...patch.layers },
    notifications: { ...current.notifications, ...patch.notifications },
    autoRotate: { ...current.autoRotate, ...patch.autoRotate },
    refresh: { ...current.refresh, ...patch.refresh },
    dataMode: patch.dataMode ?? current.dataMode,
    integrations: { ...current.integrations, ...patch.integrations },
  };
}
