// Erstellt aus einem für den Aufrufer sichtbaren und änderbaren Ticket einen Kalendertermin.
// Sicherheit: aktive Mitarbeiter (requireCallerAccess), Ticket-Lesen und -Ändern mit Aufruferrechten (RLS),
// E-Mail nur an die gespeicherte Ticketadresse mit escaptem Inhalt, keine Rohfehler an den Client.
import { z } from 'npm:zod@3.25.76';
import { escapeHtml, isUuid, jsonResponse, safeError } from '../_shared/security-core.ts';

const PUBLIC_BASE = 'https://alixwork.de';
const text = (max: number) => z.string().max(max).optional().nullable();
export const AppointmentInput = z.object({
  ticket_id: z.string().uuid(),
  start_at: z.string().refine(v => !Number.isNaN(Date.parse(v)), 'Ungültiges Datum'),
  end_at: z.string().refine(v => !Number.isNaN(Date.parse(v)), 'Ungültiges Datum').optional().nullable(),
  event_kind: z.string().regex(/^[a-z_]{2,40}$/).default('kundentermin'),
  title: text(300), description: text(4000), requires_confirmation: z.boolean().default(true),
  department_id: text(200), assigned_user_id: text(64), resource_id: text(64),
  customer_name: text(300), customer_email: text(320), customer_phone: text(64), address: text(500),
  location: text(500), internal_note: text(4000), external_note: text(4000), priority: text(40),
});

export function normalizePriority(value: unknown): 'low' | 'normal' | 'high' | 'urgent' {
  const map: Record<string, 'low' | 'normal' | 'high' | 'urgent'> = {
    low: 'low', niedrig: 'low', normal: 'normal', mittel: 'normal', medium: 'normal', high: 'high', hoch: 'high',
    urgent: 'urgent', kritisch: 'urgent', critical: 'urgent', dringend: 'urgent',
  };
  return map[String(value ?? 'normal').trim().toLowerCase()] ?? 'normal';
}

export function ticketPatchFor(kind: string, startIso: string): Record<string, unknown> {
  if (['frist', 'rueckruf', 'eskalation'].includes(kind)) return { due_at: startIso };
  if (kind === 'wiedervorlage') return { follow_up_at: startIso };
  return { appointment_at: startIso, status: 'Termin vereinbart' };
}

export interface AppointmentDeps {
  access: (req: Request) => Promise<{ response: Response } | { caller: any; user: { id: string } }>;
  admin: any;
  sendMail: (body: Record<string, unknown>, auth: string) => Promise<{ error: unknown }>;
}

export async function handleAppointment(req: Request, cors: Record<string, string>, deps: AppointmentDeps): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return jsonResponse(cors, { error: 'Methode nicht erlaubt' }, 405);
  const access = await deps.access(req);
  if ('response' in access) return access.response;
  const parsed = AppointmentInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonResponse(cors, { error: 'Ungültige Eingabe', fields: parsed.error.flatten().fieldErrors }, 400);
  const b = parsed.data;
  const { caller, user } = access;
  const admin = deps.admin;
  try {
    // Nur Tickets, die der Mitarbeiter selbst lesen darf
    const { data: ticket, error: tErr } = await caller.from('tickets')
      .select('id, ticket_number, title, department, customer_name, customer_email, customer_phone, customer_address, assigned_to, priority')
      .eq('id', b.ticket_id).maybeSingle();
    if (tErr || !ticket) return jsonResponse(cors, { error: 'Ticket nicht gefunden' }, 404);

    let escDeptId: string | null = isUuid(b.department_id) ? b.department_id : null;
    const nameCandidate = !escDeptId && b.department_id ? b.department_id : (ticket.department ?? null);
    if (!escDeptId && nameCandidate) {
      const { data: d } = await admin.from('esc_departments').select('id').ilike('name', String(nameCandidate).replace(/[%_\\]/g, '\\$&')).maybeSingle();
      escDeptId = d?.id ?? null;
    }
    if (!escDeptId) {
      const { data: fallback } = await admin.from('esc_departments').select('id').limit(1).maybeSingle();
      escDeptId = fallback?.id ?? null;
    }
    if (!escDeptId) return jsonResponse(cors, { error: 'Keine ESC-Abteilung vorhanden — bitte in ESC → Abteilungen anlegen.' }, 400);

    const assignedUserId = isUuid(b.assigned_user_id) ? b.assigned_user_id : (isUuid(ticket.assigned_to) ? ticket.assigned_to : null);
    const resourceId = isUuid(b.resource_id) ? b.resource_id : null;
    const start = new Date(b.start_at);
    const end = b.end_at ? new Date(b.end_at) : new Date(start.getTime() + 30 * 60 * 1000);
    if (end <= start) return jsonResponse(cors, { error: 'Ungültige Eingabe', fields: { end_at: ['Ende muss nach Beginn liegen'] } }, 400);
    const patch = ticketPatchFor(b.event_kind, start.toISOString());

    // Änderungsrecht am Ticket mit Aufruferrechten nachweisen, bevor etwas angelegt wird
    const { data: changed, error: uErr } = await caller.from('tickets').update(patch).eq('id', b.ticket_id).select('id');
    if (uErr || !changed?.length) return jsonResponse(cors, { error: 'Keine Berechtigung, dieses Ticket zu ändern' }, 403);

    const token = crypto.randomUUID().replace(/-/g, '');
    const { data: ev, error: evErr } = await admin.from('esc_events').insert({
      ticket_id: b.ticket_id, event_kind: b.event_kind,
      title: b.title ?? `${ticket.ticket_number ?? 'Ticket'} · ${ticket.title ?? ticket.customer_name ?? ''}`,
      description: b.description ?? `Erstellt aus Ticket ${ticket.ticket_number ?? b.ticket_id}`,
      start_at: start.toISOString(), end_at: end.toISOString(), department_id: escDeptId, status: 'planned',
      priority: normalizePriority(b.priority ?? ticket.priority),
      customer_name: b.customer_name ?? ticket.customer_name, customer_email: b.customer_email ?? ticket.customer_email,
      customer_phone: b.customer_phone ?? ticket.customer_phone, address: b.address ?? ticket.customer_address ?? null,
      location: b.location ?? null, internal_note: b.internal_note ?? null, external_note: b.external_note ?? null,
      resource_id: resourceId, assigned_user_id: assignedUserId, requires_confirmation: b.requires_confirmation,
      confirmation_status: b.requires_confirmation ? 'pending' : 'not_required', confirmation_token: token,
      confirmation_token_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      appointment_status: b.requires_confirmation ? 'bestaetigung_ausstehend' : 'geplant', source: 'ticket', created_by: user.id,
    }).select('id').single();
    if (evErr || !ev) return safeError(cors, evErr ?? 'event insert failed');

    await admin.from('ticket_history').insert({
      ticket_id: b.ticket_id, action: 'appointment_created', field: 'event_id', new_value: ev.id,
      meta: { event_kind: b.event_kind, start_at: start.toISOString(), actor: user.id },
    });

    const links = {
      confirm: `${PUBLIC_BASE}/termin/bestaetigen/${token}`,
      reschedule: `${PUBLIC_BASE}/termin/verschieben/${token}`,
      cancel: `${PUBLIC_BASE}/termin/ablehnen/${token}`,
    };
    let emailStatus: 'sent' | 'skipped' | 'failed' = 'skipped';
    // Nur an die gespeicherte Ticketadresse, nie an eine im Request übergebene Adresse
    if (ticket.customer_email) {
      const dateStr = start.toLocaleString('de-DE', { timeZone: 'Europe/Berlin', dateStyle: 'full', timeStyle: 'short' });
      const num = escapeHtml(ticket.ticket_number ?? '');
      const html = `<div style="font-family:Inter,Arial,sans-serif;font-size:14px;color:#111;line-height:1.55;max-width:560px">
<p>Guten Tag${ticket.customer_name ? ' ' + escapeHtml(ticket.customer_name) : ''},</p>
<p>zu Ihrer Anfrage <strong>${num}</strong> ${ticket.title ? '„' + escapeHtml(ticket.title) + '“' : ''} schlagen wir folgenden Termin vor:</p>
<p style="font-size:16px;font-weight:600;margin:16px 0">${escapeHtml(dateStr)}</p>
<p>Bitte wählen Sie eine Option:</p>
<p style="margin:20px 0">
<a href="${links.confirm}" style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin-right:6px">Termin bestätigen</a>
<a href="${links.reschedule}" style="background:#f59e0b;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;margin-right:6px">Verschieben</a>
<a href="${links.cancel}" style="background:#dc2626;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Ablehnen</a>
</p>
<p style="color:#6b7280;font-size:12px;margin-top:24px">Die Links sind 30 Tage gültig. Bei Fragen antworten Sie einfach auf diese E-Mail.</p></div>`;
      try {
        const resp = await deps.sendMail({
          to_email: ticket.customer_email, from_email: 'service@alixwork.de',
          subject: `Terminvorschlag zu ${ticket.ticket_number ?? 'Ihrem Ticket'} – bitte bestätigen`, body_html: html, ticket_id: b.ticket_id,
        }, req.headers.get('authorization') ?? '');
        if (resp.error) throw resp.error;
        emailStatus = 'sent';
        await admin.from('ticket_history').insert({
          ticket_id: b.ticket_id, action: 'appointment_email_sent', field: 'customer_email', new_value: ticket.customer_email,
          meta: { event_id: ev.id, actor: user.id },
        });
      } catch (mailErr) {
        emailStatus = 'failed';
        console.error('appointment email failed', mailErr instanceof Error ? mailErr.message : String(mailErr));
      }
    }
    return jsonResponse(cors, { success: true, event_id: ev.id, token, links, email: { status: emailStatus, error: emailStatus === 'failed' ? 'E-Mail konnte nicht gesendet werden' : null } });
  } catch (err) {
    return safeError(cors, err);
  }
}
