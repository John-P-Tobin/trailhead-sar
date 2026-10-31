import { describe, expect, it } from "vitest";
import { SubjectProposalSchema, subjectFromProposal } from "@/lib/subjectParse";

const now = Date.parse("2026-10-31T03:00:00Z");
const base = {
  category: "day_hiker" as const,
  name: "Dan Harper",
  age_band: "adult" as const,
  experience: "some" as const,
  fitness: "high" as const,
  medical: "none" as const,
  equipment: "questionable" as const,
  party_size: 1,
  last_seen_at: "2026-10-30T17:00:00-04:00",
  intent: "Heading for the summit",
  notes: "",
  unclear_points: [],
};

describe("subject proposal → Subject", () => {
  it("validates and converts a complete proposal", () => {
    expect(SubjectProposalSchema.safeParse(base).success).toBe(true);
    const { subject, unclear } = subjectFromProposal(base, now);
    expect(subject.name).toBe("Dan Harper");
    expect(subject.lastSeenAt).toBe("2026-10-30T21:00:00.000Z");
    expect(subject.notes).toBeUndefined();
    expect(unclear).toEqual([]);
  });

  it("falls back to 2 hours ago and flags it when the time is missing, garbled or in the future", () => {
    for (const bad of ["", "yesterday-ish", "2026-11-02T10:00:00Z"]) {
      const { subject, unclear } = subjectFromProposal({ ...base, last_seen_at: bad }, now);
      expect(subject.lastSeenAt).toBe(new Date(now - 2 * 3600_000).toISOString());
      expect(unclear).toHaveLength(1);
    }
  });

  it("rejects out-of-range values instead of letting Claude set them", () => {
    expect(SubjectProposalSchema.safeParse({ ...base, party_size: 9 }).success).toBe(false);
    expect(SubjectProposalSchema.safeParse({ ...base, fitness: "olympic" }).success).toBe(false);
  });
});
