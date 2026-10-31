import { describe, expect, it } from "vitest";
import {
  formatAge,
  MAX_STALE_LIVE_MS,
  mergeWeather,
  nextRefreshDelay,
  WEATHER_REFRESH_MS,
  WEATHER_RETRY_MS,
  WeatherSnapshot,
} from "@/lib/weather";
import { cachedWeather } from "@/lib/demo/weather";

const NOW = Date.parse("2026-10-31T06:00:00Z");
const live = (ageMs: number): WeatherSnapshot => ({
  ...cachedWeather(NOW),
  source: "live",
  location: "test",
  fetchedAt: new Date(NOW - ageMs).toISOString(),
});

describe("weather refresh policy", () => {
  it("refreshes 20 minutes after a successful attempt, 5 after a failure", () => {
    expect(WEATHER_REFRESH_MS).toBe(20 * 60_000);
    expect(nextRefreshDelay(NOW, false, NOW)).toBe(WEATHER_REFRESH_MS);
    expect(nextRefreshDelay(NOW, true, NOW)).toBe(WEATHER_RETRY_MS);
    expect(nextRefreshDelay(NOW - 25 * 60_000, false, NOW)).toBe(0); // overdue → now
  });

  it("new live data always replaces what is shown", () => {
    expect(mergeWeather(live(30 * 60_000), live(0), NOW)).toEqual(live(0));
    expect(mergeWeather(cachedWeather(NOW), live(0), NOW).source).toBe("live");
  });

  it("a failed refresh keeps a recent live forecast instead of canned weather", () => {
    const prev = live(25 * 60_000);
    expect(mergeWeather(prev, cachedWeather(NOW), NOW)).toBe(prev);
  });

  it("falls back to cached weather once the live forecast is too old, or if there never was one", () => {
    expect(mergeWeather(live(MAX_STALE_LIVE_MS + 60_000), cachedWeather(NOW), NOW).source).toBe("cached");
    expect(mergeWeather(null, cachedWeather(NOW), NOW).source).toBe("cached");
  });

  it("formats ages for the 'updated X min ago' line", () => {
    expect(formatAge(20_000)).toBe("just now");
    expect(formatAge(60_000)).toBe("1 min ago");
    expect(formatAge(23 * 60_000 + 5_000)).toBe("23 min ago");
    expect(formatAge(65 * 60_000)).toBe("1 h 5 min ago");
    expect(formatAge(120 * 60_000)).toBe("2 h ago");
    expect(formatAge(-5_000)).toBe("just now");
  });
});
