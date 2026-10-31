import { readFileSync } from "node:fs";
import { BBox } from "@/lib/geo";
import { buildTerrainModel, normalizeTerrainData } from "@/lib/osm";

/** The bundled terrain exactly as the app builds it (data/terrain.geojson). */
export function bundledTerrain() {
  const raw = JSON.parse(readFileSync(new URL("../../data/terrain.geojson", import.meta.url), "utf8"));
  const elevation = JSON.parse(readFileSync(new URL("../../data/elevation.json", import.meta.url), "utf8")).cells;
  const fc = normalizeTerrainData(raw);
  const b = fc.trailhead!.bbox!;
  const bbox: BBox = { south: b[0], west: b[1], north: b[2], east: b[3] };
  return { raw, fc, bbox, elevation, model: buildTerrainModel(fc, bbox, "bundled", { elevation }) };
}
