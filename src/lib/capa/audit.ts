import { supabase } from '@/integrations/supabase/client';

export type CapaTimelineEvent = {
  capaId: string;
  stepNo?: number | null;
  eventType: string;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  note?: string | null;
};

function short(v: any) {
  if (v === null || v === undefined) return null;
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 2000 ? s.slice(0, 2000) + ' …' : s;
}

export async function logCapaEvent(ev: CapaTimelineEvent, actor?: { id?: string; name?: string }) {
  try {
    await (supabase as any).from('capa_timeline').insert({
      capa_id: ev.capaId,
      step_no: ev.stepNo ?? null,
      event_type: ev.eventType,
      field_name: ev.fieldName ?? null,
      old_value: short(ev.oldValue),
      new_value: short(ev.newValue),
      note: ev.note ?? null,
      actor_id: actor?.id ?? null,
      actor_name: actor?.name ?? null,
    });
  } catch (e) {
    console.error('capa timeline log failed', e);
  }
}

/** Loggt alle geänderten Felder eines Patches (alter/neuer Wert). */
export async function logCapaChanges(
  capaId: string,
  stepNo: number | null,
  before: Record<string, any>,
  patch: Record<string, any>,
  actor?: { id?: string; name?: string },
) {
  const entries = Object.entries(patch).filter(([k, v]) => JSON.stringify(before?.[k] ?? null) !== JSON.stringify(v ?? null));
  for (const [field, value] of entries) {
    await logCapaEvent(
      { capaId, stepNo, eventType: 'feld_geaendert', fieldName: field, oldValue: before?.[field], newValue: value },
      actor,
    );
  }
}
