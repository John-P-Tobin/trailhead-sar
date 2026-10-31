import { cachedWeather } from "@/lib/demo/weather";
import { MAP_ANCHOR } from "@/lib/terrain";
import { parseNwsElevation, parseNwsHourly, WeatherSnapshot } from "@/lib/weather";

const UA = "TrailheadSAR (hackathon demo)";
const TTL_MS = 10 * 60_000;
let cache: { at: number; key: string; snap: WeatherSnapshot } | null = null;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/geo+json" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`NWS ${res.status}`);
  return res.json();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const lat = Number(url.searchParams.get("lat") ?? MAP_ANCHOR.lat);
  const lon = Number(url.searchParams.get("lon") ?? MAP_ANCHOR.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return Response.json(cachedWeather(Date.now(), "Invalid location"));
  const key = `${lat.toFixed(4)},${lon.toFixed(4)}`;
  const fresh = url.searchParams.get("fresh") === "1";
  if (!fresh && cache && cache.key === key && Date.now() - cache.at < TTL_MS) return Response.json(cache.snap);

  try {
    const points = (await getJson(`https://api.weather.gov/points/${key}`)) as {
      properties?: { forecastHourly?: string; relativeLocation?: { properties?: { city?: string; state?: string } } };
    };
    const hourlyUrl = points.properties?.forecastHourly;
    if (!hourlyUrl) throw new Error("No forecastHourly URL");
    const hourly = await getJson(hourlyUrl);
    const periods = parseNwsHourly(hourly).slice(0, 24);
    if (!periods.length) throw new Error("Empty forecast");
    const elevationM = parseNwsElevation(hourly);
    const rel = points.properties?.relativeLocation?.properties;
    const snap: WeatherSnapshot = {
      source: "live",
      fetchedAt: new Date().toISOString(),
      location: rel?.city ? `Near ${rel.city}, ${rel.state} (${MAP_ANCHOR.label})` : MAP_ANCHOR.label,
      periods,
      ...(elevationM !== undefined ? { elevationM: Math.round(elevationM) } : {}),
    };
    cache = { at: Date.now(), key, snap };
    return Response.json(snap);
  } catch (e) {
    return Response.json(cachedWeather(Date.now(), `NWS unavailable: ${(e as Error).message}`));
  }
}
