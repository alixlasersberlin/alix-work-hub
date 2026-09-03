/**
 * ALIX MOBILE COMMAND CENTER – Client-Anbindung (Prompt 6).
 *
 * Grundregeln:
 *  - AlixWork bleibt die zentrale Wahrheit: keine zweite Kunden-, Geräte-,
 *    Ticket- oder Status-Verwaltung. Es werden ausschliesslich bestehende
 *    Tabellen/Funktionen gelesen.
 *  - Aggregation läuft serverseitig (RPC `get_mobile_command_center`,
 *    `mobile_magic_search`) statt über viele Einzel-Queries (kein N+1).
 *  - Rollenprüfung passiert serverseitig; das Frontend rendert nur, was
 *    zurückkommt.
 */
import { supabase } from '@/integrations/supabase/client';

/* ------------------------------------------------------------------ Flags */

export const CC_FLAG_KEYS = [
  'command_center_enabled',
  'team_presence_enabled',
  'supervisor_cockpit_enabled',
  'magic_search_enabled',
  'follow_up_reminders_enabled',
  'shift_handover_enabled',
  'management_kpis_enabled',
  'ai_daily_brief_enabled',
] as const;
export type CcFlagKey = typeof CC_FLAG_KEYS[number];
export type CcFlags = Record<CcFlagKey, boolean>;

export const SLA_KEYS = [
  'sla_p1_warn_minutes', 'sla_p1_overdue_minutes',
  'sla_p2_warn_minutes', 'sla_p2_overdue_minutes',
  'sla_default_warn_minutes', 'sla_default_overdue_minutes',
] as const;
export type SlaKey = typeof SLA_KEYS[number];

export async function fetchCcFlags(): Promise<CcFlags> {
  const { data } = await (supabase as any).from('app_settings').select('key, value').in('key', CC_FLAG_KEYS as any);
  const map = new Map<string, string>((data || []).map((r: any) => [r.key, String(r.value)]));
  const out = {} as CcFlags;
  // Fail-open: fehlt der Schlüssel, gilt der Bereich als aktiv (Migration setzt ihn).
  for (const k of CC_FLAG_KEYS) out[k] = (map.get(k) ?? 'true').toLowerCase() === 'true';
  return out;
}

export async function fetchSlaThresholds(): Promise<Record<SlaKey, number>> {
  const defaults: Record<SlaKey, number> = {
    sla_p1_warn_minutes: 5, sla_p1_overdue_minutes: 10,
    sla_p2_warn_minutes: 15, sla_p2_overdue_minutes: 30,
    sla_default_warn_minutes: 60, sla_default_overdue_minutes: 120,
  };
  const { data } = await (supabase as any).from('app_settings').select('key, value').in('key', SLA_KEYS as any);
  for (const r of data || []) {
    const n = Number(r.value);
    if (Number.isFinite(n)) (defaults as any)[r.key] = n;
  }
  return defaults;
}

export async function setSetting(key: string, value: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await (supabase as any).from('app_settings')
    .upsert({ key, value, updated_by: auth?.user?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  if (error) throw error;
}

/* ----------------------------------------------------------------- SLA */

export type SlaState = 'IM_ZEITPLAN' | 'BALD_FAELLIG' | 'UEBERFAELLIG' | 'KRITISCH';

export const SLA_LABEL: Record<SlaState, string> = {
  IM_ZEITPLAN: 'Im Zeitplan',
  BALD_FAELLIG: 'Bald fällig',
  UEBERFAELLIG: 'Überfällig',
  KRITISCH: 'Kritisch',
};

/** Bewertet die Wartezeit gegen die konfigurierten Schwellwerte (keine Hardcodes). */
export function slaState(priority: string | null | undefined, minutes: number, th: Record<SlaKey, number>): SlaState {
  const p = (priority || 'P3').toUpperCase();
  const warn = p === 'P1' ? th.sla_p1_warn_minutes : p === 'P2' ? th.sla_p2_warn_minutes : th.sla_default_warn_minutes;
  const over = p === 'P1' ? th.sla_p1_overdue_minutes : p === 'P2' ? th.sla_p2_overdue_minutes : th.sla_default_overdue_minutes;
  if (minutes >= over * 2) return 'KRITISCH';
  if (minutes >= over) return 'UEBERFAELLIG';
  if (minutes >= warn) return 'BALD_FAELLIG';
  return 'IM_ZEITPLAN';
}

export function minutesLabel(min: number): string {
  if (min < 1) return 'gerade eben';
  if (min < 60) return `${Math.round(min)} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} Std. ${Math.round(min % 60)} Min.`;
  return `${Math.floor(h / 24)} Tg. ${h % 24} Std.`;
}

/* --------------------------------------------------------- Snapshot (RPC) */

export type PriorityItem = {
  id: string;
  kind: 'conversation';
  prio: string;
  title: string;
  preview: string | null;
  assigned_to: string | null;
  category: string | null;
  waiting_minutes: number;
};

export type TeamMember = {
  user_id: string;
  name: string | null;
  status: string;
  activity: string | null;
  last_seen_at: string | null;
  chats: number;
  p1p2: number;
  tickets: number;
  oldest_wait_minutes: number | null;
};

export type CommandSnapshot = {
  generated_at: string;
  is_supervisor: boolean;
  counts: { unread: number; p1p2: number; unanswered: number; mine: number; unassigned: number };
  tickets: { open: number; mine: number; overdue: number };
  escalations: number;
  reminders_due: number;
  priority_items: PriorityItem[];
  team: TeamMember[];
};

export async function fetchCommandSnapshot(): Promise<CommandSnapshot> {
  const { data, error } = await (supabase as any).rpc('get_mobile_command_center');
  if (error) throw error;
  return data as CommandSnapshot;
}

/** Einfacher, transparenter Workload-Score – rein operative Arbeitsverteilung. */
export function workloadScore(m: TeamMember): { score: number; level: 'NIEDRIG' | 'MITTEL' | 'HOCH' } {
  const score = m.p1p2 * 5 + Math.max(0, m.chats - m.p1p2) * 1 + m.tickets * 2;
  return { score, level: score >= 15 ? 'HOCH' : score >= 7 ? 'MITTEL' : 'NIEDRIG' };
}

/* ----------------------------------------------------------- Magic Search */

export type MagicResults = {
  customers: { id: string; company: string | null; contact: string | null; email: string | null; phone: string | null; number: string | null }[];
  devices: { id: string; serial: string | null; model: string | null; status: string | null; customer: string | null }[];
  tickets: { id: string; number: string | null; case: string | null; subject: string | null; status: string | null; priority: string | null; customer: string | null; serial: string | null }[];
  orders: { id: string; number: string | null; status: string | null; total: number | null; date: string | null; magic_status: string | null }[];
  conversations: { id: string; preview: string | null; priority: string | null; status: string | null; at: string | null }[];
};

export const EMPTY_RESULTS: MagicResults = { customers: [], devices: [], tickets: [], orders: [], conversations: [] };

export async function magicSearch(q: string): Promise<MagicResults> {
  const term = q.trim();
  if (term.length < 2) return EMPTY_RESULTS;
  const { data, error } = await (supabase as any).rpc('mobile_magic_search', { q: term });
  if (error) throw error;
  return { ...EMPTY_RESULTS, ...(data as MagicResults) };
}

/* ------------------------------------------------------------- Presence */

export const PRESENCE_STATES = ['ONLINE', 'BESCHAEFTIGT', 'PAUSE', 'NICHT_VERFUEGBAR', 'OFFLINE'] as const;
export type PresenceState = typeof PRESENCE_STATES[number];

export const PRESENCE_LABEL: Record<string, string> = {
  ONLINE: 'Online',
  BESCHAEFTIGT: 'Beschäftigt',
  PAUSE: 'Pause',
  NICHT_VERFUEGBAR: 'Nicht verfügbar',
  OFFLINE: 'Offline',
  SCHULUNG: 'Schulung',
  AUSSER_HAUS: 'Ausser Haus',
  TECHNIK_EINSATZ: 'Technik-Einsatz',
};

export async function fetchMyPresence(userId: string) {
  const { data } = await (supabase as any)
    .from('ac_user_presence').select('*').eq('user_id', userId).maybeSingle();
  return data as { status: string; current_activity: string | null; manual_status: boolean; last_seen_at: string | null } | null;
}

/** Manuell gesetzte Status haben Vorrang vor automatischer Erkennung. */
export async function setMyPresence(userId: string, status: string, activity?: string | null) {
  const { error } = await (supabase as any).from('ac_user_presence').upsert({
    user_id: userId,
    status,
    current_activity: activity ?? null,
    manual_status: status !== 'ONLINE',
    last_seen_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Heartbeat: setzt ONLINE nur, wenn kein manueller Status gesetzt ist. */
export async function touchPresence(userId: string) {
  const cur = await fetchMyPresence(userId);
  if (cur?.manual_status) {
    await (supabase as any).from('ac_user_presence')
      .update({ last_seen_at: new Date().toISOString() }).eq('user_id', userId);
    return;
  }
  await (supabase as any).from('ac_user_presence').upsert({
    user_id: userId, status: 'ONLINE', manual_status: false,
    last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
}

/* ------------------------------------------------------ Follow-up Reminder */

export type FollowUpReminder = {
  id: string;
  user_id: string;
  conversation_id: string | null;
  ticket_id: string | null;
  remind_at: string;
  note: string | null;
  status: 'SCHEDULED' | 'TRIGGERED' | 'COMPLETED' | 'CANCELLED';
  created_at: string;
  completed_at: string | null;
};

export async function fetchMyReminders(includeDone = false): Promise<FollowUpReminder[]> {
  let q = (supabase as any).from('follow_up_reminders').select('*').order('remind_at', { ascending: true }).limit(200);
  if (!includeDone) q = q.in('status', ['SCHEDULED', 'TRIGGERED']);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as FollowUpReminder[];
}

export async function createReminder(input: {
  remindAt: Date; note?: string; conversationId?: string | null; ticketId?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) throw new Error('Nicht angemeldet.');
  const { data, error } = await (supabase as any).from('follow_up_reminders').insert({
    user_id: auth.user.id,
    remind_at: input.remindAt.toISOString(),
    note: input.note ?? null,
    conversation_id: input.conversationId ?? null,
    ticket_id: input.ticketId ?? null,
  }).select('id').single();
  if (error) throw error;
  return data.id as string;
}

export async function setReminderStatus(id: string, status: FollowUpReminder['status']) {
  const { error } = await (supabase as any).from('follow_up_reminders').update({
    status, completed_at: status === 'COMPLETED' ? new Date().toISOString() : null,
  }).eq('id', id);
  if (error) throw error;
}

/* ---------------------------------------------------------- Shift Handover */

export type Handover = {
  id: string; from_user_id: string; to_user_id: string | null; department: string | null;
  summary: string | null; status: 'OPEN' | 'ACCEPTED' | 'CANCELLED';
  created_at: string; accepted_at: string | null; accepted_by_user_id: string | null;
};

export type HandoverItem = {
  id: string; handover_id: string; item_type: string;
  conversation_id: string | null; ticket_id: string | null;
  priority: string | null; note: string | null; created_at: string;
};

export async function fetchHandovers(): Promise<Handover[]> {
  const { data, error } = await (supabase as any)
    .from('shift_handovers').select('*').order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return (data || []) as Handover[];
}

export async function fetchHandoverItems(handoverId: string): Promise<HandoverItem[]> {
  const { data, error } = await (supabase as any)
    .from('shift_handover_items').select('*').eq('handover_id', handoverId).order('created_at');
  if (error) throw error;
  return (data || []) as HandoverItem[];
}

/** Sammelt die offenen Vorgänge des Mitarbeiters (bestehende Daten, keine Kopien). */
export async function collectHandoverCandidates(userId: string) {
  const [convs, tks] = await Promise.all([
    (supabase as any).from('ac_conversations')
      .select('id, priority, last_message_preview, category, status')
      .eq('assigned_to', userId).neq('status', 'closed').limit(50),
    (supabase as any).from('tickets')
      .select('id, ticket_number, subject, title, priority, status')
      .eq('assigned_to', userId)
      .not('status', 'in', '("closed","geschlossen","erledigt","resolved")').limit(50),
  ]);
  return {
    conversations: (convs.data || []) as any[],
    tickets: (tks.data || []) as any[],
  };
}

export async function createHandover(input: {
  toUserId?: string | null; department?: string | null; summary: string;
  items: { item_type: string; conversation_id?: string | null; ticket_id?: string | null; priority?: string | null; note?: string | null }[];
}) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user?.id) throw new Error('Nicht angemeldet.');
  const { data, error } = await (supabase as any).from('shift_handovers').insert({
    from_user_id: auth.user.id,
    to_user_id: input.toUserId ?? null,
    department: input.department ?? null,
    summary: input.summary,
  }).select('id').single();
  if (error) throw error;
  const id = data.id as string;
  if (input.items.length) {
    const { error: e2 } = await (supabase as any).from('shift_handover_items')
      .insert(input.items.map((i) => ({ ...i, handover_id: id })));
    if (e2) throw e2;
  }
  await logMobileAudit('HANDOVER_CREATED', { handover_id: id, items: input.items.length });
  return id;
}

export async function acceptHandover(id: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await (supabase as any).from('shift_handovers').update({
    status: 'ACCEPTED', accepted_at: new Date().toISOString(), accepted_by_user_id: auth?.user?.id ?? null,
  }).eq('id', id);
  if (error) throw error;
  await logMobileAudit('HANDOVER_ACCEPTED', { handover_id: id });
}

export async function cancelHandover(id: string) {
  const { error } = await (supabase as any).from('shift_handovers')
    .update({ status: 'CANCELLED', cancelled_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ Audit */

/**
 * Mobile-spezifische Audit-Events. Wird NUR für Aktionen genutzt, die der
 * Backend-Prozess nicht ohnehin selbst protokolliert (keine doppelten Logs).
 */
export async function logMobileAudit(action: string, details: Record<string, any>, conversationId?: string) {
  try {
    if (conversationId) {
      await (supabase as any).from('ac_conversation_events').insert({
        conversation_id: conversationId, event_type: action, metadata: details,
      });
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    await (supabase as any).from('audit_logs').insert({
      user_id: auth?.user?.id ?? null, action, details,
    });
  } catch {
    /* Audit darf die Benutzeraktion nie blockieren */
  }
}
