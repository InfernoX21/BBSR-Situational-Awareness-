/**
 * The ARKA table.
 *
 * One table implementation for the whole platform. Sorting, sticky header,
 * selection, numeric alignment, responsive column hiding and virtualisation are
 * all here, so a page that needs a table configures this rather than writing its
 * own `<table>` — which is how the previous interface ended up with nine table
 * styles and three different ideas about what an empty table looks like.
 *
 * Virtualisation uses spacer rows rather than absolute positioning. That keeps
 * real `<table>` semantics — column widths still resolve against the header,
 * screen readers still announce a table, and copy-paste still produces columns.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronsUpDown, ChevronUp } from 'lucide-react';
import { cx } from './cx';
import { useVirtualRows } from './virtual';

export type SortDirection = 'asc' | 'desc';
export type ColumnAlign = 'left' | 'center' | 'right';

export interface Column<T> {
  /** Stable identifier. Also the sort key. */
  key: string;
  header: string;
  /** Cell renderer. Must handle a row with the field missing. */
  render: (row: T) => ReactNode;
  /** Monospace, tabular, right-aligned. For anything an operator compares. */
  numeric?: boolean;
  align?: ColumnAlign;
  /** Fixed column width, e.g. `'96px'`. Omit to let the content size it. */
  width?: string;
  sortable?: boolean;
  /**
   * Sort key extractor. Nulls always sort last in both directions — an unknown
   * value is not a small value.
   */
  sortValue?: (row: T) => string | number | null | undefined;
  /** Header tooltip: what this column actually measures. */
  hint?: string;
  /** Hides the column below a breakpoint, so narrow viewports keep the essentials. */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
}

const HIDE_BELOW: Record<NonNullable<Column<unknown>['hideBelow']>, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
};

const ALIGN: Record<ColumnAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/** Row-rail tones. Same six the alert and incident rails use elsewhere. */
export type RailTone = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'neutral';

const RAIL: Record<RailTone, string> = {
  critical: 'ark-rail ark-rail-critical',
  high: 'ark-rail ark-rail-high',
  medium: 'ark-rail ark-rail-medium',
  low: 'ark-rail ark-rail-low',
  info: 'ark-rail ark-rail-info',
  neutral: 'ark-rail ark-rail-neutral',
};

/** Unaccented first cells keep the 2px gutter so the column never shifts. */
const RAIL_NONE = 'border-l-2 border-l-transparent';

export interface DataTableProps<T> {
  rows: readonly T[];
  columns: ReadonlyArray<Column<T>>;
  rowKey: (row: T) => string;
  /** Accessible name for the table. */
  label: string;
  defaultSort?: { key: string; dir: SortDirection };
  /** Controlled sort. Supply with `onSortChange` to lift sort into a page. */
  sort?: { key: string; dir: SortDirection } | null;
  onSortChange?: (sort: { key: string; dir: SortDirection }) => void;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  /**
   * Leading severity rail for a row, or null for none. Drawn as a 2px border on
   * the first cell so severity is readable as position, not only hue.
   *
   * A token rather than a colour, deliberately: a page that could pass
   * `'#ff0000'` here would eventually pass a red that is not the platform's red.
   */
  rowAccent?: (row: T) => RailTone | null;
  /** Extra classes per row, e.g. to dim an acknowledged alert. */
  rowClassName?: (row: T) => string | undefined;
  /** Rendered when there are no rows. Must distinguish empty from unavailable. */
  empty?: ReactNode;
  /** Row height in px. Only used when virtualising; must match actual density. */
  rowHeight?: number;
  /** Above this row count the body is windowed. */
  virtualizeAfter?: number;
  /** Caps the scroll container. Required for the sticky header to be useful. */
  maxHeight?: number | string;
  className?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  label,
  defaultSort,
  sort: controlledSort,
  onSortChange,
  onRowClick,
  selectedKey,
  rowAccent,
  rowClassName,
  empty,
  rowHeight = 33,
  virtualizeAfter = 120,
  maxHeight,
  className,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState<{ key: string; dir: SortDirection } | null>(
    defaultSort ?? null,
  );
  const sort = controlledSort !== undefined ? controlledSort : internalSort;

  const toggleSort = useCallback(
    (key: string) => {
      const next: { key: string; dir: SortDirection } =
        sort?.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
      if (onSortChange) onSortChange(next);
      else setInternalSort(next);
    },
    [sort, onSortChange],
  );

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((candidate) => candidate.key === sort.key);
    if (!column?.sortValue) return rows;
    const extract = column.sortValue;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const left = extract(a);
      const right = extract(b);
      // Unknowns sink to the bottom regardless of direction.
      const leftMissing = left == null || left === '';
      const rightMissing = right == null || right === '';
      if (leftMissing && rightMissing) return 0;
      if (leftMissing) return 1;
      if (rightMissing) return -1;
      if (typeof left === 'number' && typeof right === 'number') return (left - right) * factor;
      return String(left).localeCompare(String(right), undefined, { numeric: true }) * factor;
    });
  }, [rows, columns, sort]);

  const virtualise = sorted.length > virtualizeAfter;
  const { window: win, scrollRef } = useVirtualRows({
    count: virtualise ? sorted.length : 0,
    rowHeight,
    overscan: 8,
  });

  const visible = virtualise ? sorted.slice(win.start, win.end) : sorted;
  const padTop = virtualise ? win.start * rowHeight : 0;
  const padBottom = virtualise ? Math.max(0, win.totalHeight - win.end * rowHeight) : 0;

  return (
    <div
      ref={scrollRef}
      className={cx('overflow-auto ark-scroll min-h-0', className)}
      style={maxHeight != null ? { maxHeight } : undefined}
    >
      <table className="ark-table" aria-label={label} aria-rowcount={sorted.length}>
        <thead>
          <tr>
            {columns.map((column) => {
              const isSorted = sort?.key === column.key;
              const align = column.align ?? (column.numeric ? 'right' : 'left');
              return (
                <th
                  key={column.key}
                  scope="col"
                  title={column.hint}
                  style={column.width ? { width: column.width } : undefined}
                  aria-sort={isSorted ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={cx(
                    ALIGN[align],
                    column.sortable && 'is-sortable',
                    isSorted && 'is-sorted',
                    column.hideBelow && HIDE_BELOW[column.hideBelow],
                  )}
                  onClick={column.sortable ? () => toggleSort(column.key) : undefined}
                >
                  <span className={cx('inline-flex items-center gap-1', align === 'right' && 'flex-row-reverse')}>
                    {column.header}
                    {column.sortable &&
                      (isSorted ? (
                        sort.dir === 'asc' ? (
                          <ChevronUp size={11} aria-hidden />
                        ) : (
                          <ChevronDown size={11} aria-hidden />
                        )
                      ) : (
                        <ChevronsUpDown size={11} className="opacity-35" aria-hidden />
                      ))}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {padTop > 0 && (
            <tr aria-hidden>
              <td colSpan={columns.length} style={{ height: padTop, padding: 0, border: 0 }} />
            </tr>
          )}

          {visible.map((row) => {
            const key = rowKey(row);
            const accent = rowAccent?.(row) ?? null;
            const selected = selectedKey != null && selectedKey === key;
            return (
              <tr
                key={key}
                className={cx(
                  selected && 'is-selected',
                  onRowClick && 'cursor-pointer',
                  rowClassName?.(row),
                )}
                aria-selected={selected || undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column, columnIndex) => {
                  const align = column.align ?? (column.numeric ? 'right' : 'left');
                  return (
                    <td
                      key={column.key}
                      className={cx(
                        column.numeric && 'is-num',
                        !column.numeric && ALIGN[align],
                        column.hideBelow && HIDE_BELOW[column.hideBelow],
                        columnIndex === 0 && (accent ? RAIL[accent] : RAIL_NONE),
                      )}
                    >
                      {column.render(row)}
                    </td>
                  );
                })}
              </tr>
            );
          })}

          {padBottom > 0 && (
            <tr aria-hidden>
              <td colSpan={columns.length} style={{ height: padBottom, padding: 0, border: 0 }} />
            </tr>
          )}

          {sorted.length === 0 && empty && (
            <tr>
              <td colSpan={columns.length} style={{ padding: 0, border: 0 }}>
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Standard numeric cell.
 *
 * Renders an explicit unknown for null rather than a dash or a zero, so a column
 * of readings cannot silently include gaps that look like measurements.
 */
export function NumCell({
  value,
  unit,
  digits = 0,
}: {
  value: number | null | undefined;
  unit?: string;
  digits?: number;
}) {
  if (value == null || Number.isNaN(value)) return <span className="ark-unknown">—</span>;
  return (
    <span>
      {value.toFixed(digits)}
      {unit && <span className="text-ink-faint ml-0.5">{unit}</span>}
    </span>
  );
}

/** Primary identifying cell: a name on the first line, a qualifier under it. */
export function NameCell({
  primary,
  secondary,
  icon,
}: {
  primary: string;
  secondary?: string | null;
  icon?: ReactNode;
}) {
  return (
    <span className="flex items-center gap-2 min-w-0">
      {icon && (
        <span className="text-ink-faint shrink-0" aria-hidden>
          {icon}
        </span>
      )}
      <span className="min-w-0">
        <span className="block text-ink truncate">{primary}</span>
        {secondary && <span className="block text-[10.5px] text-ink-faint truncate">{secondary}</span>}
      </span>
    </span>
  );
}
