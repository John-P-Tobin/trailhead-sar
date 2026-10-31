"use client";

import { useState } from "react";
import { niceDomain, scaleLinear } from "@/lib/chartScale";
import { HourlyPeriod } from "@/lib/weather";

// Two small single-series panels (temperature line, wind bars) over the next hours.
// One axis per panel; night hours shaded; hover shows the hour's values.

const W = 360;
const PAD = { l: 30, r: 8 };
const hourLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric" }).replace(" ", "").toLowerCase();

export default function ForecastChart({ periods, nowMs }: { periods: HourlyPeriod[]; nowMs: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = periods.length;
  if (n === 0) return null;
  const x = scaleLinear([0, Math.max(n - 1, 1)], [PAD.l, W - PAD.r]);
  const slot = (W - PAD.l - PAD.r) / Math.max(n, 1);

  const tempDomain = niceDomain(periods.map((p) => p.temperatureF));
  const windDomain: [number, number] = [0, niceDomain(periods.map((p) => p.windMph), 0, 10)[1]];
  const H1 = 64;
  const H2 = 44;
  const yT = scaleLinear(tempDomain, [H1 - 14, 6]);
  const yW = scaleLinear(windDomain, [H2 - 2, 2]);
  const tempPath = periods.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${yT(p.temperatureF).toFixed(1)}`).join("");
  const nowIdx = periods.findIndex((p) => Date.parse(p.startTime) <= nowMs && nowMs < Date.parse(p.endTime));
  const h = hover ?? (nowIdx >= 0 ? nowIdx : 0);
  const hp = periods[h];

  const nightBands = periods.map((p, i) =>
    p.isDaytime ? null : <rect key={`n${i}`} x={x(i) - slot / 2} y={0} width={slot} height="100%" fill="var(--color-surface-2)" />,
  );
  const hitZones = (height: number) =>
    periods.map((_, i) => (
      <rect key={`h${i}`} x={x(i) - slot / 2} y={0} width={slot} height={height} fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
    ));

  return (
    <div className="space-y-1" role="img" aria-label={`Forecast for the next ${n} hours: temperatures ${tempDomain[0]} to ${tempDomain[1]} °F, wind up to ${windDomain[1]} mph.`}>
      <div className="flex items-baseline justify-between text-xs text-fg-2">
        <span>
          Next {n} h · <span className="text-fg">{hourLabel(hp.startTime)}</span>: {hp.temperatureF}°F, wind {hp.windMph} mph, precip {hp.precipChance}%
          {!hp.isDaytime && " · night"}
        </span>
        <span className="text-fg-3">hover for hours</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H1}`} className="block h-16 w-full" aria-hidden>
        {nightBands}
        {[tempDomain[0], tempDomain[1]].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={yT(v)} y2={yT(v)} stroke="var(--color-line)" strokeWidth={1} />
            <text x={PAD.l - 4} y={yT(v) + 3} textAnchor="end" fontSize={9} fill="var(--color-fg-3)">
              {v}°
            </text>
          </g>
        ))}
        <path d={tempPath} fill="none" stroke="var(--color-primary-hover)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {nowIdx >= 0 && <line x1={x(nowIdx)} x2={x(nowIdx)} y1={2} y2={H1 - 14} stroke="var(--color-warning)" strokeWidth={1} strokeDasharray="2 3" />}
        <circle cx={x(h)} cy={yT(hp.temperatureF)} r={4} fill="var(--color-primary-hover)" stroke="var(--color-surface)" strokeWidth={2} />
        <text x={x(h)} y={yT(hp.temperatureF) - 7} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--color-fg)">
          {hp.temperatureF}°
        </text>
        {periods.map((p, i) =>
          i % 3 === 0 ? (
            <text key={`t${i}`} x={x(i)} y={H1 - 3} textAnchor="middle" fontSize={9} fill="var(--color-fg-3)">
              {hourLabel(p.startTime)}
            </text>
          ) : null,
        )}
        {hitZones(H1)}
      </svg>
      <svg viewBox={`0 0 ${W} ${H2}`} className="block h-11 w-full" aria-hidden>
        {nightBands}
        <text x={PAD.l - 4} y={10} textAnchor="end" fontSize={9} fill="var(--color-fg-3)">
          {windDomain[1]}
        </text>
        <text x={PAD.l - 4} y={H2 - 2} textAnchor="end" fontSize={9} fill="var(--color-fg-3)">
          mph
        </text>
        {periods.map((p, i) => {
          const bw = Math.max(slot - 2, 2);
          const top = yW(p.windMph);
          return <rect key={`w${i}`} x={x(i) - bw / 2} y={top} width={bw} height={Math.max(H2 - 2 - top, 0)} rx={2} fill={i === h ? "var(--color-primary-hover)" : "var(--color-fg-3)"} opacity={i === h ? 1 : 0.6} />;
        })}
        {hitZones(H2)}
      </svg>
    </div>
  );
}
