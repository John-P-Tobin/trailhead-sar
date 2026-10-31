// Browser-side terrain loading: the bundled Mt Washington file, or live OSM for the
// grid's bounding box via /api/terrain, cached in localStorage.

import { BBox, bboxKey, DEFAULT_BBOX } from "./geo";
import { buildTerrainModel, normalizeTerrainData, TerrainFeatureCollection } from "./osm";
import { STYLIZED_TERRAIN, TerrainModel, TerrainSnapshot } from "./terrain";
import { CellElevation } from "./elevation";

const CACHE_PREFIX = "trailhead:terrain:v1:";
export const TERRAIN_CACHE_MAX_AGE_MS = 7 * 24 * 3600_000;

let bundled: Promise<TerrainModel | null> | null = null;

/** data/elevation.json ships with the app; null if it is missing or unreadable. */
export function loadBundledElevation(): Promise<Record<string, CellElevation> | null> {
  return import("@/data/elevation.json")
    .then((mod) => (mod.default as { cells?: Record<string, CellElevation> }).cells ?? null)
    .catch(() => null);
}

/** data/terrain.geojson ships with the app, so demo mode never depends on a live API. */
export function loadBundledTerrain(): Promise<TerrainModel | null> {
  bundled ??= Promise.all([import("@/data/terrain.geojson"), loadBundledElevation()])
    .then(([mod, elevation]) => {
      const fc = normalizeTerrainData(mod.default);
      const b = fc.trailhead?.bbox;
      const bbox: BBox = b ? { south: b[0], west: b[1], north: b[2], east: b[3] } : DEFAULT_BBOX;
      return buildTerrainModel(fc, bbox, "bundled", { fetchedAt: fc.trailhead?.osm_timestamp, elevation: elevation ?? undefined });
    })
    .catch(() => null);
  return bundled;
}

interface CacheEntry {
  fetchedAt: string;
  featureCollection: TerrainFeatureCollection;
}

function readCache(bbox: BBox): CacheEntry | null {
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + bboxKey(bbox));
    if (!raw) return null;
    const c = JSON.parse(raw) as CacheEntry;
    if (!c?.fetchedAt || Date.now() - Date.parse(c.fetchedAt) > TERRAIN_CACHE_MAX_AGE_MS) return null;
    return { fetchedAt: c.fetchedAt, featureCollection: normalizeTerrainData(c.featureCollection) };
  } catch {
    return null;
  }
}

function writeCache(bbox: BBox, entry: CacheEntry): void {
  try {
    window.localStorage.setItem(CACHE_PREFIX + bboxKey(bbox), JSON.stringify(entry));
  } catch {
    // storage full or unavailable: the live model is still used for this session
  }
}

export interface LiveTerrainResult {
  model: TerrainModel | null;
  reason?: string;
  cached?: boolean;
}

/** Live OSM for the grid's bounding box: the localStorage cache first, then Overpass via our route. */
export async function loadLiveTerrain(bbox: BBox): Promise<LiveTerrainResult> {
  const hit = readCache(bbox);
  if (hit) return { model: buildTerrainModel(hit.featureCollection, bbox, "live", { fetchedAt: hit.fetchedAt }), cached: true };
  try {
    const res = await fetch(`/api/terrain?bbox=${bboxKey(bbox)}`, { signal: AbortSignal.timeout(40_000) });
    const j = (await res.json()) as { ok?: boolean; reason?: string; fetchedAt?: string; featureCollection?: unknown };
    if (!j?.ok || !j.featureCollection || !j.fetchedAt) return { model: null, reason: j?.reason ?? `Terrain route error (${res.status}).` };
    const fc = normalizeTerrainData(j.featureCollection);
    writeCache(bbox, { fetchedAt: j.fetchedAt, featureCollection: fc });
    return { model: buildTerrainModel(fc, bbox, "live", { fetchedAt: j.fetchedAt }) };
  } catch (e) {
    return { model: null, reason: (e as Error).name === "TimeoutError" ? "Terrain request timed out." : "Could not reach the terrain route." };
  }
}

/** Map features for a persisted terrain snapshot after a reload (never hits the network). */
export async function featuresForSnapshot(snap: TerrainSnapshot): Promise<TerrainModel | null> {
  if (snap.source === "stylized") return STYLIZED_TERRAIN;
  if (snap.source === "live") {
    const hit = readCache(snap.bbox);
    if (hit) return buildTerrainModel(hit.featureCollection, snap.bbox, "live", { fetchedAt: hit.fetchedAt });
  }
  return loadBundledTerrain();
}
