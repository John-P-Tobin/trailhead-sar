# Trailhead — Build Plan

Bayesian search-and-rescue planner for a volunteer incident commander (IC).
Claude proposes values; the IC confirms every number; the math is plain, tested TypeScript.

Deadline: demo video by **Sat Oct 31, 10:00 a.m. ET**. Feature freeze **6:30 a.m.**

---

## 1. Architecture

```
┌──────────────────────────── Browser (client state only) ───────────────────────────┐
│  page.tsx (Ops console)                                                            │
│   ├─ GridMap (SVG terrain + animated POA heatmap, LKP marker, cell selection)      │
│   ├─ SetupPanel (LKP, profile, edit priors, ROW %)                                 │
│   ├─ ReportPanel (free text → Parse | Manual entry) → ReviewCard (edit → Apply)    │
│   ├─ SuggestionsPanel (top 5, assign team, override reason prompt)                 │
│   ├─ CluePanel (IC-chosen boost)        ├─ WeatherPanel (urgency, safety flags)    │
│   ├─ ExplanationCard                    ├─ AuditLog (view + export JSON)           │
│   └─ Footer: "Decision support only. The incident commander directs all search…"  │
│                                                                                    │
│  useSearchStore (React reducer) ── persists to localStorage (try/catch)            │
│  lib/engine/* (pure TS: priors, Bayes update, POD, ranking, clues) ← unit tested   │
└────────────────────────────────────────┬───────────────────────────────────────────┘
                                         │ fetch (JSON)
┌────────────────────────── Next.js route handlers (server only) ────────────────────┐
│  POST /api/parse-report  → Claude → zod validate → retry once → else {fallback}    │
│  POST /api/explain       → Claude → 2–3 sentences + least-certain assumption       │
│  GET  /api/weather       → NWS /points → forecastHourly (User-Agent set)           │
│                            → else cached demo weather + `cached: true`             │
│  ANTHROPIC_API_KEY read here only (process.env), never sent to the client          │
└────────────────────────────────────────────────────────────────────────────────────┘
```

**Key design decisions**
- **Grid:** 15×15, columns `A–O`, rows `1–15`, cell IDs like `C4`. Terrain is a hand-authored static map (`lib/terrain.ts`) with per-cell features: `trail`, `drainage`, `ridge`, `cliff`, `water`, `forest`, `open`, plus elevation. One trail junction sits near the center for the demo LKP.
- **State model:** `{ grid: Terrain, lkp, profile, poa: Record<CellId, number>, row: number, cumulativePod: Record<CellId, number>, sweeps[], clues[], assignments[], audit[], weather }`. Probabilities stored as one vector (cells + ROW) so sum-to-1 is checked in one place.
- **Engine is pure:** no React, no fetch. Every state change to probabilities goes through `applySweep` / `applyClue` / `setPriors`, each of which asserts `|Σ − 1| < 1e-9` and renormalises only float drift (throws on real violations in tests).
- **Claude never writes to the model directly.** API responses become a *draft* in the ReviewCard; only the IC's Apply dispatches the update.
- **Fallback chain for parsing:** Claude → (invalid JSON) retry once → manual mode. In demo mode, a canned parse for each scripted report is used if the API call fails.
- **Model ID** in one constant: `lib/claude.ts` → `export const CLAUDE_MODEL = "claude-sonnet-5-5"` (a current model from the Anthropic docs; confirmed via the claude-api reference before Milestone 4).
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
│  ├─ layout.tsx                 # dark ops-console shell, persistent safety footer
│  ├─ page.tsx                   # main console
│  ├─ globals.css
│  └─ api/
│     ├─ parse-report/route.ts   # Claude → ParsedReport (zod), retry once
│     ├─ explain/route.ts        # Claude → explanation + least-certain assumption
│     └─ weather/route.ts        # NWS proxy + cached fallback
├─ components/
│  ├─ GridMap.tsx  TerrainLayer.tsx  HeatmapLayer.tsx
│  ├─ SetupPanel.tsx  ProfilePicker.tsx  PriorEditor.tsx  RowIndicator.tsx
│  ├─ ReportPanel.tsx  ReviewCard.tsx  ManualEntry.tsx  ExplanationCard.tsx
│  ├─ SuggestionsPanel.tsx  OverrideReasonDialog.tsx
│  ├─ CluePanel.tsx  WeatherPanel.tsx  SummitCard.tsx
│  ├─ AuditLog.tsx  DemoControls.tsx  SafetyFooter.tsx
├─ lib/
│  ├─ engine/
│  │  ├─ grid.ts          # CellId helpers, neighbours, distance
│  │  ├─ priors.ts        # distance × terrain × profile → POA, + ROW
│  │  ├─ bayes.ts         # applySweep, applySweeps, cumulativePod, assertSumToOne
│  │  ├─ rank.ts          # POA × expected POD × weather modifier → top 5
│  │  └─ clues.ts         # IC-chosen boost around a cell, renormalise
│  ├─ terrain.ts          # static White Mountains-style map
│  ├─ profiles.ts         # 5 profiles, illustrative weights (labelled as such)
│  ├─ weather.ts          # NWS types, POD modifiers, exposure risk, safety flags
│  ├─ schemas.ts          # zod: ParsedReport, Explanation, Weather
│  ├─ claude.ts           # CLAUDE_MODEL constant + prompt text (no key)
│  ├─ server/anthropic.ts # server-only client factory
│  ├─ store.ts            # reducer, actions, localStorage persistence
│  ├─ audit.ts            # audit entry types + JSON export
│  └─ demo/
│     ├─ scenario.ts      # LKP, profile, 4 scripted reports, 1 clue, family tip
│     ├─ canned.ts        # canned parses + explanations
│     └─ weather.json     # cached Mt Washington forecast
├─ tests/                 # vitest: bayes, priors, rank, clues, weather, schemas
├─ .env.example  .gitignore  PLAN.md  NOTES.md  CLAUDE.md  README.md
└─ package.json  tsconfig.json  vitest.config.ts  next.config.ts
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
- [ ] `bayes.ts`: `P_i' = P_i(1−p)/(1−P_i·p)`, others `/ (1−P_i·p)`, sequential over cells, ROW included
- [ ] `assertSumToOne`; `cumulativePod = 1 − Π(1−p_k)`
- [ ] `priors.ts`: distance decay × terrain multipliers × profile tendency; ROW starts at 10%; normalise
- [ ] `profiles.ts`: day hiker, child, hunter, older adult, trail runner — marked "illustrative estimates"
- [ ] Tests: sum-to-1 after every op, hand-computed single update, p=0 no-op, p=1 zeroes cell, sequential = repeated single, cumulative POD, ROW grows after sweeps, priors sum to 1 for every profile
- [ ] `npm test` + build pass; commit

### M3 — Interactive grid (first end-to-end, target ~midnight)
- [ ] Store/reducer + localStorage (try/catch)
- [ ] Click to place LKP; profile picker regenerates priors
- [ ] Heatmap overlay with animated transitions; cell hover shows POA + cumulative POD
- [ ] Prior editor (edit a cell's POA, auto-renormalise others) — only before search starts
- [ ] ROW always visible, with trend
- [ ] Manual report entry: team, cells, POD → Apply → update
- [ ] Reset search; verify in browser; commit

### M4 — Claude parse + review + explain
- [ ] Confirm current model ID via claude-api reference; set `CLAUDE_MODEL`
- [ ] `/api/parse-report`: system prompt → JSON; zod validate; retry once; else `{ok:false}`
- [ ] ReviewCard: every field editable; low confidence → amber + "verify with team" above details; unclear_points listed
- [ ] Nothing changes until Apply; failure → manual mode with message
- [ ] `/api/explain`: 2–3 sentences + least-certain assumption, given before/after diff
- [ ] Audit: raw report, AI proposal, IC edits (diff), applied values
- [ ] Schema tests; build; manual check with and without key; commit

### M5 — Weather (NWS)
- [ ] `/api/weather`: `/points/44.27,-71.30` → `forecastHourly`, `User-Agent: TrailheadSAR (hackathon demo)`, timeout
- [ ] Cached demo weather fallback + "using cached weather" badge
- [ ] POD modifiers (fog, rain, snow, darkness) with visible text, e.g. "fog: −30% expected detection"
- [ ] Urgency panel: temp, wind, wind chill, exposure risk label (low/moderate/high/severe) — **no survival time**
- [ ] Team safety flags (e.g. ridge cells + wind > 50 mph)
- [ ] Tests for modifiers / wind chill / risk label; commit

### M6 — Suggestions, overrides, clues, audit export
- [ ] `rank.ts`: score = POA × expected POD (weather-adjusted); top 5 of unsearched/under-searched; tested
- [ ] SuggestionsPanel labelled "suggestions"; IC assigns team to any cell
- [ ] Picking non-top suggestion → optional one-line reason dialog → logged
- [ ] CluePanel: text + cell + IC-chosen boost (none/small/medium/large) and radius; AI never weights clues; tested
- [ ] Audit log view + Export JSON; never a "stop search" recommendation anywhere
- [ ] Commit

### M7 — Demo mode
- [ ] "Load demo scenario": LKP at trail junction, day hiker
- [ ] Step-through of 4 reports + 1 clue + family-tip override, per the scripted story (trail corridor cleared → fog sweep → clue shifts to drainage → override → found in cell both pointed to)
- [ ] Canned parses/explanations used when Claude fails; cached weather when NWS fails
- [ ] Run full demo with network blocked to API; commit

### M8 — Polish
- [ ] Serious dark ops-console styling, light mode friendly
- [ ] Responsive layout (laptop + tablet), empty states, loading spinners/skeletons
- [ ] Accessibility pass (labels, focus, color + text for amber warnings)
- [ ] Update NOTES.md with pitch answers (who/what could go wrong/helps not decides); commit

### M9 — (Optional) Summit conditions card
- [ ] Link-out card to Mount Washington Observatory webcam + Higher Summits Forecast (no scraping/hotlinking)
- [ ] Commit

## 5. Per-milestone routine
Build → tests → run app and check the feature → commit → push to `claude/funny-johnson-necpxn` → tick box here. Main is never left broken; reliability of the demo path beats extra features.
