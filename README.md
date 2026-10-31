# Trailhead — Bayesian Search & Rescue Planner

Decision support for volunteer SAR incident commanders. Built for AI at 70 (Dartmouth × Anthropic).

```bash
npm install
cp .env.example .env.local   # ANTHROPIC_API_KEY (optional; manual mode works without it); CALTOPO_* to enable live publishing
npm run dev
```

`npm test` runs the unit tests. See `PLAN.md`, `NOTES.md` and `DEMO.md` (run sheet). Don't run `npm run build` while `npm run dev` is running (both use `.next`).

Bundled terrain: `data/terrain.geojson` (OpenStreetMap, © OpenStreetMap contributors, ODbL). To regenerate it from an Overpass Turbo export: `npm run convert-terrain -- export.geojson`. Elevation grid: `data/elevation.json` (Copernicus GLO-90 via Open-Meteo, spot-checked against USGS 3DEP); rebuild with `npm run fetch-elevation`.
