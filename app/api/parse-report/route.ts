import { z } from "zod";
import { askClaudeJson } from "@/lib/server/anthropic";
import { buildParseSystem } from "@/lib/prompts";
import { ParsedReport, ParsedReportSchema } from "@/lib/schemas";
import { isCellId } from "@/lib/engine/grid";

// Loose shape for the model's structured output; strict checks happen after.
const ParseOutput = z.object({
  team: z.string(),
  cells: z.array(z.string()),
  coverage_description: z.string(),
  estimated_pod: z.number(),
  pod_confidence: z.enum(["low", "med", "high"]),
  conditions: z.array(z.string()),
  clues: z.array(z.string()),
  unclear_points: z.array(z.string()),
});

const PromptFeatureSchema = z.object({
  kind: z.enum(["trail", "road", "stream", "water", "cliff", "ridge", "peak", "saddle"]),
  name: z.string().min(1).max(120),
  cells: z.array(z.string().max(3)).max(60),
});

const Body = z.object({
  text: z.string().min(1).max(4000),
  /** Named features of the map the IC is looking at, so "the Crawford Path" maps to cells. */
  features: z.array(PromptFeatureSchema).max(80).optional(),
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ ok: false, reason: "Report text is required." }, { status: 400 });

  const result = await askClaudeJson<ParsedReport>({
    system: buildParseSystem(
      (body.data.features ?? []).map((f) => ({ ...f, cells: f.cells.filter(isCellId).map((c) => c.toUpperCase()) })),
    ),
    user: `Radio report:\n"""\n${body.data.text}\n"""`,
    outputSchema: ParseOutput,
    strictSchema: ParsedReportSchema,
  });
  if (!result.ok) return Response.json(result);

  // Drop anything that is not a real grid cell and tell the IC about it.
  const report = result.data;
  const bad = report.cells.filter((c) => !isCellId(c));
  const cells = [...new Set(report.cells.filter(isCellId).map((c) => c.toUpperCase()))];
  const unclear = bad.length
    ? [...report.unclear_points, `Ignored invalid cell reference(s): ${bad.join(", ")}`]
    : report.unclear_points;
  return Response.json({ ok: true, report: { ...report, cells, unclear_points: unclear } });
}
