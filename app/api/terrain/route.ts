import { bboxKey, parseBbox } from "@/lib/geo";
import { normalizeTerrainData, overpassQuery } from "@/lib/osm";

// Live OpenStreetMap terrain for the grid's bounding box, fetched from Overpass.
export const maxDuration = 45;

const OVERPASS_URL = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const UA = "TrailheadSAR (hackathon demo)";
const MAX_SPAN_DEG = 0.25;

export async function GET(req: Request) {
  const bbox = parseBbox(new URL(req.url).searchParams.get("bbox") ?? "");
  if (!bbox || bbox.north - bbox.south > MAX_SPAN_DEG || bbox.east - bbox.west > MAX_SPAN_DEG) {
    return Response.json({ ok: false, reason: "A bbox of south,west,north,east up to 0.25° is required." }, { status: 400 });
  }
  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ data: overpassQuery(bbox) }),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
    const featureCollection = normalizeTerrainData(await res.json(), bbox);
    return Response.json({ ok: true, fetchedAt: new Date().toISOString(), bbox: bboxKey(bbox), featureCollection });
  } catch (e) {
    const err = e as Error;
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    return Response.json({ ok: false, reason: timedOut ? "Overpass did not answer within 30 s." : `Overpass unavailable (${err.message}).` });
  }
}
