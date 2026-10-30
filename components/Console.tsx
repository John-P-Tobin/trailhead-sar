"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import GridMap from "./GridMap";
import MapLegend from "./MapLegend";
import Panel from "./ui/Panel";
import RowIndicator from "./RowIndicator";
import SetupPanel from "./SetupPanel";
import CellInspector from "./CellInspector";
import ReviewCard from "./ReviewCard";
import ReportInput from "./ReportInput";
import ExplanationCard from "./ExplanationCard";
import WeatherPanel from "./WeatherPanel";
import { WeatherSnapshot } from "@/lib/weather";
import { cachedWeather } from "@/lib/demo/weather";
import { explainUpdate, parseReport } from "@/lib/api";
import { buildUpdateSummary, localExplanation } from "@/lib/explain";
import { btnGhost } from "./ui/styles";
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

  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [explaining, setExplaining] = useState<string | null>(null);
  const requested = useRef(new Set<string>());

  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  useEffect(() => saveState(state), [state]);

  const fetchWeather = () =>
    fetch("/api/weather", { signal: AbortSignal.timeout(20_000) })
      .then((r) => r.json() as Promise<WeatherSnapshot>)
      .catch(() => cachedWeather(Date.now(), "Weather route unreachable"))
      .then((snap) => {
        setWeather(snap);
        setWeatherLoading(false);
      });
  const loadWeather = () => {
    setWeatherLoading(true);
    fetchWeather();
  };
  useEffect(() => void fetchWeather(), []);

  // Ask for an explanation of each newly applied report (falls back to a local summary).
  const lastReport = state.reports.at(-1);
  useEffect(() => {
    if (!lastReport || lastReport.explanation || !state.prob || requested.current.has(lastReport.id)) return;
    requested.current.add(lastReport.id);
    const report = lastReport;
    const prob = state.prob;
    setExplaining(report.id);
    explainUpdate(buildUpdateSummary(report, prob)).then((res) => {
      dispatch(
        res.ok
          ? { type: "set_explanation", reportId: report.id, explanation: res.explanation, source: "claude" }
          : { type: "set_explanation", reportId: report.id, explanation: localExplanation(report, prob), source: "local" },
      );
      setExplaining(null);
    });
  }, [lastReport, state.prob]);

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

  const openManual = (rawText?: string) =>
    setDraft({ report: emptyReport(), proposal: null, source: "manual", rawText: rawText || undefined, key: Date.now() });

  const onParse = async (text: string) => {
    setParsing(true);
    setParseError(null);
    const res = await parseReport(text);
    setParsing(false);
    if (res.ok) {
      setDraft({ report: res.report, proposal: res.report, source: "claude", rawText: text, key: Date.now() });
    } else {
      setParseError(`Claude unavailable: ${res.reason} Switched to manual entry — the model works the same.`);
      openManual(text);
    }
  };

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
            <Panel title="Radio report">
              {draft ? (
                <div className="space-y-2">
                  {draft.rawText && (
                    <blockquote className="rounded-md border-l-2 border-slate-600 bg-slate-950/50 px-3 py-2 font-mono text-xs text-slate-300">
                      {draft.rawText}
                    </blockquote>
                  )}
                  {parseError && draft.source === "manual" && (
                    <div className="rounded-md border border-amber-500/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                      {parseError}
                    </div>
                  )}
                  <ReviewCard
                    key={draft.key}
                    draft={draft.report}
                    proposal={draft.proposal}
                    source={draft.source}
                    onChange={(report) => setDraft({ ...draft, report })}
                    onApply={() => {
                      applyDraft();
                      setParseError(null);
                    }}
                    onCancel={() => setDraft(null)}
                  />
                </div>
              ) : (
                <ReportInput busy={parsing} error={null} onParse={onParse} onManual={openManual} />
              )}
            </Panel>
          )}

          <WeatherPanel weather={weather} loading={weatherLoading} onRefresh={loadWeather} />

          {lastReport && (
            <Panel title="Why the map changed">
              <ExplanationCard report={lastReport} loading={explaining === lastReport.id} />
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
