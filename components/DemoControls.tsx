"use client";

import Panel from "./ui/Panel";
import { btnPrimary, btnSecondary } from "./ui/styles";
import { DEMO_STEPS, DEMO_SUBJECT, DemoStep } from "@/lib/demo/scenario";
import { BoostLevel, BOOST_FACTORS } from "@/lib/engine/clues";

export default function DemoControls({
  step,
  busy,
  onReport,
  onClue,
  onPrefillOverride,
  onFound,
  onExit,
}: {
  step: number;
  busy: boolean;
  onReport: (s: Extract<DemoStep, { kind: "report" }>) => void;
  onClue: (s: Extract<DemoStep, { kind: "clue" }>, boost: BoostLevel) => void;
  onPrefillOverride: (s: Extract<DemoStep, { kind: "override" }>) => void;
  onFound: (s: Extract<DemoStep, { kind: "found" }>) => void;
  onExit: () => void;
}) {
  const current = DEMO_STEPS[step];
  return (
    <Panel
      title={`Demo scenario · step ${Math.min(step + 1, DEMO_STEPS.length)} of ${DEMO_STEPS.length}`}
      className="border-sky-700/60"
      right={
        <button className="text-xs text-slate-400 hover:text-slate-200" onClick={onExit}>
          Exit demo
        </button>
      }
    >
      <p className="mb-2 text-xs text-slate-400">{DEMO_SUBJECT}</p>
      <ol className="mb-3 flex flex-wrap gap-1 text-[11px]">
        {DEMO_STEPS.map((s, i) => (
          <li
            key={s.id}
            className={`rounded px-1.5 py-0.5 ${
              i < step ? "bg-slate-800 text-slate-500 line-through" : i === step ? "bg-sky-700 text-white" : "bg-slate-800 text-slate-400"
            }`}
          >
            {i + 1}. {s.title}
          </li>
        ))}
      </ol>

      {!current ? (
        <p className="text-sm text-emerald-300">Scenario complete. Export the audit log for the after-action review.</p>
      ) : (
        <div className="space-y-2">
          {current.kind === "report" && (
            <>
              <blockquote className="rounded-md border-l-2 border-sky-500 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-200">
                📻 {current.text}
              </blockquote>
              <button className={btnPrimary} disabled={busy} onClick={() => onReport(current)}>
                {busy ? "Parsing…" : "Receive radio report → parse"}
              </button>
            </>
          )}
          {current.kind === "clue" && (
            <>
              <blockquote className="rounded-md border-l-2 border-fuchsia-500 bg-slate-950/60 px-3 py-2 text-xs text-slate-200">
                🔎 {current.text}
              </blockquote>
              <div className="text-xs text-slate-400">IC: how much should this clue boost cells near {current.cell}?</div>
              <div className="flex flex-wrap gap-2">
                {(["small", "medium", "large"] as BoostLevel[]).map((b) => (
                  <button
                    key={b}
                    className={b === current.suggestedBoost ? btnPrimary : btnSecondary}
                    onClick={() => {
                      // The scripted story needs the suggested boost; guard against a misclick while recording.
                      if (
                        b !== current.suggestedBoost &&
                        !window.confirm(`The demo script uses a ${current.suggestedBoost} boost. A ${b} boost changes the suggestion ranking later in the story. Apply ${b} anyway?`)
                      )
                        return;
                      onClue(current, b);
                    }}
                  >
                    {b} ×{BOOST_FACTORS[b]}
                  </button>
                ))}
              </div>
            </>
          )}
          {current.kind === "override" && (
            <>
              <blockquote className="rounded-md border-l-2 border-violet-500 bg-slate-950/60 px-3 py-2 text-xs text-slate-200">
                👪 {current.tip}
              </blockquote>
              <button className={btnSecondary} onClick={() => onPrefillOverride(current)}>
                Prefill assignment: {current.team} → {current.cell}
              </button>
              <div className="text-[11px] text-slate-500">Then click Assign in the Suggestions panel and give a reason.</div>
            </>
          )}
          {current.kind === "found" && (
            <>
              <blockquote className="rounded-md border-l-2 border-emerald-500 bg-slate-950/60 px-3 py-2 font-mono text-xs text-slate-200">
                📻 {current.text}
              </blockquote>
              <button className={btnPrimary} onClick={() => onFound(current)}>
                Log subject located
              </button>
            </>
          )}
          <p className="text-[11px] italic text-slate-500">Presenter note: {current.note}</p>
        </div>
      )}
    </Panel>
  );
}
