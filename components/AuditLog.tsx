"use client";

import { useState } from "react";
import Panel from "./ui/Panel";
import { btnSecondary } from "./ui/styles";
import { AuditEntry, AuditType, exportAuditJson } from "@/lib/audit";
import { SearchState } from "@/lib/store";
import { PROFILES } from "@/lib/profiles";
import { CLAUDE_MODEL } from "@/lib/claude";

const TYPE_STYLE: Partial<Record<AuditType, string>> = {
  report: "text-sky-300",
  override: "text-violet-300",
  clue: "text-fuchsia-300",
  prior_edit: "text-amber-300",
  explanation: "text-slate-400",
};

export default function AuditLog({ state }: { state: SearchState }) {
  const [all, setAll] = useState(false);
  const entries: AuditEntry[] = [...state.audit].reverse();
  const shown = all ? entries : entries.slice(0, 8);

  const download = () => {
    const json = exportAuditJson(state.audit, {
      app: "Trailhead SAR planner",
      claude_model: CLAUDE_MODEL,
      lkp: state.lkp,
      profile: PROFILES[state.profileId].label,
      current_row: state.prob?.row ?? null,
      reports: state.reports,
      clues: state.clues,
      assignments: state.assignments,
      row_history: state.rowHistory,
    });
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `trailhead-audit-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel
      title={`Audit log (${state.audit.length})`}
      right={
        <button className={`${btnSecondary} px-2 py-0.5 text-xs`} onClick={download} disabled={!state.audit.length}>
          Export JSON
        </button>
      }
    >
      {entries.length === 0 ? (
        <p className="text-sm text-slate-400">Every report, AI proposal, IC edit, override and clue is recorded here.</p>
      ) : (
        <>
          <ol className="space-y-1 text-xs">
            {shown.map((e) => (
              <li key={e.id} className="grid grid-cols-[auto_auto_1fr] gap-2">
                <span className="font-mono text-slate-500">
                  {new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className={`uppercase ${TYPE_STYLE[e.type] ?? "text-slate-300"}`}>{e.type.replace("_", " ")}</span>
                <span className="text-slate-300">{e.summary}</span>
              </li>
            ))}
          </ol>
          {entries.length > 8 && (
            <button className="mt-2 text-xs text-sky-300 hover:underline" onClick={() => setAll(!all)}>
              {all ? "Show recent only" : `Show all ${entries.length}`}
            </button>
          )}
        </>
      )}
    </Panel>
  );
}
