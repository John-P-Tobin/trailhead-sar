// Lost-person behaviour: how far from the last known point subjects of each kind
// tend to be found, and how that spreads with time. Decision support only: the
// hiker fit is published (see DISTANCE_MODEL); everything else is illustrative and
// must be verified before operational use.

import { Profile, ProfileId } from "../profiles";
import { Subject } from "../subject";

/**
 * Straight-line distance from the LKP is modelled as lognormal (natural log of km).
 * day_hiker uses the ISRID fit for hikers in temperate mountainous terrain from
 * MapScore (github.com/ctwardy/mapscore, arc-models/lognorm_params.csv): μ 0.962, σ 1.258,
 * i.e. half of hikers are found within 2.6 km. The other categories are fitted to the
 * approximate quartiles below, which are adapted from the shape of published
 * lost-person statistics and are ILLUSTRATIVE.
 */
export interface LogNormal {
  mu: number;
  sigma: number;
  source: string;
}

/** Approximate 25 / 50 / 75 / 95 % distances (km) used to fit the non-hiker categories. */
export const DISTANCE_QUARTILES_KM: Record<ProfileId, [number, number, number, number]> = {
  day_hiker: [1.1, 2.6, 6.1, 20.7], // implied by the MapScore fit, listed for reference
  child: [0.5, 1.3, 3.2, 8],
  hunter: [1.0, 2.1, 5.1, 17],
  older_adult: [0.3, 0.8, 1.9, 5],
  trail_runner: [1.5, 4.0, 8.0, 20],
};

const fit = (q: [number, number, number, number], source: string): LogNormal => ({
  mu: Math.log(q[1]),
  sigma: (Math.log(q[2]) - Math.log(q[0])) / (2 * 0.6745),
  source,
});

const ILLUSTRATIVE = "illustrative, fitted to approximate quartiles";
export const DISTANCE_MODEL: Record<ProfileId, LogNormal> = {
  day_hiker: { mu: 0.962, sigma: 1.258, source: "ISRID hiker, temperate mountainous (MapScore lognorm_params.csv)" },
  child: fit(DISTANCE_QUARTILES_KM.child, ILLUSTRATIVE),
  hunter: fit(DISTANCE_QUARTILES_KM.hunter, ILLUSTRATIVE),
  older_adult: fit(DISTANCE_QUARTILES_KM.older_adult, ILLUSTRATIVE),
  trail_runner: fit(DISTANCE_QUARTILES_KM.trail_runner, ILLUSTRATIVE),
};

/** Standard normal CDF (Abramowitz–Stegun 7.1.26, |error| < 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return 0.5 * (1 + (z < 0 ? -erf : erf));
}

/** Inverse normal CDF (Acklam's rational approximation, relative error ~1e-9). */
export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  let q: number;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

/** Typical travelling speed when moving (km/h), before fitness adjustments. */
const SPEED_KMH: Record<ProfileId, number> = {
  day_hiker: 2.0,
  child: 1.0,
  hunter: 1.5,
  older_adult: 0.8,
  trail_runner: 4.0,
};

/** People stop: darkness, exhaustion, injury. Travel is not assumed beyond this many hours. */
export const TRAVEL_HOURS_CAP = 6;
const REACH_FLOOR_KM = 0.3;

/** Multiplier on the distance table for this particular subject (0.4–1.6). */
export function distanceScaleFor(s: Subject): number {
  let k = 1;
  k *= { none: 0.85, some: 1, experienced: 1.15 }[s.experience];
  k *= { low: 0.8, average: 1, high: 1.2 }[s.fitness];
  k *= { child_1_6: 0.6, child_7_12: 1, teen: 1.05, adult: 1, older_65: 0.8 }[s.ageBand];
  if (s.medical === "known") k *= 0.8;
  return Math.min(1.6, Math.max(0.4, k));
}

/** The lognormal for this subject: the category's fit shifted by the subject's distance scale. */
export function distanceParams(s: Subject): LogNormal {
  const base = DISTANCE_MODEL[s.category];
  return { ...base, mu: base.mu + Math.log(distanceScaleFor(s)) };
}

export function distanceQuantile(p: LogNormal, pct: number): number {
  return Math.exp(p.mu + p.sigma * normalQuantile(pct));
}

/** 25 / 50 / 75 / 95 % distances (km) for this subject. */
export function scaledQuartiles(s: Subject): [number, number, number, number] {
  const p = distanceParams(s);
  return [0.25, 0.5, 0.75, 0.95].map((x) => distanceQuantile(p, x)) as [number, number, number, number];
}

/** Radial CDF: share of subjects found within `km` of the LKP. */
export function distanceCdf(p: LogNormal, km: number): number {
  if (km <= 0) return 0;
  return normalCdf((Math.log(km) - p.mu) / p.sigma);
}

export function reachKm(s: Subject, hoursElapsed: number): number {
  const speed = SPEED_KMH[s.category] * { low: 0.75, average: 1, high: 1.25 }[s.fitness];
  return Math.max(REACH_FLOOR_KM, speed * Math.min(Math.max(0, hoursElapsed), TRAVEL_HOURS_CAP));
}

/** CDF truncated at what the subject could have walked so far. */
export function truncatedCdf(s: Subject, hoursElapsed: number, km: number): number {
  const p = distanceParams(s);
  const reach = reachKm(s, hoursElapsed);
  const norm = distanceCdf(p, reach);
  return distanceCdf(p, Math.min(km, reach)) / norm;
}

export function massWithinKm(s: Subject, km: number, hoursElapsed: number): number {
  return truncatedCdf(s, hoursElapsed, km);
}

/**
 * Probability density per square metre at `km` from the LKP: the ring's share of the
 * CDF spread over the ring's area. `minKm` avoids the singularity at the LKP itself.
 */
export function arealDensity(s: Subject, hoursElapsed: number, km: number, minKm: number): number {
  const d = Math.max(km, minKm);
  const h = 0.01;
  const pdf = (truncatedCdf(s, hoursElapsed, d + h) - truncatedCdf(s, hoursElapsed, Math.max(0, d - h))) / (2 * h);
  return pdf / (2 * Math.PI * d);
}

/** Model's suggestion for the share of probability outside the grid. The IC's slider stays authoritative. */
export function suggestedRow(s: Subject, nearestEdgeKm: number, hoursElapsed: number): number {
  const outside = 1 - truncatedCdf(s, hoursElapsed, nearestEdgeKm);
  return Math.min(0.6, Math.max(0.05, Math.round(outside * 100) / 100));
}

/** Downhill pull that grows with the drop below the LKP and saturates at the profile's factor by 150 m. */
export const DOWNHILL_FULL_DROP_M = 150;
export function gradedDownhill(profile: Profile, dropM: number): number {
  const t = Math.min(1, Math.max(0, dropM / DOWNHILL_FULL_DROP_M));
  return 1 + (profile.downhill - 1) * t;
}
