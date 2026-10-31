import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/terrain/route";

const req = (bbox: string) => new Request(`http://localhost/api/terrain?bbox=${bbox}`);
const BBOX = "44.24500,-71.33500,44.28500,-71.28500";

describe("/api/terrain", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("queries Overpass with a User-Agent and a 30 s timeout, and returns normalized GeoJSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ elements: [{ type: "way", id: 1, tags: { highway: "path", name: "Crawford Path" }, geometry: [{ lat: 44.26, lon: -71.32 }, { lat: 44.265, lon: -71.31 }] }] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await GET(req(BBOX));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.featureCollection.features[0].properties).toMatchObject({ kind: "trail", name: "Crawford Path", osm_id: "way/1" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["User-Agent"]).toBe("TrailheadSAR (hackathon demo)");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(String(init.body)).toContain(encodeURIComponent("bbox:44.245,-71.335,44.285,-71.285"));
  });

  it("reports Overpass failures instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("busy", { status: 429 })));
    expect(await (await GET(req(BBOX))).json()).toEqual({ ok: false, reason: "Overpass unavailable (Overpass returned 429)." });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Object.assign(new Error("t"), { name: "TimeoutError" })));
    expect((await (await GET(req(BBOX))).json()).reason).toMatch(/30 s/);
  });

  it("rejects bad or oversized boxes", async () => {
    expect((await GET(req("nope"))).status).toBe(400);
    expect((await GET(req("44,-72,45,-71"))).status).toBe(400);
  });
});
