// Convert an Overpass Turbo GeoJSON export (or raw Overpass JSON) into the bundled
// terrain file. Usage: npm run convert-terrain -- <export.geojson> [output]
import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT_BBOX } from "../lib/geo";
import { normalizeTerrainData } from "../lib/osm";

const [input, output = "data/terrain.geojson"] = process.argv.slice(2);
if (!input) {
  console.error("Usage: npm run convert-terrain -- <export.geojson> [output]");
  process.exit(1);
}
const raw = JSON.parse(readFileSync(input, "utf8"));
const fc = normalizeTerrainData(raw, DEFAULT_BBOX);
const b = DEFAULT_BBOX;
const meta = {
  bbox: [b.south, b.west, b.north, b.east],
  source: "OpenStreetMap via Overpass Turbo",
  osm_timestamp: raw.timestamp ?? raw.osm3s?.timestamp_osm_base,
  converted_at: new Date().toISOString(),
  attribution: "© OpenStreetMap contributors (ODbL)",
};
// One feature per line keeps diffs readable.
const body = fc.features.map((f) => JSON.stringify(f)).join(",\n");
writeFileSync(output, `{"type":"FeatureCollection","trailhead":${JSON.stringify(meta)},"features":[\n${body}\n]}\n`);
const counts: Record<string, number> = {};
for (const f of fc.features) counts[f.properties.kind] = (counts[f.properties.kind] ?? 0) + 1;
console.log(`Wrote ${fc.features.length} features to ${output}`, counts);
