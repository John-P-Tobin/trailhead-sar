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
import SuggestionsPanel from "./SuggestionsPanel";
import CluePanel from "./CluePanel";
import AuditLog from "./AuditLog";
import DemoControls from "./DemoControls";
import WelcomeCard from "./WelcomeCard";
import SummitCard from "./SummitCard";
import TerrainBadge from "./TerrainBadge";
import { DEMO_LKP, DEMO_PROFILE, DEMO_STEPS } from "@/lib/demo/scenario";
import { combinedFactor, currentPeriod, podModifiers, safetyFlags, upcoming } from "@/lib/weather";
import { useWeather } from "@/lib/useWeather";
import { rankCells } from "@/lib/engine/rank";
import { explainUpdate, parseReport } from "@/lib/api";
import { buildUpdateSummary, localExplanation } from "@/lib/explain";
import { btnGhost, btnSecondary } from "./ui/styles";
import { cumulativePodMap, initialState, loadState, reducer, ReportSource, saveState } from "@/lib/store";
import { CellId } from "@/lib/engine/grid";
import { emptyReport, ParsedReport } from "@/lib/schemas";
import { describeCell, promptFeatures, snapshotOf, STYLIZED_TERRAIN, TerrainModel } from "@/lib/terrain";
import { featuresForSnapshot, loadBundledTerrain, loadLiveTerrain } from "@/lib/terrainClient";

interface Draft {
  report: ParsedReport;
  proposal: ParsedReport | null;
  source: ReportSource;
  rawText?: string;
  key: number;
  demo?: boolean;
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

  const [prefill, setPrefill] = useState<{ team: string; cell: string; reason: string; key: number } | null>(null);
  useEffect(() => saveState(state), [state]);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Terrain: the store holds the cells the model uses; this holds the drawable features.
  const [terrainModel, setTerrainModel] = useState<TerrainModel>(STYLIZED_TERRAIN);
  const [terrainLoading, setTerrainLoading] = useState(false);
  const [terrainNote, setTerrainNote] = useState<string | null>(null);

  const applyTerrain = (model: TerrainModel) => {
    setTerrainModel(model);
    dispatch({ type: "set_terrain", terrain: snapshotOf(model) });
  };

  // On load: before a search starts, use real terrain (cached live OSM for this grid, else the
  // bundled file). A search in progress keeps the cells it started with; only the drawing is restored.
  useEffect(() => {
    const s = stateRef.current;
    featuresForSnapshot(s.terrain).then(async (model) => {
      if (s.started) {
        if (model) setTerrainModel(model);
        return;
      }
      const real = model && model.source !== "stylized" ? model : await loadBundledTerrain();
      if (real && !stateRef.current.started) applyTerrain(real);
    });
  }, []);

  /** After the LKP is placed: fetch live OSM for the grid (cache first). The bundled terrain stays if it fails. */
  const fetchLiveTerrain = async () => {
    const bbox = stateRef.current.terrain.bbox;
    setTerrainLoading(true);
    setTerrainNote(null);
    const res = await loadLiveTerrain(bbox);
    setTerrainLoading(false);
    const s = stateRef.current;
    if (!res.model) {
      setTerrainNote(`Live OSM unavailable: ${res.reason} Using ${s.terrain.label} terrain.`);
    } else if (s.started || s.demo) {
      setTerrainNote(`Live OSM arrived after the search started, so the ${s.terrain.label} terrain was kept to keep the model consistent.`);
    } else {
      applyTerrain(res.model);
    }
  };

  // Weather auto-refreshes every 20 minutes while a search is active.
  const searchActive = !!state.lkp && !state.found;
  const { weather, loading: weatherLoading, lastAttemptAt, refreshFailed, refresh: refreshWeather } = useWeather(searchActive);

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
      if (!state.demo && state.terrain.source !== "live") fetchLiveTerrain();
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

  const onParse = async (text: string, canned?: ParsedReport) => {
    setParsing(true);
    setParseError(null);
    const res = await parseReport(text, promptFeatures(terrainModel.features));
    setParsing(false);
    const demo = !!canned;
    if (res.ok) {
      setDraft({ report: res.report, proposal: res.report, source: "claude", rawText: text, key: Date.now(), demo });
    } else if (canned) {
      setParseError(`Claude unavailable: ${res.reason} Using the demo's canned parse — review it like any proposal.`);
      setDraft({ report: canned, proposal: canned, source: "canned", rawText: text, key: Date.now(), demo });
    } else {
      setParseError(`Claude unavailable: ${res.reason} Switched to manual entry — the model works the same.`);
      openManual(text);
    }
  };

  const resetAll = () => {
    if (!confirm("Reset the whole search? This clears the map, reports and audit log.")) return;
    dispatch({ type: "reset" });
    requested.current.clear();
    setPrefill(null);
    setDraft(null);
    setInspect(null);
    setParseError(null);
  };

  const demoStep = state.demo ? DEMO_STEPS[state.demoStep] : undefined;

  // Demo mode always uses the bundled terrain, so the video never depends on a live API.
  const loadDemo = async () => {
    if (state.audit.length > 1 && !confirm("Load the demo scenario? This replaces the current search.")) return;
    const bundled = await loadBundledTerrain();
    const model = bundled ?? STYLIZED_TERRAIN;
    setTerrainModel(model);
    setTerrainNote(bundled ? null : "The bundled terrain failed to load; the demo story is tuned for it.");
    dispatch({ type: "demo_load", lkp: DEMO_LKP, profileId: DEMO_PROFILE, terrain: snapshotOf(model) });
    requested.current.clear();
    setDraft(null);
    setInspect(null);
    setPrefill(null);
    setParseError(null);
  };

  const applyDraft = () => {
    if (!draft) return;
    dispatch({
      type: "apply_report",
      payload: { confirmed: draft.report, proposal: draft.proposal, source: draft.source, rawText: draft.rawText },
    });
    if (draft.demo) dispatch({ type: "demo_advance" });
    setDraft(null);
  };

  const selected = draft ? draft.report.cells : inspect ? [inspect] : [];

  const modifiers = useMemo(() => podModifiers(weather ? currentPeriod(weather) : null), [weather]);
  const weatherFactor = combinedFactor(modifiers);
  const flaggedCells = useMemo(
    () => new Set(weather ? safetyFlags(upcoming(weather, 12), state.terrain.cells).flatMap((f) => f.cells) : []),
    [weather, state.terrain.cells],
  );
  const suggestions = useMemo(
    () => (state.prob ? rankCells(state.prob, cumPod, state.terrain.cells, weatherFactor) : []),
    [state.prob, cumPod, state.terrain.cells, weatherFactor],
  );
  // Cells come from the store (what the model uses); lines and shapes from the loaded terrain.
  const mapTerrain = {
    cells: state.terrain.cells,
    bbox: state.terrain.bbox,
    osm: state.terrain.source !== "stylized",
    features: terrainModel.features,
  };

  return (
    <main className="mx-auto max-w-[1400px] p-3 pb-16 sm:p-4 sm:pb-16">
      <header className="mb-3 flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Trailhead <span className="text-slate-500">·</span>{" "}
            <span className="text-slate-300">Search Planner</span>
          </h1>
          <p className="text-xs text-slate-500">
            Bayesian decision support for the incident commander · prototype with illustrative priors
          </p>
        </div>
        <div className="ml-auto flex gap-2">
          <button className={btnSecondary} onClick={loadDemo}>
            Load demo scenario
          </button>
          <button className={btnGhost} onClick={resetAll}>
            Reset
          </button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px] lg:grid-rows-[auto_1fr]">
        <div className="lg:col-start-1 lg:row-start-1">
          <Panel
            title="Search area"
            right={
              <div className="flex flex-wrap items-center justify-end gap-2">
                {needLkp ? (
                  <span className="text-xs font-medium text-amber-300">Click a cell to place the last known point</span>
                ) : draft ? (
                  <span className="text-xs font-medium text-sky-300">Click cells to add/remove them from the report</span>
                ) : null}
                <TerrainBadge
                  source={state.terrain.source}
                  label={state.terrain.label}
                  fetchedAt={state.terrain.fetchedAt}
                  loading={terrainLoading}
                />
              </div>
            }
          >
            <GridMap
              terrain={mapTerrain}
              poa={state.prob?.cells}
              cumulativePod={cumPod}
              lkp={state.lkp}
              selected={selected}
              suggested={draft ? [] : suggestions.map((s) => s.cell)}
              clueCells={state.clues.map((c) => c.cell)}
              found={state.found?.cell ?? null}
              onCellClick={onCellClick}
            />
            {terrainNote && <p className="mt-2 text-xs text-amber-300">{terrainNote}</p>}
            <div className="mt-2">
              <MapLegend kinds={new Set(mapTerrain.features.map((f) => f.kind))} />
            </div>
          </Panel>
        </div>

        <div className="space-y-3 lg:col-start-2 lg:row-span-2 lg:row-start-1">
          {!state.lkp && <WelcomeCard onDemo={loadDemo} />}

          {state.found && (
            <section className="rounded-lg border border-emerald-500/60 bg-emerald-950/40 p-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">Subject located</div>
              <div className="mt-1 text-sm text-emerald-100">
                <span className="font-mono font-semibold">{state.found.cell}</span> — {state.found.text}
              </div>
              {(() => {
                const a = [...state.assignments].reverse().find((x) => x.cell === state.found!.cell);
                return a ? (
                  <div className="mt-1 text-xs text-emerald-200/80">
                    Model: suggestion #{a.suggestedRank ?? "—"} when assigned · IC: {a.override ? `override${a.reason ? ` (“${a.reason}”)` : ""}` : "followed top suggestion"}
                  </div>
                ) : null;
              })()}
            </section>
          )}

          {state.demo && (
            <DemoControls
              step={state.demoStep}
              busy={parsing || !!draft}
              onReport={(s) => onParse(s.text, s.canned)}
              onClue={(s, boost) => {
                dispatch({ type: "add_clue", text: s.text, cell: s.cell, radius: s.radius, boost });
                dispatch({ type: "demo_advance" });
              }}
              onPrefillOverride={(s) => setPrefill({ team: s.team, cell: s.cell, reason: s.reason, key: Date.now() })}
              onFound={(s) => {
                dispatch({ type: "mark_found", cell: s.cell, text: s.text });
                dispatch({ type: "demo_advance" });
              }}
              onExit={resetAll}
            />
          )}

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
            lkpInfo={state.lkp ? describeCell(state.terrain.cells[state.lkp]) : undefined}
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

          <WeatherPanel
            weather={weather}
            loading={weatherLoading}
            lastAttemptAt={lastAttemptAt}
            refreshFailed={refreshFailed}
            autoRefresh={searchActive}
            terrain={state.terrain.cells}
            onRefresh={refreshWeather}
          />
          <SummitCard />

          {lastReport && (
            <Panel title="Why the map changed">
              <ExplanationCard report={lastReport} loading={explaining === lastReport.id} />
            </Panel>
          )}

          {inspect && state.prob && !draft && (
            <CellInspector
              key={`${inspect}-${state.prob.cells[inspect]}`}
              cell={inspect}
              terrain={state.terrain.cells[inspect]}
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
        <div className="space-y-3 lg:col-start-1 lg:row-start-2">
          {state.prob && (
            <div className="grid gap-3 xl:grid-cols-2">
              <SuggestionsPanel
                key={prefill?.key ?? 0}
                prefill={prefill}
                suggestions={suggestions}
                modifiers={modifiers}
                weatherFactor={weatherFactor}
                flaggedCells={flaggedCells}
                assignments={state.assignments}
                selectedCell={inspect}
                terrain={state.terrain.cells}
                onAssign={(a) => {
                  dispatch({ type: "assign", ...a });
                  if (demoStep?.kind === "override" && a.cell === demoStep.cell) dispatch({ type: "demo_advance" });
                }}
              />
              <CluePanel
                prob={state.prob}
                clues={state.clues}
                selectedCell={inspect}
                onAdd={(c) => dispatch({ type: "add_clue", ...c })}
              />
            </div>
          )}

          <AuditLog state={state} />
        </div>

      </div>
    </main>
  );
}
