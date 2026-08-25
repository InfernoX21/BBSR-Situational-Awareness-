/**
 * A* over the road graph.
 *
 * Multi-source, multi-target. That is not gold-plating — it is what snapping
 * requires. A vehicle standing mid-block can legally reach either end of the
 * segment it is on, so the search starts from both endpoints with the cost of
 * driving to each already charged, and finishes at whichever endpoint of the
 * destination segment yields the cheapest total. One search instead of four, and
 * the answer is the true optimum rather than the optimum of an arbitrary guess
 * about which end to use.
 *
 * The heuristic is straight-line distance to the nearest target plus that
 * target's exit cost. Admissible so long as every edge costs at least its length
 * in metres, which is why all cost multipliers in this engine are >= 1: an
 * incentive below 1 would let A* return a non-optimal path while claiming
 * optimality, and "optimal" is a claim this system makes to operators.
 */

import { haversineM } from './geo';
import type { GraphEdge, RoadGraph } from './RoadGraph';

/** Entry point into the graph, with the cost of reaching it already paid. */
export interface PathSource {
  nodeId: string;
  initialCostM: number;
}

/** Exit point, with the cost of leaving it charged on arrival. */
export interface PathTarget {
  nodeId: string;
  finalCostM: number;
}

/**
 * Cost of traversing one edge, in metres-equivalent.
 *
 * Must return at least `edge.lengthM`. Return `Infinity` to make an edge
 * impassable — that is how closures and no-go zones are expressed, rather than
 * by deleting geometry.
 */
export type EdgeCostFn = (edge: GraphEdge) => number;

export interface TraversedEdge {
  edge: GraphEdge;
  /** True when travelled in published `a → b` order. */
  forward: boolean;
}

export interface PathResult {
  edges: TraversedEdge[];
  nodeIds: string[];
  /** Total weighted cost, including source and target charges. */
  costM: number;
  /** Total real geometry length of the traversed edges, in metres. */
  lengthM: number;
  expanded: number;
  startNodeId: string;
  endNodeId: string;
}

/** Min-heap keyed on f-score. Plain array heap; no dependency, no allocation churn. */
class MinHeap {
  private readonly keys: number[] = [];
  private readonly values: string[] = [];

  get size(): number {
    return this.keys.length;
  }

  push(key: number, value: string): void {
    this.keys.push(key);
    this.values.push(value);
    let i = this.keys.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.keys[parent] <= this.keys[i]) break;
      this.swap(parent, i);
      i = parent;
    }
  }

  pop(): string | undefined {
    if (this.keys.length === 0) return undefined;
    const top = this.values[0];
    const lastKey = this.keys.pop() as number;
    const lastValue = this.values.pop() as string;

    if (this.keys.length > 0) {
      this.keys[0] = lastKey;
      this.values[0] = lastValue;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < this.keys.length && this.keys[left] < this.keys[smallest]) smallest = left;
        if (right < this.keys.length && this.keys[right] < this.keys[smallest]) smallest = right;
        if (smallest === i) break;
        this.swap(i, smallest);
        i = smallest;
      }
    }

    return top;
  }

  private swap(a: number, b: number): void {
    const k = this.keys[a];
    this.keys[a] = this.keys[b];
    this.keys[b] = k;
    const v = this.values[a];
    this.values[a] = this.values[b];
    this.values[b] = v;
  }
}

export interface FindPathOptions {
  sources: PathSource[];
  targets: PathTarget[];
  cost: EdgeCostFn;
  /** Safety valve so a pathological graph cannot hang the UI thread. */
  maxExpansions?: number;
}

const DEFAULT_MAX_EXPANSIONS = 250_000;

/**
 * Shortest path under `cost`, or null when no connected path exists.
 *
 * Null is the load-bearing case: it is what produces `NO VALID ROUTE AVAILABLE`
 * upstream. Nothing here ever falls back to a straight line.
 */
export function findPath(graph: RoadGraph, options: FindPathOptions): PathResult | null {
  const { cost, sources, targets } = options;
  const maxExpansions = options.maxExpansions ?? DEFAULT_MAX_EXPANSIONS;

  if (sources.length === 0 || targets.length === 0) return null;

  const targetById = new Map<string, number>();
  for (const t of targets) {
    const existing = targetById.get(t.nodeId);
    if (existing === undefined || t.finalCostM < existing) targetById.set(t.nodeId, t.finalCostM);
  }

  const targetPoints: { lat: number; lng: number; finalCostM: number }[] = [];
  for (const [nodeId, finalCostM] of targetById) {
    const node = graph.nodeAt(nodeId);
    if (node) targetPoints.push({ lat: node.lat, lng: node.lng, finalCostM });
  }
  if (targetPoints.length === 0) return null;

  const heuristic = (lat: number, lng: number): number => {
    let best = Number.POSITIVE_INFINITY;
    for (const t of targetPoints) {
      const h = haversineM(lat, lng, t.lat, t.lng) + t.finalCostM;
      if (h < best) best = h;
    }
    return best;
  };

  const gScore = new Map<string, number>();
  const cameFrom = new Map<string, { nodeId: string; edgeIndex: number; forward: boolean }>();
  const closed = new Set<string>();
  const open = new MinHeap();

  for (const source of sources) {
    const node = graph.nodeAt(source.nodeId);
    if (!node) continue;
    const existing = gScore.get(source.nodeId);
    if (existing !== undefined && existing <= source.initialCostM) continue;
    gScore.set(source.nodeId, source.initialCostM);
    open.push(source.initialCostM + heuristic(node.lat, node.lng), source.nodeId);
  }

  let expanded = 0;
  let goal: string | null = null;

  while (open.size > 0) {
    const current = open.pop() as string;
    if (closed.has(current)) continue;
    closed.add(current);
    expanded += 1;

    if (targetById.has(current)) {
      goal = current;
      break;
    }

    if (expanded >= maxExpansions) break;

    const g = gScore.get(current) as number;
    for (const link of graph.neighbours(current)) {
      if (closed.has(link.toNodeId)) continue;

      const edge = graph.edgeAt(link.edgeIndex);
      const weight = cost(edge);
      if (!Number.isFinite(weight)) continue;

      const tentative = g + weight;
      const known = gScore.get(link.toNodeId);
      if (known !== undefined && known <= tentative) continue;

      gScore.set(link.toNodeId, tentative);
      cameFrom.set(link.toNodeId, { nodeId: current, edgeIndex: link.edgeIndex, forward: link.forward });

      const node = graph.nodeAt(link.toNodeId);
      if (!node) continue;
      open.push(tentative + heuristic(node.lat, node.lng), link.toNodeId);
    }
  }

  if (!goal) return null;

  // Walk the parent chain back to whichever source was actually used.
  const edges: TraversedEdge[] = [];
  const nodeIds: string[] = [goal];
  let cursor = goal;
  let lengthM = 0;

  while (cameFrom.has(cursor)) {
    const step = cameFrom.get(cursor) as { nodeId: string; edgeIndex: number; forward: boolean };
    const edge = graph.edgeAt(step.edgeIndex);
    edges.push({ edge, forward: step.forward });
    lengthM += edge.lengthM;
    cursor = step.nodeId;
    nodeIds.push(cursor);
  }

  edges.reverse();
  nodeIds.reverse();

  return {
    edges,
    nodeIds,
    costM: (gScore.get(goal) as number) + (targetById.get(goal) as number),
    lengthM,
    expanded,
    startNodeId: cursor,
    endNodeId: goal,
  };
}
