import { z } from "zod";
import { askClaudeJson } from "@/lib/server/anthropic";
import { buildSubjectSystem } from "@/lib/prompts";
import { SubjectProposal, SubjectProposalSchema, subjectFromProposal } from "@/lib/subjectParse";

const Body = z.object({
  text: z.string().trim().min(1).max(4000),
  /** The client's current time and zone so "1 p.m." resolves correctly. */
  now: z.string().datetime({ offset: true }).optional(),
  timeZone: z.string().max(64).optional(),
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ ok: false, reason: "Call-out text is required." }, { status: 400 });
  const nowMs = body.data.now ? Date.parse(body.data.now) : Date.now();

  const result = await askClaudeJson<SubjectProposal>({
    system: buildSubjectSystem(new Date(nowMs).toISOString(), body.data.timeZone ?? "UTC"),
    user: `Call-out:\n"""\n${body.data.text}\n"""`,
    outputSchema: SubjectProposalSchema,
    strictSchema: SubjectProposalSchema,
  });
  if (!result.ok) return Response.json(result);
  const { subject, unclear } = subjectFromProposal(result.data, nowMs);
  return Response.json({ ok: true, subject, unclear });
}
