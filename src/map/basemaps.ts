/**
 * Basemap and 3D style definitions for the MapLibre GL map.
 *
 * Every source here is keyless and free to use, so the platform has no
 * API-key dependency and no vendor lock-in:
 *   - OpenFreeMap  — hosted OpenMapTiles vector styles + the `planet` tileset
 *                    (which carries the `building` layer used for extrusions)
 *   - Esri         — World Imagery / Reference / Terrain Base raster services
 *   - AWS Terrain  — public `elevation-tiles-prod` terrarium DEM tiles
 *
 * The six basemap ids match the existing `BasemapStyle` union so the layer
 * toolbar, LayerManager and saved state keep working unchanged.
 */

import type { Map as MaplibreMap } from 'maplibre-gl';
import type { BasemapStyle } from '../types';

/* Types derived from maplibre-gl's own signatures so we do not have to depend
   on @maplibre/maplibre-gl-style-spec directly. */
export type MapStyleSpec = Exclude<
  NonNullable<ConstructorParameters<typeof MaplibreMap>[0]['style']>,
  string
>;
export type MapLayerSpec = Parameters<MaplibreMap['addLayer']>[0];
export type MapSourceSpec = Parameters<MaplibreMap['addSource']>[1];
export type MapTerrainSpec = NonNullable<Parameters<MaplibreMap['setTerrain']>[0]>;
export type MapSkySpec = Parameters<MaplibreMap['setSky']>[0];

/* ------------------------------------------------------------------ view --- */

/** Bhubaneswar city centre, in GeoJSON [lng, lat] order. */
export const CITY_CENTER: [number, number] = [85.8245, 20.2961];
export const DEFAULT_ZOOM = 13;
/** A slight tilt reads as 3D without hurting map legibility. */
export const DEFAULT_PITCH = 40;
export const DEFAULT_BEARING = 0;
export const MAX_PITCH = 75;

/* --------------------------------------------------------------- sources --- */

const OFM_HOST = 'https://tiles.openfreemap.org';

/** Glyph + sprite endpoints, needed by the hand-built raster styles. */
export const MAP_GLYPHS = `${OFM_HOST}/fonts/{fontstack}/{range}.pbf`;
export const MAP_SPRITE = `${OFM_HOST}/sprites/ofm_f384/ofm`;
/** The only fontstack guaranteed present on OpenFreeMap. */
export const MAP_FONT = ['Noto Sans Regular'];

/**
 * Vector source id. OpenFreeMap's hosted styles already name their source
 * `openmaptiles`, and the raster styles below reuse the same id, so a single
 * building-extrusion layer definition works on every basemap.
 */
export const VECTOR_SOURCE_ID = 'openmaptiles';
const OFM_PLANET_TILEJSON = `${OFM_HOST}/planet`;

export const TERRAIN_SOURCE_ID = 'arka-terrain-dem';
export const BUILDINGS_LAYER_ID = 'arka-buildings-3d';

const ESRI_IMAGERY =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ESRI_REFERENCE =
  'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}';
const ESRI_TERRAIN =
  'https://services.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}';

const ATTR_OFM =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
const ATTR_ESRI = 'Imagery © Esri, Maxar, Earthstar Geographics';
const ATTR_TERRAIN = 'Elevation © AWS Terrain Tiles / USGS, SRTM';

/* -------------------------------------------------------------- basemaps --- */

export interface BasemapDefinition {
  id: BasemapStyle;
  /** Label used in the basemap switcher. */
  label: string;
  /** One-line description shown under the label. */
  description: string;
  /** Imagery basemaps need a lighter marker treatment than vector ones. */
  kind: 'vector' | 'imagery';
  /** Drives sky colours, building tint and label halos. */
  tone: 'dark' | 'light';
  provider: string;
  /** A style URL (hosted) or a complete inline style specification. */
  style: string | MapStyleSpec;
}

/**
 * Raster basemaps are assembled by hand so they can carry the same vector
 * source (for 3D buildings) and glyph endpoint as the hosted vector styles.
 */
function rasterStyle(options: {
  tiles: string[];
  attribution: string;
  /** Optional transparent label/boundary raster drawn over the imagery. */
  overlayTiles?: string[];
  overlayAttribution?: string;
  maxzoom?: number;
  background: string;
}): MapStyleSpec {
  const layers: Record<string, unknown>[] = [
    {
      id: 'background',
      type: 'background',
      paint: { 'background-color': options.background },
    },
    {
      id: 'basemap-raster',
      type: 'raster',
      source: 'basemap-raster',
      paint: { 'raster-opacity': 1 },
    },
  ];

  const sources: Record<string, unknown> = {
    'basemap-raster': {
      type: 'raster',
      tiles: options.tiles,
      tileSize: 256,
      maxzoom: options.maxzoom ?? 19,
      attribution: options.attribution,
    },
    // Present on every basemap so the 3D building layer can be added
    // regardless of which basemap the operator selects.
    [VECTOR_SOURCE_ID]: {
      type: 'vector',
      url: OFM_PLANET_TILEJSON,
      attribution: ATTR_OFM,
    },
  };

  if (options.overlayTiles) {
    sources['basemap-reference'] = {
      type: 'raster',
      tiles: options.overlayTiles,
      tileSize: 256,
      maxzoom: options.maxzoom ?? 19,
      attribution: options.overlayAttribution ?? options.attribution,
    };
    layers.push({
      id: 'basemap-reference',
      type: 'raster',
      source: 'basemap-reference',
      paint: { 'raster-opacity': 0.9 },
    });
  }

  return {
    version: 8,
    name: 'ARKA raster basemap',
    glyphs: MAP_GLYPHS,
    sprite: MAP_SPRITE,
    sources,
    layers,
  } as unknown as MapStyleSpec;
}

export const BASEMAPS: BasemapDefinition[] = [
  {
    id: 'dark',
    label: 'Dark',
    description: 'Muted vector cartography — default operations basemap',
    kind: 'vector',
    tone: 'dark',
    provider: 'OpenFreeMap / OpenStreetMap',
    style: `${OFM_HOST}/styles/dark`,
  },
  {
    id: 'night',
    label: 'Night',
    description: 'Low-luminance vector basemap for night shifts',
    kind: 'vector',
    tone: 'dark',
    provider: 'OpenFreeMap / OpenStreetMap',
    style: `${OFM_HOST}/styles/fiord`,
  },
  {
    id: 'street',
    label: 'Street',
    description: 'Full street cartography with civic labels',
    kind: 'vector',
    tone: 'light',
    provider: 'OpenFreeMap / OpenStreetMap',
    style: `${OFM_HOST}/styles/liberty`,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    description: 'High-resolution imagery, no label clutter',
    kind: 'imagery',
    tone: 'dark',
    provider: 'Esri World Imagery',
    style: rasterStyle({
      tiles: [ESRI_IMAGERY],
      attribution: ATTR_ESRI,
      background: '#0a0c0f',
    }),
  },
  {
    id: 'hybrid',
    label: 'Hybrid',
    description: 'Imagery with roads, boundaries and place labels',
    kind: 'imagery',
    tone: 'dark',
    provider: 'Esri World Imagery + Reference',
    style: rasterStyle({
      tiles: [ESRI_IMAGERY],
      overlayTiles: [ESRI_REFERENCE],
      attribution: ATTR_ESRI,
      overlayAttribution: 'Reference layer © Esri',
      background: '#0a0c0f',
    }),
  },
  {
    id: 'terrain',
    label: 'Terrain',
    description: 'Shaded relief for drainage and elevation context',
    kind: 'imagery',
    tone: 'light',
    provider: 'Esri World Terrain Base',
    style: rasterStyle({
      tiles: [ESRI_TERRAIN],
      attribution: 'Terrain © Esri, USGS, NOAA',
      maxzoom: 13,
      background: '#11151a',
    }),
  },
];

export function getBasemap(id: BasemapStyle | undefined): BasemapDefinition {
  return BASEMAPS.find((b) => b.id === id) ?? BASEMAPS[0];
}

/* ---------------------------------------------------------------- 3D bits --- */

/**
 * Extruded buildings, driven by the OpenMapTiles `building` layer
 * (`render_height` / `render_min_height` / `hide_3d`).
 */
export function buildingsLayer(
  tone: 'dark' | 'light',
  opacity = 0.92
): MapLayerSpec {
  const ramp =
    tone === 'dark'
      ? ['#232a33', '#2c3542', '#3a4553', '#4b5867']
      : ['#d8dde4', '#cbd2db', '#bcc5d0', '#aab5c3'];

  return {
    id: BUILDINGS_LAYER_ID,
    type: 'fill-extrusion',
    source: VECTOR_SOURCE_ID,
    'source-layer': 'building',
    minzoom: 13,
    filter: ['!=', ['coalesce', ['get', 'hide_3d'], false], true],
    paint: {
      'fill-extrusion-color': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'render_height'], 6],
        0,
        ramp[0],
        12,
        ramp[1],
        40,
        ramp[2],
        90,
        ramp[3],
      ],
      'fill-extrusion-height': [
        'interpolate',
        ['linear'],
        ['zoom'],
        13,
        0,
        14.5,
        ['coalesce', ['get', 'render_height'], 6],
      ],
      'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
      'fill-extrusion-opacity': opacity,
      'fill-extrusion-vertical-gradient': true,
    },
  } as unknown as MapLayerSpec;
}

/** Public DEM used for real terrain elevation under the tilted view. */
export const TERRAIN_SOURCE: MapSourceSpec = {
  type: 'raster-dem',
  tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
  encoding: 'terrarium',
  tileSize: 256,
  maxzoom: 15,
  attribution: ATTR_TERRAIN,
} as unknown as MapSourceSpec;

export function terrainSpec(exaggeration = 1.4): MapTerrainSpec {
  return { source: TERRAIN_SOURCE_ID, exaggeration } as MapTerrainSpec;
}

/** Restrained atmosphere so the horizon does not glow on a tilted view. */
export function skyFor(tone: 'dark' | 'light'): MapSkySpec {
  if (tone === 'light') {
    return {
      'sky-color': '#aebfd2',
      'horizon-color': '#dfe6ee',
      'fog-color': '#e8edf3',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.5,
      'fog-ground-blend': 0.4,
      'atmosphere-blend': 0.5,
    } as MapSkySpec;
  }
  return {
    'sky-color': '#0a0f16',
    'horizon-color': '#1b232d',
    'fog-color': '#0b0d10',
    'sky-horizon-blend': 0.5,
    'horizon-fog-blend': 0.45,
    'fog-ground-blend': 0.35,
    'atmosphere-blend': 0.4,
  } as MapSkySpec;
}

/**
 * Operational overlays must sit under map labels but over the basemap fills.
 * Hosted styles differ, so the insert point is resolved from the live style.
 */
export function firstSymbolLayerId(map: MaplibreMap): string | undefined {
  const layers = map.getStyle()?.layers ?? [];
  return layers.find((layer) => layer.type === 'symbol')?.id;
}
