import { describe, expect, it } from "vitest";
import { assembleRings, buildTerrainModel, classifyTags, normalizeTerrainData, parseEle, TerrainFeatureCollection } from "@/lib/osm";
import { BBox, cellBounds, fromGrid } from "@/lib/geo";
import { promptFeatures } from "@/lib/terrain";
import { generatePriors } from "@/lib/engine/priors";
import { PROFILES } from "@/lib/profiles";
import { total } from "@/lib/engine/bayes";

// A small synthetic sample inside the default grid (not real OSM data).
const BB: BBox = { south: 44.245, west: -71.335, north: 44.285, east: -71.285 };
const at = (gx: number, gy: number) => fromGrid(BB, gx, gy); // [lon, lat]
const sample = {
  type: "FeatureCollection",
  generator: "overpass-turbo",
  features: [
    // Trail straight across row 5 from A5 to O5 (gy 4.5)
    { type: "Feature", properties: { "@id": "way/1", highway: "path", name: "Sample Path" }, geometry: { type: "LineString", coordinates: [at(0.1, 4.5), at(14.9, 4.5)] } },
    // 20 m stub in C10: too short to flag the cell
    { type: "Feature", properties: { "@id": "way/2", highway: "footway" }, geometry: { type: "LineString", coordinates: [at(2.5, 9.5), at(2.575, 9.5)] } },
    // Stream down column H from H6 to H15 (gx 7.5)
    { type: "Feature", properties: { "@id": "way/3", waterway: "stream", name: "Sample Brook" }, geometry: { type: "LineString", coordinates: [at(7.5, 5.2), at(7.5, 14.9)] } },
    // Pond covering most of K12
    {
      type: "Feature",
      properties: { "@id": "way/4", natural: "water", water: "pond", name: "Sample Pond" },
      geometry: { type: "Polygon", coordinates: [[at(10.1, 11.1), at(10.9, 11.1), at(10.9, 11.9), at(10.1, 11.9), at(10.1, 11.1)]] },
    },
    // Cliff across D3
    { type: "Feature", properties: { "@id": "way/5", natural: "cliff" }, geometry: { type: "LineString", coordinates: [at(3.05, 2.5), at(3.95, 2.5)] } },
    // Peak in L3, older osmtogeojson property layout
    { type: "Feature", properties: { type: "node", id: 6, tags: { natural: "peak", name: "Sample Peak", ele: "1900" } }, geometry: { type: "Point", coordinates: at(11.5, 2.5) } },
    // Ignored: not a terrain feature
    { type: "Feature", properties: { "@id": "way/7", highway: "pedestrian", area: "yes" }, geometry: { type: "Polygon", coordinates: [[at(1, 1), at(1.2, 1), at(1.2, 1.2), at(1, 1)]] } },
    // Entirely outside the grid: dropped when clipping
    { type: "Feature", properties: { "@id": "way/8", highway: "path", name: "Far Away" }, geometry: { type: "LineString", coordinates: [[-71.0, 44.0], [-71.01, 44.01]] } },
  ],
};

describe("OSM tags and values", () => {
  it("classifies the features we use", () => {
    expect(classifyTags({ highway: "path" })).toBe("trail");
    expect(classifyTags({ highway: "unclassified", name: "Auto Road" })).toBe("road");
    expect(classifyTags({ waterway: "stream" })).toBe("stream");
    expect(classifyTags({ natural: "water", water: "pond" })).toBe("water");
    expect(classifyTags({ natural: "cliff" })).toBe("cliff");
    expect(classifyTags({ natural: "peak" })).toBe("peak");
    expect(classifyTags({ highway: "pedestrian" })).toBeNull();
    expect(classifyTags({ amenity: "shelter" })).toBeNull();
  });
  it("parses elevations in meters or feet", () => {
    expect(parseEle("1917")).toBe(1917);
    expect(parseEle("1916.6 m")).toBeCloseTo(1916.6);
    expect(parseEle("6288 ft")).toBeCloseTo(1916.6, 0);
    expect(parseEle("high")).toBeUndefined();
  });
});

describe("normalizeTerrainData", () => {
  it("reads an Overpass Turbo export, drops non-terrain features and clips to the grid", () => {
    const fc = normalizeTerrainData(sample, BB);
    const names = fc.features.map((f) => f.properties.name ?? f.properties.kind);
    expect(names).toEqual(["Sample Path", "trail", "Sample Brook", "Sample Pond", "cliff", "Sample Peak"]);
    const peak = fc.features.find((f) => f.properties.kind === "peak")!;
    expect(peak.properties).toMatchObject({ name: "Sample Peak", ele: 1900, osm_id: "node/6" });
  });

  it("is idempotent on its own output", () => {
    const once = normalizeTerrainData(sample, BB);
    expect(normalizeTerrainData(once, BB)).toEqual(once);
  });

  it("reads raw Overpass JSON: `out geom` ways, node-ref ways, peaks and multipolygon relations", () => {
    const overpass = {
      elements: [
        { type: "node", id: 10, lat: 44.27, lon: -71.31, tags: { natural: "peak", name: "P", ele: "1700" } },
        { type: "node", id: 11, lat: 44.26, lon: -71.32 },
        { type: "node", id: 12, lat: 44.262, lon: -71.322 },
        { type: "way", id: 20, tags: { highway: "path", name: "Geom Path" }, geometry: [{ lat: 44.25, lon: -71.33 }, { lat: 44.255, lon: -71.325 }] },
        { type: "way", id: 21, tags: { waterway: "stream" }, nodes: [11, 12] },
        { type: "way", id: 30, geometry: [{ lat: 44.27, lon: -71.30 }, { lat: 44.27, lon: -71.29 }, { lat: 44.275, lon: -71.29 }] },
        { type: "way", id: 31, geometry: [{ lat: 44.275, lon: -71.29 }, { lat: 44.275, lon: -71.30 }, { lat: 44.27, lon: -71.30 }] },
        { type: "relation", id: 40, tags: { natural: "water", name: "Lake R" }, members: [{ type: "way", ref: 30, role: "outer" }, { type: "way", ref: 31, role: "outer" }] },
      ],
    };
    const fc = normalizeTerrainData(overpass);
    const byName = (n: string) => fc.features.find((f) => f.properties.name === n);
    expect(byName("P")!.geometry).toEqual({ type: "Point", coordinates: [-71.31, 44.27] });
    expect(byName("Geom Path")!.geometry.type).toBe("LineString");
    expect(fc.features.find((f) => f.properties.kind === "stream")!.geometry).toEqual({ type: "LineString", coordinates: [[-71.32, 44.26], [-71.322, 44.262]] });
    const lake = byName("Lake R")!.geometry;
    expect(lake.type).toBe("Polygon");
    expect(lake.type === "Polygon" && lake.coordinates[0].length).toBe(5);
  });

  it("joins open ring segments, including reversed ones", () => {
    const rings = assembleRings([
      [[0, 0], [1, 0], [1, 1]],
      [[0, 0], [0, 1], [1, 1]], // reversed relative to the first
    ]);
    expect(rings).toHaveLength(1);
    expect(rings[0][0]).toEqual(rings[0][rings[0].length - 1]);
  });

  it("rejects input that is neither GeoJSON nor Overpass JSON", () => {
    expect(() => normalizeTerrainData({ hello: 1 })).toThrow();
  });
});

describe("buildTerrainModel", () => {
  const model = buildTerrainModel(normalizeTerrainData(sample, BB) as TerrainFeatureCollection, BB, "live");

  it("gives every cell real lat/lon bounds from the bounding box", () => {
    expect(model.cells.A1.bounds).toEqual(cellBounds(BB, 0, 0));
    expect(model.cells.A1.bounds.north).toBeCloseTo(BB.north, 9);
    expect(model.cells.A1.bounds.west).toBeCloseTo(BB.west, 9);
    expect(model.cells.O15.bounds.south).toBeCloseTo(BB.south, 9);
    expect(model.cells.O15.bounds.east).toBeCloseTo(BB.east, 9);
    expect(model.cells.B1.bounds.west).toBeCloseTo(model.cells.A1.bounds.east, 12);
  });

  it("flags trail, drainage, water, cliff and ridge cells from real lengths and areas", () => {
    for (const c of ["A5", "E5", "O5"]) expect(model.cells[c].trail).toBe(true);
    expect(model.cells.A6.trail).toBe(false);
    expect(model.cells.C10.trail).toBe(false); // 20 m stub
    for (const c of ["H7", "H10", "H15"]) expect(model.cells[c].drainage).toBe(true);
    expect(model.cells.G10.drainage).toBe(false);
    expect(model.cells.K12.water).toBe(true);
    expect(model.cells.D3.cliff).toBe(true);
    expect(model.cells.L3.ridge).toBe(true);
    expect(model.osm).toBe(true);
  });

  it("estimates elevation falling away from the peak, lower along drainages", () => {
    expect(model.cells.L3.elevationM).toBeGreaterThan(model.cells.L8.elevationM!);
    expect(model.cells.L3.elevation).toBe(1);
    expect(model.cells.H12.elevationM).toBeLessThan(model.cells.G12.elevationM!);
  });

  it("keeps closed pond outlines intact when simplifying for the map", () => {
    const pond = model.features.find((f) => f.name === "Sample Pond")!;
    const ring = pond.rings![0];
    expect(ring.length).toBeGreaterThanOrEqual(4);
    const xs = ring.map((p) => p[0]);
    const ys = ring.map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.5);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(0.5);
  });

  it("lists named features with the cells they pass through, in order", () => {
    const pf = promptFeatures(model.features);
    const path = pf.find((f) => f.name === "Sample Path")!;
    expect(path.cells[0]).toBe("A5");
    expect(path.cells.at(-1)).toBe("O5");
    expect(pf.find((f) => f.name === "Sample Brook")!.cells[0]).toBe("H6");
  });

  it("priors on OSM terrain sum to 1 and favor the trail over plain ground", () => {
    const s = generatePriors("H5", PROFILES.day_hiker, model.cells);
    expect(total(s)).toBeCloseTo(1, 9);
    expect(s.cells.E5).toBeGreaterThan(s.cells.E4);
  });
});
