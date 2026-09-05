/**
 * Overlays: modal, drawer, confirmation.
 *
 * All three portal to `document.body` so a panel with `overflow: hidden` — every
 * scrolling panel in ARKA — cannot clip them, and all three share one dismissal
 * contract: Escape closes, the scrim closes, focus returns to whatever opened it.
 *
 * The drawer is the important one. It is the platform's inspector: click an asset
 * on the map, a row in a table or an incident in the feed and the same drawer
 * opens with the same anatomy. That is why there is no per-page detail panel.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cx } from './cx';
import { Button, IconButton } from './primitives';

// --- Shared overlay behaviour ------------------------------------------------

let openOverlays = 0;

/**
 * Locks background scroll, closes on Escape, and restores focus on unmount.
 *
 * Scroll locking is reference-counted: a confirm dialog opened from inside a
 * drawer must not release the lock when it alone closes.
 */
function useOverlayBehaviour(open: boolean, onClose?: () => void): void {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    openOverlays += 1;
    const previousOverflow = document.body.style.overflow;
    if (openOverlays === 1) document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      closeRef.current?.();
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      openOverlays = Math.max(0, openOverlays - 1);
      if (openOverlays === 0) document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);
}

// --- Modal -------------------------------------------------------------------

const MODAL_WIDTH = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
} as const;

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** One line of context. Not a paragraph — a modal is not documentation. */
  subtitle?: string;
  /** Provenance or status devices, rendered beside the title. */
  meta?: ReactNode;
  size?: keyof typeof MODAL_WIDTH;
  /** Footer actions. Primary action rightmost, matching platform convention. */
  footer?: ReactNode;
  children: ReactNode;
  /** Set false when losing the contents would cost the operator work. */
  dismissOnScrim?: boolean;
  className?: string;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  meta,
  size = 'md',
  footer,
  children,
  dismissOnScrim = true,
  className,
}: ModalProps) {
  useOverlayBehaviour(open, onClose);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-start justify-center p-4 sm:p-8 overflow-y-auto ark-scroll">
      <div className="ark-scrim" onClick={dismissOnScrim ? onClose : undefined} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('ark-modal relative w-full my-auto', MODAL_WIDTH[size], className)}
      >
        <header className="shrink-0 flex items-start justify-between gap-3 px-3.5 py-2.5 border-b border-line">
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="ark-title truncate">{title}</h2>
              {meta}
            </div>
            {subtitle && <p className="mt-0.5 text-[11.5px] text-ink-subtle">{subtitle}</p>}
          </div>
          <IconButton label="Close" icon={<X size={14} />} onClick={onClose} />
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto ark-scroll p-3.5">{children}</div>
        {footer && (
          <footer className="shrink-0 flex items-center justify-end gap-2 px-3.5 py-2.5 border-t border-line">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

// --- Drawer ------------------------------------------------------------------

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** What kind of thing this is: "Incident", "Camera", "Feeder". */
  eyebrow?: string;
  subtitle?: string;
  /** Provenance strip, severity badge, status badge. */
  meta?: ReactNode;
  /** Header actions: acknowledge, escalate, dispatch. */
  actions?: ReactNode;
  side?: 'right' | 'left';
  width?: number;
  /** Sticky footer, for the primary action on a long inspector. */
  footer?: ReactNode;
  /** Renders without a scrim so the map stays readable and clickable behind it. */
  inline?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * The universal inspector.
 *
 * `inline` exists for the map: on a wide viewport the drawer sits beside the map
 * rather than over it, because an operator inspecting a hydrant still needs to
 * see the ward around it. On narrow viewports it becomes a normal scrimmed panel.
 */
export function Drawer({
  open,
  onClose,
  title,
  eyebrow,
  subtitle,
  meta,
  actions,
  side = 'right',
  width = 380,
  footer,
  inline = false,
  children,
  className,
}: DrawerProps) {
  useOverlayBehaviour(open && !inline, onClose);
  if (!open) return null;

  const panel = (
    <aside
      role="dialog"
      aria-label={title}
      aria-modal={inline ? undefined : 'true'}
      className={cx('ark-drawer relative', side === 'left' && 'is-left', className)}
      style={{ width: inline ? width : undefined, maxWidth: '100vw' }}
    >
      <header className="shrink-0 px-3 py-2.5 border-b border-line">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {eyebrow && <div className="ark-eyebrow">{eyebrow}</div>}
            <h2 className="ark-title mt-0.5 leading-snug">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11.5px] text-ink-subtle">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {actions}
            <IconButton label="Close inspector" icon={<X size={14} />} onClick={onClose} />
          </div>
        </div>
        {meta && <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">{meta}</div>}
      </header>
      <div className="flex-1 min-h-0 overflow-y-auto ark-scroll">{children}</div>
      {footer && (
        <footer className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-t border-line">{footer}</footer>
      )}
    </aside>
  );

  if (inline) return panel;

  return createPortal(
    <div
      className={cx('fixed inset-0 z-[1000] flex', side === 'left' ? 'justify-start' : 'justify-end')}
    >
      <div className="ark-scrim" onClick={onClose} aria-hidden />
      <div className="relative h-full" style={{ width, maxWidth: '100vw' }}>
        {panel}
      </div>
    </div>,
    document.body,
  );
}

// --- Confirmation ------------------------------------------------------------

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** What will happen, in plain terms. Include what cannot be undone. */
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Uses the danger treatment. Set for anything irreversible or outward-facing. */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Gate for consequential actions.
 *
 * ARKA has several: escalating an incident, notifying an external agency,
 * approving an autonomous agent action. All of them reach outside the control
 * room, so all of them stop here first.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      dismissOnScrim={!busy}
      footer={
        <>
          <Button variant="quiet" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} busy={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-[12.5px] text-ink-muted leading-relaxed">{body}</div>
    </Modal>
  );
}
