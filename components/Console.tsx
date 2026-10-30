"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import GridMap from "./GridMap";
import MapLegend from "./MapLegend";
import Panel from "./ui/Panel";
import RowIndicator from "./RowIndicator";
import SetupPanel from "./SetupPanel";
import CellInspector from "./CellInspector";
import ReviewCard from "./ReviewCard";
import { btnGhost, btnSecondary } from "./ui/styles";
import { cumulativePodMap, initialState, loadState, reducer, ReportSource, saveState } from "@/lib/store";
import { CellId } from "@/lib/engine/grid";
import { emptyReport, ParsedReport } from "@/lib/schemas";

interface Draft {
  report: ParsedReport;
  proposal: ParsedReport | null;
  source: ReportSource;
  rawText?: string;
  key: number;
}

export default function Console() {
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState() ?? initialState());
  const [placingLkp, setPlacingLkp] = useState(false);
  const [inspect, setInspect] = useState<CellId | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);

  useEffect(() => saveState(state), [state]);

  const cumPod = useMemo(() => cumulativePodMap(state.pods), [state.pods]);
  const needLkp = !state.lkp || placingLkp;

  const onCellClick = (id: CellId) => {
    if (needLkp) {
      dispatch({ type: "set_lkp", cell: id });
      setPlacingLkp(false);
      return;
    }
    if (draft) {
      const cells = draft.report.cells.includes(id)
        ? draft.report.cells.filter((c) => c !== id)
        : [...draft.report.cells, id];
      setDraft({ ...draft, report: { ...draft.report, cells } });
      return;
    }
    setInspect(id === inspect ? null : id);
  };

  const openManual = () =>
    setDraft({ report: emptyReport(), proposal: null, source: "manual", key: Date.now() });

  const applyDraft = () => {
    if (!draft) return;
    dispatch({
      type: "apply_report",
      payload: { confirmed: draft.report, proposal: draft.proposal, source: draft.source, rawText: draft.rawText },
    });
    setDraft(null);
  };

  const selected = draft ? draft.report.cells : inspect ? [inspect] : [];

  return (
    <main className="mx-auto max-w-[1400px] p-3 sm:p-4">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Trailhead <span className="text-slate-500">·</span>{" "}
            <span className="text-slate-300">Search Planner</span>
          </h1>
          <p className="text-xs text-slate-500">Bayesian decision support for the incident commander</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button
            className={btnGhost}
            onClick={() => {
              if (confirm("Reset the whole search? This clears the map, reports and audit log.")) {
                dispatch({ type: "reset" });
                setDraft(null);
                setInspect(null);
              }
            }}
          >
            Reset
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-3">
          <Panel
            title="Search area"
            right={
              needLkp ? (
                <span className="text-xs font-medium text-amber-300">Click a cell to place the last known point</span>
              ) : draft ? (
                <span className="text-xs font-medium text-sky-300">Click cells to add/remove them from the report</span>
              ) : null
            }
          >
            <GridMap
              poa={state.prob?.cells}
              cumulativePod={cumPod}
              lkp={state.lkp}
              selected={selected}
              onCellClick={onCellClick}
            />
            <div className="mt-2">
              <MapLegend />
            </div>
          </Panel>
        </div>

        <div className="space-y-3">
          {state.prob && (
            <Panel title="Rest of World">
              <RowIndicator row={state.prob.row} history={state.rowHistory} />
              <p className="mt-2 text-xs text-slate-500">
                Probability the subject is outside the grid. It grows as the grid is searched without a find. The app
                never recommends ending or expanding the search — that call stays with people.
              </p>
            </Panel>
          )}

          <SetupPanel
            lkp={state.lkp}
            profileId={state.profileId}
            row={state.prob?.row ?? null}
            started={state.started}
            placingLkp={placingLkp}
            onTogglePlaceLkp={() => setPlacingLkp((v) => !v)}
            onProfile={(p) => dispatch({ type: "set_profile", profileId: p })}
            onRow={(v) => dispatch({ type: "set_row", value: v })}
          />

          {state.prob && (
            <Panel
              title="Radio report"
              right={
                !draft && (
                  <button className={btnSecondary} onClick={openManual}>
                    Manual entry
                  </button>
                )
              }
            >
              {draft ? (
                <ReviewCard
                  key={draft.key}
                  draft={draft.report}
                  proposal={draft.proposal}
                  source={draft.source}
                  onChange={(report) => setDraft({ ...draft, report })}
                  onApply={applyDraft}
                  onCancel={() => setDraft(null)}
                />
              ) : (
                <p className="text-sm text-slate-400">
                  Enter which cells a team searched and the POD. Nothing changes until you click Apply.
                </p>
              )}
            </Panel>
          )}

          {inspect && state.prob && !draft && (
            <CellInspector
              key={`${inspect}-${state.prob.cells[inspect]}`}
              cell={inspect}
              poa={state.prob.cells[inspect]}
              cumPod={cumPod[inspect] ?? 0}
              sweeps={state.pods[inspect]?.length ?? 0}
              editable={!state.started}
              onEdit={(value) => dispatch({ type: "edit_cell_poa", cell: inspect, value })}
            />
          )}

          {state.reports.length > 0 && (
            <Panel title="Applied reports">
              <ul className="space-y-2 text-sm">
                {[...state.reports].reverse().map((r) => (
                  <li key={r.id} className="rounded-md bg-slate-950/50 px-2 py-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">{r.team}</span>
                      <span className="text-xs text-slate-500">{new Date(r.at).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-xs text-slate-400">
                      <span className="font-mono">{r.cells.join(", ")}</span> · POD {(r.pod * 100).toFixed(0)}% · ROW{" "}
                      {(r.rowBefore * 100).toFixed(1)}% → {(r.rowAfter * 100).toFixed(1)}%
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>
    </main>
  );
}
