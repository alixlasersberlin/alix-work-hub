import { supabase } from "@/integrations/supabase/client";

/**
 * Erfasst eine Feldänderung im ALIX Audit Center (Phase 2).
 * WORM: nur Insert – Update/Delete sind per RLS gesperrt.
 */
export async function logAuditChange(params: {
  module: string;
  object_type: string;
  object_id: string;
  field: string;
  old_value?: unknown;
  new_value?: unknown;
  reason?: string;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("audit_changes").insert({
      user_id: user.id,
      user_email: user.email ?? null,
      module: params.module,
      object_type: params.object_type,
      object_id: params.object_id,
      field: params.field,
      old_value: (params.old_value ?? null) as any,
      new_value: (params.new_value ?? null) as any,
      reason: params.reason ?? null,
    });
  } catch {
    // Audit darf UX nie blockieren
  }
}

/** Diff-Helper: erzeugt für jedes veränderte Feld einen audit_changes-Eintrag. */
export async function logAuditDiff(params: {
  module: string;
  object_type: string;
  object_id: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  ignoreFields?: string[];
  reason?: string;
}) {
  const ignore = new Set(params.ignoreFields ?? ["updated_at", "created_at"]);
  const keys = new Set([...Object.keys(params.before ?? {}), ...Object.keys(params.after ?? {})]);
  const rows: any[] = [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  for (const k of keys) {
    if (ignore.has(k)) continue;
    const a = params.before?.[k];
    const b = params.after?.[k];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    rows.push({
      user_id: user.id,
      user_email: user.email ?? null,
      module: params.module,
      object_type: params.object_type,
      object_id: params.object_id,
      field: k,
      old_value: (a ?? null) as any,
      new_value: (b ?? null) as any,
      reason: params.reason ?? null,
    });
  }
  if (rows.length === 0) return;
  try { await supabase.from("audit_changes").insert(rows); } catch {}
}
