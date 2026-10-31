"use client";

import { useState } from "react";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Steps from "./ui/Steps";
import { useConfirm } from "./ui/ConfirmProvider";
import { quote } from "./ui/styles";
import { DEMO_STEPS, DemoStep } from "@/lib/demo/scenario";
import { BoostLevel, BOOST_FACTORS } from "@/lib/engine/clues";

export default function DemoControls({
  step,
  busy,
  reviewing = false,
  onCallout,
  onReport,
  onClue,
  onPrefillOverride,
  onFound,
  onExit,
}: {
  step: number;
  busy: boolean;
  /** A parsed report is open in the review card; the presenter applies it there. */
  reviewing?: boolean;
  onCallout: (s: Extract<DemoStep, { kind: "callout" }>) => void;
  onReport: (s: Extract<DemoStep, { kind: "report" }>) => void;
  onClue: (s: Extract<DemoStep, { kind: "clue" }>, boost: BoostLevel) => void;
  onPrefillOverride: (s: Extract<DemoStep, { kind: "override" }>) => void;
  onFound: (s: Extract<DemoStep, { kind: "found" }>) => void;
  onExit: () => void;
}) {
  const confirm = useConfirm();
  const [showNote, setShowNote] = useState(false);
  const current = DEMO_STEPS[step];

  const pickBoost = async (s: Extract<DemoStep, { kind: "clue" }>, b: BoostLevel) => {
    // The scripted story needs the suggested boost; guard against a misclick while recording.
    if (
      b !== s.suggestedBoost &&
      !(await confirm({
        title: `Apply a ${b} boost?`,
        content: `The demo script uses a ${s.suggestedBoost} boost. A ${b} boost changes the suggestion ranking later in the story.`,
        okText: `Apply ${b}`,
      }))
    )
      return;
    onClue(s, b);
  };

  return (
    <Card
      title={`Demo scenario · step ${Math.min(step + 1, DEMO_STEPS.length)} of ${DEMO_STEPS.length}`}
      tone="primary"
      size="small"
      extra={
        <Button variant="text" size="sm" onClick={onExit}>
          Exit demo
        </Button>
      }
    >
      <Steps size="sm" current={step} steps={DEMO_STEPS.map((s) => ({ key: s.id, title: s.title }))} />

      {!current ? (
        <p className="mt-3 text-sm text-success">Scenario complete. Export the audit log for the after-action review.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {current.kind === "callout" && (
            <>
              <blockquote className={`${quote} border-primary font-sans`}>☎️ {current.text}</blockquote>
              <Button variant="primary" loading={busy} disabled={reviewing} onClick={() => onCallout(current)}>
                {busy ? "Reading…" : reviewing ? "Review the subject card below, then Confirm" : "Receive call-out → pre-fill subject"}
              </Button>
            </>
          )}
          {current.kind === "report" && (
            <>
              <blockquote className={`${quote} border-primary`}>📻 {current.text}</blockquote>
              <Button variant="primary" loading={busy} disabled={reviewing} onClick={() => onReport(current)}>
                {busy ? "Parsing…" : reviewing ? "Review the parse below, then Apply" : "Receive radio report → parse"}
              </Button>
            </>
          )}
          {current.kind === "clue" && (
            <>
              <blockquote className={`${quote} border-purple`}>🔎 {current.text}</blockquote>
              <div className="text-xs text-fg-2">IC: how much should this clue boost cells near {current.cell}?</div>
              <div className="flex flex-wrap gap-2">
                {(["small", "medium", "large"] as BoostLevel[]).map((b) => (
                  <Button key={b} variant={b === current.suggestedBoost ? "primary" : "default"} onClick={() => pickBoost(current, b)}>
                    {b} ×{BOOST_FACTORS[b]}
                  </Button>
                ))}
              </div>
            </>
          )}
          {current.kind === "override" && (
            <>
              <blockquote className={`${quote} border-purple font-sans`}>👪 {current.tip}</blockquote>
              <Button onClick={() => onPrefillOverride(current)}>
                Prefill assignment: {current.team} → {current.cell}
              </Button>
              <div className="text-xs text-fg-3">Then click Assign in the Operations tab and keep the reason.</div>
            </>
          )}
          {current.kind === "found" && (
            <>
              <blockquote className={`${quote} border-success`}>📻 {current.text}</blockquote>
              <Button variant="primary" onClick={() => onFound(current)}>
                Log subject located
              </Button>
            </>
          )}
          <div className="text-xs text-fg-3">
            <button type="button" className="text-primary-hover hover:underline" onClick={() => setShowNote((v) => !v)}>
              {showNote ? "Hide presenter note" : "Presenter note"}
            </button>
            {showNote && <span className="ml-2 italic">{current.note}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
