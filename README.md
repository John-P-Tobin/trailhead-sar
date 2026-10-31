# Trailhead — Bayesian Search & Rescue Planner

Decision support for volunteer SAR incident commanders. Built for AI at 70 (Dartmouth × Anthropic).

```bash
npm install
cp .env.example .env.local   # add your ANTHROPIC_API_KEY (optional; manual mode works without it)
npm run dev
```

`npm test` runs the unit tests. See `PLAN.md` and `NOTES.md`.

Bundled terrain: `data/terrain.geojson` (OpenStreetMap, © OpenStreetMap contributors, ODbL). To regenerate it from an Overpass Turbo export: `npm run convert-terrain -- export.geojson`.
