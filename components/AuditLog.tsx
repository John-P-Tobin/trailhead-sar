"use client";

import { useState } from "react";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Empty from "./ui/Empty";
import Tag, { TagColor } from "./ui/Tag";
import { IconDownload, IconList } from "./ui/icons";
import { AuditEntry, AuditType, exportAuditJson } from "@/lib/audit";
import { SearchState } from "@/lib/store";
import { PROFILES } from "@/lib/profiles";
import { CLAUDE_MODEL } from "@/lib/claude";
import { downloadText, fileStamp } from "@/lib/download";

const TYPE_COLOR: Partial<Record<AuditType, TagColor>> = {
  report: "primary",
  override: "purple",
  clue: "purple",
  prior_edit: "warning",
  urgency: "warning",
  subject: "info",
  export: "success",
  reset: "error",
};

export default function AuditLog({ state }: { state: SearchState }) {
  const [all, setAll] = useState(false);
  const entries: AuditEntry[] = [...state.audit].reverse();
  const shown = all ? entries : entries.slice(0, 10);

  const download = () => {
    const json = exportAuditJson(state.audit, {
      app: "Trailhead SAR planner",
      claude_model: CLAUDE_MODEL,
      lkp: state.lkp,
      profile: PROFILES[state.profileId].label,
      subject: state.subject,
      urgency_overrides: state.urgencyOverrides,
      current_row: state.prob?.row ?? null,
      reports: state.reports,
      clues: state.clues,
      assignments: state.assignments,
      row_history: state.rowHistory,
    });
    downloadText(`trailhead-audit-${fileStamp()}.json`, json, "application/json");
  };

  return (
    <Card
      title={`Audit log (${state.audit.length})`}
      size="small"
      extra={
        <Button size="sm" icon={<IconDownload width={14} height={14} />} onClick={download} disabled={!state.audit.length}>
          Export JSON
        </Button>
      }
    >
      {entries.length === 0 ? (
        <Empty icon={<IconList width={22} height={22} />} title="Nothing logged yet" hint="Every report, AI proposal, IC edit, override and clue is recorded here for the after-action review." />
      ) : (
        <>
          <ol className="space-y-1.5 text-xs">
            {shown.map((e) => (
              <li key={e.id} className="grid grid-cols-[auto_auto_1fr] items-start gap-2">
                <span className="font-mono text-fg-3">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                <Tag color={TYPE_COLOR[e.type] ?? "default"}>{e.type.replace("_", " ")}</Tag>
                <span className="text-fg-2">{e.summary}</span>
              </li>
            ))}
          </ol>
          {entries.length > 10 && (
            <Button variant="link" size="sm" className="mt-2" onClick={() => setAll(!all)}>
              {all ? "Show recent only" : `Show all ${entries.length}`}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
