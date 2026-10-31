import Alert from "./ui/Alert";
import Skeleton from "./ui/Skeleton";
import Tag from "./ui/Tag";
import { AppliedReport } from "@/lib/store";

const SOURCE: Record<string, { text: string; color: "primary" | "warning" | "default" }> = {
  claude: { text: "Written by Claude", color: "primary" },
  canned: { text: "Demo fallback explanation (Claude unavailable)", color: "warning" },
  local: { text: "Auto-generated summary (Claude unavailable)", color: "default" },
};

export default function ExplanationCard({ report, loading }: { report: AppliedReport; loading: boolean }) {
  const e = report.explanation;
  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-fg-3">
        <span>
          After {report.team} · <span className="font-mono">{report.cells.join(", ")}</span>
        </span>
        {e && <Tag color={SOURCE[e.source].color}>{SOURCE[e.source].text}</Tag>}
      </div>
      {!e && loading && <Skeleton lines={3} />}
      {e && (
        <>
          <p className="leading-relaxed text-fg">{e.explanation}</p>
          <Alert type="warning" compact title="Least certain assumption" description={e.least_certain_assumption} />
        </>
      )}
    </div>
  );
}
