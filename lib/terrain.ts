// Hand-authored, fictional terrain loosely styled on a White Mountains valley.
// Higher ground to the north-east (ridge), lower ground to the south-west.

import { ALL_CELLS, CellId, parseCellId } from "./engine/grid";

export type Cover = "hardwood" | "spruce" | "alpine" | "open";

export interface CellTerrain {
  id: CellId;
  x: number;
  y: number;
  cover: Cover;
  elevation: number; // 0 (valley floor) – 1 (summit ridge)
  trail: boolean;
  drainage: boolean;
  ridge: boolean;
  cliff: boolean;
  water: boolean;
}

export interface LineFeature {
  name: string;
  cells: CellId[];
}

export const TRAILS: LineFeature[] = [
  { name: "Hollow Trail", cells: ["H15", "H14", "H13", "H12", "H11", "H10", "H9", "H8"] },
  { name: "Ridge Trail", cells: ["H8", "I7", "J6", "K5", "L4", "M3"] },
  { name: "Notch Trail", cells: ["H8", "G8", "F7", "E7", "D6", "C6", "B5"] },
];

export const STREAMS: LineFeature[] = [
  { name: "Hollow Brook", cells: ["G9", "F10", "E11", "E12", "D13", "C14", "B15"] },
  { name: "Ledge Brook", cells: ["K8", "K9", "L10", "L11", "M12", "M13", "N14", "O15"] },
];

export const RIDGES: LineFeature[] = [
  { name: "Hollow Ridge", cells: ["J1", "K2", "L3", "M3", "N4", "N5", "O6"] },
];

export const CLIFFS: CellId[] = ["I3", "J3", "J4", "C3", "D3"];
export const WATER: CellId[] = ["B9", "B10", "C10"];
const OPEN: CellId[] = ["C9", "G13", "F14"];

/** Trail junction where the demo subject was last seen. */
export const DEFAULT_LKP: CellId = "H8";

/** Real-world anchor for weather lookups (Mount Washington area). */
export const MAP_ANCHOR = { lat: 44.27, lon: -71.3, label: "Mount Washington area, NH" };

const inLine = (lines: LineFeature[]) => new Set(lines.flatMap((l) => l.cells));

export const TERRAIN: Record<CellId, CellTerrain> = (() => {
  const trail = inLine(TRAILS);
  const drainage = inLine(STREAMS);
  const ridge = inLine(RIDGES);
  const out: Record<CellId, CellTerrain> = {};
  for (const id of ALL_CELLS) {
    const { x, y } = parseCellId(id)!;
    let elevation = 0.05 + 0.04 * x + 0.03 * (14 - y);
    if (ridge.has(id)) elevation += 0.15;
    if (drainage.has(id)) elevation -= 0.05;
    elevation = Math.max(0, Math.min(1, elevation));
    const cover: Cover = OPEN.includes(id)
      ? "open"
      : elevation >= 0.9
        ? "alpine"
        : elevation >= 0.5
          ? "spruce"
          : "hardwood";
    out[id] = {
      id,
      x,
      y,
      cover,
      elevation,
      trail: trail.has(id),
      drainage: drainage.has(id),
      ridge: ridge.has(id),
      cliff: CLIFFS.includes(id),
      water: WATER.includes(id),
    };
  }
  return out;
})();

export function describeCell(id: CellId): string {
  const t = TERRAIN[id];
  if (!t) return id;
  const tags: string[] = [t.cover];
  if (t.trail) tags.push("trail");
  if (t.drainage) tags.push("drainage");
  if (t.ridge) tags.push("ridgeline");
  if (t.cliff) tags.push("cliffs");
  if (t.water) tags.push("open water");
  return tags.join(", ");
}
