// ECH · Renderer & Sender (Prompt 8)
// Deterministic placeholder rendering + a modular sender that logs every
// outbound message. Actual provider transports (SMTP, Twilio, WhatsApp Business,
// Teams, Zoom, Google Meet, Push) can be wired later without changing callers.

import type { EscAppointment } from '../types';
import type { EchChannel, EchLanguage, EchMessage } from './types';
import { appendMessage, resolveTemplate, getSettings, patchMessage } from './store';
import { buildIcsForAppointment } from '../ics';
import { publicUrl } from '../public-url';

export interface RenderContext {
  appointment?: EscAppointment;
  customerName?: string;
  employeeName?: string;
  department?: string;
  company?: string;
  meetingUrl?: string;
  meetingPassword?: string;
  extras?: Record<string, string>;
}

export function renderTemplate(source: string, ctx: RenderContext): string {
  const a = ctx.appointment;
  const map: Record<string, string> = {
    customer_name: ctx.customerName ?? a?.customerName ?? 'Kunde',
    appointment_date: a ? new Date(a.startAt).toLocaleDateString() : '',
    appointment_time: a ? new Date(a.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    employee_name: ctx.employeeName ?? '',
    department: ctx.department ?? a?.departmentId ?? '',
    company: ctx.company ?? 'AlixWorks',
    location: a?.location ?? a?.address ?? '',
    calendar_link: a ? publicUrl(`/appointment/${a.confirmationToken ?? a.id}.ics`) : '',
    confirmation_link: a?.confirmationToken ? publicUrl(`/appointment/${a.confirmationToken}`) : '',
    cancel_link: a?.confirmationToken ? publicUrl(`/appointment/cancel/${a.confirmationToken}`) : '',
    reschedule_link: a?.confirmationToken ? publicUrl(`/appointment/reschedule/${a.confirmationToken}`) : '',
    qr_code: a?.confirmationToken ? publicUrl(`/appointment/qr/${a.confirmationToken}`) : '',
    meeting_url: ctx.meetingUrl ?? '',
    meeting_password: ctx.meetingPassword ?? '',
    ...(ctx.extras ?? {}),
  };
  return source.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, k) => map[k] ?? '');
}

export interface SendInput {
  channel: EchChannel;
  templateSlug: string;
  language?: EchLanguage;
  recipient: string;
  ctx: RenderContext;
  refs?: EchMessage['refs'];
}

/** Queue an outbound message. Simulates async delivery and records status transitions. */
export function sendMessage(input: SendInput): EchMessage {
  const settings = getSettings();
  const lang = input.language ?? settings.defaultLanguage;
  const template = resolveTemplate(input.templateSlug, input.channel, lang);
  const subject = template?.subject ? renderTemplate(template.subject, input.ctx) : undefined;
  const body = template ? renderTemplate(template.body, input.ctx) : `(kein Template für ${input.templateSlug}/${input.channel}/${lang})`;

  const msg: EchMessage = {
    id: crypto.randomUUID(),
    channel: input.channel,
    templateSlug: input.templateSlug,
    language: lang,
    recipient: input.recipient,
    subject,
    body,
    status: 'queued',
    refs: input.refs,
    createdAt: new Date().toISOString(),
    retryCount: 0,
  };
  appendMessage(msg);

  // Real transport for email/calendar_invite via edge function; other channels remain simulated.
  if (input.channel === 'email' || input.channel === 'calendar_invite') {
    import('@/integrations/supabase/client').then(({ supabase }) =>
      supabase.functions.invoke('esc-send-email', {
        body: {
          template_slug: input.templateSlug,
          language: lang,
          recipient: input.recipient,
          context: (input.ctx.extras ?? {}),
          event_id: input.ctx.appointment?.id,
          subject, body,
        },
      }).then(({ error }) => {
        if (error) patchMessage(msg.id, { status: 'failed', error: error.message });
        else patchMessage(msg.id, { status: 'sent', sentAt: new Date().toISOString() });
      }).catch((e) => patchMessage(msg.id, { status: 'failed', error: e?.message }))
    );
  } else {
    setTimeout(() => {
      patchMessage(msg.id, { status: 'sent', sentAt: new Date().toISOString() });
      setTimeout(() => patchMessage(msg.id, { status: 'delivered' }), 400);
    }, 250);
  }

  return msg;
}

// ---- Meeting URL generation (deterministic placeholders) ---------------
// These are safe placeholder generators. Once Teams/Zoom/Meet are connected
// (see Integrations page), the same functions get replaced by real API calls.
export function generateMeetingUrl(provider: 'teams' | 'zoom' | 'google_meet', appointmentId: string) {
  const short = appointmentId.replace(/-/g, '').slice(0, 12);
  switch (provider) {
    case 'teams':
      return { url: `https://teams.microsoft.com/l/meetup-join/alixworks/${short}`, password: undefined };
    case 'zoom':
      return { url: `https://zoom.us/j/${short}`, password: Math.floor(100000 + Math.random() * 900000).toString() };
    case 'google_meet':
      return { url: `https://meet.google.com/${short.slice(0, 3)}-${short.slice(3, 7)}-${short.slice(7, 10)}`, password: undefined };
  }
}

// ---- ICS attachment helper (calendar invite channel) -------------------
export function buildIcsAttachment(a: EscAppointment) {
  return { filename: `${a.title || 'termin'}.ics`, mime: 'text/calendar', content: buildIcsForAppointment(a) };
}

// ---- Feed URL builders --------------------------------------------------
export function feedUrl(token: string, format: 'ics' | 'caldav' = 'ics') {
  return publicUrl(`/ech/feed/${token}.${format}`);
}
