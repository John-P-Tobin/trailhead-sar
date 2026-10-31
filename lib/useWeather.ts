import { useCallback, useEffect, useState } from "react";
import { cachedWeather } from "./demo/weather";
import { mergeWeather, nextRefreshDelay, WeatherSnapshot } from "./weather";

export interface WeatherState {
  weather: WeatherSnapshot | null;
  loading: boolean;
  /** When the app last asked for weather (ms since epoch). */
  lastAttemptAt: number | null;
  /** True if the last attempt did not return live NWS data. */
  refreshFailed: boolean;
  refresh: () => void;
}

const isSnapshot = (x: unknown): x is WeatherSnapshot =>
  !!x && Array.isArray((x as WeatherSnapshot).periods) && typeof (x as WeatherSnapshot).fetchedAt === "string";

/** Loads weather on mount and, while `autoRefresh` is on, refreshes it every 20 minutes. */
export function useWeather(autoRefresh: boolean): WeatherState {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState<{ at: number; failed: boolean } | null>(null);

  const load = useCallback(
    (fresh: boolean) =>
      fetch(`/api/weather${fresh ? "?fresh=1" : ""}`, { signal: AbortSignal.timeout(20_000) })
        .then((r) => r.json())
        .then((j: unknown) => (isSnapshot(j) ? j : cachedWeather(Date.now(), "Weather route returned an unexpected response")))
        .catch(() => cachedWeather(Date.now(), "Weather route unreachable"))
        .then((next) => {
          setWeather((prev) => mergeWeather(prev, next));
          setAttempt({ at: Date.now(), failed: next.source !== "live" });
          setLoading(false);
        }),
    [],
  );

  useEffect(() => void load(false), [load]);

  // During a search: refresh 20 min after the last attempt (5 min after a failure).
  useEffect(() => {
    if (!autoRefresh || !attempt) return;
    const timer = setTimeout(() => {
      setLoading(true);
      load(false);
    }, nextRefreshDelay(attempt.at, attempt.failed));
    return () => clearTimeout(timer);
  }, [autoRefresh, attempt, load]);

  const refresh = useCallback(() => {
    setLoading(true);
    load(true);
  }, [load]);

  return { weather, loading, lastAttemptAt: attempt?.at ?? null, refreshFailed: attempt?.failed ?? false, refresh };
}
