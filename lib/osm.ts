// OpenStreetMap terrain: the Overpass query, conversion of raw Overpass JSON or an
// Overpass Turbo GeoJSON export into one normalized FeatureCollection, and the
// mapping of those features onto grid cells (trail/drainage/cliff/water/ridge flags).
// Thresholds and the elevation estimate are ILLUSTRATIVE, tuned for this demo.

import { ALL_CELLS, GRID_SIZE } from "./engine/grid";
import { CellElevation } from "./elevation";
import { BBox, cellBounds, cellSizeM, expandBbox, toGrid } from "./geo";
import { CellTerrain, Cover, FeatureKind, MapFeature, SOURCE_LABEL, TerrainModel, TerrainSource } from "./terrain";

export type Position = [number, number]; // [lon, lat], WGS84
export type Geometry =
  | { type: "Point"; coordinates: Position }
  | { type: "LineString"; coordinates: Position[] }
  | { type: "MultiLineString"; coordinates: Position[][] }
  | { type: "Polygon"; coordinates: Position[][] }
  | { type: "MultiPolygon"; coordinates: Position[][][] };

export interface TerrainProps {
  kind: FeatureKind;
  name?: string;
  ele?: number;
  osm_id?: string;
}
export interface TerrainFeature {
  type: "Feature";
  properties: TerrainProps;
  geometry: Geometry;
}
export interface TerrainFileMeta {
  bbox?: [number, number, number, number]; // south, west, north, east
  source?: string;
  osm_timestamp?: string;
  converted_at?: string;
  attribution?: string;
  synthetic?: boolean;
  label?: string;
}
export interface TerrainFeatureCollection {
  type: "FeatureCollection";
  trailhead?: TerrainFileMeta;
  features: TerrainFeature[];
}

export const TERRAIN_PARAMS = {
  sampleStepM: 10,
  trailMinM: 40,
  streamMinM: 40,
  cliffMinM: 60,
  ridgeMinM: 60,
  waterMinFrac: 0.3,
  /** Only list a feature in a cell for the parse prompt if it runs at least this far there. */
  promptMinM: 20,
  /** Elevation estimate: ground falls off from known summits at this rate (m per m). */
  slope: 0.3,
  drainageDropM: 40,
  treelineM: 1450,
  hardwoodBelowM: 700,
};

export function overpassQuery(b: BBox): string {
  return [
    `[out:json][timeout:25][bbox:${b.south},${b.west},${b.north},${b.east}];`,
    "(",
    '  way["highway"];',
    '  way["waterway"];',
    '  way["natural"~"^(water|cliff|ridge|arete)$"];',
    '  relation["natural"="water"];',
    '  node["natural"~"^(peak|saddle)$"];',
    ");",
    "out geom;",
  ].join("\n");
}

const TRAIL_HIGHWAYS = new Set(["path", "footway", "bridleway", "steps", "track", "cycleway", "via_ferrata"]);
const ROAD_HIGHWAYS = new Set([
  "unclassified",
  "service",
  "residential",
  "tertiary",
  "secondary",
  "primary",
  "trunk",
  "living_street",
  "road",
]);
const STREAM_WATERWAYS = new Set(["stream", "river", "brook", "creek", "canal", "drain", "ditch", "rapids"]);
const KINDS = new Set<FeatureKind>(["trail", "road", "stream", "water", "cliff", "ridge", "peak", "saddle"]);
const LINE_KINDS = new Set<FeatureKind>(["trail", "road", "stream", "cliff", "ridge"]);

export function classifyTags(tags: Record<string, unknown>): FeatureKind | null {
  const t = (k: string) => (typeof tags[k] === "string" ? (tags[k] as string) : undefined);
  const natural = t("natural");
  if (natural === "peak") return "peak";
  if (natural === "saddle") return "saddle";
  if (natural === "water" || t("water") || t("waterway") === "riverbank" || t("landuse") === "reservoir") return "water";
  if (natural === "cliff") return "cliff";
  if (natural === "ridge" || natural === "arete") return "ridge";
  const waterway = t("waterway");
  if (waterway && STREAM_WATERWAYS.has(waterway)) return "stream";
  const highway = t("highway");
  if (highway && TRAIL_HIGHWAYS.has(highway)) return "trail";
  if (highway && ROAD_HIGHWAYS.has(highway)) return "road";
  return null;
}

/** OSM `ele` is meters; tolerate "1917 m" and "6288 ft". */
export function parseEle(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v !== "string") return undefined;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*(m|ft|feet|')?\s*$/i.exec(v);
  if (!m) return undefined;
  const n = Number(m[1]);
  return m[2] && /^(ft|feet|')$/i.test(m[2]) ? n * 0.3048 : n;
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function isPosition(p: unknown): p is Position {
  return Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
}
function positions(c: unknown): Position[] {
  return Array.isArray(c) ? c.filter(isPosition).map((p): Position => [r6(p[0]), r6(p[1])]) : [];
}
const closed = (ring: Position[]) =>
  ring.length >= 4 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];

function makeProps(kind: FeatureKind, name: unknown, ele: unknown, osmId: string | undefined): TerrainProps {
  const props: TerrainProps = { kind };
  const n = str(name);
  if (n) props.name = n;
  const e = kind === "peak" || kind === "saddle" ? parseEle(ele) : undefined;
  if (e !== undefined) props.ele = Math.round(e * 10) / 10;
  if (osmId) props.osm_id = osmId;
  return props;
}

/** Turn a set of coordinate lists into the right geometry for a feature kind. */
function linesGeometry(kind: FeatureKind, lists: Position[][]): Geometry | null {
  const valid = lists.filter((l) => l.length >= 2);
  if (!valid.length) return null;
  if (kind === "water") {
    const rings = valid.filter(closed);
    if (!rings.length) return null;
    return rings.length === 1 ? { type: "Polygon", coordinates: [rings[0]] } : { type: "MultiPolygon", coordinates: rings.map((r) => [r]) };
  }
  if (!LINE_KINDS.has(kind)) return null;
  return valid.length === 1 ? { type: "LineString", coordinates: valid[0] } : { type: "MultiLineString", coordinates: valid };
}

// ---------------------------------------------------------------------------
// Raw Overpass JSON (`out geom`, or `out body; >; out skel qt;`)

interface OverpassLatLon {
  lat: number;
  lon: number;
}
interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  nodes?: number[];
  geometry?: (OverpassLatLon | null)[];
  members?: { type: string; ref: number; role: string; geometry?: (OverpassLatLon | null)[] }[];
}

const fromLatLon = (g?: (OverpassLatLon | null)[]) =>
  (g ?? []).filter((p): p is OverpassLatLon => !!p).map((p): Position => [r6(p.lon), r6(p.lat)]);

/** Join open way segments end-to-end into closed rings (multipolygon members). */
export function assembleRings(segments: Position[][]): Position[][] {
  const same = (a: Position, b: Position) => a[0] === b[0] && a[1] === b[1];
  const pool = segments.filter((s) => s.length >= 2).map((s) => [...s]);
  const rings: Position[][] = [];
  while (pool.length) {
    let ring = pool.shift()!;
    let grew = true;
    while (!same(ring[0], ring[ring.length - 1]) && grew) {
      grew = false;
      for (let i = 0; i < pool.length; i++) {
        const s = pool[i];
        const end = ring[ring.length - 1];
        if (same(s[0], end)) ring = ring.concat(s.slice(1));
        else if (same(s[s.length - 1], end)) ring = ring.concat([...s].reverse().slice(1));
        else continue;
        pool.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (closed(ring)) rings.push(ring);
  }
  return rings;
}

function overpassToFeatures(json: unknown): TerrainFeature[] {
  const elements = (json as { elements?: OverpassElement[] }).elements;
  if (!Array.isArray(elements)) throw new Error("Not an Overpass JSON response");
  const nodes = new Map<number, Position>();
  for (const e of elements) {
    if (e.type === "node" && Number.isFinite(e.lat) && Number.isFinite(e.lon)) nodes.set(e.id, [r6(e.lon!), r6(e.lat!)]);
  }
  const wayCoords = (e: OverpassElement): Position[] =>
    e.geometry ? fromLatLon(e.geometry) : (e.nodes ?? []).map((id) => nodes.get(id)).filter((p): p is Position => !!p);
  const ways = new Map<number, Position[]>();
  for (const e of elements) if (e.type === "way") ways.set(e.id, wayCoords(e));

  const out: TerrainFeature[] = [];
  for (const e of elements) {
    if (!e.tags) continue;
    const kind = classifyTags(e.tags);
    if (!kind) continue;
    const props = makeProps(kind, e.tags.name, e.tags.ele, `${e.type}/${e.id}`);
    let geometry: Geometry | null = null;
    if (e.type === "node") {
      const p = nodes.get(e.id);
      geometry = p && (kind === "peak" || kind === "saddle") ? { type: "Point", coordinates: p } : null;
    } else if (e.type === "way") {
      geometry = linesGeometry(kind, [ways.get(e.id) ?? []]);
    } else if (e.type === "relation" && kind === "water") {
      const member = (role: (r: string) => boolean) =>
        (e.members ?? [])
          .filter((m) => m.type === "way" && role(m.role))
          .map((m) => (m.geometry ? fromLatLon(m.geometry) : ways.get(m.ref) ?? []));
      const outers = assembleRings(member((r) => r !== "inner"));
      const inners = assembleRings(member((r) => r === "inner"));
      if (outers.length) {
        const polys = outers.map((o) => [o, ...inners.filter((h) => pointInRing(h[0], o))]);
        geometry = polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys };
      }
    }
    if (geometry) out.push({ type: "Feature", properties: props, geometry });
  }
  return out;
}

// ---------------------------------------------------------------------------
// GeoJSON: an Overpass Turbo export (tags as properties, "@id"), the older
// osmtogeojson layout (properties.tags), or this app's normalized format.

function geojsonToFeatures(input: unknown): TerrainFeature[] {
  const feats = (input as { features?: unknown[] }).features;
  if (!Array.isArray(feats)) throw new Error("Not a GeoJSON FeatureCollection");
  const out: TerrainFeature[] = [];
  for (const raw of feats) {
    const f = raw as { id?: unknown; properties?: Record<string, unknown> | null; geometry?: { type?: string; coordinates?: unknown } | null };
    const g = f?.geometry;
    if (!g?.type) continue;
    const p = f.properties ?? {};
    const tags = p.tags && typeof p.tags === "object" ? (p.tags as Record<string, unknown>) : p;
    const kind = KINDS.has(p.kind as FeatureKind) ? (p.kind as FeatureKind) : classifyTags(tags);
    if (!kind) continue;
    const osmId =
      str(p.osm_id) ?? str(p["@id"]) ?? (str(p.type) && p.id !== undefined ? `${p.type}/${p.id}` : undefined) ?? str(f.id);
    const props = makeProps(kind, p.name ?? tags.name, p.ele ?? tags.ele, osmId);
    const c = g.coordinates;
    let geometry: Geometry | null = null;
    switch (g.type) {
      case "Point":
        if ((kind === "peak" || kind === "saddle") && isPosition(c)) geometry = { type: "Point", coordinates: [r6(c[0]), r6(c[1])] };
        break;
      case "LineString":
        geometry = linesGeometry(kind, [positions(c)]);
        break;
      case "MultiLineString":
      case "Polygon": // a closed way exported as an area: water stays a polygon, line kinds use the outline
        geometry =
          kind === "water" && g.type === "Polygon"
            ? polygonGeometry([(c as unknown[]).map(positions)])
            : linesGeometry(kind, (Array.isArray(c) ? c : []).map(positions));
        break;
      case "MultiPolygon": {
        const polys = (Array.isArray(c) ? c : []).map((poly) => (Array.isArray(poly) ? poly : []).map(positions));
        geometry = kind === "water" ? polygonGeometry(polys) : linesGeometry(kind, polys.flat());
        break;
      }
    }
    if (geometry) out.push({ type: "Feature", properties: props, geometry });
  }
  return out;
}

function polygonGeometry(polys: Position[][][]): Geometry | null {
  const valid = polys.map((rings) => rings.filter(closed)).filter((rings) => rings.length > 0);
  if (!valid.length) return null;
  return valid.length === 1 ? { type: "Polygon", coordinates: valid[0] } : { type: "MultiPolygon", coordinates: valid };
}

// ---------------------------------------------------------------------------
// Clipping: keep what is inside the grid plus a one-cell margin.

function lineRuns(line: Position[], box: BBox): Position[][] {
  const runs: Position[][] = [];
  let run: Position[] = [];
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    const hit =
      Math.max(a[0], b[0]) >= box.west &&
      Math.min(a[0], b[0]) <= box.east &&
      Math.max(a[1], b[1]) >= box.south &&
      Math.min(a[1], b[1]) <= box.north;
    if (hit) {
      if (!run.length) run.push(a);
      run.push(b);
    } else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}

function clipFeature(f: TerrainFeature, box: BBox): TerrainFeature | null {
  const g = f.geometry;
  const inBox = (p: Position) => p[0] >= box.west && p[0] <= box.east && p[1] >= box.south && p[1] <= box.north;
  switch (g.type) {
    case "Point":
      return inBox(g.coordinates) ? f : null;
    case "LineString":
    case "MultiLineString": {
      const lines = g.type === "LineString" ? [g.coordinates] : g.coordinates;
      const runs = lines.flatMap((l) => lineRuns(l, box));
      if (!runs.length) return null;
      return { ...f, geometry: runs.length === 1 ? { type: "LineString", coordinates: runs[0] } : { type: "MultiLineString", coordinates: runs } };
    }
    case "Polygon":
    case "MultiPolygon": {
      const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      const kept = polys.filter((rings) => lineRuns(rings[0], box).length > 0);
      if (!kept.length) return null;
      return { ...f, geometry: kept.length === 1 ? { type: "Polygon", coordinates: kept[0] } : { type: "MultiPolygon", coordinates: kept } };
    }
  }
}

/**
 * Accept raw Overpass JSON, an Overpass Turbo GeoJSON export, or this app's own
 * format, and return the normalized FeatureCollection. With `clip`, features are
 * trimmed to that box plus a one-cell margin.
 */
export function normalizeTerrainData(input: unknown, clip?: BBox): TerrainFeatureCollection {
  if (!input || typeof input !== "object") throw new Error("Terrain data must be a JSON object");
  const features = "elements" in input ? overpassToFeatures(input) : geojsonToFeatures(input);
  const box = clip ? expandBbox(clip, 1) : null;
  const kept = box ? features.map((f) => clipFeature(f, box)).filter((f): f is TerrainFeature => f !== null) : features;
  const meta = (input as { trailhead?: TerrainFileMeta }).trailhead;
  return { type: "FeatureCollection", ...(meta ? { trailhead: meta } : {}), features: kept };
}

// ---------------------------------------------------------------------------
// Mapping features onto the grid

function pointInRing(p: [number, number] | Position, ring: [number, number][] | Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Douglas–Peucker in grid units, rounded to 0.001 of a cell. */
function simplify(line: [number, number][], tol = 0.02): [number, number][] {
  if (line.length <= 2) return line.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = line[a];
    const [bx, by] = line[b];
    const len = Math.hypot(bx - ax, by - ay);
    let maxD = 0;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      // Closed rings start and end on the same point: measure from that point instead of a zero-length line.
      const d =
        len < 1e-9
          ? Math.hypot(line[i][0] - ax, line[i][1] - ay)
          : Math.abs((bx - ax) * (ay - line[i][1]) - (ax - line[i][0]) * (by - ay)) / len;
      if (d > maxD) [maxD, idx] = [d, i];
    }
    if (idx >= 0 && maxD > tol) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return line.filter((_, i) => keep[i]).map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);
}

/** Build the per-cell terrain and drawable features for a grid bounding box. */
export function buildTerrainModel(
  fc: TerrainFeatureCollection,
  bbox: BBox,
  source: TerrainSource,
  opts: { fetchedAt?: string; label?: string; elevation?: Record<string, CellElevation> } = {},
): TerrainModel {
  const P = TERRAIN_PARAMS;
  const N = GRID_SIZE * GRID_SIZE;
  const { w: cellW, h: cellH } = cellSizeM(bbox);
  const cellIndex = ([gx, gy]: [number, number]) => {
    const x = Math.floor(gx);
    const y = Math.floor(gy);
    return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE ? y * GRID_SIZE + x : -1;
  };
  const project = (p: Position) => toGrid(bbox, p[0], p[1]);
  const len = { trail: new Float64Array(N), stream: new Float64Array(N), cliff: new Float64Array(N), ridge: new Float64Array(N) };
  const waterFrac = new Float64Array(N);
  const onRidge = new Uint8Array(N);
  const known: { gx: number; gy: number; ele: number }[] = [];
  const features: MapFeature[] = [];

  for (const f of fc.features) {
    const { kind, name, ele } = f.properties;
    const g = f.geometry;

    if (g.type === "Point") {
      const pt = project(g.coordinates);
      const i = cellIndex(pt);
      if (ele !== undefined) known.push({ gx: pt[0], gy: pt[1], ele });
      if (i >= 0) onRidge[i] = 1; // peaks and saddles sit on ridgelines
      features.push({ kind, name, ele, point: [Math.round(pt[0] * 1000) / 1000, Math.round(pt[1] * 1000) / 1000], cells: i >= 0 ? [ALL_CELLS[i]] : [] });
      continue;
    }

    if (g.type === "Polygon" || g.type === "MultiPolygon") {
      const polys = (g.type === "Polygon" ? [g.coordinates] : g.coordinates).map((rings) => rings.map((r) => r.map(project)));
      const touched: number[] = [];
      const K = 6;
      for (const rings of polys) {
        const xs = rings[0].map((p) => p[0]);
        const ys = rings[0].map((p) => p[1]);
        for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(GRID_SIZE - 1, Math.floor(Math.max(...ys))); y++) {
          for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(GRID_SIZE - 1, Math.floor(Math.max(...xs))); x++) {
            let inside = 0;
            for (let a = 0; a < K; a++)
              for (let b = 0; b < K; b++) {
                const pt: [number, number] = [x + (a + 0.5) / K, y + (b + 0.5) / K];
                if (rings.reduce((acc, ring) => (pointInRing(pt, ring) ? !acc : acc), false)) inside++;
              }
            if (inside) {
              waterFrac[y * GRID_SIZE + x] += inside / (K * K);
              if (!touched.includes(y * GRID_SIZE + x)) touched.push(y * GRID_SIZE + x);
            }
          }
        }
      }
      features.push({ kind, name, rings: polys.flat().map((r) => simplify(r, 0.01)), cells: touched.map((i) => ALL_CELLS[i]) });
      continue;
    }

    const lines = (g.type === "LineString" ? [g.coordinates] : g.coordinates).map((l) => l.map(project));
    const target = kind === "stream" ? len.stream : kind === "cliff" ? len.cliff : kind === "ridge" ? len.ridge : len.trail;
    const here = new Map<number, number>(); // meters of this feature per cell, in order of first visit
    for (const line of lines) {
      for (let k = 1; k < line.length; k++) {
        const [x0, y0] = line[k - 1];
        const [x1, y1] = line[k];
        const segM = Math.hypot((x1 - x0) * cellW, (y1 - y0) * cellH);
        const steps = Math.max(1, Math.ceil(segM / P.sampleStepM));
        for (let s = 0; s < steps; s++) {
          const t = (s + 0.5) / steps;
          const i = cellIndex([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t]);
          if (i < 0) continue;
          target[i] += segM / steps;
          here.set(i, (here.get(i) ?? 0) + segM / steps);
        }
      }
    }
    features.push({
      kind,
      name,
      lines: lines.map((l) => simplify(l)),
      cells: [...here].filter(([, m]) => m >= P.promptMinM).map(([i]) => ALL_CELLS[i]),
    });
  }

  // Rough elevation: ground falls away from each known summit at a fixed slope; drainages sit lower.
  const est = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const cx = (i % GRID_SIZE) + 0.5;
    const cy = Math.floor(i / GRID_SIZE) + 0.5;
    let best = -Infinity;
    for (const k of known) best = Math.max(best, k.ele - P.slope * Math.hypot((cx - k.gx) * cellW, (cy - k.gy) * cellH));
    est[i] = best - (len.stream[i] >= P.streamMinM ? P.drainageDropM : 0);
  }
  // A bundled DEM grid is attached per cell for display and safety checks; the smoothed
  // estimate stays the model's elevation so the behaviour priors are not driven by DEM noise.
  const dem = opts.elevation;
  const hasElevation = known.length > 0;
  const lo = hasElevation ? Math.min(...est) : 0;
  const hi = hasElevation ? Math.max(...est) : 0;

  const cells: Record<string, CellTerrain> = {};
  ALL_CELLS.forEach((id, i) => {
    const x = i % GRID_SIZE;
    const y = Math.floor(i / GRID_SIZE);
    const m = est[i];
    const d = dem?.[id];
    const cover: Cover = !hasElevation ? "hardwood" : m >= P.treelineM ? "alpine" : m >= P.hardwoodBelowM ? "spruce" : "hardwood";
    cells[id] = {
      id,
      x,
      y,
      bounds: cellBounds(bbox, x, y),
      cover,
      elevation: hasElevation && hi > lo ? (m - lo) / (hi - lo) : 0.5,
      ...(hasElevation ? { elevationM: Math.round(m) } : {}),
      ...(d && Number.isFinite(d.meanM) ? { demMeanM: Math.round(d.meanM), elevationMinM: Math.round(d.minM), elevationMaxM: Math.round(d.maxM), slopeDeg: d.slopeDeg, aspect: d.aspect } : {}),
      trail: len.trail[i] >= P.trailMinM,
      drainage: len.stream[i] >= P.streamMinM,
      ridge: onRidge[i] === 1 || len.ridge[i] >= P.ridgeMinM,
      cliff: len.cliff[i] >= P.cliffMinM,
      water: waterFrac[i] >= P.waterMinFrac,
    };
  });

  return { source, label: opts.label ?? SOURCE_LABEL[source], bbox, fetchedAt: opts.fetchedAt, osm: true, cells, features };
}
