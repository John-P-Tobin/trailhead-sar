"use client";

import { useEffect, useState } from "react";
import Alert, { AlertType } from "./ui/Alert";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Descriptions from "./ui/Descriptions";
import Skeleton from "./ui/Skeleton";
import Statistic from "./ui/Statistic";
import Tag from "./ui/Tag";
import { IconRefresh } from "./ui/icons";
import {
  currentPeriod,
  exposureRisk,
  ExposureLevel,
  formatAge,
  nextRefreshDelay,
  podModifiers,
  combinedFactor,
  safetyFlags,
  upcoming,
  WeatherSnapshot,
  windChillF,
  tempAtElevation,
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

function UpdatedLine({ weather, lastAttemptAt, refreshFailed, autoRefresh }: { weather: WeatherSnapshot; lastAttemptAt: number | null; refreshFailed: boolean; autoRefresh: boolean }) {
  const now = useNow(30_000);
  const nextMin = autoRefresh && lastAttemptAt !== null ? Math.ceil(nextRefreshDelay(lastAttemptAt, refreshFailed, now) / 60_000) : null;
  const next = nextMin === null ? "" : nextMin <= 0 ? " · refreshing…" : ` · next refresh in ${nextMin} min`;
  if (weather.source === "live") {
    const age = now - Date.parse(weather.fetchedAt);
    const warn = refreshFailed || age > STALE_MS;
    return (
      <div className={`text-xs ${warn ? "text-warning" : "text-fg-3"}`}>
        Updated {formatAge(age)}
        {refreshFailed && " · last refresh failed, showing the last live forecast"}
        {next}
      </div>
    );
  }
  return (
    <div className="text-xs text-warning">
      Live NWS unavailable{lastAttemptAt !== null && ` · last checked ${formatAge(now - lastAttemptAt)}`}
      {next}
    </div>
  );
}

const RISK_ALERT: Record<ExposureLevel, AlertType> = { low: "success", moderate: "warning", high: "error", severe: "error" };
const RISK_TONE: Record<ExposureLevel, "success" | "warning" | "error"> = { low: "success", moderate: "warning", high: "error", severe: "error" };

const hour = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric" });

export default function WeatherPanel({
  weather,
  loading,
  lastAttemptAt,
  refreshFailed,
  autoRefresh,
  terrain,
  onRefresh,
  onHighlightCells,
  lkpElevationM,
}: {
  weather: WeatherSnapshot | null;
  terrain: Record<string, CellTerrain>;
  loading: boolean;
  lastAttemptAt: number | null;
  refreshFailed: boolean;
  /** True while a search is active; the forecast then refreshes every 20 minutes. */
  autoRefresh: boolean;
  onRefresh: () => void;
  onHighlightCells?: (cells: string[]) => void;
  /** Elevation of the LKP cell (metres) for the lapse-rate estimate. */
  lkpElevationM?: number;
}) {
  const now = currentPeriod(weather ?? { source: "cached", fetchedAt: "", location: "", periods: [] });
  const risk = exposureRisk(now);
  const mods = podModifiers(now);
  const next = weather ? upcoming(weather, 12) : [];
  const flags = safetyFlags(next, terrain);

  return (
    <Card
      title="Weather & exposure"
      size="small"
      extra={
        <>
          {weather?.source === "cached" && <Tag color="warning">Using cached weather</Tag>}
          {weather?.source === "live" && <Tag color="success">Live NWS</Tag>}
          <Button size="sm" variant="text" icon={<IconRefresh width={14} height={14} />} loading={loading} onClick={onRefresh} aria-label="Refresh forecast">
            Refresh
          </Button>
        </>
      }
      footer={
        weather && (
          <>
            {weather.location}. Exposure risk is a plain label from temperature, wind and wetness. Survival time is a judgment for the IC and medical staff, so it is not shown.
            {weather.note && <> ({weather.note})</>}
          </>
        )
      }
    >
      {!weather || !now ? (
        <Skeleton lines={4} />
      ) : (
        <div className="space-y-3">
          <UpdatedLine weather={weather} lastAttemptAt={lastAttemptAt} refreshFailed={refreshFailed} autoRefresh={autoRefresh} />
          <div className="flex flex-wrap items-start gap-4">
            <Statistic label="Now" value={`${now.temperatureF}°F`} hint={now.shortForecast} />
            <Statistic label="Exposure risk" value={risk.level} mono={false} tone={RISK_TONE[risk.level]} size="md" className="ml-auto text-right capitalize" />
          </div>
          <Descriptions
            items={[
              { label: "Wind", value: `${now.windDirection} ${now.windMph} mph` },
              { label: "Wind chill", value: `${windChillF(now.temperatureF, now.windMph)}°F` },
              { label: "Precip chance", value: `${now.precipChance}%` },
              { label: "Daylight", value: now.isDaytime ? "Day" : "Night" },
              ...(weather.elevationM !== undefined
                ? [
                    { label: `Est. at summit (1,917 m)`, value: `${tempAtElevation(now.temperatureF, weather.elevationM, 1917)}°F` },
                    { label: lkpElevationM !== undefined ? `Est. at LKP (${lkpElevationM.toLocaleString()} m)` : "Est. at LKP", value: lkpElevationM !== undefined ? `${tempAtElevation(now.temperatureF, weather.elevationM, lkpElevationM)}°F` : undefined },
                  ]
                : []),
            ]}
          />
          {weather.elevationM !== undefined && (
            <p className="text-xs text-fg-3">Forecast point is at {weather.elevationM.toLocaleString()} m; the summit and LKP figures apply a standard 6.5 °C/km lapse rate and are estimates.</p>
          )}
          <Alert type={RISK_ALERT[risk.level]} compact description={risk.reasons.join(" · ")} />

          {mods.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-fg-2">
              <span>Expected detection ×{combinedFactor(mods).toFixed(2)}:</span>
              {mods.map((m) => (
                <Tag key={m.key} color="info">
                  {m.label}
                </Tag>
              ))}
            </div>
          )}

          {flags.length > 0 && (
            <ul className="space-y-1.5">
              {flags.map((f, i) => (
                <li key={i}>
                  <Alert
                    type={f.level === "warning" ? "error" : "warning"}
                    compact
                    description={f.text}
                    action={
                      onHighlightCells && f.cells.length > 0 ? (
                        <Button size="sm" variant="text" onClick={() => onHighlightCells(f.cells)}>
                          Show {f.cells.length} cells
                        </Button>
                      ) : undefined
                    }
                  />
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-6 gap-1 text-center text-xs text-fg-2">
            {next.slice(0, 12).map((p) => (
              <div key={p.startTime} className={`rounded px-1 py-1 ${p.isDaytime ? "bg-surface-2" : "bg-background"}`}>
                <div>{hour(p.startTime)}</div>
                <div className="font-mono text-fg">{p.temperatureF}°</div>
                <div>{p.windMph} mph</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
