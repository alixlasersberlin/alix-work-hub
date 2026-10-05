export type TicketKind = 'neu' | 'vorgang' | 'auto';

export interface TicketKindInput {
  id: string;
  created_at: string;
  customer_email?: string | null;
  customer_name?: string | null;
  title?: string | null;
  subject?: string | null;
  repair_order_id?: string | null;
  merged_into_ticket_id?: string | null;
  last_agent_reply_at?: string | null;
}

const AUTO_SENDER = /(^|[<\s"])(no-?reply|do-?not-?reply|mailer-daemon|postmaster|notifications?|notify|alerts?|newsletter|news|bounce|system|automat|info-noreply)[^@]*@/i;
const AUTO_SUBJECT = /(automatische antwort|auto(matic)?[- ]?reply|abwesenheit|out of office|delivery status|unzustellbar|undeliverable|bestätigen sie ihre|registrierung|verify your|verification code|bestätigungscode|newsletter|passwort zurücksetzen|password reset|\[kopie\])/i;
const REPLY_SUBJECT = /^\s*(re|aw|wg|fw|fwd|antw)\s*:/i;

const norm = (e?: string | null) => {
  if (!e) return '';
  const m = e.match(/<([^>]+)>/);
  return (m ? m[1] : e).trim().toLowerCase();
};

export function isAutoTicket(t: TicketKindInput): boolean {
  const email = t.customer_email || '';
  const subj = `${t.subject || ''} ${t.title || ''}`;
  return AUTO_SENDER.test(` ${email}`) || AUTO_SUBJECT.test(subj);
}

/** Ordnet Tickets automatisch zu: neue Kundenanfrage, bestehender Vorgang oder automatische Meldung. */
export function classifyTickets(rows: TicketKindInput[]): Record<string, TicketKind> {
  const firstByEmail: Record<string, { id: string; t: number }> = {};
  for (const r of rows) {
    const e = norm(r.customer_email);
    if (!e) continue;
    const t = new Date(r.created_at).getTime();
    if (!firstByEmail[e] || t < firstByEmail[e].t) firstByEmail[e] = { id: r.id, t };
  }
  const out: Record<string, TicketKind> = {};
  for (const r of rows) {
    if (isAutoTicket(r)) { out[r.id] = 'auto'; continue; }
    const e = norm(r.customer_email);
    const subj = r.subject || r.title || '';
    const existing =
      !!r.repair_order_id ||
      !!r.merged_into_ticket_id ||
      !!r.last_agent_reply_at ||
      REPLY_SUBJECT.test(subj) ||
      (!!e && firstByEmail[e] && firstByEmail[e].id !== r.id);
    out[r.id] = existing ? 'vorgang' : 'neu';
  }
  return out;
}
