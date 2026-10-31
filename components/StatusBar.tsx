"use client";

import { useEffect, useState } from "react";
import Statistic from "./ui/Statistic";
import Tag, { TagColor } from "./ui/Tag";
import { IconClock } from "./ui/icons";
import { ExposureLevel } from "@/lib/weather";
import { formatMissingFor, hoursSince } from "@/lib/subject";
import { UrgencyBand } from "@/lib/engine/urgency";

const EXPOSURE_COLOR: Record<ExposureLevel, TagColor> = { low: "success", moderate: "warning", high: "error", severe: "error" };
const BAND_COLOR: Record<UrgencyBand, TagColor> = { emergency: "error", measured: "warning", evaluate: "success" };

/** Mission vitals across the top of the console. Everything here is also shown in detail further down. */
export default function StatusBar({
  lkp,
  subjectLabel,
  subjectConfirmed,
  lastSeenAt,
  row,
  rowStart,
  urgency,
  exposure,
  found,
}: {
  lkp: string | null;
  subjectLabel: string;
  subjectConfirmed: boolean;
  lastSeenAt: string | null;
  row: number | null;
  rowStart: number | null;
  urgency: { band: UrgencyBand; label: string; total: number } | null;
  exposure: ExposureLevel | null;
  found: string | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!lkp) return null;
  const rowTone = row === null ? "default" : row >= 0.5 ? "error" : row >= 0.25 ? "warning" : "purple";
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-3 rounded-card border border-line bg-surface px-4 py-3">
      <Statistic size="sm" label="LKP" value={lkp} tone="error" />
      <Statistic
        size="sm"
        mono={false}
        label="Subject"
        value={
          <span className="inline-flex items-center gap-2">
            {subjectLabel}
            {!subjectConfirmed && (
              <Tag color="warning" title="The subject card has not been confirmed; the category's defaults are in use">
                unconfirmed
              </Tag>
            )}
          </span>
        }
      />
      {lastSeenAt && (
        <Statistic
          size="sm"
          label={found ? "Was missing for" : "Missing for"}
          value={
            <span className="inline-flex items-center gap-1.5">
              <IconClock width={14} height={14} className="text-fg-3" />
              {formatMissingFor(hoursSince(lastSeenAt, now))}
            </span>
          }
        />
      )}
      {row !== null && (
        <Statistic size="sm" label="Rest of World" value={`${(row * 100).toFixed(1)}%`} tone={rowTone} hint={rowStart !== null && rowStart !== row ? `from ${(rowStart * 100).toFixed(1)}%` : undefined} />
      )}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {urgency && (
          <Tag color={BAND_COLOR[urgency.band]} title={`Relative urgency ${urgency.total} of 21`}>
            {urgency.label} · {urgency.total}
          </Tag>
        )}
        {exposure && <Tag color={EXPOSURE_COLOR[exposure]}>Exposure {exposure}</Tag>}
        {found && <Tag color="success">Subject located · {found}</Tag>}
      </div>
    </div>
  );
}
