/**
 * Data-source health.
 *
 * The brief asks for data-source health, last-updated timestamps and provenance
 * as first-class government-grade features. This is where they live: one row per
 * registered feed, showing what it is, how it arrives, when it last succeeded,
 * and — when it is failing — the actual error rather than a generic red dot.
 *
 * It replaces the Settings page's "WEBSOCKET STATUS · CONNECTED (Port 3000) ·
 * LATENCY 14 ms · INGESTION RATE 14.2 msg/sec" panel, every figure of which was
 * a literal in the markup. `transport.ts` documents that this build has no
 * websocket at all; the transport column here says `poll` because that is what
 * the feed actually does.
 */

import { memo, useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import type { FeedStatus } from '../store/ArkaStore';
import {
  Button,
  Drawer,
  EmptyState,
  FeedHealthRow,
  PageSection,
  summariseFeeds,
} from '../ui';

export interface SourceHealthDrawerProps {
  open: boolean;
  onClose: () => void;
  feeds: readonly FeedStatus[];
  /** Re-polls one feed, or every feed when called without an id. */
  onRefresh: (id?: string) => void;
}

export const SourceHealthDrawer = memo(function SourceHealthDrawer({
  open,
  onClose,
  feeds,
  onRefresh,
}: SourceHealthDrawerProps) {
  const health = summariseFeeds(feeds);

  // Failing sources first: an operator opening this panel is asking "what is
  // broken", not "list my feeds alphabetically".
  const ordered = useMemo(() => {
    const RANK: Record<FeedStatus['state'], number> = {
      UNAVAILABLE: 0,
      FALLBACK: 1,
      CACHED: 2,
      SIMULATED: 3,
      SEED: 4,
      LIVE: 5,
    };
    return [...feeds].sort((a, b) => RANK[a.state] - RANK[b.state] || a.label.localeCompare(b.label));
  }, [feeds]);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      eyebrow="Diagnostics"
      title="Data source health"
      subtitle={
        health.total === 0
          ? 'No sources have registered with the ingestion layer.'
          : `${health.live} of ${health.total} sources reporting live.`
      }
      width={440}
      actions={
        <Button
          variant="secondary"
          size="xs"
          icon={<RefreshCw size={12} />}
          onClick={() => onRefresh()}
          disabled={health.total === 0}
        >
          Re-poll all
        </Button>
      }
    >
      <div className="p-3 space-y-4">
        {ordered.length === 0 ? (
          <EmptyState
            title="No sources registered"
            detail="Ingestion has not started, so ARKA has nothing to report on. This is a startup state, not a fault."
          />
        ) : (
          <>
            {health.failing.length > 0 && (
              <PageSection
                title="Failing"
                hint={`${health.failing.length} source${health.failing.length === 1 ? '' : 's'} unreachable`}
              >
                <div className="space-y-1">
                  {health.failing.map((feed) => (
                    <FeedHealthRow key={feed.id} feed={feed} onRefresh={onRefresh} />
                  ))}
                </div>
              </PageSection>
            )}

            <PageSection title="All sources" hint={`${ordered.length} registered`}>
              <div className="space-y-1">
                {ordered.map((feed) => (
                  <FeedHealthRow key={feed.id} feed={feed} onRefresh={onRefresh} />
                ))}
              </div>
            </PageSection>
          </>
        )}

        <p className="text-[11px] leading-relaxed text-ink-faint border-t border-line pt-2.5">
          Cadence is the requested polling interval, not a guarantee. A source reads CACHED when it
          is replaying the last value it received, and UNAVAILABLE when no approved source is
          reachable — in both cases the modules that depend on it show the age of what they are
          displaying rather than substituting a value.
        </p>
      </div>
    </Drawer>
  );
});
