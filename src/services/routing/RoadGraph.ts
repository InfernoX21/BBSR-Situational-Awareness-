/**
 * Road network as a routing graph.
 *
 * The published data is a bag of polylines. This turns it into nodes and edges
 * so a pathfinder can walk it:
 *
 *   Node A ──── Edge (one published road segment) ──── Node B
 *
 * The single most important fact about this dataset is that it is *already
 * noded*. Segment endpoints from different features land on identical
 * coordinates — measured across an 11 km corridor, endpoints agree exactly at
 * six decimal places, 1,084 of 1,279 distinct endpoints are shared by two or
 * more segments, and only five interior vertices coincide with another segment's
 * endpoint. So intersections do not have to be discovered geometrically: keying
 * nodes on rounded endpoint coordinates recovers the city's own topology, and
 * 98.8% of the resulting nodes fall in one connected component.
 *
 * Consequences worth stating, because they shape what routing can promise:
 *
 * - Edges are UNDIRECTED. No oneway attribute is published, so the graph cannot
 *   model turn restrictions or one-way streets. Callers must disclose this.
 * - Edge weight is metres of published geometry. Not seconds — no speed
 *   attribute exists to convert with.
 * - A segment that touches another only at a mid-block crossing (a bridge over,
 *   or a genuine data gap) is not connected here. That is the correct reading of
 *   the source, and it is why `componentOf` exists: a route across a component
 *   boundary is reported as unreachable rather than drawn as a leap.
 */

import type { RoadClassDef, RoadSegmentRecord } from '../gis/types';
import { haversineM, mPerDegLng, M_PER_DEG_LAT, projectOnSegment } from './geo';
import type { LatLng } from './types';

/**
 * Decimal places used to key a node.
 *
 * Six is what the source publishes and what it agrees to; ~0.11 m at this
 * latitude. Rounding harder would fuse genuinely distinct junctions on a divided
 * carriageway, rounding softer would split shared endpoints into two nodes and
 * tear the graph apart.
 */
const NODE_PRECISION = 6;

/** Spatial index cell size in degrees, ~0.52 km east-west at this latitude. */
const CELL_SIZE_DEG = 0.005;

/** Conservative metres-per-cell, used to bound the snap ring search. */
const CELL_MIN_M = CELL_SIZE_DEG * Math.min(M_PER_DEG_LAT, mPerDegLng(20.3));

export interface GraphNode {
  id: string;
  lat: number;
  lng: number;
  /** Indices into `edges`. Undirected, so an edge appears at both endpoints. */
  edgeIndices: number[];
  component: number;
}

export interface GraphEdge {
  index: number;
  segmentId: string;
  classId: string;
  classRank: number;
  classLabel: string;
  street: string | null;
  /** Node id of the first published vertex. */
  a: string;
  /** Node id of the last published vertex. */
  b: string;
  /** Published vertices, `[lat, lng]`, in `a → b` order. Never modified. */
  coordinates: [number, number][];
  /** Haversine length over the published vertices. */
  lengthM: number;
}

/** One way to enter or leave the network from a snapped point. */
export interface SnapEntry {
  nodeId: string;
  /** Length of the partial run between the snapped point and that node. */
  tailM: number;
  /** That partial run, ordered snapped-point → node. */
  tail: [number, number][];
}

export interface SnapAnchor {
  requested: LatLng;
  point: LatLng;
  distanceM: number;
  edgeIndex: number;
  /** Snapped between published vertex `vertexIndex` and `vertexIndex + 1`. */
  vertexIndex: number;
  segmentId: string;
  classId: string;
  street: string | null;
  /** The two endpoints of the snapped segment, nearer one first. */
  entries: SnapEntry[];
}

function nodeKey(lat: number, lng: number): string {
  return `${lat.toFixed(NODE_PRECISION)},${lng.toFixed(NODE_PRECISION)}`;
}

export class RoadGraph {
  private readonly nodes = new Map<string, GraphNode>();
  private readonly edges: GraphEdge[] = [];
  private readonly cells = new Map<string, number[]>();
  private readonly segmentIds = new Set<string>();

  private componentCountValue = 0;
  private largestComponentSizeValue = 0;

  /**
   * Build a graph from published segments.
   *
   * `classes` supplies rank and label only. Duplicate segment ids are dropped,
   * which matters because overlapping bounding-box fetches legitimately return
   * the same arterial twice and a doubled edge would distort nothing but waste
   * search.
   */
  static build(segments: readonly RoadSegmentRecord[], classes: readonly RoadClassDef[]): RoadGraph {
    const graph = new RoadGraph();
    const byId = new Map<string, RoadClassDef>();
    for (const c of classes) byId.set(c.id, c);

    for (const segment of segments) graph.addSegment(segment, byId.get(segment.classId));
    graph.labelComponents();
    graph.freezeIndex();
    return graph;
  }

  get nodeCount(): number {
    return this.nodes.size;
  }

  get edgeCount(): number {
    return this.edges.length;
  }

  get componentCount(): number {
    return this.componentCountValue;
  }

  get largestComponentSize(): number {
    return this.largestComponentSizeValue;
  }

  edgeAt(index: number): GraphEdge {
    return this.edges[index];
  }

  nodeAt(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  componentOf(nodeId: string): number {
    return this.nodes.get(nodeId)?.component ?? -1;
  }

  /** Every edge leaving `nodeId`, with the direction of travel resolved. */
  neighbours(nodeId: string): { edgeIndex: number; forward: boolean; toNodeId: string }[] {
    const node = this.nodes.get(nodeId);
    if (!node) return [];

    const out: { edgeIndex: number; forward: boolean; toNodeId: string }[] = [];
    for (const index of node.edgeIndices) {
      const edge = this.edges[index];
      if (edge.a === nodeId && edge.b !== nodeId) out.push({ edgeIndex: index, forward: true, toNodeId: edge.b });
      else if (edge.b === nodeId && edge.a !== nodeId) out.push({ edgeIndex: index, forward: false, toNodeId: edge.a });
      // A closed loop (a === b) leads nowhere new and is skipped for traversal;
      // it still participates in snapping.
    }
    return out;
  }

  /**
   * Pull a raw coordinate onto the nearest published road segment.
   *
   * Returns null when nothing lies within `maxDistanceM` — which is a real
   * answer, not a failure to try. A vehicle 400 m from any mapped road cannot be
   * given a road route, and the caller must say so rather than start the line in
   * open ground.
   */
  snap(lat: number, lng: number, maxDistanceM: number): SnapAnchor | null {
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || this.edges.length === 0) return null;

    const baseLat = Math.floor(lat / CELL_SIZE_DEG);
    const baseLng = Math.floor(lng / CELL_SIZE_DEG);
    const maxRing = Math.ceil(maxDistanceM / CELL_MIN_M) + 1;

    let bestEdge = -1;
    let bestVertex = -1;
    let bestPoint: { lat: number; lng: number } | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;
    const tested = new Set<number>();

    for (let ring = 0; ring <= maxRing; ring += 1) {
      // Once a candidate is closer than the ring we are about to search, nothing
      // further out can beat it.
      if (bestEdge >= 0 && bestDistance <= (ring - 1) * CELL_MIN_M) break;

      for (const cell of this.ringCells(baseLat, baseLng, ring)) {
        const indices = this.cells.get(cell);
        if (!indices) continue;

        for (const index of indices) {
          if (tested.has(index)) continue;
          tested.add(index);

          const edge = this.edges[index];
          for (let v = 1; v < edge.coordinates.length; v += 1) {
            const p = projectOnSegment(
              lat,
              lng,
              edge.coordinates[v - 1][0],
              edge.coordinates[v - 1][1],
              edge.coordinates[v][0],
              edge.coordinates[v][1],
            );
            if (p.distanceM < bestDistance) {
              bestDistance = p.distanceM;
              bestEdge = index;
              bestVertex = v - 1;
              bestPoint = { lat: p.lat, lng: p.lng };
            }
          }
        }
      }
    }

    if (bestEdge < 0 || !bestPoint || bestDistance > maxDistanceM) return null;

    const edge = this.edges[bestEdge];
    const toA = this.tail(edge, bestVertex, bestPoint, 'a');
    const toB = this.tail(edge, bestVertex, bestPoint, 'b');
    const entries: SnapEntry[] = [
      { nodeId: edge.a, tailM: toA.lengthM, tail: toA.coordinates },
      { nodeId: edge.b, tailM: toB.lengthM, tail: toB.coordinates },
    ].sort((x, y) => x.tailM - y.tailM);

    return {
      requested: { lat, lng },
      point: bestPoint,
      distanceM: bestDistance,
      edgeIndex: bestEdge,
      vertexIndex: bestVertex,
      segmentId: edge.segmentId,
      classId: edge.classId,
      street: edge.street,
      entries,
    };
  }

  /**
   * The partial run of a segment between a snapped point and one of its
   * endpoints, ordered point → endpoint.
   *
   * This is what keeps the first and last legs of a route on the road instead of
   * cutting the corner: the vehicle travels along the segment it is standing on
   * until it reaches a junction the graph knows about.
   */
  tail(
    edge: GraphEdge,
    vertexIndex: number,
    point: { lat: number; lng: number },
    endpoint: 'a' | 'b',
  ): { coordinates: [number, number][]; lengthM: number } {
    const coordinates: [number, number][] = [[point.lat, point.lng]];

    if (endpoint === 'a') {
      for (let v = vertexIndex; v >= 0; v -= 1) coordinates.push(edge.coordinates[v]);
    } else {
      for (let v = vertexIndex + 1; v < edge.coordinates.length; v += 1) coordinates.push(edge.coordinates[v]);
    }

    // Drop a duplicate leading vertex when the snap landed exactly on one.
    if (
      coordinates.length > 1 &&
      coordinates[0][0] === coordinates[1][0] &&
      coordinates[0][1] === coordinates[1][1]
    ) {
      coordinates.splice(1, 1);
    }

    let lengthM = 0;
    for (let i = 1; i < coordinates.length; i += 1) {
      lengthM += haversineM(coordinates[i - 1][0], coordinates[i - 1][1], coordinates[i][0], coordinates[i][1]);
    }

    return { coordinates, lengthM };
  }

  /**
   * The run of one segment between two points snapped to it.
   *
   * Origin and destination often land on the same street — a callout halfway
   * along the block a unit is already parked on. Routing that through the
   * segment's endpoints would send the vehicle to a junction and back. This
   * returns the stretch of published geometry actually driven, in travel order.
   */
  subRun(from: SnapAnchor, to: SnapAnchor): { coordinates: [number, number][]; lengthM: number } | null {
    if (from.edgeIndex !== to.edgeIndex) return null;
    const edge = this.edges[from.edgeIndex];
    if (!edge) return null;

    const forward =
      from.vertexIndex < to.vertexIndex ||
      (from.vertexIndex === to.vertexIndex &&
        haversineM(edge.coordinates[from.vertexIndex][0], edge.coordinates[from.vertexIndex][1], from.point.lat, from.point.lng) <=
          haversineM(edge.coordinates[to.vertexIndex][0], edge.coordinates[to.vertexIndex][1], to.point.lat, to.point.lng));

    const coordinates: [number, number][] = [[from.point.lat, from.point.lng]];
    if (forward) {
      for (let v = from.vertexIndex + 1; v <= to.vertexIndex; v += 1) coordinates.push(edge.coordinates[v]);
    } else {
      for (let v = from.vertexIndex; v > to.vertexIndex; v -= 1) coordinates.push(edge.coordinates[v]);
    }
    coordinates.push([to.point.lat, to.point.lng]);

    const deduped: [number, number][] = [];
    for (const point of coordinates) {
      const prev = deduped[deduped.length - 1];
      if (prev && prev[0] === point[0] && prev[1] === point[1]) continue;
      deduped.push(point);
    }
    if (deduped.length < 2) return null;

    let lengthM = 0;
    for (let i = 1; i < deduped.length; i += 1) {
      lengthM += haversineM(deduped[i - 1][0], deduped[i - 1][1], deduped[i][0], deduped[i][1]);
    }

    return { coordinates: deduped, lengthM };
  }

  // --- Build -------------------------------------------------------------

  private addSegment(segment: RoadSegmentRecord, cls: RoadClassDef | undefined): void {
    if (segment.coordinates.length < 2) return;
    if (this.segmentIds.has(segment.id)) return;
    this.segmentIds.add(segment.id);

    const first = segment.coordinates[0];
    const last = segment.coordinates[segment.coordinates.length - 1];
    const a = this.ensureNode(first[0], first[1]);
    const b = this.ensureNode(last[0], last[1]);

    let lengthM = 0;
    for (let i = 1; i < segment.coordinates.length; i += 1) {
      lengthM += haversineM(
        segment.coordinates[i - 1][0],
        segment.coordinates[i - 1][1],
        segment.coordinates[i][0],
        segment.coordinates[i][1],
      );
    }
    if (lengthM <= 0) return;

    const index = this.edges.length;
    const edge: GraphEdge = {
      index,
      segmentId: segment.id,
      classId: segment.classId,
      classRank: cls?.rank ?? 9,
      classLabel: cls?.label ?? segment.classId,
      street: segment.street,
      a: a.id,
      b: b.id,
      coordinates: segment.coordinates,
      lengthM,
    };
    this.edges.push(edge);

    a.edgeIndices.push(index);
    if (b.id !== a.id) b.edgeIndices.push(index);

    this.indexEdge(edge);
  }

  private ensureNode(lat: number, lng: number): GraphNode {
    const id = nodeKey(lat, lng);
    let node = this.nodes.get(id);
    if (!node) {
      node = { id, lat, lng, edgeIndices: [], component: -1 };
      this.nodes.set(id, node);
    }
    return node;
  }

  /**
   * Register an edge in every grid cell its bounding box touches.
   *
   * A bbox is a superset of the cells the line actually crosses, so snapping may
   * test a few extra candidates but can never miss the true nearest one.
   */
  private indexEdge(edge: GraphEdge): void {
    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let minLng = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;

    for (const [lat, lng] of edge.coordinates) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    const latFrom = Math.floor(minLat / CELL_SIZE_DEG);
    const latTo = Math.floor(maxLat / CELL_SIZE_DEG);
    const lngFrom = Math.floor(minLng / CELL_SIZE_DEG);
    const lngTo = Math.floor(maxLng / CELL_SIZE_DEG);

    for (let y = latFrom; y <= latTo; y += 1) {
      for (let x = lngFrom; x <= lngTo; x += 1) {
        const key = `${y}:${x}`;
        const bucket = this.cells.get(key);
        if (bucket) bucket.push(edge.index);
        else this.cells.set(key, [edge.index]);
      }
    }
  }

  private *ringCells(baseLat: number, baseLng: number, ring: number): Generator<string> {
    if (ring === 0) {
      yield `${baseLat}:${baseLng}`;
      return;
    }
    for (let d = -ring; d <= ring; d += 1) {
      yield `${baseLat - ring}:${baseLng + d}`;
      yield `${baseLat + ring}:${baseLng + d}`;
    }
    for (let d = -ring + 1; d <= ring - 1; d += 1) {
      yield `${baseLat + d}:${baseLng - ring}`;
      yield `${baseLat + d}:${baseLng + ring}`;
    }
  }

  /**
   * Flood-fill connected components.
   *
   * Used to answer "is the destination reachable at all" before spending a
   * search on it, and to give a specific failure reason when it is not.
   */
  private labelComponents(): void {
    let component = 0;
    let largest = 0;

    for (const start of this.nodes.values()) {
      if (start.component !== -1) continue;

      let size = 0;
      const stack = [start];
      start.component = component;

      while (stack.length > 0) {
        const node = stack.pop() as GraphNode;
        size += 1;
        for (const index of node.edgeIndices) {
          const edge = this.edges[index];
          const otherId = edge.a === node.id ? edge.b : edge.a;
          const other = this.nodes.get(otherId);
          if (other && other.component === -1) {
            other.component = component;
            stack.push(other);
          }
        }
      }

      if (size > largest) largest = size;
      component += 1;
    }

    this.componentCountValue = component;
    this.largestComponentSizeValue = largest;
  }

  /** Sort each cell bucket so snap iteration order is stable across runs. */
  private freezeIndex(): void {
    for (const bucket of this.cells.values()) bucket.sort((a, b) => a - b);
  }
}
