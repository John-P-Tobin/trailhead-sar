# Notes

## Decisions
- Next.js 16 (App Router) + Tailwind 4 + TypeScript; vitest for engine tests.
- Grid is 15×15, columns A–O (west→east), rows 1–15 (north→south), over a real bounding box: Mt Washington / Lakes of the Clouds, 44.245–44.285 N, 71.335–71.285 W (`lib/geo.ts`). Each cell has real lat/lon bounds and is about 266 m × 297 m; the map draws cells at that true aspect ratio.
- System fonts only (no Google Fonts fetch at build time).
- `ANTHROPIC_API_KEY` is server-only; `.env*` is git-ignored except `.env.example` (empty value).
- Engine (`lib/engine/`) is pure TS: `bayes.ts` (update formula, sequential sweeps, cumulative POD, sum-to-1 assertion, prior editing), `priors.ts` (exp(−d/scale) × terrain × profile multipliers, ROW 10%), `clues.ts` (IC-chosen likelihood-ratio boost with distance falloff, renormalized incl. ROW — so a clue on the grid slightly lowers ROW).
- Profile weights in `lib/profiles.ts` are **illustrative estimates**, hand-tuned, not published statistics. Say so in the pitch.
- Editing a cell's prior rescales the other cells and leaves ROW fixed; ROW has its own control.
- State: `lib/store.ts` reducer (pure; every probability change goes through the engine) + localStorage (`trailhead:v1`, try/catch). The console is client-only (`next/dynamic` with `ssr:false`) so restored state never causes hydration mismatches.
- Once any report or clue is applied, setup (LKP, profile, priors, ROW) locks.
- The review card is shared by manual entry and the Claude parse: same fields, same Apply button. Map clicks add/remove cells while a report draft is open.
- Claude: `CLAUDE_MODEL` in `lib/claude.ts`, effort `low` (short extraction tasks; keeps latency down). Calls use `client.messages.parse` with a zod structured-output format, then a strict zod check. An invalid output or a refusal is retried once; after that the route returns `{ok:false}` and the UI switches to manual mode. There is deliberately **no fallback to another model**: manual entry is the failure path and the safeguard story.
- Prompts in `lib/prompts.ts`. The parse prompt lists the current map's named features with the cells they pass through (sent by the client from the loaded terrain), so "the Dry River Trail through G11" maps to cells. Claude lists clues but never weights them.
- Explanation: `/api/explain` gets a text summary of the update (top shifts, ROW change, top cells). If Claude is down, a deterministic local explanation is shown, clearly labelled.
- **Not yet tested against the live API** (no key in the build container). Before the demo: put the key in `.env.local` / Vercel env and run one report through.
- Weather: `/api/weather` → NWS `/points/44.27,-71.3` → `forecastHourly` with `User-Agent: TrailheadSAR (hackathon demo)`, 8 s timeouts, 10-min in-memory cache. Any failure returns cached demo weather (`lib/demo/weather.ts`, times relative to now, day/night from Eastern time) and the UI shows a "Using cached weather" badge. **api.weather.gov is blocked from the build container, so the live path is untested here** — check it once on Vercel.
- Weather refresh: while a search is active (LKP placed, subject not found) the forecast refreshes every 20 min; the panel shows "Updated X min ago" and when the next refresh is due. A failed refresh keeps the last live forecast (up to 2 h, flagged amber) rather than swapping in canned weather, and retries after 5 min. The Refresh button bypasses the server's 10-min cache. Logic in `lib/useWeather.ts` + pure helpers in `lib/weather.ts` (unit-tested).
- POD modifiers (illustrative): fog ×0.7, rain ×0.8, snow ×0.75, darkness ×0.6, combined floor 0.3. Exposure risk is a label (low/moderate/high/severe) from wind chill, wetness, night, heat — never a survival time. Safety flags: winds ≥50 mph on ridge cells (warning), ≥25 mph caution on exposed cells (point forecast understates ridge wind), thunderstorms, wind chill ≤10°F, darkness coming.
- Suggestions (`lib/engine/rank.ts`): score = POA × expected POD; expected POD by vegetation (open 0.75, hardwood 0.6, spruce 0.45, alpine 0.65; cliffs/water ≤0.3 — illustrative) × current weather factor. Cells with cumulative POD ≥ 80% drop out. Top 5 shown as dashed numbered boxes on the map. Safety-flagged cells get ⚠ but are never hidden — the IC decides.
- Assigning any cell other than #1 opens an optional one-line reason prompt; both the assignment and the override (with reason) go to the audit log.
- Clues: IC picks cell, radius (0–2) and boost (log only / ×1.5 / ×2.5 / ×4) and sees a preview of the probability shift before applying. Claude may list clues in a parsed report but they are never applied automatically.
- Audit export: JSON with every entry plus reports, clues, assignments, ROW history, LKP, profile and the Claude model ID.

## Terrain (OpenStreetMap)
- Three sources, shown as a badge on the map: **Live OSM** (Overpass, fetched when the IC places the LKP), **Bundled Mt Washington** (`data/terrain.geojson`, shipped with the app), **Stylized** (the original fictional map, last-resort fallback).
- `/api/terrain?bbox=s,w,n,e` queries Overpass (trails/roads, streams, water, cliffs/ridges, peaks) with `User-Agent: TrailheadSAR (hackathon demo)` and a 30 s timeout, then returns normalized GeoJSON clipped to the grid + one cell. The client caches it in localStorage for 7 days. If it fails, the bundled terrain stays and a note under the map says why. **Overpass is blocked from the build container, so the live path is tested with mocks only — check the badge turns "Live OSM" on Vercel.**
- Live terrain only replaces the bundled terrain before the first report or clue (priors regenerate; IC-edited priors are kept). Once the search starts, terrain is locked so the map never shifts under applied updates. The terrain cells persist with the search.
- `data/terrain.geojson`: the team's Overpass Turbo export of 2026-10-31 00:49 UTC, converted with `npm run convert-terrain -- <export.geojson>` (normalized properties `kind/name/ele/osm_id`, 148 features, 177 KB). Imported as JSON via a Turbopack rule, so demo mode never touches a live API.
- Mapping (`lib/osm.ts`, illustrative): lines are sampled every 10 m; a cell is trail/road or drainage with ≥40 m of it, cliff or ridgeline with ≥60 m (or a peak in the cell), water if ≥30% covered. Elevation is a rough estimate falling 0.3 m per m from known peak heights (−40 m in drainages); alpine above 1,450 m (treeline). Mt Washington lands in J6 at ~1,912 m (actual 1,917 m).
- Data caveats: this OSM export has no `natural=cliff` features in the box, so no cliff cells; the ponds (Lakes of the Clouds, Hermit Lake, Spaulding Lake, Gem Pool) are smaller than a cell, so they are drawn but no cell is flagged water.
- Attribution: "© OpenStreetMap contributors" (link to openstreetmap.org/copyright) sits on the map whenever OSM data is shown; the bundled file carries the ODbL attribution.

## Robustness (round 3)
- The reducer never throws: if the engine rejects an update (e.g. probabilities would not sum to 1) the previous state is kept and the audit log gets an "Update ignored (…)" note.
- `loadState` rejects corrupt, old or hand-edited saved state (`isUsableState`: version, terrain, audit array, probabilities sum to 1, cells match the terrain) so a refresh starts clean instead of crashing.
- `apply_report` clamps POD with the engine's `clampPod`; `/api/parse-report` trims the text, so a blank report is rejected without calling Claude.
- `/api/terrain` asks two Overpass servers at once (overpass-api.de and overpass.private.coffee) and takes the first good answer; `OVERPASS_URL` still overrides with a single server. **Overpass was overloaded on the night of Oct 30**, so Live OSM may not appear; the demo always uses the bundled terrain regardless.
- `tests/robustness.test.ts`: blank reports, out-of-grid cells, garbled POD, engine errors, 300 random sweeps/clues staying normalized, restore after refresh, corrupt saved state, Reset mid-demo, Overpass backup server.

## Export for CalTopo
- Real SAR teams run searches in CalTopo; its API needs a team account, so Trailhead exports files the IC imports (Import → choose file). Button in the audit-log panel; every export is logged.
- GeoJSON (`lib/export.ts`, RFC 7946: WGS84, `[lon, lat]`): one Polygon per cell (counterclockwise ring from the cell's real bounds) titled like "G14 – POA 1.7%", with a description (POA, cumulative POD, last searched by, sweeps, weather-adjusted vs base expected POD with active penalties, terrain, and any team-safety flag on ridgeline/exposed cells) and `fill` / `fill-opacity` / `stroke` from the same heatmap function the map uses (`lib/heat.ts`). Markers for the LKP, each clue (title = clue text) and the found location. Each team's assigned cells are merged into one outline polygon (adjacent cells merge, corner-only contacts split, holes kept), titled with the team name.
- The top-level `description` (and a structured `trailhead` member) carries the note: export time, ROW, NWS conditions at export time, exposure-risk label, weather source and last update, and the decision-support line. CalTopo ignores top-level members, so the same note is also a "Trailhead export" marker at the grid's NW corner.
- KML with inline styles (aabbggrr colors, outline-only team shapes) as a fallback. Unit tests check structure, coordinate order, ring closure/orientation, titles, styles, markers, outlines and the note. **Not tested by importing into CalTopo itself** (needs an account and network access) — try one import before the demo.

## Demo script (Load demo scenario)
Runs on the bundled real terrain. Subject: Dan, 58, day hiker; left the Lakes of the Clouds hut (E10, junction of the Crawford Path, Ammonoosuc Ravine and Dry River trails) for the summit in fog. Each step still goes through the real UI — the presenter applies each parse, picks the clue boost and makes the assignment.
1. Team 1 hasty search of the Crawford Path toward the summit (E10, F10, G10, G9; POD 50%) → ROW 10.0 → 10.3%.
2. Team 2 line search all around the hut (E10, D10, E9, D9, E11, E12, D12, F12, F11; POD 60%) → the hut cell and its neighbours drop out; probability shifts downhill into the two drainages. (Round 4: these extra cells are needed because the lognormal prior keeps a lot of mass in the cells next to the LKP.)
3. Team 1 in fog down the Dry River Trail (F11, G11, G12) → **amber low-confidence card**, POD 25%: those cells are barely cleared.
4. Clue: wrapper on the Dry River Trail at G13 — the IC picks the boost (**small ×1.5**: it's a busy trail). ROW drops slightly.
5. Team 2 clears the Ammonoosuc Ravine (D8, D7, C7, B8, B9; POD 70%).
6. Family tip → suggestions are G13 (wrapper), G11 (fogged), **G14** (downstream); IC overrides to **G14** (model's #3) and logs the reason.
7. Subject located in G14 beside the Dry River → banner shows "model suggestion #3 · IC override".
The story depends on the **small** boost: at medium, G14 rises to #2. In the demo panel, clicking any boost other than the scenario's `suggestedBoost` asks for confirmation first (`window.confirm` in `components/DemoControls.tsx`), so a misclick while recording can be cancelled. **UI teammate:** this is the only components/ change in round 3; no styles touched. Swap it for an inline confirm if you prefer. Click-by-click run sheet with lines to say: `DEMO.md`. Works fully offline: canned parses if Claude fails, cached weather if NWS fails, local explanations if /api/explain fails, bundled terrain always. `tests/demo.test.ts` checks the story on the bundled file (clue cell #1, override cell #3, found there, downstream and lower).

## Pitch: the three questions
**1. Who is this for and why do they need it?**
The incident commander of a small volunteer SAR team (3–6 field teams) running a lost-hiker search. Professional teams use Bayesian search theory to decide where to look next; volunteer ICs rarely have the time or tools to do that math under pressure at 2 a.m., so they fall back on whiteboards and gut feel. Trailhead runs the math, turns messy radio traffic into structured inputs, and keeps a defensible record of every decision.

**2. What could go wrong, and what do we do about it?**
- *Claude misreads a report* (wrong cells, inflated POD) → it only proposes; every value is editable on a review card and nothing changes until the IC clicks Apply. Edits vs. the AI proposal are logged. Vague reports are flagged amber with "verify with team".
- *False confidence in the map* → ROW is always on screen and grows as the grid is searched; the app never recommends ending, suspending or expanding a search. Priors are labelled illustrative. Each update comes with "the assumption I'm least sure about".
- *Over-trusting the ranking* → suggestions are labelled suggestions; any cell can be assigned; overrides prompt for a reason, which is logged rather than discouraged.
- *Clues weighted wrongly by an AI* → the AI never weights clues. The IC picks the boost and sees a preview first.
- *Exposure misjudged* → weather gives a plain risk label and team-safety flags; no survival-time number (that's for the IC and medical staff).
- *API outages in the field* → manual mode works the same; cached weather with a visible badge; local explanations; the demo works fully offline.
- *Accountability* → full audit log (reports, AI proposals, IC edits, overrides with reasons, clues) exportable as JSON for the after-action review.

**Fits how SAR teams already work.** Trailhead runs on real terrain (OpenStreetMap trails, streams and lakes for the actual Mt Washington / Lakes of the Clouds area) and exports its grid, probabilities, team assignments, clues and weather to CalTopo, the mapping tool real SAR teams already use. It adds the Bayesian math and an audit trail to the team's existing workflow instead of asking them to replace it.

**3. How does this help people rather than decide for them?**
It does the arithmetic and the transcription — the parts humans are bad at under fatigue — and leaves every judgment (POD, clue weight, team assignment, safety, when to stop) with the IC. The demo ends with the subject found in a cell the model ranked #3 and the IC chose on a family tip: the model narrowed the field, the human made the call.

## UI notes
- Layout: map + suggestions/clues/audit on the left; demo, ROW, setup, report, weather and explanation on the right. On phones the order is map → controls → suggestions; POA numbers hide below 640 px.
- Persistent amber footer: "Decision support only. The incident commander directs all search operations."
- Summit conditions card (`components/SummitCard.tsx`) only links out to the Mount Washington Observatory webcam and Higher Summits Forecast pages; no scraping or hotlinking. **The two deep links couldn't be verified from the build container — click them once before recording.**

## Before recording the demo (checklist)
1. Set `ANTHROPIC_API_KEY` in Vercel project env (and `.env.local` for local runs). Run one live report; confirm the review card fills and the explanation says "Written by Claude".
2. Confirm the weather badge says "Live NWS" on Vercel and the panel shows "Updated X min ago" (cached fallback is what the build container saw).
3. Outside demo mode, place an LKP and confirm the terrain badge turns "Live OSM" (Overpass was blocked from the build container).
4. Export for CalTopo once and import the file into a CalTopo map (Import → choose file) to check titles, colors and outlines.
5. Click both summit links.
6. Load demo scenario → step through all 7 steps once. At the clue step pick **small** (the highlighted button). Reset before recording.
