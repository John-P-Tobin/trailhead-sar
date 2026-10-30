# Notes

## Decisions
- Next.js 16 (App Router) + Tailwind 4 + TypeScript; vitest for engine tests.
- Grid is 15×15, columns A–O (west→east), rows 1–15 (north→south). Terrain is fictional, hand-authored in `lib/terrain.ts`: ridge to the NE, valley to the SW, trail junction at H8 (demo LKP), Hollow Brook draining SW from G9, Ledge Brook on the east, cliffs at I3/J3/J4/C3/D3, pond at B9/B10/C10.
- System fonts only (no Google Fonts fetch at build time).
- `ANTHROPIC_API_KEY` is server-only; `.env*` is git-ignored except `.env.example` (empty value).
