export type AuditType =
  | "setup"
  | "prior_edit"
  | "report"
  | "explanation"
  | "clue"
  | "assignment"
  | "override"
  | "note"
  | "export"
  | "reset";

export interface AuditEntry {
  id: string;
  at: string; // ISO timestamp
  type: AuditType;
  summary: string;
  data?: unknown;
}

let counter = 0;
export function makeAudit(type: AuditType, summary: string, data?: unknown): AuditEntry {
  counter += 1;
  return { id: `${Date.now().toString(36)}-${counter}`, at: new Date().toISOString(), type, summary, data };
}

export function exportAuditJson(entries: AuditEntry[], meta: Record<string, unknown>): string {
  return JSON.stringify({ exported_at: new Date().toISOString(), ...meta, entries }, null, 2);
}

/** List the fields where the IC's confirmed values differ from the AI proposal. */
export function diffFields<T extends Record<string, unknown>>(proposal: T, confirmed: T): Record<string, { ai: unknown; ic: unknown }> {
  const out: Record<string, { ai: unknown; ic: unknown }> = {};
  for (const k of Object.keys(confirmed)) {
    if (JSON.stringify(proposal[k]) !== JSON.stringify(confirmed[k])) out[k] = { ai: proposal[k], ic: confirmed[k] };
  }
  return out;
}
