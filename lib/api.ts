// Browser-side calls to our own server routes (never to Anthropic directly).
import { Explanation, ParsedReport } from "./schemas";
import type { PromptFeature } from "./terrain";
import type { Subject } from "./subject";
import type { PublishFeature } from "./caltopoPublish";

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

export const parseSubject = (text: string) =>
  post<{ subject: Subject; unclear: string[] }>(
    "/api/parse-subject",
    { text, now: new Date().toISOString(), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    45_000,
  );

export async function caltopoStatus(): Promise<{ configured: boolean; mapUrl?: string; mapId?: string }> {
  try {
    const res = await fetch("/api/caltopo", { signal: AbortSignal.timeout(8000) });
    return (await res.json()) as { configured: boolean; mapUrl?: string };
  } catch {
    return { configured: false };
  }
}

export type OwnedFeature = { id: string; class: "Marker" | "Shape" | "Folder" };

export const publishToCalTopo = (features: PublishFeature[], previous: OwnedFeature[], label: string) =>
  post<{ created: OwnedFeature[]; deleted: number; leftovers: OwnedFeature[]; mapUrl: string }>("/api/caltopo", { features, previous, label }, 60_000);
