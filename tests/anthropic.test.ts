import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@anthropic-ai/sdk/helpers/zod", () => ({ zodOutputFormat: () => ({ type: "json_schema" }) }));
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status?: number;
  }
  class AuthenticationError extends APIError {}
  class RateLimitError extends APIError {}
  class APIConnectionError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static AuthenticationError = AuthenticationError;
    static RateLimitError = RateLimitError;
    static APIConnectionError = APIConnectionError;
    messages = { parse };
  }
  return { default: Anthropic };
});

import { askClaudeJson } from "@/lib/server/anthropic";

const schema = z.object({ answer: z.string() });
const ask = () => askClaudeJson({ system: "s", user: "u", outputSchema: schema, strictSchema: schema });

describe("askClaudeJson failure path", () => {
  beforeEach(() => {
    parse.mockReset();
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns validated output and sends no cross-model fallback", async () => {
    parse.mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { answer: "ok" } });
    expect(await ask()).toEqual({ ok: true, data: { answer: "ok" } });
    expect(parse).toHaveBeenCalledTimes(1);
    const params = parse.mock.calls[0][0];
    expect(params).not.toHaveProperty("fallbacks");
    expect(params).not.toHaveProperty("betas");
  });

  it("retries once on invalid output, then fails so the UI goes to manual mode", async () => {
    parse.mockResolvedValue({ stop_reason: "end_turn", parsed_output: { wrong: 1 } });
    const res = await ask();
    expect(res.ok).toBe(false);
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("treats a refusal as a failed attempt (one retry, no other model)", async () => {
    parse.mockResolvedValue({ stop_reason: "refusal", parsed_output: null });
    expect(await ask()).toEqual({ ok: false, reason: "Claude declined to process this report." });
    expect(parse).toHaveBeenCalledTimes(2);
  });

  it("recovers if the retry succeeds", async () => {
    parse
      .mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { wrong: 1 } })
      .mockResolvedValueOnce({ stop_reason: "end_turn", parsed_output: { answer: "second" } });
    expect(await ask()).toEqual({ ok: true, data: { answer: "second" } });
  });

  it("fails fast without an API key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    expect((await ask()).ok).toBe(false);
    expect(parse).not.toHaveBeenCalled();
  });
});
