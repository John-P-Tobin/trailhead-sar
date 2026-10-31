"use client";

import { useEffect, useState } from "react";
import Panel from "./ui/Panel";
import { btnGhost } from "./ui/styles";
import {
  currentPeriod,
  exposureRisk,
  ExposureLevel,
  formatAge,
  nextRefreshDelay,
  podModifiers,
  safetyFlags,
  upcoming,
  WeatherSnapshot,
  windChillF,
} from "@/lib/weather";
import { CellTerrain } from "@/lib/terrain";

/** Live NWS data older than this is flagged as stale. */
const STALE_MS = 45 * 60_000;

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function UpdatedLine({
  weather,
  lastAttemptAt,
  refreshFailed,
  autoRefresh,
}: {
  weather: WeatherSnapshot;
  lastAttemptAt: number | null;
  refreshFailed: boolean;
  autoRefresh: boolean;
}) {
  const now = useNow(30_000);
  const nextMin =
    autoRefresh && lastAttemptAt !== null ? Math.ceil(nextRefreshDelay(lastAttemptAt, refreshFailed, now) / 60_000) : null;
  const next = nextMin === null ? "" : nextMin <= 0 ? " · refreshing…" : ` · next refresh in ${nextMin} min`;

  if (weather.source === "live") {
    const age = now - Date.parse(weather.fetchedAt);
    const warn = refreshFailed || age > STALE_MS;
    return (
      <div className={`text-xs ${warn ? "text-amber-300" : "text-slate-400"}`}>
        Updated {formatAge(age)}
        {refreshFailed && " · last refresh failed, showing the last live forecast"}
        {next}
      </div>
    );
  }
  return (
    <div className="text-xs text-amber-300">
      Live NWS unavailable{lastAttemptAt !== null && ` · last checked ${formatAge(now - lastAttemptAt)}`}
      {next}
    </div>
  );
}

const RISK_STYLE: Record<ExposureLevel, string> = {
  low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  moderate: "bg-yellow-500/15 text-yellow-200 border-yellow-500/40",
  high: "bg-orange-500/20 text-orange-200 border-orange-500/50",
  severe: "bg-red-600/25 text-red-200 border-red-500/60",
};

const hour = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric" });

export default function WeatherPanel({
  weather,
  loading,
  lastAttemptAt,
  refreshFailed,
  autoRefresh,
  terrain,
  onRefresh,
}: {
  weather: WeatherSnapshot | null;
  terrain: Record<string, CellTerrain>;
  loading: boolean;
  lastAttemptAt: number | null;
  refreshFailed: boolean;
  /** True while a search is active; the forecast then refreshes every 20 minutes. */
  autoRefresh: boolean;
  onRefresh: () => void;
}) {
  const now = currentPeriod(weather ?? { source: "cached", fetchedAt: "", location: "", periods: [] });
  const risk = exposureRisk(now);
  const mods = podModifiers(now);
  const next = weather ? upcoming(weather, 12) : [];
  const flags = safetyFlags(next, terrain);

  return (
    <Panel
      title="Weather & urgency"
      right={
        <div className="flex items-center gap-2">
          {weather?.source === "cached" && (
            <span className="rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Using cached weather
            </span>
          )}
          {weather?.source === "live" && (
            <span className="rounded border border-emerald-500/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              Live NWS
            </span>
          )}
          <button className={`${btnGhost} px-2 py-0.5 text-xs`} onClick={onRefresh} disabled={loading}>
            {loading ? "…" : "Refresh"}
          </button>
        </div>
      }
    >
      {!weather || !now ? (
        <div className="space-y-2" aria-busy>
          <div className="h-8 w-1/2 animate-pulse rounded bg-slate-800" />
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-800" />
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <UpdatedLine weather={weather} lastAttemptAt={lastAttemptAt} refreshFailed={refreshFailed} autoRefresh={autoRefresh} />
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <div className="text-2xl font-semibold tabular-nums">{now.temperatureF}°F</div>
              <div className="text-xs text-slate-400">{now.shortForecast}</div>
            </div>
            <div className="text-xs text-slate-300">
              <div>
                Wind {now.windDirection} {now.windMph} mph
              </div>
              <div>Wind chill {windChillF(now.temperatureF, now.windMph)}°F</div>
              <div>Precip {now.precipChance}%</div>
            </div>
            <div className={`ml-auto rounded-md border px-3 py-1.5 text-center ${RISK_STYLE[risk.level]}`}>
              <div className="text-[10px] uppercase tracking-wider opacity-80">Exposure risk</div>
              <div className="text-base font-bold uppercase">{risk.level}</div>
            </div>
          </div>
          <div className="text-xs text-slate-400">{risk.reasons.join(" · ")}</div>

          {mods.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {mods.map((m) => (
                <span key={m.key} className="rounded bg-sky-900/50 px-2 py-0.5 text-xs text-sky-200">
                  {m.label}
                </span>
              ))}
            </div>
          )}

          {flags.length > 0 && (
            <ul className="space-y-1.5">
              {flags.map((f, i) => (
                <li
                  key={i}
                  className={`rounded-md border px-2 py-1.5 text-xs ${
                    f.level === "warning" ? "border-red-500/50 bg-red-950/30 text-red-200" : "border-amber-500/40 bg-amber-950/20 text-amber-200"
                  }`}
                >
                  ⚠ {f.text}
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-6 gap-1 text-center text-[11px] text-slate-400">
            {next.slice(0, 6).map((p) => (
              <div key={p.startTime} className={`rounded px-1 py-1 ${p.isDaytime ? "bg-slate-800/60" : "bg-slate-950"}`}>
                <div>{hour(p.startTime)}</div>
                <div className="font-mono text-slate-200">{p.temperatureF}°</div>
                <div>{p.windMph}mph</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500">
            {weather.location}. Exposure risk is a plain label from temperature, wind and wetness. Survival time is a
            judgment for the IC and medical staff, so it is not shown.
            {weather.note && <> ({weather.note})</>}
          </p>
        </div>
      )}
    </Panel>
  );
}
