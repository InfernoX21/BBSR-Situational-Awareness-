/**
 * Change detection for feed ticks.
 *
 * Every feed here polls, which means it re-delivers the same records on every
 * cadence. If each tick emitted an event per record, the ticker would fill with
 * the same congested corridor every sixty seconds and the analytics counts would
 * measure polling frequency rather than city activity.
 *
 * So feeds emit on *transition*: a corridor that changes congestion level, a
 * utility that changes status, an incident that moves stage. The tracker below
 * holds the previous reading per record id and hands it back on the next tick.
 *
 * First sight is deliberately distinguishable from unchanged (`undefined` versus
 * an equal value), because the two need different treatment. An operator opening
 * the console on a corridor that is already jammed does need to be told; a camera
 * that has had three anomalies since before they arrived does not need those
 * three announced as if they just happened.
 */

export class ChangeTracker<T> {
  private readonly previous = new Map<string, T>();

  /**
   * Records the current value and returns the one before it.
   *
   * `undefined` means this id has not been seen since the last `retain` pruned
   * it — first sight, not "no change".
   */
  observe(id: string, value: T): T | undefined {
    const before = this.previous.get(id);
    this.previous.set(id, value);
    return before;
  }

  peek(id: string): T | undefined {
    return this.previous.get(id);
  }

  /**
   * Forgets every id outside `keep`.
   *
   * Called with the ids present in the current tick, so a record that disappears
   * and later returns is treated as newly arrived rather than compared against a
   * reading from an hour ago.
   */
  retain(keep: ReadonlySet<string>): void {
    for (const id of Array.from(this.previous.keys())) {
      if (!keep.has(id)) this.previous.delete(id);
    }
  }

  clear(): void {
    this.previous.clear();
  }
}

/**
 * Tracks which record ids a feed put into the store.
 *
 * Needed only where a kind has more than one writer. Incidents are the case:
 * the incident endpoint is authoritative for the incidents it holds, but an
 * operator can raise one locally that has not reached the server yet, and
 * `replaceKind` — which treats the incoming set as the complete truth — would
 * delete it on the next tick. Owning ids lets a feed remove exactly what it
 * created and leave everything else alone.
 */
export class OwnedIds {
  private owned = new Set<string>();

  /** Returns the ids this feed owned but the latest tick did not contain. */
  reconcile(current: ReadonlySet<string>): string[] {
    const gone: string[] = [];
    for (const id of this.owned) {
      if (!current.has(id)) gone.push(id);
    }
    this.owned = new Set(current);
    return gone;
  }

  clear(): string[] {
    const gone = Array.from(this.owned);
    this.owned = new Set();
    return gone;
  }
}
