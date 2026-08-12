import { supabase } from '@/integrations/supabase/client';

export type FcCase = {
  id: string;
  case_type: string;
  trigger_event: string;
  source_table: string;
  source_id: string;
  order_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  customer_number: string | null;
  reference_number: string | null;
  order_amount: number;
  delivered_amount: number;
  invoiced_amount: number;
  paid_amount: number;
  open_to_invoice: number;
  open_to_pay: number;
  status: string;
  priority: string;
  traffic: string;
  billing_flag: string | null;
  assigned_to: string | null;
  due_date: string | null;
  followup_date: string | null;
  approval_status: string;
  approved_by: string | null;
  approved_at: string | null;
  escalated_at: string | null;
  notes: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FcEvent = {
  id: string;
  case_id: string;
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  invoice_number: string | null;
  comment: string | null;
  user_name: string | null;
  created_at: string;
};

/** Typed-loose accessor, solange die generierten Typen fc_* noch nicht kennen. */
const sb = supabase as any;

export const FC_STATUS: Record<string, string> = {
  neu: 'Neu',
  pruefung_erforderlich: 'Prüfung erforderlich',
  rechnung_erforderlich: 'Rechnung erforderlich',
  rechnung_zurueckgestellt: 'Rechnung zurückstellen',
  rechnung_ohne_versand: 'Rechnung stellen (ohne Versand)',
  mietkauf_rechnung: 'Mietkauf Rechnung stellen',
  rechnung_erstellen: 'Rechnung erstellen',
  rechnung_erstellt: 'Rechnung erstellt',
  rechnung_vorhanden: 'Rechnung vorhanden',
  pruefung_rechnung: 'Prüfung Rechnung',
  differenz: 'Differenz',
  rueckfrage: 'Rückfrage',
  freigegeben: 'Freigegeben',
  abgeschlossen: 'Abgeschlossen',
};

export const FC_TRAFFIC: Record<string, { label: string; cls: string; dot: string }> = {
  gruen: { label: 'Grün', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', dot: 'bg-emerald-400' },
  gelb: { label: 'Gelb', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20', dot: 'bg-amber-400' },
  rot: { label: 'Rot', cls: 'bg-destructive text-destructive-foreground border-destructive', dot: 'bg-destructive-foreground' },
  kritisch: { label: 'Kritisch', cls: 'bg-red-700 text-white border-red-800', dot: 'bg-white' },
};

export const FC_TYPE_LABEL: Record<string, string> = {
  AUFTRAG: 'AUFTRAG',
  LIEFERUNG: 'LIEFERUNG',
  TEILLIEFERUNG: 'TEILLIEFERUNG',
  REPARATUR: 'REPARATUR',
  SCHLUSSRECHNUNG: 'SCHLUSSRECHNUNG',
  SONSTIGER: 'SONSTIGER VORGANG',
};

export async function listFcCases(): Promise<FcCase[]> {
  const { data, error } = await sb
    .from('fc_cases')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []) as FcCase[];
}

export async function listFcEvents(caseId: string): Promise<FcEvent[]> {
  const { data, error } = await sb
    .from('fc_events')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as FcEvent[];
}

export async function updateFcCase(id: string, patch: Partial<FcCase>) {
  const { error } = await sb.from('fc_cases').update(patch).eq('id', id);
  if (error) throw error;
}

export async function addFcEvent(caseId: string, e: Partial<FcEvent>) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await sb.from('fc_events').insert({
    case_id: caseId,
    event_type: e.event_type ?? 'kommentar',
    old_status: e.old_status ?? null,
    new_status: e.new_status ?? null,
    invoice_number: e.invoice_number ?? null,
    comment: e.comment ?? null,
    user_id: auth?.user?.id ?? null,
    user_name: auth?.user?.email ?? null,
  });
  if (error) throw error;
}

export async function setFcStatus(c: FcCase, newStatus: string, comment?: string) {
  if (newStatus === 'abgeschlossen' && c.approval_status !== 'freigegeben') {
    throw new Error('Abschluss nicht möglich: Finance-Freigabe fehlt.');
  }
  await updateFcCase(c.id, {
    status: newStatus,
    closed_at: newStatus === 'abgeschlossen' ? new Date().toISOString() : null,
    traffic: newStatus === 'abgeschlossen' || newStatus === 'freigegeben' ? 'gruen' : c.traffic,
  } as Partial<FcCase>);
  await addFcEvent(c.id, { event_type: 'status', old_status: c.status, new_status: newStatus, comment });
}

/** Rechnungen eines Vorgangs (über Auftragsnummer als Referenz). */
export async function loadCaseInvoices(reference: string | null) {
  if (!reference) return [];
  const { data, error } = await supabase
    .from('zoho_invoices')
    .select('id, invoice_number, invoice_date, total, balance, status, payment_status, is_deposit')
    .eq('reference_number', reference)
    .order('invoice_date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export const FC_APPROVAL: Record<string, { label: string; cls: string }> = {
  offen: { label: 'Freigabe offen', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  freigegeben: { label: 'Freigegeben', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  abgelehnt: { label: 'Abgelehnt', cls: 'bg-destructive text-destructive-foreground border-destructive' },
};

/** Finance-Freigabe setzen (Voraussetzung für endgültigen Abschluss). */
export async function setFcApproval(c: FcCase, approval: 'offen' | 'freigegeben' | 'abgelehnt', comment?: string) {
  const { data: auth } = await supabase.auth.getUser();
  await updateFcCase(c.id, {
    approval_status: approval,
    approved_by: approval === 'offen' ? null : (auth?.user?.id ?? null),
    approved_at: approval === 'offen' ? null : new Date().toISOString(),
  } as Partial<FcCase>);
  await addFcEvent(c.id, {
    event_type: 'freigabe',
    comment: comment || `Finance-Freigabe: ${FC_APPROVAL[approval]?.label ?? approval}`,
  });
}

export type FcMonthClose = {
  from: string; to: string;
  orders_closed: number; invoices_created: number; invoices_missing: number;
  revenue_not_invoiced: number; open_final_invoices: number; open_repair_invoices: number;
  open_partial_deliveries: number; open_to_pay_total: number;
  approved: number; awaiting_approval: number;
};

export async function loadFcMonthClose(from: string, to: string): Promise<FcMonthClose> {
  const { data, error } = await sb.rpc('fc_month_close', { p_from: from, p_to: to });
  if (error) throw error;
  return data as FcMonthClose;
}

export const fmtEur = (n: number | null | undefined) =>
  new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(n ?? 0));
