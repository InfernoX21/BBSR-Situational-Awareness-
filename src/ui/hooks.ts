/**
 * Shared hooks for the ARKA interface.
 *
 * The clock deserves a note. Ages ("14 s ago") have to re-render on their own,
 * and the previous interface solved that with a `setInterval` per component —
 * a dashboard with thirty timestamps ran thirty timers and re-rendered thirty
 * subtrees a second. Here one module-level interval drives every subscriber
 * through `useSyncExternalStore`, and the snapshot is quantised to the caller's
 * granularity so a component asking for 5-second precision re-renders once per
 * five seconds rather than once per second.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react';

// --- Shared clock ------------------------------------------------------------

const clockListeners = new Set<() => void>();
let clockTimer: ReturnType<typeof setInterval> | null = null;
let clockNow = Date.now();

function clockTick(): void {
  clockNow = Date.now();
  for (const listener of clockListeners) listener();
}

function subscribeClock(onChange: () => void): () => void {
  clockListeners.add(onChange);
  if (clockTimer === null) {
    clockNow = Date.now();
    clockTimer = setInterval(clockTick, 1000);
  }
  return () => {
    clockListeners.delete(onChange);
    if (clockListeners.size === 0 && clockTimer !== null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
}

/**
 * Current epoch milliseconds, quantised to `granularitySeconds`.
 *
 * Returns a number that only changes once per granularity window, so React's
 * bail-out does the throttling and the component does not need to.
 */
export function useClock(granularitySeconds = 1): number {
  const getSnapshot = useCallback(() => {
    const step = granularitySeconds * 1000;
    return Math.floor(clockNow / step) * step;
  }, [granularitySeconds]);
  return useSyncExternalStore(subscribeClock, getSnapshot, getSnapshot);
}

/**
 * Seconds elapsed since an ISO timestamp, recomputed on the shared clock.
 * Null when the timestamp is absent or unparseable — never 0, which would read
 * as "just now".
 */
export function useAge(iso: string | null | undefined, granularitySeconds = 5): number | null {
  const now = useClock(granularitySeconds);
  return useMemo(() => {
    if (!iso) return null;
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) return null;
    return Math.max(0, Math.round((now - parsed) / 1000));
  }, [iso, now]);
}

// --- Keyboard ----------------------------------------------------------------

/** True when the event target is a field that owns its own keystrokes. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable ||
    target.getAttribute('role') === 'textbox'
  );
}

export interface Hotkey {
  /** `event.key`, compared case-insensitively. */
  key: string;
  ctrlOrMeta?: boolean;
  shift?: boolean;
  alt?: boolean;
  /** Fire even while the operator is typing in a field. Rare; Escape wants it. */
  allowInInput?: boolean;
  handler: (event: KeyboardEvent) => void;
  /** Description surfaced by the shortcuts help sheet. */
  description?: string;
}

/**
 * Binds a set of global shortcuts.
 *
 * The array is read through a ref so a caller can pass a freshly-built array on
 * every render without re-binding the listener — which matters because the shell
 * that owns the shortcut table re-renders on every store change.
 */
export function useHotkeys(hotkeys: readonly Hotkey[], enabled = true): void {
  const ref = useRef(hotkeys);
  ref.current = hotkeys;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const typing = isTypingTarget(event.target);
      const pressedModifier = event.ctrlKey || event.metaKey;
      for (const hotkey of ref.current) {
        if (event.key.toLowerCase() !== hotkey.key.toLowerCase()) continue;
        if (!!hotkey.ctrlOrMeta !== pressedModifier) continue;
        if (!!hotkey.shift !== event.shiftKey) continue;
        if (!!hotkey.alt !== event.altKey) continue;
        if (typing && !hotkey.allowInInput) continue;
        event.preventDefault();
        hotkey.handler(event);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

/** Escape-to-dismiss for one overlay. Bound at the top of the document. */
export function useEscape(onEscape: () => void, enabled = true): void {
  const ref = useRef(onEscape);
  ref.current = onEscape;
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        ref.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enabled]);
}

// --- Dismissal ---------------------------------------------------------------

/** Calls `onOutside` on a pointer press outside `ref`. For popovers and menus. */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  onOutside: () => void,
  enabled = true,
): void {
  const handler = useRef(onOutside);
  handler.current = onOutside;
  useEffect(() => {
    if (!enabled) return;
    const onPointerDown = (event: PointerEvent) => {
      const node = ref.current;
      if (node && event.target instanceof Node && !node.contains(event.target)) handler.current();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [ref, enabled]);
}

// --- Layout ------------------------------------------------------------------

/** Reactive media query. Used to switch the shell between rail and drawer nav. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window === 'undefined' ? false : window.matchMedia(query).matches,
  );
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    onChange();
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Observed pixel size of an element. Drives list virtualisation. */
export function useElementSize<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  width: number;
  height: number;
} {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((prev) =>
        Math.abs(prev.width - width) < 1 && Math.abs(prev.height - height) < 1
          ? prev
          : { width: Math.round(width), height: Math.round(height) },
      );
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
}

// --- Deferred work -----------------------------------------------------------

/**
 * State mirrored into `localStorage`.
 *
 * Backs the brief's persistent filters, saved map views and per-operator layout
 * choices. Failures are swallowed on purpose: a locked-down browser profile or a
 * full quota must degrade to a session-only preference, never break a control
 * room screen. Nothing operational is stored through this — only preferences.
 */
export function useStoredState<T>(
  key: string,
  initial: T,
): [T, (next: T | ((previous: T) => T)) => void] {
  const storageKey = `arka.ui.${key}`;
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = window.localStorage.getItem(storageKey);
      return raw === null ? initial : (JSON.parse(raw) as T);
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved =
          typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(resolved));
        } catch {
          // Preference is session-only this time. Not worth surfacing.
        }
        return resolved;
      });
    },
    [storageKey],
  );

  return [value, set];
}

/**
 * Debounced mirror of a value. Used for search boxes so a 900-row table is not
 * refiltered on every keystroke.
 */
export function useDebounced<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/**
 * True once the element has been within the viewport.
 *
 * The mechanism behind deferred heavy panels: a chart below the fold does not
 * load Recharts until it is scrolled to, and does not unload it afterwards
 * (which would reintroduce the cost on every scroll).
 */
export function useHasBeenVisible<T extends HTMLElement>(
  rootMargin = '200px',
): { ref: RefObject<T | null>; visible: boolean } {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  return { ref, visible };
}
