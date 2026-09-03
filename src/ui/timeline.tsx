/**
 * Timeline and playback.
 *
 * One vocabulary for every ordered sequence in ARKA: incident history, workflow
 * stages, agent tool calls, the audit trail. All four are "things that happened,
 * in order, with a time and an actor", so all four render through the same node.
 *
 * Every node demands a timestamp and an actor. An audit entry without an actor is
 * not an audit entry, and the component makes that omission visible rather than
 * quietly rendering a blank.
 */

import { memo, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { Pause, Play, SkipBack, SkipForward } from 'lucide-react';
import { cx } from './cx';
import { Clock } from './status';
import { IconButton, Select } from './primitives';

export type TimelineNodeState = 'pending' | 'current' | 'done' | 'failed';

const NODE_CLASS: Record<TimelineNodeState, string> = {
  pending: '',
  current: 'is-current',
  done: 'is-done',
  failed: 'is-failed',
};

export function Timeline({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ol className={cx('ark-timeline space-y-2.5', className)} role="list">
      {children}
    </ol>
  );
}

export interface TimelineItemProps {
  title: string;
  state?: TimelineNodeState;
  /** ISO instant. Rendered as an absolute clock time — audit needs the moment. */
  at?: string | null;
  /** Who or what did this: an operator id, an agency, an agent name. */
  actor?: string | null;
  detail?: ReactNode;
  /** Badges: severity, status, confidence, approval state. */
  meta?: ReactNode;
  /** Nested content, e.g. an agent's tool arguments or a diff. */
  children?: ReactNode;
  className?: string;
}

export const TimelineItem = memo(function TimelineItem({
  title,
  state = 'pending',
  at,
  actor,
  detail,
  meta,
  children,
  className,
}: TimelineItemProps) {
  return (
    <li className={cx('ark-timeline-node', NODE_CLASS[state], className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={cx(
            'text-[12px] font-semibold min-w-0 truncate',
            state === 'failed' ? 'text-critical' : state === 'pending' ? 'text-ink-subtle' : 'text-ink',
          )}
        >
          {title}
        </span>
        {at !== undefined && (
          <span className="shrink-0">
            {at ? <Clock iso={at} /> : <span className="ark-unknown">NO TIME</span>}
          </span>
        )}
      </div>
      {(actor !== undefined || meta) && (
        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
          {actor !== undefined &&
            (actor ? (
              <span className="text-[10.5px] text-ink-faint">{actor}</span>
            ) : (
              <span className="ark-unknown">NO ACTOR RECORDED</span>
            ))}
          {meta}
        </div>
      )}
      {detail && <div className="mt-0.5 text-[11.5px] text-ink-muted leading-snug">{detail}</div>}
      {children && <div className="mt-1.5">{children}</div>}
    </li>
  );
});

// --- Playback ----------------------------------------------------------------

const SPEEDS = [
  { value: '0.5', label: '0.5×' },
  { value: '1', label: '1×' },
  { value: '2', label: '2×' },
  { value: '4', label: '4×' },
  { value: '8', label: '8×' },
] as const;

export interface TimelineScrubberProps {
  /** Current frame index, 0-based. */
  index: number;
  /** Total frames. The scrubber is inert at 0 rather than pretending to scrub. */
  total: number;
  onIndexChange: (index: number) => void;
  playing: boolean;
  onPlayingChange: (playing: boolean) => void;
  /** Milliseconds per frame at 1×. */
  frameMs?: number;
  speed?: number;
  onSpeedChange?: (speed: number) => void;
  /** Label for the current frame: its timestamp, or "T+04:12". */
  readout?: ReactNode;
  className?: string;
}

/**
 * Frame-by-frame playback for a recorded sequence.
 *
 * Used for incident replay and map history. Advancing stops at the last frame
 * rather than looping: an operator reviewing an incident needs to know they have
 * reached the present, and a loop hides that.
 */
export function TimelineScrubber({
  index,
  total,
  onIndexChange,
  playing,
  onPlayingChange,
  frameMs = 1000,
  speed = 1,
  onSpeedChange,
  readout,
  className,
}: TimelineScrubberProps) {
  const indexRef = useRef(index);
  indexRef.current = index;
  const changeRef = useRef(onIndexChange);
  changeRef.current = onIndexChange;
  const playingRef = useRef(onPlayingChange);
  playingRef.current = onPlayingChange;

  useEffect(() => {
    if (!playing || total === 0) return;
    const timer = setInterval(() => {
      const next = indexRef.current + 1;
      if (next >= total) {
        changeRef.current(total - 1);
        playingRef.current(false);
        return;
      }
      changeRef.current(next);
    }, Math.max(60, frameMs / Math.max(0.25, speed)));
    return () => clearInterval(timer);
  }, [playing, total, frameMs, speed]);

  const step = useCallback(
    (delta: number) => {
      if (total === 0) return;
      onIndexChange(Math.max(0, Math.min(total - 1, index + delta)));
    },
    [index, total, onIndexChange],
  );

  const inert = total === 0;

  return (
    <div className={cx('flex items-center gap-2 min-w-0', className)}>
      <IconButton
        label="Step back"
        icon={<SkipBack size={13} />}
        disabled={inert || index === 0}
        onClick={() => step(-1)}
      />
      <IconButton
        label={playing ? 'Pause playback' : 'Play back sequence'}
        icon={playing ? <Pause size={13} /> : <Play size={13} />}
        active={playing}
        disabled={inert}
        onClick={() => onPlayingChange(!playing)}
      />
      <IconButton
        label="Step forward"
        icon={<SkipForward size={13} />}
        disabled={inert || index >= total - 1}
        onClick={() => step(1)}
      />

      <input
        type="range"
        className="ark-range flex-1 min-w-24"
        aria-label="Playback position"
        min={0}
        max={Math.max(0, total - 1)}
        step={1}
        value={index}
        disabled={inert}
        onChange={(event) => onIndexChange(Number(event.target.value))}
      />

      <span className="ark-mono text-[10.5px] text-ink-subtle shrink-0 tabular-nums">
        {inert ? '—' : `${index + 1}/${total}`}
      </span>
      {readout && <span className="shrink-0">{readout}</span>}

      {onSpeedChange && (
        <Select
          value={String(speed)}
          options={SPEEDS}
          onValueChange={(value) => onSpeedChange(Number(value))}
          aria-label="Playback speed"
          disabled={inert}
          className="w-16 shrink-0"
        />
      )}
    </div>
  );
}
