// Build data/elevation.json: per-cell elevation summaries for the default grid.
// Samples a 4×4 lattice per cell (3,600 points) from Open-Meteo's elevation API
// (Copernicus DEM GLO-90), then spot-checks a few points against USGS 3DEP EPQS.
// Usage: npm run fetch-elevation
import { writeFileSync } from "node:fs";
import { ALL_CELLS, GRID_SIZE } from "../lib/engine/grid";
import { cellBounds, DEFAULT_BBOX, M_PER_DEG_LAT, metersPerDegLon } from "../lib/geo";
import { ElevationFile, summarizeCell } from "../lib/elevation";

const N = 3;
const UA = "TrailheadSAR (hackathon demo)";

async function openMeteo(points: { lat: number; lon: number }[]): Promise<number[]> {
  const url = `https://api.open-meteo.com/v1/elevation?latitude=${points.map((p) => p.lat.toFixed(5)).join(",")}&longitude=${points.map((p) => p.lon.toFixed(5)).join(",")}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20_000) });
      if (res.status === 429) {
        process.stdout.write(" (rate limited, waiting 15 s)");
        await new Promise((r) => setTimeout(r, 15_000));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { elevation: number[] };
      if (!Array.isArray(j.elevation) || j.elevation.length !== points.length) throw new Error("bad response");
      return j.elevation;
    } catch (e) {
      if (attempt === 5) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw new Error("unreachable");
}

async function usgs(lat: number, lon: number): Promise<number | null> {
  try {
    const res = await fetch(`https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&units=Meters&wkid=4326`, { signal: AbortSignal.timeout(20_000) });
    const j = (await res.json()) as { value?: string | number };
    const v = Number(j.value);
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

async function main() {
  const bbox = DEFAULT_BBOX;
  const points: { cell: string; lat: number; lon: number; x: number; y: number }[] = [];
  ALL_CELLS.forEach((id, i) => {
    const b = cellBounds(bbox, i % GRID_SIZE, Math.floor(i / GRID_SIZE));
    const mLon = metersPerDegLon((b.north + b.south) / 2);
    for (let a = 0; a < N; a++)
      for (let c = 0; c < N; c++) {
        const lon = b.west + ((a + 0.5) / N) * (b.east - b.west);
        const lat = b.south + ((c + 0.5) / N) * (b.north - b.south);
        points.push({ cell: id, lat, lon, x: (lon - b.west) * mLon, y: (lat - b.south) * M_PER_DEG_LAT });
      }
  });
  console.log(`Fetching ${points.length} points in batches of 100…`);
  const z: number[] = new Array(points.length);
  for (let i = 0; i < points.length; i += 100) {
    const batch = points.slice(i, i + 100);
    const vals = await openMeteo(batch);
    vals.forEach((v, k) => (z[i + k] = v));
    process.stdout.write(`\r${Math.min(i + 100, points.length)}/${points.length}`);
    await new Promise((r) => setTimeout(r, 1200));
  }
  console.log("\nSummarising cells…");
  const cells: ElevationFile["cells"] = {};
  for (const id of ALL_CELLS) {
    const samples = points.map((p, k) => ({ ...p, z: z[k] })).filter((p) => p.cell === id);
    cells[id] = summarizeCell(samples);
  }
  console.log("Spot-checking 6 points against USGS 3DEP…");
  const checks = [0, 400, 800, 1200, 1600, 2000].map((k) => points[k]);
  const diffs: number[] = [];
  for (const [k, p] of checks.entries()) {
    const u = await usgs(p.lat, p.lon);
    if (u !== null) {
      const idx = points.indexOf(p);
      diffs.push(Math.abs(u - z[idx]));
      console.log(`  ${p.cell}: Open-Meteo ${z[idx].toFixed(0)} m, USGS ${u.toFixed(0)} m (${k + 1}/6)`);
    }
  }
  const file: ElevationFile & { spotCheck: { points: number; maxDiffM: number | null } } = {
    source: "Open-Meteo elevation API (Copernicus DEM GLO-90), 9 samples per cell",
    attribution: "Elevation: Copernicus DEM GLO-90 via Open-Meteo; spot-checked against USGS 3DEP",
    fetchedAt: new Date().toISOString(),
    bbox: [bbox.south, bbox.west, bbox.north, bbox.east],
    samplesPerCell: N * N,
    cells,
    spotCheck: { points: diffs.length, maxDiffM: diffs.length ? Math.round(Math.max(...diffs)) : null },
  };
  writeFileSync(new URL("../data/elevation.json", import.meta.url), JSON.stringify(file, null, 1));
  console.log(`Wrote data/elevation.json · J6 max ${cells.J6.maxM} m · E10 mean ${cells.E10.meanM} m · spot-check max diff ${file.spotCheck.maxDiffM} m`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
