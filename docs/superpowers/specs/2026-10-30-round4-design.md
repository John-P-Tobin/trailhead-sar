# Trailhead — Round 4: make everything work, Ant-style UI/UX, real elevation, richer weather

## Context
Round 3 (robustness + DEMO.md) is merged and live. Claude parsing and NWS weather work on Vercel. The user now owns the UI too and wants three things before the **6:30 a.m. feature freeze** (video due 10:00 a.m.):
- the app clearly works end to end,
- a cleaner, Ant Design–style UX,
- weather and elevation that are visible and real.

Decisions already made:
- Build Ant patterns in Tailwind; don't install antd.
- Ship real elevation as a bundled per-cell USGS grid.
- I own components/ and styles now.
- Ship as small PRs, merging each to main only when tests, lint and build pass.
- This Claude Code session already bills the Anthropic Console org (prepaid credits), confirmed from the login config; no change needed.

## Step 1 — Live health check (no code, ~10 min)
Before changing anything, check the live site at trailhead-sar.vercel.app with Playwright:
- a real report shows "Written by Claude",
- the weather badge says "Live NWS",
- placing an LKP outside demo mode shows "Live OSM", or the bundled fallback note if Overpass is down,
- the demo runs all 7 steps with **small** chosen at the clue step,
- CalTopo export downloads.

Anything broken here gets fixed first, in its own PR.

## Step 2 — Shared UI kit, Ant-style (PR "ui-kit")
- Add Ant-dark design tokens to `app/globals.css` via `@theme`:
  - colour roles: primary blue, success, warning, error, info, plus surface/border/text levels,
  - a 4/8 px spacing rhythm, radius 6–8 px, and one type scale (12/14/16/20/24; no more 10/11 px text).
- Grow `components/ui/` from `Panel.tsx` + `styles.ts` into small, typed components:
  - `Card` (title, extra, footer; replaces Panel and the hand-rolled sections),
  - `Button` (primary/default/text/danger, loading state, icon slot),
  - `Tag` (status colours; replaces the duplicated badge strings),
  - `Alert` (info/warning/error, with "verify with team" and the cached-weather notices),
  - `Statistic` (label/value/suffix; replaces CellInspector `Stat`, ROW and weather big numbers),
  - `Steps` (WelcomeCard, DemoControls),
  - `Descriptions` (key/value rows for cell details and weather),
  - `Tooltip` (CSS/ARIA; replaces native `title` on badges and buttons),
  - `Modal` + `useConfirm()` (replaces `confirm()` in `Console.tsx:168,181` and `DemoControls.tsx:79`),
  - `Empty` (empty states),
  - `Skeleton` and `Segmented` (boost picker, profile picker).
- Use a small inline SVG icon set in `components/ui/icons.tsx` instead of emoji/⚠ glyphs.
- Pure refactor of existing panels onto the kit, with no behaviour change. Existing tests must still pass.

## Step 3 — Layout and flow (PR "ui-layout")
Rework `components/Console.tsx`, currently ~11 stacked cards on the right:
- **Header:** title, a mission status bar (LKP, profile, elapsed time, ROW `Statistic`, weather risk `Tag`, terrain source `Tag`), and actions (Load demo, Export for CalTopo, Reset via the confirm modal).
- **Left (map, sticky):** GridMap, legend, and a new **map layer toggle** (Probability / Elevation / Terrain), using `Segmented`.
- **Right, tabbed by workflow:**
  - **Operations:** Radio report → Review card → Explanation, then Suggestions/Assign.
  - **Cell:** the inspector, opened automatically on map click.
  - **Clues.**
  - **Weather.**
  - **Log:** applied reports, audit log, exports.
- Demo controls float as a compact `Steps` bar above the map in demo mode, with the presenter note collapsible.
- Keep the safety footer and the ROW display always visible. Make the review card's Apply the clear primary action.
- Responsive: on tablets the right panel stacks under the map; on phones the order is map → tabs.
- Every async action shows a loading state on its button: parse, explain, weather refresh, terrain fetch.

## Step 4 — Real elevation (PR "elevation")
- New script `scripts/fetch-elevation.ts`:
  - samples a 4×4 point grid per cell (3,600 points) for the bundled bbox from **USGS 3DEP EPQS**, with Open-Meteo's batch elevation API as backup,
  - writes `data/elevation.json` keyed by cell id: `{minM, meanM, maxM, slopeDeg, aspect}`,
  - adds an npm script, `npm run fetch-elevation`.
- `lib/osm.ts` `buildTerrainModel` (estimate block ~`:483-509`): new option `elevation?: Record<CellId, CellElevation>`.
  - When present, it replaces the peak-distance estimate; normalisation and cover (alpine ≥1450 m, etc.) follow unchanged.
  - Wire it in `lib/terrainClient.ts` for bundled and demo terrain. Live OSM in other bboxes keeps the estimate, labelled "approx."
- Extend `CellTerrain` (`lib/terrain.ts:13`) with `slopeDeg?` / `aspect?`. Steep cells (>35°) get a "steep" note in `describeCell` and team-safety context. They are not used in priors unless the demo still holds.
- UI:
  - an **Elevation layer** on GridMap: hypsometric shading by `meanM`, a slope hatch for steep cells, and peak labels with elevation (e.g. "Mt Washington 1,917 m"),
  - an elevation scale in MapLegend,
  - the cell inspector `Descriptions` shows elevation range, slope and aspect.
- Retune and re-verify the demo:
  - run `tests/demo.test.ts`, which checks the clue cell is #1, G14 is #3, and G14 is lower than the clue cell,
  - if rankings move, adjust only the scenario POD/cells in `lib/demo/scenario.ts`, not the engine,
  - update `tests/osm.test.ts:133-136` and `tests/terrain.test.ts:56` for real values,
  - add a test that bundled cells use `elevation.json`.

## Step 5 — Richer weather (PR "weather")
- `app/api/weather/route.ts`:
  - keep all 24 hourly periods,
  - also read the NWS `forecastGridData` already linked from `/points`, for **wind gusts, sky cover, relative humidity and visibility** (best effort; missing fields are fine),
  - expose the forecast grid's elevation.
- Extend `lib/weather.ts` with pure, unit-tested helpers:
  - `tempAtElevation(tempF, fromM, toM)` with a standard lapse rate of 6.5 °C/km, labelled an estimate,
  - per-cell wind chill on ridge/alpine cells, using gusts where available,
  - `nextDarkness()` from the `isDaytime` transitions,
  - extended POD factors that use visibility.
- `WeatherPanel` redesign:
  - current conditions in `Descriptions`,
  - an exposure `Alert`,
  - a **12-hour chart** (temp line, wind/gust bars, precip %, night shaded). Read the dataviz skill first.
  - safety flags list the cells they affect, and clicking one highlights those cells on the map,
  - "at LKP elevation" vs "at summit" temperature estimates.
- Cell inspector: estimated temperature and wind chill at that cell's elevation, plus any active safety flag.
- No survival-time numbers anywhere (spec rule).

## Step 6 — Clear code + docs (PR "docs")
- Remove dead class strings from `components/ui/styles.ts`.
- Add one short header comment per component, and keep files under ~250 lines by splitting GridMap layers into `components/map/*`.
- Update NOTES.md (UI kit, elevation source and attribution "Elevation: USGS 3DEP", weather fields), DEMO.md (new button locations and tabs), PLAN.md (Round 4 boxes) and CLAUDE.md milestones.

## Order and timing (feature freeze 6:30 a.m.)
| Step | PR | Target |
|---|---|---|
| 1 | health check (+ fixes if needed) | ~11 p.m. |
| 2 | ui-kit | ~12:30 a.m. |
| 4 | elevation (data first; the demo retune is the risky bit) | ~2 a.m. |
| 5 | weather | ~3:30 a.m. |
| 3 | ui-layout (uses the kit, elevation layer and weather chart) | ~5 a.m. |
| 6 | docs + final live check | ~6 a.m. |

If time runs short, drop the gridData extras in Step 5 and the tabs in Step 3, in that order. The demo path always comes first.

## Verification (every PR)
- Run `npm test`, `npm run lint` and `npm run build`. All must pass before merging to main.
- Run `npm run dev` and use Playwright to click through the demo (7 steps, small boost, G14 override, found) and take screenshots at 1440 px and 820 px.
- After each merge, wait for the Vercel deploy, then check:
  - `/api/weather` returns `source: "live"`,
  - a free-text report shows "Written by Claude",
  - the elevation layer renders,
  - the demo runs start to finish.
- Before merging, ask the user before anything outward-facing beyond our own repo and Vercel.
