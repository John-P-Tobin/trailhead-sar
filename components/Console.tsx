"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import GridMap from "./GridMap";
import MapLegend from "./MapLegend";
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
import StatusBar from "./StatusBar";
import SubjectCard, { SubjectDraft } from "./SubjectCard";
import UrgencyCard from "./UrgencyCard";
import Alert from "./ui/Alert";
import Button from "./ui/Button";
import Card from "./ui/Card";
import Empty from "./ui/Empty";
import Tabs from "./ui/Tabs";
import Tag from "./ui/Tag";
import { useConfirm } from "./ui/ConfirmProvider";
import { IconDownload, IconTarget } from "./ui/icons";
import { listRow, quote } from "./ui/styles";
import { DEMO_LKP, DEMO_PROFILE, DEMO_STEPS, demoSubject } from "@/lib/demo/scenario";
import { combinedFactor, currentPeriod, exposureRisk, podModifiers, safetyFlags, upcoming } from "@/lib/weather";
import { useWeather } from "@/lib/useWeather";
import { rankCells } from "@/lib/engine/rank";
import { priorSummary } from "@/lib/engine/priors";
import { hazardsNearLkp, scoreUrgency, urgencyFactors } from "@/lib/engine/urgency";
import { explainUpdate, parseReport, parseSubject } from "@/lib/api";
import { defaultSubject, Subject } from "@/lib/subject";
import { buildUpdateSummary, localExplanation } from "@/lib/explain";
import { cumulativePodMap, initialState, loadState, reducer, ReportSource, saveState } from "@/lib/store";
import { CellId } from "@/lib/engine/grid";
import { emptyReport, ParsedReport } from "@/lib/schemas";
import { PROFILES } from "@/lib/profiles";
import { describeCell, promptFeatures, snapshotOf, STYLIZED_TERRAIN, TerrainModel } from "@/lib/terrain";
import { featuresForSnapshot, loadBundledTerrain, loadLiveTerrain } from "@/lib/terrainClient";
import { buildCalTopoGeoJSON, buildCalTopoKML, CALTOPO_HINT } from "@/lib/export";
import { downloadText, fileStamp } from "@/lib/download";
import { makeAudit } from "@/lib/audit";

interface Draft {
  report: ParsedReport;
  proposal: ParsedReport | null;
  source: ReportSource;
  rawText?: string;
  key: number;
  demo?: boolean;
}

type TabKey = "ops" | "cell" | "clues" | "weather" | "log";

export default function Console() {
  const confirm = useConfirm();
  const [state, dispatch] = useReducer(reducer, undefined, () => loadState() ?? initialState());
  const [placingLkp, setPlacingLkp] = useState(false);
  const [inspect, setInspect] = useState<CellId | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [tab, setTab] = useState<TabKey>("ops");
  const [highlight, setHighlight] = useState<CellId[]>([]);
  const [ringsOn, setRingsOn] = useState(true);
  const [subjectDraft, setSubjectDraft] = useState<SubjectDraft | null>(null);
  const [subjectParsing, setSubjectParsing] = useState(false);
  const [subjectError, setSubjectError] = useState<string | null>(null);

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
  const demoStep = state.demo ? DEMO_STEPS[state.demoStep] : undefined;
  const needLkp = !state.lkp || placingLkp;

  const onCellClick = (id: CellId) => {
    setHighlight([]);
    if (needLkp) {
      dispatch({ type: "set_lkp", cell: id });
      setPlacingLkp(false);
      if (!state.demo && state.terrain.source !== "live") fetchLiveTerrain();
      return;
    }
    if (draft) {
      const cells = draft.report.cells.includes(id) ? draft.report.cells.filter((c) => c !== id) : [...draft.report.cells, id];
      setDraft({ ...draft, report: { ...draft.report, cells } });
      return;
    }
    const next = id === inspect ? null : id;
    setInspect(next);
    if (next) setTab("cell");
  };

  const openSubjectManual = () =>
    setSubjectDraft({ subject: state.subject ?? defaultSubject(state.profileId), proposal: null, source: "manual", unclear: [], key: Date.now() });

  const onParseSubject = async (text: string, canned?: Subject) => {
    setSubjectParsing(true);
    setSubjectError(null);
    setTab("ops");
    const res = await parseSubject(text);
    setSubjectParsing(false);
    if (res.ok) {
      setSubjectDraft({ subject: res.subject, proposal: res.subject, source: "claude", rawText: text, unclear: res.unclear, key: Date.now() });
    } else if (canned) {
      setSubjectError(`Claude unavailable: ${res.reason} Using the demo's canned subject — review it like any proposal.`);
      setSubjectDraft({ subject: canned, proposal: canned, source: "canned", rawText: text, unclear: [], key: Date.now() });
    } else {
      setSubjectError(`Claude unavailable: ${res.reason} Fill the card in by hand — the model works the same.`);
      setSubjectDraft({ subject: defaultSubject(state.profileId), proposal: null, source: "manual", rawText: text, unclear: [], key: Date.now() });
    }
  };

  const confirmSubject = () => {
    if (!subjectDraft) return;
    dispatch({ type: "set_subject", subject: subjectDraft.subject, source: subjectDraft.source, proposal: subjectDraft.proposal, rawText: subjectDraft.rawText });
    if (demoStep?.kind === "callout") dispatch({ type: "demo_advance" });
    setSubjectDraft(null);
    setSubjectError(null);
  };

  const openManual = (rawText?: string) => setDraft({ report: emptyReport(), proposal: null, source: "manual", rawText: rawText || undefined, key: Date.now() });

  const onParse = async (text: string, canned?: ParsedReport) => {
    setParsing(true);
    setParseError(null);
    setTab("ops");
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

  const clearLocal = () => {
    requested.current.clear();
    setPrefill(null);
    setDraft(null);
    setInspect(null);
    setParseError(null);
    setHighlight([]);
    setSubjectDraft(null);
    setSubjectError(null);
    setTab("ops");
  };

  const resetAll = async () => {
    if (!(await confirm({ title: "Reset the whole search?", content: "This clears the map, reports, clues and the audit log.", okText: "Reset", danger: true }))) return;
    dispatch({ type: "reset" });
    clearLocal();
  };

  // Demo mode always uses the bundled terrain, so the video never depends on a live API.
  const loadDemo = async () => {
    if (state.audit.length > 1 && !(await confirm({ title: "Load the demo scenario?", content: "This replaces the current search.", okText: "Load demo" }))) return;
    const bundled = await loadBundledTerrain();
    const model = bundled ?? STYLIZED_TERRAIN;
    setTerrainModel(model);
    setTerrainNote(bundled ? null : "The bundled terrain failed to load; the demo story is tuned for it.");
    dispatch({ type: "demo_load", lkp: DEMO_LKP, profileId: DEMO_PROFILE, terrain: snapshotOf(model), subject: demoSubject() });
    clearLocal();
  };

  const applyDraft = () => {
    if (!draft) return;
    dispatch({ type: "apply_report", payload: { confirmed: draft.report, proposal: draft.proposal, source: draft.source, rawText: draft.rawText } });
    if (draft.demo) dispatch({ type: "demo_advance" });
    setDraft(null);
  };

  const selected = draft ? draft.report.cells : highlight.length ? highlight : inspect ? [inspect] : [];

  /** Download the grid, markers and team outlines for CalTopo, and log the export. */
  const exportCalTopo = (format: "geojson" | "kml") => {
    if (!state.prob) return;
    const input = { state, weather, now: Date.now() };
    const row = `${(state.prob.row * 100).toFixed(1)}%`;
    const weatherSource = weather?.source === "live" ? "Live NWS" : "cached";
    if (format === "geojson") {
      const fc = buildCalTopoGeoJSON(input);
      downloadText(`trailhead-caltopo-${fileStamp()}.geojson`, JSON.stringify(fc), "application/geo+json");
      const teams = fc.features.filter((f) => f.properties.kind === "assignment").length;
      const markers = fc.features.filter((f) => f.geometry.type === "Point").length;
      dispatch({
        type: "log",
        entry: makeAudit(
          "export",
          `Exported for CalTopo (GeoJSON): 225 cells, ${markers} marker${markers === 1 ? "" : "s"}, ${teams} team outline${teams === 1 ? "" : "s"}; ROW ${row}; ${weatherSource} weather`,
        ),
      });
    } else {
      downloadText(`trailhead-caltopo-${fileStamp()}.kml`, buildCalTopoKML(input), "application/vnd.google-earth.kml+xml");
      dispatch({ type: "log", entry: makeAudit("export", `Exported for CalTopo (KML): ROW ${row}; ${weatherSource} weather`) });
    }
  };

  const period = weather ? currentPeriod(weather) : null;
  const modifiers = useMemo(() => podModifiers(period), [period]);
  const weatherFactor = combinedFactor(modifiers);
  const flaggedCells = useMemo(() => new Set(weather ? safetyFlags(upcoming(weather, 12), state.terrain.cells).flatMap((f) => f.cells) : []), [weather, state.terrain.cells]);
  const suggestions = useMemo(() => (state.prob ? rankCells(state.prob, cumPod, state.terrain.cells, weatherFactor) : []), [state.prob, cumPod, state.terrain.cells, weatherFactor]);
  const exposure = period ? exposureRisk(period).level : null;
  const exposureSoon = weather ? (upcoming(weather, 8).map((p) => exposureRisk(p).level).find((l) => l === "severe" || l === "high") ?? null) : null;
  const effectiveSubject = useMemo(() => state.subject ?? defaultSubject(state.profileId), [state.subject, state.profileId]);
  const urgency = useMemo(() => {
    if (!state.lkp) return null;
    const f = urgencyFactors(effectiveSubject, { exposureNow: exposure, exposureSoon, hazardsNearLkp: hazardsNearLkp(state.lkp, state.terrain.cells) });
    return scoreUrgency(f, state.urgencyOverrides);
  }, [effectiveSubject, state.lkp, state.terrain.cells, state.urgencyOverrides, exposure, exposureSoon]);
  const summary = useMemo(
    () => (state.lkp ? priorSummary(state.lkp, subjectDraft?.subject ?? effectiveSubject, state.terrain.cells) : null),
    [state.lkp, subjectDraft, effectiveSubject, state.terrain.cells],
  );

  // Cells come from the store (what the model uses); lines and shapes from the loaded terrain.
  const mapTerrain = { cells: state.terrain.cells, bbox: state.terrain.bbox, osm: state.terrain.source !== "stylized", features: terrainModel.features };
  const subjectLabel = `${state.subject?.name ? `${state.subject.name} · ` : ""}${PROFILES[effectiveSubject.category].label}${state.subjectConfirmed ? "" : " (unconfirmed)"}`;

  const opsTab = (
    <div className="space-y-3">
      {state.found && (
        <Alert
          type="success"
          title={
            <>
              Subject located in <span className="font-mono">{state.found.cell}</span>
            </>
          }
          description={
            <>
              {state.found.text}
              {(() => {
                const a = [...state.assignments].reverse().find((x) => x.cell === state.found!.cell);
                return a ? (
                  <div className="mt-1">
                    Model: suggestion #{a.suggestedRank ?? "—"} when assigned · IC: {a.override ? `override${a.reason ? ` (“${a.reason}”)` : ""}` : "followed top suggestion"}
                  </div>
                ) : null;
              })()}
            </>
          }
        />
      )}
      {!state.lkp && <WelcomeCard onDemo={loadDemo} />}
      {(!state.started || !state.lkp) && (
        <SetupPanel
          lkp={state.lkp}
          lkpInfo={state.lkp ? describeCell(state.terrain.cells[state.lkp]) : undefined}
          profileId={state.profileId}
          row={state.prob?.row ?? null}
          suggestedRow={summary?.suggestedRow}
          started={state.started}
          placingLkp={placingLkp}
          onTogglePlaceLkp={() => setPlacingLkp((v) => !v)}
          onProfile={(p) => dispatch({ type: "set_profile", profileId: p })}
          onRow={(v) => dispatch({ type: "set_row", value: v })}
        />
      )}
      {state.lkp && (
        <SubjectCard
          subject={state.subjectConfirmed ? state.subject : null}
          draft={subjectDraft}
          summary={state.started ? null : summary}
          started={state.started}
          parsing={subjectParsing}
          parseError={subjectError}
          onParse={(t) => onParseSubject(t)}
          onOpenManual={openSubjectManual}
          onChangeDraft={(subject) => subjectDraft && setSubjectDraft({ ...subjectDraft, subject })}
          onConfirm={confirmSubject}
          onCancel={() => {
            setSubjectDraft(null);
            setSubjectError(null);
          }}
        />
      )}
      {urgency && state.lkp && <UrgencyCard urgency={urgency} onOverride={(key, score, proposed) => dispatch({ type: "set_urgency_override", key, score, proposed })} />}
      {state.prob && (
        <Card title="Radio report" size="small" tone={draft ? "primary" : "default"} extra={draft && <Tag color="primary">Review before applying</Tag>}>
          {draft ? (
            <div className="space-y-2">
              {draft.rawText && <blockquote className={`${quote} border-line-strong`}>{draft.rawText}</blockquote>}
              {parseError && draft.source === "manual" && <Alert type="warning" compact description={parseError} />}
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
        </Card>
      )}
      {lastReport && (
        <Card title="Why the map changed" size="small">
          <ExplanationCard report={lastReport} loading={explaining === lastReport.id} />
        </Card>
      )}
      {state.prob && (
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
      )}
    </div>
  );

  const cellTab =
    inspect && state.prob ? (
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
    ) : (
      <Card size="small">
        <Empty icon={<IconTarget width={22} height={22} />} title="Click a cell on the map" hint="See its probability, how well it has been searched, and its terrain. Before the search starts you can edit its prior here." />
      </Card>
    );

  const logTab = (
    <div className="space-y-3">
      {state.reports.length > 0 && (
        <Card title="Applied reports" size="small">
          <ul className="space-y-1.5 text-sm">
            {[...state.reports].reverse().map((r) => (
              <li key={r.id} className={listRow}>
                <div className="flex justify-between">
                  <span className="font-medium">{r.team}</span>
                  <span className="text-xs text-fg-3">{new Date(r.at).toLocaleTimeString()}</span>
                </div>
                <div className="text-xs text-fg-2">
                  <span className="font-mono">{r.cells.join(", ")}</span> · POD {(r.pod * 100).toFixed(0)}% · ROW {(r.rowBefore * 100).toFixed(1)}% → {(r.rowAfter * 100).toFixed(1)}%
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <AuditLog state={state} />
    </div>
  );

  const tabs = [
    { key: "ops", label: "Operations", badge: draft ? <Tag color={draft.report.pod_confidence === "low" ? "warning" : "primary"}>1</Tag> : undefined, content: opsTab },
    { key: "cell", label: inspect ? `Cell ${inspect}` : "Cell", content: cellTab },
    { key: "clues", label: "Clues", badge: state.clues.length ? <Tag>{state.clues.length}</Tag> : undefined, content: state.prob ? <CluePanel prob={state.prob} clues={state.clues} selectedCell={inspect} onAdd={(c) => dispatch({ type: "add_clue", ...c })} /> : <Card size="small"><Empty title="Place the LKP first" /></Card> },
    {
      key: "weather",
      label: "Weather",
      badge: exposure && exposure !== "low" ? <Tag color={exposure === "moderate" ? "warning" : "error"}>{exposure}</Tag> : undefined,
      content: (
        <div className="space-y-3">
          <WeatherPanel
            weather={weather}
            loading={weatherLoading}
            lastAttemptAt={lastAttemptAt}
            refreshFailed={refreshFailed}
            autoRefresh={searchActive}
            terrain={state.terrain.cells}
            onRefresh={refreshWeather}
            onHighlightCells={(cells) => setHighlight(cells)}
          />
          <SummitCard />
        </div>
      ),
    },
    { key: "log", label: "Log", badge: state.audit.length ? <Tag>{state.audit.length}</Tag> : undefined, content: logTab },
  ];

  return (
    <main className="mx-auto max-w-[1480px] space-y-3 p-3 pb-16 sm:p-4 sm:pb-16">
      <header className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">
            Trailhead <span className="text-fg-3">·</span> <span className="text-fg-2">Search Planner</span>
          </h1>
          <p className="text-xs text-fg-3">Bayesian decision support for the incident commander · prototype with illustrative priors</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button onClick={loadDemo}>Load demo scenario</Button>
          <Button icon={<IconDownload width={14} height={14} />} onClick={() => exportCalTopo("geojson")} disabled={!state.prob} title={CALTOPO_HINT}>
            Export for CalTopo
          </Button>
          <Button variant="text" onClick={() => exportCalTopo("kml")} disabled={!state.prob} title="KML with styles, as a fallback">
            KML
          </Button>
          <Button variant="danger" onClick={resetAll}>
            Reset
          </Button>
        </div>
      </header>

      <StatusBar
        lkp={state.lkp}
        subjectLabel={subjectLabel}
        lastSeenAt={state.subject?.lastSeenAt ?? null}
        row={state.prob?.row ?? null}
        rowStart={state.rowHistory[0] ?? null}
        urgency={urgency ? { band: urgency.band, label: urgency.bandLabel, total: urgency.total } : null}
        exposure={exposure}
        found={state.found?.cell ?? null}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="space-y-3 lg:sticky lg:top-3 lg:self-start">
          <Card
            title="Search area"
            size="small"
            extra={
              <>
                {needLkp ? (
                  <Tag color="warning">Click a cell to place the last known point</Tag>
                ) : draft ? (
                  <Tag color="primary">Click cells to add or remove them from the report</Tag>
                ) : highlight.length ? (
                  <Button size="sm" variant="text" onClick={() => setHighlight([])}>
                    Clear highlight
                  </Button>
                ) : null}
                {state.lkp && (
                  <Button size="sm" variant="text" onClick={() => setRingsOn((v) => !v)} title="25 / 50 / 75 % distance rings for this subject (illustrative)">
                    {ringsOn ? "Hide rings" : "Show rings"}
                  </Button>
                )}
                <TerrainBadge source={state.terrain.source} label={state.terrain.label} fetchedAt={state.terrain.fetchedAt} loading={terrainLoading} />
              </>
            }
            footer={<MapLegend kinds={new Set(mapTerrain.features.map((f) => f.kind))} rings={ringsOn && !!state.lkp} />}
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
              ringsKm={ringsOn && summary ? summary.quartilesKm.slice(0, 3) : []}
              onCellClick={onCellClick}
            />
            {terrainNote && <Alert type="warning" compact className="mt-2" description={terrainNote} />}
          </Card>
          {state.prob && (
            <Card size="small" footer="Probability the subject is outside the grid. It grows as the grid is searched without a find. The app never recommends ending or expanding the search; that call stays with people.">
              <RowIndicator row={state.prob.row} history={state.rowHistory} />
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-3">
          {state.demo && (
            <DemoControls
              step={state.demoStep}
              busy={parsing || subjectParsing}
              reviewing={!!draft || !!subjectDraft}
              onCallout={(s) => onParseSubject(s.text, demoSubject())}
              onReport={(s) => onParse(s.text, s.canned)}
              onClue={(s, boost) => {
                dispatch({ type: "add_clue", text: s.text, cell: s.cell, radius: s.radius, boost });
                dispatch({ type: "demo_advance" });
              }}
              onPrefillOverride={(s) => {
                setPrefill({ team: s.team, cell: s.cell, reason: s.reason, key: Date.now() });
                setTab("ops");
              }}
              onFound={(s) => {
                dispatch({ type: "mark_found", cell: s.cell, text: s.text });
                dispatch({ type: "demo_advance" });
                setTab("ops");
              }}
              onExit={resetAll}
            />
          )}
          <Tabs tabs={tabs} active={tab} onChange={(k) => setTab(k as TabKey)} />
        </div>
      </div>
    </main>
  );
}
