// ALIX COLLECT – Öffentliches Kundenportal für Zahl-Links (kein Login)
// GET-artig via {token} -> offene Posten; Aktionen: ratenantrag, zahlung_angekuendigt
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const body = await req.json().catch(() => ({}));
    const token = String(body?.token ?? '').trim();
    const action = String(body?.action ?? 'view');
    if (!token || token.length < 20) return json({ error: 'Ungültiger Link' }, 400);

    const { data: link } = await admin
      .from('collect_payment_links')
      .select('*')
      .eq('token', token)
      .maybeSingle();

    if (!link) return json({ error: 'Link nicht gefunden' }, 404);
    if (link.expires_at && new Date(link.expires_at) < new Date()) return json({ error: 'Dieser Link ist abgelaufen' }, 410);
    if (link.status === 'cancelled') return json({ error: 'Dieser Link wurde deaktiviert' }, 410);

    const { data: items } = await admin
      .from('collect_case_items')
      .select('invoice_number, invoice_date, due_date, balance, currency, days_overdue')
      .eq('case_id', link.case_id)
      .gt('balance', 0)
      .order('due_date');

    if (action === 'view') {
      if (!link.opened_at) {
        await admin.from('collect_payment_links').update({ opened_at: new Date().toISOString() }).eq('id', link.id);
        await admin.from('collect_events').insert({
          case_id: link.case_id,
          event_type: 'payment_link_opened',
          channel: 'portal',
          direction: 'inbound',
          subject: 'Kunde hat den Zahlungslink geöffnet',
          automated: true,
        });
      }
      return json({
        success: true,
        customer_name: link.customer_name,
        amount: link.amount,
        currency: link.currency ?? 'EUR',
        allow_installments: link.allow_installments,
        expires_at: link.expires_at,
        status: link.status,
        items: items ?? [],
      });
    }

    if (action === 'promise') {
      const date = String(body?.date ?? '').slice(0, 10);
      const amount = Number(body?.amount ?? link.amount ?? 0);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Bitte ein gültiges Datum angeben' }, 400);
      if (!(amount > 0)) return json({ error: 'Bitte einen gültigen Betrag angeben' }, 400);

      await admin.from('collect_promises').insert({
        case_id: link.case_id,
        promised_date: date,
        amount,
        currency: link.currency ?? 'EUR',
        status: 'open',
        source: 'portal',
        note: 'Zahlungszusage über Kundenportal',
      });
      await admin.from('collect_events').insert({
        case_id: link.case_id,
        event_type: 'promise_created',
        channel: 'portal',
        direction: 'inbound',
        subject: `Kunde sagt Zahlung zu: ${amount} zum ${date}`,
        automated: true,
      });
      await admin.from('collect_payment_links').update({ status: 'promised' }).eq('id', link.id);
      return json({ success: true, message: 'Vielen Dank – Ihre Zahlungszusage wurde erfasst.' });
    }

    if (action === 'installment_request') {
      if (!link.allow_installments) return json({ error: 'Ratenzahlung ist für diesen Vorgang nicht freigegeben' }, 403);
      const months = Math.min(Math.max(Number(body?.months ?? 3), 2), 24);
      const note = String(body?.note ?? '').slice(0, 500);
      const total = Number(link.amount ?? 0);

      await admin.from('collect_tasks').insert({
        case_id: link.case_id,
        task_type: 'installment_request',
        title: `Ratenzahlungsantrag: ${months} Raten (${total})`,
        description: `Kundenantrag über Portal.${note ? ` Anmerkung: ${note}` : ''}`,
        priority: 'high',
        status: 'open',
        due_date: new Date().toISOString().slice(0, 10),
      });
      await admin.from('collect_events').insert({
        case_id: link.case_id,
        event_type: 'installment_requested',
        channel: 'portal',
        direction: 'inbound',
        subject: `Kunde beantragt Ratenzahlung über ${months} Monate`,
        body: note || null,
        automated: true,
      });
      await admin.from('collect_payment_links').update({ status: 'installment_requested' }).eq('id', link.id);
      return json({ success: true, message: 'Ihr Ratenzahlungsantrag ist eingegangen. Wir melden uns kurzfristig.' });
    }

    return json({ error: 'Unbekannte Aktion' }, 400);
  } catch (e: any) {
    console.error('collect-portal-pay error', e);
    return json({ error: e?.message ?? 'Unbekannter Fehler' }, 500);
  }
});
