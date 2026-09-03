// ALIX AI – Kontextaufbau mit Datenminimierung (Prompt 5)
// Es wird NUR das an den Provider gegeben, was fuer die Aufgabe noetig ist.
// Keine vollstaendige Kundenakte, keine fremden Kundendaten.

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type ConvContext = {
  conversation: any;
  contact: any;
  customer: { id: string; company_name: string | null } | null;
  devices: Array<{ id: string; model_name: string | null; serial_number: string | null; device_status: string | null }>;
  openTickets: Array<{ id: string; number: string | null; title: string | null; status: string | null; serial_number: string | null; category: string | null; created_at: string }>;
  messages: Array<{ id: string; dir: string; body: string; at: string }>;
  lastCustomerMessage: { id: string; body: string; at: string } | null;
};

const MAX_MSG = 20;
const MAX_LEN = 1200;

export async function loadContext(admin: SupabaseClient, conversationId: string): Promise<ConvContext> {
  const { data: conv } = await admin.from('ac_conversations')
    .select('id, customer_id, contact_id, category, priority, inbox_status, assigned_department, subject')
    .eq('id', conversationId).maybeSingle();
  if (!conv) throw new Error('CONVERSATION_NOT_FOUND');

  let contact: any = null;
  if (conv.contact_id) {
    const { data } = await admin.from('ac_contacts')
      .select('id, full_name, email, phone, whatsapp_number, customer_id')
      .eq('id', conv.contact_id).maybeSingle();
    contact = data ?? null;
  }

  const customerId = conv.customer_id ?? contact?.customer_id ?? null;
  let customer: ConvContext['customer'] = null;
  if (customerId) {
    const { data } = await admin.from('customers')
      .select('id, company_name').eq('id', customerId).maybeSingle();
    customer = data ?? null;
  }

  // Geraete des Kunden (nur eigene!)
  let devices: ConvContext['devices'] = [];
  if (contact?.email) {
    const { data } = await admin.from('lager_devices')
      .select('id, model_name, serial_number, device_status')
      .eq('customer_email', contact.email).limit(25);
    devices = data ?? [];
  }

  // Offene Tickets desselben Kontakts
  let openTickets: ConvContext['openTickets'] = [];
  if (contact?.email || contact?.whatsapp_number || contact?.phone) {
    let q = admin.from('tickets')
      .select('id, ticket_number, case_number, title, status, serial_number, category, created_at')
      .neq('status', 'closed').order('created_at', { ascending: false }).limit(15);
    q = contact.email
      ? q.eq('customer_email', contact.email)
      : q.eq('customer_phone', contact.whatsapp_number ?? contact.phone);
    const { data } = await q;
    openTickets = (data ?? []).map((t: any) => ({
      id: t.id, number: t.ticket_number ?? t.case_number ?? null, title: t.title,
      status: t.status, serial_number: t.serial_number, category: t.category, created_at: t.created_at,
    }));
  }

  const { data: msgs } = await admin.from('ac_messages')
    .select('id, direction, body, created_at, is_internal_note')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MAX_MSG);

  const ordered = (msgs ?? []).filter((m: any) => !m.is_internal_note).reverse();
  const messages = ordered.map((m: any) => ({
    id: m.id,
    dir: m.direction === 'inbound' ? 'KUNDE' : 'ALIX',
    body: String(m.body ?? '').slice(0, MAX_LEN),
    at: m.created_at,
  }));
  const lastIn = [...ordered].reverse().find((m: any) => m.direction === 'inbound');

  return {
    conversation: conv,
    contact,
    customer,
    devices,
    openTickets,
    messages,
    lastCustomerMessage: lastIn ? { id: lastIn.id, body: String(lastIn.body ?? '').slice(0, MAX_LEN), at: lastIn.created_at } : null,
  };
}

/** Untrusted Kundeninhalte klar abgegrenzt, AlixWork-Fakten separat. */
export function renderContext(ctx: ConvContext, opts: { includeFacts?: boolean } = {}): string {
  const lines: string[] = [];
  if (opts.includeFacts !== false) {
    lines.push('=== ALIXWORK FAKTEN (vertrauenswuerdig) ===');
    lines.push(`Kontakt: ${ctx.contact?.full_name ?? 'Nicht bekannt'}`);
    lines.push(`Firma: ${ctx.customer?.company_name ?? 'Nicht bekannt'}`);
    lines.push(`Kundenstatus: ${ctx.customer ? 'BESTANDSKUNDE' : (ctx.contact ? 'BEKANNTER KONTAKT (kein Kundenkonto)' : 'UNBEKANNTER KONTAKT')}`);
    lines.push(`Aktuelle Kategorie: ${ctx.conversation.category ?? 'Nicht gesetzt'}`);
    lines.push(`Aktuelle Prioritaet: ${ctx.conversation.priority ?? 'Nicht gesetzt'}`);
    lines.push(ctx.devices.length
      ? `Geraete des Kunden: ${ctx.devices.map((d) => `${d.model_name ?? '?'} (SN ${d.serial_number ?? '?'}, Status ${d.device_status ?? '?'})`).join('; ')}`
      : 'Geraete des Kunden: Nicht bekannt');
    lines.push(ctx.openTickets.length
      ? `Offene Tickets: ${ctx.openTickets.map((t) => `${t.number ?? t.id.slice(0, 8)} – ${t.title ?? ''} (${t.status})`).join('; ')}`
      : 'Offene Tickets: keine');
  }
  lines.push('');
  lines.push('<<<KUNDENNACHRICHTEN — UNTRUSTED USER CONTENT>>>');
  for (const m of ctx.messages) {
    lines.push(`[${m.dir} ${new Date(m.at).toLocaleString('de-DE')}] ${m.body}`);
  }
  lines.push('<<<ENDE KUNDENNACHRICHTEN>>>');
  return lines.join('\n');
}

const SERIAL_RE = /\b[A-Z]{1,4}[-_ ]?\d{4,12}[A-Z0-9]{0,4}\b/gi;
const ERROR_RE = /\b(?:E|ERR|ERROR|CODE|FEHLER)[\s-]?0?\d{1,4}\b/gi;

/** Kandidaten aus Text – danach IMMER gegen echte Geraetedaten validieren. */
export function extractCandidates(text: string) {
  const serials = Array.from(new Set((text.match(SERIAL_RE) ?? []).map((s) => s.trim().toUpperCase())));
  const errors = Array.from(new Set((text.match(ERROR_RE) ?? []).map((s) => s.trim().toUpperCase().replace(/\s+/g, ' '))));
  return { serials, errors };
}

/** Validierung gegen echte AlixWork-Geraete (keine Zuordnung nur per Namensaehnlichkeit). */
export async function resolveDevice(
  admin: SupabaseClient,
  ctx: ConvContext,
  candidates: string[],
  aiSerial: string | null,
) {
  const all = Array.from(new Set([...(aiSerial ? [aiSerial.toUpperCase()] : []), ...candidates]));
  const norm = (s: string) => s.replace(/[^A-Z0-9]/gi, '').toUpperCase();

  // 1) exakter Treffer im Geraetebestand des Kunden
  for (const cand of all) {
    const hit = ctx.devices.find((d) => d.serial_number && norm(d.serial_number) === norm(cand));
    if (hit) return { device: hit, serial: hit.serial_number, confidence: 0.99, ambiguous: false as const, options: [] as any[] };
  }
  // 2) exakter Treffer global (Geraet evtl. noch nicht zugeordnet)
  for (const cand of all) {
    const { data } = await admin.from('lager_devices')
      .select('id, model_name, serial_number, device_status')
      .ilike('serial_number', cand).limit(2);
    if (data && data.length === 1) {
      return { device: data[0], serial: data[0].serial_number, confidence: 0.9, ambiguous: false as const, options: [] as any[] };
    }
    if (data && data.length > 1) {
      return { device: null, serial: cand, confidence: 0.4, ambiguous: true as const, options: data };
    }
  }
  // 3) genau ein Geraet im Bestand -> Vorschlag mit niedriger Confidence
  if (ctx.devices.length === 1) {
    return { device: ctx.devices[0], serial: ctx.devices[0].serial_number, confidence: 0.5, ambiguous: false as const, options: [] as any[] };
  }
  if (ctx.devices.length > 1) {
    return { device: null, serial: all[0] ?? null, confidence: 0.2, ambiguous: true as const, options: ctx.devices };
  }
  return { device: null, serial: all[0] ?? null, confidence: 0.1, ambiguous: false as const, options: [] as any[] };
}

/** Heuristische Aehnlichkeit zu bestehenden offenen Tickets (kein Auto-Merge). */
export function matchTicket(ctx: ConvContext, opts: { serial: string | null; category: string | null; errorCodes: string[]; problem: string }) {
  let best: { ticket: ConvContext['openTickets'][number]; score: number } | null = null;
  const words = new Set(opts.problem.toLowerCase().split(/\W+/).filter((w) => w.length > 4));
  for (const t of ctx.openTickets) {
    let score = 0;
    if (opts.serial && t.serial_number && t.serial_number.toUpperCase() === opts.serial.toUpperCase()) score += 0.5;
    if (opts.category && t.category && t.category.toUpperCase() === opts.category.toUpperCase()) score += 0.15;
    const title = (t.title ?? '').toLowerCase();
    for (const c of opts.errorCodes) if (title.includes(c.toLowerCase())) score += 0.2;
    let overlap = 0;
    for (const w of words) if (title.includes(w)) overlap++;
    score += Math.min(0.25, overlap * 0.06);
    const ageDays = (Date.now() - new Date(t.created_at).getTime()) / 86400000;
    if (ageDays < 14) score += 0.1;
    if (!best || score > best.score) best = { ticket: t, score: Math.min(1, score) };
  }
  if (!best || best.score < 0.35) return null;
  return best;
}
