import { describe, expect, it } from "vitest";
import { buildCalTopoGeoJSON, buildCalTopoKML, cellsOutline, DECISION_SUPPORT_LINE, GeoJSONFeature, kmlColor } from "@/lib/export";
import { initialState, reducer, SearchState } from "@/lib/store";
import { snapshotOf } from "@/lib/terrain";
import { DEFAULT_BBOX } from "@/lib/geo";
import { cachedWeather } from "@/lib/demo/weather";
import { WeatherSnapshot } from "@/lib/weather";
import { bundledTerrain } from "./helpers/bundled";

const NOW = Date.parse("2026-10-31T14:30:00Z");
const terrain = snapshotOf(bundledTerrain().model);
const B = DEFAULT_BBOX;

function searchState(): SearchState {
  let s = reducer(initialState(terrain), { type: "set_lkp", cell: "E10" });
  s = reducer(s, {
    type: "apply_report",
    payload: {
      confirmed: { team: "Team 1", cells: ["F11", "G11"], coverage_description: "", estimated_pod: 0.25, pod_confidence: "low", conditions: ["fog"], clues: [], unclear_points: [] },
      source: "manual",
    },
  });
  s = reducer(s, { type: "add_clue", text: "Granola wrapper on the Dry River Trail", cell: "G13", radius: 1, boost: "small" });
  s = reducer(s, { type: "assign", team: "Team 3", cell: "G14", suggestedRank: 3, topSuggestion: "G13", reason: "family tip" });
  s = reducer(s, { type: "assign", team: "team 3 ", cell: "G15", suggestedRank: null, topSuggestion: "G13" });
  s = reducer(s, { type: "assign", team: "Team 2", cell: "D8", suggestedRank: null, topSuggestion: "G13" });
  return reducer(s, { type: "mark_found", cell: "G14", text: "Subject located beside the Dry River" });
}

// Fog + 55 mph winds at export time, from the cached-weather shape.
const weather: WeatherSnapshot = (() => {
  const w = cachedWeather(NOW);
  w.source = "live";
  w.fetchedAt = new Date(NOW - 12 * 60_000).toISOString();
  w.periods = w.periods.map((p) => ({ ...p, isDaytime: true, shortForecast: "Areas Of Fog", windMph: 55 }));
  return w;
})();

const positions = (g: GeoJSONFeature["geometry"]): [number, number][] =>
  g.type === "Point" ? [g.coordinates] : g.type === "Polygon" ? g.coordinates.flat() : g.coordinates.flat(2);

describe("CalTopo GeoJSON export", () => {
  const fc = buildCalTopoGeoJSON({ state: searchState(), weather, now: NOW });
  const cells = fc.features.filter((f) => f.properties.cell && f.geometry.type === "Polygon" && f.properties.class === "Shape" && !f.properties.kind);

  it("is a FeatureCollection of valid features", () => {
    expect(fc.type).toBe("FeatureCollection");
    for (const f of fc.features) {
      expect(f.type).toBe("Feature");
      expect(["Point", "Polygon", "MultiPolygon"]).toContain(f.geometry.type);
      expect(typeof f.properties.title).toBe("string");
      expect(typeof f.properties.description).toBe("string");
    }
    expect(JSON.parse(JSON.stringify(fc))).toEqual(fc); // plain JSON
  });

  it("uses WGS84 [lon, lat] order inside the grid's bounding box", () => {
    for (const f of fc.features) {
      for (const [lon, lat] of positions(f.geometry)) {
        expect(lon).toBeGreaterThanOrEqual(B.west - 1e-9);
        expect(lon).toBeLessThanOrEqual(B.east + 1e-9);
        expect(lat).toBeGreaterThanOrEqual(B.south - 1e-9);
        expect(lat).toBeLessThanOrEqual(B.north + 1e-9);
      }
    }
  });

  it("has one closed, counterclockwise polygon per cell, titled and styled on the heatmap scale", () => {
    expect(cells).toHaveLength(225);
    for (const f of cells) {
      if (f.geometry.type !== "Polygon") throw new Error("cell must be a Polygon");
      const ring = f.geometry.coordinates[0];
      expect(ring).toHaveLength(5);
      expect(ring[0]).toEqual(ring[4]);
      const area = ring.slice(1).reduce((a, p, i) => a + ring[i][0] * p[1] - p[0] * ring[i][1], 0);
      expect(area).toBeGreaterThan(0);
      expect(f.properties.title).toMatch(/^[A-O]\d{1,2} – POA \d+\.\d%$/);
      expect(f.properties.fill).toMatch(/^#[0-9a-f]{6}$/);
      expect(f.properties.stroke).toMatch(/^#[0-9a-f]{6}$/);
      expect(f.properties["fill-opacity"]).toBeGreaterThanOrEqual(0.08);
      expect(f.properties["fill-opacity"]).toBeLessThanOrEqual(0.7);
    }
    const a1 = cells.find((f) => f.properties.cell === "A1")!;
    expect(a1.geometry.type === "Polygon" && a1.geometry.coordinates[0][3]).toEqual([B.west, B.north]); // NW corner
  });

  it("describes POA, cumulative POD, who searched, sweeps and weather-adjusted POD", () => {
    const g11 = cells.find((f) => f.properties.cell === "G11")!;
    const d = String(g11.properties.description);
    expect(d).toMatch(/POA \d+\.\d\d%/);
    expect(d).toContain("Cumulative POD 25%");
    expect(d).toMatch(/Last searched by Team 1 at /);
    expect(d).toContain("Sweeps: 1");
    expect(d).toMatch(/Expected POD next sweep: \d+% weather-adjusted \(base \d+%\) — fog: −30% expected detection/);
    expect(g11.properties.expected_pod).toBeLessThan(g11.properties.base_pod as number);
  });

  it("adds the active safety flag to ridgeline cells", () => {
    const washington = cells.find((f) => f.properties.cell === "J6")!;
    expect(String(washington.properties.description)).toMatch(/⚠ Winds above 50 mph forecast/);
    const valley = cells.find((f) => f.properties.cell === "G14")!;
    expect(String(valley.properties.description)).not.toMatch(/Winds above 50 mph/);
  });

  it("adds markers for the LKP, each clue and the found location", () => {
    const markers = fc.features.filter((f) => f.geometry.type === "Point");
    const titles = markers.map((m) => m.properties.title);
    expect(titles).toContain("LKP – E10");
    expect(titles).toContain("Granola wrapper on the Dry River Trail");
    expect(titles).toContain("Subject located – G14");
    const lkp = markers.find((m) => m.properties.title === "LKP – E10")!;
    const [lon, lat] = lkp.geometry.coordinates as [number, number];
    expect(lon).toBeCloseTo((terrain.cells.E10.bounds.west + terrain.cells.E10.bounds.east) / 2, 6);
    expect(lat).toBeCloseTo((terrain.cells.E10.bounds.south + terrain.cells.E10.bounds.north) / 2, 6);
  });

  it("outlines each team's assigned cells, titled with the team name", () => {
    const teams = fc.features.filter((f) => f.properties.kind === "assignment");
    expect(teams.map((t) => t.properties.title)).toEqual(["Team 3", "Team 2"]); // "team 3 " merges into Team 3
    const t3 = teams[0];
    expect(t3.geometry.type).toBe("Polygon"); // G14 + G15 are adjacent → one outline
    expect(t3.geometry.type === "Polygon" && t3.geometry.coordinates[0]).toHaveLength(5);
    expect(t3.properties["fill-opacity"]).toBe(0);
  });

  it("carries the weather note and the decision-support line at the top level", () => {
    expect(fc.description).toContain("Rest of World (outside the grid):");
    expect(fc.description).toMatch(/Weather — Live NWS, updated .*, 12 min ago: /);
    expect(fc.description).toMatch(/55 mph/);
    expect(fc.description).toMatch(/wind chill -?\d+°F/);
    expect(fc.description).toMatch(/precip \d+%/);
    expect(fc.description).toMatch(/Exposure risk: (LOW|MODERATE|HIGH|SEVERE)/);
    expect(fc.description).toContain(DECISION_SUPPORT_LINE);
    expect(fc.trailhead).toMatchObject({ decision_support: DECISION_SUPPORT_LINE, weather: { source: "Live NWS", wind_mph: 55 } });
  });

  it("refuses to export before there is a search", () => {
    expect(() => buildCalTopoGeoJSON({ state: initialState(terrain), weather: null, now: NOW })).toThrow();
  });
});

describe("cellsOutline", () => {
  const ringOf = (cells: string[]) => cellsOutline(cells, B);
  it("one cell → a 4-corner ring", () => {
    const p = ringOf(["E5"]);
    expect(p).toHaveLength(1);
    expect(p[0][0]).toHaveLength(5);
  });
  it("an L of three cells → one 6-corner ring", () => {
    const p = ringOf(["E5", "E6", "F6"]);
    expect(p).toHaveLength(1);
    expect(p[0][0]).toHaveLength(7);
  });
  it("a ring of eight cells keeps its hole, wound clockwise", () => {
    const p = ringOf(["D4", "E4", "F4", "D5", "F5", "D6", "E6", "F6"]);
    expect(p).toHaveLength(1);
    expect(p[0]).toHaveLength(2);
    const hole = p[0][1];
    const area = hole.slice(1).reduce((a, q, i) => a + hole[i][0] * q[1] - q[0] * hole[i][1], 0);
    expect(area).toBeLessThan(0);
  });
  it("cells touching only at a corner stay separate polygons", () => {
    expect(ringOf(["E5", "F6"])).toHaveLength(2);
  });
});

describe("CalTopo KML export", () => {
  const kml = buildCalTopoKML({ state: searchState(), weather, now: NOW });
  it("is a KML document with styled placemarks in lon,lat order", () => {
    expect(kml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(kml).toContain('<kml xmlns="http://www.opengis.net/kml/2.2">');
    expect(kml.match(/<Placemark>/g)!.length).toBe(225 + 2 + 4); // cells + 2 teams + note, LKP, clue, found
    expect(kml).toContain("<PolyStyle><color>");
    expect(kml).toContain("<fill>0</fill>"); // team outlines are outline-only
    const first = /<coordinates>([^<]+)<\/coordinates>/.exec(kml)![1].split(" ")[0].split(",").map(Number);
    expect(first[0]).toBeLessThan(0); // longitude first (west is negative)
    expect(first[1]).toBeGreaterThan(44);
    expect(kml).toContain(DECISION_SUPPORT_LINE);
  });
  it("converts colors to KML aabbggrr", () => {
    expect(kmlColor("#ff8000", 1)).toBe("ff0080ff");
    expect(kmlColor("#112233", 0)).toBe("00332211");
  });
});
