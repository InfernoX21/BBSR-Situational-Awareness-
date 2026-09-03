/**
 * Notifications.
 *
 * Two kinds, deliberately separated:
 *
 *   toast   — transient confirmation of something the operator just did.
 *   alert   — an operational event that must be acknowledged before it clears.
 *
 * The distinction matters in a control room. A toast that auto-dismisses is fine
 * for "route saved". An unacknowledged critical alert must not disappear because
 * nobody was looking at the screen for four seconds, so alerts have no timeout
 * and expose an explicit acknowledge control that reports back who cleared it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Check, Info, X, XOctagon } from 'lucide-react';
import { cx } from './cx';
import { Button, IconButton } from './primitives';

export type NotifyTone = 'critical' | 'warning' | 'info' | 'success';

const TONE_CLASS: Record<NotifyTone, string> = {
  critical: 'is-critical',
  warning: 'is-high',
  info: 'is-low',
  success: 'is-resolved',
};

const TONE_ICON: Record<NotifyTone, ReactNode> = {
  critical: <XOctagon size={13} className="text-critical" aria-hidden />,
  warning: <AlertTriangle size={13} className="text-warning" aria-hidden />,
  info: <Info size={13} className="text-info" aria-hidden />,
  success: <Check size={13} className="text-success" aria-hidden />,
};

export interface NotifyInput {
  tone?: NotifyTone;
  /** One line. The operator reads this at a glance and nothing more. */
  title: string;
  /** Optional second line: the reason, the source, the record id. */
  detail?: string;
  /**
   * Requires an explicit acknowledgement and never auto-dismisses. Use for
   * anything an operator is accountable for having seen.
   */
  requiresAck?: boolean;
  /** Milliseconds before auto-dismissal. Ignored when `requiresAck`. */
  ttlMs?: number;
  /** Single inline action, e.g. "Open incident". */
  action?: { label: string; onClick: () => void };
  /** Called when the operator acknowledges. Wire to the audit trail. */
  onAcknowledge?: () => void;
}

interface Notification extends NotifyInput {
  id: string;
  tone: NotifyTone;
}

interface NotifyApi {
  /** Raises a notification and returns its id. */
  notify: (input: NotifyInput) => string;
  dismiss: (id: string) => void;
  /** Clears every transient notification. Leaves un-acknowledged alerts. */
  clearTransient: () => void;
  /** Count of notifications still awaiting acknowledgement. */
  pendingAck: number;
}

const NotifyContext = createContext<NotifyApi | null>(null);

const DEFAULT_TTL = 4500;

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Notification[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback(
    (input: NotifyInput) => {
      counter.current += 1;
      const id = `n${counter.current}`;
      const item: Notification = { tone: 'info', ...input, id };
      setItems((prev) => {
        // Cap the stack. Alerts awaiting acknowledgement are never evicted.
        const next = [...prev, item];
        if (next.length <= 5) return next;
        const evictable = next.findIndex((candidate) => !candidate.requiresAck);
        if (evictable === -1) return next;
        return next.filter((_, index) => index !== evictable);
      });
      if (!input.requiresAck) {
        const timer = setTimeout(() => dismiss(id), input.ttlMs ?? DEFAULT_TTL);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  const clearTransient = useCallback(() => {
    setItems((prev) => {
      for (const item of prev) {
        if (item.requiresAck) continue;
        const timer = timers.current.get(item.id);
        if (timer) {
          clearTimeout(timer);
          timers.current.delete(item.id);
        }
      }
      return prev.filter((item) => item.requiresAck);
    });
  }, []);

  useEffect(
    () => () => {
      for (const timer of timers.current.values()) clearTimeout(timer);
      timers.current.clear();
    },
    [],
  );

  const pendingAck = items.filter((item) => item.requiresAck).length;

  const api = useMemo<NotifyApi>(
    () => ({ notify, dismiss, clearTransient, pendingAck }),
    [notify, dismiss, clearTransient, pendingAck],
  );

  return (
    <NotifyContext.Provider value={api}>
      {children}
      <NotificationHost items={items} onDismiss={dismiss} />
    </NotifyContext.Provider>
  );
}

/**
 * Access to the notification queue.
 *
 * Returns a no-op implementation outside a provider rather than throwing, so a
 * component rendered in isolation — a map layer, a detail panel under test —
 * still works.
 */
export function useNotify(): NotifyApi {
  const context = useContext(NotifyContext);
  return (
    context ?? {
      notify: () => '',
      dismiss: () => {},
      clearTransient: () => {},
      pendingAck: 0,
    }
  );
}

function NotificationHost({
  items,
  onDismiss,
}: {
  items: readonly Notification[];
  onDismiss: (id: string) => void;
}) {
  if (typeof document === 'undefined' || items.length === 0) return null;

  return createPortal(
    <div
      className="fixed bottom-3 right-3 z-[1100] flex flex-col-reverse gap-1.5 pointer-events-none"
      role="region"
      aria-label="Notifications"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cx('ark-toast pointer-events-auto', TONE_CLASS[item.tone])}
          role={item.tone === 'critical' ? 'alert' : 'status'}
          aria-live={item.tone === 'critical' ? 'assertive' : 'polite'}
        >
          <span className="shrink-0 mt-px">{TONE_ICON[item.tone]}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-ink leading-snug">{item.title}</p>
            {item.detail && <p className="mt-0.5 text-[11px] text-ink-subtle leading-snug">{item.detail}</p>}
            {(item.action || item.requiresAck) && (
              <div className="mt-1.5 flex items-center gap-1.5">
                {item.action && (
                  <Button size="xs" variant="outline" onClick={item.action.onClick}>
                    {item.action.label}
                  </Button>
                )}
                {item.requiresAck && (
                  <Button
                    size="xs"
                    variant="secondary"
                    onClick={() => {
                      item.onAcknowledge?.();
                      onDismiss(item.id);
                    }}
                  >
                    Acknowledge
                  </Button>
                )}
              </div>
            )}
          </div>
          {!item.requiresAck && (
            <IconButton label="Dismiss" icon={<X size={12} />} onClick={() => onDismiss(item.id)} />
          )}
        </div>
      ))}
    </div>,
    document.body,
  );
}
