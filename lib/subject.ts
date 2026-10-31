// The missing subject: who they are and when they were last seen.
// These fields drive the behaviour-based priors (lib/engine/behaviour.ts) and the
// relative-urgency chart (lib/engine/urgency.ts). Every value is the IC's call.

import { ProfileId } from "./profiles";

export type AgeBand = "child_1_6" | "child_7_12" | "teen" | "adult" | "older_65";
export type Experience = "none" | "some" | "experienced";
export type Fitness = "low" | "average" | "high";
export type Medical = "none" | "suspected" | "known";
export type Equipment = "adequate" | "questionable" | "inadequate";
export type PartySize = 1 | 2 | 3; // 3 = three or more

export interface Subject {
  category: ProfileId;
  name?: string;
  ageBand: AgeBand;
  experience: Experience;
  fitness: Fitness;
  /** Known condition or medication need. */
  medical: Medical;
  /** Clothing, light and water for the conditions. */
  equipment: Equipment;
  partySize: PartySize;
  /** ISO time the subject was last seen or known to be at the LKP. */
  lastSeenAt: string;
  /** Where they said they were going, free text. */
  intent?: string;
  notes?: string;
}

export const AGE_BAND_LABEL: Record<AgeBand, string> = {
  child_1_6: "Child 1–6",
  child_7_12: "Child 7–12",
  teen: "Teen 13–17",
  adult: "Adult 18–64",
  older_65: "65 or older",
};

const CATEGORY_DEFAULTS: Record<ProfileId, Pick<Subject, "ageBand" | "experience" | "fitness">> = {
  day_hiker: { ageBand: "adult", experience: "some", fitness: "average" },
  child: { ageBand: "child_7_12", experience: "none", fitness: "average" },
  hunter: { ageBand: "adult", experience: "experienced", fitness: "average" },
  older_adult: { ageBand: "older_65", experience: "some", fitness: "low" },
  trail_runner: { ageBand: "adult", experience: "experienced", fitness: "high" },
};

const DEFAULT_MISSING_HOURS = 2;

/** A complete subject from just a category, so the quick profile picker still works. */
export function defaultSubject(category: ProfileId, now = Date.now()): Subject {
  return {
    category,
    ...CATEGORY_DEFAULTS[category],
    medical: "none",
    equipment: "questionable",
    partySize: 1,
    lastSeenAt: new Date(now - DEFAULT_MISSING_HOURS * 3600_000).toISOString(),
  };
}

/** Hours since an ISO time, never negative; unparseable input counts as "just now". */
export function hoursSince(iso: string, now = Date.now()): number {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 0;
  return Math.max(0, (now - t) / 3600_000);
}

export function formatMissingFor(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h ? `${h} h ${m.toString().padStart(2, "0")} min` : `${m} min`;
}
