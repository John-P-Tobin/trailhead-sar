# Notes

## Decisions
- Next.js 16 (App Router) + Tailwind 4 + TypeScript; vitest for engine tests.
- Grid is 15×15, columns A–O (west→east), rows 1–15 (north→south). Terrain is fictional, hand-authored in `lib/terrain.ts`: ridge to the NE, valley to the SW, trail junction at H8 (demo LKP), Hollow Brook draining SW from G9, Ledge Brook on the east, cliffs at I3/J3/J4/C3/D3, pond at B9/B10/C10.
- System fonts only (no Google Fonts fetch at build time).
- `ANTHROPIC_API_KEY` is server-only; `.env*` is git-ignored except `.env.example` (empty value).
- Engine (`lib/engine/`) is pure TS: `bayes.ts` (update formula, sequential sweeps, cumulative POD, sum-to-1 assertion, prior editing), `priors.ts` (exp(−d/scale) × terrain × profile multipliers, ROW 10%), `clues.ts` (IC-chosen likelihood-ratio boost with distance falloff, renormalized incl. ROW — so a clue on the grid slightly lowers ROW).
- Profile weights in `lib/profiles.ts` are **illustrative estimates**, hand-tuned, not published statistics. Say so in the pitch.
- Editing a cell's prior rescales the other cells and leaves ROW fixed; ROW has its own control.
- State: `lib/store.ts` reducer (pure; every probability change goes through the engine) + localStorage (`trailhead:v1`, try/catch). The console is client-only (`next/dynamic` with `ssr:false`) so restored state never causes hydration mismatches.
- Once any report or clue is applied, setup (LKP, profile, priors, ROW) locks.
- The review card is shared by manual entry and the Claude parse: same fields, same Apply button. Map clicks add/remove cells while a report draft is open.
- Claude: `CLAUDE_MODEL = "claude-opus-5-5"` in `lib/claude.ts`, effort `low` (short extraction tasks; keeps latency down). Calls use `client.beta.messages.parse` with a zod structured-output format, then a strict zod check; one retry on invalid output, then `{ok:false}` → UI switches to manual mode. Server-side refusal fallback is enabled (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`) so a classifier decline is retried on another model instead of failing.
- Prompts in `lib/prompts.ts`. The parse prompt includes the named trail/stream cells so "swept the Hollow Trail to H11" maps to cells. Claude lists clues but never weights them.
- Explanation: `/api/explain` gets a text summary of the update (top shifts, ROW change, top cells). If Claude is down, a deterministic local explanation is shown, clearly labelled.
- **Not yet tested against the live API** (no key in the build container). Before the demo: put the key in `.env.local` / Vercel env and run one report through.
- Weather: `/api/weather` → NWS `/points/44.27,-71.3` → `forecastHourly` with `User-Agent: TrailheadSAR (hackathon demo)`, 8 s timeouts, 10-min in-memory cache. Any failure returns cached demo weather (`lib/demo/weather.ts`, times relative to now, day/night from Eastern time) and the UI shows a "Using cached weather" badge. **api.weather.gov is blocked from the build container, so the live path is untested here** — check it once on Vercel.
- POD modifiers (illustrative): fog ×0.7, rain ×0.8, snow ×0.75, darkness ×0.6, combined floor 0.3. Exposure risk is a label (low/moderate/high/severe) from wind chill, wetness, night, heat — never a survival time. Safety flags: winds ≥50 mph on ridge cells (warning), ≥25 mph caution on exposed cells (point forecast understates ridge wind), thunderstorms, wind chill ≤10°F, darkness coming.
- Suggestions (`lib/engine/rank.ts`): score = POA × expected POD; expected POD by vegetation (open 0.75, hardwood 0.6, spruce 0.45, alpine 0.65; cliffs/water ≤0.3 — illustrative) × current weather factor. Cells with cumulative POD ≥ 80% drop out. Top 5 shown as dashed numbered boxes on the map. Safety-flagged cells get ⚠ but are never hidden — the IC decides.
- Assigning any cell other than #1 opens an optional one-line reason prompt; both the assignment and the override (with reason) go to the audit log.
- Clues: IC picks cell, radius (0–2) and boost (log only / ×1.5 / ×2.5 / ×4) and sees a preview of the probability shift before applying. Claude may list clues in a parsed report but they are never applied automatically.
- Audit export: JSON with every entry plus reports, clues, assignments, ROW history, LKP, profile and the Claude model ID.

## Demo script (Load demo scenario)
Subject: Dan, 58, day hiker, LKP H8 (trail junction). Each step still goes through the real UI — the presenter applies each parse, picks the clue boost and makes the assignment.
1. Team 1 hasty search of Hollow Trail H8–H12 (POD 50%) → trail cells cool, ROW 10.0 → 10.5%.
2. Team 2 line search of the trail corridor (POD 60%) → ROW 11.2%.
3. Team 1 in fog on Hollow Brook G9/F10 → **amber low-confidence card**, POD 25%: those cells are barely cleared.
4. Clue: wrapper at E11 — the IC picks the boost (medium ×2.5). ROW drops slightly (evidence the subject is on the grid).
5. Team 2 clears Ledge Brook (POD 70%).
6. Family tip → top suggestion is E11 (the wrapper cell); IC overrides to **E12** (model's #3, downstream) and logs the reason.
7. Subject located in E12 → banner shows "model suggestion #3 · IC override".
Works fully offline: canned parses (`lib/demo/scenario.ts`, labelled "Demo fallback parse") if Claude fails, cached weather if NWS fails, local explanations if /api/explain fails. `tests/demo.test.ts` checks the story holds numerically (E12 in top-5 but not #1 before the override).
