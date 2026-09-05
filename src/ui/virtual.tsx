/**
 * Fixed-height list virtualisation.
 *
 * ARKA has several lists that are unbounded in principle — the event stream caps
 * at 750, camera rosters run to several hundred, the audit trail grows all shift.
 * Rendering those in full costs a DOM node per row forever, and the previous
 * interface did exactly that.
 *
 * Deliberately minimal and dependency-free: fixed row height, one scroll
 * listener, a windowed slice plus overscan. Variable-height virtualisation needs
 * measurement and a cache, and no list here needs it — every operational row in
 * ARKA is one of a handful of fixed densities.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { cx } from './cx';

export interface VirtualWindow {
  /** First index to render. */
  start: number;
  /** One past the last index to render. */
  end: number;
  /** Total scrollable height, in px. */
  totalHeight: number;
  /** Offset to translate the rendered slice by, in px. */
  offset: number;
}

/**
 * Computes the visible window for a scroll container.
 *
 * Returns the full range when the container has not been measured yet, so the
 * first paint is correct rather than empty — an empty first paint reads as "no
 * data", which is the one thing a list must never lie about.
 */
export function useVirtualRows(options: {
  count: number;
  rowHeight: number;
  /** Rows rendered beyond the viewport on each side. */
  overscan?: number;
}): { window: VirtualWindow; scrollRef: RefObject<HTMLDivElement | null> } {
  const { count, rowHeight, overscan = 6 } = options;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState({ scrollTop: 0, viewport: 0 });

  const measure = useCallback(() => {
    const node = scrollRef.current;
    if (!node) return;
    setMetrics((prev) => {
      const next = { scrollTop: node.scrollTop, viewport: node.clientHeight };
      return prev.scrollTop === next.scrollTop && prev.viewport === next.viewport ? prev : next;
    });
  }, []);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    measure();
    node.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => {
      node.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure]);

  const window_ = useMemo<VirtualWindow>(() => {
    const totalHeight = count * rowHeight;
    if (metrics.viewport === 0) {
      // Unmeasured: render a screenful rather than nothing.
      const guess = Math.min(count, 40);
      return { start: 0, end: guess, totalHeight, offset: 0 };
    }
    const first = Math.max(0, Math.floor(metrics.scrollTop / rowHeight) - overscan);
    const visible = Math.ceil(metrics.viewport / rowHeight) + overscan * 2;
    const last = Math.min(count, first + visible);
    return { start: first, end: last, totalHeight, offset: first * rowHeight };
  }, [count, rowHeight, overscan, metrics]);

  return { window: window_, scrollRef };
}

export interface VirtualListProps<T> {
  items: readonly T[];
  rowHeight: number;
  itemKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  /** Below this count the list renders in full and skips the windowing maths. */
  threshold?: number;
  overscan?: number;
  className?: string;
  /** Rendered when `items` is empty. */
  empty?: ReactNode;
  /** Accessible name for the list region. */
  label?: string;
}

/**
 * A virtualised vertical list.
 *
 * Short lists bypass virtualisation entirely: a 20-row list gains nothing from
 * an absolute-positioned window and loses the ability to size itself to its
 * content.
 */
export function VirtualList<T>({
  items,
  rowHeight,
  itemKey,
  renderItem,
  threshold = 60,
  overscan = 6,
  className,
  empty,
  label,
}: VirtualListProps<T>) {
  const virtualise = items.length > threshold;
  const { window: win, scrollRef } = useVirtualRows({
    count: virtualise ? items.length : 0,
    rowHeight,
    overscan,
  });

  if (items.length === 0) {
    return <div className={cx('min-h-0', className)}>{empty}</div>;
  }

  if (!virtualise) {
    return (
      <div className={cx('overflow-y-auto ark-scroll min-h-0', className)} aria-label={label}>
        {items.map((item, index) => (
          <div key={itemKey(item, index)} style={{ height: rowHeight }}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    );
  }

  const slice = items.slice(win.start, win.end);
  return (
    <div ref={scrollRef} className={cx('overflow-y-auto ark-scroll min-h-0', className)} aria-label={label}>
      <div style={{ height: win.totalHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${win.offset}px)` }}>
          {slice.map((item, offsetIndex) => {
            const index = win.start + offsetIndex;
            return (
              <div key={itemKey(item, index)} style={{ height: rowHeight }}>
                {renderItem(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
