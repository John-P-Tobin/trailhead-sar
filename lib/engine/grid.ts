// Grid geometry: 15×15 cells, columns A–O (west→east), rows 1–15 (north→south).

export const GRID_SIZE = 15;
export const COLS = "ABCDEFGHIJKLMNO";

export type CellId = string;

export function cellId(x: number, y: number): CellId {
  return `${COLS[x]}${y + 1}`;
}

export function parseCellId(id: string): { x: number; y: number } | null {
  const m = /^([A-Oa-o])\s*(\d{1,2})$/.exec(id.trim());
  if (!m) return null;
  const x = COLS.indexOf(m[1].toUpperCase());
  const y = Number(m[2]) - 1;
  if (x < 0 || y < 0 || y >= GRID_SIZE) return null;
  return { x, y };
}

export function isCellId(id: string): boolean {
  return parseCellId(id) !== null;
}

export const ALL_CELLS: CellId[] = (() => {
  const out: CellId[] = [];
  for (let y = 0; y < GRID_SIZE; y++) for (let x = 0; x < GRID_SIZE; x++) out.push(cellId(x, y));
  return out;
})();

export function distance(a: CellId, b: CellId): number {
  const pa = parseCellId(a)!;
  const pb = parseCellId(b)!;
  return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

/** Cells within `radius` (Euclidean, in cells) of `center`, including center. */
export function cellsWithin(center: CellId, radius: number): CellId[] {
  return ALL_CELLS.filter((c) => distance(center, c) <= radius + 1e-9);
}

/**
 * Expand free-form cell references such as "C4-C6", "C4 through C6", "D2, D3"
 * into a list of valid cell IDs. A range along one row or column expands to
 * every cell between; any other range expands to the rectangle.
 */
export function expandCellRefs(text: string): CellId[] {
  const out: CellId[] = [];
  const norm = text.replace(/\s+(?:through|thru|to)\s+/gi, "-").replace(/\s*[–—]\s*/g, "-");
  for (const tok of norm.split(/[\s,;/&]+|\band\b/i)) {
    if (!tok) continue;
    const [a, b] = tok.split("-");
    const pa = parseCellId(a ?? "");
    if (!pa) continue;
    const pb = b ? parseCellId(b) : null;
    if (!pb) {
      out.push(cellId(pa.x, pa.y));
      continue;
    }
    for (let y = Math.min(pa.y, pb.y); y <= Math.max(pa.y, pb.y); y++)
      for (let x = Math.min(pa.x, pb.x); x <= Math.max(pa.x, pb.x); x++) out.push(cellId(x, y));
  }
  return [...new Set(out)];
}
