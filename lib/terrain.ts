// Terrain model shared by the map, the priors and the suggestions.
//
// Three sources, shown as a badge on the map:
//   live     — OpenStreetMap fetched from Overpass for the grid's bounding box
//   bundled  — data/terrain.geojson (Mt Washington / Lakes of the Clouds), used by demo mode
//   stylized — the original hand-drawn fictional map, the last-resort fallback

import { ALL_CELLS, CellId, parseCellId } from "./engine/grid";
import { Aspect, STEEP_DEG } from "./elevation";
import { BBox, cellBounds, DEFAULT_BBOX } from "./geo";

export type Cover = "hardwood" | "spruce" | "alpine" | "open";

export interface CellTerrain {
  id: CellId;
  x: number;
  y: number;
  /** Real lat/lon bounds derived from the grid's bounding box. */
  bounds: BBox;
  cover: Cover;
  elevation: number; // 0 (lowest cell in the grid) – 1 (highest)
  /** Smoothed estimate in metres from peak heights (what the behaviour model's downhill pull uses). */
  elevationM?: number;
  /** Digital elevation model (bundled grid): mean, range, slope and aspect for the cell. Shown to the IC; not used by the prior. */
  demMeanM?: number;
  elevationMinM?: number;
  elevationMaxM?: number;
  slopeDeg?: number;
  aspect?: Aspect;
  trail: boolean;
  drainage: boolean;
  ridge: boolean;
  cliff: boolean;
  water: boolean;
}

export type TerrainSource = "live" | "bundled" | "stylized";

export const SOURCE_LABEL: Record<TerrainSource, string> = {
  live: "Live OSM",
  bundled: "Bundled Mt Washington",
  stylized: "Stylized",
};

export type FeatureKind = "trail" | "road" | "stream" | "water" | "cliff" | "ridge" | "peak" | "saddle";

/** A map feature in grid units (gx 0–15 west→east, gy 0–15 north→south). */
export interface MapFeature {
  kind: FeatureKind;
  name?: string;
  ele?: number;
  lines?: [number, number][][];
  rings?: [number, number][][];
  point?: [number, number];
  /** Grid cells the feature passes through, in order along the feature. */
  cells: CellId[];
}

/** What the search state stores: enough to keep priors and suggestions consistent across reloads. */
export interface TerrainSnapshot {
  source: TerrainSource;
  label: string;
  bbox: BBox;
  fetchedAt?: string;
  cells: Record<CellId, CellTerrain>;
}

export interface TerrainModel extends TerrainSnapshot {
  /** True when the data comes from OpenStreetMap (attribution required). */
  osm: boolean;
  features: MapFeature[];
}

export const snapshotOf = (m: TerrainModel): TerrainSnapshot => ({
  source: m.source,
  label: m.label,
  bbox: m.bbox,
  fetchedAt: m.fetchedAt,
  cells: m.cells,
});

/** Real-world anchor for weather lookups: the default grid's center (Mount Washington area). */
export const MAP_ANCHOR = { lat: 44.27, lon: -71.3, label: "Mount Washington area, NH" };

export function describeCell(t: CellTerrain | undefined): string {
  if (!t) return "";
  const tags: string[] = [t.cover];
  if (t.trail) tags.push("trail");
  if (t.drainage) tags.push("drainage");
  if (t.ridge) tags.push("ridgeline");
  if (t.cliff) tags.push("cliffs");
  if (t.water) tags.push("open water");
  if (t.slopeDeg !== undefined && t.slopeDeg >= STEEP_DEG) tags.push("steep");
  const m = t.demMeanM ?? t.elevationM;
  if (m !== undefined) tags.push(`~${Math.round(m / 10) * 10} m`);
  return tags.join(", ");
}

// ---------------------------------------------------------------------------
// Stylized fallback: hand-authored, fictional terrain loosely styled on a White
// Mountains valley. Higher ground to the north-east, lower to the south-west.

interface LineFeature {
  name: string;
  cells: CellId[];
}

const TRAILS: LineFeature[] = [
  { name: "Hollow Trail", cells: ["H15", "H14", "H13", "H12", "H11", "H10", "H9", "H8"] },
  { name: "Ridge Trail", cells: ["H8", "I7", "J6", "K5", "L4", "M3"] },
  { name: "Notch Trail", cells: ["H8", "G8", "F7", "E7", "D6", "C6", "B5"] },
];
const STREAMS: LineFeature[] = [
  { name: "Hollow Brook", cells: ["G9", "F10", "E11", "E12", "D13", "C14", "B15"] },
  { name: "Ledge Brook", cells: ["K8", "K9", "L10", "L11", "M12", "M13", "N14", "O15"] },
];
const RIDGES: LineFeature[] = [{ name: "Hollow Ridge", cells: ["J1", "K2", "L3", "M3", "N4", "N5", "O6"] }];
const CLIFFS: CellId[] = ["I3", "J3", "J4", "C3", "D3"];
const WATER: CellId[] = ["B9", "B10", "C10"];
const OPEN: CellId[] = ["C9", "G13", "F14"];

/** LKP used by the stylized map's tests: the trail junction at H8. */
export const DEFAULT_LKP: CellId = "H8";

const center = (id: CellId): [number, number] => {
  const { x, y } = parseCellId(id)!;
  return [x + 0.5, y + 0.5];
};
const square = (id: CellId): [number, number][] => {
  const { x, y } = parseCellId(id)!;
  return [
    [x, y],
    [x + 1, y],
    [x + 1, y + 1],
    [x, y + 1],
    [x, y],
  ];
};

export const STYLIZED_TERRAIN: TerrainModel = (() => {
  const trail = new Set(TRAILS.flatMap((l) => l.cells));
  const drainage = new Set(STREAMS.flatMap((l) => l.cells));
  const ridge = new Set(RIDGES.flatMap((l) => l.cells));
  const cells: Record<CellId, CellTerrain> = {};
  for (const id of ALL_CELLS) {
    const { x, y } = parseCellId(id)!;
    let elevation = 0.05 + 0.04 * x + 0.03 * (14 - y);
    if (ridge.has(id)) elevation += 0.15;
    if (drainage.has(id)) elevation -= 0.05;
    elevation = Math.max(0, Math.min(1, elevation));
    const cover: Cover = OPEN.includes(id) ? "open" : elevation >= 0.9 ? "alpine" : elevation >= 0.5 ? "spruce" : "hardwood";
    cells[id] = {
      id,
      x,
      y,
      bounds: cellBounds(DEFAULT_BBOX, x, y),
      cover,
      elevation,
      trail: trail.has(id),
      drainage: drainage.has(id),
      ridge: ridge.has(id),
      cliff: CLIFFS.includes(id),
      water: WATER.includes(id),
    };
  }
  const line = (kind: FeatureKind, l: LineFeature): MapFeature => ({ kind, name: l.name, lines: [l.cells.map(center)], cells: l.cells });
  const features: MapFeature[] = [
    ...WATER.map((id): MapFeature => ({ kind: "water", rings: [square(id)], cells: [id] })),
    ...CLIFFS.map((id): MapFeature => ({ kind: "cliff", rings: [square(id)], cells: [id] })),
    ...RIDGES.map((l) => line("ridge", l)),
    ...STREAMS.map((l) => line("stream", l)),
    ...TRAILS.map((l) => line("trail", l)),
  ];
  return { source: "stylized", label: SOURCE_LABEL.stylized, bbox: DEFAULT_BBOX, osm: false, cells, features };
})();

// ---------------------------------------------------------------------------
// Named features for the report-parsing prompt

export interface PromptFeature {
  kind: FeatureKind;
  name: string;
  cells: CellId[];
}

const PROMPT_ORDER: FeatureKind[] = ["trail", "stream", "water", "peak", "road", "ridge", "cliff"];

/** Named features, merged by name, with the cells they pass through (in order). */
export function promptFeatures(features: MapFeature[], max = 60): PromptFeature[] {
  const merged = new Map<string, PromptFeature>();
  for (const f of features) {
    if (!f.name || !f.cells.length || !PROMPT_ORDER.includes(f.kind)) continue;
    const key = `${f.kind}|${f.name}`;
    const m = merged.get(key) ?? { kind: f.kind, name: f.name, cells: [] };
    for (const c of f.cells) if (!m.cells.includes(c)) m.cells.push(c);
    merged.set(key, m);
  }
  return [...merged.values()]
    .sort((a, b) => PROMPT_ORDER.indexOf(a.kind) - PROMPT_ORDER.indexOf(b.kind) || a.name.localeCompare(b.name))
    .slice(0, max)
    .map((f) => ({ ...f, cells: f.cells.slice(0, 40) }));
}
