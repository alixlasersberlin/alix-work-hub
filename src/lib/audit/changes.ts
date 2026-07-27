import { supabase } from "@/integrations/supabase/client";

/**
 * Erfasst eine Feldänderung im ALIX Audit Center (Phase 2).
 * WORM: nur Insert – Update/Delete sind per RLS gesperrt.
 * `module` (logische Zuordnung) + Kontext wandern in `meta`.
 */
export async function logAuditChange(params: {
  module: string;
  table_name: string;
  record_id: string;
  field_name: string;
  operation?: "update" | "insert" | "delete";
  old_value?: unknown;
  new_value?: unknown;
  reason?: string;
  meta?: Record<string, unknown>;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("audit_changes").insert({
      user_id: user.id,
      table_name: params.table_name,
      record_id: params.record_id,
      field_name: params.field_name,
      operation: params.operation ?? "update",
      old_value: params.old_value === null || params.old_value === undefined ? null
        : typeof params.old_value === "string" ? params.old_value : JSON.stringify(params.old_value),
      new_value: params.new_value === null || params.new_value === undefined ? null
        : typeof params.new_value === "string" ? params.new_value : JSON.stringify(params.new_value),
      meta: {
        module: params.module,
        user_email: user.email ?? null,
        reason: params.reason ?? null,
        ...(params.meta ?? {}),
      } as any,
    });
  } catch {
    // Audit darf UX nie blockieren
  }
}

/** Diff-Helper: erzeugt für jedes veränderte Feld einen audit_changes-Eintrag. */
export async function logAuditDiff(params: {
  module: string;
  table_name: string;
  record_id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  ignoreFields?: string[];
  reason?: string;
}) {
  const ignore = new Set(params.ignoreFields ?? ["updated_at", "created_at"]);
  const keys = new Set([...Object.keys(params.before ?? {}), ...Object.keys(params.after ?? {})]);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const rows: any[] = [];
  for (const k of keys) {
    if (ignore.has(k)) continue;
    const a = params.before?.[k];
    const b = params.after?.[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    rows.push({
      user_id: user.id,
      table_name: params.table_name,
      record_id: params.record_id,
      field_name: k,
      operation: "update",
      old_value: a === null || a === undefined ? null : typeof a === "string" ? a : JSON.stringify(a),
      new_value: b === null || b === undefined ? null : typeof b === "string" ? b : JSON.stringify(b),
      meta: { module: params.module, user_email: user.email ?? null, reason: params.reason ?? null } as any,
    });
  }
  if (rows.length === 0) return;
  try { await supabase.from("audit_changes").insert(rows); } catch {}
}
