import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { applySystemCopies } from '../_shared/global-bcc.ts';
import { recoverable, key, address } from './policy.ts';

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const api = Deno.env.get('LOVABLE_API_KEY');
    const connector = Deno.env.get('RESEND_API_KEY');
    if (!url || !anon || !service || !api || !connector) return reply({ error: 'Versandzugang fehlt' }, 500);
    const auth = req.headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return reply({ error: 'Anmeldung erforderlich' }, 401);
    const caller = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: user, error: userError } = await caller.auth.getUser(auth.slice(7));
    if (userError || !user.user) return reply({ error: 'Anmeldung erforderlich' }, 401);
    const { data: allowed, error: roleError } = await caller.rpc('is_admin');
    if (roleError || !allowed) return reply({ error: 'Nur Administration' }, 403);
    const db = createClient(url, service);
    const headers = { Authorization: `Bearer ${api}`, 'X-Connection-Api-Key': connector, 'Content-Type': 'application/json' };
    const gateway = async (path: string, init?: RequestInit) => {
      await new Promise(r => setTimeout(r, 550));
      const res = await fetch(`https://connector-gateway.lovable.dev/resend${path}`, { ...init, headers: { ...headers, ...init?.headers } });
      const text = await res.text();
      if (!res.ok) { console.error(`Provider [${res.status}]: ${text}`); throw new Error(`Provider [${res.status}]: ${text}`); }
      return JSON.parse(text);
    };
    const body = await req.json();
    if (body.action === 'inventory') {
      const all: any[] = [];
      let after = '';
      let complete = false;
      for (let page = 0; page < 40; page++) {
        const result = await gateway(`/emails?limit=100${after ? `&after=${after}` : ''}`);
        all.push(...result.data);
        if (!result.has_more || !result.data.length || result.data.at(-1).created_at < '2026-10-01') { complete = true; break; }
        after = result.data.at(-1).id;
      }
      if (!complete) return reply({ error: 'Inventur unvollständig; kein Versand', count: all.length });
      const later = new Set<string>();
      const latest = new Map<string, any>();
      const candidates: any[] = [];
      for (const m of all) {
        const k = key(m);
        if (m.last_event !== 'suppressed' && m.last_event !== 'bounced' && m.last_event !== 'failed') later.add(k);
        if (recoverable(m) && !latest.has(k)) { latest.set(k, m); if (!later.has(k)) candidates.push(m); }
      }
      const { data: recovered, error } = await db.from('email_send_log').select('source_id').like('source_id', 'resend-%').gte('created_at', '2026-11-01');
      if (error) throw error;
      const known = new Set(recovered?.map(r => r.source_id.slice(7)));
      return reply({ complete, total: all.length, oldest: all.at(-1)?.created_at, suppressed: all.filter(recoverable).length, candidates: candidates.filter(m => !known.has(m.id)).map(m => ({ id: m.id, subject: m.subject, to: m.to, date: m.created_at })) });
    }
    if (body.action !== 'send' || !Array.isArray(body.ids) || body.ids.length < 1 || body.ids.length > 5 || body.ids.some((id: unknown) => typeof id !== 'string' || !/^[a-f0-9-]{36}$/i.test(id))) return reply({ error: 'Ungültige Versandliste' }, 400);
    const results: any[] = [];
    for (const id of body.ids) {
      try {
        const m = await gateway(`/emails/${id}`);
        if (!recoverable(m)) { results.push({ id, skipped: 'Keine freigegebene Oktober-Sperre' }); continue; }
        const { data: original, error: logError } = await db.from('email_send_log').select('*').eq('provider_message_id', id).limit(1).maybeSingle();
        if (logError) throw logError;
        // Financial letters require current evidence; historical random-key reminders cannot be safely replayed.
        if (/mahn|zahlungserinnerung|rechnung/i.test(m.subject) && !original) { results.push({ id, skipped: 'Aktuelle Forderungszuordnung fehlt' }); continue; }
        if (original?.template === 'finance-reminder' || /rücklastschrift|gebührenrechnung/i.test(m.subject)) { results.push({ id, skipped: 'Historischer Forderungsbetrag muss aktuell fachlich geprüft werden' }); continue; }
        if (/Anzahlung\s+/i.test(m.subject) || /Anzahlungsrechnung/i.test(m.subject)) {
          const order = m.subject.match(/(?:Anzahlung|Auftrag)\s+(\S+)/i)?.[1];
          const { data: dep, error } = await db.from('finance_deposits').select('id,open_amount,status,finance_lock').eq('order_number', order ?? '').gt('open_amount', 0).neq('status', 'storniert');
          if (error) throw error;
          if (dep?.length !== 1 || dep[0].finance_lock) { results.push({ id, skipped: 'Forderung nicht eindeutig offen oder gesperrt' }); continue; }
        }
        if (original?.template === 'ticket-csat') {
          const ticketId = original.source_id.replace(/^csat-/, '');
          const { data: survey, error } = await db.from('ticket_csat_surveys').select('expires_at,responded_at').eq('ticket_id', ticketId).maybeSingle();
          if (error) throw error;
          if (!survey || survey.responded_at || (survey.expires_at && new Date(survey.expires_at) < new Date())) { results.push({ id, skipped: 'Bewertungslink abgelaufen oder bereits beantwortet' }); continue; }
        }
        const attachments = await gateway(`/emails/${id}/attachments`);
        if (attachments.has_more || attachments.data.some((a: any) => !a.download_url || !a.filename)) { results.push({ id, skipped: 'Originalanhänge nicht vollständig' }); continue; }
        const payload: any = { from: m.from, to: m.to, subject: m.subject, html: m.html || undefined, text: m.text || undefined, reply_to: m.reply_to || undefined, cc: m.cc || undefined, bcc: m.bcc || undefined };
        payload.attachments = attachments.data.map((a: any) => ({ filename: a.filename, path: a.download_url }));
        applySystemCopies(payload);
        if (!payload.html && !payload.text) throw new Error('Originaltext fehlt');
        const recipient = address(m.to[0]);
        const source = `resend-${id}`;
        const { data: lock, error: lockError } = await db.from('email_send_log').insert({ source_id: source, recipient_email: recipient, subject: m.subject, template: original?.template ?? 'october-recovery', status: 'pending', metadata: { resend_of: id, requested_by: user.user.id, reason: 'Bestätigte Kopien-Sperre; Oktober-Nachversand' } }).select('id').single();
        if (lockError?.code === '23505') { results.push({ id, skipped: 'Wiederholung bereits reserviert oder versendet' }); continue; }
        if (lockError || !lock) throw lockError ?? new Error('Versandreservierung fehlt');
        const sent = await gateway('/emails', { method: 'POST', headers: { 'Idempotency-Key': source }, body: JSON.stringify(payload) });
        const { error: updateError } = await db.from('email_send_log').update({ provider_message_id: sent.id, status: 'sent', sent_at: new Date().toISOString() }).eq('id', lock.id);
        if (updateError) throw new Error(`Versand angenommen, Protokoll ungeklärt: ${sent.id}`);
        const { error: archiveError } = await db.from('mail_messages').insert({ to_email: recipient, from_email: address(m.from), subject: m.subject, body_html: m.html, body_text: m.text, status: 'sent', provider_message_id: sent.id, sent_at: new Date().toISOString(), created_by: user.user.id, direction: 'outbound', mailbox: 'sent' });
        results.push({ id, provider_id: sent.id, accepted: true, ...(archiveError ? { archive_error: archiveError.message } : {}) });
      } catch (e) { results.push({ id, error: String(e), no_automatic_retry: true }); }
    }
    return reply({ results });
  } catch (e) { return reply({ error: String(e) }, 500); }
});