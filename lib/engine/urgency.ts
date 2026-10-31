// Relative urgency rating: the seven-factor chart ICs are trained on (age, medical,
// number of subjects, experience, weather, equipment, terrain), each scored 1–3 where
// 1 is most urgent, total 7–21. The app proposes each score from the subject form,
// the forecast and the terrain; the IC can override any factor and the override is
// logged. This is a response-urgency rating, never a survival estimate.

import { CellId, cellsWithin } from "./grid";
import { Subject } from "../subject";
import { CellTerrain } from "../terrain";
import { ExposureLevel } from "../weather";

export type UrgencyKey = "age" | "medical" | "subjects" | "experience" | "weather" | "equipment" | "terrain";
export type UrgencyScore = 1 | 2 | 3;

export interface UrgencyFactor {
  key: UrgencyKey;
  label: string;
  score: UrgencyScore;
  reason: string;
  overridden?: boolean;
}

export type UrgencyBand = "emergency" | "measured" | "evaluate";

export interface Urgency {
  factors: UrgencyFactor[];
  total: number;
  band: UrgencyBand;
  bandLabel: string;
}

export const URGENCY_FACTORS: { key: UrgencyKey; label: string; hint: string }[] = [
  { key: "age", label: "Age", hint: "1 very young or very old · 3 fit adult" },
  { key: "medical", label: "Medical", hint: "1 known condition · 2 suspected · 3 healthy" },
  { key: "subjects", label: "Number of subjects", hint: "1 alone · 3 group" },
  { key: "experience", label: "Experience", hint: "1 none · 3 experienced" },
  { key: "weather", label: "Weather", hint: "1 hazardous now · 2 hazardous soon · 3 benign" },
  { key: "equipment", label: "Equipment", hint: "1 inadequate · 2 questionable · 3 adequate" },
  { key: "terrain", label: "Terrain hazards", hint: "1 cliffs, water or alpine nearby · 3 benign" },
];

export const BAND_LABEL: Record<UrgencyBand, string> = {
  emergency: "Emergency response",
  measured: "Measured response",
  evaluate: "Evaluate and investigate",
};

export interface UrgencyContext {
  exposureNow: ExposureLevel | null;
  exposureSoon: ExposureLevel | null;
  hazardsNearLkp: boolean;
}

const hazardous = (l: ExposureLevel | null) => l === "high" || l === "severe";

export function urgencyFactors(s: Subject, ctx: UrgencyContext): UrgencyFactor[] {
  const age: UrgencyFactor =
    s.ageBand === "child_1_6" || s.ageBand === "older_65"
      ? { key: "age", label: "Age", score: 1, reason: "Very young or older subject" }
      : s.ageBand === "child_7_12"
        ? { key: "age", label: "Age", score: 2, reason: "Child" }
        : { key: "age", label: "Age", score: 3, reason: "Teen or adult" };
  const medical: UrgencyFactor = {
    key: "medical",
    label: "Medical",
    score: s.medical === "known" ? 1 : s.medical === "suspected" ? 2 : 3,
    reason: s.medical === "known" ? "Known condition or medication need" : s.medical === "suspected" ? "Suspected condition" : "No known condition",
  };
  const subjects: UrgencyFactor = {
    key: "subjects",
    label: "Number of subjects",
    score: s.partySize === 1 ? 1 : s.partySize === 2 ? 2 : 3,
    reason: s.partySize === 1 ? "Alone" : s.partySize === 2 ? "Pair" : "Group of three or more",
  };
  const experience: UrgencyFactor = {
    key: "experience",
    label: "Experience",
    score: s.experience === "none" ? 1 : s.experience === "some" ? 2 : 3,
    reason: s.experience === "none" ? "No backcountry experience" : s.experience === "some" ? "Some experience" : "Experienced",
  };
  const weather: UrgencyFactor = hazardous(ctx.exposureNow)
    ? { key: "weather", label: "Weather", score: 1, reason: `Exposure risk ${ctx.exposureNow} now` }
    : hazardous(ctx.exposureSoon) || ctx.exposureNow === "moderate"
      ? { key: "weather", label: "Weather", score: 2, reason: hazardous(ctx.exposureSoon) ? "Hazardous conditions forecast within 8 h" : "Moderate exposure risk" }
      : { key: "weather", label: "Weather", score: 3, reason: ctx.exposureNow ? "Benign conditions" : "No forecast; assumed benign" };
  const equipment: UrgencyFactor = {
    key: "equipment",
    label: "Equipment",
    score: s.equipment === "inadequate" ? 1 : s.equipment === "questionable" ? 2 : 3,
    reason: s.equipment === "inadequate" ? "Inadequate for conditions" : s.equipment === "questionable" ? "Questionable for conditions" : "Adequate for conditions",
  };
  const terrain: UrgencyFactor = ctx.hazardsNearLkp
    ? { key: "terrain", label: "Terrain hazards", score: 1, reason: "Cliffs, open water or alpine ground near the LKP" }
    : { key: "terrain", label: "Terrain hazards", score: 3, reason: "No major hazards mapped near the LKP" };
  return [age, medical, subjects, experience, weather, equipment, terrain];
}

export function scoreUrgency(factors: UrgencyFactor[], overrides: Partial<Record<UrgencyKey, UrgencyScore>>): Urgency {
  const merged = factors.map((f) => {
    const o = overrides[f.key];
    return o && o !== f.score ? { ...f, score: o, overridden: true, reason: `${f.reason} (IC set ${o})` } : { ...f, overridden: false };
  });
  const total = merged.reduce((a, f) => a + f.score, 0);
  const band: UrgencyBand = total <= 11 ? "emergency" : total <= 16 ? "measured" : "evaluate";
  return { factors: merged, total, band, bandLabel: BAND_LABEL[band] };
}

/** Cliffs, open water or alpine ground within a few cells of the LKP. */
export function hazardsNearLkp(lkp: CellId, terrain: Record<CellId, CellTerrain>, radiusCells = 3): boolean {
  return cellsWithin(lkp, radiusCells).some((c) => {
    const t = terrain[c];
    return !!t && (t.cliff || t.water || t.cover === "alpine");
  });
}
