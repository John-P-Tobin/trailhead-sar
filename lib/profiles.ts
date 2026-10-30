// Lost-person behaviour profiles.
// ILLUSTRATIVE ESTIMATES ONLY — hand-tuned for this demo, not published statistics.

export type ProfileId = "day_hiker" | "child" | "hunter" | "older_adult" | "trail_runner";

export interface Profile {
  id: ProfileId;
  label: string;
  summary: string;
  /** Distance decay scale in cells: larger = wanders farther. */
  distanceScale: number;
  trail: number;
  drainage: number;
  ridge: number;
  /** Multiplier for cells lower than the LKP. */
  downhill: number;
  cliff: number;
  water: number;
  openGround: number;
}

export const PROFILES: Record<ProfileId, Profile> = {
  day_hiker: {
    id: "day_hiker",
    label: "Day hiker",
    summary: "Follows trails, then drainages downhill when lost.",
    distanceScale: 3.5,
    trail: 2.2,
    drainage: 1.8,
    ridge: 0.9,
    downhill: 1.35,
    cliff: 0.3,
    water: 0.15,
    openGround: 1.1,
  },
  child: {
    id: "child",
    label: "Child (7–12)",
    summary: "Stays closer to the LKP; drawn to open ground; may hide.",
    distanceScale: 2.0,
    trail: 1.4,
    drainage: 1.3,
    ridge: 0.6,
    downhill: 1.1,
    cliff: 0.2,
    water: 0.4,
    openGround: 1.4,
  },
  hunter: {
    id: "hunter",
    label: "Hunter",
    summary: "Off-trail, travels farther, uses ridges and drainages.",
    distanceScale: 5.0,
    trail: 0.9,
    drainage: 1.5,
    ridge: 1.4,
    downhill: 1.1,
    cliff: 0.4,
    water: 0.2,
    openGround: 1.0,
  },
  older_adult: {
    id: "older_adult",
    label: "Older adult",
    summary: "Shorter distances; stays on easy, downhill terrain.",
    distanceScale: 2.5,
    trail: 1.8,
    drainage: 1.4,
    ridge: 0.6,
    downhill: 1.4,
    cliff: 0.2,
    water: 0.2,
    openGround: 1.2,
  },
  trail_runner: {
    id: "trail_runner",
    label: "Trail runner",
    summary: "Covers long distances fast, strongly trail-bound.",
    distanceScale: 6.0,
    trail: 3.0,
    drainage: 1.1,
    ridge: 1.3,
    downhill: 1.0,
    cliff: 0.3,
    water: 0.15,
    openGround: 1.0,
  },
};

export const PROFILE_LIST = Object.values(PROFILES);
