import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { readConfig, signRequest, toCalTopoObject } from "@/lib/server/caltopo";
import { buildPublishFeatures, MAX_PUBLISH_FEATURES, zoneCells } from "@/lib/caltopoPublish";
import { DEMO_LKP, DEMO_PROFILE, DEMO_STEPS, demoSubject } from "@/lib/demo/scenario";
import { cumulativePodMap, initialState, reducer } from "@/lib/store";
import { rankCells } from "@/lib/engine/rank";
import { snapshotOf } from "@/lib/terrain";
import { bundledTerrain } from "./helpers/bundled";

describe("CalTopo request signing", () => {
  it("matches the caltopo_python reference implementation", () => {
    // Vector generated with: base64(hmac_sha256(b64decode(key), "POST /api/v1/map/TESTMAP/Shape\n1700000000000\n{...}"))
    const key = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=";
    const sig = signRequest(key, "post", "/api/v1/map/TESTMAP/Shape", 1700000000000, '{"properties":{"title":"x"}}');
    expect(sig).toBe("74GIbm6URirAadQ0cIxqxFo/K1NA3GR9CgVf+ChKNJw=");
  });

  it("is unconfigured unless id, key and map id are all present", () => {
    expect(readConfig({})).toBeNull();
    expect(readConfig({ CALTOPO_ID: "a", CALTOPO_KEY: "b" })).toBeNull();
    expect(readConfig({ CALTOPO_ID: "a", CALTOPO_KEY: "b", CALTOPO_MAP_ID: "M" })?.host).toBe("caltopo.com");
  });

  it("builds CalTopo marker and shape objects inside the app folder", () => {
    const m = toCalTopoObject({ class: "Marker", title: "t", description: "d", geometry: { type: "Point", coordinates: [-71.3, 44.27] }, style: { "marker-color": "#f00" } }, "F1") as {
      properties: Record<string, unknown>;
    };
    expect(m.properties.folderId).toBe("F1");
    expect(m.properties["marker-symbol"]).toBe("point");
    const s = toCalTopoObject(
      { class: "Shape", title: "z", description: "", geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }, style: { fill: "#fff", "fill-opacity": 0.2 } },
      "F1",
    ) as { properties: Record<string, unknown> };
    expect(s.properties.folderId).toBe("F1");
    expect(s.properties["fill-opacity"]).toBe(0.2);
  });
});

describe("what gets published", () => {
  const terrain = snapshotOf(bundledTerrain().model);
  let s = reducer(initialState(terrain), { type: "demo_load", lkp: DEMO_LKP, profileId: DEMO_PROFILE, terrain, subject: demoSubject() });
  for (const step of DEMO_STEPS) {
    if (step.kind === "report") s = reducer(s, { type: "apply_report", payload: { confirmed: step.canned, source: "canned" } });
    if (step.kind === "clue") s = reducer(s, { type: "add_clue", text: step.text, cell: step.cell, radius: step.radius, boost: step.suggestedBoost });
    if (step.kind === "override") s = reducer(s, { type: "assign", team: step.team, cell: step.cell, suggestedRank: 3, topSuggestion: "G13", reason: step.reason });
  }
  const suggestions = rankCells(s.prob!, cumulativePodMap(s.pods), s.terrain.cells);
  const features = buildPublishFeatures({ state: s, weather: null, now: Date.parse("2026-10-31T03:00:00Z") }, suggestions);

  it("zones are nested and hold at least their share of on-grid probability", () => {
    const z50 = zoneCells(s.prob!.cells, 0.5);
    const z90 = zoneCells(s.prob!.cells, 0.9);
    expect(z50.every((c) => z90.includes(c))).toBe(true);
    const total = Object.values(s.prob!.cells).reduce((a, b) => a + b, 0);
    expect(z50.reduce((a, c) => a + s.prob!.cells[c], 0) / total).toBeGreaterThanOrEqual(0.5);
  });

  it("stays well under the feature cap and uses closed [lon, lat] rings", () => {
    expect(features.length).toBeGreaterThan(5);
    expect(features.length).toBeLessThanOrEqual(MAX_PUBLISH_FEATURES);
    for (const f of features) {
      if (f.geometry.type !== "Polygon") continue;
      for (const ring of f.geometry.coordinates) {
        expect(ring[0]).toEqual(ring[ring.length - 1]);
        for (const [lon, lat] of ring) {
          expect(lon).toBeLessThan(-70);
          expect(lat).toBeGreaterThan(44);
        }
      }
    }
  });

  it("includes zones, top suggestions, the team outline, LKP and clue markers", () => {
    const titles = features.map((f) => f.title);
    expect(titles.some((t) => t.startsWith("50% zone"))).toBe(true);
    expect(titles.some((t) => t.startsWith("#1 G13"))).toBe(true);
    expect(titles.some((t) => t.startsWith("Team: Team 3"))).toBe(true);
    expect(titles.some((t) => t.startsWith("LKP – E10"))).toBe(true);
    expect(titles.some((t) => t === "Clue · G13")).toBe(true);
    for (const t of titles) expect(t.length).toBeLessThanOrEqual(60);
    expect(features.filter((f) => f.class === "Marker").length).toBeGreaterThanOrEqual(3);
  });

  it("never writes the subject's name or medical details onto the shared map", () => {
    const text = JSON.stringify(features);
    expect(text).not.toMatch(/Dan Harper|Harper|medical|meds/i);
  });
});
