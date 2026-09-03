/**
 * ALIX INBOX — Datenzugriff auf die bestehende Alix-Connect-Struktur
 * (ac_channels / ac_conversations / ac_messages / ac_contacts).
 * Es werden KEINE Kunden-, Geräte- oder Benutzerstrukturen dupliziert.
 */
import { supabase } from '@/integrations/supabase/client';

export type InboxStatus =
  | 'NEW' | 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER'
  | 'WAITING_INTERNAL' | 'RESOLVED' | 'ARCHIVED';

export const STATUS_LABEL: Record<InboxStatus, string> = {
  NEW: 'Neu',
  OPEN: 'Offen',
  IN_PROGRESS: 'In Bearbeitung',
  WAITING_CUSTOMER: 'Wartet auf Kunde',
  WAITING_INTERNAL: 'Wartet intern',
  RESOLVED: 'Erledigt',
  ARCHIVED: 'Archiviert',
};

export const STATUS_ORDER: InboxStatus[] = [
  'NEW', 'OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'WAITING_INTERNAL', 'RESOLVED', 'ARCHIVED',
];

/** Abbildung auf das bestehende ac_conversation_status Enum (nicht verändert). */
export function toBaseStatus(s: InboxStatus): 'open' | 'pending' | 'resolved' | 'closed' | 'snoozed' {
  switch (s) {
    case 'NEW':
    case 'OPEN': return 'open';
    case 'IN_PROGRESS': return 'pending';
    case 'WAITING_CUSTOMER':
    case 'WAITING_INTERNAL': return 'snoozed';
    case 'RESOLVED': return 'resolved';
    case 'ARCHIVED': return 'closed';
  }
}

export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export const PRIORITY_LABEL: Record<Priority, string> = {
  P1: 'KRITISCH', P2: 'HOCH', P3: 'NORMAL', P4: 'NIEDRIG',
};
export const PRIORITY_ORDER: Priority[] = ['P1', 'P2', 'P3', 'P4'];

/** Bestehende Werte ('urgent'/'high'/'normal'/'low') tolerant auf P1..P4 mappen. */
export function normPriority(p: string | null | undefined): Priority {
  const v = (p || '').toUpperCase();
  if (v === 'P1' || v === 'URGENT' || v === 'CRITICAL') return 'P1';
  if (v === 'P2' || v === 'HIGH') return 'P2';
  if (v === 'P4' || v === 'LOW') return 'P4';
  return 'P3';
}

export const CATEGORIES = [
  'TECHNIK', 'SALES', 'RECHNUNG', 'VERTRAG', 'LIEFERUNG',
  'SCHULUNG', 'WARTUNG', 'TERMIN', 'REKLAMATION', 'SONSTIGES',
] as const;

export type ConversationRow = {
  id: string;
  channel_id: string | null;
  channel_type: string | null;
  customer_id: string | null;
  contact_id: string | null;
  assigned_to: string | null;
  assigned_department: string | null;
  inbox_status: InboxStatus;
  priority: string | null;
  category: string | null;
  subject: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number | null;
  customer_match_required: boolean | null;
  is_test: boolean | null;
  external_thread_id: string | null;
  ac_contacts?: { full_name: string | null; phone: string | null; whatsapp_number: string | null; customer_id: string | null } | null;
  ac_channels?: { name: string | null; department: string | null; provider: string | null } | null;
};

const CONV_SELECT = `
  id, channel_id, channel_type, customer_id, contact_id, assigned_to, assigned_department,
  inbox_status, priority, category, subject, last_message_at, last_message_preview,
  unread_count, customer_match_required, is_test, external_thread_id,
  ac_contacts:contact_id ( full_name, phone, whatsapp_number, customer_id ),
  ac_channels:channel_id ( name, department, provider )
`;

export async function fetchConversations(opts: {
  search?: string;
  includeArchived?: boolean;
  limit?: number;
}): Promise<ConversationRow[]> {
  let q = (supabase as any)
    .from('ac_conversations')
    .select(CONV_SELECT)
    .order('last_message_at', { ascending: false, nullsFirst: false })
    .limit(opts.limit ?? 200);

  if (!opts.includeArchived) q = q.neq('inbox_status', 'ARCHIVED');

  const s = (opts.search || '').trim();
  if (s.length >= 2) {
    const esc = s.replace(/[%,()]/g, ' ');
    q = q.or(`subject.ilike.%${esc}%,last_message_preview.ilike.%${esc}%,external_thread_id.ilike.%${esc}%`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as ConversationRow[];
}

/** Inbox-Sortierung: P1/P2 ungelöst → ungelesen → letzte Nachricht. */
export function sortConversations(rows: ConversationRow[]): ConversationRow[] {
  const done = (r: ConversationRow) => r.inbox_status === 'RESOLVED' || r.inbox_status === 'ARCHIVED';
  const rank = (r: ConversationRow) => {
    const p = normPriority(r.priority);
    if (!done(r) && p === 'P1') return 0;
    if (!done(r) && p === 'P2') return 1;
    if (!done(r) && (r.unread_count ?? 0) > 0) return 2;
    if (!done(r)) return 3;
    return 4;
  };
  return [...rows].sort((a, b) => {
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime();
  });
}

export async function logEvent(
  conversationId: string,
  eventType: string,
  oldValue?: unknown,
  newValue?: unknown,
  metadata?: Record<string, unknown>,
) {
  const { data: auth } = await supabase.auth.getUser();
  await (supabase as any).from('ac_conversation_events').insert({
    conversation_id: conversationId,
    event_type: eventType,
    user_id: auth?.user?.id ?? null,
    old_value: oldValue === undefined ? null : (oldValue as any),
    new_value: newValue === undefined ? null : (newValue as any),
    metadata: metadata ?? null,
  });
}

export async function claimConversation(conv: ConversationRow) {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error('Nicht angemeldet.');
  const nextStatus: InboxStatus = conv.inbox_status === 'NEW' ? 'IN_PROGRESS' : conv.inbox_status;
  const { error } = await (supabase as any).from('ac_conversations').update({
    assigned_to: uid,
    inbox_status: nextStatus,
    status: toBaseStatus(nextStatus),
  }).eq('id', conv.id);
  if (error) throw error;
  await (supabase as any).from('ac_conversation_assignments').insert({
    conversation_id: conv.id,
    assigned_to_user_id: uid,
    assigned_by_user_id: uid,
    assignment_type: 'MANUAL',
  });
  await logEvent(conv.id, 'ASSIGNED', { assigned_to: conv.assigned_to }, { assigned_to: uid });
}

export async function assignConversation(conv: ConversationRow, userId: string, type = 'TRANSFER') {
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await (supabase as any).from('ac_conversations')
    .update({ assigned_to: userId }).eq('id', conv.id);
  if (error) throw error;
  await (supabase as any).from('ac_conversation_assignments').insert({
    conversation_id: conv.id,
    assigned_to_user_id: userId,
    assigned_by_user_id: auth?.user?.id ?? null,
    assignment_type: type,
  });
  await logEvent(conv.id, 'TRANSFERRED', { assigned_to: conv.assigned_to }, { assigned_to: userId });
}

export async function setStatus(conv: ConversationRow, next: InboxStatus) {
  const patch: Record<string, unknown> = { inbox_status: next, status: toBaseStatus(next) };
  if (next === 'RESOLVED') patch.closed_at = new Date().toISOString();
  const { error } = await (supabase as any).from('ac_conversations').update(patch).eq('id', conv.id);
  if (error) throw error;
  await logEvent(conv.id, next === 'RESOLVED' ? 'RESOLVED' : 'STATUS_CHANGED',
    { inbox_status: conv.inbox_status }, { inbox_status: next });
}

export async function setPriority(conv: ConversationRow, next: Priority) {
  const { error } = await (supabase as any).from('ac_conversations')
    .update({ priority: next }).eq('id', conv.id);
  if (error) throw error;
  await logEvent(conv.id, 'PRIORITY_CHANGED', { priority: conv.priority }, { priority: next });
}

export async function setCategory(conv: ConversationRow, next: string) {
  const { error } = await (supabase as any).from('ac_conversations')
    .update({ category: next }).eq('id', conv.id);
  if (error) throw error;
  await logEvent(conv.id, 'CATEGORY_CHANGED', { category: conv.category }, { category: next });
}

export async function markRead(conversationId: string) {
  await (supabase as any).from('ac_conversations')
    .update({ unread_count: 0 }).eq('id', conversationId);
}

export async function addInternalNote(conversationId: string, body: string) {
  const { data: auth } = await supabase.auth.getUser();
  const { data: conv } = await (supabase as any).from('ac_conversations')
    .select('tenant_id, channel_id').eq('id', conversationId).maybeSingle();
  const { error } = await (supabase as any).from('ac_messages').insert({
    tenant_id: conv?.tenant_id ?? null,
    channel_id: conv?.channel_id ?? null,
    conversation_id: conversationId,
    direction: 'internal',
    sender_type: 'user',
    sender_user_id: auth?.user?.id ?? null,
    body,
    is_internal_note: true,
    delivery_status: 'internal',
  });
  if (error) throw error;
}

export type MessageRow = {
  id: string;
  conversation_id: string;
  direction: string;
  sender_type: string;
  sender_user_id: string | null;
  sender_name: string | null;
  body: string | null;
  attachments: any;
  is_internal_note: boolean | null;
  delivery_status: string | null;
  external_message_id: string | null;
  created_at: string;
};

export async function fetchMessages(conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await (supabase as any)
    .from('ac_messages')
    .select('id, conversation_id, direction, sender_type, sender_user_id, sender_name, body, attachments, is_internal_note, delivery_status, external_message_id, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data || []) as MessageRow[];
}

export async function fetchEvents(conversationId: string) {
  const { data } = await (supabase as any)
    .from('ac_conversation_events')
    .select('id, event_type, created_at, old_value, new_value')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);
  return data || [];
}

export function displayName(c: ConversationRow): string {
  return c.ac_contacts?.full_name
    || c.subject?.replace(/^WhatsApp · /, '')
    || c.ac_contacts?.whatsapp_number
    || c.external_thread_id
    || 'Unbekannter Kontakt';
}

export function relTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  return new Date(iso).toLocaleDateString('de-DE');
}

// ============================================================
// Prompt 4 — Outbound WhatsApp, Medien, Quick Replies, Ticket
// ============================================================

export type FeatureFlags = {
  whatsapp_outbound_enabled: boolean;
  media_send_enabled: boolean;
  ticket_from_chat_enabled: boolean;
  voice_messages_enabled: boolean;
  templates_enabled: boolean;
};

export async function fetchFeatureFlags(): Promise<FeatureFlags> {
  const keys = [
    'whatsapp_outbound_enabled', 'media_send_enabled', 'ticket_from_chat_enabled',
    'voice_messages_enabled', 'templates_enabled',
  ];
  const { data } = await (supabase as any).from('app_settings').select('key, value').in('key', keys);
  const map = new Map<string, string>((data || []).map((r: any) => [r.key, String(r.value)]));
  const on = (k: string) => (map.get(k) || '').toLowerCase() === 'true';
  return {
    whatsapp_outbound_enabled: on('whatsapp_outbound_enabled'),
    media_send_enabled: on('media_send_enabled'),
    ticket_from_chat_enabled: on('ticket_from_chat_enabled'),
    voice_messages_enabled: on('voice_messages_enabled'),
    templates_enabled: on('templates_enabled'),
  };
}

export type QuickReply = {
  id: string; title: string; body: string; category: string | null; department: string | null;
};

export async function fetchQuickReplies(): Promise<QuickReply[]> {
  const { data } = await (supabase as any)
    .from('quick_replies').select('id, title, body, category, department')
    .eq('is_active', true).order('title').limit(200);
  return (data || []) as QuickReply[];
}

/** Ist das 24-Stunden-Fenster offen? (letzte Kundennachricht < 24 h) */
export function windowOpen(messages: MessageRow[]): boolean {
  const last = [...messages].reverse().find((m) => m.direction === 'inbound');
  if (!last) return false;
  return Date.now() - new Date(last.created_at).getTime() < 24 * 3600_000;
}

const MEDIA_TYPE_BY_MIME = (mime: string): 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' => {
  if (mime.startsWith('image/')) return 'IMAGE';
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  return 'DOCUMENT';
};

const BLOCKED_MEDIA = /\.(exe|bat|cmd|scr|msi|js|vbs|sh|apk|dll|php|html?|svg)$/i;

/** Lädt eine Datei in den privaten Bucket `inbox-media` (keine öffentliche URL). */
export async function uploadInboxMedia(conversationId: string, file: File) {
  if (BLOCKED_MEDIA.test(file.name)) throw new Error('Dieser Dateityp ist nicht erlaubt.');
  if (file.size > 50 * 1024 * 1024) throw new Error('Die Datei ist größer als 50 MB.');
  const ext = file.name.split('.').pop() || 'bin';
  const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from('inbox-media')
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (error) throw error;
  return {
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || 'application/octet-stream',
    file_size: file.size,
    message_type: MEDIA_TYPE_BY_MIME(file.type || ''),
  };
}

export type SendPayload = {
  conversation_id: string;
  message_type?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'DOCUMENT' | 'TEMPLATE';
  body?: string | null;
  storage_path?: string | null;
  file_name?: string | null;
  mime_type?: string | null;
  file_size?: number | null;
  reply_to_message_id?: string | null;
  template_id?: string | null;
  template_params?: string[];
};

/**
 * Echter WhatsApp-Versand über die Edge Function. Es wird NIE ein Erfolg
 * gemeldet, den der Provider nicht bestätigt hat.
 */
export async function sendWhatsApp(payload: SendPayload) {
  const { data, error } = await supabase.functions.invoke('ac-whatsapp-send', {
    body: { ...payload, client_message_id: crypto.randomUUID() },
  });
  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as any)?.context;
      if (ctx?.text) {
        const parsed = JSON.parse(await ctx.text());
        detail = parsed?.error || parsed?.detail || detail;
      }
    } catch { /* Original-Fehlertext behalten */ }
    throw new Error(detail);
  }
  if (!data?.ok) throw new Error(data?.error || 'Versand fehlgeschlagen.');
  return data;
}

/** Erstellt ein Ticket im bestehenden Ticketsystem (eigene Nummernlogik bleibt aktiv). */
export async function createTicketFromChat(opts: {
  conv: ConversationRow;
  title: string;
  description: string;
  department: string;
  priority: string;
  category?: string | null;
  deviceId?: string | null;
}) {
  const { data: auth } = await supabase.auth.getUser();
  const contact = opts.conv.ac_contacts;
  const { data: ticket, error } = await (supabase as any).from('tickets').insert({
    source_system: 'alixwork',
    source: 'whatsapp',
    title: opts.title,
    subject: opts.title,
    description: opts.description,
    status: 'open',
    priority: opts.priority,
    department: opts.department,
    category: opts.category ?? null,
    customer_name: contact?.full_name ?? null,
    customer_phone: contact?.whatsapp_number ?? contact?.phone ?? null,
    customer_email: (contact as any)?.email ?? null,
    device_id: opts.deviceId ?? null,
    customer_visible_status: 'in_bearbeitung',
    assigned_to: auth?.user?.id ?? null,
  }).select('id, ticket_number, case_number').single();
  if (error) throw error;

  await (supabase as any).from('conversation_tickets').insert({
    conversation_id: opts.conv.id,
    ticket_id: ticket.id,
    created_by: auth?.user?.id ?? null,
  });
  await logEvent(opts.conv.id, 'TICKET_CREATED', null, {
    ticket_id: ticket.id, ticket_number: ticket.ticket_number ?? ticket.case_number,
  });
  return ticket;
}

export async function fetchLinkedTickets(conversationId: string) {
  const { data } = await (supabase as any)
    .from('conversation_tickets')
    .select('ticket_id, created_at, tickets:ticket_id ( id, title, status, ticket_number, case_number )')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false });
  return data || [];
}

/** Signierte, kurzlebige URL für ein Chat-Medium. */
export async function signedMediaUrl(path: string) {
  const { data } = await supabase.storage.from('inbox-media').createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}
