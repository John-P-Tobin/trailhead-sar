import { z } from "zod";

export const PodConfidence = z.enum(["low", "med", "high"]);
export type PodConfidence = z.infer<typeof PodConfidence>;

/** What Claude proposes from a radio report. Every field is reviewed by the IC. */
export const ParsedReportSchema = z.object({
  team: z.string(),
  cells: z.array(z.string()),
  coverage_description: z.string(),
  estimated_pod: z.number().min(0).max(1),
  pod_confidence: PodConfidence,
  conditions: z.array(z.string()),
  clues: z.array(z.string()),
  unclear_points: z.array(z.string()),
});
export type ParsedReport = z.infer<typeof ParsedReportSchema>;

export const ExplanationSchema = z.object({
  explanation: z.string().min(1),
  least_certain_assumption: z.string().min(1),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

export const emptyReport = (): ParsedReport => ({
  team: "",
  cells: [],
  coverage_description: "",
  estimated_pod: 0.5,
  pod_confidence: "med",
  conditions: [],
  clues: [],
  unclear_points: [],
});
