// Export the search for CalTopo: GeoJSON (RFC 7946: WGS84, [lon, lat]) and KML with
// styles as a fallback. CalTopo's API needs a team account, so teams import files.

import { CellId, GRID_SIZE, parseCellId } from "./engine/grid";
import { expectedPod } from "./engine/rank";
import { BBox, fromGrid } from "./geo";
import { heatHex, heatOpacity } from "./heat";
import { PROFILES } from "./profiles";
import { cumulativePodMap, SearchState } from "./store";
import { CellTerrain, describeCell } from "./terrain";
import {
  combinedFactor,
  currentPeriod,
  exposureRisk,
  formatAge,
  podModifiers,
  safetyFlags,
  upcoming,
  WeatherSnapshot,
  windChillF,
} from "./weather";

export const DECISION_SUPPORT_LINE = "Decision support only. The incident commander directs all search operations.";
export const CALTOPO_HINT = "Import into CalTopo via Import → choose file.";

type Pos = [number, number]; // [lon, lat]
type PolygonCoords = Pos[][];

interface Item {
  title: string;
  description: string;
  style: Record<string, string | number>;
  props: Record<string, unknown>;
}
interface ShapeItem extends Item {
  polygons: PolygonCoords[]; // one entry per polygon: [exterior, ...holes]
}
interface MarkerItem extends Item {
  point: Pos;
}

const TEAM_COLORS = ["#38bdf8", "#f472b6", "#a3e635", "#fbbf24", "#c084fc", "#2dd4bf", "#fb923c"];
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;
const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function cellPolygon(t: CellTerrain): PolygonCoords {
  const { west: w, south: s, east: e, north: n } = t.bounds;
  // Exterior ring counterclockwise, as RFC 7946 recommends.
  return [
    [
      [r6(w), r6(s)],
      [r6(e), r6(s)],
      [r6(e), r6(n)],
      [r6(w), r6(n)],
      [r6(w), r6(s)],
    ],
  ];
}

const cellCenter = (t: CellTerrain): Pos => [r6((t.bounds.west + t.bounds.east) / 2), r6((t.bounds.south + t.bounds.north) / 2)];

/** Signed area in lon/lat (positive = counterclockwise). */
function signedArea(ring: Pos[]): number {
  let a = 0;
  for (let i = 1; i < ring.length; i++) a += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1];
  return a / 2;
}

function pointInRing(p: Pos, ring: Pos[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Outline of a set of grid cells as polygons in [lon, lat]: adjacent cells merge,
 * holes are kept, and cells touching only at a corner become separate polygons.
 * Exterior rings are counterclockwise and holes clockwise.
 */
export function cellsOutline(cells: CellId[], bbox: BBox): PolygonCoords[] {
  const inSet = new Set(cells.map((c) => c.toUpperCase()));
  const has = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE && inSet.has(`${"ABCDEFGHIJKLMNO"[x]}${y + 1}`);
  // Work in (X, Y) = (x, -y) so "up" is north; boundary edges keep the region on their left.
  type V = [number, number];
  const edges: [V, V][] = [];
  for (const id of inSet) {
    const p = parseCellId(id);
    if (!p) continue;
    const { x, y } = p;
    const bl: V = [x, -(y + 1)];
    const br: V = [x + 1, -(y + 1)];
    const tr: V = [x + 1, -y];
    const tl: V = [x, -y];
    if (!has(x, y + 1)) edges.push([bl, br]);
    if (!has(x + 1, y)) edges.push([br, tr]);
    if (!has(x, y - 1)) edges.push([tr, tl]);
    if (!has(x - 1, y)) edges.push([tl, bl]);
  }
  const key = (v: V) => `${v[0]},${v[1]}`;
  const outgoing = new Map<string, number[]>();
  edges.forEach(([a], i) => outgoing.set(key(a), [...(outgoing.get(key(a)) ?? []), i]));
  const used = new Uint8Array(edges.length);
  const rings: V[][] = [];
  for (let start = 0; start < edges.length; start++) {
    if (used[start]) continue;
    const ring: V[] = [edges[start][0]];
    let cur = start;
    while (!used[cur]) {
      used[cur] = 1;
      const [a, b] = edges[cur];
      ring.push(b);
      if (key(b) === key(ring[0])) break; // ring closed (even if another boundary also touches this corner)
      const d: V = [b[0] - a[0], b[1] - a[1]];
      const next = (outgoing.get(key(b)) ?? []).filter((i) => !used[i]);
      if (!next.length) break;
      // At a corner where two boundaries meet, take the leftmost turn so rings never cross.
      next.sort((i, j) => {
        const turn = (k: number) => {
          const [p, q] = edges[k];
          return d[0] * (q[1] - p[1]) - d[1] * (q[0] - p[0]);
        };
        return turn(j) - turn(i);
      });
      cur = next[0];
    }
    // Drop collinear vertices, keep the ring closed.
    const pts = ring.slice(0, -1);
    const simple = pts.filter((v, i) => {
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const nxt = pts[(i + 1) % pts.length];
      return (v[0] - prev[0]) * (nxt[1] - v[1]) - (v[1] - prev[1]) * (nxt[0] - v[0]) !== 0;
    });
    rings.push([...simple, simple[0]]);
  }
  const toLonLat = (ring: V[]): Pos[] =>
    ring.map(([X, Y]) => {
      const [lon, lat] = fromGrid(bbox, X, -Y);
      return [r6(lon), r6(lat)];
    });
  const geo = rings.map(toLonLat);
  const exteriors = geo.filter((r) => signedArea(r) > 0);
  const holes = geo.filter((r) => signedArea(r) < 0);
  return exteriors.map((ext) => [ext, ...holes.filter((h) => pointInRing(h[0], ext) || pointInRing(h[1], ext))]);
}

export interface CalTopoInput {
  state: SearchState;
  weather: WeatherSnapshot | null;
  now?: number;
}

interface Collected {
  title: string;
  note: string;
  meta: Record<string, unknown>;
  cells: ShapeItem[];
  markers: MarkerItem[];
  teams: ShapeItem[];
}

function collect({ state, weather, now = Date.now() }: CalTopoInput): Collected {
  if (!state.prob) throw new Error("Nothing to export: place the LKP first.");
  const prob = state.prob;
  const cells = state.terrain.cells;
  const cumPod = cumulativePodMap(state.pods);
  const exportedAt = new Date(now).toISOString();

  // Weather at export time
  const period = weather ? currentPeriod(weather, now) : null;
  const mods = podModifiers(period);
  const factor = combinedFactor(mods);
  const risk = exposureRisk(period);
  const flags = weather ? safetyFlags(upcoming(weather, 12, now), cells) : [];
  const source = weather?.source === "live" ? "Live NWS" : "Cached";
  const weatherLine = period
    ? `${period.temperatureF}°F, wind ${period.windDirection} ${period.windMph} mph, wind chill ${windChillF(period.temperatureF, period.windMph)}°F, precip ${period.precipChance}%, ${period.shortForecast}`
    : "No forecast available";
  const updated = weather ? `updated ${clock(weather.fetchedAt)}, ${formatAge(now - Date.parse(weather.fetchedAt))}` : "not loaded";

  const title = `Trailhead search – ${new Date(now).toLocaleString()}`;
  const note = [
    `Exported ${new Date(now).toLocaleString()} (${exportedAt})`,
    `Rest of World (outside the grid): ${pct(prob.row)}`,
    `Weather — ${source}, ${updated}: ${weatherLine}`,
    `Exposure risk: ${risk.level.toUpperCase()} (${risk.reasons.join("; ")})`,
    mods.length ? `Detection penalties: ${mods.map((m) => m.label).join("; ")}` : "Detection penalties: none",
    ...flags.map((f) => `Team safety: ${f.text}`),
    `LKP ${state.lkp} · ${PROFILES[state.profileId].label} · terrain: ${state.terrain.label}`,
    DECISION_SUPPORT_LINE,
  ].join("\n");

  const max = Math.max(...Object.values(prob.cells), 1e-9);
  const cellItems: ShapeItem[] = Object.values(cells).map((t) => {
    const poa = prob.cells[t.id] ?? 0;
    const heat = poa / max;
    const color = heatHex(heat);
    const base = expectedPod(t.id, cells, 1);
    const adjusted = expectedPod(t.id, cells, factor);
    const sweeps = state.pods[t.id]?.length ?? 0;
    const last = [...state.reports].reverse().find((r) => r.cells.includes(t.id));
    const cellFlags = flags.filter((f) => f.cells.includes(t.id));
    const description = [
      `POA ${pct(poa, 2)}`,
      `Cumulative POD ${pct(cumPod[t.id] ?? 0, 0)}`,
      last ? `Last searched by ${last.team} at ${clock(last.at)} (POD ${pct(last.pod, 0)})` : "Not searched yet",
      `Sweeps: ${sweeps}`,
      `Expected POD next sweep: ${pct(adjusted, 0)} weather-adjusted (base ${pct(base, 0)})${mods.length ? ` — ${mods.map((m) => m.label).join("; ")}` : ""}`,
      `Terrain: ${describeCell(t)}`,
      ...cellFlags.map((f) => `⚠ ${f.text}`),
    ].join("\n");
    return {
      title: `${t.id} – POA ${pct(poa)}`,
      description,
      polygons: [cellPolygon(t)],
      style: { stroke: color, "stroke-opacity": 0.8, "stroke-width": 1, fill: color, "fill-opacity": Math.round(heatOpacity(heat) * 100) / 100 },
      props: { cell: t.id, poa: r6(poa), cumulative_pod: r6(cumPod[t.id] ?? 0), sweeps, expected_pod: r6(adjusted), base_pod: r6(base) },
    };
  });

  const markers: MarkerItem[] = [];
  const marker = (cell: CellId, title: string, description: string, color: string, kind: string) => {
    const t = cells[cell];
    if (t) markers.push({ title, description, point: cellCenter(t), style: { "marker-color": color, "marker-symbol": "point" }, props: { kind, cell } });
  };
  marker(
    "A1",
    `Trailhead export – ${new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
    note,
    "#94a3b8",
    "note",
  );
  if (state.lkp) marker(state.lkp, `LKP – ${state.lkp}`, `Last known point. Profile: ${PROFILES[state.profileId].label}.`, "#f43f5e", "lkp");
  for (const c of state.clues) {
    marker(
      c.cell,
      c.text,
      `Clue near ${c.cell} · IC boost ${c.boost}${c.boost === "none" ? "" : ` (×${c.factor}, radius ${c.radius})`} · ${clock(c.at)}`,
      "#a855f7",
      "clue",
    );
  }
  if (state.found) marker(state.found.cell, `Subject located – ${state.found.cell}`, `${state.found.text} · ${clock(state.found.at)}`, "#34d399", "found");

  const byTeam = new Map<string, { name: string; cells: CellId[]; lines: string[] }>();
  for (const a of state.assignments) {
    const k = a.team.trim().toLowerCase();
    const entry = byTeam.get(k) ?? { name: a.team.trim(), cells: [], lines: [] };
    if (!entry.cells.includes(a.cell)) entry.cells.push(a.cell);
    entry.lines.push(`${a.cell} at ${clock(a.at)}${a.override ? ` — IC override${a.reason ? `: ${a.reason}` : ""}` : ""}`);
    byTeam.set(k, entry);
  }
  const teams: ShapeItem[] = [...byTeam.values()].map((t, i) => {
    const color = TEAM_COLORS[i % TEAM_COLORS.length];
    return {
      title: t.name,
      description: [`Assigned cells: ${t.cells.join(", ")}`, ...t.lines].join("\n"),
      polygons: cellsOutline(t.cells, state.terrain.bbox),
      style: { stroke: color, "stroke-opacity": 1, "stroke-width": 3, fill: color, "fill-opacity": 0 },
      props: { kind: "assignment", team: t.name, cells: t.cells },
    };
  });

  const meta = {
    exported_at: exportedAt,
    rest_of_world: r6(prob.row),
    lkp: state.lkp,
    profile: PROFILES[state.profileId].label,
    terrain: { source: state.terrain.source, label: state.terrain.label },
    weather: period
      ? {
          source,
          updated_at: weather!.fetchedAt,
          temperature_f: period.temperatureF,
          wind_mph: period.windMph,
          wind_direction: period.windDirection,
          wind_chill_f: windChillF(period.temperatureF, period.windMph),
          precip_chance: period.precipChance,
          short_forecast: period.shortForecast,
          exposure_risk: risk.level,
          detection_penalties: mods.map((m) => m.label),
          safety_flags: flags.map((f) => f.text),
        }
      : null,
    note,
    decision_support: DECISION_SUPPORT_LINE,
  };
  return { title, note, meta, cells: cellItems, markers, teams };
}

// ---------------------------------------------------------------------------
// GeoJSON

export interface GeoJSONFeature {
  type: "Feature";
  geometry: { type: "Point"; coordinates: Pos } | { type: "Polygon"; coordinates: PolygonCoords } | { type: "MultiPolygon"; coordinates: PolygonCoords[] };
  properties: Record<string, unknown>;
}
export interface CalTopoGeoJSON {
  type: "FeatureCollection";
  name: string;
  description: string;
  trailhead: Record<string, unknown>;
  features: GeoJSONFeature[];
}

export function buildCalTopoGeoJSON(input: CalTopoInput): CalTopoGeoJSON {
  const c = collect(input);
  const shape = (s: ShapeItem): GeoJSONFeature => ({
    type: "Feature",
    geometry: s.polygons.length === 1 ? { type: "Polygon", coordinates: s.polygons[0] } : { type: "MultiPolygon", coordinates: s.polygons },
    properties: { class: "Shape", title: s.title, description: s.description, ...s.style, ...s.props },
  });
  const point = (m: MarkerItem): GeoJSONFeature => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: m.point },
    properties: { class: "Marker", title: m.title, description: m.description, ...m.style, ...m.props },
  });
  return {
    type: "FeatureCollection",
    name: c.title,
    description: c.note,
    trailhead: c.meta,
    features: [...c.cells.map(shape), ...c.teams.filter((t) => t.polygons.length).map(shape), ...c.markers.map(point)],
  };
}

// ---------------------------------------------------------------------------
// KML

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** "#rrggbb" + opacity → KML aabbggrr. */
export function kmlColor(hex: string, opacity: number): string {
  const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${a}${hex.slice(5, 7)}${hex.slice(3, 5)}${hex.slice(1, 3)}`;
}

const kmlRing = (ring: Pos[]) => `<LinearRing><coordinates>${ring.map(([lon, lat]) => `${lon},${lat}`).join(" ")}</coordinates></LinearRing>`;
const kmlPolygon = (p: PolygonCoords) =>
  `<Polygon><outerBoundaryIs>${kmlRing(p[0])}</outerBoundaryIs>${p
    .slice(1)
    .map((h) => `<innerBoundaryIs>${kmlRing(h)}</innerBoundaryIs>`)
    .join("")}</Polygon>`;

function kmlShape(s: ShapeItem): string {
  const stroke = String(s.style.stroke);
  const fill = Number(s.style["fill-opacity"]);
  const style = `<Style><LineStyle><color>${kmlColor(stroke, Number(s.style["stroke-opacity"]))}</color><width>${s.style["stroke-width"]}</width></LineStyle><PolyStyle><color>${kmlColor(String(s.style.fill), fill)}</color>${fill === 0 ? "<fill>0</fill>" : ""}</PolyStyle></Style>`;
  const geom = s.polygons.length === 1 ? kmlPolygon(s.polygons[0]) : `<MultiGeometry>${s.polygons.map(kmlPolygon).join("")}</MultiGeometry>`;
  return `<Placemark><name>${xml(s.title)}</name><description>${xml(s.description)}</description>${style}${geom}</Placemark>`;
}

function kmlMarker(m: MarkerItem): string {
  const style = `<Style><IconStyle><color>${kmlColor(String(m.style["marker-color"]), 1)}</color></IconStyle></Style>`;
  return `<Placemark><name>${xml(m.title)}</name><description>${xml(m.description)}</description>${style}<Point><coordinates>${m.point[0]},${m.point[1]}</coordinates></Point></Placemark>`;
}

export function buildCalTopoKML(input: CalTopoInput): string {
  const c = collect(input);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    "<Document>",
    `<name>${xml(c.title)}</name>`,
    `<description>${xml(c.note)}</description>`,
    `<Folder><name>Cells (POA heatmap)</name>${c.cells.map(kmlShape).join("\n")}</Folder>`,
    `<Folder><name>Team assignments</name>${c.teams.filter((t) => t.polygons.length).map(kmlShape).join("\n")}</Folder>`,
    `<Folder><name>Markers</name>${c.markers.map(kmlMarker).join("\n")}</Folder>`,
    "</Document>",
    "</kml>",
  ].join("\n");
}
