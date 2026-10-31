// Weather: NWS hourly forecast parsing, POD modifiers, exposure risk and team safety flags.
// All thresholds and multipliers are ILLUSTRATIVE ESTIMATES for decision support.

import { CellId } from "./engine/grid";
import { CellTerrain } from "./terrain";

export interface HourlyPeriod {
  startTime: string;
  endTime: string;
  isDaytime: boolean;
  temperatureF: number;
  windMph: number;
  windDirection: string;
  precipChance: number; // 0–100
  shortForecast: string;
}

export interface WeatherSnapshot {
  source: "live" | "cached";
  fetchedAt: string;
  location: string;
  periods: HourlyPeriod[];
  note?: string;
}

/** "5 to 10 mph" → 10, "15 mph" → 15. */
export function parseWindMph(s: string | null | undefined): number {
  const nums = (s ?? "").match(/\d+(\.\d+)?/g)?.map(Number) ?? [];
  return nums.length ? Math.max(...nums) : 0;
}

const toF = (value: number, unit: string | undefined) => (unit && /C$/i.test(unit) ? value * 1.8 + 32 : value);

/** Parse the `properties.periods` array of an NWS forecastHourly response. Tolerant of missing fields. */
export function parseNwsHourly(json: unknown): HourlyPeriod[] {
  const periods = (json as { properties?: { periods?: unknown[] } })?.properties?.periods;
  if (!Array.isArray(periods)) throw new Error("No forecast periods");
  return periods
    .map((raw) => {
      const p = raw as Record<string, unknown>;
      const temp = typeof p.temperature === "number" ? p.temperature : (p.temperature as { value?: number })?.value;
      const pop = (p.probabilityOfPrecipitation as { value?: number | null } | undefined)?.value;
      if (typeof temp !== "number" || typeof p.startTime !== "string") return null;
      return {
        startTime: p.startTime,
        endTime: typeof p.endTime === "string" ? p.endTime : p.startTime,
        isDaytime: p.isDaytime !== false,
        temperatureF: Math.round(toF(temp, p.temperatureUnit as string | undefined)),
        windMph: parseWindMph(p.windSpeed as string),
        windDirection: typeof p.windDirection === "string" ? p.windDirection : "",
        precipChance: typeof pop === "number" ? pop : 0,
        shortForecast: typeof p.shortForecast === "string" ? p.shortForecast : "",
      } satisfies HourlyPeriod;
    })
    .filter((p): p is HourlyPeriod => p !== null);
}

/** NWS wind chill (°F, mph). Only defined for T ≤ 50°F and wind ≥ 3 mph; otherwise returns T. */
export function windChillF(tempF: number, windMph: number): number {
  if (tempF > 50 || windMph < 3) return tempF;
  const v = Math.pow(windMph, 0.16);
  return Math.round(35.74 + 0.6215 * tempF - 35.75 * v + 0.4275 * tempF * v);
}

/** The period covering `now`, else the first upcoming one, else the first. */
export function currentPeriod(snap: WeatherSnapshot, now = Date.now()): HourlyPeriod | null {
  const ps = snap.periods;
  return (
    ps.find((p) => Date.parse(p.startTime) <= now && now < Date.parse(p.endTime)) ??
    ps.find((p) => Date.parse(p.startTime) > now) ??
    ps[0] ??
    null
  );
}

export function upcoming(snap: WeatherSnapshot, hours: number, now = Date.now()): HourlyPeriod[] {
  const end = now + hours * 3600_000;
  const list = snap.periods.filter((p) => Date.parse(p.endTime) > now && Date.parse(p.startTime) < end);
  return list.length ? list : snap.periods.slice(0, hours);
}

export interface PodModifier {
  key: "fog" | "rain" | "snow" | "darkness";
  factor: number;
  label: string;
}

const MODIFIERS: Record<PodModifier["key"], number> = { fog: 0.7, rain: 0.8, snow: 0.75, darkness: 0.6 };

export function makeModifier(key: PodModifier["key"]): PodModifier {
  const factor = MODIFIERS[key];
  return { key, factor, label: `${key}: −${Math.round((1 - factor) * 100)}% expected detection` };
}

/** Which conditions in a forecast period lower expected detection. */
export function podModifiers(p: HourlyPeriod | null): PodModifier[] {
  if (!p) return [];
  const f = p.shortForecast.toLowerCase();
  const out: PodModifier[] = [];
  if (/fog|mist|haze/.test(f)) out.push(makeModifier("fog"));
  if (/snow|flurr|sleet|freezing/.test(f)) out.push(makeModifier("snow"));
  else if (/rain|shower|drizzle|thunder/.test(f) || p.precipChance >= 60) out.push(makeModifier("rain"));
  if (!p.isDaytime) out.push(makeModifier("darkness"));
  return out;
}

/** Combined multiplier on expected POD (never below 0.3). */
export function combinedFactor(mods: PodModifier[]): number {
  return Math.max(0.3, mods.reduce((a, m) => a * m.factor, 1));
}

export type ExposureLevel = "low" | "moderate" | "high" | "severe";

/** Plain exposure-risk label. Deliberately never a survival-time estimate. */
export function exposureRisk(p: HourlyPeriod | null): { level: ExposureLevel; reasons: string[] } {
  if (!p) return { level: "moderate", reasons: ["No forecast available"] };
  const wc = windChillF(p.temperatureF, p.windMph);
  const wet = p.precipChance >= 50 || /rain|shower|drizzle|snow|sleet|fog/i.test(p.shortForecast);
  const reasons: string[] = [];
  let level: ExposureLevel = "low";
  const bump = (l: ExposureLevel) => {
    const order: ExposureLevel[] = ["low", "moderate", "high", "severe"];
    if (order.indexOf(l) > order.indexOf(level)) level = l;
  };
  if (wc <= 0) bump("severe");
  else if (wc <= 20) bump("high");
  else if (wc <= 40) bump("moderate");
  if (wc <= 40) reasons.push(`Wind chill ${wc}°F`);
  if (wet && p.temperatureF <= 50) {
    bump(wc <= 32 ? "high" : "moderate");
    reasons.push("Wet and cold — hypothermia risk rises quickly");
  }
  if (!p.isDaytime && p.temperatureF <= 50) {
    bump("moderate");
    reasons.push("Night-time temperatures");
  }
  if (p.temperatureF >= 90) {
    bump("high");
    reasons.push(`Heat ${p.temperatureF}°F`);
  }
  if (!reasons.length) reasons.push("Mild conditions");
  return { level, reasons };
}

export interface SafetyFlag {
  level: "caution" | "warning";
  text: string;
  cells: CellId[];
}

/** Team safety flags over the next hours. These inform the IC; they never block an assignment. */
export function safetyFlags(periods: HourlyPeriod[], terrain: Record<CellId, CellTerrain>): SafetyFlag[] {
  const all = Object.values(terrain);
  const RIDGE = all.filter((t) => t.ridge).map((t) => t.id);
  const EXPOSED = all.filter((t) => t.ridge || t.cover === "alpine").map((t) => t.id);
  if (!periods.length) return [];
  const flags: SafetyFlag[] = [];
  const maxWind = Math.max(...periods.map((p) => p.windMph));
  if (maxWind >= 50) {
    flags.push({
      level: "warning",
      text: `Winds above 50 mph forecast (up to ${maxWind} mph) on ridgeline cells. Consider team safety before assigning.`,
      cells: RIDGE,
    });
  } else if (maxWind >= 25) {
    flags.push({
      level: "caution",
      text: `Forecast winds up to ${maxWind} mph; exposed ridge and alpine cells are often much windier than the point forecast. Consider team safety before assigning.`,
      cells: EXPOSED,
    });
  }
  if (periods.some((p) => /thunder/i.test(p.shortForecast))) {
    flags.push({ level: "warning", text: "Thunderstorms forecast — lightning risk on exposed ridge and alpine cells.", cells: EXPOSED });
  }
  const minWc = Math.min(...periods.map((p) => windChillF(p.temperatureF, p.windMph)));
  if (minWc <= 10) {
    flags.push({ level: "caution", text: `Wind chill down to ${minWc}°F in the next hours — check team gear and rotation.`, cells: [] });
  }
  const darkAt = periods.find((p) => !p.isDaytime);
  if (periods[0]?.isDaytime && darkAt) {
    flags.push({
      level: "caution",
      text: `Darkness from about ${new Date(darkAt.startTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}. Plan headlamps and team return times.`,
      cells: [],
    });
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Refresh policy

export const WEATHER_REFRESH_MS = 20 * 60_000;
/** Retry sooner after a failed refresh. */
export const WEATHER_RETRY_MS = 5 * 60_000;
/** Keep showing the last live forecast after a failed refresh for up to this long. */
export const MAX_STALE_LIVE_MS = 2 * 3600_000;

/**
 * What to show after a refresh. A failed refresh (cached demo weather) does not
 * replace a recent live forecast: slightly old real data beats canned data.
 */
export function mergeWeather(prev: WeatherSnapshot | null, next: WeatherSnapshot, now = Date.now()): WeatherSnapshot {
  if (next.source === "live" || prev?.source !== "live") return next;
  return now - Date.parse(prev.fetchedAt) < MAX_STALE_LIVE_MS ? prev : next;
}

/** Milliseconds until the next scheduled refresh attempt. */
export function nextRefreshDelay(lastAttemptAt: number, failed: boolean, now = Date.now()): number {
  return Math.max(0, lastAttemptAt + (failed ? WEATHER_RETRY_MS : WEATHER_REFRESH_MS) - now);
}

/** "just now", "1 min ago", "23 min ago", "1 h 5 min ago". */
export function formatAge(ms: number): string {
  const min = Math.floor(Math.max(0, ms) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min ago` : `${h} h ago`;
}
