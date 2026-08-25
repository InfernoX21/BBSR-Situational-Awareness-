/**
 * React binding for the base GIS layer registry.
 *
 * The registry is a plain observable outside React so the map adapter can drive
 * it imperatively. This hook is the only place a component subscribes, so every
 * panel sees the same snapshot on the same render.
 */

import { useEffect, useMemo, useState } from 'react';
import { gisLayerRegistry } from '../../services/gis/GISLayerRegistry';
import type { CityGISProvider, GISLayerDef, GISLayerRuntime } from '../../services/gis/types';

export interface GISRegistryView {
  registry: typeof gisLayerRegistry;
  provider: CityGISProvider;
  /** Catalogue, in draw order. Stable for the life of the session. */
  layers: GISLayerDef[];
  /** Live runtime state keyed by layer id. */
  runtime: Record<string, GISLayerRuntime>;
}

export function useGISRegistry(): GISRegistryView {
  const [runtime, setRuntime] = useState<Record<string, GISLayerRuntime>>(() => gisLayerRegistry.getState());

  useEffect(() => gisLayerRegistry.subscribe(setRuntime), []);

  // The catalogue is compiled at module load and never changes; reading it once
  // keeps every panel's `useMemo` keyed off a stable array.
  const layers = useMemo(() => gisLayerRegistry.listLayers(), []);
  const provider = useMemo(() => gisLayerRegistry.getProvider(), []);

  return { registry: gisLayerRegistry, provider, layers, runtime };
}
