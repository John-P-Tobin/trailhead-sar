import { bboxKey, parseBbox } from "@/lib/geo";
import { normalizeTerrainData, overpassQuery } from "@/lib/osm";

// Live OpenStreetMap terrain for the grid's bounding box, fetched from Overpass.
export const maxDuration = 45;

// Overpass is often overloaded, so ask two public servers at once and take the first good answer.
const OVERPASS_URLS = process.env.OVERPASS_URL
  ? [process.env.OVERPASS_URL]
  : ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"];
const UA = "TrailheadSAR (hackathon demo)";
const MAX_SPAN_DEG = 0.25;

export async function GET(req: Request) {
  const bbox = parseBbox(new URL(req.url).searchParams.get("bbox") ?? "");
  if (!bbox || bbox.north - bbox.south > MAX_SPAN_DEG || bbox.east - bbox.west > MAX_SPAN_DEG) {
    return Response.json({ ok: false, reason: "A bbox of south,west,north,east up to 0.25° is required." }, { status: 400 });
  }
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
  const ask = async (url: string) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ data: overpassQuery(bbox) }),
      signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Overpass returned ${res.status}`);
    return normalizeTerrainData(await res.json(), bbox);
  };
  try {
    const featureCollection = await Promise.any(OVERPASS_URLS.map(ask)).catch((e: AggregateError) => {
      throw e.errors[0];
    });
    controller.abort(); // stop the slower request
    return Response.json({ ok: true, fetchedAt: new Date().toISOString(), bbox: bboxKey(bbox), featureCollection });
  } catch (e) {
    const err = e as Error;
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    return Response.json({ ok: false, reason: timedOut ? "Overpass did not answer within 30 s." : `Overpass unavailable (${err.message}).` });
  }
}
