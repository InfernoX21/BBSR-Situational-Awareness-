/**
 * Runtime state for ARKA's base GIS tier.
 *
 * `BhubaneswarGISService` describes *what* layers exist; this registry tracks
 * what each one is currently *doing* — shown or hidden, at what opacity,
 * loading or failed. It is deliberately separate from `CentralLayerManager`,
 * which owns ARKA's own live overlays: base GIS is reference cartography from a
 * third party and must not inherit the live tier's simulated telemetry ticks or
 * be toggled by its presets.
 *
 * The store is a plain observable — same subscribe/notify shape as
 * `CentralLayerManager`, so `LayerControlToolbar` can consume both without a
 * new state library.
 */

import type { CityGISProvider, GISLayerDef, GISLayerRuntime, GISSourceState } from './types';
import { bhubaneswarGIS } from './BhubaneswarGISService';

type Listener = (state: Record<string, GISLayerRuntime>) => void;

/** Persisted so an operator's layer selection survives a reload. */
const STORAGE_KEY = 'arka.gis.baseLayers.v1';

interface PersistedLayer {
  visible: boolean;
  opacity: number;
}

/**
 * Resting state for a layer nothing has been requested for yet.
 *
 * Every layer in the catalogue was verified against the live service before it
 * was published, so "we have not asked yet" is `available-dataset` — a dataset
 * ARKA knows exists. It only becomes `connected` once a request actually
 * returns, and `unavailable` only if one fails. Nothing is ever described as
 * connected on the strength of the catalogue alone.
 */
const RESTING_STATE: GISSourceState = 'available-dataset';

export class GISLayerRegistry {
  private readonly provider: CityGISProvider;
  private readonly runtime = new Map<string, GISLayerRuntime>();
  private readonly listeners = new Set<Listener>();

  constructor(provider: CityGISProvider) {
    this.provider = provider;

    const restored = this.readPersisted();
    for (const layer of provider.listLayers()) {
      const saved = restored[layer.id];
      this.runtime.set(layer.id, {
        layerId: layer.id,
        visible: saved ? saved.visible : layer.defaultVisible,
        opacity: saved ? saved.opacity : layer.defaultOpacity,
        sourceState: RESTING_STATE,
        error: null,
        featureCount: null,
        lastLoadedAt: null,
        truncated: false,
      });
    }
  }

  // --- Reads ------------------------------------------------------------

  getProvider(): CityGISProvider {
    return this.provider;
  }

  listLayers(): GISLayerDef[] {
    return this.provider.listLayers();
  }

  /** Snapshot keyed by layer id, safe to hold in React state. */
  getState(): Record<string, GISLayerRuntime> {
    const out: Record<string, GISLayerRuntime> = {};
    for (const [id, value] of this.runtime) out[id] = { ...value };
    return out;
  }

  get(layerId: string): GISLayerRuntime | undefined {
    const value = this.runtime.get(layerId);
    return value ? { ...value } : undefined;
  }

  isVisible(layerId: string): boolean {
    return this.runtime.get(layerId)?.visible ?? false;
  }

  visibleLayerIds(): string[] {
    return this.provider
      .listLayers()
      .filter((l) => this.isVisible(l.id))
      .map((l) => l.id);
  }

  /** Count of shown layers, for the toolbar summary. */
  visibleCount(): number {
    let n = 0;
    for (const value of this.runtime.values()) if (value.visible) n += 1;
    return n;
  }

  /** True when any layer is mid-request, for a single toolbar spinner. */
  isAnyLoading(): boolean {
    for (const value of this.runtime.values()) if (value.sourceState === 'loading') return true;
    return false;
  }

  /**
   * Layers whose source could not be reached, so the toolbar can show a real
   * count. A layer that answered with zero features is not in this list — that
   * is `no-data`, a fact about the city rather than a fault.
   */
  unavailableLayerIds(): string[] {
    return [...this.runtime.values()].filter((v) => v.sourceState === 'unavailable').map((v) => v.layerId);
  }

  // --- Writes -----------------------------------------------------------

  setVisible(layerId: string, visible: boolean): void {
    this.patch(layerId, (prev) =>
      prev.visible === visible
        ? prev
        : {
            ...prev,
            visible,
            // Hiding clears transient state so re-showing reports its own
            // outcome rather than a stale error from last time.
            sourceState: visible ? prev.sourceState : RESTING_STATE,
            error: visible ? prev.error : null,
          },
    );
    this.persist();
  }

  toggle(layerId: string): void {
    this.setVisible(layerId, !this.isVisible(layerId));
  }

  setOpacity(layerId: string, opacity: number): void {
    const clamped = Math.min(1, Math.max(0, opacity));
    this.patch(layerId, (prev) => (prev.opacity === clamped ? prev : { ...prev, opacity: clamped }));
    this.persist();
  }

  /** Hide every base GIS layer. Does not touch ARKA's own overlays. */
  hideAll(): void {
    let changed = false;
    for (const [id, value] of this.runtime) {
      if (!value.visible) continue;
      this.runtime.set(id, { ...value, visible: false, sourceState: RESTING_STATE, error: null });
      changed = true;
    }
    if (changed) {
      this.persist();
      this.notify();
    }
  }

  /** Restore the catalogue's own defaults. */
  resetToDefaults(): void {
    for (const layer of this.provider.listLayers()) {
      const prev = this.runtime.get(layer.id);
      if (!prev) continue;
      this.runtime.set(layer.id, {
        ...prev,
        visible: layer.defaultVisible,
        opacity: layer.defaultOpacity,
        sourceState: RESTING_STATE,
        error: null,
      });
    }
    this.persist();
    this.notify();
  }

  /** Show exactly the layers in one category, leaving other categories alone. */
  showCategory(category: GISLayerDef['category'], visible: boolean): void {
    let changed = false;
    for (const layer of this.provider.listLayers()) {
      if (layer.category !== category) continue;
      const prev = this.runtime.get(layer.id);
      if (!prev || prev.visible === visible) continue;
      this.runtime.set(layer.id, {
        ...prev,
        visible,
        sourceState: visible ? prev.sourceState : RESTING_STATE,
        error: visible ? prev.error : null,
      });
      changed = true;
    }
    if (changed) {
      this.persist();
      this.notify();
    }
  }

  // --- Source-state reporting (called by the map adapter) ---------------

  markLoading(layerId: string): void {
    this.patch(layerId, (prev) => ({ ...prev, sourceState: 'loading', error: null }));
  }

  markLoaded(layerId: string, detail: { featureCount?: number | null; truncated?: boolean } = {}): void {
    const featureCount = detail.featureCount ?? null;
    // A request that succeeded but returned nothing is 'no-data', not
    // 'connected'. The distinction is the difference between "the city has none
    // of these here" and "the source answered" — an operator must be able to
    // tell an empty map from a working one.
    const sourceState: GISSourceState = featureCount === 0 ? 'no-data' : 'connected';

    this.patch(layerId, (prev) => ({
      ...prev,
      sourceState,
      error: null,
      featureCount,
      truncated: detail.truncated ?? false,
      lastLoadedAt: new Date().toISOString(),
    }));
  }

  markError(layerId: string, message: string): void {
    // 'unavailable', never 'no-data': a failed request says nothing about
    // whether the dataset holds features.
    this.patch(layerId, (prev) => ({ ...prev, sourceState: 'unavailable', error: message }));
  }

  // --- Subscription -----------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  private patch(layerId: string, update: (prev: GISLayerRuntime) => GISLayerRuntime): void {
    const prev = this.runtime.get(layerId);
    if (!prev) return;
    const next = update(prev);
    if (next === prev) return;
    this.runtime.set(layerId, next);
    this.notify();
  }

  // --- Persistence ------------------------------------------------------

  private readPersisted(): Record<string, PersistedLayer> {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const out: Record<string, PersistedLayer> = {};
      for (const [id, value] of Object.entries(parsed)) {
        const entry = value as Partial<PersistedLayer>;
        if (typeof entry?.visible !== 'boolean' || typeof entry?.opacity !== 'number') continue;
        if (!Number.isFinite(entry.opacity)) continue;
        out[id] = { visible: entry.visible, opacity: Math.min(1, Math.max(0, entry.opacity)) };
      }
      return out;
    } catch {
      // Private browsing, disabled storage or corrupt JSON — fall back to
      // catalogue defaults rather than failing the map.
      return {};
    }
  }

  private persist(): void {
    try {
      const payload: Record<string, PersistedLayer> = {};
      for (const [id, value] of this.runtime) {
        payload[id] = { visible: value.visible, opacity: value.opacity };
      }
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Persistence is a convenience; never let it break a layer toggle.
    }
  }
}

/** Shared registry over the active city provider. */
export const gisLayerRegistry = new GISLayerRegistry(bhubaneswarGIS);
