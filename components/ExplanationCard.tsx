import { AppliedReport } from "@/lib/store";

const SOURCE: Record<string, string> = {
  claude: "Written by Claude",
  canned: "Demo fallback explanation (Claude unavailable)",
  local: "Auto-generated summary (Claude unavailable)",
};

export default function ExplanationCard({ report, loading }: { report: AppliedReport; loading: boolean }) {
  const e = report.explanation;
  return (
    <div className="space-y-2 text-sm">
      <div className="text-xs text-slate-500">
        After {report.team} · {report.cells.join(", ")}
      </div>
      {!e && loading && (
        <div className="space-y-2" aria-busy>
          <div className="h-3 w-full animate-pulse rounded bg-slate-800" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-slate-800" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-800" />
        </div>
      )}
      {e && (
        <>
          <p className="leading-relaxed text-slate-200">{e.explanation}</p>
          <p className="rounded-md border border-amber-600/40 bg-amber-950/20 px-2 py-1.5 text-xs text-amber-200">
            <span className="font-semibold">Least certain assumption: </span>
            {e.least_certain_assumption}
          </p>
          <div className="text-[11px] text-slate-500">{SOURCE[e.source]}</div>
        </>
      )}
    </div>
  );
}
