import { z } from "zod";
import { askClaudeJson } from "@/lib/server/anthropic";
import { EXPLAIN_SYSTEM } from "@/lib/prompts";
import { Explanation, ExplanationSchema } from "@/lib/schemas";

const Body = z.object({
  summary: z.string().min(1).max(6000),
});

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return Response.json({ ok: false, reason: "Update summary is required." }, { status: 400 });
  const result = await askClaudeJson<Explanation>({
    system: EXPLAIN_SYSTEM,
    user: body.data.summary,
    outputSchema: z.object({ explanation: z.string(), least_certain_assumption: z.string() }),
    strictSchema: ExplanationSchema,
    maxTokens: 2000,
  });
  return Response.json(result.ok ? { ok: true, explanation: result.data } : result);
}
