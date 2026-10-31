"use client";

import Card from "./ui/Card";
import Segmented from "./ui/Segmented";
import Statistic from "./ui/Statistic";
import Tag, { TagColor } from "./ui/Tag";
import Tooltip from "./ui/Tooltip";
import { IconInfo } from "./ui/icons";
import { Urgency, URGENCY_FACTORS, UrgencyBand, UrgencyKey, UrgencyScore } from "@/lib/engine/urgency";

const BAND_COLOR: Record<UrgencyBand, TagColor> = { emergency: "error", measured: "warning", evaluate: "success" };
const BAND_TONE: Record<UrgencyBand, "error" | "warning" | "success"> = { emergency: "error", measured: "warning", evaluate: "success" };

/** The seven-factor relative urgency chart. The app proposes each score; the IC can set any of them. */
export default function UrgencyCard({ urgency, onOverride }: { urgency: Urgency; onOverride: (key: UrgencyKey, score: UrgencyScore, proposed: UrgencyScore) => void }) {
  return (
    <Card
      title="Relative urgency"
      size="small"
      extra={<Tag color={BAND_COLOR[urgency.band]}>{urgency.bandLabel}</Tag>}
      footer="Standard SAR urgency chart: seven factors scored 1 (most urgent) to 3, total 7–21. Scores are proposed from the subject form, forecast and terrain; any you change is logged. This is a response-urgency rating, not a survival estimate."
    >
      <div className="flex items-start gap-4">
        <Statistic label="Total" value={urgency.total} suffix="/ 21" tone={BAND_TONE[urgency.band]} size="lg" />
        <div className="text-xs leading-relaxed text-fg-2">
          <div>7–11 Emergency response</div>
          <div>12–16 Measured response</div>
          <div>17–21 Evaluate and investigate</div>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-line">
        {urgency.factors.map((f) => {
          const meta = URGENCY_FACTORS.find((x) => x.key === f.key)!;
          const proposed = f.proposed ?? f.score;
          return (
            <li key={f.key} className="flex items-center gap-3 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm text-fg">
                  {f.label}
                  <Tooltip content={meta.hint}>
                    <IconInfo width={13} height={13} className="text-fg-3" />
                  </Tooltip>
                  {f.overridden && <Tag color="purple">IC set</Tag>}
                </div>
                <div className="truncate text-xs text-fg-3">{f.reason}</div>
              </div>
              <Segmented
                size="sm"
                aria-label={`${f.label} score`}
                value={String(f.score)}
                options={[
                  { value: "1", label: "1" },
                  { value: "2", label: "2" },
                  { value: "3", label: "3" },
                ]}
                onChange={(v) => onOverride(f.key, Number(v) as UrgencyScore, proposed)}
              />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
