/**
 * Attribute formatting shared by every surface that displays a GIS feature.
 *
 * Popups, the feature info card and spatial-query results all render the same
 * attributes, so the field-name-to-label mapping and the unit handling live here
 * rather than in each view. One consequence matters operationally: a value that
 * is absent, blank or a placeholder renders identically everywhere — as absent.
 * It is never coerced into a zero, a dash or an empty string that could be read
 * as a measurement.
 */

import type { GISAttributeRow, GISLayerDef, GISPopupField } from './types';

/**
 * Render one attribute value, or null when the source did not publish it.
 *
 * Three kinds of "no value" are collapsed to null on purpose:
 *
 *  - `null` / `undefined` — the column is empty.
 *  - a blank or single-space string — several source tables use `' '` as their
 *    null marker rather than SQL NULL.
 *  - zero, when the field is marked `suppressZero` because its column is only
 *    partly populated.
 */
export function formatValue(value: unknown, field: Pick<GISPopupField, 'format' | 'suppressZero'>): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);

  // An unpopulated numeric column reads as a measured zero unless we stop it.
  if (value === 0 && field.suppressZero) return null;

  switch (field.format) {
    case 'integer':
      return Math.round(value).toLocaleString('en-IN');
    case 'decimal':
      return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    case 'area-hectares':
      return `${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ha`;
    case 'area-sqm':
      // Square metres in the source; hectares is what a planner reads.
      return `${(value / 10_000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ha`;
    case 'length-metres':
      return value >= 1000
        ? `${(value / 1000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} km`
        : `${Math.round(value).toLocaleString('en-IN')} m`;
    default:
      return value.toLocaleString('en-IN');
  }
}

/**
 * Convert a feature's raw provider attributes into readable rows.
 *
 * Only fields the catalogue declares are returned, in catalogue order, and only
 * those the feature actually carries a value for. Raw provider column names
 * (`nameofthec`, `totalwardp`, `Name_of_ICDS_Centre`) never reach the interface.
 */
export function describeAttributes(layer: GISLayerDef, properties: Record<string, unknown>): GISAttributeRow[] {
  const rows: GISAttributeRow[] = [];
  for (const field of layer.popupFields ?? []) {
    const value = formatValue(properties[field.field], field);
    if (value === null) continue;
    rows.push({ label: field.label, value });
  }
  return rows;
}

/**
 * Best available display name for a feature.
 *
 * Falls back through the layer's search field, then its first popup field, then
 * the layer label itself — so a result row is always identifiable even when the
 * source publishes no name column.
 */
export function featureLabel(layer: GISLayerDef, properties: Record<string, unknown>): string {
  const candidates: string[] = [];
  if (layer.searchField) candidates.push(layer.searchField);
  for (const field of layer.popupFields ?? []) candidates.push(field.field);

  for (const key of candidates) {
    const raw = properties[key];
    if (typeof raw === 'string' && raw.trim().length) return raw.trim();
    if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  }
  return layer.label;
}
