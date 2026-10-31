// Cached demo weather: a raw late-October afternoon in the Mount Washington valley.
// Used when the NWS API is unreachable. Times are generated relative to "now".
import { HourlyPeriod, WeatherSnapshot } from "../weather";
import { MAP_ANCHOR } from "../terrain";

const SCRIPT: Omit<HourlyPeriod, "startTime" | "endTime">[] = [
  { isDaytime: true, temperatureF: 41, windMph: 15, windDirection: "NW", precipChance: 20, shortForecast: "Mostly Cloudy" },
  { isDaytime: true, temperatureF: 39, windMph: 20, windDirection: "NW", precipChance: 30, shortForecast: "Patchy Fog" },
  { isDaytime: true, temperatureF: 37, windMph: 25, windDirection: "NW", precipChance: 40, shortForecast: "Areas Of Fog" },
  { isDaytime: false, temperatureF: 35, windMph: 25, windDirection: "NW", precipChance: 50, shortForecast: "Fog And Light Rain" },
  { isDaytime: false, temperatureF: 33, windMph: 30, windDirection: "NW", precipChance: 60, shortForecast: "Light Rain" },
  { isDaytime: false, temperatureF: 32, windMph: 30, windDirection: "NW", precipChance: 60, shortForecast: "Rain And Snow Showers" },
  { isDaytime: false, temperatureF: 31, windMph: 25, windDirection: "NW", precipChance: 40, shortForecast: "Chance Snow Showers" },
  { isDaytime: false, temperatureF: 30, windMph: 20, windDirection: "NW", precipChance: 30, shortForecast: "Mostly Cloudy" },
];

/** Rough late-October daylight in New Hampshire: 7 a.m.–5 p.m. Eastern. */
function isDaylight(ms: number): boolean {
  const h = Number(
    new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/New_York" }).format(ms),
  );
  return h >= 7 && h < 17;
}

export function cachedWeather(now = Date.now(), note?: string): WeatherSnapshot {
  const start = Math.floor(now / 3600_000) * 3600_000;
  return {
    source: "cached",
    fetchedAt: new Date(now).toISOString(),
    elevationM: 1722, // the NWS gridpoint for 44.27,-71.30

    location: `${MAP_ANCHOR.label} (cached demo weather)`,
    note,
    periods: SCRIPT.map((p, i) => ({
      ...p,
      isDaytime: isDaylight(start + i * 3600_000),
      startTime: new Date(start + i * 3600_000).toISOString(),
      endTime: new Date(start + (i + 1) * 3600_000).toISOString(),
    })),
  };
}
