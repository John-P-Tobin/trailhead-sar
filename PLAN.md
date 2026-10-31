# Trailhead — Build Plan

Bayesian search-and-rescue planner for a volunteer incident commander (IC).
Claude proposes values; the IC confirms every number; the math is plain, tested TypeScript.

Deadline: demo video by **Sat Oct 31, 10:00 a.m. ET**. Feature freeze **6:30 a.m.**

---

## 1. Architecture

```
┌──────────────────────────── Browser (client state only) ───────────────────────────┐
│  Console (ops console, client-only)                                                │
│   ├─ GridMap (SVG from OSM vector data, true cell aspect, animated POA heatmap,   │
│   │           terrain badge, © OpenStreetMap contributors)                         │
│   ├─ SetupPanel (LKP, profile, ROW)        ├─ CellInspector (POA, bounds, edit)    │
│   ├─ ReportInput → ReviewCard (edit → Apply)                                       │
│   ├─ SuggestionsPanel (top 5, assign, override reason)  ├─ CluePanel (IC boost)    │
│   ├─ WeatherPanel (urgency, safety flags, auto-refresh 20 min)                     │
│   ├─ ExplanationCard   ├─ AuditLog (JSON export + Export for CalTopo / KML)        │
│   └─ Footer: "Decision support only. The incident commander directs all search…"  │
│                                                                                    │
│  lib/store.ts reducer (search + terrain snapshot) ── localStorage (try/catch)      │
│  lib/engine/* pure TS (priors, Bayes update, POD, ranking, clues) ← unit tested    │
│  lib/osm.ts (OSM → cells), lib/export.ts (CalTopo GeoJSON/KML) ← unit tested       │
│  data/terrain.geojson (bundled Mt Washington OSM, loaded as JSON)                  │
└────────────────────────────────────────┬───────────────────────────────────────────┘
                                         │ fetch (JSON)
┌────────────────────────── Next.js route handlers (server only) ────────────────────┐
│  POST /api/parse-report  → Claude → zod → retry once → else {ok:false} → manual    │
│  POST /api/explain       → Claude → 2–3 sentences + least-certain assumption       │
│  GET  /api/weather       → NWS /points → forecastHourly (User-Agent) | cached      │
│  GET  /api/terrain       → Overpass (User-Agent, 30 s) → normalized GeoJSON        │
│  ANTHROPIC_API_KEY read here only (process.env), never sent to the client          │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Key design decisions**
- **Grid:** 15×15, columns `A–O`, rows `1–15`, cell IDs like `C4`, over a real bounding box (Mt Washington / Lakes of the Clouds by default); each cell has lat/lon bounds. Per-cell terrain (`trail`, `drainage`, `ridge`, `cliff`, `water`, cover, elevation) comes from OpenStreetMap: live via Overpass, else the bundled file, else the stylized hand-drawn map.
- **State model:** `{ grid: Terrain, lkp, profile, poa: Record<CellId, number>, row: number, cumulativePod: Record<CellId, number>, sweeps[], clues[], assignments[], audit[], weather }`. Probabilities stored as one vector (cells + ROW) so sum-to-1 is checked in one place.
- **Engine is pure:** no React, no fetch. Every state change to probabilities goes through `applySweep` / `applyClue` / `setPriors`, each of which asserts `|Σ − 1| < 1e-9` and renormalises only float drift (throws on real violations in tests).
- **Claude never writes to the model directly.** API responses become a *draft* in the ReviewCard; only the IC's Apply dispatches the update.
- **Fallback chain for parsing:** Claude → (invalid output or refusal) retry once → manual mode. No fallback to another model. In demo mode, a canned parse for each scripted report is used if the API call fails.
- **Model ID** in one constant: `lib/claude.ts` → `export const CLAUDE_MODEL = "claude-opus-5-5"` (current default in the Anthropic docs), effort `low` for latency.
- **No database.** localStorage only, wrapped in try/catch; app works if storage is unavailable.

## 2. ANTHROPIC_API_KEY handling

- Read **only** in server route handlers (`app/api/parse-report/route.ts`, `app/api/explain/route.ts`) via `process.env.ANTHROPIC_API_KEY`. No `NEXT_PUBLIC_` prefix, so Next.js never bundles it for the client.
- The Anthropic client lives in `lib/server/anthropic.ts`, which imports `server-only` so any accidental client import fails the build.
- `.env.local` holds the real key locally and is in `.gitignore` (along with `.env*.local`). A committed `.env.example` contains `ANTHROPIC_API_KEY=` with no value.
- On Vercel, the key is set as a project environment variable in the dashboard, never in the repo.
- If the key is missing or the call fails, routes return `{ ok: false, reason }` (no key details) and the UI switches to manual mode / canned demo responses.
- I will never print, log, or commit the key. Before each commit I'll run `git diff --cached` and grep for `sk-ant` as a check.

## 3. File structure

```
trailhead-sar/
├─ app/
│  ├─ layout.tsx  page.tsx  globals.css     # shell, safety footer, client-only console
│  └─ api/
│     ├─ parse-report/route.ts   # Claude → ParsedReport (zod), retry once
│     ├─ explain/route.ts        # Claude → explanation + least-certain assumption
│     ├─ weather/route.ts        # NWS proxy + cached fallback
│     └─ terrain/route.ts        # Overpass → normalized OSM GeoJSON for the grid's bbox
├─ components/   Console, GridMap, MapLegend, TerrainBadge, SetupPanel, CellInspector,
│                ReportInput, ReviewCard, ExplanationCard, SuggestionsPanel, CluePanel,
│                WeatherPanel, SummitCard, AuditLog, DemoControls, WelcomeCard, …
├─ lib/
│  ├─ engine/    grid.ts  bayes.ts  priors.ts  rank.ts  clues.ts   (pure, tested)
│  ├─ geo.ts            # bbox, cell lat/lon bounds, [lon,lat] ↔ grid units
│  ├─ osm.ts            # Overpass query, OSM → normalized GeoJSON, features → cells
│  ├─ terrain.ts        # terrain types, sources, stylized fallback map
│  ├─ terrainClient.ts  # bundled file loader, live fetch + localStorage cache
│  ├─ export.ts         # CalTopo GeoJSON + KML
│  ├─ heat.ts           # heatmap scale shared by the map and the export
│  ├─ weather.ts  useWeather.ts   # NWS parsing, modifiers, risk, flags, refresh policy
│  ├─ store.ts  audit.ts  schemas.ts  prompts.ts  explain.ts  api.ts  download.ts
│  ├─ claude.ts  server/anthropic.ts   # model constant; server-only client
│  └─ demo/     scenario.ts  weather.ts
├─ data/terrain.geojson     # bundled OSM terrain (Mt Washington / Lakes of the Clouds)
├─ scripts/convert-terrain.ts   # Overpass Turbo export → data/terrain.geojson
├─ tests/                   # vitest: engine, store, weather, OSM/terrain, export, routes, demo story
└─ .env.example  PLAN.md  NOTES.md  CLAUDE.md  README.md  next.config.ts
```

## 4. Milestones checklist

### M1 — Scaffold + static grid
- [x] `create-next-app` (App Router, TS, Tailwind, ESLint), add vitest
- [x] `.gitignore` includes `.env.local` / `.env*.local`; add `.env.example`
- [x] `lib/terrain.ts` with 15×15 map (trail, junction, drainages, ridge, cliffs, pond)
- [x] `GridMap` renders SVG terrain with A–O / 1–15 labels
- [x] Safety footer in layout
- [x] `npm run build` passes; commit; start NOTES.md

### M2 — Bayesian engine + priors (pure TS, tested)
- [x] `bayes.ts`: `P_i' = P_i(1−p)/(1−P_i·p)`, others `/ (1−P_i·p)`, sequential over cells, ROW included
- [x] `assertSumToOne`; `cumulativePod = 1 − Π(1−p_k)`
- [x] `priors.ts`: distance decay × terrain multipliers × profile tendency; ROW starts at 10%; normalise
- [x] `profiles.ts`: day hiker, child, hunter, older adult, trail runner — marked "illustrative estimates"
- [x] Tests: sum-to-1 after every op, hand-computed single update, p=0 no-op, p=1 zeroes cell, sequential = repeated single, cumulative POD, ROW grows after sweeps, priors sum to 1 for every profile
- [x] `npm test` + build pass; commit

### M3 — Interactive grid (first end-to-end, target ~midnight)
- [x] Store/reducer + localStorage (try/catch)
- [x] Click to place LKP; profile picker regenerates priors
- [x] Heatmap overlay with animated transitions; cell hover shows POA + cumulative POD
- [x] Prior editor (edit a cell's POA, auto-renormalise others) — only before search starts
- [x] ROW always visible, with trend
- [x] Manual report entry: team, cells, POD → Apply → update
- [x] Reset search; verify in browser; commit

### M4 — Claude parse + review + explain
- [x] Confirm current model ID via claude-api reference; set `CLAUDE_MODEL`
- [x] `/api/parse-report`: system prompt → JSON; zod validate; retry once; else `{ok:false}`
- [x] ReviewCard: every field editable; low confidence → amber + "verify with team" above details; unclear_points listed
- [x] Nothing changes until Apply; failure → manual mode with message
- [x] `/api/explain`: 2–3 sentences + least-certain assumption, given before/after diff
- [x] Audit: raw report, AI proposal, IC edits (diff), applied values
- [x] Schema tests; build; manual check with and without key; commit

### M5 — Weather (NWS)
- [x] `/api/weather`: `/points/44.27,-71.30` → `forecastHourly`, `User-Agent: TrailheadSAR (hackathon demo)`, timeout
- [x] Cached demo weather fallback + "using cached weather" badge
- [x] POD modifiers (fog, rain, snow, darkness) with visible text, e.g. "fog: −30% expected detection"
- [x] Urgency panel: temp, wind, wind chill, exposure risk label (low/moderate/high/severe) — **no survival time**
- [x] Team safety flags (e.g. ridge cells + wind > 50 mph)
- [x] Tests for modifiers / wind chill / risk label; commit

### M6 — Suggestions, overrides, clues, audit export
- [x] `rank.ts`: score = POA × expected POD (weather-adjusted); top 5 of unsearched/under-searched; tested
- [x] SuggestionsPanel labelled "suggestions"; IC assigns team to any cell
- [x] Picking non-top suggestion → optional one-line reason dialog → logged
- [x] CluePanel: text + cell + IC-chosen boost (none/small/medium/large) and radius; AI never weights clues; tested
- [x] Audit log view + Export JSON; never a "stop search" recommendation anywhere
- [x] Commit

### M7 — Demo mode
- [x] "Load demo scenario": LKP at trail junction, day hiker
- [x] Step-through of 4 reports + 1 clue + family-tip override, per the scripted story (trail corridor cleared → fog sweep → clue shifts to drainage → override → found in cell both pointed to)
- [x] Canned parses/explanations used when Claude fails; cached weather when NWS fails
- [x] Run full demo with network blocked to API; commit

### M8 — Polish
- [x] Serious dark ops-console styling (dark-only theme)
- [x] Responsive layout (laptop + tablet), empty states, loading spinners/skeletons
- [x] Accessibility pass (labels, focus, color + text for amber warnings)
- [x] Update NOTES.md with pitch answers (who/what could go wrong/helps not decides); commit

### M9 — (Optional) Summit conditions card
- [x] Link-out card to Mount Washington Observatory webcam + Higher Summits Forecast (no scraping/hotlinking)
- [x] Commit

### Round 2
- [x] Remove the cross-model refusal fallback; invalid output or refusal → retry once → manual mode (tested)
- [x] Weather auto-refresh every 20 min during a search; "updated X min ago"; failed refresh keeps the last live forecast; cached fallback + badge unchanged (tested, fake-clock browser check)
- [x] Real terrain: `/api/terrain` (Overpass, User-Agent, 30 s), per-cell lat/lon bounds, OSM features → cell flags, localStorage cache, source badge, OSM attribution
- [x] Bundled `data/terrain.geojson` from the team's Overpass Turbo export; demo always uses it; demo story retuned and re-tested on it
- [x] Export for CalTopo: GeoJSON (cells, markers, team outlines, weather note) + KML; button + hint in the audit area; exports logged; unit tests for structure and coordinate order
- [x] Docs (PLAN, CLAUDE, NOTES), tests, lint, build, PR

### Round 3 — Robustness
- [x] Reducer never throws; corrupt saved state rejected; POD clamped; blank reports rejected; Overpass raced across two servers (tests/robustness.test.ts)
- [x] Demo clue step guards against picking a non-suggested boost
- [x] DEMO.md run sheet; NOTES updated

### Round 4 — Final product (lost-person model, subject, urgency, UI kit, CalTopo publishing)
- [x] Lognormal distance priors (ISRID hiker fit), subject-scaled, time-aware reach, graded downhill, suggested ROW (PR #5)
- [x] Subject model + relative urgency chart in the store with logged overrides (PR #5)
- [x] Ant-style UI kit, tabbed console, status bar, confirm modals (PR #6)
- [x] Subject card with Claude pre-fill (`/api/parse-subject`), urgency card, distance rings, demo call-out step (PR #7)
- [x] Publish to CalTopo via signed API into an app-owned folder (PR #8)
- [x] Docs: NOTES, DEMO.md (8 steps), PLAN, CLAUDE, README
- [ ] Vercel: add `CALTOPO_*` env vars (user action) and publish once from the live site
- [x] Bundled DEM grid (Open-Meteo/Copernicus, spot-checked vs USGS) → Elevation map layer, inspector slope/aspect, steep tags, urgency terrain hazard, lapse-rate temperatures (display/safety only; prior keeps the smoothed estimate)
- [ ] Stretch (not done): NWS gridpoint extras + 12-hour weather chart; DEM into the prior after a calibration pass

## 5. Per-milestone routine
Build → tests → run app and check the feature → commit → push to `claude/funny-johnson-necpxn` → tick box here. Main is never left broken; reliability of the demo path beats extra features.
