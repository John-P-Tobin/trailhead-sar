// Geography: the grid's bounding box, per-cell lat/lon bounds, and projection
// between WGS84 [lon, lat] and grid units (gx 0–15 west→east, gy 0–15 north→south).

import { cellId, CellId, GRID_SIZE } from "./engine/grid";

export interface BBox {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Mt Washington / Lakes of the Clouds: the default search area and the bundled terrain's extent. */
export const DEFAULT_BBOX: BBox = { south: 44.245, west: -71.335, north: 44.285, east: -71.285 };

export const M_PER_DEG_LAT = 111_320;
export const metersPerDegLon = (lat: number) => M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);

export const bboxCenter = (b: BBox) => ({ lat: (b.south + b.north) / 2, lon: (b.west + b.east) / 2 });

/** "south,west,north,east" — Overpass order; also the terrain cache key. */
export const bboxKey = (b: BBox) => [b.south, b.west, b.north, b.east].map((v) => v.toFixed(5)).join(",");

export function parseBbox(s: string): BBox | null {
  const v = s.split(",").map((x) => Number(x.trim()));
  if (v.length !== 4 || v.some((x) => !Number.isFinite(x))) return null;
  const [south, west, north, east] = v;
  if (south >= north || west >= east || south < -90 || north > 90 || west < -180 || east > 180) return null;
  return { south, west, north, east };
}

/** Cell size in meters (w: east–west, h: north–south). */
export function cellSizeM(b: BBox): { w: number; h: number } {
  const { lat } = bboxCenter(b);
  return {
    w: ((b.east - b.west) / GRID_SIZE) * metersPerDegLon(lat),
    h: ((b.north - b.south) / GRID_SIZE) * M_PER_DEG_LAT,
  };
}

/** Real lat/lon bounds of cell (x, y); row 1 (y = 0) is the northern edge. */
export function cellBounds(b: BBox, x: number, y: number): BBox {
  const dLon = (b.east - b.west) / GRID_SIZE;
  const dLat = (b.north - b.south) / GRID_SIZE;
  return {
    west: b.west + x * dLon,
    east: b.west + (x + 1) * dLon,
    north: b.north - y * dLat,
    south: b.north - (y + 1) * dLat,
  };
}

export function toGrid(b: BBox, lon: number, lat: number): [number, number] {
  return [((lon - b.west) / (b.east - b.west)) * GRID_SIZE, ((b.north - lat) / (b.north - b.south)) * GRID_SIZE];
}

/** Grid units → [lon, lat]. */
export function fromGrid(b: BBox, gx: number, gy: number): [number, number] {
  return [b.west + (gx / GRID_SIZE) * (b.east - b.west), b.north - (gy / GRID_SIZE) * (b.north - b.south)];
}

/** The cell containing a point, or null if it is outside the grid. */
export function cellAt(b: BBox, lon: number, lat: number): CellId | null {
  const [gx, gy] = toGrid(b, lon, lat);
  const x = Math.floor(gx);
  const y = Math.floor(gy);
  return x >= 0 && x < GRID_SIZE && y >= 0 && y < GRID_SIZE ? cellId(x, y) : null;
}

export function expandBbox(b: BBox, cells: number): BBox {
  const dLon = ((b.east - b.west) / GRID_SIZE) * cells;
  const dLat = ((b.north - b.south) / GRID_SIZE) * cells;
  return { south: b.south - dLat, west: b.west - dLon, north: b.north + dLat, east: b.east + dLon };
}

export const formatLatLon = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? "E" : "W"}`;
