// What Trailhead publishes onto a shared CalTopo map: a small, readable set of
// app-owned features (never the full 225-cell grid). Pure; used by the client to
// build the request and by tests. The server converts these into CalTopo objects.
//
// Privacy: nothing here carries the subject's name, medical details or family
// statements. Maps are shared; those stay on the IC's device.

import { buildCalTopoGeoJSON, CalTopoInput, cellsOutline, GeoJSONFeature } from "./export";
import { CellId } from "./engine/grid";
import { Suggestion } from "./engine/rank";

export type PublishClass = "Marker" | "Shape";

export interface PublishFeature {
  class: PublishClass;
  title: string;
  description: string;
  /** [lon, lat] for markers; closed rings for polygons. */
  geometry: { type: "Point"; coordinates: [number, number] } | { type: "Polygon"; coordinates: [number, number][][] };
  style: Record<string, string | number>;
}

export const MAX_PUBLISH_FEATURES = 50;
export const PUBLISH_FOLDER_PREFIX = "[Trailhead]";

/** Share of the on-grid probability each zone encloses, with its colour and fill. */
export const ZONES: { share: number; label: string; color: string; fill: number }[] = [
  { share: 0.5, label: "50%", color: "#ef4444", fill: 0.35 },
  { share: 0.75, label: "75%", color: "#f97316", fill: 0.22 },
  { share: 0.9, label: "90%", color: "#facc15", fill: 0.12 },
];

/** Cells (highest POA first) that together hold `share` of the on-grid probability. */
export function zoneCells(cells: Record<CellId, number>, share: number): CellId[] {
  const sorted = Object.entries(cells).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((a, [, v]) => a + v, 0);
  if (total <= 0) return [];
  const out: CellId[] = [];
  let acc = 0;
  for (const [id, v] of sorted) {
    out.push(id);
    acc += v;
    if (acc / total >= share) break;
  }
  return out;
}

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

/**
 * Build the feature list: probability zones, top suggestions, team outlines and
 * markers (LKP, clues, found, a note), capped at MAX_PUBLISH_FEATURES.
 */
export function buildPublishFeatures(input: CalTopoInput, suggestions: Suggestion[] = []): PublishFeature[] {
  const { state } = input;
  if (!state.prob) throw new Error("Nothing to publish: place the LKP first.");
  const prob = state.prob;
  const fc = buildCalTopoGeoJSON(input);
  const out: PublishFeature[] = [];
  const bbox = state.terrain.bbox;

  // Zones: nested outlines of the cells holding 50 / 75 / 90 % of on-grid probability.
  for (const z of ZONES) {
    const ids = zoneCells(prob.cells, z.share);
    const rings = cellsOutline(ids, bbox);
    rings.forEach((ring, i) => {
      out.push({
        class: "Shape",
        title: `${z.label} zone · ${ids.length} cells${rings.length > 1 ? ` (part ${i + 1} of ${rings.length})` : ""}`,
        description: `Cells holding ${z.label} of the probability on the grid (ROW ${pct(prob.row)} is outside). ${PUBLISH_FOLDER_PREFIX} decision support; the IC directs the search.`,
        geometry: { type: "Polygon", coordinates: ring },
        style: { stroke: z.color, "stroke-width": 2, "stroke-opacity": 0.9, fill: z.color, "fill-opacity": z.fill },
      });
    });
  }

  // Top suggestions as their own cell outlines.
  const cellFeature = (f: GeoJSONFeature) => f.geometry.type === "Polygon" && typeof f.properties.cell === "string";
  const byCell = new Map(fc.features.filter(cellFeature).map((f) => [f.properties.cell as string, f]));
  suggestions.slice(0, 5).forEach((s, i) => {
    const f = byCell.get(s.cell);
    if (!f || f.geometry.type !== "Polygon") return;
    out.push({
      class: "Shape",
      title: `#${i + 1} ${s.cell} · POA ${pct(s.poa)}`,
      description: `Suggested next sweep (rank ${i + 1}). Expected POD ${pct(s.expectedPod, 0)}. Suggestion only.\n${String(f.properties.description ?? "")}`,
      geometry: { type: "Polygon", coordinates: f.geometry.coordinates },
      style: { stroke: "#38bdf8", "stroke-width": 3, "stroke-opacity": 1, fill: "#38bdf8", "fill-opacity": 0.1 },
    });
  });

  // Team outlines and markers come straight from the export builder.
  for (const f of fc.features) {
    if (f.properties.kind === "assignment") {
      const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.type === "MultiPolygon" ? f.geometry.coordinates : [];
      for (const p of polys) {
        out.push({
          class: "Shape",
          title: `Team: ${String(f.properties.title)}`,
          description: String(f.properties.description ?? ""),
          geometry: { type: "Polygon", coordinates: p },
          style: { stroke: String(f.properties.stroke), "stroke-width": 3, "stroke-opacity": 1, fill: String(f.properties.fill), "fill-opacity": 0 },
        });
      }
    } else if (f.geometry.type === "Point") {
      // Clue titles are the radio text; keep map labels short and put the text in the description.
      const isClue = f.properties.kind === "clue";
      out.push({
        class: "Marker",
        title: isClue ? `Clue · ${String(f.properties.cell)}` : String(f.properties.title),
        description: isClue ? `${String(f.properties.title)}
${String(f.properties.description ?? "")}` : String(f.properties.description ?? ""),
        geometry: { type: "Point", coordinates: f.geometry.coordinates },
        style: { "marker-color": String(f.properties["marker-color"] ?? "#94a3b8"), "marker-symbol": "point" },
      });
    }
  }

  return out.slice(0, MAX_PUBLISH_FEATURES);
}
