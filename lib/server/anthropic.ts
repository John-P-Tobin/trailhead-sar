import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { CLAUDE_EFFORT, CLAUDE_MODEL } from "../claude";

// The API key is read here, server-side only. It is never sent to the browser.
function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new Anthropic({ apiKey, timeout: 25_000, maxRetries: 1 });
}

export type ClaudeResult<T> = { ok: true; data: T } | { ok: false; reason: string };

/**
 * Ask Claude for JSON matching `outputSchema`, then validate it with `strictSchema`.
 * Retries once on invalid output or a refusal; otherwise reports failure so the UI
 * falls back to manual mode. There is deliberately no fallback to another model:
 * manual entry is the failure path.
 */
export async function askClaudeJson<T>(opts: {
  system: string;
  user: string;
  outputSchema: z.ZodType;
  strictSchema: z.ZodType<T>;
  maxTokens?: number;
}): Promise<ClaudeResult<T>> {
  const client = getClient();
  if (!client) return { ok: false, reason: "Claude is not configured on the server (no API key)." };

  let lastReason = "Claude returned invalid output.";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.messages.parse({
        model: CLAUDE_MODEL,
        max_tokens: opts.maxTokens ?? 4000,
        system: opts.system,
        messages: [{ role: "user", content: opts.user }],
        output_config: { effort: CLAUDE_EFFORT, format: zodOutputFormat(opts.outputSchema) },
      });
      if (response.stop_reason === "refusal") {
        lastReason = "Claude declined to process this report.";
        continue;
      }
      const checked = opts.strictSchema.safeParse(response.parsed_output);
      if (checked.success) return { ok: true, data: checked.data };
      lastReason = "Claude's output failed validation.";
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) return { ok: false, reason: "Claude API key was rejected." };
      if (err instanceof Anthropic.RateLimitError) lastReason = "Claude is rate-limited right now.";
      else if (err instanceof Anthropic.APIConnectionError) lastReason = "Could not reach Claude.";
      else if (err instanceof Anthropic.APIError) lastReason = `Claude API error (${err.status ?? "unknown"}).`;
      else lastReason = "Claude returned output that could not be parsed.";
    }
  }
  return { ok: false, reason: lastReason };
}
