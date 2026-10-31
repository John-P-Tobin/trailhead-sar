import { describe, expect, it } from "vitest";
import { buildTerrainModel } from "@/lib/osm";
import { describeCell } from "@/lib/terrain";
import { bboxKey, cellAt, cellSizeM, DEFAULT_BBOX, fromGrid, parseBbox, toGrid } from "@/lib/geo";
import { initialState, reducer } from "@/lib/store";
import { snapshotOf, STYLIZED_TERRAIN } from "@/lib/terrain";
import { bundledTerrain } from "./helpers/bundled";

describe("geo", () => {
  it("projects between [lon, lat] and grid units", () => {
    const [lon, lat] = fromGrid(DEFAULT_BBOX, 4.5, 9.5);
    const [gx, gy] = toGrid(DEFAULT_BBOX, lon, lat);
    expect(gx).toBeCloseTo(4.5, 9);
    expect(gy).toBeCloseTo(9.5, 9);
    expect(cellAt(DEFAULT_BBOX, lon, lat)).toBe("E10");
    expect(cellAt(DEFAULT_BBOX, -71.0, 44.26)).toBeNull();
  });
  it("cells are ~266 m wide and ~297 m tall at this latitude", () => {
    const { w, h } = cellSizeM(DEFAULT_BBOX);
    expect(w).toBeGreaterThan(260);
    expect(w).toBeLessThan(272);
    expect(h).toBeCloseTo(296.9, 0);
  });
  it("parses and formats bboxes in Overpass order", () => {
    expect(parseBbox(bboxKey(DEFAULT_BBOX))).toEqual(DEFAULT_BBOX);
    expect(parseBbox("44.3,-71.3,44.2,-71.2")).toBeNull(); // south > north
    expect(parseBbox("a,b,c,d")).toBeNull();
  });
});

describe("bundled terrain (data/terrain.geojson)", () => {
  const { raw, fc, bbox, model } = bundledTerrain();

  it("covers the Mt Washington / Lakes of the Clouds box and credits OpenStreetMap", () => {
    expect(bbox).toEqual(DEFAULT_BBOX);
    expect(raw.trailhead.attribution).toMatch(/OpenStreetMap contributors/);
    expect(fc.features.length).toBeGreaterThan(100);
  });

  it("stores WGS84 coordinates in [lon, lat] order near the grid", () => {
    const pts = fc.features.flatMap((f) => {
      const g = f.geometry;
      return g.type === "Point" ? [g.coordinates] : g.type === "LineString" ? g.coordinates : g.type === "Polygon" ? g.coordinates.flat() : g.type === "MultiLineString" ? g.coordinates.flat() : g.coordinates.flat(2);
    });
    for (const [lon, lat] of pts) {
      expect(lon).toBeGreaterThan(-71.4);
      expect(lon).toBeLessThan(-71.2);
      expect(lat).toBeGreaterThan(44.2);
      expect(lat).toBeLessThan(44.33);
    }
  });

  it("puts real landmarks in the right cells", () => {
    const peak = (n: string) => model.features.find((f) => f.kind === "peak" && f.name === n)!;
    expect(peak("Mount Washington").cells).toEqual(["J6"]);
    expect(peak("Mount Washington").ele).toBe(1917);
    expect(model.cells.J6.ridge).toBe(true);
    expect(model.cells.J6.cover).toBe("alpine");
    expect(model.cells.E10.trail).toBe(true); // Lakes of the Clouds hut junction
    const lakes = model.features.filter((f) => f.kind === "water" && /Lake of the Clouds/.test(f.name ?? ""));
    expect(lakes).toHaveLength(2);
    for (const lake of lakes) expect(lake.rings![0].length).toBeGreaterThan(4); // drawable outline, not a dot
  });
});

describe("terrain in the search state", () => {
  const bundled = snapshotOf(bundledTerrain().model);
  const stylized = snapshotOf(STYLIZED_TERRAIN);

  it("new terrain before the LKP just replaces the map", () => {
    const s = reducer(initialState(stylized), { type: "set_terrain", terrain: bundled });
    expect(s.terrain.source).toBe("bundled");
    expect(s.prob).toBeNull();
  });

  it("new terrain after the LKP regenerates the priors and logs it", () => {
    let s = reducer(initialState(stylized), { type: "set_lkp", cell: "E10" });
    const before = s.prob!.cells.D8;
    s = reducer(s, { type: "set_terrain", terrain: bundled });
    expect(s.prob!.cells.D8).not.toBeCloseTo(before, 6);
    expect(s.audit.at(-1)!.summary).toMatch(/priors regenerated/);
  });

  it("keeps IC-edited priors when terrain arrives", () => {
    let s = reducer(initialState(stylized), { type: "set_lkp", cell: "E10" });
    s = reducer(s, { type: "edit_cell_poa", cell: "A1", value: 0.05 });
    s = reducer(s, { type: "set_terrain", terrain: bundled });
    expect(s.terrain.source).toBe("bundled");
    expect(s.prob!.cells.A1).toBeCloseTo(0.05, 9);
    expect(s.audit.at(-1)!.summary).toMatch(/IC-edited priors kept/);
  });

  it("never changes terrain once the search has started", () => {
    let s = reducer(initialState(bundled), { type: "set_lkp", cell: "E10" });
    s = reducer(s, { type: "add_clue", text: "x", cell: "G13", radius: 1, boost: "small" });
    const after = reducer(s, { type: "set_terrain", terrain: stylized });
    expect(after).toBe(s);
  });

  it("reset keeps the loaded terrain", () => {
    const s = reducer(initialState(bundled), { type: "reset" });
    expect(s.terrain.source).toBe("bundled");
  });
});

describe("bundled DEM elevation", () => {
  const { fc, bbox, elevation, model } = bundledTerrain();
  it("attaches DEM mean, range, slope and aspect per cell while the model estimate stays unchanged", () => {
    expect(Math.abs(model.cells.J6.demMeanM! - elevation.J6.meanM)).toBeLessThan(1);
    expect(model.cells.J6.slopeDeg).toBeGreaterThan(0);
    expect(model.cells.J6.elevationMinM).toBeLessThanOrEqual(model.cells.J6.demMeanM!);
    const est = buildTerrainModel(fc, bbox, "bundled");
    expect(model.cells.J6.elevationM).toBe(est.cells.J6.elevationM); // prior input unaffected by the DEM
    const partial = buildTerrainModel(fc, bbox, "bundled", { elevation: { J6: elevation.J6 } });
    expect(partial.cells.J6.demMeanM).toBeDefined();
    expect(partial.cells.E10.demMeanM).toBeUndefined();
    for (const c of Object.values(partial.cells)) expect(Number.isFinite(c.elevation) && c.elevation >= 0 && c.elevation <= 1).toBe(true);
  });
  it("without a grid no DEM fields are present (old behaviour)", () => {
    const est = buildTerrainModel(fc, bbox, "bundled");
    expect(Object.values(est.cells).every((c) => c.demMeanM === undefined && c.slopeDeg === undefined)).toBe(true);
  });
  it("describeCell flags steep cells only when a slope is known", () => {
    const base = model.cells.J6;
    expect(describeCell({ ...base, slopeDeg: 40 })).toContain("steep");
    expect(describeCell({ ...base, slopeDeg: undefined })).not.toContain("steep");
    expect(describeCell({ ...base, slopeDeg: undefined })).toMatch(/~\d+ m$/);
  });
});
