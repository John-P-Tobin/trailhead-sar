# Round 4: Ant-style UI kit, real elevation, richer weather — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Before the 6:30 a.m. ET freeze, make Trailhead look and feel like a serious Ant-Design-style operations console, show real per-cell elevation and a fuller NWS forecast, and keep the 7-step demo working end to end.

**Architecture:** Six PRs in order, each leaving main deployable: (A) live health check, (B) a Tailwind-only UI kit in `components/ui/` and a pure refactor of every panel onto it, (C) a bundled USGS elevation grid (`data/elevation.json`) plugged into `buildTerrainModel` plus an elevation map layer, (D) NWS grid-data extras and pure weather helpers with a redesigned weather panel and chart, (E) header status bar + tabbed right column, (F) docs. Engine math (`lib/engine/`) is untouched; only scenario values may move if the demo ranking shifts.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind 4 (`@theme` tokens in `app/globals.css`), vitest (node, `tests/**/*.test.ts`), Playwright MCP for browser checks. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-round4-design.md`

## Global Constraints

- Feature freeze **Sat Oct 31, 6:30 a.m. ET**; after that only bug fixes. Video due 10:00 a.m.
- Do **not** install antd or any component/icon library. Ant patterns are rebuilt in Tailwind.
- No DOM test runner is installed (vitest runs in node with no jsdom/testing-library). UI-only tasks verify with `npx tsc --noEmit`, `npm run lint`, `npm run build` and a Playwright click-through; pure logic goes in `lib/` with vitest tests.
- Never show a survival-time number. Exposure risk stays a label (low/moderate/high/severe).
- Priors, POD factors and elevation-derived temperatures are labelled "illustrative" / "estimate" in the UI.
- No text smaller than 12 px (`text-xs`). Replace every `text-[10px]` / `text-[11px]`.
- Footer copy stays exactly: "Decision support only. The incident commander directs all search operations."
- The demo must run fully offline: bundled terrain, bundled elevation, canned parses, cached weather.
- `tests/demo.test.ts` must pass unchanged in its assertions (clue cell #1, override cell #3, found there, override lower than clue). Only `lib/demo/scenario.ts` POD/cells may be retuned, never engine code.
- Every PR: `npm test && npm run lint && npm run build` pass → push → `gh pr create --base main` → `gh pr merge --merge` → wait for Vercel → live check.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; PR bodies end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- `ANTHROPIC_API_KEY` and the CalTopo key never enter the client bundle or the repo.

## Review Focus

1. `data/elevation.json` missing a cell (or absent entirely) → `buildTerrainModel` must fall back to the peak estimate for that cell with no `NaN`; pinned in Task 9.
2. NWS gridpoint arrays containing `null` values or `wmoUnit:m_s-1` instead of `km_h-1` → extras parse to `undefined`, never `NaN`, and the route still returns `source: "live"`; pinned in Task 12.
3. Stylized terrain cells have no `elevationM` → `tempAtElevation`/`cellConditions` return the station values unchanged; pinned in Task 13.
4. A search restored from localStorage saved before Round 4 has `CellTerrain` without `slopeDeg`/`aspect`/`elevationMin` → inspector shows "—" and `describeCell` omits the steep tag; pinned in Task 9.
5. Weather snapshots with fewer than 12 periods (end of cached demo window) → the forecast chart scales from whatever exists and renders no empty bars; pinned in Task 14.

---

## PR A — Live health check

### Task 1: Verify the deployed app end to end (no code unless broken)

**Files:** none (notes go to `NOTES.md` only if something is found)

- [ ] **Step 1: Load https://trailhead-sar.vercel.app with Playwright (`browser_navigate`, `browser_snapshot`).** Expected: title "Trailhead", footer present, weather badge "Live NWS".
- [ ] **Step 2: Outside demo mode, click a cell to place the LKP.** Expected: terrain badge becomes "Live OSM" within 40 s, or the bundled fallback note appears under the map (Overpass overloaded is acceptable; note it).
- [ ] **Step 3: Type a free-text report ("Team 2 swept C4 through C6, thick spruce, spacing maybe 20 meters, fog rolling in, no clues."), click Parse with Claude, Apply to map.** Expected: review card filled, explanation card says "Written by Claude".
- [ ] **Step 4: Reset → Load demo scenario → run all 7 steps, choosing `small ×1.5` at the clue.** Expected: suggestions after r4 list G13, G11, G14 in that order; banner after found reads "model suggestion #3 · IC override".
- [ ] **Step 5: Click Export for CalTopo.** Expected: a `.geojson` download is logged in the audit log.
- [ ] **Step 6: If any step fails, fix it on branch `round4-healthcheck` with a regression test, run `npm test && npm run lint && npm run build`, PR, merge. Otherwise record "health check 2026-10-31 HH:MM passed" in `NOTES.md` under "Before recording" in PR F.**

---

## PR B — UI kit (branch `round4-ui-kit`)

### Task 2: Design tokens

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces Tailwind utilities used by every later task: `bg-surface`, `bg-surface-2`, `bg-surface-3`, `border-line`, `text-fg`, `text-fg-2`, `text-fg-3`, `bg-primary`, `text-primary`, `bg-success`, `bg-warning`, `bg-error`, `bg-info` (+ `/10` alpha variants via Tailwind), `rounded-card`.

- [ ] **Step 1: Add an `@theme` block (not `@theme inline`) to `app/globals.css` with exactly these tokens:**

```css
--color-surface: #0f172a;    /* card */
--color-surface-2: #111c33;  /* elevated / list row */
--color-surface-3: #182540;  /* hover */
--color-line: #273449;       /* borders */
--color-fg: #e6edf5;
--color-fg-2: #a3b1c6;
--color-fg-3: #6b7a93;
--color-primary: #1677ff;    /* Ant blue */
--color-success: #52c41a;
--color-warning: #faad14;
--color-error: #ff4d4f;
--color-info: #1677ff;
--radius-card: 8px;
```
Keep `--background: #0b1220` and the system font stack. Remove the `@theme inline` block (the two old tokens become `--color-background` / `--color-foreground` inside the new `@theme`).

- [ ] **Step 2: Run `npm run build`.** Expected: succeeds; the site looks identical (tokens unused yet).
- [ ] **Step 3: Commit** `style: add Ant-style design tokens`.

### Task 3: Core primitives — Card, Button, Tag, Alert, Statistic, Empty, Skeleton, icons

**Files:**
- Create: `components/ui/Card.tsx`, `components/ui/Button.tsx`, `components/ui/Tag.tsx`, `components/ui/Alert.tsx`, `components/ui/Statistic.tsx`, `components/ui/Empty.tsx`, `components/ui/Skeleton.tsx`, `components/ui/icons.tsx`
- Modify: `components/ui/styles.ts` (keep only `input` and `label`; delete `btn*`)

**Interfaces (Produces):**
```ts
// Card.tsx
export default function Card(p: { title?: ReactNode; extra?: ReactNode; footer?: ReactNode; size?: "default"|"small"; className?: string; bodyClassName?: string; children: ReactNode }): JSX.Element
// Button.tsx
export type ButtonVariant = "primary" | "default" | "text" | "danger";
export default function Button(p: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm"|"md"; loading?: boolean; icon?: ReactNode; block?: boolean }): JSX.Element
// Tag.tsx
export type TagColor = "default" | "primary" | "success" | "warning" | "error" | "info" | "purple";
export default function Tag(p: { color?: TagColor; icon?: ReactNode; title?: string; className?: string; children: ReactNode }): JSX.Element
// Alert.tsx
export default function Alert(p: { type: "info"|"success"|"warning"|"error"; title?: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }): JSX.Element
// Statistic.tsx
export default function Statistic(p: { label: ReactNode; value: ReactNode; suffix?: ReactNode; hint?: ReactNode; tone?: "default"|"warning"|"error"|"success"; size?: "md"|"lg" }): JSX.Element
// Empty.tsx
export default function Empty(p: { title: string; hint?: ReactNode; action?: ReactNode }): JSX.Element
// Skeleton.tsx
export default function Skeleton(p: { lines?: number; className?: string }): JSX.Element
// icons.tsx — 16px stroke icons, each `(p: SVGProps<SVGSVGElement>) => JSX.Element`:
export { IconRadio, IconMap, IconCloud, IconWarning, IconInfo, IconCheck, IconClose, IconSearch, IconClue, IconUser, IconDownload, IconRefresh, IconMountain, IconWind, IconDrop, IconMoon, IconChevronDown, IconLoader }
```

- [ ] **Step 1: Create the eight files with the signatures above.** Styling rules (Ant dark): Card = `rounded-card border border-line bg-surface`, header `px-4 py-2.5 text-sm font-semibold text-fg` with `extra` right-aligned, body `p-4` (`p-3` for small). Button primary = `bg-primary text-white hover:brightness-110`, default = `border border-line bg-surface-2 text-fg hover:bg-surface-3`, text = `text-fg-2 hover:bg-surface-3`, danger = `border border-error/60 text-error hover:bg-error/10`; `loading` swaps `icon` for a spinning `IconLoader` and sets `disabled`; focus ring `focus-visible:ring-2 ring-primary/60`. Tag = `inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium` with `bg-{color}/15 text-{color} border border-{color}/30`. Alert = left border 3 px in the type colour, icon from `icons.tsx`, `bg-{color}/10`, `title` 14 px semibold, `description` 13 px `text-fg-2`. Statistic = label `text-xs uppercase tracking-wide text-fg-3`, value `text-2xl` (`text-3xl` for lg) tabular-nums. Empty = centred `IconSearch` in `text-fg-3`, title 14 px, hint 13 px.
- [ ] **Step 2: Remove `btn`, `btnPrimary`, `btnSecondary`, `btnGhost` from `styles.ts`.** Expected: `npx tsc --noEmit` now lists every call site (used in Task 6).
- [ ] **Step 3: Run `npm run lint`.** Expected: no errors in `components/ui/*`.
- [ ] **Step 4: Commit** `feat(ui): Card, Button, Tag, Alert, Statistic, Empty, Skeleton, icons`.

### Task 4: Structural primitives — Descriptions, Steps, Segmented, Tooltip, Tabs

**Files:**
- Create: `components/ui/Descriptions.tsx`, `components/ui/Steps.tsx`, `components/ui/Segmented.tsx`, `components/ui/Tooltip.tsx`, `components/ui/Tabs.tsx`

**Interfaces (Produces):**
```ts
export default function Descriptions(p: { items: { label: ReactNode; value: ReactNode; span?: 1|2 }[]; columns?: 1|2; size?: "sm"|"md"; className?: string }): JSX.Element
export interface Step { key: string; title: string; description?: ReactNode; status?: "wait"|"process"|"finish"|"error" }
export default function Steps(p: { steps: Step[]; current: number; direction?: "horizontal"|"vertical"; size?: "sm"|"md"; onStepClick?: (i: number) => void }): JSX.Element
export default function Segmented<T extends string>(p: { options: { value: T; label: ReactNode; disabled?: boolean; title?: string }[]; value: T; onChange: (v: T) => void; size?: "sm"|"md"; block?: boolean; "aria-label": string }): JSX.Element
export default function Tooltip(p: { content: ReactNode; placement?: "top"|"bottom"; children: ReactElement }): JSX.Element   // CSS :hover/:focus-within, role="tooltip", no portal
export interface Tab { key: string; label: ReactNode; badge?: ReactNode; content: ReactNode }
export default function Tabs(p: { tabs: Tab[]; active: string; onChange: (key: string) => void; className?: string }): JSX.Element  // role="tablist"/"tab"/"tabpanel", arrow-key navigation
```

- [ ] **Step 1: Create the five files.** Steps: numbered 24 px circles, `finish` = primary filled with `IconCheck`, `process` = primary ring, `wait` = `border-line text-fg-3`, connector line `bg-line` (`bg-primary` when finished). Segmented: `bg-surface-2 p-0.5 rounded-md`, selected option `bg-surface-3 text-fg shadow-sm`. Tabs: underline style, active tab `border-b-2 border-primary text-fg`, inactive `text-fg-2`; `badge` renders a small `Tag`.
- [ ] **Step 2: `npx tsc --noEmit` and `npm run lint`.** Expected: clean for the new files.
- [ ] **Step 3: Commit** `feat(ui): Descriptions, Steps, Segmented, Tooltip, Tabs`.

### Task 5: Modal + `useConfirm`, replacing native dialogs

**Files:**
- Create: `components/ui/Modal.tsx`, `components/ui/ConfirmProvider.tsx`
- Modify: `components/ConsoleLoader.tsx` (wrap in `ConfirmProvider`), `components/Console.tsx:168,181`, `components/DemoControls.tsx:76-84`

**Interfaces (Produces):**
```ts
export default function Modal(p: { open: boolean; title: ReactNode; onClose: () => void; footer?: ReactNode; danger?: boolean; children: ReactNode }): JSX.Element   // <dialog>-less: fixed overlay, role="dialog" aria-modal, Escape closes, focus moves to first button
export interface ConfirmOptions { title: string; content?: ReactNode; okText?: string; cancelText?: string; danger?: boolean }
export function ConfirmProvider(p: { children: ReactNode }): JSX.Element
export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean>
```

- [ ] **Step 1: Implement Modal and ConfirmProvider.** The provider holds one pending `{opts, resolve}`; `useConfirm` returns a function that sets it and returns the promise; OK resolves `true`, Cancel/Escape/overlay click resolve `false`; a second call while one is open resolves the first as `false`.
- [ ] **Step 2: Replace the three native dialogs.** `resetAll` and `loadDemo` in `Console.tsx` become `async` and `await confirm({ title: "Reset the whole search?", content: "This clears the map, reports and audit log.", okText: "Reset", danger: true })` / `{ title: "Load the demo scenario?", content: "This replaces the current search.", okText: "Load demo" }`. `DemoControls` clue buttons: `{ title: \`Apply a ${b} boost?\`, content: \`The demo script uses a ${current.suggestedBoost} boost; ${b} changes the suggestion ranking later in the story.\`, okText: \`Apply ${b}\` }` — keep the suggested boost confirmation-free.
- [ ] **Step 3: Verify with Playwright on `npm run dev`:** click Reset → modal appears → Escape → state unchanged; click Reset → OK → map cleared. In demo, click `medium ×2.5` → modal → Cancel → step unchanged; click `small ×1.5` → no modal, step advances.
- [ ] **Step 4: Commit** `feat(ui): Modal and useConfirm replace native confirm()`.

### Task 6: Migrate every panel onto the kit (pure refactor)

**Files:**
- Modify: all of `components/*.tsx`; delete `components/ui/Panel.tsx`
- Test: existing `tests/**` unchanged

Mapping, applied file by file (same copy, same behaviour):
- `Panel` → `Card` (title in sentence case, `extra` for the right slot).
- `btnPrimary/btnSecondary/btnGhost` → `<Button variant="primary|default|text">`; async actions get `loading` (`parsing`, explanation loading, weather refresh, terrain fetch).
- Badge strings in `WeatherPanel.tsx:106,111`, `TerrainBadge.tsx:31`, suggestion ⚠ → `Tag` with `IconWarning`.
- Amber boxes in `ReportInput.tsx:30`, `Console.tsx:378`, `ReviewCard.tsx:53,63`, `ExplanationCard.tsx:26` → `Alert type="warning"`; the "verify with team" banner keeps that exact phrase as `title`.
- `CellInspector.tsx:60` local `Stat`, `RowIndicator` big number, `WeatherPanel` current temp → `Statistic`.
- `WelcomeCard` numbered list → `Steps direction="vertical"`; `DemoControls` step chips → `Steps size="sm"` horizontal; boost buttons → three `Button`s (suggested = primary).
- Empty states ("No suggestions yet", "No clues", "No reports applied") → `Empty`.
- Native `title=` tooltips on badges/buttons → `Tooltip`.
- Every `text-[10px]`/`text-[11px]` → `text-xs`.
- Hand-rolled "Subject located" block (`Console.tsx:311-326`) → `Alert type="success"` inside a `Card`.

- [ ] **Step 1: Migrate `components/ui`-adjacent small files first** (SafetyFooter, TerrainBadge, MapLegend, RowIndicator, ExplanationCard, WelcomeCard, SummitCard, ReportInput). `npx tsc --noEmit` after each.
- [ ] **Step 2: Migrate the large files** (ReviewCard, WeatherPanel, SuggestionsPanel, CluePanel, AuditLog, CellInspector, DemoControls, SetupPanel, Console). Delete `Panel.tsx` when the last import is gone.
- [ ] **Step 3: Run `npm test && npm run lint && npm run build`.** Expected: 109+ tests pass, lint clean, build succeeds.
- [ ] **Step 4: Playwright: run the full 7-step demo on `npm run dev`; take screenshots at 1440×900 and 820×1180 (`browser_resize`, `browser_take_screenshot`).** Expected: identical behaviour, consistent spacing, no 10–11 px text.
- [ ] **Step 5: Commit** `refactor(ui): move all panels onto the shared kit`; push; PR "Round 4a: Ant-style UI kit"; merge when green; confirm the live demo still runs.

---

## PR C — Real elevation (branch `round4-elevation`)

### Task 7: Pure elevation math

**Files:**
- Create: `lib/elevation.ts`
- Test: `tests/elevation.test.ts`

**Interfaces (Produces):**
```ts
export type Aspect = "N"|"NE"|"E"|"SE"|"S"|"SW"|"W"|"NW"|"flat";
export interface CellElevation { minM: number; meanM: number; maxM: number; slopeDeg: number; aspect: Aspect }
export interface ElevationFile { source: string; attribution: string; fetchedAt: string; bbox: [number, number, number, number]; samplesPerCell: number; cells: Record<string, CellElevation> }
/** Least-squares plane through samples given in metres east (x), metres north (y), metres up (z). */
export function fitSlope(samples: { x: number; y: number; z: number }[]): { slopeDeg: number; aspect: Aspect }
/** Aggregate a cell's samples (needs ≥3 non-collinear points; otherwise slope 0 / "flat"). */
export function summarizeCell(samples: { x: number; y: number; z: number }[]): CellElevation
export const STEEP_DEG = 35;
export const ELEVATION_ATTRIBUTION = "Elevation: USGS 3DEP";
```

- [ ] **Step 1: Write failing tests in `tests/elevation.test.ts`:**
  - `fitSlope` on a plane z = 0.5·x (rising to the east) → `slopeDeg ≈ 26.57` (±0.1), `aspect "W"` (downslope faces west).
  - `fitSlope` on z = -1·y (falling to the north) → `slopeDeg ≈ 45`, `aspect "N"`.
  - `fitSlope` on a flat plane → `slopeDeg 0`, `aspect "flat"`.
  - `summarizeCell` of 16 samples 1500..1530 → `minM 1500`, `maxM 1530`, `meanM 1515`.
  - `summarizeCell` with 2 samples → `slopeDeg 0`, `aspect "flat"`, no `NaN`.
- [ ] **Step 2: `npx vitest run tests/elevation.test.ts`.** Expected: FAIL (module not found).
- [ ] **Step 3: Implement `lib/elevation.ts`.** Aspect = compass bearing of the downslope vector `(-dz/dx, -dz/dy)` bucketed into 8 sectors; `"flat"` when `slopeDeg < 1`.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(elevation): plane-fit slope and aspect helpers`.

### Task 8: Fetch script and bundled grid

**Files:**
- Create: `scripts/fetch-elevation.ts`, `data/elevation.json` (generated)
- Modify: `package.json` scripts (`"fetch-elevation": "tsx scripts/fetch-elevation.ts"`), `NOTES.md` (one line: source + command)

**Interfaces:**
- Consumes: `summarizeCell`, `ElevationFile` from Task 7; `DEFAULT_BBOX`, `cellBounds` from `lib/geo.ts`; `ALL_CELLS` from `lib/engine/grid.ts`.
- Produces: `data/elevation.json` matching `ElevationFile`, `samplesPerCell: 16`, all 225 cell ids present.

- [ ] **Step 1: Write `scripts/fetch-elevation.ts`.** For each cell, sample a 4×4 lattice at `(i+0.5)/4, (j+0.5)/4` of the cell bounds (3,600 points). Primary: USGS EPQS `https://epqs.nationalmap.gov/v1/json?x={lon}&y={lat}&units=Meters&wkid=4326` (`value` field; concurrency 8, 10 s timeout, 2 retries). Fallback per failed point: Open-Meteo `https://api.open-meteo.com/v1/elevation?latitude=…&longitude=…` batched ≤100 points. Convert lat/lon offsets to metres with `cellSizeM` from `lib/osm.ts` (or `111_320 m/°` × cos(lat)). Write `source: "USGS 3DEP EPQS (fallback: Open-Meteo Copernicus DEM90)"`, `attribution: ELEVATION_ATTRIBUTION`. Print how many points came from each source. Abort if any cell lacks ≥3 samples.
- [ ] **Step 2: Run `npm run fetch-elevation`.** Expected: `data/elevation.json` ≈ 25 KB, 225 cells, `J6.maxM` within 1,900–1,920, `E10.meanM` within 1,500–1,560.
- [ ] **Step 3: Add a test to `tests/elevation.test.ts`: load `data/elevation.json`, assert 225 cells, every value finite, `J6.maxM > 1900`, `G14.meanM < G13.meanM`.** Run → PASS.
- [ ] **Step 4: Commit** `feat(elevation): bundled USGS 3DEP grid for the Mt Washington box`.

### Task 9: Plug real elevation into the terrain model

**Files:**
- Modify: `lib/terrain.ts:13-28` (`CellTerrain`), `lib/terrain.ts:86` (`describeCell`), `lib/osm.ts:396-401,482-509` (`buildTerrainModel`), `lib/terrainClient.ts:14-24`, `tests/helpers/bundled.ts`, `tests/osm.test.ts:133-136`, `tests/terrain.test.ts:56`
- Test: `tests/terrain.test.ts`

**Interfaces (Produces):**
```ts
// lib/terrain.ts
export interface CellTerrain { …existing; elevationM?: number; elevationMinM?: number; elevationMaxM?: number; slopeDeg?: number; aspect?: Aspect; elevationSource?: "usgs" | "estimate" }
// lib/osm.ts
export function buildTerrainModel(fc, bbox, source, opts: { fetchedAt?: string; label?: string; elevation?: Record<string, CellElevation> }): TerrainModel
// lib/terrainClient.ts
export function loadBundledElevation(): Promise<Record<string, CellElevation> | null>   // import("@/data/elevation.json"), null on failure
```

- [ ] **Step 1: Write failing tests in `tests/terrain.test.ts`:**
  - `bundledTerrain().model.cells.J6.elevationSource === "usgs"` and `elevationM` within 50 m of `elevation.json` `J6.meanM`.
  - `buildTerrainModel(fc, bbox, "bundled", { elevation: { J6: elev.J6 } })` → J6 is `"usgs"`, E10 is `"estimate"`, every cell's `elevation` in [0,1], no `NaN`.
  - `buildTerrainModel(fc, bbox, "bundled")` (no option) → every cell `"estimate"` (old behaviour).
  - `describeCell({ …cell, slopeDeg: 40 })` contains `"steep"`; `describeCell({ …cell, slopeDeg: undefined })` does not and still ends with the `~m` tag.
- [ ] **Step 2: Run `npx vitest run tests/terrain.test.ts`.** Expected: FAIL.
- [ ] **Step 3: Implement.** In `buildTerrainModel`, after `est` is computed: `const m = opts.elevation?.[id]?.meanM ?? est[i]`; normalise `elevation` over the merged values; set `elevationMinM/MaxM/slopeDeg/aspect/elevationSource`. `hasElevation` is true if either peaks or the option exist. `describeCell` appends `"steep"` when `slopeDeg >= STEEP_DEG`. `loadBundledTerrain` awaits `loadBundledElevation()` and passes it. `tests/helpers/bundled.ts` reads `data/elevation.json` and passes it the same way.
- [ ] **Step 4: Update `tests/osm.test.ts:133-136`** to build the fixture model without the option (it tests the estimate) — assertions unchanged. `tests/terrain.test.ts:56` (`J6.cover === "alpine"`) should still hold with real data; if not, that is a data problem — investigate before touching thresholds.
- [ ] **Step 5: Run `npm test`.** Expected: all pass **except possibly `tests/demo.test.ts`** → Task 10.
- [ ] **Step 6: Commit** `feat(elevation): terrain model uses the bundled USGS grid`.

### Task 10: Re-verify the demo story

**Files:**
- Modify (only if needed): `lib/demo/scenario.ts` canned `estimated_pod` / `cells`, `NOTES.md` demo section

- [ ] **Step 1: Run `npx vitest run tests/demo.test.ts`.** If PASS, skip to Step 4.
- [ ] **Step 2: If "override cell is the model's #3" fails:** print `rankCells(...)` top 6 after r4 with scores. Allowed knobs, in order: r3 fog POD (0.25 → 0.2–0.3), r4 POD (0.7 → 0.6–0.8), r2 cells (add/remove one hut-corridor cell). Not allowed: engine, profiles, terrain thresholds, clue boost (stays `small`). Re-run until the test passes with `small`; also assert by hand that `medium` still moves G14 to #2 or higher (so the DEMO.md warning stays true) — if not, update that sentence in `NOTES.md`/`DEMO.md`.
- [ ] **Step 3: If "override lower than clue" fails** (G14 meanM ≥ G13 meanM in real data): stop and report — the story needs a different downstream cell and that is the user's call.
- [ ] **Step 4: Run `npm test && npm run lint && npm run build`.** Expected: green.
- [ ] **Step 5: Commit** `test(demo): story verified on USGS elevation` (include any scenario retune in the same commit with the reason in the body).

### Task 11: Elevation on the map and in the inspector

**Files:**
- Modify: `components/GridMap.tsx:28-39,107,193,294`, `components/MapLegend.tsx`, `components/CellInspector.tsx`, `components/Console.tsx` (layer state + `Segmented` above the map), `lib/heat.ts`
- Test: `tests/heat.test.ts` (new)

**Interfaces (Produces):**
```ts
// lib/heat.ts
export function hypsoCss(t: number): string   // 0 → "#2d5a3d" (valley green) … 0.5 → "#b08a4e" … 1 → "#f3f4f6" (summit), clamped
// components/GridMap.tsx
export type MapLayer = "probability" | "elevation" | "terrain";
export interface GridMapProps { …existing; layer?: MapLayer /* default "probability" */; highlighted?: CellId[] }
```

- [ ] **Step 1: Write `tests/heat.test.ts`:** `hypsoCss(0)`, `hypsoCss(1)` equal the pinned colours; `hypsoCss(-1) === hypsoCss(0)`; `hypsoCss(2) === hypsoCss(1)`. Run → FAIL → implement → PASS.
- [ ] **Step 2: GridMap.** `layer === "elevation"`: cell fill = `hypsoCss(cell.elevation)`, heatmap hidden, cells with `slopeDeg >= STEEP_DEG` get a diagonal hatch pattern (`<pattern id="steep">`), peak labels become `"{name} {ele} m"`. `layer === "terrain"`: cover fills, no heat. `highlighted` cells get a 2 px `stroke-primary` outline (used by Task 14). The tooltip `<title>` gains `"{elevationM} m · slope {slopeDeg}° {aspect}"` when present.
- [ ] **Step 3: MapLegend.** When `layer === "elevation"`, show a 5-stop hypsometric bar labelled with the grid's min/max metres and a "steep ≥35°" hatch swatch; add the line `Elevation: USGS 3DEP` next to the OSM attribution when any cell is `"usgs"`.
- [ ] **Step 4: Console.** `const [layer, setLayer] = useState<MapLayer>("probability")`; render `<Segmented aria-label="Map layer" options={[{value:"probability",label:"Probability"},{value:"elevation",label:"Elevation"},{value:"terrain",label:"Terrain"}]} …/>` in the map Card's `extra`.
- [ ] **Step 5: CellInspector.** Replace the terrain text line with `Descriptions` items: Terrain (`describeCell` tags as `Tag`s), Elevation (`"{min}–{max} m (mean {mean})"` or `"~{elevationM} m (estimate)"`; `"—"` when undefined), Slope (`"{slopeDeg}° facing {aspect}"` or `"—"`), Corner coordinates. Steep cells get an `Alert type="warning" title="Steep ground (≥35°)"`.
- [ ] **Step 6: `npm test && npm run lint && npm run build`; Playwright screenshot of the elevation layer at 1440 px.** Expected: Mt Washington cell lightest, Ammonoosuc and Dry River drainages darkest.
- [ ] **Step 7: Commit** `feat(map): elevation layer, hypsometric legend, inspector elevation details`; push; PR "Round 4b: real elevation (USGS 3DEP)"; merge when green; live check demo + layer toggle.

---

## PR D — Richer weather (branch `round4-weather`)

### Task 12: NWS gridpoint extras in the route

**Files:**
- Modify: `lib/weather.ts:7-16,18-24,35-57`, `app/api/weather/route.ts`, `lib/demo/weather.ts` (add `elevationM: 1540` to the cached snapshot)
- Test: `tests/weather.test.ts`

**Interfaces (Produces):**
```ts
export interface HourlyPeriod { …existing; windGustMph?: number; humidityPct?: number; visibilityMi?: number; skyCoverPct?: number }
export interface WeatherSnapshot { …existing; elevationM?: number }
export interface GridExtras { gusts: TimedValue[]; humidity: TimedValue[]; visibility: TimedValue[]; skyCover: TimedValue[]; elevationM?: number }
export interface TimedValue { start: number /* epoch ms */; end: number; value: number }
export function parseNwsGrid(json: unknown): GridExtras            // tolerant: null values skipped; km_h-1 and m_s-1 → mph; metres → miles
export function mergeGridExtras(periods: HourlyPeriod[], extras: GridExtras): HourlyPeriod[]   // value whose [start,end) contains period.startTime
```

- [ ] **Step 1: Failing tests.** A fixture gridpoint JSON with `windGust.uom "wmoUnit:km_h-1"`, values `[{validTime:"2026-10-31T02:00:00+00:00/PT3H", value: 64.8}, {…, value: null}]`, `visibility` in `wmoUnit:m` `[{…, value: 400}]`, `elevation.value 1540`. Assert: `parseNwsGrid` → one gust `{value: 40.3±0.1}` (null skipped), visibility `0.25±0.01 mi`, `elevationM 1540`; `mergeGridExtras` assigns `windGustMph` to the periods at 02:00, 03:00, 04:00 and leaves 05:00 `undefined`; a fixture with `uom "wmoUnit:m_s-1"` and value 20 → `44.7 mph`; `parseNwsGrid({})` → empty arrays, no throw.
- [ ] **Step 2: Run → FAIL. Implement. Run → PASS.** ISO interval parsing: split on `/`, duration `PT(\d+)H` (and `P(\d+)D` + `T…H`); default 1 h.
- [ ] **Step 3: Route.** After `points`, also read `properties.forecastGridData`; fetch it in parallel with `forecastHourly` via `Promise.allSettled`; on fulfilment merge extras and set `snap.elevationM`; on rejection keep the plain hourly snapshot (still `source: "live"`). Keep `.slice(0, 24)`.
- [ ] **Step 4: `npm test`; then `curl -s localhost:3000/api/weather | jq '.elevationM, .periods[0].windGustMph'`** on `npm run dev`. Expected: `1540`-ish number and a gust value (or `null` if NWS omits it).
- [ ] **Step 5: Commit** `feat(weather): gusts, humidity, visibility, sky cover and grid elevation from NWS gridpoints`.

### Task 13: Pure weather helpers for elevation and cells

**Files:**
- Modify: `lib/weather.ts:96-110` (`podModifiers`), append new helpers
- Test: `tests/weather.test.ts`

**Interfaces (Produces):**
```ts
export const LAPSE_F_PER_M = 0.0117;   // 6.5 °C/km standard lapse, as °F per metre
export function tempAtElevation(tempF: number, fromM: number | undefined, toM: number | undefined): number   // either undefined → tempF
export interface CellConditions { tempF: number; windMph: number; windChillF: number; usesGust: boolean; estimated: boolean }
export function cellConditions(p: HourlyPeriod, cell: CellTerrain, stationElevM: number | undefined): CellConditions
   // ridge or alpine cells use windGustMph when present (usesGust true); estimated = elevation adjustment applied
export function nextDarkness(periods: HourlyPeriod[], now?: number): string | null   // startTime of first !isDaytime period after now; null if none or already dark
```
`podModifiers` adds `visibility` to the fog branch: `visibilityMi !== undefined && visibilityMi < 0.5` triggers the existing `fog` modifier (no duplicate if `shortForecast` already says fog).

- [ ] **Step 1: Failing tests:** `tempAtElevation(40, 1540, 1917)` → `35.6±0.1`; `tempAtElevation(40, undefined, 1917)` → `40`; `cellConditions` on an alpine cell at 1917 m with gust 50 → `windMph 50, usesGust true, estimated true`, `windChillF === windChillF(tempF, 50)`; on a stylized cell (no `elevationM`) → `estimated false`, `tempF` unchanged; `nextDarkness` with periods day,day,night starting 14:00 → the 16:00 `startTime`; all-night → `null`; `podModifiers({…fair, visibilityMi: 0.25})` includes key `"fog"` exactly once.
- [ ] **Step 2: Run → FAIL. Implement. Run → PASS.**
- [ ] **Step 3: Commit** `feat(weather): elevation-adjusted temperature, per-cell conditions, next darkness`.

### Task 14: Weather panel redesign, forecast chart, flagged-cell highlight

**Files:**
- Create: `components/weather/ForecastChart.tsx`, `lib/chartScale.ts`
- Modify: `components/WeatherPanel.tsx`, `components/CellInspector.tsx`, `components/Console.tsx` (highlight state → `GridMap highlighted`), `components/SuggestionsPanel.tsx` (weather factor banner → `Alert type="info"` with the per-modifier `Tag`s)
- Test: `tests/chartScale.test.ts`

**Interfaces (Produces):**
```ts
// lib/chartScale.ts
export function niceDomain(values: number[], pad?: number): [number, number]   // [] → [0, 1]; single value v → [v-5, v+5]; else rounded to 5s with pad (default 5)
export function scaleLinear(domain: [number, number], range: [number, number]): (v: number) => number
// components/weather/ForecastChart.tsx
export default function ForecastChart(p: { periods: HourlyPeriod[]; hours?: number /* default 12 */; nowMs?: number }): JSX.Element
// Console → GridMap
highlighted: CellId[]   // set by WeatherPanel.onHighlightCells(cells) and CellInspector; cleared on map click
```

- [ ] **Step 1: Read the `dataviz` skill before writing the chart.** Then failing tests for `niceDomain`: `[]` → `[0,1]`; `[41]` → `[36,46]`; `[38, 52]` → `[30, 60]` (floor/ceil to 5 with pad 5); `scaleLinear([0,10],[0,100])(5) === 50`. Run → FAIL → implement → PASS.
- [ ] **Step 2: `ForecastChart`.** Inline SVG, `viewBox 0 0 360 120`, responsive width. Night periods shaded `fill-surface-2`; temperature line (and a dashed wind-chill line when it differs), wind bars with a lighter gust cap when `windGustMph` exists, precip % as small dots along the top, hour labels every 3 h, a "now" marker. Renders with `periods.length` 1–24 (empty periods → `Empty title="No forecast yet"`). Colours from the dataviz palette; text ≥ 12 px; `role="img"` with an `aria-label` summary sentence.
- [ ] **Step 3: `WeatherPanel`.** Layout top → bottom: header `extra` = source `Tag` + Refresh `Button loading`; `Statistic size="lg"` current temp with `hint` = wind chill; `Descriptions columns=2` (Wind + gust, Humidity, Visibility, Sky cover, Precip chance, Darkness from `nextDarkness`, "At summit (1,917 m)" via `tempAtElevation`, "At LKP" when the LKP cell has `elevationM`) — items with `undefined` data show "—"; exposure `Alert` (type by level: low→info, moderate→warning, high/severe→error) with reasons; POD modifier `Tag`s with the combined factor; `ForecastChart`; safety flags as `Alert`s whose action is a `Button variant="text"` "Show {n} cells" calling `onHighlightCells(f.cells)`; footer text "Illustrative thresholds. No survival estimates are shown; that is a medical and command judgment."
- [ ] **Step 4: `CellInspector`.** Add a "Conditions now" `Descriptions` block from `cellConditions(currentPeriod, cell, weather.elevationM)`: temp (`"≈"` prefix when `estimated`), wind (gust note when `usesGust`), wind chill; plus any `safetyFlags` entry whose `cells` include this cell as an `Alert`.
- [ ] **Step 5: `npm test && npm run lint && npm run build`; Playwright: weather tab at 1440 and 820 px, click "Show cells" on a flag → outlined cells on the map.**
- [ ] **Step 6: Commit** `feat(weather): redesigned panel, 12-hour forecast chart, flagged-cell highlight`; push; PR "Round 4c: richer weather"; merge when green; live check `/api/weather` shows `elevationM` and the chart renders.

---

## PR E — Layout and flow (branch `round4-layout`)

### Task 15: Header status bar

**Files:**
- Create: `components/StatusBar.tsx`
- Modify: `components/Console.tsx:250-268`

**Interfaces (Produces):**
```ts
export default function StatusBar(p: { lkp: CellId | null; profileLabel: string | null; startedAt: number | null; row: number | null; exposure: ExposureLevel | null; weatherSource: "live"|"cached"|null; terrainSource: TerrainSource; found: CellId | null }): JSX.Element
```

- [ ] **Step 1: Implement.** One row of `Statistic size="md"`/`Tag`s: LKP, Profile, Elapsed (`hh:mm` from the first applied report's `at`, ticking each minute), ROW (tone warning ≥ 25 %, error ≥ 50 %), Exposure `Tag`, Weather `Tag`, Terrain `Tag`; wraps to two rows below 1024 px. Header actions (right): `Load demo scenario` (default), `Export for CalTopo` (default, `IconDownload`, same handler AuditLog uses), `Reset` (danger text).
- [ ] **Step 2: `npm run lint && npm run build`; Playwright screenshot.**
- [ ] **Step 3: Commit** `feat(layout): header status bar with mission vitals and actions`.

### Task 16: Tabbed right column, sticky map, demo steps bar

**Files:**
- Modify: `components/Console.tsx:270-478`, `components/DemoControls.tsx`

- [ ] **Step 1: Right column → `Tabs`** with keys and content: `ops` "Operations" (Setup card while unlocked → Radio report / Review card → Explanation → Suggestions & assign), `cell` "Cell" (CellInspector or `Empty title="Click a cell on the map"`), `clues` "Clues" (CluePanel, badge = clue count), `weather` "Weather" (WeatherPanel + SummitCard), `log` "Log" (Applied reports, AuditLog). `activeTab` state; map click sets `inspect` and switches to `cell`; applying a report switches to `ops`; a low-confidence parse shows a warning badge on `ops`.
- [ ] **Step 2: Left column** becomes `lg:sticky lg:top-4`: map Card (layer `Segmented` in `extra`, TerrainBadge, legend) and the ROW card (`Statistic size="lg"` + sparkline) directly under it so ROW is always visible.
- [ ] **Step 3: DemoControls** renders as a horizontal `Steps size="sm"` strip above the map with the current step's action beneath and the presenter note behind a "Note" `Button variant="text"` toggle. WelcomeCard shows in the right column only before an LKP exists.
- [ ] **Step 4: Responsive.** `< lg`: map → status bar → tabs stacked; tabs scroll horizontally. Confirm nothing overflows at 820 px and 390 px (`browser_resize`).
- [ ] **Step 5: `npm test && npm run lint && npm run build`; Playwright full 7-step demo + screenshots 1440/820/390.** Expected: every step reachable without scrolling the map off screen at 1440 px.
- [ ] **Step 6: Commit** `feat(layout): tabbed workflow, sticky map, demo steps bar`; push; PR "Round 4d: layout"; merge when green; live demo check.

---

## PR F — Docs and final check (branch `round4-docs`)

### Task 17: Documentation and run sheet

**Files:**
- Modify: `NOTES.md` (UI kit section; elevation source/attribution/command; weather fields; health-check timestamp), `DEMO.md` (tab names, layer toggle moment after step 2: "switch to Elevation to show the drainages", confirm-modal note), `PLAN.md` (Round 4 boxes), `CLAUDE.md` (Round 4 bullet list under Round 2), `README.md` (one line on `npm run fetch-elevation`)

- [ ] **Step 1: Write the updates.** DEMO.md keeps 7 steps and total ≤ 3 min; add the spoken line for the elevation layer: "Real USGS elevation: the two drainages fall away from the hut, which is why a tired hiker follows them."
- [ ] **Step 2: `npm test && npm run lint && npm run build`; commit** `docs: round 4 notes, demo run sheet, plan`; PR "Round 4e: docs"; merge.
- [ ] **Step 3: Final live check (Task 1 steps 1–5 again) and record the timestamp in NOTES.md "Before recording".** Report results to the user with exact outputs; do not claim anything that was not observed.
