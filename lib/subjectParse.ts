// Claude's proposal for the subject card and how it becomes a Subject. Claude only
// proposes; the IC confirms every field. Shared by the server route and the client.

import { z } from "zod";
import { ProfileId } from "./profiles";
import { defaultSubject, Subject } from "./subject";

export const SubjectProposalSchema = z.object({
  category: z.enum(["day_hiker", "child", "hunter", "older_adult", "trail_runner"]),
  name: z.string().max(80),
  age_band: z.enum(["child_1_6", "child_7_12", "teen", "adult", "older_65"]),
  experience: z.enum(["none", "some", "experienced"]),
  fitness: z.enum(["low", "average", "high"]),
  medical: z.enum(["none", "suspected", "known"]),
  equipment: z.enum(["adequate", "questionable", "inadequate"]),
  party_size: z.number().int().min(1).max(3),
  /** ISO 8601 with offset, or empty when the call-out gives no time. */
  last_seen_at: z.string().max(40),
  intent: z.string().max(200),
  notes: z.string().max(300),
  unclear_points: z.array(z.string().max(200)).max(8),
});
export type SubjectProposal = z.infer<typeof SubjectProposalSchema>;

/**
 * Turn a validated proposal into a Subject. An unparseable or future time falls back
 * to the category default (2 h ago) and is reported so the IC fixes it.
 */
export function subjectFromProposal(p: SubjectProposal, now = Date.now()): { subject: Subject; unclear: string[] } {
  const unclear = [...p.unclear_points];
  const base = defaultSubject(p.category as ProfileId, now);
  const t = Date.parse(p.last_seen_at);
  let lastSeenAt = base.lastSeenAt;
  if (!p.last_seen_at.trim()) unclear.push("Time last seen was not stated; defaulted to 2 hours ago. Confirm with the caller.");
  else if (!Number.isFinite(t)) unclear.push(`Could not read the time last seen ("${p.last_seen_at}"); defaulted to 2 hours ago.`);
  else if (t > now + 5 * 60_000) unclear.push("The stated time last seen is in the future; defaulted to 2 hours ago.");
  else lastSeenAt = new Date(t).toISOString();
  return {
    subject: {
      category: p.category,
      name: p.name.trim() || undefined,
      ageBand: p.age_band,
      experience: p.experience,
      fitness: p.fitness,
      medical: p.medical,
      equipment: p.equipment,
      partySize: p.party_size as 1 | 2 | 3,
      lastSeenAt,
      intent: p.intent.trim() || undefined,
      notes: p.notes.trim() || undefined,
    },
    unclear,
  };
}
