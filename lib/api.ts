// Browser-side calls to our own server routes (never to Anthropic directly).
import { Explanation, ParsedReport } from "./schemas";
import type { PromptFeature } from "./terrain";

type Result<T> = ({ ok: true } & T) | { ok: false; reason: string };

async function post<T>(url: string, body: unknown, timeoutMs: number): Promise<Result<T>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => null);
    if (!json || typeof json.ok !== "boolean") return { ok: false, reason: `Server error (${res.status}).` };
    return json as Result<T>;
  } catch (e) {
    return { ok: false, reason: (e as Error).name === "AbortError" ? "Request timed out." : "Network error." };
  } finally {
    clearTimeout(timer);
  }
}

export const parseReport = (text: string, features: PromptFeature[] = []) =>
  post<{ report: ParsedReport }>("/api/parse-report", { text, features }, 45_000);

export const explainUpdate = (summary: string) =>
  post<{ explanation: Explanation }>("/api/explain", { summary }, 45_000);
