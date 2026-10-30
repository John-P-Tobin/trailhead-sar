# Notes

## Decisions
- Next.js 16 (App Router) + Tailwind 4 + TypeScript; vitest for engine tests.
- Grid is 15×15, columns A–O (west→east), rows 1–15 (north→south). Terrain is fictional, hand-authored in `lib/terrain.ts`: ridge to the NE, valley to the SW, trail junction at H8 (demo LKP), Hollow Brook draining SW from G9, Ledge Brook on the east, cliffs at I3/J3/J4/C3/D3, pond at B9/B10/C10.
- System fonts only (no Google Fonts fetch at build time).
- `ANTHROPIC_API_KEY` is server-only; `.env*` is git-ignored except `.env.example` (empty value).
- Engine (`lib/engine/`) is pure TS: `bayes.ts` (update formula, sequential sweeps, cumulative POD, sum-to-1 assertion, prior editing), `priors.ts` (exp(−d/scale) × terrain × profile multipliers, ROW 10%), `clues.ts` (IC-chosen likelihood-ratio boost with distance falloff, renormalized incl. ROW — so a clue on the grid slightly lowers ROW).
- Profile weights in `lib/profiles.ts` are **illustrative estimates**, hand-tuned, not published statistics. Say so in the pitch.
- Editing a cell's prior rescales the other cells and leaves ROW fixed; ROW has its own control.
